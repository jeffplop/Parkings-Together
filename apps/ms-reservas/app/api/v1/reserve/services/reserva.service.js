import { ReserveRepository } from '../repositories/reserva.repository';

// ════════════════════════════════════════════════════════════════════════════
// ⚠️  DEMOSTRACIÓN DIDÁCTICA DEL PATRÓN SAGA — NO ES EL CAMINO DE PRODUCCIÓN
// ────────────────────────────────────────────────────────────────────────────
// Este microservicio existe para ILUSTRAR el patrón Saga (compensación por
// pasos). NO está desplegado y el frontend NO lo consume: la app usa siempre el
// BFF de mismo origen `apps/web/app/api/reservas/reserve`, que reserva mediante
// la función PostgreSQL `reservar_estacionamiento(...)` con `FOR UPDATE` — atómica
// y a prueba de doble reserva.
//
// `processSaga()` de abajo tiene una CONDICIÓN DE CARRERA conocida: lee la
// ocupación, inserta la reserva y luego actualiza la ocupación en pasos
// separados (check-then-act sin bloqueo). Bajo concurrencia, dos peticiones
// pueden leer el mismo cupo libre y reservar ambas. La compensación revierte
// una inconsistencia *después* de ocurrir, pero NO evita la carrera.
//
// → NO desplegar este servicio como ruta de reservas real. Comparación completa:
//   docs/arquitectura/patrones.md (repo de documentación) y docs/AUDIT_002.
// ════════════════════════════════════════════════════════════════════════════

export const ReserveService = {
  async processSaga(payload) {
    const { parking_id, user_id, start_time } = payload;

    // 1. Verificación CQRS
    //    ⚠️ Inicio del check-then-act: entre esta lectura y el UPDATE del paso 3
    //    no hay bloqueo de fila. En producción esto lo resuelve la RPC con
    //    FOR UPDATE del BFF; aquí se deja así a propósito para mostrar la Saga.
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
