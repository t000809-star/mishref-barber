import { Link, Outlet, useLocation } from 'react-router-dom'
import { Logo } from '../components/Logo'

export default function CustomerLayout() {
  const { pathname } = useLocation()
  const onHome = pathname === '/'
  return (
    <div className="min-h-full bg-cream">
      <header className="px-5 pt-5 pb-3 flex items-center justify-between">
        <Link to="/" aria-label="Home"><Logo /></Link>
        {!onHome && (
          <Link to="/" className="text-sm text-muted hover:text-brand">Cancel</Link>
        )}
      </header>
      <main className="px-5 pb-24 max-w-md mx-auto w-full">
        <Outlet />
      </main>
      <footer className="px-5 py-6 text-center text-xs text-muted">
        Mishref · Block 4, Street 12 · Open 10am – 9pm
      </footer>
    </div>
  )
}
