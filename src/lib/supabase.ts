import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  throw new Error(
    'Missing Supabase env. Copy .env.example to .env and fill in VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.',
  )
}

export const supabase = createClient(url, key)

export type Db = {
  slots: {
    id: string
    date: string
    time: string
    status: 'open' | 'booked' | 'closed'
  }
  bookings: {
    id: string
    slot_id: string
    service_id: string
    customer_name: string
    phone: string
    notes: string | null
    created_at: string
    status: 'pending' | 'done' | 'cancelled'
    paid?: boolean
    tap_charge_id?: string | null
    access_token: string
  }
}
