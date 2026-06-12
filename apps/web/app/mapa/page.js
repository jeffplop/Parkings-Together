'use client';
import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useMapRadar } from '../../src/hooks/useMapRadar';
import { api } from '../../src/lib/api';
import { supabase } from '@parkings/supabase-db';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { REGIONES, detectarRegion } from '../../src/lib/comunas-chile';

const Map = dynamic(() => import('../../src/components/Map'), { ssr: false });
const ParkingSelector = dynamic(() => import('../../src/components/ParkingSelector'), { ssr: false });

function MapaPageInner() {
  const { state, actions } = useMapRadar();
  const searchParams = useSearchParams();
  const pendingSelectRef = useRef(null);

  // Si venimos del ranking con ?id=&lat=&lng=, recentramos el radar en esas
  // coordenadas para que el backend cargue ese estacionamiento, y lo marcamos
  // como "pendiente de seleccionar".
  useEffect(() => {
    const id = searchParams.get('id');
    const lat = parseFloat(searchParams.get('lat'));
    const lng = parseFloat(searchParams.get('lng'));
    if (!id) return;
    pendingSelectRef.current = id;
    if (!isNaN(lat) && !isNaN(lng)) actions.setLocationOverride({ lat, lng });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Cuando los estacionamientos se recargan alrededor de esa ubicación,
  // seleccionamos el pendiente en cuanto aparece.
  useEffect(() => {
    if (!pendingSelectRef.current) return;
    const found = state.parkings?.find(p => String(p.id) === String(pendingSelectRef.current));
    if (found) {
      actions.setSelectedSpot(found);
      pendingSelectRef.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.parkings]);
  const [filters, setFilters] = useState({ p2p: false, pmr: false, vehicle: null });
  const [localRadius, setLocalRadius] = useState(state.radius);
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  // En pantallas pequeñas el panel arranca contraído para no tapar el mapa.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 600) setPanelCollapsed(true);
  }, []);

  // ── Búsqueda avanzada ──
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchRegion, setSearchRegion] = useState('');
  const [searchComuna, setSearchComuna] = useState('');
  const [searchDisponible, setSearchDisponible] = useState(false);
  const [searchPrecioMin, setSearchPrecioMin] = useState('');
  const [searchPrecioMax, setSearchPrecioMax] = useState('');

  // Comunas disponibles según la región seleccionada
  const comunasDisponibles = searchRegion
    ? (REGIONES.find(r => r.id === searchRegion)?.comunas || [])
    : [];

  // Auto-detectar región desde GPS cuando el panel de búsqueda se abre
  useEffect(() => {
    if (!searchOpen || searchRegion) return;
    const { lat, lng } = state.userLoc || {};
    if (!lat || !lng) return;
    const region = detectarRegion(lat, lng);
    if (region) setSearchRegion(region.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchOpen, state.userLoc?.lat, state.userLoc?.lng]);

  // ── Selector de plaza ──
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [authToken, setAuthToken] = useState(null);

  // ── Lightbox de fotos (galería ampliada) ──
  const [lightbox, setLightbox] = useState(null); // { photos: [], index: 0 }

  // ── Reseñas del estacionamiento seleccionado ──
  const [reviews, setReviews]         = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsOpen, setReviewsOpen] = useState(false);

  // ── Mobile bottom sheet drag ──
  const sheetRef = useRef(null);
  const dragStartY = useRef(null);
  const dragStartH = useRef(null);
  const [sheetHeight, setSheetHeight] = useState(null); // null = CSS default

  const onSheetTouchStart = (e) => {
    if (e.target.closest('.reviews-body') || e.target.closest('.spot-photos')) return;
    dragStartY.current = e.touches[0].clientY;
    dragStartH.current = sheetRef.current?.offsetHeight ?? 0;
  };
  const onSheetTouchMove = (e) => {
    if (dragStartY.current === null) return;
    const dy = dragStartY.current - e.touches[0].clientY;
    const newH = Math.max(80, Math.min(window.innerHeight - 80, dragStartH.current + dy));
    setSheetHeight(newH);
  };
  const onSheetTouchEnd = () => {
    if (sheetRef.current) {
      const h = sheetRef.current.offsetHeight;
      const vh = window.innerHeight;
      if (h < 140) { actions.setSelectedSpot(null); setSheetHeight(null); }
      else if (h < vh * 0.45) setSheetHeight(Math.round(vh * 0.38));
      else if (h > vh * 0.8)  setSheetHeight(Math.round(vh * 0.88));
      else                    setSheetHeight(Math.round(vh * 0.55));
    }
    dragStartY.current = null;
  };

  // Teclado para el lightbox: Esc cierra, flechas navegan
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setLightbox(null);
      else if (e.key === 'ArrowLeft') setLightbox(lb => lb && ({ ...lb, index: (lb.index - 1 + lb.photos.length) % lb.photos.length }));
      else if (e.key === 'ArrowRight') setLightbox(lb => lb && ({ ...lb, index: (lb.index + 1) % lb.photos.length }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  // ── Favoritos ──
  const [favIds, setFavIds] = useState(new Set());
  const [favLoading, setFavLoading] = useState(false);

  // Cargar reseñas cuando cambia el estacionamiento seleccionado
  useEffect(() => {
    setSheetHeight(null); // reset drag height on new spot
    if (!state.selectedSpot) { setReviews([]); setReviewsOpen(false); return; }
    setReviewsLoading(true);
    fetch(`/api/resenas?estacionamiento_id=${state.selectedSpot.id}`)
      .then(r => r.json())
      .then(res => { if (res.success) setReviews(res.data || []); })
      .finally(() => setReviewsLoading(false));
  }, [state.selectedSpot?.id]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      setAuthToken(session.access_token);
      api.favoritos.listar().then(res => {
        if (res.success) {
          setFavIds(new Set(res.data.map(f => f.estacionamiento?.id ?? f.estacionamiento_id)));
        }
      });
    });
  }, []);

  const toggleFavorito = useCallback(async (spot) => {
    const id = spot.id;
    setFavLoading(true);
    if (favIds.has(id)) {
      await api.favoritos.quitar(id);
      setFavIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    } else {
      await api.favoritos.agregar(id);
      setFavIds(prev => new Set(prev).add(id));
    }
    setFavLoading(false);
  }, [favIds]);

  const handleBusquedaAvanzada = () => {
    const filtros = {};
    if (searchQ)        filtros.q         = searchQ;
    if (searchComuna)   filtros.comuna    = searchComuna;
    if (searchDisponible) filtros.disponible = 'true';
    if (searchPrecioMin) filtros.precioMin = searchPrecioMin;
    if (searchPrecioMax) filtros.precioMax = searchPrecioMax;
    api.mapas.buscar(filtros).then(res => {
      if (res.success) actions.setParkingsOverride?.(res.data);
    });
    setSearchOpen(false);
  };

  const handleGPS = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        actions.setLocationOverride({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      });
    }
  };

  // Convertir slider (1-5) a kms reales
  const radiusMap = { 1: 0.5, 2: 1, 3: 2, 4: 3, 5: 5 };
  
  const handleRadiusChange = (e) => {
    const val = parseInt(e.target.value);
    const km = radiusMap[val];
    setLocalRadius(km);
    actions.setRadius(km);
  };

  // Valor inverso para setear el slider desde el state (por si cambia externamente)
  const getSliderVal = (km) => {
    return Object.keys(radiusMap).find(k => radiusMap[k] === km) || 3; // default 2km -> 3
  };

  return (
    <div className="map-page-wrapper">

      {/* ── PANEL DE CONTROL UNIFICADO (Radar + Filtros, colapsable) ── */}
      <div className="radar-overlay">
        <div className={`glass-panel-strict control-panel ${panelCollapsed ? 'is-collapsed' : ''}`}>
          <div className="panel-header">
            <i className="fa-solid fa-satellite-dish pulse-icon text-green-500"></i>
            <span>Radar de Proximidad</span>
            {panelCollapsed && (
              <span className="collapsed-hint">{localRadius < 1 ? `${localRadius * 1000} m` : `${localRadius} km`}</span>
            )}
            <button
              className="btn-collapse"
              onClick={() => setPanelCollapsed(c => !c)}
              aria-label={panelCollapsed ? 'Expandir panel de control' : 'Contraer panel de control'}
              aria-expanded={!panelCollapsed}
            >
              <i className={`fa-solid fa-chevron-${panelCollapsed ? 'down' : 'up'}`}></i>
            </button>
          </div>

          {!panelCollapsed && (
          <div className="panel-content">

          {/* Indicador de precisión de ubicación */}
          {state.locationSource && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px',
              fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.5px',
              color: state.locationSource === 'gps' ? '#10b981' : state.locationSource === 'network' ? '#f59e0b' : '#94a3b8' }}>
              <i className={`fa-solid fa-${state.locationSource === 'gps' ? 'satellite' : state.locationSource === 'network' ? 'wifi' : 'globe'}`}></i>
              {state.locationSource === 'gps'     && 'GPS · Alta precisión'}
              {state.locationSource === 'network' && 'Red · Precisión media'}
              {state.locationSource === 'ip'      && 'IP · Aproximada — activa el GPS'}
              {state.locationSource === 'fallback'&& 'Sin ubicación — activa el GPS'}
            </div>
          )}

          <div className="panel-divider"></div>

          {/* Control de Alcance (Slider) */}
          <div className="control-group">
            <div className="radar-header">
              <span className="control-label">ALCANCE</span>
              <span className="control-value">{localRadius < 1 ? `${localRadius*1000} m` : `${localRadius} km`}</span>
            </div>
            <input 
              type="range" 
              min="1" 
              max="5" 
              step="1"
              value={getSliderVal(localRadius)} 
              onChange={handleRadiusChange}
              className="modern-slider"
            />
            <div className="slider-marks">
              <span>500m</span>
              <span>1k</span>
              <span>2k</span>
              <span>3k</span>
              <span>5k</span>
            </div>
          </div>

          <div className="panel-divider"></div>

          {/* Filtros Rápidos (Switches) */}
          <div className="control-group">
            <div className="filter-row">
              <span className="switch-text">Solo entre personas</span>
              <label className="modern-switch">
                <input
                  type="checkbox"
                  checked={filters.p2p}
                  onChange={(e) => setFilters({...filters, p2p: e.target.checked})}
                />
                <span className="slider round"></span>
              </label>
            </div>

            <div className="filter-row">
              <span className="switch-text text-blue-400">Acceso para movilidad reducida</span>
              <label className="modern-switch">
                <input
                  type="checkbox"
                  checked={filters.pmr}
                  onChange={(e) => setFilters({...filters, pmr: e.target.checked})}
                />
                <span className="slider round blue"></span>
              </label>
            </div>
          </div>

          <div className="panel-divider"></div>

          {/* Filtro de vehículo */}
          <div className="control-group">
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Mi vehículo</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px' }}>
              {[
                { id: 'car',        icon: 'fa-car',           label: 'Auto' },
                { id: 'motorcycle', icon: 'fa-motorcycle',    label: 'Moto' },
                { id: 'bicycle',    icon: 'fa-bicycle',       label: 'Bici' },
                { id: 'scooter',    icon: 'fa-person-biking', label: 'Scoot' },
              ].map(v => {
                const active = filters.vehicle === v.id;
                return (
                  <button
                    key={v.id}
                    title={v.label}
                    onClick={() => setFilters(f => ({ ...f, vehicle: f.vehicle === v.id ? null : v.id }))}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', padding: '8px 4px', borderRadius: '10px', border: active ? '1px solid rgba(59,130,246,0.6)' : '1px solid rgba(255,255,255,0.07)', background: active ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.03)', color: active ? '#60a5fa' : '#64748b', cursor: 'pointer', transition: 'all 0.15s', fontSize: '0.6rem', fontWeight: 700 }}
                  >
                    <i className={`fa-solid ${v.icon}`} style={{ fontSize: '0.95rem' }}></i>
                    {v.label}
                  </button>
                );
              })}
            </div>
            {filters.vehicle && (
              <button
                onClick={() => setFilters(f => ({ ...f, vehicle: null }))}
                style={{ marginTop: '8px', width: '100%', background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', color: '#475569', fontSize: '0.72rem', padding: '5px', cursor: 'pointer' }}
              >
                <i className="fa-solid fa-xmark" style={{ marginRight: '4px' }}></i> Quitar filtro
              </button>
            )}
          </div>

          <div className="panel-divider"></div>

          {/* Acordeón: Filtros avanzados (nombre, región, comuna, precio) */}
          <button
            className="accordion-toggle"
            onClick={() => setSearchOpen(o => !o)}
            aria-expanded={searchOpen}
          >
            <span><i className="fa-solid fa-sliders" style={{ marginRight: '8px', color: '#60a5fa' }}></i>Filtros avanzados</span>
            <i className={`fa-solid fa-chevron-${searchOpen ? 'up' : 'down'}`}></i>
          </button>

          {searchOpen && (
            <div className="advanced-section">
              <input
                className="search-input"
                placeholder="Nombre del estacionamiento..."
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
              />
              <select
                className="search-input"
                value={searchRegion}
                onChange={e => { setSearchRegion(e.target.value); setSearchComuna(''); }}
                style={{ marginTop: '8px' }}
              >
                <option value="">Todas las regiones</option>
                {REGIONES.map(r => (
                  <option key={r.id} value={r.id}>{r.nombre}</option>
                ))}
              </select>
              {comunasDisponibles.length > 0 && (
                <select
                  className="search-input"
                  value={searchComuna}
                  onChange={e => setSearchComuna(e.target.value)}
                  style={{ marginTop: '8px' }}
                >
                  <option value="">Todas las comunas</option>
                  {comunasDisponibles.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              )}
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <input
                  className="search-input"
                  placeholder="Precio mín"
                  type="number"
                  min="0"
                  value={searchPrecioMin}
                  onChange={e => setSearchPrecioMin(e.target.value)}
                  style={{ flex: 1 }}
                />
                <input
                  className="search-input"
                  placeholder="Precio máx"
                  type="number"
                  min="0"
                  value={searchPrecioMax}
                  onChange={e => setSearchPrecioMax(e.target.value)}
                  style={{ flex: 1 }}
                />
              </div>
              <div style={{ padding: '4px 4px 0', fontSize: '0.68rem', color: '#475569' }}>Precio / hora (CLP)</div>
              <div className="filter-row" style={{ paddingTop: '8px' }}>
                <span className="switch-text">Solo disponibles</span>
                <label className="modern-switch">
                  <input type="checkbox" checked={searchDisponible} onChange={e => setSearchDisponible(e.target.checked)} />
                  <span className="slider round"></span>
                </label>
              </div>
              <button className="btn-reserve-strict" style={{ marginTop: '12px' }} onClick={handleBusquedaAvanzada}>
                <i className="fa-solid fa-magnifying-glass"></i> Buscar
              </button>
            </div>
          )}
          </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button className="btn-gps-strict" onClick={handleGPS} aria-label="Centrar en mi ubicación">
            <i className="fa-solid fa-location-crosshairs"></i>
          </button>
        </div>
      </div>

      {/* ── Pill flotante: estacionamientos encontrados ── */}
      {!state.loading && state.parkings.length > 0 && (
        <div style={{ position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 999, background: 'rgba(15,23,42,0.88)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '99px', padding: '7px 18px', color: '#e2e8f0', fontSize: '0.8rem', fontWeight: 700, pointerEvents: 'none', whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
          <i className="fa-solid fa-square-parking" style={{ color: '#3b82f6', marginRight: 8 }}></i>
          {state.parkings.length} estacionamiento{state.parkings.length !== 1 ? 's' : ''} en el área
        </div>
      )}

      {/* ── ÁREA DEL MAPA ── */}
      <div className="map-area">
        <Map
          location={state.userLoc}
          isLoading={state.loading}
          error={state.reserveError}
          parkings={state.parkings}
          onSpotSelect={actions.setSelectedSpot}
          radius={localRadius}
          filters={filters}
          userProfile={state.userProfile}
        />
        {state.loading && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 500, textAlign: 'center', pointerEvents: 'none' }}>
            <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2rem', color: '#3b82f6', filter: 'drop-shadow(0 0 8px #3b82f6)' }}></i>
          </div>
        )}
        {!state.loading && state.parkings.length === 0 && (
          <div style={{ position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 500, background: 'rgba(15,23,42,0.9)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '12px 20px', color: '#94a3b8', fontSize: '0.85rem', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
            <i className="fa-solid fa-radar mr-2" style={{ color: '#3b82f6' }}></i>
            Sin estacionamientos en este radio — expande el radar
          </div>
        )}
      </div>

      {/* ── PANEL DE INFORMACIÓN ── */}
      {state.selectedSpot && !selectorOpen && (() => {
        const totalSpots = state.selectedSpot.total_spots || 10;
        const occupiedSpots = state.selectedSpot.occupied_spots || 0;
        const availableSpots = Math.max(totalSpots - occupiedSpots, 0);
        const isFull = availableSpots === 0;

        return (
          <div
            ref={sheetRef}
            className={`glass-panel-strict reservation-panel ${state.selectedSpot ? 'slide-in' : ''}`}
            style={sheetHeight ? { height: sheetHeight, maxHeight: 'none' } : {}}
            onTouchStart={onSheetTouchStart}
            onTouchMove={onSheetTouchMove}
            onTouchEnd={onSheetTouchEnd}
          >
            {/* Drag handle — visible on mobile only */}
            <div className="sheet-drag-handle" aria-hidden="true"><span></span></div>
            <div className="res-header">
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-square-parking" style={{ color: '#3b82f6' }}></i>
                {state.selectedSpot.nombre}
              </h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  className="btn-close-strict"
                  onClick={() => toggleFavorito(state.selectedSpot)}
                  disabled={favLoading}
                  title={favIds.has(state.selectedSpot.id) ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                  aria-label={favIds.has(state.selectedSpot.id) ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                  style={{ color: favIds.has(state.selectedSpot.id) ? '#f59e0b' : '#64748b', fontSize: '1.1rem' }}
                >
                  <i className={`fa-${favIds.has(state.selectedSpot.id) ? 'solid' : 'regular'} fa-star`}></i>
                </button>
                <button className="btn-close-strict" aria-label="Cerrar panel" onClick={() => actions.setSelectedSpot(null)}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            </div>

            <div className="res-body">
              {state.selectedSpot.photos && state.selectedSpot.photos.length > 0 && (
                <div className="spot-photos">
                  {state.selectedSpot.photos.map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      className="spot-photo-btn"
                      onClick={() => setLightbox({ photos: state.selectedSpot.photos, index: i })}
                      aria-label={`Ampliar foto ${i + 1}`}
                    >
                      <img src={url} alt={`Foto ${i+1}`} className="spot-photo" loading="lazy" onError={e => { e.target.closest('.spot-photo-btn').style.display = 'none'; }} />
                      <span className="spot-photo-zoom"><i className="fa-solid fa-magnifying-glass-plus"></i></span>
                    </button>
                  ))}
                </div>
              )}
              {state.selectedSpot.descripcion && (
                <p style={{color:'#94a3b8',fontSize:'0.85rem',lineHeight:1.6,margin:'0 0 14px',fontStyle:'italic'}}>
                  <i className="fa-solid fa-quote-left" style={{color:'#3b82f6',marginRight:'6px',fontSize:'0.7rem'}}></i>
                  {state.selectedSpot.descripcion}
                </p>
              )}
              <p className="res-row">
                <i className="fa-solid fa-user-tie" style={{ color: '#64748b', width: '16px' }}></i>
                <span style={{ color: '#cbd5e1' }}>{state.selectedSpot.arrendador || 'Estacionamiento compartido'}</span>
              </p>
              <p className="res-row">
                <i className="fa-solid fa-car" style={{ color: isFull ? '#ef4444' : '#10b981', width: '16px' }}></i>
                <span style={{ color: isFull ? '#ef4444' : '#10b981', fontWeight: 700 }}>
                  {availableSpots} disponibles
                </span>
                <span style={{ color: '#475569', fontSize: '0.8rem' }}>/ {totalSpots} totales</span>
              </p>
              {state.selectedSpot.precio_hora !== undefined && (
                <p className="res-row">
                  <i className="fa-solid fa-coins" style={{ color: '#64748b', width: '16px' }}></i>
                  <span style={{ color: '#f59e0b', fontWeight: 700 }}>
                    {state.selectedSpot.precio_hora === 0 ? 'Gratuito' : `$${state.selectedSpot.precio_hora?.toLocaleString()}/hr`}
                  </span>
                </p>
              )}
              {state.selectedSpot.comuna && (
                <p className="res-row">
                  <i className="fa-solid fa-location-dot" style={{ color: '#64748b', width: '16px' }}></i>
                  <span style={{ color: '#94a3b8' }}>{state.selectedSpot.comuna}</span>
                </p>
              )}
              {state.selectedSpot.es_pmr && (
                <div className="pmr-badge-strict" style={{ marginTop: '8px' }}>
                  <i className="fa-solid fa-wheelchair"></i> Accesible para personas con movilidad reducida
                </div>
              )}

              {/* Barra de ocupacion */}
              {(() => {
                const pct = Math.round((occupiedSpots / totalSpots) * 100);
                const barColor = pct >= 90 ? '#ef4444' : pct >= 60 ? '#f59e0b' : '#10b981';
                return (
                  <div style={{ margin: '10px 0 4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b', marginBottom: '5px' }}>
                      <span>Ocupacion</span><span style={{ color: barColor, fontWeight: 700 }}>{pct}%</span>
                    </div>
                    <div style={{ height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: '3px', transition: 'width 0.6s ease', boxShadow: `0 0 6px ${barColor}` }}></div>
                    </div>
                  </div>
                );
              })()}

              {/* ── RESEÑAS ── */}
              <div className="reviews-section">
                <button className="reviews-toggle" onClick={() => setReviewsOpen(v => !v)}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <i className="fa-solid fa-comments" style={{ color: '#3b82f6' }}></i>
                    <strong>Reseñas</strong>
                    {state.selectedSpot.reviews_count > 0 && (
                      <span className="reviews-count-badge">{state.selectedSpot.reviews_count}</span>
                    )}
                    {state.selectedSpot.rating > 0 && (
                      <span style={{ color: '#fbbf24', fontSize: '0.78rem', fontWeight: 700 }}>
                        <i className="fa-solid fa-star" style={{ fontSize: '0.7rem' }}></i> {Number(state.selectedSpot.rating).toFixed(1)}
                      </span>
                    )}
                  </span>
                  <i className={`fa-solid fa-chevron-${reviewsOpen ? 'up' : 'down'}`} style={{ color: '#475569', fontSize: '0.75rem' }}></i>
                </button>

                {reviewsOpen && (
                  <div className="reviews-body">
                    {reviewsLoading ? (
                      <div className="reviews-loading"><i className="fa-solid fa-spinner fa-spin"></i> Cargando...</div>
                    ) : reviews.length === 0 ? (
                      <div className="reviews-empty">
                        <i className="fa-regular fa-comment-dots"></i>
                        <p>Aún no hay reseñas.</p>
                        <p style={{ fontSize: '0.72rem', color: '#475569', marginTop: 6 }}>
                          Reserva y completa tu visita para poder dejar la primera reseña.
                        </p>
                      </div>
                    ) : (
                      <div className="reviews-list">
                        {reviews.map((r, i) => {
                          const nombre = r.perfil?.nombre ? `${r.perfil.nombre.split(' ')[0]}${r.perfil.apellido ? ' ' + r.perfil.apellido[0] + '.' : ''}` : 'Usuario';
                          const fecha = new Date(r.created_at).toLocaleDateString('es-CL', { month: 'short', year: 'numeric' });
                          return (
                            <div key={i} className="review-card">
                              <div className="review-header">
                                <div className="review-avatar">{nombre[0].toUpperCase()}</div>
                                <div className="review-meta">
                                  <strong>{nombre}</strong>
                                  <span className="review-date">
                                    <i className="fa-solid fa-circle-check" style={{ color: '#34d399', marginRight: 3 }}></i>
                                    Verificada · {fecha}
                                  </span>
                                </div>
                                <div className="review-stars">
                                  {[1,2,3,4,5].map(s => (
                                    <i key={s} className={`fa-${s <= r.calificacion ? 'solid' : 'regular'} fa-star`} style={{ color: s <= r.calificacion ? '#fbbf24' : '#1e293b', fontSize: '0.7rem' }}></i>
                                  ))}
                                </div>
                              </div>
                              {r.comentario && <p className="review-text">{r.comentario}</p>}
                              {r.review_photo_url && (
                                <img
                                  src={r.review_photo_url}
                                  alt="Foto de reseña"
                                  className="review-photo"
                                  onError={e => { e.target.style.display = 'none'; }}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <a
                  href={`/estacionamiento/${state.selectedSpot.id}`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '9px', borderRadius: '10px', border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.08)', color: '#c084fc', fontSize: '0.85rem', fontWeight: 700, textDecoration: 'none', marginBottom: '8px', boxSizing: 'border-box' }}
                >
                  <i className="fa-solid fa-id-card"></i> Ver perfil completo y reseñas
                </a>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${state.selectedSpot.lat},${state.selectedSpot.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '9px', borderRadius: '10px', border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.08)', color: '#60a5fa', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none', boxSizing: 'border-box', transition: 'background 0.2s' }}
                  >
                    <i className="fa-solid fa-diamond-turn-right"></i> Como llegar
                  </a>
                  <button
                    onClick={async () => {
                      const sp = state.selectedSpot;
                      const url = `https://www.google.com/maps/search/?api=1&query=${sp.lat},${sp.lng}`;
                      const texto = `${sp.nombre}${sp.comuna ? ' · ' + sp.comuna : ''}${sp.precio_hora ? ' · $' + sp.precio_hora.toLocaleString() + '/hr' : ''}`;
                      try {
                        if (navigator.share) await navigator.share({ title: sp.nombre, text: texto, url });
                        else { await navigator.clipboard.writeText(`${texto}\n${url}`); alert('Enlace copiado al portapapeles'); }
                      } catch { /* cancelado */ }
                    }}
                    aria-label="Compartir esta plaza"
                    title="Compartir"
                    style={{ flexShrink: 0, width: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#94a3b8', fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s' }}
                  >
                    <i className="fa-solid fa-share-nodes"></i>
                  </button>
                </div>
                {state.reserveError && (
                  <div style={{ color: '#f87171', fontSize: '0.82rem', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)', marginBottom: '10px', textAlign: 'center' }}>
                    {state.reserveError}
                  </div>
                )}
                <button
                  className="btn-reserve-strict"
                  disabled={isFull}
                  onClick={() => !isFull && setSelectorOpen(true)}
                  aria-label={isFull ? 'Sin disponibilidad' : 'Elegir plaza'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    fontSize: '0.9rem',
                    letterSpacing: '0.5px',
                    ...(isFull ? {
                      background: 'rgba(255,255,255,0.05)',
                      color: '#475569',
                      cursor: 'not-allowed',
                      opacity: 0.5,
                      pointerEvents: 'none',
                      border: '1px solid rgba(255,255,255,0.06)',
                    } : {}),
                  }}
                >
                  {isFull
                    ? <><i className="fa-solid fa-ban"></i> Sin disponibilidad</>
                    : <><i className="fa-solid fa-border-all"></i> ELEGIR PLAZA</>
                  }
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── MODAL SELECTOR DE PLAZA ── */}
      {selectorOpen && state.selectedSpot && (
        <ParkingSelector
          parking={state.selectedSpot}
          isReserving={state.isReserving}
          onReserve={actions.handleReserve}
          tempLocks={state.tempLocks}
          authToken={authToken}
          onClose={() => {
            setSelectorOpen(false);
            actions.setSelectedSpot(null);
          }}
        />
      )}

      {/* ── Lightbox: galería de fotos ampliada ── */}
      {lightbox && (
        <div className="lightbox-overlay" onClick={() => setLightbox(null)}>
          <button className="lightbox-close" onClick={() => setLightbox(null)} aria-label="Cerrar">
            <i className="fa-solid fa-xmark"></i>
          </button>

          {lightbox.photos.length > 1 && (
            <button
              className="lightbox-nav prev"
              onClick={(e) => { e.stopPropagation(); setLightbox(lb => ({ ...lb, index: (lb.index - 1 + lb.photos.length) % lb.photos.length })); }}
              aria-label="Foto anterior"
            >
              <i className="fa-solid fa-chevron-left"></i>
            </button>
          )}

          <img
            src={lightbox.photos[lightbox.index]}
            alt={`Foto ampliada ${lightbox.index + 1}`}
            className="lightbox-img"
            onClick={(e) => e.stopPropagation()}
          />

          {lightbox.photos.length > 1 && (
            <button
              className="lightbox-nav next"
              onClick={(e) => { e.stopPropagation(); setLightbox(lb => ({ ...lb, index: (lb.index + 1) % lb.photos.length })); }}
              aria-label="Foto siguiente"
            >
              <i className="fa-solid fa-chevron-right"></i>
            </button>
          )}

          {lightbox.photos.length > 1 && (
            <div className="lightbox-counter" onClick={(e) => e.stopPropagation()}>
              {lightbox.index + 1} / {lightbox.photos.length}
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .map-page-wrapper {
          position: relative;
          width: 100%;
          height: calc(100dvh - 96px);
          overflow: hidden;
          background: #020617;
          overscroll-behavior: none;
        }
        .map-area { position: absolute; inset: 0; overscroll-behavior: none; }

        /* === TRUE GLASSMORPHISM === */
        .glass-panel-strict {
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          color: white;
        }

        /* === RADAR OVERLAY === */
        .radar-overlay {
          position: absolute;
          top: 24px;
          left: 24px;
          z-index: 1000;
          display: flex;
          gap: 16px;
          align-items: flex-start;
          width: 320px;
        }
        
        .radar-overlay > .glass-panel-strict {
          flex: 1;
          padding: 20px;
        }
        .control-panel {
          max-height: calc(100vh - 130px);
          overflow-y: auto;
        }
        .btn-collapse {
          margin-left: auto;
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          font-size: 0.95rem;
          padding: 4px 8px;
          border-radius: 8px;
          transition: color 0.2s, background 0.2s;
        }
        .btn-collapse:hover { color: #fff; background: rgba(255,255,255,0.06); }
        .collapsed-hint {
          margin-left: auto;
          margin-right: 6px;
          font-size: 0.85rem;
          font-weight: 800;
          color: #60a5fa;
        }
        .accordion-toggle {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          color: #cbd5e1;
          font-size: 0.85rem;
          font-weight: 600;
          padding: 11px 14px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .accordion-toggle:hover {
          background: rgba(59,130,246,0.1);
          border-color: rgba(59,130,246,0.3);
          color: #fff;
        }
        .advanced-section {
          margin-top: 10px;
          animation: advDown 0.25s ease;
        }
        @keyframes advDown {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .panel-header {
          display: flex;
          align-items: center;
          gap: 10px;
          font-family: 'Inter', sans-serif;
          font-weight: 700;
          font-size: 1.05rem;
          color: #f8fafc;
        }

        .pulse-icon {
          animation: text-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes text-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .panel-divider {
          height: 1px;
          background: rgba(255, 255, 255, 0.08);
          margin: 16px 0;
        }

        /* === CONTROLS === */
        .radar-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .filter-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 12px;
        }

        .control-label {
          font-size: 0.8rem;
          color: #94a3b8;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .control-value {
          font-size: 0.9rem;
          color: #60a5fa;
          font-weight: 800;
        }

        /* Modern Slider */
        .modern-slider {
          -webkit-appearance: none;
          width: 100%;
          height: 6px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
          outline: none;
          margin: 10px 0;
        }
        .modern-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
          transition: transform 0.1s;
        }
        .modern-slider::-webkit-slider-thumb:hover { transform: scale(1.2); }
        .slider-marks {
          display: flex;
          justify-content: space-between;
          padding: 0 4px;
          font-size: 0.65rem;
          color: #64748b;
          font-weight: 600;
        }

        /* Modern Switch */
        .modern-switch {
          position: relative;
          display: inline-block;
          width: 40px;
          height: 20px;
        }
        .switch-text {
          font-size: 0.9rem;
          color: #cbd5e1;
          font-weight: 500;
        }
        .modern-switch input { opacity: 0; width: 0; height: 0; }
        .slider {
          position: absolute;
          cursor: pointer;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: rgba(255, 255, 255, 0.1);
          transition: .3s;
          border-radius: 9999px;
        }
        .slider:before {
          position: absolute;
          content: "";
          height: 16px; width: 16px;
          left: 2px; bottom: 2px;
          background-color: #cbd5e1;
          transition: .3s;
          border-radius: 50%;
        }
        input:checked + .slider { background-color: #22c55e; }
        input:checked + .slider.blue { background-color: #3b82f6; }
        input:checked + .slider:before {
          transform: translateX(20px);
          background-color: white;
        }

        /* === GPS BUTTON === */
        .btn-gps-strict {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #94a3b8;
          font-size: 1.1rem;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
        }
        .btn-gps-strict:hover {
          color: white;
          background: rgba(59, 130, 246, 0.2);
          border-color: rgba(59, 130, 246, 0.4);
        }

        /* === RESERVATION PANEL === */
        .reservation-panel {
          position: absolute;
          bottom: 24px;
          right: 24px;
          width: 320px;
          max-width: calc(100vw - 48px);
          max-height: calc(100vh - 160px);
          overflow-y: auto;
          z-index: 1000;
          animation: panelSlideIn 0.38s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
        }
        @keyframes panelSlideIn {
          from { opacity: 0; transform: translateX(110%) scale(0.96); }
          to   { opacity: 1; transform: translateX(0)   scale(1);    }
        }
        .reservation-panel.slide-in { transform: translateX(0); }
        .res-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          background: rgba(0,0,0,0.2);
          border-radius: 16px 16px 0 0;
        }
        .res-header h3 { margin: 0; font-size: 1rem; font-weight: 700; font-family: 'Inter', sans-serif; }
        .btn-close-strict {
          background: transparent; border: none; color: #64748b; cursor: pointer; font-size: 1.1rem; transition: color 0.2s;
        }
        .btn-close-strict:hover { color: white; }
        
        .res-body { padding: 14px 20px 16px; }
        .res-row { margin: 0 0 12px 0; font-size: 0.9rem; color: #cbd5e1; display: flex; align-items: center; gap: 12px; }
        .res-row i { color: #64748b; width: 16px; text-align: center; }
        .spot-photos { display: flex; gap: 8px; overflow-x: auto; margin-bottom: 14px; padding-bottom: 4px; }
        .spot-photo-btn { position: relative; padding: 0; border: none; background: none; cursor: pointer; flex-shrink: 0; border-radius: 10px; overflow: hidden; line-height: 0; }
        .spot-photo { width: 100px; height: 70px; object-fit: cover; border-radius: 10px; display: block; border: 1px solid rgba(255,255,255,0.1); transition: transform 0.3s ease; }
        .spot-photo-btn:hover .spot-photo { transform: scale(1.08); }
        .spot-photo-zoom { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: white; font-size: 1.1rem; background: rgba(2,6,23,0.45); opacity: 0; transition: opacity 0.25s; border-radius: 10px; }
        .spot-photo-btn:hover .spot-photo-zoom { opacity: 1; }

        /* === REVIEWS === */
        .reviews-section { margin: 12px 0; border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; overflow: hidden; }
        .reviews-toggle { width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: rgba(15,23,42,0.6); border: none; cursor: pointer; color: #e2e8f0; font-size: 0.85rem; transition: background 0.2s; }
        .reviews-toggle:hover { background: rgba(15,23,42,0.9); }
        .reviews-count-badge { background: rgba(59,130,246,0.2); color: #60a5fa; font-size: 0.7rem; font-weight: 800; padding: 2px 8px; border-radius: 99px; }
        .reviews-body { background: rgba(2,6,23,0.4); max-height: 280px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: #1e293b transparent; }
        .reviews-loading { text-align: center; padding: 20px; color: #475569; font-size: 0.82rem; }
        .reviews-empty { text-align: center; padding: 24px 16px; color: #334155; }
        .reviews-empty i { font-size: 1.5rem; display: block; margin-bottom: 8px; }
        .reviews-empty p { margin: 0; font-size: 0.8rem; }
        .reviews-list { display: flex; flex-direction: column; gap: 0; }
        .review-card { padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,0.04); }
        .review-card:last-child { border-bottom: none; }
        .review-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
        .review-avatar { width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg,#2563eb,#10b981); color: white; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 800; flex-shrink: 0; }
        .review-meta { flex: 1; }
        .review-meta strong { display: block; font-size: 0.8rem; color: #e2e8f0; }
        .review-date { font-size: 0.7rem; color: #475569; }
        .review-stars { display: flex; gap: 2px; }
        .review-text { margin: 0; font-size: 0.8rem; color: #94a3b8; line-height: 1.5; }
        .review-photo { width: 100%; max-height: 120px; object-fit: cover; border-radius: 8px; margin-top: 8px; }

        /* === LIGHTBOX === */
        .lightbox-overlay { position: fixed; inset: 0; z-index: 5000; background: rgba(2,6,23,0.92); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; padding: 40px; animation: lbFade 0.25s ease; cursor: zoom-out; }
        .lightbox-img { max-width: min(92vw, 1100px); max-height: 85vh; object-fit: contain; border-radius: 14px; box-shadow: 0 25px 60px rgba(0,0,0,0.7); cursor: default; animation: lbZoom 0.3s cubic-bezier(0.175,0.885,0.32,1.275); }
        .lightbox-close { position: absolute; top: 24px; right: 28px; width: 46px; height: 46px; border-radius: 50%; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15); color: white; font-size: 1.3rem; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; }
        .lightbox-close:hover { background: rgba(239,68,68,0.8); transform: rotate(90deg); }
        .lightbox-nav { position: absolute; top: 50%; transform: translateY(-50%); width: 52px; height: 52px; border-radius: 50%; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: white; font-size: 1.2rem; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; }
        .lightbox-nav:hover { background: rgba(59,130,246,0.7); }
        .lightbox-nav.prev { left: 28px; }
        .lightbox-nav.next { right: 28px; }
        .lightbox-counter { position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%); background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15); color: #e2e8f0; padding: 6px 16px; border-radius: 99px; font-size: 0.85rem; font-weight: 700; letter-spacing: 0.5px; }
        @keyframes lbFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes lbZoom { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @media (max-width: 600px) {
          .lightbox-overlay { padding: 16px; }
          .lightbox-nav { width: 42px; height: 42px; }
          .lightbox-nav.prev { left: 12px; }
          .lightbox-nav.next { right: 12px; }
        }
        
        .pmr-badge-strict {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          background: rgba(59,130,246,0.1); color: #60a5fa;
          padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(59,130,246,0.2);
          font-size: 0.8rem; font-weight: 600; width: 100%;
        }

        .btn-reserve-strict {
          width: 100%;
          background: #2563eb;
          color: white;
          font-weight: 700; font-size: 0.9rem; letter-spacing: 0.5px;
          padding: 12px; border-radius: 10px; border: none; cursor: pointer;
          transition: background 0.2s;
        }
        .btn-reserve-strict:hover { background: #1d4ed8; }

        /* Inputs de filtros avanzados (dentro del panel de control) */
        .search-input {
          width: 100%;
          padding: 10px 14px;
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          color: white;
          font-size: 0.9rem;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.2s;
        }
        .search-input:focus { border-color: rgba(59,130,246,0.5); }
        .search-input::placeholder { color: #64748b; }
        .search-input option { background: #1e293b; color: white; }

        /* === DRAG HANDLE (mobile only) === */
        .sheet-drag-handle {
          display: none;
          justify-content: center;
          padding: 10px 0 4px;
          cursor: grab;
          touch-action: none;
        }
        .sheet-drag-handle span {
          width: 36px; height: 4px;
          border-radius: 2px;
          background: rgba(255,255,255,0.2);
          display: block;
        }

        @media (max-width: 600px) {
          .sheet-drag-handle { display: flex; }
          .radar-overlay { top: 16px; left: 16px; width: calc(100% - 32px); gap: 10px; }
          .control-panel { max-height: 55vh; }
          .reservation-panel {
            bottom: 0;
            right: 0;
            left: 0;
            width: 100%;
            max-width: 100%;
            height: 55vh;
            max-height: 92vh;
            border-radius: 20px 20px 0 0;
            border-bottom: none;
            animation: panelSlideUp 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
            transition: height 0.12s ease;
          }
          @keyframes panelSlideUp {
            from { opacity: 0; transform: translateY(100%); }
            to   { opacity: 1; transform: translateY(0);    }
          }
        }
      `}</style>
    </div>
  );
}

export default function MapaPageContainer() {
  return (
    <Suspense>
      <MapaPageInner />
    </Suspense>
  );
}