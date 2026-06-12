import { NextResponse } from 'next/server';

// ─────────────────────────────────────────────────────────────────────────────
// NOTA DE ARQUITECTURA — protección de rutas
//
// La sesión de Supabase se persiste en localStorage del navegador (cliente
// estándar @supabase/supabase-js), NO en cookies. El middleware corre en el
// edge runtime del servidor y SOLO puede leer cookies — nunca localStorage —
// por lo que aquí es imposible conocer el estado real de autenticación.
//
// Un middleware que intentara leer una cookie de sesión inexistente redirigía
// SIEMPRE a /auth, dejando /dashboard, /profile y /reservas inaccesibles incluso
// para usuarios con sesión válida (ese fue el bug reportado).
//
// La protección efectiva se hace en el cliente: cada página protegida verifica
// supabase.auth.getSession() y redirige a /auth?redirectTo=... si no hay sesión.
// La seguridad de los datos la garantizan las políticas RLS de Postgres y el
// token Bearer que cada ruta /api/* exige — independientemente del middleware.
//
// Por eso este middleware es un passthrough: no bloquea, deja que el guard de
// cliente decida. Se mantiene el archivo para documentar la decisión.
// ─────────────────────────────────────────────────────────────────────────────

export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
