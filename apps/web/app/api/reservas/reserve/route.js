// Archivo: apps/web/app/api/reservas/reserve/route.js
//
// Route Handler de MISMO ORIGEN para reservas (sustituye a `ms-reservas` en runtime).
// Implementa el patrón Saga: crear reserva -> incrementar ocupación -> compensar si falla.
//
// - GET (disponibilidad): cliente anónimo (lectura pública de estacionamientos).
// - POST (crear reserva): cliente con el JWT del usuario, para que RLS exija
//   auth.uid() = conductor_id.

import { NextResponse } from 'next/server';
import { supabase, getSupabaseWithToken } from '@parkings/supabase-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getToken(request) {
  const header = request.headers.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const parkingId = searchParams.get('parkingId');
    if (!parkingId) {
      return NextResponse.json({ success: false, error: 'Falta parkingId' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('estacionamientos')
      .select('occupied_spots, total_spots, nombre, id')
      .eq('id', parkingId)
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        success: true,
        available: data.occupied_spots < data.total_spots,
        spots_left: data.total_spots - data.occupied_spots,
        data,
      },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const token = getToken(request);
    if (!token) {
      return NextResponse.json({ success: false, error: 'No autenticado.' }, { status: 401 });
    }

    const body = await request.json();
    const { parking_id, user_id, fecha_inicio, fecha_fin, spot_label, duration_hours } = body;
    if (!parking_id || !user_id) {
      return NextResponse.json({ success: false, error: 'Faltan parking_id o user_id.' }, { status: 400 });
    }

    const db = getSupabaseWithToken(token);

    // Dos modos sobre la misma transacción atómica (RPC SECURITY DEFINER):
    //  - PRO (reserva anticipada): si llegan fecha_inicio y fecha_fin, reserva una
    //    ventana de tiempo validando capacidad por solapamiento; queda 'pendiente'
    //    hasta que el arrendador la confirme.
    //  - INSTANTÁNEA (legacy): sin fechas, ocupa un cupo ahora e incrementa
    //    occupied_spots. Se conserva para el flujo de "estacionar ya".
    let reserva, error;
    // estacionamientos.id es integer en producción — coercionar explícitamente
    const estId = Number(parking_id);
    // Compute fecha_inicio / fecha_fin from duration_hours when not explicitly provided.
    // Add 30s buffer when no explicit start is given — prevents the Postgres past-check
    // from triggering due to clock skew / network latency between client and server.
    const resolvedInicio = fecha_inicio ?? new Date(Date.now() + 30_000).toISOString();
    const resolvedFin = fecha_fin ?? (duration_hours
      ? new Date(Date.now() + duration_hours * 3600 * 1000).toISOString()
      : null);

    if (resolvedFin) {
      ({ data: reserva, error } = await db.rpc('crear_reserva_pro', {
        p_estacionamiento_id: estId,
        p_fecha_inicio: resolvedInicio,
        p_fecha_fin: resolvedFin,
      }));
    } else {
      ({ data: reserva, error } = await db.rpc('reservar_estacionamiento', {
        p_estacionamiento_id: estId,
      }));
    }

    // Attach spot_label to the reservation row if the RPC returned an id
    if (!error && reserva && spot_label) {
      const reservaId = typeof reserva === 'object' ? reserva.id ?? reserva : reserva;
      if (reservaId) {
        await db.from('reservas').update({ spot_label }).eq('id', reservaId);
      }
    }

    if (error) {
      const lleno = /lleno/i.test(error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: lleno ? 409 : 400 });
    }

    return NextResponse.json({ success: true, reserva }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
