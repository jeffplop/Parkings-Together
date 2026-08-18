## Qué cambia y por qué

<!-- Describe el problema que resuelve, no solo lo que tocaste.
     Si corrige un error, explica la causa raíz, no solo el síntoma. -->

## Tipo de cambio

- [ ] `feat` — nueva funcionalidad
- [ ] `fix` — corrección de un error
- [ ] `refactor` — reorganización sin cambio de comportamiento
- [ ] `docs` — solo documentación
- [ ] `test` — solo pruebas
- [ ] `build` / `ci` — herramientas, dependencias o pipeline
- [ ] Cambio rompiente (describe la migración necesaria)

## Verificación

> El CI ejecuta estas mismas comprobaciones. Correrlas antes ahorra un ciclo.

- [ ] `npm run lint` — 0 errores
- [ ] `npm test` — todas las pruebas en verde
- [ ] `npm run build` — las 4 aplicaciones compilan
- [ ] Probado manualmente en el navegador (indica qué flujo)

## Impacto en base de datos

- [ ] No toca la base de datos
- [ ] Incluye migración SQL en `sql/` (numerada, **idempotente** y verificada)
- [ ] Modifica políticas RLS (explica el nuevo modelo de acceso)

## Notas para quien revisa

<!-- Decisiones discutibles, alternativas descartadas, deuda que se asume
     conscientemente. Si el cambio implica una decisión de arquitectura,
     considera añadir un ADR en docs/adr/. -->
