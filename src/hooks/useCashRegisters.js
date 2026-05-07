import { useState, useEffect, useCallback } from 'react';
import { useCacheStore } from '../store/cacheStore';
import { cashService } from '../services/cashService';

const CACHE_KEY = 'cash_registers';

/**
 * Cache-aware cash registers hook.
 * - Returns registers instantly on 2nd+ visits (same session).
 * - Auto-refetches when Supabase Realtime invalidates cash_registers.
 * - Used by CashPage, Dashboard header, POS payment panel, etc.
 */
export const useCashRegisters = () => {
  const getCache = useCacheStore(s => s.getCache);
  const setCache = useCacheStore(s => s.setCache);
  const isCacheValid = useCacheStore(s => s._cache[CACHE_KEY]?.valid ?? false);

  const [registers, setRegisters] = useState(() => getCache(CACHE_KEY) || []);
  const [loading, setLoading] = useState(() => !getCache(CACHE_KEY));

  const fetchRegisters = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await cashService.getRegisters();
      setCache(CACHE_KEY, data);
      setRegisters(data);
    } catch (err) {
      console.error('[useCashRegisters] Fetch hatası:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setCache]);

  useEffect(() => {
    const cached = getCache(CACHE_KEY);
    if (cached) {
      setRegisters(cached);
      setLoading(false);
    } else {
      fetchRegisters();
    }
  }, [isCacheValid]);

  return { registers, loading, refetch: fetchRegisters };
};
