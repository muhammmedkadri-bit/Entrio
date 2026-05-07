import { create } from 'zustand';

/**
 * Global in-memory cache store.
 * - Data is stored per "key" (usually table name or derived key).
 * - Cache is purely in-memory: cleared on browser tab close/refresh.
 * - Supabase Realtime events call invalidate() to mark entries stale.
 * - Components call getOrFetch() to get cached data or trigger a fresh fetch.
 */
export const useCacheStore = create((set, get) => ({
  _cache: {},

  /** Store fetched data for a key. Marks it as valid. */
  setCache: (key, data) =>
    set(state => ({
      _cache: {
        ...state._cache,
        [key]: { data, fetchedAt: Date.now(), valid: true },
      },
    })),

  /** Read cached data. Returns null if missing or invalidated. */
  getCache: (key) => {
    const entry = get()._cache[key];
    if (!entry || !entry.valid) return null;
    return entry.data;
  },

  /**
   * Mark a key as invalid (stale).
   * Next component that needs this data will re-fetch from Supabase.
   */
  invalidate: (key) =>
    set(state => {
      const entry = state._cache[key];
      if (!entry) return state;
      return {
        _cache: {
          ...state._cache,
          [key]: { ...entry, valid: false },
        },
      };
    }),

  /** Invalidate multiple keys at once */
  invalidateMany: (keys) =>
    set(state => {
      const updated = { ...state._cache };
      for (const key of keys) {
        if (updated[key]) updated[key] = { ...updated[key], valid: false };
      }
      return { _cache: updated };
    }),

  /** Clear everything (on logout) */
  clearAll: () => set({ _cache: {} }),
}));
