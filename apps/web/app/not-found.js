import Link from 'next/link';

// Página 404 a nivel de App Router. Reutiliza el lenguaje visual existente
// (fondo slate-950, tarjeta glass, tipografía Inter, iconografía FontAwesome).
export const metadata = {
  title: 'Página no encontrada | Parkings Together',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div style={{
      minHeight: 'calc(100vh - 80px)',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#020617',
      fontFamily: "'Inter', sans-serif",
      padding: '24px',
    }}>
      <div style={{
        textAlign: 'center',
        padding: '40px',
        background: 'rgba(30, 41, 59, 0.6)',
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.08)',
        maxWidth: '440px',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px', opacity: 0.8 }}>
          <i className="fa-solid fa-map-location-dot" style={{ color: '#3b82f6' }} />
        </div>
        <h1 style={{ color: '#f8fafc', fontSize: '2.4rem', fontWeight: 900, margin: '0 0 4px' }}>404</h1>
        <h2 style={{ color: '#e2e8f0', fontSize: '1.2rem', fontWeight: 800, marginBottom: '8px' }}>
          No encontramos esta página
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '24px', lineHeight: 1.6 }}>
          La dirección que buscas no existe o fue movida. Vuelve al inicio o busca
          un estacionamiento en el mapa.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/" style={{
            padding: '10px 22px', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            color: 'white', borderRadius: '12px', fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none',
          }}>
            <i className="fa-solid fa-house" style={{ marginRight: '8px' }} /> Ir al inicio
          </Link>
          <Link href="/mapa" style={{
            padding: '10px 22px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
            color: '#e2e8f0', borderRadius: '12px', fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none',
          }}>
            <i className="fa-solid fa-magnifying-glass-location" style={{ marginRight: '8px' }} /> Buscar plaza
          </Link>
        </div>
      </div>
    </div>
  );
}
