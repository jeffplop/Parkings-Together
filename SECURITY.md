# Política de Seguridad — Parkings Together

## Reportar una vulnerabilidad

Si detectas un problema de seguridad, **no abras un issue público**. Escribe a los
mantenedores mediante un [security advisory privado de GitHub](https://github.com/jeffplop/Parkings-Together/security/advisories/new).

Compromiso de respuesta: acuse de recibo en 72 horas y diagnóstico inicial en 7 días.

---

## Modelo de seguridad

La premisa del proyecto es: **la autorización vive en la base de datos, no en el código de
aplicación.**

| Capa | Mecanismo |
|---|---|
| **Autenticación** | Supabase Auth (JWT). El token viaja en `Authorization: Bearer <token>`. |
| **Autorización** | Políticas **RLS** de PostgreSQL que evalúan `auth.uid()` sobre el JWT. Aunque una ruta del backend tuviera un fallo lógico, la base de datos rechaza la operación. |
| **Integridad transaccional** | Funciones `SECURITY DEFINER` con `FOR UPDATE` (ver `sql/004_security_hardening.sql`): la doble reserva es imposible por diseño, no por validación en código. |
| **Superficie de escritura** | Ninguna clave de servicio (`SERVICE_ROLE`) se expone al frontend. Las escrituras reenvían el JWT del usuario real. |
| **Entrada** | Validación por esquemas con Zod en formularios; *rate limiting* en rutas sensibles. |
| **Secretos** | `.gitignore` bloquea `.env` y `.env.*` (excepto `.env.example`). Ver el incidente histórico más abajo. |

Detalle completo en [`docs/AUDIT_002_seguridad_rls.md`](docs/AUDIT_002_seguridad_rls.md) y
[`docs/adr/0001-proteccion-de-rutas-sin-middleware.md`](docs/adr/0001-proteccion-de-rutas-sin-middleware.md).

---

## Estado de las dependencias

Auditado con `npm audit` en la versión actual. **Vulnerabilidades accionables: 0.**

Las 5 alertas restantes se han analizado individualmente y se documentan aquí como
**riesgo aceptado con justificación**, no como deuda ignorada.

### Alcanzables solo en desarrollo (2)

| Paquete | Cadena | Por qué no es accionable |
|---|---|---|
| `js-yaml@3.14.2` | `babel-jest → babel-plugin-istanbul → @istanbuljs/load-nyc-config` | Herramienta de **cobertura de pruebas**; no se empaqueta en producción. `load-nyc-config` fija `js-yaml@^3.13.1`; forzar la v4 rompe su API. La ruta de **producción** (`swagger-ui-react`) ya usa `js-yaml@4.3.0`, que **no** es vulnerable. |
| `brace-expansion@1.1.14` | `babel-jest → … → minimatch@3` | Solo en el ejecutor de pruebas. `minimatch@3` fija `brace-expansion@^1.1.7`. El vector es una DoS al expandir *globs*, y los únicos globs que se procesan son las rutas de nuestros propios tests. |

### Empaquetadas dentro del framework (3)

| Paquete | Cadena | Por qué no es accionable |
|---|---|---|
| `postcss@8.4.31` | dentro de `next@16.2.11` | El "arreglo" que propone `npm audit` es **bajar a `next@9.3.3`** — una versión mayor de hace siete años, con vulnerabilidades muy superiores. El XSS requiere procesar CSS de origen no confiable; el proyecto solo compila su propio CSS. |
| `sharp@0.34.5` | dentro de `next@16.2.11` | Ídem. Corresponde al optimizador de imágenes de Next.js. Se resolverá cuando Next publique una versión con la dependencia actualizada. |
| `next@16.2.11` | — | Marcado únicamente por arrastre de los dos anteriores. |

> **Cerrada en esta versión:** `next` tenía una vulnerabilidad **alta** propia —*Middleware /
> Proxy bypass in App Router applications*— corregida al fijar `next@16.2.11`.

### Advertencia operativa

**No ejecutar `npm audit fix` en este repositorio.** Se comprobó que degrada `@babel/core`
y arrastra toda la cadena de Jest, elevando el recuento de 9 a 23 vulnerabilidades. Las
correcciones se aplican de forma dirigida (actualización puntual del paquete o `overrides`)
y verificando siempre con `npm test` y `npm run build`.

---

## Incidente histórico: fuga de `SERVICE_ROLE_KEY`

Durante el desarrollo, el archivo `apps/web/.env.local` —que contenía la clave
`SUPABASE_SERVICE_ROLE_KEY` (privilegios de administrador, ignora RLS)— quedó versionado
en git antes de que existiera la regla correspondiente en `.gitignore`.

**Acciones tomadas:**

1. `git rm --cached apps/web/.env.local` (deja de versionarse, se conserva en local).
2. `.gitignore` reforzado: ignora `.env` y `.env.*`, salvo `.env.example`.
3. Se añadió la plantilla `apps/web/.env.example` sin secretos.
4. **Rotación de las claves** en el panel de Supabase.

**Lección aplicada:** desversionar un archivo no lo borra del historial de git. Una
credencial expuesta sigue siendo recuperable de commits anteriores hasta que **se rota**.
La rotación es obligatoria, no opcional.

---

## Verificación

```bash
npm audit --audit-level=high   # estado de dependencias
npm run lint                   # 0 errores exigido
npm test                       # 167 pruebas
```
