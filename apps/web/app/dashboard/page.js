// Archivo: apps/web/app/dashboard/page.js
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { api } from '../../src/lib/api';
import { supabase } from '@parkings/supabase-db';
import ConductorDashboard from '../../src/components/ConductorDashboard';

const MiniMapComponent = dynamic(() => import('../../src/components/MiniMap'), {
  ssr: false,
  loading: () => (
    <div style={{ height: '350px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
      <i className="fa-solid fa-satellite-dish fa-spin" style={{ fontSize: '2rem', color: 'var(--primary)', marginBottom: '10px' }}></i>
      <span style={{color: '#94a3b8', fontSize: '0.8rem'}}>Conectando a satélites...</span>
    </div>
  )
});

export default function DashboardPage() {
  const [session, setSession] = useState(null);
  const [myParkings, setMyParkings] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [comuna, setComuna] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [totalSpots, setTotalSpots] = useState(1);
  const [esPmr, setEsPmr] = useState(false);

  // Pricing
  const [precioHora,     setPrecioHora]     = useState('');
  const [pricePerMinute, setPricePerMinute] = useState('');
  const [pricePerDay,    setPricePerDay]    = useState('');

  // Vehicle types
  const VEHICLE_TYPES = [
    { id: 'car',        label: 'Auto',      icon: 'fa-car'           },
    { id: 'motorcycle', label: 'Moto',      icon: 'fa-motorcycle'    },
    { id: 'bicycle',    label: 'Bicicleta', icon: 'fa-bicycle'       },
    { id: 'scooter',    label: 'Scooter',   icon: 'fa-person-biking' },
  ];
  const [allowedVehicleTypes, setAllowedVehicleTypes] = useState(['car']);
  const toggleVehicle = (id) => setAllowedVehicleTypes(prev =>
    prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
  );
  const [selectedIds, setSelectedIds] = useState([]);
  const [toast, setToast] = useState(null);
  const [reservasRecibidas, setReservasRecibidas] = useState([]);

  // Photo upload
  const [photos, setPhotos] = useState([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handlePhotoUpload = async (files) => {
    if (!session?.user?.id) return;
    setUploadingPhotos(true);
    const uploaded = [];
    for (const file of Array.from(files)) {
      try {
        const path = `${session.user.id}/${Date.now()}-${file.name}`;
        const { error } = await supabase.storage.from('parking-photos').upload(path, file, { upsert: false });
        if (error) { showToast(`Error subiendo ${file.name}: ${error.message}`, 'error'); continue; }
        const { data: { publicUrl } } = supabase.storage.from('parking-photos').getPublicUrl(path);
        uploaded.push(publicUrl);
      } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
      }
    }
    setPhotos(prev => [...prev, ...uploaded]);
    setUploadingPhotos(false);
  };

  useEffect(() => {
    const checkUserAndFetchData = async () => {
      // Use Supabase session instead of manually checking localStorage
      const { data: { session: authSession } } = await supabase.auth.getSession();
      
      if (!authSession?.user) {
        router.push('/auth?redirectTo=/dashboard');
        return;
      }

      // Fetch the user's rol from the database (resilient)
      let profile = null;
      try {
        const { data: profileData } = await supabase.from('perfiles').select('rol, nombre').eq('id', authSession.user.id).single();
        profile = profileData;
      } catch (e) {
        if (process.env.NODE_ENV === 'development') console.warn('[Dashboard] Perfil no disponible, usando fallback de auth metadata');
      }
      
      const userObj = {
        id: authSession.user.id,
        email: authSession.user.email,
        nombre: profile?.nombre || authSession.user.user_metadata?.nombre || authSession.user.email?.split('@')[0],
        rol: profile?.rol || authSession.user.user_metadata?.rol || 'cliente'
      };

      setSession({ user: userObj, access_token: authSession.access_token });

      try {
        const result = await api.mapas.getMisEstacionamientos(userObj.id);
        if (result.success) setMyParkings(result.data || []);
      } catch (e) {
        if (process.env.NODE_ENV === 'development') console.error('Error cargando estacionamientos:', e);
      }

      if (userObj.rol === 'arrendador') {
        try {
          const rr = await api.reservas.listar('arrendador');
          if (rr.success) setReservasRecibidas(rr.data || []);
        } catch (e) {
          if (process.env.NODE_ENV === 'development') console.error('Error cargando reservas recibidas:', e);
        }
      }

      setLoading(false);
    };
    checkUserAndFetchData();
  }, [router]);

  const recargarReservasRecibidas = async () => {
    const rr = await api.reservas.listar('arrendador');
    if (rr.success) setReservasRecibidas(rr.data || []);
  };

  // ── Auto-completar reservas cuyo tiempo ya terminó ──
  // El arrendador no debería tener que cerrar manualmente una reserva cuyas
  // horas ya se cumplieron. Detectamos las confirmadas/activas cuya fecha_fin
  // ya pasó y las marcamos como completadas automáticamente (igual queda el
  // botón manual para los casos en que se quiera cerrar antes de tiempo).
  const autoCompletadasRef = useState(() => new Set())[0];
  useEffect(() => {
    if (!reservasRecibidas.length) return;
    const ahora = Date.now();
    const vencidas = reservasRecibidas.filter(r =>
      (r.estado === 'confirmada' || r.estado === 'activa') &&
      r.fecha_fin && new Date(r.fecha_fin).getTime() < ahora &&
      !autoCompletadasRef.has(r.id)
    );
    if (vencidas.length === 0) return;
    (async () => {
      for (const r of vencidas) {
        autoCompletadasRef.add(r.id);
        await api.reservas.completar(r.id);
      }
      showToast(`${vencidas.length} reserva(s) finalizada(s) automáticamente por tiempo cumplido`, 'success');
      recargarReservasRecibidas();
    })();
  }, [reservasRecibidas, autoCompletadasRef]);

  // Tiempo restante / estado del intervalo de una reserva.
  const intervaloReserva = (r) => {
    if (!r.fecha_fin) return null;
    const fin = new Date(r.fecha_fin).getTime();
    const ini = r.fecha_inicio ? new Date(r.fecha_inicio).getTime() : null;
    const ahora = Date.now();
    if (fin < ahora) return { vencida: true, texto: 'Tiempo cumplido' };
    const minRestantes = Math.round((fin - ahora) / 60000);
    if (ini && ini > ahora) {
      const minInicio = Math.round((ini - ahora) / 60000);
      return { vencida: false, futura: true, texto: `Empieza en ${minInicio < 60 ? `${minInicio} min` : `${Math.round(minInicio / 60)} h`}` };
    }
    return { vencida: false, texto: `Quedan ${minRestantes < 60 ? `${minRestantes} min` : `${Math.round(minRestantes / 60)} h`}` };
  };

  const gestionarReserva = async (accion, id) => {
    const fn = { confirmar: api.reservas.confirmar, completar: api.reservas.completar, cancelar: api.reservas.cancelar }[accion];
    showToast('Procesando reserva...', 'syncing');
    const res = await fn(id);
    if (res.success) { showToast('Reserva actualizada', 'success'); recargarReservasRecibidas(); }
    else showToast(res.error || 'No se pudo actualizar la reserva', 'error');
  };

  const fmtFechaR = (f) => f ? new Date(f).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

  // Rellena automáticamente la dirección (y la comuna) al elegir un punto en el mapa.
  const handleAddressResolved = (texto, comunaDetectada) => {
    setDireccion(texto);
    if (comunaDetectada) setComuna(comunaDetectada);
  };

  const handleSearchAddress = async () => {
    if (!direccion.trim()) return;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(direccion + ', Chile')}`);
      const data = await res.json();
      if (data && data.length > 0) {
        setLat(data[0].lat);
        setLng(data[0].lon);
        // Intenta extraer la comuna del nombre devuelto por el geocodificador.
        const partes = (data[0].display_name || '').split(',').map(s => s.trim());
        if (partes.length >= 2) setComuna(partes[1]);
        showToast('¡Dirección ubicada y fijada en el mapa!', 'success');
      } else {
        showToast('Dirección no encontrada.', 'error');
      }
    } catch {
      showToast('Error de conexión satelital.', 'error');
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!lat || !lng) { showToast('Fija el pin rojo en el mapa primero.', 'error'); return; }

    const nombreArrendador = session.user.nombre || session.user.email.split('@')[0];
    showToast('Publicando estacionamiento...', 'syncing');

    try {
      const result = await api.mapas.crearEstacionamiento({
        nombre,
        arrendador: nombreArrendador,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        totalSpots: parseInt(totalSpots),
        esPmr,
        userId: session.user.id,
        comuna:             comuna || undefined,
        descripcion:        descripcion || undefined,
        direccion:          direccion || undefined,
        precioHora:         precioHora     ? parseFloat(precioHora)     : undefined,
        pricePerMinute:     pricePerMinute ? parseFloat(pricePerMinute) : undefined,
        pricePerDay:        pricePerDay    ? parseFloat(pricePerDay)    : undefined,
        allowedVehicleTypes: allowedVehicleTypes.length > 0 ? allowedVehicleTypes : ['car'],
        photos: photos.length > 0 ? photos : undefined,
      });

      if (result.success && result.data) {
        setMyParkings(prev => [result.data, ...prev]);
        setNombre(''); setDireccion(''); setDescripcion(''); setComuna(''); setLat(''); setLng(''); setTotalSpots(1); setEsPmr(false);
        setPrecioHora(''); setPricePerMinute(''); setPricePerDay('');
        setAllowedVehicleTypes(['car']);
        setPhotos([]);
        showToast('¡Estacionamiento publicado con éxito!', 'success');
      } else if (!result.success) {
        showToast(result.error || 'No se pudo publicar el estacionamiento.', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Error al guardar en Supabase.', 'error');
    }
  };

  const updateOccupancy = async (id, currentOccupied, total, change) => {
    const newOccupied = currentOccupied + change;
    if (newOccupied < 0 || newOccupied > total) return;
    
    // Optimistic Update
    setMyParkings(prev => prev.map(p => p.id === id ? { ...p, occupied_spots: newOccupied } : p));
    showToast('Actualizando cupos...', 'syncing');

    try {
      const res = await api.mapas.actualizarOcupacion(id, newOccupied);
      if (res.success) {
        showToast('Cupos actualizados', 'success');
      } else {
        throw new Error(res.error);
      }
    } catch (error) {
      setMyParkings(prev => prev.map(p => p.id === id ? { ...p, occupied_spots: currentOccupied } : p));
      showToast('Error al actualizar los cupos', 'error');
    }
  };

  const toggleSelection = (id) =>
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );

  const selectAll = () =>
    selectedIds.length === myParkings.length
      ? setSelectedIds([])
      : setSelectedIds(myParkings.map(p => p.id));

  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // ── Edit modal ──
  const [editingParking,   setEditingParking]   = useState(null);
  const [editNombre,       setEditNombre]       = useState('');
  const [editDescripcion,  setEditDescripcion]  = useState('');
  const [editDireccion,    setEditDireccion]    = useState('');
  const [editTotalSpots,   setEditTotalSpots]   = useState(1);
  const [editEsPmr,        setEditEsPmr]        = useState(false);
  const [editPrecioHora,   setEditPrecioHora]   = useState('');
  const [editPriceMin,     setEditPriceMin]     = useState('');
  const [editPriceDay,     setEditPriceDay]     = useState('');
  const [editVehicles,     setEditVehicles]     = useState(['car']);
  const VEHICLE_EDIT = [
    { id: 'car',        label: 'Auto',      icon: 'fa-car'           },
    { id: 'motorcycle', label: 'Moto',      icon: 'fa-motorcycle'    },
    { id: 'bicycle',    label: 'Bicicleta', icon: 'fa-bicycle'       },
    { id: 'scooter',    label: 'Scooter',   icon: 'fa-person-biking' },
  ];

  const openEdit = (parking) => {
    setEditingParking(parking);
    setEditNombre(parking.nombre || '');
    setEditDescripcion(parking.descripcion || '');
    setEditDireccion(parking.direccion || '');
    setEditTotalSpots(parking.total_spots || 1);
    setEditEsPmr(parking.es_pmr || false);
    setEditPrecioHora(parking.precio_hora != null ? String(parking.precio_hora) : '');
    setEditPriceMin(parking.price_per_minute != null ? String(parking.price_per_minute) : '');
    setEditPriceDay(parking.price_per_day != null ? String(parking.price_per_day) : '');
    setEditVehicles(parking.allowed_vehicle_types?.length > 0 ? parking.allowed_vehicle_types : ['car']);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    showToast('Guardando cambios...', 'syncing');
    try {
      const res = await api.mapas.actualizarEstacionamiento(editingParking.id, {
        nombre:              editNombre,
        descripcion:         editDescripcion || null,
        direccion:           editDireccion || null,
        totalSpots:          editTotalSpots,
        esPmr:               editEsPmr,
        precioHora:          editPrecioHora,
        pricePerMinute:      editPriceMin,
        pricePerDay:         editPriceDay,
        allowedVehicleTypes: editVehicles.length > 0 ? editVehicles : ['car'],
      });
      if (res.success) {
        setMyParkings(prev => prev.map(p => p.id === editingParking.id ? { ...p, ...res.data } : p));
        setEditingParking(null);
        showToast('Plaza actualizada con éxito', 'success');
      } else {
        showToast(res.error || 'No se pudo actualizar', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Error al guardar', 'error');
    }
  };

  const handleToggleActivo = async (parking) => {
    const wasActivo = parking.activo !== false;
    showToast(wasActivo ? 'Desactivando plaza...' : 'Reactivando plaza...', 'syncing');
    try {
      const res = await api.mapas.toggleActivar(parking.id);
      if (res.success) {
        setMyParkings(prev => prev.map(p => p.id === parking.id ? { ...p, activo: res.activo } : p));
        showToast(res.activo ? 'Plaza reactivada y visible en el mapa' : 'Plaza desactivada y oculta del mapa', 'success');
      } else {
        showToast(res.error || 'Error al cambiar estado', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Error', 'error');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setShowConfirmModal(true);
  };

  const executeBulkDelete = async () => {
    setShowConfirmModal(false);
    showToast('Eliminando...', 'syncing');

    try {
      const result = await api.mapas.eliminarEstacionamientos(selectedIds);
      if (result.success) {
        // Hard-deleted → remove from list; soft-deleted → mark as inactive
        const hardIds = result.hardDeletedIds || [];
        const softIds = result.softDeletedIds || [];
        setMyParkings(prev => prev
          .filter(p => !hardIds.includes(p.id))
          .map(p => softIds.includes(p.id) ? { ...p, activo: false } : p)
        );
        setSelectedIds([]);
        const msg = result.softDeleted > 0
          ? `${result.hardDeleted} eliminado(s), ${result.softDeleted} desactivado(s) (tienen reservas activas)`
          : `${result.hardDeleted} estacionamiento(s) eliminado(s)`;
        showToast(msg, 'success');
      }
    } catch (err) {
      showToast(err.message || 'Error al eliminar.', 'error');
    }
  };

  if (loading) return (
    <div style={{ height: '80vh', display: 'flex', flexDirection: 'column', gap: '20px', justifyContent: 'center', alignItems: 'center', color: 'white' }}>
      <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '3rem', color: 'var(--primary)' }}></i>
      <h3 style={{ color: '#94a3b8' }}>Cargando...</h3>
    </div>
  );

  // Los conductores ven un panel propio con reservas, vehículos, favoritos y gastos.
  if (session?.user?.rol !== 'arrendador') {
    return <ConductorDashboard user={session.user} />;
  }

  return (
    <section className="dashboard-container">
      <div className="dashboard-header">
        <div className="header-titles">
          <h2>Panel de Control</h2>
          <p>Hola, {session?.user?.nombre || session?.user?.email}</p>
        </div>
        
      </div>

      {/* ANALYTICS PANEL */}
      {session?.user?.rol === 'arrendador' && (
        <div className="analytics-panel">
          <div className="analytics-card">
            <div className="analytics-icon blue"><i className="fa-solid fa-square-parking"></i></div>
            <div className="analytics-data">
              <span className="analytics-label">PLAZAS ACTIVAS</span>
              <span className="analytics-value">{myParkings.filter(p=>p.activo!==false).length}</span>
            </div>
          </div>
          <div className="analytics-card">
            <div className="analytics-icon green"><i className="fa-solid fa-calendar-check"></i></div>
            <div className="analytics-data">
              <span className="analytics-label">RESERVAS HOY</span>
              <span className="analytics-value">{reservasRecibidas.filter(r=>{const d=new Date(r.created_at);const h=new Date();return d.getDate()===h.getDate()&&d.getMonth()===h.getMonth()}).length}</span>
            </div>
          </div>
          <div className="analytics-card">
            <div className="analytics-icon amber"><i className="fa-solid fa-clock"></i></div>
            <div className="analytics-data">
              <span className="analytics-label">PENDIENTES</span>
              <span className="analytics-value">{reservasRecibidas.filter(r=>r.estado==='pendiente').length}</span>
            </div>
          </div>
          <div className="analytics-card">
            <div className="analytics-icon purple"><i className="fa-solid fa-peso-sign"></i></div>
            <div className="analytics-data">
              <span className="analytics-label">INGRESOS (MES)</span>
              <span className="analytics-value">${reservasRecibidas.filter(r=>r.estado==='completada'&&new Date(r.created_at).getMonth()===new Date().getMonth()).reduce((acc,r)=>acc+Number(r.precio_total||0),0).toLocaleString('es-CL')}</span>
            </div>
          </div>
        </div>
      )}

      {/* TOAST SYSTEM */}
      {toast && (
        <div className={`toast-notification ${toast.type}`}>
          {toast.type === 'success' && <i className="fa-solid fa-check-circle"></i>}
          {toast.type === 'error' && <i className="fa-solid fa-triangle-exclamation"></i>}
          {toast.type === 'syncing' && <i className="fa-solid fa-arrows-rotate fa-spin"></i>}
          {toast.msg}
        </div>
      )}

      {/* ── EDIT MODAL ── */}
      {editingParking && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content" style={{ maxWidth: '520px', width: '92%', textAlign: 'left', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fa-solid fa-pen-to-square" style={{ color: '#3b82f6' }}></i> Editar Plaza
              </h3>
              <button onClick={() => setEditingParking(null)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.2rem' }}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Nombre */}
              <div className="input-group">
                <i className="fa-solid fa-signature icon"></i>
                <input type="text" placeholder="Nombre de la Plaza" value={editNombre} onChange={e => setEditNombre(e.target.value)} required />
              </div>
              {/* Descripcion */}
              <textarea
                placeholder="Descripción (opcional)"
                value={editDescripcion}
                onChange={e => setEditDescripcion(e.target.value)}
                rows={2}
                maxLength={500}
                style={{width:'100%',background:'rgba(0,0,0,0.3)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'12px',color:'white',padding:'12px 14px',fontSize:'0.9rem',resize:'vertical',fontFamily:'inherit',outline:'none',boxSizing:'border-box'}}
              />
              {/* Direccion */}
              <div className="input-group">
                <i className="fa-solid fa-map-pin icon"></i>
                <input type="text" placeholder="Dirección (opcional)" value={editDireccion} onChange={e => setEditDireccion(e.target.value)} />
              </div>
              {/* Cupos y PMR */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <div className="input-group" style={{ flex: 1 }}>
                  <i className="fa-solid fa-car icon"></i>
                  <input type="number" min="1" placeholder="Cupos totales" value={editTotalSpots} onChange={e => setEditTotalSpots(e.target.value)} required />
                </div>
              </div>
              <div className="checkbox-pmr" style={{ cursor: 'pointer' }}>
                <input type="checkbox" id="edit-pmr" checked={editEsPmr} onChange={e => setEditEsPmr(e.target.checked)} style={{ width: '20px', height: '20px', accentColor: '#38bdf8' }} />
                <label htmlFor="edit-pmr" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'white', fontWeight: 700 }}>
                  <i className="fa-solid fa-wheelchair" style={{ color: '#38bdf8' }}></i> Acceso para movilidad reducida
                </label>
              </div>
              {/* Tarifas */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '14px' }}>
                <p style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', fontWeight: 700 }}>
                  <i className="fa-solid fa-coins" style={{ color: '#f59e0b', marginRight: '6px' }}></i> Tarifas
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div className="input-group" style={{ flex: 1 }}>
                    <i className="fa-solid fa-clock icon"></i>
                    <input type="number" min="0" placeholder="Por hora" value={editPrecioHora} onChange={e => setEditPrecioHora(e.target.value)} />
                  </div>
                  <div className="input-group" style={{ flex: 1 }}>
                    <i className="fa-solid fa-stopwatch icon"></i>
                    <input type="number" min="0" placeholder="Por minuto" value={editPriceMin} onChange={e => setEditPriceMin(e.target.value)} />
                  </div>
                  <div className="input-group" style={{ flex: 1 }}>
                    <i className="fa-solid fa-calendar-day icon"></i>
                    <input type="number" min="0" placeholder="Por día" value={editPriceDay} onChange={e => setEditPriceDay(e.target.value)} />
                  </div>
                </div>
              </div>
              {/* Vehículos */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '14px' }}>
                <p style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', fontWeight: 700 }}>
                  <i className="fa-solid fa-car" style={{ color: '#3b82f6', marginRight: '6px' }}></i> Vehículos admitidos
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px' }}>
                  {VEHICLE_EDIT.map(v => {
                    const active = editVehicles.includes(v.id);
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setEditVehicles(prev => prev.includes(v.id) ? prev.filter(x => x !== v.id) : [...prev, v.id])}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', padding: '12px 6px', borderRadius: '12px', border: active ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.08)', background: active ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)', color: active ? '#60a5fa' : '#64748b', cursor: 'pointer', transition: 'all 0.15s', fontWeight: 700, fontSize: '0.72rem' }}
                      >
                        <i className={`fa-solid ${v.icon}`} style={{ fontSize: '1.1rem' }}></i>
                        {v.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Actions */}
              <div style={{ display: 'flex', gap: '12px', paddingTop: '4px' }}>
                <button type="button" onClick={() => setEditingParking(null)} className="btn-cancel" style={{ flex: 1 }}>Cancelar</button>
                <button type="submit" className="btn-cyber-primary" style={{ flex: 2, padding: '12px' }}>
                  <i className="fa-solid fa-floppy-disk"></i> Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showConfirmModal && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content">
            <h3><i className="fa-solid fa-triangle-exclamation" style={{color: '#ef4444'}}></i> Confirmar Eliminación</h3>
            <p>¿Estás seguro de que deseas eliminar {selectedIds.length} estacionamiento(s) de la red?</p>
            <div className="modal-actions">
              <button onClick={() => setShowConfirmModal(false)} className="btn-cancel">Cancelar</button>
              <button onClick={executeBulkDelete} className="btn-delete-bulk">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      <div className="dashboard-grid">
        {/* KPI METRICS */}
        {session?.user?.rol === 'arrendador' && myParkings.length > 0 && (
          <div className="kpi-row">
            <div className="kpi-card">
              <div className="kpi-icon blue"><i className="fa-solid fa-warehouse"></i></div>
              <div className="kpi-data">
                <span className="kpi-value">{myParkings.length}</span>
                <span className="kpi-label">Plazas Activas</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon green"><i className="fa-solid fa-car-side"></i></div>
              <div className="kpi-data">
                <span className="kpi-value">{myParkings.reduce((sum, p) => sum + p.total_spots, 0)}</span>
                <span className="kpi-label">Cupos Totales</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon amber"><i className="fa-solid fa-chart-pie"></i></div>
              <div className="kpi-data">
                <span className="kpi-value">
                  {myParkings.reduce((sum, p) => sum + p.total_spots, 0) > 0 
                    ? Math.round((myParkings.reduce((sum, p) => sum + (p.occupied_spots || 0), 0) / myParkings.reduce((sum, p) => sum + p.total_spots, 0)) * 100) 
                    : 0}%
                </span>
                <span className="kpi-label">Tasa Ocupación</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon purple"><i className="fa-solid fa-wheelchair"></i></div>
              <div className="kpi-data">
                <span className="kpi-value">{myParkings.filter(p => p.es_pmr).length}</span>
                <span className="kpi-label">Acceso movilidad</span>
              </div>
            </div>
          </div>
        )}
        
        {/* FORMULARIO NUEVO ESPACIO (Sólo Arrendadores) */}
        {session?.user?.rol === 'arrendador' && (
          <div className="glass-panel form-panel">
            <h3><i className="fa-solid fa-square-parking"></i> Publicar Estacionamiento</h3>
            <p className="panel-desc">Añade tu plaza a la red y comienza a generar ingresos con tu espacio disponible.</p>
            
            <form onSubmit={handleCreate} className="create-form">
              {/* 1. Ubicar espacio */}
              <div className="form-block">
                <label className="field-label">
                  <span className="field-step">1</span> ¿Dónde está tu estacionamiento?
                </label>
                <div className="input-group search-group">
                  <i className="fa-solid fa-map-pin icon"></i>
                  <input type="text" placeholder="Escribe la dirección. Ej: Av. Providencia 123" value={direccion} onChange={e => setDireccion(e.target.value)} />
                  <button type="button" onClick={handleSearchAddress} className="btn-search">Buscar</button>
                </div>
                <p className="field-hint">
                  <i className="fa-solid fa-hand-pointer" style={{ marginRight: '6px', color: '#60a5fa' }}></i>
                  También puedes <strong>tocar el mapa</strong> en el lugar exacto: la dirección se completará sola.
                </p>

                <div className="map-container">
                  <MiniMapComponent lat={lat} lng={lng} setLat={setLat} setLng={setLng} onAddressResolved={handleAddressResolved} />
                </div>
                {lat && lng && (
                  <p className="field-hint" style={{ color: '#10b981' }}>
                    <i className="fa-solid fa-circle-check" style={{ marginRight: '6px' }}></i>
                    Ubicación fijada{comuna ? ` en ${comuna}` : ''}. Ya puedes continuar.
                  </p>
                )}
              </div>
              
              {/* 2. Configurar características */}
              <div className="form-block">
                <label className="field-label">
                  <span className="field-step">2</span> Datos de tu plaza
                </label>
                <div className="input-row">
                  <div style={{ flex: 1 }}>
                    <span className="tarifa-cap"><i className="fa-solid fa-signature"></i> Nombre que verán los conductores</span>
                    <div className="input-group">
                      <i className="fa-solid fa-signature icon"></i>
                      <input type="text" placeholder="Ej: Estacionamiento Casa Centro" value={nombre} onChange={e => setNombre(e.target.value)} required />
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <span className="tarifa-cap"><i className="fa-solid fa-car"></i> Cantidad de cupos</span>
                    <div className="input-group">
                      <i className="fa-solid fa-car icon"></i>
                      <input type="number" min="1" placeholder="Ej: 3" value={totalSpots} onChange={e => setTotalSpots(e.target.value)} required />
                    </div>
                  </div>
                </div>
                
                <div className="form-group">
                  <label>Descripción</label>
                  <textarea
                    placeholder="Describe tu estacionamiento: características, acceso, instrucciones de llegada…"
                    value={descripcion}
                    onChange={e => setDescripcion(e.target.value)}
                    rows={3}
                    maxLength={500}
                    style={{width:'100%',background:'rgba(0,0,0,0.3)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'12px',color:'white',padding:'14px',fontSize:'0.9rem',resize:'vertical',fontFamily:'inherit',outline:'none',boxSizing:'border-box'}}
                  />
                </div>
                <div className="checkbox-pmr">
                  <input type="checkbox" id="pmr-check" checked={esPmr} onChange={e => setEsPmr(e.target.checked)} style={{width: '20px', height: '20px', accentColor: '#38bdf8'}} />
                  <label htmlFor="pmr-check" style={{display: 'flex', flexDirection: 'column', cursor: 'pointer'}}>
                    <span style={{color: 'white', fontSize: '1.05rem', fontWeight: 700}}><i className="fa-solid fa-wheelchair" style={{marginRight: '8px', color: '#38bdf8'}}></i> Plaza accesible para personas con movilidad reducida</span>
                    <span style={{color: '#94a3b8', fontSize: '0.85rem', marginTop: '4px'}}>Destaca este estacionamiento para usuarios con movilidad reducida.</span>
                  </label>
                </div>
              </div>
              
              {/* 3. Tarifas */}
              <div className="form-block">
                <label className="field-label">
                  <span className="field-step">3</span>
                  <i className="fa-solid fa-coins" style={{ color: '#f59e0b', margin: '0 8px' }}></i>
                  ¿Cuánto quieres cobrar? <span className="field-optional">(opcional)</span>
                </label>
                <p className="field-hint" style={{ marginTop: 0, marginBottom: '12px' }}>
                  Completa solo las tarifas que quieras ofrecer. Puedes dejarlas en blanco y definirlas después.
                  El sistema elige automáticamente la opción más conveniente para quien reserva.
                </p>
                <div className="tarifa-grid">
                  <div className="tarifa-field">
                    <span className="tarifa-cap"><i className="fa-solid fa-clock"></i> Por hora</span>
                    <div className="input-group">
                      <span className="tarifa-prefix">$</span>
                      <input type="number" min="0" placeholder="1.500" value={precioHora} onChange={e => setPrecioHora(e.target.value)} />
                    </div>
                  </div>
                  <div className="tarifa-field">
                    <span className="tarifa-cap"><i className="fa-solid fa-stopwatch"></i> Por minuto</span>
                    <div className="input-group">
                      <span className="tarifa-prefix">$</span>
                      <input type="number" min="0" placeholder="50" value={pricePerMinute} onChange={e => setPricePerMinute(e.target.value)} />
                    </div>
                  </div>
                  <div className="tarifa-field">
                    <span className="tarifa-cap"><i className="fa-solid fa-calendar-day"></i> Por día</span>
                    <div className="input-group">
                      <span className="tarifa-prefix">$</span>
                      <input type="number" min="0" placeholder="12.000" value={pricePerDay} onChange={e => setPricePerDay(e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. Vehículos admitidos */}
              <div className="form-block">
                <label className="field-label">
                  <span className="field-step">4</span>
                  <i className="fa-solid fa-car" style={{ color: '#3b82f6', margin: '0 8px' }}></i>
                  ¿Qué vehículos aceptas?
                </label>
                <p className="field-hint" style={{ marginTop: 0, marginBottom: '12px' }}>Toca para activar o desactivar cada tipo. Al menos uno debe quedar seleccionado.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px' }}>
                  {[
                    { id: 'car',        label: 'Auto',      icon: 'fa-car'           },
                    { id: 'motorcycle', label: 'Moto',      icon: 'fa-motorcycle'    },
                    { id: 'bicycle',    label: 'Bicicleta', icon: 'fa-bicycle'       },
                    { id: 'scooter',    label: 'Scooter',   icon: 'fa-person-biking' },
                  ].map(v => {
                    const active = allowedVehicleTypes.includes(v.id);
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => toggleVehicle(v.id)}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '14px 8px', borderRadius: '12px', border: active ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.08)', background: active ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)', color: active ? '#60a5fa' : '#64748b', cursor: 'pointer', transition: 'all 0.15s', fontWeight: 700, fontSize: '0.75rem' }}
                      >
                        <i className={`fa-solid ${v.icon}`} style={{ fontSize: '1.3rem' }}></i>
                        {v.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 5. Fotos */}
              <div className="form-block">
                <label className="field-label">
                  <span className="field-step">5</span>
                  <i className="fa-solid fa-camera" style={{ color: '#a78bfa', margin: '0 8px' }}></i>
                  Fotos del estacionamiento <span className="field-optional">(opcional)</span>
                </label>
                <p className="field-hint" style={{ marginTop: 0, marginBottom: '12px' }}>
                  Agrega fotos para que los conductores conozcan tu espacio. Sube varias a la vez.
                </p>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 18px', background: 'rgba(139,92,246,0.08)', border: '1px dashed rgba(139,92,246,0.3)', borderRadius: '12px', cursor: 'pointer', color: '#a78bfa', fontWeight: 700, fontSize: '0.9rem', transition: '0.2s' }}>
                  <i className="fa-solid fa-cloud-arrow-up" style={{ fontSize: '1.2rem' }}></i>
                  {uploadingPhotos ? 'Subiendo fotos...' : 'Seleccionar fotos'}
                  <input type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={e => handlePhotoUpload(e.target.files)} disabled={uploadingPhotos} />
                </label>
                {photos.length > 0 && (
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '12px' }}>
                    {photos.map((url, i) => (
                      <div key={i} style={{ position: 'relative' }}>
                        <img src={url} alt={`Foto ${i+1}`} style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)' }} />
                        <button
                          type="button"
                          onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}
                          style={{ position: 'absolute', top: '-6px', right: '-6px', width: '20px', height: '20px', borderRadius: '50%', background: '#ef4444', border: 'none', color: 'white', fontSize: '0.65rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Eliminar foto"
                        >
                          <i className="fa-solid fa-xmark"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 6. Publicar */}
              <div className="form-block">
                <button type="submit" className="btn-cyber-primary submit-btn" style={{width: '100%'}}>
                  <i className="fa-solid fa-cloud-arrow-up"></i> PUBLICAR ESTACIONAMIENTO
                </button>
              </div>
            </form>
          </div>
        )}

        {/* RESERVAS RECIBIDAS (Sólo Arrendadores) */}
        {session?.user?.rol === 'arrendador' && (
          <div className="glass-panel form-panel">
            <h3><i className="fa-solid fa-calendar-check"></i> Reservas Recibidas ({reservasRecibidas.length})</h3>
            <p className="panel-desc">Confirma o cancela tus reservas. Las que cumplen su horario se cierran solas.</p>

            {/* Resumen de disponibilidad actual */}
            {myParkings.length > 0 && (
              <div className="disp-summary">
                <span className="disp-summary-title"><i className="fa-solid fa-list-check"></i> Disponibilidad ahora</span>
                {myParkings.filter(p => p.activo !== false).map(p => {
                  const libres = Math.max((p.total_spots || 0) - (p.occupied_spots || 0), 0);
                  return (
                    <div key={p.id} className="disp-row">
                      <span className="disp-name">{p.nombre}</span>
                      <span className={`disp-pill ${libres === 0 ? 'red' : 'green'}`}>
                        {libres === 0 ? 'Sin cupos' : `${libres} libre${libres > 1 ? 's' : ''}`} · {p.occupied_spots || 0}/{p.total_spots} ocupados
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {reservasRecibidas.length === 0 ? (
              <div className="glass-panel empty-state" style={{ marginTop: '10px' }}>
                <i className="fa-solid fa-inbox"></i>
                <p>Todavía no has recibido reservas.</p>
              </div>
            ) : (
              <div className="reservas-recibidas">
                {reservasRecibidas.map(r => {
                  const intv = intervaloReserva(r);
                  return (
                  <div key={r.id} className="reserva-row">
                    <div className="reserva-info">
                      <strong>{r.estacionamiento?.nombre || 'Estacionamiento'}</strong>
                      <span><i className="fa-solid fa-clock" style={{ width: '14px', color: '#64748b' }}></i> {fmtFechaR(r.fecha_inicio)} → {fmtFechaR(r.fecha_fin)}</span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: '2px' }}>
                        <span className={`estado-badge estado-${r.estado}`}>{r.estado}</span>
                        {intv && (r.estado === 'confirmada' || r.estado === 'activa' || r.estado === 'pendiente') && (
                          <span className={`intervalo-badge ${intv.vencida ? 'vencida' : intv.futura ? 'futura' : 'activa'}`}>
                            <i className={`fa-solid ${intv.vencida ? 'fa-flag-checkered' : 'fa-hourglass-half'}`}></i> {intv.texto}
                          </span>
                        )}
                        {r.precio_total != null && (
                          <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: '0.82rem' }}>
                            ${Number(r.precio_total).toLocaleString('es-CL')}
                          </span>
                        )}
                        {r.estacionamiento?.comuna && (
                          <span style={{ color: '#64748b', fontSize: '0.8rem' }}>
                            <i className="fa-solid fa-location-dot"></i> {r.estacionamiento.comuna}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="reserva-acts">
                      {r.estado === 'pendiente' && (
                        <button onClick={() => gestionarReserva('confirmar', r.id)} className="btn-cyber-secondary action-btn">
                          <i className="fa-solid fa-check"></i> Confirmar
                        </button>
                      )}
                      {(r.estado === 'confirmada' || r.estado === 'activa') && (
                        <button onClick={() => gestionarReserva('completar', r.id)} className="btn-cyber-secondary action-btn">
                          <i className="fa-solid fa-flag-checkered"></i> Completar
                        </button>
                      )}
                      {(r.estado === 'pendiente' || r.estado === 'confirmada') && (
                        <button onClick={() => gestionarReserva('cancelar', r.id)} className="btn-delete-bulk">
                          <i className="fa-solid fa-ban"></i>
                        </button>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* INVENTARIO / MIS VEHICULOS */}
        <div className="inventory-panel">
          <div className="inventory-header">
            <div style={{ minWidth: 0 }}>
              <h3>
                {session?.user?.rol === 'arrendador' ? (
                  <><i className="fa-solid fa-warehouse"></i> Mis Estacionamientos ({myParkings.length})</>
                ) : (
                  <><i className="fa-solid fa-car"></i> Mis Vehículos ({myParkings.length})</>
                )}
              </h3>
              {session?.user?.rol === 'arrendador' && myParkings.length > 0 && (
                <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: '6px 0 0', lineHeight: 1.5 }}>
                  Aquí administras cada plaza. Usa <i className="fa-solid fa-pen-to-square" style={{ color: '#60a5fa' }}></i> para editar,
                  el <i className="fa-solid fa-eye-slash" style={{ color: '#f59e0b' }}></i> para ocultarla del mapa, y los botones
                  <strong style={{ color: '#cbd5e1' }}> − / +</strong> para indicar cuántos cupos están ocupados ahora.
                </p>
              )}
            </div>
            {myParkings.length > 0 && session?.user?.rol === 'arrendador' && (
              <div className="inventory-actions">
                <button onClick={selectAll} className="btn-cyber-secondary action-btn" aria-label={selectedIds.length === myParkings.length ? 'Desmarcar todos' : 'Seleccionar todos'}>
                  {selectedIds.length === myParkings.length ? 'Desmarcar' : 'Seleccionar'}
                </button>
                {selectedIds.length > 0 && (
                  <button onClick={handleBulkDelete} className="btn-delete-bulk" aria-label={`Borrar ${selectedIds.length} estacionamiento(s) seleccionado(s)`}>
                    <i className="fa-solid fa-trash"></i> Borrar ({selectedIds.length})
                  </button>
                )}
              </div>
            )}
          </div>

          {myParkings.length === 0 ? (
            <div className="glass-panel empty-state">
              {session?.user?.rol === 'arrendador' ? (
                <>
                  <i className="fa-solid fa-square-parking"></i>
                  <p>Aún no tienes plazas publicadas. Añade tu primer estacionamiento para comenzar a recibir reservas.</p>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-car-burst"></i>
                  <p>Aún no has registrado vehículos ni reservas.</p>
                  <button onClick={() => router.push('/mapa')} className="btn-cyber-primary" style={{marginTop: '15px'}}>
                    <i className="fa-solid fa-map-location-dot"></i> Ir al Mapa
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="parking-list">
              {myParkings.map((parking) => {
                const isFull     = parking.occupied_spots >= parking.total_spots;
                const isSelected = selectedIds.includes(parking.id);
                const isInactive = parking.activo === false;
                return (
                  <div key={parking.id} className={`glass-panel parking-item ${isSelected ? 'selected' : ''} ${isInactive ? 'inactive-parking' : ''}`}>
                    {/* ── Zona Izquierda: checkbox + info ── */}
                    <div className="item-info">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelection(parking.id)} className="custom-checkbox" />
                      <div style={{ minWidth: 0 }}>
                        <h4>
                          {parking.nombre}
                          {parking.es_pmr && <i className="fa-solid fa-wheelchair pmr-icon"></i>}
                        </h4>
                        <div className="status-badges">
                          {isInactive
                            ? <span className="badge" style={{ background: 'rgba(100,116,139,0.2)', color: '#64748b' }}>INACTIVO</span>
                            : <span className={`badge ${isFull ? 'red' : 'green'}`}>{isFull ? 'LLENO' : 'DISPONIBLE'}</span>
                          }
                          <span className="spots-info"><i className="fa-solid fa-car-side"></i> {parking.occupied_spots}/{parking.total_spots}</span>
                          {parking.precio_hora > 0 && <span className="spots-info" style={{ color: '#f59e0b' }}>${parking.precio_hora?.toLocaleString()}/hr</span>}
                        </div>
                      </div>
                    </div>

                    {/* ── Zona Derecha: controles ── */}
                    <div className="item-controls">
                      <div className="item-action-btns">
                        <button
                          onClick={() => router.push(`/estacionamiento/${parking.id}`)}
                          title="Ver perfil público y reseñas"
                          aria-label="Ver perfil público y reseñas"
                          className="ctrl-action-btn green"
                        >
                          <i className="fa-solid fa-up-right-from-square"></i>
                        </button>
                        <button
                          onClick={() => openEdit(parking)}
                          title="Editar"
                          aria-label="Editar estacionamiento"
                          className="ctrl-action-btn blue"
                        >
                          <i className="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button
                          onClick={() => handleToggleActivo(parking)}
                          title={isInactive ? 'Reactivar' : 'Desactivar'}
                          aria-label={isInactive ? 'Reactivar plaza' : 'Desactivar plaza'}
                          className={`ctrl-action-btn ${isInactive ? 'green' : 'amber'}`}
                        >
                          <i className={`fa-solid ${isInactive ? 'fa-eye' : 'fa-eye-slash'}`}></i>
                        </button>
                      </div>

                      {!isInactive && (
                        <div className="occupancy-controls">
                          <button onClick={() => updateOccupancy(parking.id, parking.occupied_spots, parking.total_spots, -1)} disabled={parking.occupied_spots === 0} className="ctrl-btn minus" aria-label="Reducir cupos ocupados">
                            <i className="fa-solid fa-minus"></i>
                          </button>
                          <strong>{parking.occupied_spots}</strong>
                          <button onClick={() => updateOccupancy(parking.id, parking.occupied_spots, parking.total_spots, 1)} disabled={isFull} className="ctrl-btn plus" aria-label="Aumentar cupos ocupados">
                            <i className="fa-solid fa-plus"></i>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .dashboard-container { padding: 30px; position: relative; max-width: 1400px; margin: 0 auto; }

        /* Reservas recibidas */
        .reservas-recibidas { display: flex; flex-direction: column; gap: 12px; }
        .reserva-row { display: flex; align-items: center; justify-content: space-between; gap: 15px; padding: 16px 18px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; flex-wrap: wrap; }
        .reserva-row:hover { border-color: rgba(59, 130, 246, 0.3); }
        .reserva-info { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .reserva-info strong { color: white; font-size: 1.05rem; }
        .reserva-info span { color: #94a3b8; font-size: 0.85rem; }
        .reserva-acts { display: flex; align-items: center; gap: 10px; }
        .estado-badge { display: inline-block; width: fit-content; padding: 2px 10px; border-radius: 20px; font-size: 0.7rem; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; }
        .estado-pendiente { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
        .estado-confirmada { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }
        .estado-activa { background: rgba(16, 185, 129, 0.15); color: #10b981; }
        .estado-completada { background: rgba(148, 163, 184, 0.15); color: #94a3b8; }
        .estado-cancelada { background: rgba(239, 68, 68, 0.15); color: #ef4444; }

        .intervalo-badge { display: inline-flex; align-items: center; gap: 5px; padding: 2px 10px; border-radius: 20px; font-size: 0.72rem; font-weight: 700; }
        .intervalo-badge.activa { background: rgba(16,185,129,0.12); color: #34d399; }
        .intervalo-badge.futura { background: rgba(59,130,246,0.12); color: #60a5fa; }
        .intervalo-badge.vencida { background: rgba(148,163,184,0.15); color: #cbd5e1; }

        /* Resumen de disponibilidad */
        .disp-summary { background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; padding: 14px 16px; margin-bottom: 18px; }
        .disp-summary-title { display: flex; align-items: center; gap: 8px; color: #94a3b8; font-size: 0.78rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }
        .disp-summary-title i { color: #60a5fa; }
        .disp-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 6px 0; border-top: 1px solid rgba(255,255,255,0.04); }
        .disp-row:first-of-type { border-top: none; }
        .disp-name { color: #e2e8f0; font-weight: 700; font-size: 0.88rem; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .disp-pill { font-size: 0.74rem; font-weight: 700; padding: 3px 10px; border-radius: 20px; white-space: nowrap; flex-shrink: 0; }
        .disp-pill.green { background: rgba(16,185,129,0.12); color: #34d399; }
        .disp-pill.red { background: rgba(239,68,68,0.12); color: #f87171; }
        
        .analytics-panel { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
        .analytics-card { display: flex; align-items: center; gap: 14px; padding: 18px 20px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; }
        .analytics-icon { width: 46px; height: 46px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; flex-shrink: 0; }
        .analytics-icon.blue { background: rgba(59,130,246,0.12); color: #60a5fa; }
        .analytics-icon.green { background: rgba(16,185,129,0.12); color: #10b981; }
        .analytics-icon.amber { background: rgba(245,158,11,0.12); color: #f59e0b; }
        .analytics-icon.purple { background: rgba(139,92,246,0.12); color: #a78bfa; }
        .analytics-data { display: flex; flex-direction: column; gap: 2px; }
        .analytics-label { font-size: 0.65rem; color: #64748b; font-weight: 700; letter-spacing: 1px; }
        .analytics-value { font-size: 1.3rem; color: #f8fafc; font-weight: 900; }
        @media (max-width: 768px) { .analytics-panel { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 480px) { .analytics-panel { grid-template-columns: 1fr; } }

        .dashboard-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 30px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 20px; flex-wrap: wrap; gap: 20px; }
        .header-titles h2 { font-size: 2.2rem; color: #3b82f6; margin: 0; font-weight: 900; letter-spacing: -1px; }
        .header-titles p { color: #94a3b8; margin: 5px 0 0 0; font-size: 0.95rem; font-weight: 600; }
        
        
        .toast-notification { position: fixed; top: 20px; right: 20px; padding: 15px 25px; border-radius: 12px; font-weight: 800; display: flex; align-items: center; gap: 10px; z-index: 9999; animation: slideLeft 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .toast-notification.success { background: #10b981; color: white; border: 2px solid #059669; }
        .toast-notification.error { background: #ef4444; color: white; border: 2px solid #b91c1c; }
        .toast-notification.syncing { background: #3b82f6; color: white; border: 2px solid #2563eb; }
        
        .dashboard-grid { display: flex; gap: 30px; align-items: flex-start; flex-wrap: wrap; }
        
        /* KPI METRICS */
        .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; width: 100%; }
        .kpi-card { display: flex; align-items: center; gap: 15px; padding: 18px 20px; background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; transition: 0.3s; }
        .kpi-card:hover { border-color: rgba(59, 130, 246, 0.2); transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.2); }
        .kpi-icon { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0; }
        .kpi-icon.blue { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }
        .kpi-icon.green { background: rgba(16, 185, 129, 0.15); color: #10b981; }
        .kpi-icon.amber { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
        .kpi-icon.purple { background: rgba(139, 92, 246, 0.15); color: #a78bfa; }
        .kpi-data { display: flex; flex-direction: column; }
        .kpi-value { font-size: 1.6rem; font-weight: 900; color: white; line-height: 1; }
        .kpi-label { font-size: 0.75rem; color: #64748b; font-weight: 600; margin-top: 3px; }
        
        .form-panel { flex: 1; min-width: 0; padding: 30px; }
        .form-panel h3 { margin: 0 0 5px 0; font-size: 1.4rem; display: flex; align-items: center; gap: 10px; }
        .panel-desc { color: #64748b; font-size: 0.85rem; margin-bottom: 25px; }
        
        .create-form { display: flex; flex-direction: column; gap: 20px; width: 100%; }
        .form-block { display: flex; flex-direction: column; gap: 15px; }
        .input-row { display: flex; flex-direction: column; gap: 15px; width: 100%; }
        .input-group { position: relative; width: 100%; background: rgba(0,0,0,0.4); border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); transition: 0.3s; }
        .input-group:focus-within { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
        .input-group .icon { position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: #64748b; }
        .input-group input { width: 100%; padding: 15px 15px 15px 45px; background: transparent; border: none; color: white; outline: none; }

        /* Etiquetas amigables de pasos */
        .field-label { display: flex; align-items: center; color: #f1f5f9; font-weight: 800; font-size: 1.02rem; margin-bottom: 8px; }
        .field-step { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 8px; background: rgba(59,130,246,0.18); color: #60a5fa; font-size: 0.82rem; font-weight: 900; margin-right: 10px; flex-shrink: 0; }
        .field-optional { color: #64748b; font-weight: 600; font-size: 0.85rem; margin-left: 6px; }
        .field-hint { color: #94a3b8; font-size: 0.82rem; line-height: 1.5; margin: 8px 0 0; }

        /* Tarifas: cada campo con su etiqueta clara, sin recortes */
        .tarifa-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .tarifa-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
        .tarifa-cap { color: #94a3b8; font-size: 0.78rem; font-weight: 700; display: flex; align-items: center; gap: 6px; white-space: nowrap; }
        .tarifa-cap i { color: #64748b; }
        .tarifa-field .input-group input { padding-left: 30px; }
        .tarifa-prefix { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #f59e0b; font-weight: 800; z-index: 1; }
        @media (max-width: 600px) { .tarifa-grid { grid-template-columns: 1fr; } }

        .search-group { display: flex; flex-direction: row; padding-right: 5px; }
        .btn-search { background: #3b82f6; color: white; border: none; border-radius: 8px; margin: 5px; padding: 0 15px; font-weight: 800; cursor: pointer; transition: 0.3s; }
        .btn-search:hover { background: #2563eb; }
        
        .map-container { height: 350px; width: 100%; border-radius: 12px; overflow: hidden; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.05); }
        
        .checkbox-pmr { display: flex; align-items: center; gap: 12px; background: rgba(56, 189, 248, 0.1); padding: 15px; border-radius: 12px; cursor: pointer; border: 1px solid rgba(56, 189, 248, 0.2); transition: 0.3s; }
        .checkbox-pmr:hover { background: rgba(56, 189, 248, 0.15); }
        .checkbox-pmr span { color: white; font-size: 0.95rem; font-weight: 700; }
        .checkbox-pmr i { color: #38bdf8; margin-right: 8px; }
        
        .submit-btn { padding: 18px; font-size: 1.1rem; border-radius: 12px; margin-top: 10px; }
        
        .inventory-panel { flex: 1.2; min-width: 0; }
        .inventory-header { display: flex; justify-content: space-between; align-items: flex-start; background: rgba(30, 41, 59, 0.6); padding: 20px; border-radius: 16px; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.05); flex-wrap: wrap; gap: 15px; }
        .inventory-header h3 { margin: 0; display: flex; align-items: center; gap: 10px; }
        .inventory-actions { display: flex; gap: 10px; }
        .action-btn { padding: 8px 15px; font-size: 0.85rem; }
        .btn-delete-bulk { padding: 8px 15px; font-size: 0.85rem; background: #dc2626; border: none; border-radius: 12px; color: white; cursor: pointer; font-weight: 900; transition: 0.3s; }
        .btn-delete-bulk:hover { background: #b91c1c; box-shadow: 0 5px 15px rgba(220, 38, 38, 0.3); }
        
        .empty-state { text-align: center; padding: 60px 20px; color: #64748b; }
        .empty-state i { font-size: 3rem; margin-bottom: 20px; opacity: 0.5; }
        .empty-state p { font-weight: 700; }
        
        .parking-list { display: flex; flex-direction: column; gap: 12px; }

        /* Card: info left, controls right; stacks vertically on narrow viewports */
        .parking-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 18px;
          gap: 14px;
          transition: 0.3s;
          flex-wrap: wrap;
        }
        .parking-item.selected { border-color: #ef4444; background: rgba(239, 68, 68, 0.05); }
        .parking-item.inactive-parking { opacity: 0.55; border-color: rgba(100,116,139,0.2); }
        .parking-item:hover { transform: translateX(4px); }

        /* Left zone */
        .item-info { display: flex; align-items: center; gap: 14px; min-width: 0; flex: 1; }
        .custom-checkbox { width: 18px; height: 18px; accent-color: #ef4444; cursor: pointer; flex-shrink: 0; }
        .item-info h4 { margin: 0 0 6px 0; font-size: 1rem; font-weight: 800; display: flex; align-items: center; }
        .pmr-icon { color: #38bdf8; margin-left: 8px; font-size: 0.85rem; }
        .status-badges { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .badge { font-size: 0.68rem; padding: 3px 9px; border-radius: 6px; font-weight: 900; white-space: nowrap; }
        .badge.green { background: rgba(16, 185, 129, 0.2); color: #10b981; }
        .badge.red { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
        .spots-info { color: #94a3b8; font-size: 0.78rem; font-weight: 700; display: flex; align-items: center; gap: 4px; white-space: nowrap; }

        /* Right zone: action buttons + occupancy in a vertical stack */
        .item-controls { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; flex-shrink: 0; }
        .item-action-btns { display: flex; gap: 6px; }
        .ctrl-action-btn { border-radius: 10px; cursor: pointer; padding: 7px 9px; font-size: 0.88rem; transition: all 0.15s; border-width: 1px; border-style: solid; }
        .ctrl-action-btn.blue { background: rgba(59,130,246,0.1); border-color: rgba(59,130,246,0.25); color: #60a5fa; }
        .ctrl-action-btn.green { background: rgba(16,185,129,0.1); border-color: rgba(16,185,129,0.25); color: #10b981; }
        .ctrl-action-btn.amber { background: rgba(245,158,11,0.1); border-color: rgba(245,158,11,0.25); color: #f59e0b; }

        /* Occupancy counter: smaller and compact */
        .occupancy-controls { display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.4); padding: 5px 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.06); }
        .ctrl-btn { background: transparent; border: none; cursor: pointer; transition: 0.3s; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 7px; font-size: 0.8rem; }
        .ctrl-btn.minus { color: #10b981; background: rgba(16, 185, 129, 0.1); }
        .ctrl-btn.plus { color: #ef4444; background: rgba(239, 68, 68, 0.1); }
        .ctrl-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .occupancy-controls strong { font-size: 1rem; color: white; min-width: 20px; text-align: center; }
        
        @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.5); opacity: 0.5; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes slideLeft { from { transform: translateX(100px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        
        .modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); backdrop-filter: blur(5px); z-index: 10000; display: flex; align-items: center; justify-content: center; animation: fadeIn 0.3s ease; }
        .modal-content { padding: 30px; max-width: 400px; text-align: center; border: 1px solid rgba(239, 68, 68, 0.3); background: rgba(15, 23, 42, 0.95); }
        .modal-content h3 { margin-top: 0; color: white; font-size: 1.4rem; }
        .modal-content p { color: #94a3b8; margin: 20px 0; }
        .modal-actions { display: flex; gap: 15px; justify-content: center; }
        .btn-cancel { background: transparent; border: 1px solid rgba(255,255,255,0.2); color: white; padding: 10px 20px; border-radius: 12px; cursor: pointer; transition: 0.3s; font-weight: 700; }
        .btn-cancel:hover { background: rgba(255,255,255,0.1); }
        
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        
        /* RESPONSIVIDAD MOBILE */
        @media (max-width: 1000px) {
          .dashboard-grid { flex-direction: column; }
          .form-panel, .inventory-panel { width: 100%; flex: none; }
        }
        
        @media (max-width: 600px) {
          .dashboard-container { padding: 15px; }
          .form-panel { padding: 20px; }
          .responsive-row { flex-direction: column; }
          .parking-item { flex-direction: column; align-items: flex-start; gap: 15px; }
          .occupancy-controls { width: 100%; justify-content: space-between; }
          .kpi-row { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </section>
  );
}