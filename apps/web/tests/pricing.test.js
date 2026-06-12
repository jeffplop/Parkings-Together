import { calcTotal, calcBreakdown } from '../src/lib/pricing.js';

// ─── Fixtures ───────────────────────────────────────────────────────────────
const soloHora   = { precio_hora: 1000, price_per_minute: null,  price_per_day: null  };
const soloMin    = { precio_hora: null,  price_per_minute: 20,    price_per_day: null  };
const soloDia    = { precio_hora: null,  price_per_minute: null,  price_per_day: 10000 };
const completo   = { precio_hora: 1000, price_per_minute: 20,    price_per_day: 10000 };
const gratuito   = { precio_hora: null,  price_per_minute: null,  price_per_day: null  };
const horaDia    = { precio_hora: 1500, price_per_minute: null,  price_per_day: 12000 };


// ═══════════════════════════════════════════════════════════════════════════
// calcTotal
// ═══════════════════════════════════════════════════════════════════════════
describe('calcTotal — precio total por duración', () => {

  describe('casos base', () => {
    test('duración 0 → $0 con cualquier tarifa', () => {
      expect(calcTotal(0, 0, 0, soloHora)).toBe(0);
      expect(calcTotal(0, 0, 0, completo)).toBe(0);
    });

    test('estacionamiento gratuito (sin tarifas) → $0 siempre', () => {
      expect(calcTotal(0, 2, 30, gratuito)).toBe(0);
      expect(calcTotal(2, 0, 0,  gratuito)).toBe(0);
    });
  });

  describe('tarifa solo por hora', () => {
    test('1 hora exacta = $1.000', () => {
      expect(calcTotal(0, 1, 0, soloHora)).toBe(1000);
    });

    test('2 horas exactas = $2.000', () => {
      expect(calcTotal(0, 2, 0, soloHora)).toBe(2000);
    });

    test('fracción de hora (30 min) → redondea a 1 hora = $1.000', () => {
      expect(calcTotal(0, 0, 30, soloHora)).toBe(1000);
    });

    test('1h 30min → 2 horas (redondeo) = $2.000', () => {
      expect(calcTotal(0, 1, 30, soloHora)).toBe(2000);
    });
  });

  describe('tarifa solo por minuto', () => {
    test('45 min × $20 = $900', () => {
      expect(calcTotal(0, 0, 45, soloMin)).toBe(900);
    });

    test('1 hora (60 min) × $20 = $1.200', () => {
      expect(calcTotal(0, 1, 0, soloMin)).toBe(1200);
    });
  });

  describe('tarifa solo por día', () => {
    test('1 día exacto = $10.000', () => {
      expect(calcTotal(1, 0, 0, soloDia)).toBe(10000);
    });

    test('2 días = $20.000', () => {
      expect(calcTotal(2, 0, 0, soloDia)).toBe(20000);
    });

    test('1 día + 3 horas → redondea a 2 días = $20.000', () => {
      expect(calcTotal(1, 3, 0, soloDia)).toBe(20000);
    });

    test('solo minutos con tarifa por día → redondea a 1 día = $10.000', () => {
      expect(calcTotal(0, 0, 45, soloDia)).toBe(10000);
    });
  });

  describe('tarifas combinadas', () => {
    test('1 día + 2 horas + 30 min con tarifa completa', () => {
      // 1 día $10.000 + 2 horas $2.000 + 30 min × $20 ($600) = $12.600
      expect(calcTotal(1, 2, 30, completo)).toBe(12600);
    });

    test('1 día + 30 min (sin tarifa por minuto → redondea 30 min a 1 hora)', () => {
      // 1 día $12.000 + redondeo a 1h $1.500 = $13.500
      expect(calcTotal(1, 0, 30, horaDia)).toBe(13500);
    });

    test('solo horas con tarifa hora+día', () => {
      // 3 horas < 1 día → se cobra como horas: 3 × $1.500 = $4.500
      expect(calcTotal(0, 3, 0, horaDia)).toBe(4500);
    });
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// calcBreakdown
// ═══════════════════════════════════════════════════════════════════════════
describe('calcBreakdown — líneas de detalle de precio', () => {

  test('duración 0 → array vacío', () => {
    expect(calcBreakdown(0, 0, 0, completo)).toEqual([]);
  });

  test('1 día → 1 línea con label "1 día"', () => {
    const lines = calcBreakdown(1, 0, 0, completo);
    expect(lines).toHaveLength(1);
    expect(lines[0].label).toBe('1 día');
    expect(lines[0].sub).toBe(10000);
  });

  test('2 días → label plural "2 días"', () => {
    const lines = calcBreakdown(2, 0, 0, completo);
    expect(lines[0].label).toBe('2 días');
  });

  test('2 horas → label "2 horas"', () => {
    const lines = calcBreakdown(0, 2, 0, soloHora);
    expect(lines).toHaveLength(1);
    expect(lines[0].label).toBe('2 horas');
    expect(lines[0].sub).toBe(2000);
  });

  test('1 hora exacta → label singular "1 hora"', () => {
    const lines = calcBreakdown(0, 1, 0, soloHora);
    expect(lines[0].label).toBe('1 hora');
  });

  test('1 hora + 30 min → 2 líneas (hora + minutos)', () => {
    const lines = calcBreakdown(0, 1, 30, completo);
    expect(lines).toHaveLength(2);
    expect(lines[0].label).toBe('1 hora');
    expect(lines[1].label).toBe('30 min');
  });

  test('fracción de hora sin tarifa por minuto → línea de redondeo', () => {
    const lines = calcBreakdown(0, 0, 30, soloHora);
    expect(lines).toHaveLength(1);
    expect(lines[0].label).toContain('redondeo a 1h');
  });

  test('fracción con solo tarifa por día → línea de redondeo a día', () => {
    const lines = calcBreakdown(0, 0, 45, soloDia);
    expect(lines).toHaveLength(1);
    expect(lines[0].label).toContain('redondeo a 1 día');
  });

  test('la suma de sub en todas las líneas coincide con calcTotal', () => {
    const p = completo;
    const lines = calcBreakdown(1, 2, 30, p);
    const sumaBreakdown = lines.reduce((acc, l) => acc + l.sub, 0);
    expect(sumaBreakdown).toBe(calcTotal(1, 2, 30, p));
  });
});
