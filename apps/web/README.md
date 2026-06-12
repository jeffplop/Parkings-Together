# apps/web — Frontend PWA + BFF (Backend For Frontend)

Aplicación Next.js 14 que actúa simultáneamente como:
- **Frontend PWA** (Progressive Web App) para conductores y arrendadores de estacionamientos.
- **BFF (Backend For Frontend)** que orquesta las llamadas a los microservicios y Supabase, centralizando autenticación, transformación de datos y manejo de errores.

---

## Stack Tecnológico

| Tecnología       | Propósito                                      |
|------------------|------------------------------------------------|
| Next.js 14       | Framework React con App Router + API Routes    |
| React 18         | UI reactiva con hooks                          |
| Supabase JS      | Auth client-side + Realtime (WebSockets)       |
| Leaflet.js       | Mapas interactivos con marcadores              |
| TailwindCSS      | Estilos utilitarios                            |
| @parkings/supabase-db | Cliente compartido de Supabase (Singleton) |

---

## API Routes (BFF)

Todas las rutas son de mismo origen (`/api/...`), lo que elimina problemas de CORS en producción (Vercel).

| Método(s)              | Ruta                         | Descripción                                                    |
|------------------------|------------------------------|----------------------------------------------------------------|
| GET, POST, PATCH, DELETE | `/api/mapas/search`        | Proxy + orquestación hacia microservicio ms-mapas              |
| GET                    | `/api/mapas/locks`           | Gestión de bloqueos temporales de plazas                       |
| GET, POST              | `/api/reservas/reserve`      | Crear reserva (Saga) / verificar disponibilidad                |
| GET, PATCH             | `/api/reservas/manage`       | Listar, confirmar, cancelar, completar, calificar reservas     |
| POST                   | `/api/pagos`                 | Procesamiento de pagos (mock / efectivo / webpay)              |
| GET, POST, DELETE      | `/api/favoritos`             | Gestión de estacionamientos favoritos del usuario              |
| POST                   | `/api/auth/signup`           | Registro de nuevos usuarios                                    |

---

## Patrones de Diseño Implementados

1. **BFF (Backend For Frontend):** Las API Routes actúan como capa de orquestación entre el frontend y los microservicios. Ver `app/api/`.
2. **Facade:** `src/lib/api.js` expone un objeto `api` unificado con namespaces `mapas`, `reservas` y `favoritos`. Incluye `AbortController` con timeout de 4 segundos.
3. **Strategy:** `src/lib/payments.js` implementa tres proveedores de pago intercambiables (`mock`, `efectivo`, `webpay`) con la misma interfaz de retorno.
4. **Observer:** `src/components/Navbar.js` usa Supabase Realtime para actualizar el contador de reservas pendientes en tiempo real mediante suscripciones a cambios en PostgreSQL.

---

## Estructura de Carpetas

```
apps/web/
├── app/
│   ├── api/                  ← BFF: API Routes de Next.js
│   │   ├── mapas/
│   │   ├── reservas/
│   │   ├── pagos/
│   │   ├── favoritos/
│   │   └── auth/
│   ├── mapa/                 ← Página del mapa interactivo
│   ├── dashboard/            ← Panel del arrendador
│   └── ...
├── src/
│   ├── components/           ← Componentes React reutilizables
│   │   ├── Navbar.js         ← Observer Pattern (Supabase Realtime)
│   │   └── ...
│   └── lib/
│       ├── api.js            ← Facade Pattern
│       └── payments.js       ← Strategy Pattern
└── tests/                    ← 62 tests unitarios
```

---

## Variables de Entorno

Crear un archivo `.env.local` en `apps/web/` con:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key

# Microservicios (opcionales — el BFF usa same-origin en producción)
NEXT_PUBLIC_MS_MAPAS_URL=http://localhost:3002
NEXT_PUBLIC_MS_RESERVAS_URL=http://localhost:3003
NEXT_PUBLIC_AUTH_URL=http://localhost:3001

# Webpay (opcional — sin estas vars, usa modo simulado)
TRANSBANK_COMMERCE_CODE=tu-commerce-code
TRANSBANK_API_KEY=tu-api-key
TRANSBANK_ENV=integration
```

---

## Instalación y Ejecución

```bash
# Desde la raíz del monorepo
npm install

# Solo apps/web
cd apps/web
npm install
npm run dev
# → http://localhost:3000
```

---

## Tests Unitarios

```bash
cd apps/web
npm test
```

**62 tests** organizados en:

| Archivo de test              | Qué prueba                                    | Tests |
|------------------------------|-----------------------------------------------|-------|
| `tests/pricing.test.js`      | Cálculo de precios dinámicos y tarifas        | ~15   |
| `tests/payments.test.js`     | Strategy Pattern — los 3 proveedores de pago  | ~20   |
| `tests/geocoding.test.js`    | Geocodificación y búsqueda por coordenadas    | ~12   |
| `tests/api.test.js`          | Facade API — manejo de errores y timeouts     | ~15   |

---

## Despliegue

- **Plataforma:** Vercel (CI/CD automático desde la rama `master`)
- **URL producción:** https://parkings-web.vercel.app
- Cada merge a `master` desencadena un despliegue automático.
