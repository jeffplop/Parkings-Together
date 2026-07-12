import {
  precioCiclo,
  mesesToPayback,
  COMISION_PLATAFORMA,
  PLANES,
  NIVELES_CONDUCTOR,
  BADGES,
} from '../src/lib/planes.js';

// ═══════════════════════════════════════════════════════════════════════════
// precioCiclo
// ═══════════════════════════════════════════════════════════════════════════
describe('precioCiclo', () => {
  test('plan gratuito siempre devuelve 0 independiente del ciclo', () => {
    expect(precioCiclo(0, 'mensual')).toBe(0);
    expect(precioCiclo(0, 'anual')).toBe(0);
  });

  test('ciclo mensual devuelve el precio sin modificar', () => {
    expect(precioCiclo(2990, 'mensual')).toBe(2990);
    expect(precioCiclo(4990, 'mensual')).toBe(4990);
    expect(precioCiclo(7990, 'mensual')).toBe(7990);
  });

  test('ciclo anual equivale a 10 mensualidades (2 meses gratis)', () => {
    expect(precioCiclo(2990, 'anual')).toBe(29900);
    expect(precioCiclo(4990, 'anual')).toBe(49900);
    expect(precioCiclo(7990, 'anual')).toBe(79900);
  });

  test('ciclo desconocido se trata como mensual', () => {
    expect(precioCiclo(2990, 'trimestral')).toBe(2990);
    expect(precioCiclo(2990, undefined)).toBe(2990);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// mesesToPayback
// ═══════════════════════════════════════════════════════════════════════════
describe('mesesToPayback', () => {
  test('calcula correctamente con la tarifa de comisión por defecto (8%)', () => {
    // Pro = $2990/mes, reserva promedio = $10000
    // ahorro por reserva = 10000 * 0.08 = 800
    // reservas necesarias/mes = ceil(2990/800) = ceil(3.7375) = 4
    expect(mesesToPayback(2990, 10000)).toBe(4);
  });

  test('precio de reserva más alto implica menos reservas para amortizar', () => {
    // Pro = $2990, reserva = $50000, ahorro = 4000/reserva → ceil(0.7475) = 1
    expect(mesesToPayback(2990, 50000)).toBe(1);
  });

  test('con precio de reserva bajo se necesitan más reservas para amortizar', () => {
    // Pro = $2990, reserva = $1000, ahorro = 80/reserva → ceil(37.375) = 38
    expect(mesesToPayback(2990, 1000)).toBe(38);
  });

  test('COMISION_PLATAFORMA es 8', () => {
    expect(COMISION_PLATAFORMA).toBe(8);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PLANES — estructura del catálogo
// ═══════════════════════════════════════════════════════════════════════════
describe('PLANES — estructura del catálogo', () => {
  test('tiene categorías conductor y arrendador', () => {
    expect(PLANES).toHaveProperty('conductor');
    expect(PLANES).toHaveProperty('arrendador');
  });

  test('conductor tiene 2 planes: free y pro', () => {
    expect(PLANES.conductor).toHaveLength(2);
    expect(PLANES.conductor.map(p => p.id)).toEqual(['free', 'pro']);
  });

  test('arrendador tiene 3 planes: free, plus y premium', () => {
    expect(PLANES.arrendador).toHaveLength(3);
    expect(PLANES.arrendador.map(p => p.id)).toEqual(['free', 'plus', 'premium']);
  });

  test('el plan conductor free tiene precio 0', () => {
    const libre = PLANES.conductor.find(p => p.id === 'free');
    expect(libre.precioMensual).toBe(0);
  });

  test('el plan conductor pro cuesta $2990/mes', () => {
    const pro = PLANES.conductor.find(p => p.id === 'pro');
    expect(pro.precioMensual).toBe(2990);
  });

  test('solo un plan de conductor está marcado como destacado', () => {
    const destacados = PLANES.conductor.filter(p => p.destacado);
    expect(destacados).toHaveLength(1);
    expect(destacados[0].id).toBe('pro');
  });

  test('cada plan tiene los campos obligatorios', () => {
    const campos = ['id', 'nombre', 'tagline', 'precioMensual', 'beneficios'];
    [...PLANES.conductor, ...PLANES.arrendador].forEach(plan => {
      campos.forEach(campo => expect(plan).toHaveProperty(campo));
    });
  });

  test('todos los beneficios tienen txt y ok', () => {
    [...PLANES.conductor, ...PLANES.arrendador].forEach(plan => {
      plan.beneficios.forEach(b => {
        expect(b).toHaveProperty('txt');
        expect(b).toHaveProperty('ok');
        expect(typeof b.ok).toBe('boolean');
      });
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// NIVELES_CONDUCTOR — gamificación
// ═══════════════════════════════════════════════════════════════════════════
describe('NIVELES_CONDUCTOR', () => {
  test('hay exactamente 4 niveles', () => {
    expect(NIVELES_CONDUCTOR).toHaveLength(4);
  });

  test('los IDs son novato → regular → frecuente → elite', () => {
    expect(NIVELES_CONDUCTOR.map(n => n.id)).toEqual([
      'novato', 'regular', 'frecuente', 'elite',
    ]);
  });

  test('los niveles están ordenados de menor a mayor (min ascendente)', () => {
    for (let i = 1; i < NIVELES_CONDUCTOR.length; i++) {
      expect(NIVELES_CONDUCTOR[i].min).toBeGreaterThan(NIVELES_CONDUCTOR[i - 1].min);
    }
  });

  test('el nivel novato comienza en 0 reservas', () => {
    expect(NIVELES_CONDUCTOR[0].min).toBe(0);
  });

  test('cada nivel tiene id, label, min, icon y color', () => {
    NIVELES_CONDUCTOR.forEach(n => {
      expect(n).toHaveProperty('id');
      expect(n).toHaveProperty('label');
      expect(n).toHaveProperty('min');
      expect(n).toHaveProperty('icon');
      expect(n).toHaveProperty('color');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BADGES
// ═══════════════════════════════════════════════════════════════════════════
describe('BADGES', () => {
  test('hay al menos 3 badges definidos', () => {
    expect(BADGES.length).toBeGreaterThanOrEqual(3);
  });

  test('cada badge tiene id, label, icon y desc', () => {
    BADGES.forEach(b => {
      expect(b).toHaveProperty('id');
      expect(b).toHaveProperty('label');
      expect(b).toHaveProperty('icon');
      expect(b).toHaveProperty('desc');
    });
  });

  test('primera_reserva badge existe', () => {
    const badge = BADGES.find(b => b.id === 'primera_reserva');
    expect(badge).toBeDefined();
  });

  test('los IDs de los badges son únicos', () => {
    const ids = BADGES.map(b => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
