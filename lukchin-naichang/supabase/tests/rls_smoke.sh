#!/usr/bin/env bash
# Applies the migrations to a throwaway local Postgres with a minimal
# Supabase stub (auth.users, auth.uid(), anon/authenticated roles) and checks
# RLS behaviour per role. Never point this at a real project.
# Usage: PGHOST=/socket/dir PGPORT=54329 PGUSER=postgres supabase/tests/rls_smoke.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=ln_rls_test
psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
P="psql -q -At -v ON_ERROR_STOP=1 -d $DB"
# Roles are cluster-wide, so tolerate them existing from a previous run.
for r in anon authenticated; do
  $P -c "do \$\$ begin create role $r nologin; exception when duplicate_object then null; end \$\$"
done
$P <<'EOF'
create schema auth; grant usage on schema auth to anon, authenticated;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
EOF
for f in supabase/migrations/*.sql supabase/seed.sql supabase/seed.sql; do $P -f "$f"; done

A=00000000-0000-0000-0000-00000000000a S1=00000000-0000-0000-0000-000000000051
S2=00000000-0000-0000-0000-000000000052 R1=00000000-0000-0000-0000-000000000071
R2=00000000-0000-0000-0000-000000000072 RB=00000000-0000-0000-0000-000000000073
C=00000000-0000-0000-0000-0000000000c1 O=00000000-0000-0000-0000-0000000000e1
ORD=22222222-2222-2222-2222-222222222222 SB=11111111-1111-1111-1111-111111111112
$P <<EOF
insert into auth.users select x::uuid, x from unnest(array['$A','$S1','$S2','$R1','$R2','$RB','$C','$O']) x;
insert into stores(id,slug,name) values ('$SB','other-store','Other');
insert into staff_profiles(user_id,store_id,role) values
 ('$A',null,'admin'),
 ('$S1',(select id from stores where slug='lukchin-naichang'),'staff'),
 ('$S2','$SB','staff'),
 ('$R1',(select id from stores where slug='lukchin-naichang'),'rider'),
 ('$R2',(select id from stores where slug='lukchin-naichang'),'rider'),
 ('$RB','$SB','rider');
insert into orders(id,order_number,store_id,customer_user_id,customer_name,customer_phone,fulfillment,delivery_address,delivery_latitude,delivery_longitude,subtotal_satang,delivery_fee_satang,total_satang)
 values ('$ORD','LN-0001',(select id from stores where slug='lukchin-naichang'),'$C','Test','0812345678','delivery','addr',15.2,104.8,10000,2000,12000);
insert into order_items(order_id,product_name,unit_price_satang,quantity,line_total_satang) values ('$ORD','x',5000,2,10000);
insert into payments(order_id,amount_satang) values ('$ORD',12000);
insert into deliveries(order_id,rider_id,status,assigned_at) values ('$ORD','$R1','assigned',now());
EOF

pass=0; fail=0
t() { # role sub sql expected label
  local out
  out=$($P 2>&1 <<EOF | tr '\n' ' ' | sed 's/ *$//'
begin; set local role $1; select set_config('request.jwt.claim.sub','$2',true) \g /dev/null
$3;
rollback;
EOF
) || true
  if [[ "$out" == *"$4"* ]]; then pass=$((pass+1)); echo "ok   $5"; else fail=$((fail+1)); echo "FAIL $5 => got [$out] want [$4]"; fi
}
DENIED="permission denied"; RLS="violates row-level security"
t anon "" "select count(*) from stores" "2" "anon reads public stores"
for tb in orders order_items order_item_options payments deliveries staff_profiles order_status_history; do
  t anon "" "select count(*) from $tb" "$DENIED" "anon denied on $tb"
done
t anon "" "insert into products(store_id,name,price_satang) select id,'x',1 from stores limit 1" "$DENIED" "anon cannot write catalog"
t authenticated $O "select (select count(*) from orders)||','||(select count(*) from staff_profiles)||','||(select count(*) from order_items)" "0,0,0" "outsider sees nothing"
t authenticated $C "select (select count(*) from orders)||','||(select count(*) from payments)||','||(select count(*) from order_items)" "1,0,1" "customer sees own order only"
t authenticated $C "with u as (update orders set status='completed' returning 1) select 'rows='||count(*) from u" "rows=0" "customer cannot change status"
t authenticated $S1 "select (select count(*) from orders)||','||(select count(*) from payments)||','||(select count(*) from staff_profiles)" "1,1,1" "staff sees own store"
t authenticated $S1 "update orders set status='confirmed' returning status" "confirmed" "staff updates status"
t authenticated $S1 "update orders set total_satang=1 returning id" "$DENIED" "staff cannot alter totals"
t authenticated $S1 "with u as (update staff_profiles set role='admin' where user_id='$S1' returning 1) select 'rows='||count(*) from u" "rows=0" "staff cannot self-escalate"
t authenticated $S1 "insert into staff_profiles(user_id,role) values ('$O','admin')" "$RLS" "staff cannot create admin"
t authenticated $S1 "update payments set status='verified', verified_by='$A', verified_at=now() returning id" "$RLS" "staff cannot verify as someone else"
t authenticated $S1 "update payments set status='verified', verified_by='$S1' returning status" "verified" "staff verifies as self"
t authenticated $S1 "update payments set amount_satang=1 returning id" "$DENIED" "staff cannot alter amount"
t authenticated $S1 "update payments set status='verified', verified_by='$S1'; update payments set status='pending', verified_by=null, verified_at=null" "cannot return to" "verified payment cannot be reversed"
t authenticated $S1 "update payments set status='verified', verified_by='$S1'; update payments set verified_at=now()-interval '1 day'" "immutable" "verification time cannot be backdated"
t authenticated $S2 "select (select count(*) from orders)||','||(select count(*) from payments)||','||(select count(*) from deliveries)" "0,0,0" "other-store staff isolated"
t authenticated $S1 "update deliveries set rider_id='$RB' returning id" "$RLS" "staff cannot assign other-store rider"
t authenticated $S1 "update deliveries set rider_id='$R2' returning id" "-" "staff reassigns same-store rider"
t authenticated $R1 "select (select count(*) from orders)||','||(select count(*) from deliveries)||','||(select count(*) from payments)" "1,1,0" "assigned rider sees order, not payments"
t authenticated $R2 "select (select count(*) from orders)||','||(select count(*) from deliveries)" "0,0" "unassigned rider sees nothing"
t authenticated $R1 "update deliveries set rider_id='$R2' returning id" "$RLS" "rider cannot hand job to another"
t authenticated $R1 "update deliveries set order_id=gen_random_uuid() returning id" "$DENIED" "rider cannot change order_id"
t authenticated $R1 "update deliveries set status='delivered', delivered_at=now(); select count(*) from orders" "0" "rider loses PII access after delivery"
t authenticated $A "select (select count(*) from orders)||','||(select count(*) from staff_profiles)||','||(select count(*) from payments)" "1,6,1" "admin sees all"
t authenticated $S1 "update orders set status='preparing'; select string_agg(coalesce(from_status::text,'-')||'>'||to_status, ' ' order by id) from order_status_history" "->pending_payment pending_payment>preparing" "status history logged"
t authenticated $S1 "insert into order_status_history(order_id,to_status) values ('$ORD','completed')" "$DENIED" "history cannot be forged"
t authenticated $O "select app_private.is_admin()" "f" "outsider is not admin"
echo "passed=$pass failed=$fail"
psql -q -d postgres -c "drop database $DB"
[[ $fail -eq 0 ]]
