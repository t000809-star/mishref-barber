// Admin-only edge function: refunds a captured Tap charge tied to a booking,
// logs the refund to the payments table, and clears bookings.paid if the
// refund was a full refund.
//
// Auth: requires a Supabase Auth JWT (any signed-in user counts as admin in
// this single-user app).

import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  // Verify the JWT.
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Missing bearer token' }, 401)
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData.user) return json({ error: 'Unauthorized' }, 401)

  const adminEmail = Deno.env.get('ADMIN_EMAIL')
  if (!adminEmail) return json({ error: 'Server misconfigured' }, 500)
  if (userData.user.email?.toLowerCase() !== adminEmail.toLowerCase()) {
    return json({ error: 'Forbidden' }, 403)
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
    return json({ error: 'Body must be JSON: { bookingId, amount?, reason? }' }, 400)
  }
  if (!/^MBC-[A-Z0-9]{4}$/.test(bookingId)) return json({ error: 'Invalid booking ref' }, 400)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: booking, error: bErr } = await admin
    .from('bookings')
    .select('id, tap_charge_id, paid, customer_name')
    .eq('id', bookingId)
    .maybeSingle()
  if (bErr) return json({ error: bErr.message }, 500)
  if (!booking) return json({ error: 'Booking not found' }, 404)
  if (!booking.tap_charge_id) return json({ error: 'No charge on this booking' }, 400)
  if (!booking.paid) return json({ error: 'Booking is not paid' }, 400)

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
  if (remaining <= 0) return json({ error: 'Already fully refunded' }, 400)

  const refundAmount = amount != null ? amount : remaining
  if (refundAmount <= 0) return json({ error: 'Amount must be positive' }, 400)
  if (toFils(refundAmount) > toFils(remaining)) {
    return json({ error: `Cannot refund more than ${remaining}` }, 400)
  }

  const tapKey = Deno.env.get('TAP_SECRET_KEY')
  if (!tapKey) return json({ error: 'Tap not configured' }, 500)

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
  if (!tapRes.ok) return json({ error: 'Tap refund failed', details: tapJson }, 502)

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
  })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
