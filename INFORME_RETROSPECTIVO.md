# Informe Retrospectivo — Parkings Together
**Asignatura:** Desarrollo Fullstack III  
**Equipo:** Parkings Together  
**Fecha:** Julio 2026  
**Extensión:** ~7 páginas (sin diagramas ni anexos)

---

## Introducción

Parkings Together es un marketplace P2P de estacionamientos que conecta conductores con arrendadores en Chile. Este documento es una retrospectiva del desarrollo semestral, orientada a reflexionar sobre las decisiones técnicas tomadas, los problemas encontrados y las oportunidades de mejora identificadas. No describe el sistema como un manual, sino como el balance honesto de un equipo que construyó algo real y aprendió en el proceso.

---

## Diagrama de Arquitectura General

```
                        ┌──────────────────────┐
                        │      Navegador        │
                        │  (React / Next.js)    │
                        └──────────┬───────────┘
                                   │ HTTPS
                                   ▼
              ┌────────────────────────────────────────┐
              │         apps/web  (Vercel)             │
              │                                        │
              │  ┌─────────────┐   ┌────────────────┐ │
              │  │  App Router │   │   BFF /api/*   │ │
              │  │  (páginas   │◄──│  signup        │ │
              │  │   React)    │   │  mapas/search  │ │
              │  └─────────────┘   │  reservas/mgmt │ │
              │                    │  favoritos     │ │
              │   @parkings/       │  premium       │ │
              │   supabase-db ─────┤  pagos/webpay  │ │
              │   (Singleton)      └───────┬────────┘ │
              └──────────────────────────┬─┘──────────┘
                         ┌──────────────┘
                         │ (opcional vía env vars)
           ┌─────────────┼──────────────────┐
           ▼             ▼                  ▼
  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
  │  apps/auth   │ │ apps/ms-     │ │ apps/ms-     │
  │  puerto 3001 │ │ mapas        │ │ reservas     │
  │  (Render)    │ │ puerto 3002  │ │ puerto 3003  │
  │              │ │ (Render)     │ │ (Render)     │
  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
         │                │                │
         └────────────────┼────────────────┘
                          ▼
          ┌───────────────────────────────┐
          │   Supabase (PostgreSQL 17)    │
          │  Auth · RLS · PostGIS ·       │
          │  Realtime · Storage           │
          └───────────────────────────────┘
```

> El BFF en `apps/web` accede directamente a Supabase en producción. Los microservicios (`auth`, `ms-mapas`, `ms-reservas`) son activados mediante variables de entorno y operan como capa adicional en entornos especializados o desarrollo local.

---

## 1. Arquitectura

### Decisión tomada

Se adoptó una **arquitectura de microservicios organizada como monorepo con Turborepo**. El sistema está compuesto por cuatro aplicaciones independientes: un frontend con BFF (`apps/web`), y tres microservicios REST versionados (`apps/auth` en puerto 3001, `apps/ms-mapas` en 3002, `apps/ms-reservas` en 3003). Cada servicio tiene su propio ciclo de vida, dependencias y despliegue. Un paquete compartido (`packages/supabase-db`) implementa el patrón **Singleton** para el cliente de base de datos.

La arquitectura central es el **BFF (Backend for Frontend)**: el frontend no llama a los microservicios directamente, sino a rutas de mismo origen (`/api/*`) dentro de `apps/web`, que a su vez orquestan la lógica y acceden a Supabase de manera segura desde el servidor. Esto evita exponer la `SUPABASE_SERVICE_ROLE_KEY` al navegador y elimina los problemas de CORS.

### Ventajas

- **Separación de responsabilidades clara**: cada microservicio es independiente y desplegable en Render sin afectar al frontend.
- **Escalabilidad horizontal**: si `ms-reservas` requiere más instancias por carga, se escala sin tocar el resto.
- **Seguridad por diseño**: el BFF actúa como capa de intermediación. Las claves de servicio nunca llegan al cliente.
- **Monorepo coherente**: Turborepo permite compartir tipos y clientes entre servicios, evitando duplicación.

### Desventajas

- **Complejidad operacional**: gestionar tres microservicios en Render más el BFF en Vercel requiere configurar cuatro entornos de variables de entorno distintos.
- **Doble vía implícita**: en producción, el BFF accede directamente a Supabase (la ruta más corta), mientras que los microservicios quedan como "capa adicional opcional" activada por variables de entorno. Esto es funcional pero dificulta razonar sobre cuál es el flujo real en producción.

