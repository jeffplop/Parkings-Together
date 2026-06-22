# Pagos — Webpay Plus (Transbank) y comisión de la plataforma

Documento operativo del módulo de pagos: cómo funciona, cómo se cobra la
comisión y **qué falta para cobrar dinero real**.

> **Estado actual:** integración **verificada de extremo a extremo en
> producción**, pero corriendo en el **ambiente de integración (prueba)** de
> Transbank. Con tarjetas de prueba — **no mueve dinero real** hasta configurar
> una cuenta de comercio propia (ver [Pasar a producción](#pasar-a-producción)).

---

## 1. Arquitectura del flujo

El usuario paga el total a Parkings Together (un único comercio Transbank).
Los datos de la tarjeta **los maneja Transbank**, nunca nuestro servidor.

```
Usuario confirma pago (ParkingSelector)
        │
        ▼
POST /api/pagos/webpay/init ───────────────► Transbank: crea transacción
  · auth (Bearer) + valida monto/reserva       devuelve { token, url }
  · registra payment status=pending
        │
        ▼  (form POST token_ws → url)
   Webpay (transbank.cl): el usuario ingresa su tarjeta
        │
        ▼  (Transbank redirige de vuelta)
POST /api/pagos/webpay/return ─────────────► Transbank: commit(token)
  · confirma resultado                          { response_code, status, amount }
  · actualiza payment → completed | failed
  · guarda comisión en metadata
        │
        ▼  (redirect 303)
/pago/resultado?estado=ok|error|cancelado&monto=…
```

**Archivos:**

| Archivo | Rol |
|---|---|
| `apps/web/src/lib/webpay.js`            | Cliente REST de Transbank (`create` + `commit`). |
| `apps/web/src/lib/fees.js`              | Cálculo de la comisión (split del monto). |
| `apps/web/app/api/pagos/webpay/init/`   | Inicia la transacción y registra el pago pendiente. |
| `apps/web/app/api/pagos/webpay/return/` | Confirma (commit) y actualiza el pago. |
| `apps/web/app/pago/resultado/`          | Pantalla de éxito / rechazo / cancelado. |
| `apps/web/src/components/ParkingSelector.js` | Dispara el flujo si el método es Webpay. |

El método **"Efectivo al llegar"** y los cobros simulados (`mock`) siguen por
`POST /api/pagos` (capa `src/lib/payments.js`) — ese camino también registra la
comisión.

---

## 2. Comisión de la plataforma

El cobro es a un **único comercio** (Parkings Together). De cada pago se separa,
para efectos contables, cuánto es ingreso de la plataforma y cuánto se le debe
liquidar al dueño del estacionamiento:

```
platform_fee = round(amount × PLATFORM_FEE_PCT / 100)   ← ingreso de la plataforma
owner_payout = amount − platform_fee                    ← se liquida al dueño
```

Esto se calcula en `src/lib/fees.js` y se guarda en `payments.metadata` en cada
pago (`fee_pct`, `platform_fee`, `owner_payout`). El porcentaje se controla con
la variable `PLATFORM_FEE_PCT` (por defecto **10%**).

**Importante (honestidad operativa):** Transbank deposita el **total** en la
cuenta del comercio. El `owner_payout` es lo que la plataforma **le debe** al
dueño; la liquidación a su cuenta es un paso aparte (transferencia/settlement
manual, o Webpay Mall multicomercio en el futuro). Hoy queda **registrado**, no
se transfiere automáticamente.

### Reporte de ingresos

```sql
select
  count(*)                                      as pagos,
  sum(amount)                                   as bruto_clp,
  sum((metadata->>'platform_fee')::numeric)     as comision_plataforma_clp,
  sum((metadata->>'owner_payout')::numeric)     as a_liquidar_duenos_clp
from payments
where status = 'completed';
```

---

## 3. Variables de entorno

| Variable | Por defecto | Descripción |
|---|---|---|
| `TBK_ENV`            | `integration` | `integration` (prueba) o `production` (real). |
| `TBK_COMMERCE_CODE`  | código público de prueba | Código de comercio de Transbank. |
| `TBK_API_KEY`        | llave pública de prueba  | API key (secret) de Transbank. |
| `PLATFORM_FEE_PCT`   | `10` | Comisión de la plataforma, 0–100. |

En **integración** no hace falta definir nada: el código trae las credenciales
públicas de prueba de Transbank. En **producción** hay que definir las tres
primeras con los datos de la cuenta de comercio real.

---

## 4. Pasar a producción

> Esto requiere identidad/empresa y **solo lo puede hacer el dueño del negocio**.

1. **Abrir cuenta de comercio en Transbank** (Webpay Plus). Existe la opción
   *Transbank para Emprendedores* para partir sin gran formalización. Se necesita
   RUT, datos de la persona/empresa y una cuenta bancaria para los depósitos.
2. Transbank entrega un **Commerce Code** y una **API Key** de producción.
3. En **Vercel → Project → Settings → Environment Variables** (Production):
   ```
   TBK_ENV=production
   TBK_COMMERCE_CODE=<tu código real>
   TBK_API_KEY=<tu llave real>
   ```
4. Redeploy. El mismo código apunta solo a `https://webpay3g.transbank.cl`.
   **No hay que cambiar nada más.**
5. Hacer una compra real de monto bajo para validar el depósito.

> **Responsabilidad tributaria:** cobrar a terceros y repartir pagos implica
> emitir boletas/facturas y declarar. Revisar con un contador antes de operar
> comercialmente.

---

## 5. Tarjetas de prueba (ambiente de integración)

| Tarjeta | Número | Resultado |
|---|---|---|
| VISA (crédito)      | `4051 8856 0044 6623` | **Aprueba** |
| MASTERCARD (crédito)| `5186 0595 5959 0568` | Rechaza |
| Fecha / CVV         | cualquiera futura · `123` | |
| Banco (RUT / clave) | `11.111.111-1` / `123` | En la pantalla del banco elegir **Aceptar**. |

---

## 6. Estados del pago (`payments.status`)

| Estado | Significado |
|---|---|
| `pending`   | Transacción creada, esperando que el usuario pague. |
| `completed` | Pago aprobado por Transbank (`response_code = 0` + `AUTHORIZED`). |
| `failed`    | Rechazado por el banco o error en el commit. |
| `cancelled` | El usuario abortó el formulario de Webpay (volvió sin pagar). |

---

## 7. Seguridad

- Los datos de la tarjeta **nunca** tocan nuestro servidor: los captura Transbank.
- `init` exige sesión (Bearer) y valida que el monto coincida con
  `reservas.precio_total` y que la reserva sea del propio usuario (anti-manipulación).
- `return` confirma contra Transbank con `commit`; el estado del pago se decide
  por la respuesta de Transbank, no por el cliente.
- La API key de producción vive solo en variables de entorno de Vercel, fuera del
  repositorio.
