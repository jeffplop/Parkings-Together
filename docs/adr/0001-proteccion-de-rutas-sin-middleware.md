# ADR 0001 — Protección de rutas sin middleware de servidor

- **Estado:** Aceptada
- **Fecha:** 2026-07-25
- **Contexto previo:** el repositorio contenía `apps/web/middleware.js` como *passthrough*
  con `matcher: []` (no interceptaba ninguna ruta) y una nota extensa explicando por qué.

---

## Contexto

La sesión de Supabase se persiste en el **`localStorage` del navegador** (cliente estándar
`@supabase/supabase-js`), no en cookies. El middleware de Next.js corre en el servidor
(edge runtime) y **solo puede leer cookies**; nunca tiene acceso a `localStorage`.

Un intento previo de proteger rutas con middleware leía una cookie de sesión inexistente y
por tanto redirigía **siempre** a `/auth`, dejando `/dashboard`, `/profile` y `/reservas`
inaccesibles incluso para usuarios con sesión válida. Ese fue un bug reportado y corregido.

## Decisión

**No se usa middleware de servidor para autorización.** La protección se implementa en dos
capas reales:

1. **Guard de cliente.** Cada página protegida verifica `supabase.auth.getSession()` y
   redirige a `/auth?redirectTo=…` si no hay sesión. Es una decisión de *navegación*, no de
   seguridad.
2. **Autorización en la base de datos.** La seguridad efectiva la garantizan las políticas
   **RLS** de PostgreSQL evaluando `auth.uid()` sobre el JWT, más el `Bearer token` que
   exige cada ruta `/api/*`. Aunque un atacante navegue directamente a una vista protegida,
   no obtiene datos: la base de datos rechaza la consulta.

El archivo `middleware.js` fue **eliminado** porque:

- Con `matcher: []` no ejecutaba nada: era código muerto.
- La convención `middleware` está **deprecada** en Next.js 16 (sustituida por `proxy`),
  y su sola presencia generaba un warning en cada build.
- Mantener un archivo inerte solo para alojar un comentario confunde a quien lee el
  repositorio: sugiere que existe una capa de protección de servidor que en realidad no opera.

La justificación se conserva aquí, que es su lugar correcto.

## Consecuencias

**Positivas**

- Se elimina el warning de build y una convención deprecada.
- El modelo de seguridad queda explícito y en un solo lugar: *la autorización vive en la base
  de datos*.
- Menos código inerte que mantener.

**Negativas / riesgos asumidos**

- No hay protección de rutas a nivel de servidor: una vista protegida se **renderiza**
  brevemente antes de que el guard de cliente redirija. No hay fuga de datos (RLS los
  bloquea), pero sí un parpadeo de UI.
- Si en el futuro se migra la sesión a cookies (por ejemplo con `@supabase/ssr`), esta
  decisión **debe revisarse**: en ese escenario un `proxy.js` sí podría autorizar en el
  servidor y eliminar el parpadeo.

## Alternativas consideradas

| Alternativa | Por qué se descartó |
|---|---|
| Migrar la sesión a cookies con `@supabase/ssr` y autorizar en `proxy.js` | Refactor transversal de todo el flujo de autenticación; el beneficio (evitar un parpadeo) no justifica el riesgo en este momento del proyecto. Queda como mejora futura. |
| Mantener `middleware.js` como passthrough documentado | Código muerto + convención deprecada + warning en cada build, a cambio de alojar un comentario que pertenece a la documentación. |

## Referencias

- `docs/AUDIT_002_seguridad_rls.md` — políticas RLS y autorización de endpoints.
- [Next.js: middleware → proxy](https://nextjs.org/docs/messages/middleware-to-proxy)
