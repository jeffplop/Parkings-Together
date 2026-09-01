-- ════════════════════════════════════════════════════════════════════════════
-- 014 · Recalcular rating / reviews_count desde la realidad
-- ────────────────────────────────────────────────────────────────────────────
-- PROBLEMA (detectado en QA): las semillas de demostración
-- (011_seed_estacionamientos_v2.sql) insertaron `rating` y `reviews_count` con
-- valores curados (p. ej. 4.6★ / 84 reseñas) que NO están respaldados por
-- calificaciones reales. Resultado: un estacionamiento sin ninguna reserva
-- calificada mostraba "social proof" falso, e inconsistente con el panel de
-- reseñas (que sale vacío).
--
-- FUENTE DE VERDAD: `reservas.calificacion` (1..5). El rating de un
-- estacionamiento es el promedio de las calificaciones de sus reservas, y
-- reviews_count el número de ellas — exactamente como lo calcula la RPC
-- `calificar_reserva` (ver sql/008_favoritos_resenas.sql).
--
-- ESTA MIGRACIÓN recalcula ambos campos para TODOS los estacionamientos a partir
-- de esa fuente. Los que no tengan calificaciones reales quedan en 0 / 0, y la UI
-- deja de mostrar el badge (ya filtra por rating > 0 y reviews_count > 0).
--
-- Es idempotente: puede ejecutarse varias veces con el mismo resultado.
--
-- ⚠️ Nota de producto: tras aplicarla, los estacionamientos DEMO perderán su
-- rating curado y se mostrarán sin estrellas hasta recibir reseñas reales. Es el
-- comportamiento honesto; si se prefiere conservar el "demo poblado", NO aplicar
-- esta migración (o sembrar calificaciones reales en `reservas.calificacion`).
-- ════════════════════════════════════════════════════════════════════════════

UPDATE public.estacionamientos e
SET
  rating = COALESCE(agg.avg_cal, 0),
  reviews_count = COALESCE(agg.cnt_cal, 0)
FROM (
  SELECT
    est.id AS est_id,
    ROUND(AVG(r.calificacion)::numeric, 2) AS avg_cal,
    COUNT(r.calificacion)                  AS cnt_cal
  FROM public.estacionamientos est
  LEFT JOIN public.reservas r
    ON r.estacionamiento_id = est.id
   AND r.calificacion IS NOT NULL
  GROUP BY est.id
) AS agg
WHERE e.id = agg.est_id
  AND (
    e.rating        IS DISTINCT FROM COALESCE(agg.avg_cal, 0)
    OR e.reviews_count IS DISTINCT FROM COALESCE(agg.cnt_cal, 0)
  );

-- ── Verificación ────────────────────────────────────────────────────────────
-- Debe devolver 0 filas: ningún estacionamiento con rating/reseñas "colgando"
-- sin calificaciones reales que los respalden.
--
-- SELECT e.id, e.nombre, e.rating, e.reviews_count,
--        COUNT(r.calificacion) AS calificaciones_reales
-- FROM public.estacionamientos e
-- LEFT JOIN public.reservas r
--   ON r.estacionamiento_id = e.id AND r.calificacion IS NOT NULL
-- GROUP BY e.id, e.nombre, e.rating, e.reviews_count
-- HAVING (e.reviews_count <> COUNT(r.calificacion))
--     OR (e.reviews_count = 0 AND e.rating <> 0);
