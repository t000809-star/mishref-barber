// Admin-only edge function: dumps every booking to CSV, uploads to the
// private "exports" bucket, and returns a short-lived signed URL.
// Auth: requires a valid Supabase Auth JWT (any signed-in user counts as
// admin in this single-user app).

import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Missing bearer token' }, 401)

  // Verify the JWT by asking Supabase Auth who it belongs to.
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData.user) return json({ error: 'Unauthorized' }, 401)

  const adminEmail = Deno.env.get('ADMIN_EMAIL')
  if (!adminEmail) return json({ error: 'Server misconfigured' }, 500)
  if (userData.user.email?.toLowerCase() !== adminEmail.toLowerCase()) {
    return json({ error: 'Forbidden' }, 403)
  }

  // Service role for the actual work — read all bookings, write to storage.
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: rows, error: qErr } = await admin
    .from('bookings')
    .select('id, customer_name, phone, service_id, slot_id, status, notes, created_at')
    .order('created_at', { ascending: false })
  if (qErr) return json({ error: qErr.message }, 500)

  const headers = ['id', 'customer_name', 'phone', 'service_id', 'slot_id', 'status', 'notes', 'created_at']
  const csv = [
    headers.join(','),
    ...rows.map((r: Record<string, unknown>) => headers.map(h => csvCell(r[h])).join(',')),
  ].join('\n') + '\n'

  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const path = `bookings-${ts}.csv`
  const { error: upErr } = await admin.storage
    .from('exports')
    .upload(path, new Blob([csv], { type: 'text/csv' }), { upsert: false })
  if (upErr) return json({ error: `upload: ${upErr.message}` }, 500)

  const { data: signed, error: sErr } = await admin.storage
    .from('exports')
    .createSignedUrl(path, 60 * 5) // 5 min
  if (sErr) return json({ error: `sign: ${sErr.message}` }, 500)

  return json({
    ok: true,
    path,
    rows: rows.length,
    signedUrl: signed.signedUrl,
    expiresInSec: 300,
  })
})

function csvCell(v: unknown) {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
