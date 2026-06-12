import { supabase } from '@parkings/supabase-db';

// El web usa SIEMPRE route handlers de MISMO ORIGEN (/api/mapas, /api/reservas),
// que viven dentro de apps/web y consultan Supabase en el servidor.
// Esto elimina por completo la dependencia en runtime de microservicios externos
// (cuya URL inlineada caía a localhost en Vercel), que era la causa de que los
// estacionamientos no se mostraran en producción. Es determinista: no depende de
// ninguna variable NEXT_PUBLIC_MS_*_URL que pudiera quedar mal configurada.
const MAPAS_URL = '/api/mapas';
const RESERVAS_URL = '/api/reservas';
const FAVORITOS_URL = '/api/favoritos';

/**
 * Cabeceras con el JWT del usuario (si hay sesión), para que RLS evalúe
 * auth.uid() en operaciones de escritura.
 */
async function authHeaders() {
  const base = { 'Content-Type': 'application/json' };
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) base.Authorization = `Bearer ${session.access_token}`;
  } catch {
    // sin sesión → se envían solo las cabeceras base
  }
  return base;
}

/**
 * Envoltorio Resiliente con AbortController y Timeout.
 * Límite estricto de 8 segundos. Si falla, retorna Fallback seguro
 * pero preservando el mensaje real del backend para no ocultar el error.
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 4000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);

    let payload = null;
    try { payload = await response.json(); } catch { /* respuesta sin cuerpo JSON */ }

    if (!response.ok) {
      return {
        success: false,
        error: payload?.error || `HTTP Error: ${response.status}`,
        data: [],
      };
    }
    return payload ?? { success: true, data: [] };
  } catch (error) {
    clearTimeout(id);
    if (process.env.NODE_ENV === 'development') console.error(`[BFF Timeout/Error] Falló la petición a ${url}`, error.message);
    return {
      success: false,
      error: true,
      message: 'El servicio está experimentando latencia o no está disponible.',
      data: [],
      fallback: true,
    };
  }
}

// --- API ORCHESTRATOR (BFF) ---
export const api = {
  mapas: {
    getMisEstacionamientos: (userId) =>
      fetchWithTimeout(`${MAPAS_URL}/search?userId=${userId}`),

    // Búsqueda avanzada: filtros combinables (q, comuna, pmr, disponible,
    // precioMax, lat/lng/radius). Devuelve { success, data }.
    buscar: (filtros = {}) => {
      const qs = new URLSearchParams(
        Object.entries(filtros).filter(([, v]) => v !== undefined && v !== null && v !== '')
      ).toString();
      return fetchWithTimeout(`${MAPAS_URL}/search?${qs}`);
    },

    crearEstacionamiento: async (data) =>
      fetchWithTimeout(`${MAPAS_URL}/search`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify(data),
      }),

    eliminarEstacionamientos: async (ids) =>
      fetchWithTimeout(`${MAPAS_URL}/search`, {
        method: 'DELETE',
        headers: await authHeaders(),
        body: JSON.stringify({ ids }),
      }),

    actualizarOcupacion: async (id, occupied_spots) =>
      fetchWithTimeout(`${MAPAS_URL}/search`, {
        method: 'PATCH',
        headers: await authHeaders(),
        body: JSON.stringify({ id, occupied_spots }),
      }),

    actualizarEstacionamiento: async (id, data) =>
      fetchWithTimeout(`${MAPAS_URL}/search`, {
        method: 'PATCH',
        headers: await authHeaders(),
        body: JSON.stringify({ action: 'updateFull', id, ...data }),
      }),

    toggleActivar: async (id) =>
      fetchWithTimeout(`${MAPAS_URL}/search`, {
        method: 'PATCH',
        headers: await authHeaders(),
        body: JSON.stringify({ action: 'toggleActivo', id }),
      }),
  },
  reservas: {
    verificarDisponibilidad: (parkingId) =>
      fetchWithTimeout(`${RESERVAS_URL}/reserve?parkingId=${parkingId}`),

    // crearReserva acepta opcionalmente fecha_inicio/fecha_fin (ISO 8601) para
    // reserva PROFESIONAL anticipada; sin ellas, es reserva instantánea.
    crearReserva: async (data) =>
      fetchWithTimeout(`${RESERVAS_URL}/reserve`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify(data),
      }),

    // Listado de reservas del usuario. scope: 'conductor' | 'arrendador'.
    listar: async (scope = 'conductor') =>
      fetchWithTimeout(`${RESERVAS_URL}/manage?scope=${scope}`, {
        headers: await authHeaders(),
      }),

    confirmar: async (reserva_id) =>
      fetchWithTimeout(`${RESERVAS_URL}/manage`, {
        method: 'PATCH',
        headers: await authHeaders(),
        body: JSON.stringify({ action: 'confirmar', reserva_id }),
      }),

    cancelar: async (reserva_id) =>
      fetchWithTimeout(`${RESERVAS_URL}/manage`, {
        method: 'PATCH',
        headers: await authHeaders(),
        body: JSON.stringify({ action: 'cancelar', reserva_id }),
      }),

    reprogramar: async (reserva_id, fecha_inicio, fecha_fin) =>
      fetchWithTimeout(`${RESERVAS_URL}/manage`, {
        method: 'PATCH',
        headers: await authHeaders(),
        body: JSON.stringify({ action: 'reprogramar', reserva_id, fecha_inicio, fecha_fin }),
      }),

    completar: async (reserva_id) =>
      fetchWithTimeout(`${RESERVAS_URL}/manage`, {
        method: 'PATCH',
        headers: await authHeaders(),
        body: JSON.stringify({ action: 'completar', reserva_id }),
      }),

    calificar: async (reserva_id, calificacion, comentario, photoUrl) =>
      fetchWithTimeout(`${RESERVAS_URL}/manage`, {
        method: 'PATCH',
        headers: await authHeaders(),
        body: JSON.stringify({ action: 'calificar', reserva_id, calificacion, comentario, ...(photoUrl ? { review_photo_url: photoUrl } : {}) }),
      }),
  },
  premium: {
    // Plan actual del usuario autenticado.
    estado: async () =>
      fetchWithTimeout(`/api/premium`, { headers: await authHeaders() }),

    // Cambia de plan (flujo de pago simulado en la demo).
    suscribir: async (plan, ciclo = 'mensual') =>
      fetchWithTimeout(`/api/premium`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ plan, ciclo }),
      }),
  },
  favoritos: {
    listar: async () =>
      fetchWithTimeout(`${FAVORITOS_URL}`, { headers: await authHeaders() }),

    agregar: async (estacionamiento_id) =>
      fetchWithTimeout(`${FAVORITOS_URL}`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ estacionamiento_id }),
      }),

    quitar: async (estacionamiento_id) =>
      fetchWithTimeout(`${FAVORITOS_URL}`, {
        method: 'DELETE',
        headers: await authHeaders(),
        body: JSON.stringify({ estacionamiento_id }),
      }),
  },
};
