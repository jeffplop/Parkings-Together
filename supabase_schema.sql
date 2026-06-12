-- supabase_schema.sql
-- Esquema COMPLETO de producción — incluye todas las migraciones (004–008).
-- Este archivo es de referencia documental; para aplicar cambios usar sql/APLICAR_TODO.sql.
-- Última actualización: 2026-06-03

-- ============================================================================
-- 1. PERFILES  (1:1 con auth.users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.perfiles (
  id           uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre       text        NOT NULL,
  telefono     text,
  avatar_url   text,
  requiere_pmr boolean     DEFAULT false,
  rol          text        NOT NULL DEFAULT 'cliente'
                           CHECK (rol IN ('cliente', 'arrendador')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perfiles_select_own" ON public.perfiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "perfiles_insert_own" ON public.perfiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "perfiles_update_own" ON public.perfiles FOR UPDATE USING (auth.uid() = id);

-- Trigger: crea el perfil automáticamente al registrar usuario.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.perfiles (id, nombre, rol)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'rol', 'cliente')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 2. VEHÍCULOS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.vehiculos (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  placa      text        NOT NULL,
  modelo     text        NOT NULL,
  color      text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vehiculos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehiculos_select_own" ON public.vehiculos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "vehiculos_insert_own" ON public.vehiculos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "vehiculos_update_own" ON public.vehiculos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "vehiculos_delete_own" ON public.vehiculos FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- 3. ESTACIONAMIENTOS
-- IMPORTANTE: en producción id es SERIAL/integer (no uuid).
-- El código API coerciona con Number(id) antes de llamar a las RPCs.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.estacionamientos (
  id             serial      PRIMARY KEY,
  user_id        uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre         text        NOT NULL,
  arrendador     text,
  lat            numeric     NOT NULL,
  lng            numeric     NOT NULL,
  precio_hora    numeric     DEFAULT 0,
  total_spots    integer     NOT NULL DEFAULT 1,
  occupied_spots integer     NOT NULL DEFAULT 0,
  es_pmr         boolean     DEFAULT false,
  rating         numeric     DEFAULT 0,
  reviews_count  integer     DEFAULT 0,
  comuna         text,
  coordenadas    geography(Point, 4326),
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT estacionamientos_spots_validos
    CHECK (occupied_spots >= 0 AND occupied_spots <= total_spots)
);

CREATE INDEX IF NOT EXISTS idx_estacionamientos_user_id ON public.estacionamientos (user_id);
ALTER TABLE public.estacionamientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estacionamientos_select_all"        ON public.estacionamientos FOR SELECT USING (true);
CREATE POLICY "estacionamientos_insert_arrendador" ON public.estacionamientos
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'arrendador')
  );
CREATE POLICY "estacionamientos_update_owner" ON public.estacionamientos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "estacionamientos_delete_owner" ON public.estacionamientos FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- 4. RESERVAS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.reservas (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  estacionamiento_id integer     NOT NULL REFERENCES public.estacionamientos(id) ON DELETE CASCADE,
  conductor_id       uuid        NOT NULL REFERENCES auth.users(id),
  estado             text        NOT NULL DEFAULT 'pendiente'
                                 CHECK (estado IN ('pendiente','confirmada','activa','completada','cancelada')),
  fecha_inicio       timestamptz,
  fecha_fin          timestamptz,
  precio_total       numeric,
  calificacion       integer,
  comentario         text,
  calificada_at      timestamptz,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reservas_rango_valido
    CHECK (fecha_fin IS NULL OR fecha_inicio IS NULL OR fecha_fin > fecha_inicio),
  CONSTRAINT reservas_calificacion_rango
    CHECK (calificacion IS NULL OR calificacion BETWEEN 1 AND 5)
);

CREATE INDEX IF NOT EXISTS idx_reservas_estacionamiento_rango
  ON public.reservas (estacionamiento_id, fecha_inicio, fecha_fin);
CREATE INDEX IF NOT EXISTS idx_reservas_conductor ON public.reservas (conductor_id);

ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reservas_select_conductor"  ON public.reservas FOR SELECT USING (auth.uid() = conductor_id);
CREATE POLICY "reservas_insert_conductor"  ON public.reservas FOR INSERT WITH CHECK (auth.uid() = conductor_id);
CREATE POLICY "reservas_update_conductor"  ON public.reservas FOR UPDATE
  USING (auth.uid() = conductor_id) WITH CHECK (auth.uid() = conductor_id);
CREATE POLICY "reservas_delete_conductor"  ON public.reservas FOR DELETE USING (auth.uid() = conductor_id);
CREATE POLICY "reservas_select_arrendador" ON public.reservas FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.estacionamientos e
    WHERE e.id = reservas.estacionamiento_id AND e.user_id = auth.uid())
);
CREATE POLICY "reservas_update_arrendador" ON public.reservas FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.estacionamientos e
    WHERE e.id = reservas.estacionamiento_id AND e.user_id = auth.uid())
);

-- ============================================================================
-- 5. FAVORITOS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.favoritos (
  id                 uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  estacionamiento_id integer NOT NULL REFERENCES public.estacionamientos(id) ON DELETE CASCADE,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, estacionamiento_id)
);

CREATE INDEX IF NOT EXISTS idx_favoritos_user ON public.favoritos (user_id);
ALTER TABLE public.favoritos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "favoritos_select_own" ON public.favoritos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "favoritos_insert_own" ON public.favoritos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "favoritos_delete_own" ON public.favoritos FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- 6. REALTIME
-- ============================================================================
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.estacionamientos;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL;
END $$;
