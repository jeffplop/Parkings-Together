// Catálogo de planes de suscripción de Parkings Together — v2
// Basado en análisis competitivo: SpotHero, JustPark, EasyPark, BlaBlaCar.
//
// Principios de diseño:
//  · Los conductores reservan GRATIS siempre (modelo del mercado).
//  · El premium de conductores es conveniencia/ahorro, nunca acceso básico.
//  · Los arrendadores tienen 3 niveles (escalonados por volumen).
//  · La plataforma gana con comisión de servicio (~8%) incluida en el precio.
//  · Premium reduce esa comisión → el upgrade se paga solo para usuarios frecuentes.
//  · Precios alineados con referencia CLP Chile 2025 (Apple TV+ $4.990, Netflix $7.190).

export const COMISION_PLATAFORMA = 8; // % incluido en precio mostrado, plan Free

export const PLANES = {
  conductor: [
    {
      id: 'free',
      nombre: 'Explorador',
      tagline: 'Todo lo que necesitas para empezar',
      precioMensual: 0,
      color: '#64748b',
      icon: 'fa-car',
      destacado: false,
      tag: null,
      beneficios: [
        { txt: 'Búsqueda y reserva ilimitadas', ok: true, bold: true },
        { txt: 'Pago seguro e historial completo', ok: true },
        { txt: 'Reseñas y favoritos sin límite', ok: true },
        { txt: 'Ranking de mejores plazas', ok: true },
        { txt: 'Tarifa de servicio incluida (~8%)', ok: true, note: 'Incluida en el precio mostrado' },
        { txt: 'Reserva anticipada hasta 7 días', ok: false },
        { txt: 'Alertas de disponibilidad', ok: false },
        { txt: 'Insignia Pro + sin tarifa de servicio', ok: false },
      ],
    },
    {
      id: 'pro',
      nombre: 'Conductor Pro',
      tagline: 'Para quien estaciona seguido',
      precioMensual: 2990,
      color: '#3b82f6',
      icon: 'fa-bolt',
      destacado: true,
      tag: 'Más popular',
      beneficios: [
        { txt: 'Todo lo del plan Explorador', ok: true, bold: true },
        { txt: 'Sin tarifa de servicio (ahorras ~8%/reserva)', ok: true, bold: true },
        { txt: 'Reserva anticipada hasta 30 días', ok: true },
        { txt: 'Alertas cuando se libere una plaza favorita', ok: true },
        { txt: 'Estadísticas de gasto mensual', ok: true },
        { txt: 'Insignia "Pro" en tus reseñas', ok: true },
        { txt: 'Soporte prioritario por chat', ok: true },
      ],
    },
  ],
  arrendador: [
    {
      id: 'free',
      nombre: 'Inicio',
      tagline: 'Publica tus primeras plazas sin costo',
      precioMensual: 0,
      color: '#64748b',
      icon: 'fa-square-parking',
      destacado: false,
      tag: null,
      beneficios: [
        { txt: 'Hasta 3 estacionamientos publicados', ok: true, bold: true },
        { txt: 'Comisión plataforma: 15% por reserva', ok: true },
        { txt: 'Fotos ilimitadas por plaza', ok: true },
        { txt: 'Panel de gestión de reservas', ok: true },
        { txt: 'Comisión reducida (8%)', ok: false },
        { txt: 'Destacado ⭐ en el mapa', ok: false },
        { txt: 'Analítica de ingresos avanzada', ok: false },
      ],
    },
    {
      id: 'plus',
      nombre: 'Arrendador Plus',
      tagline: 'Más plazas, menor comisión',
      precioMensual: 4990,
      color: '#3b82f6',
      icon: 'fa-chart-line',
      destacado: false,
      tag: null,
      beneficios: [
        { txt: 'Hasta 10 estacionamientos', ok: true, bold: true },
        { txt: 'Comisión reducida: 8% (ahorras 7%)', ok: true, bold: true },
        { txt: 'Destacado ⭐ en el mapa', ok: true },
        { txt: 'Analítica de ingresos avanzada', ok: true },
        { txt: 'Soporte prioritario', ok: true },
        { txt: 'Comisión mínima 5%', ok: false },
        { txt: 'Insignia "Verificado" + estacionamientos ilimitados', ok: false },
      ],
    },
    {
      id: 'premium',
      nombre: 'Arrendador Pro',
      tagline: 'Maximiza ingresos sin límites',
      precioMensual: 7990,
      color: '#8b5cf6',
      icon: 'fa-crown',
      destacado: true,
      tag: 'Máximo rendimiento',
      beneficios: [
        { txt: 'Estacionamientos ilimitados', ok: true, bold: true },
        { txt: 'Comisión mínima: 5% (ahorras 10%)', ok: true, bold: true },
        { txt: 'Máximo destacado ⭐⭐ en el mapa', ok: true },
        { txt: 'Insignia "Verificado" en todas tus plazas', ok: true },
        { txt: 'Analítica avanzada + exportar reportes', ok: true },
        { txt: 'Soporte prioritario 24/7', ok: true },
        { txt: 'Acceso anticipado a nuevas funciones', ok: true },
      ],
    },
  ],
};