### Problemas encontrados

El problema más crítico de arquitectura fue que los microservicios en Vercel referenciaban `localhost:3002` en lugar de sus URLs de Render, causando que los estacionamientos no se mostraran en producción. El diagnóstico y la solución están documentados en `docs/FIX_001_estacionamientos_vercel.md`. La resolución fue consolidar la lógica en el BFF y configurar las URLs de microservicios como variables de entorno opcionales, sólo activadas en desarrollo o en despliegues especializados.

### Oportunidades de mejora

- Agregar un API Gateway (ej. Nginx o Kong) para centralizar autenticación y rate limiting.
- Implementar `docker-compose.yml` para levantar todos los servicios localmente con un solo comando.
- Añadir health checks y circuit breakers entre el BFF y los microservicios.

---

## 2. Componentes

### Decisión tomada

El frontend está construido con **Next.js 14 (App Router)** usando React Server Components donde es posible y Client Components para la interactividad. Los componentes de UI viven en `apps/web/src/components/` y las páginas en `apps/web/app/`. Se eligió `styled-jsx` para el CSS (colocado junto al JSX de cada componente) para maximizar la legibilidad académica.

Los componentes más significativos son:
- **`Map.js`** — mapa interactivo con Leaflet, clustering de marcadores y heatmap en tiempo real.
- **`ConductorDashboard.js`** — panel completo de reservas con estados, QR y calificaciones.
- **`SupportChat.js`** — chat con IA (Claude Haiku) con detección de prompt injection.
- **`ParkingSelector.js`** — selector de plaza con lock temporal (5 min) anti doble-reserva.

### Ventajas

- **Componentes de responsabilidad única**: cada componente hace una sola cosa bien. `ReviewModal.js` solo gestiona reseñas; `QRCode.js` solo genera el código QR.
- **Hooks personalizados**: `useGeolocation.js` y `useMapRadar.js` encapsulan la lógica de geolocalización y actualización en tiempo real, reutilizable desde cualquier página.
- **PWA**: la app es instalable como aplicación móvil (`manifest.js`, `PWAInstallPrompt.js`), lo que mejora la experiencia en dispositivos.

### Desventajas

- **styled-jsx no es el estándar industrial**: dificulta la reutilización de estilos entre componentes y no tiene soporte nativo de dark mode. En un proyecto de producción a escala, CSS Modules o Tailwind serían más adecuados.
- **Ausencia de Storybook**: no existe documentación visual de componentes aislados, lo que complica el onboarding de nuevos desarrolladores.

### Problemas encontrados

El componente `Map.js` (que usa Leaflet) no funciona en SSR porque Leaflet requiere `window`. Se resolvió con `dynamic(() => import('./Map'), { ssr: false })`, patrón que luego se replicó para el Swagger UI en la ruta `/api-docs`. La lección: cualquier librería que acceda a APIs del navegador requiere carga dinámica en Next.js.

### Oportunidades de mejora

- Migrar los estilos a CSS Modules para mejor rendimiento y soporte de temas.
- Agregar Storybook para documentar y probar componentes en aislamiento.
- Implementar React Query o SWR para cachear y sincronizar el estado del servidor.

---

## 3. Patrones de Diseño y Arquitectónicos

### Decisiones tomadas

Se implementaron 9 patrones, documentados en `docs/PATRONES_DISEÑO.md` con código fuente real y justificación de cada elección:

| Patrón | Dónde | Por qué |
|---|---|---|
| **BFF** | `apps/web/app/api/*` | Eliminar CORS y proteger credenciales |
| **Repository** | `apps/ms-*/src/repositories/` | Aislar acceso a datos del dominio |
| **Service Layer** | `apps/ms-*/src/services/` | Separar lógica de negocio del transporte HTTP |
| **Saga + CQRS** | `ms-reservas/.../reserva.service.js` | Atomicidad en reservas concurrentes con rollback |
| **Strategy** | `apps/web/src/lib/payments.js` | Intercambiar proveedor de pago sin cambiar la ruta |
| **Observer** | `Navbar.js` con Supabase Realtime | Actualización en tiempo real de ocupación |
| **Singleton** | `packages/supabase-db/index.js` | Un solo cliente Supabase por proceso |
| **Facade** | `apps/web/src/lib/api.js` | API unificada con timeout y retry para el frontend |
| **MVC** | Cada microservicio | Separación clásica Controller → Service → Repository |

