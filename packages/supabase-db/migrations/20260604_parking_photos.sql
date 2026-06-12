-- Add photos array to estacionamientos
ALTER TABLE estacionamientos ADD COLUMN IF NOT EXISTS photos text[] DEFAULT '{}';

-- Storage bucket for parking photos (handled via Supabase dashboard, but add policy)
-- The bucket 'parking-photos' must be created manually or via dashboard.
-- RLS policy: arrendadores can upload to their own folder
