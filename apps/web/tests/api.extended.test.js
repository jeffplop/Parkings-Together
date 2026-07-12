// Tests extendidos para apps/web/src/lib/api.js
// Cubre: fetchWithTimeout (timeout, error HTTP, sin JSON), y todos los métodos
// del facade: mapas.*, reservas.*, favoritos.*, premium.*

jest.mock('@parkings/supabase-db', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}));

import { api } from '../src/lib/api.js';
import { supabase } from '@parkings/supabase-db';

const OK = (body) => ({
  ok: true,
  status: 200,
  json: jest.fn().mockResolvedValue(body),
});

const ERR = (status, body) => ({
  ok: false,
  status,
  json: jest.fn().mockResolvedValue(body),
});

beforeEach(() => {
  global.fetch = jest.fn();
  jest.useFakeTimers();
  supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
});

afterEach(() => {
  jest.runAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

// ─── fetchWithTimeout — timeout ───────────────────────────────────────────
describe('fetchWithTimeout — timeout y errores de red', () => {
  test('devuelve fallback cuando fetch tarda más del timeout', async () => {
    global.fetch.mockImplementation(
      (_url, opts) =>
        new Promise((_, reject) => {
          opts.signal.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        })
    );
    const promise = api.mapas.getMisEstacionamientos('user-1');
    jest.runAllTimers();
    const res = await promise;
    expect(res.success).toBe(false);
    expect(res.fallback).toBe(true);
  });

  test('devuelve error estructurado ante respuesta HTTP no-ok con payload', async () => {
    global.fetch.mockResolvedValue(ERR(404, { error: 'No encontrado' }));
    const res = await api.mapas.getMisEstacionamientos('u1');
    expect(res.success).toBe(false);
    expect(res.error).toBe('No encontrado');
  });

  test('devuelve error genérico cuando la respuesta no-ok no tiene error en el cuerpo', async () => {
    global.fetch.mockResolvedValue(ERR(500, {}));
    const res = await api.mapas.getMisEstacionamientos('u1');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/HTTP Error: 500/);
  });

  test('devuelve fallback cuando fetch lanza una excepción de red', async () => {
    global.fetch.mockRejectedValue(new Error('Network error'));
    const res = await api.mapas.getMisEstacionamientos('u1');
    expect(res.success).toBe(false);
    expect(res.fallback).toBe(true);
  });
});

// ─── mapas.getMisEstacionamientos ─────────────────────────────────────────
describe('mapas.getMisEstacionamientos', () => {
  test('llama a /api/mapas/search con userId en query string', async () => {
    global.fetch.mockResolvedValue(OK({ success: true, data: [{ id: 1 }] }));
    const res = await api.mapas.getMisEstacionamientos('user-abc');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('userId=user-abc'),
      expect.any(Object)
    );
    expect(res.success).toBe(true);
  });
});

// ─── mapas.buscar ─────────────────────────────────────────────────────────
describe('mapas.buscar', () => {
  test('sin filtros llama a /api/mapas/search sin query string relevante', async () => {
    global.fetch.mockResolvedValue(OK({ success: true, data: [] }));
    await api.mapas.buscar();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/mapas/search'),
      expect.any(Object)
    );
  });

  test('con filtros construye query string correcto', async () => {
    global.fetch.mockResolvedValue(OK({ success: true, data: [] }));
    await api.mapas.buscar({ comuna: 'Santiago', precioMax: 2000 });
    const url = global.fetch.mock.calls[0][0];
    expect(url).toContain('comuna=Santiago');
    expect(url).toContain('precioMax=2000');
  });

  test('filtra valores undefined y null del query string', async () => {
    global.fetch.mockResolvedValue(OK({ success: true, data: [] }));
    await api.mapas.buscar({ comuna: 'Santiago', lat: null, lng: undefined });
    const url = global.fetch.mock.calls[0][0];
    expect(url).toContain('comuna=Santiago');
    expect(url).not.toContain('lat=');
    expect(url).not.toContain('lng=');
  });
});

