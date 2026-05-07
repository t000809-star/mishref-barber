import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type LocationState = { from?: string } | null

export default function Login() {
  const nav = useNavigate()
  const loc = useLocation()
  const from = (loc.state as LocationState)?.from ?? '/admin'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) nav(from, { replace: true })
    })
  }, [nav, from])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setError(null)
    setSubmitting(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setSubmitting(false)
      return
    }
    nav(from, { replace: true })
  }

  return (
    <div className="pt-10">
      <h1 className="font-display text-3xl text-cream">Admin sign in</h1>
      <p className="text-cream/60 text-sm mt-1">Staff only.</p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            className="w-full rounded-xl border border-cream/20 bg-brand-dark text-cream px-4 py-3 text-base outline-none focus:border-cream"
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full rounded-xl border border-cream/20 bg-brand-dark text-cream px-4 py-3 text-base outline-none focus:border-cream"
          />
        </Field>

        {error && <p className="text-sm text-red-300">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !email || !password}
          className="w-full rounded-full bg-gold text-brand-dark font-medium py-3 disabled:opacity-60"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-cream/60 mb-1.5">{label}</span>
      {children}
    </label>
  )
}
