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
