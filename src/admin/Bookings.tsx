import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useBooking } from '../store/BookingContext'
import { serviceById } from '../data/services'
import { formatDate, formatTime } from '../lib/format'
import type { BookingStatus } from '../types'

export default function Bookings() {
  const { bookings, slots } = useBooking()
  const [filter, setFilter] = useState<'all' | BookingStatus>('all')
  const [day, setDay] = useState<'all' | string>('all')

  const dates = useMemo(() => {
    const set = new Set<string>()
    bookings.forEach(b => {
      const s = slots.find(x => x.id === b.slotId)
      if (s) set.add(s.date)
    })
    return Array.from(set).sort()
  }, [bookings, slots])

  const list = bookings
    .map(b => ({ b, s: slots.find(x => x.id === b.slotId) }))
    .filter(({ b, s }) => s
      && (filter === 'all' || b.status === filter)
      && (day === 'all' || s.date === day))
    .sort((a, b) => (a.s!.date + a.s!.time).localeCompare(b.s!.date + b.s!.time))

  return (
    <div className="pt-4">
      <h1 className="font-display text-3xl text-cream">All bookings</h1>

      <div className="mt-3 flex gap-2 overflow-x-auto -mx-4 px-4 pb-2">
        {(['all', 'pending', 'done', 'cancelled'] as const).map(f => (
          <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f[0].toUpperCase() + f.slice(1)}
          </Chip>
        ))}
      </div>

      {dates.length > 0 && (
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-2">
          <Chip active={day === 'all'} onClick={() => setDay('all')}>Any date</Chip>
          {dates.map(d => (
            <Chip key={d} active={day === d} onClick={() => setDay(d)}>{formatDate(d)}</Chip>
          ))}
        </div>
      )}

      <ul className="mt-3 space-y-2">
        {list.length === 0 && (
          <li className="panel rounded-2xl p-5 text-cream/70 text-sm">No bookings match.</li>
        )}
        {list.map(({ b, s }) => {
          const service = serviceById(b.serviceId)
          return (
            <li key={b.id}>
              <Link to={`/admin/bookings/${b.id}`} className="panel rounded-2xl p-4 flex gap-3 items-center active:scale-[.99] transition">
                <div className="w-20 shrink-0">
                  <div className="text-cream/70 text-[11px] uppercase tracking-wider">{formatDate(s!.date)}</div>
                  <div className="font-display text-lg text-cream">{formatTime(s!.time)}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-cream font-medium truncate">{b.customerName}</div>
                  <div className="text-cream/70 text-sm truncate">{service?.name} · {b.id}</div>
                </div>
                <span className="text-cream/60 text-xs">›</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-sm whitespace-nowrap border transition ${
        active ? 'bg-cream text-brand-dark border-cream' : 'bg-transparent text-cream/80 border-cream/20'
      }`}
    >
      {children}
    </button>
  )
}