### Ventajas

El patrón **Saga** fue el más valioso en producción. La función `processSaga()` en `ms-reservas` garantiza que si el incremento de ocupación falla después de crear la reserva, la reserva se borra (compensación), evitando inconsistencias en la base de datos bajo concurrencia. Sin este patrón, dos conductores podrían reservar la misma plaza simultáneamente.

El patrón **Strategy** en pagos permitió iterar rápido: primero se implementó `chargeMock`, luego `chargeEfectivo`, y la integración real de Webpay queda preparada sin tocar la ruta `/api/pagos`.

El siguiente fragmento resume cómo el Saga garantiza la consistencia: si el paso 3 falla, la reserva creada en el paso 2 se elimina antes de propagar el error:

```js
// apps/ms-reservas/app/api/v1/reserve/services/reserva.service.js
async processSaga(payload) {
  // 1. Verificación de disponibilidad (CQRS — solo lectura)
  const parking = await ReserveRepository.getParkingAvailability(parking_id);
  if (parking.occupied_spots >= parking.total_spots)
    throw new Error('El estacionamiento ya está lleno.');

  // 2. Crear la reserva
  const reserva = await ReserveRepository.createReserve({ ...reservaData });

  // 3. Incrementar ocupación — si falla, compensar
  try {
    await ReserveRepository.updateParkingOccupancy(parking_id, parking.occupied_spots + 1);
  } catch {
    await ReserveRepository.deleteReserve(reserva.id); // rollback
    throw new Error('Saga Compensada.');
  }
  return reserva;
}
```

### Desventajas

- El **CQRS** implementado es "CQRS simple": no hay bus de comandos real ni proyecciones separadas. Es una separación de lectura/escritura en el mismo servicio, lo que limita su escalabilidad a largo plazo.
- El patrón **Observer** con Supabase Realtime depende de que la tabla `estacionamientos` esté publicada en tiempo real. Si Supabase desactiva esa tabla por inactividad, el mapa deja de actualizarse sin error visible.

### Problemas encontrados

La primera versión del patrón BFF no inyectaba el JWT del usuario correctamente en las políticas RLS. Las queries devolvían datos vacíos porque `auth.uid()` evaluaba como `null`. La solución fue `getSupabaseWithToken(accessToken)`, que crea un cliente Supabase efímero con el token en el header `Authorization`, permitiendo a Postgres identificar al usuario.

### Oportunidades de mejora

- Implementar un bus de comandos real (ej. con BullMQ o Supabase Edge Functions) para el patrón CQRS.
- Agregar el patrón **Circuit Breaker** en el Facade (`api.js`) para abrir automáticamente cuando el BFF falla repetidamente.

---

## 4. Estrategia de Branching

### Decisión tomada

Se adoptó el modelo **Feature Branch Workflow** con `master` como rama de producción protegida. Cada funcionalidad se desarrolla en una rama con prefijo semántico (`feat/`, `fix/`, `docs/`, `refactor/`, `claude/`) y se integra mediante **Pull Request con revisión obligatoria**. Los mensajes de commit siguen el estándar **Conventional Commits**, documentado en `docs/ESTRATEGIA_BRANCHING.md`.

Ejemplos reales del historial del repositorio:
```
feat(api-docs): Swagger UI interactivo en /api-docs
fix(signup): detectar variables de entorno faltantes al inicio del módulo
docs(openapi): completar spec con todos los endpoints BFF
chore(deps): actualizar package-lock.json con swagger-ui-react
```

### Ventajas

- **Trazabilidad total**: cada cambio tiene un commit con tipo, alcance y descripción. En el historial de 164+ commits es posible filtrar solo los `fix:` o solo los `docs:` en segundos.
- **Master siempre desplegable**: ningún código experimental llega a `master` sin revisión. Vercel despliega automáticamente desde `master` solo cuando el Quality Gate de GitHub Actions pasa.
- **Conventional Commits habilita CHANGELOG automático**: herramientas como `conventional-changelog` pueden generar notas de versión directamente del historial.

### Desventajas

