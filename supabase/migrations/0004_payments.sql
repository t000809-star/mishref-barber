-- Track Tap Payments charge id and paid status on bookings.
alter table public.bookings
  add column if not exists tap_charge_id text,
  add column if not exists paid boolean not null default false;

create index if not exists bookings_tap_charge_id_idx on public.bookings (tap_charge_id);
