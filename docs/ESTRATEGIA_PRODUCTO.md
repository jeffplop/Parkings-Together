# Parkings Together — Evolución Estratégica de Producto
### De "proyecto que funciona" a "líder de categoría"

> Análisis con rol simultáneo de CTO, PM, Arquitecto, UX/UI Lead, Growth y Consultor de startups.
> Basado en: auditoría UX página por página (sobre el código real), investigación competitiva
> (JustPark, SpotHero, Spacer, Parkhound, Pavemint, SpotAngels, y Airbnb/Turo como referentes de
> confianza) e ideación desde 6 lentes de experto.

---

## 1. Resumen ejecutivo

Parkings Together ya tiene **los cimientos correctos de un marketplace P2P**: mapa con disponibilidad
en tiempo real (semáforo), reservas atómicas (instantánea + anticipada), reseñas ligadas a reservas
completadas, pagos con verificación e idempotencia, y un asistente con IA. **Lo que le falta no es
"que funcione" — es la capa que convierte un MVP en un producto de categoría: confianza verificable,
inteligencia (precio/predicción), y los loops de retención y crecimiento.**

La tesis es clara y respaldada por el mercado: **Chile quedó sin líder P2P residencial tras la salida
de WeSmartPark.** Quien combine **disponibilidad en tiempo real (ya la tienen) + confianza explícita
(verificación, badges, garantía) + inteligencia (pricing y predicción con la data que ya capturan)**
gana la categoría. Hoy Parkings Together tiene la pata 1 y le faltan la 2 y la 3 — y la mayoría son
construibles sobre lo que ya existe.

---

## 2. Análisis UX por página

| Página | Qué falta (lo más importante) | Qué la haría parecer una app comercial real |
|---|---|---|
| **Home (`/`)** | Rating **4.8 hardcodeado** (riesgo de credibilidad); stats que descargan todas las filas para contar en cliente; sin navbar/CTA login vs registro diferenciados; sin prueba social real | Métricas vivas reales ("X reservas hoy"), testimonios con foto/comuna, badges de confianza (Webpay, soporte 24/7), bloque dual conductor/arrendador con **calculadora de ingresos**, footer legal completo |
| **Mapa (`/mapa`)** | **Dos sistemas de filtrado que no se combinan** (switches cliente vs filtros avanzados que sobrescriben); sin orden (cercanía/precio/rating); sin vista lista; sin estimador de costo total | Chips de filtros activos con "limpiar", toggle mapa/lista, orden, búsqueda **orientada al destino** ("cerca de a dónde voy") con tiempo a pie |
| **Detalle (`/estacionamiento/[id]`)** | Reseñas sin **verificación de visita**, sin categorías, sin orden por utilidad, sin respuesta del arrendador; sin atributos (CCTV/techado/EV); sin foto/identidad del arrendador | Sello "Visita verificada", desglose por criterios, perfil humano del arrendador con nivel/reputación, galería rica, mapa de cómo llegar embebido |
| **Dashboard** | Sin notificaciones de eventos de reserva; sin proyección de ingresos/insights para el arrendador; sin mensajería | KPIs accionables, panel de liquidez por comuna, recomendación de precio, centro de notificaciones |
| **Reservas (`/reservas`)** | Sin **extender tiempo** ni recordatorio de vencimiento; cancelación sin reglas/reembolso claros; sin mensajería con la contraparte | Gestión de sesión activa ("quedan 10 min", "+30 min"), política de cancelación visible, chat acotado a la reserva |
| **Perfil (`/profile`)** | Sin verificación (teléfono/identidad), sin historial de actividad, sin badges/nivel/reputación | Sello "Verificado", nivel calculado (no declarado), historial, reputación bidireccional |
| **Ranking** | Orden estático solo por rating; sin estatus dinámico ni perks | Sello "Súper Arrendador" con criterios objetivos que mejora el ranking y se ve en el mapa |
| **Premium (`/premium`)** | Gamificación **cosmética** (niveles/badges sin valor canjeable); paywall no contextual | Beneficios reales atados a reputación, paywall en el punto de fricción, referidos con crédito |
| **Auth (`/auth`)** | Sin verificación de teléfono en el registro; sin "social proof" de seguridad | OTP de teléfono (Supabase Auth), señales de confianza, onboarding por rol |

---

## 3. Potencial desaprovechado del producto

