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
