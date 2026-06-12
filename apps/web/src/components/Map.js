'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';

// ── Semáforo de disponibilidad ──────────────────────────────────────────────
// Clasifica un estacionamiento por su % de ocupación real (no por nº absoluto).
//   🟢 verde  → baja ocupación  (muchas plazas)   occ < 60%
//   🟡 amarillo → ocupación media                  60% ≤ occ < 90%
//   🔴 rojo   → alta ocupación  (pocas plazas)     occ ≥ 90% o lleno
//   ⚫ gris   → sin información de cupos
export function estadoDisponibilidad(total, occupied) {
  const t = Number(total);
  const o = Number(occupied) || 0;
  if (!Number.isFinite(t) || t <= 0) {
    return { color: '#94A3B8', text: '#ffffff', cls: 'pin-unknown', nivel: 'sin-info', libres: null, pct: null };
  }
  const libres = Math.max(t - o, 0);
  const pct = Math.min(Math.max(o / t, 0), 1);
  if (libres <= 0 || pct >= 0.9) return { color: '#EF4444', text: '#ffffff', cls: 'pin-saturated', nivel: 'alta',  libres, pct };
  if (pct >= 0.6)                return { color: '#FACC15', text: '#0b1220', cls: 'pin-medium',    nivel: 'media', libres, pct };
  return { color: '#22C55E', text: '#0b1220', cls: 'pin-high', nivel: 'baja', libres, pct };
}

