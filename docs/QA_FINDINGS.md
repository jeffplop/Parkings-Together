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
| Chat IA (Dareko) | 🗑️ | **Eliminado del proyecto** (ver nota en 3.1). Ya no existe el widget ni la ruta. |
| Login + Dashboard (arrendador) | ✅ | Sesión OK; panel con stats, publicar, reservas y "mis estacionamientos". |
| Publicar estacionamiento | ✅ | Flujo completo: geocoding → datos → `POST /api/mapas/search` **201**; aparece "DISPONIBLE · 0/5 · $1500/hr". |

## 3. Hallazgos

### 3.1 ❌ CRÍTICO — El chat de IA falla en producción (config)

> ✅ **RESUELTO / OBSOLETO (actualización posterior).** El **chat de soporte con IA
> ("Dareko") fue eliminado por completo** del proyecto (componente `SupportChat.js`
> y ruta `POST /api/support/chat`), así que este hallazgo ya no aplica. Además, las
> funciones de IA que se conservan —*Resumen de reseñas* y *Sugeridor de precios*—
> **migraron de Anthropic a Google Gemini**: usan `GEMINI_API_KEY` (opcional; sin
> ella degradan con elegancia, no rompen la app). Ya **no** se necesita
> `ANTHROPIC_API_KEY`. Todo lo que sigue en 3.1 queda como registro histórico.

Enviar cualquier mensaje al asistente "Dareko" devuelve siempre:
*"Ocurrió un error. Por favor intenta de nuevo…"* (probado 2 veces, persistente).
- **Causa raíz CONFIRMADA** (runtime logs de Vercel, prod): el error es
  `[support/chat] Error: Could not resolve authentication method. Expected either
  apiKey or authToken to be set.` → **la `ANTHROPIC_API_KEY` no está configurada en
  el entorno de producción**. El SDK lanza ese error genérico (sin `.status`), por
  eso cae en el *catch* general (responde 200 con el mensaje de error) y no en la
  rama 401.
- **Afecta también** al *Resumen IA de reseñas* (`/api/resenas/resumen`), que usa
  el mismo cliente; ahí degrada en silencio (no muestra la tarjeta de resumen).
- **Actualización (2º deploy):** se configuró `ANTHROPIC_API_KEY` **pero con una
  key de Gemini** → el log pasó a `[support/chat] Error: 401` (Anthropic rechaza la
  credencial). **Una key de Gemini NO sirve:** el código usa `@anthropic-ai/sdk`
  (Claude), que solo acepta una key de **Anthropic**.
- **Fix:** poner una `ANTHROPIC_API_KEY` **real de Anthropic** (console.anthropic.com)
  en Vercel (Production) y redeploy. *(Alternativa: reescribir el código para usar la
  API de Gemini —otro SDK y formato— si se prefiere ese proveedor.)*
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

### 3.4 ✅ CORREGIDO — Excepción de Realtime en el Navbar
En consola, al navegar logueado, se repetía:
`Error: cannot add postgres_changes callbacks for realtime:navbar-reservas after
subscribe().` Causa: el `useEffect` (deps `[user]`) crea el canal de Supabase
Realtime dentro de un `.then()` **async**; cuando el efecto se re-ejecuta (el auth
listener cambia `user`), el cleanup corre con `channel` aún `undefined`, no elimina
el canal, y el siguiente `supabase.channel('navbar-reservas').on(...)` se ejecuta
sobre un canal **ya suscrito** → excepción.
- **Fix:** guard `cancelled` en el efecto (no crear el canal si el efecto ya se
  limpió). `apps/web/src/components/Navbar.js`. *(Requiere deploy para confirmar.)*

### 3.5 Observación de UX — Prompt PWA intrusivo
El banner "Instala Parkings Together" (abajo-izquierda) aparece en **todas** las
páginas y **tapa contenido** (p. ej. la tarjeta #1 del podio en `/ranking`).
Sugerencia: mostrarlo una sola vez / recordar el descarte / no solaparlo con
contenido clave.

### 3.6 Observaciones positivas (sin acción)
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
| ~~Chat IA~~ | 🗑️ Eliminado del proyecto. Las funciones de IA que quedan (resumen de reseñas, sugeridor de precios) usan **Gemini**. |

## 5. Estado y próximos pasos

- ✅ QA interactivo de la superficie pública + auditoría de código.
- ✅ Corregidos: FOUC de Premium y Toaster duplicado (PR de QA).
- ✅ **Chat IA eliminado** del proyecto; el hallazgo 3.1 (ANTHROPIC_API_KEY) queda obsoleto.
- ✅ **Mapa:** corregido el "API KEY REQUIRED" migrando de CARTO a Esri Dark Gray (sin key).
- ✅ **Geolocalización:** corregido el 403 de `ip-api.com` (solo HTTP) usando geojs/ipwho.is.
- ⏳ **Flujos autenticados** (publicar/reservar/pagar/calificar): requieren una
  sesión iniciada. El asistente no puede crear cuentas ni introducir contraseñas;
  hacen falta o bien que el equipo recorra esos flujos, o una sesión de prueba ya
  iniciada en el navegador.
- ✅ Migración de IA a **Gemini** hecha en código (resumen de reseñas + sugeridor de
  precios; el chat se eliminó). Usa `GEMINI_API_KEY` (o `GOOGLE_API_KEY`); opcional.
- ⏳ Innovación: integración real de **Webpay (Transbank)** — la base (Strategy en
  `payments.js` + `/api/pagos`) ya está lista; falta SDK + credenciales.

## 6. Flujo autenticado completo (sesión arrendador) — verificado en vivo

Recorrido end-to-end con sesión real iniciada por el usuario:

| Paso | Resultado |
|---|---|
| Login + Dashboard | ✅ |
| **Publicar estacionamiento** | ✅ `POST /api/mapas/search` **201** (aparece DISPONIBLE 0/5 $1500/hr) |
| Buscar plaza / mapa | ✅ "23 estacionamientos" (incluye la creada); búsqueda PostGIS OK |
| Ficha de estacionamiento | ✅ (la propia muestra "Tu publicación" + Gestión, sin botón reservar) |
| **Reservar** (otra plaza) | ✅ selector visual de plazas → duración → `POST /api/reservas/reserve` **201** |
| **Pagar** (Webpay simulado) | ✅ `POST /api/pagos` **201** |

### Hallazgos del flujo
- 🟡 **Inestabilidad transitoria durante el redeploy:** varias lecturas devolvieron
  **503** (ranking vacío, "estacionamiento no encontrado"), pero las funciones
  logueaban 200 → era la **ventana de despliegue** de Vercel. Al recargar, todo OK.
  *Recomendación: avisar/bloquear acciones durante deploys, o reintentar en cliente.*
- 🟡 **Datos: `comuna` mal poblada** — al publicar "Av. Providencia 1234", la comuna
  quedó como **"1234"** (el geocoder usó el número de calle). Debería extraer la
  comuna real.
- 🟡 **Datos: rating por defecto inflado** — un estacionamiento recién creado (0
  reservas) devuelve `rating: 4.5, reviews_count: 10` en la API de lista (se ve en
  tarjetas/mapa), mientras la **ficha** muestra correctamente 0 reseñas / sin
  calificación. El `rating`/`reviews_count` almacenado no refleja la realidad →
  conviene que las nuevas plazas partan en 0 y el rating se calcule de reseñas reales.
