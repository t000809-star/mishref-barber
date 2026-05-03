import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useBooking } from '../store/BookingContext'
import { serviceById } from '../data/services'
import { isoForOffset } from '../data/seedSlots'
import { formatDate, formatTime } from '../lib/format'

export default function SlotPicker() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const { slots } = useBooking()
  const serviceId = params.get('service') || ''
  const service = serviceById(serviceId)

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => isoForOffset(i)), [])
  const [activeDay, setActiveDay] = useState(days[0])

  if (!service) {
    return (
      <div className="pt-6">
        <p>Pick a service first.</p>
        <button onClick={() => nav('/services')} className="mt-4 underline">Back to services</button>
      </div>
    )
  }

  const daySlots = slots.filter(s => s.date === activeDay).sort((a, b) => a.time.localeCompare(b.time))

  return (
    <div className="pt-2">
      <p className="text-xs uppercase tracking-wider text-gold">{service.name} · {service.priceKwd} KWD</p>
      <h1 className="font-display text-3xl text-brand-dark mt-1">Pick a time</h1>

      <div className="mt-5 -mx-5 px-5 overflow-x-auto">
        <div className="flex gap-2 w-max pb-2">
          {days.map(d => {
            const active = d === activeDay
            return (
              <button
                key={d}
                onClick={() => setActiveDay(d)}
                className={`px-4 py-2 rounded-full text-sm whitespace-nowrap border transition ${
                  active
                    ? 'bg-brand text-cream border-brand'
                    : 'bg-white text-ink border-sand'
                }`}
              >
                {formatDate(d)}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        {daySlots.map(s => {
          const disabled = s.status !== 'open'
          return (
            <button
              key={s.id}
              disabled={disabled}
              onClick={() => nav(`/book?slot=${s.id}&service=${service.id}`)}
              className={`rounded-xl py-3 text-sm font-medium border transition ${
                disabled
                  ? 'bg-sand/60 text-muted border-sand line-through'
                  : 'bg-white text-brand-dark border-sand active:bg-brand active:text-cream'
              }`}
            >
              {formatTime(s.time)}
            </button>
          )
        })}
      </div>

      {daySlots.every(s => s.status !== 'open') && (
        <p className="mt-6 text-sm text-muted">Fully booked — try another day.</p>
      )}
    </div>
  )
}
