-- ╔══════════════════════════════════════════════════════════════╗
-- ║  PARKINGS TOGETHER — Vehículo principal (predeterminado)     ║
-- ║  Ejecutar en: Supabase Dashboard > SQL Editor                ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Marca el vehículo que se usará por defecto al reservar.
ALTER TABLE public.vehiculos
  ADD COLUMN IF NOT EXISTS es_principal boolean NOT NULL DEFAULT false;

-- Cada usuario puede tener a lo sumo un vehículo principal.
CREATE UNIQUE INDEX IF NOT EXISTS vehiculos_un_principal_por_usuario
  ON public.vehiculos (user_id)
  WHERE es_principal = true;
