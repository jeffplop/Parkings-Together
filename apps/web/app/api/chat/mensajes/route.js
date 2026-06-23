// apps/web/app/api/chat/mensajes/route.js
//
//   GET ?conversacion_id= → mensajes de la conversación (y la marca como leída).
//   POST                  → envía un mensaje (vía RPC enviar_mensaje).

import { NextResponse } from 'next/server';
import { getSupabaseWithToken } from '@parkings/supabase-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getToken(req) {
  const h = req.headers.get('authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

export async function GET(request) {
  const token = getToken(request);
  if (!token) return NextResponse.json({ success: false, error: 'No autenticado.' }, { status: 401 });

  const convId = new URL(request.url).searchParams.get('conversacion_id');
  if (!convId) return NextResponse.json({ success: false, error: 'Falta conversacion_id.' }, { status: 400 });

  const db = getSupabaseWithToken(token);
  const { data: authData } = await db.auth.getUser();
  const user = authData?.user ?? null;
  if (!user) return NextResponse.json({ success: false, error: 'Token inválido.' }, { status: 401 });

  // RLS garantiza que solo se devuelvan mensajes de conversaciones del usuario.
  const { data, error } = await db
    .from('mensajes')
    .select('id, sender_id, body, created_at')
    .eq('conversacion_id', convId)
    .order('created_at', { ascending: true })
    .limit(500);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Marca la conversación como leída para este usuario (best-effort).
  try { await db.rpc('marcar_leida', { p_conversacion_id: convId }); } catch { /* noop */ }

  return NextResponse.json({ success: true, data: data || [], me: user.id }, { status: 200 });
}

export async function POST(request) {
  const token = getToken(request);
  if (!token) return NextResponse.json({ success: false, error: 'No autenticado.' }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Cuerpo inválido.' }, { status: 400 });
  }

  const convId = body?.conversacion_id;
  const text = (body?.body ?? '').toString();
  if (!convId || !text.trim()) {
    return NextResponse.json({ success: false, error: 'Mensaje o conversación inválidos.' }, { status: 400 });
  }

  const db = getSupabaseWithToken(token);
  const { data, error } = await db.rpc('enviar_mensaje', { p_conversacion_id: convId, p_body: text });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });

  return NextResponse.json({ success: true, data }, { status: 201 });
}
