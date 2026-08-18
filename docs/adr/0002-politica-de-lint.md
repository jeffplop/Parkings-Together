# ADR 0002 — Política de lint: qué bloquea el CI y qué no

- **Estado:** Aceptada
- **Fecha:** 2026-07-25

---

## Contexto

Hasta esta versión, `npm run lint` **no funcionaba**: el script raíz invocaba
`turbo run lint`, pero `turbo.json` no declaraba la tarea `lint` y ninguna app tenía un
script `lint`. El comando terminaba con:

```
x Missing tasks in project
`->   x Could not find task `lint` in project
```

Es decir: el proyecto **nunca había pasado por un linter**. Al configurar ESLint 9 (flat
config) con `eslint-config-next/core-web-vitals` aparecieron **63 problemas: 41 errores y
22 avisos**.

Al analizarlos resultaron ser de dos naturalezas muy distintas:

| Naturaleza | Cantidad | Ejemplos |
|---|---|---|
| **Defectos reales** (código muerto) | 20 | imports sin usar, variables calculadas y descartadas, `catch (error)` con la variable sin usar |
| **Sugerencias del React Compiler** | 21 | `set-state-in-effect`, `purity`, `refs`, `immutability` |

## Decisión

**Se separan por severidad según su impacto real, no según el default de la herramienta.**

### Bloquean el CI (`error`)

Todo lo que indica un defecto o un riesgo de corrección:

`no-unused-vars`, `no-const-assign`, `no-dupe-keys`, `no-unreachable`, `eqeqeq`,
y las reglas de error de `next/core-web-vitals`.

Los 20 defectos reales **se corrigieron** en esta misma versión:

- Los `catch (error)` que no usaban la variable pasaron a *optional catch binding*
  (`} catch {`), que expresa la intención con precisión.
- Imports, constantes y desestructuraciones muertas: eliminados.
- `let channel` reasignado una sola vez → `const`.
- Excepción documentada en `apps/web/src/lib/payments.js`: los parámetros de
  `chargeWebpay()` figuran como "sin usar" porque la integración real con Transbank está
  comentada a la espera de credenciales; se conservan con su nombre real (en vez de
  prefijarlos con `_`) para que el bloque comentado siga siendo válido al activarlo. Se
  marcó con un `eslint-disable-next-line` **con su justificación al lado**.

### No bloquean el CI (`warn`)

Las reglas del **React Compiler** (`eslint-plugin-react-hooks` v6):
`set-state-in-effect`, `purity`, `refs`, `immutability`.

**Razón:** marcan patrones que *funcionan correctamente* pero que impiden al compilador de
React memoizar de forma óptima. Refactorizar ~21 hooks de una aplicación ya desplegada y
con 167 pruebas en verde, únicamente para satisfacer una regla de rendimiento, introduce
más riesgo de regresión del que elimina.

Lo mismo aplica a `@next/next/no-img-element` (15 casos): migrar de `<img>` a
`next/image` es una optimización deseable, no una corrección de defecto.

**No se desactivan**: quedan como aviso para que sigan siendo visibles y priorizables.

## Consecuencias

- `npm run lint` funciona y el repositorio queda con **0 errores de lint**.
- El CI puede exigir `--max-warnings` sobre los errores sin bloquearse por deuda técnica
  preexistente.
- Los 41 avisos restantes constituyen un **backlog explícito y medible**. Reducirlos es
  trabajo futuro planificable, no una urgencia.
- Riesgo asumido: un aviso puede normalizarse y dejar de leerse. Mitigación: el CI reporta
  el conteo en cada ejecución, de modo que un aumento es visible en el propio pull request.

## Backlog derivado

1. Migrar los 15 `<img>` a `next/image` (rendimiento y LCP).
2. Refactorizar progresivamente los 21 hooks señalados por el React Compiler, **con
   pruebas que cubran cada componente antes de tocarlo**.
3. Reevaluar `@next/next/no-page-custom-font` en `app/layout.js`.
