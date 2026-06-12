# Parkings Together

**Plataforma de Optimización de Movilidad Urbana y Gestión Inteligente de Estacionamientos**

Sistema peer-to-peer que conecta conductores con propietarios de estacionamientos mediante geolocalización en tiempo real. Los conductores encuentran plazas disponibles, hacen reservas y pagan desde la app. Los arrendadores gestionan sus espacios y reciben reservas al instante.

---

## Estructura del Monorepo (Turborepo)

```
Parkings-Together/
├── apps/
│   ├── web/           ← Next.js 14 — Frontend PWA + BFF
│   ├── ms-mapas/      ← Microservicio de mapas (puerto 3002)
│   ├── ms-reservas/   ← Microservicio de reservas (puerto 3003)
│   └── auth/          ← Microservicio de autenticación (puerto 3001)
└── packages/
    └── supabase-db/   ← Paquete compartido: cliente Supabase (Singleton)
```

---

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTE (Browser)                         │
│              PWA Next.js — Leaflet Map — Supabase Auth          │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP (same-origin)
┌──────────────────────────▼──────────────────────────────────────┐
│                    BFF — apps/web/app/api/                       │
│   /api/mapas    /api/reservas    /api/pagos    /api/favoritos    │
│                  (JWT injection + orchestration)                  │
└──────┬──────────────────┬──────────────────────┬────────────────┘
       │                  │                      │
┌──────▼──────┐  ┌────────▼────────┐  ┌──────────▼──────────────┐
│  ms-mapas   │  │  ms-reservas    │  │        auth              │
│  port:3002  │  │   port:3003     │  │      port:3001           │
│ MVC+Repo    │  │  Saga+CQRS+Repo │  │   MVC+Repository         │
└──────┬──────┘  └────────┬────────┘  └──────────┬──────────────┘
       │                  │                       │
       └──────────────────┴───────────────────────┘
                          │
              ┌───────────▼───────────┐
              │  Supabase (PostgreSQL) │
              │  PostGIS + Realtime    │
              └───────────────────────┘
```

---

## Patrones de Diseño Implementados

| Patrón            | Categoría    | Ubicación                                          |
|-------------------|--------------|-----------------------------------------------------|
| Repository        | Arquitectural | `apps/*/repositories/*.repository.js`              |
| Service Layer     | Arquitectural | `apps/*/services/*.service.js`                     |
| Controller (MVC)  | Arquitectural | `apps/ms-mapas/src/controllers/`, `apps/auth/src/` |
| Saga + CQRS       | Comportamental | `apps/ms-reservas/.../services/reserva.service.js` |
| Observer          | Comportamental | `apps/web/src/components/Navbar.js`                |
| Strategy          | Comportamental | `apps/web/src/lib/payments.js`                     |
| Singleton         | Creacional    | `packages/supabase-db/index.js`                    |
| Facade            | Estructural   | `apps/web/src/lib/api.js`                          |
| BFF               | Arquitectural | `apps/web/app/api/`                                |

Ver documentación completa: [`docs/PATRONES_DISEÑO.md`](docs/PATRONES_DISEÑO.md)

---

## Características Principales

- **Semaforo de Ocupación en Tiempo Real:** Verde/Amarillo/Rojo impulsado por Supabase Realtime (WebSockets).
- **Reservas con Saga:** Transacciones compensatorias para garantizar consistencia entre reservas y ocupación.
- **Pagos Multi-Proveedor:** Mock (desarrollo), Efectivo y Webpay (Transbank) mediante Strategy Pattern.
- **Mapa Interactivo:** Leaflet.js con marcadores geolocalizados y filtros avanzados.
- **Modelo P2P:** Conductores y arrendadores con roles y dashboards independientes.
- **Autenticación Centralizada:** JWT con Supabase Auth y RLS (Row Level Security) en PostgreSQL.

---

## Instalación y Configuración

### Prerequisitos
- Node.js 18+
- npm 9+

### Instalación

```bash
git clone https://github.com/jeffplop/Parkings-Together.git
cd Parkings-Together
npm install
```

### Variables de Entorno

Cada app requiere su propio `.env.local`. Plantilla base para todas:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
```

### Ejecutar todo el monorepo

```bash
# Todos los servicios en paralelo (Turborepo)
npm run dev
```

### Ejecutar servicios individuales

```bash
# Frontend + BFF (puerto 3000)
cd apps/web && npm run dev

# Microservicio de mapas (puerto 3002)
cd apps/ms-mapas && npm run dev

# Microservicio de reservas (puerto 3003)
cd apps/ms-reservas && npm run dev

# Microservicio de autenticación (puerto 3001)
cd apps/auth && npm run dev
```

---

## Tests

```bash
# Tests del BFF/frontend (62 tests)
cd apps/web && npm test

# Tests del microservicio de reservas (Saga/CQRS)
cd apps/ms-reservas && npm test
```

---

## Stack Tecnológico

| Tecnología     | Uso                                                  |
|----------------|------------------------------------------------------|
| Next.js 14     | Frontend PWA + BFF (API Routes)                      |
| React 18       | UI reactiva con hooks                                |
| Supabase       | PostgreSQL + Auth + Realtime (WebSockets) + PostGIS  |
| Leaflet.js     | Mapas interactivos con geolocalización               |
| TailwindCSS    | Estilos utilitarios                                  |
| Turborepo      | Gestión del monorepo con caché de builds             |
| Vercel         | Despliegue + CI/CD automático                        |
| Jest           | Framework de tests unitarios                         |

---

## Despliegue

- **URL producción:** https://parkings-web.vercel.app
- **Plataforma:** Vercel (deploy automático desde `master`)
- **Base de datos:** Supabase (PostgreSQL 17 con PostGIS)
- **CI/CD:** GitHub Actions + Vercel webhooks

---

## READMEs por Componente

- [`apps/web/README.md`](apps/web/README.md) — Frontend PWA + BFF
- [`apps/ms-mapas/README.md`](apps/ms-mapas/README.md) — Microservicio de Mapas
- [`apps/ms-reservas/README.md`](apps/ms-reservas/README.md) — Microservicio de Reservas
- [`apps/auth/README.md`](apps/auth/README.md) — Microservicio de Autenticación

## Documentación Técnica

- [`docs/PATRONES_DISEÑO.md`](docs/PATRONES_DISEÑO.md) — Patrones de diseño implementados
- [`docs/ESTRATEGIA_BRANCHING.md`](docs/ESTRATEGIA_BRANCHING.md) — Estrategia de branching y flujo de trabajo
- [`repositorios.txt`](repositorios.txt) — URLs de todos los componentes
- [`docs/TECHNICAL_DOCUMENTATION.md`](docs/TECHNICAL_DOCUMENTATION.md) — Documentación técnica detallada
- [`docs/UNIT_TESTS.md`](docs/UNIT_TESTS.md) — Documentación de tests unitarios

---

## Branching

- **Rama de producción:** `master`
- **Rama de desarrollo:** `claude/inspiring-rubin-WVJbv`
- **PRs:** 13+ pull requests documentados
- Ver: [`docs/ESTRATEGIA_BRANCHING.md`](docs/ESTRATEGIA_BRANCHING.md)
