import { useState, useEffect, useCallback, useRef } from 'react';
import { useCacheStore } from '../store/cacheStore';
import { cashService } from '../services/cashService';

const CACHE_KEY = 'cash_registers';
const MIN_REFETCH_MS = 6000;

/**
 * Cache-aware cash registers hook.
 * - Returns registers instantly on 2nd+ visits (same session).
 * - Auto-refetches when Supabase Realtime invalidates cash_registers.
 * - Guards against concurrent fetches and identical-data re-renders.
 */
export const useCashRegisters = () => {
  const getCache = useCacheStore(s => s.getCache);
  const setCache = useCacheStore(s => s.setCache);
  const isCacheValid = useCacheStore(s => s._cache[CACHE_KEY]?.valid ?? false);

  const [registers, setRegisters] = useState(() => getCache(CACHE_KEY) || []);
  const [loading, setLoading] = useState(() => !getCache(CACHE_KEY));

  const isFetchingRef = useRef(false);
  const lastFetchRef = useRef(0);
  const fingerprintRef = useRef('');

  const makeFingerprint = (data) =>
    data.map(r => `${r.id}:${r.current_balance}:${r.is_active}:${r.name}:${r.type}`).join('|');

  const fetchRegisters = useCallback(async (silent = false, force = false) => {
    if (isFetchingRef.current) return;
    if (!force && Date.now() - lastFetchRef.current < MIN_REFETCH_MS) return;

    isFetchingRef.current = true;
    lastFetchRef.current = Date.now();
    if (!silent) setLoading(true);
    try {
      const data = await cashService.getRegisters();
      const fp = makeFingerprint(data);
      if (fp !== fingerprintRef.current) {
        fingerprintRef.current = fp;
        setCache(CACHE_KEY, data);
        setRegisters(data);
      }
    } catch (err) {
      console.error('[useCashRegisters] Fetch hatası:', err);
      throw err;
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [setCache]);

  useEffect(() => {
    const cached = getCache(CACHE_KEY);
    if (cached) {
      const fp = makeFingerprint(cached);
      if (fp !== fingerprintRef.current) {
        fingerprintRef.current = fp;
        setRegisters(cached);
      }
      setLoading(false);
    } else {
      fetchRegisters(false, true);
    }
  }, [isCacheValid]);

  return { registers, loading, refetch: (force = true) => fetchRegisters(false, force) };
};
