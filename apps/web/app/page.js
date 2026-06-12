'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@parkings/supabase-db';

function useCountUp(target, duration = 1800) {
  const [value, setValue] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (!target || started.current) return;
    started.current = true;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(ease * target));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return value;
}

export default function HomePage() {
  const router = useRouter();
  const [gpsLoading, setGpsLoading] = useState(false);
  const [stats, setStats] = useState({ spots: 0, comunas: 0, rating: 0 });

  useEffect(() => {
    supabase
      .from('estacionamientos')
      .select('id, comuna, rating')
      .eq('activo', true)
      .then(({ data }) => {
        if (!data) return;
        const comunasUnicas = new Set(data.map(e => e.comuna).filter(Boolean)).size;
        // Promedio REAL de valoración (solo plazas con rating > 0). Sin dato hardcodeado.
        const conRating = data.filter(e => Number(e.rating) > 0);
        const promedio = conRating.length
          ? conRating.reduce((a, e) => a + Number(e.rating), 0) / conRating.length
          : 0;
        setStats({ spots: data.length, comunas: comunasUnicas, rating: promedio });
      });
  }, []);

  const totalSpots   = useCountUp(stats.spots);
  const totalComunas = useCountUp(stats.comunas);

  const handleGPS = () => {
    if (!navigator.geolocation) { router.push('/mapa'); return; }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => router.push(`/mapa?lat=${pos.coords.latitude.toFixed(6)}&lng=${pos.coords.longitude.toFixed(6)}`),
      () => { setGpsLoading(false); router.push('/mapa'); },
      { timeout: 6000 }
    );
  };

  return (
    <div className="landing-wrapper">
      <div className="cyber-grid-bg"></div>

      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">
            Estaciona sin estrés.<br />
            <span>Gana con tu espacio.</span>
          </h1>
          <p className="hero-description">
            Conectamos conductores que buscan estacionamiento con propietarios que tienen plazas disponibles.
            Simple, rápido y seguro.
          </p>
          <div className="hero-actions">
            <button onClick={handleGPS} className="btn-cyber-primary btn-gps-hero" disabled={gpsLoading}>
              {gpsLoading
                ? <><i className="fa-solid fa-circle-notch fa-spin" style={{ marginRight: '10px' }}></i>Buscando...</>
                : <><i className="fa-solid fa-location-crosshairs" style={{ marginRight: '10px' }}></i>Buscar cerca de mi</>
              }
            </button>
            <Link href="/auth" className="btn-cyber-secondary">
              <i className="fa-solid fa-user-plus" style={{ marginRight: '10px' }}></i>
              Registrarme gratis
            </Link>
          </div>

          {stats.spots > 0 && (
            <div className="live-stats">
              <div className="stat-chip">
                <span className="stat-dot green"></span>
                <span className="stat-num">{totalSpots}</span>
                <span className="stat-label">plazas activas</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-chip">
                <span className="stat-dot blue"></span>
                <span className="stat-num">{totalComunas}</span>
                <span className="stat-label">comunas</span>
              </div>
              {stats.rating > 0 && (
                <>
                  <div className="stat-divider"></div>
                  <div className="stat-chip">
                    <span className="stat-dot purple"></span>
                    <span className="stat-num">{stats.rating.toFixed(1)} ★</span>
                    <span className="stat-label">valoración</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="hero-visual">
          <div className="radar-container">
            <div className="radar-circle circle-1"></div>
            <div className="radar-circle circle-2"></div>
            <div className="radar-circle circle-3"></div>
            <div className="radar-scanner"></div>
            <div className="node n1"></div>
            <div className="node n2"></div>
            <div className="node n3"></div>
          </div>
        </div>
      </section>

      <section className="features-grid">
        <div className="glass-panel feature-card">
          <div className="f-icon"><i className="fa-solid fa-coins"></i></div>
          <h3>Gana dinero con tu espacio</h3>
          <p>Convierte tu estacionamiento disponible en ingresos adicionales de forma simple y segura. Tu pones el precio y los horarios.</p>
        </div>
        <div className="glass-panel feature-card">
          <div className="f-icon"><i className="fa-solid fa-magnifying-glass-location"></i></div>
          <h3>Encuentra plaza rapidamente</h3>
          <p>Reserva una plaza en segundos y evita perder tiempo buscando donde estacionar. Filtra por zona, precio y disponibilidad.</p>
        </div>
        <div className="glass-panel feature-card">
          <div className="f-icon"><i className="fa-solid fa-shield-halved"></i></div>
          <h3>Comunidad confiable</h3>
          <p>Perfiles verificados y sistema de resenas para una experiencia segura y transparente, tanto para conductores como arrendadores.</p>
        </div>
      </section>

      <section style={{ width: '100%', maxWidth: '900px', padding: '0 5% 80px', position: 'relative', zIndex: 5 }}>
        <h2 style={{ color: '#f8fafc', fontWeight: 800, fontSize: '1.8rem', textAlign: 'center', marginBottom: '40px' }}>Como funciona?</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '24px' }}>
          {[
            { n: '1', icon: 'fa-location-crosshairs', title: 'Ubicacion',  desc: 'Activa tu ubicacion desde la pagina de inicio o busca en el mapa.' },
            { n: '2', icon: 'fa-hand-pointer',        title: 'Elige',      desc: 'Selecciona la plaza que mejor se ajuste a tu horario y presupuesto.' },
            { n: '3', icon: 'fa-lock',                title: 'Reserva',    desc: 'Confirma tu reserva en segundos. Tu plaza queda bloqueada de inmediato.' },
            { n: '4', icon: 'fa-diamond-turn-right',  title: 'Llega!',     desc: 'Recibe direccion navegable y llega sin vueltas. Sin sorpresas.' },
          ].map(({ n, icon, title, desc }) => (
            <div key={n} style={{ background: 'rgba(15,23,42,0.5)', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.06)', padding: '28px 22px', textAlign: 'center' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', position: 'relative' }}>
                <i className={`fa-solid ${icon}`} style={{ color: '#60a5fa', fontSize: '1.2rem' }}></i>
                <span style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#3b82f6', color: 'white', borderRadius: '50%', width: '20px', height: '20px', fontSize: '0.65rem', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n}</span>
              </div>
              <h4 style={{ color: '#f8fafc', fontWeight: 800, marginBottom: '8px', fontSize: '1rem' }}>{title}</h4>
              <p style={{ color: '#64748b', fontSize: '0.88rem', lineHeight: 1.6, margin: 0 }}>{desc}</p>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: '40px' }}>
          <button onClick={handleGPS} className="btn-cyber-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', border: 'none' }} disabled={gpsLoading}>
            <i className="fa-solid fa-location-crosshairs"></i>
            {gpsLoading ? 'Obteniendo ubicacion...' : 'Explorar estacionamientos'}
          </button>
        </div>
      </section>

      <footer className="landing-footer">
        <p style={{ color: '#475569', fontSize: '0.85rem' }}>Parkings Together 2026 Plataforma de estacionamientos compartidos</p>
        <p className="sub">Dareko</p>
      </footer>

      <style jsx>{`
        .landing-wrapper { min-height: 100vh; display: flex; flex-direction: column; align-items: center; position: relative; overflow: hidden; }
        .cyber-grid-bg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-image: radial-gradient(rgba(59, 130, 246, 0.15) 1px, transparent 1px); background-size: 40px 40px; z-index: -1; opacity: 0.5; mask-image: linear-gradient(to bottom, black 40%, transparent 100%); -webkit-mask-image: linear-gradient(to bottom, black 40%, transparent 100%); }
        .hero-section { display: flex; align-items: center; justify-content: space-between; padding: 100px 5%; width: 100%; max-width: 1300px; gap: 50px; flex: 1; }
        .hero-content { flex: 1; text-align: left; animation: slideRight 0.8s ease-out; }
        .hero-title { font-size: 4rem; line-height: 1.1; font-weight: 900; color: white; margin-bottom: 25px; letter-spacing: -1px; }
        .hero-title span { background: linear-gradient(135deg, #60a5fa, #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; display: inline-block; }
        .hero-description { font-size: 1.2rem; color: #94a3b8; max-width: 550px; line-height: 1.7; margin-bottom: 45px; }
        .hero-actions { display: flex; gap: 20px; flex-wrap: wrap; }
        .btn-gps-hero:disabled { opacity: 0.7; cursor: not-allowed; }
        .live-stats { display: flex; align-items: center; gap: 14px; margin-top: 32px; padding: 12px 20px; background: rgba(15,23,42,0.7); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; backdrop-filter: blur(8px); width: fit-content; animation: fadeUp 0.6s 0.4s ease-out both; }
        .stat-chip { display: flex; align-items: center; gap: 8px; }
        .stat-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .stat-dot.green  { background: #10b981; box-shadow: 0 0 6px #10b981; animation: blink 2s infinite; }
        .stat-dot.blue   { background: #3b82f6; box-shadow: 0 0 6px #3b82f6; animation: blink 2s 0.6s infinite; }
        .stat-dot.purple { background: #a78bfa; box-shadow: 0 0 6px #a78bfa; animation: blink 2s 1.2s infinite; }
        .stat-num   { font-size: 1.1rem; font-weight: 900; color: #f8fafc; letter-spacing: -0.5px; }
        .stat-label { font-size: 0.75rem; color: #64748b; font-weight: 500; }
        .stat-divider { width: 1px; height: 24px; background: rgba(255,255,255,0.08); }
        .hero-visual { flex: 1; display: flex; align-items: center; justify-content: center; position: relative; height: 450px; animation: scaleUp 1s ease-out; }
        .radar-container { position: relative; width: 400px; height: 400px; display: flex; align-items: center; justify-content: center; }
        .radar-circle { position: absolute; border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 50%; }
        .circle-1 { width: 100%; height: 100%; box-shadow: inset 0 0 40px rgba(59,130,246,0.1); }
        .circle-2 { width: 65%; height: 65%; border-color: rgba(59, 130, 246, 0.4); }
        .circle-3 { width: 30%; height: 30%; background: rgba(59, 130, 246, 0.1); border-color: rgba(59, 130, 246, 0.6); box-shadow: 0 0 30px rgba(59,130,246,0.4); }
        .radar-scanner { position: absolute; width: 50%; height: 50%; background: conic-gradient(from 0deg, rgba(59,130,246,0.8) 0deg, transparent 60deg); top: 0; left: 50%; transform-origin: bottom left; border-radius: 100% 0 0 0; animation: scanRotate 3s linear infinite; }
        .node { position: absolute; width: 12px; height: 12px; background: #10b981; border-radius: 50%; box-shadow: 0 0 15px #10b981; animation: pulseNode 1.5s infinite; }
        .n1 { top: 20%; left: 30%; animation-delay: 0.2s; }
        .n2 { top: 60%; right: 20%; background: #fbbf24; box-shadow: 0 0 15px #fbbf24; animation-delay: 0.7s; }
        .n3 { bottom: 25%; left: 40%; background: #3b82f6; box-shadow: 0 0 15px #3b82f6; animation-delay: 1.2s; }
        .features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 30px; width: 100%; max-width: 1200px; padding: 0 5% 60px; position: relative; z-index: 5; }
        .feature-card { padding: 40px 30px; text-align: left; transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); background: rgba(15, 23, 42, 0.6); border-radius: 24px; border: 1px solid rgba(255,255,255,0.05); overflow: hidden; position: relative; }
        .feature-card::before { content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 4px; background: linear-gradient(90deg, #3b82f6, #8b5cf6); transform: scaleX(0); transform-origin: left; transition: transform 0.4s; }
        .feature-card:hover { transform: translateY(-15px); border-color: rgba(59, 130, 246, 0.3); box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
        .feature-card:hover::before { transform: scaleX(1); }
        .f-icon { width: 60px; height: 60px; background: rgba(59, 130, 246, 0.1); border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; color: #60a5fa; margin-bottom: 25px; border: 1px solid rgba(59, 130, 246, 0.2); }
        .feature-card h3 { margin-bottom: 15px; font-weight: 800; font-size: 1.2rem; color: white; }
        .feature-card p { color: #94a3b8; font-size: 0.95rem; line-height: 1.6; }
        .landing-footer { margin-top: auto; padding: 40px; text-align: center; color: #475569; font-size: 0.9rem; border-top: 1px solid rgba(255,255,255,0.05); width: 100%; }
        .landing-footer .sub { font-size: 0.8rem; margin-top: 8px; color: #334155; }
        @keyframes scanRotate  { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulseNode   { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.5); opacity: 0.5; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes blink       { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes slideRight  { from { opacity: 0; transform: translateX(-50px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes scaleUp     { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
        @keyframes fadeUp      { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 1024px) {
          .hero-section { flex-direction: column; text-align: center; padding: 60px 5%; }
          .hero-content { text-align: center; display: flex; flex-direction: column; align-items: center; }
          .hero-title { font-size: 3rem; }
          .hero-visual { height: 350px; margin-top: 40px; }
          .radar-container { width: 300px; height: 300px; }
          .features-grid { grid-template-columns: 1fr; }
          .live-stats { flex-wrap: wrap; justify-content: center; }
        }
        @media (max-width: 500px) {
          .hero-title { font-size: 2.2rem; }
          .hero-actions { flex-direction: column; width: 100%; }
        }
      `}</style>
    </div>
  );
}
