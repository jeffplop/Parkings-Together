// Ruta de metadatos de Next.js → genera /manifest.webmanifest.
// Da soporte PWA básico (instalable, color de tema, modo standalone).
// Nota: para íconos PWA óptimos añade icon-192.png e icon-512.png en /public
// y agrégalos al array `icons`. Por ahora se referencia el favicon existente.

export default function manifest() {
  return {
    name: 'Parkings Together',
    short_name: 'Parkings',
    description: 'Encuentra estacionamientos cerca de ti o publica tu plaza disponible.',
    start_url: '/',
    display: 'standalone',
    background_color: '#020617',
    theme_color: '#020617',
    lang: 'es-CL',
    categories: ['travel', 'navigation', 'utilities'],
    icons: [
      { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
      { src: '/favicon.ico', sizes: 'any', type: 'image/x-icon' },
    ],
  };
}
