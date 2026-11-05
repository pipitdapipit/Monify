-- -------------------------------------------------------------
-- Personal API keys (iPhone Shortcut import)
--
-- The key itself is never stored, only its SHA-256 hash. The server calls the
-- api_key_* functions below with the publishable key + the raw key; each
-- function hashes the key, finds its owner, and only touches that user's data.
-- No secret / service_role key is involved.
-- Safe to run more than once.
-- -------------------------------------------------------------

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.api_keys (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 40),
  key_hash     text not null unique,
  prefix       text not null check (char_length(prefix) = 12),
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists api_keys_user_idx on public.api_keys (user_id);

-- At most 5 keys per user (checked by the insert policy).
create or replace function public.api_key_count_ok()
returns boolean
language sql stable security invoker
set search_path = ''
as $$
  select count(*) < 5 from public.api_keys where user_id = (select auth.uid());
$$;

alter table public.api_keys enable row level security;

drop policy if exists api_keys_select on public.api_keys;
drop policy if exists api_keys_insert on public.api_keys;
drop policy if exists api_keys_delete on public.api_keys;
create policy api_keys_select on public.api_keys for select to authenticated
  using (user_id = (select auth.uid()));
create policy api_keys_insert on public.api_keys for insert to authenticated
  with check (user_id = (select auth.uid()) and public.api_key_count_ok());
create policy api_keys_delete on public.api_keys for delete to authenticated
  using (user_id = (select auth.uid()));
-- No update policy: last_used_at is only set by api_key_lists().

-- Owner of a raw key. Invalid key -> error 28000 (invalid authorization).
-- Internal helper: not callable by anyone directly.
create or replace function public.api_key_owner(p_key text)
returns uuid
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  select k.user_id into v_user
  from public.api_keys k
  where k.key_hash = encode(extensions.digest(p_key, 'sha256'), 'hex');
  if v_user is null then
    raise exception 'invalid api key' using errcode = '28000';
  end if;
  return v_user;
end;
$$;

-- Wallets and categories of the key's owner (same shape as loadUserLists).
create or replace function public.api_key_lists(p_key text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid := public.api_key_owner(p_key);
begin
  update public.api_keys
  set last_used_at = now()
  where key_hash = encode(extensions.digest(p_key, 'sha256'), 'hex');

  return jsonb_build_object(
    'wallets', coalesce((
      select jsonb_agg(jsonb_build_object('id', w.id, 'name', w.name) order by w.created_at)
      from public.wallets w where w.user_id = v_user
    ), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'type', c.type) order by c.created_at)
      from public.categories c where c.user_id is null or c.user_id = v_user
    ), '[]'::jsonb)
  );
end;
$$;

-- Existing transactions of the key's owner in one wallet + date range (duplicate check).
-- The key is checked first, always. The range is capped (a screenshot spans a few days),
-- so a leaked key cannot be used to download the owner's whole history.
drop function if exists public.api_key_existing(text, uuid, date, date);
create function public.api_key_existing(p_key text, p_wallet_id uuid, p_from date, p_to date)
returns table (date date, type text, amount bigint)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_user uuid := public.api_key_owner(p_key);
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 62
     or p_from < (now() at time zone 'Asia/Jakarta')::date - 400 then
    raise exception 'date range must be at most 62 days within the last 400 days' using errcode = '22023';
  end if;

  return query
    select t.date, t.type, t.amount
    from public.transactions t
    where t.user_id = v_user
      and t.wallet_id = p_wallet_id
      and t.date between p_from and p_to;
end;
$$;

-- Insert 1-50 rows for the key's owner. All rows or none.
-- p_rows: [{ date, type, amount, note, category_id }]
create or replace function public.api_key_insert_transactions(p_key text, p_wallet_id uuid, p_rows jsonb)
returns int
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid := public.api_key_owner(p_key);
  v_count int;
begin
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) not between 1 and 50 then
    raise exception 'p_rows must hold 1-50 rows' using errcode = '22023';
  end if;

  if not exists (select 1 from public.wallets w where w.id = p_wallet_id and w.user_id = v_user) then
    raise exception 'wallet not owned by key owner' using errcode = '42501';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as r(type text, category_id uuid)
    where not exists (
      select 1 from public.categories c
      where c.id = r.category_id
        and (c.user_id is null or c.user_id = v_user)
        and c.type = r.type
    )
  ) then
    raise exception 'category not usable by key owner' using errcode = '42501';
  end if;

  insert into public.transactions (user_id, wallet_id, category_id, type, amount, date, note, source)
  select v_user, p_wallet_id, r.category_id, r.type, r.amount, r.date, r.note, 'ai_receipt'
  from jsonb_to_recordset(p_rows) as r(date date, type text, amount bigint, note text, category_id uuid);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.api_key_count_ok()                                  from public, anon;
revoke execute on function public.api_key_owner(text)                                 from public, anon, authenticated;
revoke execute on function public.api_key_lists(text)                                 from public;
revoke execute on function public.api_key_existing(text, uuid, date, date)            from public;
revoke execute on function public.api_key_insert_transactions(text, uuid, jsonb)      from public;
grant  execute on function public.api_key_count_ok()                                  to authenticated;
grant  execute on function public.api_key_lists(text)                                 to anon, authenticated;
grant  execute on function public.api_key_existing(text, uuid, date, date)            to anon, authenticated;
grant  execute on function public.api_key_insert_transactions(text, uuid, jsonb)      to anon, authenticated;