- En un equipo pequeño (2-3 personas), el overhead de crear PR para cada cambio pequeño puede ralentizar el ritmo. Varios commits fueron de documentación que podría haberse agrupado.
- No se usan **tags de versión** (`v1.0`, `v1.1`). Sin tags, es difícil regresar a un punto de estabilidad conocido.

### Problemas encontrados

En dos ocasiones se pusieron cambios directamente a `master` durante una urgencia de entrega, saltando el proceso de PR. Esto generó conflictos cuando ramas que se habían bifurcado antes de ese commit intentaron hacer merge. La lección: incluso en urgencias, el costo de resolver conflictos supera el tiempo de abrir el PR.

### Oportunidades de mejora

- Agregar protección de rama en GitHub para impedir `git push` directo a `master`.
- Implementar `commitlint` como hook pre-commit para validar automáticamente el formato de Conventional Commits.
- Usar tags semánticos (`v1.0.0`, `v1.1.0`) en cada entrega para facilitar rollbacks.

---

## 5. Integración con Base de Datos

### Decisión tomada

Se eligió **Supabase** (PostgreSQL 17 + PostGIS) como capa de datos. La integración usa directamente `supabase-js` v2 sin ORM adicional. El control de acceso se delega completamente a **Row Level Security (RLS)** de PostgreSQL, que evalúa `auth.uid()` contra el JWT del usuario en cada query. Las operaciones críticas usan **RPCs PL/pgSQL con SECURITY DEFINER** para ejecutar lógica con privilegios controlados sin exponer credenciales al cliente.

El esquema está versionado con 13 migraciones SQL numeradas (`001_create_perfiles_and_storage.sql` → `013_obtener_resenas.sql`).

### Ventajas

- **RLS como contrato de seguridad**: un conductor nunca puede leer las reservas de otro usuario porque la política de Postgres lo impide en la base de datos, no solo en el código. Aunque el código tenga un bug, la BD no entrega datos ajenos.
- **RPCs atómicas**: `reservar_estacionamiento()` usa `SELECT ... FOR UPDATE` para serializar reservas concurrentes, evitando el problema de la doble-reserva a nivel de BD.
- **PostGIS para búsqueda geoespacial**: la función `buscar_estacionamientos_radio()` usa `ST_DWithin` para filtrar estacionamientos por radio en kilómetros con índices GIST, lo que escala a millones de registros.
- **Realtime integrado**: `supabase.channel().on('postgres_changes')` entrega actualizaciones de ocupación al mapa sin polling, usando WebSockets nativos de Supabase.

### Desventajas

- **Sin herramienta formal de migración**: las migraciones son SQL planos aplicados manualmente con `APLICAR_TODO.sql`. No hay CLI que garantice que la BD de desarrollo está en el mismo estado que producción.
- **Sin rollback de migraciones**: cada migración es unidireccional. Si se necesita revertir un cambio de esquema, hay que escribir el SQL de reversión manualmente.
- **Acoplamiento al cliente de Supabase**: `supabase-js` no es un ORM agnóstico; cambiar de proveedor de BD requeriría reescribir toda la capa de acceso a datos.

### Problemas encontrados

La RPC `obtener_resenas` fallaba en producción porque la función no existía en la BD antes de la migración `013`. El endpoint de reseñas devolvía error 500, lo que rompía la carga de la ficha del estacionamiento. La solución fue envolver la llamada en `try/catch` y degradar a "sin reseñas" con status 200, manteniendo la ficha funcional aunque faltara el resumen de reseñas. La lección: los endpoints de datos complementarios nunca deben bloquear la carga del recurso principal.

### Oportunidades de mejora

- Adoptar **Supabase CLI** (`supabase db push`) para gestionar migraciones de forma reproducible.
- Agregar migraciones de rollback (`down.sql`) para cada migración.
- Implementar un ambiente de staging en Supabase con datos sintéticos para testear migraciones antes de producción.

---

## 6. Pruebas Unitarias

### Decisión tomada

Se implementaron **167 tests** distribuidos en 12 suites, cubriendo las cuatro aplicaciones del monorepo:

