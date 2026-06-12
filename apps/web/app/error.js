'use client';

export default function Error({ error, reset }) {
  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#020617',
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{
        textAlign: 'center',
        padding: '40px',
        background: 'rgba(30, 41, 59, 0.6)',
        borderRadius: '16px',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        maxWidth: '420px',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px', opacity: 0.7 }}>
          <i className="fa-solid fa-triangle-exclamation" style={{ color: '#ef4444' }} />
        </div>
        <h2 style={{ color: '#e2e8f0', fontSize: '1.3rem', fontWeight: 800, marginBottom: '8px' }}>
          Algo salió mal
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '24px' }}>
          {error?.message || 'Error inesperado en la aplicación.'}
        </p>
        <button
          onClick={() => reset()}
          style={{
            padding: '10px 24px',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
