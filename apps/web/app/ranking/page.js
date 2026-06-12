'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../src/lib/api';
import { REGIONES, detectarRegion } from '../../src/lib/comunas-chile';

const VEHICULOS = [
  { value: '',           label: 'Todos',   icon: 'fa-layer-group' },
  { value: 'car',        label: 'Auto',    icon: 'fa-car' },
  { value: 'motorcycle', label: 'Moto',    icon: 'fa-motorcycle' },
  { value: 'bicycle',    label: 'Bici',    icon: 'fa-bicycle' },
  { value: 'scooter',    label: 'Scooter', icon: 'fa-person-biking' },
];

const MEDALLAS = ['#fbbf24', '#cbd5e1', '#d97706']; // oro, plata, bronce

function Estrellas({ rating }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span className="stars">
      {[0, 1, 2, 3, 4].map(i => (
        <i key={i} className={`fa-${i < full ? 'solid' : (i === full && half ? 'solid fa-star-half-stroke' : 'regular')} ${i < full ? 'fa-star' : (i === full && half ? '' : 'fa-star')}`}></i>
      ))}
      <span className="rating-num">{Number(rating).toFixed(1)}</span>
    </span>
  );
}

export default function RankingPage() {
  const router = useRouter();
  const [todos, setTodos]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [regionId, setRegionId] = useState('');
  const [comuna, setComuna]     = useState('');
  const [vehiculo, setVehiculo] = useState('');
  const [soloDisp, setSoloDisp] = useState(false);
  const [precioMax, setPrecioMax] = useState('');
  const [zonaAuto, setZonaAuto] = useState(null);

  // Carga inicial de todos los estacionamientos + auto-detección de zona por GPS.
  useEffect(() => {
    api.mapas.buscar({}).then(res => {
      if (res.success) setTodos(res.data || []);
      setLoading(false);
    });

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const reg = detectarRegion(pos.coords.latitude, pos.coords.longitude);
          if (reg) { setRegionId(reg.id); setZonaAuto(reg.nombre); }
        },
        () => { /* sin permiso: el usuario filtra manualmente */ },
        { timeout: 5000 }
      );
    }
  }, []);

  const comunasDisponibles = useMemo(() => {
    const reg = REGIONES.find(r => r.id === regionId);
    return reg ? [...new Set(reg.comunas)].sort((a, b) => a.localeCompare(b)) : [];
  }, [regionId]);

  // Ranking filtrado + ordenado por rating (desempate por nº de reseñas).
  const ranking = useMemo(() => {
    const reg = REGIONES.find(r => r.id === regionId);
    const comunasReg = reg ? new Set(reg.comunas) : null;

    return (todos || [])
      .filter(p => {
        if (comuna && p.comuna !== comuna) return false;
        if (!comuna && comunasReg && !comunasReg.has(p.comuna)) return false;
        if (vehiculo && !(p.allowed_vehicle_types || []).includes(vehiculo)) return false;
        if (soloDisp && !((p.total_spots - p.occupied_spots) > 0)) return false;
        if (precioMax && Number(p.precio_hora) > Number(precioMax)) return false;
        return true;
      })
      .sort((a, b) =>
        (b.rating - a.rating) ||
        (b.reviews_count - a.reviews_count) ||
        a.nombre.localeCompare(b.nombre)
      );
  }, [todos, regionId, comuna, vehiculo, soloDisp, precioMax]);

  const podio = ranking.slice(0, 3);
  const resto = ranking.slice(3);

  const limpiar = () => { setRegionId(''); setComuna(''); setVehiculo(''); setSoloDisp(false); setPrecioMax(''); };

  const irAlMapa = (p) => router.push(`/mapa?id=${p.id}&lat=${p.lat}&lng=${p.lng}`);

  return (
    <div className="rank-wrap">
      {/* HERO */}
      <header className="rank-hero">
        <span className="rank-badge"><i className="fa-solid fa-trophy"></i> Ranking Comunidad</span>
        <h1>Los mejores parkings <span className="grad">de Chile</span></h1>
        <p>
          {zonaAuto
            ? <>Detectamos que estás en <strong>{zonaAuto}</strong>. Estos son los mejor evaluados cerca de ti.</>
            : 'Clasificados por calificación real de la comunidad. Haz clic para ver en el mapa.'}
        </p>
        {!loading && ranking.length > 0 && (
          <div className="rank-hero-stats">
            <div className="hero-stat">
              <strong>{ranking.length}</strong>
              <span>Parkings</span>
            </div>
            <div className="hero-stat">
              <strong>{ranking.filter(p => (p.total_spots - p.occupied_spots) > 0).length}</strong>
              <span>Disponibles</span>
            </div>
            <div className="hero-stat">
              <strong>{ranking.length > 0 ? (ranking.reduce((a,p) => a + p.rating, 0) / ranking.length).toFixed(1) : '—'}</strong>
              <span>Rating prom.</span>
            </div>
          </div>
        )}
      </header>

      {/* FILTROS */}
      <section className="rank-filters">
        <div className="filter-row">
          <div className="f-group">
            <label>Región</label>
            <select value={regionId} onChange={e => { setRegionId(e.target.value); setComuna(''); }}>
              <option value="">Todo Chile</option>
              {REGIONES.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </div>
          <div className="f-group">
            <label>Comuna</label>
            <select value={comuna} onChange={e => setComuna(e.target.value)} disabled={!regionId}>
              <option value="">Todas</option>
              {comunasDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="f-group">
            <label>Precio máx. ($/h)</label>
            <input type="number" min="0" step="100" placeholder="Sin límite" value={precioMax} onChange={e => setPrecioMax(e.target.value)} />
          </div>
        </div>

        <div className="filter-row bottom">
          <div className="veh-chips">
            {VEHICULOS.map(v => (
              <button key={v.value} className={`veh-chip ${vehiculo === v.value ? 'active' : ''}`} onClick={() => setVehiculo(v.value)}>
                <i className={`fa-solid ${v.icon}`}></i> {v.label}
              </button>
            ))}
          </div>
          <label className="disp-check">
            <input type="checkbox" checked={soloDisp} onChange={e => setSoloDisp(e.target.checked)} />
            <span>Solo con cupos</span>
          </label>
          <button className="clear-btn" onClick={limpiar}><i className="fa-solid fa-rotate-left"></i> Limpiar</button>
        </div>
      </section>

      {/* RESULTADOS */}
      {loading ? (
        <div className="rank-empty"><i className="fa-solid fa-spinner fa-spin"></i> Cargando ranking...</div>
      ) : ranking.length === 0 ? (
        <div className="rank-empty">
          <i className="fa-solid fa-magnifying-glass"></i>
          <p>No hay estacionamientos que coincidan con tu filtro.</p>
          <button className="clear-btn" onClick={limpiar}>Quitar filtros</button>
        </div>
      ) : (
        <>
          {/* PODIO */}
          {podio.length > 0 && (
            <>
              <div className="section-label"><i className="fa-solid fa-trophy"></i> Top 3</div>
              <section className="podio">
                {[podio[1], podio[0], podio[2]].filter(Boolean).map((p, visualIdx) => {
                  const realIdx = podio.indexOf(p);
                  return (
                    <article key={p.id} className={`podio-card pos-${realIdx}`} onClick={() => irAlMapa(p)} style={{ '--medal': MEDALLAS[realIdx] }}>
                      <div className="medal"><span>{realIdx + 1}</span></div>
                      {p.photos?.[0]
                        ? <img src={p.photos[0]} alt={p.nombre} className="podio-img" onError={e => { e.target.replaceWith(Object.assign(document.createElement('div'), { className: 'podio-img placeholder', innerHTML: '<i class="fa-solid fa-square-parking"></i>' })); }} />
                        : <div className="podio-img placeholder"><i className="fa-solid fa-square-parking"></i></div>}
                      <h3>{p.nombre}</h3>
                      <p className="podio-comuna"><i className="fa-solid fa-location-dot"></i> {p.comuna}</p>
                      <Estrellas rating={p.rating} />
                      <span className="reviews">{p.reviews_count} {p.reviews_count === 1 ? 'reseña' : 'reseñas'}</span>
                      <span className="podio-precio"><i className="fa-solid fa-tag"></i> ${Number(p.precio_hora).toLocaleString('es-CL')}/h</span>
                      {(() => { const cupos = (p.total_spots || 0) - (p.occupied_spots || 0); return <span className={`podio-spots${cupos > 0 ? ' available' : ''}`}>{cupos > 0 ? `${cupos} cupos disponibles` : 'Sin cupos'}</span>; })()}
                    </article>
                  );
                })}
              </section>
            </>
          )}

          {/* LISTA */}
          {resto.length > 0 && (
            <>
              <div className="section-label"><i className="fa-solid fa-list-ol"></i> Resto del ranking</div>
              <section className="rank-list">
                {resto.map((p, i) => {
                  const cupos = (p.total_spots || 0) - (p.occupied_spots || 0);
                  return (
                    <article key={p.id} className="rank-row" onClick={() => irAlMapa(p)}>
                      <span className="rank-pos">#{i + 4}</span>
                      {p.photos?.[0]
                        ? <img src={p.photos[0]} alt={p.nombre} className="row-img" onError={e => { e.target.replaceWith(Object.assign(document.createElement('div'), { className: 'row-img placeholder', innerHTML: '<i class="fa-solid fa-square-parking"></i>' })); }} />
                        : <div className="row-img placeholder"><i className="fa-solid fa-square-parking"></i></div>}
                      <div className="row-info">
                        <h4>{p.nombre}</h4>
                        <div className="row-meta">
                          <span><i className="fa-solid fa-location-dot"></i> {p.comuna}</span>
                          <span className="tag-price"><i className="fa-solid fa-tag"></i> ${Number(p.precio_hora).toLocaleString('es-CL')}/h</span>
                          <span style={{ color: cupos > 0 ? '#22c55e' : '#64748b' }}>
                            <i className={`fa-solid ${cupos > 0 ? 'fa-circle-check' : 'fa-circle-xmark'}`}></i>
                            {cupos > 0 ? `${cupos} cupos` : 'Sin cupos'}
                          </span>
                        </div>
                      </div>
                      <div className="row-rating">
                        <Estrellas rating={p.rating} />
                        <span className="reviews">{p.reviews_count} reseñas</span>
                      </div>
                      <i className="fa-solid fa-chevron-right row-arrow"></i>
                    </article>
                  );
                })}
              </section>
            </>
          )}
        </>
      )}

      <style jsx>{`
        .rank-wrap { max-width: 1020px; margin: 0 auto; padding: 30px 20px 100px; color: #e2e8f0; }

        /* ── HERO ── */
        .rank-hero { text-align: center; padding: 24px 0 36px; }
        .rank-badge {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(245,158,11,0.12); color: #fbbf24;
          border: 1px solid rgba(245,158,11,0.35); padding: 6px 18px;
          border-radius: 99px; font-size: 0.78rem; font-weight: 800;
          letter-spacing: 1px; text-transform: uppercase; margin-bottom: 18px;
          box-shadow: 0 0 20px rgba(245,158,11,0.1);
        }
        .rank-hero h1 { font-size: 2.6rem; font-weight: 900; margin: 0 0 14px; letter-spacing: -1.5px; color: white; line-height: 1.1; }
        .grad { background: linear-gradient(135deg,#3b82f6,#8b5cf6,#10b981); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
        .rank-hero p { color: #94a3b8; max-width: 560px; margin: 0 auto; line-height: 1.7; font-size: 0.95rem; }
        .rank-hero strong { color: #93c5fd; }
        .rank-hero-stats { display: flex; justify-content: center; gap: 32px; margin-top: 24px; }
        .hero-stat { text-align: center; }
        .hero-stat strong { display: block; font-size: 1.6rem; font-weight: 900; color: white; }
        .hero-stat span { font-size: 0.72rem; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }

        /* ── FILTROS ── */
        .rank-filters {
          background: rgba(15,23,42,0.7);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 20px; padding: 22px; margin-bottom: 34px;
          backdrop-filter: blur(12px);
        }
        .filter-row { display: flex; gap: 14px; flex-wrap: wrap; }
        .filter-row.bottom { margin-top: 18px; align-items: center; }
        .f-group { flex: 1; min-width: 150px; display: flex; flex-direction: column; gap: 6px; }
        .f-group label { font-size: 0.72rem; color: #64748b; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; }
        .f-group select, .f-group input {
          padding: 11px 14px;
          background: rgba(0,0,0,0.45);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px; color: white; outline: none; font-size: 0.9rem;
          transition: border-color 0.2s;
        }
        .f-group select:focus, .f-group input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.15); }
        .f-group select:disabled { opacity: 0.4; }

        .veh-chips { display: flex; gap: 8px; flex-wrap: wrap; flex: 1; }
        .veh-chip {
          padding: 8px 15px;
          background: rgba(0,0,0,0.4);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 99px; color: #94a3b8;
          font-size: 0.8rem; font-weight: 600; cursor: pointer;
          transition: all 0.2s; display: flex; align-items: center; gap: 7px;
        }
        .veh-chip:hover { border-color: rgba(59,130,246,0.4); color: #cbd5e1; }
        .veh-chip.active { background: rgba(59,130,246,0.18); border-color: #3b82f6; color: #93c5fd; box-shadow: 0 0 12px rgba(59,130,246,0.15); }
        .disp-check { display: flex; align-items: center; gap: 8px; color: #cbd5e1; font-size: 0.85rem; font-weight: 600; cursor: pointer; white-space: nowrap; }
        .disp-check input { width: 16px; height: 16px; accent-color: #3b82f6; }
        .clear-btn {
          padding: 9px 18px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px; color: #94a3b8;
          font-weight: 700; cursor: pointer; font-size: 0.8rem;
          transition: all 0.2s; white-space: nowrap; display: flex; align-items: center; gap: 6px;
        }
        .clear-btn:hover { background: rgba(255,255,255,0.1); color: white; }

        /* ── SECCIÓN HEADER ── */
        .section-label {
          display: flex; align-items: center; gap: 10px;
          font-size: 0.75rem; font-weight: 800; text-transform: uppercase;
          letter-spacing: 1px; color: #64748b; margin-bottom: 18px;
        }
        .section-label::before, .section-label::after {
          content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.07);
        }

        /* ── PODIO ── */
        .podio { display: grid; grid-template-columns: 1fr 1.08fr 1fr; gap: 16px; margin-bottom: 14px; align-items: end; }
        .podio-card {
          position: relative;
          background: linear-gradient(160deg, rgba(20,30,50,0.95), rgba(10,18,35,0.95));
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 22px; padding: 22px 16px 18px;
          text-align: center; cursor: pointer;
          transition: transform 0.25s cubic-bezier(.175,.885,.32,1.275), box-shadow 0.25s;
          border-top: 3px solid var(--medal);
          overflow: hidden;
        }
        .podio-card::before {
          content: ''; position: absolute; inset: 0;
          background: radial-gradient(circle at 50% 0%, rgba(255,255,255,0.04) 0%, transparent 60%);
          pointer-events: none;
        }
        .podio-card:hover { transform: translateY(-8px); box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
        .podio-card.pos-0 { transform: translateY(-8px); box-shadow: 0 24px 56px rgba(251,191,36,0.15); }
        .podio-card.pos-0:hover { transform: translateY(-14px); }
        .podio-card.pos-1, .podio-card.pos-2 { transform: translateY(0); }
        .medal {
          position: absolute; top: -12px; left: 50%; transform: translateX(-50%);
          width: 36px; height: 36px; border-radius: 50%;
          background: var(--medal); color: #0f172a;
          display: flex; align-items: center; justify-content: center;
          font-weight: 900; font-size: 1rem;
          box-shadow: 0 4px 16px rgba(0,0,0,0.4);
        }
        .medal i { display: none; }
        .podio-img {
          width: 100%; height: 120px; object-fit: cover;
          border-radius: 14px; margin: 16px 0 16px;
        }
        .podio-img.placeholder {
          display: flex; align-items: center; justify-content: center;
          background: rgba(0,0,0,0.35); color: #1e293b; font-size: 2.2rem;
        }
        .podio-card h3 { font-size: 0.98rem; font-weight: 800; color: white; margin: 0 0 6px; line-height: 1.3; }
        .podio-comuna { font-size: 0.78rem; color: #64748b; margin: 0 0 10px; }
        .podio-precio {
          display: inline-flex; align-items: center; gap: 4px;
          background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.25);
          color: #34d399; font-weight: 800; font-size: 0.88rem;
          padding: 4px 12px; border-radius: 99px; margin-top: 10px;
        }
        .podio-spots {
          display: block; font-size: 0.7rem; color: #475569; margin-top: 6px;
        }
        .podio-spots.available { color: #22c55e; }

        /* ── ESTRELLAS ── */
        .stars { color: #fbbf24; font-size: 0.82rem; display: inline-flex; align-items: center; gap: 2px; }
        .stars .fa-regular { color: #334155; }
        .rating-num { color: white; font-weight: 800; margin-left: 6px; font-size: 0.85rem; }
        .reviews { display: block; color: #64748b; font-size: 0.7rem; margin-top: 3px; }

        /* ── LISTA ── */
        .rank-list { display: flex; flex-direction: column; gap: 8px; margin-top: 28px; }
        .rank-row {
          display: flex; align-items: center; gap: 14px;
          background: rgba(15,23,42,0.55);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px; padding: 14px 18px;
          cursor: pointer; transition: all 0.2s;
          position: relative; overflow: hidden;
        }
        .rank-row::before {
          content: ''; position: absolute; left: 0; top: 0; bottom: 0;
          width: 3px; background: rgba(59,130,246,0);
          transition: background 0.2s;
          border-radius: 3px 0 0 3px;
        }
        .rank-row:hover { background: rgba(15,23,42,0.85); border-color: rgba(59,130,246,0.25); transform: translateX(2px); }
        .rank-row:hover::before { background: #3b82f6; }
        .rank-pos {
          font-weight: 900; color: #334155; font-size: 0.85rem;
          width: 28px; text-align: center; flex-shrink: 0;
        }
        .row-img {
          width: 68px; height: 52px; object-fit: cover;
          border-radius: 12px; flex-shrink: 0;
        }
        .row-img.placeholder {
          display: flex; align-items: center; justify-content: center;
          background: rgba(0,0,0,0.35); color: #1e293b; font-size: 1.4rem;
        }
        .row-info { flex: 1; min-width: 0; }
        .row-info h4 { margin: 0 0 5px; color: white; font-size: 0.93rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .row-meta { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
        .row-meta span { font-size: 0.75rem; color: #64748b; display: flex; align-items: center; gap: 4px; }
        .row-meta span i { font-size: 0.65rem; }
        .row-meta .tag-price { color: #34d399; font-weight: 700; }
        .row-rating { text-align: right; flex-shrink: 0; }
        .row-arrow { color: #334155; flex-shrink: 0; transition: color 0.2s, transform 0.2s; }
        .rank-row:hover .row-arrow { color: #3b82f6; transform: translateX(3px); }

        /* ── EMPTY ── */
        .rank-empty { text-align: center; padding: 60px 20px; color: #64748b; }
        .rank-empty i { font-size: 2.5rem; margin-bottom: 16px; display: block; opacity: 0.4; }
        .rank-empty p { margin: 0 0 16px; font-size: 0.9rem; }

        /* ── RESPONSIVE ── */
        @media (max-width: 760px) {
          .rank-hero h1 { font-size: 1.85rem; }
          .rank-hero-stats { gap: 20px; }
          .hero-stat strong { font-size: 1.3rem; }
          .podio { grid-template-columns: 1fr; gap: 24px; }
          .podio-card.pos-0 { transform: none; box-shadow: none; }
          .podio-card.pos-0:hover { transform: translateY(-6px); }
          .podio-card.pos-1, .podio-card.pos-2 { transform: none; }
          .row-rating { display: none; }
          .row-arrow { display: none; }
          .rank-row { padding: 12px 14px; }
        }
      `}</style>
    </div>
  );
}
