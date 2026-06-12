# apps/ms-reservas — Microservicio de Reservas

Microservicio Next.js responsable de la creación y verificación de reservas de estacionamiento. Implementa el patrón **Saga con transacciones compensatorias** para garantizar la consistencia de datos en operaciones distribuidas, y aplica principios de **CQRS** (Command Query Responsibility Segregation) para separar lecturas de escrituras.

---

## Patrón Arquitectural: DDD + Saga + CQRS

### ¿Por qué Saga?

Una reserva exitosa requiere dos operaciones atómicas sobre dos entidades distintas:
1. Insertar un registro en la tabla `reservas`.
2. Incrementar `occupied_spots` en la tabla `estacionamientos`.

Si la segunda operación falla, la primera debe revertirse. Sin Saga, el sistema quedaría en estado inconsistente (reserva creada pero sin actualización de ocupación).

### Flujo de la Saga

```
processSaga(payload)
    │
    ├── [Query CQRS] getParkingAvailability(parking_id)
    │       ↓
    │   ¿occupied_spots >= total_spots?
    │       ├── SÍ → throw Error("Estacionamiento lleno")
    │       └── NO → continúa
    │
    ├── [Command] createReserve(reservaData)
    │       ↓
    │   Reserva creada en BD
    │
    └── [Command + Compensación] updateParkingOccupancy(parking_id, spots+1)
            ├── ÉXITO → retorna reserva
            └── FALLO → deleteReserve(reserva.id) → throw Error("Saga compensada")
```

### Implementación

```js
// apps/ms-reservas/app/api/v1/reserve/services/reserva.service.js
export const ReserveService = {
  async processSaga(payload) {
    const { parking_id, user_id, start_time } = payload;

    // 1. Query CQRS — solo lectura para verificar disponibilidad
    const parking = await ReserveRepository.getParkingAvailability(parking_id);
    if (parking.occupied_spots >= parking.total_spots) {
      throw new Error('El estacionamiento ya está lleno. Transacción rechazada.');
    }

    // 2. Command — escritura: crear la reserva
    const reserva = await ReserveRepository.createReserve({
      estacionamiento_id: parking_id,
      conductor_id: user_id,
      estado: 'activa',
      created_at: start_time || new Date().toISOString()
    });

    // 3. Compensación Saga: si updateOccupancy falla, se revierte la reserva
    try {
      await ReserveRepository.updateParkingOccupancy(parking_id, parking.occupied_spots + 1);
    } catch (error) {
      await ReserveRepository.deleteReserve(reserva.id); // Rollback
      throw new Error('Fallo al actualizar ocupación. Reserva revertida (Saga Compensada).');
    }

    return reserva;
  }
};
```

---

## Capas de la Arquitectura

```
Request HTTP POST /api/v1/reserve
          ↓
    route.js (Entry point — Next.js API Route)
          ↓
    ReserveService.processSaga() (Lógica de negocio + Saga)
          ↓
    ReserveRepository (Acceso a datos Supabase)
          ↓
    PostgreSQL via Supabase
```

| Archivo                                                  | Responsabilidad                              |
|----------------------------------------------------------|----------------------------------------------|
| `app/api/v1/reserve/route.js`                            | Entry point HTTP, parseo de request          |
| `app/api/v1/reserve/services/reserva.service.js`         | Saga orchestration, lógica de negocio, CQRS  |
| `app/api/v1/reserve/repositories/reserva.repository.js`  | Acceso a Supabase, queries SQL               |

---

## Endpoints

### `POST /api/v1/reserve` — Crear reserva

**Body:**
```json
{
  "parking_id": "uuid-del-estacionamiento",
  "user_id": "uuid-del-conductor",
  "start_time": "2026-06-04T14:00:00Z",
  "duration_hours": 2
}
```

**Respuesta exitosa (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-de-la-reserva",
    "estacionamiento_id": "uuid-del-estacionamiento",
    "conductor_id": "uuid-del-conductor",
    "estado": "activa",
    "created_at": "2026-06-04T14:00:00Z"
  }
}
```

**Respuesta de error — estacionamiento lleno (400):**
```json
{
  "success": false,
  "error": "El estacionamiento ya está lleno. Transacción rechazada."
}
```

### `GET /api/v1/reserve?parkingId=<uuid>` — Verificar disponibilidad

**Respuesta:**
```json
{
  "success": true,
  "available": true,
  "spots_left": 3,
  "data": { "occupied_spots": 2, "total_spots": 5 }
}
```

---

## Instalación y Ejecución

```bash
cd apps/ms-reservas
npm install
npm run dev
# → http://localhost:3003
```

### Variables de entorno

Crear `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
PORT=3003
```

---

## Tests Unitarios

```bash
cd apps/ms-reservas
npm test
```

**2 tests** en `tests/reserveService.test.js`:

| Test                                            | Descripción                                              |
|-------------------------------------------------|----------------------------------------------------------|
| `Saga compensation on occupancy update failure` | Verifica que si `updateParkingOccupancy` falla, la reserva se elimina automáticamente. |
| `Rejects reservation when parking is full`      | Verifica que si `occupied_spots >= total_spots`, se lanza error y no se crea reserva. |

### Ejemplo de test

```js
it('should compensate and delete reservation if occupancy update fails', async () => {
  ReserveRepository.getParkingAvailability.mockResolvedValue({
    occupied_spots: 1, total_spots: 5
  });
  ReserveRepository.createReserve.mockResolvedValue({ id: 'reserva-123' });
  ReserveRepository.updateParkingOccupancy.mockRejectedValue(new Error('DB error'));
  ReserveRepository.deleteReserve.mockResolvedValue(true);

  await expect(ReserveService.processSaga(payload)).rejects.toThrow('Saga Compensada');
  expect(ReserveRepository.deleteReserve).toHaveBeenCalledWith('reserva-123');
});
```
