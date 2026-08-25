-- LOOTFORM Season Hero Asset
-- Date: 2026-08-25
--
-- Purpose:
--   Let Admin attach a custom image or 3D (.glb) model to the landing
--   page hero "mystery box" instead of the hardcoded emoji placeholder.
--   Either asset is optional; PublicHome falls back to the emoji when
--   neither is set.
--
-- Storage:
--   season-hero-images (public, 5 MB, jpeg/png/webp)
--   season-hero-models (public, 50 MB, glb)
--   Both buckets were created directly via the Supabase Storage API to
--   match the existing character-images / character-models convention.

BEGIN;

ALTER TABLE public.season_settings
  ADD COLUMN IF NOT EXISTS hero_image_url text,
  ADD COLUMN IF NOT EXISTS hero_image_path text,
  ADD COLUMN IF NOT EXISTS hero_model_url text,
  ADD COLUMN IF NOT EXISTS hero_model_path text;

COMMIT;
