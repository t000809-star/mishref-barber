import { useMemo, useState } from 'react'
import { useBooking } from '../store/BookingContext'
import { isoForOffset } from '../data/seedSlots'
import { formatDate, formatTime } from '../lib/format'

export default function SlotsManager() {
  const { slots, setSlotStatus, addSlot } = useBooking()
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => isoForOffset(i)), [])
  const [activeDay, setActiveDay] = useState(days[0])
  const [newTime, setNewTime] = useState('14:00')

  const daySlots = slots.filter(s => s.date === activeDay).sort((a, b) => a.time.localeCompare(b.time))

  return (
    <div className="pt-4">
      <h1 className="font-display text-3xl text-cream">Slot manager</h1>
      <p className="text-cream/60 text-sm mt-1">Tap a slot to open or close it. Booked slots can't be edited here.</p>

      <div className="mt-4 -mx-4 px-4 overflow-x-auto">
        <div className="flex gap-2 w-max pb-2">
          {days.map(d => {
            const active = d === activeDay
            return (
              <button
                key={d}
                onClick={() => setActiveDay(d)}
                className={`px-3.5 py-1.5 rounded-full text-sm whitespace-nowrap border transition ${
                  active ? 'bg-cream text-brand-dark border-cream' : 'text-cream/80 border-cream/20'
                }`}
              >
                {formatDate(d)}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-4 panel rounded-2xl p-3">
        <div className="grid grid-cols-3 gap-2">
          {daySlots.map(s => {
            const tone =
              s.status === 'open' ? 'bg-cream text-brand-dark border-cream'
              : s.status === 'closed' ? 'bg-transparent text-cream/50 border-cream/20 line-through'
              : 'bg-gold/20 text-gold border-gold/40'
            const next = s.status === 'open' ? 'closed' : s.status === 'closed' ? 'open' : null
            return (
              <button
                key={s.id}
                disabled={s.status === 'booked'}
                onClick={() => next && setSlotStatus(s.id, next)}
                className={`rounded-xl py-2.5 text-sm font-medium border transition ${tone}`}
                title={s.status === 'booked' ? 'Booked — cancel from booking detail' : `Tap to mark ${next}`}
              >
                {formatTime(s.time)}
                <span className="block text-[10px] mt-0.5 opacity-70 uppercase">{s.status}</span>
              </button>
            )
          })}
        </div>
        {daySlots.length === 0 && (
          <p className="text-cream/60 text-sm py-6 text-center">No slots on this day yet.</p>
        )}
      </div>

      <div className="mt-5 panel rounded-2xl p-4">
        <div className="text-xs uppercase tracking-wider text-cream/60">Add slot to {formatDate(activeDay)}</div>
        <div className="mt-2 flex gap-2">
          <input
            type="time"
            value={newTime}
            onChange={e => setNewTime(e.target.value)}
            className="flex-1 rounded-xl border border-cream/20 bg-brand-dark text-cream px-3 py-2 text-base outline-none focus:border-cream"
          />
          <button
            onClick={() => addSlot(activeDay, newTime)}
            className="rounded-xl bg-gold text-brand-dark font-medium px-4"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
