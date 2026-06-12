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

  test('Debe abortar la petición y devolver fallback si toma más de 4s', async () => {
    // Simulamos un fetch que se queda colgado pero respeta el AbortSignal
    global.fetch.mockImplementation((_url, options) => {
      return new Promise((_resolve, reject) => {
        if (options?.signal) {
          options.signal.addEventListener('abort', () => reject(new Error('AbortError')));
        }
      });
    });

    const promise = api.mapas.getMisEstacionamientos('user-123');

    // Avanzamos el reloj más de 4s y dejamos que todos los microtasks se resuelvan
    await jest.runAllTimersAsync();

    const result = await promise;

    expect(result).toEqual({
      error: true,
      message: 'El servicio está experimentando latencia o no está disponible.',
      data: [],
      fallback: true,
      success: false,
    });
  });
});