export default function Map({
  location,
  isLoading,
  error,
  parkings = [],
  onSpotSelect,
  radius = 5,
  filters = { p2p: false, pmr: false },
  userProfile
}) {
  const mapRef        = useRef(null); // L.Map instance
  const markerLayerRef = useRef(null);
  const radarCircleRef = useRef(null);
  const radarPulseRef  = useRef(null);
  const userMarkerRef  = useRef(null); // L.Marker for live avatar — ref, not state
  const [mapReady, setMapReady] = useState(false); // triggers userMarker effect after init
  const [userName, setUserName] = useState(null);

  // ── 1. Sync user display name ──
  useEffect(() => {
    setUserName(userProfile?.name ?? null);
  }, [userProfile]);

  // ── 2. Map init, radar and parking markers ──
  useEffect(() => {
    if (isLoading || typeof window === 'undefined') return;

    // ── Init map (once) ──
    if (!mapRef.current) {
      mapRef.current = L.map('map', { zoomControl: false })
        .setView([location.lat, location.lng], 15);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        subdomains: 'abcd',
        maxZoom: 20,
      }).addTo(mapRef.current);

      markerLayerRef.current = L.markerClusterGroup({
        maxClusterRadius: 60,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        iconCreateFunction: (cluster) => {
          const count = cluster.getChildCount();
          const size = count > 30 ? 44 : count > 10 ? 38 : 32;
          return L.divIcon({
            html: `<div style="background:rgba(59,130,246,0.85);width:${size}px;height:${size}px;border-radius:50%;border:2px solid rgba(255,255,255,0.8);box-shadow:0 0 20px rgba(59,130,246,0.5);display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:800;">${count}</div>`,
            className: 'marker-cluster-custom',
            iconSize: L.point(size, size),
          });
        },
      }).addTo(mapRef.current);

      // ── Leyenda del semáforo de disponibilidad ──
      const legend = L.control({ position: 'bottomleft' });
      legend.onAdd = () => {
        const div = L.DomUtil.create('div', 'map-legend');
        div.innerHTML = `
          <div class="legend-title"><i class="fa-solid fa-traffic-light"></i> Disponibilidad</div>
          <div class="legend-row"><span class="legend-dot" style="background:#22C55E"></span> Alta · muchas plazas</div>
          <div class="legend-row"><span class="legend-dot" style="background:#FACC15"></span> Media</div>
          <div class="legend-row"><span class="legend-dot" style="background:#EF4444"></span> Baja · casi lleno</div>
          <div class="legend-row"><span class="legend-dot" style="background:#94A3B8"></span> Sin información</div>`;
        return div;
      };
      legend.addTo(mapRef.current);

      setMapReady(true); // signal userMarker effect
    } else {
      // Map already exists — just re-center
      mapRef.current.flyTo([location.lat, location.lng], mapRef.current.getZoom(), {
        animate: true, duration: 1.0,
      });
    }

    // ── Create or update radar circles ──
    // FIX: circles are stored in refs so they survive across effect re-runs.
    // We create them once; thereafter we call setLatLng/setRadius in-place.
    if (!radarCircleRef.current) {
      radarCircleRef.current = L.circle([location.lat, location.lng], {
        color: '#1E3A8A', fillColor: '#1E3A8A', fillOpacity: 0.10, weight: 1,
      }).addTo(mapRef.current);
    }
    if (!radarPulseRef.current) {
      radarPulseRef.current = L.circle([location.lat, location.lng], {
        color: 'transparent', fillColor: '#1E3A8A', fillOpacity: 0.6,
        className: 'radar-pulse-anim',
      }).addTo(mapRef.current);
    }

    // Safe: refs are guaranteed non-null from this point
    radarCircleRef.current.setLatLng([location.lat, location.lng]);
    radarCircleRef.current.setRadius(radius * 1000);
    radarPulseRef.current.setLatLng([location.lat, location.lng]);
    radarPulseRef.current.setRadius(radius * 1000);

    // ── Rebuild parking markers ──
    if (markerLayerRef.current) markerLayerRef.current.clearLayers();

    const filteredParkings = parkings.filter(spot => {
      if (filters.p2p && !spot.arrendador) return false;
      if (filters.pmr && !spot.es_pmr)     return false;
      // Vehicle filter: hide spots that don't include the selected vehicle type.
      // Spots without allowed_vehicle_types (legacy) are always shown for backward compat.
      if (filters.vehicle && spot.allowed_vehicle_types?.length > 0
          && !spot.allowed_vehicle_types.includes(filters.vehicle)) return false;
      return true;
    });

    filteredParkings.forEach(spot => {
      const totalSpots    = spot.total_spots   || 0;
      const occupiedSpots = spot.occupied_spots || 0;

      // Semáforo por % de ocupación (verde/amarillo/rojo/gris).
      const est         = estadoDisponibilidad(totalSpots, occupiedSpots);
      const stateColor  = est.color;
      const stateClass  = est.cls;
      const spotsLeft   = est.libres;                       // null = sin info
      const innerLabel  = est.libres == null ? '·' : spotsLeft;

      const icon = L.divIcon({
        className: `custom-div-icon ${stateClass}${spot.es_pmr ? ' pin-pmr' : ''}`,
        html: `<div style="position:relative;width:26px;height:26px;">
            <div style="background:${stateColor};width:26px;height:26px;border-radius:50%;border:2px solid rgba(255,255,255,0.92);box-shadow:0 0 14px ${stateColor}90;display:flex;align-items:center;justify-content:center;color:${est.text};font-size:11px;font-weight:800;">${innerLabel}</div>
            ${spot.es_pmr ? `<span style="position:absolute;bottom:-3px;right:-3px;background:#3B82F6;border:1.5px solid #0b1220;border-radius:50%;width:14px;height:14px;display:flex;align-items:center;justify-content:center;font-size:7px;color:#fff;line-height:1;"><i class="fa-solid fa-wheelchair"></i></span>` : ''}
          </div>`,
        iconSize: [26, 26], iconAnchor: [13, 13],
      });

      const marker = L.marker([spot.lat, spot.lng], { icon });
      if (markerLayerRef.current) marker.addTo(markerLayerRef.current);

      const precio   = spot.precio_hora ? `$${spot.precio_hora.toLocaleString()}/hr` : 'Gratis';
      const safeName = (spot.nombre || '').replace(/[<>&"']/g, c =>
        ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[c]
      );

      const dispLabel = est.nivel === 'sin-info'
        ? 'Cupos no informados'
        : est.libres <= 0
          ? 'COMPLETO'
          : `${est.libres} libres · ${Math.round(est.pct * 100)}% ocupado`;

      marker.bindTooltip(`
        <div style="font-family:'Inter',sans-serif;padding:4px;">
          <strong style="font-size:14px;color:#f8fafc;">${safeName}</strong><br>
          <span style="color:#94a3b8;font-size:11px;">${precio}</span><br>
          <span style="color:${stateColor};font-weight:800;font-size:12px;display:block;margin-top:4px;">
            ${dispLabel}
          </span>
        </div>`, {
        className: 'custom-map-tooltip glass-tooltip',
        direction: 'top', offset: [0, -15], opacity: 1,
      });

      marker.on('click', () => {
        if (onSpotSelect) onSpotSelect({ ...spot, total_spots: totalSpots, occupied_spots: occupiedSpots });
      });
    });

    // Cleanup: only clear dynamic layers — do NOT destroy the map or circles.
    // The circles are updated in-place via setLatLng; destroying and re-adding
    // them on every render was the cause of the setLatLng-on-null crash.
    return () => {
      if (markerLayerRef.current) markerLayerRef.current.clearLayers();
    };
  }, [location, isLoading, parkings, onSpotSelect, radius, filters]);

  // ── Full cleanup on unmount ──
  useEffect(() => {
    return () => {
      if (radarCircleRef.current) { radarCircleRef.current.remove(); radarCircleRef.current = null; }
      if (radarPulseRef.current)  { radarPulseRef.current.remove();  radarPulseRef.current  = null; }
      if (markerLayerRef.current) { markerLayerRef.current.clearLayers(); markerLayerRef.current = null; }
      if (userMarkerRef.current)  { userMarkerRef.current.remove();  userMarkerRef.current  = null; }
      if (mapRef.current)         { mapRef.current.remove();          mapRef.current          = null; }
    };
  }, []);

  // ── 3. Live avatar marker ──
  // FIX: mapReady (state, not ref) is the correct dependency to detect when
  // the map is initialized. mapRef.current is a mutable ref — using it as a
  // dependency does NOT trigger this effect when the ref is first assigned.
  // userMarkerRef replaces useState(userMarker) to avoid stale closure issues.
  useEffect(() => {
    if (!mapReady || !mapRef.current || !location) return;

    const isReady    = userName !== null;
    const userInitial = isReady ? userName.charAt(0).toUpperCase() : '…';

    const userLiveIcon = L.divIcon({
      className: 'custom-user-pin',
      html: `<div class="user-live-marker ${!isReady ? 'loading-avatar' : ''}">${userInitial}</div>`,
      iconSize: [36, 36], iconAnchor: [18, 18],
    });

    if (!userMarkerRef.current) {
      userMarkerRef.current = L.marker([location.lat, location.lng], {
        icon: userLiveIcon, zIndexOffset: 1000,
      }).addTo(mapRef.current);
    } else {
      // Safe: ref is guaranteed non-null
      userMarkerRef.current.setLatLng([location.lat, location.lng]);
      userMarkerRef.current.setIcon(userLiveIcon);
    }
  }, [mapReady, location, userName]);

  if (error) return (
    <div className="flex h-full w-full items-center justify-center bg-[#0f172a]">
      <div className="glass-panel p-6 text-red-400 border border-red-500/20">
        <i className="fa-solid fa-triangle-exclamation mr-2"></i> Error de mapa: {error}
      </div>
    </div>
  );

  return (
    <>
      <div id="map" className="map-container shadow-2xl" />
      <style global jsx>{`
        .radar-pulse-anim { animation: radarPulse 3s ease-out infinite; transform-origin: center; }
        @keyframes radarPulse { 0% { transform: scale(0.5); fill-opacity: 0.6; } 100% { transform: scale(1.15); fill-opacity: 0; } }
        @keyframes livePulse { 0% { box-shadow: 0 0 0 0 rgba(59,130,246,0.7); } 70% { box-shadow: 0 0 0 20px rgba(59,130,246,0); } 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); } }
        .user-live-marker { display:flex; justify-content:center; align-items:center; width:36px!important; height:36px!important; background:rgba(15,23,42,0.8); backdrop-filter:blur(4px); border:2px solid #3B82F6; border-radius:9999px; color:white; font-size:16px; font-weight:700; text-transform:uppercase; animation:livePulse 2s infinite; box-shadow:0 4px 6px -1px rgba(0,0,0,.5); }
        .loading-avatar { opacity:0.5; animation:text-pulse 1.5s infinite ease-in-out; }
        @keyframes text-pulse { 0%,100% { opacity:0.4; } 50% { opacity:0.8; } }
        .pin-high { animation: pin-pulse 2s infinite; }
        .pin-saturated { opacity:0.62; }
        .pin-unknown { opacity:0.78; }
        .pin-pmr { z-index:1000!important; }
        @keyframes pin-pulse { 0% { transform:scale(1); box-shadow:0 0 0 0 rgba(34,197,94,0.7); } 70% { transform:scale(1.1); box-shadow:0 0 0 10px rgba(34,197,94,0); } 100% { transform:scale(1); box-shadow:0 0 0 0 rgba(34,197,94,0); } }

        /* ── Leyenda del semáforo ── */
        .map-legend {
          background: rgba(15,23,42,0.82);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          padding: 10px 12px;
          color: #e2e8f0;
          font-family: 'Inter', sans-serif;
          font-size: 11px;
          line-height: 1.5;
          box-shadow: 0 8px 24px rgba(0,0,0,0.4);
          margin: 0 0 12px 12px;
        }
        .map-legend .legend-title {
          font-weight: 800; font-size: 11px; color: #f8fafc;
          margin-bottom: 6px; display: flex; align-items: center; gap: 6px;
        }
        .map-legend .legend-title i { color: #60a5fa; }
        .map-legend .legend-row { display: flex; align-items: center; gap: 7px; color: #cbd5e1; }
        .map-legend .legend-dot {
          width: 11px; height: 11px; border-radius: 50%;
          border: 1.5px solid rgba(255,255,255,0.85); flex-shrink: 0;
        }
        @media (max-width: 600px) { .map-legend { display: none; } }
      `}</style>
      <style jsx>{`
        .map-container { height:100%; width:100%; min-height:300px; background-color:var(--bg-dark); overscroll-behavior:none; touch-action:none; }
      `}</style>
    </>
  );
}
