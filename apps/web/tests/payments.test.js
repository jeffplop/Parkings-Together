import { createCharge, isValidProvider, genTransactionId, isWebpayConfigured, PAYMENT_PROVIDERS } from '../src/lib/payments.js';

// ═══════════════════════════════════════════════════════════════════════════
// isValidProvider
// ═══════════════════════════════════════════════════════════════════════════
describe('isValidProvider', () => {
  test.each(PAYMENT_PROVIDERS)('"%s" es un proveedor válido', (p) => {
    expect(isValidProvider(p)).toBe(true);
  });

  test.each(['paypal', 'stripe', '', null, undefined, 'MOCK'])(
    '"%s" no es un proveedor válido',
    (p) => { expect(isValidProvider(p)).toBe(false); }
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// genTransactionId
// ═══════════════════════════════════════════════════════════════════════════
describe('genTransactionId', () => {
  test('incluye el prefijo por defecto "TXN"', () => {
    expect(genTransactionId()).toMatch(/^TXN-/);
  });

  test('incluye el prefijo personalizado', () => {
    expect(genTransactionId('CASH')).toMatch(/^CASH-/);
    expect(genTransactionId('WP')).toMatch(/^WP-/);
  });

  test('genera IDs únicos en llamadas sucesivas', () => {
    const ids = new Set(Array.from({ length: 20 }, () => genTransactionId()));
    expect(ids.size).toBe(20);
  });

  test('el ID tiene el formato PREFIX-timestamp-random', () => {
    const id = genTransactionId('TEST');
    expect(id).toMatch(/^TEST-\d+-[A-Z0-9]+$/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// isWebpayConfigured
// ═══════════════════════════════════════════════════════════════════════════
describe('isWebpayConfigured', () => {
  const origCode = process.env.TRANSBANK_COMMERCE_CODE;
  const origKey  = process.env.TRANSBANK_API_KEY;

  afterEach(() => {
    process.env.TRANSBANK_COMMERCE_CODE = origCode;
    process.env.TRANSBANK_API_KEY       = origKey;
  });

  test('devuelve false si faltan las dos variables de entorno', () => {
    delete process.env.TRANSBANK_COMMERCE_CODE;
    delete process.env.TRANSBANK_API_KEY;
    expect(isWebpayConfigured()).toBe(false);
  });

  test('devuelve false si solo está TRANSBANK_COMMERCE_CODE', () => {
    process.env.TRANSBANK_COMMERCE_CODE = '597055555532';
    delete process.env.TRANSBANK_API_KEY;
    expect(isWebpayConfigured()).toBe(false);
  });

  test('devuelve false si solo está TRANSBANK_API_KEY', () => {
    delete process.env.TRANSBANK_COMMERCE_CODE;
    process.env.TRANSBANK_API_KEY = 'testApiKey';
    expect(isWebpayConfigured()).toBe(false);
  });

  test('devuelve true cuando ambas variables están presentes', () => {
    process.env.TRANSBANK_COMMERCE_CODE = '597055555532';
    process.env.TRANSBANK_API_KEY       = 'testApiKey';
    expect(isWebpayConfigured()).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// createCharge
// ═══════════════════════════════════════════════════════════════════════════
describe('createCharge', () => {
  const params = { amount: 5000, buyOrder: 'ORD-123', sessionId: 'user-abc' };

  describe('proveedor "mock"', () => {
    test('devuelve status "completed"', async () => {
      const r = await createCharge('mock', params);
      expect(r.status).toBe('completed');
    });

    test('devuelve transactionId con prefijo "TXN"', async () => {
      const r = await createCharge('mock', params);
      expect(r.transactionId).toMatch(/^TXN-/);
    });

    test('raw.simulated es true', async () => {
      const r = await createCharge('mock', params);
      expect(r.raw.simulated).toBe(true);
    });

    test('raw.amount coincide con el amount enviado', async () => {
      const r = await createCharge('mock', { ...params, amount: 12345 });
      expect(r.raw.amount).toBe(12345);
    });
  });

  describe('proveedor "efectivo"', () => {
    test('devuelve status "pending"', async () => {
      const r = await createCharge('efectivo', params);
      expect(r.status).toBe('pending');
    });

    test('transactionId comienza con "CASH"', async () => {
      const r = await createCharge('efectivo', params);
      expect(r.transactionId).toMatch(/^CASH-/);
    });

    test('raw.method es "efectivo"', async () => {
      const r = await createCharge('efectivo', params);
      expect(r.raw.method).toBe('efectivo');
    });
  });

  describe('proveedor "webpay" sin configurar (simulado)', () => {
    beforeEach(() => {
      delete process.env.TRANSBANK_COMMERCE_CODE;
      delete process.env.TRANSBANK_API_KEY;
    });

    test('devuelve status "completed" cuando no hay credenciales', async () => {
      const r = await createCharge('webpay', params);
      expect(r.status).toBe('completed');
    });

    test('transactionId comienza con "WP-SIM"', async () => {
      const r = await createCharge('webpay', params);
      expect(r.transactionId).toMatch(/^WP-SIM-/);
    });

    test('raw.simulated es true', async () => {
      const r = await createCharge('webpay', params);
      expect(r.raw.simulated).toBe(true);
    });
  });

  describe('resultado uniforme', () => {
    test.each(PAYMENT_PROVIDERS)('"%s" devuelve { status, transactionId, raw }', async (p) => {
      const r = await createCharge(p, params);
      expect(r).toHaveProperty('status');
      expect(r).toHaveProperty('transactionId');
      expect(r).toHaveProperty('raw');
      expect(typeof r.status).toBe('string');
      expect(typeof r.transactionId).toBe('string');
      expect(typeof r.raw).toBe('object');
    });
  });
});
