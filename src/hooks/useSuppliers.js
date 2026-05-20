import { useState, useEffect, useCallback, useRef } from 'react';
import { useCacheStore } from '../store/cacheStore';
import { supplierService } from '../services/supplierService';

const CACHE_KEY = 'suppliers';
const MIN_REFETCH_MS = 4000;

/**
 * Cache-aware suppliers hook.
 * - First visit: fetches from Supabase, stores in cache.
 * - Subsequent visits: returns cached data instantly.
 * - When Supabase Realtime fires a change on `suppliers` table:
 *   → cacheStore marks 'suppliers' as invalid → this hook re-fetches.
 */
export const useSuppliers = (filters = {}) => {
  const getCache  = useCacheStore(s => s.getCache);
  const setCache  = useCacheStore(s => s.setCache);
  const isCacheValid = useCacheStore(s => s._cache[CACHE_KEY]?.valid ?? false);

  const [suppliers, setSuppliers] = useState(() => getCache(CACHE_KEY) || []);
  const [loading,   setLoading]   = useState(() => !getCache(CACHE_KEY));
  const [summary,   setSummary]   = useState(null);

  const isFetchingRef = useRef(false);
  const lastFetchRef  = useRef(0);

  const computeSummary = (data) => {
    let totalDebt = 0, totalReceivable = 0;
    data.forEach(s => {
      const bal = parseFloat(s.balance) || 0;
      if (bal > 0) totalDebt += bal;
      else if (bal < 0) totalReceivable += Math.abs(bal);
    });
    return { totalCount: data.length, totalDebt, totalReceivable, netBalance: totalDebt - totalReceivable };
  };

  const fetchSuppliers = useCallback(async (force = false) => {
    if (isFetchingRef.current) return;
    if (!force && Date.now() - lastFetchRef.current < MIN_REFETCH_MS) return;
    isFetchingRef.current = true;
    lastFetchRef.current = Date.now();
    setLoading(true);
    try {
      const data = await supplierService.getAll(filters);
      setCache(CACHE_KEY, data);
      setSuppliers(data);
      setSummary(computeSummary(data));
    } catch (err) {
      console.error('[useSuppliers] Fetch hatası:', err);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [setCache]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const cached = getCache(CACHE_KEY);
    if (cached) {
      setSuppliers(cached);
      setSummary(computeSummary(cached));
      setLoading(false);
    } else {
      fetchSuppliers(true);
    }
  }, [isCacheValid]);

  return { suppliers, loading, summary, refetch: () => fetchSuppliers(true) };
};
