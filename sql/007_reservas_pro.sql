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
