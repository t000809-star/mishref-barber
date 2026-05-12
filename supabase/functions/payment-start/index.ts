// Creates a Tap Payments charge for a booking and returns the hosted-checkout
// redirect URL. Anon-callable: the customer just made the booking and needs
// to pay. We trust the bookingId because the price comes from a static service
// table on the server, not from client input.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { checkRateLimit } from '../_shared/rate-limit.ts'

const SERVICES: Record<string, { name: string; priceKwd: number }> = {
  'classic-cut':     { name: 'Classic Cut',     priceKwd: 5 },
  'beard-sculpt':    { name: 'Beard Sculpt',    priceKwd: 3 },
  'hot-towel-shave': { name: 'Hot Towel Shave', priceKwd: 4 },
  'the-works':       { name: 'The Works',       priceKwd: 10 },
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  let bookingId: string
  let returnUrl: string
  try {
    const body = await req.json()
    bookingId = String(body.bookingId ?? '')
    returnUrl = String(body.returnUrl ?? '')
  } catch {
    return json({ error: 'Body must be JSON: { bookingId, returnUrl }' }, 400)
  }
  if (!/^MBC-[A-Z0-9]{4}$/.test(bookingId)) return json({ error: 'Invalid booking ref' }, 400)

  // returnUrl is handed to Tap as the post-checkout redirect target, so an
  // attacker-controlled value would let them land paying customers on a
  // phishing page. Restrict to an explicit allow-list of origins configured
  // via the ALLOWED_REDIRECT_ORIGINS function secret (comma-separated).
  const allowed = (Deno.env.get('ALLOWED_REDIRECT_ORIGINS') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (allowed.length === 0) return json({ error: 'Server misconfigured' }, 500)
  let parsedReturn: URL
  try {
    parsedReturn = new URL(returnUrl)
  } catch {
    return json({ error: 'Invalid return URL' }, 400)
  }
  if (!allowed.includes(parsedReturn.origin)) return json({ error: 'Invalid return URL' }, 400)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const limited = await checkRateLimit(supabase, 'payment-start', req)
  if (limited) return limited

  const { data: booking, error: bErr } = await supabase
    .from('bookings')
    .select('id, customer_name, phone, service_id, paid')
    .eq('id', bookingId)
    .maybeSingle()
  if (bErr) return json({ error: bErr.message }, 500)
  if (!booking) return json({ error: 'Booking not found' }, 404)
  if (booking.paid) return json({ error: 'Already paid' }, 409)

  const service = SERVICES[booking.service_id]
  if (!service) return json({ error: 'Unknown service' }, 400)

  const tapKey = Deno.env.get('TAP_SECRET_KEY')
  if (!tapKey) return json({ error: 'Tap not configured' }, 500)

  const [firstName, ...rest] = (booking.customer_name || 'Customer').split(/\s+/)
  const lastName = rest.join(' ') || 'Guest'
  const phoneDigits = String(booking.phone || '').replace(/[^\d]/g, '').slice(-8) || '99999999'

  const tapBody = {
    amount: service.priceKwd,
    currency: 'KWD',
    threeDSecure: true,
    save_card: false,
    description: `${service.name} — booking ${booking.id}`,
    statement_descriptor: 'Mishref Barber',
    metadata: { booking_id: booking.id, service_id: booking.service_id },
    reference: { transaction: booking.id, order: booking.id },
    customer: {
      first_name: firstName,
      last_name: lastName,
      phone: { country_code: 965, number: phoneDigits },
    },
    source: { id: 'src_all' },
    redirect: { url: `${returnUrl}?bookingId=${booking.id}` },
  }

  const tapRes = await fetch('https://api.tap.company/v2/charges/', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tapKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(tapBody),
  })
  const tapJson = await tapRes.json()
  if (!tapRes.ok) {
    return json({ error: 'Tap rejected the charge', details: tapJson }, 502)
  }

  const chargeId = tapJson.id as string
  const transactionUrl = tapJson.transaction?.url as string | undefined
  if (!chargeId || !transactionUrl) {
    return json({ error: 'Tap returned no transaction URL', details: tapJson }, 502)
  }

  const { error: upErr } = await supabase
    .from('bookings')
    .update({ tap_charge_id: chargeId })
    .eq('id', bookingId)
  if (upErr) return json({ error: upErr.message }, 500)

  // Audit log: this charge was initiated. We'll fill in card brand / last4
  // / final status when the customer comes back through payment-verify.
  await supabase.from('payments').insert({
    booking_id: bookingId,
    type: 'charge',
    tap_id: chargeId,
    amount: tapJson.amount ?? service.priceKwd,
    currency: tapJson.currency ?? 'KWD',
    status: tapJson.status ?? 'INITIATED',
    raw: tapJson,
  })

  return json({ ok: true, chargeId, redirectUrl: transactionUrl })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
