import type { Booking } from '../types'
import { isoForOffset } from './seedSlots'

export const seedBookings = (): Booking[] => {
  const today = isoForOffset(0)
  const tomorrow = isoForOffset(1)
  const dayAfter = isoForOffset(2)

  return [
    {
      id: 'MBC-7K2P',
      slotId: `${today}-11:00`,
      serviceId: 'classic-cut',
      customerName: 'Faisal Al-Rashid',
      phone: '+965 5544 1122',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 14).toISOString(),
      status: 'pending',
    },
    {
      id: 'MBC-9XQM',
      slotId: `${today}-13:30`,
      serviceId: 'the-works',
      customerName: 'Mohammad Al-Khaled',
      phone: '+965 6677 9988',
      notes: 'First time — recommended by my brother. Take your time.',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
      status: 'pending',
    },
    {
      id: 'MBC-3LDA',
      slotId: `${today}-17:30`,
      serviceId: 'beard-sculpt',
      customerName: 'Hamad Al-Otaibi',
      phone: '+965 9988 7766',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
      status: 'done',
    },
    {
      id: 'MBC-B4WF',
      slotId: `${tomorrow}-10:30`,
      serviceId: 'hot-towel-shave',
      customerName: 'Abdullah Al-Sayer',
      phone: '+965 5050 2020',
      notes: 'Sensitive skin — go easy with the aftershave.',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
      status: 'pending',
    },
    {
      id: 'MBC-T2NJ',
      slotId: `${tomorrow}-16:00`,
      serviceId: 'classic-cut',
      customerName: 'Saud Al-Mutairi',
      phone: '+965 6543 2109',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
      status: 'pending',
    },
    {
      id: 'MBC-Q8VC',
      slotId: `${dayAfter}-12:00`,
      serviceId: 'the-works',
      customerName: 'Yousef Al-Sabah',
      phone: '+965 9090 1010',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
      status: 'pending',
    },
  ]
}
