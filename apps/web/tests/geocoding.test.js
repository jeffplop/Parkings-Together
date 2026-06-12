import { detectarRegion, REGIONES } from '../src/lib/comunas-chile.js';

describe('REGIONES — estructura del catálogo', () => {
  test('exporta exactamente 16 regiones (todas las de Chile)', () => {
    expect(REGIONES).toHaveLength(16);
  });

  test('cada región tiene id, nombre, límites lat/lng y comunas', () => {
    REGIONES.forEach(r => {
      expect(typeof r.id).toBe('string');
      expect(typeof r.nombre).toBe('string');
      expect(typeof r.latMin).toBe('number');
      expect(typeof r.latMax).toBe('number');
      expect(typeof r.lngMin).toBe('number');
      expect(typeof r.lngMax).toBe('number');
      expect(Array.isArray(r.comunas)).toBe(true);
      expect(r.comunas.length).toBeGreaterThan(0);
    });
  });

  test('los límites son coherentes (min < max) en todas las regiones', () => {
    REGIONES.forEach(r => {
      expect(r.latMin).toBeLessThan(r.latMax);
      expect(r.lngMin).toBeLessThan(r.lngMax);
    });
  });
});

describe('detectarRegion — detección por coordenadas', () => {
  test('coordenadas del centro de Santiago → Región Metropolitana', () => {
    const r = detectarRegion(-33.45, -70.65);
    expect(r).not.toBeNull();
    expect(r.nombre).toContain('Metropolitana');
  });

  test('Valparaíso (costas) → V Región', () => {
    const r = detectarRegion(-33.04, -71.62);
    expect(r).not.toBeNull();
    expect(r.nombre).toContain('Valparaíso');
  });

  test('coordenadas fuera de Chile (Brasil) → null', () => {
    expect(detectarRegion(-10, -50)).toBeNull();
  });

  test('coordenadas fuera de Chile (Europa) → null', () => {
    expect(detectarRegion(48.85, 2.35)).toBeNull();
  });

  test('retorna un objeto de REGIONES (no una copia)', () => {
    const r = detectarRegion(-33.45, -70.65);
    expect(REGIONES).toContain(r);
  });
});
