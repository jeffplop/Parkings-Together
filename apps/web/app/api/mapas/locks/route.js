import { NextResponse } from 'next/server';
import { supabase, getSupabaseWithToken } from '@parkings/supabase-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getToken(req) {
  const h = req.headers.get('authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

// GET: active locks for a parking
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const estacionamientoId = searchParams.get('estacionamientoId');
  if (!estacionamientoId) return NextResponse.json({ success: false, error: 'Falta estacionamientoId' }, { status: 400 });

  // Delete expired locks for this parking first (cleanup)
  await supabase.from('spot_locks').delete().eq('estacionamiento_id', Number(estacionamientoId)).lt('expires_at', new Date().toISOString());

  const { data, error } = await supabase
    .from('spot_locks')
    .select('spot_label, user_id, expires_at')
    .eq('estacionamiento_id', Number(estacionamientoId));

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}

// POST: acquire a lock for a spot
export async function POST(request) {
  const token = getToken(request);
  if (!token) return NextResponse.json({ success: false, error: 'No autenticado.' }, { status: 401 });

  const { estacionamiento_id, spot_label } = await request.json();
  if (!estacionamiento_id || !spot_label) return NextResponse.json({ success: false, error: 'Faltan campos.' }, { status: 400 });

  const db = getSupabaseWithToken(token);
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: 'Token inválido.' }, { status: 401 });

  // Cleanup expired lock on this spot (so it can be re-acquired)
  await db.from('spot_locks').delete()
    .eq('estacionamiento_id', Number(estacionamiento_id))
    .eq('spot_label', spot_label)
    .lt('expires_at', new Date().toISOString());

  // Check if there's an active lock by another user
  const { data: existing } = await db.from('spot_locks')
    .select('id, user_id')
    .eq('estacionamiento_id', Number(estacionamiento_id))
    .eq('spot_label', spot_label)
    .single();

  if (existing && existing.user_id !== user.id) {
    return NextResponse.json({ success: false, error: 'Esta plaza acaba de ser reservada por otro usuario.' }, { status: 409 });
  }

  // If the same user already has a lock on this spot, return it
  if (existing && existing.user_id === user.id) {
    return NextResponse.json({ success: true, lockId: existing.id });
  }

  const { data: lock, error } = await db.from('spot_locks').insert({
    estacionamiento_id: Number(estacionamiento_id),
    spot_label,
    user_id: user.id,
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  }).select('id').single();

  if (error) {
    // Unique constraint violation → someone else just acquired it
    if (error.code === '23505') return NextResponse.json({ success: false, error: 'Esta plaza acaba de ser tomada.' }, { status: 409 });
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, lockId: lock.id }, { status: 201 });
}

// DELETE: release a lock
export async function DELETE(request) {
  const token = getToken(request);
  if (!token) return NextResponse.json({ success: false, error: 'No autenticado.' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const lockId = searchParams.get('lockId');
  if (!lockId) return NextResponse.json({ success: false, error: 'Falta lockId.' }, { status: 400 });

  const db = getSupabaseWithToken(token);
  const { error } = await db.from('spot_locks').delete().eq('id', lockId);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
