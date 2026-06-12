'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@parkings/supabase-db';
import { toast } from 'react-hot-toast';

const VEH_LABEL = { car: 'Auto', motorcycle: 'Moto', bicycle: 'Bicicleta', scooter: 'Scooter' };

function Estrellas({ n, size = '0.9rem' }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(s => (
        <i key={s} className={`fa-${s <= Math.round(n) ? 'solid' : 'regular'} fa-star`}
           style={{ color: s <= Math.round(n) ? '#fbbf24' : '#334155', fontSize: size }}></i>
      ))}
    </span>
  );
}

export default function EstacionamientoDetalle() {
  const { id } = useParams();
  const router = useRouter();
  const [parking, setParking]   = useState(null);
  const [reviews, setReviews]   = useState([]);
  const [resumen, setResumen]   = useState({ total: 0, promedio: 0, distribucion: {} });
  const [reservasCount, setReservasCount] = useState(0);
  const [userId, setUserId]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [resumenIA, setResumenIA] = useState(null); // { resumen, pros, contras } generado por IA

  const esOwner = parking && userId && parking.user_id === userId;

  const cargar = async () => {
    // 1) Estacionamiento — controla el loading y el estado "no encontrado".
    //    Va AISLADO de las reseñas: un fallo al cargar reseñas jamás debe dejar
    //    el parking en null (esa era la causa de "Estacionamiento no encontrado").
    try {
      const res = await fetch(`/api/mapas/search?id=${id}`);
      const pRes = await res.json();
      if (pRes.success && pRes.data) setParking(pRes.data);
    } catch {
      // Error de red: parking queda null → muestra estado "no encontrado".
    } finally {
      setLoading(false);
    }

    // 2) Reseñas — petición totalmente independiente. Si falla, la ficha del
    //    estacionamiento se muestra igual (solo no aparecen las reseñas).
    try {
      const res = await fetch(`/api/resenas?estacionamiento_id=${id}`);
      const rRes = await res.json();
      if (rRes.success) {
        setReviews(rRes.data || []);
        setResumen(rRes.resumen || { total: 0, promedio: 0, distribucion: {} });
      }
    } catch {
      // Sin reseñas: no es crítico, la ficha sigue visible.
    }

    // 3) Resumen inteligente de reseñas (IA) — independiente y best-effort.
    //    Si no hay suficientes reseñas o la IA no está disponible, devuelve null
    //    y simplemente no se muestra la tarjeta.
    try {
      const res = await fetch(`/api/resenas/resumen?estacionamiento_id=${id}`);
      const data = await res.json();
      if (data.success && data.resumen) setResumenIA(data);
    } catch {
      // Sin resumen IA: no es crítico.
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUserId(session?.user?.id || null));
    cargar();
    // nº de reservas del estacionamiento (señal de popularidad)
    supabase.from('reservas').select('id', { count: 'exact', head: true }).eq('estacionamiento_id', id)
      .then(({ count }) => setReservasCount(count || 0));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const subirFotos = async (files) => {
    if (!esOwner) return;
    setUploading(true);
    const urls = [...(parking.photos || [])];
    for (const file of Array.from(files)) {
      try {
        const path = `${userId}/${id}-${Date.now()}-${file.name}`;
        const { error } = await supabase.storage.from('parking-photos').upload(path, file, { upsert: false });
        if (error) { toast.error(`No se pudo subir ${file.name}`); continue; }
        const { data: { publicUrl } } = supabase.storage.from('parking-photos').getPublicUrl(path);
        urls.push(publicUrl);
      } catch { toast.error('Error al subir imagen'); }
    }
    await guardarFotos(urls);
    setUploading(false);
  };

  const quitarFoto = async (url) => {
    if (!esOwner) return;
    await guardarFotos((parking.photos || []).filter(u => u !== url));
  };

  const guardarFotos = async (photos) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) { toast.error('Sesión expirada. Vuelve a iniciar sesión.'); return; }
    const res = await fetch('/api/mapas/search', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ action: 'updateFull', id: Number(id), photos }),
    });
    const data = await res.json();
    if (data.success) { setParking(p => ({ ...p, photos })); toast.success('Imágenes actualizadas'); }
    else toast.error(data.error || 'No se pudieron guardar las imágenes');
  };

  if (loading) {
    return <div style={{ height: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
      <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2.5rem', color: '#3b82f6' }}></i>
    </div>;
  }
  if (!parking) {
    return <div style={{ textAlign: 'center', padding: '80px 20px', color: '#64748b' }}>
      <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '2.5rem', marginBottom: 16, display: 'block' }}></i>
      <p>Estacionamiento no encontrado.</p>
      <button onClick={() => router.push('/mapa')} className="det-btn">Volver al mapa</button>
    </div>;
  }

  const cupos = (parking.total_spots || 0) - (parking.occupied_spots || 0);
  const fotos = parking.photos || [];
  const maxDist = Math.max(1, ...Object.values(resumen.distribucion || {}));

  return (
    <div className="det-wrap">
      <button className="det-back" onClick={() => router.back()}><i className="fa-solid fa-arrow-left"></i> Volver</button>

      {/* HERO */}
      <header className="det-hero">
        <div className="det-hero-main">
          <div className="det-title-row">
            <h1>{parking.nombre}</h1>
            {esOwner && <span className="det-owner-badge"><i className="fa-solid fa-crown"></i> Tu publicación</span>}
          </div>
          <div className="det-meta">
            {resumen.total > 0 && <span className="det-rating"><Estrellas n={resumen.promedio} /> <strong>{resumen.promedio.toFixed(1)}</strong> ({resumen.total})</span>}
            {parking.comuna && <span><i className="fa-solid fa-location-dot"></i> {parking.comuna}</span>}
            {parking.es_pmr && <span className="det-pmr"><i className="fa-solid fa-wheelchair"></i> Accesible</span>}
          </div>
        </div>
        {!esOwner && (
          <button className="det-btn primary" disabled={cupos <= 0}
            onClick={() => router.push(`/mapa?id=${parking.id}&lat=${parking.lat}&lng=${parking.lng}`)}>
            <i className="fa-solid fa-border-all"></i> {cupos > 0 ? 'Reservar plaza' : 'Sin cupos'}
          </button>
        )}
      </header>

      {/* GALERÍA */}
      <section className="det-gallery">
        {fotos.length === 0 ? (
          <div className="det-gallery-empty">
            <i className="fa-solid fa-images"></i>
            <p>{esOwner ? 'Aún no has subido fotos. ¡Agrega algunas para atraer más reservas!' : 'Sin fotografías disponibles.'}</p>
          </div>
        ) : (
          <div className="det-gallery-grid">
            {fotos.map((url, i) => (
              <div key={i} className="det-photo" onClick={() => setLightbox(url)}>
                <img src={url} alt={`Foto ${i + 1}`} loading={i < 3 ? 'eager' : 'lazy'} onError={e => { e.target.closest('.det-photo').style.display = 'none'; }} />
                {esOwner && (
                  <button className="det-photo-del" onClick={e => { e.stopPropagation(); quitarFoto(url); }} aria-label="Quitar foto">
                    <i className="fa-solid fa-trash"></i>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {esOwner && (
          <label className="det-upload">
            {uploading ? <><i className="fa-solid fa-spinner fa-spin"></i> Subiendo...</> : <><i className="fa-solid fa-camera"></i> Agregar fotos</>}
            <input type="file" accept="image/*" multiple style={{ display: 'none' }} disabled={uploading}
              onChange={e => e.target.files?.length && subirFotos(e.target.files)} />
          </label>
        )}
      </section>

      <div className="det-grid">
        {/* INFO */}
        <div>
          {parking.descripcion && (
            <section className="det-card">
              <h3><i className="fa-solid fa-circle-info"></i> Acerca de este lugar</h3>
              <p className="det-desc">{parking.descripcion}</p>
            </section>
          )}

          <section className="det-card">
            <h3><i className="fa-solid fa-list-check"></i> Detalles</h3>
            <div className="det-facts">
              <div className="det-fact"><span>Precio/hora</span><strong>{parking.precio_hora ? `$${Number(parking.precio_hora).toLocaleString('es-CL')}` : 'Gratis'}</strong></div>
              <div className="det-fact"><span>Cupos</span><strong>{cupos} / {parking.total_spots}</strong></div>
              <div className="det-fact"><span>Arrendador</span><strong>{parking.arrendador || '—'}</strong></div>
              <div className="det-fact"><span>Vehículos</span><strong>{(parking.allowed_vehicle_types || ['car']).map(v => VEH_LABEL[v] || v).join(', ')}</strong></div>
            </div>
          </section>

          {/* RESEÑAS */}
          <section className="det-card">
            <h3><i className="fa-solid fa-comments"></i> Reseñas {resumen.total > 0 && <span className="det-count">{resumen.total}</span>}</h3>

            {/* Resumen inteligente generado por IA a partir de las reseñas verificadas */}
            {resumenIA?.resumen && (
              <div className="det-ai-summary">
                <div className="det-ai-head">
                  <i className="fa-solid fa-wand-magic-sparkles"></i>
                  <strong>Resumen inteligente</strong>
                  <span className="det-ai-tag">IA · {resumenIA.total} reseñas</span>
                </div>
                <p className="det-ai-text">{resumenIA.resumen}</p>
                {(resumenIA.pros?.length > 0 || resumenIA.contras?.length > 0) && (
                  <div className="det-ai-pc">
                    {resumenIA.pros?.length > 0 && (
                      <div className="det-ai-col">
                        <span className="det-ai-col-h pro"><i className="fa-solid fa-thumbs-up"></i> A favor</span>
                        {resumenIA.pros.map((p, i) => <span key={i} className="det-ai-chip pro">{p}</span>)}
                      </div>
                    )}
                    {resumenIA.contras?.length > 0 && (
                      <div className="det-ai-col">
                        <span className="det-ai-col-h con"><i className="fa-solid fa-triangle-exclamation"></i> A considerar</span>
                        {resumenIA.contras.map((c, i) => <span key={i} className="det-ai-chip con">{c}</span>)}
                      </div>
                    )}
                  </div>
                )}
                <span className="det-ai-foot">Generado por IA a partir de reseñas verificadas. Puede contener imprecisiones.</span>
              </div>
            )}

            {resumen.total > 0 && (
              <div className="det-rating-summary">
                <div className="det-rating-big">
                  <strong>{resumen.promedio.toFixed(1)}</strong>
                  <Estrellas n={resumen.promedio} size="1rem" />
                  <span>{resumen.total} {resumen.total === 1 ? 'reseña' : 'reseñas'}</span>
                </div>
                <div className="det-rating-bars">
                  {[5, 4, 3, 2, 1].map(n => (
                    <div key={n} className="det-bar-row">
                      <span>{n}★</span>
                      <div className="det-bar"><div style={{ width: `${((resumen.distribucion?.[n] || 0) / maxDist) * 100}%` }}></div></div>
                      <span className="det-bar-n">{resumen.distribucion?.[n] || 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {reviews.length === 0 ? (
              <div className="det-empty">
                <i className="fa-regular fa-comment-dots"></i>
                <p>Aún no hay reseñas.</p>
                <span>Las reseñas las dejan los conductores que completaron una reserva aquí.</span>
              </div>
            ) : (
              <div className="det-reviews">
                {reviews.map(r => {
                  const nombre = r.perfil?.nombre ? `${r.perfil.nombre.split(' ')[0]}${r.perfil.apellido ? ' ' + r.perfil.apellido[0] + '.' : ''}` : 'Usuario';
                  const fecha = new Date(r.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
                  return (
                    <article key={r.id} className="det-review">
                      <div className="det-rev-head">
                        {r.perfil?.avatar_url
                          ? <img src={r.perfil.avatar_url} className="det-rev-av" alt="" onError={e => { e.target.style.display = 'none'; }} />
                          : <div className="det-rev-av ph">{nombre[0].toUpperCase()}</div>}
                        <div className="det-rev-meta">
                          <strong>{nombre}</strong>
                          {/* Toda reseña proviene de una reserva COMPLETADA (lo exige la RPC
                              calificar_reserva), así que es una visita verificada de verdad. */}
                          <span className="det-rev-verified" title="Esta reseña la dejó un conductor que completó una reserva aquí">
                            <i className="fa-solid fa-circle-check"></i> Visita verificada · {fecha}
                          </span>
                        </div>
                        <Estrellas n={r.calificacion} size="0.8rem" />
                      </div>
                      {r.comentario && <p className="det-rev-text">{r.comentario}</p>}
                      {r.review_photo_url && (
                        <img src={r.review_photo_url} className="det-rev-photo" alt="Foto de reseña" loading="lazy"
                          onClick={() => setLightbox(r.review_photo_url)}
                          onError={e => { e.target.style.display = 'none'; }} />
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* SIDEBAR STATS */}
        <aside className="det-side">
          <div className="det-card det-stats">
            <h3><i className="fa-solid fa-chart-simple"></i> Estadísticas</h3>
            <div className="det-stat"><i className="fa-solid fa-calendar-check" style={{ color: '#3b82f6' }}></i><div><strong>{reservasCount}</strong><span>Reservas totales</span></div></div>
            <div className="det-stat"><i className="fa-solid fa-star" style={{ color: '#fbbf24' }}></i><div><strong>{resumen.total ? resumen.promedio.toFixed(1) : '—'}</strong><span>Calificación</span></div></div>
            <div className="det-stat"><i className="fa-solid fa-comments" style={{ color: '#10b981' }}></i><div><strong>{resumen.total}</strong><span>Reseñas</span></div></div>
            <div className="det-stat"><i className="fa-solid fa-square-parking" style={{ color: '#a855f7' }}></i><div><strong>{cupos}/{parking.total_spots}</strong><span>Disponibles</span></div></div>
          </div>
          {esOwner && (
            <div className="det-card">
              <h3><i className="fa-solid fa-screwdriver-wrench"></i> Gestión</h3>
              <button className="det-btn full" onClick={() => router.push('/dashboard')}><i className="fa-solid fa-pen-to-square"></i> Editar datos</button>
              <p className="det-tip">Sube fotos arriba ☝️ y edita precio, cupos y descripción desde tu Panel.</p>
            </div>
          )}
        </aside>
      </div>

      {/* MOBILE STICKY CTA */}
      {!esOwner && (
        <div className="det-sticky-cta">
          <div className="det-sticky-price">
            {parking.precio_hora === 0 ? 'Gratis' : <><strong>${Number(parking.precio_hora).toLocaleString('es-CL')}</strong>/hr</>}
          </div>
          <button
            className="det-btn primary"
            disabled={cupos <= 0}
            onClick={() => router.push(`/mapa?id=${parking.id}&lat=${parking.lat}&lng=${parking.lng}`)}
            style={{ flex: 1, maxWidth: 220 }}
          >
            <i className="fa-solid fa-border-all"></i> {cupos > 0 ? 'Reservar plaza' : 'Sin cupos'}
          </button>
        </div>
      )}

      {/* LIGHTBOX */}
      {lightbox && (
        <div className="det-lb" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" onClick={e => e.stopPropagation()} />
          <button className="det-lb-close" onClick={() => setLightbox(null)}><i className="fa-solid fa-xmark"></i></button>
        </div>
      )}

      <style jsx>{`
        .det-wrap { max-width: 1000px; margin: 0 auto; padding: 24px 18px 80px; color: #e2e8f0; }
        .det-back { background: none; border: none; color: #94a3b8; font-weight: 700; cursor: pointer; font-size: 0.88rem; margin-bottom: 18px; padding: 0; }
        .det-back:hover { color: white; }

        .det-hero { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 22px; }
        .det-title-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .det-hero h1 { font-size: 1.9rem; font-weight: 900; color: white; margin: 0; letter-spacing: -0.5px; }
        .det-owner-badge { background: rgba(245,158,11,0.13); color: #fbbf24; border: 1px solid rgba(245,158,11,0.3); padding: 4px 12px; border-radius: 99px; font-size: 0.72rem; font-weight: 800; }
        .det-meta { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; margin-top: 10px; color: #94a3b8; font-size: 0.85rem; }
        .det-meta i { margin-right: 4px; }
        .det-rating { display: inline-flex; align-items: center; gap: 6px; }
        .det-rating strong { color: white; }
        .det-pmr { color: #38bdf8; }

        .det-btn { background: rgba(59,130,246,0.12); border: 1px solid rgba(59,130,246,0.3); color: #60a5fa; padding: 10px 18px; border-radius: 12px; font-weight: 800; cursor: pointer; font-size: 0.88rem; }
        .det-btn:hover { background: rgba(59,130,246,0.2); }
        .det-btn.primary { background: linear-gradient(135deg,#2563eb,#1d4ed8); color: white; border: none; }
        .det-btn.primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .det-btn.full { width: 100%; margin-bottom: 10px; }

        .det-gallery { margin-bottom: 24px; }
        .det-gallery-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; }
        .det-photo { position: relative; aspect-ratio: 4/3; border-radius: 14px; overflow: hidden; cursor: pointer; border: 1px solid rgba(255,255,255,0.08); }
        .det-photo img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s; }
        .det-photo:hover img { transform: scale(1.06); }
        .det-photo-del { position: absolute; top: 8px; right: 8px; width: 32px; height: 32px; border-radius: 9px; background: rgba(2,6,23,0.8); border: 1px solid rgba(239,68,68,0.4); color: #f87171; cursor: pointer; }
        .det-gallery-empty { text-align: center; padding: 40px 20px; color: #475569; background: rgba(15,23,42,0.5); border: 1px dashed rgba(255,255,255,0.1); border-radius: 16px; }
        .det-gallery-empty i { font-size: 2rem; display: block; margin-bottom: 10px; opacity: 0.5; }
        .det-gallery-empty p { margin: 0; font-size: 0.85rem; }
        .det-upload { display: inline-flex; align-items: center; gap: 8px; margin-top: 12px; padding: 10px 18px; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); border-radius: 12px; color: #34d399; font-weight: 700; font-size: 0.85rem; cursor: pointer; }
        .det-upload:hover { background: rgba(16,185,129,0.18); }

        .det-grid { display: grid; grid-template-columns: 1fr 300px; gap: 18px; align-items: start; }
        .det-card { background: rgba(15,23,42,0.55); border: 1px solid rgba(255,255,255,0.07); border-radius: 18px; padding: 20px; margin-bottom: 16px; }
        .det-card h3 { display: flex; align-items: center; gap: 10px; font-size: 1rem; font-weight: 800; color: white; margin: 0 0 16px; }
        .det-card h3 i { color: #60a5fa; }
        .det-count { background: rgba(59,130,246,0.2); color: #60a5fa; font-size: 0.72rem; padding: 2px 9px; border-radius: 99px; }
        .det-desc { color: #94a3b8; line-height: 1.7; font-size: 0.9rem; margin: 0; white-space: pre-wrap; }

        .det-facts { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .det-fact { display: flex; flex-direction: column; gap: 3px; }
        .det-fact span { font-size: 0.72rem; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        .det-fact strong { color: white; font-size: 0.95rem; }

        .det-rating-summary { display: flex; gap: 24px; align-items: center; padding-bottom: 18px; margin-bottom: 18px; border-bottom: 1px solid rgba(255,255,255,0.06); flex-wrap: wrap; }
        .det-rating-big { text-align: center; }
        .det-rating-big strong { display: block; font-size: 2.6rem; font-weight: 900; color: white; line-height: 1; }
        .det-rating-big span { display: block; font-size: 0.72rem; color: #64748b; margin-top: 4px; }
        .det-rating-bars { flex: 1; min-width: 180px; }
        .det-bar-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
        .det-bar-row > span { font-size: 0.72rem; color: #94a3b8; width: 22px; }
        .det-bar { flex: 1; height: 7px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden; }
        .det-bar div { height: 100%; background: linear-gradient(90deg,#fbbf24,#f59e0b); border-radius: 4px; }
        .det-bar-n { color: #64748b; font-size: 0.72rem; width: 18px; text-align: right; }

        .det-reviews { display: flex; flex-direction: column; gap: 16px; }
        .det-review { border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 16px; }
        .det-review:last-child { border-bottom: none; padding-bottom: 0; }
        .det-rev-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
        .det-rev-av { width: 38px; height: 38px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
        .det-rev-av.ph { background: linear-gradient(135deg,#2563eb,#10b981); color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; }
        .det-rev-meta { flex: 1; }
        .det-rev-meta strong { display: block; color: white; font-size: 0.9rem; }
        .det-rev-meta span { font-size: 0.74rem; color: #64748b; }
        .det-rev-verified { display: inline-flex; align-items: center; gap: 5px; color: #34d399 !important; font-weight: 600; }
        .det-rev-verified i { color: #34d399; font-size: 0.78rem; }

        /* Resumen inteligente (IA) */
        .det-ai-summary { background: linear-gradient(135deg, rgba(168,85,247,0.10), rgba(59,130,246,0.08)); border: 1px solid rgba(168,85,247,0.22); border-radius: 14px; padding: 14px 16px; margin-bottom: 18px; }
        .det-ai-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .det-ai-head i { color: #c084fc; }
        .det-ai-head strong { color: #f8fafc; font-size: 0.95rem; }
        .det-ai-tag { margin-left: auto; font-size: 0.68rem; font-weight: 700; color: #c084fc; background: rgba(168,85,247,0.15); padding: 3px 9px; border-radius: 99px; }
        .det-ai-text { color: #cbd5e1; line-height: 1.6; font-size: 0.88rem; margin: 0 0 10px; }
        .det-ai-pc { display: flex; gap: 18px; flex-wrap: wrap; margin-bottom: 8px; }
        .det-ai-col { display: flex; flex-direction: column; gap: 5px; flex: 1; min-width: 140px; }
        .det-ai-col-h { font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.4px; display: inline-flex; align-items: center; gap: 5px; }
        .det-ai-col-h.pro { color: #34d399; }
        .det-ai-col-h.con { color: #fbbf24; }
        .det-ai-chip { font-size: 0.8rem; color: #e2e8f0; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 4px 9px; }
        .det-ai-chip.pro { border-left: 2px solid #34d399; }
        .det-ai-chip.con { border-left: 2px solid #fbbf24; }
        .det-ai-foot { font-size: 0.68rem; color: #64748b; }
        .det-rev-text { color: #cbd5e1; line-height: 1.6; font-size: 0.88rem; margin: 0 0 10px; }
        .det-rev-photo { max-width: 220px; width: 100%; border-radius: 12px; cursor: pointer; border: 1px solid rgba(255,255,255,0.08); }

        .det-empty { text-align: center; padding: 30px 16px; color: #475569; }
        .det-empty i { font-size: 1.8rem; display: block; margin-bottom: 10px; opacity: 0.5; }
        .det-empty p { margin: 0 0 6px; color: #94a3b8; font-weight: 600; }
        .det-empty span { font-size: 0.78rem; }

        .det-stats .det-stat { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
        .det-stats .det-stat:last-child { border-bottom: none; }
        .det-stat i { font-size: 1.1rem; width: 24px; text-align: center; }
        .det-stat strong { display: block; color: white; font-size: 1.1rem; line-height: 1; }
        .det-stat span { font-size: 0.72rem; color: #64748b; }
        .det-tip { font-size: 0.76rem; color: #64748b; line-height: 1.5; margin: 4px 0 0; }

        .det-lb { position: fixed; inset: 0; z-index: 6000; background: rgba(2,6,23,0.92); display: flex; align-items: center; justify-content: center; padding: 40px; cursor: zoom-out; }
        .det-lb img { max-width: 92vw; max-height: 85vh; object-fit: contain; border-radius: 14px; }
        .det-lb-close { position: absolute; top: 24px; right: 28px; width: 44px; height: 44px; border-radius: 50%; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15); color: white; font-size: 1.2rem; cursor: pointer; }

        /* Mobile sticky reservation bar */
        .det-sticky-cta {
          display: none;
          position: fixed;
          bottom: 0;
          left: 0; right: 0;
          z-index: 2000;
          background: rgba(15,23,42,0.95);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-top: 1px solid rgba(255,255,255,0.08);
          padding: 12px 20px;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .det-sticky-price { color: #94a3b8; font-size: 0.85rem; }
        .det-sticky-price strong { color: #fbbf24; font-size: 1.1rem; font-weight: 800; }

        @media (max-width: 820px) {
          .det-grid { grid-template-columns: 1fr; }
          .det-side { order: -1; } /* stats sidebar above on mobile */
          .det-facts { grid-template-columns: 1fr 1fr; }
          .det-hero { flex-direction: column; }
          .det-hero > .det-btn { display: none; } /* hide hero CTA; sticky bar replaces it */
          .det-sticky-cta { display: flex; }
          .det-wrap { padding-bottom: 90px; } /* space for sticky bar */
        }
        @media (max-width: 500px) {
          .det-gallery-grid { grid-template-columns: repeat(auto-fill, minmax(130px,1fr)); }
          .det-hero h1 { font-size: 1.5rem; }
        }
      `}</style>
    </div>
  );
}
