import { rateLimit, clientIp } from '../src/lib/rateLimit';

// Claves aleatorias por test para no interferir con el estado en memoria compartido.
const k = (p) => `${p}-${Math.random().toString(36).slice(2)}`;

describe('rateLimit', () => {
  test('permite hasta max accesos y bloquea el siguiente', () => {
    const key = k('limit');
    for (let i = 0; i < 3; i++) {
      expect(rateLimit(key, { max: 3, windowMs: 60_000 }).ok).toBe(true);
    }
    const blocked = rateLimit(key, { max: 3, windowMs: 60_000 });
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  test('claves distintas no comparten contador', () => {
    expect(rateLimit(k('a'), { max: 1 }).ok).toBe(true);
    expect(rateLimit(k('b'), { max: 1 }).ok).toBe(true);
  });

  test('remaining decrece con cada acceso', () => {
    const key = k('rem');
    expect(rateLimit(key, { max: 2 }).remaining).toBe(1);
    expect(rateLimit(key, { max: 2 }).remaining).toBe(0);
  });
});

describe('clientIp', () => {
  const req = (xff) => ({ headers: { get: (h) => (h === 'x-forwarded-for' ? xff : null) } });

  test('toma la primera IP de x-forwarded-for', () => {
    expect(clientIp(req('203.0.113.5, 70.41.3.18'))).toBe('203.0.113.5');
  });

  test('devuelve "unknown" si no hay cabecera', () => {
    expect(clientIp(req(null))).toBe('unknown');
  });
});
