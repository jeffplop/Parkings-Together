'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';
import { supabase } from '@parkings/supabase-db';

const ESTADOS = {
  pendiente:  { label: 'Pendiente',  color: '#f59e0b', icon: 'fa-clock' },
  confirmada: { label: 'Confirmada', color: '#3b82f6', icon: 'fa-circle-check' },
  completada: { label: 'Completada', color: '#10b981', icon: 'fa-flag-checkered' },
  cancelada:  { label: 'Cancelada',  color: '#ef4444', icon: 'fa-ban' },
};

function fmtFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function ConductorDashboard({ user }) {
  const router = useRouter();
  const [reservas, setReservas]   = useState([]);
  const [favoritos, setFavoritos] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [plan, setPlan]           = useState('free');
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    let activo = true;
    (async () => {
      const [resR, resF, resP] = await Promise.all([
        api.reservas.listar('conductor'),
        api.favoritos.listar(),
        api.premium.estado(),
      ]);
      let vehs = [];
      try {
        const { data } = await supabase.from('vehiculos').select('*').eq('user_id', user.id).order('es_principal', { ascending: false });
        vehs = data || [];
      } catch { /* tabla sin acceso */ }

      if (!activo) return;
      setReservas(resR.success ? (resR.data || []) : []);
      setFavoritos(resF.success ? (resF.data || []) : []);
      setPlan(resP.success && resP.data?.plan ? resP.data.plan : 'free');
      setVehiculos(vehs);
      setLoading(false);
    })();
    return () => { activo = false; };
  }, [user.id]);

  const ahora = Date.now();
  const proximas = reservas
    .filter(r => (r.estado === 'pendiente' || r.estado === 'confirmada') && new Date(r.fecha_fin || r.fecha_inicio).getTime() >= ahora)
    .sort((a, b) => new Date(a.fecha_inicio) - new Date(b.fecha_inicio));
  const historial = reservas
    .filter(r => r.estado === 'completada' || r.estado === 'cancelada')
    .sort((a, b) => new Date(b.fecha_inicio) - new Date(a.fecha_inicio));

  const completadas = reservas.filter(r => r.estado === 'completada');
  const gastoTotal = completadas.reduce((acc, r) => acc + Number(r.precio_total || 0), 0);
  const gastoMes = completadas
    .filter(r => new Date(r.fecha_inicio).getMonth() === new Date().getMonth() && new Date(r.fecha_inicio).getFullYear() === new Date().getFullYear())
    .reduce((acc, r) => acc + Number(r.precio_total || 0), 0);

  const esPremium = plan && plan !== 'free';

  if (loading) {
    return (
      <div style={{ height: '60vh', display: 'flex', flexDirection: 'column', gap: 16, justifyContent: 'center', alignItems: 'center', color: '#94a3b8' }}>
        <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2.5rem', color: '#3b82f6' }}></i>
        Cargando tu panel...
      </div>
    );
  }

  return (
    <div className="cd-wrap">
      {/* Hero */}
      <div className="cd-hero">
        <div>
          <span className="cd-kicker"><i className="fa-solid fa-gauge-high"></i> Panel del Conductor</span>
          <h1>Hola, {user.nombre?.split(' ')[0] || 'conductor'} 👋</h1>
          <p>Todo tu mundo de estacionamientos en un solo lugar.</p>
        </div>
        <span className={`cd-plan-badge ${esPremium ? 'pro' : ''}`}>
          <i className={`fa-solid ${esPremium ? 'fa-crown' : 'fa-user'}`}></i>
          {esPremium ? `Plan ${plan}` : 'Plan Gratis'}
        </span>
      </div>

      {/* KPIs */}
      <div className="cd-kpis">
        <div className="cd-kpi">
          <div className="cd-kpi-ic blue"><i className="fa-solid fa-calendar-day"></i></div>
          <div><strong>{proximas.length}</strong><span>Próximas reservas</span></div>
        </div>
        <div className="cd-kpi">
          <div className="cd-kpi-ic green"><i className="fa-solid fa-flag-checkered"></i></div>
          <div><strong>{completadas.length}</strong><span>Completadas</span></div>
        </div>
        <div className="cd-kpi">
          <div className="cd-kpi-ic amber"><i className="fa-solid fa-coins"></i></div>
          <div><strong>${gastoMes.toLocaleString('es-CL')}</strong><span>Gasto este mes</span></div>
        </div>
        <div className="cd-kpi">
          <div className="cd-kpi-ic purple"><i className="fa-solid fa-heart"></i></div>
          <div><strong>{favoritos.length}</strong><span>Favoritos</span></div>
        </div>
      </div>

      {/* Acciones rápidas */}
      <div className="cd-quick">
        <button onClick={() => router.push('/mapa')}><i className="fa-solid fa-map-location-dot"></i> Buscar plaza</button>
        <button onClick={() => router.push('/ranking')}><i className="fa-solid fa-trophy"></i> Ver ranking</button>
        <button onClick={() => router.push('/profile?tab=favoritos')}><i className="fa-solid fa-heart"></i> Favoritos</button>
        {!esPremium && <button className="pro" onClick={() => router.push('/premium')}><i className="fa-solid fa-crown"></i> Hazte Pro</button>}
      </div>

      <div className="cd-grid">
        {/* Próximas reservas */}
        <section className="cd-card">
          <h3><i className="fa-solid fa-calendar-day" style={{ color: '#3b82f6' }}></i> Próximas reservas</h3>
          {proximas.length === 0 ? (
            <div className="cd-empty">
              <i className="fa-regular fa-calendar"></i>
              <p>No tienes reservas próximas.</p>
              <button onClick={() => router.push('/mapa')}>Reservar ahora</button>
            </div>
          ) : (
            <div className="cd-list">
              {proximas.slice(0, 4).map(r => {
                const est = ESTADOS[r.estado] || ESTADOS.pendiente;
                return (
                  <div key={r.id} className="cd-row" onClick={() => router.push('/reservas')}>
                    <div className="cd-row-ic" style={{ background: `${est.color}22`, color: est.color }}><i className={`fa-solid ${est.icon}`}></i></div>
                    <div className="cd-row-info">
                      <strong>{r.estacionamiento?.nombre || 'Estacionamiento'}</strong>
                      <span>{fmtFecha(r.fecha_inicio)}</span>
                    </div>
                    <span className="cd-tag" style={{ color: est.color, borderColor: `${est.color}55` }}>{est.label}</span>
                  </div>
                );
              })}
              {proximas.length > 4 && <button className="cd-more" onClick={() => router.push('/reservas')}>Ver todas ({proximas.length})</button>}
            </div>
          )}
        </section>

        {/* Mis vehículos */}
        <section className="cd-card">
          <h3><i className="fa-solid fa-car" style={{ color: '#10b981' }}></i> Mis vehículos</h3>
          {vehiculos.length === 0 ? (
            <div className="cd-empty">
              <i className="fa-solid fa-car-side"></i>
              <p>No tienes vehículos registrados.</p>
              <button onClick={() => router.push('/profile?tab=vehiculos')}>Agregar vehículo</button>
            </div>
          ) : (
            <div className="cd-list">
              {vehiculos.map(v => (
                <div key={v.id} className="cd-row">
                  <div className="cd-row-ic" style={{ background: 'rgba(16,185,129,0.13)', color: '#10b981' }}><i className="fa-solid fa-car"></i></div>
                  <div className="cd-row-info">
                    <strong>{(v.patente || '').toUpperCase()} {v.es_principal && <span className="cd-principal">Principal</span>}</strong>
                    <span>{[v.marca, v.modelo, v.color].filter(Boolean).join(' · ') || 'Sin detalles'}</span>
                  </div>
                </div>
              ))}
              <button className="cd-more" onClick={() => router.push('/profile?tab=vehiculos')}>Gestionar vehículos</button>
            </div>
          )}
        </section>

        {/* Favoritos */}
        <section className="cd-card">
          <h3><i className="fa-solid fa-heart" style={{ color: '#ec4899' }}></i> Favoritos</h3>
          {favoritos.length === 0 ? (
            <div className="cd-empty">
              <i className="fa-regular fa-heart"></i>
              <p>Aún no guardas estacionamientos.</p>
              <button onClick={() => router.push('/mapa')}>Explorar mapa</button>
            </div>
          ) : (
            <div className="cd-list">
              {favoritos.slice(0, 4).map(f => {
                const e = f.estacionamiento || f;
                return (
                  <div key={e.id} className="cd-row" onClick={() => router.push(`/mapa?id=${e.id}&lat=${e.lat}&lng=${e.lng}`)}>
                    <div className="cd-row-ic" style={{ background: 'rgba(236,72,153,0.13)', color: '#ec4899' }}><i className="fa-solid fa-square-parking"></i></div>
                    <div className="cd-row-info">
                      <strong>{e.nombre}</strong>
                      <span>{e.comuna || ''}{e.precio_hora ? ` · $${Number(e.precio_hora).toLocaleString('es-CL')}/h` : ''}</span>
                    </div>
                    <i className="fa-solid fa-chevron-right" style={{ color: '#475569', fontSize: '0.75rem' }}></i>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Resumen de gastos */}
        <section className="cd-card">
          <h3><i className="fa-solid fa-chart-pie" style={{ color: '#f59e0b' }}></i> Resumen de gastos</h3>
          <div className="cd-spend">
            <div className="cd-spend-main">
              <span>Total acumulado</span>
              <strong>${gastoTotal.toLocaleString('es-CL')}</strong>
            </div>
            <div className="cd-spend-row"><span>Este mes</span><strong style={{ color: '#f59e0b' }}>${gastoMes.toLocaleString('es-CL')}</strong></div>
            <div className="cd-spend-row"><span>Reservas completadas</span><strong>{completadas.length}</strong></div>
            <div className="cd-spend-row"><span>Ticket promedio</span><strong>${completadas.length ? Math.round(gastoTotal / completadas.length).toLocaleString('es-CL') : 0}</strong></div>
            {!esPremium && (
              <div className="cd-pro-hint">
                <i className="fa-solid fa-crown"></i>
                Con <strong>Pro</strong> ahorras la tarifa de servicio en cada reserva.
                <button onClick={() => router.push('/premium')}>Ver planes</button>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Historial */}
      {historial.length > 0 && (
        <section className="cd-card" style={{ marginTop: 18 }}>
          <h3><i className="fa-solid fa-clock-rotate-left" style={{ color: '#64748b' }}></i> Historial reciente</h3>
          <div className="cd-list">
            {historial.slice(0, 5).map(r => {
              const est = ESTADOS[r.estado] || ESTADOS.completada;
              return (
                <div key={r.id} className="cd-row">
                  <div className="cd-row-ic" style={{ background: `${est.color}22`, color: est.color }}><i className={`fa-solid ${est.icon}`}></i></div>
                  <div className="cd-row-info">
                    <strong>{r.estacionamiento?.nombre || 'Estacionamiento'}</strong>
                    <span>{fmtFecha(r.fecha_inicio)}</span>
                  </div>
                  <span className="cd-tag" style={{ color: est.color, borderColor: `${est.color}55` }}>{est.label}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <style jsx>{`
        .cd-wrap { max-width: 1100px; margin: 0 auto; padding: 24px 18px 80px; }
        .cd-hero { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; margin-bottom: 26px; }
        .cd-kicker { display: inline-flex; align-items: center; gap: 8px; background: rgba(59,130,246,0.12); color: #60a5fa; border: 1px solid rgba(59,130,246,0.3); padding: 5px 14px; border-radius: 99px; font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
        .cd-hero h1 { font-size: 1.9rem; font-weight: 900; color: white; margin: 0 0 6px; letter-spacing: -0.5px; }
        .cd-hero p { color: #94a3b8; margin: 0; font-size: 0.92rem; }
        .cd-plan-badge { display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 12px; font-weight: 800; font-size: 0.85rem; background: rgba(100,116,139,0.15); color: #94a3b8; border: 1px solid rgba(255,255,255,0.08); }
        .cd-plan-badge.pro { background: rgba(245,158,11,0.13); color: #fbbf24; border-color: rgba(245,158,11,0.3); }

        .cd-kpis { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; margin-bottom: 18px; }
        .cd-kpi { display: flex; align-items: center; gap: 14px; background: rgba(15,23,42,0.6); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 16px; }
        .cd-kpi-ic { width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; flex-shrink: 0; }
        .cd-kpi-ic.blue { background: rgba(59,130,246,0.15); color: #60a5fa; }
        .cd-kpi-ic.green { background: rgba(16,185,129,0.15); color: #34d399; }
        .cd-kpi-ic.amber { background: rgba(245,158,11,0.15); color: #fbbf24; }
        .cd-kpi-ic.purple { background: rgba(168,85,247,0.15); color: #c084fc; }
        .cd-kpi strong { display: block; font-size: 1.4rem; font-weight: 900; color: white; line-height: 1.1; }
        .cd-kpi span { font-size: 0.74rem; color: #64748b; font-weight: 600; }

        .cd-quick { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 24px; }
        .cd-quick button { display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; border-radius: 12px; background: rgba(15,23,42,0.6); border: 1px solid rgba(255,255,255,0.08); color: #cbd5e1; font-weight: 700; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; }
        .cd-quick button:hover { border-color: rgba(59,130,246,0.4); color: white; transform: translateY(-2px); }
        .cd-quick button.pro { background: linear-gradient(135deg, rgba(245,158,11,0.15), rgba(236,72,153,0.1)); border-color: rgba(245,158,11,0.35); color: #fbbf24; }

        .cd-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .cd-card { background: rgba(15,23,42,0.55); border: 1px solid rgba(255,255,255,0.07); border-radius: 18px; padding: 20px; }
        .cd-card h3 { display: flex; align-items: center; gap: 10px; font-size: 1rem; font-weight: 800; color: white; margin: 0 0 16px; }

        .cd-list { display: flex; flex-direction: column; gap: 8px; }
        .cd-row { display: flex; align-items: center; gap: 12px; padding: 11px 12px; background: rgba(2,6,23,0.4); border: 1px solid rgba(255,255,255,0.04); border-radius: 12px; cursor: pointer; transition: all 0.18s; }
        .cd-row:hover { background: rgba(2,6,23,0.7); border-color: rgba(59,130,246,0.2); }
        .cd-row-ic { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; flex-shrink: 0; }
        .cd-row-info { flex: 1; min-width: 0; }
        .cd-row-info strong { display: block; color: white; font-size: 0.88rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cd-row-info span { font-size: 0.76rem; color: #64748b; }
        .cd-principal { font-size: 0.62rem; background: rgba(16,185,129,0.18); color: #34d399; padding: 2px 7px; border-radius: 99px; font-weight: 800; margin-left: 6px; vertical-align: middle; }
        .cd-tag { font-size: 0.7rem; font-weight: 800; padding: 3px 9px; border-radius: 99px; border: 1px solid; white-space: nowrap; }
        .cd-more { background: none; border: none; color: #60a5fa; font-weight: 700; font-size: 0.8rem; cursor: pointer; padding: 8px; text-align: center; }
        .cd-more:hover { text-decoration: underline; }

        .cd-empty { text-align: center; padding: 24px 12px; color: #475569; }
        .cd-empty i { font-size: 1.8rem; display: block; margin-bottom: 10px; opacity: 0.5; }
        .cd-empty p { margin: 0 0 12px; font-size: 0.82rem; }
        .cd-empty button { background: rgba(59,130,246,0.12); border: 1px solid rgba(59,130,246,0.3); color: #60a5fa; padding: 8px 16px; border-radius: 10px; font-weight: 700; font-size: 0.8rem; cursor: pointer; }
        .cd-empty button:hover { background: rgba(59,130,246,0.2); }

        .cd-spend-main { display: flex; flex-direction: column; align-items: center; padding: 14px 0 18px; border-bottom: 1px solid rgba(255,255,255,0.06); margin-bottom: 12px; }
        .cd-spend-main span { font-size: 0.78rem; color: #64748b; font-weight: 600; }
        .cd-spend-main strong { font-size: 2rem; font-weight: 900; color: white; }
        .cd-spend-row { display: flex; justify-content: space-between; padding: 7px 0; font-size: 0.85rem; color: #94a3b8; }
        .cd-spend-row strong { color: white; font-weight: 700; }
        .cd-pro-hint { margin-top: 14px; padding: 12px 14px; background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.2); border-radius: 12px; font-size: 0.8rem; color: #cbd5e1; line-height: 1.5; }
        .cd-pro-hint i { color: #fbbf24; margin-right: 6px; }
        .cd-pro-hint button { display: block; margin-top: 8px; background: #f59e0b; color: #0f172a; border: none; padding: 7px 14px; border-radius: 9px; font-weight: 800; font-size: 0.78rem; cursor: pointer; }

        @media (max-width: 820px) {
          .cd-kpis { grid-template-columns: repeat(2,1fr); }
          .cd-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
