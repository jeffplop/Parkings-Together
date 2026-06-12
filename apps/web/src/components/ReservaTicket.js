'use client';

// ════════════════════════════════════════════════════════════════════════════
// ReservaTicket — comprobante digital de reserva estilo "boarding pass".
// ────────────────────────────────────────────────────────────────────────────
//  • QR escaneable que apunta a /verificar?r=<id> para validación del arrendador.
//  • Imprimible (window.print con estilos @media print que aíslan el ticket).
//  • Compartible (Web Share API con fallback a portapapeles).
//  • Cierra con Escape o clic en el backdrop.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import QRCode from './QRCode';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || '';

const ESTADO_COLOR = {
  pendiente:  '#f59e0b',
  confirmada: '#3b82f6',
  activa:     '#8b5cf6',
  completada: '#10b981',
  cancelada:  '#ef4444',
};

function fmtFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CL', {
    weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export default function ReservaTicket({ reserva, onClose }) {
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const est       = reserva.estacionamiento || {};
  const codigo    = String(reserva.id || '').replace(/-/g, '').slice(0, 8).toUpperCase();
  const estadoCol = ESTADO_COLOR[reserva.estado] || '#94a3b8';
  const qrValue   = `${SITE}/verificar?r=${reserva.id}`;

  const handlePrint = () => window.print();

  const handleShare = async () => {
    const text = `Reserva en ${est.nombre || 'estacionamiento'} · ${fmtFecha(reserva.fecha_inicio)} · Código ${codigo}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Comprobante · Parkings Together', text, url: qrValue });
      } else {
        await navigator.clipboard.writeText(`${text}\n${qrValue}`);
        toast.success('Comprobante copiado al portapapeles');
      }
    } catch { /* el usuario canceló el diálogo de compartir */ }
  };

  return (
    <div className="ticket-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Comprobante de reserva">
      <div className="ticket" onClick={(e) => e.stopPropagation()}>
        <button ref={closeRef} className="ticket-close" onClick={onClose} aria-label="Cerrar comprobante">
          <i className="fa-solid fa-xmark"></i>
        </button>

        {/* Encabezado */}
        <div className="ticket-head">
          <div className="ticket-brand">
            <i className="fa-solid fa-square-parking"></i>
            <span>Parkings Together</span>
          </div>
          <span className="ticket-estado" style={{ background: `${estadoCol}22`, color: estadoCol, borderColor: `${estadoCol}55` }}>
            {reserva.estado || 'reserva'}
          </span>
        </div>

        <h2 className="ticket-title">{est.nombre || 'Estacionamiento'}</h2>
        {est.comuna && <p className="ticket-sub"><i className="fa-solid fa-location-dot"></i> {est.comuna}</p>}

        {/* Datos */}
        <div className="ticket-grid">
          <div className="tg-item">
            <span className="tg-label">Entrada</span>
            <span className="tg-value">{fmtFecha(reserva.fecha_inicio)}</span>
          </div>
          <div className="tg-item">
            <span className="tg-label">Salida</span>
            <span className="tg-value">{fmtFecha(reserva.fecha_fin)}</span>
          </div>
          {reserva.spot_label && (
            <div className="tg-item">
              <span className="tg-label">Plaza</span>
              <span className="tg-value">{reserva.spot_label}</span>
            </div>
          )}
          {reserva.patente_registrada && (
            <div className="tg-item">
              <span className="tg-label">Patente</span>
              <span className="tg-value">{reserva.patente_registrada}</span>
            </div>
          )}
          {reserva.precio_total != null && (
            <div className="tg-item">
              <span className="tg-label">Total</span>
              <span className="tg-value tg-price">${Number(reserva.precio_total).toLocaleString('es-CL')}</span>
            </div>
          )}
        </div>

        {/* Línea perforada */}
        <div className="ticket-perf"><span className="perf-l"></span><span className="perf-r"></span></div>

        {/* QR */}
        <div className="ticket-qr">
          <QRCode value={qrValue} size={170} />
          <div className="ticket-code">
            <span className="tc-label">Código de verificación</span>
            <span className="tc-value">{codigo}</span>
            <span className="tc-hint">Presenta este código al arrendador al llegar</span>
          </div>
        </div>

        {/* Acciones (no se imprimen) */}
        <div className="ticket-actions">
          <button className="ta-btn ta-share" onClick={handleShare}>
            <i className="fa-solid fa-share-nodes"></i> Compartir
          </button>
          <button className="ta-btn ta-print" onClick={handlePrint}>
            <i className="fa-solid fa-print"></i> Imprimir / Guardar PDF
          </button>
        </div>
      </div>

      <style jsx>{`
        .ticket-backdrop {
          position: fixed; inset: 0; z-index: 4000;
          background: rgba(2, 6, 23, 0.8); backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center; padding: 20px;
          animation: fade 0.2s ease;
        }
        .ticket {
          position: relative; width: 100%; max-width: 380px;
          max-height: 92vh; overflow-y: auto;
          background: linear-gradient(160deg, #ffffff 0%, #f1f5f9 100%);
          border-radius: 24px; padding: 28px 26px;
          box-shadow: 0 30px 60px -15px rgba(0,0,0,0.6);
          animation: pop 0.3s cubic-bezier(0.175,0.885,0.32,1.275);
        }
        .ticket-close {
          position: absolute; top: 16px; right: 16px;
          width: 32px; height: 32px; border-radius: 50%;
          background: rgba(15,23,42,0.06); border: none; color: #475569;
          cursor: pointer; font-size: 1rem; transition: background 0.2s;
        }
        .ticket-close:hover { background: rgba(15,23,42,0.12); }

        .ticket-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
        .ticket-brand { display: flex; align-items: center; gap: 8px; font-weight: 800; color: #1d4ed8; font-size: 0.92rem; }
        .ticket-brand i { font-size: 1.1rem; }
        .ticket-estado {
          font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;
          padding: 4px 10px; border-radius: 8px; border: 1px solid;
        }

        .ticket-title { margin: 0 0 4px; color: #0f172a; font-size: 1.5rem; font-weight: 900; letter-spacing: -0.5px; }
        .ticket-sub { margin: 0 0 18px; color: #64748b; font-size: 0.85rem; }
        .ticket-sub i { margin-right: 5px; color: #94a3b8; }

        .ticket-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 18px; margin-bottom: 20px; }
        .tg-item { display: flex; flex-direction: column; gap: 2px; }
        .tg-label { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; font-weight: 700; }
        .tg-value { font-size: 0.92rem; color: #1e293b; font-weight: 700; }
        .tg-price { color: #059669; font-size: 1.05rem; }

        .ticket-perf { position: relative; height: 28px; margin: 4px -26px 18px; }
        .ticket-perf::before {
          content: ''; position: absolute; top: 50%; left: 18px; right: 18px;
          border-top: 2px dashed #cbd5e1;
        }
        .perf-l, .perf-r { position: absolute; top: 50%; transform: translateY(-50%); width: 28px; height: 28px; border-radius: 50%; background: rgba(2,6,23,0.8); }
        .perf-l { left: -14px; } .perf-r { right: -14px; }

        .ticket-qr { display: flex; align-items: center; gap: 18px; }
        .ticket-code { display: flex; flex-direction: column; gap: 3px; }
        .tc-label { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; font-weight: 700; }
        .tc-value { font-size: 1.5rem; font-weight: 900; color: #0f172a; letter-spacing: 2px; font-family: ui-monospace, 'Courier New', monospace; }
        .tc-hint { font-size: 0.72rem; color: #64748b; line-height: 1.4; margin-top: 4px; }

        .ticket-actions { display: flex; gap: 10px; margin-top: 24px; }
        .ta-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px; border-radius: 12px; font-weight: 700; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; border: none; }
        .ta-share { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
        .ta-share:hover { background: #dbeafe; }
        .ta-print { background: #1d4ed8; color: #fff; }
        .ta-print:hover { background: #1e40af; }

        @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pop  { from { opacity: 0; transform: scale(0.92) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }

        @media (max-width: 420px) {
          .ticket-grid { grid-template-columns: 1fr; }
          .ticket-qr { flex-direction: column; text-align: center; }
        }
      `}</style>

      {/* Estilos de impresión: solo el ticket en la hoja */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden !important; }
          .ticket, .ticket * { visibility: visible !important; }
          .ticket {
            position: fixed !important; top: 0; left: 50%; transform: translateX(-50%);
            box-shadow: none !important; max-height: none !important; border-radius: 0 !important;
          }
          .ticket-close, .ticket-actions { display: none !important; }
          .perf-l, .perf-r { background: #fff !important; }
        }
      `}</style>
    </div>
  );
}
