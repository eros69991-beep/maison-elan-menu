-- MAISON ÉLAN V3.6
-- 在 Supabase Dashboard → SQL Editor 中整段执行。
-- 执行前：把下面的 demo@example.com 改成你准备登录订单台的员工邮箱（公开演示可保留）。

create extension if not exists pgcrypto;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  table_number text not null,
  note text not null default '无备注',
  status text not null default 'pending'
    check (status in ('pending', 'preparing', 'ready', 'completed', 'cancelled')),
  item_count integer not null check (item_count between 1 and 99),
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  total numeric(10, 2) not null check (total >= 0 and total <= 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_created_at_idx
  on public.orders (created_at desc);

create index if not exists orders_status_idx
  on public.orders (status);

-- 员工邮箱白名单：只有这里登记的账号才能读取和处理订单。
create table if not exists public.staff_emails (
  email text primary key,
  created_at timestamptz not null default now()
);

insert into public.staff_emails (email)
values (lower('demo@example.com'))
on conflict (email) do nothing;

alter table public.orders enable row level security;
alter table public.staff_emails enable row level security;

-- staff_emails 不创建面向客户端的策略，前端无法直接读取白名单。
create or replace function public.is_maison_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff_emails
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_maison_staff() from public;
grant execute on function public.is_maison_staff() to authenticated;

-- Data API 权限。真正是否可操作仍由下面的 RLS 策略决定。
grant usage on schema public to anon, authenticated;
grant insert on table public.orders to anon, authenticated;
grant select, update, delete on table public.orders to authenticated;

-- 顾客只能新建“待接单”订单，不能读取、修改或删除订单。
drop policy if exists "customers can create orders" on public.orders;
create policy "customers can create orders"
on public.orders
for insert
to anon, authenticated
with check (
  status = 'pending'
  and char_length(table_number) between 1 and 12
  and char_length(note) <= 120
  and item_count between 1 and 99
  and jsonb_typeof(items) = 'array'
  and jsonb_array_length(items) between 1 and 99
  and total between 0 and 100000
);

-- 只有邮箱白名单中的已登录员工可以查看、改状态和清理订单。
drop policy if exists "staff can read orders" on public.orders;
create policy "staff can read orders"
on public.orders
for select
to authenticated
using (public.is_maison_staff());

drop policy if exists "staff can update orders" on public.orders;
create policy "staff can update orders"
on public.orders
for update
to authenticated
using (public.is_maison_staff())
with check (
  public.is_maison_staff()
  and status in ('pending', 'preparing', 'ready', 'completed', 'cancelled')
);

drop policy if exists "staff can delete orders" on public.orders;
create policy "staff can delete orders"
on public.orders
for delete
to authenticated
using (public.is_maison_staff());

-- 数据库自动维护 updated_at。
create or replace function public.set_maison_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_orders_updated_at on public.orders;
create trigger set_orders_updated_at
before update on public.orders
for each row
execute function public.set_maison_updated_at();

-- 开启 orders 表的 Realtime Postgres Changes。
do $$
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    execute 'create publication supabase_realtime';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    execute 'alter publication supabase_realtime add table public.orders';
  end if;
end
$$;
