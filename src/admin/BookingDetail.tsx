import { Link, useNavigate, useParams } from 'react-router-dom'
import { useBooking } from '../store/BookingContext'
import { serviceById } from '../data/services'
import { formatLongDate, formatTime } from '../lib/format'

export default function BookingDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { bookings, slots, updateBookingStatus, deleteBooking } = useBooking()
  const booking = bookings.find(b => b.id === id)
  const slot = booking ? slots.find(s => s.id === booking.slotId) : undefined
  const service = booking ? serviceById(booking.serviceId) : undefined

  if (!booking || !slot || !service) {
    return (
      <div className="pt-6 text-cream/80">
        <p>Booking not found.</p>
        <Link to="/admin/bookings" className="underline mt-3 inline-block">Back to list</Link>
      </div>
    )
  }

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
        <Row k="Payment" v={booking.paid ? 'Paid online' : 'Pay in chair'} />
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
