-- ==================================================================
-- APLICAR_TODO.sql (v3) — Ejecutar completo en Supabase SQL Editor
-- Orden: 004 → 005 → 006 → 007 → 008
-- Todas las migraciones son idempotentes (re-ejecutables).
-- CORRECCIÓN v3: estacionamientos.id es INTEGER en producción.
-- ==================================================================

-- ╔══════════════════════════════════════════╗
-- ╚══════════════════════════════════════════╝
-- ╔══════════════════════════════════════════════════════════════╗
-- ║  PARKINGS TOGETHER — 004 Endurecimiento de Seguridad + RLS    ║
-- ║  Idempotente. Ejecutar en: Supabase Dashboard > SQL Editor    ║
-- ╚══════════════════════════════════════════════════════════════╝
-- Corrige:
--   A) Reserva rota por RLS (conductor no puede incrementar ocupacion).
--   B) Falta de policies UPDATE/DELETE en reservas (cancelar/completar).
--   C) Sin constraint de ocupacion (occupied entre 0 y total).
--   E) Perfil no creado de forma fiable en el registro.
--   Realtime: asegurar publicacion de estacionamientos.

-- ───────────────────────────────────────────────────────────────
-- C) Constraint de ocupacion (NOT VALID para no bloquear filas previas)
-- ───────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'estacionamientos_ocupacion_valida'
  ) THEN
    ALTER TABLE public.estacionamientos
      ADD CONSTRAINT estacionamientos_ocupacion_valida
      CHECK (occupied_spots >= 0 AND occupied_spots <= total_spots) NOT VALID;
  END IF;
END$$;

-- ───────────────────────────────────────────────────────────────
-- B) Policies UPDATE/DELETE para reservas
-- ───────────────────────────────────────────────────────────────
-- Conductor puede actualizar (p.ej. cancelar) sus propias reservas
DROP POLICY IF EXISTS "reservas_update_conductor" ON public.reservas;
CREATE POLICY "reservas_update_conductor" ON public.reservas
  FOR UPDATE USING (auth.uid() = conductor_id)
  WITH CHECK (auth.uid() = conductor_id);

-- Anfitrion puede actualizar (p.ej. completar) reservas de sus estacionamientos
DROP POLICY IF EXISTS "reservas_update_anfitrion" ON public.reservas;
CREATE POLICY "reservas_update_anfitrion" ON public.reservas
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.estacionamientos e
      WHERE e.id = reservas.estacionamiento_id AND e.user_id = auth.uid()
    )
  );

-- Conductor puede eliminar sus reservas (opcional; preferir estado 'cancelada')
DROP POLICY IF EXISTS "reservas_delete_conductor" ON public.reservas;
CREATE POLICY "reservas_delete_conductor" ON public.reservas
  FOR DELETE USING (auth.uid() = conductor_id);

-- ───────────────────────────────────────────────────────────────
-- E) Trigger para crear el perfil automaticamente al registrarse
--    Evita que el perfil falle si la confirmacion por email esta activa.
-- ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.perfiles (id, nombre, rol)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'rol', 'cliente')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ───────────────────────────────────────────────────────────────
-- A) RPC atomica de reserva (resuelve autorizacion + doble reserva)
--    SECURITY DEFINER: ejecuta con privilegios controlados, pero
--    valida internamente que el conductor es el auth.uid() actual.
-- ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reservar_estacionamiento(p_estacionamiento_id integer)
RETURNS public.reservas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_parking public.estacionamientos%ROWTYPE;
  v_reserva public.reservas%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  -- Bloqueo de fila para evitar doble reserva concurrente
  SELECT * INTO v_parking
  FROM public.estacionamientos
  WHERE id = p_estacionamiento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Estacionamiento no encontrado';
  END IF;

  IF v_parking.occupied_spots >= v_parking.total_spots THEN
    RAISE EXCEPTION 'Estacionamiento lleno';
  END IF;

  INSERT INTO public.reservas (estacionamiento_id, conductor_id, estado)
  VALUES (p_estacionamiento_id, v_uid, 'activa')
  RETURNING * INTO v_reserva;

  UPDATE public.estacionamientos
  SET occupied_spots = occupied_spots + 1
  WHERE id = p_estacionamiento_id;

  RETURN v_reserva;
END;
$$;

