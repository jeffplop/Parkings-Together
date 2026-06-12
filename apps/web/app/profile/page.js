'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@parkings/supabase-db';
import { toast } from 'react-hot-toast';
import { api } from '../../src/lib/api';
import ReviewModal from '../../src/components/ReviewModal';

export default function ProfilePage() {
  const searchParams = useSearchParams();
  const [session, setSession] = useState(null);
  const [perfil, setPerfil] = useState({ nombre: '', telefono: '', requiere_pmr: false, avatar_url: '' });
  const [vehiculos, setVehiculos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [activeTab, setActiveTab] = useState(searchParams?.get('tab') || 'personales'); // personales, vehiculos, pmr
  
  const [nuevoVehiculo, setNuevoVehiculo] = useState({ patente: '', marca: '', modelo: '', color: '' });

  const [reservas, setReservas] = useState([]);
  const [loadingReservas, setLoadingReservas] = useState(false);
  const [favoritos, setFavoritos] = useState([]);
  const [loadingFavs, setLoadingFavs] = useState(false);

  const router = useRouter();

  const cargarReservas = async () => {
    setLoadingReservas(true);
    const res = await api.reservas.listar('conductor');
    if (res.success) setReservas(res.data || []);
    setLoadingReservas(false);
  };

  useEffect(() => {
    if (activeTab === 'reservas') cargarReservas();
    if (activeTab === 'favoritos') {
      setLoadingFavs(true);
      api.favoritos.listar().then(res => {
        if (res.success) setFavoritos(res.data || []);
        setLoadingFavs(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleQuitarFavorito = async (estacionamientoId) => {
    await api.favoritos.quitar(estacionamientoId);
    setFavoritos(prev => prev.filter(f => (f.estacionamiento?.id ?? f.estacionamiento_id) !== estacionamientoId));
    toast.success('Eliminado de favoritos');
  };

  const handleCancelarReserva = async (id) => {
    const res = await api.reservas.cancelar(id);
    if (res.success) { toast.success('Reserva cancelada'); cargarReservas(); }
    else toast.error(res.error || 'No se pudo cancelar');
  };

  const [reviewModal, setReviewModal] = useState(null); // { reservaId }

  const handleSubmitReview = async ({ reservaId, stars, comentario, photoUrl }) => {
    const res = await api.reservas.calificar(reservaId, stars, comentario, photoUrl);
    if (!res.success) throw new Error(res.error || 'No se pudo calificar');
    cargarReservas();
  };

  const fmtFecha = (f) => f ? new Date(f).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/auth?redirectTo=/profile');
      } else {
        setSession(session);
        fetchPerfilData(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.push('/auth?redirectTo=/profile');
      else setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const fetchPerfilData = async (userId) => {
    try {
      const { data: perfilData, error: perfilError } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
        
      if (perfilError && perfilError.code !== 'PGRST116') throw perfilError;
      if (perfilData) setPerfil(perfilData);

      try {
        const { data: vehiculosData, error: vehiculosError } = await supabase
          .from('vehiculos')
          .select('*')
          .eq('user_id', userId);
          
        if (vehiculosError) throw vehiculosError;
        if (vehiculosData) setVehiculos(vehiculosData);
      } catch (vehiculosErr) {
        if (process.env.NODE_ENV === 'development') console.error('Error cargando vehículos (puede no existir la tabla):', vehiculosErr);
        setVehiculos([]);
      }

    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error(error);
      toast.error('Error al cargar datos del perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePerfil = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase.from('perfiles').upsert({
        id: session.user.id,
        ...perfil
      });
      if (error) throw error;
      toast.success('Perfil actualizado correctamente');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddVehiculo = async (e) => {
    e.preventDefault();
    if (!nuevoVehiculo.patente || !nuevoVehiculo.marca || !nuevoVehiculo.modelo || !nuevoVehiculo.color) {
      toast.error('Completa todos los campos del vehículo');
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.from('vehiculos').insert([{
        user_id: session.user.id,
        ...nuevoVehiculo
      }]).select();
      
      if (error) throw error;
      
      setVehiculos([...vehiculos, data[0]]);
      setNuevoVehiculo({ patente: '', marca: '', modelo: '', color: '' });
      toast.success('Vehículo agregado a la red');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };
  
  const handleRemoveVehiculo = async (id) => {
    try {
      const { error } = await supabase.from('vehiculos').delete().eq('id', id);
      if (error) throw error;
      setVehiculos(prev => prev.filter(v => v.id !== id));
      toast.success('Vehículo removido');
    } catch (error) {
      toast.error('Error al remover vehículo');
    }
  };

  const handleTogglePMR = async () => {
    const newValue = !perfil.requiere_pmr;
    setPerfil(prev => ({ ...prev, requiere_pmr: newValue }));
    try {
      const { error } = await supabase.from('perfiles').upsert({
        id: session.user.id,
        requiere_pmr: newValue
      });
      if (error) throw error;
      toast.success(newValue ? 'Mostrando solo estacionamientos accesibles' : 'Mostrando todos los estacionamientos');
    } catch (error) {
      setPerfil(prev => ({ ...prev, requiere_pmr: !newValue }));
      toast.error('Error al actualizar preferencias');
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${session.user.id}/avatar.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const avatarUrl = `${publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase.from('perfiles').upsert({ id: session.user.id, avatar_url: avatarUrl });
      if (updateError) throw updateError;
      setPerfil(prev => ({ ...prev, avatar_url: avatarUrl }));
      toast.success('Avatar actualizado');
    } catch (error) {
      toast.error(error.message || 'Error al subir avatar');
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!nuevoEmail || nuevoEmail === session?.user?.email) return;
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: nuevoEmail });
      if (error) throw error;
      toast.success('Se envió un correo de confirmación al nuevo email');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth');
  };

  if (loading) return (
    <div className="loader-screen">
      <i className="fa-solid fa-satellite fa-spin"></i>
      <p>Cargando Perfil...</p>
      <style jsx>{`
        .loader-screen { min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; color: #3b82f6; font-size: 2rem; gap: 15px; background: #020617; }
        .loader-screen p { font-size: 1rem; font-weight: 800; letter-spacing: 2px; }
      `}</style>
    </div>
  );

  return (
    <div className="profile-wrapper">
      {reviewModal && <ReviewModal reservaId={reviewModal.reservaId} onClose={() => setReviewModal(null)} onSubmit={handleSubmitReview} />}
      <div className="cyber-grid-bg"></div>

      <div className="profile-container">
        
        {/* Sidebar / User Info */}
        <div className="profile-sidebar">
          <div className="avatar-ring" onClick={() => document.getElementById('avatar-input').click()} style={{cursor:'pointer'}} title="Cambiar foto de perfil">
            {uploading ? (
               <i className="fa-solid fa-spinner fa-spin"></i>
            ) : perfil.avatar_url ? (
               <img src={perfil.avatar_url} alt="Avatar" className="avatar-img" />
            ) : (
               <i className="fa-solid fa-user-astronaut"></i>
            )}
            <div className="avatar-overlay"><i className="fa-solid fa-camera"></i></div>
            <input id="avatar-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAvatarUpload} style={{display:'none'}} />
          </div>
          <h1>{perfil.nombre || 'Usuario Registrado'}</h1>
          <p className="email-tag">{session?.user?.email}</p>
          <div className="status-badge">
             <span className="dot pulse-green"></span> CUENTA ACTIVA
          </div>
          
          {/* Rol del usuario */}
          <div className="role-badge" style={{
            padding: '8px 16px',
            borderRadius: '12px',
            border: `1px solid ${perfil.rol === 'arrendador' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
            background: perfil.rol === 'arrendador' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(59, 130, 246, 0.1)',
            color: perfil.rol === 'arrendador' ? '#f59e0b' : '#60a5fa',
            fontSize: '0.8rem',
            fontWeight: '800',
            letterSpacing: '1px',
            marginBottom: '30px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <i className={`fa-solid ${perfil.rol === 'arrendador' ? 'fa-building' : 'fa-car'}`}></i>
            {perfil.rol === 'arrendador' ? 'ARRENDADOR' : 'CONDUCTOR'}
          </div>

          <div className="nav-tabs">
            <button className={`tab-btn ${activeTab === 'personales' ? 'active' : ''}`} onClick={() => setActiveTab('personales')}>
              <i className="fa-solid fa-id-card"></i> Datos Personales
            </button>
            <button className={`tab-btn ${activeTab === 'vehiculos' ? 'active' : ''}`} onClick={() => setActiveTab('vehiculos')}>
              <i className="fa-solid fa-car"></i> Mis Vehículos ({vehiculos.length})
            </button>
            <button className={`tab-btn ${activeTab === 'reservas' ? 'active' : ''}`} onClick={() => setActiveTab('reservas')}>
              <i className="fa-solid fa-calendar-check"></i> Mis Reservas
            </button>
            <button className={`tab-btn ${activeTab === 'favoritos' ? 'active' : ''}`} onClick={() => setActiveTab('favoritos')}>
              <i className="fa-solid fa-star"></i> Favoritos
            </button>
            <button className={`tab-btn ${activeTab === 'pmr' ? 'active' : ''}`} onClick={() => setActiveTab('pmr')}>
              <i className="fa-solid fa-wheelchair"></i> Accesibilidad
            </button>
          </div>

          <button onClick={handleLogout} className="btn-action danger mt-auto">
            <i className="fa-solid fa-power-off"></i> Desconectar
          </button>
        </div>

        {/* Contenido Principal */}
        <div className="profile-content">
          
          {activeTab === 'personales' && (
            <div className="tab-pane fade-in">
              <h2>Identidad de Usuario</h2>
              
              {/* ACCOUNT INFO CARDS */}
              <div className="account-info-grid">
                <div className="info-card">
                  <div className="info-card-icon"><i className="fa-solid fa-envelope"></i></div>
                  <div className="info-card-data">
                    <span className="info-label">CORREO ELECTRÓNICO</span>
                    <span className="info-value">{session?.user?.email}</span>
                  </div>
                </div>
                <div className="info-card">
                  <div className="info-card-icon role"><i className={`fa-solid ${perfil.rol === 'arrendador' ? 'fa-building' : 'fa-car'}`}></i></div>
                  <div className="info-card-data">
                    <span className="info-label">TIPO DE CUENTA</span>
                    <span className="info-value">{perfil.rol === 'arrendador' ? 'Arrendador' : 'Conductor'}</span>
                  </div>
                </div>
                <div className="info-card">
                  <div className="info-card-icon date"><i className="fa-solid fa-calendar-check"></i></div>
                  <div className="info-card-data">
                    <span className="info-label">MIEMBRO DESDE</span>
                    <span className="info-value">{session?.user?.created_at ? new Date(session.user.created_at).toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}</span>
                  </div>
                </div>
              </div>

              <h3 style={{color: '#94a3b8', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '1px', marginTop: '35px', marginBottom: '5px'}}>EDITAR DATOS PERSONALES</h3>
              <form onSubmit={handleUpdatePerfil} className="cyber-form">
                <div className="input-wrap">
                  <label>Nombre Completo</label>
                  <input type="text" value={perfil.nombre} onChange={e => setPerfil({...perfil, nombre: e.target.value})} required />
                </div>
                <div className="input-wrap">
                  <label>Teléfono de Contacto</label>
                  <input type="tel" placeholder="+56 9 1234 5678" value={perfil.telefono} onChange={e => setPerfil({...perfil, telefono: e.target.value})} />
                </div>
                
                <button type="submit" className="btn-cyber-primary" disabled={saving}>
                  {saving ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-floppy-disk"></i>} Guardar Cambios
                </button>
              </form>

              <h3 style={{color: '#94a3b8', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '1px', marginTop: '35px', marginBottom: '5px'}}>CAMBIAR CORREO ELECTRÓNICO</h3>
              <div className="cyber-form" style={{maxWidth: '500px', marginTop: '15px'}}>
                <div className="input-wrap">
                  <label>Nuevo Correo Electrónico</label>
                  <input type="email" placeholder={session?.user?.email} value={nuevoEmail} onChange={e => setNuevoEmail(e.target.value)} />
                </div>
                <button type="button" className="btn-cyber-secondary" onClick={handleUpdateEmail} disabled={saving || !nuevoEmail} style={{marginTop:'10px'}}>
                  <i className="fa-solid fa-envelope"></i> Actualizar Email
                </button>
              </div>
            </div>
          )}

          {activeTab === 'vehiculos' && (
            <div className="tab-pane fade-in">
              <h2>Flota Registrada</h2>
              <p className="subtitle-desc">El arrendador necesita estos datos para autorizar tu ingreso.</p>
              
              <div className="vehicles-list">
                {vehiculos.length === 0 ? (
                  <div className="empty-state">Aún no has registrado ningún vehículo.</div>
                ) : (
                  vehiculos.map(v => (
                    <div key={v.id} className="vehicle-card">
                      <div className="v-icon"><i className="fa-solid fa-car-side"></i></div>
                      <div className="v-details">
                        <strong>{v.patente?.toUpperCase() || v.placa?.toUpperCase()}</strong>
                        <span>{v.marca ? `${v.marca} ` : ''}{v.modelo} - {v.color}</span>
                      </div>
                      <button onClick={() => handleRemoveVehiculo(v.id)} className="btn-icon-danger" title="Eliminar">
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </div>
                  ))
                )}
              </div>

              <h3 className="section-divider">Agregar Nuevo Vehículo</h3>
              <form onSubmit={handleAddVehiculo} className="cyber-form vehicle-form">
                <div className="input-wrap">
                  <input type="text" placeholder="Patente" value={nuevoVehiculo.patente} onChange={e => setNuevoVehiculo({...nuevoVehiculo, patente: e.target.value})} maxLength={6} required />
                </div>
                <div className="input-wrap">
                  <input type="text" placeholder="Marca (Ej. Toyota)" value={nuevoVehiculo.marca} onChange={e => setNuevoVehiculo({...nuevoVehiculo, marca: e.target.value})} required />
                </div>
                <div className="input-wrap">
                  <input type="text" placeholder="Modelo (Ej. Yaris)" value={nuevoVehiculo.modelo} onChange={e => setNuevoVehiculo({...nuevoVehiculo, modelo: e.target.value})} required />
                </div>
                <div className="input-wrap">
                  <input type="text" placeholder="Color" value={nuevoVehiculo.color} onChange={e => setNuevoVehiculo({...nuevoVehiculo, color: e.target.value})} required />
                </div>
                <button type="submit" className="btn-cyber-secondary" disabled={saving}>
                  {saving ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-plus"></i>} Agregar
                </button>
              </form>
            </div>
          )}

          {activeTab === 'reservas' && (
            <div className="tab-pane fade-in">
              <h2>Mis Reservas</h2>
              <p className="subtitle-desc">Historial y reservas activas. Califica las completadas y gestiona las próximas.</p>

              {loadingReservas ? (
                <div className="empty-state"><i className="fa-solid fa-spinner fa-spin"></i> Cargando reservas…</div>
              ) : reservas.length === 0 ? (
                <div className="empty-state">Aún no tienes reservas. Encuentra un estacionamiento en el mapa.</div>
              ) : (
                <div className="vehicles-list">
                  {reservas.map(r => (
                    <div key={r.id} className="vehicle-card reserva-card">
                      <div className="v-details" style={{ marginLeft: 0 }}>
                        <strong>{r.estacionamiento?.nombre || 'Estacionamiento'}</strong>
                        <span>{r.estacionamiento?.comuna ? `${r.estacionamiento.comuna} · ` : ''}{fmtFecha(r.fecha_inicio)} → {fmtFecha(r.fecha_fin)}</span>
                        <span>
                          {r.precio_total != null && <>💲 ${Number(r.precio_total).toLocaleString('es-CL')} · </>}
                          <span className={`estado-badge estado-${r.estado}`}>{r.estado}</span>
                          {r.calificacion ? <> · {'★'.repeat(r.calificacion)}</> : null}
                        </span>
                      </div>
                      <div className="reserva-actions">
                        {r.review_photo_url && (
                          <img src={r.review_photo_url} alt="foto reseña" style={{width:'48px',height:'48px',objectFit:'cover',borderRadius:'8px',border:'1px solid rgba(255,255,255,0.08)'}} />
                        )}
                        {(r.estado === 'pendiente' || r.estado === 'confirmada') && (
                          <button onClick={() => handleCancelarReserva(r.id)} className="btn-icon-danger" title="Cancelar">
                            <i className="fa-solid fa-ban"></i>
                          </button>
                        )}
                        {r.estado === 'completada' && !r.calificacion && (
                          <button onClick={() => setReviewModal({ reservaId: r.id })} className="btn-cyber-secondary" style={{ padding: '8px 14px' }}>
                            <i className="fa-solid fa-star"></i> Calificar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'favoritos' && (
            <div className="tab-pane fade-in">
              <h2>Estacionamientos Favoritos</h2>
              <p className="subtitle-desc">Tus lugares guardados. Accede rápidamente desde aquí o desde el mapa.</p>

              {loadingFavs ? (
                <div className="empty-state"><i className="fa-solid fa-spinner fa-spin"></i> Cargando favoritos…</div>
              ) : favoritos.length === 0 ? (
                <div className="empty-state">
                  <i className="fa-solid fa-star" style={{ fontSize: '2rem', color: '#334155', marginBottom: '12px' }}></i>
                  <p>Aún no tienes favoritos. Toca la estrella en cualquier estacionamiento del mapa.</p>
                </div>
              ) : (
                <div className="vehicles-list">
                  {favoritos.map(f => {
                    const est = f.estacionamiento || {};
                    const id = est.id ?? f.estacionamiento_id;
                    const libres = est.total_spots != null ? Math.max((est.total_spots || 0) - (est.occupied_spots || 0), 0) : null;
                    return (
                      <div key={f.id} className="fav-card">
                        {est.photos && est.photos.length > 0 ? (
                          <img src={est.photos[0]} alt={est.nombre} className="fav-thumb" />
                        ) : (
                          <div className="fav-icon-box">
                            <i className="fa-solid fa-square-parking"></i>
                          </div>
                        )}
                        <div className="fav-info">
                          <span className="fav-name">{est.nombre || 'Estacionamiento'}</span>
                          <span className="fav-meta">
                            {est.comuna ? `${est.comuna} · ` : ''}
                            {est.precio_hora != null ? (est.precio_hora === 0 ? 'Gratuito' : `$${Number(est.precio_hora).toLocaleString('es-CL')}/hr`) : ''}
                            {est.es_pmr ? ' · ♿' : ''}
                            {libres != null ? ` · ${libres > 0 ? `${libres} libre${libres > 1 ? 's' : ''}` : 'Sin cupos'}` : ''}
                          </span>
                          {est.rating > 0 && (
                            <span className="fav-rating">
                              {'★'.repeat(Math.round(est.rating))}{'☆'.repeat(5 - Math.round(est.rating))} {est.rating}
                            </span>
                          )}
                        </div>
                        <div className="fav-actions">
                          {est.lat && est.lng && (
                            <a href={`/mapa?lat=${est.lat}&lng=${est.lng}&id=${id}`} className="fav-btn fav-btn-map" title="Ir al mapa">
                              <i className="fa-solid fa-map-pin"></i> Ir al mapa
                            </a>
                          )}
                          <a href={`/mapa?id=${id}&reservar=1`} className="fav-btn fav-btn-book" title="Reservar">
                            <i className="fa-solid fa-calendar-plus"></i> Reservar
                          </a>
                          <button
                            onClick={() => handleQuitarFavorito(id)}
                            className="fav-btn fav-btn-del"
                            title="Quitar de favoritos"
                          >
                            <i className="fa-solid fa-star-slash"></i>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'pmr' && (
            <div className="tab-pane fade-in">
              <h2>Preferencias de Inclusión</h2>
              <div className="pmr-card">
                <div className="pmr-info">
                  <i className="fa-solid fa-wheelchair"></i>
                  <div>
                    <h3>Estacionamientos accesibles</h3>
                    <p>Filtra el mapa para mostrar solo estacionamientos con acceso garantizado para personas con movilidad reducida.</p>
                  </div>
                </div>
                <div className="toggle-switch">
                  <input type="checkbox" id="pmr-toggle" checked={perfil.requiere_pmr} onChange={handleTogglePMR} />
                  <label htmlFor="pmr-toggle"></label>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      <style jsx>{`
        .profile-wrapper { min-height: 100vh; padding: 100px 5%; display: flex; justify-content: center; align-items: flex-start; position: relative; background: #020617; }
        .cyber-grid-bg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-image: radial-gradient(rgba(59, 130, 246, 0.1) 1px, transparent 1px); background-size: 40px 40px; z-index: 1; }
        
        .profile-container { position: relative; z-index: 2; width: 100%; max-width: 1100px; display: grid; grid-template-columns: 320px 1fr; gap: 30px; }
        
        /* Sidebar */
        .profile-sidebar { background: rgba(15, 23, 42, 0.8); backdrop-filter: blur(20px); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 24px; padding: 40px 20px; display: flex; flex-direction: column; align-items: center; text-align: center; height: calc(100vh - 140px); position: sticky; top: 100px; }
        .avatar-ring { width: 100px; height: 100px; margin: 0 auto 20px; background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(16, 185, 129, 0.1)); border: 2px solid #3b82f6; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; color: #60a5fa; box-shadow: 0 0 30px rgba(59, 130, 246, 0.3); overflow: hidden; }
        .avatar-img { width: 100%; height: 100%; object-fit: cover; }
        .avatar-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; border-radius: 50%; opacity: 0; transition: opacity 0.3s; font-size: 1.2rem; color: white; }
        .avatar-ring:hover .avatar-overlay { opacity: 1; }
        .avatar-ring { position: relative; }
        .profile-sidebar h1 { color: white; font-size: 1.5rem; font-weight: 900; margin-bottom: 5px; }
        .email-tag { color: #94a3b8; font-size: 0.9rem; margin-bottom: 20px; }
        .status-badge { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); color: #10b981; border-radius: 20px; font-size: 0.75rem; font-weight: 900; letter-spacing: 1px; margin-bottom: 40px; }
        .dot { width: 8px; height: 8px; border-radius: 50%; }
        .pulse-green { background: #10b981; box-shadow: 0 0 10px #10b981; animation: pulse 2s infinite; }
        
        .nav-tabs { width: 100%; display: flex; flex-direction: column; gap: 10px; }
        .tab-btn { background: transparent; border: 1px solid transparent; color: #94a3b8; padding: 15px; border-radius: 12px; text-align: left; font-size: 1rem; font-weight: 600; cursor: pointer; transition: all 0.3s; display: flex; align-items: center; gap: 12px; }
        .tab-btn:hover { background: rgba(255,255,255,0.05); color: white; }
        .tab-btn.active { background: rgba(59, 130, 246, 0.1); border-color: rgba(59, 130, 246, 0.3); color: #60a5fa; box-shadow: inset 4px 0 0 #3b82f6; }
        .tab-btn i { width: 20px; text-align: center; }
        
        .mt-auto { margin-top: auto; width: 100%; }
        .btn-action { padding: 15px; border-radius: 12px; font-size: 0.9rem; font-weight: 800; cursor: pointer; transition: 0.3s; display: flex; align-items: center; justify-content: center; gap: 10px; border: none; }
        .btn-action.danger { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); }
        .btn-action.danger:hover { background: #ef4444; color: white; }

        /* Content Area */
        .profile-content { background: rgba(15, 23, 42, 0.5); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.05); border-radius: 24px; padding: 40px; min-height: 500px; }
        .fade-in { animation: fadeIn 0.4s ease-out; }
        .profile-content h2 { color: white; font-size: 1.8rem; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 15px; }
        .subtitle-desc { color: #94a3b8; font-size: 0.95rem; margin-bottom: 30px; }

        /* Account Info Cards */
        .account-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 20px; }
        .info-card { display: flex; align-items: center; gap: 14px; padding: 16px 18px; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; transition: 0.3s; }
        .info-card:hover { border-color: rgba(59, 130, 246, 0.2); background: rgba(0,0,0,0.35); }
        .info-card-icon { width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1rem; background: rgba(59, 130, 246, 0.12); color: #60a5fa; flex-shrink: 0; }
        .info-card-icon.role { background: rgba(245, 158, 11, 0.12); color: #f59e0b; }
        .info-card-icon.date { background: rgba(16, 185, 129, 0.12); color: #10b981; }
        .info-card-icon.id { background: rgba(139, 92, 246, 0.12); color: #a78bfa; }
        .info-card-data { display: flex; flex-direction: column; min-width: 0; }
        .info-label { font-size: 0.65rem; color: #64748b; font-weight: 700; letter-spacing: 1px; }
        .info-value { font-size: 0.95rem; color: white; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .info-value.mono { font-family: 'Courier New', monospace; font-size: 0.85rem; color: #a78bfa; }

        /* Forms */
        .cyber-form { display: flex; flex-direction: column; gap: 20px; max-width: 500px; margin-top: 30px; }
        .input-wrap { display: flex; flex-direction: column; gap: 8px; }
        .input-wrap label { color: #cbd5e1; font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
        .input-wrap input { padding: 15px 20px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: white; font-size: 1rem; transition: 0.3s; }
        .input-wrap input:focus { border-color: #3b82f6; outline: none; background: rgba(0,0,0,0.5); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2); }
        
        .btn-cyber-primary { padding: 16px; background: linear-gradient(135deg, #3b82f6, #2563eb); border: none; border-radius: 12px; color: white; font-weight: 800; font-size: 1rem; cursor: pointer; transition: 0.3s; margin-top: 10px; display: flex; justify-content: center; gap: 10px; align-items: center; }
        .btn-cyber-primary:disabled { opacity: 0.7; cursor: not-allowed; }
        .btn-cyber-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(37, 99, 235, 0.4); }
        
        .btn-cyber-secondary { padding: 16px; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 12px; color: #60a5fa; font-weight: 800; font-size: 1rem; cursor: pointer; transition: 0.3s; display: flex; justify-content: center; gap: 10px; align-items: center; }
        .btn-cyber-secondary:hover:not(:disabled) { background: rgba(59, 130, 246, 0.2); }

        /* Vehicles */
        .vehicles-list { display: flex; flex-direction: column; gap: 15px; margin-bottom: 40px; }
        .empty-state { padding: 30px; text-align: center; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1); border-radius: 16px; color: #64748b; }
        .vehicle-card { display: flex; align-items: center; justify-content: space-between; padding: 20px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; transition: 0.3s; }
        .vehicle-card:hover { border-color: rgba(59, 130, 246, 0.3); background: rgba(59, 130, 246, 0.05); }
        .v-icon { width: 50px; height: 50px; background: rgba(59, 130, 246, 0.1); color: #3b82f6; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; }
        .v-details { flex: 1; margin-left: 20px; display: flex; flex-direction: column; gap: 4px; }
        .v-details strong { color: white; font-size: 1.1rem; letter-spacing: 1px; }
        .v-details span { color: #94a3b8; font-size: 0.9rem; }
        .btn-icon-danger { background: transparent; border: none; color: #ef4444; font-size: 1.2rem; cursor: pointer; padding: 10px; border-radius: 8px; transition: 0.3s; }
        .btn-icon-danger:hover { background: rgba(239, 68, 68, 0.1); }
        
        .section-divider { color: white; font-size: 1.2rem; margin-top: 20px; }
        .vehicle-form { display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 15px; max-width: 100%; align-items: end; }
        .vehicle-form .input-wrap { gap: 4px; }

        /* PMR Toggle */
        .pmr-card { margin-top: 30px; display: flex; align-items: center; justify-content: space-between; padding: 30px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), transparent); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 20px; }
        .pmr-info { display: flex; align-items: center; gap: 20px; }
        .pmr-info i { font-size: 2.5rem; color: #10b981; background: rgba(16, 185, 129, 0.1); padding: 15px; border-radius: 16px; }
        .pmr-info h3 { color: white; font-size: 1.2rem; margin-bottom: 5px; }
        .pmr-info p { color: #94a3b8; font-size: 0.9rem; max-width: 400px; line-height: 1.5; }
        
        .toggle-switch { position: relative; width: 60px; height: 34px; }
        .toggle-switch input { opacity: 0; width: 0; height: 0; }
        .toggle-switch label { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(255,255,255,0.1); transition: .4s; border-radius: 34px; }
        .toggle-switch label:before { position: absolute; content: ""; height: 26px; width: 26px; left: 4px; bottom: 4px; background-color: white; transition: .4s; border-radius: 50%; }
        .toggle-switch input:checked + label { background-color: #10b981; box-shadow: 0 0 15px rgba(16, 185, 129, 0.5); }
        .toggle-switch input:checked + label:before { transform: translateX(26px); }

        /* Reservas */
        .reserva-card { gap: 15px; }
        .reserva-actions { display: flex; align-items: center; gap: 10px; }
        .estado-badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 0.7rem; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; }
        .estado-pendiente { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
        .estado-confirmada { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }
        .estado-activa { background: rgba(16, 185, 129, 0.15); color: #10b981; }
        .estado-completada { background: rgba(148, 163, 184, 0.15); color: #94a3b8; }
        .estado-cancelada { background: rgba(239, 68, 68, 0.15); color: #ef4444; }

        /* Favoritos enhanced cards */
        .fav-card { display: flex; align-items: center; gap: 16px; padding: 18px 20px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; transition: 0.3s; }
        .fav-card:hover { border-color: rgba(245,158,11,0.3); background: rgba(245,158,11,0.04); }
        .fav-thumb { width: 64px; height: 64px; border-radius: 12px; object-fit: cover; flex-shrink: 0; border: 1px solid rgba(255,255,255,0.08); }
        .fav-icon-box { width: 64px; height: 64px; border-radius: 12px; background: rgba(245,158,11,0.1); color: #f59e0b; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; flex-shrink: 0; }
        .fav-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
        .fav-name { color: #f8fafc; font-weight: 800; font-size: 1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .fav-meta { color: #94a3b8; font-size: 0.82rem; }
        .fav-rating { color: #f59e0b; font-size: 0.78rem; }
        .fav-actions { display: flex; gap: 8px; flex-shrink: 0; }
        .fav-btn { display: flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 10px; font-size: 0.8rem; font-weight: 700; border: none; cursor: pointer; transition: 0.2s; text-decoration: none; white-space: nowrap; }
        .fav-btn-map { background: rgba(59,130,246,0.12); color: #60a5fa; border: 1px solid rgba(59,130,246,0.25); }
        .fav-btn-map:hover { background: rgba(59,130,246,0.22); }
        .fav-btn-book { background: rgba(16,185,129,0.12); color: #10b981; border: 1px solid rgba(16,185,129,0.25); }
        .fav-btn-book:hover { background: rgba(16,185,129,0.22); }
        .fav-btn-del { background: transparent; color: #ef4444; border: 1px solid rgba(239,68,68,0.2); padding: 8px 10px; }
        .fav-btn-del:hover { background: rgba(239,68,68,0.1); }
        @media (max-width: 600px) { .fav-actions { flex-direction: column; } .fav-btn { font-size: 0.72rem; padding: 6px 10px; } }

        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }

        @media (max-width: 900px) {
          .profile-container { grid-template-columns: 1fr; }
          .profile-sidebar { height: auto; position: relative; top: 0; margin-bottom: 20px; }
          .vehicle-form { grid-template-columns: 1fr; }
          .pmr-card { flex-direction: column; text-align: center; gap: 20px; }
          .pmr-info { flex-direction: column; }
          .account-info-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}