-- ลูกชิ้นนายช่าง — Row Level Security and privileges.
--
-- Access model
--   anon / any visitor : read active catalog + store info only. No PII.
--   customer (authed)  : read own orders (customer_user_id = auth.uid()).
--   staff              : read/update orders, payments, deliveries of own store.
--   rider              : read only orders actively assigned to them.
--   admin              : everything, all stores; sole manager of staff roles.
--
-- Orders, order items and payments are INSERTED by trusted server code
-- (service role) only — there is deliberately no client insert policy.

-- ---------------------------------------------------------------------------
-- Helper functions in a schema that PostgREST does not expose.
-- SECURITY DEFINER so they can read staff_profiles/deliveries without
-- recursing through those tables' own RLS policies.
-- ---------------------------------------------------------------------------
create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to anon, authenticated;

create or replace function app_private.current_staff_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select sp.role
  from public.staff_profiles sp
  where sp.user_id = auth.uid() and sp.is_active
$$;

create or replace function app_private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(app_private.current_staff_role() = 'admin', false)
$$;

-- Staff of the given store, or any admin.
create or replace function app_private.is_store_staff(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_profiles sp
    where sp.user_id = auth.uid()
      and sp.is_active
      and (sp.role = 'admin' or (sp.role = 'staff' and sp.store_id = p_store_id))
  )
$$;

-- Rider currently assigned to the order (access ends once delivered/cancelled).
create or replace function app_private.is_assigned_rider(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.deliveries d
    join public.staff_profiles sp on sp.user_id = d.rider_id
    join public.orders o on o.id = d.order_id
    where d.order_id = p_order_id
      and sp.store_id = o.store_id
      and d.rider_id = auth.uid()
      and d.status in ('assigned', 'picked_up')
      and sp.role = 'rider'
      and sp.is_active
  )
$$;

-- The given user is an active rider of the order's store.
create or replace function app_private.is_store_rider(p_rider_id uuid, p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_profiles sp
    join public.orders o on o.id = p_order_id
    where sp.user_id = p_rider_id
      and sp.role = 'rider'
      and sp.is_active
      and sp.store_id = o.store_id
  )
$$;

create or replace function app_private.can_read_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.orders o
    where o.id = p_order_id
      and (
        app_private.is_store_staff(o.store_id)
        or (o.customer_user_id is not null and o.customer_user_id = auth.uid())
        or app_private.is_assigned_rider(o.id)
      )
  )
$$;

revoke all on all functions in schema app_private from public;
grant execute on all functions in schema app_private to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS on every table
-- ---------------------------------------------------------------------------
alter table public.stores                enable row level security;
alter table public.store_settings        enable row level security;
alter table public.staff_profiles        enable row level security;
alter table public.categories            enable row level security;
alter table public.products              enable row level security;
alter table public.product_options       enable row level security;
alter table public.product_option_values enable row level security;
alter table public.delivery_zones        enable row level security;
alter table public.orders                enable row level security;
alter table public.order_items           enable row level security;
alter table public.order_item_options    enable row level security;
alter table public.payments              enable row level security;
alter table public.deliveries            enable row level security;
alter table public.order_status_history  enable row level security;

-- ---------------------------------------------------------------------------
-- Table privileges (defence in depth on top of RLS)
-- ---------------------------------------------------------------------------
-- Sensitive tables: nothing for anon at all.
revoke all on public.staff_profiles, public.orders, public.order_items,
  public.order_item_options, public.payments, public.deliveries,
  public.order_status_history
  from anon;

-- Public catalog: anon may only read.
revoke insert, update, delete, truncate on public.stores, public.store_settings,
  public.categories, public.products, public.product_options,
  public.product_option_values, public.delivery_zones
  from anon;

-- Authenticated users never insert/delete order data directly and may only
-- update specific columns (RLS then decides which rows).
revoke insert, update, delete, truncate on public.orders, public.order_items,
  public.order_item_options, public.payments, public.order_status_history
  from authenticated;
revoke truncate on public.deliveries, public.staff_profiles from authenticated;

grant update (status) on public.orders to authenticated;
grant update (status, provider_reference, verified_by, verified_at) on public.payments to authenticated;

-- ---------------------------------------------------------------------------
-- Catalog & store info: public read of active rows, admin write
-- ---------------------------------------------------------------------------
create policy stores_public_read on public.stores
  for select to anon, authenticated
  using (is_active or app_private.is_admin());
create policy stores_admin_write on public.stores
  for all to authenticated
  using (app_private.is_admin()) with check (app_private.is_admin());

create policy store_settings_public_read on public.store_settings
  for select to anon, authenticated
  using (true);
create policy store_settings_admin_write on public.store_settings
  for all to authenticated
  using (app_private.is_admin()) with check (app_private.is_admin());

