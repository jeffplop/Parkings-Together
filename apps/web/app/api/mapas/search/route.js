// Archivo: apps/web/app/api/mapas/search/route.js
//
// Route Handler de MISMO ORIGEN para estacionamientos.
// Sustituye la dependencia en runtime del microservicio externo `ms-mapas`.
// Al correr dentro de apps/web (lado servidor en Vercel), no requiere CORS ni
// que exista localhost:3002 en producción: este fue el origen del bug de
// "estacionamientos no se muestran en Vercel".
//
// - Lecturas (GET): cliente anónimo. La política RLS `estacionamientos_select_all
//   USING (true)` permite lectura pública.
// - Escrituras (POST/PATCH/DELETE): cliente con el JWT del usuario reenviado en
//   la cabecera Authorization, de modo que RLS evalúa auth.uid() = usuario real.

import { NextResponse } from 'next/server';
import { supabase, getSupabaseWithToken } from '@parkings/supabase-db';

// Forzamos runtime Node (no Edge) para máxima compatibilidad con supabase-js.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getToken(request) {
  const header = request.headers.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

// Distancia Haversine en km (filtro geográfico en memoria mientras no haya RPC PostGIS).
function distanciaKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    // Detalle de un estacionamiento puntual por id (para la página de perfil).
    const id = searchParams.get('id');
    if (id) {
      const { data, error } = await supabase.from('estacionamientos').select('*').eq('id', id).single();
      if (error) return NextResponse.json({ success: false, error: error.message, data: null }, { status: 404 });
      return NextResponse.json({ success: true, data }, { status: 200 });
    }

    const userId = searchParams.get('userId');
    const lat = parseFloat(searchParams.get('lat'));
    const lng = parseFloat(searchParams.get('lng'));
    const radius = parseFloat(searchParams.get('radius'));

    const q = searchParams.get('q') || null;
    const comuna = searchParams.get('comuna') || null;
    const pmr = searchParams.get('pmr');
    const disponible = searchParams.get('disponible');
    const precioMin = parseFloat(searchParams.get('precioMin'));
    const precioMax = parseFloat(searchParams.get('precioMax'));

    const hasGeo = !Number.isNaN(lat) && !Number.isNaN(lng) && !Number.isNaN(radius) && radius > 0 && radius < 9999;

    if (hasGeo && !userId) {
      // Use PostGIS spatial RPC — O(log n) via GIST index
      const { data, error } = await supabase.rpc('buscar_estacionamientos_radio', {
        p_lat: lat,
        p_lng: lng,
        p_radio_km: radius,
        p_q: q,
        p_comuna: comuna,
        p_pmr: pmr === 'true' ? true : null,
        p_precio_max: !Number.isNaN(precioMax) ? Math.round(precioMax) : null,
        p_disponible: disponible === 'true' ? true : null,
      });

      if (error) {
        return NextResponse.json({ success: false, error: error.message, data: [] }, { status: 500 });
      }
      // precioMin not supported in RPC — filter in-memory
      const filtered = !Number.isNaN(precioMin)
        ? (data || []).filter(p => p.precio_hora == null || p.precio_hora >= precioMin)
        : (data || []);
      return NextResponse.json({ success: true, data: filtered }, {
        status: 200,
        headers: { 'Cache-Control': 'public, max-age=20, stale-while-revalidate=60' },
      });
    }

    // Fallback: non-spatial query (userId filter, or no geo params = fetch all)
    let query = supabase.from('estacionamientos').select('*');
    if (userId) query = query.eq('user_id', userId);
    else        query = query.eq('activo', true); // hide inactive spots from public search
    if (q) {
      const escaped = q.replace(/%/g, '\\%').replace(/_/g, '\\_');
      query = query.ilike('nombre', `%${escaped}%`);
    }
    if (comuna) query = query.ilike('comuna', comuna);
    if (pmr === 'true') query = query.eq('es_pmr', true);
    if (!Number.isNaN(precioMin)) query = query.gte('precio_hora', precioMin);
    if (!Number.isNaN(precioMax)) query = query.lte('precio_hora', precioMax);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ success: false, error: error.message, data: [] }, { status: 500 });
    }

    let result = data || [];

    if (disponible === 'true') {
      result = result.filter(
        (p) => p.total_spots == null || Number(p.occupied_spots ?? 0) < Number(p.total_spots)
      );
    }

    // In-memory geo filter only for fallback path (e.g. userId + geo)
    if (hasGeo) {
      result = result.filter(
        (p) => distanciaKm(lat, lng, Number(p.lat), Number(p.lng)) <= radius
      );
    }

    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message, data: [] }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const token = getToken(request);
    if (!token) {
      return NextResponse.json({ success: false, error: 'No autenticado.' }, { status: 401 });
    }

    const body = await request.json();
    if (!body.nombre || body.lat === undefined || body.lng === undefined) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos obligatorios: nombre, lat, lng.' },
        { status: 400 }
      );
    }

    const latVal = parseFloat(body.lat);
    const lngVal = parseFloat(body.lng);
    if (!Number.isFinite(latVal) || !Number.isFinite(lngVal)) {
      return NextResponse.json({ success: false, error: 'lat/lng inválidos.' }, { status: 400 });
    }

    const db = getSupabaseWithToken(token);
    const { data: { user } } = await db.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'Sesión inválida.' }, { status: 401 });

    const parkingData = {
      nombre: body.nombre,
      arrendador: body.arrendador,
      lat: latVal,
      lng: lngVal,
      coordenadas: `SRID=4326;POINT(${lngVal} ${latVal})`,
      total_spots: parseInt(body.totalSpots) || 1,
      occupied_spots: 0,
      es_pmr: body.esPmr || false,
      user_id: user.id,
      precio_hora: body.precioHora ? Math.round(parseFloat(body.precioHora)) : 1500,
      price_per_minute: body.pricePerMinute ? parseFloat(body.pricePerMinute) : null,
      price_per_day: body.pricePerDay ? Math.round(parseFloat(body.pricePerDay)) : null,
      allowed_vehicle_types: Array.isArray(body.allowedVehicleTypes) && body.allowedVehicleTypes.length > 0
        ? body.allowedVehicleTypes
        : ['car'],
      comuna: body.comuna || null,
      descripcion: body.descripcion || null,
      direccion: body.direccion || null,
    };

    const { data, error } = await db
      .from('estacionamientos')
      .insert([parkingData])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const token = getToken(request);
    if (!token) {
      return NextResponse.json({ success: false, error: 'No autenticado.' }, { status: 401 });
    }

    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ success: false, error: 'Se requiere id.' }, { status: 400 });
    }

    const db = getSupabaseWithToken(token);

    // ── toggleActivo: flip the activo boolean ──
    if (body.action === 'toggleActivo') {
      const { data: current, error: fetchErr } = await db
        .from('estacionamientos')
        .select('activo')
        .eq('id', body.id)
        .single();

      if (fetchErr) return NextResponse.json({ success: false, error: fetchErr.message }, { status: 404 });

      const newActivo = !(current.activo ?? true);
      const { data, error } = await db
        .from('estacionamientos')
        .update({ activo: newActivo })
        .eq('id', body.id)
        .select()
        .single();

      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 403 });
      return NextResponse.json({ success: true, data, activo: newActivo }, { status: 200 });
    }

    // ── updateFull: update all editable fields ──
    if (body.action === 'updateFull') {
      const updates = {};
      if (body.nombre      !== undefined) updates.nombre       = body.nombre;
      if (body.totalSpots  !== undefined) updates.total_spots  = parseInt(body.totalSpots);
      if (body.esPmr       !== undefined) updates.es_pmr       = body.esPmr;
      if (body.precioHora  !== undefined) updates.precio_hora  = body.precioHora ? Math.round(parseFloat(body.precioHora)) : null;
      if (body.pricePerMinute !== undefined) updates.price_per_minute = body.pricePerMinute ? parseFloat(body.pricePerMinute) : null;
      if (body.pricePerDay !== undefined) updates.price_per_day = body.pricePerDay ? Math.round(parseFloat(body.pricePerDay)) : null;
      if (Array.isArray(body.allowedVehicleTypes)) updates.allowed_vehicle_types = body.allowedVehicleTypes;
      if (Array.isArray(body.photos)) updates.photos = body.photos;
      if ('descripcion' in body) updates.descripcion = body.descripcion || null;
      if ('direccion'   in body) updates.direccion   = body.direccion   || null;

      const { data, error } = await db
        .from('estacionamientos')
        .update(updates)
        .eq('id', body.id)
        .select()
        .single();

      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 403 });
      return NextResponse.json({ success: true, data }, { status: 200 });
    }

    // ── Default: update occupied_spots only ──
    const spots = parseInt(body.occupied_spots);
    if (!Number.isFinite(spots) || spots < 0) {
      return NextResponse.json({ success: false, error: 'Se requiere occupied_spots (>= 0).' }, { status: 400 });
    }

    const { data, error } = await db
      .from('estacionamientos')
      .update({ occupied_spots: spots })
      .eq('id', body.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const token = getToken(request);
    if (!token) {
      return NextResponse.json({ success: false, error: 'No autenticado.' }, { status: 401 });
    }

    const body = await request.json();
    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json({ success: false, error: 'Se requiere un array de IDs.' }, { status: 400 });
    }

    const db = getSupabaseWithToken(token);

    // For each ID: check if there are active reservations.
    // If yes → soft-delete (activo = false). If no → hard delete.
    const hardDelete = [];
    const softDelete = [];

    for (const id of body.ids) {
      const { count } = await db
        .from('reservas')
        .select('id', { count: 'exact', head: true })
        .eq('estacionamiento_id', id)
        .in('estado', ['pendiente', 'confirmada', 'activa']);

      if ((count ?? 0) > 0) softDelete.push(id);
      else           hardDelete.push(id);
    }

    if (softDelete.length > 0) {
      const { error } = await db
        .from('estacionamientos')
        .update({ activo: false })
        .in('id', softDelete);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    if (hardDelete.length > 0) {
      const { error } = await db.from('estacionamientos').delete().in('id', hardDelete);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      hardDeleted: hardDelete.length,
      softDeleted: softDelete.length,
      hardDeletedIds: hardDelete,
      softDeletedIds: softDelete,
    }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
