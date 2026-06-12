// Archivo: apps/web/app/api/reservas/manage/route.js
//
// Gestión de reservas profesionales (mismo origen, runtime Node).
//  - GET   ?scope=conductor   → reservas del conductor autenticado.
//          ?scope=arrendador  → reservas recibidas en los estacionamientos del
//                               arrendador autenticado.
//  - PATCH { action, reserva_id, fecha_inicio?, fecha_fin? }
//          action ∈ confirmar | cancelar | reprogramar
//
// Toda operación usa el JWT del usuario: las RPC (SECURITY DEFINER) y las
// políticas RLS validan internamente auth.uid().

import { NextResponse } from 'next/server';
import { getSupabaseWithToken } from '@parkings/supabase-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getToken(request) {
  const header = request.headers.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

export async function GET(request) {
  try {
    const token = getToken(request);
    if (!token) return NextResponse.json({ success: false, error: 'No autenticado.' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope') || 'conductor';
    const db = getSupabaseWithToken(token);

    const { data: authData } = await db.auth.getUser();
    const user = authData?.user ?? null;
    if (!user) return NextResponse.json({ success: false, error: 'Sesión inválida.' }, { status: 401 });

    let query = db
      .from('reservas')
      .select('*, estacionamiento:estacionamientos(id, nombre, comuna, precio_hora, lat, lng)')
      .order('fecha_inicio', { ascending: false, nullsFirst: false });

    if (scope === 'conductor') {
      query = query.eq('conductor_id', user.id);
    } else if (scope === 'arrendador') {
      // Get all parking IDs owned by this user
      const { data: mis } = await db.from('estacionamientos').select('id').eq('user_id', user.id);
      const ids = (mis || []).map(p => p.id);
      if (ids.length === 0) return NextResponse.json({ success: true, scope, data: [] }, { status: 200 });
      query = query.in('estacionamiento_id', ids);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ success: false, error: error.message, data: [] }, { status: 500 });

    return NextResponse.json({ success: true, scope, data: data || [] }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message, data: [] }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const token = getToken(request);
    if (!token) return NextResponse.json({ success: false, error: 'No autenticado.' }, { status: 401 });

    const { action, reserva_id, fecha_inicio, fecha_fin, calificacion, comentario, review_photo_url } = await request.json();
    if (!action || !reserva_id) {
      return NextResponse.json({ success: false, error: 'Faltan action o reserva_id.' }, { status: 400 });
    }

    const db = getSupabaseWithToken(token);
    let result;

    switch (action) {
      case 'confirmar':
        result = await db.rpc('confirmar_reserva', { p_reserva_id: reserva_id });
        break;
      case 'cancelar':
        result = await db.rpc('cancelar_reserva_pro', { p_reserva_id: reserva_id });
        break;
      case 'completar':
        result = await db.rpc('completar_reserva', { p_reserva_id: reserva_id });
        break;
      case 'calificar': {
        const cal = parseInt(calificacion);
        if (!Number.isFinite(cal) || cal < 1 || cal > 5) {
          return NextResponse.json({ success: false, error: 'Calificación debe ser entre 1 y 5.' }, { status: 400 });
        }
        result = await db.rpc('calificar_reserva', {
          p_reserva_id: reserva_id,
          p_calificacion: cal,
          p_comentario: comentario ? String(comentario).slice(0, 500) : null,
        });
        // Save review photo URL if provided (after rating the reservation)
        if (!result.error && review_photo_url) {
          await db
            .from('reservas')
            .update({ review_photo_url: String(review_photo_url) })
            .eq('id', reserva_id);
        }
      }
        break;
      case 'reprogramar':
        if (!fecha_inicio || !fecha_fin) {
          return NextResponse.json({ success: false, error: 'Reprogramar requiere fecha_inicio y fecha_fin.' }, { status: 400 });
        }
        result = await db.rpc('reprogramar_reserva', {
          p_reserva_id: reserva_id,
          p_fecha_inicio: fecha_inicio,
          p_fecha_fin: fecha_fin,
        });
        break;
      default:
        return NextResponse.json({ success: false, error: `Acción no soportada: ${action}` }, { status: 400 });
    }

    if (result.error) {
      const lleno = /lleno/i.test(result.error.message);
      const noAuth = /autoriz|autenticado/i.test(result.error.message);
      return NextResponse.json(
        { success: false, error: result.error.message },
        { status: lleno ? 409 : noAuth ? 403 : 400 }
      );
    }
    return NextResponse.json({ success: true, reserva: result.data }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
