// Verifies a Tap Payments charge with Tap directly and reconciles the
// booking. Called from the /payment/return page after Tap redirects back.
// Anon-callable: the redirect lives in the customer's browser. We never
// trust the client's claim of "paid" — we ask Tap.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { checkRateLimit } from '../_shared/rate-limit.ts'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405, cors)

  let bookingId: string
  let chargeId: string
  try {
    const body = await req.json()
    bookingId = String(body.bookingId ?? '')
    chargeId = String(body.chargeId ?? '')
  } catch {
    return json({ error: 'Body must be JSON: { bookingId, chargeId }' }, 400, cors)
  }
  if (!/^MBC-[A-Z0-9]{4}$/.test(bookingId)) return json({ error: 'Invalid booking ref' }, 400, cors)
  if (!chargeId.startsWith('chg_')) return json({ error: 'Invalid charge id' }, 400, cors)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const limited = await checkRateLimit(supabase, 'payment-verify', req)
  if (limited) return limited

  // Fetch the booking and confirm the charge id we recorded matches the one
  // the redirect handed back. Stops attackers from reconciling someone else's
  // paid charge against this booking.
  const { data: booking, error: bErr } = await supabase
    .from('bookings')
    .select('id, tap_charge_id, paid')
    .eq('id', bookingId)
    .maybeSingle()
  if (bErr) return json({ error: bErr.message }, 500, cors)
  if (!booking) return json({ error: 'Booking not found' }, 404, cors)
  if (booking.tap_charge_id !== chargeId) {
    return json({ error: 'Charge id does not belong to this booking' }, 400, cors)
  }

  const tapKey = Deno.env.get('TAP_SECRET_KEY')
  if (!tapKey) return json({ error: 'Tap not configured' }, 500, cors)

  const tapRes = await fetch(`https://api.tap.company/v2/charges/${chargeId}`, {
    headers: { Authorization: `Bearer ${tapKey}` },
  })
  const tapJson = await tapRes.json()
  if (!tapRes.ok) return json({ error: 'Tap retrieve failed', details: tapJson }, 502, cors)

  const status = String(tapJson.status ?? '')
  const captured = status === 'CAPTURED'

  // Idempotency: if this exact charge already captured and reconciled, return
  // success without re-writing bookings or appending another payments row.
  // Refreshing /payment/return is the common trigger. The tap_charge_id match
  // is enforced above (line 45-47), so we know the charge belongs here.
  if (captured && booking.paid && booking.tap_charge_id === chargeId) {
    return json({
      ok: true,
      bookingId,
      chargeId,
      status,
      paid: true,
    }, 200, cors)
  }

  if (captured && !booking.paid) {
    const { error: upErr } = await supabase
      .from('bookings')
      .update({ paid: true })
      .eq('id', bookingId)
    if (upErr) return json({ error: upErr.message }, 500, cors)
  }

  // Audit log: update the existing charge row with the final outcome.
  // Pull card / brand / failure details out of Tap's response.
  const card = tapJson.card ?? tapJson.source ?? {}
  const response = tapJson.response ?? {}
  const update = {
    status,
    amount: tapJson.amount ?? null,
    currency: tapJson.currency ?? null,
    payment_method: card.scheme ?? card.brand ?? card.payment_method ?? null,
    card_last4: card.last_four ?? card.last4 ?? null,
    card_brand: card.brand ?? card.scheme ?? null,
    failure_code: !captured ? (response.code ?? null) : null,
    failure_message: !captured ? (response.message ?? null) : null,
    raw: tapJson,
    updated_at: new Date().toISOString(),
  }
  const { data: existing } = await supabase
    .from('payments')
    .select('id')
    .eq('tap_id', chargeId)
    .eq('type', 'charge')
    .maybeSingle()

  if (existing) {
    await supabase.from('payments').update(update).eq('id', existing.id)
  } else {
    await supabase.from('payments').insert({
      booking_id: bookingId,
      type: 'charge',
      tap_id: chargeId,
      ...update,
    })
  }

  return json({
    ok: true,
    bookingId,
    chargeId,
    status,
    paid: captured || booking.paid,
  }, 200, cors)
})

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
