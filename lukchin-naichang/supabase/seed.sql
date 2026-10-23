-- Initial store record. Coordinates, phone, address and PromptPay ID are left
-- NULL until the owner provides real values. Ordering stays disabled.
insert into public.stores (slug, name, timezone)
values ('lukchin-naichang', 'ลูกชิ้นนายช่าง', 'Asia/Bangkok')
on conflict (slug) do nothing;

insert into public.store_settings (store_id, open_time, close_time, delivery_radius_m, ordering_enabled)
select id, '09:00', '22:00', 5000, false
from public.stores
where slug = 'lukchin-naichang'
on conflict (store_id) do nothing;
