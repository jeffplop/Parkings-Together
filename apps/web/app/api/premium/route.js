import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@parkings/supabase-db';

const PLANES_VALIDOS = ['free', 'pro', 'premium'];
const CICLOS_VALIDOS = ['mensual', 'anual'];

/**
 * Devuelve el cliente Supabase autenticado con el JWT del usuario (Bearer),
 * o null si no hay token. Permite leer auth.uid() para identificar al usuario.
 */
function getUserFromRequest(request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } }
  );
  return client;
}

// GET → plan actual del usuario
export async function GET(request) {
  try {
    const client = getUserFromRequest(request);
    if (!client) return NextResponse.json({ success: false, error: 'No autenticado.' }, { status: 401 });

    const { data: { user } } = await client.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'Sesión inválida.' }, { status: 401 });

    const { data, error } = await client
      .from('perfiles')
      .select('plan, plan_ciclo, plan_desde, rol')
      .eq('id', user.id)
      .single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('[premium GET] Unexpected:', err.message);
    return NextResponse.json({ success: false, error: 'Error interno del servidor.' }, { status: 500 });
  }
}

// POST → cambiar de plan (flujo de pago simulado para la demo)
export async function POST(request) {
  try {
    const client = getUserFromRequest(request);
    if (!client) return NextResponse.json({ success: false, error: 'No autenticado.' }, { status: 401 });

    const { data: { user } } = await client.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'Sesión inválida.' }, { status: 401 });

    const { plan, ciclo } = await request.json();
    if (!PLANES_VALIDOS.includes(plan)) {
      return NextResponse.json({ success: false, error: 'Plan inválido.' }, { status: 400 });
    }
    const cicloFinal = CICLOS_VALIDOS.includes(ciclo) ? ciclo : 'mensual';

    // Service role para escribir el perfil de forma fiable (la fila ya es del usuario).
    const admin = getServiceSupabase();
    const { error } = await admin
      .from('perfiles')
      .update({
        plan,
        plan_ciclo: cicloFinal,
        plan_desde: plan === 'free' ? null : new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });

    return NextResponse.json({
      success: true,
      data: { plan, ciclo: cicloFinal },
      message: plan === 'free' ? 'Plan cancelado. Volviste al plan Gratis.' : '¡Suscripción activada!',
    });
  } catch (err) {
    console.error('[premium POST] Unexpected:', err.message);
    return NextResponse.json({ success: false, error: 'Error interno del servidor.' }, { status: 500 });
  }
}
