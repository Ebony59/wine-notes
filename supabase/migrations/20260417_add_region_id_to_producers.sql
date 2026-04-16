alter table public.producers
add column if not exists region_id bigint references public.regions (id) on delete set null;

create index if not exists producers_region_id_idx on public.producers (region_id);
