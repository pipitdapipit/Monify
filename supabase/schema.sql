-- =============================================================
-- Monify database schema (Supabase / Postgres)
--
-- Money is always bigint rupiah (no decimals).
-- Every table has RLS: users only see and change their own rows.
-- Safe to run more than once: nothing here drops tables or deletes data.
-- =============================================================


-- -------------------------------------------------------------
-- Tables
-- -------------------------------------------------------------

create table if not exists public.wallets (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name              text not null check (char_length(name) between 1 and 40),
  type              text not null default 'cash' check (type in ('cash', 'bank', 'ewallet', 'other')),
  initial_balance   bigint not null default 0,
  include_in_budget boolean not null default true,
  created_at        timestamptz not null default now()
);

-- user_id null = default category shared by everyone (read-only for users).
-- color is used by the front-end charts.
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 40),
  type       text not null check (type in ('income', 'expense')),
  icon       text,
  color      text,
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  wallet_id   uuid not null references public.wallets (id) on delete restrict,
  category_id uuid not null references public.categories (id) on delete restrict,
  type        text not null check (type in ('income', 'expense')),
  amount      bigint not null check (amount > 0),
  date        date not null default (now() at time zone 'Asia/Jakarta')::date,
  note        text check (char_length(note) <= 200),
  source      text not null default 'manual' check (source in ('manual', 'ai_text', 'ai_receipt')),
  created_at  timestamptz not null default now()
);

create table if not exists public.recurring_bills (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  amount      bigint not null check (amount > 0),
  due_day     int not null check (due_day between 1 and 31),
  wallet_id   uuid references public.wallets (id) on delete set null,
  category_id uuid references public.categories (id) on delete set null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- One row per user. If a user has no row yet, payday 25 is assumed.
create table if not exists public.settings (
  user_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  payday_date int not null default 25 check (payday_date between 1 and 31),
  created_at  timestamptz not null default now()
);


-- -------------------------------------------------------------
-- Indexes
-- -------------------------------------------------------------

create index if not exists transactions_user_date_idx on public.transactions (user_id, date);
create index if not exists transactions_wallet_idx    on public.transactions (wallet_id);
-- Extra indexes on foreign keys (Supabase advisors warn when these are missing)
create index if not exists transactions_category_idx  on public.transactions (category_id);
create index if not exists wallets_user_idx           on public.wallets (user_id);
create index if not exists categories_user_idx        on public.categories (user_id);
create index if not exists recurring_bills_user_idx   on public.recurring_bills (user_id);
create index if not exists recurring_bills_wallet_idx on public.recurring_bills (wallet_id);
create index if not exists recurring_bills_cat_idx    on public.recurring_bills (category_id);


-- -------------------------------------------------------------
-- Ownership helpers (used by policies below)
-- A foreign key only checks that a wallet exists, not WHO owns it.
-- These stop a user from attaching someone else's wallet/category.
-- -------------------------------------------------------------

create or replace function public.owns_wallet(p_wallet_id uuid)
returns boolean
language sql stable security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.wallets w
    where w.id = p_wallet_id and w.user_id = (select auth.uid())
  );
$$;

-- Category must be the user's own or a default one, and match the type.
create or replace function public.can_use_category(p_category_id uuid, p_type text)
returns boolean
language sql stable security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.categories c
    where c.id = p_category_id
      and (c.user_id is null or c.user_id = (select auth.uid()))
      and (p_type is null or c.type = p_type)
  );
$$;


-- -------------------------------------------------------------
-- Row Level Security
-- -------------------------------------------------------------

alter table public.wallets         enable row level security;
alter table public.categories      enable row level security;
alter table public.transactions    enable row level security;
alter table public.recurring_bills enable row level security;
alter table public.settings        enable row level security;

-- wallets: own rows only
drop policy if exists wallets_select on public.wallets;
drop policy if exists wallets_insert on public.wallets;
drop policy if exists wallets_update on public.wallets;
drop policy if exists wallets_delete on public.wallets;
create policy wallets_select on public.wallets for select to authenticated
  using (user_id = (select auth.uid()));
create policy wallets_insert on public.wallets for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy wallets_update on public.wallets for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy wallets_delete on public.wallets for delete to authenticated
  using (user_id = (select auth.uid()));

-- categories: read own + defaults, write own only
drop policy if exists categories_select on public.categories;
drop policy if exists categories_insert on public.categories;
drop policy if exists categories_update on public.categories;
drop policy if exists categories_delete on public.categories;
create policy categories_select on public.categories for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));
create policy categories_insert on public.categories for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy categories_update on public.categories for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy categories_delete on public.categories for delete to authenticated
  using (user_id = (select auth.uid()));

