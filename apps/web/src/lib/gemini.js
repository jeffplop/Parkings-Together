// apps/web/src/lib/gemini.js
//
// Cliente mínimo para la API de Google Gemini (Generative Language API) vía REST,
// sin dependencias extra. Reemplaza a @anthropic-ai/sdk en las features de IA.
//
// Clave: se lee en tiempo de ejecución de GEMINI_API_KEY (o GOOGLE_API_KEY, o
// ANTHROPIC_API_KEY como compatibilidad con la variable ya configurada en Vercel).
// Modelo: configurable con GEMINI_MODEL (por defecto gemini-2.0-flash).

const getKey = () =>
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.ANTHROPIC_API_KEY ||
  null;

const getModel = () => process.env.GEMINI_MODEL || 'gemini-2.0-flash';

export function hasGeminiKey() {
  return Boolean(getKey());
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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${getModel()}:generateContent?key=${encodeURIComponent(key)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    const e = new Error(`Gemini ${res.status}: ${detail.slice(0, 200)}`);
    e.status = res.status;
    throw e;
  }

  const data = await res.json();
  return (data?.candidates?.[0]?.content?.parts || [])
    .map((p) => p.text || '')
    .join('');
}
