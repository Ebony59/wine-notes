do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'wine_group_notes'
      and column_name = 'cover_photo_url'
  ) then
    alter table public.wine_group_notes
    add column cover_photo_url text;
  end if;
end
$$;
