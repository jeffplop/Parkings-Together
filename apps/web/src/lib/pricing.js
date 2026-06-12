// Lógica de cálculo de precio por tiempo. Extracción de ParkingSelector para poder
// testear estas funciones puras de forma aislada sin montar el componente React.

/**
 * Calcula el precio total aplicando tarifas de mayor a menor granularidad:
 * 1. días completos al precio/día
 * 2. horas completas al precio/hora
 * 3. minutos restantes al precio/minuto; si no hay precio por minuto, redondea
 *    al siguiente bloque disponible (hora o día).
 */
export function calcTotal(days, hours, mins, parking) {
  const pMin  = parking.price_per_minute;
  const pHour = parking.precio_hora;
  const pDay  = parking.price_per_day;

  let remaining = days * 1440 + hours * 60 + mins;
  if (remaining <= 0) return 0;

  let total = 0;

  if (pDay && remaining >= 1440) {
    const d  = Math.floor(remaining / 1440);
    total    += d * pDay;
    remaining -= d * 1440;
  }
  if (pHour && remaining >= 60) {
    const h  = Math.floor(remaining / 60);
    total    += h * pHour;
    remaining -= h * 60;
  }
  if (remaining > 0) {
    if (pMin)       total += remaining * pMin;
    else if (pHour) total += pHour;   // redondea al siguiente bloque de 1 hora
    else if (pDay)  total += pDay;    // redondea al siguiente día
  }

  return Math.round(total);
}

/**
 * Devuelve un array de líneas de detalle para mostrar en la UI.
 * Misma lógica escalonada que calcTotal.
 */
export function calcBreakdown(days, hours, mins, parking) {
  const pMin  = parking.price_per_minute;
  const pHour = parking.precio_hora;
  const pDay  = parking.price_per_day;
  const lines = [];

  let remaining = days * 1440 + hours * 60 + mins;
  if (remaining <= 0) return lines;

  if (pDay && remaining >= 1440) {
    const d = Math.floor(remaining / 1440);
    lines.push({ label: `${d} día${d > 1 ? 's' : ''}`, rate: `$${pDay.toLocaleString()}/día`, sub: d * pDay });
    remaining -= d * 1440;
  }
  if (pHour && remaining >= 60) {
    const h = Math.floor(remaining / 60);
    lines.push({ label: `${h} hora${h > 1 ? 's' : ''}`, rate: `$${pHour.toLocaleString()}/hr`, sub: h * pHour });
    remaining -= h * 60;
  }
  if (remaining > 0) {
    if (pMin) {
      lines.push({ label: `${remaining} min`, rate: `$${pMin.toLocaleString()}/min`, sub: remaining * pMin });
    } else if (pHour) {
      lines.push({ label: `${remaining} min (redondeo a 1h)`, rate: `$${pHour.toLocaleString()}/hr`, sub: pHour });
    } else if (pDay) {
      lines.push({ label: `${remaining} min (redondeo a 1 día)`, rate: `$${pDay.toLocaleString()}/día`, sub: pDay });
    }
  }
  return lines;
}