create policy categories_public_read on public.categories
  for select to anon, authenticated
  using (is_active or app_private.is_store_staff(store_id));
create policy categories_admin_write on public.categories
  for all to authenticated
  using (app_private.is_admin()) with check (app_private.is_admin());

create policy products_public_read on public.products
  for select to anon, authenticated
  using (is_available or app_private.is_store_staff(store_id));
create policy products_admin_write on public.products
  for all to authenticated
  using (app_private.is_admin()) with check (app_private.is_admin());

create policy product_options_public_read on public.product_options
  for select to anon, authenticated
  using (true);
create policy product_options_admin_write on public.product_options
  for all to authenticated
  using (app_private.is_admin()) with check (app_private.is_admin());

create policy product_option_values_public_read on public.product_option_values
  for select to anon, authenticated
  using (true);
create policy product_option_values_admin_write on public.product_option_values
  for all to authenticated
  using (app_private.is_admin()) with check (app_private.is_admin());

create policy delivery_zones_public_read on public.delivery_zones
  for select to anon, authenticated
  using (is_active or app_private.is_store_staff(store_id));
create policy delivery_zones_admin_write on public.delivery_zones
  for all to authenticated
  using (app_private.is_admin()) with check (app_private.is_admin());

-- ---------------------------------------------------------------------------
-- Staff profiles: own row or admin; only admins assign roles
-- ---------------------------------------------------------------------------
create policy staff_profiles_self_read on public.staff_profiles
  for select to authenticated
  using (user_id = (select auth.uid()) or app_private.is_admin());
create policy staff_profiles_admin_insert on public.staff_profiles
  for insert to authenticated
  with check (app_private.is_admin());
create policy staff_profiles_admin_update on public.staff_profiles
  for update to authenticated
  using (app_private.is_admin()) with check (app_private.is_admin());
create policy staff_profiles_admin_delete on public.staff_profiles
  for delete to authenticated
  using (app_private.is_admin());

-- ---------------------------------------------------------------------------
-- Orders & children (PII)
-- ---------------------------------------------------------------------------
create policy orders_read on public.orders
  for select to authenticated
  using (
    app_private.is_store_staff(store_id)
    or (customer_user_id is not null and customer_user_id = (select auth.uid()))
    or app_private.is_assigned_rider(id)
  );
-- Column grant limits this to `status`.
create policy orders_staff_update on public.orders
  for update to authenticated
  using (app_private.is_store_staff(store_id))
  with check (app_private.is_store_staff(store_id));

create policy order_items_read on public.order_items
  for select to authenticated
  using (app_private.can_read_order(order_id));

create policy order_item_options_read on public.order_item_options
  for select to authenticated
  using (
    exists (
      select 1 from public.order_items oi
      where oi.id = order_item_id and app_private.can_read_order(oi.order_id)
    )
  );

create policy order_status_history_read on public.order_status_history
  for select to authenticated
  using (app_private.can_read_order(order_id));

-- ---------------------------------------------------------------------------
-- Payments: store staff only (customers see status via their order)
-- ---------------------------------------------------------------------------
create policy payments_staff_read on public.payments
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and app_private.is_store_staff(o.store_id)
    )
  );
-- Column grant limits writable columns; the verifier must be the caller.
create policy payments_staff_update on public.payments
  for update to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and app_private.is_store_staff(o.store_id)
    )
  )
  with check (
    (verified_by is null or verified_by = (select auth.uid()))
    and exists (
      select 1 from public.orders o
      where o.id = order_id and app_private.is_store_staff(o.store_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Deliveries: store staff manage; riders read/update only their own
-- ---------------------------------------------------------------------------
create policy deliveries_staff_all on public.deliveries
  for all to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and app_private.is_store_staff(o.store_id)
    )
  )
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_id and app_private.is_store_staff(o.store_id)
    )
    and (rider_id is null or app_private.is_store_rider(rider_id, order_id))
  );

create policy deliveries_rider_read on public.deliveries
  for select to authenticated
  using (
    rider_id = (select auth.uid())
    and app_private.current_staff_role() = 'rider'
  );

-- A rider cannot reassign the job to someone else (WITH CHECK) and can only
-- touch jobs that are currently active.
create policy deliveries_rider_update on public.deliveries
  for update to authenticated
  using (
    rider_id = (select auth.uid())
    and status in ('assigned', 'picked_up')
    and app_private.current_staff_role() = 'rider'
  )
  with check (
    rider_id = (select auth.uid())
    and status in ('assigned', 'picked_up', 'delivered', 'failed')
  );

-- Riders must not change which order a delivery belongs to.
revoke update on public.deliveries from authenticated;
grant insert, delete on public.deliveries to authenticated;
grant update (rider_id, status, assigned_at, picked_up_at, delivered_at, note)
  on public.deliveries to authenticated;