Parkings Together **ya captura los datos y tiene la infraestructura** para tres motores de valor que
hoy no explota. Esto es lo desaprovechado:

**3.1. Confianza — el gap #1, y casi gratis.** Todos los líderes (Airbnb, Turo, JustPark, Spacer)
se construyen sobre **identidad verificada + reputación visible**. Parkings Together registra patente
pero **no verifica identidad** y **no muestra ningún sello de confianza**. Tiene todo para hacerlo:
Supabase Auth soporta **OTP de teléfono** (verificación barata), y las tablas `reservas`/reseñas ya
contienen el comportamiento para calcular **niveles/badges** (rating, % de confirmación, baja
cancelación) tipo *Superhost*. Además, **cada reseña ya es una "visita verificada"** (solo existe si
hubo reserva completada) y el producto **no lo comunica** — un sello de confianza de coste cero.

**3.2. Inteligencia — la data ya está, falta el cerebro.** El precio es **100% manual y fijo**
(`precio_hora`/`price_per_minute`/`price_per_day`) y la disponibilidad es solo **en vivo** (semáforo).
Los líderes (SpotHero IQ, Parkopedia, SpotAngels) **predicen** disponibilidad futura y **recomiendan
precio** con histórico. Parkings Together ya tiene el histórico (`reservas` con `fecha_inicio/fin`,
`spot_locks`, PostGIS por comuna): con **una RPC de agregación** puede ofrecer "alta probabilidad de
cupo a las 18:00" en el marcador y "te sugerimos $1.800/h" al arrendador. Sube ingreso del arrendador
**y** comisión, sin trabajo manual.

**3.3. El loop conductor↔arrendador está abierto.** No hay **mensajería interna**, ni
**notificaciones** de eventos de reserva, ni **reseña bidireccional** (el arrendador no califica al
conductor). Sin reputación del conductor, el arrendador no confía para reservas anticipadas; sin
notificaciones, el loop de gestión se rompe; sin chat, se filtra el teléfono. Todo es construible
sobre **Supabase Realtime** (que ya usan para el mapa) + la **PWA** (push ya configurada).

**3.4. Monetización de un solo carril.** Hoy: suscripción + comisión. Se desaprovecha el segmento de
**mayor LTV** (parking **mensual/recurrente** con cobro automático vía `pg_cron`), la **confianza
monetizable** (garantía/seguro como add-on en checkout, modelo "Peace of Mind" de JustPark), y el
**B2B** (cuentas empresa/flotas). El motor de planes y pagos ya existe; falta cablearlo.

**3.5. Crecimiento sin loops.** No hay **programa de referidos** (loop viral clave en un mercado sin
líder), ni **proyección de ingresos** en el onboarding del arrendador (el gancho estándar para captar
oferta), ni **prueba social viva** en la home (que además hoy miente con el 4.8 fijo).

---

## 4. Plan para convertir este proyecto en un producto sobresaliente

Ordenado por **impacto/esfuerzo/valor**. Tres horizontes.

### 🟢 Quick wins — Semana 1 (alto valor, bajo esfuerzo, sin romper nada)

| # | Mejora | Categoría | Impacto | Esfuerzo | Valor real |
|---|---|---|---|---|---|
| 1 | **Sello "Visita verificada"** en cada reseña (la data ya lo garantiza) | Confianza | Alto | Bajo | Credibilidad instantánea de las reseñas, coste cero |
| 2 | **Matar el rating 4.8 hardcodeado** de la home → rating real agregado o "Nuevo" | Confianza | Alto | Bajo | Elimina riesgo de credibilidad y de evaluación |
| 3 | **Desglose de precio total + fee ANTES de confirmar** la reserva | Conversión | Alto | Bajo | Transparencia = más conversión, menos disputas |
| 4 | **Extender sesión / +tiempo** reusando `crear_reserva_pro` | Retención | Medio | Bajo | Reduce fricción del caso de uso #1 (se me acaba el tiempo) |
| 5 | **Atributos de valor** (CCTV, techado, acceso seguro, cargador EV) como chips | UX/valor | Medio | Bajo | Justifica precio y guía la decisión |

### 🔵 Diferenciadores — Mes 1 (lo que separa de un MVP)

