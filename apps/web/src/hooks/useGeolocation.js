import { useState, useEffect } from 'react';
import { supabase } from '@parkings/supabase-db';

// Estrategia de localización en 3 fases:
// 1. getCurrentPosition rápido (baja precisión, timeout 4s) → mueve el mapa de inmediato
// 2. watchPosition alta precisión → refina cuando GPS esté disponible
// 3. Fallback IP → si el navegador rechaza permisos, consulta ip-api.com (sin API key)
// El fallback fijo de Santiago solo se usa si todo lo anterior falla.

const FALLBACK_SANTIAGO = { lat: -33.4489, lng: -70.6693 }; // Centro de Santiago (más preciso)

async function getLocationByIP() {
  try {
    const res = await fetch('https://ip-api.com/json/?fields=lat,lon,status', { signal: AbortSignal.timeout(4000) });
    const data = await res.json();
    if (data.status === 'success') return { lat: data.lat, lng: data.lon };
  } catch { /* silencioso */ }
  return null;
}

export function useGeolocation() {
  const [location, setLocation] = useState(null); // null hasta que resuelva
  const [locationSource, setLocationSource] = useState(null); // 'gps'|'network'|'ip'|'fallback'
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    // ── Perfil de usuario (independiente de la geolocalización) ──
    const loadProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        let resolvedName = null;
        try {
          const { data: profile } = await supabase
            .from('perfiles').select('nombre').eq('id', session.user.id).single();
          if (profile?.nombre) resolvedName = profile.nombre;
        } catch { /* fallback abajo */ }

        if (!resolvedName) {
          resolvedName =
            session.user.user_metadata?.nombre ||
            session.user.user_metadata?.full_name ||
            session.user.email?.split('@')[0] ||
            'Usuario';
        }
        setUserProfile({ name: resolvedName, session });
      } catch { setUserProfile(null); }
    };
    loadProfile();

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      // Sin API de geolocalización → intentar IP
      getLocationByIP().then(loc => {
        setLocation(loc || FALLBACK_SANTIAGO);
        setLocationSource(loc ? 'ip' : 'fallback');
        setIsLoading(false);
      });
      return;
    }

    let resolved = false;
    let watchId = null;

    // Fase 1: lectura rápida baja precisión para mostrar el mapa sin esperar
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!resolved) {
          resolved = true;
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocationSource(pos.coords.accuracy <= 100 ? 'gps' : 'network');
          setIsLoading(false);
        }
      },
      async (err) => {
        // Permiso denegado o timeout → fallback IP
        if (!resolved) {
          resolved = true;
          if (err.code === err.PERMISSION_DENIED) {
            setError('Permiso de ubicación denegado. Mostrando ubicación aproximada.');
          }
          const ipLoc = await getLocationByIP();
          setLocation(ipLoc || FALLBACK_SANTIAGO);
          setLocationSource(ipLoc ? 'ip' : 'fallback');
          setIsLoading(false);
        }
      },
      { enableHighAccuracy: false, timeout: 4000, maximumAge: 30000 }
    );

    // Fase 2: watch alta precisión → refina la posición en cuanto GPS esté disponible
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const acc = pos.coords.accuracy;
        // Solo actualizamos si mejora la precisión (< 80m = GPS real)
        setLocation(prev => {
          if (!prev || acc < 80) return { lat: pos.coords.latitude, lng: pos.coords.longitude };
          return prev;
        });
        if (acc < 80) setLocationSource('gps');
        if (!resolved) {
          resolved = true;
          setIsLoading(false);
        }
      },
      () => { /* silencioso; Fase 1 ya manejó el error */ },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // Mientras resuelve la ubicación, usar Santiago como placeholder (no null)
  const effectiveLocation = location || FALLBACK_SANTIAGO;

  return { location: effectiveLocation, locationSource, error, isLoading, userProfile };
}
