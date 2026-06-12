'use client';

// ════════════════════════════════════════════════════════════════════════════
// PWAInstallPrompt — botón flotante para instalar la app como PWA.
// ────────────────────────────────────────────────────────────────────────────
// Captura el evento `beforeinstallprompt` (Chrome/Edge/Android) y muestra un
// botón discreto. Si el usuario lo descarta, se recuerda en localStorage para
// no volver a molestar. No se muestra si la app ya está instalada (standalone).
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';

const DISMISS_KEY = 'pt_pwa_dismissed';

export default function PWAInstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Ya instalada → no mostrar nada
    if (window.matchMedia?.('(display-mode: standalone)').matches) return;
    if (localStorage.getItem(DISMISS_KEY) === '1') return;

    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    const onInstalled = () => { setVisible(false); setDeferred(null); };
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch { /* ignorar */ }
    setVisible(false);
    setDeferred(null);
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="pwa-bar" role="region" aria-label="Instalar aplicación">
      <div className="pwa-icon"><i className="fa-solid fa-square-parking"></i></div>
      <div className="pwa-text">
        <strong>Instala Parkings Together</strong>
        <span>Acceso directo y más rápido desde tu pantalla de inicio.</span>
      </div>
      <button className="pwa-install" onClick={install}>Instalar</button>
      <button className="pwa-dismiss" onClick={dismiss} aria-label="Descartar">
        <i className="fa-solid fa-xmark"></i>
      </button>

      <style jsx>{`
        .pwa-bar {
          position: fixed; bottom: 20px; left: 20px; z-index: 3500;
          display: flex; align-items: center; gap: 12px;
          max-width: 360px; padding: 14px 16px;
          background: rgba(15, 23, 42, 0.92); backdrop-filter: blur(12px);
          border: 1px solid rgba(59,130,246,0.25); border-radius: 16px;
          box-shadow: 0 20px 40px -10px rgba(0,0,0,0.6);
          animation: slideUp 0.4s cubic-bezier(0.175,0.885,0.32,1.275);
        }
        .pwa-icon {
          flex-shrink: 0; width: 40px; height: 40px; border-radius: 12px;
          background: rgba(59,130,246,0.15); border: 1px solid rgba(59,130,246,0.3);
          display: flex; align-items: center; justify-content: center;
          color: #60a5fa; font-size: 1.2rem;
        }
        .pwa-text { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
        .pwa-text strong { color: #f8fafc; font-size: 0.88rem; font-weight: 800; }
        .pwa-text span { color: #94a3b8; font-size: 0.74rem; line-height: 1.3; }
        .pwa-install {
          flex-shrink: 0; padding: 9px 16px; border-radius: 10px; border: none;
          background: #2563eb; color: #fff; font-weight: 800; font-size: 0.82rem; cursor: pointer;
          transition: background 0.2s;
        }
        .pwa-install:hover { background: #1d4ed8; }
        .pwa-dismiss {
          flex-shrink: 0; width: 26px; height: 26px; border-radius: 8px;
          background: transparent; border: none; color: #64748b; cursor: pointer; font-size: 0.9rem;
        }
        .pwa-dismiss:hover { color: #cbd5e1; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 480px) { .pwa-bar { left: 12px; right: 12px; max-width: none; } }
      `}</style>
    </div>
  );
}
