import { NavLink, Outlet, Link } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { useBooking } from '../store/BookingContext'

export default function AdminLayout() {
  const { loading, error } = useBooking()
  return (
    <div className="admin-scope min-h-full">
      <header className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-cream/10">
        <Link to="/admin" aria-label="Admin home"><Logo tone="light" /></Link>
        <span className="text-[11px] uppercase tracking-widest text-gold">Admin</span>
      </header>

      <nav className="px-3 pt-3 flex gap-1 overflow-x-auto">
        <Tab to="/admin" end>Today</Tab>
        <Tab to="/admin/bookings">All bookings</Tab>
        <Tab to="/admin/slots">Slot manager</Tab>
        <Link to="/" className="ml-auto px-3 py-2 rounded-full text-xs text-cream/70 hover:text-cream whitespace-nowrap">View site →</Link>
      </nav>

      <main className="px-4 pb-24 max-w-md mx-auto w-full">
        {error ? (
          <p className="pt-10 text-sm text-red-300">Couldn't reach the booking system: {error}</p>
        ) : loading ? (
          <p className="pt-10 text-sm text-cream/70">Loading…</p>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  )
}

function Tab({ to, children, end }: { to: string; children: React.ReactNode; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `px-4 py-2 rounded-full text-sm whitespace-nowrap transition ${
          isActive ? 'bg-cream text-brand-dark font-medium' : 'text-cream/80 hover:text-cream'
        }`
      }
    >
      {children}
    </NavLink>
  )
}
