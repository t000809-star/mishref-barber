export type Service = {
  id: string
  name: string
  durationMin: number
  priceKwd: number
  description: string
}

export type SlotStatus = 'open' | 'booked' | 'closed'

export type Slot = {
  id: string
  date: string   // YYYY-MM-DD
  time: string   // HH:mm  (start time, 24h)
  status: SlotStatus
}

export type BookingStatus = 'pending' | 'done' | 'cancelled'

export type Booking = {
  id: string          // ref like MBC-2A1F
  slotId: string
  serviceId: string
  customerName: string
  phone: string
  notes?: string
  createdAt: string   // ISO
  status: BookingStatus
  paid: boolean
  tapChargeId?: string
  accessToken: string // opaque random per-booking token; gates customer reopens
}