// ─── mapas.crearEstacionamiento ───────────────────────────────────────────
describe('mapas.crearEstacionamiento', () => {
  test('realiza POST a /api/mapas/search con el cuerpo correcto', async () => {
    global.fetch.mockResolvedValue(OK({ success: true, data: { id: 5 } }));
    const data = { nombre: 'Parking A', lat: -33.4, lng: -70.6, userId: 'u1' };
    const res = await api.mapas.crearEstacionamiento(data);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/mapas/search'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify(data) })
    );
    expect(res.success).toBe(true);
  });
});

// ─── mapas.eliminarEstacionamientos ───────────────────────────────────────
describe('mapas.eliminarEstacionamientos', () => {
  test('realiza DELETE con array de ids', async () => {
    global.fetch.mockResolvedValue(OK({ success: true, deleted: 2 }));
    await api.mapas.eliminarEstacionamientos([1, 2]);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: 'DELETE', body: JSON.stringify({ ids: [1, 2] }) })
    );
  });
});

// ─── mapas.actualizarEstacionamiento ──────────────────────────────────────
describe('mapas.actualizarEstacionamiento', () => {
  test('realiza PATCH con action updateFull', async () => {
    global.fetch.mockResolvedValue(OK({ success: true }));
    await api.mapas.actualizarEstacionamiento(3, { nombre: 'Nuevo nombre' });
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.action).toBe('updateFull');
    expect(body.id).toBe(3);
    expect(body.nombre).toBe('Nuevo nombre');
  });
});

// ─── mapas.toggleActivar ──────────────────────────────────────────────────
describe('mapas.toggleActivar', () => {
  test('realiza PATCH con action toggleActivo', async () => {
    global.fetch.mockResolvedValue(OK({ success: true }));
    await api.mapas.toggleActivar(7);
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.action).toBe('toggleActivo');
    expect(body.id).toBe(7);
  });
});

// ─── reservas.listar ──────────────────────────────────────────────────────
describe('reservas.listar', () => {
  test('llama a /api/reservas/manage con scope=conductor por defecto', async () => {
    global.fetch.mockResolvedValue(OK({ success: true, data: [] }));
    await api.reservas.listar();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('scope=conductor'),
      expect.any(Object)
    );
  });

  test('permite scope=arrendador', async () => {
    global.fetch.mockResolvedValue(OK({ success: true, data: [] }));
    await api.reservas.listar('arrendador');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('scope=arrendador'),
      expect.any(Object)
    );
  });
});

// ─── reservas.confirmar ───────────────────────────────────────────────────
describe('reservas.confirmar', () => {
  test('realiza PATCH con action confirmar', async () => {
    global.fetch.mockResolvedValue(OK({ success: true }));
    await api.reservas.confirmar('res-uuid-001');
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.action).toBe('confirmar');
    expect(body.reserva_id).toBe('res-uuid-001');
  });
});

// ─── reservas.cancelar ────────────────────────────────────────────────────
describe('reservas.cancelar', () => {
  test('realiza PATCH con action cancelar', async () => {
    global.fetch.mockResolvedValue(OK({ success: true }));
    await api.reservas.cancelar('res-uuid-002');
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.action).toBe('cancelar');
    expect(body.reserva_id).toBe('res-uuid-002');
  });
});

// ─── reservas.reprogramar ─────────────────────────────────────────────────
describe('reservas.reprogramar', () => {
  test('realiza PATCH con action reprogramar e incluye fechas', async () => {
    global.fetch.mockResolvedValue(OK({ success: true }));
    const inicio = '2026-07-01T10:00:00Z';
    const fin    = '2026-07-01T12:00:00Z';
    await api.reservas.reprogramar('res-uuid-003', inicio, fin);
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.action).toBe('reprogramar');
    expect(body.fecha_inicio).toBe(inicio);
    expect(body.fecha_fin).toBe(fin);
  });
});

// ─── reservas.completar ───────────────────────────────────────────────────
describe('reservas.completar', () => {
  test('realiza PATCH con action completar', async () => {
    global.fetch.mockResolvedValue(OK({ success: true }));
    await api.reservas.completar('res-uuid-004');
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.action).toBe('completar');
    expect(body.reserva_id).toBe('res-uuid-004');
  });
});

