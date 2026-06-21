// apps/web/app/api/precios/sugerencia/route.js
//
// Sugeridor de precio con IA para arrendadores. Toma los estacionamientos cercanos
// (comparables) y le pide a Gemini un precio/hora competitivo en CLP. Si la IA no
// está disponible, degrada a una sugerencia estadística (mediana de los cercanos).

import { NextResponse } from 'next/server';
import { supabase } from '@parkings/supabase-db';
import { geminiGenerate, hasGeminiKey } from '../../../../src/lib/gemini';
import { rateLimit, clientIp } from '../../../../src/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Distancia Haversine en km.
function distanciaKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const median = (arr) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get('lat'));
    const lng = parseFloat(searchParams.get('lng'));
    const comuna = searchParams.get('comuna') || null;

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return NextResponse.json({ success: false, error: 'Faltan lat/lng.' }, { status: 400 });
    }

    // Comparables: estacionamientos activos con precio, dentro de ~3 km.
    const { data, error } = await supabase
      .from('estacionamientos')
      .select('lat, lng, precio_hora, comuna, total_spots, occupied_spots')
      .eq('activo', true);
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const cercanos = (data || [])
      .filter((p) => p.precio_hora != null && Number(p.precio_hora) > 0)
      .map((p) => ({ ...p, dist: distanciaKm(lat, lng, Number(p.lat), Number(p.lng)) }))
      .filter((p) => p.dist <= 3)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 12);

    const precios = cercanos.map((p) => Math.round(Number(p.precio_hora)));
    const med = median(precios);

    // Fallback estadístico (sin IA): mediana de los cercanos o un base razonable.
    const fallback = {
      success: true,
      ia: false,
      sugerido: med ?? 1500,
      min: precios.length ? Math.min(...precios) : 1000,
      max: precios.length ? Math.max(...precios) : 2500,
      razon: precios.length
        ? `Basado en ${precios.length} estacionamiento(s) cercano(s) (mediana $${med}/h).`
        : 'No hay comparables cercanos; sugerencia base para la zona.',
      comparables: precios.length,
    };

    if (!hasGeminiKey() || precios.length === 0) {
      return NextResponse.json(fallback, { status: 200 });
    }

    // Rate-limit por IP (la IA cuesta): 20/min.
    const { ok } = rateLimit(`precio:${clientIp(request)}`, { max: 20, windowMs: 60_000 });
    if (!ok) return NextResponse.json(fallback, { status: 200 });

    try {
      // Pedimos SOLO un número: es mucho más robusto que pedir JSON a un modelo flash
      // (que a veces ignora el modo JSON y responde texto).
      const out = await geminiGenerate({
        system:
          'Eres un asesor de precios para estacionamientos en Chile (precios en CLP). ' +
          'Responde ÚNICAMENTE con el precio por hora sugerido como un número entero, ' +
          'sin texto, sin símbolos, sin puntos. Ejemplo de respuesta válida: 2000',
        messages: [
          {
            role: 'user',
            content:
              `Precios por hora de ${precios.length} estacionamientos cercanos (CLP): [${precios.join(', ')}]. ` +
              `Mediana: ${med}. Comuna: ${comuna || 'desconocida'}. ` +
              `Dame UN precio por hora competitivo y realista (solo el número entero).`,
          },
        ],
        maxOutputTokens: 16,
        temperature: 0.2,
      });

      // Extrae el primer número de la respuesta (tolera "$2.000", "2000 CLP", etc.).
      const m = String(out).match(/\d[\d.\s]*/);
      const sugerido = m ? parseInt(m[0].replace(/[^\d]/g, ''), 10) : NaN;
      if (!Number.isFinite(sugerido) || sugerido <= 0) {
        return NextResponse.json(fallback, { status: 200 });
      }

      return NextResponse.json(
        {
          success: true,
          ia: true,
          sugerido,
          min: fallback.min,
          max: fallback.max,
          razon: `Sugerido por IA según ${precios.length} estacionamiento(s) cercano(s) (mediana $${med}/h).`,
          comparables: precios.length,
        },
        { status: 200 },
      );
    } catch {
      return NextResponse.json(fallback, { status: 200 });
    }
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
