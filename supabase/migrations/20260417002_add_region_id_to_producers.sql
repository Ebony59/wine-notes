do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'producers'
      and column_name = 'region_id'
  ) then
    alter table public.producers
    add column region_id bigint references public.regions (id) on delete set null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'producers_region_id_idx'
  ) then
    create index producers_region_id_idx on public.producers (region_id);
  end if;
end
$$;
