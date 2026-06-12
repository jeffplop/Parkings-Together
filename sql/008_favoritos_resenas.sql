-- 008_favoritos_resenas.sql  (v3)
-- Favoritos + Calificaciones/Reseñas.
-- CORRECCIÓN: estacionamientos.id en producción es INTEGER (no uuid).
-- Se hace DROP TABLE IF EXISTS porque la tabla aún no tiene datos de producción.
-- Idempotente. Ejecutar DESPUÉS de 005/006/007.

BEGIN;

-- ============================================================================
-- 1) FAVORITOS
-- ============================================================================

-- Borramos si quedó creada con el tipo incorrecto (sin datos, es seguro).
DROP TABLE IF EXISTS public.favoritos;

CREATE TABLE public.favoritos (
  id                 uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  estacionamiento_id integer NOT NULL REFERENCES public.estacionamientos(id) ON DELETE CASCADE,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, estacionamiento_id)
);

CREATE INDEX idx_favoritos_user ON public.favoritos (user_id);

ALTER TABLE public.favoritos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "favoritos_select_own" ON public.favoritos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "favoritos_insert_own" ON public.favoritos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "favoritos_delete_own" ON public.favoritos
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- 2) CALIFICACIONES / RESEÑAS
-- ============================================================================
ALTER TABLE public.reservas
  ADD COLUMN IF NOT EXISTS calificacion   int,
  ADD COLUMN IF NOT EXISTS comentario     text,
  ADD COLUMN IF NOT EXISTS calificada_at  timestamptz;

ALTER TABLE public.reservas DROP CONSTRAINT IF EXISTS reservas_calificacion_rango;
ALTER TABLE public.reservas
  ADD CONSTRAINT reservas_calificacion_rango
  CHECK (calificacion IS NULL OR calificacion BETWEEN 1 AND 5);

-- Columnas de agregado (en prod ya existen → idempotente).
ALTER TABLE public.estacionamientos
  ADD COLUMN IF NOT EXISTS rating        numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reviews_count integer DEFAULT 0;

-- ============================================================================
-- 3) RPC: calificar reserva propia + recalcular rating del estacionamiento
-- ============================================================================
CREATE OR REPLACE FUNCTION public.calificar_reserva(
  p_reserva_id   uuid,
  p_calificacion integer,
  p_comentario   text DEFAULT NULL
)
RETURNS public.reservas
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_reserva public.reservas%ROWTYPE;
  v_avg     numeric;
  v_cnt     integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF p_calificacion < 1 OR p_calificacion > 5 THEN
    RAISE EXCEPTION 'La calificación debe estar entre 1 y 5';
  END IF;

  SELECT * INTO v_reserva FROM public.reservas WHERE id = p_reserva_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reserva no encontrada'; END IF;
  IF v_reserva.conductor_id <> v_uid THEN
    RAISE EXCEPTION 'Solo el conductor puede calificar su reserva';
  END IF;
  IF v_reserva.estado <> 'completada' THEN
    RAISE EXCEPTION 'Solo se califican reservas completadas';
  END IF;

  UPDATE public.reservas
    SET calificacion  = p_calificacion,
        comentario    = p_comentario,
        calificada_at = now()
    WHERE id = p_reserva_id
    RETURNING * INTO v_reserva;

  SELECT ROUND(AVG(calificacion)::numeric, 2), COUNT(*)
    INTO v_avg, v_cnt
    FROM public.reservas
    WHERE estacionamiento_id = v_reserva.estacionamiento_id
      AND calificacion IS NOT NULL;

  UPDATE public.estacionamientos
    SET rating        = COALESCE(v_avg, 0),
        reviews_count = COALESCE(v_cnt, 0)
    WHERE id = v_reserva.estacionamiento_id;

  RETURN v_reserva;
END; $$;

REVOKE ALL ON FUNCTION public.calificar_reserva(uuid,integer,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.calificar_reserva(uuid,integer,text) TO authenticated;

-- ============================================================================
-- 4) RPC: completar reserva (arrendador o conductor)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.completar_reserva(p_reserva_id uuid)
RETURNS public.reservas
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_reserva public.reservas%ROWTYPE;
  v_owner   uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT * INTO v_reserva FROM public.reservas WHERE id = p_reserva_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reserva no encontrada'; END IF;

  SELECT user_id INTO v_owner
    FROM public.estacionamientos WHERE id = v_reserva.estacionamiento_id;

  IF v_reserva.conductor_id <> v_uid AND v_owner IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF v_reserva.estado NOT IN ('confirmada','activa') THEN
    RAISE EXCEPTION 'Solo se completan reservas confirmadas o activas';
  END IF;

  UPDATE public.reservas SET estado = 'completada'
    WHERE id = p_reserva_id
    RETURNING * INTO v_reserva;

  RETURN v_reserva;
END; $$;

REVOKE ALL ON FUNCTION public.completar_reserva(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.completar_reserva(uuid) TO authenticated;

COMMIT;
