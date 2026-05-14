-- =====================================================================
-- Bootstrap SQL for the Mishref Barber dev Supabase project.
--
-- Paste this file into the dev project: Supabase Studio -> SQL Editor -> New
-- query -> paste -> Run. It is idempotent at the create-extension and
-- "create table if not exists" level, but most CREATE POLICY / CREATE VIEW
-- statements would fail if run twice -- so only run this once on a fresh
-- project.
--
-- Migration 0009 (slots_insert -> authenticated only) is intentionally
-- omitted: the customer-facing ensureSlotsForNextDays() helper currently
-- upserts slots as anon, and tightening that policy without first moving
-- slot generation server-side would crash the customer flow. Track the
-- followup before applying 0009 in either env.
-- =====================================================================


-- ============================================================
-- 0001_init.sql
-- ============================================================
-- Booking schema for Mishref Barber Co.
-- Idempotent: safe to re-run.

create table if not exists public.services (
  id text primary key,
  name text not null,
  duration_min integer not null check (duration_min > 0),
  price_kwd numeric(6,2) not null check (price_kwd >= 0),
  description text not null default ''
);

create table if not exists public.slots (
  id text primary key,
  date date not null,
  time text not null,
  status text not null default 'open' check (status in ('open','booked','closed'))
);

create index if not exists slots_date_idx on public.slots (date);

create table if not exists public.bookings (
  id text primary key,
  slot_id text not null references public.slots(id) on delete restrict,
  service_id text not null references public.services(id) on delete restrict,
  customer_name text not null,
  phone text not null,
  notes text,
  created_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','done','cancelled'))
);

create index if not exists bookings_status_idx on public.bookings (status);
create index if not exists bookings_created_at_idx on public.bookings (created_at desc);

-- RLS: enabled, with permissive policies for the anon role.
-- NOTE: this matches the app's current trust model (no admin auth yet).
-- Before production, add auth + tighten the slot/booking write policies to admins.
alter table public.services enable row level security;
alter table public.slots    enable row level security;
alter table public.bookings enable row level security;

drop policy if exists services_read on public.services;
create policy services_read on public.services for select using (true);

drop policy if exists slots_read on public.slots;
create policy slots_read on public.slots for select using (true);

drop policy if exists slots_write on public.slots;
create policy slots_write on public.slots for all using (true) with check (true);

drop policy if exists bookings_read on public.bookings;
create policy bookings_read on public.bookings for select using (true);

drop policy if exists bookings_write on public.bookings;
create policy bookings_write on public.bookings for all using (true) with check (true);

-- Seed services
insert into public.services (id, name, duration_min, price_kwd, description) values
  ('classic-cut',     'Classic Cut',     30,  5.00, 'Scissor & clipper cut, finished with a hot rinse.'),
  ('beard-sculpt',    'Beard Sculpt',    30,  3.00, 'Line-up, shape and oil — clean edges, soft finish.'),
  ('hot-towel-shave', 'Hot Towel Shave', 45,  4.00, 'Steamed towel, straight razor, balm. The full ritual.'),
  ('the-works',       'The Works',       60, 10.00, 'Cut + beard sculpt + hot towel shave. Walk out new.')
on conflict (id) do update set
  name = excluded.name,
  duration_min = excluded.duration_min,
  price_kwd = excluded.price_kwd,
  description = excluded.description;

-- ============================================================
-- 0002_auth_rls.sql
-- ============================================================
-- Tighten RLS now that we have admin auth.
-- Idempotent: drops old policies then re-creates.

-- Slots: anon can read, insert (bootstrap), and book a slot (open -> booked).
-- Admin can do anything.
drop policy if exists slots_read   on public.slots;
drop policy if exists slots_write  on public.slots;
drop policy if exists slots_insert on public.slots;
drop policy if exists slots_update_book on public.slots;
drop policy if exists slots_admin  on public.slots;

