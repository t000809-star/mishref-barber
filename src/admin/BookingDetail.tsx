import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useBooking } from '../store/BookingContext'
import { serviceById } from '../data/services'
import { formatLongDate, formatTime } from '../lib/format'
import { supabase } from '../lib/supabase'

type PaymentRow = {
  id: string
  type: 'charge' | 'refund'
  tap_id: string | null
  related_charge_id: string | null
  amount: number | null
  currency: string | null
  status: string | null
  payment_method: string | null
  card_last4: string | null
  card_brand: string | null
  failure_code: string | null
  failure_message: string | null
  created_at: string
}

export default function BookingDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { bookings, slots, updateBookingStatus, deleteBooking } = useBooking()
  const booking = bookings.find(b => b.id === id)
  const slot = booking ? slots.find(s => s.id === booking.slotId) : undefined
  const service = booking ? serviceById(booking.serviceId) : undefined

  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [paymentsLoading, setPaymentsLoading] = useState(true)
  const [refunding, setRefunding] = useState(false)
  const [refundError, setRefundError] = useState<string | null>(null)

  const reloadPayments = useCallback(async () => {
    if (!booking) return
    setPaymentsLoading(true)
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('booking_id', booking.id)
      .order('created_at', { ascending: false })
    if (!error && data) setPayments(data as PaymentRow[])
    setPaymentsLoading(false)
  }, [booking])

  useEffect(() => { void reloadPayments() }, [reloadPayments])

  if (!booking || !slot || !service) {
    return (
      <div className="pt-6 text-cream/80">
        <p>Booking not found.</p>
        <Link to="/admin/bookings" className="underline mt-3 inline-block">Back to list</Link>
      </div>
    )
  }

  const totalPaid = payments
    .filter(p => p.type === 'charge' && p.status === 'CAPTURED')
    .reduce((s, p) => s + Number(p.amount ?? 0), 0)
  const totalRefunded = payments
    .filter(p => p.type === 'refund')
    .reduce((s, p) => s + Number(p.amount ?? 0), 0)
  const remainingRefundable = Math.max(0, totalPaid - totalRefunded)

  const markDone = () => { void updateBookingStatus(booking.id, 'done') }
  const cancel = async () => {
    if (!confirm('Cancel this booking? The slot will be re-opened.')) return
    await updateBookingStatus(booking.id, 'cancelled')
    nav('/admin/bookings')
  }
  const remove = async () => {
    if (!confirm('Delete this booking permanently? This cannot be undone.')) return
    await deleteBooking(booking.id)
    nav('/admin/bookings')
  }
  const refund = async () => {
    if (!confirm(`Refund ${remainingRefundable} KWD to the customer?`)) return
    setRefundError(null)
    setRefunding(true)
    const { data, error } = await supabase.functions.invoke<{ ok: true }>(
      'payment-refund',
      { body: { bookingId: booking.id } },
    )
    if (error || !data) {
      setRefundError(error?.message ?? 'Refund failed')
    } else {
      await reloadPayments()
    }
    setRefunding(false)
  }

  return (
    <div className="pt-4">
      <Link to="/admin/bookings" className="text-cream/60 text-sm">← All bookings</Link>

      <div className="mt-3 flex items-baseline justify-between">
        <h1 className="font-display text-2xl text-cream">{booking.customerName}</h1>
        <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full border border-cream/30 text-cream/80">
          {booking.status}
        </span>
      </div>

      <div className="mt-4 panel rounded-2xl p-5 space-y-2 text-sm">
        <Row k="Ref" v={booking.id} />
        <Row k="Service" v={`${service.name} · ${service.durationMin} min`} />
        <Row k="When" v={`${formatLongDate(slot.date)} · ${formatTime(slot.time)}`} />
        <Row k="Phone" v={booking.phone} />
        {booking.notes && <Row k="Notes" v={booking.notes} />}
        <Row k="Price" v={`${service.priceKwd} KWD`} />
        <Row k="Payment" v={booking.paid ? `Paid online${totalRefunded > 0 ? ` (${totalRefunded} KWD refunded)` : ''}` : 'Pay in chair'} />
      </div>

      <div className="mt-5 panel rounded-2xl p-5">
        <div className="flex items-baseline justify-between mb-3">
          <div className="font-display text-cream">Payment history</div>
          <span className="text-[10px] uppercase tracking-widest text-cream/50">Tap audit log</span>
        </div>
        {paymentsLoading ? (
          <p className="text-cream/60 text-sm">Loading…</p>
        ) : payments.length === 0 ? (
          <p className="text-cream/60 text-sm">No payment activity yet.</p>
        ) : (
          <ul className="space-y-3">
            {payments.map(p => <PaymentItem key={p.id} p={p} />)}
          </ul>
        )}
      </div>

      <div className="mt-5 space-y-2">
        <a
          href={`tel:${booking.phone.replace(/[^\d+]/g, '')}`}
          className="block w-full text-center rounded-full bg-cream text-brand-dark font-medium py-3 active:scale-[.99] transition"
        >
          Call customer
        </a>
        {booking.status === 'pending' && (
          <button onClick={markDone}
            className="block w-full rounded-full bg-gold text-brand-dark font-medium py-3 active:scale-[.99] transition">
            Mark as done
          </button>
        )}
        {remainingRefundable > 0 && (
          <button
            onClick={refund}
            disabled={refunding}
            className="block w-full rounded-full border border-cream/50 text-cream font-medium py-3 active:scale-[.99] transition disabled:opacity-60"
          >
            {refunding ? 'Refunding…' : `Refund ${remainingRefundable} KWD`}
          </button>
        )}
        {refundError && <p className="text-xs text-red-300">{refundError}</p>}
        {booking.status !== 'cancelled' && (
          <button onClick={cancel}
            className="block w-full rounded-full border border-red-300/50 text-red-200 font-medium py-3 active:scale-[.99] transition">
            Cancel booking
          </button>
        )}
        {booking.status === 'cancelled' && (
          <button onClick={remove}
            className="block w-full rounded-full bg-red-600 text-cream font-medium py-3 active:scale-[.99] transition">
            Delete permanently
          </button>
        )}
      </div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-cream/60">{k}</span>
      <span className="text-cream text-right">{v}</span>
    </div>
  )
}

function PaymentItem({ p }: { p: PaymentRow }) {
  const dt = new Date(p.created_at)
  const stamp = dt.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  const isRefund = p.type === 'refund'
  const captured = p.status === 'CAPTURED'
  const tone =
    captured ? 'text-emerald-300' :
    isRefund ? 'text-cream/80' :
    p.status === 'INITIATED' ? 'text-cream/60' :
    'text-red-300'
  return (
    <li className="border-l-2 pl-3 border-cream/20">
      <div className="flex items-baseline justify-between gap-3">
        <div className={`text-sm font-medium ${tone}`}>
          {isRefund ? 'Refund' : 'Charge'}
          {p.amount != null && ` · ${p.amount} ${p.currency ?? 'KWD'}`}
        </div>
        <div className="text-cream/50 text-[11px] whitespace-nowrap">{stamp}</div>
      </div>
      <div className="text-cream/70 text-xs mt-0.5">
        {p.status ?? 'unknown'}
        {p.payment_method && ` · ${p.payment_method}`}
        {p.card_last4 && ` · •••• ${p.card_last4}`}
      </div>
      {p.tap_id && (
        <div className="text-cream/40 text-[10px] mt-0.5 font-mono break-all">{p.tap_id}</div>
      )}
      {p.failure_message && (
        <div className="text-red-300 text-xs mt-1">{p.failure_message}</div>
      )}
    </li>
  )
}
