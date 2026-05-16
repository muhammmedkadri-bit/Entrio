import { useState, useEffect, useCallback, useRef } from 'react';
import { useCacheStore } from '../store/cacheStore';
import { productService } from '../services/productService';

const CACHE_KEY = 'products';
const MIN_REFETCH_MS = 6000; // Prevent auto-refetch more than once per 6 seconds

/**
 * Cache-aware products hook.
 *
 * - First visit: fetches from Supabase, stores in cache.
 * - Subsequent visits (same session): returns cached data instantly (0ms).
 * - When Supabase Realtime fires a change on `products` table:
 *   - cacheStore marks 'products' as invalid
 *   - This hook re-fetches ONLY if data actually changed (fingerprint check).
 *   - Concurrent fetches are blocked via isFetchingRef guard.
 */
export const useProducts = (filters = {}) => {
  const getCache = useCacheStore(s => s.getCache);
  const setCache = useCacheStore(s => s.setCache);

  const isCacheValid = useCacheStore(s => s._cache[CACHE_KEY]?.valid ?? false);

  const [products, setProducts] = useState(() => getCache(CACHE_KEY) || []);
  const [loading, setLoading] = useState(() => !getCache(CACHE_KEY));

  // Guards
  const isFetchingRef = useRef(false);
  const lastFetchRef = useRef(0);
  // Fingerprint: id:stock_quantity for each product to detect real changes
  const fingerprintRef = useRef('');

  const makeFingerprint = (data) =>
    data.map(p => `${p.id}:${p.stock_quantity}:${p.sale_price}`).join('|');

  const fetchProducts = useCallback(async (silent = false, force = false) => {
    // Block concurrent fetches
    if (isFetchingRef.current) return;
    // Enforce minimum interval for background auto-refetches (not forced calls)
    if (!force && Date.now() - lastFetchRef.current < MIN_REFETCH_MS) return;

    isFetchingRef.current = true;
    lastFetchRef.current = Date.now();
    if (!silent) setLoading(true);
    try {
      const data = await productService.getAll(filters);
      const fp = makeFingerprint(data);
      // Only update state if data actually changed
      if (fp !== fingerprintRef.current) {
        fingerprintRef.current = fp;
        setCache(CACHE_KEY, data);
        setProducts(data);
      }
    } catch (err) {
      console.error('[useProducts] Fetch hatası:', err);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const cached = getCache(CACHE_KEY);
    if (cached) {
      // Cache hit — only update state if data actually changed
      const fp = makeFingerprint(cached);
      if (fp !== fingerprintRef.current) {
        fingerprintRef.current = fp;
        setProducts(cached);
      }
      setLoading(false);
    } else {
      // Cache missing or invalidated by Realtime — fetch from DB
      fetchProducts(false, true); // force=true since it's an explicit invalidation
    }
  }, [isCacheValid]); // Re-runs whenever Realtime invalidates the cache

  /**
   * Optimistic stock update after a sale.
   * Immediately patches the in-memory product list so the POS grid
   * reflects the new stock without waiting for a Realtime event.
   */
  const applyStockDeduction = useCallback((soldItems) => {
    setProducts(prev => {
      const updated = prev.map(p => {
        const sold = soldItems.find(i => String(i.product_id) === String(p.id));
        if (!sold) return p;
        return {
          ...p,
          stock_quantity: Math.max(0, (Number(p.stock_quantity) || 0) - sold.quantity),
        };
      });
      const fp = makeFingerprint(updated);
      fingerprintRef.current = fp;
      setCache(CACHE_KEY, updated);
      return updated;
    });
  }, [setCache]);

  return { products, loading, refetch: (force = true) => fetchProducts(false, force), applyStockDeduction };
};
