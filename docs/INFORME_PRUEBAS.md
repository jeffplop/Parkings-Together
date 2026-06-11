# Informe de Pruebas — Parkings Together

| | |
|---|---|
| **Proyecto** | Parkings Together — Marketplace P2P de estacionamientos |
| **Documento** | Informe de Pruebas de Software |
| **Fecha** | 11 de junio de 2026 |
| **Integrantes** | _(completar)_ |
| **Frameworks** | Jest · Node.js Test Runner (`node:test`) · Istanbul (cobertura) |
| **Resultado global** | ✅ **68 / 68 pruebas aprobadas (100%)** |

---

## 1. Objetivo

Verificar, mediante **pruebas automatizadas**, que la lógica de negocio y las APIs
de Parkings Together funcionan correctamente y se mantienen estables ante cambios.
Este informe documenta las pruebas ejecutadas, sus resultados y la **cobertura de
código** alcanzada, aportando la evidencia que respalda la calidad del software.

---

## 2. Alcance y entorno de pruebas

Se probó la **lógica de dominio** (precios, pagos, geocodificación), el patrón
**Saga** de reservas y las **rutas del BFF** (mapas y reservas). Las pruebas se
ejecutan sin depender de servicios externos: la base de datos y la red se
**simulan (mocks)**, de modo que son rápidas, deterministas y reproducibles.

| Aspecto | Detalle |
|---|---|
| Lenguaje / runtime | JavaScript · Node.js (≥ 22) |
| Pruebas unitarias y de dominio | **Jest** (`babel-jest` para ESM → CJS) |
| Pruebas de integración de API | **`node:test`** (runner nativo de Node) |
| Cobertura | Istanbul (reporte `text` y `lcov-report` HTML) |
| Aislamiento | `jest.mock()` y mock de `fetch` → sin BD ni red reales |
| Ubicación | `apps/web/tests/`, `apps/ms-reservas/tests/` |

---

## 3. Estrategia y tipos de prueba

| Tipo | Qué valida | Suites |
|---|---|---|
| **Unitarias** | Funciones puras de negocio (cálculo de precios, proveedores de pago, regiones) | `pricing`, `payments`, `geocoding` |
| **Integración de API** | Contrato de las rutas del BFF (estructura de respuesta, códigos) | `api.test.js` |
| **Dominio / Saga** | Reserva atómica con compensación (rollback) y control de capacidad (CQRS) | `reserveService.test.js` |
| **Resiliencia** | Timeout y *fallback* del BFF ante latencia del backend | `api.timeout.test.js` |

---

## 4. Resumen de resultados

### Pruebas evidenciadas en las capturas

| Capa | Framework | Archivos | Casos | Resultado |
|---|---|---|---:|:--:|
| Unitarias (lógica de negocio) | Jest | `pricing`, `payments`, `geocoding` | **62** | ✅ 62/62 |
| Integración de API (BFF) | `node:test` | `api.test.js` | **6** | ✅ 6/6 |
| **TOTAL** | | | **68** | ✅ **100%** |

- **Test Suites (Jest):** 3 passed, 3 total
- **Tests (Jest):** 62 passed, 62 total — tiempo ≈ **0.36 s** (sin cobertura) / **0.56 s** (con cobertura)
- **Tests (node:test):** 6 passed, 0 failed — `duration_ms ≈ 107`

### Pruebas de dominio adicionales (incluidas en la cobertura global)

| Suite | Framework | Casos | Resultado |
|---|---|---:|:--:|
| Saga de reservas (`reserveService.test.js`) | Jest | 2 | ✅ |
| Timeout / fallback BFF (`api.timeout.test.js`) | Jest | 2 | ✅ |

> En total, el repositorio contiene **72 pruebas automatizadas**; las 68 de la tabla
> principal son las verificadas directamente en las capturas de evidencia.

---

## 5. Detalle por suite

