import { useState, useEffect, useCallback, useRef } from 'react';
import { useCacheStore } from '../store/cacheStore';
import { customerService } from '../services/customerService';

const CACHE_KEY = 'customers';
const MIN_REFETCH_MS = 4000;

/**
 * Cache-aware customers hook.
 * - First visit: fetches from Supabase, stores in cache.
 * - Subsequent visits: returns cached data instantly.
 * - When Supabase Realtime fires a change on `customers` table:
 *   → cacheStore marks 'customers' as invalid → this hook re-fetches.
 * - Summary (receivable/debt totals) is computed client-side from the list
 *   to avoid a second DB round-trip.
 */
export const useCustomers = (filters = {}) => {
  const getCache  = useCacheStore(s => s.getCache);
  const setCache  = useCacheStore(s => s.setCache);
  const isCacheValid = useCacheStore(s => s._cache[CACHE_KEY]?.valid ?? false);

  const [customers, setCustomers] = useState(() => getCache(CACHE_KEY) || []);
  const [loading,   setLoading]   = useState(() => !getCache(CACHE_KEY));
  const [summary,   setSummary]   = useState(null);

  const isFetchingRef = useRef(false);
  const lastFetchRef  = useRef(0);

  const computeSummary = (data) => {
    let totalReceivable = 0, totalDebt = 0;
    data.forEach(c => {
      const bal = parseFloat(c.balance) || 0;
      if (bal > 0) totalReceivable += bal;
      else if (bal < 0) totalDebt += Math.abs(bal);
    });
    return { totalCount: data.length, totalReceivable, totalDebt, netBalance: totalReceivable - totalDebt };
  };

  const fetchCustomers = useCallback(async (force = false) => {
    if (isFetchingRef.current) return;
    if (!force && Date.now() - lastFetchRef.current < MIN_REFETCH_MS) return;
    isFetchingRef.current = true;
    lastFetchRef.current = Date.now();
    setLoading(true);
    try {
      const data = await customerService.getAll(filters);
      setCache(CACHE_KEY, data);
      setCustomers(data);
      setSummary(computeSummary(data));
    } catch (err) {
      console.error('[useCustomers] Fetch hatası:', err);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [setCache]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const cached = getCache(CACHE_KEY);
    if (cached) {
      setCustomers(cached);
      setSummary(computeSummary(cached));
      setLoading(false);
    } else {
      fetchCustomers(true);
    }
  }, [isCacheValid]); // Re-runs whenever Realtime invalidates the cache

  return { customers, loading, summary, refetch: () => fetchCustomers(true) };
};
