import { ReserveService } from '../app/api/v1/reserve/services/reserva.service';
import { ReserveRepository } from '../app/api/v1/reserve/repositories/reserva.repository';

// Mockear el repositorio con factory function para evitar que Jest cargue Supabase y arroje error de WebSockets
jest.mock('../app/api/v1/reserve/repositories/reserva.repository', () => ({
  ReserveRepository: {
    getParkingAvailability: jest.fn(),
    createReserve: jest.fn(),
    updateParkingOccupancy: jest.fn(),
    deleteReserve: jest.fn()
  }
}));

// ─── checkAvailability ────────────────────────────────────────────────────────
describe('ReserveService.checkAvailability', () => {
  test('retorna available=true cuando hay plazas libres', async () => {
    ReserveRepository.getParkingAvailability.mockResolvedValue({
      occupied_spots: 3, total_spots: 10, id: 'p-1'
    });
    const result = await ReserveService.checkAvailability('p-1');
    expect(result.available).toBe(true);
    expect(result.spots_left).toBe(7);
  });

  test('retorna available=false cuando está lleno', async () => {
    ReserveRepository.getParkingAvailability.mockResolvedValue({
      occupied_spots: 10, total_spots: 10, id: 'p-2'
    });
    const result = await ReserveService.checkAvailability('p-2');
    expect(result.available).toBe(false);
    expect(result.spots_left).toBe(0);
  });

  test('incluye los datos crudos del estacionamiento en result.data', async () => {
    const raw = { occupied_spots: 1, total_spots: 5, id: 'p-3', nombre: 'Central' };
    ReserveRepository.getParkingAvailability.mockResolvedValue(raw);
    const result = await ReserveService.checkAvailability('p-3');
    expect(result.data).toEqual(raw);
  });
});

// ─── processSaga — happy path ─────────────────────────────────────────────────
describe('ReserveService.processSaga — happy path', () => {
  test('crea la reserva y actualiza la ocupación cuando hay cupo', async () => {
    ReserveRepository.getParkingAvailability.mockResolvedValue({
      occupied_spots: 2, total_spots: 10, id: 'p-4'
    });
    const nuevaReserva = { id: 'res-happy', estacionamiento_id: 'p-4', estado: 'activa' };
    ReserveRepository.createReserve.mockResolvedValue(nuevaReserva);
    ReserveRepository.updateParkingOccupancy.mockResolvedValue({ occupied_spots: 3 });

    const result = await ReserveService.processSaga({ parking_id: 'p-4', user_id: 'u-1' });

    expect(result).toEqual(nuevaReserva);
    expect(ReserveRepository.createReserve).toHaveBeenCalledWith(
      expect.objectContaining({ estacionamiento_id: 'p-4', estado: 'activa' })
    );
    expect(ReserveRepository.updateParkingOccupancy).toHaveBeenCalledWith('p-4', 3);
    expect(ReserveRepository.deleteReserve).not.toHaveBeenCalled();
  });
});

describe('Domain-Driven Design: Saga de Reservas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Debe rechazar la reserva si el estacionamiento está lleno (CQRS)', async () => {
    ReserveRepository.getParkingAvailability.mockResolvedValue({
      occupied_spots: 10,
      total_spots: 10,
      id: 'p-123'
    });

    await expect(ReserveService.processSaga({
      parking_id: 'p-123', user_id: 'u-123'
    })).rejects.toThrow('El estacionamiento ya está lleno');

    expect(ReserveRepository.createReserve).not.toHaveBeenCalled();
  });

  test('Debe realizar rollback (compensación) si la actualización de plazas falla', async () => {
    // 1. Hay cupo
    ReserveRepository.getParkingAvailability.mockResolvedValue({
      occupied_spots: 5,
      total_spots: 10,
      id: 'p-123'
    });

    // 2. Reserva exitosa
    ReserveRepository.createReserve.mockResolvedValue({ id: 'res-999' });

    // 3. Falla al aumentar la ocupación (simulando error de concurrencia)
    ReserveRepository.updateParkingOccupancy.mockRejectedValue(new Error('Concurrency error'));

    // Ejecutar saga
    await expect(ReserveService.processSaga({
      parking_id: 'p-123', user_id: 'u-123'
    })).rejects.toThrow('Saga Compensada');

    // VERIFICAR QUE SE BORRÓ LA RESERVA PARA MANTENER INTEGRIDAD (ROLLBACK)
    expect(ReserveRepository.deleteReserve).toHaveBeenCalledWith('res-999');
  });
});
