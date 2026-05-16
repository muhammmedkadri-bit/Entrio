import { useState, useEffect, useCallback, useRef } from 'react';
import { useCacheStore } from '../store/cacheStore';
import { reportService } from '../services/reportService';
import { cashService } from '../services/cashService';
import { supabase } from '../lib/supabaseClient';
import { isSupabase } from '../config/database';
import { db } from '../db';
import { startOfDay, endOfDay, subDays } from 'date-fns';

const CACHE_KEY = 'dashboard';
const CACHE_KEY_REGISTERS = 'cash_registers';
const MIN_REFETCH_MS = 8000; // Don't auto-refetch more than once per 8 seconds

/**
 * Cache-aware dashboard data hook.
 *
 * OPTIMIZED:
 * - First visit: fetches from Supabase.
 * - Same session subsequent visits: returns cached data instantly (0ms, no re-render).
 * - Realtime invalidation → debounced (800ms in useRealtimeSync) → re-fetches ONLY
 *   if data fingerprint has actually changed → skips setState if identical.
 * - Concurrent fetch guard: only ONE fetch can run at a time.
 * - Minimum interval guard: won't auto-refetch more than once per 8 seconds.
 */
export const useDashboardData = () => {
  const getCache = useCacheStore(s => s.getCache);
  const setCache = useCacheStore(s => s.setCache);

  const isDashboardValid = useCacheStore(s => s._cache[CACHE_KEY]?.valid ?? false);
  const isRegistersValid = useCacheStore(s => s._cache[CACHE_KEY_REGISTERS]?.valid ?? false);

  const [data, setData] = useState(() => getCache(CACHE_KEY) || null);
  const [registers, setRegisters] = useState(() => getCache(CACHE_KEY_REGISTERS) || []);
  const [loading, setLoading] = useState(() => !getCache(CACHE_KEY));

  // Guards
  const isFetchingRef = useRef(false);
  const lastFetchRef = useRef(0);
  // Fingerprints for change detection
  const txFingerprintRef = useRef('');
  const regFingerprintRef = useRef('');

  const makeRegFingerprint = (regs) =>
    regs.map(r => `${r.id}:${r.current_balance}`).join('|');

  const makeTxFingerprint = (txs) =>
    txs.slice(0, 10).map(t => `${t.id}:${t.amount}`).join('|');

  const fetchData = useCallback(async (silent = false, force = false) => {
    // Block concurrent fetches
    if (isFetchingRef.current) return;
    // Enforce minimum interval for background auto-refetches
    if (!force && Date.now() - lastFetchRef.current < MIN_REFETCH_MS) return;

    isFetchingRef.current = true;
    lastFetchRef.current = Date.now();
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

      // Only update state if data actually changed
      const newTxFp = makeTxFingerprint(allTxs);
      const newRegFp = makeRegFingerprint(regs);
      const txChanged = newTxFp !== txFingerprintRef.current;
      const regChanged = newRegFp !== regFingerprintRef.current;

      if (txChanged || regChanged || force) {
        txFingerprintRef.current = newTxFp;
        regFingerprintRef.current = newRegFp;

        const dashboardData = { cashReport, salesSummary, allTxs, fetchedAt: Date.now() };
        setCache(CACHE_KEY, dashboardData);
        setCache(CACHE_KEY_REGISTERS, regs);

        if (txChanged || force) setData(dashboardData);
        if (regChanged || force) setRegisters(regs.filter(r => r.is_active !== false));
      }
    } catch (err) {
      console.error('[useDashboardData] Fetch hatası:', err);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [setCache]);

  useEffect(() => {
    const cached = getCache(CACHE_KEY);
    if (cached) {
      // Cache hit — only update state if data actually changed
      const newTxFp = makeTxFingerprint(cached.allTxs || []);
      if (newTxFp !== txFingerprintRef.current) {
        txFingerprintRef.current = newTxFp;
        setData(cached);
      }
      setLoading(false);

      const cachedRegs = getCache(CACHE_KEY_REGISTERS);
      if (cachedRegs) {
        const newRegFp = makeRegFingerprint(cachedRegs);
        if (newRegFp !== regFingerprintRef.current) {
          regFingerprintRef.current = newRegFp;
          setRegisters(cachedRegs.filter(r => r.is_active !== false));
        }
      }
    } else {
      // Cache invalidated — re-fetch with force=true since Realtime said data changed
      // Silent fetch to prevent full-page loader flash
      fetchData(true, true);
    }
  }, [isDashboardValid, isRegistersValid]);

  return {
    cashReport: data?.cashReport || null,
    salesSummary: data?.salesSummary || null,
    allTxs: data?.allTxs || [],
    registers,
    loading,
    refetch: (force = true) => fetchData(false, force),
  };
};