create policy slots_read   on public.slots for select using (true);
create policy slots_insert on public.slots for insert with check (true);
create policy slots_update_book on public.slots for update
  using (status = 'open')
  with check (status = 'booked');
create policy slots_admin on public.slots for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Bookings: anyone can create one (customer form). Only admin can read,
-- update, or delete. Customer-side flow no longer reads the bookings table.
drop policy if exists bookings_read  on public.bookings;
drop policy if exists bookings_write on public.bookings;

create policy bookings_insert on public.bookings for insert with check (true);
create policy bookings_admin_select on public.bookings for select
  using (auth.role() = 'authenticated');
create policy bookings_admin_update on public.bookings for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
create policy bookings_admin_delete on public.bookings for delete
  using (auth.role() = 'authenticated');

-- ============================================================
-- 0003_realtime.sql
-- ============================================================
-- Add bookings + slots to the supabase_realtime publication so
-- Postgres Changes fire over the websocket. RLS is enforced on the
-- subscriber side, so anon subscribers never receive bookings events.

alter publication supabase_realtime add table public.slots;
alter publication supabase_realtime add table public.bookings;

-- ============================================================
-- 0004_payments.sql
-- ============================================================
-- Track Tap Payments charge id and paid status on bookings.
alter table public.bookings
  add column if not exists tap_charge_id text,
  add column if not exists paid boolean not null default false;

create index if not exists bookings_tap_charge_id_idx on public.bookings (tap_charge_id);

-- ============================================================
-- 0005_payments_log.sql
-- ============================================================
-- Audit log of every Tap Payments interaction. One row per charge attempt
-- and one row per refund — never updated in destructive ways. The bookings
-- table keeps the simple `paid` flag as a fast index; this table is the truth.

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id text not null references public.bookings(id) on delete cascade,
  type text not null check (type in ('charge', 'refund')),
  tap_id text,                       -- chg_xxx for charges, re_/refund_xxx for refunds
  related_charge_id text,            -- for refunds: original charge id
  amount numeric(10,2),
  currency text,
  status text,                       -- INITIATED, CAPTURED, FAILED, DECLINED, REFUNDED, etc.
  payment_method text,               -- VISA, MADA, KNET, AMEX, ...
  card_last4 text,
  card_brand text,
  failure_code text,
  failure_message text,
  raw jsonb,                         -- full Tap response, for audit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_booking_idx on public.payments (booking_id, created_at desc);
create index if not exists payments_tap_id_idx  on public.payments (tap_id);

-- RLS: only authenticated admin can read. Writes happen via the service role
-- inside edge functions, which bypasses RLS.
alter table public.payments enable row level security;

drop policy if exists payments_admin_select on public.payments;
create policy payments_admin_select on public.payments for select
  using (auth.role() = 'authenticated');

-- ============================================================
-- 0006_report_views.sql
-- ============================================================
-- All reporting math lives in Postgres so the frontend just renders
-- pre-aggregated rows. Views inherit RLS from the underlying tables —
-- anon SELECT on bookings/payments is denied, so anon gets zero rows
-- here too. Authenticated admin gets the real numbers.

create or replace view public.report_totals as
with charges_all as (
  select coalesce(sum(amount), 0)::numeric as total
  from public.payments
  where type = 'charge' and status = 'CAPTURED'
),
refunds_all as (
  select coalesce(sum(amount), 0)::numeric as total
  from public.payments
  where type = 'refund'
),
charges_month as (
  select coalesce(sum(amount), 0)::numeric as total
  from public.payments
  where type = 'charge' and status = 'CAPTURED'
    and created_at >= date_trunc('month', now())
),
refunds_month as (
  select coalesce(sum(amount), 0)::numeric as total
  from public.payments
  where type = 'refund'
    and created_at >= date_trunc('month', now())
),
bookings_month as (
  select count(*)::int as total from public.bookings
  where created_at >= date_trunc('month', now())
),
pending as (
  select
    count(b.id)::int as count,
    coalesce(sum(s.price_kwd), 0)::numeric as value
  from public.bookings b
  join public.services s on s.id = b.service_id
  where b.status <> 'cancelled' and not b.paid
),
lifetime as (
  select count(*)::int as total from public.bookings
)
select
  charges_all.total                            as collected_captured,
  refunds_all.total                            as collected_refunded,
  (charges_all.total - refunds_all.total)      as collected_net,
  pending.count                                as pending_count,
  pending.value                                as pending_value,
  (charges_month.total - refunds_month.total)  as this_month_net,
  bookings_month.total                         as this_month_bookings,
  lifetime.total                               as lifetime_bookings
