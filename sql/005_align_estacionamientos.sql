-- 005_align_estacionamientos.sql
-- Objetivo: alinear la tabla `public.estacionamientos` de PRODUCCIÓN con lo que
-- el código de apps/web espera (POST/PATCH en app/api/mapas/search/route.js).
--
-- Contexto: la API de producción devuelve hoy las columnas:
--   id, nombre, lat, lng, precio_hora, es_pmr, rating, reviews_count,
--   comuna, created_at, coordenadas
-- y NO tiene: user_id, total_spots, occupied_spots, arrendador.
-- Por eso el alta de estacionamientos (POST) y la actualización de ocupación
-- (PATCH) fallan en producción.
--
-- Esta migración es IDEMPOTENTE: se puede ejecutar varias veces sin error.
-- Ejecutar en: Supabase → SQL Editor (proyecto obthriistwvcutjfrksh).

BEGIN;

-- 1) Columnas que el código necesita -----------------------------------------
ALTER TABLE public.estacionamientos
  ADD COLUMN IF NOT EXISTS user_id        uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS arrendador     text,
  ADD COLUMN IF NOT EXISTS total_spots    integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS occupied_spots integer NOT NULL DEFAULT 0;

-- Coherencia de ocupación (no negativa, no mayor que el total).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'estacionamientos_spots_validos'
  ) THEN
    ALTER TABLE public.estacionamientos
      ADD CONSTRAINT estacionamientos_spots_validos
      CHECK (occupied_spots >= 0 AND occupied_spots <= total_spots);
  END IF;
END $$;

-- Índice para las consultas por propietario (GET ?userId= y "mis estacionamientos").
CREATE INDEX IF NOT EXISTS idx_estacionamientos_user_id
  ON public.estacionamientos (user_id);

-- 2) Row Level Security -------------------------------------------------------
ALTER TABLE public.estacionamientos ENABLE ROW LEVEL SECURITY;

-- Lectura pública (cualquiera puede ver los estacionamientos).
DROP POLICY IF EXISTS "estacionamientos_select_all" ON public.estacionamientos;
CREATE POLICY "estacionamientos_select_all" ON public.estacionamientos
  FOR SELECT USING (true);

-- Alta: solo arrendadores, y solo a su propio nombre (user_id = auth.uid()).
-- NOTA: ejecutar 006_rename_rol_arrendador.sql para migrar el valor del rol.
DROP POLICY IF EXISTS "estacionamientos_insert_anfitrion" ON public.estacionamientos;
DROP POLICY IF EXISTS "estacionamientos_insert_arrendador" ON public.estacionamientos;
CREATE POLICY "estacionamientos_insert_arrendador" ON public.estacionamientos
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE id = auth.uid() AND rol = 'arrendador'
    )
  );

-- Actualización: solo el propietario.
DROP POLICY IF EXISTS "estacionamientos_update_owner" ON public.estacionamientos;
CREATE POLICY "estacionamientos_update_owner" ON public.estacionamientos
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Borrado: solo el propietario.
DROP POLICY IF EXISTS "estacionamientos_delete_owner" ON public.estacionamientos;
CREATE POLICY "estacionamientos_delete_owner" ON public.estacionamientos
  FOR DELETE USING (auth.uid() = user_id);

-- 3) Realtime -----------------------------------------------------------------
-- El frontend (useMapRadar) se suscribe a cambios de esta tabla. Aseguramos que
-- la tabla esté en la publicación de Realtime. (Ignorar si ya está añadida.)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.estacionamientos;
EXCEPTION
  WHEN duplicate_object THEN NULL;  -- ya estaba en la publicación
  WHEN undefined_object THEN NULL;  -- la publicación no existe en este entorno
END $$;

COMMIT;

-- 4) Verificación (ejecutar aparte para comprobar) ----------------------------
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'estacionamientos'
--  ORDER BY ordinal_position;
--
-- SELECT polname, cmd FROM pg_policies
--  WHERE schemaname = 'public' AND tablename = 'estacionamientos';
