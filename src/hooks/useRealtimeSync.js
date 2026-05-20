import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useCacheStore } from '../store/cacheStore';

/**
 * App-level Supabase Realtime sync hook.
 * Mount ONCE in App.jsx — creates a single WebSocket channel for all table changes.
 *
 * OPTIMIZED: Realtime events are debounced per cache-key group (800ms window).
 * This prevents a burst of DB events (e.g. 10 sale_items inserted at once)
 * from triggering 10 separate re-fetches. Only ONE invalidation fires per group.
 */

// Map: supabase table name → cache store keys to invalidate
const TABLE_CACHE_MAP = {
  products:              ['products'],
  sales:                 ['sales', 'dashboard'],
  cash_transactions:     ['cash_transactions', 'dashboard'],
  cash_registers:        ['cash_registers'],
  customers:             ['customers'],
  suppliers:             ['suppliers'],
  purchases:             ['purchases'],
  categories:            ['categories'],
  customer_transactions: ['customer_transactions'],
  supplier_transactions: ['supplier_transactions'],
  purchase_items:        ['purchases'],
};

const DEBOUNCE_MS = 800; // batch events in 800ms window

export const useRealtimeSync = () => {
  const invalidateMany = useCacheStore(s => s.invalidateMany);
  const clearAll = useCacheStore(s => s.clearAll);
  const channelRef = useRef(null);
  // Per-group debounce timers — keyed by sorted cache keys string
  const timersRef = useRef({});

  useEffect(() => {
    const debouncedInvalidate = (keys) => {
      const groupKey = [...keys].sort().join(',');
      if (timersRef.current[groupKey]) clearTimeout(timersRef.current[groupKey]);
      timersRef.current[groupKey] = setTimeout(() => {
        invalidateMany(keys);
        delete timersRef.current[groupKey];
      }, DEBOUNCE_MS);
    };

    // Build a single channel that listens to all relevant tables
    const channel = supabase.channel('entrio-global-realtime', {
      config: { broadcast: { self: false } },
    });

    // Subscribe to each table with debounced invalidation
    for (const [table, cacheKeys] of Object.entries(TABLE_CACHE_MAP)) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => {
          debouncedInvalidate(cacheKeys);
        }
      );
    }

    // Handle connection status
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[Realtime] ✅ Bağlantı kuruldu — tüm tablolar dinleniyor');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('[Realtime] ⚠️ Bağlantı hatası — tüm cache geçersiz kılınıyor');
        clearAll();
      } else if (status === 'CLOSED') {
        console.log('[Realtime] Bağlantı kapatıldı');
      }
    });

    channelRef.current = channel;

    return () => {
      // Clear all pending debounce timers
      Object.values(timersRef.current).forEach(clearTimeout);
      timersRef.current = {};
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []); // Only runs once on mount
};
