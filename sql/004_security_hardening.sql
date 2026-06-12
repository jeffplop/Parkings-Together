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
