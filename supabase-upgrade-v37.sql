-- MAISON ÉLAN V3.7 升级：价格由数据库决定
-- 前提：已经执行过 supabase-setup-v36.sql。
-- 在 Supabase Dashboard → SQL Editor 中整段执行。可以重复执行，不会重复插入数据。
--
-- 这次升级做了三件事：
--   1. 新建 menu_items 表，存每个可点项目的真实价格和上下架状态。
--   2. 新建 place_order 函数：顾客只提交「项目 key + 数量」，
--      由数据库查价、算总价、生成订单号并写入 orders。
--   3. 收回顾客直接写 orders 表的权限，只能通过 place_order 下单。

-- ---------------------------------------------------------------
-- 1. 菜单价格表
-- ---------------------------------------------------------------
-- key 和前端 menu-data-v36.js 里的 id 一致；
-- 葡萄酒分杯和整瓶，key 后面分别加 ::glass 和 ::bottle。
create table if not exists public.menu_items (
  key text primary key,
  name_zh text not null,
  name_en text not null,
  price numeric(10, 2) not null check (price > 0 and price <= 10000),
  is_available boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.menu_items enable row level security;

grant select on table public.menu_items to anon, authenticated;

-- 任何人都可以读取上架中的菜品价格（菜单本来就是公开的）。
drop policy if exists "anyone can read available menu items" on public.menu_items;
create policy "anyone can read available menu items"
on public.menu_items
for select
to anon, authenticated
using (is_available);

-- 价格（美元）。要改价：直接在 Table Editor 里改 menu_items 的 price。
insert into public.menu_items (key, name_zh, name_en, price) values
  ('recommendations-foie-gras-1',    '香煎鹅肝配无花果红酒汁', 'Pan-Seared Foie Gras',        26),
  ('recommendations-duck-breast-2',  '香煎鸭胸配莓果酱汁',     'Pan-Seared Duck Breast',      42),
  ('recommendations-lamb-chops-3',   '法式香煎羊排',           'Grilled Lamb Chops',          48),
  ('appetizers-foie-gras-1',         '香煎鹅肝配无花果红酒汁', 'Pan-Seared Foie Gras',        26),
  ('appetizers-escargots-2',         '勃艮第焗蜗牛',           'Escargots de Bourgogne',      18),
  ('appetizers-salmon-tartare-3',    '烟熏三文鱼塔塔',         'Smoked Salmon Tartare',       21),
  ('appetizers-nicoise-salad-4',     '尼斯沙拉',               'Salade Niçoise',              17),
  ('soups-onion-soup-1',             '法式洋葱汤',             'French Onion Soup',           14),
  ('soups-cream-mushroom-soup-2',    '奶油蘑菇浓汤',           'Cream of Mushroom Soup',      12),
  ('soups-lobster-bisque-3',         '龙虾浓汤',               'Lobster Bisque',              19),
  ('soups-pumpkin-soup-4',           '南瓜浓汤',               'Pumpkin Velouté',             12),
  ('mains-beef-bourguignon-1',       '红酒炖牛肉',             'Boeuf Bourguignon',           39),
  ('mains-duck-breast-2',            '香煎鸭胸配莓果酱汁',     'Pan-Seared Duck Breast',      42),
  ('mains-sea-bass-3',               '香草黄油海鲈鱼',         'Herb Butter Sea Bass',        38),
  ('mains-roast-chicken-4',          '普罗旺斯烤鸡',           'Provençal Roasted Chicken',   32),
  ('mains-truffle-pasta-5',          '松露奶油烩意面',         'Truffle Cream Pasta',         29),
  ('mains-lamb-chops-6',             '法式香煎羊排',           'Grilled Lamb Chops',          48),
  ('desserts-creme-brulee-1',        '焦糖布丁',               'Crème Brûlée',                12),
  ('desserts-lemon-tart-2',          '柠檬塔',                 'Lemon Tart',                  12),
  ('desserts-lava-cake-3',           '熔岩巧克力蛋糕',         'Chocolate Lava Cake',         14),
  ('desserts-souffle-4',             '香草舒芙蕾',             'Vanilla Soufflé',             15),
  ('drinks-sparkling-water-1',       '气泡矿泉水',             'Sparkling Water',              7),
  ('drinks-americano-2',             '美式咖啡',               'Americano',                    5),
  ('drinks-hot-chocolate-3',         '法式热可可',             'French Hot Chocolate',         7),
  ('drinks-citrus-soda-4',           '柑橘苏打特调',           'Citrus Soda',                  8),
  ('drinks-grape-juice-5',           '葡萄汁',                 'Grape Juice',                  7),
  ('wines-bordeaux-1::glass',        '波尔多干红 · 单杯',      'Bordeaux Rouge · Glass',      16),
  ('wines-bordeaux-1::bottle',       '波尔多干红 · 整瓶',      'Bordeaux Rouge · Bottle',     62),
  ('wines-pinot-noir-2::glass',      '勃艮第黑皮诺 · 单杯',    'Bourgogne Pinot Noir · Glass', 19),
  ('wines-pinot-noir-2::bottle',     '勃艮第黑皮诺 · 整瓶',    'Bourgogne Pinot Noir · Bottle', 78),
  ('wines-chardonnay-3::glass',      '勃艮第霞多丽 · 单杯',    'Bourgogne Chardonnay · Glass', 18),
  ('wines-chardonnay-3::bottle',     '勃艮第霞多丽 · 整瓶',    'Bourgogne Chardonnay · Bottle', 72),
  ('wines-sauvignon-blanc-4::glass', '长相思白葡萄酒 · 单杯',  'Sauvignon Blanc · Glass',     15),
  ('wines-sauvignon-blanc-4::bottle','长相思白葡萄酒 · 整瓶',  'Sauvignon Blanc · Bottle',    58),
  ('wines-prosecco-5::glass',        '普罗塞克起泡酒 · 单杯',  'Prosecco · Glass',            14),
  ('wines-prosecco-5::bottle',       '普罗塞克起泡酒 · 整瓶',  'Prosecco · Bottle',           54),
  ('wines-rose-wine-6::glass',       '桃红葡萄酒 · 单杯',      'Rosé Wine · Glass',           15),
  ('wines-rose-wine-6::bottle',      '桃红葡萄酒 · 整瓶',      'Rosé Wine · Bottle',          58)
on conflict (key) do nothing;

-- ---------------------------------------------------------------
-- 2. 下单函数
-- ---------------------------------------------------------------
-- 顾客端传入：
--   p_table  桌号，例如 'A01'
--   p_note   备注，可为空
--   p_items  [{"key": "mains-sea-bass-3", "quantity": 2}, ...]
-- 价格、小计、总价、订单号全部由这里决定，前端传来的任何价格都不会被使用。
create or replace function public.place_order(
  p_table text,
  p_note text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table text := upper(trim(coalesce(p_table, '')));
  v_note text := coalesce(nullif(trim(coalesce(p_note, '')), ''), '无备注');
  v_items jsonb;
  v_item_count integer;
  v_total numeric(10, 2);
  v_requested integer;
  v_matched integer;
  v_order_number text;
  v_attempt integer := 0;
begin
  -- 桌号：1–12 位大写字母、数字、下划线、连字符或中文。
  if v_table !~ '^[A-Z0-9_一-鿿-]{1,12}$' then
    raise exception 'invalid table number' using errcode = '22023';
  end if;

  if char_length(v_note) > 120 then
    raise exception 'note too long' using errcode = '22023';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) not between 1 and 40 then
    raise exception 'invalid items' using errcode = '22023';
  end if;

  -- 每一行都必须是 {key: 文本, quantity: 1–20 的整数}。
  if exists (
    select 1
    from jsonb_array_elements(p_items) as e(value)
    where jsonb_typeof(e.value) <> 'object'
       or jsonb_typeof(e.value -> 'key') <> 'string'
       or jsonb_typeof(e.value -> 'quantity') <> 'number'
       or (e.value ->> 'quantity') !~ '^[0-9]+$'
       or (e.value ->> 'quantity')::integer not between 1 and 20
  ) then
    raise exception 'invalid item quantity' using errcode = '22023';
  end if;

  -- 同一个 key 出现多次时合并数量，再和 menu_items 对价。
  with requested as (
    select e.value ->> 'key' as key,
           sum((e.value ->> 'quantity')::integer) as quantity
    from jsonb_array_elements(p_items) as e(value)
    group by e.value ->> 'key'
  ),
  priced as (
    select r.key, r.quantity, m.name_zh, m.name_en, m.price
    from requested r
    join public.menu_items m on m.key = r.key and m.is_available
  )
  select
    (select count(*) from requested),
    count(*),
    coalesce(sum(p.quantity), 0),
    coalesce(sum(p.price * p.quantity), 0),
    coalesce(jsonb_agg(jsonb_build_object(
      'key', p.key,
      'name', p.name_zh,
      'englishName', p.name_en,
      'price', p.price,
      'quantity', p.quantity,
      'subtotal', p.price * p.quantity
    ) order by p.key), '[]'::jsonb)
  into v_requested, v_matched, v_item_count, v_total, v_items
  from priced p;

  -- 有任何一项不存在或已下架，整单拒绝。
  if v_matched <> v_requested then
    raise exception 'unknown or unavailable item' using errcode = '22023';
  end if;

  if v_item_count not between 1 and 99 then
    raise exception 'too many items' using errcode = '22023';
  end if;

  -- 简单防刷：同一桌 60 秒内最多 3 单。
  if (
    select count(*)
    from public.orders
    where table_number = v_table
      and created_at > now() - interval '60 seconds'
  ) >= 3 then
    raise exception 'too many orders, please wait' using errcode = 'P0001';
  end if;

  -- 订单号：ME + 月日（洛杉矶时间）+ 4 位随机数，撞号时重试。
  loop
    v_attempt := v_attempt + 1;
    v_order_number := 'ME'
      || to_char(now() at time zone 'America/Los_Angeles', 'MMDD')
      || lpad(floor(random() * 10000)::integer::text, 4, '0');

    begin
      insert into public.orders (order_number, table_number, note, status, item_count, items, total)
      values (v_order_number, v_table, v_note, 'pending', v_item_count, v_items, v_total);
      exit;
    exception when unique_violation then
      if v_attempt >= 5 then
        raise;
      end if;
    end;
  end loop;

  return jsonb_build_object(
    'order_number', v_order_number,
    'table_number', v_table,
    'item_count', v_item_count,
    'total', v_total
  );
end;
$$;

revoke all on function public.place_order(text, text, jsonb) from public;
grant execute on function public.place_order(text, text, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------
-- 3. 收回直接写 orders 的权限
-- ---------------------------------------------------------------
drop policy if exists "customers can create orders" on public.orders;
revoke insert on table public.orders from anon, authenticated;
