# API REST — Parkings Together (Swagger / OpenAPI)

Especificación de los endpoints de la plataforma. Cubre el **BFF** (rutas de mismo
origen consumidas por el frontend) y los **microservicios** independientes.

## Archivos

| Archivo | Descripción |
|---|---|
| [`openapi.yaml`](./openapi.yaml) | Especificación OpenAPI 3.0 (fuente de verdad). Incluye esquemas y ejemplos de petición/respuesta. |
| [`index.html`](./index.html) | Visor **Swagger UI** (carga `openapi.yaml`). Es "el link de la API": página para ver y probar los endpoints. |
| [`postman_collection.json`](./postman_collection.json) | Colección **Postman** lista para importar. |

## Endpoints documentados (29 operaciones)

| Área | Rutas |
|---|---|
| Autenticación | `POST /api/auth/signup` · `POST /api/v1/auth/login` · `POST /api/v1/auth/register` |
| Mapas | `GET/POST/PATCH/DELETE /api/mapas/search` · `GET/POST/DELETE /api/mapas/locks` |
| Reservas | `GET/POST /api/reservas/reserve` · `GET/PATCH /api/reservas/manage` |
| Reseñas | `GET /api/resenas` · `GET /api/resenas/resumen` (resumen IA) |
| Favoritos | `GET/POST/DELETE /api/favoritos` |
| Pagos y planes | `POST /api/pagos` · `GET/POST /api/premium` |
| Soporte | `POST /api/support/chat` (asistente IA) |
| Microservicios | `/api/v1/search` (ms-mapas) · `/api/v1/reserve` (ms-reservas) |

> La especificación incluye el servidor de **producción** (`https://parkings-web.vercel.app`)
> y el de **desarrollo** (`http://localhost:3000`); puedes elegir cuál usar desde el
> selector «Servers» de Swagger UI.

## Cómo ver el Swagger

**Opción A — Abrir el visor localmente**

```bash
# desde la raíz del repo
npx http-server docs/api -p 8088
# luego abrir http://localhost:8088/  (index.html carga openapi.yaml)
```

> Abrir `index.html` con doble clic puede fallar por CORS al leer el `.yaml`;
> por eso se recomienda servirlo con un servidor estático como arriba.

**Opción B — Swagger Editor online**

Pegar el contenido de `openapi.yaml` en <https://editor.swagger.io>.

**Opción C — Postman**

Importar `postman_collection.json`, definir las variables de entorno
(`{{bff}}`, `{{auth}}`, `{{mapas}}`, `{{reservas}}`, `{{token}}`) y ejecutar.

## Puertos de los servicios (desarrollo)

| Servicio | App | Puerto | Base |
|---|---|---|---|
| Frontend / BFF | `apps/web` | 3000 | `/api/mapas`, `/api/reservas` |
| Autenticación | `apps/auth` | 3001 | `/api/v1/auth` |
| Estacionamientos | `apps/ms-mapas` | 3002 | `/api/v1/search` |
| Reservas | `apps/ms-reservas` | 3003 | `/api/v1/reserve` |

## Autenticación

Las operaciones de escritura requieren `Authorization: Bearer <access_token>`.
El token JWT se obtiene en `POST /api/v1/auth/login` y las políticas RLS de
PostgreSQL lo usan para evaluar `auth.uid()`.
