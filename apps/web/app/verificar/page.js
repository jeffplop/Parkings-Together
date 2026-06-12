'use client';

// ════════════════════════════════════════════════════════════════════════════
// /verificar?r=<reservaId>
// ────────────────────────────────────────────────────────────────────────────
// Página pública a la que apunta el QR del comprobante. Muestra el código de
// verificación de forma destacada para que el arrendador lo contraste con el
// que ve en su panel. No expone datos sensibles: los detalles de la reserva
// están protegidos por RLS y solo son visibles para las partes autenticadas.
// ════════════════════════════════════════════════════════════════════════════

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function VerificarContent() {
  const params = useSearchParams();
  const id = params.get('r') || '';
  const codigo = id.replace(/-/g, '').slice(0, 8).toUpperCase();
  const valido = codigo.length === 8;

  return (
    <div className="verif-wrap">
      <div className="verif-card">
        <div className={`verif-icon ${valido ? 'ok' : 'bad'}`}>
          <i className={`fa-solid ${valido ? 'fa-circle-check' : 'fa-circle-question'}`}></i>
        </div>

        {valido ? (
          <>
            <h1>Reserva verificada</h1>
            <p className="verif-sub">Contrasta este código con el de tu panel de control.</p>
            <div className="verif-code">{codigo}</div>
            <p className="verif-note">
              <i className="fa-solid fa-shield-halved"></i>
              Los detalles completos de la reserva solo son visibles para el conductor y el
              arrendador desde sus cuentas.
            </p>
            <Link href="/reservas" className="verif-btn">
              <i className="fa-solid fa-calendar-check"></i> Ir a mis reservas
            </Link>
          </>
        ) : (
          <>
            <h1>Código no válido</h1>
            <p className="verif-sub">El enlace no contiene una reserva reconocible.</p>
            <Link href="/" className="verif-btn">
              <i className="fa-solid fa-house"></i> Volver al inicio
            </Link>
          </>
        )}
      </div>

      <style jsx>{`
        .verif-wrap { min-height: calc(100vh - 80px); display: flex; align-items: center; justify-content: center; padding: 24px; background: radial-gradient(circle at center, #0f172a 0%, #020617 100%); }
        .verif-card { width: 100%; max-width: 420px; text-align: center; padding: 44px 32px; background: rgba(15,23,42,0.6); backdrop-filter: blur(30px); border: 1px solid rgba(255,255,255,0.06); border-radius: 28px; box-shadow: 0 30px 60px -20px rgba(0,0,0,0.9); }
        .verif-icon { width: 84px; height: 84px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2.6rem; margin: 0 auto 24px; }
        .verif-icon.ok  { background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.3); color: #10b981; }
        .verif-icon.bad { background: rgba(245,158,11,0.12); border: 1px solid rgba(245,158,11,0.3); color: #f59e0b; }
        h1 { color: #f8fafc; font-size: 1.6rem; font-weight: 900; margin: 0 0 8px; }
        .verif-sub { color: #94a3b8; font-size: 0.9rem; margin: 0 0 24px; }
        .verif-code { font-family: ui-monospace, 'Courier New', monospace; font-size: 2.4rem; font-weight: 900; letter-spacing: 6px; color: #60a5fa; background: rgba(59,130,246,0.08); border: 1px dashed rgba(59,130,246,0.3); border-radius: 16px; padding: 18px; margin-bottom: 24px; }
        .verif-note { display: flex; gap: 8px; align-items: flex-start; text-align: left; color: #64748b; font-size: 0.78rem; line-height: 1.5; margin-bottom: 26px; }
        .verif-note i { color: #3b82f6; margin-top: 2px; }
        .verif-btn { display: inline-flex; align-items: center; gap: 8px; padding: 13px 24px; background: #2563eb; color: #fff; font-weight: 800; border-radius: 12px; text-decoration: none; transition: background 0.2s; }
        .verif-btn:hover { background: #1d4ed8; }
      `}</style>
    </div>
  );
}

export default function VerificarPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#020617' }} />}>
      <VerificarContent />
    </Suspense>
  );
}
