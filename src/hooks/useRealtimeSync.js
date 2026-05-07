import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useCacheStore } from '../store/cacheStore';

/**
 * App-level Supabase Realtime sync hook.
 * Mount ONCE in App.jsx — creates a single WebSocket channel for all table changes.
 *
 * When a DB change arrives:
 *  - The corresponding cache key(s) are invalidated.
 *  - The next component that needs that data will automatically re-fetch.
 *
 * Works across multiple tabs: each tab has its own WebSocket connection to Supabase,
 * so all tabs receive the same events and stay in sync independently.
 */

// Map: supabase table name → cache store keys to invalidate
const TABLE_CACHE_MAP = {
  products:          ['products'],
  sales:             ['sales', 'dashboard'],
  cash_transactions: ['cash_transactions', 'dashboard'],
  cash_registers:    ['cash_registers'],
  customers:         ['customers'],
  suppliers:         ['suppliers'],
  purchases:         ['purchases'],
};

export const useRealtimeSync = () => {
  const invalidateMany = useCacheStore(s => s.invalidateMany);
  const clearAll = useCacheStore(s => s.clearAll);
  const channelRef = useRef(null);

  useEffect(() => {
    // Build a single channel that listens to all relevant tables
    const channel = supabase.channel('entrio-global-realtime', {
      config: { broadcast: { self: false } },
    });

    // Subscribe to each table
    for (const [table, cacheKeys] of Object.entries(TABLE_CACHE_MAP)) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => {
          invalidateMany(cacheKeys);
        }
      );
    }

    // Handle connection status
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[Realtime] ✅ Bağlantı kuruldu — tüm tablolar dinleniyor');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('[Realtime] ⚠️ Bağlantı hatası — tüm cache geçersiz kılınıyor');
        // Safety: if connection drops, invalidate everything so stale data is never shown
        clearAll();
      } else if (status === 'CLOSED') {
        console.log('[Realtime] Bağlantı kapatıldı');
      }
    });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []); // Only runs once on mount
};
