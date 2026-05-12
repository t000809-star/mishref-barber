// Local-device memory of bookings the customer just made, so they can come
// back to /confirmed/:id later and still hit the edge function (which now
// requires an access token alongside the booking id).
//
// This is intentionally tiny: a capped append-only list in localStorage.
// Reads and writes are defensive — quota errors and malformed JSON degrade
// to "no saved bookings" rather than throwing into React render.

const KEY = 'mbc.myBookings'
const MAX_ENTRIES = 20

export type SavedBooking = {
  id: string
  ref: string
  token: string
  savedAt: string  // ISO
}

export function readMyBookings(): SavedBooking[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (x): x is SavedBooking =>
        x &&
        typeof x.id === 'string' &&
        typeof x.ref === 'string' &&
        typeof x.token === 'string' &&
        typeof x.savedAt === 'string',
    )
  } catch {
    return []
  }
}

export function addMyBooking(entry: SavedBooking): void {
  if (typeof window === 'undefined') return
  try {
    const current = readMyBookings().filter(b => b.id !== entry.id)
    const next = [...current, entry]
      .sort((a, b) => a.savedAt.localeCompare(b.savedAt))
      .slice(-MAX_ENTRIES)
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Quota exceeded or storage disabled — silently drop. The customer can
    // still complete this booking via the in-memory ?t= URL parameter.
  }
}

export function findTokenForBooking(id: string): string | null {
  const found = readMyBookings().find(b => b.id === id)
  return found?.token ?? null
}

export function removeMyBooking(id: string): void {
  if (typeof window === 'undefined') return
  try {
    const next = readMyBookings().filter(b => b.id !== id)
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
}
