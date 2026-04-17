create table if not exists public.vintages (
  region_id bigint not null references public.regions (id) on delete cascade,
  year integer not null check (year between 1800 and 2100),
  notes text,
  created_at timestamptz not null default now(),
  primary key (region_id, year)
);

create index if not exists vintages_year_idx on public.vintages (year);

alter table public.vintages enable row level security;

create policy vintages_select on public.vintages for select to authenticated using (true);
create policy vintages_insert on public.vintages for insert to authenticated with check (true);
create policy vintages_update on public.vintages for update to authenticated using (true) with check (true);
create policy vintages_delete on public.vintages for delete to authenticated using (true);
