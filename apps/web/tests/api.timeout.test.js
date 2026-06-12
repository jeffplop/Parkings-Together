import { api } from '../src/lib/api';

describe('BFF: Timeout y Fallback', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test('Debe devolver los datos correctamente si fetch responde a tiempo', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: ['estacionamiento_1'] })
    });

    const result = await api.mapas.getMisEstacionamientos('user-123');
    expect(result.data).toEqual(['estacionamiento_1']);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('Debe abortar la petición y devolver fallback si supera el timeout (8s)', async () => {
    // Simulamos un fetch que se queda colgado pero respeta el AbortSignal
    global.fetch.mockImplementation((url, options) => {
      return new Promise((resolve, reject) => {
        if (options && options.signal) {
          options.signal.addEventListener('abort', () => reject(new Error('AbortError')));
        }
      });
    });

    const promise = api.mapas.getMisEstacionamientos('user-123');

    // Avanzamos el reloj de Jest más allá del límite estricto de 8 s de fetchWithTimeout
    jest.advanceTimersByTime(8500);

    const result = await promise;

    expect(result).toEqual({
      success: false,
      error: true,
      message: 'El servicio está experimentando latencia o no está disponible.',
      data: [],
      fallback: true
    });
  });
});
