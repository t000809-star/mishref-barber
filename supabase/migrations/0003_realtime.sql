-- Add bookings + slots to the supabase_realtime publication so
-- Postgres Changes fire over the websocket. RLS is enforced on the
-- subscriber side, so anon subscribers never receive bookings events.

alter publication supabase_realtime add table public.slots;
alter publication supabase_realtime add table public.bookings;
