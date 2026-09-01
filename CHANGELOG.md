# Changelog

Registro de cambios de **Parkings Together**.

Sigue el formato de [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el
versionado de [SemVer](https://semver.org/lang/es/): `MAYOR.MENOR.PARCHE`.

> **Nota histórica.** El proyecto se desarrolló durante un semestre sin etiquetas de
> versión. Las versiones anteriores a la `1.2.0` se **reconstruyeron a posteriori** a
> partir del historial real de git (243 commits, del 17-03-2026 al 25-07-2026),
> agrupando los cambios por hitos funcionales. Cada versión indica el commit en el que
> se cerró, de modo que la reconstrucción es verificable con `git show <hash>`.

---

## [No publicado]

> Contiene un **cambio rompiente** (eliminación de `/api/support/chat`). Al publicar,
> corresponde una versión mayor (`2.0.0`) según SemVer.

### Corregido
- **El mapa mostraba "API KEY REQUIRED" sobre toda la superficie.** CARTO exige una API
  key para sus basemaps desde 2025 y, sin ella, devuelve los tiles con esa marca de agua
  incrustada. Se cambió el proveedor por defecto a **Esri World Dark Gray Base** (oscuro,
  sin key, sin marca de agua), centralizado en `src/lib/mapTiles.js` y sobreescribible por
  entorno (`NEXT_PUBLIC_MAP_TILES_URL` / `_ATTRIBUTION`).
- **`403 Forbidden` en consola al cargar el mapa.** La geolocalización por IP usaba
  `ip-api.com`, cuyo tier gratuito es solo HTTP y devuelve 403 desde una página HTTPS. El
  usuario que negaba el GPS acababa **siempre** en Santiago, ignorando su ciudad. Se
  reemplazó por `geojs` (primario) e `ipwho.is` (respaldo), ambos keyless sobre HTTPS.
- Dos avisos de lint reales: directiva `eslint-disable` muerta en `profile/page.js` y un
  `console.log` de producción en `gemini.js` (ahora `console.warn` solo en desarrollo).

### Eliminado
- **Chat de soporte con IA** (widget flotante "Dareko"): componente `SupportChat.js`, ruta
  `POST /api/support/chat` y su documentación en el OpenAPI. La **mensajería en tiempo real
  conductor↔arrendador** (`/api/chat/*`) es una función distinta y **se conserva**.
- Corregido `.env.example`, que aún pedía `ANTHROPIC_API_KEY` para ese chat pese a la
  migración a Gemini (v1.0.0); ahora documenta `GEMINI_API_KEY`, las variables del mapa y
  las de Webpay.

### Seguridad
- Se documentó el estado de endurecimiento de Supabase en `docs/SEGURIDAD.md` (dos ajustes
  pendientes de panel: listado de buckets públicos y protección de contraseñas filtradas).

**⚠ Cambio rompiente:** `POST /api/support/chat` deja de existir. Ningún cliente propio lo
consumía (solo el widget eliminado).

---

## [1.2.0] — 2026-07-25

Versión de **endurecimiento**: sin funcionalidad nueva; corrige la cadena de construcción,
la seguridad de dependencias y la documentación. Es la primera con etiqueta de versión.

### Añadido
- **ESLint 9** (flat config) compartido en el monorepo con `eslint-config-next` 16, más
  configuración heredada por cada aplicación.
- **`SECURITY.md`**: modelo de seguridad, canal de reporte y análisis individual de cada
  alerta de dependencias vigente con su justificación.
- **Registros de decisión de arquitectura** en `docs/adr/`:
  - `0001` — por qué no hay middleware de servidor.
  - `0002` — política de lint: qué bloquea el CI y por qué.
- **Automatización de CI/CD**:
  - Pipeline reescrito en tres trabajos (`quality`, `security`, `gate`) con caché de
    Turborepo, cancelación de ejecuciones obsoletas y publicación de cobertura.
  - Workflow de `release` que valida lint + pruebas + build antes de publicar una etiqueta.
  - `dependabot.yml` con agrupación de dependencias y bloqueo de versiones mayores.
  - Plantillas de pull request e issues.
- Scripts nuevos: `lint`, `lint:fix`, `test:coverage`, `test:watch`, `audit:ci` y `verify`.
- Tareas `lint` y `clean` declaradas en `turbo.json`, con `globalDependencies` para que la
  caché invalide al cambiar la configuración de lint o de pruebas.

### Corregido
- **`npm run lint` nunca había funcionado.** Invocaba `turbo run lint`, pero la tarea no
  estaba declarada en `turbo.json` ni existía script `lint` en ninguna aplicación: fallaba
  con `Could not find task 'lint' in project`. El proyecto jamás había pasado por un linter.
  Al configurarlo aparecieron 63 problemas (41 errores, 22 avisos); los 41 errores están
  corregidos.
- **Builds no reproducibles.** `next`, `react` y `react-dom` estaban declarados como
  `"latest"`: cada `npm install` podía resolver una versión distinta y una versión mayor
  rompiente publicada aguas arriba habría tumbado producción sin cambiar una línea de
  código. Fijados a versiones exactas en las cuatro aplicaciones.
- **Vulnerabilidad alta en Next.js** — *Middleware / Proxy bypass in App Router
  applications* — cerrada al fijar `next@16.2.11`.
- **Documentación de pagos engañosa.** `payments.js` indicaba que para activar Webpay
  había que instalar `@transbank/sdk` y descomentar un bloque, cuando la integración real
  **ya existía** desde la versión 1.0.0 por REST en `src/lib/webpay.js`, en otras rutas y
  con otros nombres de variables de entorno (`TBK_*` en lugar de `TRANSBANK_*`). Habría
  llevado a cualquier desarrollador por el camino equivocado.
- Eliminado código muerto detectado por el linter: seis `catch` que no usaban su variable
  (ahora *optional catch binding*), imports sin usar, constantes calculadas y descartadas,
  y una guarda `if (channel)` que nunca podía ser falsa.
- Corregidas 11 referencias a "Next.js 14" y "React 18" en la documentación, cuando el
  proyecto ejecuta Next.js 16 y React 19.

### Eliminado
- **`apps/web/middleware.js`**: era código muerto (`matcher: []`, no interceptaba ninguna
  ruta) y usaba una convención deprecada en Next.js 16, generando un warning en cada build.
  Su justificación arquitectónica se conserva en el ADR `0001`.
- **`@anthropic-ai/sdk`**: quedó como dependencia de producción sin uso tras la migración
  de las funciones de IA a Gemini en la versión 1.0.0.

### Seguridad
- Alertas de `npm audit` reducidas de 4 advisories raíz a 3, todas documentadas y
  justificadas en `SECURITY.md`. **Vulnerabilidades accionables: 0.**
- Actualizados `swagger-ui-react` (5.32.6 → 5.32.11, que cierra `immutable`, `js-yaml` y
  `dompurify` de una vez), `@babel/core` (7.29.7) y `turbo` (2.10.7).
- Añadidos `overrides` para `brace-expansion@1.1.16` y `js-yaml@3.15.0`.
- Documentado que **no debe ejecutarse `npm audit fix`** en este repositorio: degrada
  `@babel/core` y arrastra la cadena de Jest, elevando el recuento de 9 a 23.

---

## [1.1.0] — 2026-07-12 · `18b853e`

### Añadido
- Cobertura de pruebas de los microservicios: la suite pasa de 77 a **167 pruebas**
  (12 conjuntos) con **91,55 %** de cobertura de sentencias.
- Swagger UI ampliado para documentar las cuatro superficies de la API.
- Informe de la Evaluación Transversal con diagrama de arquitectura y fragmento del
  patrón Saga.

---

## [1.0.0] — 2026-06-22 · `a6ebc88`

Primera versión considerada **completa en funcionalidad**: pagos reales, IA operativa y
mensajería en tiempo real.

### Añadido
- **Webpay Plus (Transbank) real** mediante cliente REST propio, sin SDK
  (`src/lib/webpay.js`), con el flujo completo de redirección: crear transacción →
  pago en Transbank → retorno → confirmación (*commit*). Opera en el ambiente de
  integración con credenciales públicas de prueba.
- **Comisión de plataforma** por pago, documentada en `docs/PAGOS.md`.
- **Mensajería en tiempo real** entre conductor y arrendador, con contador de no leídos
  en la barra de navegación.
- **Sugeridor de precios con IA** para arrendadores.

### Cambiado
- **Las funciones de IA migran de Anthropic (Claude) a Google Gemini**: chat de soporte,
  resumen de reseñas y sugeridor de precios. Se implementa un cliente REST mínimo
  (`src/lib/gemini.js`) sin dependencias adicionales, que descubre el modelo disponible
  con `ListModels` en lugar de fijar uno (evitando los 404 por modelo inexistente).

### Corregido
- Ajustes sucesivos del sugeridor de precios: limpieza de *fences* de markdown, parseo
  tolerante del JSON, guarda de cordura ante valores truncados y ampliación del límite de
  tokens de salida.
- Eliminado el *Toaster* duplicado en premium y auth.
- Corregido el FOUC en premium moviendo los estilos a un CSS importado.
- Evitada una excepción de Realtime al resuscribir el canal de reservas en la barra de
  navegación.
- La comuna se obtiene del geocodificador real y las plazas nuevas dejan de mostrar una
  valoración falsa.

---

## [0.9.0] — 2026-06-15 · `a8f92ae`

### Añadido
- **Swagger UI interactivo** publicado en `/api-docs`, servido desde la propia aplicación.

### Corregido
- Detección temprana de variables de entorno faltantes en el registro de usuarios.
- Suites de pruebas sincronizadas con las rutas de mismo origen.

---

## [0.8.0] — 2026-06-06 · `c828763`

### Añadido
- **Sello "Visita verificada"** en las reseñas, como señal de confianza.
- **Resumen inteligente de reseñas** con IA en la ficha del estacionamiento.

### Corregido
- La portada mostraba una valoración `4.8` fija en el código; ahora usa el promedio real.

---

## [0.7.0] — 2026-06-05 · `67833ff`

### Añadido
- Panel del conductor y vista de reservas según el rol del usuario.
- Página de detalle del estacionamiento.
- **Asistente de soporte con IA**, en sustitución del emparejamiento por palabras clave
  de las preguntas frecuentes.
- Edición de reseñas y panel de opiniones.
- Mejoras de experiencia móvil: llamada a la acción fija, imágenes diferidas.

---

## [0.6.0] — 2026-06-04 · `5b4b6f8`

### Añadido
- **PWA instalable** y ticket digital con código QR.
- Fotografías de estacionamientos y de reseñas, con visor ampliado.
- Panel de analítica para el arrendador.
- **Planes premium** con calculadora de ahorro y ranking por zona.
- Registro en varios pasos con campos específicos por rol.
- Abstracción de pagos, endurecimiento de SEO y estándares web.
- Datos de demostración para la Región Metropolitana y Rancagua.

---

## [0.5.0] — 2026-06-04 · `f81eac3`

### Añadido
- **Selector de plaza específica** con disposición tipo sala de cine.
- Bloqueos temporales de plaza (*locks*), pagos y reseñas.
- Precios dinámicos y soporte para varios tipos de vehículo.
- CRUD completo para el arrendador con **borrado lógico** protegido: un estacionamiento
  con reservas activas se desactiva en lugar de eliminarse.
- Página dedicada de reservas con indicador de notificaciones en tiempo real.

---

## [0.4.0] — 2026-06-03 · `86688e2`

### Añadido
- **Reservas profesionales** con ventana de tiempo (reserva anticipada), además de la
  reserva instantánea.
- Favoritos, valoraciones e historial.
- Búsqueda avanzada en el mapa.

### Corregido
- Migración idempotente para alinear el esquema de `estacionamientos` con el código: la
  base de datos de producción había evolucionado por fuera de los scripts versionados.

---

## [0.3.0] — 2026-05-31 · `a5287c2`

### Añadido
- **Radar de proximidad** en el mapa.
- Tabla `vehiculos` y gestión de estados vacíos en la interfaz.

---

## [0.2.0] — 2026-05-18 · `83d6df9`

### Añadido
- **Refactorización mayor a arquitectura por capas (DDD)** con patrón BFF.
- **Circuit Breaker** en las llamadas entre servicios.
- Primeras pruebas unitarias y pipeline de CI/CD.
- Aislamiento de variables de entorno por microservicio.

---

## [0.1.0] — 2026-03-17 · `8cf5cc3`

### Añadido
- Estructura inicial del monorepo con Turborepo.
- Aplicaciones `web`, `auth`, `ms-mapas` y `ms-reservas`.
- Paquete compartido `@parkings/supabase-db`.

---

## Cómo publicar una versión

1. Actualizar la sección `[No publicado]` de este archivo con los cambios reales.
2. Renombrarla a `[X.Y.Z] — AAAA-MM-DD`.
3. Verificar en local:
   ```bash
   npm run verify   # lint + pruebas + build
   ```
4. Confirmar, etiquetar y publicar:
   ```bash
   git commit -am "chore(release): vX.Y.Z"
   git tag -a vX.Y.Z -m "vX.Y.Z"
   git push origin master --follow-tags
   ```

El workflow `.github/workflows/release.yml` valida de nuevo lint, pruebas y build, y
publica la release en GitHub tomando las notas de la sección correspondiente de este
archivo.

### Criterio de versionado

| Incremento | Cuándo |
|---|---|
| **MAYOR** (`X`) | Cambio rompiente: la API, el esquema de datos o el contrato de configuración dejan de ser compatibles. |
| **MENOR** (`Y`) | Funcionalidad nueva compatible con lo anterior. |
| **PARCHE** (`Z`) | Correcciones, seguridad y documentación, sin funcionalidad nueva. |
