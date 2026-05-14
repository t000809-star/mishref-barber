#!/usr/bin/env node
// Reads everything from one Supabase project and writes a human-readable
// snapshot. Refuses to run without an explicit --env=development|production
// so a `db:dump` muscle-memory invocation can never silently hit prod.
//
// Run with:  npm run db:dump:dev   OR   npm run db:dump:prod
// Output:    db-snapshot.<env>.md  (gitignored)

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

const env = loadEnv()
const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!url || !key) {
  console.error(`Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY in ${envFile}.`)
  process.exit(1)
}

console.log(`Dumping ${flag} project: ${url}`)
const supabase = createClient(url, key)

async function fetchAll(table, order) {
  let query = supabase.from(table).select('*')
  for (const o of order) query = query.order(o.column, { ascending: o.asc ?? true })
  const { data, error } = await query
  if (error) throw new Error(`${table}: ${error.message}`)
  return data
}

function table(headers, rows) {
  if (rows.length === 0) return '_(none)_\n'
  const head = `| ${headers.join(' | ')} |`
  const sep  = `| ${headers.map(() => '---').join(' | ')} |`
  const body = rows
    .map(r => `| ${headers.map(h => fmtCell(r[h])).join(' | ')} |`)
    .join('\n')
  return `${head}\n${sep}\n${body}\n`
}

function fmtCell(v) {
  if (v == null) return ''
  if (typeof v === 'string') return v.replace(/\|/g, '\\|').replace(/\n/g, ' ')
  return String(v)
}

const services = await fetchAll('services', [{ column: 'id' }])
const slots    = await fetchAll('slots',    [{ column: 'date' }, { column: 'time' }])
const bookings = await fetchAll('bookings', [{ column: 'created_at', asc: false }])

const slotCounts = slots.reduce((acc, s) => ((acc[s.status] = (acc[s.status] ?? 0) + 1), acc), {})
const bookingCounts = bookings.reduce((acc, b) => ((acc[b.status] = (acc[b.status] ?? 0) + 1), acc), {})

const out = []
out.push(`# Database snapshot (${flag})`)
out.push(``)
out.push(`Generated: ${new Date().toISOString()}`)
out.push(`Project:   ${url}`)
out.push(``)
out.push(`## Summary`)
out.push(``)
out.push(`- **Services**: ${services.length}`)
out.push(`- **Slots**: ${slots.length}  (open: ${slotCounts.open ?? 0}, booked: ${slotCounts.booked ?? 0}, closed: ${slotCounts.closed ?? 0})`)
out.push(`- **Bookings**: ${bookings.length}  (pending: ${bookingCounts.pending ?? 0}, done: ${bookingCounts.done ?? 0}, cancelled: ${bookingCounts.cancelled ?? 0})`)
out.push(``)

out.push(`## Services`)
out.push(``)
out.push(table(['id', 'name', 'duration_min', 'price_kwd', 'description'], services))
out.push(``)

out.push(`## Bookings`)
out.push(``)
out.push(table(['id', 'created_at', 'status', 'customer_name', 'phone', 'service_id', 'slot_id', 'notes'], bookings))
out.push(``)

out.push(`## Slots — booked or closed`)
out.push(``)
out.push(table(['id', 'date', 'time', 'status'], slots.filter(s => s.status !== 'open')))
out.push(``)

out.push(`## Slots — open (by date)`)
out.push(``)
const byDate = {}
for (const s of slots) {
  if (s.status !== 'open') continue
  ;(byDate[s.date] ??= []).push(s.time)
}
for (const date of Object.keys(byDate).sort()) {
  out.push(`- **${date}** (${byDate[date].length}): ${byDate[date].join(', ')}`)
}
out.push(``)

const outFile = `db-snapshot.${flag}.md`
writeFileSync(new URL(`../${outFile}`, import.meta.url), out.join('\n'))
console.log(`Wrote ${outFile}  (${services.length} services, ${slots.length} slots, ${bookings.length} bookings)`)
