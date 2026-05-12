import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useBooking } from '../store/BookingContext'
import { serviceById } from '../data/services'
import { formatLongDate, formatTime } from '../lib/format'

export default function BookingForm() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const { slots, createBooking } = useBooking()

  const slotId = params.get('slot') || ''
  const serviceId = params.get('service') || ''
  const slot = slots.find(s => s.id === slotId)
  const service = serviceById(serviceId)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!slot || !service) {
    return (
      <div className="pt-6">
        <p>That slot isn't available anymore.</p>
        <button onClick={() => nav('/services')} className="mt-4 underline">Start over</button>
      </div>
    )
  }
  if (slot.status !== 'open') {
    return (
      <div className="pt-6">
        <p>That slot was just taken. Pick another time.</p>
        <button onClick={() => nav(`/slots?service=${service.id}`)} className="mt-4 underline">Back to times</button>
      </div>
    )
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    if (!name.trim()) return setError('We need a name to greet you with.')
    const cleanPhone = phone.replace(/[^\d+]/g, '')
    if (cleanPhone.length < 7) return setError('Enter a phone we can reach you on.')
    setError(null)
    setSubmitting(true)
    try {
      const b = await createBooking({ slotId, serviceId, customerName: name, phone, notes })
      // Carry the token in the URL so refresh / share / bookmark all keep
      // working — confirm-booking will reject the call without it.
      nav(`/confirmed/${b.id}?t=${encodeURIComponent(b.accessToken)}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="pt-2">
      <h1 className="font-display text-3xl text-brand-dark">Your details</h1>

      <div className="mt-4 rounded-2xl bg-white border border-sand p-4">
        <div className="text-xs uppercase tracking-wider text-gold">Booking summary</div>
        <div className="mt-1 font-display text-lg text-brand-dark">{service.name}</div>
        <div className="text-sm text-muted">
          {formatLongDate(slot.date)} · {formatTime(slot.time)} · {service.durationMin} min
        </div>
        <div className="text-sm text-brand mt-1">{service.priceKwd} KWD · pay in chair</div>
      </div>

      <form onSubmit={submit} className="mt-5 space-y-4">
        <Field label="Full name">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Khalid Al-Mutairi"
            autoComplete="name"
            maxLength={80}
            className="w-full rounded-xl border border-sand bg-white px-4 py-3 text-base outline-none focus:border-brand"
          />
        </Field>
        <Field label="Phone number">
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+965 5000 0000"
            inputMode="tel"
            autoComplete="tel"
            maxLength={20}
            className="w-full rounded-xl border border-sand bg-white px-4 py-3 text-base outline-none focus:border-brand"
          />
        </Field>
        <Field label="Notes (optional)">
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Skin fade, leave the top long."
            rows={3}
            maxLength={500}
            className="w-full rounded-xl border border-sand bg-white px-4 py-3 text-base outline-none focus:border-brand resize-none"
          />
        </Field>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-brand text-cream font-medium py-4 shadow-card active:scale-[.99] transition disabled:opacity-60"
        >
          {submitting ? 'Confirming…' : 'Confirm booking'}
        </button>
        <p className="text-[11px] text-center text-muted">
          By booking you agree to a 1 hour cancellation window.
        </p>
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-muted mb-1.5">{label}</span>
      {children}
    </label>
  )
}
