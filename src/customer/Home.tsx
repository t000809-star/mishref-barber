import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { readMyBookings } from '../lib/myBookings'

export default function Home() {
  const [hasSaved, setHasSaved] = useState(false)
  useEffect(() => {
    setHasSaved(readMyBookings().length > 0)
  }, [])

  return (
    <div className="pt-4">
      <p className="text-xs uppercase tracking-[0.2em] text-gold mb-3">Est. 2019 · Mishref</p>
      <h1 className="font-display text-4xl leading-tight text-brand-dark">
        A sharp cut.<br/>A good chair.<br/>Booked in 30 seconds.
      </h1>
      <p className="mt-4 text-muted text-[15px] leading-relaxed">
        Walk in to a clean chair, a hot towel and Khalid's straight razor.
        Pick a service, lock a time, that's it.
      </p>

      <Link
        to="/services"
        className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-brand text-cream font-medium py-4 active:scale-[.99] transition shadow-card"
      >
        Book a chair
      </Link>

      {hasSaved && (
        <Link
          to="/my-bookings"
          className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-white border border-brand text-brand font-medium py-4 active:scale-[.99] transition shadow-card"
        >
          Find my booking
        </Link>
      )}

      <div className="mt-8 grid grid-cols-3 gap-3 text-center">
        <Stat k="Chairs" v="2" />
        <Stat k="Avg cut" v="30 min" />
        <Stat k="Rating" v="4.9 ★" />
      </div>

      <section className="mt-10">
        <h2 className="font-display text-xl text-brand-dark mb-3">What we do best</h2>
        <ul className="space-y-2 text-[15px]">
          <li className="flex justify-between border-b border-sand py-2"><span>Classic Cut</span><span className="text-muted">5 KWD · 30m</span></li>
          <li className="flex justify-between border-b border-sand py-2"><span>Beard Sculpt</span><span className="text-muted">3 KWD · 30m</span></li>
          <li className="flex justify-between border-b border-sand py-2"><span>Hot Towel Shave</span><span className="text-muted">4 KWD · 45m</span></li>
          <li className="flex justify-between py-2"><span>The Works</span><span className="text-muted">10 KWD · 60m</span></li>
        </ul>
      </section>
    </div>
  )
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-2xl bg-white/60 border border-sand py-3">
      <div className="font-display text-lg text-brand-dark">{v}</div>
      <div className="text-[11px] uppercase tracking-wider text-muted">{k}</div>
    </div>
  )
}
