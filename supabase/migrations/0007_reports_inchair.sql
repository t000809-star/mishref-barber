-- Treat bookings marked "done" without an online payment as in-chair
-- revenue (cash / KNET / Apple Pay collected at the chair). Pending now
-- only counts upcoming bookings ("pending" status) that haven't paid.
-- Monthly trend bars include in-chair revenue, attributed to the slot date.

drop view if exists public.report_totals;
drop view if exists public.report_monthly;

create view public.report_totals as
with charges_all as (
  select coalesce(sum(amount), 0)::numeric as total
  from public.payments
  where type = 'charge' and status = 'CAPTURED'
),
refunds_all as (
  select coalesce(sum(amount), 0)::numeric as total
  from public.payments
  where type = 'refund'
),
charges_month as (
  select coalesce(sum(amount), 0)::numeric as total
  from public.payments
  where type = 'charge' and status = 'CAPTURED'
    and created_at >= date_trunc('month', now())
),
refunds_month as (
  select coalesce(sum(amount), 0)::numeric as total
  from public.payments
  where type = 'refund'
    and created_at >= date_trunc('month', now())
),
in_chair_all as (
  -- service rendered, no online charge -> assume paid in chair
  select coalesce(sum(s.price_kwd), 0)::numeric as total
  from public.bookings b
  join public.services s on s.id = b.service_id
  where b.status = 'done' and not b.paid
),
in_chair_month as (
  select coalesce(sum(s.price_kwd), 0)::numeric as total
  from public.bookings b
  join public.services s on s.id = b.service_id
  join public.slots sl   on sl.id = b.slot_id
  where b.status = 'done' and not b.paid
    and sl.date >= date_trunc('month', now())::date
),
bookings_month as (
  select count(*)::int as total from public.bookings
  where created_at >= date_trunc('month', now())
),
pending as (
  -- only upcoming, unpaid bookings still owe money
  select
    count(b.id)::int as count,
    coalesce(sum(s.price_kwd), 0)::numeric as value
  from public.bookings b
  join public.services s on s.id = b.service_id
  where b.status = 'pending' and not b.paid
),
lifetime as (
  select count(*)::int as total from public.bookings
)
select
  charges_all.total                                         as collected_captured,
  refunds_all.total                                         as collected_refunded,
  in_chair_all.total                                        as collected_in_chair,
  (charges_all.total - refunds_all.total + in_chair_all.total) as collected_net,
  pending.count                                             as pending_count,
  pending.value                                             as pending_value,
  (charges_month.total - refunds_month.total + in_chair_month.total) as this_month_net,
  bookings_month.total                                      as this_month_bookings,
  lifetime.total                                            as lifetime_bookings
from charges_all, refunds_all, in_chair_all, pending,
     charges_month, refunds_month, in_chair_month,
     bookings_month, lifetime;

create or replace view public.report_monthly as
with months as (
  select generate_series(
    date_trunc('month', now()) - interval '5 months',
    date_trunc('month', now()),
    interval '1 month'
  ) as month
),
booking_counts as (
  select date_trunc('month', created_at) as month, count(*)::int as bookings
  from public.bookings
  group by 1
),
charge_sums as (
  select date_trunc('month', created_at) as month, sum(amount)::numeric as charges
  from public.payments
  where type = 'charge' and status = 'CAPTURED'
  group by 1
),
refund_sums as (
  select date_trunc('month', created_at) as month, sum(amount)::numeric as refunds
  from public.payments
  where type = 'refund'
  group by 1
),
in_chair_sums as (
  -- in-chair revenue attributed to the slot's date (service rendered)
  select date_trunc('month', sl.date::date)::timestamptz as month,
         sum(s.price_kwd)::numeric as in_chair
  from public.bookings b
  join public.services s on s.id = b.service_id
  join public.slots sl   on sl.id = b.slot_id
  where b.status = 'done' and not b.paid
  group by 1
)
select
  to_char(m.month, 'YYYY-MM')                       as month_key,
  to_char(m.month, 'Mon YYYY')                      as label,
  coalesce(b.bookings, 0)                           as bookings,
  coalesce(c.charges, 0)::numeric                   as charges,
  coalesce(r.refunds, 0)::numeric                   as refunds,
  coalesce(ic.in_chair, 0)::numeric                 as in_chair,
  (coalesce(c.charges, 0)
     - coalesce(r.refunds, 0)
     + coalesce(ic.in_chair, 0))::numeric           as net
from months m
left join booking_counts b on b.month = m.month
left join charge_sums    c on c.month = m.month
left join refund_sums    r on r.month = m.month
left join in_chair_sums  ic on ic.month = m.month
order by m.month;

grant select on public.report_totals  to anon, authenticated;
grant select on public.report_monthly to anon, authenticated;
