-- Tighten slots_insert RLS so anon can't pollute the schedule.
--
-- Before this, the policy was `with check (true)` for all roles, meaning
-- anon could POST /rest/v1/slots and insert phantom availability or DoS
-- the schedule via mass insert. Admin manages slots through the dashboard
-- under an authenticated Supabase session (see src/admin/Slots.tsx via
-- BookingContext.addSlot, gated by RequireAuth), and edge functions use
-- the service role which bypasses RLS, so restricting this policy to the
-- `authenticated` role blocks anon while keeping admin functionality
-- intact. The slots_update_book policy (anon flipping open->booked during
-- checkout) is left untouched.

drop policy if exists slots_insert on public.slots;

create policy slots_insert on public.slots for insert to authenticated
  with check (true);
