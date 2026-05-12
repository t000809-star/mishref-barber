import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatLongDate, formatTime } from '../lib/format'
import { useBooking } from '../store/BookingContext'
import { findTokenForBooking } from '../lib/myBookings'

// The confirm-booking edge function intentionally omits customer_name and
// phone — those would let an anon caller enumerate the short booking-ref
// keyspace and scrape the customer directory. We read the customer's own
// name/phone from local React state (BookingContext), populated when the
// booking was just created in this browser session. If a user deep-links
// back to /confirmed/:id later (fresh page load, RLS hides bookings from
// anon), localBooking will be undefined — we just hide the Name row and
// drop the phone reference rather than displaying someone else's data.
type Receipt = {
  ok: true
  ref: string
  message: string
  booking: {
    id: string
    service: string
    duration_min: number | null
    price_kwd: number | null
    date: string | null
    time: string | null
    status: string
    paid: boolean
    notes?: string | null
  }
}

export default function Confirmation() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const { bookings } = useBooking()
  const localBooking = bookings.find(b => b.id === id)
  // Prefer the token in the URL (set by BookingForm right after creation,
  // and what a refresh / share / bookmark will preserve). Fall back to the
  // device-local stash so a customer who somehow lands here with a bare URL
  // still gets in. If neither is present, we render an explanatory message
  // below instead of hitting the edge function — it would just 404.
  const token = useMemo(() => {
    if (!id) return null
    return searchParams.get('t') || findTokenForBooking(id) || null
  }, [id, searchParams])
  const [data, setData] = useState<Receipt | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [payError, setPayError] = useState<string | null>(null)
  const [paying, setPaying] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!id) {
      setError('Missing booking reference.')
      setLoading(false)
      return
    }
    if (!token) {
      // No token available anywhere on this device — don't bother calling
      // the edge function. We surface a clearer message than a silent 404.
      setLoading(false)
      return
    }
    ;(async () => {
      const { data, error } = await supabase.functions.invoke<Receipt>('confirm-booking', {
        body: { bookingId: id, token },
      })
      if (cancelled) return
      if (error) setError(error.message)
      else if (!data?.ok) setError('Booking not found.')
      else setData(data)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [id, token])

  if (loading) return <p className="pt-10 text-sm text-muted">Confirming your booking…</p>
  if (!token) {
    return (
      <div className="pt-10 text-center">
        <p>We can't find your booking from this device — open it from the original link.</p>
        <Link to="/" className="underline mt-3 inline-block">Back to start</Link>
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="pt-10 text-center">
        <p>We couldn't confirm that booking{error ? `: ${error}` : '.'}</p>
        <Link to="/" className="underline mt-3 inline-block">Back to start</Link>
      </div>
    )
  }

  const b = data.booking
  return (
    <div className="pt-4">
      <div className="text-center">
        <div className="mx-auto h-14 w-14 rounded-full bg-brand text-cream flex items-center justify-center text-2xl">✓</div>
        <h1 className="font-display text-3xl text-brand-dark mt-4">You're booked.</h1>
        <p className="text-muted text-sm mt-1">
          {localBooking?.phone
            ? `We'll text ${localBooking.phone} if anything changes.`
            : `We'll text you if anything changes.`}
        </p>
      </div>

      <div className="mt-6 rounded-2xl bg-white border border-sand p-5 shadow-card">
        <div className="text-xs uppercase tracking-wider text-gold">Booking ref</div>
        <div className="font-display text-2xl text-brand-dark">{b.id}</div>

        <hr className="my-4 border-sand" />

        <Row k="Service" v={b.service} />
        {b.date && b.time && <Row k="When" v={`${formatLongDate(b.date)} · ${formatTime(b.time)}`} />}
        {b.duration_min != null && <Row k="Duration" v={`${b.duration_min} min`} />}
        {b.price_kwd != null && <Row k="Price" v={`${b.price_kwd} KWD (pay in chair)`} />}
        {localBooking?.customerName && <Row k="Name" v={localBooking.customerName} />}
        {b.notes && <Row k="Notes" v={b.notes} />}
      </div>

      <div className="mt-4 rounded-2xl bg-cream border border-sand p-4 text-sm text-ink">
        <div className="text-xs uppercase tracking-wider text-muted mb-1">Confirmation</div>
        {data.message}
      </div>

      {b.paid ? (
        <div className="mt-4 rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
          <div className="flex items-center gap-2">
            <span className="h-6 w-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">✓</span>
            <div className="text-sm font-medium text-emerald-800">Paid online</div>
          </div>
          <p className="mt-2 text-xs text-emerald-700">
            We received your {b.price_kwd ?? ''} KWD payment. Nothing else due — just show up.
          </p>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl bg-white border border-sand p-4">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-gold">Pay now (optional)</div>
              <div className="text-sm text-muted mt-1">Or pay in chair when you arrive.</div>
            </div>
            <span className="text-[10px] uppercase tracking-widest text-muted bg-sand/60 rounded-full px-2 py-0.5">test mode</span>
          </div>
          <button
            onClick={async () => {
              if (!id || paying) return
              setPayError(null)
              setPaying(true)
              const { data: res, error } = await supabase.functions.invoke<{ redirectUrl: string }>(
                'payment-start',
                { body: { bookingId: id, returnUrl: `${window.location.origin}/payment/return` } },
              )
              if (error || !res?.redirectUrl) {
                setPayError(error?.message ?? 'Could not start payment.')
                setPaying(false)
                return
              }
              window.location.href = res.redirectUrl
            }}
            disabled={paying}
            className="mt-3 w-full rounded-full bg-brand text-cream font-medium py-3 disabled:opacity-60"
          >
            {paying ? 'Redirecting…' : `Pay ${b.price_kwd ?? ''} KWD`}
          </button>
          {payError && <p className="mt-2 text-xs text-red-700">{payError}</p>}
        </div>
      )}

      <div className="mt-6 rounded-2xl bg-brand-dark text-cream p-5">
        <div className="font-display text-lg">What happens next</div>
        <ol className="mt-2 text-sm space-y-1.5 list-decimal list-inside text-cream/90">
          <li>Show up 5 min early — front door on Street 12.</li>
          <li>Khalid will greet you, hot towel first.</li>
          <li>Pay in chair — cash, KNET, or Apple Pay.</li>
        </ol>
      </div>

      <Link to="/" className="block mt-6 text-center text-brand underline">Done</Link>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted">{k}</span>
      <span className="text-ink text-right">{v}</span>
    </div>
  )
}