| Suite | Tests | Qué valida |
|---|---|---|
| `pricing.test.js` | 24 | Cálculo de tarifas hora/minuto/día (funciones puras) |
| `payments.test.js` | 30 | Tres estrategias de pago, IDs únicos, proveedores válidos |
| `planes.test.js` | 29 | Catálogo de planes, gamificación, badges, funciones de precio |
| `api.extended.test.js` | 47 | Todos los métodos del Facade (mapas, reservas, favoritos, premium) |
| `geocoding.test.js` | 8 | Detección de las 16 regiones de Chile por coordenadas |
| `api.timeout.test.js` | 2 | Timeout con AbortController y fallback |
| `rateLimit.test.js` | 5 | Rate limiting por IP con ventana deslizante |
| `reserveService.test.js` | 7 | Saga: cupo lleno, rollback compensatorio, happy path, checkAvailability |
| `authService.test.js` | 7 | Login con metadata de usuario, fallbacks de nombre, registro con rol |
| `authController.test.js` | 9 | Validación de campos obligatorios, status 401/400/201 |
| `mapService.test.js` | 8 | Normalización de coords, precio base, defaults de negocio |
| `mapController.test.js` | 12 | Validación de todos los métodos HTTP del controlador |
| `api.test.js` (node:test) | 6 | Contratos HTTP del BFF vía mocks de fetch |

**Cobertura final:**

| Métrica | Antes (ET3) | Después (ET final) |
|---|---|---|
| Sentencias | 71% | **90.6%** |
| Ramas | 69% | **82.4%** |
| **Funciones** | **38%** | **86%** |
| Líneas | 71% | **90.7%** |

### Ventajas

- **Tests de funciones puras primero**: `pricing.js`, `payments.js` y `planes.js` son 100% testeables en aislamiento porque no tienen efectos secundarios. Son los tests más rápidos y confiables del proyecto.
- **Mocks de fetch para el BFF**: los tests del Facade (`api.extended.test.js`) no requieren un servidor real. Mockear `global.fetch` y `supabase.auth.getSession` permite probar todos los métodos en milisegundos.
- **CI automático**: GitHub Actions ejecuta todos los tests en cada PR. Un PR que rompe un test no puede mergearse a `master`.

### Desventajas

- **Cobertura de `supabase-db/index.js` es 0% en funciones**: el Singleton y `getSupabaseWithToken` no se testean porque requieren una instancia real de Supabase. Mockearlos cambiaría lo que se está probando.
- **Sin tests de integración ni E2E**: no hay pruebas que verifiquen que el sistema completo funciona de extremo a extremo (navegador → BFF → Supabase). Un bug en la configuración de RLS no sería detectado por los tests unitarios.
- **Cobertura de los route handlers es 0%**: los 11 archivos `route.js` del BFF no tienen tests. Probarlos requeriría levantar el servidor de Next.js o usar herramientas como `msw` (Mock Service Worker).

### Problemas encontrados

La suite `geocoding.test.js` usa `describe` de Jest pero fue incluida en el script `test` que usa `node --test`. El runner de Node.js no reconoce `describe`, por lo que fallaba con `ReferenceError: describe is not defined`. La solución fue ejecutar esa suite solo con `jest` (`npm run test:unit`) y excluir `api.test.js` del runner de Jest (que usa `import` de ES modules incompatible con la configuración de Babel). La coexistencia de dos runners distintos en el mismo proyecto es deuda técnica.

### Oportunidades de mejora

- Agregar tests de integración con **Playwright** para los flujos críticos: registro → login → reserva → pago → calificación.
- Migrar `api.test.js` a Jest para unificar los runners.
- Alcanzar 60%+ de cobertura en los route handlers usando **Supertest** con un servidor de Next.js en modo test.

---

## Conclusión

Parkings Together es un sistema funcional con arquitectura de microservicios real, patrones de diseño implementados y verificables, y una base de datos robusta con seguridad a nivel de BD. Las principales deudas técnicas identificadas son la ausencia de tests de integración/E2E y la falta de una herramienta formal de migración de base de datos.

El aprendizaje más importante del semestre fue que las decisiones de arquitectura tienen consecuencias concretas en producción: el bug del localhost en Vercel nos enseñó que una decisión de configuración puede tumbar una funcionalidad entera, y que la solución correcta (BFF de mismo origen) es más simple y robusta que la arquitectura inicial (microservicios con URLs variables). La segunda lección fue sobre la seguridad por diseño: las políticas RLS de Postgres protegen los datos incluso cuando el código tiene bugs, porque el contrato de seguridad vive en la capa que no se puede bypasear.

---

*Parkings Together — Desarrollo Fullstack III · Julio 2026*
