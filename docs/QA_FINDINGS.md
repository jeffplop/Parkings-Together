# Informe de QA y Auditoría — Parkings Together

> Fecha: 2026-06-20 · Método: revisión del sitio en vivo (HTTP) +
> auditoría del código fuente. Pendiente: recorrido interactivo completo
> (requiere la extensión "Claude in Chrome" conectada o credenciales locales).

## 1. Veredicto general

La aplicación está **bien construida y es madura**: arquitectura BFF + microservicios,
seguridad seria (RLS por usuario, rate-limiting, escape de HTML, validación de
contraseña, anti-manipulación de montos), UI responsiva y cuidada, y degradación
elegante ante fallos. Los problemas encontrados son **menores**; no hay fallas
críticas evidentes en el código revisado.

## 2. Reglas de negocio (extraídas del código)

| Área | Regla |
|---|---|
| Registro | Contraseña: 8+ con mayúscula, minúscula, número y símbolo. Roles: `cliente` / `arrendador`. Rate-limit **10 registros/IP/hora**. Crea perfil (trigger) y, si el conductor da patente, su primer vehículo. |
| Estacionamientos | Solo `arrendador` puede publicar (RLS). Lectura pública. Dueño edita/borra los suyos. `occupied_spots` entre 0 y `total_spots` (CHECK). Borrado: **lógico** si tiene reservas activas, físico si no. Precio base 1500 CLP. Búsqueda espacial PostGIS. |
| Reservas | Dos modos: **instantánea** (ocupa cupo ya) y **profesional** (ventana `[inicio, fin)`, valida capacidad por solapamiento; estados pendiente→confirmada→completada/cancelada). Patrón **Saga** con compensación. **Bloqueo de plaza** 5 min anti-concurrencia. |
| Calificación | Solo reservas **completadas**, nota 1–5; recalcula el `rating` del estacionamiento. |
| Pagos | Proveedores `mock`/`efectivo`/`webpay`. Solo el conductor paga **su** reserva. El monto debe coincidir con `precio_total` (anti-manipulación). **Idempotente**. Tope 10.000.000 CLP. Pago **simulado** (Webpay queda para producción). |
| Premium | Planes `free`/`pro`/`premium`, ciclo mensual/anual (anual = 2 meses gratis). El conductor **siempre** reserva gratis; el premium agrega conveniencia/ahorro. |
| Chat soporte (IA) | Rate-limit **20/min/IP**. Detección de prompt-injection. Escalación a humano (fraude, reembolso, legal, emergencia). Claude Haiku, máx. 600 caracteres, contexto últimos 10 mensajes. |
| Resumen de reseñas (IA) | Solo si hay ≥3 reseñas con texto. Cacheado por nº de reseñas; rate-limit solo en cache-miss. Siempre responde 200 (nunca rompe la ficha). |

## 3. Hallazgos

### 3.1 Corregido en esta auditoría
- **`<Toaster>` duplicado** (`apps/web/app/premium/page.js`, `apps/web/app/auth/page.js`):
  el componente ya está montado globalmente en `layout.js`, por lo que en esas dos
  páginas **cada notificación se renderizaba dos veces**. Se eliminaron los locales.
  *Impacto: toasts dobles. Riesgo del fix: nulo (el global cubre toda la app).*

### 3.2 Observaciones positivas (no requieren acción)
- El chat de soporte **escapa el HTML** antes de re-inyectar `<strong>`/`<br>` →
  `dangerouslySetInnerHTML` usado de forma **segura** (sin XSS).
- Pagos **idempotentes** y con verificación de propiedad y de monto.
- Reseñas y resumen IA **degradan a vacío con HTTP 200** para no romper la ficha.

### 3.3 Oportunidades de optimización (sin urgencia)
- **Fuentes y Font Awesome por CDN** en `<head>` (`layout.js`): son recursos
  *render-blocking*. Migrar a `next/font` y a un subconjunto local de iconos
  mejoraría LCP/CLS.
- **Stats del home** (`page.js`): se traen todos los estacionamientos activos al
  cliente para contar plazas/comunas/rating. A escala conviene una RPC de agregado.
- **Cobertura de `api.js`** (BFF) baja (~40% funcs): faltan pruebas de contrato
  para las rutas nuevas (favoritos, pagos, premium, reseñas, soporte).

## 4. Innovación propuesta (hoja de ruta)

- **Pago real con Webpay (Transbank).** La base ya existe: `src/lib/payments.js`
  implementa el patrón **Strategy** y `/api/pagos` ya enruta por proveedor. Falta:
  instalar el SDK de Transbank, implementar la estrategia `webpay` (init transaction
  → redirección → commit en el `return_url`), y configurar credenciales (integración
  → producción). No cambia el resto del flujo.
- **IA (ampliar lo existente):** sugerencia de precio para arrendadores (según zona y
  demanda), búsqueda en lenguaje natural ("plaza cerca del estadio a las 20:00"),
  predicción de disponibilidad.
- **Tiempo real:** ya hay Supabase Realtime habilitado en `estacionamientos`;
  aprovecharlo para ocupación en vivo en el mapa y notificaciones push (PWA).

## 5. Estado y próximos pasos

- ✅ Auditoría de código de las páginas núcleo + verificación del deploy en vivo.
- ✅ Corrección del `<Toaster>` duplicado.
- ⏳ **Recorrido interactivo completo** (login, publicar plaza, reservar, pagar,
  calificar, premium): requiere la extensión *Claude in Chrome* conectada o un
  `.env.local` con credenciales de un proyecto Supabase de prueba.
- ⏳ Integración real de Webpay y pruebas de contrato del BFF.
