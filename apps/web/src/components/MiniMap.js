// Archivo: apps/web/components/MiniMap.js
// ✅ REGLA 1: Eliminado import de Supabase. Solo Leaflet para el mapa interactivo.
'use client';
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

export default function MiniMap({ lat, lng, setLat, setLng, onAddressResolved }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markerRef = useRef(null);
  const onAddrRef = useRef(onAddressResolved);
  onAddrRef.current = onAddressResolved;

  // Geocodificación inversa: convierte coordenadas en una dirección legible.
  const reverseGeocode = async (latNum, lngNum) => {
    if (typeof onAddrRef.current !== 'function') return;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latNum}&lon=${lngNum}&addressdetails=1&accept-language=es`
      );
      const data = await res.json();
      const a = data?.address || {};
      // Construye "Calle 123, Comuna" de forma resiliente.
      const calle = [a.road, a.house_number].filter(Boolean).join(' ');
      const comuna = a.city || a.town || a.village || a.municipality || a.suburb || a.county || '';
      const partes = [calle, comuna].filter(Boolean);
      const texto = partes.join(', ') || data?.display_name || '';
      if (texto) onAddrRef.current(texto, comuna);
    } catch {
      /* sin red: se conserva lo que el usuario ya tuviera escrito */
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined' || mapInstance.current) return;

    const L = require('leaflet');

    const initialLat = parseFloat(lat) || -33.4489;
    const initialLng = parseFloat(lng) || -70.6693;

    mapInstance.current = L.map(mapRef.current, {
      preferCanvas: true,
      zoomControl: true,
    }).setView([initialLat, initialLng], 14);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '©OpenStreetMap',
    }).addTo(mapInstance.current);

    // Click en el mapa para colocar el pin
    mapInstance.current.on('click', (e) => {
      const { lat: clickLat, lng: clickLng } = e.latlng;
      setLat(clickLat.toFixed(6));
      setLng(clickLng.toFixed(6));
      reverseGeocode(clickLat, clickLng);

      if (markerRef.current) {
        markerRef.current.setLatLng([clickLat, clickLng]);
      } else {
        const pinIcon = L.divIcon({
          className: 'mini-map-pin',
          html: `<div style="width:20px;height:20px;background:#ef4444;border:3px solid white;border-radius:50%;box-shadow:0 0 10px #ef4444;"></div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });
        markerRef.current = L.marker([clickLat, clickLng], { icon: pinIcon }).addTo(mapInstance.current);
      }
    });

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
      markerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cuando lat/lng cambian desde fuera (búsqueda de dirección), mover el mapa
  useEffect(() => {
    if (!mapInstance.current || !lat || !lng) return;
    const L = require('leaflet');
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);

    mapInstance.current.flyTo([parsedLat, parsedLng], 16, { animate: true, duration: 1 });

    if (markerRef.current) {
      markerRef.current.setLatLng([parsedLat, parsedLng]);
    } else {
      const pinIcon = L.divIcon({
        className: 'mini-map-pin',
        html: `<div style="width:20px;height:20px;background:#ef4444;border:3px solid white;border-radius:50%;box-shadow:0 0 10px #ef4444;"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      markerRef.current = L.marker([parsedLat, parsedLng], { icon: pinIcon }).addTo(mapInstance.current);
    }
  }, [lat, lng]);

  const handleGPS = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setLat(lat.toFixed(6));
      setLng(lng.toFixed(6));
      reverseGeocode(lat, lng);
      if (mapInstance.current) {
        mapInstance.current.flyTo([lat, lng], 16, { animate: true, duration: 1 });
      }
    }, null, { enableHighAccuracy: true });
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={mapRef}
        style={{ width: '100%', height: '100%', borderRadius: '8px' }}
      />
      <button
        type="button"
        onClick={handleGPS}
        title="Usar mi ubicación GPS"
        style={{
          position: 'absolute',
          bottom: '12px',
          right: '12px',
          zIndex: 1000,
          width: '40px',
          height: '40px',
          borderRadius: '12px',
          background: 'rgba(15, 23, 42, 0.9)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          color: '#60a5fa',
          fontSize: '1rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: '0.3s',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}
        onMouseEnter={(e) => { e.target.style.background = 'rgba(59, 130, 246, 0.3)'; e.target.style.color = 'white'; }}
        onMouseLeave={(e) => { e.target.style.background = 'rgba(15, 23, 42, 0.9)'; e.target.style.color = '#60a5fa'; }}
      >
        <i className="fa-solid fa-location-crosshairs"></i>
      </button>
    </div>
  );
}