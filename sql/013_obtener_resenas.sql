-- 013_obtener_resenas.sql
-- ============================================================================
-- CAUSA RAÍZ del bug "Estacionamiento no encontrado":
-- El endpoint /api/reseñas leía la tabla `reservas` con el SERVICE_ROLE_KEY
-- para poder ver reseñas de TODOS los conductores (RLS de `reservas` solo deja
-- ver las propias). En producción ese createClient lanzaba una excepción no
-- capturada (HTTP 500 con HTML), y como la página de detalle pedía parking +
-- reseñas con un único Promise.all, el fallo de reseñas tumbaba TODA la carga
-- y el parking quedaba en null → "Estacionamiento no encontrado".
--
-- SOLUCIÓN: una RPC SECURITY DEFINER que expone SOLO los campos públicos de la
-- reseña (sin tocar el resto de columnas sensibles de `reservas`) y que puede
-- llamar el cliente anónimo. Elimina por completo la dependencia del
-- SERVICE_ROLE_KEY para leer reseñas.
--
-- Idempotente. Ejecutar después de 008_favoritos_resenas.sql.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.obtener_resenas(p_estacionamiento_id integer)
RETURNS TABLE (
  id               uuid,
  calificacion     integer,
  comentario       text,
  review_photo_url text,
  created_at       timestamptz,
  autor_nombre     text,
  autor_apellido   text,
  autor_avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.calificacion, r.comentario, r.review_photo_url, r.created_at,
         p.nombre, p.apellido, p.avatar_url
  FROM public.reservas r
  LEFT JOIN public.perfiles p ON p.id = r.conductor_id
  WHERE r.estacionamiento_id = p_estacionamiento_id
    AND r.calificacion IS NOT NULL
  ORDER BY r.created_at DESC
  LIMIT 50;
$$;

-- Por defecto una función se concede a PUBLIC; lo revocamos y concedemos solo
-- a los roles esperados (lectura pública de reseñas vía API).
REVOKE ALL ON FUNCTION public.obtener_resenas(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.obtener_resenas(integer) TO anon, authenticated;
