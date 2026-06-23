// apps/web/app/api/chat/conversaciones/route.js
//
// Conversaciones del chat conductor ↔ arrendador.
//   GET  → lista las conversaciones del usuario (normalizadas a su perspectiva).
//   POST → inicia (o recupera) la conversación con el arrendador de un parking.

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

  const db = getSupabaseWithToken(token);
  const { data: authData } = await db.auth.getUser();
  const user = authData?.user ?? null;
  if (!user) return NextResponse.json({ success: false, error: 'Token inválido.' }, { status: 401 });

  const { data, error } = await db
    .from('conversaciones')
    .select('*')
    .order('last_message_at', { ascending: false });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Normaliza cada conversación a la perspectiva del usuario: el "otro"
  // participante y los no-leídos que le corresponden a él.
  const list = (data || []).map((c) => {
    const soyConductor = c.conductor_id === user.id;
    return {
      id: c.id,
      estacionamiento_id: c.estacionamiento_id,
      estacionamiento_nombre: c.estacionamiento_nombre,
      otro_nombre: soyConductor ? c.arrendador_nombre : c.conductor_nombre,
      soy: soyConductor ? 'conductor' : 'arrendador',
      last_message: c.last_message,
      last_message_at: c.last_message_at,
      unread: soyConductor ? c.conductor_unread : c.arrendador_unread,
    };
  });

  const totalUnread = list.reduce((s, c) => s + (c.unread || 0), 0);
  return NextResponse.json({ success: true, data: list, totalUnread }, { status: 200 });
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

  const estId = Number(body?.estacionamiento_id);
  if (!Number.isInteger(estId)) {
    return NextResponse.json({ success: false, error: 'estacionamiento_id inválido.' }, { status: 400 });
  }

  const db = getSupabaseWithToken(token);
  const { data, error } = await db.rpc('iniciar_conversacion', { p_estacionamiento_id: estId });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });

  return NextResponse.json({ success: true, data }, { status: 200 });
}
