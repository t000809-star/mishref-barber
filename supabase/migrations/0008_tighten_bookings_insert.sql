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
