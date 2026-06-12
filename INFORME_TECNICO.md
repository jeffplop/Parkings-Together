# Informe Técnico — Parkings Together
**Documento de traspaso completo · Versión 2.0 · Junio 2025**

> Este documento está redactado como si su autor abandonara la empresa mañana. Cubre cada rincón del sistema: arquitectura, archivos clave, base de datos, migraciones, seguridad, tests, despliegue y guías para extender el proyecto. Si algo falla en producción, empieza por aquí.

---

## Índice

1. [Visión general del producto](#1-visión-general-del-producto)
2. [Arquitectura del sistema](#2-arquitectura-del-sistema)
3. [Estructura de directorios](#3-estructura-de-directorios)
4. [Aplicación web — apps/web](#4-aplicación-web--appsweb)
5. [Rutas API (BFF)](#5-rutas-api-bff)
6. [Componentes y librerías compartidas](#6-componentes-y-librerías-compartidas)
7. [Base de datos — Supabase](#7-base-de-datos--supabase)
8. [Migraciones SQL](#8-migraciones-sql)
9. [Funciones RPC (PostgreSQL)](#9-funciones-rpc-postgresql)
10. [Package supabase-db](#10-package-supabase-db)
11. [Microservicios (referencia)](#11-microservicios-referencia)
12. [Suite de pruebas unitarias](#12-suite-de-pruebas-unitarias)
13. [Variables de entorno](#13-variables-de-entorno)
14. [Seguridad — advertencias críticas](#14-seguridad--advertencias-críticas)
15. [Despliegue en Vercel](#15-despliegue-en-vercel)
16. [Git — historial y ramas](#16-git--historial-y-ramas)
17. [Modelo de negocio y planes Premium](#17-modelo-de-negocio-y-planes-premium)
18. [Funcionalidad de Ranking](#18-funcionalidad-de-ranking)
19. [Flujo de reservas (Saga)](#19-flujo-de-reservas-saga)
20. [Datos de demostración](#20-datos-de-demostración)
21. [Guía para nuevos desarrolladores](#21-guía-para-nuevos-desarrolladores)
22. [Decisiones de diseño documentadas](#22-decisiones-de-diseño-documentadas)
23. [Deuda técnica y mejoras pendientes](#23-deuda-técnica-y-mejoras-pendientes)

---

## 1. Visión general del producto

**Parkings Together** es una plataforma de arriendo colaborativo de estacionamientos entre particulares, diseñada como proyecto académico para DuocUC. Permite a conductores encontrar y reservar plazas en tiempo real mediante un mapa interactivo, y a arrendadores publicar y gestionar sus estacionamientos.

### Páginas públicas disponibles

| Ruta | Descripción |
|------|-------------|
| `/` | Landing page con mapa en vivo, estadísticas y GPS |
| `/mapa` | Mapa interactivo completo con búsqueda avanzada |
| `/auth` | Registro (3 pasos) y login |
| `/dashboard` | Panel del arrendador — gestión de plazas y reservas |
| `/reservas` | Historial de reservas del conductor |
| `/profile` | Perfil de usuario, plan actual y badges |
| `/premium` | Página de planes de suscripción con calculadora |
| `/ranking` | Estacionamientos mejor calificados por zona |
| `/verificar` | Verificación de email |

---

## 2. Arquitectura del sistema

```
┌─────────────────────────────────────────────────────┐
│                  Navegador (cliente)                │
│  Next.js App Router · React 18 · styled-jsx         │
│  Leaflet + MarkerClusterGroup · FontAwesome         │
└──────────────────────┬──────────────────────────────┘
                       │ fetch /api/*  (mismo origen)
┌──────────────────────▼──────────────────────────────┐
│              apps/web  (BFF — Next.js)              │
│  Route Handlers (/api/mapas, /api/reservas, …)      │
│  ⚡ Todos en el servidor → no expone credenciales    │
└──────────────┬──────────────────────┬───────────────┘
               │ supabase-js (admin)  │ supabase-js (anon)
┌──────────────▼──────────────────────▼───────────────┐
│                   Supabase Cloud                    │
│  PostgreSQL + PostGIS + RLS + Realtime + Storage    │
│  Región: us-east-2 · Proyecto: obthriistwvcutjfrksh │
└─────────────────────────────────────────────────────┘
```

### Patrón BFF (Backend For Frontend)

El cliente web **solo** habla con rutas del mismo dominio (`/api/*`). Estas rutas corren en Node.js dentro de Vercel y pueden usar `SUPABASE_SERVICE_ROLE_KEY` de forma segura. Esto reemplaza la arquitectura original de microservicios externos cuyas URLs causaban errores en producción por quedar apuntando a `localhost`.

### Autenticación

1. Supabase Auth emite un JWT al hacer login/signup.
2. El cliente lo guarda en `localStorage` vía el SDK.
3. En cada petición al BFF, `authHeaders()` inyecta `Authorization: Bearer <jwt>`.
4. Los route handlers crean un cliente Supabase con ese token para que RLS evalúe `auth.uid()`.

---

## 3. Estructura de directorios

```
Parkings-Together/
├── apps/
│   ├── web/                    ← Aplicación principal (Next.js 14)
│   │   ├── app/                ← App Router (páginas + API routes)
│   │   │   ├── api/            ← Route Handlers (BFF)
│   │   │   │   ├── auth/       ← signup/login
│   │   │   │   ├── favoritos/  ← favoritos CRUD
│   │   │   │   ├── mapas/      ← estacionamientos CRUD + búsqueda
│   │   │   │   ├── pagos/      ← pago simulado
│   │   │   │   ├── premium/    ← planes premium
│   │   │   │   └── reservas/   ← reserve + manage
│   │   │   ├── auth/           ← Página de registro/login
│   │   │   ├── dashboard/      ← Panel arrendador
│   │   │   ├── mapa/           ← Mapa interactivo
│   │   │   ├── premium/        ← Planes de suscripción
│   │   │   ├── profile/        ← Perfil de usuario
│   │   │   ├── ranking/        ← Ranking por zona
│   │   │   ├── reservas/       ← Historial conductor
│   │   │   ├── verificar/      ← Verificación email
│   │   │   ├── layout.js       ← Root layout + metadata
│   │   │   ├── page.js         ← Landing page
│   │   │   ├── globals.css     ← Reset + tipografía global
│   │   │   ├── manifest.js     ← Web App Manifest (PWA)
│   │   │   ├── robots.js       ← robots.txt dinámico
│   │   │   └── sitemap.js      ← sitemap.xml dinámico
│   │   ├── src/
│   │   │   ├── components/     ← Navbar, Footer, etc.
│   │   │   ├── lib/            ← api.js, planes.js, pricing.js, geocoding.js
│   │   │   └── middleware.js   ← Protección de rutas privadas
│   │   ├── tests/              ← Suites Jest / node:test
│   │   ├── public/             ← favicon.svg, icons PWA
│   │   ├── next.config.mjs
│   │   └── jest.config.mjs
│   ├── ms-reservas/            ← Microservicio de reservas (Express)
│   ├── ms-mapas/               ← Microservicio de mapas (Express)
│   └── auth/                   ← Microservicio de auth (Express)
├── packages/
│   └── supabase-db/            ← Cliente Supabase compartido
│       └── index.js
├── sql/                        ← Migraciones y seeds
│   ├── 001_*.sql … 011_*.sql
│   ├── APLICAR_TODO.sql
│   └── DIAGNOSTICO_SIGNUP.sql
├── package.json                ← Turborepo root
├── turbo.json
└── INFORME_TECNICO.md          ← Este archivo
```

---

## 4. Aplicación web — apps/web

### 4.1 Páginas principales

#### `app/page.js` — Landing Page
- Mapa Leaflet en vivo (SSR desactivado con `dynamic(..., {ssr:false})`).
- Estadísticas en tiempo real (contadores de estacionamientos y reservas via Supabase Realtime).
- GPS: botón "Usar mi ubicación" con `navigator.geolocation`.
- Firma en el footer: `Dareko` (línea 165 aprox.).
- Sección hero con buscador rápido por dirección.

#### `app/mapa/page.js` — Mapa Interactivo
Página más compleja. Características:
- **Panel unificado** colapsable en mobile con filtros: texto, comuna, PMR, precio máx, geolocalización.
- **MarkerClusterGroup**: agrupa pines; el círculo verde es un clúster de marcadores cercanos.
- **Lightbox de fotos**: click en imagen abre overlay animado. Teclado: `Escape` cierra, flechas navegan entre fotos. Estado: `const [lightbox, setLightbox] = useState(null)` con `{photos, idx}`.
- **ParkingSelector** (panel lateral): detalles del estacionamiento seleccionado, galería, formulario de reserva con fecha/hora y calculadora de precio.
- Realtime: suscripción a cambios en tabla `estacionamientos` para actualizar pines sin recargar.

#### `app/auth/page.js` — Registro en 3 pasos
Flujo de wizard con validación manual (sin react-hook-form):

| Paso | Contenido |
|------|-----------|
| 1 | Selección de rol: tarjeta **Conductor** o **Arrendador** |
| 2 | Datos personales: nombre, apellido, teléfono + campo específico del rol (tipo de vehículo o empresa) |
| 3 | Email + contraseña con medidor de fortaleza (5 criterios → barra de color) |

El medidor de contraseña evalúa: longitud ≥8, mayúscula, minúscula, número, símbolo. Score 0-5 → colores desde rojo `#ef4444` hasta verde `#10b981`.

#### `app/dashboard/page.js` — Panel Arrendador
- Tabla de estacionamientos propios con edición inline.
- Formulario de nuevo estacionamiento con auto-completado de dirección desde click en mapa.
- Estadísticas: ingresos totales, plazas activas, ocupación media.
- Historial de reservas recibidas con acciones (confirmar/completar/cancelar).
- Exportar datos CSV.

#### `app/reservas/page.js` — Historial Conductor
- Lista de reservas con estado (activa, completada, cancelada).
- Reprogramación y cancelación.
- Sistema de calificación con foto de reseña (upload a Supabase Storage).

#### `app/premium/page.js` — Planes de Suscripción
Ver sección 17 para el modelo completo. Componentes clave dentro de la página:
- `<Calculadora>` — slider interactivo; muestra break-even "con X reservas/mes el plan se paga solo".
- `<GamificacionSection>` — 4 niveles de conductor + 6 badges.
- `<ComparativaSection>` — tabla vs SpotHero / JustPark / EasyPark.
- Toggle conductor/arrendador + toggle mensual/anual.

#### `app/ranking/page.js` — Ranking por Zona
- Detección automática de región vía `detectarRegion(lat, lng)`.
- Filtros: región → (cascada) comunas, tipo de vehículo, precio máx, solo con disponibilidad.
- Ordenamiento: calificación DESC, luego cantidad de reseñas DESC.
- Podio top-3 con medallas oro/plata/bronce + lista completa.
- Fuente de datos: `api.mapas.buscar()` con filtros aplicados client-side.

### 4.2 Middleware — `src/middleware.js`

Protege las rutas privadas. Si el usuario no tiene sesión válida y accede a `/dashboard`, `/reservas`, `/profile`, lo redirige a `/auth`. Lógica especial: usa `supabase.auth.getUser()` (no solo `getSession()`) para detectar tokens expirados pero refrescables, evitando logout prematuro.

### 4.3 Layout raíz — `app/layout.js`

- Metadatos globales (Open Graph, Twitter Card, canonical URL).
- Carga Font Awesome CDN.
- Envuelve con `<AuthProvider>` (contexto de sesión global).
- `<Navbar>` + children + `<Footer>`.

### 4.4 Manifest y PWA — `app/manifest.js`

La app es instalable como PWA. El manifest define nombre, íconos (SVG + PNG), colores del tema y modo `standalone`.

---

## 5. Rutas API (BFF)

Todas viven en `apps/web/app/api/`. Corren en el servidor (Node.js edge runtime desactivado intencionalmente para poder usar `getServiceSupabase()`).

### `GET/POST /api/auth/signup`

| Método | Acción |
|--------|--------|
| POST | Crear usuario en `auth.users` + insertar en `public.usuarios` con campos extendidos |

Campos aceptados en el body:
```json
{
  "email": "...",
  "password": "...",
  "nombre": "...",
  "apellido": "...",
  "telefono": "...",
  "rol": "cliente|arrendador",
  "tipo_vehiculo": "auto|moto|camioneta|furgon",
  "empresa": "..."
}
```

El nombre se guarda como `"${nombre} ${apellido}".trim()`. `tipo_vehiculo` solo se guarda si `rol === 'cliente'`; `empresa` solo si `rol === 'arrendador'`.

### `GET/POST/PATCH/DELETE /api/mapas/search`

| Método | Acción |
|--------|--------|
| GET | Listar estacionamientos con filtros (userId, q, comuna, pmr, disponible, precioMax, lat, lng, radius) |
| POST | Crear nuevo estacionamiento (requiere JWT) |
| PATCH | Actualizar ocupación, datos completos, o toggle activo/inactivo |
| DELETE | Eliminar uno o varios por IDs (solo el dueño) |

La búsqueda por geolocalización llama a la RPC `buscar_estacionamientos_radio(lat, lng, radius_km)`.

### `GET/POST /api/reservas/reserve`

| Método | Acción |
|--------|--------|
| GET | Verificar disponibilidad de una plaza (parkingId query param) |
| POST | Crear reserva → llama a la Saga de 3 pasos |

Body POST:
```json
{
  "parking_id": "uuid",
  "fecha_inicio": "2025-06-01T10:00:00Z",
  "fecha_fin": "2025-06-01T12:00:00Z",
  "monto": 5000
}
```

### `GET/PATCH /api/reservas/manage`

| Método | Acción |
|--------|--------|
| GET | Listar reservas del usuario (scope: 'conductor' o 'arrendador') |
| PATCH | Confirmar / cancelar / reprogramar / completar / calificar |

### `GET/POST /api/premium`

| Método | Acción |
|--------|--------|
| GET | Retorna el plan actual del usuario autenticado |
| POST | Cambia de plan (simulado; en producción conectar Webpay/Stripe) |

### `GET/POST/DELETE /api/favoritos`

CRUD de favoritos. Requiere JWT. Vinculado a tabla `favoritos`.

### `POST /api/pagos`

Pago simulado. Recibe `monto` y `reserva_id`, actualiza estado del pago en la BD.

---

## 6. Componentes y librerías compartidas

### `src/components/Navbar.js`

Barra de navegación responsiva. Items definidos en el arreglo `NAV_ITEMS`:

```js
[
  { href: '/',        label: 'Inicio',   icon: 'fa-home' },
  { href: '/mapa',    label: 'Explorar', icon: 'fa-map-location-dot' },
  { href: '/ranking', label: 'Ranking',  icon: 'fa-trophy' },
  // + dashboard si es arrendador, reservas si es conductor
]
```

Incluye enlace premium con estilo dorado (clase `.premium-link`) y "Hazte Premium" en el dropdown del avatar de usuario con ícono de corona.

### `src/lib/api.js`

Orquestador BFF del lado cliente. Único punto de entrada para todas las llamadas al servidor. Estructura:

```
api.mapas.{buscar, crearEstacionamiento, actualizarOcupacion, ...}
api.reservas.{verificarDisponibilidad, crearReserva, listar, confirmar, cancelar, ...}
api.premium.{estado, suscribir}
api.favoritos.{listar, agregar, quitar}
```

Usa `fetchWithTimeout()` con AbortController (timeout 4 segundos). Ante cualquier error retorna `{ success: false, error, data: [] }` para que la UI nunca crashee.

`authHeaders()` obtiene el JWT de Supabase y lo inyecta como `Authorization: Bearer`.

### `src/lib/planes.js`

Catálogo de planes v2. Exporta:
- `PLANES` — objeto con keys `conductor` y `arrendador`, cada uno array de planes.
- `COMISION_PLATAFORMA` — constante 8 (%).
- `precioCiclo(precioMensual, ciclo)` — calcula precio anual (= 10 mensualidades).
- `mesesToPayback(precioMensualPro, precioPromedioReserva)` — calcula cuántas reservas necesitas para que el Pro se pague solo.
- `NIVELES_CONDUCTOR` — 4 niveles gamificados (Novato → Regular → Frecuente → Elite).
- `BADGES` — 6 insignias (Primera Plaza, x10, x50, Puntual, Crítico, Explorador).
- `FAQ` — 6 preguntas frecuentes con respuestas honestas incluyendo el break-even.

### `src/lib/pricing.js`

Lógica de cálculo de precios de estacionamiento. Soporta tarifas por hora, por minuto y por día de forma combinada. Exporta:
- `calcTotal(dias, horas, minutos, tarifa)` — retorna el total en CLP.
- `calcBreakdown(dias, horas, minutos, tarifa)` — retorna array de líneas de detalle para mostrar en la UI.

Reglas de redondeo: fracción de hora sin tarifa por minuto → redondea arriba a la hora; fracción de día → redondea arriba al día.

### `src/lib/geocoding.js`

Utilidades de geocodificación. Usa la API de OpenStreetMap Nominatim (sin key requerida).
- `geocodeAddress(address)` → `{lat, lng}` o `null`.
- `reverseGeocode(lat, lng)` → dirección legible.
- `detectarRegion(lat, lng)` → nombre de región chilena basado en rangos de coordenadas.

---

## 7. Base de datos — Supabase

**Proyecto**: `obthriistwvcutjfrksh`  
**Región**: us-east-2  
**Extensions activas**: `postgis`, `uuid-ossp`

### Tablas principales

#### `public.usuarios`
| Columna | Tipo | Notas |
|---------|------|-------|
| id | uuid PK | = auth.users.id |
| email | text | |
| nombre | text | "nombre apellido" |
| rol | text | `'cliente'` o `'arrendador'` |
| telefono | text | |
| tipo_vehiculo | text | Solo conductores |
| empresa | text | Solo arrendadores |
| plan | text | `'free'`, `'pro'`, `'plus'`, `'premium'` |
| plan_ciclo | text | `'mensual'` o `'anual'` |
| plan_hasta | timestamptz | Fecha de expiración del plan |
| avatar_url | text | URL pública en Supabase Storage |
| created_at | timestamptz | |

#### `public.estacionamientos`
| Columna | Tipo | Notas |
|---------|------|-------|
| id | uuid PK | |
| arrendador_id | uuid FK | → usuarios.id |
| nombre | text | |
| descripcion | text | |
| direccion | text | |
| comuna | text | |
| region | text | |
| lat | float8 | |
| lng | float8 | |
| location | geometry(Point,4326) | PostGIS — generado automáticamente |
| capacidad_total | int | |
| occupied_spots | int | |
| precio_hora | numeric | |
| price_per_minute | numeric | |
| price_per_day | numeric | |
| es_pmr | boolean | Accesibilidad |
| activo | boolean | |
| fotos | text[] | Array de URLs (Supabase Storage) |
| calificacion_promedio | numeric | |
| reviews_count | int | |
| vehiculos_permitidos | text[] | `['auto','moto','camioneta']` |
| created_at | timestamptz | |

#### `public.reservas`
| Columna | Tipo | Notas |
|---------|------|-------|
| id | uuid PK | |
| conductor_id | uuid FK | → usuarios.id |
| estacionamiento_id | uuid FK | → estacionamientos.id |
| fecha_inicio | timestamptz | |
| fecha_fin | timestamptz | |
| estado | text | `activa`, `confirmada`, `completada`, `cancelada` |
| monto | numeric | |
| calificacion | int | 1-5 stars |
| comentario | text | |
| review_photo_url | text | |
| created_at | timestamptz | |

#### `public.favoritos`
| Columna | Tipo |
|---------|------|
| id | uuid PK |
| usuario_id | uuid FK |
| estacionamiento_id | uuid FK |
| created_at | timestamptz |

Restricción única: `(usuario_id, estacionamiento_id)`.

#### `public.vehiculos`
Vehículos registrados por conductores. Campos: marca, modelo, patente, tipo, color.

#### `public.spot_locks` (tabla de concurrencia)
Bloqueos temporales durante el proceso de reserva (Saga paso 1). TTL de 5 minutos. Evita doble-reserva.

#### `public.payments`
Registro de pagos. Estado: `pending`, `completed`, `failed`.

### Row Level Security (RLS)

**Todas las tablas tienen RLS activado.** Políticas principales:

- `estacionamientos`: SELECT público; INSERT/UPDATE/DELETE solo si `arrendador_id = auth.uid()`.
- `reservas`: SELECT/INSERT si `conductor_id = auth.uid()` O si es arrendador del estacionamiento.
- `usuarios`: SELECT propio; UPDATE propio.
- `favoritos`: solo el dueño.
- `spot_locks`: solo el creador del lock.

---

## 8. Migraciones SQL

Ubicación: `/sql/`. Se aplican en orden numérico. Usar `APLICAR_TODO.sql` para aplicar todas de una vez en un proyecto nuevo.

| Archivo | Contenido |
|---------|-----------|
| `001_create_perfiles_and_storage.sql` | Tabla `usuarios`, Storage bucket `avatars`, políticas RLS iniciales |
| `002_create_perfiles_only.sql` | Variante sin Storage (para ambientes sin Storage activado) |
| `003_create_vehiculos.sql` | Tabla `vehiculos` con FK a usuarios |
| `004_security_hardening.sql` | Revisión de políticas RLS, índices de performance, guards de seguridad |
| `005_align_estacionamientos.sql` | Esquema completo de `estacionamientos` con PostGIS `location` y columnas de calificación |
| `006_rename_rol_arrendador.sql` | Renombra `rol = 'arrendador'` en tablas que lo necesitaban alinear |
| `007_reservas_pro.sql` | Tabla `reservas` pro-level + `spot_locks` + `payments` + funciones Saga |
| `008_favoritos_resenas.sql` | Tabla `favoritos` + columnas de reseñas en `reservas` (calificacion, comentario, review_photo_url) |
| `009_seed_demo_estacionamientos_rm.sql` | 15 estacionamientos demo en la Región Metropolitana con imágenes reales |
| `010_seed_demo_rancagua.sql` | 5 estacionamientos demo en Rancagua (O'Higgins) |
| `011_seed_estacionamientos_v2.sql` | Versión consolidada del seed: 20 spots totales con pool de 6 fotos de Unsplash |

### Cómo limpiar datos de demo

```sql
-- Orden obligatorio para respetar FK constraints
DELETE FROM public.spot_locks;
DELETE FROM public.payments;
DELETE FROM public.reservas;
DELETE FROM public.favoritos;
DELETE FROM public.vehiculos;
DELETE FROM public.usuarios;
DELETE FROM auth.users;  -- requiere service_role
DELETE FROM public.estacionamientos;
```

Luego re-ejecutar `011_seed_estacionamientos_v2.sql` si se necesitan datos de prueba.

---

## 9. Funciones RPC (PostgreSQL)

### `buscar_estacionamientos_radio(p_lat, p_lng, p_radius_km)`

Búsqueda geoespacial. Retorna estacionamientos activos dentro del radio indicado, ordenados por distancia.

```sql
SELECT * FROM buscar_estacionamientos_radio(
  -33.4569,   -- latitud
  -70.6483,   -- longitud
  5.0         -- radio en km
);
```

Usa `ST_DWithin` con `ST_SetSRID(ST_MakePoint(lng, lat), 4326)`. El campo `location` en `estacionamientos` debe estar poblado; el trigger `update_location_from_lat_lng` lo hace automáticamente al INSERT/UPDATE de `lat`/`lng`.

### Saga de Reservas (3 funciones atómicas)

Implementadas en `007_reservas_pro.sql`:

1. **`saga_reserva_step1_lock(p_estacionamiento_id, p_conductor_id, p_fecha_inicio, p_fecha_fin)`**  
   Crea un `spot_lock` temporal (5 min). Verifica que no haya conflicto de horario. Retorna `lock_id` o error.

2. **`saga_reserva_step2_pago(p_lock_id, p_monto, p_metodo_pago)`**  
   Verifica que el lock esté vigente. Crea registro en `payments` con estado `pending`. Simula procesamiento. Retorna `payment_id`.

3. **`saga_reserva_step3_confirmar(p_lock_id, p_payment_id)`**  
   Verifica lock + pago exitoso. Inserta en `reservas` con estado `activa`. Libera el lock. Es atómica: si falla, hace rollback completo.

---

## 10. Package supabase-db

**Ubicación**: `packages/supabase-db/index.js`

Tres exports distintos con distintos niveles de privilegio:

```js
// Cliente público — usar en componentes React (browser-safe)
import { supabase } from '@parkings/supabase-db';

// Cliente con JWT del usuario — usar en route handlers para RLS
import { getSupabaseWithToken } from '@parkings/supabase-db';
const client = getSupabaseWithToken(accessToken);

// Cliente admin (service_role) — SOLO en servidor, jamás en cliente
import { getServiceSupabase } from '@parkings/supabase-db';
const adminClient = getServiceSupabase(); // lanza Error si window !== undefined
```

`getServiceSupabase()` tiene un guard explícito:
```js
if (typeof window !== 'undefined') {
  throw new Error('getServiceSupabase() cannot be called in the browser');
}
```

---

## 11. Microservicios (referencia)

Los microservicios existen en `apps/ms-reservas`, `apps/ms-mapas` y `apps/auth` pero **no son usados en producción**. La web los reemplaza con sus propios route handlers BFF. Los microservicios se conservan como referencia arquitectónica para el examen académico.

Si en el futuro se desea usar los microservicios, descomentar las variables en `.env.local`:
```env
NEXT_PUBLIC_MS_MAPAS_URL="https://..."
NEXT_PUBLIC_MS_RESERVAS_URL="https://..."
```
Y actualizar `src/lib/api.js` para apuntar a esas URLs en lugar de las rutas internas.

---

## 12. Suite de pruebas unitarias

**Total**: ~66 pruebas en 5 suites. Comando: `npm test` desde la raíz.

| Archivo | Framework | Tests | Cubre |
|---------|-----------|-------|-------|
| `apps/web/tests/pricing.test.js` | Jest | ~20 | `calcTotal` y `calcBreakdown` — todas las combinaciones de tarifas, redondeos |
| `apps/web/tests/api.test.js` | node:test | ~10 | BFF `api.mapas`, `api.reservas` — happy path + errores |
| `apps/web/tests/api.timeout.test.js` | Jest | ~8 | `fetchWithTimeout` — timeout, abort, fallback |
| `apps/web/tests/geocoding.test.js` | Jest | ~12 | `geocodeAddress`, `reverseGeocode`, `detectarRegion` |
| `apps/web/tests/payments.test.js` | Jest | ~8 | Lógica de pagos simulados |
| `apps/ms-reservas/tests/reserveService.test.js` | Jest | ~8 | Saga de reservas (mock de Supabase) |

### Casos notables en pricing.test.js

- Duración 0 → siempre $0.
- Estacionamiento gratuito (sin ninguna tarifa) → $0.
- Fracción de hora sin tarifa/min → redondea arriba a 1 hora.
- Fracción de día → redondea arriba a 1 día.
- Tarifas combinadas: días + horas + minutos se calculan en ese orden de prioridad.
- `calcBreakdown` debe sumar exactamente lo mismo que `calcTotal` (prueba de consistencia).

---

## 13. Variables de entorno

### `apps/web/.env.local` (nunca commitear)

```env
# Públicas — expuestas al navegador (prefijo NEXT_PUBLIC_)
NEXT_PUBLIC_SUPABASE_URL="https://obthriistwvcutjfrksh.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<anon-key>"

# Privada — SOLO servidor, NUNCA al cliente
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
```

### Variables en Vercel

Ir a: **Project Settings → Environment Variables**

| Variable | Scope | Descripción |
|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Production + Preview | URL pública del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production + Preview | Clave anon pública (OK exponer) |
| `SUPABASE_SERVICE_ROLE_KEY` | Production + Preview | **SECRETO** — clave admin (rotar si se expuso) |

### `packages/supabase-db/index.js` usa

- `process.env.NEXT_PUBLIC_SUPABASE_URL`
- `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `process.env.SUPABASE_SERVICE_ROLE_KEY`

---

## 14. Seguridad — advertencias críticas

### ⚠️ URGENTE: Rotar SUPABASE_SERVICE_ROLE_KEY

La clave `SUPABASE_SERVICE_ROLE_KEY` fue expuesta en el commit `e2cdd40` del historial de git. Aunque el branch sea privado, cualquier persona con acceso al repositorio puede obtenerla.

**Pasos inmediatos antes de ir a producción:**

1. Ir a [Supabase Dashboard](https://supabase.com/dashboard) → proyecto `obthriistwvcutjfrksh`.
2. Settings → API → "Reset service_role key".
3. Copiar la nueva clave.
4. Actualizar en Vercel: Project Settings → Environment Variables → `SUPABASE_SERVICE_ROLE_KEY`.
5. Actualizar en `.env.local` local.
6. El commit antiguo seguirá en el historial — para borrarlo se necesita `git rebase` o `git filter-branch`, pero con la clave rotada ya no importa.

### Principios de seguridad implementados

- `getServiceSupabase()` lanza error si se llama en el navegador (guard de runtime).
- Todo acceso admin pasa por route handlers de Next.js (servidor).
- RLS activado en todas las tablas — incluso si alguien obtiene la anon key, no puede ver datos de otros usuarios.
- Tokens JWT de corta duración + refresh automático via Supabase Auth.
- Middleware de Next.js valida sesión con `getUser()` (no solo `getSession()`) para detectar tokens realmente expirados.
- Inputs sanitizados: no hay queries SQL construidas con concatenación de strings; se usan los builders de supabase-js.

---

## 15. Despliegue en Vercel

### Primera vez

```bash
# 1. Instalar Vercel CLI
npm i -g vercel

# 2. Desde el directorio apps/web
cd apps/web
vercel

# 3. Configurar variables de entorno en el dashboard de Vercel
# (ver sección 13)

# 4. El build command es: turbo run build
# El output directory es: .next
# El install command es: npm install
```

### Configuración de Vercel para monorepo

En `vercel.json` (o en el dashboard):
- **Root Directory**: `apps/web`
- **Build Command**: `cd ../.. && npm install && cd apps/web && npm run build`
- **Output Directory**: `.next`

### Dominio personalizado

Vercel Project Settings → Domains → Agregar dominio. Configurar DNS según instrucciones de Vercel.

### Revisión de logs en producción

- Vercel Dashboard → Deployments → seleccionar deploy → Runtime Logs.
- Para errores de Supabase: Supabase Dashboard → Logs → API Logs.

---

## 16. Git — historial y ramas

### Rama de desarrollo activa

```
claude/inspiring-rubin-WVJbv
```

### Últimos commits (más reciente primero)

```
797f17c feat(premium): evidence-based pricing redesign with calculator and gamification
b9b7aca feat(premium): subscription plans page + zone-based parking ranking
2ebed36 feat(mapa): photo lightbox + real parking images, footer signature
afda2f0 feat(auth): multi-step registration form with role-specific fields
b09f711 feat(data): add demo parking spots in Rancagua and nearby comunas
2e3758c feat(mapa): unify control panel, collapsible on mobile, RM demo data
27b3ed9 chore: add test scripts, remove dead CSS keyframe
c52a0a3 refactor: extract shared reservation action-button style helper
77576ba perf: guard dev-only console logs, hoist static spot button styles
62c8cc3 docs: full exam documentation - patterns, branching, READMEs
bf097fe fix: panel animation keyframes, mobile bottom sheet, DB security
2ef425b feat: review photos, analytics dashboard, parking descriptions
90dd478 feat: parking photos, favorites quick actions, navbar improvements
71db677 feat: digital ticket with QR, PWA install, share spot
eab46bc feat: GPS landing, live stats, occupancy bar, directions, favicon
ae3a137 feat: unit tests, auth Suspense boundary, loading text fix
6668dd7 feat: web standards, PWA, payment abstraction, SEO hardening
f81eac3 test: 36 tests Jest verdes + 6 node:test; cobertura pricing/geocodificacion
25d4906 fix: popup button clipped and parking card cramped layout
d5033b4 ux: friendlier dashboard, auto-fill address from map
```

### Convención de commits

Se sigue Conventional Commits: `tipo(scope): descripción`.  
Tipos usados: `feat`, `fix`, `chore`, `docs`, `refactor`, `perf`, `test`, `ux`.

---

## 17. Modelo de negocio y planes Premium

### Filosofía (basada en investigación competitiva)

Basado en análisis de SpotHero, JustPark, EasyPark y BlaBlaCar:

> **Los conductores reservan GRATIS siempre.** La plataforma monetiza con una comisión de servicio (~8%) incluida en el precio mostrado, no con suscripción obligatoria.

Esto refleja cómo funcionan SpotHero y JustPark, los líderes del mercado.

### Planes de conductor

| Plan | Precio | Ventaja clave |
|------|--------|---------------|
| Explorador (free) | $0/mes | Búsqueda y reserva ilimitadas, comisión ~8% incluida |
| Conductor Pro | $2.990/mes | Sin tarifa de servicio (ahorra ~8%/reserva), alertas de disponibilidad |

**Break-even del Pro**: Si reservas plazas por más de ~$37.500/mes, el ahorro en comisión cubre el costo de la suscripción.

### Planes de arrendador

| Plan | Precio | Comisión | Límite plazas |
|------|--------|----------|---------------|
| Inicio (free) | $0/mes | 15% | 3 estacionamientos |
| Arrendador Plus | $4.990/mes | 8% | 10 estacionamientos |
| Arrendador Pro | $7.990/mes | 5% | Ilimitados |

### Precios de referencia CLP 2025

- Apple TV+: $4.990/mes
- Netflix: $7.190/mes
- Los planes de arrendador están calibrados en ese rango.

### Ciclo anual

`precioCiclo(precio, 'anual')` = precio × 10 (equivale a 2 meses gratis).

---

## 18. Funcionalidad de Ranking

### Algoritmo de ranking

1. Se obtienen todos los estacionamientos activos via `api.mapas.buscar()`.
2. Se filtran por los criterios seleccionados (región, comuna, tipo de vehículo, precio máx, disponibilidad).
3. Se ordenan por `calificacion_promedio DESC`, luego `reviews_count DESC` como criterio de desempate.
4. Los top 3 se muestran en un podio especial; el resto en lista numerada.

### Detección de región

`detectarRegion(lat, lng)` en `src/lib/geocoding.js` mapea coordenadas a regiones chilenas usando rangos de latitud/longitud. Cubre: RM, Valparaíso, O'Higgins, Biobío, y más.

### Filtros de ranking

- **Región**: selector, carga automáticamente según GPS del usuario.
- **Comunas**: se filtran al cambiar región (cascada).
- **Tipo de vehículo**: chips multi-selección (auto, moto, camioneta, furgón).
- **Precio máximo**: slider numérico en CLP.
- **Solo disponibles**: toggle que filtra `occupied_spots < capacidad_total`.

---

## 19. Flujo de reservas (Saga)

```
Cliente
  │
  ├─ 1. api.reservas.verificarDisponibilidad(parkingId)
  │     → GET /api/reservas/reserve?parkingId=...
  │     → Consulta spot_locks activos + reservas en ese horario
  │
  ├─ 2. api.reservas.crearReserva({parking_id, fecha_inicio, fecha_fin, monto})
  │     → POST /api/reservas/reserve
  │     → saga_reserva_step1_lock() — crea lock de 5 min
  │     → saga_reserva_step2_pago() — registra pago pending
  │     → saga_reserva_step3_confirmar() — crea reserva, libera lock
  │     → Retorna reserva_id con estado 'activa'
  │
  ├─ 3. (Arrendador) api.reservas.confirmar(reserva_id)
  │     → PATCH action: 'confirmar' → estado = 'confirmada'
  │
  └─ 4. api.reservas.completar(reserva_id) → estado = 'completada'
        → Habilita calificación del arrendador
```

Si el lock expira antes del paso 3, la reserva falla y el conductor debe intentar de nuevo.

---

## 20. Datos de demostración

### Pool de imágenes reales

Las fotos de estacionamientos usan 6 IDs de Unsplash:
```
photo-1506521781263-d8422e82f27a  (estacionamiento cubierto)
photo-1558618666-fcd25c85cd64  (parking subterráneo)
photo-1571068316344-75bc76f77890  (entrada parking)
photo-1568605117036-5fe5e7bab0b7  (plazas al aire libre)
photo-1590674899484-d5640e854abe  (señalización parking)
photo-1449824913935-59a10b8d2000  (calle con autos)
```

Se asignan ciclicamente: el estacionamiento N usa `imgs[(N % 6) + 1]`.

### Zonas de demo

- **Región Metropolitana**: 15 spots cubriendo Providencia, Las Condes, Ñuñoa, Santiago Centro, Vitacura, Maipú, La Florida.
- **O'Higgins / Rancagua**: 5 spots en Rancagua Centro, Machalí, San Fernando.

---

## 21. Guía para nuevos desarrolladores

### Setup local

```bash
# 1. Clonar
git clone https://github.com/jeffplop/parkings-together.git
cd parkings-together
git checkout claude/inspiring-rubin-WVJbv

# 2. Instalar dependencias (monorepo)
npm install

# 3. Configurar entorno
cp apps/web/.env.example apps/web/.env.local
# Editar .env.local con las claves reales de Supabase

# 4. Aplicar migraciones SQL
# Ir a Supabase Dashboard → SQL Editor
# Pegar y ejecutar contenido de sql/APLICAR_TODO.sql

# 5. Levantar dev server
npm run dev
# Web disponible en http://localhost:3000
```

### Añadir una nueva página

1. Crear `apps/web/app/<nombre>/page.js`.
2. Si requiere autenticación, agregar la ruta al array `PROTECTED_ROUTES` en `src/middleware.js`.
3. Agregar el enlace en `NAV_ITEMS` dentro de `src/components/Navbar.js`.

### Añadir una nueva ruta API

1. Crear `apps/web/app/api/<nombre>/route.js`.
2. Exportar `GET`, `POST`, `PATCH` o `DELETE` según necesidad.
3. Para operaciones que requieren autenticación: extraer el JWT con `request.headers.get('Authorization')`, crear cliente con `getSupabaseWithToken(token)`.
4. Para operaciones admin: usar `getServiceSupabase()` (que automáticamente valida que está en servidor).
5. Registrar el endpoint en `src/lib/api.js` bajo el namespace correspondiente.

### Añadir un nuevo plan de suscripción

1. Editar `src/lib/planes.js` → añadir objeto al array correspondiente.
2. Actualizar la lógica en `app/api/premium/route.js` para reconocer el nuevo `plan` id.
3. Si hay cambios en permisos de BD, agregar columna en `public.usuarios.plan` check constraint.

### Añadir nuevos estacionamientos de demo

```sql
-- Ejecutar en Supabase SQL Editor
INSERT INTO public.estacionamientos (
  nombre, descripcion, direccion, comuna, region,
  lat, lng, capacidad_total, occupied_spots,
  precio_hora, activo, fotos
) VALUES (
  'Mi Parking',
  'Descripción del parking',
  'Calle 123, Ciudad',
  'Santiago',
  'Metropolitana',
  -33.4500, -70.6500,
  10, 3,
  2000, true,
  ARRAY['https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=800']
);
```

---

## 22. Decisiones de diseño documentadas

### Por qué BFF en lugar de microservicios

Los microservicios (`ms-mapas`, `ms-reservas`) requerían variables de entorno `NEXT_PUBLIC_MS_*_URL` con las URLs de despliegue. En Vercel, estas URLs eran distintas del localhost de desarrollo, causando que en producción los llamados fallaran silenciosamente. La solución fue mover toda la lógica a route handlers de Next.js dentro de `apps/web`, que siempre son del mismo origen y no requieren configuración de URL.

### Por qué comisión incluida en el precio (no cargo separado)

Investigación competitiva mostró que SpotHero y JustPark muestran el precio final incluyendo comisión, y nunca cobran suscripción para que conductores puedan reservar. Los usuarios perciben como engaño ver un precio y luego un "cargo de servicio" adicional. El modelo "precio todo incluido" con comisión visible en tooltip es más honesto y tiene mejor conversión.

### Por qué styled-jsx en lugar de Tailwind/CSS Modules

El proyecto comenzó con styled-jsx para facilitar la evaluación académica (todo el CSS del componente es visible junto al JSX en el mismo archivo). No hay dependencia de sistema de clases externo. Para un proyecto de producción a escala, considerar migrar a CSS Modules o Tailwind para mejor rendimiento.

### Por qué `detectarRegion` en el cliente y no en Supabase

La función de detección de región es puramente geométrica (rangos de lat/lng) y no requiere BD. Al ejecutarla en el cliente se evita un roundtrip de red. Si en el futuro se requiere precisión de polígonos reales (ej. límites administrativos exactos de Chile), mover a una RPC con PostGIS `ST_Contains`.

---

## 23. Deuda técnica y mejoras pendientes

### Alta prioridad

- [ ] **Rotar `SUPABASE_SERVICE_ROLE_KEY`** — ver sección 14.
- [ ] **Integrar Webpay (Transbank)** — actualmente el pago es simulado. Para producción real en Chile, integrar el SDK de Transbank.
- [ ] **Sistema de notificaciones push** — alertas de disponibilidad del plan Pro están UI-only; no hay lógica de backend que detecte cuándo una plaza favorita se libera.

### Media prioridad

- [ ] **Email transaccional** — confirmaciones de reserva, recordatorios, recibos. Usar Supabase Edge Functions + Resend o SendGrid.
- [ ] **Validación de patente** — el campo de patente en `vehiculos` no valida formato chileno (AA-BB-11).
- [ ] **Rate limiting en API** — los route handlers no tienen protección contra abuso. Agregar middleware de rate limiting (ej. Upstash Redis con `@upstash/ratelimit`).
- [ ] **Imágenes en producción** — el sistema acepta URLs de Unsplash para el seed pero en producción los usuarios subirán fotos a Supabase Storage. El componente de upload ya existe pero el manejo de errores de Storage necesita revisión.

### Baja prioridad

- [ ] **Internacionalización** — la app está en español chileno. Si se expande, usar `next-intl`.
- [ ] **Dark mode** — la UI no tiene soporte de dark mode. Los colores están hardcodeados en styled-jsx.
- [ ] **Migrar a CSS Modules** — styled-jsx no es el estándar de la industria. Una migración a CSS Modules mejoraría el developer experience.
- [ ] **E2E tests** — hay unit tests pero no hay tests de integración/E2E (Playwright/Cypress).
- [ ] **Storybook** — documentar componentes UI de forma aislada.

---

*Documento generado por el equipo de desarrollo de Parkings Together · Junio 2025*  
*Cualquier duda: revisar el historial de commits o el código fuente en la rama `claude/inspiring-rubin-WVJbv`.*
