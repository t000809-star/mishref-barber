import { useEffect, useMemo, useState } from 'react'
import { useBooking } from '../store/BookingContext'
import { serviceById } from '../data/services'
import { supabase } from '../lib/supabase'

type PaymentRow = {
  id: string
  booking_id: string
  type: 'charge' | 'refund'
  amount: number | null
  status: string | null
  created_at: string
}

type MonthBucket = {
  key: string          // YYYY-MM
  label: string        // "May 2026"
  bookings: number
  charges: number      // KWD captured
  refunds: number      // KWD refunded
}

const KWD = (n: number) => `${n.toFixed(n % 1 ? 2 : 0)} KWD`

const monthKey = (iso: string) => iso.slice(0, 7)
const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString(undefined, { month: 'short', year: 'numeric' })
}

export default function Reports() {
  const { bookings, slots } = useBooking()
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('payments')
        .select('id, booking_id, type, amount, status, created_at')
        .order('created_at', { ascending: false })
      if (cancelled) return
      setPayments((data as PaymentRow[]) ?? [])
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  const collected = useMemo(() => {
    const charges = payments
      .filter(p => p.type === 'charge' && p.status === 'CAPTURED')
      .reduce((s, p) => s + Number(p.amount ?? 0), 0)
    const refunds = payments
      .filter(p => p.type === 'refund')
      .reduce((s, p) => s + Number(p.amount ?? 0), 0)
    return { charges, refunds, net: charges - refunds }
  }, [payments])

  // Pending = bookings that aren't cancelled and aren't paid yet.
  // Value comes from the static service price for each booking.
  const pending = useMemo(() => {
    const rows = bookings.filter(b => b.status !== 'cancelled' && !b.paid)
    const value = rows.reduce((s, b) => s + (serviceById(b.serviceId)?.priceKwd ?? 0), 0)
    return { count: rows.length, value }
  }, [bookings])

  const thisMonthKey = new Date().toISOString().slice(0, 7)
  const thisMonth = useMemo(() => {
    const inMonth = (iso: string) => monthKey(iso) === thisMonthKey
    const charges = payments
      .filter(p => p.type === 'charge' && p.status === 'CAPTURED' && inMonth(p.created_at))
      .reduce((s, p) => s + Number(p.amount ?? 0), 0)
    const refunds = payments
      .filter(p => p.type === 'refund' && inMonth(p.created_at))
      .reduce((s, p) => s + Number(p.amount ?? 0), 0)
    const bookingsThisMonth = bookings.filter(b => inMonth(b.createdAt)).length
    return { net: charges - refunds, bookings: bookingsThisMonth }
  }, [payments, bookings, thisMonthKey])

  // Last 6 months including the current one.
  const trend = useMemo<MonthBucket[]>(() => {
    const now = new Date()
    const months: MonthBucket[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
      months.push({ key, label: monthLabel(key), bookings: 0, charges: 0, refunds: 0 })
    }
    const byKey = new Map(months.map(m => [m.key, m]))
    for (const b of bookings) {
      const m = byKey.get(monthKey(b.createdAt))
      if (m) m.bookings++
    }
    for (const p of payments) {
      const m = byKey.get(monthKey(p.created_at))
      if (!m) continue
      if (p.type === 'charge' && p.status === 'CAPTURED') m.charges += Number(p.amount ?? 0)
      else if (p.type === 'refund') m.refunds += Number(p.amount ?? 0)
    }
    return months
  }, [bookings, payments])

  const trendMaxNet = Math.max(1, ...trend.map(m => Math.max(0, m.charges - m.refunds)))
  const trendMaxBookings = Math.max(1, ...trend.map(m => m.bookings))

  // Avoid the "useless slots" warning.
  void slots

  return (
    <div className="pt-4">
      <h1 className="font-display text-3xl text-cream">Reports</h1>
      <p className="text-cream/60 text-sm mt-1">Money in, money owed, and how the months are trending.</p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <BigStat
          k="Collected (net)"
          v={KWD(collected.net)}
          sub={`${KWD(collected.charges)} captured · ${KWD(collected.refunds)} refunded`}
        />
        <BigStat
          k="Pending"
          v={KWD(pending.value)}
          sub={`${pending.count} booking${pending.count === 1 ? '' : 's'} unpaid`}
        />
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <BigStat k="This month" v={KWD(thisMonth.net)} sub={`${thisMonth.bookings} booking${thisMonth.bookings === 1 ? '' : 's'}`} />
        <BigStat k="Lifetime bookings" v={String(bookings.length)} sub="all time" />
      </div>

      <h2 className="mt-7 font-display text-xl text-cream">Last 6 months</h2>
      {loading ? (
        <p className="text-cream/60 text-sm mt-3">Loading…</p>
      ) : (
        <div className="mt-3 panel rounded-2xl p-4 space-y-3">
          {trend.map(m => {
            const net = m.charges - m.refunds
            return (
              <div key={m.key}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-cream font-medium">{m.label}</span>
                  <span className="text-cream/70">
                    <span className="text-cream font-medium">{KWD(net)}</span>
                    <span className="text-cream/50"> · {m.bookings} booking{m.bookings === 1 ? '' : 's'}</span>
                  </span>
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <Bar label="KWD"      pct={(net / trendMaxNet) * 100}            tone="bg-gold" />
                  <Bar label="bookings" pct={(m.bookings / trendMaxBookings) * 100} tone="bg-cream" />
                </div>
              </div>
            )
          })}
        </div>
      )}
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
