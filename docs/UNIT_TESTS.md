# Pruebas Unitarias — Parkings Together
### Guía práctica: cómo ejecutarlas, generar la cobertura y qué mostrarle al profesor

> **Estado real (verificado):** **66 pruebas, 66/66 passing** ·
> Cobertura: **71.22 % sentencias · 70.76 % líneas · 69.23 % ramas** (supera el 60 % exigido).
> Esta guía es para la **Evaluación Parcial N°3 (DSY1106)**. El paquete completo de
> entrega está en la carpeta [`ENTREGA_PARCIAL3/`](../ENTREGA_PARCIAL3).

---

## 1. Paso a paso: cómo correr TODO (copiar y pegar)

Desde la **raíz del monorepo** (`Parkings-Together/`):

```bash
# 0. Instalar dependencias (solo la primera vez)
npm install

# 1. Correr TODAS las pruebas unitarias (Jest)
npx jest
#    -> Esperado: "Tests: 66 passed, 66 total"

# 2. Correr las pruebas + generar el REPORTE DE COBERTURA
npx jest --coverage
#    -> Crea la carpeta  coverage/  con el reporte HTML

# 3. Abrir el reporte de cobertura HTML en el navegador.
#    OJO: Jest lo genera en  coverage/lcov-report/index.html  (no en coverage/index.html)
#    Windows (PowerShell):
Invoke-Item .\coverage\lcov-report\index.html
#    Mac:    open coverage/lcov-report/index.html
#    Linux:  xdg-open coverage/lcov-report/index.html

# 4. (Opcional) Pruebas de contrato de las rutas API (node:test, aparte de Jest)
cd apps/web && npm test
```

> **¿Por qué dos comandos de pruebas?**
> `npx jest` corre las pruebas de **lógica de negocio** y de **microservicios** con
> medición de cobertura. `npm test` (en `apps/web`) corre 6 pruebas de **contrato de
> las rutas API** con el runner nativo `node:test` (sin base de datos real).

---

## 2. Qué se está probando (66 pruebas, 5 suites)

| Suite | Componente | N° | Qué valida |
|---|---|---:|---|
| `apps/web/tests/pricing.test.js` | BFF · `pricing.js` | **24** | Cálculo de tarifas por hora/minuto/día, redondeos, desglose |
| `apps/web/tests/payments.test.js` | BFF · `payments.js` | **30** | Proveedores de pago, IDs de transacción únicos, contrato uniforme |
| `apps/web/tests/geocoding.test.js` | BFF · `comunas-chile.js` | **8** | 16 regiones de Chile, detección por coordenadas |
| `apps/ms-reservas/tests/reserveService.test.js` | **ms-reservas** | **2** | **Saga** (rollback compensatorio) y **CQRS** (rechazo si está lleno) |
| `apps/web/tests/api.timeout.test.js` | BFF · resiliencia | **2** | `fetchWithTimeout` aborta y degrada ante latencia |
| **TOTAL (Jest)** | | **66** | **66/66 passing** |

Suite complementaria (corre con `npm test`, no con Jest):
`apps/web/tests/api.test.js` → 6 pruebas de contrato de `/api/mapas/search` y `/api/reservas/reserve`.

---

## 3. Cobertura real (salida de `npx jest --coverage`)

```
----------------------------------------------|---------|----------|---------|---------
File                                          | % Stmts | % Branch | % Funcs | % Lines
----------------------------------------------|---------|----------|---------|---------
All files                                     |   71.22 |    69.23 |   38.46 |   70.76
 apps/ms-reservas/.../reserve/services         |   78.57 |   100.00 |   50.00 |   78.57
 apps/web/src/lib/pricing.js                   |  100.00 |    97.50 |  100.00 |  100.00
 apps/web/src/lib/comunas-chile.js             |  100.00 |   100.00 |  100.00 |  100.00
 apps/web/src/lib/payments.js                  |   92.30 |    80.00 |  100.00 |   92.30
 packages/supabase-db/index.js                 |   53.33 |    41.66 |    0.00 |   53.33
----------------------------------------------|---------|----------|---------|---------
```

- **3 de las 4 métricas superan el 60 %** que exige la rúbrica.
- La lógica de negocio crítica (precios, pagos, geocoding) está al **100 % / 92 %**.
- El núcleo del microservicio de reservas tiene **100 % de ramas** (los dos caminos
  de la Saga, éxito y compensación, están probados).

