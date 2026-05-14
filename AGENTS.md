# Repo Notes

## Supabase migrations

- Every file in `supabase/migrations/` must have a unique version prefix.
- Use a single migration versioning scheme consistently across this repo.
- Prefer `YYYYMMDDNNN_description.sql` in this project.
- Do not create new short date-only versions like `20260514_description.sql`.
- Do not mix short versions like `20260514` with longer same-day versions like `20260514001`; that causes `supabase migration list` and `supabase db push` history mismatches.
- Before adding a migration, check the existing filenames in `supabase/migrations/` and choose the next unused numeric suffix for that day.
- If migrations for a given day already exist, continue the sequence, for example:
  - `20260514001_...`
  - `20260514002_...`
  - `20260514003_...`
- When changing an existing local migration filename after it has been pushed remotely, also verify remote migration history with `supabase migration list`.
- If Supabase reports remote versions not found locally, first check for version-width mismatches or duplicate day prefixes before using `supabase migration repair`.
- Keep migration SQL idempotent where practical so repeated pushes or repaired history do not fail on already-existing columns, indexes, or policies.
- If two migrations share the same effective version prefix, `supabase db push` can fail because remote and local migration history no longer match cleanly.
