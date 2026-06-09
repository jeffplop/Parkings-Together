# Documentación de la API REST (Swagger / OpenAPI)

Cada servicio de **Parkings Together** documenta su API REST con un contrato
**OpenAPI 3.0** y una interfaz interactiva **Swagger UI**. Desde Swagger se
pueden **probar los endpoints en vivo** (botón *Try it out*), ya que el `servers:`
de cada contrato apunta a la URL real desplegada.

---

## Accesos directos

| Servicio | Despliegue | Swagger UI | Contrato OpenAPI |
|---|---|---|---|
| **BFF** (apps/web) | Vercel | https://parkings-web.vercel.app/api-docs.html | `/openapi.yaml` |
| **auth** | Render | https://ms-auth-n0pd.onrender.com/api-docs.html | `/openapi.yaml` |
| **ms-mapas** | Render | https://api-mapas-chile.onrender.com/api-docs.html | `/openapi.yaml` |
| **ms-reservas** | Render | https://ms-reservas-m6nq.onrender.com/api-docs.html | `/openapi.yaml` |

> Los contratos viven en el repo en `apps/<servicio>/public/openapi.yaml` y se
> sirven como archivos estáticos junto a la página `api-docs.html`.

---

## Endpoints documentados

| Servicio | Endpoints |
|---|---|
| **auth** | `POST /api/v1/auth/register` · `POST /api/v1/auth/login` |
| **ms-mapas** | `GET/POST/PATCH/DELETE /api/v1/search` |
| **ms-reservas** | `GET /api/v1/reserve` · `POST /api/v1/reserve` |
| **BFF** | `auth/signup`, `mapas/search`, `mapas/locks`, `reservas/reserve`, `reservas/manage`, `favoritos`, `pagos`, `premium`, `reseñas`, `support/chat` |

---

## Cómo probar un endpoint (Try it out)

1. Abre la Swagger UI del servicio.
2. Pulsa **Try it out** en el endpoint, completa los parámetros y **Execute**.
3. Verás la URL real (`curl`), el código de estado y la respuesta del servicio.

### Endpoints que requieren autenticación (JWT)

Muchos endpoints del **BFF** requieren `Authorization: Bearer <token>`. Para
obtener un token:

1. En la Swagger del **auth**, ejecuta `POST /api/v1/auth/login` con un email y
   contraseña válidos y copia el `session.access_token` de la respuesta.
2. En la Swagger del **BFF**, pulsa el botón **Authorize** (candado), pega el
   token y autoriza. A partir de ahí, *Try it out* enviará el Bearer
   automáticamente.

---

## ⚠️ Render (plan gratuito): cold start

Los microservicios (`auth`, `ms-mapas`, `ms-reservas`) corren en el plan free de
Render: tras ~15 min de inactividad se suspenden y la **primera** petición tarda
~30–60 s en responder. **Recomendación:** abre las 3 URLs unos minutos antes de
una demo o defensa para "despertar" los servicios.

---

## Ejecución local

Cada servicio sirve su Swagger en su puerto de desarrollo:

| Servicio | URL local |
|---|---|
| BFF (apps/web) | http://localhost:3000/api-docs.html |
| auth | http://localhost:3001/api-docs.html |
| ms-mapas | http://localhost:3002/api-docs.html |
| ms-reservas | http://localhost:3003/api-docs.html |

```bash
npm run dev   # levanta todo el monorepo (Turborepo)
```

> El contrato OpenAPI también puede importarse en **Swagger Editor**
> (https://editor.swagger.io) o **Postman** pegando el contenido de
> `apps/<servicio>/public/openapi.yaml`.