---

## 4. ✅ Qué mostrarle al profesor (guion de demostración)

Sigue estos pasos **en vivo** durante la defensa. Toma ~3 minutos.

**Paso 1 — Demostrar que las pruebas pasan.**
```bash
npx jest
```
> *“Tenemos 66 pruebas unitarias automatizadas y todas pasan.”*
Muestra la línea verde **`Tests: 66 passed, 66 total`**.

**Paso 2 — Demostrar la cobertura (el requisito ≥ 60 %).**
```bash
npx jest --coverage
```
> *“La cobertura de sentencias es 71.22 %, supera el 60 % exigido.”*
Señala la fila **`All files`** de la tabla.

**Paso 3 — Mostrar el reporte navegable.**
```powershell
Invoke-Item .\coverage\lcov-report\index.html
```
> *“Este es el reporte HTML generado por la herramienta de testing (Istanbul).”*
Haz clic en `pricing.js` (100 %) y en `reserva.service.js` para mostrar las líneas cubiertas.

**Paso 4 — Mostrar una prueba que valida un PATRÓN DE DISEÑO** (clave para el 20 % del indicador 8).
Abre `apps/ms-reservas/tests/reserveService.test.js` y explica la prueba
*“rollback (compensación) si la actualización de plazas falla”*:
> *“Esta prueba verifica el patrón **Saga**: si falla un paso después de crear la
> reserva, el sistema la **borra** para mantener la integridad. Eso es lo que
> verifica `expect(deleteReserve).toHaveBeenCalledWith('res-999')`.”*

**Paso 5 — Enlazar con la documentación de entrega.**
Abre [`ENTREGA_PARCIAL3/03_Informe_Pruebas_Unitarias.pdf`](../ENTREGA_PARCIAL3/03_Informe_Pruebas_Unitarias.md)
y el diagrama [`ENTREGA_PARCIAL3/01_Diagrama_Arquitectura/arquitectura.png`](../ENTREGA_PARCIAL3/01_Diagrama_Arquitectura).

### Checklist rápido antes de la defensa
- [ ] `npx jest` corre sin errores en mi equipo (probado antes de la clase).
- [ ] Sé abrir `coverage\lcov-report\index.html` y leer el % de un archivo.
  1 [ ] Puedo explicar la prueba de la **Saga** señalando el código.
- [ ] Sé dónde está cada suite y qué componente prueba.
- [ ] Tengo el ZIP `ENTREGA_PARCIAL3_ParkingsTogether.zip` subido a Blackboard.

---

## 5. Configuración técnica (por si preguntan)

**`jest.config.js`** (raíz): entorno `node`, transpila con `babel-jest`, y carga
`jest.setup.js` que hace *polyfill* de `WebSocket` para que el cliente Supabase no
falle al cargarse en el entorno de pruebas.

```js
module.exports = {
  testEnvironment: 'node',
  setupFiles: ['./jest.setup.js'],
  transform: { '^.+\\.js$': 'babel-jest' },
  testMatch: ['**/tests/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', 'apps/web/tests/api.test.js'],
  transformIgnorePatterns: ['/node_modules/(?!@parkings)'],
};
```

**Metodología:** todas las pruebas siguen **AAA (Arrange-Act-Assert)** y aíslan las
dependencias con **mocks** (`jest.mock`), por lo que son deterministas y no
necesitan base de datos ni red reales.

---

## 6. Cómo agregar una prueba nueva

1. Crea `apps/<componente>/tests/mi-modulo.test.js`.
2. Importa la función a probar: `import { miFuncion } from '../src/...';`
3. Escribe los casos:
   ```js
   describe('miFuncion', () => {
     test('caso esperado', () => {
       expect(miFuncion(entrada)).toBe(resultadoEsperado);
     });
   });
   ```
4. Corre `npx jest` y confirma que pasa.
5. Vuelve a generar la cobertura con `npx jest --coverage`.

---

## 7. Plan de mejora de cobertura (honesto)

La métrica de **funciones (38 %)** es menor porque `apps/web/src/lib/api.js` (el
orquestador de red del BFF) y `packages/supabase-db/index.js` agrupan funciones de
I/O difíciles de cubrir sin un entorno de integración. **Siguiente paso:** añadir
pruebas de los *wrappers* de `api.js` con `fetch` mockeado (ya iniciado en
`api.timeout.test.js`) para subir funciones por sobre el 60 %.
