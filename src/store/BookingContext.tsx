import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Booking, BookingStatus, Slot, SlotStatus } from '../types'
import { seedSlots } from '../data/seedSlots'

type Ctx = {
  slots: Slot[]
  bookings: Booking[]
  createBooking: (input: {
    slotId: string
    serviceId: string
    customerName: string
    phone: string
    notes?: string
  }) => Booking
  updateBookingStatus: (id: string, status: BookingStatus) => void
  setSlotStatus: (id: string, status: SlotStatus) => void
  addSlot: (date: string, time: string) => void
}

const BookingCtx = createContext<Ctx | null>(null)

const makeRef = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let r = ''
  for (let i = 0; i < 4; i++) r += chars[Math.floor(Math.random() * chars.length)]
  return `MBC-${r}`
}

export function BookingProvider({ children }: { children: ReactNode }) {
  const [slots, setSlots] = useState<Slot[]>(() => seedSlots())
  const [bookings, setBookings] = useState<Booking[]>([])

  const value = useMemo<Ctx>(() => ({
    slots,
    bookings,
    createBooking: (input) => {
      const booking: Booking = {
        id: makeRef(),
        slotId: input.slotId,
        serviceId: input.serviceId,
        customerName: input.customerName.trim(),
        phone: input.phone.trim(),
        notes: input.notes?.trim() || undefined,
        createdAt: new Date().toISOString(),
        status: 'pending',
      }
      setBookings(b => [booking, ...b])
      setSlots(ss => ss.map(s => s.id === input.slotId ? { ...s, status: 'booked' } : s))
      return booking
    },
    updateBookingStatus: (id, status) => {
      setBookings(b => b.map(x => x.id === id ? { ...x, status } : x))
      if (status === 'cancelled') {
        // free up the slot
        const target = bookings.find(x => x.id === id)
        if (target) {
          setSlots(ss => ss.map(s => s.id === target.slotId ? { ...s, status: 'open' } : s))
        }
      }
    },
    setSlotStatus: (id, status) => {
      setSlots(ss => ss.map(s => s.id === id ? { ...s, status } : s))
    },
    addSlot: (date, time) => {
      const id = `${date}-${time}`
      setSlots(ss => ss.some(s => s.id === id) ? ss : [...ss, { id, date, time, status: 'open' }])
    },
  }), [slots, bookings])

  return <BookingCtx.Provider value={value}>{children}</BookingCtx.Provider>
}

export function useBooking() {
  const ctx = useContext(BookingCtx)
  if (!ctx) throw new Error('useBooking must be used inside BookingProvider')
  return ctx
}
