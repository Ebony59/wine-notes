create table if not exists public.producer_regions (
  producer_id bigint not null references public.producers (id) on delete cascade,
  region_id bigint not null references public.regions (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (producer_id, region_id)
);

create index if not exists producer_regions_region_id_idx on public.producer_regions (region_id);

grant select, insert, update, delete on public.producer_regions to authenticated;

insert into public.producer_regions (producer_id, region_id)
select id, region_id
from public.producers
where region_id is not null
on conflict (producer_id, region_id) do nothing;

alter table public.producer_regions enable row level security;

drop policy if exists producer_regions_select on public.producer_regions;
create policy producer_regions_select on public.producer_regions
for select to authenticated
using (true);

drop policy if exists producer_regions_insert on public.producer_regions;
create policy producer_regions_insert on public.producer_regions
for insert to authenticated
with check (true);

drop policy if exists producer_regions_update on public.producer_regions;
create policy producer_regions_update on public.producer_regions
for update to authenticated
using (true)
with check (true);

drop policy if exists producer_regions_delete on public.producer_regions;
create policy producer_regions_delete on public.producer_regions
for delete to authenticated
using (true);
