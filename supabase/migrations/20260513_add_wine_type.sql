alter table wines
  add column wine_type text
    check (wine_type in ('sparkling', 'white', 'rose', 'red', 'fortified'));
