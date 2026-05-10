import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// All math lives in Postgres (see supabase/migrations/0006_report_views.sql).
// Frontend only renders.

type Totals = {
  collected_captured: number
  collected_refunded: number
  collected_net: number
  pending_count: number
  pending_value: number
  this_month_net: number
  this_month_bookings: number
  lifetime_bookings: number
}

type MonthRow = {
  month_key: string
  label: string
  bookings: number
  charges: number
  refunds: number
  net: number
}

const KWD = (n: number) => `${(Number(n) || 0).toFixed(Number(n) % 1 ? 2 : 0)} KWD`

export default function Reports() {
  const [totals, setTotals] = useState<Totals | null>(null)
  const [trend, setTrend] = useState<MonthRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [t, m] = await Promise.all([
        supabase.from('report_totals').select('*').maybeSingle(),
        supabase.from('report_monthly').select('*'),
      ])
      if (cancelled) return
      if (t.error) setError(t.error.message)
      else if (t.data) {
        const d = t.data as Record<string, string | number>
        setTotals({
          collected_captured:  Number(d.collected_captured),
          collected_refunded:  Number(d.collected_refunded),
          collected_net:       Number(d.collected_net),
          pending_count:       Number(d.pending_count),
          pending_value:       Number(d.pending_value),
          this_month_net:      Number(d.this_month_net),
          this_month_bookings: Number(d.this_month_bookings),
          lifetime_bookings:   Number(d.lifetime_bookings),
        })
      }
      if (m.error) setError(m.error.message)
      else if (m.data) {
        setTrend((m.data as Record<string, string | number>[]).map(r => ({
          month_key: String(r.month_key),
          label:     String(r.label),
          bookings:  Number(r.bookings),
          charges:   Number(r.charges),
          refunds:   Number(r.refunds),
          net:       Number(r.net),
        })))
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  if (loading) return <p className="pt-10 text-sm text-cream/70">Loading…</p>
  if (error || !totals) {
    return <p className="pt-10 text-sm text-red-300">Couldn't load reports{error ? `: ${error}` : ''}.</p>
  }

  const trendMaxNet      = Math.max(1, ...trend.map(m => Math.max(0, m.net)))
  const trendMaxBookings = Math.max(1, ...trend.map(m => m.bookings))

  return (
    <div className="pt-4">
      <h1 className="font-display text-3xl text-cream">Reports</h1>
      <p className="text-cream/60 text-sm mt-1">Money in, money owed, and how the months are trending.</p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <BigStat
          k="Collected (net)"
          v={KWD(totals.collected_net)}
          sub={`${KWD(totals.collected_captured)} captured · ${KWD(totals.collected_refunded)} refunded`}
        />
        <BigStat
          k="Pending"
          v={KWD(totals.pending_value)}
          sub={`${totals.pending_count} booking${totals.pending_count === 1 ? '' : 's'} unpaid`}
        />
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <BigStat
          k="This month"
          v={KWD(totals.this_month_net)}
          sub={`${totals.this_month_bookings} booking${totals.this_month_bookings === 1 ? '' : 's'}`}
        />
        <BigStat k="Lifetime bookings" v={String(totals.lifetime_bookings)} sub="all time" />
      </div>

      <h2 className="mt-7 font-display text-xl text-cream">Last 6 months</h2>
      <div className="mt-3 panel rounded-2xl p-4 space-y-3">
        {trend.map(m => (
          <div key={m.month_key}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-cream font-medium">{m.label}</span>
              <span className="text-cream/70">
                <span className="text-cream font-medium">{KWD(m.net)}</span>
                <span className="text-cream/50"> · {m.bookings} booking{m.bookings === 1 ? '' : 's'}</span>
              </span>
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <Bar label="KWD"      pct={(m.net / trendMaxNet) * 100}            tone="bg-gold" />
              <Bar label="bookings" pct={(m.bookings / trendMaxBookings) * 100} tone="bg-cream" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function BigStat({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="panel rounded-2xl p-4">
      <div className="text-[10px] uppercase tracking-wider text-cream/60">{k}</div>
      <div className="font-display text-2xl text-cream mt-1">{v}</div>
      {sub && <div className="text-cream/50 text-[11px] mt-0.5">{sub}</div>}
    </div>
  )
}

function Bar({ label, pct, tone }: { label: string; pct: number; tone: string }) {
  const w = Math.max(2, Math.min(100, pct))
  return (
    <div>
      <div className="h-2 rounded-full bg-cream/10 overflow-hidden">
        <div className={`h-full ${tone}`} style={{ width: `${w}%` }} />
      </div>
      <div className="text-[10px] uppercase tracking-wider text-cream/40 mt-0.5">{label}</div>
    </div>
  )
}
