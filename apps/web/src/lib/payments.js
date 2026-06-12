// ════════════════════════════════════════════════════════════════════════════
// Capa de abstracción de pagos
// ────────────────────────────────────────────────────────────────────────────
// Aísla la ruta /api/pagos del proveedor concreto. Hoy soporta:
//   • 'mock'     → cobro simulado e inmediato (demos / desarrollo)
//   • 'efectivo' → pago al llegar; queda 'pending' hasta que el arrendador cobre
//   • 'webpay'   → punto de integración real con Transbank (Webpay Plus)
//
// Todos los proveedores devuelven un resultado uniforme:
//   { status: 'completed' | 'pending' | 'failed', transactionId: string, raw: object }
//
// Para activar Webpay real:
//   1. npm i @transbank/sdk
//   2. Definir TRANSBANK_COMMERCE_CODE, TRANSBANK_API_KEY y TRANSBANK_ENV.
//   3. Descomentar el bloque de integración en chargeWebpay() y el commit en el
//      endpoint de retorno (return_url) / webhook.
// ════════════════════════════════════════════════════════════════════════════

export const PAYMENT_PROVIDERS = Object.freeze(['mock', 'efectivo', 'webpay']);

export function isValidProvider(provider) {
  return PAYMENT_PROVIDERS.includes(provider);
}

export function genTransactionId(prefix = 'TXN') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export function isWebpayConfigured() {
  return Boolean(process.env.TRANSBANK_COMMERCE_CODE && process.env.TRANSBANK_API_KEY);
}

// ── Proveedores ─────────────────────────────────────────────────────────────

async function chargeMock({ amount }) {
  return { status: 'completed', transactionId: genTransactionId('TXN'), raw: { simulated: true, amount } };
}

async function chargeEfectivo() {
  // El dinero se entrega en persona: la reserva queda pagada al confirmarse en sitio.
  return { status: 'pending', transactionId: genTransactionId('CASH'), raw: { method: 'efectivo' } };
}

async function chargeWebpay({ amount, buyOrder, sessionId, returnUrl }) {
  if (!isWebpayConfigured()) {
    // Sin credenciales de Transbank: se simula para no bloquear el flujo en
    // demos/desarrollo. En producción, define las variables de entorno.
    return {
      status: 'completed',
      transactionId: genTransactionId('WP-SIM'),
      raw: { simulated: true, provider: 'webpay', note: 'Transbank no configurado — cobro simulado' },
    };
  }

  // ── Integración real con Transbank (activar tras `npm i @transbank/sdk`) ──
  // const { WebpayPlus, Options, Environment } = await import('@transbank/sdk');
  // const env = process.env.TRANSBANK_ENV === 'production'
  //   ? Environment.Production : Environment.Integration;
  // const options = new Options(
  //   process.env.TRANSBANK_COMMERCE_CODE,
  //   process.env.TRANSBANK_API_KEY,
  //   env,
  // );
  // const resp = await new WebpayPlus.Transaction(options)
  //   .create(buyOrder, sessionId, amount, returnUrl);
  // // resp.url + resp.token → el cliente debe redirigir a resp.url?token_ws=resp.token
  // // El commit se hace en el endpoint de retorno con .commit(token).
  // return { status: 'pending', transactionId: resp.token, raw: resp };

  return {
    status: 'completed',
    transactionId: genTransactionId('WP'),
    raw: { configured: true, pendingImplementation: true },
  };
}

/**
 * Punto de entrada único. Crea un cobro con el proveedor indicado.
 * @param {'mock'|'efectivo'|'webpay'} provider
 * @param {{ amount:number, buyOrder?:string, sessionId?:string, returnUrl?:string, metadata?:object }} params
 * @returns {Promise<{status:string, transactionId:string, raw:object}>}
 */
export async function createCharge(provider, params = {}) {
  switch (provider) {
    case 'webpay':   return chargeWebpay(params);
    case 'efectivo': return chargeEfectivo(params);
    case 'mock':
    default:         return chargeMock(params);
  }
}
