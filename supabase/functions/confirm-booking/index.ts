// Customer-facing edge function: returns a friendly confirmation receipt
// for a booking the customer just made. Reads with the service role so RLS
// doesn't block (the customer can't SELECT bookings directly).

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { checkRateLimit } from '../_shared/rate-limit.ts'

const SERVICES: Record<string, { name: string; durationMin: number; priceKwd: number }> = {
  'classic-cut':     { name: 'Classic Cut',     durationMin: 30, priceKwd: 5 },
  'beard-sculpt':    { name: 'Beard Sculpt',    durationMin: 30, priceKwd: 3 },
  'hot-towel-shave': { name: 'Hot Towel Shave', durationMin: 45, priceKwd: 4 },
  'the-works':       { name: 'The Works',       durationMin: 60, priceKwd: 10 },
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  let bookingId: string
  try {
    const body = await req.json()
    bookingId = String(body.bookingId ?? '')
  } catch {
    return json({ error: 'Body must be JSON: { bookingId }' }, 400)
  }
  if (!/^MBC-[A-Z0-9]{4}$/.test(bookingId)) {
    return json({ error: 'Invalid booking ref' }, 400)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const limited = await checkRateLimit(supabase, 'confirm-booking', req)
  if (limited) return limited

  // Note: customer_name and phone are intentionally NOT selected or returned.
  // This endpoint is anon-callable and the booking ref is a short
  // alphanumeric (~1M keyspace), so returning PII here would let anyone
  // enumerate refs and scrape the customer directory. The confirmation page
  // reads the customer's own name/phone from local React state (the form
  // they just submitted / BookingContext), not from this response.
  const { data: booking, error: bErr } = await supabase
    .from('bookings')
    .select('id, service_id, slot_id, notes, created_at, status, paid')
    .eq('id', bookingId)
    .maybeSingle()
  if (bErr) return json({ error: bErr.message }, 500)
  if (!booking) return json({ error: 'Booking not found' }, 404)

  const { data: slot, error: sErr } = await supabase
    .from('slots')
    .select('date, time')
    .eq('id', booking.slot_id)
    .maybeSingle()
  if (sErr) return json({ error: sErr.message }, 500)

  const service = SERVICES[booking.service_id]

  const message =
    `You're booked at Mishref Barber Co. ` +
    `for ${service?.name ?? booking.service_id} on ${slot?.date} at ${slot?.time}. ` +
    `Ref: ${booking.id}. See you then.`

  return json({
    ok: true,
    ref: booking.id,
    message,
    booking: {
      id: booking.id,
      service: service?.name ?? booking.service_id,
      duration_min: service?.durationMin ?? null,
      price_kwd: service?.priceKwd ?? null,
      date: slot?.date ?? null,
      time: slot?.time ?? null,
      status: booking.status,
      paid: booking.paid ?? false,
    },
  })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
