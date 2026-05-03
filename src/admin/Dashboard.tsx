import { Link } from 'react-router-dom'
import { useBooking } from '../store/BookingContext'
import { serviceById } from '../data/services'
import { todayIso } from '../data/seedSlots'
import { formatLongDate, formatTime } from '../lib/format'

export default function Dashboard() {
  const { bookings, slots } = useBooking()
  const today = todayIso()

  const todays = bookings
    .map(b => ({ b, s: slots.find(x => x.id === b.slotId) }))
    .filter(({ s }) => s && s.date === today)
    .sort((a, b) => (a.s!.time).localeCompare(b.s!.time))

  const pending = todays.filter(({ b }) => b.status === 'pending').length
  const done = todays.filter(({ b }) => b.status === 'done').length
  const revenue = todays
    .filter(({ b }) => b.status !== 'cancelled')
    .reduce((sum, { b }) => sum + (serviceById(b.serviceId)?.priceKwd ?? 0), 0)

  return (
    <div className="pt-4">
      <p className="text-cream/60 text-xs uppercase tracking-wider">Today</p>
      <h1 className="font-display text-3xl text-cream">{formatLongDate(today)}</h1>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat k="Booked" v={String(todays.length)} />
        <Stat k="Done" v={`${done}/${todays.length || 0}`} />
        <Stat k="Revenue" v={`${revenue} KWD`} />
      </div>

      <h2 className="mt-7 font-display text-xl text-cream">Schedule</h2>
      <p className="text-cream/60 text-sm">{pending} appointment{pending === 1 ? '' : 's'} still to come</p>

      <ul className="mt-3 space-y-2">
        {todays.length === 0 && (
          <li className="panel rounded-2xl p-5 text-cream/70 text-sm">
            No bookings yet today. Open more slots or share the booking link with regulars.
          </li>
        )}
        {todays.map(({ b, s }) => {
          const service = serviceById(b.serviceId)
          return (
            <li key={b.id}>
              <Link
                to={`/admin/bookings/${b.id}`}
                className="panel rounded-2xl p-4 flex items-center gap-3 active:scale-[.99] transition"
              >
                <div className="w-16 shrink-0 text-center">
                  <div className="font-display text-xl text-cream">{formatTime(s!.time)}</div>
                  <div className="text-[10px] uppercase tracking-wider text-cream/50">{service?.durationMin}m</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-cream font-medium truncate">{b.customerName}</div>
                  <div className="text-cream/70 text-sm truncate">{service?.name} · {b.phone}</div>
                </div>
                <StatusPill status={b.status} />
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="panel rounded-2xl p-3 text-center">
      <div className="font-display text-2xl text-cream">{v}</div>
      <div className="text-[10px] uppercase tracking-wider text-cream/60">{k}</div>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-gold/20 text-gold border-gold/40',
    done: 'bg-cream/15 text-cream/70 border-cream/30',
    cancelled: 'bg-red-900/40 text-red-200 border-red-400/30',
  }
  return (
    <span className={`shrink-0 text-[10px] uppercase tracking-wider px-2 py-1 rounded-full border ${map[status]}`}>
      {status}
    </span>
  )
}
