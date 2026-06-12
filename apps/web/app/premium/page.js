'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast, Toaster } from 'react-hot-toast';
import { supabase } from '@parkings/supabase-db';
import { api } from '../../src/lib/api';
import { PLANES, precioCiclo, mesesToPayback, NIVELES_CONDUCTOR, BADGES, FAQ, COMISION_PLATAFORMA } from '../../src/lib/planes';

const fmt = (n) => n === 0 ? 'Gratis' : `$${n.toLocaleString('es-CL')}`;

// ── Calculadora de ahorro para conductores ─────────────────────────────────
const PRECIO_PRO = 2990;

function Calculadora() {
  const [gasto, setGasto] = useState(30000);
  const ahorro = Math.round(gasto * (COMISION_PLATAFORMA / 100));
  const conviene = ahorro >= PRECIO_PRO;
  const neto = ahorro - PRECIO_PRO;
  const ahorroAnual = neto > 0 ? neto * 12 : 0;
  // % del slider para pintar la barra de progreso
  const pct = Math.round(((gasto - 5000) / (150000 - 5000)) * 100);
  const umbral = Math.ceil(PRECIO_PRO / (COMISION_PLATAFORMA / 100) / 1000) * 1000;

  return (
    <section className="calc2">
      <div className="calc2-head">
        <span className="section-badge"><i className="fa-solid fa-calculator"></i> Calculadora de ahorro</span>
        <h2>¿Te conviene el plan Pro?</h2>
        <p>Ajusta cuánto gastas al mes en estacionamientos y descubre tu ahorro real.</p>
      </div>

      <div className="calc2-card">
        {/* Slider */}
        <div className="calc2-slider-block">
          <div className="calc2-gasto-display">
            <span>Gasto mensual</span>
            <strong>{fmt(gasto)}</strong>
          </div>
          <input
            className="calc2-range"
            type="range" min={5000} max={150000} step={5000}
            value={gasto} onChange={e => setGasto(+e.target.value)}
            style={{ '--pct': `${pct}%` }}
          />
          <div className="calc2-range-labels"><span>$5.000</span><span>$150.000</span></div>
        </div>

        {/* Comparación visual */}
        <div className="calc2-compare">
          <div className="calc2-col free">
            <span className="calc2-col-tag">Plan Gratis</span>
            <span className="calc2-col-num">{fmt(ahorro)}</span>
            <span className="calc2-col-desc">en tarifas de servicio / mes</span>
          </div>
          <div className="calc2-arrow"><i className="fa-solid fa-arrow-right-arrow-left"></i></div>
          <div className="calc2-col pro">
            <span className="calc2-col-tag"><i className="fa-solid fa-crown"></i> Plan Pro</span>
            <span className="calc2-col-num">{fmt(PRECIO_PRO)}</span>
            <span className="calc2-col-desc">tarifa fija / mes · sin comisiones</span>
          </div>
        </div>

        {/* Veredicto */}
        <div className={`calc2-verdict ${conviene ? 'yes' : 'no'}`}>
          {conviene ? (
            <>
              <div className="calc2-verdict-ic"><i className="fa-solid fa-circle-check"></i></div>
              <div>
                <strong>¡Te conviene Pro!</strong>
                <p>Ahorras <b>{fmt(neto)}/mes</b> · hasta <b>{fmt(ahorroAnual)}</b> al año.</p>
              </div>
            </>
          ) : (
            <>
              <div className="calc2-verdict-ic"><i className="fa-solid fa-circle-info"></i></div>
              <div>
                <strong>El plan Gratis te basta por ahora</strong>
                <p>Pro empieza a convenir desde <b>~{fmt(umbral)}/mes</b> de gasto.</p>
              </div>
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        .calc2 { margin: 0 0 50px; }
        .calc2-head { text-align: center; margin-bottom: 24px; }
        .calc2-head .section-badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(59,130,246,0.12); color: #60a5fa; border: 1px solid rgba(59,130,246,0.3); padding: 5px 14px; border-radius: 99px; font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
        .calc2-head h2 { font-size: 1.9rem; font-weight: 900; color: white; margin: 0 0 8px; letter-spacing: -0.5px; }
        .calc2-head p { color: #94a3b8; font-size: 0.92rem; max-width: 480px; margin: 0 auto; }

        .calc2-card { background: linear-gradient(160deg, rgba(20,30,50,0.85), rgba(10,18,35,0.9)); border: 1px solid rgba(255,255,255,0.09); border-radius: 24px; padding: 28px; max-width: 640px; margin: 0 auto; }

        .calc2-slider-block { margin-bottom: 26px; }
        .calc2-gasto-display { display: flex; flex-direction: column; align-items: center; margin-bottom: 16px; }
        .calc2-gasto-display span { font-size: 0.76rem; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
        .calc2-gasto-display strong { font-size: 2.4rem; font-weight: 900; color: white; line-height: 1.1; }
        .calc2-range { width: 100%; -webkit-appearance: none; appearance: none; height: 8px; border-radius: 99px; background: linear-gradient(90deg, #3b82f6 var(--pct, 20%), rgba(255,255,255,0.1) var(--pct, 20%)); outline: none; cursor: pointer; }
        .calc2-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 24px; height: 24px; border-radius: 50%; background: white; border: 4px solid #3b82f6; cursor: pointer; box-shadow: 0 2px 10px rgba(59,130,246,0.5); }
        .calc2-range::-moz-range-thumb { width: 24px; height: 24px; border-radius: 50%; background: white; border: 4px solid #3b82f6; cursor: pointer; }
        .calc2-range-labels { display: flex; justify-content: space-between; margin-top: 8px; font-size: 0.72rem; color: #475569; font-weight: 600; }

        .calc2-compare { display: grid; grid-template-columns: 1fr auto 1fr; gap: 14px; align-items: center; margin-bottom: 22px; }
        .calc2-col { text-align: center; padding: 18px 14px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); }
        .calc2-col.free { background: rgba(100,116,139,0.08); }
        .calc2-col.pro { background: rgba(59,130,246,0.1); border-color: rgba(59,130,246,0.3); }
        .calc2-col-tag { display: inline-flex; align-items: center; gap: 5px; font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; }
        .calc2-col.pro .calc2-col-tag { color: #60a5fa; }
        .calc2-col-num { display: block; font-size: 1.7rem; font-weight: 900; color: white; margin: 6px 0 4px; }
        .calc2-col-desc { font-size: 0.72rem; color: #64748b; line-height: 1.4; }
        .calc2-arrow { color: #475569; font-size: 1.1rem; }

        .calc2-verdict { display: flex; align-items: center; gap: 14px; padding: 18px 20px; border-radius: 16px; }
        .calc2-verdict.yes { background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); }
        .calc2-verdict.no { background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.25); }
        .calc2-verdict-ic { font-size: 1.8rem; flex-shrink: 0; }
        .calc2-verdict.yes .calc2-verdict-ic { color: #34d399; }
        .calc2-verdict.no .calc2-verdict-ic { color: #fbbf24; }
        .calc2-verdict strong { display: block; color: white; font-size: 1rem; font-weight: 800; }
        .calc2-verdict p { margin: 3px 0 0; color: #94a3b8; font-size: 0.85rem; }
        .calc2-verdict b { color: #e2e8f0; }

        @media (max-width: 560px) {
          .calc2-compare { grid-template-columns: 1fr; }
          .calc2-arrow { transform: rotate(90deg); }
          .calc2-gasto-display strong { font-size: 2rem; }
        }
      `}</style>
    </section>
  );
}

// ── Sección de gamificación ────────────────────────────────────────────────
function GamificacionSection() {
  return (
    <section className="gami-section">
      <div className="gami-header">
        <span className="section-badge"><i className="fa-solid fa-medal"></i> Sistema de niveles</span>
        <h2>Sube de nivel mientras te mueves</h2>
        <p>Cada reserva completada y reseña publicada te acerca al siguiente nivel. Sin pagar nada.</p>
      </div>
      <div className="gami-grid">
        <div className="niveles-list">
          {[
            { icon: 'fa-seedling', color: '#64748b', label: 'Novato', desc: 'Comienzas aquí', range: '0–4 reservas' },
            { icon: 'fa-car', color: '#3b82f6', label: 'Conductor Regular', desc: 'Ya conoces el sistema', range: '5–19 reservas' },
            { icon: 'fa-bolt', color: '#8b5cf6', label: 'Conductor Frecuente', desc: 'Rutas optimizadas', range: '20–49 reservas' },
            { icon: 'fa-star', color: '#f59e0b', label: 'Conductor Elite', desc: 'Máxima experiencia', range: '50+ reservas' },
          ].map((n, i) => (
            <div key={i} className="nivel-row" style={{ '--nc': n.color }}>
              <div className="nivel-icon"><i className={`fa-solid ${n.icon}`}></i></div>
              <div>
                <strong>{n.label}</strong>
                <span>{n.desc} · <em>{n.range}</em></span>
              </div>
            </div>
          ))}
        </div>
        <div className="badges-grid">
          {BADGES.map(b => (
            <div key={b.id} className="badge-chip">
              <i className={`fa-solid ${b.icon}`}></i>
              <span>{b.label}</span>
              <p>{b.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Comparativa mercado (insight de investigación) ─────────────────────────
function ComparativaSection() {
  const features = [
    { label: 'Uso gratuito conductor',     pt: true,  sh: true,  jp: true,  ep: false },
    { label: 'Sin comisión para arrendador', pt: false, sh: false, jp: false, ep: false },
    { label: 'Comisión baja (≤8%)',        pt: true,  sh: false, jp: false, ep: false },
    { label: 'App en español (Chile)',      pt: true,  sh: false, jp: false, ep: true  },
    { label: 'Reserva por hora',            pt: true,  sh: true,  jp: true,  ep: true  },
    { label: 'P2P entre particulares',      pt: true,  sh: false, jp: true,  ep: false },
    { label: 'Ranking por calidad',         pt: true,  sh: false, jp: false, ep: false },
    { label: 'Plan Premium accesible',      pt: true,  sh: false, jp: false, ep: true  },
    { label: 'Soporte en Chile',            pt: true,  sh: false, jp: false, ep: false },
  ];

  const COLS = [
    { key: 'pt', label: 'Parkings Together', icon: 'fa-location-pin', color: '#3b82f6', highlight: true },
    { key: 'sh', label: 'SpotHero',          icon: 'fa-circle',       color: '#64748b', highlight: false },
    { key: 'jp', label: 'JustPark',          icon: 'fa-circle',       color: '#64748b', highlight: false },
    { key: 'ep', label: 'EasyPark',          icon: 'fa-circle',       color: '#64748b', highlight: false },
  ];

  const ptScore = features.filter(f => f.pt).length;

  return (
    <section className="comp-section">
      <span className="section-badge"><i className="fa-solid fa-scale-balanced"></i> Vs. la competencia</span>
      <h2>¿Por qué Parkings Together?</h2>
      <p className="comp-subtitle">La única plataforma de estacionamientos diseñada para Chile, con las mejores condiciones del mercado.</p>

      {/* Score cards */}
      <div className="comp-scores">
        {COLS.map(c => {
          const score = features.filter(f => f[c.key]).length;
          return (
            <div key={c.key} className={`comp-score-card ${c.highlight ? 'comp-score-hl' : ''}`}>
              <i className={`fa-solid ${c.icon}`} style={{ color: c.highlight ? '#3b82f6' : '#475569', fontSize: c.highlight ? '1rem' : '0.7rem', marginBottom: 8, display: 'block' }}></i>
              <strong className="comp-score-name">{c.label}</strong>
              <div className="comp-score-num">
                <span style={{ color: c.highlight ? '#3b82f6' : '#64748b', fontWeight: 900 }}>{score}</span>
                <span style={{ color: '#334155', fontSize: '0.75rem' }}>/{features.length}</span>
              </div>
              <div className="comp-score-bar-wrap">
                <div className="comp-score-bar" style={{ width: `${(score/features.length)*100}%`, background: c.highlight ? 'linear-gradient(90deg,#3b82f6,#10b981)' : '#1e293b' }}></div>
              </div>
              {c.highlight && <span className="comp-winner-badge"><i className="fa-solid fa-trophy"></i> Mejor opción</span>}
            </div>
          );
        })}
      </div>

      {/* Feature grid */}
      <div className="comp-grid-wrap">
        <div className="comp-grid-head">
          <div className="comp-feat-col">Característica</div>
          {COLS.map(c => (
            <div key={c.key} className={`comp-app-col ${c.highlight ? 'hl' : ''}`}>
              <i className={`fa-solid ${c.icon}`} style={{ color: c.highlight ? '#3b82f6' : '#475569', fontSize: c.highlight ? '0.9rem' : '0.6rem', marginRight: 5 }}></i>
              {c.label.split(' ')[0]}
            </div>
          ))}
        </div>
        {features.map((f, i) => (
          <div key={i} className={`comp-grid-row ${i % 2 === 0 ? 'even' : ''}`}>
            <div className="comp-feat-col">{f.label}</div>
            {COLS.map(c => (
              <div key={c.key} className={`comp-app-col ${c.highlight ? 'hl' : ''}`}>
                {f[c.key]
                  ? <span className="comp-check"><i className="fa-solid fa-circle-check"></i></span>
                  : <span className="comp-cross"><i className="fa-solid fa-circle-xmark"></i></span>}
              </div>
            ))}
          </div>
        ))}
      </div>

      <p className="comp-note"><i className="fa-solid fa-circle-info"></i> Datos basados en análisis público de tarifas de SpotHero, JustPark y EasyPark (junio 2026).</p>
    </section>
  );
}

// ── Componente principal ───────────────────────────────────────────────────
export default function PremiumPage() {
  const router = useRouter();
  const [audiencia, setAudiencia] = useState('conductor');
  const [ciclo, setCiclo]         = useState('mensual');
  const [user, setUser]           = useState(null);
  const [planActual, setPlanActual] = useState('free');
  const [procesando, setProcesando] = useState(null);
  const [faqOpen, setFaqOpen]     = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        api.premium.estado().then(res => {
          if (res.success && res.data) {
            setPlanActual(res.data.plan || 'free');
            if (res.data.rol === 'arrendador') setAudiencia('arrendador');
          }
        });
      }
    });
  }, []);

  const handleSuscribir = async (planId) => {
    if (!user) { router.push('/auth?redirectTo=/premium'); return; }
    if (planId === planActual) { toast('Ya tienes este plan activo.', { icon: 'ℹ️' }); return; }

    setProcesando(planId);
    await new Promise(r => setTimeout(r, 1100));
    const res = await api.premium.suscribir(planId, ciclo);
    setProcesando(null);

    if (res.success) {
      setPlanActual(planId);
      toast.success(res.message || '¡Listo!');
    } else {
      toast.error(res.error || 'No se pudo procesar la suscripción.');
    }
  };

  const planes = PLANES[audiencia];

  return (
    <div className="premium-wrap">
      <Toaster position="top-right" toastOptions={{ style: { background: '#1e293b', color: '#fff', border: '1px solid #3b82f6' } }} />

      {/* ═══ HERO ═══ */}
      <header className="premium-hero">
        <span className="hero-badge"><i className="fa-solid fa-crown"></i> Planes y precios</span>
        <h1>Gratis de verdad.<br /><span className="grad">Premium cuando vale la pena.</span></h1>
        <p className="hero-sub">
          Los conductores reservan <strong>siempre gratis</strong> — igual que en SpotHero o JustPark.
          El premium agrega conveniencia y ahorro, nunca te bloquea el acceso básico.
        </p>

        <div className="aud-toggle">
          <button className={audiencia === 'conductor' ? 'active' : ''} onClick={() => setAudiencia('conductor')}>
            <i className="fa-solid fa-car"></i> Soy Conductor
          </button>
          <button className={audiencia === 'arrendador' ? 'active' : ''} onClick={() => setAudiencia('arrendador')}>
            <i className="fa-solid fa-square-parking"></i> Soy Arrendador
          </button>
        </div>

        <div className="ciclo-toggle">
          <span className={ciclo === 'mensual' ? 'on' : ''}>Mensual</span>
          <button className="switch" onClick={() => setCiclo(c => c === 'mensual' ? 'anual' : 'mensual')} aria-label="Cambiar ciclo">
            <span className={`knob ${ciclo === 'anual' ? 'right' : ''}`}></span>
          </button>
          <span className={ciclo === 'anual' ? 'on' : ''}>Anual <em className="save-pill">2 meses gratis</em></span>
        </div>
      </header>

      {/* ═══ PLANES ═══ */}
      <section className={`planes-grid cols-${planes.length}`}>
        {planes.map(plan => {
          const precio = precioCiclo(plan.precioMensual, ciclo);
          const esActual = plan.id === planActual;
          return (
            <article key={plan.id} className={`plan-card ${plan.destacado ? 'featured' : ''}`} style={{ '--accent': plan.color }}>
              {plan.tag && <div className="ribbon">{plan.tag}</div>}
              <div className="plan-icon"><i className={`fa-solid ${plan.icon}`}></i></div>
              <h3>{plan.nombre}</h3>
              <p className="plan-tag">{plan.tagline}</p>

              <div className="plan-price">
                <span className="amount">{fmt(precio)}</span>
                {precio > 0 && <span className="period">/{ciclo === 'anual' ? 'año' : 'mes'}</span>}
              </div>
              {precio > 0 && ciclo === 'anual' && (
                <p className="price-note">≈ {fmt(Math.round(precio / 12))}/mes facturado anual</p>
              )}

              <button
                className={`plan-cta ${esActual ? 'current' : ''}`}
                disabled={procesando === plan.id || esActual}
                onClick={() => handleSuscribir(plan.id)}
              >
                {procesando === plan.id
                  ? <><i className="fa-solid fa-spinner fa-spin"></i> Procesando...</>
                  : esActual
                    ? <><i className="fa-solid fa-check"></i> Tu plan actual</>
                    : plan.id === 'free'
                      ? 'Volver a Gratis'
                      : <><i className="fa-solid fa-bolt"></i> {precio === 0 ? 'Empezar gratis' : 'Suscribirme'}</>}
              </button>

              <ul className="plan-benefits">
                {plan.beneficios.map((b, i) => (
                  <li key={i} className={`${b.ok ? '' : 'off'} ${b.bold ? 'bold' : ''}`}>
                    <i className={`fa-solid ${b.ok ? 'fa-circle-check' : 'fa-circle-xmark'}`}></i>
                    <span>
                      {b.txt}
                      {b.note && <em className="benefit-note">{b.note}</em>}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </section>

      {/* ═══ CALCULADORA (solo conductores) ═══ */}
      {audiencia === 'conductor' && <Calculadora />}

      {/* ═══ GAMIFICACIÓN ═══ */}
      <GamificacionSection />

      {/* ═══ COMPARATIVA ═══ */}
      <ComparativaSection />

      {/* ═══ CTA RANKING ═══ */}
      <section className="ranking-promo">
        <div className="rp-text">
          <h2><i className="fa-solid fa-trophy" style={{ color: '#f59e0b' }}></i> Ranking de tu zona</h2>
          <p>Descubre los estacionamientos mejor evaluados cerca de ti. Disponible para todos los usuarios — sin suscripción.</p>
          <button className="rp-btn" onClick={() => router.push('/ranking')}>
            Ver ranking <i className="fa-solid fa-arrow-right"></i>
          </button>
        </div>
        <div className="rp-podium">
          <div className="podium-bar second"><span>2</span></div>
          <div className="podium-bar first"><i className="fa-solid fa-crown"></i><span>1</span></div>
          <div className="podium-bar third"><span>3</span></div>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section className="faq">
        <h2>Preguntas frecuentes</h2>
        {FAQ.map((f, i) => (
          <div key={i} className={`faq-item ${faqOpen === i ? 'open' : ''}`}>
            <button onClick={() => setFaqOpen(o => o === i ? null : i)}>
              <span>{f.q}</span>
              <i className={`fa-solid fa-chevron-${faqOpen === i ? 'up' : 'down'}`}></i>
            </button>
            {faqOpen === i && <p>{f.a}</p>}
          </div>
        ))}
      </section>

      <p className="demo-note">
        <i className="fa-solid fa-circle-info"></i> Demo académica · pago simulado. En producción se integra Webpay (Transbank).
      </p>

      <style jsx global>{`
        .premium-wrap { max-width: 1100px; margin: 0 auto; padding: 30px 20px 80px; color: #e2e8f0; }

        /* HERO */
        .premium-hero { text-align: center; padding: 30px 0 20px; }
        .hero-badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(245,158,11,0.12); color: #fbbf24; border: 1px solid rgba(245,158,11,0.3); padding: 6px 16px; border-radius: 99px; font-size: 0.8rem; font-weight: 800; letter-spacing: 0.5px; margin-bottom: 18px; }
        .premium-hero h1 { font-size: 2.5rem; font-weight: 900; margin: 0 0 12px; letter-spacing: -1.5px; color: white; line-height: 1.15; }
        .grad { background: linear-gradient(135deg,#3b82f6,#8b5cf6); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
        .hero-sub { color: #94a3b8; font-size: 1rem; max-width: 600px; margin: 0 auto 28px; line-height: 1.7; }
        .hero-sub strong { color: #93c5fd; }

        .aud-toggle { display: inline-flex; gap: 6px; background: rgba(15,23,42,0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 5px; margin-bottom: 22px; }
        .aud-toggle button { padding: 10px 20px; border: none; background: transparent; color: #94a3b8; font-weight: 700; border-radius: 10px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; font-size: 0.9rem; }
        .aud-toggle button.active { background: linear-gradient(135deg,#3b82f6,#2563eb); color: white; box-shadow: 0 4px 14px rgba(37,99,235,0.4); }
        .ciclo-toggle { display: flex; align-items: center; justify-content: center; gap: 14px; font-size: 0.9rem; color: #64748b; font-weight: 600; }
        .ciclo-toggle .on { color: white; }
        .switch { width: 52px; height: 28px; border-radius: 99px; background: #1e293b; border: 1px solid rgba(255,255,255,0.1); position: relative; cursor: pointer; padding: 0; flex-shrink: 0; }
        .knob { position: absolute; top: 2px; left: 2px; width: 22px; height: 22px; border-radius: 50%; background: #3b82f6; transition: left 0.25s; }
        .knob.right { left: 26px; background: #8b5cf6; }
        .save-pill { font-style: normal; background: rgba(16,185,129,0.15); color: #34d399; font-size: 0.7rem; padding: 2px 8px; border-radius: 8px; margin-left: 4px; font-weight: 800; }

        /* PLANES */
        .planes-grid { display: grid; gap: 22px; margin: 38px 0; }
        .planes-grid.cols-2 { grid-template-columns: repeat(2,1fr); max-width: 800px; margin-left: auto; margin-right: auto; }
        .planes-grid.cols-3 { grid-template-columns: repeat(3,1fr); }
        .plan-card { position: relative; background: rgba(15,23,42,0.6); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.08); border-radius: 24px; padding: 30px 26px; transition: transform 0.25s, border-color 0.25s; }
        .plan-card.featured { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent), 0 20px 50px -20px var(--accent); }
        .plan-card:hover { transform: translateY(-4px); }
        .ribbon { position: absolute; top: 18px; right: 18px; background: var(--accent); color: white; font-size: 0.7rem; font-weight: 900; padding: 4px 12px; border-radius: 99px; letter-spacing: 0.5px; }
        .plan-icon { width: 52px; height: 52px; border-radius: 14px; background: color-mix(in srgb, var(--accent) 18%, transparent); color: var(--accent); display: flex; align-items: center; justify-content: center; font-size: 1.4rem; margin-bottom: 14px; }
        .plan-card h3 { font-size: 1.3rem; font-weight: 900; margin: 0 0 4px; color: white; }
        .plan-tag { color: #64748b; font-size: 0.85rem; margin: 0 0 16px; }
        .plan-price { display: flex; align-items: baseline; gap: 6px; margin-bottom: 4px; }
        .plan-price .amount { font-size: 2.2rem; font-weight: 900; color: white; letter-spacing: -1px; }
        .plan-price .period { color: #94a3b8; font-weight: 600; }
        .price-note { color: #64748b; font-size: 0.75rem; margin: 0 0 12px; }

        .plan-cta { width: 100%; padding: 13px; border-radius: 13px; border: none; background: var(--accent); color: white; font-weight: 800; font-size: 0.92rem; cursor: pointer; transition: all 0.2s; margin: 14px 0 20px; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .plan-cta:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-2px); }
        .plan-cta:disabled { opacity: 0.75; cursor: default; transform: none; }
        .plan-cta.current { background: rgba(16,185,129,0.15); color: #34d399; border: 1px solid rgba(16,185,129,0.4); }

        .plan-benefits { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 11px; }
        .plan-benefits li { display: flex; align-items: flex-start; gap: 10px; font-size: 0.88rem; color: #94a3b8; line-height: 1.5; }
        .plan-benefits li i { color: #10b981; margin-top: 2px; flex-shrink: 0; }
        .plan-benefits li.off { color: #475569; }
        .plan-benefits li.off i { color: #334155; }
        .plan-benefits li.bold { color: #e2e8f0; font-weight: 600; }
        .benefit-note { display: block; font-size: 0.75rem; color: #64748b; font-style: normal; margin-top: 2px; }

        /* CALCULADORA */
        .calc-wrap { background: linear-gradient(135deg, rgba(59,130,246,0.08), rgba(139,92,246,0.06)); border: 1px solid rgba(59,130,246,0.2); border-radius: 20px; padding: 28px 30px; margin: 10px auto 40px; max-width: 760px; }
        .calc-wrap h3 { color: white; font-size: 1.1rem; font-weight: 800; margin: 0 0 6px; display: flex; align-items: center; gap: 10px; }
        .calc-sub { color: #94a3b8; font-size: 0.88rem; margin: 0 0 18px; }
        .calc-slider-row { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; color: #64748b; font-size: 0.8rem; }
        .calc-slider-row input[type=range] { flex: 1; accent-color: #3b82f6; height: 4px; }
        .calc-gasto { text-align: center; color: #94a3b8; font-size: 0.88rem; margin: 0 0 16px; }
        .calc-gasto strong { color: white; font-size: 1.1rem; }
        .calc-result { border-radius: 14px; padding: 18px 20px; border: 1px solid; }
        .calc-result.yes { background: rgba(16,185,129,0.1); border-color: rgba(16,185,129,0.3); }
        .calc-result.no { background: rgba(100,116,139,0.1); border-color: rgba(100,116,139,0.2); }
        .calc-numbers { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
        .calc-numbers > div { flex: 1; min-width: 120px; }
        .calc-vs { color: #64748b; flex-shrink: 0; font-size: 1.1rem; }
        .calc-label { display: block; font-size: 0.75rem; color: #64748b; margin-bottom: 4px; }
        .calc-val { font-size: 1.3rem; font-weight: 900; color: white; }
        .calc-verdict { font-size: 0.9rem; font-weight: 600; display: flex; align-items: center; gap: 8px; }
        .calc-result.yes .calc-verdict { color: #34d399; }
        .calc-result.no .calc-verdict { color: #94a3b8; }

        /* GAMIFICACIÓN */
        .gami-section { margin: 0 0 50px; }
        .gami-header { text-align: center; margin-bottom: 30px; }
        .section-badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(59,130,246,0.1); color: #60a5fa; border: 1px solid rgba(59,130,246,0.25); padding: 5px 14px; border-radius: 99px; font-size: 0.78rem; font-weight: 800; margin-bottom: 14px; }
        .gami-section h2, .comp-section h2 { text-align: center; color: white; font-size: 1.6rem; font-weight: 900; margin: 0 0 8px; }
        .gami-header p { color: #94a3b8; max-width: 520px; margin: 0 auto; line-height: 1.6; font-size: 0.92rem; }
        .gami-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .niveles-list { background: rgba(15,23,42,0.5); border: 1px solid rgba(255,255,255,0.07); border-radius: 18px; padding: 20px; display: flex; flex-direction: column; gap: 14px; }
        .nivel-row { display: flex; align-items: center; gap: 14px; }
        .nivel-icon { width: 40px; height: 40px; border-radius: 12px; background: color-mix(in srgb, var(--nc,#64748b) 18%, transparent); color: var(--nc,#64748b); display: flex; align-items: center; justify-content: center; font-size: 1.1rem; flex-shrink: 0; }
        .nivel-row strong { display: block; color: white; font-size: 0.9rem; }
        .nivel-row span { color: #64748b; font-size: 0.8rem; }
        .nivel-row em { color: #475569; font-style: normal; }
        .badges-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 10px; }
        .badge-chip { background: rgba(15,23,42,0.5); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 14px; text-align: center; }
        .badge-chip i { font-size: 1.3rem; color: #fbbf24; margin-bottom: 6px; display: block; }
        .badge-chip span { display: block; color: white; font-size: 0.82rem; font-weight: 700; margin-bottom: 4px; }
        .badge-chip p { margin: 0; color: #64748b; font-size: 0.72rem; line-height: 1.4; }

        /* COMPARATIVA */
        .comp-section { margin: 0 0 50px; }
        .comp-section .section-badge { display: block; text-align: center; margin: 0 auto 14px; width: fit-content; }
        .comp-section h2 { text-align: center; font-size: 1.9rem; font-weight: 900; margin: 0 0 10px; color: white; letter-spacing: -0.5px; }
        .comp-subtitle { text-align: center; color: #64748b; font-size: 0.9rem; margin: 0 auto 30px; max-width: 500px; line-height: 1.6; }

        /* Score cards */
        .comp-scores { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 24px; }
        .comp-score-card { background: rgba(15,23,42,0.6); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 18px 14px; text-align: center; position: relative; }
        .comp-score-hl { background: rgba(37,99,235,0.1); border-color: rgba(59,130,246,0.35); box-shadow: 0 0 24px rgba(59,130,246,0.1); }
        .comp-score-name { display: block; font-size: 0.78rem; color: #94a3b8; font-weight: 700; margin-bottom: 10px; line-height: 1.3; }
        .comp-score-hl .comp-score-name { color: #93c5fd; }
        .comp-score-num { font-size: 1.6rem; font-weight: 900; margin-bottom: 8px; }
        .comp-score-bar-wrap { height: 4px; background: rgba(255,255,255,0.06); border-radius: 2px; overflow: hidden; }
        .comp-score-bar { height: 100%; border-radius: 2px; transition: width 0.6s ease; }
        .comp-winner-badge { display: inline-flex; align-items: center; gap: 4px; background: rgba(251,191,36,0.12); color: #fbbf24; border: 1px solid rgba(251,191,36,0.25); border-radius: 99px; font-size: 0.65rem; font-weight: 800; padding: 3px 8px; margin-top: 10px; }

        /* Feature grid */
        .comp-grid-wrap { border: 1px solid rgba(255,255,255,0.08); border-radius: 18px; overflow: hidden; }
        .comp-grid-head { display: grid; grid-template-columns: 1fr repeat(4,80px); background: rgba(15,23,42,0.8); padding: 12px 16px; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .comp-grid-row { display: grid; grid-template-columns: 1fr repeat(4,80px); padding: 11px 16px; gap: 8px; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.15s; }
        .comp-grid-row.even { background: rgba(255,255,255,0.02); }
        .comp-grid-row:last-child { border-bottom: none; }
        .comp-grid-row:hover { background: rgba(59,130,246,0.04); }
        .comp-feat-col { font-size: 0.82rem; color: #94a3b8; }
        .comp-grid-head .comp-feat-col { color: #475569; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
        .comp-app-col { text-align: center; font-size: 0.72rem; color: #475569; font-weight: 700; }
        .comp-app-col.hl { color: #93c5fd; }
        .comp-check { color: #10b981; font-size: 1rem; }
        .comp-cross { color: #1e293b; font-size: 0.85rem; }
        .comp-note { color: #475569; font-size: 0.78rem; margin-top: 14px; display: flex; align-items: center; gap: 6px; }

        @media (max-width: 680px) {
          .comp-scores { grid-template-columns: repeat(2,1fr); }
          .comp-grid-head { grid-template-columns: 1fr repeat(4,54px); padding: 10px 12px; }
          .comp-grid-row { grid-template-columns: 1fr repeat(4,54px); padding: 10px 12px; }
          .comp-feat-col { font-size: 0.75rem; }
        }

        /* RANKING PROMO */
        .ranking-promo { display: flex; align-items: center; gap: 30px; background: linear-gradient(135deg, rgba(59,130,246,0.1), rgba(139,92,246,0.08)); border: 1px solid rgba(139,92,246,0.2); border-radius: 24px; padding: 36px; margin: 20px 0 50px; }
        .rp-text { flex: 1; }
        .rp-text h2 { font-size: 1.4rem; font-weight: 900; color: white; margin: 0 0 10px; display: flex; align-items: center; gap: 10px; text-align: left; }
        .rp-text p { color: #94a3b8; line-height: 1.6; margin: 0 0 18px; font-size: 0.92rem; }
        .rp-btn { background: linear-gradient(135deg,#3b82f6,#8b5cf6); color: white; border: none; padding: 12px 22px; border-radius: 12px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s; font-size: 0.9rem; }
        .rp-btn:hover { transform: translateX(3px); box-shadow: 0 10px 25px rgba(99,102,241,0.4); }
        .rp-podium { display: flex; align-items: flex-end; gap: 8px; height: 110px; flex-shrink: 0; }
        .podium-bar { width: 46px; border-radius: 10px 10px 0 0; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding-top: 8px; color: white; font-weight: 900; gap: 4px; font-size: 0.85rem; }
        .podium-bar.first { height: 110px; background: linear-gradient(180deg,#fbbf24,#f59e0b); }
        .podium-bar.first i { font-size: 0.85rem; }
        .podium-bar.second { height: 80px; background: linear-gradient(180deg,#cbd5e1,#94a3b8); }
        .podium-bar.third { height: 58px; background: linear-gradient(180deg,#d97706,#b45309); }

        /* FAQ */
        .faq { margin: 0 auto 40px; max-width: 760px; }
        .faq h2 { text-align: center; color: white; font-size: 1.5rem; font-weight: 900; margin-bottom: 22px; }
        .faq-item { border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; margin-bottom: 10px; overflow: hidden; background: rgba(15,23,42,0.5); }
        .faq-item button { width: 100%; padding: 16px 18px; background: none; border: none; color: #e2e8f0; font-weight: 700; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 12px; text-align: left; }
        .faq-item button i { color: #64748b; flex-shrink: 0; }
        .faq-item p { margin: 0; padding: 0 18px 16px; color: #94a3b8; line-height: 1.6; font-size: 0.88rem; animation: fadeIn 0.2s; }
        .demo-note { text-align: center; color: #475569; font-size: 0.8rem; }
        .demo-note i { margin-right: 6px; }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        @media (max-width: 900px) {
          .planes-grid.cols-3 { grid-template-columns: 1fr; }
          .gami-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 700px) {
          .premium-hero h1 { font-size: 1.9rem; }
          .planes-grid.cols-2 { grid-template-columns: 1fr; }
          .aud-toggle button { padding: 9px 14px; font-size: 0.82rem; }
          .ranking-promo { flex-direction: column; padding: 24px 18px; }
          .rp-text h2 { justify-content: center; }
          .badges-grid { grid-template-columns: repeat(3,1fr); }
          .calc-numbers { flex-direction: column; align-items: flex-start; }
          .calc-vs { transform: rotate(90deg); align-self: center; }
        }
      `}</style>
    </div>
  );
}
