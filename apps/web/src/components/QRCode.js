'use client';

// ════════════════════════════════════════════════════════════════════════════
// QRCode — genera un código QR sin dependencias ni paso de build.
// ────────────────────────────────────────────────────────────────────────────
// Usa un servicio de imagen estándar (api.qrserver.com). El comprobante de
// reserva se consulta en línea, por lo que una imagen remota es aceptable y
// siempre produce un QR válido y escaneable.
//
// Para un QR 100% offline en el futuro:  npm i qrcode  y renderizar a <canvas>.
// La interfaz de este componente no cambiaría.
// ════════════════════════════════════════════════════════════════════════════

export default function QRCode({ value, size = 180, className = '' }) {
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=0&qzone=1&data=${encodeURIComponent(value)}`;
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt="Código QR de la reserva"
      loading="lazy"
      className={className}
      style={{ display: 'block', borderRadius: '10px', background: '#fff', padding: '8px' }}
    />
  );
}
