import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Booking, BookingStatus, Slot, SlotStatus } from '../types'
import { supabase, type Db } from '../lib/supabase'
import { isoForOffset } from '../data/seedSlots'

type Ctx = {
  loading: boolean
  error: string | null
  slots: Slot[]
  bookings: Booking[]
  createBooking: (input: {
    slotId: string
    serviceId: string
    customerName: string
    phone: string
    notes?: string
  }) => Promise<Booking>
  updateBookingStatus: (id: string, status: BookingStatus) => Promise<void>
  setSlotStatus: (id: string, status: SlotStatus) => Promise<void>
  addSlot: (date: string, time: string) => Promise<void>
}

const BookingCtx = createContext<Ctx | null>(null)

const TIMES = [
  '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30',
  '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00', '18:30',
  '19:00', '19:30', '20:00', '20:30',
]

const makeRef = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let r = ''
  for (let i = 0; i < 4; i++) r += chars[Math.floor(Math.random() * chars.length)]
  return `MBC-${r}`
}

const slotFromRow = (row: Db['slots']): Slot => ({
  id: row.id,
  date: row.date,
  time: row.time,
  status: row.status,
})

const bookingFromRow = (row: Db['bookings']): Booking => ({
  id: row.id,
  slotId: row.slot_id,
  serviceId: row.service_id,
  customerName: row.customer_name,
  phone: row.phone,
  notes: row.notes ?? undefined,
  createdAt: row.created_at,
  status: row.status,
})

async function ensureSlotsForNextDays(days: number) {
  const rows: Db['slots'][] = []
  for (let d = 0; d < days; d++) {
    const date = isoForOffset(d)
    for (const time of TIMES) {
      rows.push({ id: `${date}-${time}`, date, time, status: 'open' })
    }
  }
  const { error } = await supabase
    .from('slots')
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
  if (error) throw error
}

export function BookingProvider({ children }: { children: ReactNode }) {
  const [slots, setSlots] = useState<Slot[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const [slotsRes, bookingsRes] = await Promise.all([
      supabase.from('slots').select('*').order('date').order('time'),
      supabase.from('bookings').select('*').order('created_at', { ascending: false }),
    ])
    if (slotsRes.error) throw slotsRes.error
    if (bookingsRes.error) throw bookingsRes.error
    setSlots((slotsRes.data as Db['slots'][]).map(slotFromRow))
    setBookings((bookingsRes.data as Db['bookings'][]).map(bookingFromRow))
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await ensureSlotsForNextDays(7)
        if (cancelled) return
        await reload()
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reload])

  const value = useMemo<Ctx>(() => ({
    loading,
    error,
    slots,
    bookings,
    createBooking: async (input) => {
      const row: Db['bookings'] = {
        id: makeRef(),
        slot_id: input.slotId,
        service_id: input.serviceId,
        customer_name: input.customerName.trim(),
        phone: input.phone.trim(),
        notes: input.notes?.trim() || null,
        created_at: new Date().toISOString(),
        status: 'pending',
      }
      const { data, error } = await supabase
        .from('bookings')
        .insert(row)
        .select()
        .single()
      if (error) throw error
      const { error: slotErr } = await supabase
        .from('slots')
        .update({ status: 'booked' })
        .eq('id', input.slotId)
      if (slotErr) throw slotErr
      const booking = bookingFromRow(data as Db['bookings'])
      setBookings(b => [booking, ...b])
      setSlots(ss => ss.map(s => s.id === input.slotId ? { ...s, status: 'booked' } : s))
      return booking
    },
    updateBookingStatus: async (id, status) => {
      const target = bookings.find(b => b.id === id)
      const { error } = await supabase
        .from('bookings')
        .update({ status })
        .eq('id', id)
      if (error) throw error
      setBookings(b => b.map(x => x.id === id ? { ...x, status } : x))
      if (status === 'cancelled' && target) {
        const { error: slotErr } = await supabase
          .from('slots')
          .update({ status: 'open' })
          .eq('id', target.slotId)
        if (slotErr) throw slotErr
        setSlots(ss => ss.map(s => s.id === target.slotId ? { ...s, status: 'open' } : s))
      }
    },
    setSlotStatus: async (id, status) => {
      const { error } = await supabase
        .from('slots')
        .update({ status })
        .eq('id', id)
      if (error) throw error
      setSlots(ss => ss.map(s => s.id === id ? { ...s, status } : s))
    },
    addSlot: async (date, time) => {
      const id = `${date}-${time}`
      const { error } = await supabase
        .from('slots')
        .upsert({ id, date, time, status: 'open' }, { onConflict: 'id', ignoreDuplicates: true })
      if (error) throw error
      setSlots(ss => ss.some(s => s.id === id) ? ss : [...ss, { id, date, time, status: 'open' }])
    },
  }), [slots, bookings, loading, error])

  return <BookingCtx.Provider value={value}>{children}</BookingCtx.Provider>
}

export function useBooking() {
  const ctx = useContext(BookingCtx)
  if (!ctx) throw new Error('useBooking must be used inside BookingProvider')
  return ctx
}
