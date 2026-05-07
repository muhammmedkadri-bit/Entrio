import { useState, useEffect, useCallback } from 'react';
import { useCacheStore } from '../store/cacheStore';
import { categoryService } from '../services/categoryService';

const CACHE_KEY = 'categories';

/**
 * Cache-aware categories hook.
 * Categories rarely change — once loaded they're served from cache for the
 * entire session. Supabase Realtime does NOT currently monitor a 'categories'
 * table, so this data is long-lived and only refreshed on explicit refetch.
 */
export const useCategories = () => {
  const getCache = useCacheStore(s => s.getCache);
  const setCache = useCacheStore(s => s.setCache);
  const isCacheValid = useCacheStore(s => s._cache[CACHE_KEY]?.valid ?? false);

  const [categories, setCategories] = useState(() => getCache(CACHE_KEY) || []);
  const [loading, setLoading] = useState(() => !getCache(CACHE_KEY));

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const data = await categoryService.getAll();
      setCache(CACHE_KEY, data);
      setCategories(data);
    } catch (err) {
      console.error('[useCategories] Fetch hatası:', err);
    } finally {
      setLoading(false);
    }
  }, [setCache]);

  useEffect(() => {
    const cached = getCache(CACHE_KEY);
    if (cached) {
      setCategories(cached);
      setLoading(false);
    } else {
      fetchCategories();
    }
  }, [isCacheValid]);

  return { categories, loading, refetch: fetchCategories };
};