from charges_all, refunds_all, pending,
     charges_month, refunds_month, bookings_month, lifetime;

create or replace view public.report_monthly as
with months as (
  select generate_series(
    date_trunc('month', now()) - interval '5 months',
    date_trunc('month', now()),
    interval '1 month'
  ) as month
),
booking_counts as (
  select date_trunc('month', created_at) as month, count(*)::int as bookings
  from public.bookings
  group by 1
),
charge_sums as (
  select date_trunc('month', created_at) as month, sum(amount)::numeric as charges
  from public.payments
  where type = 'charge' and status = 'CAPTURED'
  group by 1
),
refund_sums as (
  select date_trunc('month', created_at) as month, sum(amount)::numeric as refunds
  from public.payments
  where type = 'refund'
  group by 1
)
select
  to_char(m.month, 'YYYY-MM')          as month_key,
  to_char(m.month, 'Mon YYYY')         as label,
  coalesce(b.bookings, 0)              as bookings,
  coalesce(c.charges, 0)::numeric      as charges,
  coalesce(r.refunds, 0)::numeric      as refunds,
  (coalesce(c.charges, 0) - coalesce(r.refunds, 0))::numeric as net
from months m
left join booking_counts b on b.month = m.month
left join charge_sums    c on c.month = m.month
left join refund_sums    r on r.month = m.month
order by m.month;

grant select on public.report_totals  to anon, authenticated;
grant select on public.report_monthly to anon, authenticated;

-- ============================================================
-- 0007_reports_inchair.sql
-- ============================================================
-- Treat bookings marked "done" without an online payment as in-chair
-- revenue (cash / KNET / Apple Pay collected at the chair). Pending now
-- only counts upcoming bookings ("pending" status) that haven't paid.
-- Monthly trend bars include in-chair revenue, attributed to the slot date.

drop view if exists public.report_totals;
drop view if exists public.report_monthly;

create view public.report_totals as
with charges_all as (
  select coalesce(sum(amount), 0)::numeric as total
  from public.payments
  where type = 'charge' and status = 'CAPTURED'
),
refunds_all as (
  select coalesce(sum(amount), 0)::numeric as total
  from public.payments
  where type = 'refund'
),
charges_month as (
  select coalesce(sum(amount), 0)::numeric as total
  from public.payments
  where type = 'charge' and status = 'CAPTURED'
    and created_at >= date_trunc('month', now())
),
refunds_month as (
  select coalesce(sum(amount), 0)::numeric as total
  from public.payments
  where type = 'refund'
    and created_at >= date_trunc('month', now())
),
in_chair_all as (
  -- service rendered, no online charge -> assume paid in chair
  select coalesce(sum(s.price_kwd), 0)::numeric as total
  from public.bookings b
  join public.services s on s.id = b.service_id
  where b.status = 'done' and not b.paid
),
in_chair_month as (
  select coalesce(sum(s.price_kwd), 0)::numeric as total
  from public.bookings b
  join public.services s on s.id = b.service_id
  join public.slots sl   on sl.id = b.slot_id
  where b.status = 'done' and not b.paid
    and sl.date >= date_trunc('month', now())::date
),
bookings_month as (
  select count(*)::int as total from public.bookings
  where created_at >= date_trunc('month', now())
),
pending as (
  -- only upcoming, unpaid bookings still owe money
  select
    count(b.id)::int as count,
    coalesce(sum(s.price_kwd), 0)::numeric as value
  from public.bookings b
  join public.services s on s.id = b.service_id
  where b.status = 'pending' and not b.paid
),
lifetime as (
  select count(*)::int as total from public.bookings
)
select
  charges_all.total                                         as collected_captured,
  refunds_all.total                                         as collected_refunded,
  in_chair_all.total                                        as collected_in_chair,
  (charges_all.total - refunds_all.total + in_chair_all.total) as collected_net,
  pending.count                                             as pending_count,
  pending.value                                             as pending_value,
  (charges_month.total - refunds_month.total + in_chair_month.total) as this_month_net,
  bookings_month.total                                      as this_month_bookings,
  lifetime.total                                            as lifetime_bookings
