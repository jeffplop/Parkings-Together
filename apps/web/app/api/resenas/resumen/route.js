// apps/web/app/api/resenas/resumen/route.js
//
// Resumen INTELIGENTE de reseñas con IA (Claude Haiku). Convierte una lista de
// reseñas en un veredicto neutral (resumen + pros + contras) para que el
// conductor decida más rápido. Diferenciador real: ningún competidor local lo ofrece.
//
// DISEÑO (coste y resiliencia):
//  - Solo resume si hay >= MIN_RESENAS reseñas con texto (si no, devuelve null).
//  - Caché en memoria por `${id}:${nReseñas}`: el resumen solo se regenera cuando
//    cambia el número de reseñas -> 1 llamada a la IA por estacionamiento hasta que
//    llegue una reseña nueva. Coste acotado.
//  - Rate-limit por IP SOLO en cache-miss (cuando realmente vamos a llamar a la IA).
//  - SIEMPRE responde 200; ante cualquier fallo (sin API key, error de red, JSON
//    inválido) devuelve { resumen: null } y la UI simplemente no muestra la tarjeta.
//    Nunca rompe la ficha del estacionamiento.

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '@parkings/supabase-db';
import { rateLimit, clientIp } from '../../../../src/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const cache = new Map();
const MIN_RESENAS = 3;     // bajo este umbral no aporta y se omite
const MAX_CORPUS = 30;     // tope de reseñas enviadas a la IA (coste/latencia)

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const idNum = parseInt(searchParams.get('estacionamiento_id'), 10);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      return NextResponse.json({ success: false, error: 'id inválido', resumen: null }, { status: 400 });
    }

    // Lee las reseñas vía la RPC pública (mismo origen de verdad que la ficha).
    const { data: filas, error } = await supabase.rpc('obtener_resenas', { p_estacionamiento_id: idNum });
    if (error) return NextResponse.json({ success: true, resumen: null }, { status: 200 });

    const reviews = (filas || []).filter((r) => r.comentario && String(r.comentario).trim());
    if (reviews.length < MIN_RESENAS) {
      return NextResponse.json({ success: true, resumen: null, motivo: 'pocas_resenas' }, { status: 200 });
    }

    const cacheKey = `${idNum}:${reviews.length}`;
    if (cache.has(cacheKey)) {
      return NextResponse.json({ success: true, ...cache.get(cacheKey), cached: true }, { status: 200 });
    }

    // Solo limitamos cuando hay cache-miss (vamos a gastar una llamada a la IA).
    const { ok } = rateLimit(`resumen:${clientIp(request)}`, { max: 15, windowMs: 60_000 });
    if (!ok) return NextResponse.json({ success: true, resumen: null, motivo: 'rate_limited' }, { status: 200 });

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ success: true, resumen: null }, { status: 200 });
    }

    const promedio = reviews.reduce((a, r) => a + r.calificacion, 0) / reviews.length;
    const corpus = reviews
      .slice(0, MAX_CORPUS)
      .map((r) => `(${r.calificacion}★) ${String(r.comentario).slice(0, 280)}`)
      .join('\n');

    const resp = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 320,
      system: `Eres un analista de reseñas de un marketplace chileno de estacionamientos. Resumes reseñas REALES de usuarios verificados de forma honesta, neutral y útil para quien decide si reservar. Responde SOLO con JSON válido (sin texto adicional, sin markdown) con esta forma EXACTA:
{"resumen":"<2-3 frases en español neutral>","pros":["<máx 3, cortos>"],"contras":["<máx 3, cortos; usa [] si no hay>"]}
No inventes nada que no esté en las reseñas. Si son contradictorias, dilo con neutralidad.`,
      messages: [
        { role: 'user', content: `Promedio: ${promedio.toFixed(1)}★ sobre ${reviews.length} reseñas verificadas.\nReseñas:\n${corpus}` },
      ],
    });

    let parsed = null;
    try { parsed = JSON.parse(resp.content?.[0]?.text ?? '{}'); } catch { /* respuesta no-JSON */ }
    if (!parsed?.resumen) return NextResponse.json({ success: true, resumen: null }, { status: 200 });

    const payload = {
      resumen: String(parsed.resumen).slice(0, 600),
      pros: Array.isArray(parsed.pros) ? parsed.pros.slice(0, 3).map((s) => String(s).slice(0, 80)) : [],
      contras: Array.isArray(parsed.contras) ? parsed.contras.slice(0, 3).map((s) => String(s).slice(0, 80)) : [],
      total: reviews.length,
    };
    cache.set(cacheKey, payload);
    return NextResponse.json({ success: true, ...payload }, { status: 200 });
  } catch (err) {
    // Red de seguridad: jamás romper la ficha por el resumen.
    return NextResponse.json({ success: true, resumen: null, warning: err?.message }, { status: 200 });
  }
}
