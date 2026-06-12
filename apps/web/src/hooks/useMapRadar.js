import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../lib/api';
import { useRouter } from 'next/navigation';
import { useGeolocation } from './useGeolocation';
import { supabase } from '@parkings/supabase-db';
import { toast } from 'react-hot-toast';

export function useMapRadar() {
  const { location: gpsLoc, locationSource, isLoading: isLocating, error: locError, userProfile } = useGeolocation();
  // locOverride is cleared after one load cycle so live GPS resumes automatically
  const [locOverride, setLocOverride] = useState(null);
  const userLoc = locOverride || gpsLoc;
  const [parkings, setParkings] = useState([]);
  const [radius, setRadius] = useState(5);
  const [sortOption, setSortOption] = useState('cercania');
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [isReserving, setIsReserving] = useState(false);
  const [reserveStep, setReserveStep] = useState(0);
  const [reserveError, setReserveError] = useState(null);
  const [tempLocks, setTempLocks] = useState(new Set());

  const router = useRouter();

  const fetchRadar = async (r, lat, lng) => {
    try {
      const res = await fetch(`/api/mapas/search?radius=${r}&lat=${lat}&lng=${lng}`, { cache: 'no-store' });
      const data = await res.json();
      return data.success ? data.data : [];
    } catch (e) { return []; }
  };

  const debounceRef = useRef(null);

  const loadParkings = useCallback(async (r, lat, lng) => {
    setLoading(true);
    const effectiveRadius = parseInt(r) === 100 ? 9999 : r;
    const data = await fetchRadar(effectiveRadius, lat, lng);
    setParkings(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    // Debounce location/radius changes by 400ms to prevent API flooding
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadParkings(radius, userLoc.lat, userLoc.lng);
      // Clear override after first load so live GPS resumes
      if (locOverride) setLocOverride(null);
    }, 400);

    // ─── WEBSOCKETS REALTIME SUBSCRIPTION ───
    const channel = supabase
      .channel('public:estacionamientos')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'estacionamientos' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setParkings((current) =>
              current.map((p) => (p.id === payload.new.id ? { ...p, ...payload.new } : p))
            );
            setSelectedSpot((current) =>
              current?.id === payload.new.id ? { ...current, ...payload.new } : current
            );
          } else if (payload.eventType === 'INSERT') {
            setParkings((current) => [...current, payload.new]);
          } else if (payload.eventType === 'DELETE') {
            setParkings((current) => current.filter((p) => p.id !== payload.old.id));
            setSelectedSpot((current) => current?.id === payload.old.id ? null : current);
          }
        }
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radius, userLoc.lat, userLoc.lng]);

  // ── Realtime subscription for spot_locks on current selectedSpot parking ──
  useEffect(() => {
    if (!selectedSpot) { setTempLocks(new Set()); return; }

    const load = async () => {
      try {
        const res = await fetch(`/api/mapas/locks?estacionamientoId=${selectedSpot.id}`);
        const data = await res.json();
        if (data.success) setTempLocks(new Set((data.data || []).map(l => l.spot_label)));
      } catch { /* ignore */ }
    };

    load();
    const channel = supabase.channel(`spot-locks-${selectedSpot.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'spot_locks', filter: `estacionamiento_id=eq.${selectedSpot.id}` }, load)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [selectedSpot?.id]);

  const handleReserve = async ({ spotLabel, durationHours = 1 } = {}) => {
    const { data: { session: authSession } } = await supabase.auth.getSession();
    if (!authSession?.user) {
      router.push('/auth');
      return { success: false, error: 'No autenticado.' };
    }

    setIsReserving(true);
    setReserveError(null);
    setReserveStep(1);

    try {
      const check = await api.reservas.verificarDisponibilidad(selectedSpot.id);
      if (!check.success || !check.available) {
        throw new Error('El estacionamiento ya no está disponible o está lleno.');
      }

      setReserveStep(2);

      // +30s buffer absorbs clock skew between client and Postgres now()
      const startMs = Date.now() + 30_000;
      const fecha_inicio = new Date(startMs).toISOString();
      const fecha_fin    = new Date(startMs + durationHours * 3600 * 1000).toISOString();

      const resData = await api.reservas.crearReserva({
        parking_id: selectedSpot.id,
        user_id: authSession.user.id,
        spot_label: spotLabel,
        duration_hours: durationHours,
        fecha_inicio,
        fecha_fin,
      });

      if (!resData.success) {
        throw new Error(resData.error || 'No se pudo completar la reserva.');
      }

      setReserveStep(3);
      loadParkings(radius, userLoc.lat, userLoc.lng);

      setTimeout(() => {
        setIsReserving(false);
        setReserveStep(0);
        setSelectedSpot(null);
      }, 3000);

      toast.success('¡Plaza reservada con éxito!');
      return { success: true };
    } catch (err) {
      setReserveError(err.message);
      setIsReserving(false);
      setReserveStep(0);
      toast.error(err.message || 'No se pudo completar la reserva.');
      return { success: false, error: err.message };
    }
  };

  return {
    state: { userLoc, locationSource, parkings, radius, sortOption, selectedSpot, loading, mobileMenuOpen, isReserving, reserveStep, reserveError, userProfile, tempLocks },
    actions: { setRadius, setSortOption, setSelectedSpot, setMobileMenuOpen, handleReserve, setParkingsOverride: setParkings, setLocationOverride: setLocOverride }
  };
}