from charges_all, refunds_all, in_chair_all, pending,
     charges_month, refunds_month, in_chair_month,
     bookings_month, lifetime;

create or replace view public.report_monthly as
with months as (
  select generate_series(
    date_trunc('month', now()) - interval '5 months',
    date_trunc('month', now()),
    interval '1 month'
  ) as month
),
booking_counts as (
  select date_trunc('month', created_at) as month, count(*)::int as bookings
  from public.bookings
  group by 1
),
charge_sums as (
  select date_trunc('month', created_at) as month, sum(amount)::numeric as charges
  from public.payments
  where type = 'charge' and status = 'CAPTURED'
  group by 1
),
refund_sums as (
  select date_trunc('month', created_at) as month, sum(amount)::numeric as refunds
  from public.payments
  where type = 'refund'
  group by 1
),
in_chair_sums as (
  -- in-chair revenue attributed to the slot's date (service rendered)
  select date_trunc('month', sl.date::date)::timestamptz as month,
         sum(s.price_kwd)::numeric as in_chair
  from public.bookings b
  join public.services s on s.id = b.service_id
  join public.slots sl   on sl.id = b.slot_id
  where b.status = 'done' and not b.paid
  group by 1
)
select
  to_char(m.month, 'YYYY-MM')                       as month_key,
  to_char(m.month, 'Mon YYYY')                      as label,
  coalesce(b.bookings, 0)                           as bookings,
  coalesce(c.charges, 0)::numeric                   as charges,
  coalesce(r.refunds, 0)::numeric                   as refunds,
  coalesce(ic.in_chair, 0)::numeric                 as in_chair,
  (coalesce(c.charges, 0)
     - coalesce(r.refunds, 0)
     + coalesce(ic.in_chair, 0))::numeric           as net
from months m
left join booking_counts b on b.month = m.month
left join charge_sums    c on c.month = m.month
left join refund_sums    r on r.month = m.month
left join in_chair_sums  ic on ic.month = m.month
order by m.month;

grant select on public.report_totals  to anon, authenticated;
grant select on public.report_monthly to anon, authenticated;

-- ============================================================
-- 0008_tighten_bookings_insert.sql
-- ============================================================
-- Tighten bookings_insert RLS so anon can't forge a paid booking.
--
-- Before this, the policy was `with check (true)`, meaning anon could
-- POST /rest/v1/bookings with paid=true and an arbitrary tap_charge_id,
-- bypassing Tap entirely. Anon-initiated inserts must now start life as
-- an unpaid, pending booking with no charge id; only the payment-verify
-- edge function (running with the service role, which bypasses RLS) can
-- flip paid=true and set tap_charge_id after confirming with Tap.

drop policy if exists bookings_insert on public.bookings;

create policy bookings_insert on public.bookings for insert to anon
  with check (paid = false and tap_charge_id is null and status = 'pending');

-- ============================================================
-- 0010_secure_report_views.sql
-- ============================================================
-- Fix MEDIUM-4: report views were owned by postgres (BYPASSRLS) and granted
-- to anon, so anonymous clients could read full financial aggregates via
-- /rest/v1/report_totals and /rest/v1/report_monthly. Setting
-- security_invoker=true makes each view run as the calling role so the
-- caller's RLS on the underlying bookings/payments tables applies. We then
-- revoke SELECT from anon entirely; authenticated admins keep access for
-- the dashboard. Migrations 0006 and 0007 are immutable history — this
-- migration is the fix.

