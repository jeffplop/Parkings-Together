/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // El web consume @parkings/supabase-db desde sus route handlers de mismo origen
  // (app/api), por lo que debe transpilar el paquete del workspace.
  transpilePackages: ["@parkings/supabase-db"],
  // Cabeceras de seguridad de base. No se incluye Content-Security-Policy porque
  // la app usa estilos inline (styled-jsx) y CDNs (Google Fonts, Font Awesome,
  // tiles de mapa), y una CSP estricta los rompería; queda como mejora futura.
  // Vercel ya añade Strict-Transport-Security (HSTS) automáticamente.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), payment=()" },
        ],
      },
    ];
  },
  async rewrites() {
    const authUrl = process.env.NEXT_PUBLIC_MS_AUTH_URL;
    const mapasUrl = process.env.NEXT_PUBLIC_MS_MAPAS_URL;
    const reservasUrl = process.env.NEXT_PUBLIC_MS_RESERVAS_URL;
    if (process.env.NODE_ENV === "development") return [];
    if (!authUrl || !mapasUrl || !reservasUrl) return [];
    return [
      { source: "/api/auth/:path*", destination: authUrl + "/auth/:path*" },
      { source: "/api/mapas/:path*", destination: mapasUrl + "/search/:path*" },
      { source: "/api/reservas/:path*", destination: reservasUrl + "/reserve/:path*" },
    ];
  },
};

export default nextConfig;
