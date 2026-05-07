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
