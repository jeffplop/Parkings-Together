// Tests unitarios para MapController (apps/ms-mapas)
// Verifica validación de entrada y mapeo de respuestas HTTP

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body, opts) => ({ body, status: opts?.status ?? 200 })),
  },
}));

jest.mock('../src/services/map.service', () => ({
  MapService: {
    getMisEstacionamientos: jest.fn(),
    createEstacionamiento: jest.fn(),
    deleteEstacionamientos: jest.fn(),
    updateOcupacion: jest.fn(),
  },
}));

import { MapController } from '../src/controllers/map.controller';
import { MapService } from '../src/services/map.service';

const mockRequest = (body, url = 'http://localhost/api/v1/search') => ({
  json: jest.fn().mockResolvedValue(body),
  url,
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── get ──────────────────────────────────────────────────────────────────────
describe('MapController.get', () => {
  test('pasa userId de la query string al servicio', async () => {
    MapService.getMisEstacionamientos.mockResolvedValue([{ id: 1 }]);
    const res = await MapController.get(
      mockRequest({}, 'http://localhost/api/v1/search?userId=user-xyz')
    );
    expect(MapService.getMisEstacionamientos).toHaveBeenCalledWith('user-xyz');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('retorna 500 si el servicio lanza un error', async () => {
    MapService.getMisEstacionamientos.mockRejectedValue(new Error('DB error'));
    const res = await MapController.get(mockRequest({}, 'http://localhost/api/v1/search'));
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ─── create ───────────────────────────────────────────────────────────────────
describe('MapController.create', () => {
  test('retorna 400 si falta nombre', async () => {
    const res = await MapController.create(
      mockRequest({ lat: -33.4, lng: -70.6, userId: 'u1' })
    );
    expect(res.status).toBe(400);
    expect(MapService.createEstacionamiento).not.toHaveBeenCalled();
  });

  test('retorna 400 si falta lat', async () => {
    const res = await MapController.create(
      mockRequest({ nombre: 'P', lng: -70.6, userId: 'u1' })
    );
    expect(res.status).toBe(400);
  });

  test('retorna 400 si falta userId', async () => {
    const res = await MapController.create(
      mockRequest({ nombre: 'P', lat: -33.4, lng: -70.6 })
    );
    expect(res.status).toBe(400);
  });

  test('retorna 201 cuando la creación es exitosa', async () => {
    MapService.createEstacionamiento.mockResolvedValue({ id: 99 });
    const res = await MapController.create(
      mockRequest({ nombre: 'Parking', lat: -33.4, lng: -70.6, userId: 'u1' })
    );
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });
});

// ─── remove ───────────────────────────────────────────────────────────────────
describe('MapController.remove', () => {
  test('retorna 400 si ids está vacío', async () => {
    const res = await MapController.remove(mockRequest({ ids: [] }));
    expect(res.status).toBe(400);
    expect(MapService.deleteEstacionamientos).not.toHaveBeenCalled();
  });

  test('retorna 400 si ids no es array', async () => {
    const res = await MapController.remove(mockRequest({ ids: 5 }));
    expect(res.status).toBe(400);
  });

  test('retorna 400 si no se envía ids', async () => {
    const res = await MapController.remove(mockRequest({}));
    expect(res.status).toBe(400);
  });

  test('retorna 200 con conteo cuando la eliminación es exitosa', async () => {
    MapService.deleteEstacionamientos.mockResolvedValue(2);
    const res = await MapController.remove(mockRequest({ ids: [1, 2] }));
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(2);
  });
});

// ─── update ───────────────────────────────────────────────────────────────────
describe('MapController.update', () => {
  test('retorna 400 si falta id', async () => {
    const res = await MapController.update(mockRequest({ occupied_spots: 3 }));
    expect(res.status).toBe(400);
    expect(MapService.updateOcupacion).not.toHaveBeenCalled();
  });

  test('retorna 400 si falta occupied_spots', async () => {
    const res = await MapController.update(mockRequest({ id: 1 }));
    expect(res.status).toBe(400);
  });

  test('acepta occupied_spots=0 como valor válido', async () => {
    MapService.updateOcupacion.mockResolvedValue({ id: 1, occupied_spots: 0 });
    const res = await MapController.update(mockRequest({ id: 1, occupied_spots: 0 }));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('retorna 200 con los datos actualizados', async () => {
    MapService.updateOcupacion.mockResolvedValue({ id: 5, occupied_spots: 3 });
    const res = await MapController.update(mockRequest({ id: 5, occupied_spots: 3 }));
    expect(res.status).toBe(200);
    expect(res.body.data.occupied_spots).toBe(3);
  });
});
