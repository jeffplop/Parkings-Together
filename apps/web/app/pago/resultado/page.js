'use client';
import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-CL')}`;

function Resultado() {
  const params = useSearchParams();
  const router = useRouter();
  const estado = params.get('estado') || 'error';
  const monto = params.get('monto');

  const cfg = {
    ok: { icon: 'fa-circle-check', color: '#10b981', titulo: '¡Pago exitoso!', msg: 'Tu pago con Webpay se procesó correctamente.' },
    error: { icon: 'fa-circle-xmark', color: '#ef4444', titulo: 'Pago rechazado', msg: 'No se pudo procesar el pago. No se realizó ningún cobro.' },
    cancelado: { icon: 'fa-circle-info', color: '#f59e0b', titulo: 'Pago cancelado', msg: 'Cancelaste el pago. Puedes intentarlo de nuevo cuando quieras.' },
  }[estado] || { icon: 'fa-circle-xmark', color: '#ef4444', titulo: 'Pago rechazado', msg: 'Ocurrió un problema con el pago.' };

  return (
    <main style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 440, width: '100%', textAlign: 'center', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: '40px 28px' }}>
        <div style={{ fontSize: '3.5rem', color: cfg.color, marginBottom: 12 }}>
          <i className={`fa-solid ${cfg.icon}`}></i>
        </div>
        <h1 style={{ color: 'white', fontSize: '1.6rem', fontWeight: 900, margin: '0 0 10px' }}>{cfg.titulo}</h1>
        <p style={{ color: '#94a3b8', lineHeight: 1.6, margin: '0 0 6px' }}>{cfg.msg}</p>
        {estado === 'ok' && monto && (
          <p style={{ color: '#e2e8f0', fontSize: '1.4rem', fontWeight: 800, margin: '8px 0 0' }}>{fmt(monto)}</p>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 26, flexWrap: 'wrap' }}>
          <button onClick={() => router.push('/reservas')} style={{ background: 'linear-gradient(135deg,#2563eb,#3b82f6)', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 20px', fontWeight: 700, cursor: 'pointer' }}>
            Ver mis reservas
          </button>
          <button onClick={() => router.push('/')} style={{ background: 'rgba(255,255,255,0.06)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '12px 20px', fontWeight: 700, cursor: 'pointer' }}>
            Ir al inicio
          </button>
        </div>
        <p style={{ color: '#475569', fontSize: '0.72rem', marginTop: 22 }}>
          <i className="fa-solid fa-shield-halved"></i> Pago procesado por Webpay (Transbank) · ambiente de prueba
        </p>
      </div>
    </main>
  );
}

export default function PagoResultadoPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '70vh' }} />}>
      <Resultado />
    </Suspense>
  );
}
