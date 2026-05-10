import { useEffect, useState } from 'react'
import { NavLink, Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { useBooking } from '../store/BookingContext'
import { supabase } from '../lib/supabase'

export default function AdminLayout() {
  const { loading, error } = useBooking()
  const loc = useLocation()
  const nav = useNavigate()
  const onLogin = loc.pathname === '/admin/login'

  const [signedIn, setSignedIn] = useState(false)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(!!session)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    nav('/admin/login', { replace: true })
  }

  return (
    <div className="admin-scope min-h-full">
      <header className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-cream/10">
        <Link to="/admin" aria-label="Admin home"><Logo tone="light" /></Link>
        <div className="flex items-center gap-3">
          <span className="text-[11px] uppercase tracking-widest text-gold">Admin</span>
          {signedIn && !onLogin && (
            <button onClick={signOut} className="text-xs text-cream/70 hover:text-cream">
              Sign out
            </button>
          )}
        </div>
      </header>

      {!onLogin && signedIn && (
        <nav className="px-3 pt-3 flex gap-1 overflow-x-auto">
          <Tab to="/admin" end>Today</Tab>
          <Tab to="/admin/bookings">All bookings</Tab>
          <Tab to="/admin/slots">Slot manager</Tab>
          <Tab to="/admin/reports">Reports</Tab>
          <Link to="/" className="ml-auto px-3 py-2 rounded-full text-xs text-cream/70 hover:text-cream whitespace-nowrap">View site →</Link>
        </nav>
      )}

      <main className="px-4 pb-24 max-w-md mx-auto w-full">
        {error ? (
          <p className="pt-10 text-sm text-red-300">Couldn't reach the booking system: {error}</p>
        ) : loading && !onLogin ? (
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
