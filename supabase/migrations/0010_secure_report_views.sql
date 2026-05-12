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
