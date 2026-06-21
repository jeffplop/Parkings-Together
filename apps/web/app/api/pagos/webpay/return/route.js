// apps/web/app/api/pagos/webpay/return/route.js
//
// URL de retorno de Webpay. Transbank redirige aquí (POST con token_ws al pagar, o
// TBK_TOKEN si el usuario aborta). Confirma la transacción (commit), actualiza el
// pago y redirige al usuario a la pantalla de resultado.

import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@parkings/supabase-db';
import { webpayCommit } from '../../../../../src/lib/webpay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function origin(request) {
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  return `${proto}://${host}`;
}

async function readParams(request) {
  const url = new URL(request.url);
  const q = url.searchParams;
  if (request.method === 'POST') {
    try {
      const form = await request.formData();
      return {
        token_ws: form.get('token_ws') || q.get('token_ws'),
        tbk_token: form.get('TBK_TOKEN') || q.get('TBK_TOKEN'),
      };
    } catch {
      /* sin cuerpo de formulario */
    }
  }
  return { token_ws: q.get('token_ws'), tbk_token: q.get('TBK_TOKEN') };
}

async function handle(request) {
  const base = origin(request);
  const redir = (estado, extra = '') =>
    NextResponse.redirect(`${base}/pago/resultado?estado=${estado}${extra}`, 303);

  const { token_ws, tbk_token } = await readParams(request);

  // El usuario abortó o expiró el formulario (sin token_ws).
  if (!token_ws) {
    if (tbk_token) {
      try {
        await getServiceSupabase()
          .from('payments')
          .update({ status: 'cancelled' })
          .eq('transaction_id', tbk_token);
      } catch { /* best-effort */ }
    }
    return redir('cancelado');
  }

  let result;
  try {
    result = await webpayCommit(token_ws);
  } catch (err) {
    console.error('[webpay/return] commit', err.message);
    return redir('error');
  }

  const aprobado = result?.response_code === 0 && result?.status === 'AUTHORIZED';
  const monto = Math.round(Number(result?.amount || 0));

  try {
    await getServiceSupabase()
      .from('payments')
      .update({
        status: aprobado ? 'completed' : 'failed',
        metadata: {
          buy_order: result?.buy_order,
          authorization_code: result?.authorization_code,
          payment_type_code: result?.payment_type_code,
          response_code: result?.response_code,
          card_last4: result?.card_detail?.card_number,
        },
      })
      .eq('transaction_id', token_ws);
  } catch (err) {
    console.error('[webpay/return] update', err.message);
  }

  return redir(aprobado ? 'ok' : 'error', `&monto=${monto}`);
}

export async function POST(request) {
  return handle(request);
}
export async function GET(request) {
  return handle(request);
}