// ─── reservas.calificar ───────────────────────────────────────────────────
describe('reservas.calificar', () => {
  test('realiza PATCH con action calificar, calificación y comentario', async () => {
    global.fetch.mockResolvedValue(OK({ success: true }));
    await api.reservas.calificar('res-uuid-005', 5, 'Excelente servicio');
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.action).toBe('calificar');
    expect(body.calificacion).toBe(5);
    expect(body.comentario).toBe('Excelente servicio');
    expect(body).not.toHaveProperty('review_photo_url');
  });

  test('incluye review_photo_url cuando se provee', async () => {
    global.fetch.mockResolvedValue(OK({ success: true }));
    await api.reservas.calificar('res-uuid-005', 4, 'Bueno', 'https://cdn.example.com/foto.jpg');
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.review_photo_url).toBe('https://cdn.example.com/foto.jpg');
  });
});

// ─── favoritos.listar ─────────────────────────────────────────────────────
describe('favoritos.listar', () => {
  test('realiza GET a /api/favoritos', async () => {
    global.fetch.mockResolvedValue(OK({ success: true, data: [] }));
    const res = await api.favoritos.listar();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/favoritos'),
      expect.any(Object)
    );
    expect(res.success).toBe(true);
  });
});

// ─── favoritos.agregar ────────────────────────────────────────────────────
describe('favoritos.agregar', () => {
  test('realiza POST con estacionamiento_id', async () => {
    global.fetch.mockResolvedValue(OK({ success: true, data: { id: 1 } }));
    await api.favoritos.agregar(42);
    const call = global.fetch.mock.calls[0];
    expect(call[1].method).toBe('POST');
    expect(JSON.parse(call[1].body)).toEqual({ estacionamiento_id: 42 });
  });
});

// ─── favoritos.quitar ─────────────────────────────────────────────────────
describe('favoritos.quitar', () => {
  test('realiza DELETE con estacionamiento_id', async () => {
    global.fetch.mockResolvedValue(OK({ success: true }));
    await api.favoritos.quitar(42);
    const call = global.fetch.mock.calls[0];
    expect(call[1].method).toBe('DELETE');
    expect(JSON.parse(call[1].body)).toEqual({ estacionamiento_id: 42 });
  });
});

// ─── premium.estado ───────────────────────────────────────────────────────
describe('premium.estado', () => {
  test('realiza GET a /api/premium', async () => {
    global.fetch.mockResolvedValue(OK({ success: true, data: { plan: 'free' } }));
    const res = await api.premium.estado();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/premium'),
      expect.any(Object)
    );
    expect(res.data.plan).toBe('free');
  });
});

// ─── premium.suscribir ────────────────────────────────────────────────────
describe('premium.suscribir', () => {
  test('realiza POST con plan y ciclo mensual por defecto', async () => {
    global.fetch.mockResolvedValue(OK({ success: true, data: { plan: 'pro', ciclo: 'mensual' } }));
    await api.premium.suscribir('pro');
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.plan).toBe('pro');
    expect(body.ciclo).toBe('mensual');
  });

  test('permite especificar ciclo anual', async () => {
    global.fetch.mockResolvedValue(OK({ success: true }));
    await api.premium.suscribir('premium', 'anual');
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.ciclo).toBe('anual');
  });
});

// ─── authHeaders — con sesión activa ──────────────────────────────────────
describe('authHeaders — inyección de Bearer token', () => {
  test('incluye Authorization cuando hay sesión activa', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'tok-abc-123' } },
    });
    global.fetch.mockResolvedValue(OK({ success: true, data: [] }));
    await api.favoritos.listar();
    const headers = global.fetch.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe('Bearer tok-abc-123');
  });

  test('no incluye Authorization cuando no hay sesión', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
    global.fetch.mockResolvedValue(OK({ success: true, data: [] }));
    await api.mapas.getMisEstacionamientos('u1');
    const headers = global.fetch.mock.calls[0][1].headers;
    expect(headers?.Authorization).toBeUndefined();
  });
});
