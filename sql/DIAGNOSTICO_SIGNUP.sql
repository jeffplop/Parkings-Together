-- ============================================================
-- DIAGNOSTICO_SIGNUP.sql
-- Copia y ejecuta este script en Supabase → SQL Editor
-- para diagnosticar el error 500 en signup.
-- ============================================================

-- 1. Verificar que el trigger existe y apunta a la función correcta
SELECT
  t.trigger_name,
  t.event_object_schema || '.' || t.event_object_table AS tabla,
  t.action_timing,
  t.event_manipulation,
  t.action_statement
FROM information_schema.triggers t
WHERE t.trigger_name = 'on_auth_user_created';

-- 2. Verificar que la función del trigger existe
SELECT
  p.proname AS funcion,
  p.prosecdef AS security_definer,
  pg_get_functiondef(p.oid) AS codigo
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'handle_new_user' AND n.nspname = 'public';

-- 3. Verificar el constraint de rol en perfiles
SELECT
  conname AS nombre_constraint,
  pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE conrelid = 'public.perfiles'::regclass
AND contype = 'c';

-- 4. Ver si hay errores recientes en logs de Postgres
-- (esto puede estar vacío según el plan de Supabase)
SELECT
  log_time,
  error_severity,
  message,
  detail
FROM postgres_log
WHERE error_severity IN ('ERROR', 'FATAL')
  AND log_time > now() - interval '1 hour'
ORDER BY log_time DESC
LIMIT 20;

-- 5. Probar manualmente la lógica del trigger
-- (simula qué pasaría al registrar un usuario nuevo)
DO $$
DECLARE
  test_id uuid := gen_random_uuid();
  test_email text := 'diagnostico_test_' || floor(random()*9999)::text || '@test.com';
  test_rol text := 'cliente';
  test_nombre text := 'Test Usuario';
BEGIN
  -- Intentar insertar un perfil tal como lo haría el trigger
  INSERT INTO public.perfiles (id, nombre, rol)
  VALUES (test_id, COALESCE(test_nombre, split_part(test_email, '@', 1)), COALESCE(test_rol, 'cliente'))
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'EXITO: El trigger funcionaría correctamente con rol=% nombre=%', test_rol, test_nombre;

  -- Limpiar el registro de prueba
  DELETE FROM public.perfiles WHERE id = test_id;

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ERROR en la lógica del trigger: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END $$;

-- 6. Verificar RLS en perfiles (el trigger usa SECURITY DEFINER así que debería ignorar RLS)
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_habilitado
FROM pg_tables
WHERE tablename = 'perfiles' AND schemaname = 'public';

-- 7. Listar las políticas RLS de perfiles
SELECT
  policyname,
  cmd AS operacion,
  qual AS condicion_using,
  with_check
FROM pg_policies
WHERE tablename = 'perfiles' AND schemaname = 'public';
