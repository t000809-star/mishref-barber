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
