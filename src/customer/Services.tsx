import { useNavigate } from 'react-router-dom'
import { SERVICES } from '../data/services'

export default function Services() {
  const nav = useNavigate()
  return (
    <div className="pt-2">
      <h1 className="font-display text-3xl text-brand-dark">Pick a service</h1>
      <p className="text-muted text-sm mt-1">You'll choose a time next.</p>

      <ul className="mt-6 space-y-3">
        {SERVICES.map(s => (
          <li key={s.id}>
            <button
              onClick={() => nav(`/slots?service=${s.id}`)}
              className="w-full text-left rounded-2xl bg-white border border-sand px-4 py-4 shadow-card active:scale-[.99] transition"
            >
              <div className="flex items-baseline justify-between">
                <span className="font-display text-lg text-brand-dark">{s.name}</span>
                <span className="font-medium text-brand">{s.priceKwd} KWD</span>
              </div>
              <div className="text-xs text-muted mt-0.5">{s.durationMin} min</div>
              <p className="text-[14px] text-ink/80 mt-2">{s.description}</p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
