// ════════════════════════════════════════════════════════════════════════════
// Capa de abstracción de pagos (patrón Strategy)
// ────────────────────────────────────────────────────────────────────────────
// Aísla la ruta POST /api/pagos del proveedor concreto. Soporta:
//   • 'mock'     → cobro simulado e inmediato (demos / desarrollo)
//   • 'efectivo' → pago al llegar; queda 'pending' hasta que el arrendador cobre
//   • 'webpay'   → registro simulado, para dejar constancia del pago en la reserva
//
// Todos los proveedores devuelven un resultado uniforme:
//   { status: 'completed' | 'pending' | 'failed', transactionId: string, raw: object }
//
// ⚠️  IMPORTANTE — el cobro REAL con Webpay NO pasa por aquí.
//
// Webpay Plus exige un flujo con redirección (crear transacción → el usuario paga
// en el sitio de Transbank → vuelve al `return_url` → se confirma con *commit*),
// que no encaja en la firma síncrona `charge() → resultado` de esta capa.
//
// La integración real vive en:
//   • `src/lib/webpay.js`                  — cliente REST de Transbank (sin SDK)
//   • `app/api/pagos/webpay/init/route.js` — crea la transacción y devuelve la URL
//   • `app/api/pagos/webpay/return/route.js` — confirma (commit) al regresar
//
// Y se configura con las variables `TBK_ENV`, `TBK_COMMERCE_CODE` y `TBK_API_KEY`
// (por defecto: ambiente de INTEGRACIÓN de Transbank con credenciales públicas de
// prueba). Ojo: son distintas de las `TRANSBANK_*` que lee `isWebpayConfigured()`
// más abajo, que solo gobiernan esta ruta simulada.
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

// Registro de un pago marcado como 'webpay' desde POST /api/pagos.
//
// El cobro real NO ocurre aquí: Webpay exige redirección y se implementa en
// `src/lib/webpay.js` + `app/api/pagos/webpay/{init,return}` (ver la cabecera de
// este archivo). Esta función solo deja constancia del pago asociado a la reserva
// cuando el flujo con redirección no se ha usado.
async function chargeWebpay() {
  if (!isWebpayConfigured()) {
    return {
      status: 'completed',
      transactionId: genTransactionId('WP-SIM'),
      raw: {
        simulated: true,
        provider: 'webpay',
        note: 'Registro simulado. El cobro real se hace en /api/pagos/webpay/init.',
      },
    };
  }

  return {
    status: 'completed',
    transactionId: genTransactionId('WP'),
    raw: {
      configured: true,
      note: 'Registro simulado. El cobro real se hace en /api/pagos/webpay/init.',
    },
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
