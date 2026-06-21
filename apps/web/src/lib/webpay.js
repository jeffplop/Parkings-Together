// apps/web/src/lib/webpay.js
//
// Cliente REST de Webpay Plus (Transbank), sin dependencias. Implementa el flujo
// de pago con redirección: crear transacción -> el usuario paga en Transbank ->
// vuelve al return_url -> confirmar (commit).
//
// Por defecto usa el AMBIENTE DE INTEGRACIÓN con las credenciales públicas de
// prueba de Transbank (tarjetas de prueba, sin dinero real). Para PRODUCCIÓN,
// definir TBK_ENV=production, TBK_COMMERCE_CODE y TBK_API_KEY (de tu cuenta de
// comercio real de Transbank).

const ENV = process.env.TBK_ENV || 'integration';

const BASE =
  ENV === 'production'
    ? 'https://webpay3g.transbank.cl'
    : 'https://webpay3gint.transbank.cl';

// Credenciales públicas de INTEGRACIÓN de Transbank (Webpay Plus) — solo pruebas.
const COMMERCE_CODE = process.env.TBK_COMMERCE_CODE || '597055555532';
const API_KEY =
  process.env.TBK_API_KEY ||
  '579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C';

const API = `${BASE}/rswebpaytransaction/api/webpay/v1.2/transactions`;

const headers = () => ({
  'Tbk-Api-Key-Id': COMMERCE_CODE,
  'Tbk-Api-Key-Secret': API_KEY,
  'Content-Type': 'application/json',
});

export function webpayIsProduction() {
  return ENV === 'production';
}

/**
 * Crea una transacción. Devuelve { token, url }. El frontend debe redirigir
 * (POST token_ws=token) a `url` para que el usuario pague en Transbank.
 */
export async function webpayCreate({ buyOrder, sessionId, amount, returnUrl }) {
  const res = await fetch(API, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      buy_order: String(buyOrder).slice(0, 26),
      session_id: String(sessionId).slice(0, 61),
      amount: Math.round(Number(amount)),
      return_url: returnUrl,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    const e = new Error(`Webpay create ${res.status}: ${detail.slice(0, 300)}`);
    e.status = res.status;
    throw e;
  }
  return res.json(); // { token, url }
}

/** Confirma (commit) una transacción tras el retorno. Devuelve el resultado. */
export async function webpayCommit(token) {
  const res = await fetch(`${API}/${token}`, { method: 'PUT', headers: headers() });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    const e = new Error(`Webpay commit ${res.status}: ${detail.slice(0, 300)}`);
    e.status = res.status;
    throw e;
  }
  return res.json(); // { status, response_code, amount, buy_order, card_detail, ... }
}
