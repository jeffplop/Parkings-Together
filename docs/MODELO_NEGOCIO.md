# Parkings Together — Modelo de Negocio y Monetización
### Cómo este producto gana dinero y por qué es invertible

> Marco de monetización para un marketplace P2P de estacionamientos en Chile.
> Cifras de *unit economics* son **ilustrativas** (supuestos a validar con datos reales),
> marcadas como tales. La arquitectura para soportarlas ya existe (pagos con verificación
> e idempotencia, planes, RLS, PostGIS).

---

## 1. Tesis de negocio

Marketplace de dos lados (conductores ↔ arrendadores) en un mercado **sin líder**
(Chile, post-WeSmartPark). El valor: **monetizar capacidad de estacionamiento ociosa**
cobrando por **liquidez + confianza + conveniencia**. El negocio no vive de una sola
comisión: vive de **GMV creciente** (volumen transado) × **take rate** + capas premium.

---

## 2. Líneas de ingreso (revenue streams)

| # | Línea | Cómo cobra | Estado hoy | Prioridad |
|---|---|---|---|---|
| 1 | **Comisión transaccional (take rate)** | % sobre cada reserva pagada (núcleo del negocio) | Pagos existen (mock/Webpay sim.); falta cobrar comisión real | **Alta** |
| 2 | **Suscripción Premium** (conductor y arrendador) | Mensual/anual; planes free/pro/premium | Planes existen; beneficios poco diferenciados | **Alta** |
| 3 | **Garantía "Plaza Garantizada"** (add-on) | Fee opcional por reserva (reembolso+crédito si falla) | No existe | Media |
| 4 | **Parking mensual recurrente** | Cobro automático mensual con descuento por anticipo | No existe (solo reservas puntuales) | Media |
| 5 | **B2B / flotas / empresas** | Cuentas que reservan para empleados; facturación mensual | No existe | Media |
| 6 | **Listados destacados (boost)** | Arrendador paga por aparecer arriba en su zona | No existe | Baja |
| 7 | **Data de ocupación agregada / API** | Venta de insights a municipios/retail (futuro) | No existe | Baja (futuro) |

**Por qué múltiple:** los líderes (SpotHero, JustPark) no dependen de un solo flujo.
La comisión es la base; premium + garantía + mensual dan **ingreso recurrente y
predecible** (lo que valora un inversor).

---

## 3. Pricing y take rate (propuesta)

- **Comisión:** **12–18%** del valor de la reserva, **transparente y mostrada antes de
  confirmar** ("Plaza $X + Servicio $Y = Total $Z"). La transparencia sube conversión y
  baja disputas (patrón EasyPark/ParkWhiz). *Decisión de producto: definir el %.*
- **Premium Conductor (~$3.990/mes):** sin comisión de servicio, reserva anticipada 30
  días, alertas inteligentes de disponibilidad, soporte prioritario.
- **Premium Arrendador (~$5.990/mes):** menor comisión, prioridad en ranking, precio
  recomendado por IA, panel de insights de liquidez.
- **Garantía:** **+5–8%** opcional por reserva (margen directo, modelo *Peace of Mind*).
- **Pago real:** integrar **Webpay (Transbank)** — estándar chileno — sustituyendo el
  flujo simulado, sin tocar la capa de proveedores ya abstraída en `src/lib/payments.js`.

---

## 4. Unit economics (ilustrativo — a validar)

| Métrica | Supuesto | Nota |
|---|---|---|
| Valor medio de reserva (AOV) | $3.500 CLP | depende de duración/comuna |
| Take rate | 15% | → **$525 de ingreso por reserva** |
| Costo variable por reserva | ~$120 | pasarela (~2,9%) + infra + soporte IA |
| **Margen de contribución** | **~$405/reserva (≈77%)** | alto, típico de marketplace |
| Reservas/usuario activo/mes | 4 | conductor urbano recurrente |
| **Ingreso/usuario/mes** | **~$2.100** (solo comisión) | +premium/garantía lo elevan |
| LTV (12 meses, sin premium) | ~$25.000 | sube fuerte con recurrencia/mensual |
| CAC objetivo | < $8.000 | con loop de referidos baja mucho |
| **LTV/CAC** | **> 3x** | umbral de inversión sano |

> El **driver #1 de valuación es el GMV y su crecimiento**; el take rate y las capas
> premium convierten ese GMV en ingreso. Por eso: **liquidez antes que cobertura**
> (densificar comunas) maximiza GMV por mercado.

---

## 5. Premium que convierte (no cosmético)

El usuario debe pensar *"me ahorra/da plata"*, no *"tengo una insignia"*:

- **Conductor:** elimina la comisión de servicio (se paga solo con ~8 reservas/mes),
  reserva anticipada real, alertas de cupo en favoritos, garantía incluida.
- **Arrendador:** **menor comisión** (más ingreso neto), **precio recomendado por IA**
  (gana más sin trabajo), **prioridad en ranking** (más reservas), insights de demanda.
- **Gatillo de conversión:** paywall **contextual** en el punto de fricción ("Ahorrarías
  $X/mes con Premium" justo al pagar la comisión), no un muro genérico.

---

## 6. Qué construir para activar la monetización (priorizado)

| # | Entregable | Riesgo | Por qué |
|---|---|---|---|
| 1 | **Desglose de precio + comisión antes de confirmar** | Bajo | Transparencia = conversión; base para cobrar comisión |
| 2 | **Webpay (Transbank) real** sobre la capa `payments.js` ya abstraída | Medio | Cobro real en Chile; desbloquea ingreso |
| 3 | **Ledger de comisión** (registrar fee por transacción en `payments`) | Bajo | Medir take rate y GMV |
| 4 | **Gating de Premium** atado a ahorro + paywall contextual | Bajo | Convierte el plan en ingreso recurrente |
| 5 | **Garantía add-on** en checkout | Medio | Margen + confianza monetizable |
| 6 | **Mensual recurrente** (`pg_cron` + cobro) | Alto | Segmento de mayor LTV |

---

## 7. Métricas a instrumentar (panel de inversor)

**GMV**, **take rate efectivo**, **conversión búsqueda→reserva**, **reservas/usuario/mes**,
**retención M1/M3**, **conversión a Premium**, **densidad de oferta por comuna**,
**CAC y LTV/CAC**, **% reservas con garantía**. Hoy no se mide casi nada de esto: sin
instrumentación no hay historia de inversión.

---

## 8. Recomendación

Activar la monetización en este orden: **(1) transparencia de precio/comisión → (2)
Webpay real → (3) ledger + métricas → (4) premium contextual**. Es la secuencia que
convierte el MVP en un negocio medible y defendible, con el menor riesgo y reutilizando
la arquitectura existente.