-- transactions: own rows, and wallet/category must belong to the user
drop policy if exists transactions_select on public.transactions;
drop policy if exists transactions_insert on public.transactions;
drop policy if exists transactions_update on public.transactions;
drop policy if exists transactions_delete on public.transactions;
create policy transactions_select on public.transactions for select to authenticated
  using (user_id = (select auth.uid()));
create policy transactions_insert on public.transactions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.owns_wallet(wallet_id)
    and public.can_use_category(category_id, type)
  );
create policy transactions_update on public.transactions for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and public.owns_wallet(wallet_id)
    and public.can_use_category(category_id, type)
  );
create policy transactions_delete on public.transactions for delete to authenticated
  using (user_id = (select auth.uid()));

-- recurring_bills: own rows, optional wallet/category must belong to the user
drop policy if exists recurring_bills_select on public.recurring_bills;
drop policy if exists recurring_bills_insert on public.recurring_bills;
drop policy if exists recurring_bills_update on public.recurring_bills;
drop policy if exists recurring_bills_delete on public.recurring_bills;
create policy recurring_bills_select on public.recurring_bills for select to authenticated
  using (user_id = (select auth.uid()));
create policy recurring_bills_insert on public.recurring_bills for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (wallet_id is null or public.owns_wallet(wallet_id))
    and (category_id is null or public.can_use_category(category_id, null))
  );
create policy recurring_bills_update on public.recurring_bills for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (wallet_id is null or public.owns_wallet(wallet_id))
    and (category_id is null or public.can_use_category(category_id, null))
  );
create policy recurring_bills_delete on public.recurring_bills for delete to authenticated
  using (user_id = (select auth.uid()));

-- settings: own row only
drop policy if exists settings_select on public.settings;
drop policy if exists settings_insert on public.settings;
drop policy if exists settings_update on public.settings;
drop policy if exists settings_delete on public.settings;
create policy settings_select on public.settings for select to authenticated
  using (user_id = (select auth.uid()));
create policy settings_insert on public.settings for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy settings_update on public.settings for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy settings_delete on public.settings for delete to authenticated
  using (user_id = (select auth.uid()));


-- -------------------------------------------------------------
-- Default categories (user_id = null). Only inserted if missing.
-- -------------------------------------------------------------

insert into public.categories (user_id, name, type, icon, color)
select null, v.name, v.type, v.icon, v.color
from (values
  ('Makanan',    'expense', '🍜', '#eb6834'),
  ('Transport',  'expense', '🛵', '#2a78d6'),
  ('Belanja',    'expense', '🛒', '#1baf7a'),
  ('Tagihan',    'expense', '🧾', '#eda100'),
  ('Hiburan',    'expense', '🎬', '#e87ba4'),
  ('Kesehatan',  'expense', '💊', '#008300'),
  ('Pendidikan', 'expense', '📚', '#e34948'),
  ('Lainnya',    'expense', '📦', '#6250d6'),
  ('Gaji',       'income',  '💼', '#16a34a'),
  ('Bonus',      'income',  '🎁', '#22c55e'),
  ('Lainnya',    'income',  '💰', '#84cc16')
) as v (name, type, icon, color)
where not exists (
  select 1 from public.categories c
  where c.user_id is null and c.name = v.name and c.type = v.type
);


-- -------------------------------------------------------------
-- wallet_balances view
-- security_invoker = true -> RLS of the person asking applies.
-- -------------------------------------------------------------

create or replace view public.wallet_balances
with (security_invoker = true) as
select
  w.id      as wallet_id,
  w.user_id,
  w.include_in_budget,
  (w.initial_balance
    + coalesce(sum(case when t.type = 'income' then t.amount else -t.amount end), 0)
  )::bigint as balance
from public.wallets w
left join public.transactions t on t.wallet_id = w.id
group by w.id;


-- -------------------------------------------------------------
-- payday_in_month(day, any date in month)
-- Payday 31 in a 30-day month -> the 30th (last day of that month).
-- -------------------------------------------------------------

create or replace function public.payday_in_month(p_day int, p_month date)
returns date
language sql immutable
set search_path = ''
as $$
  select date_trunc('month', p_month)::date
    + (least(
         p_day,
         extract(day from date_trunc('month', p_month) + interval '1 month - 1 day')::int
       ) - 1);
$$;


-- -------------------------------------------------------------
-- safe_to_spend()
-- amount = (balances of budget wallets - active bills due before next payday)
--          / days left until next payday (min 1), never below 0.
-- Integer division only: no floats.
-- -------------------------------------------------------------