| # | Mejora | Categoría | Impacto | Esfuerzo | Valor real |
|---|---|---|---|---|---|
| 6 | **Verificación de arrendador por OTP de teléfono** + sello "Verificado" | Confianza | Alto | Medio | Cierra el gap de confianza #1 del mercado |
| 7 | **Niveles/reputación** ("Súper Arrendador") calculados, que mejoran el ranking | Confianza/Retención | Alto | Medio | Patrón Superhost: convierte comportamiento en marketing |
| 8 | **Política de cancelación/reembolso reglada** (máquina de estados en RPC) | Confianza | Alto | Medio | Menos disputas, seguridad de compra |
| 9 | **Reseñas avanzadas**: categorías + "útil" + orden por utilidad + respuesta del arrendador | Confianza | Alto | Medio | Reseñas de calidad comercial (Airbnb-like) |
| 10 | **Notificaciones** de eventos de reserva (PWA push + email) | Retención | Alto | Medio | Cierra el loop de gestión |
| 11 | **Mensajería interna** conductor↔arrendador (Realtime, sin exponer teléfono) | Confianza/UX | Medio | Medio | Coordinación segura del acceso |
| 12 | **Programa de referidos** con crédito bilateral | Crecimiento | Alto | Medio | Loop viral en mercado sin líder |
| 13 | **Proyección de ingresos** en el onboarding del arrendador | Adopción | Medio | Bajo | Gancho de captación de oferta |

### 🟣 Apuestas grandes — Trimestre (foso defensivo)

| # | Mejora | Categoría | Impacto | Esfuerzo | Valor real |
|---|---|---|---|---|---|
| 14 | **Predicción de disponibilidad** por franja horaria (semáforo predictivo) | IA/Datos | Alto | Medio-Alto | Lo que hace SpotHero IQ; nadie lo ofrece local |
| 15 | **Pricing dinámico/recomendado** por ocupación, hora y comuna | IA/Monetización | Alto | Medio-Alto | Sube ingreso del arrendador y comisión |
| 16 | **Parking mensual recurrente** con cobro automático (`pg_cron`) | Monetización | Alto | Alto | Segmento de mayor LTV y retención |
| 17 | **Garantía "Plaza Garantizada"** (reembolso + crédito si falla) como add-on | Confianza/Monetización | Alto | Medio | Confianza monetizable en cada transacción |
| 18 | **Reseña bidireccional** (arrendador califica al conductor) | Confianza | Medio | Medio | Responsabilidad de ambos lados |
| 19 | **Dareko proactivo** con contexto real (tool use) + **moderación IA** de reseñas | IA | Medio | Medio | Asistente que actúa, no solo responde |
| 20 | **Búsqueda orientada al destino** (a dónde voy + tiempo a pie) | UX | Alto | Medio | Cambia el modelo mental de la búsqueda |

### Foco recomendado (lo que yo haría como CTO)
**Confianza primero** (1, 2, 6, 7, 8, 9) — es el gap #1, el más barato y el que más mueve conversión y
evaluación — **luego inteligencia** (14, 15) como foso, **y en paralelo los loops de crecimiento**
(3, 12, 13). La regla del mercado: **liquidez antes que cobertura** → concentrar densidad en pocas
comunas de Santiago antes de expandir.

---

## 5. Implementar ahora (shortlist de bajo riesgo)

1. **Sello "Visita verificada"** (✅ implementado en esta entrega — ver §6). Por qué: toda reseña ya
   proviene de una reserva completada (lo exige la RPC `calificar_reserva`); comunicarlo es coste cero
   y eleva la confianza. Cómo: badge en la reseña (detalle + mapa), sin cambios de esquema.
2. **Rating real en la home**: reemplazar `4.8` por `AVG(rating)` real (o "Nuevo" si no hay datos).
   Cómo: una consulta agregada o RPC; sin riesgo.
3. **Desglose de precio antes de confirmar**: en `ParkingSelector`, mostrar `precio_hora × duración`
   y el total. Cómo: cálculo en cliente con `src/lib/pricing.js` (ya existe y está 100% testeado).
4. **Chips de atributos de valor**: columnas booleanas aditivas (`techado`, `cctv`, `cargador_ev`,
   `acceso_seguro`) + chips en el detalle/listado. Cómo: migración aditiva + UI.
5. **Extender sesión**: PATCH que reuse `crear_reserva_pro` validando solapamiento. Cómo: acción nueva
   en `/api/reservas/manage`, sin tocar el flujo existente.
