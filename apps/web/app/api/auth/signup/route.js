import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@parkings/supabase-db';
import { rateLimit, clientIp } from '../../../../src/lib/rateLimit';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PW_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\-_=+[\]{};':",.<>/?`~\\|]).{8,}$/;

export async function POST(request) {
  try {
    // Máximo 10 registros por IP por hora (mitiga creación masiva de cuentas).
    const { ok } = rateLimit(`signup:${clientIp(request)}`, { max: 10, windowMs: 60 * 60 * 1000 });
    if (!ok) {
      return NextResponse.json({ error: 'Demasiados intentos. Espera unos minutos.' }, { status: 429 });
    }

    const { email, password, nombre, apellido, rol, telefono, tipo_vehiculo, patente, empresa } = await request.json();

    if (!email || !password || !nombre || !apellido || !rol) {
      return NextResponse.json({ error: 'Faltan campos requeridos.' }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'Email inválido.' }, { status: 400 });
    if (!PW_RE.test(password)) {
      return NextResponse.json({ error: 'Contraseña insegura: mínimo 8 caracteres, incluye mayúscula, minúscula, número y símbolo.' }, { status: 400 });
    }
    if (!['cliente', 'arrendador'].includes(rol)) {
      return NextResponse.json({ error: 'Rol inválido.' }, { status: 400 });
    }

    const admin = getServiceSupabase();

    const { data: userData, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre, apellido, rol },
    });

    if (createError) {
      if (createError.message?.includes('already registered') || createError.message?.includes('already been registered')) {
        return NextResponse.json({ error: 'Credenciales inválidas o cuenta ya existente.' }, { status: 400 });
      }
      console.error('[signup] createUser error:', createError.message);
      return NextResponse.json({ error: 'No se pudo crear la cuenta.' }, { status: 400 });
    }

    const profilePayload = {
      id: userData.user.id,
      nombre: `${nombre} ${apellido}`.trim(),
      apellido: apellido || null,
      rol,
      telefono: telefono || null,
      tipo_vehiculo: rol === 'cliente' ? (tipo_vehiculo || null) : null,
      empresa: rol === 'arrendador' ? (empresa || null) : null,
    };

    const { error: profileError } = await admin.from('perfiles').upsert(profilePayload, { onConflict: 'id' });
    if (profileError) console.error('[signup] Profile error:', profileError.message);

    // Si el conductor registró una patente, creamos su primer vehículo.
    if (rol === 'cliente' && patente && String(patente).trim()) {
      const TIPO_LABEL = { auto: 'Automóvil', moto: 'Motocicleta', bicicleta: 'Bicicleta', scooter: 'Scooter' };
      const { error: vehError } = await admin.from('vehiculos').insert({
        user_id: userData.user.id,
        patente: String(patente).trim().toUpperCase(),
        marca: TIPO_LABEL[tipo_vehiculo] || 'Vehículo',
        modelo: '',
        color: '',
        es_principal: true,
      });
      if (vehError) console.error('[signup] Vehiculo error:', vehError.message);
    }

    const { createClient } = await import('@supabase/supabase-js');
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false } }
    );

    const { data: sessionData, error: signInError } = await anonClient.auth.signInWithPassword({ email, password });
    if (signInError) {
      return NextResponse.json({ success: true, autoLogin: false, message: 'Cuenta creada. Inicia sesión manualmente.' });
    }

    return NextResponse.json({
      success: true,
      autoLogin: true,
      session: sessionData.session,
      user: { id: userData.user.id, email: userData.user.email, nombre, apellido, rol },
    });

  } catch (err) {
    console.error('[signup] Unexpected:', err.message);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
