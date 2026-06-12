import test from 'node:test';
import assert from 'node:assert';
import { api } from '../src/lib/api.js';

// Mock global fetch para simular las respuestas del BFF sin llamar a la red real.
// El BFF consulta route handlers de MISMO ORIGEN (/api/mapas, /api/reservas), que
// internamente delegan en Supabase; aquí simulamos esa frontera HTTP. Cada respuesta
// incluye `ok: true` porque fetchWithTimeout() evalúa response.ok antes del cuerpo.
global.fetch = async (url, options) => {
  const method = options?.method || 'GET';

  // Mock BFF → Mapas (route handler /api/mapas/search)
  if (url.includes('/api/mapas/search')) {
    if (method === 'PATCH') {
      const body = JSON.parse(options.body);
      if (body.occupied_spots > 10) {
        return { ok: true, json: async () => ({ success: false, error: 'Excede capacidad' }) };
      }
      return { ok: true, json: async () => ({ success: true, data: { id: body.id, occupied_spots: body.occupied_spots } }) };
    }
  }

  // Mock BFF → Reservas (route handler /api/reservas/reserve, flujo Saga)
  if (url.includes('/api/reservas/reserve')) {
    if (method === 'GET') {
      // Simular verificación de disponibilidad
      const isAvailable = !url.includes('full-parking-id');
      return { ok: true, json: async () => ({ success: true, available: isAvailable }) };
    }

    if (method === 'POST') {
      const body = JSON.parse(options.body);
      if (body.parking_id === 'error-saga') {
        return { ok: true, json: async () => ({ success: false, error: 'Fallo simulado en Saga de Reservas' }) };
      }
      return { ok: true, json: async () => ({ success: true, data: { id: 'res-123', estado: 'activa' } }) };
    }
  }

  return { ok: false, status: 404, json: async () => ({ success: false, error: 'Not Found' }) };
};

test('BFF - Mapas: Debería actualizar ocupación correctamente', async (t) => {
  const res = await api.mapas.actualizarOcupacion('park-1', 5);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.data.occupied_spots, 5);
});

test('BFF - Mapas: Debería fallar al exceder capacidad en PATCH', async (t) => {
  const res = await api.mapas.actualizarOcupacion('park-1', 15);
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.error, 'Excede capacidad');
});

test('BFF - Reservas (Saga): Debería verificar disponibilidad', async (t) => {
  const res = await api.reservas.verificarDisponibilidad('park-valid');
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.available, true);
});

test('BFF - Reservas (Saga): Debería rechazar si está lleno', async (t) => {
  const res = await api.reservas.verificarDisponibilidad('full-parking-id');
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.available, false);
});

test('BFF - Reservas (Saga): Debería crear reserva con éxito', async (t) => {
  const res = await api.reservas.crearReserva({ parking_id: 'park-1', user_id: 'user-1' });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.data.estado, 'activa');
});

test('BFF - Reservas (Saga): Debería manejar el error si la Saga falla', async (t) => {
  const res = await api.reservas.crearReserva({ parking_id: 'error-saga', user_id: 'user-1' });
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.error, 'Fallo simulado en Saga de Reservas');
});
