-- ลูกชิ้นนายช่าง — Milestone 01 core schema.
-- Money is stored as integer satang (1 THB = 100 satang) to avoid float error.
-- Additive only: creates new types/tables; never drops existing objects.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'staff', 'rider');

create type public.fulfillment_type as enum ('pickup', 'delivery');

create type public.order_status as enum (
  'pending_payment',
  'payment_review',
  'confirmed',
  'preparing',
  'ready_for_pickup',
  'out_for_delivery',
  'completed',
  'cancelled'
);

create type public.payment_status as enum (
  'pending',
  'awaiting_verification',
  'verified',
  'rejected',
  'refunded'
);

create type public.delivery_status as enum (
  'unassigned',
  'assigned',
  'picked_up',
  'delivered',
  'failed',
  'cancelled'
);

-- ---------------------------------------------------------------------------
-- Shared trigger: updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Stores
-- ---------------------------------------------------------------------------
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,64}$'),
  name text not null check (char_length(name) between 1 and 200),
  phone text check (phone is null or phone ~ '^[0-9+\- ]{6,20}$'),
  address text,
  -- Nullable on purpose: store coordinates have not been provided yet.
  latitude numeric(9, 6) check (latitude is null or latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude is null or longitude between -180 and 180),
  timezone text not null default 'Asia/Bangkok',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stores_coordinates_pair check ((latitude is null) = (longitude is null))
);

create trigger stores_set_updated_at
  before update on public.stores
  for each row execute function public.set_updated_at();

create table public.store_settings (
  store_id uuid primary key references public.stores (id) on delete cascade,
  open_time time not null default '09:00',
  close_time time not null default '22:00',
  delivery_radius_m integer not null default 5000
    check (delivery_radius_m > 0 and delivery_radius_m <= 50000),
  accepts_pickup boolean not null default true,
  accepts_delivery boolean not null default true,
  -- Master switch; stays false until ordering and payment are implemented.
  ordering_enabled boolean not null default false,
  -- PromptPay receiver (phone / national ID / e-wallet ID). Shown to payers
  -- when ordering opens; null until the owner provides it.
  promptpay_id text check (promptpay_id is null or promptpay_id ~ '^[0-9]{10,15}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_settings_hours check (open_time < close_time)
);

create trigger store_settings_set_updated_at
  before update on public.store_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Staff profiles (role model). One row per staff auth user.
-- ---------------------------------------------------------------------------
create table public.staff_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  store_id uuid references public.stores (id) on delete set null,
  role public.app_role not null,
  display_name text check (display_name is null or char_length(display_name) <= 100),
  phone text check (phone is null or phone ~ '^[0-9+\- ]{6,20}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Non-admin staff must belong to a store.
  constraint staff_profiles_store_required check (role = 'admin' or store_id is not null)
);

create index staff_profiles_store_role_idx on public.staff_profiles (store_id, role);

create trigger staff_profiles_set_updated_at
  before update on public.staff_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, name)
);

create index categories_store_sort_idx on public.categories (store_id, sort_order);

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  name text not null check (char_length(name) between 1 and 200),
  description text check (description is null or char_length(description) <= 2000),
  price_satang integer not null check (price_satang >= 0),
  image_url text,
  is_available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_store_idx on public.products (store_id, sort_order);
create index products_category_idx on public.products (category_id);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create table public.product_options (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  min_select integer not null default 0 check (min_select >= 0),
  max_select integer not null default 1 check (max_select >= 1),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint product_options_select_range check (min_select <= max_select)
);

create index product_options_product_idx on public.product_options (product_id, sort_order);

