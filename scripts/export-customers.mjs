#!/usr/bin/env node
// Pulls every customer (name + phone) from Supabase bookings.
// Run with: npm run db:customers
// Output: customers.csv (gitignored)

import { readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function loadEnv() {
  const env = {}
  try {
    const text = readFileSync(new URL('../.env', import.meta.url), 'utf8')
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {
    // fall through to process.env
  }
  return {
    url: env.VITE_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL,
    key: env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  }
}

function csvCell(v) {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const { url, key } = loadEnv()
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY (set them in .env).')
  process.exit(1)
}
const supabase = createClient(url, key)

const { data, error } = await supabase
  .from('bookings')
  .select('customer_name, phone, created_at')
  .order('created_at', { ascending: false })

if (error) {
  console.error('Query failed:', error.message)
  process.exit(1)
}

// Dedupe by phone, keeping the most recent name (rows are already sorted desc).
const seen = new Set()
const customers = []
for (const row of data) {
  const phone = (row.phone ?? '').trim()
  if (!phone || seen.has(phone)) continue
  seen.add(phone)
  customers.push({ name: (row.customer_name ?? '').trim(), phone })
}

const lines = ['name,phone']
for (const c of customers) lines.push(`${csvCell(c.name)},${csvCell(c.phone)}`)
writeFileSync(new URL('../customers.csv', import.meta.url), lines.join('\n') + '\n')

console.log(`Wrote customers.csv  (${customers.length} unique customers from ${data.length} bookings)`)
