import type { Slot } from '../types'

const pad = (n: number) => String(n).padStart(2, '0')

export const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const isoForOffset = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const TIMES = [
  '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30',
  '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00', '18:30',
  '19:00', '19:30', '20:00', '20:30',
]

export const seedSlots = (): Slot[] => {
  const out: Slot[] = []
  for (let d = 0; d < 7; d++) {
    const date = isoForOffset(d)
    for (const time of TIMES) {
      out.push({
        id: `${date}-${time}`,
        date,
        time,
        status: 'open',
      })
    }
  }
  // Pre-close a couple of slots today to make the picker feel real
  const today = todayIso()
  const closedToday = new Set(['12:30', '15:00'])
  return out.map(s =>
    s.date === today && closedToday.has(s.time) ? { ...s, status: 'closed' } : s
  )
}
