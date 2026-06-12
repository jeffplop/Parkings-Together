# Documentación Técnica — Parkings Together

> **Versión:** 1.0  
> **Fecha:** 2026-06-04  
> **Proyecto Supabase:** `obthriistwvcutjfrksh` (us-east-2)  
> **Producción:** https://parkings-web.vercel.app

---

## Tabla de Contenidos

1. [Visión General de la Plataforma](#1-visión-general-de-la-plataforma)
2. [Stack Tecnológico](#2-stack-tecnológico)
3. [Estructura del Monorepo](#3-estructura-del-monorepo)
4. [Arquitectura de Autenticación](#4-arquitectura-de-autenticación)
5. [Esquema de Base de Datos](#5-esquema-de-base-de-datos)
6. [Políticas RLS (Row-Level Security)](#6-políticas-rls-row-level-security)
7. [Búsqueda Espacial con PostGIS](#7-búsqueda-espacial-con-postgis)
8. [Rutas API (Patrón BFF)](#8-rutas-api-patrón-bff)
9. [Abstracción de Pagos](#9-abstracción-de-pagos)
10. [Lógica de Precios](#10-lógica-de-precios)
11. [Mapa Interactivo](#11-mapa-interactivo)
12. [Dashboard del Arrendador](#12-dashboard-del-arrendador)
13. [Componentes Reutilizables](#13-componentes-reutilizables)
14. [SEO y Estándares Web](#14-seo-y-estándares-web)
15. [Suite de Tests](#15-suite-de-tests)
16. [Variables de Entorno](#16-variables-de-entorno)
17. [Despliegue en Vercel](#17-despliegue-en-vercel)
18. [Rendimiento y Optimizaciones de Base de Datos](#18-rendimiento-y-optimizaciones-de-base-de-datos)
19. [Seguridad — Incidentes y Acciones Requeridas](#19-seguridad--incidentes-y-acciones-requeridas)

---

## 1. Visión General de la Plataforma

**Parkings Together** es un marketplace de estacionamientos en Chile que conecta:

- **Conductores** que necesitan un lugar donde estacionar.
- **Arrendadores** (propietarios o administradores) que tienen spots disponibles.

La plataforma permite buscar estacionamientos en un mapa interactivo con filtros geoespaciales, reservar con selección de vehículo, pagar mediante múltiples métodos (Webpay, efectivo, mock), y gestionar el inventario de spots desde un panel de control dedicado.

---

## 2. Stack Tecnológico

| Capa | Tecnología | Versión / Notas |
|------|-----------|-----------------|
| Framework frontend | Next.js App Router | 14.x |
| Monorepo tooling | Turborepo | — |
| Base de datos | PostgreSQL 17 (Supabase) | — |
| Extensión geoespacial | PostGIS | ST_DWithin / geometry |
| Autenticación | Supabase Auth | email/password |
| Cliente Supabase | `@supabase/supabase-js` | — |
| Mapas | Leaflet + leaflet.markercluster + leaflet.heat | carga dinámica, `ssr: false` |
| Validación de formularios | React Hook Form + Zod | — |
| Notificaciones | react-hot-toast | — |
| Pagos | Mock / Efectivo / Transbank Webpay Plus | `@transbank/sdk` opcional |
| Testing | Jest 30 + babel-jest | ESM→CJS transform |
| Despliegue | Vercel | Turbo build |

---

## 3. Estructura del Monorepo

```
Parkings-Together/
├── apps/
│   ├── web/                        # Next.js 14 frontend + API routes (port 3000)
│   │   ├── app/                    # App Router — páginas y rutas API
│   │   │   ├── page.js             # Landing page (CSR)
│   │   │   ├── layout.js           # Root layout: SEO metadata + PWA viewport
│   │   │   ├── loading.js          # UI de carga global
│   │   │   ├── not-found.js        # Página 404 personalizada
│   │   │   ├── robots.js           # Generación de /robots.txt
│   │   │   ├── sitemap.js          # Generación de /sitemap.xml
│   │   │   ├── manifest.js         # /manifest.webmanifest (PWA)
│   │   │   ├── auth/page.js        # Login + registro (Zod + react-hook-form)
│   │   │   ├── dashboard/page.js   # Panel de control del arrendador
│   │   │   ├── mapa/page.js        # Mapa interactivo (Leaflet + clustering + heatmap)
│   │   │   ├── profile/page.js     # Perfil, vehículos, favoritos, reseñas
│   │   │   └── api/
│   │   │       ├── auth/signup/route.js
│   │   │       ├── mapas/search/route.js
│   │   │       ├── reservas/reserve/route.js
│   │   │       ├── reservas/[id]/complete/route.js
│   │   │       └── pagos/route.js
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── Navbar.js           # Barra de navegación global
│   │   │   │   ├── ParkingSelector.js  # Modal de flujo de reserva
│   │   │   │   ├── MiniMap.js          # Mapa de selección de ubicación
│   │   │   │   └── ReviewModal.js      # Formulario de reseña/rating
│   │   │   └── lib/
│   │   │       ├── pricing.js          # calcTotal / calcBreakdown
│   │   │       ├── payments.js         # Abstracción de proveedores de pago
│   │   │       └── comunas-chile.js    # Catálogo de regiones y comunas de Chile
│   │   └── tests/
│   │       ├── pricing.test.js
│   │       ├── payments.test.js
│   │       ├── geocoding.test.js
│   │       └── api.test.js
│   └── ms-reservas/                # (planificado) microservicio de reservas
└── packages/
    └── supabase-db/                # Paquete compartido del cliente Supabase
```

### Convenciones de rutas (App Router)

- Todas las páginas de usuario son Client Components (`"use client"`) con guards de sesión en el lado del cliente.
- Las rutas API en `app/api/` son Route Handlers (`route.js`) ejecutados en el servidor (Node.js runtime).
- Los componentes interactivos con Leaflet se cargan con `next/dynamic` y `{ ssr: false }` para evitar errores de `window` en SSR.

---

## 4. Arquitectura de Autenticación

### Flujo general

```
Cliente (browser)
    │
    ├─ Registro ──► POST /api/auth/signup (admin client) ──► Supabase Auth
    │                      │
    │                      └─ Crea fila en `perfiles`
    │                      └─ Retorna { access_token, refresh_token }
    │                      └─ Cliente llama supabase.auth.setSession()
    │
    └─ Login ────► supabase.auth.signInWithPassword() (directo desde cliente)
                          │
                          └─ Persiste sesión en localStorage
```

### Decisiones de diseño

| Aspecto | Decisión | Justificación |
|---------|---------|---------------|
| Almacenamiento de sesión | `localStorage` (no cookies) | Simplicidad; el middleware es un passthrough |
| Guards de rutas protegidas | Client-side por página | No hay middleware centralizado de auth |
| Token en API routes | `Authorization: Bearer <access_token>` | Garantiza que RLS se aplica con el UID del usuario real |
| `getSupabaseWithToken(token)` | Crea cliente con token inyectado | Cada request API opera bajo el contexto del usuario |
| Signup server-side | `/api/auth/signup` usa admin client | Evita rate limits de emails en el cliente |

### Política de contraseñas (Zod)

Validada client-side antes de enviar al servidor:

```
/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/
```

Requisitos: mínimo 8 caracteres, al menos una mayúscula, una minúscula, un número y un símbolo especial.

---

## 5. Esquema de Base de Datos

### Tabla `usuarios`

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID | FK → `auth.users` |
| `email` | text | Email único |
| `nombre_completo` | text | Nombre del usuario |
| `rol` | text | `'conductor'` \| `'arrendador'` |
| `patente` | text | Patente del vehículo principal |
| `telefono` | text | Teléfono de contacto |

### Tabla `perfiles`

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID | FK → `auth.users` |
| `nombre` | text | Nombre mostrado |
| `telefono` | text | — |
| `avatar_url` | text | URL de imagen de perfil |
| `requiere_pmr` | bool | Requiere plaza PMR (movilidad reducida) |
| `rol` | text | `'conductor'` \| `'arrendador'` |
| `created_at` | timestamptz | — |
| `updated_at` | timestamptz | — |

### Tabla `estacionamientos`

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | serial | PK |
| `nombre` | text | Nombre del estacionamiento |
| `lat` | float8 | Latitud |
| `lng` | float8 | Longitud |
| `precio_hora` | numeric | Precio por hora (CLP) |
| `price_per_minute` | numeric | Precio por minuto (CLP), opcional |
| `price_per_day` | numeric | Precio por día (CLP), opcional |
| `es_pmr` | bool | Plaza accesible PMR |
| `total_spots` | int | Total de spots en el estacionamiento |
| `occupied_spots` | int | Spots actualmente ocupados |
| `user_id` | UUID | FK → `auth.users` (dueño) |
| `comunas` | text | Comuna/región |
| `activo` | bool | Visible en búsquedas |
| `coordenadas` | geometry | PostGIS geometry (mantenida por trigger) |

### Tabla `reservas`

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID | PK |
| `estacionamiento_id` | int | FK → `estacionamientos` |
| `conductor_id` | UUID | FK → `auth.users` |
| `estado` | enum | `pendiente` \| `confirmada` \| `activa` \| `completada` \| `cancelada` |
| `fecha_inicio` | timestamptz | Inicio de la reserva |
| `fecha_fin` | timestamptz | Fin de la reserva |
| `precio_total` | numeric | Monto total calculado al crear (CLP) |
| `spot_label` | text | Etiqueta del spot asignado |
| `duration_hours` | numeric | Duración en horas |
| `patente_registrada` | text | Patente del vehículo usado |

**Estados del ciclo de vida de una reserva:**

```
pendiente ──► confirmada ──► activa ──► completada
     │              │            │
     └──────────────┴────────────┴──► cancelada
```

### Tabla `favoritos`

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID | PK |
| `user_id` | UUID | FK → `auth.users` |
| `estacionamiento_id` | int | FK → `estacionamientos` |

### Tabla `vehiculos`

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID | PK |
| `user_id` | UUID | FK → `auth.users` |
| `patente` | text | Patente del vehículo |
| `marca` | text | Marca |
| `modelo` | text | Modelo |
| `color` | text | Color |

### Tabla `spot_locks`

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID | PK |
| `estacionamiento_id` | int | FK → `estacionamientos` |
| `spot_label` | text | Etiqueta del spot bloqueado |
| `user_id` | UUID | FK → `auth.users` |
| `expires_at` | timestamptz | TTL de 5 minutos |

`spot_locks` implementa un mecanismo de bloqueo optimista para evitar reservas dobles durante el proceso de checkout. El lock expira automáticamente tras 5 minutos.

### Tabla `payments`

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID | PK |
| `reserva_id` | UUID | FK → `reservas` |
| `user_id` | UUID | FK → `auth.users` |
| `amount` | numeric | Monto cobrado (CLP) |
| `status` | enum | `pending` \| `completed` \| `failed` \| `expired` \| `refunded` |
| `provider` | text | `mock` \| `efectivo` \| `webpay` |
| `transaction_id` | text | ID de la transacción en el proveedor |
| `metadata` | jsonb | Datos adicionales del proveedor |

---

## 6. Políticas RLS (Row-Level Security)

RLS está habilitado en todas las tablas. El patrón estándar usa la forma de **subquery** `(select auth.uid())` en lugar de la llamada directa `auth.uid()`. Esto activa la optimización `auth_rls_initplan` de PostgreSQL, que evalúa la función una sola vez por statement en lugar de una vez por fila.

### Patrones por tabla

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `usuarios` | propio (`uid = id`) | propio | propio | propio |
| `perfiles` | propio | propio | propio | propio |
| `estacionamientos` | público (`USING (true)`) | `uid = user_id` | `uid = user_id` | `uid = user_id` |
| `reservas` | conductor **o** dueño del estacionamiento | conductor | conductor o dueño | — |
| `favoritos` | propio | propio | propio | propio |
| `vehiculos` | propio | propio | propio | propio |
| `spot_locks` | propio | propio | propio | propio |
| `payments` | propio (`uid = user_id`) | propio | propio | — |

### Ejemplo de política (patrón subquery)

```sql
-- Política de lectura en estacionamientos (pública)
CREATE POLICY "estacionamientos_select_public"
  ON estacionamientos FOR SELECT
  USING (true);

-- Política de escritura en estacionamientos (solo dueño)
CREATE POLICY "estacionamientos_insert_owner"
  ON estacionamientos FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);
```

---

## 7. Búsqueda Espacial con PostGIS

### Función `buscar_estacionamientos_radio`

Busca estacionamientos dentro de un radio geográfico usando `ST_DWithin` sobre la columna `coordenadas` (tipo `geometry`).

```sql
CREATE OR REPLACE FUNCTION buscar_estacionamientos_radio(
  lat float8,
  lng float8,
  radius_km float8
)
RETURNS SETOF estacionamientos
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM estacionamientos
  WHERE ST_DWithin(
    coordenadas,
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
    radius_km * 1000
  )
  AND activo = true;
$$;
```

> **Nota:** La función usa `SECURITY DEFINER` con `search_path = public` fijo para evitar ataques de search path injection. Se ha revocado `EXECUTE` de los roles `anon` y `authenticated`; la llamada se realiza desde el BFF con el service role cuando corresponda, o via RPC autenticado.

### Trigger `sync_coordenadas`

Mantiene la columna `coordenadas` sincronizada con `lat`/`lng` en cada INSERT y UPDATE:

```sql
CREATE OR REPLACE FUNCTION sync_coordenadas()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.coordenadas := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_coordenadas
  BEFORE INSERT OR UPDATE ON estacionamientos
  FOR EACH ROW EXECUTE FUNCTION sync_coordenadas();
```

---

## 8. Rutas API (Patrón BFF)

Todas las rutas implementan el patrón **Backend-for-Frontend (BFF)**. Cada request debe incluir:

```
Authorization: Bearer <supabase_access_token>
Content-Type: application/json
```

El handler extrae el token, llama `getSupabaseWithToken(token)` para crear un cliente Supabase con ese JWT, y todas las queries subsiguientes respetan las políticas RLS del usuario autenticado.

---

### `POST /api/auth/signup`

**Propósito:** Registro de nuevos usuarios server-side para evitar rate limits de emails en el cliente.

**Request body:**
```json
{
  "email": "usuario@ejemplo.cl",
  "password": "Contraseña1!",
  "nombre": "Juan Pérez",
  "rol": "conductor"
}
```

**Flujo interno:**
1. Usa el **admin client** (con `SUPABASE_SERVICE_ROLE_KEY`) para `auth.admin.createUser()`.
2. Inserta fila en `perfiles` con los datos del nuevo usuario.
3. Retorna `{ access_token, refresh_token }` para que el cliente llame `supabase.auth.setSession()`.

**Response `200`:**
```json
{
  "access_token": "...",
  "refresh_token": "..."
}
```

---

### `POST /api/mapas/search`

**Propósito:** Buscar estacionamientos disponibles en un radio geográfico.

**Request body:**
```json
{
  "lat": -33.4489,
  "lng": -70.6693,
  "radius_km": 2.0
}
```

**Flujo interno:**
1. Llama `supabase.rpc('buscar_estacionamientos_radio', { lat, lng, radius_km })`.
2. Retorna array de estacionamientos con todos sus campos.

**Response `200`:**
```json
[
  {
    "id": 42,
    "nombre": "Estacionamiento Centro",
    "lat": -33.4500,
    "lng": -70.6700,
    "precio_hora": 2000,
    "es_pmr": false,
    "total_spots": 10,
    "occupied_spots": 3,
    ...
  }
]
```

---

### `POST /api/reservas/reserve`

**Propósito:** Crear una nueva reserva y bloquear el spot.

**Request body:**
```json
{
  "estacionamiento_id": 42,
  "spot_label": "A1",
  "fecha_inicio": "2026-06-10T10:00:00Z",
  "fecha_fin": "2026-06-10T12:00:00Z",
  "precio_total": 4000,
  "patente": "ABCD12",
  "vehiculo_id": "uuid-del-vehiculo"
}
```

**Flujo interno:**
1. Verifica disponibilidad (no hay `spot_locks` vigentes ni reserva activa para ese spot).
2. Valida tipo de vehículo contra `allowed_vehicle_types` del estacionamiento.
3. Inserta en `reservas` con estado `pendiente`.
4. Inserta en `spot_locks` con TTL de 5 minutos.

**Response `201`:**
```json
{ "reserva_id": "uuid-de-la-reserva" }
```

---

### `POST /api/reservas/[id]/complete`

**Propósito:** Marcar una reserva como `completada`. Solo puede llamarla el dueño del estacionamiento.

**Flujo interno:**
1. Verifica que `auth.uid()` sea el `user_id` del estacionamiento asociado a la reserva.
2. Actualiza `reservas.estado = 'completada'`.
3. Decrementa `estacionamientos.occupied_spots` en 1 (con clamp a 0).

**Response `200`:**
```json
{ "ok": true }
```

---

### `POST /api/pagos`

**Propósito:** Procesar el pago de una reserva.

**Request body:**
```json
{
  "reserva_id": "uuid-de-la-reserva",
  "provider": "mock",
  "amount": 4000
}
```

**Validaciones de seguridad:**

| Validación | Detalle |
|-----------|---------|
| Provider allowlist | Solo `'mock'`, `'efectivo'`, `'webpay'` |
| Ownership check | Solo el `conductor_id` puede pagar su propia reserva |
| Anti-price-manipulation | `amount` se verifica contra `reservas.precio_total` |
| Idempotency | Si ya existe un pago `completed` para `reserva_id`, lo retorna sin crear duplicado |
| MAX_AMOUNT cap | Máximo 10,000,000 CLP |

**Flujo interno:**
1. Carga la reserva y verifica ownership.
2. Ejecuta las validaciones de seguridad listadas.
3. Llama `createCharge(provider, params)` de `src/lib/payments.js`.
4. Inserta resultado en tabla `payments`.

**Response `200`:**
```json
{
  "payment_id": "uuid-del-pago",
  "status": "completed",
  "transaction_id": "TXN-MOCK-abc123"
}
```

---

## 9. Abstracción de Pagos

**Archivo:** `apps/web/src/lib/payments.js`

La función `createCharge(provider, params)` centraliza la lógica de pago y despacha al proveedor correspondiente.

### Proveedores disponibles

#### `mock`
- Uso: desarrollo, demos, testing.
- Resultado: siempre `completed` de forma inmediata.
- `transaction_id`: formato `TXN-MOCK-<random>`.

#### `efectivo`
- Uso: pago en efectivo al llegar al estacionamiento.
- Resultado: `pending` hasta que el arrendador confirme recepción.
- `transaction_id`: formato `CASH-<timestamp>-<random>`.

#### `webpay`
- Integra con **Transbank Webpay Plus SDK** (`@transbank/sdk`).
- Si las variables de entorno `TRANSBANK_COMMERCE_CODE` y `TRANSBANK_API_KEY` están definidas, usa el SDK real.
- Si no están definidas, cae en **modo simulación** (comportamiento equivalente a `mock`).

**Para activar Webpay real:**
```bash
npm install @transbank/sdk
```

Definir las tres variables de entorno (ver [sección 16](#16-variables-de-entorno)) y descomentar el bloque de integración en `chargeWebpay()`.

### Funciones exportadas

| Función | Descripción |
|---------|-------------|
| `createCharge(provider, params)` | Entry point principal. Despacha al handler correcto. |
| `isValidProvider(provider)` | Retorna `true` si el provider está en la allowlist. |
| `genTransactionId(prefix)` | Genera un ID de transacción único con prefijo dado. |
| `isWebpayConfigured()` | Retorna `true` si las env vars de Transbank están presentes. |

### Forma uniforme del resultado

```js
{
  status: 'completed' | 'pending' | 'failed',
  transaction_id: string,
  provider: string,
  metadata: object   // datos adicionales del proveedor
}
```

---

## 10. Lógica de Precios

**Archivo:** `apps/web/src/lib/pricing.js`

Implementa tarifas por tramos (días → horas → minutos) de forma composable.

### `calcTotal(days, hours, mins, parking)`

Retorna el monto total en CLP.

**Reglas de cálculo:**
1. Se aplican días completos primero (`price_per_day * days`).
2. Luego horas restantes (`precio_hora * hours`).
3. Finalmente minutos (`price_per_minute * mins`).
4. Si quedan minutos y el estacionamiento **no tiene** `price_per_minute`, se redondea al bloque superior disponible (hora o día).

### `calcBreakdown(days, hours, mins, parking)`

Retorna un array de line items para display en la UI:

```js
[
  { label: '2 días', rate: 15000, sub: 30000 },
  { label: '3 horas', rate: 2000, sub: 6000 },
  { label: '15 minutos', rate: 50, sub: 750 }
]
```

**Invariante garantizada:** `sum(breakdown.map(i => i.sub)) === calcTotal(days, hours, mins, parking)`

### Manejo de estacionamientos gratuitos

Si todos los precios del estacionamiento son `0` o `null`, `calcTotal` retorna `0` sin error.

---

## 11. Mapa Interactivo

**Archivo:** `apps/web/app/mapa/page.js`

### Carga dinámica

Leaflet y sus plugins se cargan con `next/dynamic` y `{ ssr: false }` para evitar errores de `window is not defined` durante SSR:

```js
const MapComponent = dynamic(() => import('./MapComponent'), { ssr: false });
```

### Funcionalidades

| Feature | Descripción |
|---------|-------------|
| Geolocalización | Botón GPS con manejo de errores (permiso denegado, timeout) |
| Heatmap mode | Toggle para visualizar zonas de alta concentración de spots |
| Clustering | `leaflet.markercluster` agrupa marcadores en vistas alejadas |
| Filtro PMR | Badge que filtra solo estacionamientos accesibles |
| Panel de reserva | Max-height viewport-relative con scroll; abre `ParkingSelector` modal |
| Re-búsqueda | `buscar_estacionamientos_radio` se llama en cada pan/zoom del mapa |

### Flujo de búsqueda

```
Pan/Zoom del mapa
    │
    └─► Obtiene centro y bounds del mapa
    └─► Calcula radius_km desde los bounds
    └─► POST /api/mapas/search
    └─► Actualiza marcadores en el mapa
```

---

## 12. Dashboard del Arrendador

**Archivo:** `apps/web/app/dashboard/page.js`

Panel exclusivo para usuarios con `rol = 'arrendador'`. Protegido por guard client-side que redirige a `/auth` si no hay sesión o el rol es incorrecto.

### Gestión de estacionamientos

- **Crear:** Formulario con MiniMap para seleccionar ubicación. El click en el mapa o el botón GPS llaman Nominatim para geocodificación inversa y auto-rellenan los campos de dirección y región.
- **Editar:** Misma UX del formulario de creación, pre-rellenado con datos existentes.
- **Eliminar:** Confirmación antes de borrar. Solo se pueden eliminar spots sin reservas activas.

### Grilla de tarifas

El formulario acepta las tres tarifas de forma independiente (todas opcionales):

| Campo | Descripción |
|-------|-------------|
| `precio_hora` | CLP por hora |
| `price_per_minute` | CLP por minuto |
| `price_per_day` | CLP por día completo |

### Panel "Reservas Recibidas"

- Muestra todas las reservas de los estacionamientos del arrendador.
- **Badges de tiempo en vivo:**
  - Reservas futuras: "En X horas"
  - Reservas en curso: "En progreso — X min restantes"
  - Reservas vencidas: "Venció hace X horas"
- **Auto-complete:** Las reservas `confirmada` cuya `fecha_fin` ya pasó se marcan automáticamente como `completada`.
- **Resumen por spot:** Vista rápida de disponibilidad (spots libres / total) por estacionamiento.

---

## 13. Componentes Reutilizables

### `Navbar.js`

Barra de navegación global presente en todas las páginas.

**Comportamiento:**
- Lee `localStorage.user` al montar para obtener nombre y avatar del usuario.
- Links condicionales por rol: los arrendadores ven un enlace a `/dashboard`.
- Menú hamburguesa para mobile.
- Sign out: limpia `localStorage` y llama `supabase.auth.signOut()`.

---

### `ParkingSelector.js`

Modal que encapsula todo el flujo de reserva.

**Pasos del flujo:**
1. Selección de fecha/hora de inicio y fin.
2. Selector de duración con presets rápidos (1h, 2h, 4h, 8h) y entrada manual.
3. Selección del vehículo registrado del conductor.
4. Selección del método de pago.
5. Resumen con breakdown de precios (usa `calcTotal`/`calcBreakdown`).
6. Confirmación: llama `POST /api/reservas/reserve` seguido de `POST /api/pagos`.

---

### `MiniMap.js`

Mapa Leaflet embebido para selección de ubicación en formularios.

**Funcionalidades:**
- Marcador arrastrable: al soltar, llama Nominatim para geocodificación inversa.
- Botón GPS: centra el mapa en la ubicación actual del usuario.
- Callback `onAddressResolved(texto, comuna)`: notifica al componente padre con la dirección y comuna detectadas para auto-rellenar los campos del formulario.

---

### `ReviewModal.js`

Modal para dejar una reseña tras completar una reserva.

**Campos:**
- Rating de 1 a 5 estrellas (selector visual).
- Comentario de texto libre.

**Persistencia:** POST directo al cliente Supabase actualizando la fila en `reservas` con el rating y comentario.

---

## 14. SEO y Estándares Web

### `layout.js` — Metadata global

```js
export const metadata = {
  metadataBase: new URL('https://parkings-web.vercel.app'),
  title: { template: '%s | Parkings Together', default: 'Parkings Together' },
  description: '...',
  keywords: [...],
  authors: [{ name: 'Parkings Together' }],
  openGraph: { type: 'website', locale: 'es_CL', ... },
  twitter: { card: 'summary_large_image', ... },
  alternates: { canonical: '/' },
};

export const viewport = {
  themeColor: '#...',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};
```

### `robots.js` — Control de indexación

| Regla | Paths |
|-------|-------|
| Allow | `/`, `/mapa`, `/auth` |
| Disallow | `/api/`, `/dashboard`, `/profile`, `/reservas` |

### `sitemap.js` — Sitemap XML

Tres URLs públicas con metadatos de prioridad y frecuencia de cambio.

### `manifest.js` — PWA

```js
{
  name: 'Parkings Together',
  display: 'standalone',
  lang: 'es-CL',
  theme_color: '#...',
  background_color: '#...'
}
```

### `not-found.js` — Página 404

Incluye `export const metadata = { robots: { index: false } }` para que los motores de búsqueda no indexen URLs inexistentes.

---

## 15. Suite de Tests

**Ubicación:** `apps/web/tests/`  
**Framework:** Jest 30 con `babel-jest` para transformar ESM a CJS.

**Ejecutar todos los tests:**
```bash
cd apps/web
npx jest
```

**Ejecutar un archivo específico:**
```bash
npx jest tests/pricing.test.js
```

---

### `pricing.test.js` — 25 tests

Cubre `calcTotal` y `calcBreakdown`:

| Caso de prueba | Descripción |
|----------------|-------------|
| Duración cero | Retorna 0 sin errores |
| Estacionamiento gratuito | Retorna 0 con precios null/0 |
| Solo horas exactas | Sin redondeo |
| Solo horas con fracción | Redondeo al alza |
| Solo minutos | Con y sin `price_per_minute` |
| Solo días | Redondeo si las horas no completan un día |
| Combinación días+horas+minutos | Cálculo compuesto |
| Líneas del breakdown | Cantidad correcta de line items |
| Labels del breakdown | Texto correcto (singular/plural) |
| Invariante de suma | `sum(breakdown.sub) === calcTotal(...)` |

---

### `payments.test.js` — 22 tests

Cubre las funciones utilitarias y `createCharge`:

| Caso de prueba | Descripción |
|----------------|-------------|
| `isValidProvider` | Acepta providers válidos, rechaza inválidos |
| `genTransactionId` | Genera IDs únicos con el prefijo correcto |
| `isWebpayConfigured` | Detecta env vars, aislado por test |
| `createCharge('mock', ...)` | Retorna `completed` con shape correcta |
| `createCharge('efectivo', ...)` | Retorna `pending` con ID `CASH-...` |
| `createCharge('webpay', ...)` | Modo simulación cuando no hay env vars |
| Shape uniforme | Todos los providers retornan el mismo schema |

---

### `geocoding.test.js` — 8 tests

Cubre el catálogo de regiones de Chile:

| Caso de prueba | Descripción |
|----------------|-------------|
| `REGIONES` length | Exactamente 16 regiones |
| Campos requeridos | Cada región tiene `nombre`, `codigo`, `bounds` |
| Bounds coherentes | `minLat < maxLat`, `minLng < maxLng` |
| `detectarRegion(Santiago)` | Retorna Región Metropolitana |
| `detectarRegion(Valparaíso)` | Retorna V Región |
| `detectarRegion(fuera de Chile)` | Retorna `null` |
| Referencia de objeto | Retorna la misma referencia del catálogo |

---

### `api.test.js` — 6 tests

Tests de integración para rutas BFF con `fetch` mockeado:

| Caso de prueba | Descripción |
|----------------|-------------|
| `POST /api/mapas/search` 200 | Shape del array de estacionamientos |
| `POST /api/mapas/search` sin auth | Retorna 401 |
| `POST /api/reservas/reserve` 201 | Retorna `reserva_id` |
| `POST /api/reservas/reserve` spot ocupado | Retorna 409 |

---

## 16. Variables de Entorno

Crear el archivo `apps/web/.env.local` con las siguientes variables:

```env
# ─── Supabase ────────────────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # ⚠️ SOLO server-side. NUNCA exponer al cliente.

# ─── Sitio ───────────────────────────────────────────────────────────────────
NEXT_PUBLIC_SITE_URL=https://parkings-web.vercel.app

# ─── Transbank Webpay (opcional — activa pagos reales) ───────────────────────
TRANSBANK_COMMERCE_CODE=
TRANSBANK_API_KEY=
TRANSBANK_ENV=integration     # 'integration' para pruebas, 'production' para producción
```

### Reglas críticas de seguridad

| Variable | Disponible en cliente | Disponible en servidor |
|----------|-----------------------|------------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ **NUNCA** | ✅ |
| `TRANSBANK_COMMERCE_CODE` | ❌ | ✅ |
| `TRANSBANK_API_KEY` | ❌ | ✅ |

> Las variables sin prefijo `NEXT_PUBLIC_` nunca son expuestas al bundle del cliente por Next.js.

---

## 17. Despliegue en Vercel

### Proceso de build

```bash
turbo build
```

Turborepo detecta automáticamente las dependencias entre `packages/supabase-db` y `apps/web` y las construye en el orden correcto.

### Configuración en Vercel

1. Conectar el repositorio en Vercel.
2. **Framework Preset:** Next.js (detectado automáticamente).
3. **Root Directory:** `apps/web` (o dejar vacío si Turborepo gestiona el build desde la raíz).
4. Agregar todas las variables de entorno de la [sección 16](#16-variables-de-entorno) en **Project Settings → Environment Variables**.

### Checklist pre-producción

- [ ] Rotar `SUPABASE_SERVICE_ROLE_KEY` (ver [sección 19](#19-seguridad--incidentes-y-acciones-requeridas))
- [ ] Definir `NEXT_PUBLIC_SITE_URL` con el dominio de producción real
- [ ] Cambiar `TRANSBANK_ENV` a `'production'` si se activa Webpay real
- [ ] Habilitar **"Leaked password protection"** en Supabase Auth → Settings
- [ ] Verificar que todos los tests pasen: `npx jest`
- [ ] Confirmar que RLS está habilitado en todas las tablas

### Proyecto Supabase

| Parámetro | Valor |
|-----------|-------|
| Project ref | `obthriistwvcutjfrksh` |
| Región | `us-east-2` |
| PostgreSQL | 17 |
| PostGIS | habilitado |

---

## 18. Rendimiento y Optimizaciones de Base de Datos

### Optimización RLS (`auth_rls_initplan`)

Todas las políticas RLS usan la forma de subquery `(select auth.uid())` en lugar de `auth.uid()` directo. Esto hace que PostgreSQL evalúe la función **una sola vez por statement** (como una constante de initplan) en lugar de una vez por fila escaneada, reduciendo dramáticamente el overhead en tablas grandes.

```sql
-- ✅ Correcto (subquery — evaluación única)
USING ((select auth.uid()) = user_id)

-- ❌ Evitar (evaluación por fila)
USING (auth.uid() = user_id)
```

### Índices

| Índice | Tabla | Columna | Justificación |
|--------|-------|---------|---------------|
| `idx_favoritos_estacionamiento_id` | `favoritos` | `estacionamiento_id` | Cubre FK sin índice nativo |
| `idx_vehiculos_user_id` | `vehiculos` | `user_id` | Acelera carga de vehículos del conductor |

**Índice eliminado:** `idx_favoritos_user` fue detectado como duplicado y eliminado para reducir overhead de escritura.

### Seguridad de funciones DB

- Todas las funciones tienen `SET search_path = public` explícito para prevenir search path injection.
- `auto_confirm_user()`: se revocó `EXECUTE` de los roles `anon` y `authenticated`. Solo puede ser invocada por el service role.

---

## 19. Seguridad — Incidentes y Acciones Requeridas

### ⚠️ CRÍTICO: Service Role Key expuesta en historial de git

El `SUPABASE_SERVICE_ROLE_KEY` fue incluido accidentalmente en el commit `e2cdd40`.

**Acciones requeridas ANTES de cualquier despliegue a producción:**

#### 1. Rotar la clave inmediatamente

```
Supabase Dashboard → Settings → API → Rotate service_role key
```

Actualizar la nueva clave en todos los entornos (local `.env.local` y Vercel project settings).

#### 2. Purgar el historial de git (opcional pero recomendado)

Usar [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/) para eliminar la clave del historial:

```bash
# Instalar BFG
brew install bfg   # macOS, o descargar el JAR desde la web oficial

# Crear un archivo con el secreto a eliminar
echo "LA_CLAVE_COMPROMETIDA" > secrets.txt

# Purgar el historial
bfg --replace-text secrets.txt
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force
```

> **Nota:** Todos los colaboradores deberán hacer `git clone` fresco tras la purga del historial.

#### 3. Verificar que la clave rotada no está en caché

Revisar en Supabase Dashboard → Logs si hubo accesos no autorizados con la clave comprometida.

---

*Documentación generada el 2026-06-04. Para contribuciones o correcciones, abrir un issue o PR en el repositorio.*
