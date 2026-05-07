import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type AuthState = 'loading' | 'in' | 'out'

export default function RequireAuth() {
  const loc = useLocation()
  const [state, setState] = useState<AuthState>('loading')

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setState(data.session ? 'in' : 'out')
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(session ? 'in' : 'out')
    })
    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  if (state === 'loading') {
    return <p className="pt-10 text-sm text-cream/70">Loading…</p>
  }
  if (state === 'out') {
    return <Navigate to="/admin/login" replace state={{ from: loc.pathname + loc.search }} />
  }
  return <Outlet />
}
