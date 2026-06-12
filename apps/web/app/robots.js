// Ruta de metadatos de Next.js → genera /robots.txt automáticamente.
// Permite indexar las páginas públicas y bloquea las áreas privadas/API.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://parkings-web.vercel.app';

export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/mapa', '/auth'],
      disallow: ['/api/', '/dashboard', '/profile', '/reservas'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
