'use client';

// Chat conductor ↔ arrendador en tiempo real.
//   - Columna izquierda: lista de conversaciones (con no-leídos y último mensaje).
//   - Columna derecha: hilo de la conversación activa + caja para escribir.
//   - Realtime: los mensajes nuevos llegan al instante (Supabase Realtime / RLS).
//   - ?c=<id> abre directamente una conversación (lo usa el botón "Contactar").

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@parkings/supabase-db';
import { api } from '../../src/lib/api';

const fmtHora = (ts) =>
  ts ? new Date(ts).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : '';

const fmtFecha = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  const hoy = new Date();
  const ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
  if (d.toDateString() === hoy.toDateString()) return fmtHora(ts);
  if (d.toDateString() === ayer.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
};

function Mensajeria() {
  const router = useRouter();
  const params = useSearchParams();

  const [me, setMe] = useState(null);            // user id
  const [authChecked, setAuthChecked] = useState(false);
  const [convs, setConvs] = useState([]);
  const [activeId, setActiveId] = useState(params.get('c') || null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const endRef = useRef(null);
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  // ── Responsive ──
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 760);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Sesión ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setMe(session?.user?.id || null);
      setAuthChecked(true);
    });
  }, []);

  const cargarConvs = useCallback(async () => {
    const res = await api.chat.conversaciones();
    if (res.success) setConvs(res.data || []);
  }, []);

  // ── Carga inicial de conversaciones ──
  useEffect(() => {
    if (me) cargarConvs();
  }, [me, cargarConvs]);

  // ── Cargar mensajes de la conversación activa ──
  const cargarMensajes = useCallback(async (cid) => {
    if (!cid) { setMessages([]); return; }
    setLoadingMsgs(true);
    const res = await api.chat.mensajes(cid);
    setLoadingMsgs(false);
    if (res.success) {
      setMessages(res.data || []);
      if (res.me) setMe(res.me);
      // El GET ya marcó leído en el servidor → refrescamos la lista para limpiar el badge.
      cargarConvs();
    }
  }, [cargarConvs]);

  useEffect(() => {
    cargarMensajes(activeId);
  }, [activeId, cargarMensajes]);

  // ── Realtime: nuevos mensajes ──
  useEffect(() => {
    if (!me) return;
    const channel = supabase
      .channel('chat-mensajes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, (payload) => {
        const msg = payload.new;
        if (!msg) return;
        if (msg.conversacion_id === activeIdRef.current) {
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
          // Si llega de la otra persona y estoy mirando el hilo, marcar leído.
          if (msg.sender_id !== me) {
            api.chat.mensajes(activeIdRef.current).catch(() => {});
          }
        }
        cargarConvs();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [me, cargarConvs]);

  // ── Auto-scroll al fondo ──
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const enviar = async (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || !activeId || sending) return;
    setSending(true);
    setInput('');
    const res = await api.chat.enviar(activeId, text);
    setSending(false);
    if (res.success && res.data) {
      setMessages((prev) => (prev.some((m) => m.id === res.data.id) ? prev : [...prev, res.data]));
      cargarConvs();
    } else {
      setInput(text); // restaura si falló
    }
  };

  const activa = convs.find((c) => c.id === activeId);

  // ── Estados de carga / no autenticado ──
  if (!authChecked) {
    return <main style={{ minHeight: '60vh' }} />;
  }
  if (!me) {
    return (
      <main style={S.center}>
        <div style={S.card}>
          <div style={{ fontSize: '2.5rem', color: '#3b82f6', marginBottom: 12 }}>
            <i className="fa-solid fa-comments" />
          </div>
          <h1 style={{ color: '#fff', fontSize: '1.4rem', fontWeight: 900, margin: '0 0 8px' }}>Tus mensajes</h1>
          <p style={{ color: '#94a3b8', margin: '0 0 20px' }}>Inicia sesión para chatear con arrendadores y conductores.</p>
          <button onClick={() => router.push('/auth')} style={S.btnPrimary}>Iniciar sesión</button>
        </div>
      </main>
    );
  }

  const showList = !isMobile || !activeId;
  const showThread = !isMobile || !!activeId;

  return (
    <main style={S.wrap}>
      <div style={S.shell}>
        {/* ── Lista de conversaciones ── */}
        {showList && (
          <aside style={{ ...S.list, ...(isMobile ? { width: '100%', borderRight: 'none' } : {}) }}>
            <div style={S.listHeader}>
              <i className="fa-solid fa-comments" style={{ color: '#3b82f6' }} />
              <span>Mensajes</span>
            </div>
            {convs.length === 0 ? (
              <div style={S.empty}>
                <i className="fa-regular fa-comment-dots" style={{ fontSize: '2rem', opacity: 0.5 }} />
                <p style={{ marginTop: 10 }}>Aún no tienes conversaciones.</p>
                <p style={{ fontSize: '0.82rem', color: '#64748b' }}>
                  Entra a un estacionamiento en el mapa y toca <b>Contactar</b> para escribirle al arrendador.
                </p>
                <button onClick={() => router.push('/mapa')} style={{ ...S.btnGhost, marginTop: 14 }}>Ir al mapa</button>
              </div>
            ) : (
              convs.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  style={{ ...S.convItem, ...(c.id === activeId ? S.convItemActive : {}) }}
                >
                  <div style={S.avatar}>{(c.otro_nombre || '?').charAt(0).toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={S.convTop}>
                      <span style={S.convName}>{c.otro_nombre || 'Usuario'}</span>
                      <span style={S.convTime}>{fmtFecha(c.last_message_at)}</span>
                    </div>
                    <div style={S.convBottom}>
                      <span style={S.convPreview}>{c.last_message || `Sobre ${c.estacionamiento_nombre || 'un estacionamiento'}`}</span>
                      {c.unread > 0 && <span style={S.badge}>{c.unread}</span>}
                    </div>
                    <div style={S.convSub}>
                      <i className="fa-solid fa-square-parking" style={{ fontSize: '0.7rem' }} /> {c.estacionamiento_nombre || '—'}
                      <span style={S.rolePill}>{c.soy === 'arrendador' ? 'Eres arrendador' : 'Eres conductor'}</span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </aside>
        )}

        {/* ── Hilo ── */}
        {showThread && (
          <section style={S.thread}>
            {!activeId ? (
              <div style={S.threadEmpty}>
                <i className="fa-regular fa-comments" style={{ fontSize: '3rem', opacity: 0.3 }} />
                <p style={{ marginTop: 12 }}>Selecciona una conversación para empezar a chatear.</p>
              </div>
            ) : (
              <>
                <div style={S.threadHeader}>
                  {isMobile && (
                    <button onClick={() => setActiveId(null)} style={S.backBtn} aria-label="Volver">
                      <i className="fa-solid fa-arrow-left" />
                    </button>
                  )}
                  <div style={S.avatar}>{(activa?.otro_nombre || '?').charAt(0).toUpperCase()}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: '#fff', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {activa?.otro_nombre || 'Usuario'}
                    </div>
                    {activa?.estacionamiento_id ? (
                      <button onClick={() => router.push(`/mapa?id=${activa.estacionamiento_id}`)} style={S.parkLink}>
                        <i className="fa-solid fa-square-parking" /> {activa?.estacionamiento_nombre || 'Ver estacionamiento'}
                      </button>
                    ) : (
                      <div style={{ color: '#64748b', fontSize: '0.78rem' }}>{activa?.estacionamiento_nombre || ''}</div>
                    )}
                  </div>
                </div>

                <div style={S.msgArea}>
                  {loadingMsgs && messages.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#64748b', marginTop: 30 }}>Cargando…</div>
                  ) : messages.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#64748b', marginTop: 30 }}>
                      Escribe el primer mensaje 👋
                    </div>
                  ) : (
                    messages.map((m) => {
                      const mio = m.sender_id === me;
                      return (
                        <div key={m.id} style={{ display: 'flex', justifyContent: mio ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                          <div style={{ ...S.bubble, ...(mio ? S.bubbleMe : S.bubbleOther) }}>
                            <span>{m.body}</span>
                            <span style={S.bubbleTime}>{fmtHora(m.created_at)}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={endRef} />
                </div>

                <form onSubmit={enviar} style={S.composer}>
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Escribe un mensaje…"
                    maxLength={2000}
                    style={S.composerInput}
                  />
                  <button type="submit" disabled={!input.trim() || sending} style={{ ...S.sendBtn, opacity: !input.trim() || sending ? 0.5 : 1 }}>
                    <i className="fa-solid fa-paper-plane" />
                  </button>
                </form>
              </>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

const S = {
  wrap: { padding: '12px 4% 24px', minHeight: '70vh' },
  shell: {
    maxWidth: 1100, margin: '0 auto', display: 'flex',
    height: 'calc(100vh - 160px)', minHeight: 460,
    background: 'rgba(15,23,42,0.55)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 20, overflow: 'hidden',
  },
  list: { width: 330, borderRight: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', overflowY: 'auto' },
  listHeader: { display: 'flex', alignItems: 'center', gap: 10, padding: '16px 18px', color: '#fff', fontWeight: 900, fontSize: '1.1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', position: 'sticky', top: 0, background: 'rgba(15,23,42,0.9)', backdropFilter: 'blur(6px)', zIndex: 1 },
  empty: { padding: '36px 22px', textAlign: 'center', color: '#94a3b8' },
  convItem: { display: 'flex', gap: 12, alignItems: 'flex-start', width: '100%', textAlign: 'left', padding: '14px 16px', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', color: '#e2e8f0' },
  convItemActive: { background: 'rgba(59,130,246,0.12)' },
  avatar: { width: 42, height: 42, flexShrink: 0, borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.05rem' },
  convTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  convName: { fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  convTime: { fontSize: '0.7rem', color: '#64748b', flexShrink: 0 },
  convBottom: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 2 },
  convPreview: { fontSize: '0.85rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 },
  badge: { background: '#ef4444', color: '#fff', borderRadius: 10, fontSize: '0.7rem', fontWeight: 900, padding: '1px 7px', flexShrink: 0 },
  convSub: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: '0.72rem', color: '#64748b' },
  rolePill: { marginLeft: 'auto', background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: '1px 6px', fontSize: '0.66rem', whiteSpace: 'nowrap' },
  thread: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  threadEmpty: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b', padding: 30, textAlign: 'center' },
  threadHeader: { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(15,23,42,0.6)' },
  backBtn: { background: 'rgba(255,255,255,0.06)', border: 'none', color: '#e2e8f0', width: 36, height: 36, borderRadius: 10, cursor: 'pointer', flexShrink: 0 },
  parkLink: { background: 'transparent', border: 'none', color: '#60a5fa', fontSize: '0.78rem', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 5 },
  msgArea: { flex: 1, overflowY: 'auto', padding: '18px 18px 8px' },
  bubble: { maxWidth: '75%', padding: '9px 13px', borderRadius: 16, fontSize: '0.92rem', lineHeight: 1.4, position: 'relative', wordBreak: 'break-word', display: 'flex', flexDirection: 'column', gap: 2 },
  bubbleMe: { background: 'linear-gradient(135deg,#2563eb,#3b82f6)', color: '#fff', borderBottomRightRadius: 4 },
  bubbleOther: { background: 'rgba(255,255,255,0.08)', color: '#e2e8f0', borderBottomLeftRadius: 4 },
  bubbleTime: { fontSize: '0.62rem', opacity: 0.7, alignSelf: 'flex-end' },
  composer: { display: 'flex', gap: 10, padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.08)' },
  composerInput: { flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '12px 16px', color: '#fff', fontSize: '0.95rem', outline: 'none' },
  sendBtn: { background: 'linear-gradient(135deg,#2563eb,#3b82f6)', color: '#fff', border: 'none', borderRadius: 12, width: 48, cursor: 'pointer', fontSize: '1rem' },
  center: { minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { maxWidth: 420, width: '100%', textAlign: 'center', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: '40px 28px' },
  btnPrimary: { background: 'linear-gradient(135deg,#2563eb,#3b82f6)', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 24px', fontWeight: 700, cursor: 'pointer' },
  btnGhost: { background: 'rgba(255,255,255,0.06)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 18px', fontWeight: 700, cursor: 'pointer' },
};

export default function MensajesPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '70vh' }} />}>
      <Mensajeria />
    </Suspense>
  );
}