alter view public.report_totals  set (security_invoker = true);
alter view public.report_monthly set (security_invoker = true);

revoke select on public.report_totals  from anon;
revoke select on public.report_monthly from anon;

-- Re-assert authenticated grant for clarity (idempotent).
grant select on public.report_totals  to authenticated;
grant select on public.report_monthly to authenticated;

-- ============================================================
-- 0011_rate_limits.sql
-- ============================================================
-- Fix MEDIUM-9: anon-callable edge functions (confirm-booking, payment-start,
-- payment-verify) had no throttling. The 32^4 ref keyspace on confirm-booking
-- made customer-directory enumeration cheap, and payment-start/verify let an
-- attacker burn Tap API quota for free. We use a tiny Postgres-backed fixed
-- window token bucket so all three functions share one durable limiter that
-- survives edge cold starts.
--
-- Schema:
--   key             "<funcName>:<ip>" — one row per (function, ip) pair
--   count           requests observed in the current window
--   window_started  timestamp the current window opened
--
-- The edge function increments count; when (now - window_started) exceeds the
-- window length it resets. Only the service role (used by the edge functions)
-- touches this table; anon/authenticated have no access via RLS.

create table if not exists public.rate_limits (
  key             text        primary key,
  count           int         not null default 0,
  window_started  timestamptz not null default now()
);

alter table public.rate_limits enable row level security;

-- No policies = deny all for anon and authenticated. The edge functions use
-- the service role key which bypasses RLS, so they can still read and write.

-- Helpful for the periodic cleanup if we ever add one; not load-bearing.
create index if not exists rate_limits_window_started_idx
  on public.rate_limits (window_started);

-- ============================================================
-- 0012_booking_access_token.sql
-- ============================================================
-- Per-booking opaque access token for safe customer reopens of /confirmed/:id.
--
-- The 4-char ref (32^4 keyspace) is enumerable, so it can't be the sole gate
-- on a page that exposes booking details and a pay-now button. Each booking
-- now carries an unguessable random token; the edge function (confirm-booking)
-- will require it on the anon lookup path. Existing rows are backfilled with
-- per-row random tokens so the new not-null + unique constraints hold.
--
-- gen_random_bytes lives in the `extensions` schema in Supabase, supplied by
-- pgcrypto. 0005 already uses gen_random_uuid(), but to be safe across fresh
-- environments we ensure pgcrypto is installed.

create extension if not exists pgcrypto with schema extensions;

alter table public.bookings
  add column if not exists access_token text;

-- Backfill: one fresh random URL-safe token per existing row.
update public.bookings
set access_token = replace(replace(replace(
        encode(extensions.gen_random_bytes(24), 'base64'),
      '+', '-'),
      '/', '_'),
      '=', '')
where access_token is null;

alter table public.bookings
  alter column access_token set not null;

create unique index if not exists bookings_access_token_idx
  on public.bookings (access_token);


-- =====================================================================
-- Dev-only slot seed: 60 days of open slots from current_date forward,
-- using the same `<date>-<time>` id convention the client uses. Repeats
-- gracefully via on-conflict-do-nothing.
-- =====================================================================
do $$
declare
  d date;
  t text;
  times text[] := array[
    '10:00','10:30','11:00','11:30',
    '12:00','12:30','13:00','13:30',
    '15:00','15:30','16:00','16:30',
    '17:00','17:30','18:00','18:30',
    '19:00','19:30','20:00','20:30'
  ];
begin
  for d in select generate_series(current_date, current_date + interval '59 days', interval '1 day')::date loop
    foreach t in array times loop
      insert into public.slots (id, date, time, status)
      values (d::text || '-' || t, d, t, 'open')
      on conflict (id) do nothing;
    end loop;
  end loop;
end$$;
