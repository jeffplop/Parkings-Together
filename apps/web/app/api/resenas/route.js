// apps/web/app/api/resenas/route.js
//
// Reseñas públicas de un estacionamiento.
//
// NOTA: la ruta se llama `resenas` (sin ñ) a propósito. La carpeta anterior
// `reseñas` (con ñ) provocaba que el build incremental de Vercel NO detectara
// los cambios del route (reutilizaba la función serverless cacheada), además
// de obligar a URLs codificadas como /api/rese%C3%B1as. Usar ASCII elimina esa
// clase de fragilidad por completo.
//
// CAUSA RAÍZ del bug "Estacionamiento no encontrado":
// La versión anterior creaba un cliente con SUPABASE_SERVICE_ROLE_KEY en cada
// request. Si esa variable no estaba configurada en el entorno, supabase-js
// lanzaba "supabaseKey is required" SIN try/catch → respuesta 500 con HTML.
// La página de detalle pedía parking + reseñas en un único Promise.all, así que
// ese 500 (que no era JSON) rompía r.json() y dejaba el parking en null.
//
// Ahora usamos una RPC SECURITY DEFINER (`obtener_resenas`) invocable por el
// cliente anónimo: ya no se necesita el service-role key. Además TODO está
// envuelto en try/catch, de modo que el endpoint SIEMPRE responde JSON válido
// y nunca puede tumbar la carga del estacionamiento.

import { NextResponse } from 'next/server';
import { supabase } from '@parkings/supabase-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RESUMEN_VACIO = { total: 0, promedio: 0, distribucion: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const estacionamiento_id = searchParams.get('estacionamiento_id');

    const idNum = parseInt(estacionamiento_id, 10);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      return NextResponse.json(
        { success: false, error: 'estacionamiento_id inválido', data: [], resumen: RESUMEN_VACIO },
        { status: 400 }
      );
    }

    const { data: filas, error } = await supabase.rpc('obtener_resenas', {
      p_estacionamiento_id: idNum,
    });

    if (error) {
      // La RPC falló (p. ej. aún no aplicada en BD). Degradamos a "sin reseñas"
      // con status 200 para que la ficha del estacionamiento NUNCA se rompa.
      return NextResponse.json(
        { success: true, data: [], resumen: RESUMEN_VACIO, warning: 'reseñas no disponibles' },
        { status: 200 }
      );
    }

    const data = (filas || []).map((r) => ({
      id: r.id,
      calificacion: r.calificacion,
      comentario: r.comentario,
      review_photo_url: r.review_photo_url,
      created_at: r.created_at,
      perfil: r.autor_nombre
        ? { nombre: r.autor_nombre, apellido: r.autor_apellido, avatar_url: r.autor_avatar_url }
        : null,
    }));

    const total = data.length;
    const promedio = total ? data.reduce((a, r) => a + r.calificacion, 0) / total : 0;
    const distribucion = [1, 2, 3, 4, 5].reduce((acc, n) => {
      acc[n] = data.filter((r) => r.calificacion === n).length;
      return acc;
    }, {});

    return NextResponse.json({ success: true, data, resumen: { total, promedio, distribucion } });
  } catch (err) {
    // Última red de seguridad: jamás devolver HTML 500. Degradamos a vacío.
    return NextResponse.json(
      { success: true, data: [], resumen: RESUMEN_VACIO, warning: err?.message || 'error inesperado' },
      { status: 200 }
    );
  }
}
