// Ruta de metadatos de Next.js → genera /sitemap.xml automáticamente.
// Solo incluye rutas públicas indexables (las privadas requieren sesión).

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://parkings-web.vercel.app';

export default function sitemap() {
  const now = new Date();
  return [
    { url: `${SITE_URL}/`,     lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${SITE_URL}/mapa`, lastModified: now, changeFrequency: 'daily',   priority: 0.9 },
    { url: `${SITE_URL}/auth`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ];
}
