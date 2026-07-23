import { useState, useEffect, useCallback, useRef } from 'react';
import { useCacheStore } from '../store/cacheStore';
import { purchaseService } from '../services/purchaseService';
import { supplierService } from '../services/supplierService';

const CACHE_KEY = 'purchases';
const MIN_REFETCH_MS = 4000;

/**
 * Cache-aware purchases hook.
 * - First visit: fetches from Supabase, stores in cache.
 * - Subsequent visits: returns cached data instantly.
 * - When Supabase Realtime fires a change on `purchases` table:
 *   → cacheStore marks 'purchases' as invalid → this hook re-fetches.
 * - Month summary and highest-debt supplier are computed on fetch.
 */
export const usePurchases = () => {
  const getCache  = useCacheStore(s => s.getCache);
  const setCache  = useCacheStore(s => s.setCache);
  const isCacheValid      = useCacheStore(s => s._cache[CACHE_KEY]?.valid ?? false);
  const isSuppliersValid  = useCacheStore(s => s._cache['suppliers']?.valid ?? false);

  const [purchases, setPurchases] = useState(() => {
    const cached = getCache(CACHE_KEY);
    return Array.isArray(cached) ? cached : [];
  });
  const [loading, setLoading] = useState(() => {
    const cached = getCache(CACHE_KEY);
    return !Array.isArray(cached);
  });
  const [summary,          setSummary]          = useState({ count: 0, totalAmount: 0, paidAmount: 0, pendingDebt: 0 });
  const [highestDebtInfo,  setHighestDebtInfo]  = useState({ name: 'Yok', amount: 0 });

  const isFetchingRef = useRef(false);
  const lastFetchRef  = useRef(0);

  const fetchAll = useCallback(async (force = false) => {
    if (isFetchingRef.current) return;
    if (!force && Date.now() - lastFetchRef.current < MIN_REFETCH_MS) return;
    isFetchingRef.current = true;
    lastFetchRef.current = Date.now();
    setLoading(true);
    try {
      const [data, sum, sups] = await Promise.all([
        purchaseService.getAll(),
        purchaseService.getMonthSummary(),
        supplierService.getAll(),
      ]);
      const validData = Array.isArray(data) ? data : [];
      setCache(CACHE_KEY, validData);
      setPurchases(validData);
      setSummary(sum || { count: 0, totalAmount: 0, paidAmount: 0, pendingDebt: 0 });

      let maxDebt = 0, maxName = 'Yok';
      if (Array.isArray(sups)) {
        sups.forEach(s => { if (s.balance > maxDebt) { maxDebt = s.balance; maxName = s.name; } });
      }
      setHighestDebtInfo({ name: maxName, amount: maxDebt });
    } catch (err) {
      console.error('[usePurchases] Fetch hatası:', err);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [setCache]);

  useEffect(() => {
    const cached = getCache(CACHE_KEY);
    if (Array.isArray(cached)) {
      setPurchases(cached);
      setLoading(false);
    } else {
      fetchAll(true);
    }
  }, [isCacheValid, fetchAll, getCache]);

  // Also re-fetch when suppliers change (highest-debt info may be outdated)
  useEffect(() => {
    if (isSuppliersValid === false) fetchAll(true);
  }, [isSuppliersValid, fetchAll]);

  return { purchases, loading, summary, highestDebtInfo, refetch: () => fetchAll(true) };
};