// Precio según ciclo: anual = 10 mensualidades (≈ 2 meses gratis).
export function precioCiclo(precioMensual, ciclo) {
  if (precioMensual === 0) return 0;
  return ciclo === 'anual' ? precioMensual * 10 : precioMensual;
}

// Para un conductor que reserva N veces/mes con precio promedio P,
// ¿en cuántas reservas se paga el Pro solo?
export function mesesToPayback(precioMensualPro, precioPromedioReserva) {
  const ahorroComisionPorReserva = precioPromedioReserva * (COMISION_PLATAFORMA / 100);
  const reservasMes = precioMensualPro / ahorroComisionPorReserva;
  return Math.ceil(reservasMes);
}

// Niveles de gamificación (basados en reservas completadas)
export const NIVELES_CONDUCTOR = [
  { id: 'novato',    label: 'Novato',            min: 0,   icon: 'fa-seedling',   color: '#64748b' },
  { id: 'regular',   label: 'Conductor Regular', min: 5,   icon: 'fa-car',        color: '#3b82f6' },
  { id: 'frecuente', label: 'Conductor Frecuente',min: 20, icon: 'fa-bolt',       color: '#8b5cf6' },
  { id: 'elite',     label: 'Conductor Elite',   min: 50,  icon: 'fa-star',       color: '#f59e0b' },
];

export const BADGES = [
  { id: 'primera_reserva', label: 'Primera Plaza',    icon: 'fa-key',           desc: 'Completaste tu primera reserva' },
  { id: 'reserva_10',      label: 'Conductor x10',    icon: 'fa-car',           desc: '10 reservas completadas' },
  { id: 'reserva_50',      label: 'Conductor x50',    icon: 'fa-trophy',        desc: '50 reservas completadas' },
  { id: 'puntual',         label: 'Siempre Puntual',  icon: 'fa-clock',         desc: '5 reservas sin cancelar' },
  { id: 'reseniador',      label: 'Crítico de Plazas',icon: 'fa-star',          desc: '5 reseñas publicadas' },
  { id: 'explorador',      label: 'Explorador',       icon: 'fa-map-location-dot', desc: 'Reservaste en 3 comunas distintas' },
];

export const FAQ = [
  {
    q: '¿Los conductores realmente pueden reservar gratis?',
    a: 'Sí, siempre. La plataforma incluye una pequeña tarifa de servicio (~8%) en el precio que ves — igual que SpotHero o JustPark. Nunca pagas suscripción obligatoria para reservar.',
  },
  {
    q: '¿Cuándo me conviene el plan Conductor Pro?',
    a: 'El plan Pro ($ 2.990/mes) elimina la tarifa de servicio. Si reservas plazas por un total de ~$37.500/mes o más, te conviene: el ahorro en comisión cubre la suscripción.',
  },
  {
    q: '¿Puedo cancelar cuando quiera?',
    a: 'Sí. Bajas al plan gratuito en cualquier momento desde tu perfil. Mantienes los beneficios hasta el final del período pagado.',
  },
  {
    q: '¿Cómo funciona la comisión para arrendadores?',
    a: 'Plan Inicio: 15% sobre cada reserva. Plus: 8%. Pro: 5%. Con Pro, si recibes $500.000/mes en reservas, el ahorro en comisión (10%) supera con creces la suscripción.',
  },
  {
    q: '¿El plan anual es mejor precio?',
    a: 'El plan anual equivale a 10 mensualidades: pagas una vez y ahorras el equivalente a 2 meses.',
  },
  {
    q: '¿Los pagos son seguros?',
    a: 'Demo académica con pago simulado. En producción se integra Webpay (Transbank) para pagos reales en Chile.',
  },
];