REVOKE ALL ON FUNCTION public.reservar_estacionamiento(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reservar_estacionamiento(integer) TO authenticated;

-- ───────────────────────────────────────────────────────────────
-- A.2) RPC para cancelar una reserva activa y liberar el cupo
-- ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancelar_reserva(p_reserva_id uuid)
RETURNS public.reservas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_reserva public.reservas%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT * INTO v_reserva FROM public.reservas
  WHERE id = p_reserva_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva no encontrada';
  END IF;

  -- Solo el conductor dueño de la reserva puede cancelarla
  IF v_reserva.conductor_id <> v_uid THEN
    RAISE EXCEPTION 'No autorizado para cancelar esta reserva';
  END IF;

  IF v_reserva.estado <> 'activa' THEN
    RAISE EXCEPTION 'La reserva no esta activa';
  END IF;

  UPDATE public.reservas SET estado = 'cancelada' WHERE id = p_reserva_id
  RETURNING * INTO v_reserva;

  UPDATE public.estacionamientos
  SET occupied_spots = GREATEST(occupied_spots - 1, 0)
  WHERE id = v_reserva.estacionamiento_id;

  RETURN v_reserva;
END;
$$;

REVOKE ALL ON FUNCTION public.cancelar_reserva(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_reserva(uuid) TO authenticated;

-- ───────────────────────────────────────────────────────────────
-- Realtime: asegurar que estacionamientos emite cambios
-- ───────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'estacionamientos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.estacionamientos;
  END IF;
END$$;

-- ╔══════════════════════════════════════════╗
-- ╚══════════════════════════════════════════╝
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

-- ╔══════════════════════════════════════════╗
-- ╚══════════════════════════════════════════╝
-- 006_rename_rol_arrendador.sql
-- Renombra el rol 'anfitrion' -> 'arrendador' en todo el sistema.
-- Idempotente. Ejecutar en: Supabase → SQL Editor.
--
-- Orden recomendado de migraciones: 005 (alinear columnas) y luego 006 (rol).
-- Tras ejecutar, el frontend ya compara rol === 'arrendador'.

BEGIN;

-- 1) Quitar temporalmente el CHECK que restringe los valores del rol.
ALTER TABLE public.perfiles
  DROP CONSTRAINT IF EXISTS perfiles_rol_check;

-- 2) Migrar los datos existentes.
UPDATE public.perfiles
  SET rol = 'arrendador'
  WHERE rol = 'anfitrion';

-- 3) Reponer el CHECK con el nuevo conjunto de valores válidos.
ALTER TABLE public.perfiles
  ADD CONSTRAINT perfiles_rol_check CHECK (rol IN ('cliente', 'arrendador'));

-- 4) Ajustar el default de la columna (si lo hubiera distinto a 'cliente').
ALTER TABLE public.perfiles
  ALTER COLUMN rol SET DEFAULT 'cliente';

-- 5) Asegurar que la política de alta de estacionamientos referencia el rol nuevo.
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

COMMIT;

-- Verificación:
-- SELECT rol, count(*) FROM public.perfiles GROUP BY rol;
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conrelid = 'public.perfiles'::regclass AND conname = 'perfiles_rol_check';

-- ╔══════════════════════════════════════════╗
-- ╚══════════════════════════════════════════╝
-- 007_reservas_pro.sql
-- Sistema de RESERVAS PROFESIONALES (reserva anticipada por ventana de tiempo).
-- Idempotente. Ejecutar en Supabase → SQL Editor DESPUÉS de 004/005/006.
--
-- Modelo:
--   - Convive con la reserva "instantánea" (occupied_spots) sin alterarla.
--   - Una reserva pro ocupa un cupo en el rango [fecha_inicio, fecha_fin).
--   - Anti doble-reserva: por capacidad. Se permite reservar mientras el nº de
--     reservas solapadas vigentes (pendiente/confirmada) sea < total_spots.
--   - Estados: pendiente → confirmada → completada | cancelada.
--   - Reprogramar: cambia el rango re-validando capacidad.

BEGIN;

-- 1) Ampliar la tabla reservas -----------------------------------------------
ALTER TABLE public.reservas
  ADD COLUMN IF NOT EXISTS fecha_inicio timestamptz,
  ADD COLUMN IF NOT EXISTS fecha_fin    timestamptz,
  ADD COLUMN IF NOT EXISTS precio_total numeric,
  ADD COLUMN IF NOT EXISTS updated_at   timestamptz NOT NULL DEFAULT now();