### 5.1. `pricing.test.js` — cálculo de precios
**Módulo:** `apps/web/src/lib/pricing.js` (`calcTotal`, `calcBreakdown`).
Valida el cálculo de tarifa por duración: duración 0 → $0; estacionamiento
gratuito → $0; tarifas por **hora**, por **minuto** y por **día** (incluyendo
redondeos y fracciones); combinaciones día+hora+minuto; y que el *desglose*
(`calcBreakdown`) sume exactamente lo mismo que `calcTotal`.

### 5.2. `payments.test.js` — proveedores de pago (Strategy)
**Módulo:** `apps/web/src/lib/payments.js`.
Valida `isValidProvider` (acepta `mock`/`efectivo`/`webpay`, rechaza otros),
`genTransactionId` (formato y unicidad), `isWebpayConfigured`, y que
`createCharge` devuelva un **contrato uniforme** `{ status, transactionId, raw }`
para los tres proveedores.

### 5.3. `geocoding.test.js` — regiones de Chile
**Módulo:** `apps/web/src/lib/comunas-chile.js` (`REGIONES`, `detectarRegion`).
Valida que existan las **16 regiones** con sus campos y límites coherentes, que
coordenadas reales caigan en la región correcta (Santiago → RM, Valparaíso → V) y
que puntos fuera de Chile devuelvan `null`.

### 5.4. `api.test.js` — rutas del BFF (`node:test`)
Prueba la estructura de respuesta de `/api/mapas/search` y
`/api/reservas/reserve` con un **mock de `fetch`**, sin BD real. Casos:

| # | Caso | Resultado |
|---|---|:--:|
| 1 | BFF · Mapas: actualizar ocupación correctamente | ✅ |
| 2 | BFF · Mapas: falla al exceder capacidad en PATCH | ✅ |
| 3 | BFF · Reservas: verificar disponibilidad (plaza libre) | ✅ |
| 4 | BFF · Reservas: verificar disponibilidad (plaza llena) | ✅ |
| 5 | BFF · Reservas: crear reserva con éxito | ✅ |
| 6 | BFF · Reservas: maneja error si falla la creación | ✅ |

### 5.5. `reserveService.test.js` — Saga de reservas (CQRS + compensación)
**Módulo:** `apps/ms-reservas/.../services/reserva.service.js`. Demuestra la
**robustez transaccional**:
- Rechaza la reserva si el estacionamiento está **lleno** (no llama a `createReserve`).
- Si falla el aumento de ocupación, ejecuta **rollback** (borra la reserva creada) →
  *Saga compensada*, garantizando integridad ante errores de concurrencia.

### 5.6. `api.timeout.test.js` — resiliencia del BFF
Verifica que el cliente del BFF devuelva los datos si la respuesta llega a tiempo,
y que **aborte y entregue un *fallback*** (`{ fallback: true, success: false, data: [] }`)
si la petición supera ~4 s. Demuestra el manejo de latencia/indisponibilidad.

---

## 6. Cobertura de código

### 6.1. Cobertura de la lógica de negocio probada (`apps/web`, Jest `--coverage`)

| Archivo | % Stmts | % Branch | % Funcs | % Lines |
|---|---:|---:|---:|---:|
| **All files** | **98.59** | **94.64** | **100** | **98.43** |
| `comunas-chile.js` | 100 | 100 | 100 | 100 |
| `payments.js` | 94.44 | 80 | 100 | 94.11 |
| `pricing.js` | 100 | 97.5 | 100 | 100 |

> Los módulos ejercitados por las pruebas alcanzan **98.59 % de sentencias** y
> **100 % de funciones**: la lógica crítica de negocio está prácticamente cubierta
> en su totalidad.

### 6.2. Cobertura global del monorepo (reporte `lcov-report`)

| Módulo | % Stmts | % Branch | % Funcs | % Lines |
|---|---:|---:|---:|---:|
| **All files** | **73.15** (109/149) | **70.43** (81/115) | **41.46** (17/41) | **72.85** (102/140) |
| `apps/ms-reservas/.../reserve/services` | 78.57 | 100 | 50 | 78.57 |
| `apps/web/src/lib` | 75 | 77.01 | 43.24 | 74.77 |
| `packages/supabase-db` | 53.33 | 41.66 | 0 | 53.33 |

