// Admin-only edge function: refunds a captured Tap charge tied to a booking,
// logs the refund to the payments table, and clears bookings.paid if the
// refund was a full refund.
//
// Auth: requires a Supabase Auth JWT (any signed-in user counts as admin in
// this single-user app).

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405, cors)

  // Verify the JWT.
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Missing bearer token' }, 401, cors)
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData.user) return json({ error: 'Unauthorized' }, 401, cors)

  const adminEmail = Deno.env.get('ADMIN_EMAIL')
  if (!adminEmail) return json({ error: 'Server misconfigured' }, 500, cors)
  if (userData.user.email?.toLowerCase() !== adminEmail.toLowerCase()) {
    return json({ error: 'Forbidden' }, 403, cors)
  }

  let bookingId: string
  let amount: number | null
  let reason: string | null
  try {
    const body = await req.json()
    bookingId = String(body.bookingId ?? '')
    amount = body.amount != null ? Number(body.amount) : null
    reason = body.reason ? String(body.reason) : null
  } catch {
    return json({ error: 'Body must be JSON: { bookingId, amount?, reason? }' }, 400, cors)
  }
  if (!/^MBC-[A-Z0-9]{4}$/.test(bookingId)) return json({ error: 'Invalid booking ref' }, 400, cors)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: booking, error: bErr } = await admin
    .from('bookings')
    .select('id, tap_charge_id, paid, customer_name')
    .eq('id', bookingId)
    .maybeSingle()
  if (bErr) return json({ error: bErr.message }, 500, cors)
  if (!booking) return json({ error: 'Booking not found' }, 404, cors)
  if (!booking.tap_charge_id) return json({ error: 'No charge on this booking' }, 400, cors)
  if (!booking.paid) return json({ error: 'Booking is not paid' }, 400, cors)

  // Pull the original captured charge — refund amount can't exceed it.
  const { data: charge } = await admin
    .from('payments')
    .select('amount, currency')
    .eq('tap_id', booking.tap_charge_id)
    .eq('type', 'charge')
    .maybeSingle()

  // KWD has 3 decimals (fils). Compare/sum money in integer fils to avoid
  // floating-point drift that would otherwise let a refund exceed `remaining`
  // by up to 1 fils per call.
  const toFils = (kwd: number) => Math.round(kwd * 1000)

  // Sum existing refunds (so admin can't over-refund across multiple calls).
  const { data: priorRefunds } = await admin
    .from('payments')
    .select('amount')
    .eq('booking_id', bookingId)
    .eq('type', 'refund')
  const refundedFils = (priorRefunds ?? []).reduce(
    (sum, r) => sum + toFils(Number(r.amount ?? 0)),
    0,
  )
  const original = Number(charge?.amount ?? 0)
  const remaining = Math.max(0, (toFils(original) - refundedFils) / 1000)
  if (remaining <= 0) return json({ error: 'Already fully refunded' }, 400, cors)

  const refundAmount = amount != null ? amount : remaining
  if (refundAmount <= 0) return json({ error: 'Amount must be positive' }, 400, cors)
  if (toFils(refundAmount) > toFils(remaining)) {
    return json({ error: `Cannot refund more than ${remaining}` }, 400, cors)
  }

  const tapKey = Deno.env.get('TAP_SECRET_KEY')
  if (!tapKey) return json({ error: 'Tap not configured' }, 500, cors)

  const tapBody = {
    charge_id: booking.tap_charge_id,
    amount: refundAmount,
    currency: charge?.currency ?? 'KWD',
    reason: reason ?? 'requested_by_customer',
    metadata: { booking_id: bookingId },
    reference: { merchant: bookingId },
  }
  const tapRes = await fetch('https://api.tap.company/v2/refunds/', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tapKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(tapBody),
  })
  const tapJson = await tapRes.json()
  if (!tapRes.ok) return json({ error: 'Tap refund failed', details: tapJson }, 502, cors)

  await admin.from('payments').insert({
    booking_id: bookingId,
    type: 'refund',
    tap_id: tapJson.id ?? null,
    related_charge_id: booking.tap_charge_id,
    amount: refundAmount,
    currency: tapJson.currency ?? charge?.currency ?? 'KWD',
    status: tapJson.status ?? 'REFUNDED',
    failure_message: reason,
    raw: tapJson,
  })

  // If the booking is now fully refunded, clear the paid flag.
  const totalRefundedFils = refundedFils + toFils(refundAmount)
  const fullyRefunded = totalRefundedFils >= toFils(original)
  if (fullyRefunded) {
    await admin.from('bookings').update({ paid: false }).eq('id', bookingId)
  }

  return json({
    ok: true,
    bookingId,
    refundId: tapJson.id ?? null,
    amount: refundAmount,
    fullyRefunded,
  }, 200, cors)
})

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