-- Estados válidos (incluye los previos 'activa' para compatibilidad).
ALTER TABLE public.reservas DROP CONSTRAINT IF EXISTS reservas_estado_check;
ALTER TABLE public.reservas
  ADD CONSTRAINT reservas_estado_check
  CHECK (estado IN ('pendiente','confirmada','activa','completada','cancelada'));

-- Coherencia del rango.
ALTER TABLE public.reservas DROP CONSTRAINT IF EXISTS reservas_rango_valido;
ALTER TABLE public.reservas
  ADD CONSTRAINT reservas_rango_valido
  CHECK (fecha_fin IS NULL OR fecha_inicio IS NULL OR fecha_fin > fecha_inicio);

CREATE INDEX IF NOT EXISTS idx_reservas_estacionamiento_rango
  ON public.reservas (estacionamiento_id, fecha_inicio, fecha_fin);
CREATE INDEX IF NOT EXISTS idx_reservas_conductor
  ON public.reservas (conductor_id);

-- updated_at automático.
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_reservas_updated_at ON public.reservas;
CREATE TRIGGER trg_reservas_updated_at
  BEFORE UPDATE ON public.reservas
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) RPC: crear reserva profesional ------------------------------------------
CREATE OR REPLACE FUNCTION public.crear_reserva_pro(
  p_estacionamiento_id integer,
  p_fecha_inicio timestamptz,
  p_fecha_fin timestamptz
)
RETURNS public.reservas
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_parking public.estacionamientos%ROWTYPE;
  v_solapadas int;
  v_horas numeric;
  v_reserva public.reservas%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF p_fecha_inicio IS NULL OR p_fecha_fin IS NULL THEN
    RAISE EXCEPTION 'Faltan fechas de la reserva';
  END IF;
  IF p_fecha_fin <= p_fecha_inicio THEN
    RAISE EXCEPTION 'El fin debe ser posterior al inicio';
  END IF;
  IF p_fecha_inicio < now() THEN
    RAISE EXCEPTION 'No se puede reservar en el pasado';
  END IF;

  -- Bloqueo de la fila del estacionamiento para serializar el chequeo de capacidad.
  SELECT * INTO v_parking FROM public.estacionamientos
    WHERE id = p_estacionamiento_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Estacionamiento no encontrado'; END IF;

  -- Reservas vigentes que se solapan con el rango pedido.
  SELECT count(*) INTO v_solapadas
  FROM public.reservas r
  WHERE r.estacionamiento_id = p_estacionamiento_id
    AND r.estado IN ('pendiente','confirmada','activa')
    AND r.fecha_inicio IS NOT NULL AND r.fecha_fin IS NOT NULL
    AND r.fecha_inicio < p_fecha_fin
    AND r.fecha_fin   > p_fecha_inicio;

  IF v_solapadas >= v_parking.total_spots THEN
    RAISE EXCEPTION 'Estacionamiento lleno para el horario solicitado';
  END IF;

  v_horas := EXTRACT(EPOCH FROM (p_fecha_fin - p_fecha_inicio)) / 3600.0;

  INSERT INTO public.reservas
    (estacionamiento_id, conductor_id, estado, fecha_inicio, fecha_fin, precio_total)
  VALUES
    (p_estacionamiento_id, v_uid, 'pendiente', p_fecha_inicio, p_fecha_fin,
     ROUND(v_horas * COALESCE(v_parking.precio_hora, 0)))
  RETURNING * INTO v_reserva;

  RETURN v_reserva;
END; $$;

REVOKE ALL ON FUNCTION public.crear_reserva_pro(integer,timestamptz,timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.crear_reserva_pro(integer,timestamptz,timestamptz) TO authenticated;

-- 3) RPC: confirmar (solo el arrendador dueño del estacionamiento) ------------
CREATE OR REPLACE FUNCTION public.confirmar_reserva(p_reserva_id uuid)
RETURNS public.reservas
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_reserva public.reservas%ROWTYPE;
  v_owner uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT * INTO v_reserva FROM public.reservas WHERE id = p_reserva_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reserva no encontrada'; END IF;

  SELECT user_id INTO v_owner FROM public.estacionamientos
    WHERE id = v_reserva.estacionamiento_id;
  IF v_owner IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Solo el arrendador puede confirmar la reserva';
  END IF;
  IF v_reserva.estado <> 'pendiente' THEN
    RAISE EXCEPTION 'Solo se confirman reservas pendientes';
  END IF;

  UPDATE public.reservas SET estado = 'confirmada' WHERE id = p_reserva_id
    RETURNING * INTO v_reserva;
  RETURN v_reserva;