create table public.product_option_values (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null references public.product_options (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  price_delta_satang integer not null default 0 check (price_delta_satang >= 0),
  is_available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index product_option_values_option_idx on public.product_option_values (option_id, sort_order);

-- ---------------------------------------------------------------------------
-- Delivery zones
-- ---------------------------------------------------------------------------
create table public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  min_distance_m integer not null default 0 check (min_distance_m >= 0),
  max_distance_m integer not null check (max_distance_m > 0),
  fee_satang integer not null check (fee_satang >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_zones_range check (min_distance_m < max_distance_m)
);

create index delivery_zones_store_idx on public.delivery_zones (store_id, min_distance_m);

create trigger delivery_zones_set_updated_at
  before update on public.delivery_zones
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Orders (contain customer PII — never publicly readable)
-- ---------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique check (order_number ~ '^[A-Z0-9-]{4,32}$'),
  store_id uuid not null references public.stores (id) on delete restrict,
  customer_user_id uuid references auth.users (id) on delete set null,
  customer_name text not null check (char_length(customer_name) between 1 and 100),
  customer_phone text not null check (customer_phone ~ '^[0-9+\- ]{6,20}$'),
  fulfillment public.fulfillment_type not null,
  delivery_address text check (delivery_address is null or char_length(delivery_address) <= 500),
  delivery_latitude numeric(9, 6) check (delivery_latitude is null or delivery_latitude between -90 and 90),
  delivery_longitude numeric(9, 6) check (delivery_longitude is null or delivery_longitude between -180 and 180),
  delivery_distance_m integer check (delivery_distance_m is null or delivery_distance_m >= 0),
  note text check (note is null or char_length(note) <= 500),
  status public.order_status not null default 'pending_payment',
  subtotal_satang integer not null check (subtotal_satang >= 0),
  delivery_fee_satang integer not null default 0 check (delivery_fee_satang >= 0),
  total_satang integer not null check (total_satang >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_total_matches check (total_satang = subtotal_satang + delivery_fee_satang),
  constraint orders_delivery_fields check (
    (fulfillment = 'pickup' and delivery_fee_satang = 0)
    or (
      fulfillment = 'delivery'
      and delivery_address is not null
      and delivery_latitude is not null
      and delivery_longitude is not null
    )
  )
);

create index orders_store_status_created_idx on public.orders (store_id, status, created_at desc);
create index orders_customer_idx on public.orders (customer_user_id) where customer_user_id is not null;

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  -- Snapshot so historical orders survive menu edits.
  product_name text not null,
  unit_price_satang integer not null check (unit_price_satang >= 0),
  quantity integer not null check (quantity between 1 and 99),
  line_total_satang integer not null check (line_total_satang >= 0),
  created_at timestamptz not null default now()
);

create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

create table public.order_item_options (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items (id) on delete cascade,
  option_value_id uuid references public.product_option_values (id) on delete set null,
  option_name text not null,
  value_name text not null,
  price_delta_satang integer not null default 0 check (price_delta_satang >= 0),
  created_at timestamptz not null default now()
);

create index order_item_options_item_idx on public.order_item_options (order_item_id);
create index order_item_options_value_idx on public.order_item_options (option_value_id);

-- ---------------------------------------------------------------------------
-- Payments (PromptPay). Stores references only — never card/bank credentials.
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  method text not null default 'promptpay' check (method = 'promptpay'),
  amount_satang integer not null check (amount_satang > 0),
  status public.payment_status not null default 'pending',
  -- Bank/PromptPay transaction reference from the slip or provider.
  provider_reference text check (provider_reference is null or char_length(provider_reference) <= 100),
  -- Path in a PRIVATE storage bucket; never a public URL.
  slip_storage_path text check (slip_storage_path is null or char_length(slip_storage_path) <= 500),
  verified_by uuid references public.staff_profiles (user_id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_verified_fields check (
    status <> 'verified' or (verified_by is not null and verified_at is not null)
  )
);

create index payments_order_idx on public.payments (order_id);
create index payments_verified_by_idx on public.payments (verified_by);
-- A transaction reference can settle at most one payment (prevents slip reuse).
create unique index payments_provider_reference_uniq
  on public.payments (provider_reference) where provider_reference is not null;

-- Verification is a one-way audit fact: once verified, a payment can only
-- move to 'refunded', and who/when verified can never be rewritten.
create or replace function public.guard_payment_verification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'verified' and old.status is distinct from 'verified' then
    new.verified_at := now();
  end if;
  if old.status in ('verified', 'refunded') then
    if new.status not in ('verified', 'refunded') then
      raise exception 'verified payment % cannot return to %', old.id, new.status;
    end if;
    if new.verified_by is distinct from old.verified_by
       or new.verified_at is distinct from old.verified_at then
      raise exception 'payment % verification record is immutable', old.id;
    end if;
  end if;
  return new;
end;
$$;

create trigger payments_guard_verification
  before update on public.payments
  for each row execute function public.guard_payment_verification();

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Deliveries (restaurant-owned riders)
-- ---------------------------------------------------------------------------
create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  rider_id uuid references public.staff_profiles (user_id) on delete set null,
  status public.delivery_status not null default 'unassigned',
  assigned_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deliveries_rider_required check (status in ('unassigned', 'cancelled') or rider_id is not null)
);

create index deliveries_rider_status_idx on public.deliveries (rider_id, status);

create trigger deliveries_set_updated_at
  before update on public.deliveries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Order status history (append-only audit, written by trigger)
-- ---------------------------------------------------------------------------
create table public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  changed_by uuid references auth.users (id) on delete set null,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now()
);

create index order_status_history_order_idx on public.order_status_history (order_id, created_at);
create index order_status_history_changed_by_idx on public.order_status_history (changed_by);

create or replace function public.log_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_status_history (order_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.order_status_history (order_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

revoke all on function public.log_order_status_change() from public, anon, authenticated;

create trigger orders_log_status
  after insert or update of status on public.orders
  for each row execute function public.log_order_status_change();
