// apps/web/src/lib/fees.js
//
// Comisión de la plataforma sobre cada pago.
//
// El usuario paga el total a Parkings Together (un único comercio Transbank).
// De ese total, la plataforma retiene una comisión y el resto es lo que se le
// debe liquidar al dueño del estacionamiento:
//
//   platform_fee = ingreso de Parkings Together
//   owner_payout = amount - platform_fee   (lo que recibe el dueño)
//
// El porcentaje se configura con la variable de entorno PLATFORM_FEE_PCT
// (0–100). Por defecto 10%.

export const PLATFORM_FEE_PCT = (() => {
  const v = Number(process.env.PLATFORM_FEE_PCT);
  return Number.isFinite(v) && v >= 0 && v <= 100 ? v : 10;
})();

/**
 * Divide un monto entre la comisión de la plataforma y el pago al dueño.
 * @param {number} amount Monto total cobrado al usuario (CLP).
 * @param {number} [pct]  Porcentaje de comisión (0–100).
 * @returns {{ amount:number, platformFee:number, ownerPayout:number, feePct:number }}
 */
export function splitAmount(amount, pct = PLATFORM_FEE_PCT) {
  const total = Math.max(0, Math.round(Number(amount) || 0));
  const p = Number.isFinite(pct) && pct >= 0 && pct <= 100 ? pct : PLATFORM_FEE_PCT;
  const platformFee = Math.min(total, Math.round((total * p) / 100));
  return { amount: total, platformFee, ownerPayout: total - platformFee, feePct: p };
}

/**
 * Campos de comisión listos para fusionar en el `metadata` de un pago.
 * @returns {{ fee_pct:number, platform_fee:number, owner_payout:number }}
 */
export function feeMetadata(amount, pct = PLATFORM_FEE_PCT) {
  const { platformFee, ownerPayout, feePct } = splitAmount(amount, pct);
  return { fee_pct: feePct, platform_fee: platformFee, owner_payout: ownerPayout };
}
