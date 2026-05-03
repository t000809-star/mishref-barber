import { Link, useParams } from 'react-router-dom'
import { useBooking } from '../store/BookingContext'
import { serviceById } from '../data/services'
import { formatLongDate, formatTime } from '../lib/format'

export default function Confirmation() {
  const { id } = useParams()
  const { bookings, slots } = useBooking()
  const booking = bookings.find(b => b.id === id)
  const slot = booking ? slots.find(s => s.id === booking.slotId) : undefined
  const service = booking ? serviceById(booking.serviceId) : undefined

  if (!booking || !slot || !service) {
    return (
      <div className="pt-10 text-center">
        <p>We couldn't find that booking.</p>
        <Link to="/" className="underline mt-3 inline-block">Back to start</Link>
      </div>
    )
  }

  return (
    <div className="pt-4">
      <div className="text-center">
        <div className="mx-auto h-14 w-14 rounded-full bg-brand text-cream flex items-center justify-center text-2xl">✓</div>
        <h1 className="font-display text-3xl text-brand-dark mt-4">You're booked.</h1>
        <p className="text-muted text-sm mt-1">We'll text {booking.phone} if anything changes.</p>
      </div>

      <div className="mt-6 rounded-2xl bg-white border border-sand p-5 shadow-card">
        <div className="text-xs uppercase tracking-wider text-gold">Booking ref</div>
        <div className="font-display text-2xl text-brand-dark">{booking.id}</div>

        <hr className="my-4 border-sand" />

        <Row k="Service" v={service.name} />
        <Row k="When" v={`${formatLongDate(slot.date)} · ${formatTime(slot.time)}`} />
        <Row k="Duration" v={`${service.durationMin} min`} />
        <Row k="Price" v={`${service.priceKwd} KWD (pay in chair)`} />
        <Row k="Name" v={booking.customerName} />
        {booking.notes && <Row k="Notes" v={booking.notes} />}
      </div>

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
