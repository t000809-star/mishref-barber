-- All reporting math lives in Postgres so the frontend just renders
-- pre-aggregated rows. Views inherit RLS from the underlying tables —
-- anon SELECT on bookings/payments is denied, so anon gets zero rows
-- here too. Authenticated admin gets the real numbers.

create or replace view public.report_totals as
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
bookings_month as (
  select count(*)::int as total from public.bookings
  where created_at >= date_trunc('month', now())
),
pending as (
  select
    count(b.id)::int as count,
    coalesce(sum(s.price_kwd), 0)::numeric as value
  from public.bookings b
  join public.services s on s.id = b.service_id
  where b.status <> 'cancelled' and not b.paid
),
lifetime as (
  select count(*)::int as total from public.bookings
)
select
  charges_all.total                            as collected_captured,
  refunds_all.total                            as collected_refunded,
  (charges_all.total - refunds_all.total)      as collected_net,
  pending.count                                as pending_count,
  pending.value                                as pending_value,
  (charges_month.total - refunds_month.total)  as this_month_net,
  bookings_month.total                         as this_month_bookings,
  lifetime.total                               as lifetime_bookings
from charges_all, refunds_all, pending,
     charges_month, refunds_month, bookings_month, lifetime;

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
)
select
  to_char(m.month, 'YYYY-MM')          as month_key,
  to_char(m.month, 'Mon YYYY')         as label,
  coalesce(b.bookings, 0)              as bookings,
  coalesce(c.charges, 0)::numeric      as charges,
  coalesce(r.refunds, 0)::numeric      as refunds,
  (coalesce(c.charges, 0) - coalesce(r.refunds, 0))::numeric as net
from months m
left join booking_counts b on b.month = m.month
left join charge_sums    c on c.month = m.month
left join refund_sums    r on r.month = m.month
order by m.month;

grant select on public.report_totals  to anon, authenticated;
grant select on public.report_monthly to anon, authenticated;
