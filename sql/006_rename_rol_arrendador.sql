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
