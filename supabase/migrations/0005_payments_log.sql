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