create or replace function public.safe_to_spend()
returns json
language plpgsql stable security invoker
set search_path = ''
as $$
declare
  v_today       date := (now() at time zone 'Asia/Jakarta')::date;
  v_payday      int;
  v_cycle_start date;
  v_next_payday date;
  v_days_left   int;
  v_balance     bigint;
  v_bills       bigint := 0;
  v_due         date;
  v_bill        record;
begin
  select s.payday_date into v_payday
  from public.settings s where s.user_id = (select auth.uid());
  v_payday := coalesce(v_payday, 25);

  -- Cycle starts on the most recent payday (today or earlier)
  v_cycle_start := public.payday_in_month(v_payday, v_today);
  if v_cycle_start > v_today then
    v_cycle_start := public.payday_in_month(v_payday, (date_trunc('month', v_today) - interval '1 month')::date);
  end if;
  v_next_payday := public.payday_in_month(v_payday, (date_trunc('month', v_cycle_start) + interval '1 month')::date);

  -- Days from today until the day before next payday, including today
  v_days_left := greatest(v_next_payday - v_today, 1);

  select coalesce(sum(b.balance), 0)::bigint into v_balance
  from public.wallet_balances b
  where b.include_in_budget;

  -- Each active bill: its next due date from today. Count it if before next payday.
  for v_bill in
    select r.amount, r.due_day from public.recurring_bills r where r.active
  loop
    v_due := public.payday_in_month(v_bill.due_day, v_today);
    if v_due < v_today then
      v_due := public.payday_in_month(v_bill.due_day, (date_trunc('month', v_today) + interval '1 month')::date);
    end if;
    if v_due < v_next_payday then
      v_bills := v_bills + v_bill.amount;
    end if;
  end loop;

  return json_build_object(
    'amount',               greatest((v_balance - v_bills) / v_days_left, 0),
    'days_left',            v_days_left,
    'upcoming_bills_total', v_bills,
    'cycle_start',          v_cycle_start,
    'cycle_end',            v_next_payday - 1
  );
end;
$$;


-- -------------------------------------------------------------
-- overview(p_from, p_to)
-- Totals, expense per category, and one row per day (0 if empty).
-- -------------------------------------------------------------

create or replace function public.overview(p_from date, p_to date)
returns json
language plpgsql stable security invoker
set search_path = ''
as $$
declare
  v_result json;
begin
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'Rentang tanggal tidak valid.';
  end if;
  if p_to - p_from > 366 then
    raise exception 'Rentang tanggal maksimal 1 tahun.';
  end if;

  with tx as (
    select t.* from public.transactions t
    where t.user_id = (select auth.uid()) and t.date between p_from and p_to
  )
  select json_build_object(
    'total_income',  (select coalesce(sum(amount), 0)::bigint from tx where type = 'income'),
    'total_expense', (select coalesce(sum(amount), 0)::bigint from tx where type = 'expense'),
    'by_category', coalesce((
      select json_agg(row_to_json(c) order by c.total desc)
      from (
        select tx.category_id, cat.name, cat.icon, cat.color, sum(tx.amount)::bigint as total
        from tx join public.categories cat on cat.id = tx.category_id
        where tx.type = 'expense'
        group by tx.category_id, cat.name, cat.icon, cat.color
      ) c
    ), '[]'::json),
    'daily', (
      select json_agg(row_to_json(d) order by d.date)
      from (
        select day::date as date,
          coalesce(sum(tx.amount) filter (where tx.type = 'income'), 0)::bigint  as income,
          coalesce(sum(tx.amount) filter (where tx.type = 'expense'), 0)::bigint as expense
        from generate_series(p_from, p_to, interval '1 day') as day
        left join tx on tx.date = day::date
        group by day
      ) d
    )
  ) into v_result;

  return v_result;
end;
$$;


-- -------------------------------------------------------------
-- Function permissions: logged-in users only
-- -------------------------------------------------------------

revoke execute on function public.safe_to_spend()                  from public, anon;
revoke execute on function public.overview(date, date)             from public, anon;
revoke execute on function public.owns_wallet(uuid)                from public, anon;
revoke execute on function public.can_use_category(uuid, text)     from public, anon;
revoke execute on function public.payday_in_month(int, date)       from public, anon;
grant  execute on function public.safe_to_spend()                  to authenticated;
grant  execute on function public.overview(date, date)             to authenticated;
grant  execute on function public.owns_wallet(uuid)                to authenticated;
grant  execute on function public.can_use_category(uuid, text)     to authenticated;
grant  execute on function public.payday_in_month(int, date)       to authenticated;
