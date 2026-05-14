#!/usr/bin/env node
// Pulls every customer (name + phone) from one Supabase project's bookings.
// Refuses to run without an explicit --env=development|production so the
// production customer list can never be exported by accident.
//
// Run with:  npm run db:customers:dev   OR   npm run db:customers:prod
// Output:    customers.<env>.csv  (gitignored)

import { readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const flag = process.argv.find(a => a.startsWith('--env='))?.split('=')[1]
if (flag !== 'development' && flag !== 'production') {
  console.error('Pass --env=development or --env=production.')
  console.error('Refusing to guess which Supabase project to read from.')
  process.exit(1)
}

const envFile = flag === 'production' ? '.env.production.local' : '.env.development.local'

function loadEnv() {
  let text
  try {
    text = readFileSync(new URL(`../${envFile}`, import.meta.url), 'utf8')
  } catch {
    console.error(`Missing ${envFile}. Create it with VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.`)
    process.exit(1)
  }
  const env = {}
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}

function csvCell(v) {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const env = loadEnv()
const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!url || !key) {
  console.error(`Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY in ${envFile}.`)
  process.exit(1)
}

console.log(`Exporting ${flag} customers from: ${url}`)
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
const outFile = `customers.${flag}.csv`
writeFileSync(new URL(`../${outFile}`, import.meta.url), lines.join('\n') + '\n')

console.log(`Wrote ${outFile}  (${customers.length} unique customers from ${data.length} bookings)`)
