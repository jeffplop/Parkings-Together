// Archivo: apps/web/app/api/pagos/route.js
//
// Registro de pagos de reservas. Delega el cobro a la capa de proveedores
// (src/lib/payments.js) — hoy 'mock'/'efectivo'/'webpay' simulado, mañana
// Webpay real sin tocar esta ruta. Incluye:
//   • Allowlist de proveedores.
//   • Verificación de propiedad (solo el conductor paga su reserva).
//   • Verificación de monto contra reservas.precio_total (anti-manipulación).
//   • Idempotencia: no duplica un pago ya completado de la misma reserva.

import { NextResponse } from 'next/server';
import { getSupabaseWithToken } from '@parkings/supabase-db';
import { createCharge, isValidProvider } from '../../../src/lib/payments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_AMOUNT = 10_000_000; // tope de seguridad (CLP)

function getToken(req) {
  const h = req.headers.get('authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

export async function POST(request) {
  const token = getToken(request);
  if (!token) return NextResponse.json({ success: false, error: 'No autenticado.' }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Cuerpo de la petición inválido.' }, { status: 400 });
  }

  const { reserva_id = null, amount, provider = 'mock', metadata = null } = body;

  if (!isValidProvider(provider)) {
    return NextResponse.json({ success: false, error: 'Proveedor de pago no soportado.' }, { status: 400 });
  }

  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    return NextResponse.json({ success: false, error: 'Monto inválido.' }, { status: 400 });
  }
  if (amt > MAX_AMOUNT) {
    return NextResponse.json({ success: false, error: 'Monto fuera de rango.' }, { status: 400 });
  }

  const db = getSupabaseWithToken(token);
  const { data: authData } = await db.auth.getUser();
  const user = authData?.user ?? null;
  if (!user) return NextResponse.json({ success: false, error: 'Token inválido.' }, { status: 401 });

  // ── Validaciones cuando el pago está asociado a una reserva ──
  if (reserva_id) {
    const { data: reserva } = await db
      .from('reservas')
      .select('id, conductor_id, precio_total')
      .eq('id', reserva_id)
      .maybeSingle();

    if (reserva) {
      // Solo el conductor de la reserva puede pagarla.
      if (reserva.conductor_id !== user.id) {
        return NextResponse.json({ success: false, error: 'No puedes pagar una reserva que no es tuya.' }, { status: 403 });
      }
      // Si la reserva tiene precio fijado, el monto debe coincidir (anti-manipulación de precio).
      if (reserva.precio_total != null && Math.round(Number(reserva.precio_total)) !== Math.round(amt)) {
        return NextResponse.json({ success: false, error: 'El monto no coincide con el de la reserva.' }, { status: 400 });
      }
      // Idempotencia: si ya hay un pago completado para esta reserva, devolverlo.
      const { data: existing } = await db
        .from('payments')
        .select('id, transaction_id, status')
        .eq('reserva_id', reserva_id)
        .eq('status', 'completed')
        .maybeSingle();
      if (existing) {
        return NextResponse.json({ success: true, payment: existing, idempotent: true }, { status: 200 });
      }
    }
  }

  // ── Cobro a través de la capa de proveedores ──
  let charge;
  try {
    charge = await createCharge(provider, {
      amount: amt,
      buyOrder: reserva_id || `ORD-${Date.now()}`,
      sessionId: user.id,
      metadata,
    });
  } catch (err) {
    const notReady = err.code === 'PROVIDER_NOT_CONFIGURED' || err.code === 'PROVIDER_NOT_IMPLEMENTED';
    return NextResponse.json(
      { success: false, error: err.message || 'Error procesando el pago.' },
      { status: notReady ? 501 : 502 },
    );
  }

  const { data: payment, error } = await db.from('payments').insert({
    reserva_id,
    user_id: user.id,
    amount: amt,
    status: charge.status,
    provider,
    transaction_id: charge.transactionId,
    metadata: metadata || charge.raw || null,
  }).select('id, transaction_id, status').single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, payment }, { status: 201 });
}
