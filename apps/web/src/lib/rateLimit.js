// Rate limiter en memoria, por IP. Compartido por los route handlers que deben
// protegerse de abuso (signup, chat de soporte con IA, etc.).
//
// LIMITACIÓN CONOCIDA: el estado vive en memoria del proceso, por lo que en un
// entorno serverless (Vercel) es "best-effort" — cada instancia/lambda tiene su
// propio contador y los límites no se comparten entre instancias. Es una mitigación
// de primera línea contra abuso básico; para límites estrictos en producción usar
// un store compartido (Upstash/Redis).

const buckets = new Map();

/**
 * Registra un acceso y dice si está dentro del límite.
 * @param {string} key  Identificador del cliente (normalmente la IP).
 * @param {{max?:number, windowMs?:number}} opts  max accesos por ventana.
 * @returns {{ok:boolean, remaining:number, retryAfterMs:number}}
 */
export function rateLimit(key, { max = 20, windowMs = 60_000 } = {}) {
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || now - entry.start > windowMs) {
    buckets.set(key, { start: now, count: 1 });
    return { ok: true, remaining: max - 1, retryAfterMs: 0 };
  }

  entry.count++;
  const ok = entry.count <= max;
  return {
    ok,
    remaining: Math.max(0, max - entry.count),
    retryAfterMs: ok ? 0 : entry.start + windowMs - now,
  };
}

/** Extrae la IP del cliente desde las cabeceras del proxy de Vercel. */
export function clientIp(request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}