> La cobertura global (**73 %**) es saludable considerando que las pruebas se
> concentran en la **lógica de dominio**. Las ramas (*branches*) críticas de la Saga
> de reservas están cubiertas al **100 %**.

---

## 7. Evidencias

> Las capturas se incluyen en `docs/img/`. Cada una transcribe sus datos clave
> arriba, de modo que el informe es autocontenido.

**Evidencia 1 — `npx jest --coverage` (apps/web):** 3 suites *passed*, **62 tests
passed**, tabla de cobertura (All files 98.59 % stmts), tiempo 0.558 s.

![Evidencia 1 — Jest con cobertura](img/prueba-01-jest-coverage.png)

**Evidencia 2 — `npx jest` (apps/web):** 3 suites *passed*, **62 tests passed**,
tiempo 0.359 s.

![Evidencia 2 — Jest](img/prueba-02-jest.png)

**Evidencia 3 — `npm test` → `node --test tests/api.test.js`:** 6 pruebas del BFF
(mapas y reservas) *passed*, `pass 6 / fail 0`, `duration_ms 107`.

![Evidencia 3 — node:test API](img/prueba-03-node-test-api.png)

**Evidencia 4 — Reporte de cobertura HTML (`coverage/lcov-report/index.html`):**
All files 73.15 % stmts, con desglose por módulo (ms-reservas, web/src/lib,
supabase-db).

![Evidencia 4 — Cobertura global](img/prueba-04-cobertura-global.png)

### Nota sobre las advertencias de la Evidencia 3
La salida muestra dos *warnings* **benignos** que **no afectan el resultado**
(las 6 pruebas pasan):
- `MODULE_TYPELESS_PACKAGE_JSON`: sugerencia de añadir `"type": "module"` al
  `package.json` (solo rendimiento de parseo).
- `[supabase-db] ADVERTENCIA: Faltan llaves de Supabase`: **esperado**, porque las
  pruebas usan *mocks* y no se conectan a la base de datos real.

---

## 8. Análisis y conclusiones

- ✅ **Las pruebas funcionan correctamente:** 68/68 aprobadas (100%), en menos de
  1 segundo, de forma determinista y sin dependencias externas.
- ✅ **Lógica crítica muy cubierta:** precios, pagos y geocoding con **98.59 %** de
  sentencias y **100 %** de funciones.
- ✅ **Robustez demostrada:** la Saga de reservas valida capacidad (CQRS) y revierte
  ante fallos (compensación, *branches* al 100 %); el BFF maneja *timeout* con
  *fallback*.
- 🔧 **Oportunidades de mejora (honestas):** subir la cobertura de funciones global
  (41 %) añadiendo pruebas a más *route handlers* del BFF y a `packages/supabase-db`
  (hoy 0 % de funciones, al ser principalmente configuración del cliente).

**Conclusión:** la batería de pruebas automatizadas evidencia que los componentes
centrales de Parkings Together se comportan según lo esperado y quedan protegidos
ante regresiones.

---

## 9. Cómo reproducir las pruebas

```bash
# Desde la raíz del monorepo
npm install

# 1) Pruebas unitarias de negocio (Jest) — 62 tests
cd apps/web
npx jest                 # resultado: 3 suites, 62 passed
npx jest --coverage      # + reporte de cobertura

# 2) Pruebas de integración de API (node:test) — 6 tests
npm test                 # node --test tests/api.test.js → 6 passed

# 3) Cobertura global del monorepo (incluye Saga y timeout)
cd ../..
npx jest --coverage      # genera coverage/lcov-report/index.html
```

> El reporte HTML de cobertura queda en `coverage/lcov-report/index.html`
> (ábrelo en el navegador para la vista de la Evidencia 4).
