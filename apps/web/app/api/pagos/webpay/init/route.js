// apps/web/app/api/pagos/webpay/init/route.js
//
// Inicia un pago con Webpay Plus (Transbank). Crea la transacción, registra un pago
// "pendiente" y devuelve la URL + token para que el frontend redirija al usuario a
// Transbank. La confirmación ocurre en /api/pagos/webpay/return.

import { NextResponse } from 'next/server';
import { getSupabaseWithToken } from '@parkings/supabase-db';
import { webpayCreate } from '../../../../../src/lib/webpay';
import { feeMetadata } from '../../../../../src/lib/fees';

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
    return NextResponse.json({ success: false, error: 'Cuerpo inválido.' }, { status: 400 });
  }

  const { reserva_id = null, amount } = body;
  const amt = Math.round(Number(amount));
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

  // Validaciones si el pago está asociado a una reserva (anti-manipulación).
  if (reserva_id) {
    const { data: reserva } = await db
      .from('reservas')
      .select('id, conductor_id, precio_total')
      .eq('id', reserva_id)
      .maybeSingle();
    if (reserva) {
      if (reserva.conductor_id !== user.id) {
        return NextResponse.json({ success: false, error: 'No puedes pagar una reserva que no es tuya.' }, { status: 403 });
      }
      if (reserva.precio_total != null && Math.round(Number(reserva.precio_total)) !== amt) {
        return NextResponse.json({ success: false, error: 'El monto no coincide con el de la reserva.' }, { status: 400 });
      }
    }
  }

  // URL de retorno (mismo origen del despliegue).
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const returnUrl = `${proto}://${host}/api/pagos/webpay/return`;

  // buy_order: máx 26 chars; session_id: el id del usuario.
  const buyOrder = `PT${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.slice(0, 26);

  let tbk;
  try {
    tbk = await webpayCreate({ buyOrder, sessionId: user.id, amount: amt, returnUrl });
  } catch (err) {
    console.error('[webpay/init]', err.message);
    return NextResponse.json({ success: false, error: 'No se pudo iniciar el pago con Webpay.' }, { status: 502 });
  }

  // Registramos el pago como pendiente, identificado por el token de Transbank.
  await db.from('payments').insert({
    reserva_id,
    user_id: user.id,
    amount: amt,
    status: 'pending',
    provider: 'webpay',
    transaction_id: tbk.token,
    metadata: { buy_order: buyOrder, ...feeMetadata(amt) },
  });

  // El frontend debe redirigir con POST token_ws=token a esta url.
  return NextResponse.json({ success: true, url: tbk.url, token: tbk.token }, { status: 200 });
}
