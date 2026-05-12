import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatLongDate, formatTime } from '../lib/format'
import { readMyBookings, removeMyBooking, type SavedBooking } from '../lib/myBookings'

// Customer-facing index of bookings remembered on this device. Each row is
// reconciled against the live `confirm-booking` edge function so a refund or
// admin status change is reflected here instead of going stale. The page is
// intentionally device-local: no auth, no server-side "my bookings" list —
// just whatever sits in mbc.myBookings.

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

type Row = {
  saved: SavedBooking
  // Live data, or null if the booking 404'd / errored. We keep the saved
  // row visible either way so the customer can choose to remove it.
  live: Receipt['booking'] | null
  missing: boolean
}

export default function MyBookings() {
  const [rows, setRows] = useState<Row[] | null>(null)

  useEffect(() => {
    let cancelled = false
    const saved = readMyBookings()
    if (saved.length === 0) {
      setRows([])
      return
    }
    ;(async () => {
      const results = await Promise.all(
        saved.map(async (s): Promise<Row> => {
          const { data, error } = await supabase.functions.invoke<Receipt>(
            'confirm-booking',
            { body: { bookingId: s.id, token: s.token } },
          )
          if (error || !data?.ok) {
            return { saved: s, live: null, missing: true }
          }
          return { saved: s, live: data.booking, missing: false }
        }),
      )
      if (!cancelled) setRows(results)
    })()
    return () => { cancelled = true }
  }, [])

  function handleRemove(id: string) {
    removeMyBooking(id)
    setRows(prev => (prev ? prev.filter(r => r.saved.id !== id) : prev))
  }

  if (rows === null) {
    return <p className="pt-10 text-sm text-muted">Loading…</p>
  }

  if (rows.length === 0) {
    return (
      <div className="pt-10 text-center">
        <h1 className="font-display text-3xl text-brand-dark">No bookings yet</h1>
        <p className="mt-3 text-muted text-sm">
          Anything you book on this device will show up here so you can come
          back and pay or check the time.
        </p>
        <Link
          to="/services"
          className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-brand text-cream font-medium py-4 active:scale-[.99] transition shadow-card"
        >
          Make a booking
        </Link>
      </div>
    )
  }

  // Newest first so the most recent walk-out is at the top.
  const sorted = [...rows].sort((a, b) =>
    b.saved.savedAt.localeCompare(a.saved.savedAt),
  )

  return (
    <div className="pt-4">
      <h1 className="font-display text-3xl text-brand-dark">My bookings</h1>
      <p className="mt-2 text-muted text-sm">
        Saved on this device. Tap one to pay or view the receipt.
      </p>

      <ul className="mt-6 space-y-3">
        {sorted.map(row => (
          <BookingCard key={row.saved.id} row={row} onRemove={handleRemove} />
        ))}
      </ul>
    </div>
  )
}

function BookingCard({ row, onRemove }: { row: Row; onRemove: (id: string) => void }) {
  const { saved, live, missing } = row
  const href = `/confirmed/${saved.id}?t=${encodeURIComponent(saved.token)}`

  if (missing) {
    return (
      <li className="rounded-2xl bg-white border border-sand p-4 shadow-card">
        <div className="text-xs uppercase tracking-wider text-gold">Booking ref</div>
        <div className="font-display text-lg text-brand-dark">{saved.id}</div>
        <p className="mt-2 text-sm text-muted">Not found — remove from list?</p>
        <button
          onClick={() => onRemove(saved.id)}
          className="mt-3 w-full rounded-full border border-sand text-ink font-medium py-2.5 active:scale-[.99] transition"
        >
          Remove from list
        </button>
      </li>
    )
  }

  if (!live) return null

  const cancelled = live.status === 'cancelled'
  const when =
    live.date && live.time
      ? `${formatLongDate(live.date)} · ${formatTime(live.time)}`
      : '—'

  return (
    <li className="rounded-2xl bg-white border border-sand p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-gold">Booking ref</div>
          <div className="font-display text-lg text-brand-dark">{live.id}</div>
        </div>
        {cancelled ? (
          <span className="shrink-0 text-[10px] uppercase tracking-widest text-muted bg-sand/60 rounded-full px-2 py-0.5">
            Cancelled
          </span>
        ) : live.paid ? (
          <span className="shrink-0 text-[10px] uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
            Paid
          </span>
        ) : (
          <span className="shrink-0 text-[10px] uppercase tracking-widest text-muted bg-cream border border-sand rounded-full px-2 py-0.5">
            Unpaid
          </span>
        )}
      </div>

      <div className="mt-3 space-y-1 text-sm">
        <Row k="Service" v={live.service} />
        <Row k="When" v={when} />
        {live.price_kwd != null && <Row k="Price" v={`${live.price_kwd} KWD`} />}
      </div>

      {cancelled ? (
        <button
          onClick={() => onRemove(saved.id)}
          className="mt-4 w-full rounded-full border border-sand text-ink font-medium py-2.5 active:scale-[.99] transition"
        >
          Remove from list
        </button>
      ) : (
        <Link
          to={href}
          className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-brand text-cream font-medium py-3 active:scale-[.99] transition"
        >
          {live.paid ? 'View receipt' : 'Pay now'}
        </Link>
      )}
    </li>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted">{k}</span>
      <span className="text-ink text-right">{v}</span>
    </div>
  )
}
