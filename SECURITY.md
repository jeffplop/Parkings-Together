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

`npm audit` reporta **29 alertas**, pero esa cifra confunde: cuenta *cada paquete de cada
cadena afectada*. Al agrupar por su causa real quedan **3 advisories raíz**, analizados uno
a uno a continuación. Ninguno es accionable sin causar un daño mayor, y ninguno es
alcanzable desde producción.

### 1. `brace-expansion` — solo herramientas de desarrollo

- **Advisory:** [GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg) —
  DoS por expansión no acotada al procesar *globs*.
- **Cadena:** `eslint`, sus plugins, `glob` y `test-exclude` (cobertura de Jest), todos a
  través de `minimatch@3`, que fija `brace-expansion@^1.1.7`.
- **Por qué no se corrige:** el advisory exige `>=5.0.8` y **no existe parche en la línea
  1.x**. Se probó forzar `5.0.8` mediante `overrides`: **rompe ESLint** con un fallo en
  `@eslint/config-array` (`pathMatches`). Se revirtió a `1.1.16`, que sí cierra el advisory
  previo de expansión exponencial.
- **Riesgo real:** nulo en producción. Ese código nunca se despliega, y los únicos *globs*
  que procesa son las rutas de nuestros propios ficheros. La ruta de producción
  (`@swagger-api/apidom-reference`) ya resuelve `brace-expansion@5.0.8`, que **no** es
  vulnerable.

### 2 y 3. `postcss` y `sharp` — empaquetados dentro de Next.js

- **Cadena:** ambos van dentro de `next@16.2.11`.
- **Por qué no se corrigen:** el "arreglo" que propone `npm audit` es **bajar a
  `next@9.3.3`**, una versión mayor de hace siete años con vulnerabilidades muy superiores
  a las que resolvería.
- **Riesgo real:** el XSS de `postcss` requiere procesar CSS de origen no confiable, y el
  proyecto solo compila su propio CSS. `sharp` corresponde al optimizador de imágenes de
  Next.
- **Plan:** se resolverá al publicar Next una versión con esas dependencias actualizadas.
  Dependabot abrirá el pull request automáticamente (ver `.github/dependabot.yml`).

### Correcciones aplicadas en esta versión

| Vulnerabilidad | Severidad | Cómo se cerró |
|---|---|---|
| Next.js — *Middleware / Proxy bypass in App Router* | **Alta** | Fijar `next@16.2.11` |
| `immutable` — desbordamiento de trie en `List` | Alta | `swagger-ui-react` 5.32.6 → 5.32.11 (pasa a `immutable ^4.3.9`) |
| `js-yaml` — DoS cuadrática en *merge keys* | Alta | Ídem (pasa a `js-yaml =4.3.0`) + `override` a `3.15.0` en la cadena de cobertura |
| `dompurify` — bypass de `afterSanitizeElements` | Moderada | Ídem (pasa a `dompurify ^3.4.12`) |
| `brace-expansion` — expansión exponencial | Alta | `override` a `1.1.16` |
| `@babel/core` — lectura de ficheros vía `sourceMappingURL` | Baja | `@babel/core@7.29.7` |
| Turbo — ejecución local de código y CSRF en el callback de login | Moderada | `turbo@2.10.7` |

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
