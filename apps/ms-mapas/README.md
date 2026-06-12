# apps/ms-mapas — Microservicio de Mapas

Microservicio Next.js responsable de la gestión y búsqueda de estacionamientos. Implementa el patrón arquitectural **MVC (Model-View-Controller) + Repository**, con separación clara entre la capa HTTP, la lógica de negocio y el acceso a datos.

---

## Patrón Arquitectural: MVC + Repository

### Capas de la Arquitectura

```
Request HTTP (GET/POST/PATCH/DELETE /api/v1/search)
          ↓
    route.js (Entry point — delega al Controller)
          ↓
    MapController (Validación HTTP, manejo de errores, respuesta)
          ↓
    MapService (Lógica de negocio, transformaciones)
          ↓
    MapRepository (Acceso a datos Supabase)
          ↓
    PostgreSQL via Supabase (tabla: estacionamientos)
```

### Principio de Responsabilidad Única

| Capa           | Archivo                                  | Responsabilidad                                    |
|----------------|------------------------------------------|----------------------------------------------------|
| Controller     | `src/controllers/map.controller.js`      | Parsear request, validar inputs, construir response HTTP |
| Service        | `src/services/map.service.js`            | Lógica de negocio, transformación de datos         |
| Repository     | `src/repositories/map.repository.js`     | Queries a Supabase, encapsulamiento de persistencia |

### Ejemplo — Controller

```js
// apps/ms-mapas/src/controllers/map.controller.js
export const MapController = {
  async create(request) {
    try {
      const body = await request.json();
      if (!body.nombre || !body.lat || !body.lng || !body.userId) {
        return NextResponse.json(
          { success: false, error: 'Faltan campos obligatorios.' },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      const data = await MapService.createEstacionamiento(body);
      return NextResponse.json({ success: true, data }, { status: 201, headers: CORS_HEADERS });
    } catch (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
  }
};
```

### Ejemplo — Repository

```js
// apps/ms-mapas/src/repositories/map.repository.js
export const MapRepository = {
  async getEstacionamientos(userId) {
    let query = supabase.from('estacionamientos').select('*');
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query;
    if (error) throw new Error(`Error BD: ${error.message}`);
    return data;
  }
};
```

---

## Endpoints

### `GET /api/v1/search` — Listar estacionamientos

**Query params opcionales:**
- `userId` — filtrar por propietario
- `q` — búsqueda por texto
- `comuna` — filtrar por comuna
- `pmr` — solo plazas para personas con movilidad reducida (`true/false`)
- `disponible` — solo estacionamientos con plazas disponibles
- `precioMax` — precio máximo por hora
- `lat`, `lng`, `radius` — búsqueda geoespacial

**Respuesta (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "nombre": "Estacionamiento Centro",
      "lat": -33.4569,
      "lng": -70.6483,
      "total_spots": 10,
      "occupied_spots": 3,
      "precio_por_hora": 1500
    }
  ]
}
```

### `POST /api/v1/search` — Crear estacionamiento

**Body:**
```json
{
  "nombre": "Mi Estacionamiento",
  "lat": -33.4569,
  "lng": -70.6483,
  "userId": "uuid-del-propietario",
  "total_spots": 5,
  "precio_por_hora": 2000,
  "descripcion": "Cerca del metro"
}
```

### `PATCH /api/v1/search` — Actualizar ocupación

**Body:**
```json
{
  "id": "uuid-del-estacionamiento",
  "occupied_spots": 4
}
```

### `DELETE /api/v1/search` — Eliminar estacionamientos

**Body:**
```json
{
  "ids": ["uuid1", "uuid2"]
}
```

---

## Instalación y Ejecución

```bash
cd apps/ms-mapas
npm install
npm run dev
# → http://localhost:3002
```

### Variables de entorno

Crear `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
NEXT_PUBLIC_WEB_URL=http://localhost:3000
PORT=3002
```

---

## Estructura de Carpetas

```
apps/ms-mapas/
├── app/
│   └── api/v1/search/
│       └── route.js          ← Entry point HTTP
└── src/
    ├── controllers/
    │   └── map.controller.js ← Validación + respuesta HTTP
    ├── services/
    │   └── map.service.js    ← Lógica de negocio
    └── repositories/
        └── map.repository.js ← Acceso a Supabase
```
