import { useState, useEffect, useCallback } from 'react';
import { useCacheStore } from '../store/cacheStore';
import { productService } from '../services/productService';

const CACHE_KEY = 'products';

/**
 * Cache-aware products hook.
 *
 * - First visit: fetches from Supabase, stores in cache.
 * - Subsequent visits (same session): returns cached data instantly (0ms).
 * - When Supabase Realtime fires a change on `products` table:
 *   - cacheStore marks 'products' as invalid
 *   - This hook detects the invalidation and re-fetches automatically.
 *
 * @param {Object} filters - Optional filters to pass to productService.getAll()
 * @returns {{ products: Array, loading: boolean, refetch: Function }}
 */
export const useProducts = (filters = {}) => {
  const getCache = useCacheStore(s => s.getCache);
  const setCache = useCacheStore(s => s.setCache);

  // Subscribe to cache validity for this key — when it goes false, we re-fetch
  const isCacheValid = useCacheStore(s => s._cache[CACHE_KEY]?.valid ?? false);

  const [products, setProducts] = useState(() => getCache(CACHE_KEY) || []);
  const [loading, setLoading] = useState(() => !getCache(CACHE_KEY));

  const fetchProducts = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await productService.getAll(filters);
      setCache(CACHE_KEY, data);
      setProducts(data);
    } catch (err) {
      console.error('[useProducts] Fetch hatası:', err);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const cached = getCache(CACHE_KEY);
    if (cached) {
      // Cache is valid — use it immediately
      setProducts(cached);
      setLoading(false);
    } else {
      // Cache missing or invalidated — fetch from DB
      fetchProducts();
    }
  }, [isCacheValid]); // Re-runs whenever Realtime invalidates the cache

  /**
   * Optimistic stock update after a sale.
   * Immediately patches the in-memory product list so the POS grid
   * reflects the new stock without waiting for a Realtime event.
   * @param {Array<{product_id, quantity}>} soldItems
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
      // Also update cache so other components see the patched data
      setCache(CACHE_KEY, updated);
      return updated;
    });
  }, [setCache]);

  return { products, loading, refetch: fetchProducts, applyStockDeduction };
};
