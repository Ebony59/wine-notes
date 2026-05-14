# Claude Repo Guidance

## Supabase migration rules

- Use `YYYYMMDDNNN_description.sql` for all new files in `supabase/migrations/`.
- Never add a date-only migration such as `20260514_description.sql`.
- Never mix `YYYYMMDD` and `YYYYMMDDNNN` versions for the same day.
- Before creating a migration, inspect `supabase/migrations/` and pick the next unused suffix for that date.
- Treat migration versions as durable identifiers. If a migration is already on remote, renaming it later may require `supabase migration repair` to reconcile history.
- If `supabase db push` says remote versions are not found locally, check filename/version mismatches first.
- Prefer idempotent SQL for additive changes:
  - guard columns with `if not exists` or catalog checks
  - guard indexes with `if not exists` or catalog checks
  - guard policies with `drop policy if exists` before recreate when appropriate

## Recommended workflow

1. Check existing migration filenames in `supabase/migrations/`.
2. Create the next sequential version for that day.
3. Write migration SQL so reruns are safe where possible.
4. Run `supabase migration list` if there is any doubt about local/remote history.
5. Run `supabase db push` only after confirming the version naming is clean.
