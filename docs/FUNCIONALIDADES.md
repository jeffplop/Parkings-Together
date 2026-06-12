# Funcionalidades implementadas

Resumen de las features añadidas y cómo activarlas.

## Orden de migraciones SQL (Supabase → SQL Editor)
Ejecutar en este orden (todas idempotentes):

1. `sql/005_align_estacionamientos.sql` — columnas user_id/total_spots/occupied_spots/arrendador + RLS.
2. `sql/006_rename_rol_arrendador.sql` — rol `anfitrion` → `arrendador`.
3. `sql/007_reservas_pro.sql` — reservas profesionales (ventana de tiempo, estados, RPCs).
4. `sql/008_favoritos_resenas.sql` — favoritos + calificaciones + completar reserva.

## 1. Reservas profesionales
- Reserva anticipada por rango horario, anti doble-reserva por capacidad.
- Estados: pendiente → confirmada → completada | cancelada; reprogramación.
- UI conductor: pestaña **"Mis Reservas"** en `/profile` (cancelar / calificar).
- UI arrendador: panel **"Reservas Recibidas"** en `/dashboard` (confirmar / completar / cancelar).
- Detalle: `docs/RESERVAS-PRO.md`.

## 2. Favoritos
- Tabla `favoritos` (RLS por usuario), API `/api/favoritos` (GET/POST/DELETE).
- Cliente: `api.favoritos.listar() / agregar(id) / quitar(id)`.
- UI pendiente: botón de favorito en tarjetas del mapa y listado en perfil
  (backend y cliente listos).

## 3. Historial + Calificaciones
- El historial del conductor se deriva de `reservas` (vista "Mis Reservas").
- Calificación 1–5 + comentario por reserva completada
  (`api.reservas.calificar`), con recálculo del `rating`/`reviews_count`
  del estacionamiento. RPC `calificar_reserva`.
- RPC `completar_reserva` para cerrar una reserva (arrendador o conductor).

## 4. Búsqueda avanzada
- `GET /api/mapas/search` admite filtros combinables (aditivo, sin romper nada):
  `q` (texto en nombre), `comuna`, `pmr=true`, `disponible=true`,
  `precioMax`, además de `lat/lng/radius`.
- Cliente: `api.mapas.buscar({ q, comuna, pmr, disponible, precioMax, lat, lng, radius })`.
- UI pendiente: panel de filtros en `/mapa` (backend y cliente listos).

## Regla visual
Toda la UI nueva reutiliza las clases y el estilo existentes (glass-panel,
tab-pane, badges); no se modificó la identidad visual.
