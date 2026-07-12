// Tests unitarios para MapService (apps/ms-mapas)
// Cubre: normalización de datos, reglas de negocio, delegación al repositorio

jest.mock('../src/repositories/map.repository', () => ({
  MapRepository: {
    getEstacionamientos: jest.fn(),
    createEstacionamiento: jest.fn(),
    deleteEstacionamientos: jest.fn(),
    updateOcupacion: jest.fn(),
  },
}));

import { MapService } from '../src/services/map.service';
import { MapRepository } from '../src/repositories/map.repository';

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── getMisEstacionamientos ───────────────────────────────────────────────────
describe('MapService.getMisEstacionamientos', () => {
  test('delega userId al repositorio', async () => {
    MapRepository.getEstacionamientos.mockResolvedValue([{ id: 1 }]);
    const result = await MapService.getMisEstacionamientos('user-abc');
    expect(MapRepository.getEstacionamientos).toHaveBeenCalledWith('user-abc');
    expect(result).toEqual([{ id: 1 }]);
  });
});

// ─── createEstacionamiento ────────────────────────────────────────────────────
describe('MapService.createEstacionamiento', () => {
  test('convierte lat y lng a float', async () => {
    MapRepository.createEstacionamiento.mockResolvedValue({ id: 10 });
    await MapService.createEstacionamiento({
      nombre: 'Parking A', lat: '-33.4', lng: '-70.6', userId: 'u1',
    });

    const payload = MapRepository.createEstacionamiento.mock.calls[0][0];
    expect(payload.lat).toBe(-33.4);
    expect(payload.lng).toBe(-70.6);
    expect(typeof payload.lat).toBe('number');
    expect(typeof payload.lng).toBe('number');
  });

  test('aplica reglas de negocio: precio_hora=1500, rating=5.0, occupied_spots=0', async () => {
    MapRepository.createEstacionamiento.mockResolvedValue({ id: 11 });
    await MapService.createEstacionamiento({
      nombre: 'P', lat: 0, lng: 0, userId: 'u2',
    });

    const payload = MapRepository.createEstacionamiento.mock.calls[0][0];
    expect(payload.precio_hora).toBe(1500);
    expect(payload.rating).toBe(5.0);
    expect(payload.occupied_spots).toBe(0);
  });

  test('usa total_spots=1 por defecto cuando totalSpots no se provee', async () => {
    MapRepository.createEstacionamiento.mockResolvedValue({ id: 12 });
    await MapService.createEstacionamiento({ nombre: 'P', lat: 0, lng: 0, userId: 'u3' });

    const payload = MapRepository.createEstacionamiento.mock.calls[0][0];
    expect(payload.total_spots).toBe(1);
  });

  test('respeta el totalSpots cuando se provee', async () => {
    MapRepository.createEstacionamiento.mockResolvedValue({ id: 13 });
    await MapService.createEstacionamiento({
      nombre: 'Parking Grande', lat: 0, lng: 0, userId: 'u4', totalSpots: '5',
    });

    const payload = MapRepository.createEstacionamiento.mock.calls[0][0];
    expect(payload.total_spots).toBe(5);
  });

  test('mapea esPmr=true al campo es_pmr', async () => {
    MapRepository.createEstacionamiento.mockResolvedValue({ id: 14 });
    await MapService.createEstacionamiento({
      nombre: 'P', lat: 0, lng: 0, userId: 'u5', esPmr: true,
    });

    const payload = MapRepository.createEstacionamiento.mock.calls[0][0];
    expect(payload.es_pmr).toBe(true);
  });
});

// ─── deleteEstacionamientos ───────────────────────────────────────────────────
describe('MapService.deleteEstacionamientos', () => {
  test('retorna la cantidad de IDs eliminados', async () => {
    MapRepository.deleteEstacionamientos.mockResolvedValue(undefined);
    const count = await MapService.deleteEstacionamientos([1, 2, 3]);
    expect(count).toBe(3);
  });

  test('llama al repositorio con los IDs correctos', async () => {
    MapRepository.deleteEstacionamientos.mockResolvedValue(undefined);
    await MapService.deleteEstacionamientos([7, 8]);
    expect(MapRepository.deleteEstacionamientos).toHaveBeenCalledWith([7, 8]);
  });
});

// ─── updateOcupacion ─────────────────────────────────────────────────────────
describe('MapService.updateOcupacion', () => {
  test('delega id y occupied_spots al repositorio', async () => {
    MapRepository.updateOcupacion.mockResolvedValue({ id: 5, occupied_spots: 3 });
    const result = await MapService.updateOcupacion(5, 3);
    expect(MapRepository.updateOcupacion).toHaveBeenCalledWith(5, 3);
    expect(result.occupied_spots).toBe(3);
  });
});
