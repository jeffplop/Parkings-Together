'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@parkings/supabase-db';
import { toast } from 'react-hot-toast';
import ReviewModal from '../../src/components/ReviewModal';
import ReservaTicket from '../../src/components/ReservaTicket';

const ESTADOS = {
  pendiente:  { label: 'Pendiente',  color: '#f59e0b' },
  confirmada: { label: 'Confirmada', color: '#3b82f6' },
  completada: { label: 'Completada', color: '#10b981' },
  cancelada:  { label: 'Cancelada',  color: '#ef4444' },
};

// Base style shared by all reservation action buttons; color trio varies per action.
const ACTION_BTN_BASE = { padding: '8px 14px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' };
const actionBtn = (background, border, color) => ({ ...ACTION_BTN_BASE, background, border: `1px solid ${border}`, color });

function fmtFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function ReservasPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [rol, setRol] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('conductor');
  const [reservas, setReservas] = useState([]);
  const [reservasArr, setReservasArr] = useState([]);
  const [actionLoading, setActionLoading] = useState(null);
  const [ratingModal, setRatingModal] = useState(null); // { reservaId }
  const [ticketReserva, setTicketReserva] = useState(null); // reserva para el comprobante

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!s) { router.push('/auth?redirectTo=/reservas'); return; }
      setSession(s);
      supabase.from('perfiles').select('rol').eq('id', s.user.id).single()
        .then(({ data }) => setRol(data?.rol || s.user.user_metadata?.rol || 'cliente'));
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!s) router.push('/auth?redirectTo=/reservas');
      else setSession(s);
    });
    return () => subscription.unsubscribe();
  }, [router]);

  const fetchReservas = useCallback(async (token, esArrendador) => {
    setLoading(true);
    try {
      const peticiones = [
        fetch('/api/reservas/manage?scope=conductor', {
          headers: { Authorization: `Bearer ${token}` },
        }).then(r => r.json()),
      ];
      if (esArrendador) {
        peticiones.push(
          fetch('/api/reservas/manage?scope=arrendador', {
            headers: { Authorization: `Bearer ${token}` },
          }).then(r => r.json())
        );
      }
      const [resCond, resArr] = await Promise.all(peticiones);
      setReservas(resCond.success ? (resCond.data || []) : []);
      setReservasArr(resArr?.success ? (resArr.data || []) : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session || rol === null) return;
    const esArrendador = rol === 'arrendador';
    fetchReservas(session.access_token, esArrendador);

    // Realtime updates for reservas
    const channel = supabase
      .channel('reservas-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, () => {
        fetchReservas(session.access_token, esArrendador);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [session, rol, fetchReservas]);

  const doAction = async (action, reservaId, extra = {}) => {
    setActionLoading(reservaId + action);
    const actionLabels = { confirmar: 'confirmada', cancelar: 'cancelada', completar: 'completada', calificar: 'calificada' };
    try {
      const res = await fetch('/api/reservas/manage', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action, reserva_id: reservaId, ...extra }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchReservas(session.access_token);
        toast.success(`Reserva ${actionLabels[action] || 'actualizada'}`);
      } else {
        toast.error(data.error || 'No se pudo realizar la acción.');
      }
    } catch {
      toast.error('Error de red. Inténtalo de nuevo.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSubmitReview = async ({ reservaId, stars, comentario, photoUrl }) => {
    const res = await fetch('/api/reservas/manage', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ action: 'calificar', reserva_id: reservaId, calificacion: stars, comentario, ...(photoUrl ? { review_photo_url: photoUrl } : {}) }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'No se pudo enviar la calificación.');
    await fetchReservas(session.access_token);
  };

  const activeData = tab === 'conductor' ? reservas : reservasArr;

  return (
    <section style={{ maxWidth: '900px', margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ color: '#f8fafc', fontSize: '1.8rem', fontWeight: 800, marginBottom: '6px' }}>
          <i className="fa-solid fa-calendar-check" style={{ color: '#3b82f6', marginRight: '12px' }}></i>
          Mis Reservas
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
          Gestiona y consulta todas tus reservas activas e historial.
        </p>
      </div>

      {/* Tabs — la pestaña de arrendador solo se muestra si el rol lo es */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {[
          { key: 'conductor', label: 'Como Conductor', icon: 'fa-steering-wheel', count: reservas.filter(r => r.estado === 'pendiente' || r.estado === 'confirmada').length },
          ...(rol === 'arrendador'
            ? [{ key: 'arrendador', label: 'Como Arrendador', icon: 'fa-warehouse', count: reservasArr.filter(r => r.estado === 'pendiente').length }]
            : []),
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 20px',
              borderRadius: '12px',
              border: tab === t.key ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.08)',
              background: tab === t.key ? 'rgba(59,130,246,0.15)' : 'rgba(30,41,59,0.4)',
              color: tab === t.key ? '#60a5fa' : '#94a3b8',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              position: 'relative',
            }}
          >
            <i className={`fa-solid ${t.icon}`}></i>
            {t.label}
            {t.count > 0 && (
              <span style={{ background: '#ef4444', color: 'white', borderRadius: '10px', fontSize: '0.7rem', padding: '2px 7px', fontWeight: 900 }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
          <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2rem', color: '#3b82f6' }}></i>
        </div>
      ) : activeData.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b', background: 'rgba(30,41,59,0.4)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <i className="fa-solid fa-calendar-xmark" style={{ fontSize: '3rem', marginBottom: '16px', opacity: 0.4 }}></i>
          <p style={{ fontWeight: 700 }}>No hay reservas {tab === 'conductor' ? 'como conductor' : 'recibidas'}.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {activeData.map(r => {
            const est = r.estacionamiento || {};
            const estadoInfo = ESTADOS[r.estado] || { label: r.estado, color: '#94a3b8' };
            const isLoading = actionLoading?.startsWith(r.id);
            return (
              <div key={r.id} style={{ background: 'rgba(30,41,59,0.6)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.07)', padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <strong style={{ color: '#f8fafc', fontSize: '1rem' }}>{est.nombre || 'Estacionamiento'}</strong>
                    <span style={{ background: `${estadoInfo.color}22`, color: estadoInfo.color, borderRadius: '8px', padding: '2px 10px', fontSize: '0.75rem', fontWeight: 800 }}>
                      {estadoInfo.label}
                    </span>
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {est.comuna && <span><i className="fa-solid fa-location-dot" style={{ width: '14px', color: '#64748b' }}></i> {est.comuna}</span>}
                    <span><i className="fa-solid fa-clock" style={{ width: '14px', color: '#64748b' }}></i> {fmtFecha(r.fecha_inicio)} → {fmtFecha(r.fecha_fin)}</span>
                    {r.precio_total != null && (
                      <span><i className="fa-solid fa-dollar-sign" style={{ width: '14px', color: '#64748b' }}></i> ${Number(r.precio_total).toLocaleString('es-CL')}</span>
                    )}
                    {r.calificacion && (
                      <span style={{ color: '#f59e0b' }}>{'★'.repeat(r.calificacion)}{'☆'.repeat(5 - r.calificacion)}</span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {r.estado !== 'cancelada' && (
                    <button
                      onClick={() => setTicketReserva(r)}
                      style={actionBtn('rgba(148,163,184,0.1)', 'rgba(148,163,184,0.3)', '#cbd5e1')}
                      aria-label="Ver comprobante con código QR"
                    >
                      <i className="fa-solid fa-qrcode"></i> Comprobante
                    </button>
                  )}
                  {tab === 'arrendador' && r.estado === 'pendiente' && (
                    <button
                      onClick={() => doAction('confirmar', r.id)}
                      disabled={isLoading}
                      style={actionBtn('rgba(16,185,129,0.15)', '#10b981', '#10b981')}
                      aria-label="Confirmar reserva"
                    >
                      <i className="fa-solid fa-check"></i> Confirmar
                    </button>
                  )}
                  {tab === 'arrendador' && r.estado === 'confirmada' && (
                    <button
                      onClick={() => doAction('completar', r.id)}
                      disabled={isLoading}
                      style={actionBtn('rgba(59,130,246,0.15)', '#3b82f6', '#3b82f6')}
                      aria-label="Marcar como completada"
                    >
                      <i className="fa-solid fa-flag-checkered"></i> Completar
                    </button>
                  )}
                  {(r.estado === 'pendiente' || r.estado === 'confirmada') && (
                    <button
                      onClick={() => doAction('cancelar', r.id)}
                      disabled={isLoading}
                      style={actionBtn('rgba(239,68,68,0.1)', '#ef4444', '#ef4444')}
                      aria-label="Cancelar reserva"
                    >
                      {isLoading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-ban"></i>} Cancelar
                    </button>
                  )}
                  {tab === 'conductor' && r.estado === 'completada' && !r.calificacion && (
                    <button
                      onClick={() => setRatingModal({ reservaId: r.id })}
                      style={actionBtn('rgba(245,158,11,0.1)', '#f59e0b', '#f59e0b')}
                      aria-label="Calificar reserva"
                    >
                      <i className="fa-solid fa-star"></i> Calificar
                    </button>
                  )}
                  {tab === 'conductor' && r.estado === 'completada' && r.calificacion && (
                    <button
                      onClick={() => setRatingModal({ reservaId: r.id, stars: r.calificacion, comentario: r.comentario || '' })}
                      style={actionBtn('rgba(148,163,184,0.1)', 'rgba(148,163,184,0.3)', '#cbd5e1')}
                      aria-label="Editar reseña"
                    >
                      <i className="fa-solid fa-pen"></i> Editar reseña
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {ratingModal && (
        <ReviewModal
          reservaId={ratingModal.reservaId}
          initialStars={ratingModal.stars || 0}
          initialComentario={ratingModal.comentario || ''}
          onClose={() => setRatingModal(null)}
          onSubmit={handleSubmitReview}
        />
      )}

      {ticketReserva && (
        <ReservaTicket reserva={ticketReserva} onClose={() => setTicketReserva(null)} />
      )}
    </section>
  );
}
