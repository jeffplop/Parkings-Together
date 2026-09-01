import './globals.css';
import Navbar from '../src/components/Navbar';
import PWAInstallPrompt from '../src/components/PWAInstallPrompt';
import { Toaster } from 'react-hot-toast';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://parkings-web.vercel.app';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Parkings Together | Encuentra y Comparte Estacionamientos",
    template: "%s | Parkings Together",
  },
  description: "Encuentra estacionamientos cerca de ti y comienza a generar ingresos compartiendo tu plaza disponible.",
  applicationName: "Parkings Together",
  keywords: ["estacionamiento", "parking", "Chile", "reserva de estacionamiento", "movilidad reducida", "compartir estacionamiento"],
  authors: [{ name: "Parkings Together" }],
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
  alternates: { canonical: '/' },
  openGraph: {
    title: "Parkings Together",
    description: "Encuentra estacionamientos cerca de ti o publica tu plaza disponible.",
    type: 'website',
    locale: 'es_CL',
    siteName: 'Parkings Together',
    url: SITE_URL,
  },
  twitter: {
    card: 'summary',
    title: "Parkings Together",
    description: "Encuentra estacionamientos cerca de ti o publica tu plaza disponible.",
  },
};

export const viewport = {
  themeColor: '#020617',
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'dark',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Outfit:wght@400;600;700;800;900&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </head>
      <body>
        <Toaster position="top-right" toastOptions={{ style: { background: '#1e293b', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }, success: { iconTheme: { primary: '#10b981', secondary: '#fff' } }, error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } } }} />
        <Navbar />
        {children}
        <PWAInstallPrompt />
      </body>
    </html>
  );
}