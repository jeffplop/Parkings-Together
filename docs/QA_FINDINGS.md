# Informe de QA y Auditoría — Parkings Together

> Fecha: 2026-06-20 · Método: **QA interactivo del sitio en vivo** (navegación real
> con navegador) + auditoría del código fuente.
> Cubierto: Home, Mapa/Búsqueda, Ranking, Premium, Chat IA.
> Pendiente: flujos autenticados (login → publicar → reservar → pagar → calificar),
> que requieren iniciar sesión —acción que el asistente no puede realizar por sí
> mismo (crear cuentas / introducir contraseñas está fuera de su alcance).

## 1. Veredicto general

App **bien construida y madura**: arquitectura BFF + microservicios, seguridad
seria (RLS, rate-limiting, escape de XSS, anti-manipulación de montos), UI muy
cuidada. La navegación pública funciona y se ve excelente. Se detectaron **dos
fallas reales** (una de UX, corregida; una de configuración en producción).

## 2. Resultado del recorrido en vivo

| Sección | Estado | Notas |
|---|---|---|
| Home (`/`) | ✅ | Renderiza perfecta, responsive, stats reales (22 plazas/15 comunas/4.3★), 0 errores de consola. |
| Mapa (`/mapa`) | ✅ | Búsqueda geográfica `GET /api/mapas/search` → **200**. Mapa, radar, filtros y selector de vehículo OK. |
| Ranking (`/ranking`) | ✅ | Detecta región (RM), stats 17/17/4.4, filtros y TOP-3 con podio OK. |
| Premium (`/premium`) | ⚠️→✅ | **FOUC** corregido (ver 3.2). Tras hidratar, todas las secciones (planes, calculadora, niveles, comparativa, FAQ) se ven perfectas. |
| Chat IA (Dareko) | ❌ | La UI funciona, pero la **IA falla en producción** (ver 3.1). |

## 3. Hallazgos

### 3.1 ❌ CRÍTICO — El chat de IA falla en producción (config)
Enviar cualquier mensaje al asistente "Dareko" devuelve siempre:
*"Ocurrió un error. Por favor intenta de nuevo…"* (probado 2 veces, persistente).
- El `POST /api/support/chat` responde **200** pero con el cuerpo del *catch*
  del servidor → la llamada a Anthropic está **fallando**.
- No es un 401 (la ruta tiene un caso aparte para eso), así que **no** es "falta
  la API key" de forma directa. Causas probables: `ANTHROPIC_API_KEY` inválida o
  sin crédito en Vercel, **o** el model id `claude-haiku-4-5` no resuelve (→404).
- **Muy probablemente afecta también** al *Resumen IA de reseñas*
  (`/api/resenas/resumen`), que usa el mismo cliente y modelo.
- **Acción (ops, no código):** revisar en Vercel → Settings → Environment Variables
  la `ANTHROPIC_API_KEY`, y los **runtime logs** (buscar `[support/chat]`) para ver
  el error exacto. Si el log dice *model not found*, fijar el id a
  `claude-haiku-4-5` válido o a la versión datada.
- *Mitigación positiva:* el front degrada con elegancia (no crashea, muestra un
  mensaje y el correo de soporte).

### 3.2 ✅ CORREGIDO — FOUC (flash sin estilos) en `/premium`
Al cargar, la página de planes se mostraba **sin estilos durante 1–2 s** (texto
plano, sin tarjetas) antes de hidratar. Causa: era la **única** página que ponía
sus estilos en `<style jsx global>` (styled-jsx), que se **inyecta en el cliente
tras hidratar**; el resto de páginas usa `<style jsx>` *scoped* y no sufre el
problema.
- **Fix:** se extrajo el CSS a `apps/web/app/premium/premium.css` y se importa
  (`import './premium.css'`). El CSS importado se aplica **desde el primer paint**,
  eliminando el parpadeo. Cambio semánticamente equivalente (mismos selectores).
- ⚠️ *Requiere desplegar para confirmar en producción* (no fue posible verificar
  el build de Turbopack localmente sin credenciales).

### 3.3 ✅ CORREGIDO — `<Toaster>` duplicado
`premium/page.js` y `auth/page.js` montaban un `<Toaster>` propio además del
global de `layout.js` → cada notificación se renderizaba **dos veces**. Eliminados
los locales.

### 3.4 Observación de UX — Prompt PWA intrusivo
El banner "Instala Parkings Together" (abajo-izquierda) aparece en **todas** las
páginas y **tapa contenido** (p. ej. la tarjeta #1 del podio en `/ranking`).
Sugerencia: mostrarlo una sola vez / recordar el descarte / no solaparlo con
contenido clave.

### 3.5 Observaciones positivas (sin acción)
- Chat: `dangerouslySetInnerHTML` con **escape de HTML previo** → sin XSS.
- Pagos idempotentes con verificación de propiedad y monto.
- Reseñas/resumen degradan a 200 para no romper la ficha.

## 4. Reglas de negocio (extraídas del código)

| Área | Regla |
|---|---|
| Registro | Contraseña 8+ con may/min/número/símbolo. Roles `cliente`/`arrendador`. Rate-limit 10/IP/hora. Crea perfil (trigger) y primer vehículo si hay patente. |
| Estacionamientos | Solo `arrendador` publica. Lectura pública. `occupied` 0..`total` (CHECK). Borrado lógico si hay reservas activas. Búsqueda PostGIS. |
| Reservas | Instantánea vs profesional (ventana, capacidad por solapamiento, pendiente→confirmada→completada/cancelada). Saga + compensación. Bloqueo de plaza 5 min. |
| Calificación | Solo reservas completadas (1–5); recalcula el rating del estacionamiento. |
| Pagos | Proveedores mock/efectivo/webpay. Solo el conductor paga su reserva; el monto debe coincidir; idempotente; tope 10M CLP. **Simulado** (Webpay para producción). |
| Premium | Planes free/pro/premium, mensual/anual. El conductor siempre reserva gratis. |
| Chat IA | Rate-limit 20/min/IP, anti prompt-injection, escalación a humano, Claude Haiku, 600 chars, últimos 10 mensajes. |

## 5. Estado y próximos pasos

- ✅ QA interactivo de la superficie pública + auditoría de código.
- ✅ Corregidos: FOUC de Premium y Toaster duplicado (PR de QA).
- 🔴 **Pendiente urgente (ops):** arreglar la IA en producción (env/model en Vercel).
- ⏳ **Flujos autenticados** (publicar/reservar/pagar/calificar): requieren una
  sesión iniciada. El asistente no puede crear cuentas ni introducir contraseñas;
  hacen falta o bien que el equipo recorra esos flujos, o una sesión de prueba ya
  iniciada en el navegador.
- ⏳ Innovación: integración real de **Webpay (Transbank)** — la base (Strategy en
  `payments.js` + `/api/pagos`) ya está lista; falta SDK + credenciales.
