-- Add cover_photo_url to all knowledge lookup tables
ALTER TABLE public.countries ADD COLUMN IF NOT EXISTS cover_photo_url TEXT;
ALTER TABLE public.regions    ADD COLUMN IF NOT EXISTS cover_photo_url TEXT;
ALTER TABLE public.subregions ADD COLUMN IF NOT EXISTS cover_photo_url TEXT;
ALTER TABLE public.grapes     ADD COLUMN IF NOT EXISTS cover_photo_url TEXT;

-- Photos for countries
CREATE TABLE IF NOT EXISTS public.country_photos (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id   BIGINT      NOT NULL REFERENCES public.countries(id) ON DELETE CASCADE,
  storage_path TEXT,
  external_url TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS country_photos_country_id_idx ON public.country_photos (country_id);

-- Photos for regions
CREATE TABLE IF NOT EXISTS public.region_photos (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id    BIGINT      NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  storage_path TEXT,
  external_url TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS region_photos_region_id_idx ON public.region_photos (region_id);

-- Photos for subregions
CREATE TABLE IF NOT EXISTS public.subregion_photos (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  subregion_id   BIGINT      NOT NULL REFERENCES public.subregions(id) ON DELETE CASCADE,
  storage_path   TEXT,
  external_url   TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subregion_photos_subregion_id_idx ON public.subregion_photos (subregion_id);

-- Photos for grapes
CREATE TABLE IF NOT EXISTS public.grape_photos (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  grape_id     BIGINT      NOT NULL REFERENCES public.grapes(id) ON DELETE CASCADE,
  storage_path TEXT,
  external_url TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS grape_photos_grape_id_idx ON public.grape_photos (grape_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.country_photos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.region_photos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subregion_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grape_photos     ENABLE ROW LEVEL SECURITY;

-- country_photos
CREATE POLICY country_photos_select ON public.country_photos FOR SELECT TO authenticated USING (true);
CREATE POLICY country_photos_insert ON public.country_photos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY country_photos_update ON public.country_photos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY country_photos_delete ON public.country_photos FOR DELETE TO authenticated USING (true);

-- region_photos
CREATE POLICY region_photos_select ON public.region_photos FOR SELECT TO authenticated USING (true);
CREATE POLICY region_photos_insert ON public.region_photos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY region_photos_update ON public.region_photos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY region_photos_delete ON public.region_photos FOR DELETE TO authenticated USING (true);

-- subregion_photos
CREATE POLICY subregion_photos_select ON public.subregion_photos FOR SELECT TO authenticated USING (true);
CREATE POLICY subregion_photos_insert ON public.subregion_photos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY subregion_photos_update ON public.subregion_photos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY subregion_photos_delete ON public.subregion_photos FOR DELETE TO authenticated USING (true);

-- grape_photos
CREATE POLICY grape_photos_select ON public.grape_photos FOR SELECT TO authenticated USING (true);
CREATE POLICY grape_photos_insert ON public.grape_photos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY grape_photos_update ON public.grape_photos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY grape_photos_delete ON public.grape_photos FOR DELETE TO authenticated USING (true);
