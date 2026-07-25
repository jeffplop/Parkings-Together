import { ReserveRepository } from '../repositories/reserva.repository';

export const ReserveService = {
  async processSaga(payload) {
    const { parking_id, user_id, start_time } = payload;

    // 1. Verificación CQRS
    const parking = await ReserveRepository.getParkingAvailability(parking_id);
    if (parking.occupied_spots >= parking.total_spots) {
      throw new Error('El estacionamiento ya está lleno. Transacción rechazada.');
    }

    // 2. Insertar Reserva
    const reservaData = {
      estacionamiento_id: parking_id,
      conductor_id: user_id,
      estado: 'activa',
      created_at: start_time || new Date().toISOString()
    };
    const reserva = await ReserveRepository.createReserve(reservaData);

    // 3. Compensación Saga
    try {
      await ReserveRepository.updateParkingOccupancy(parking_id, parking.occupied_spots + 1);
    } catch {
      // Rollback (Compensación)
      await ReserveRepository.deleteReserve(reserva.id);
      throw new Error('Fallo al actualizar ocupación. Reserva revertida por seguridad (Saga Compensada).');
    }

    return reserva;
  },

  async checkAvailability(parkingId) {
    const data = await ReserveRepository.getParkingAvailability(parkingId);
    return {
      available: data.occupied_spots < data.total_spots,
      spots_left: data.total_spots - data.occupied_spots,
      data
    };
  }
};
