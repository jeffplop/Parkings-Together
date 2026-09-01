-- ════════════════════════════════════════════════════════════════════════════
-- 015 · Idempotencia de pagos a nivel de base de datos
-- ────────────────────────────────────────────────────────────────────────────
-- La ruta POST /api/pagos comprueba, antes de insertar, si ya existe un pago
-- 'completed' para la reserva (idempotencia). Pero ese patrón es "check-then-act":
-- dos peticiones concurrentes (p. ej. doble clic) pueden pasar la comprobación a
-- la vez e insertar DOS pagos completados para la misma reserva.
--
-- Este índice único PARCIAL lo hace imposible a nivel de BD: solo puede existir
-- UN pago 'completed' por reserva. El segundo INSERT concurrente falla con
-- violación de unicidad, que la ruta ya traduce a error 500 (o puede tratarse
-- como idempotente). Es la misma filosofía que la reserva con FOR UPDATE:
-- la integridad se garantiza en la base de datos, no en la aplicación.
--
-- Nota: los pagos SIN reserva (reserva_id NULL, p. ej. compras sueltas) no se ven
-- afectados — en un índice único los NULL son distintos entre sí.
--
-- Idempotente: `IF NOT EXISTS`. Ejecutar en Supabase → SQL Editor.
--
-- ⚠️ Prerrequisito: no deben existir ya pagos 'completed' DUPLICADOS por reserva.
-- Si los hubiera (por el hueco corregido en código), la creación del índice
-- fallará. La consulta del final los detecta para limpiarlos antes.
-- ════════════════════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX IF NOT EXISTS payments_un_completed_por_reserva
  ON public.payments (reserva_id)
  WHERE status = 'completed' AND reserva_id IS NOT NULL;

-- ── Detección de duplicados preexistentes (ejecutar ANTES si el índice falla) ──
-- Debe devolver 0 filas. Si devuelve alguna, hay que conservar un pago por
-- reserva y borrar/anular los demás antes de crear el índice.
--
-- SELECT reserva_id, COUNT(*) AS pagos_completados
-- FROM public.payments
-- WHERE status = 'completed' AND reserva_id IS NOT NULL
-- GROUP BY reserva_id
-- HAVING COUNT(*) > 1;
