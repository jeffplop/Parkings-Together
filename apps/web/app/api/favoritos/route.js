// Archivo: apps/web/app/api/favoritos/route.js
//
// Favoritos del conductor (mismo origen, runtime Node). RLS acota por auth.uid().
//  - GET                      → favoritos del usuario (con datos del estacionamiento)
//  - POST   { estacionamiento_id }   → añadir
//  - DELETE { estacionamiento_id }   → quitar

import { NextResponse } from 'next/server';
import { getSupabaseWithToken } from '@parkings/supabase-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getToken(request) {
  const header = request.headers.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

export async function GET(request) {
  const token = getToken(request);
  if (!token) return NextResponse.json({ success: false, error: 'No autenticado.', data: [] }, { status: 401 });

  const db = getSupabaseWithToken(token);
  const { data, error } = await db
    .from('favoritos')
    .select('id, created_at, estacionamiento:estacionamientos(id, nombre, comuna, precio_hora, es_pmr, rating, lat, lng)')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ success: false, error: error.message, data: [] }, { status: 500 });
  return NextResponse.json({ success: true, data: data || [] }, { status: 200 });
}

export async function POST(request) {
  const token = getToken(request);
  if (!token) return NextResponse.json({ success: false, error: 'No autenticado.' }, { status: 401 });

  const { estacionamiento_id } = await request.json();
  if (!estacionamiento_id) {
    return NextResponse.json({ success: false, error: 'Falta estacionamiento_id.' }, { status: 400 });
  }

  const db = getSupabaseWithToken(token);
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: 'Sesión inválida.' }, { status: 401 });

  // upsert idempotente respetando la restricción UNIQUE (user_id, estacionamiento_id).
  const { data, error } = await db
    .from('favoritos')
    .upsert({ user_id: user.id, estacionamiento_id }, { onConflict: 'user_id,estacionamiento_id' })
    .select()
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, data }, { status: 201 });
}

export async function DELETE(request) {
  try {
    const token = getToken(request);
    if (!token) return NextResponse.json({ success: false, error: 'No autenticado.' }, { status: 401 });

    const { estacionamiento_id } = await request.json();
    if (!estacionamiento_id) {
      return NextResponse.json({ success: false, error: 'Falta estacionamiento_id.' }, { status: 400 });
    }

    const db = getSupabaseWithToken(token);
    const { data: { user } } = await db.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'Sesión inválida.' }, { status: 401 });

    const { error } = await db.from('favoritos').delete().eq('estacionamiento_id', estacionamiento_id).eq('user_id', user.id);
    if (error) return NextResponse.json({ success: false, error: 'No se pudo eliminar.' }, { status: 400 });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json({ success: false, error: 'Error interno.' }, { status: 500 });
  }
}
