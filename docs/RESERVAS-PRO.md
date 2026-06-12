# Reservas Profesionales

Sistema de reserva anticipada por ventana de tiempo, con estados y protección
contra doble reserva. Convive con la reserva "instantánea" existente sin
alterarla.

## Modelo de datos (migración `sql/007_reservas_pro.sql`)
Amplía `public.reservas` con:
- `fecha_inicio`, `fecha_fin` (timestamptz) — ventana reservada.
- `precio_total` (numeric) — `horas × precio_hora` del estacionamiento.
- `updated_at` (timestamptz, trigger automático).
- Estados: `pendiente → confirmada → completada | cancelada` (se conserva
  `activa` del flujo instantáneo por compatibilidad).
- Índices por `(estacionamiento_id, fecha_inicio, fecha_fin)` y `conductor_id`.

### Anti doble-reserva
Por capacidad: una reserva se acepta si el nº de reservas vigentes
(`pendiente/confirmada/activa`) que **se solapan** con el rango pedido es
`< total_spots`. La comprobación se hace dentro de una transacción con
`SELECT ... FOR UPDATE` sobre la fila del estacionamiento, evitando condiciones
de carrera entre reservas concurrentes.

## RPCs (SECURITY DEFINER, solo `authenticated`)
- `crear_reserva_pro(estacionamiento_id, fecha_inicio, fecha_fin)` → conductor.
- `confirmar_reserva(reserva_id)` → solo el arrendador dueño del espacio.
- `cancelar_reserva_pro(reserva_id)` → conductor dueño o arrendador del espacio.
- `reprogramar_reserva(reserva_id, fecha_inicio, fecha_fin)` → conductor dueño;
  re-valida capacidad y vuelve a `pendiente`.

## API (mismo origen)
- `POST /api/reservas/reserve` — con `fecha_inicio`+`fecha_fin` crea reserva PRO;
  sin ellas, reserva instantánea (legacy).
- `GET  /api/reservas/manage?scope=conductor|arrendador` — lista (RLS acota).
- `PATCH /api/reservas/manage` — `{ action: confirmar|cancelar|reprogramar, reserva_id, [fecha_inicio, fecha_fin] }`.

## Cliente (`apps/web/src/lib/api.js`)
`api.reservas.crearReserva({ parking_id, user_id, fecha_inicio, fecha_fin })`,
`.listar(scope)`, `.confirmar(id)`, `.cancelar(id)`, `.reprogramar(id, ini, fin)`.

## Cómo aplicar
1. Ejecutar en Supabase SQL Editor, en orden: `005` → `006` → `007`.
2. Desplegar el código (ya en la rama).

## Pendiente (UI)
Falta cablear la UI en `dashboard` (panel del arrendador: confirmar/cancelar) y
`profile` (conductor: mis reservas, reprogramar/cancelar). El backend y el
cliente JS ya están listos. Se hará respetando el diseño visual actual.

## Riesgo conocido — rewrites de next.config
`apps/web/next.config.js` reescribe `/api/reservas/:path*` hacia un microservicio
externo **solo si** están definidas `NEXT_PUBLIC_MS_AUTH_URL`,
`NEXT_PUBLIC_MS_MAPAS_URL` y `NEXT_PUBLIC_MS_RESERVAS_URL` en producción. Hoy no
lo están (por eso el mismo-origen funciona). Si se definieran, interceptarían
`/api/reservas/manage` y romperían este flujo. Recomendación: no definir esas
variables mientras se use el modelo de mismo-origen, o eliminar los rewrites.
