import { useState, useEffect, useCallback } from 'react';
import { useCacheStore } from '../store/cacheStore';
import { reportService } from '../services/reportService';
import { cashService } from '../services/cashService';
import { supabase } from '../lib/supabaseClient';
import { isSupabase } from '../config/database';
import { db } from '../db';
import { startOfDay, endOfDay, subDays } from 'date-fns';

const CACHE_KEY = 'dashboard';
const CACHE_KEY_REGISTERS = 'cash_registers';

/**
 * Cache-aware dashboard data hook.
 * - Fetches cashReport, salesSummary, registers, and recent transactions in parallel.
 * - On first visit: fetches from Supabase.
 * - On subsequent visits (same session): returns cached data instantly.
 * - When Supabase Realtime fires on sales/cash_transactions: cache is invalidated,
 *   data refreshes automatically on next render cycle.
 */
export const useDashboardData = () => {
  const getCache = useCacheStore(s => s.getCache);
  const setCache = useCacheStore(s => s.setCache);

  // Subscribe to cache validity — re-run effect when Realtime invalidates
  const isDashboardValid = useCacheStore(s => s._cache[CACHE_KEY]?.valid ?? false);
  const isRegistersValid = useCacheStore(s => s._cache[CACHE_KEY_REGISTERS]?.valid ?? false);

  const [data, setData] = useState(() => getCache(CACHE_KEY) || null);
  const [registers, setRegisters] = useState(() => getCache(CACHE_KEY_REGISTERS) || []);
  const [loading, setLoading] = useState(() => !getCache(CACHE_KEY));

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const now = new Date();

      const fetchRecentTxs = async () => {
        if (isSupabase()) {
          const { data: txData } = await supabase
            .from('cash_transactions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);
          return txData || [];
        }
        return await db.cash_transactions.orderBy('created_at').reverse().limit(50).toArray();
      };

      const [cashReport, salesSummary, regs, allTxs] = await Promise.all([
        reportService.getCashReport(startOfDay(subDays(now, 6)), endOfDay(now)),
        reportService.getSalesSummary(startOfDay(now), endOfDay(now)),
        cashService.getRegisters(),
        fetchRecentTxs(),
      ]);

      const dashboardData = { cashReport, salesSummary, allTxs, fetchedAt: Date.now() };

      setCache(CACHE_KEY, dashboardData);
      setCache(CACHE_KEY_REGISTERS, regs);
      setData(dashboardData);
      setRegisters(regs.filter(r => r.is_active !== false));
    } catch (err) {
      console.error('[useDashboardData] Fetch hatası:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setCache]);

  useEffect(() => {
    const cached = getCache(CACHE_KEY);
    if (cached) {
      setData(cached);
      setLoading(false);
      const cachedRegs = getCache(CACHE_KEY_REGISTERS);
      if (cachedRegs) setRegisters(cachedRegs.filter(r => r.is_active !== false));
    } else {
      fetchData();
    }
  }, [isDashboardValid, isRegistersValid]); // Re-runs when Realtime invalidates

  return {
    cashReport: data?.cashReport || null,
    salesSummary: data?.salesSummary || null,
    allTxs: data?.allTxs || [],
    registers,
    loading,
    refetch: fetchData,
  };
};
