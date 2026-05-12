// Postgres-backed fixed-window rate limiter shared by the anon-callable edge
// functions (confirm-booking, payment-start, payment-verify). See migration
// 0011_rate_limits.sql for the backing table. Fails OPEN on any DB error so
// genuine traffic isn't blocked by infra hiccups — the trade-off is that a
// Postgres outage temporarily disables the throttle, which we'd rather have
// than the alternative (locking real customers out during an outage).
//
// Usage (inside an edge function):
//
//   const limited = await checkRateLimit(supabase, 'confirm-booking', req)
//   if (limited) return limited
//
// where `limited` is either null (allowed) or a fully-formed 429 Response.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from './cors.ts'

export const RATE_LIMIT_MAX = 30        // requests per window
export const RATE_LIMIT_WINDOW_SEC = 60 // window length in seconds

/** Extract the client IP from a request. Supabase forwards via
 * x-forwarded-for, which may be a comma-separated list — first entry is the
 * original client. Falls back to a shared "unknown" bucket so callers with
 * no IP header still get throttled (at the cost of sharing one bucket; small
 * DoS-by-association risk we accept for now). */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (!xff) return 'unknown'
  const first = xff.split(',')[0]?.trim()
  return first || 'unknown'
}

/** Returns a 429 Response if the caller is over the limit, otherwise null.
 * Always returns null on internal errors (fail-open). */
export async function checkRateLimit(
  supabase: SupabaseClient,
  funcName: string,
  req: Request,
  opts: { max?: number; windowSec?: number } = {},
): Promise<Response | null> {
  const max = opts.max ?? RATE_LIMIT_MAX
  const windowSec = opts.windowSec ?? RATE_LIMIT_WINDOW_SEC
  const key = `${funcName}:${clientIp(req)}`
  const now = new Date()
  const nowMs = now.getTime()

  try {
    const { data: row, error: selErr } = await supabase
      .from('rate_limits')
      .select('count, window_started')
      .eq('key', key)
      .maybeSingle()
    if (selErr) {
      console.error('[rate-limit] select failed, failing open:', selErr.message)
      return null
    }

    if (!row) {
      // First request for this key — insert a fresh window. If two requests
      // race here one of the inserts will lose to the PK; we treat that as
      // "allowed" too (worst case the loser gets one free request).
      const { error: insErr } = await supabase
        .from('rate_limits')
        .insert({ key, count: 1, window_started: now.toISOString() })
      if (insErr) {
        console.error('[rate-limit] insert failed, failing open:', insErr.message)
      }
      return null
    }

    const windowStartedMs = new Date(row.window_started).getTime()
    const ageSec = (nowMs - windowStartedMs) / 1000

    if (ageSec >= windowSec) {
      // Window expired — reset it and let this request through as count=1.
      const { error: upErr } = await supabase
        .from('rate_limits')
        .update({ count: 1, window_started: now.toISOString() })
        .eq('key', key)
      if (upErr) {
        console.error('[rate-limit] reset failed, failing open:', upErr.message)
      }
      return null
    }

    if (row.count >= max) {
      const retryAfter = Math.max(1, Math.ceil(windowSec - ageSec))
      return new Response(
        JSON.stringify({ error: 'Too many requests' }),
        {
          status: 429,
          headers: {
            ...corsHeaders(req),
            'Content-Type': 'application/json',
            'Retry-After': String(retryAfter),
          },
        },
      )
    }

    const { error: incErr } = await supabase
      .from('rate_limits')
      .update({ count: row.count + 1 })
      .eq('key', key)
    if (incErr) {
      console.error('[rate-limit] increment failed, failing open:', incErr.message)
    }
    return null
  } catch (e) {
    console.error('[rate-limit] unexpected error, failing open:', e)
    return null
  }
}