END; $$;

REVOKE ALL ON FUNCTION public.confirmar_reserva(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.confirmar_reserva(uuid) TO authenticated;

-- 4) RPC: cancelar reserva pro (conductor dueño o arrendador del espacio) -----
CREATE OR REPLACE FUNCTION public.cancelar_reserva_pro(p_reserva_id uuid)
RETURNS public.reservas
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_reserva public.reservas%ROWTYPE;
  v_owner uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT * INTO v_reserva FROM public.reservas WHERE id = p_reserva_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reserva no encontrada'; END IF;

  SELECT user_id INTO v_owner FROM public.estacionamientos
    WHERE id = v_reserva.estacionamiento_id;
  IF v_reserva.conductor_id <> v_uid AND v_owner IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'No autorizado para cancelar esta reserva';
  END IF;
  IF v_reserva.estado IN ('completada','cancelada') THEN
    RAISE EXCEPTION 'La reserva ya está finalizada';
  END IF;

  UPDATE public.reservas SET estado = 'cancelada' WHERE id = p_reserva_id
    RETURNING * INTO v_reserva;
  RETURN v_reserva;
END; $$;

REVOKE ALL ON FUNCTION public.cancelar_reserva_pro(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_reserva_pro(uuid) TO authenticated;

-- 5) RPC: reprogramar (conductor dueño; re-valida capacidad) ------------------
CREATE OR REPLACE FUNCTION public.reprogramar_reserva(
  p_reserva_id uuid,
  p_fecha_inicio timestamptz,
  p_fecha_fin timestamptz
)
RETURNS public.reservas
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_reserva public.reservas%ROWTYPE;
  v_parking public.estacionamientos%ROWTYPE;
  v_solapadas int;
  v_horas numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF p_fecha_fin <= p_fecha_inicio THEN RAISE EXCEPTION 'Rango inválido'; END IF;
  IF p_fecha_inicio < now() THEN RAISE EXCEPTION 'No se puede reprogramar al pasado'; END IF;

  SELECT * INTO v_reserva FROM public.reservas WHERE id = p_reserva_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reserva no encontrada'; END IF;
  IF v_reserva.conductor_id <> v_uid THEN
    RAISE EXCEPTION 'Solo el conductor puede reprogramar su reserva';
  END IF;
  IF v_reserva.estado NOT IN ('pendiente','confirmada') THEN
    RAISE EXCEPTION 'Solo se reprograman reservas pendientes o confirmadas';
  END IF;

  SELECT * INTO v_parking FROM public.estacionamientos
    WHERE id = v_reserva.estacionamiento_id FOR UPDATE;

  -- Capacidad en el nuevo rango, excluyendo la propia reserva.
  SELECT count(*) INTO v_solapadas
  FROM public.reservas r
  WHERE r.estacionamiento_id = v_reserva.estacionamiento_id
    AND r.id <> p_reserva_id
    AND r.estado IN ('pendiente','confirmada','activa')
    AND r.fecha_inicio < p_fecha_fin
    AND r.fecha_fin   > p_fecha_inicio;

  IF v_solapadas >= v_parking.total_spots THEN
    RAISE EXCEPTION 'Estacionamiento lleno para el nuevo horario';
  END IF;

  v_horas := EXTRACT(EPOCH FROM (p_fecha_fin - p_fecha_inicio)) / 3600.0;

  UPDATE public.reservas
    SET fecha_inicio = p_fecha_inicio,
        fecha_fin = p_fecha_fin,
        precio_total = ROUND(v_horas * COALESCE(v_parking.precio_hora, 0)),
        estado = 'pendiente'  -- una reprogramación vuelve a requerir confirmación
    WHERE id = p_reserva_id
    RETURNING * INTO v_reserva;
  RETURN v_reserva;
END; $$;

REVOKE ALL ON FUNCTION public.reprogramar_reserva(uuid,timestamptz,timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reprogramar_reserva(uuid,timestamptz,timestamptz) TO authenticated;

COMMIT;

-- Verificación:
-- SELECT column_name FROM information_schema.columns
--  WHERE table_schema='public' AND table_name='reservas' ORDER BY ordinal_position;

-- ╔══════════════════════════════════════════╗
-- ╚══════════════════════════════════════════╝
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
