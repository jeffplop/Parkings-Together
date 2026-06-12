import test from 'node:test';
import assert from 'node:assert';
import { api } from '../src/lib/api.js';

// ─── Mock de fetch ────────────────────────────────────────────────────────
// Intercepts same-origin BFF routes (/api/mapas/search, /api/reservas/reserve,
// /api/reservas/manage) so no real network calls are made.
global.fetch = async (url, options) => {
  const method   = options?.method || 'GET';
  const body     = options?.body ? JSON.parse(options.body) : {};

  // ── GET /api/mapas/search?userId=... ──────────────────────────────────
  if (url.includes('/api/mapas/search') && method === 'GET') {
    return { ok: true, json: async () => ({ success: true, data: [] }) };
  }

  // ── PATCH /api/mapas/search  (actualizar ocupación) ───────────────────
  if (url.includes('/api/mapas/search') && method === 'PATCH' && body.occupied_spots !== undefined) {
    if (body.occupied_spots > 10) {
      return { ok: true, json: async () => ({ success: false, error: 'Excede capacidad' }) };
    }
    return { ok: true, json: async () => ({ success: true, data: { id: body.id, occupied_spots: body.occupied_spots } }) };
  }

  // ── GET /api/reservas/reserve?parkingId=... ───────────────────────────
  if (url.includes('/api/reservas/reserve') && method === 'GET') {
    const isAvailable = !url.includes('full-parking-id');
    return { ok: true, json: async () => ({ success: true, available: isAvailable }) };
  }

  // ── POST /api/reservas/reserve ─────────────────────────────────────────
  if (url.includes('/api/reservas/reserve') && method === 'POST') {
    if (body.parking_id === 'error-saga') {
      return { ok: true, json: async () => ({ success: false, error: 'Fallo simulado en Saga de Reservas' }) };
    }
    return { ok: true, json: async () => ({ success: true, data: { id: 'res-123', estado: 'activa' } }) };
  }

  return { ok: false, json: async () => ({ success: false, error: 'Not Found' }) };
};

// ─── Tests ────────────────────────────────────────────────────────────────

test('BFF - Mapas: actualizar ocupación correctamente', async () => {
  const res = await api.mapas.actualizarOcupacion('park-1', 5);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.data.occupied_spots, 5);
});

test('BFF - Mapas: falla al exceder capacidad en PATCH', async () => {
  const res = await api.mapas.actualizarOcupacion('park-1', 15);
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.error, 'Excede capacidad');
});

test('BFF - Reservas: verificar disponibilidad (plaza libre)', async () => {
  const res = await api.reservas.verificarDisponibilidad('park-valid');
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.available, true);
});

test('BFF - Reservas: verificar disponibilidad (plaza llena)', async () => {
  const res = await api.reservas.verificarDisponibilidad('full-parking-id');
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.available, false);
});

test('BFF - Reservas: crear reserva con éxito', async () => {
  const res = await api.reservas.crearReserva({ parking_id: 'park-1', user_id: 'user-1' });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.data.estado, 'activa');
});

test('BFF - Reservas: maneja error si falla la creación', async () => {
  const res = await api.reservas.crearReserva({ parking_id: 'error-saga', user_id: 'user-1' });
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.error, 'Fallo simulado en Saga de Reservas');
});
