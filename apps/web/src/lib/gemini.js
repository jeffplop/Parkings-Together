// apps/web/src/lib/gemini.js
//
// Cliente mínimo para la API de Google Gemini (Generative Language API) vía REST,
// sin dependencias extra. Reemplaza a @anthropic-ai/sdk en las features de IA.
//
// Clave: se lee en tiempo de ejecución de GEMINI_API_KEY (o GOOGLE_API_KEY, o
// ANTHROPIC_API_KEY como compatibilidad con la variable ya configurada en Vercel).
//
// Modelo: los nombres de modelo disponibles dependen de la key/proyecto. En vez de
// asumir uno fijo (que da 404 "model not found"), se DESCUBRE con ListModels y se
// elige uno de tipo `flash` (rápido/barato). Se puede forzar con GEMINI_MODEL.

const getKey = () =>
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.ANTHROPIC_API_KEY ||
  null;

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export function hasGeminiKey() {
  return Boolean(getKey());
}

// Cache del modelo resuelto para no llamar a ListModels en cada request.
let cachedModel = null;

async function resolveModel(key) {
  if (process.env.GEMINI_MODEL) return process.env.GEMINI_MODEL;
  if (cachedModel) return cachedModel;
  try {
    const r = await fetch(`${BASE}/models?key=${encodeURIComponent(key)}`);
    if (r.ok) {
      const j = await r.json();
      const usable = (j.models || []).filter((m) =>
        (m.supportedGenerationMethods || []).includes('generateContent')
      );
      // Prefiere un modelo "flash" estable (evita variantes vision/thinking/exp);
      // si no hay, cualquier flash; si no, el primero disponible.
      const pick =
        usable.find((m) => /flash/i.test(m.name) && !/(vision|thinking|exp|preview)/i.test(m.name)) ||
        usable.find((m) => /flash/i.test(m.name)) ||
        usable[0];
      if (pick) {
        cachedModel = pick.name.replace(/^models\//, '');
        // Diagnóstico solo en desarrollo: en producción no ensucia la consola
        // (el modelo se autodescubre una vez y se cachea).
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[gemini] modelo seleccionado:', cachedModel);
        }
        return cachedModel;
      }
    } else {
      console.error('GEMINIERR_LISTMODELS_' + r.status);
    }
  } catch (e) {
    console.error('[gemini] resolveModel fallo:', e?.message);
  }
  // Último recurso si ListModels no responde.
  return 'gemini-1.5-flash';
}

/**
 * Genera texto con Gemini.
 * @param {object}   opts
 * @param {string}   [opts.system]            Instrucción de sistema.
 * @param {Array}    opts.messages            [{ role: 'user'|'assistant', content }]
 * @param {number}   [opts.maxOutputTokens]   Límite de tokens de salida.
 * @param {number}   [opts.temperature]
 * @param {boolean}  [opts.json]              Si true, fuerza respuesta JSON.
 * @returns {Promise<string>} Texto generado.
 */
export async function geminiGenerate({
  system,
  messages,
  maxOutputTokens = 400,
  temperature = 0.7,
  json = false,
} = {}) {
  const key = getKey();
  if (!key) {
    const e = new Error('GEMINI_API_KEY no configurada');
    e.status = 401;
    throw e;
  }

  const model = await resolveModel(key);

  // Gemini usa 'model' en vez de 'assistant'.
  const contents = (messages || []).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(m.content ?? '') }],
  }));

  const body = {
    contents,
    generationConfig: {
      maxOutputTokens,
      temperature,
      ...(json ? { responseMimeType: 'application/json' } : {}),
    },
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };

  const res = await fetch(
    `${BASE}/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error(`GEMINIERR_${res.status} model=${model} ${detail.slice(0, 300)}`);
    const e = new Error(`Gemini ${res.status}: ${detail.slice(0, 300)}`);
    e.status = res.status;
    throw e;
  }

  const data = await res.json();
  const text = (data?.candidates?.[0]?.content?.parts || [])
    .map((p) => p.text || '')
    .join('');
  // En modo JSON, algunos modelos envuelven la salida en ```json ... ```; lo limpiamos
  // para que JSON.parse del llamador funcione siempre.
  return json
    ? text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
    : text;
}
