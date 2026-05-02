import { db } from '../db';
import { isSupabase } from '../config/database';
import { supabase } from '../lib/supabaseClient';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

export const dayCloseService = {
  getLocalDateStr() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  },

  getLocalDateTimeStr() {
    return new Date().toISOString();
  },

  formatDateTR(dateStr) {
    if (!dateStr) return '';
    try { return format(new Date(dateStr), 'd MMMM yyyy', { locale: tr }); } catch { return dateStr; }
  },

  isAlreadyClosedToday(register) {
    return register.last_day_close_date === this.getLocalDateStr();
  },

  async needsDayClose() {
    const today = this.getLocalDateStr();
    if (isSupabase()) {
      const { data } = await supabase.from('cash_registers').select('last_day_close_date').eq('is_active', true);
      return (data || []).some(r => r.last_day_close_date !== today);
    }
    const registers = await db.cash_registers.filter(r => r.is_active !== false).toArray();
    return registers.some(r => r.last_day_close_date !== today);
  },

  async getRegisterTransactionsForToday(register) {
    const today = this.getLocalDateStr();
    const todayStartMs = new Date(); todayStartMs.setHours(0, 0, 0, 0);

    let fromMs;
    if (!register.last_day_close_date || register.last_day_close_date < today) {
      fromMs = todayStartMs.getTime();
    } else {
      fromMs = register.last_day_close_at
        ? (typeof register.last_day_close_at === 'number' ? register.last_day_close_at : new Date(register.last_day_close_at).getTime())
        : todayStartMs.getTime();
    }

    if (isSupabase()) {
      const { data, error } = await supabase.from('cash_transactions')
        .select('*').eq('register_id', register.id)
        .gt('created_at', fromMs).neq('is_day_close', true);
      if (error) throw error;
      return data || [];
    }

    const txs = await db.cash_transactions.where('register_id').equals(register.id).toArray();
    return txs.filter(t => new Date(t.created_at).getTime() > fromMs && !t.is_day_close);
  },

  async performDayClose({ isAuto = false, triggeredBy = 'manual', previewOnly = false }) {
    const today = this.getLocalDateStr();
    const now = this.getLocalDateTimeStr();

    // ── Preview veya Dexie için registerleri getir ────────────────────────
    let activeRegisters;
    if (isSupabase()) {
      const { data, error } = await supabase.from('cash_registers').select('*').eq('is_active', true);
      if (error) throw error;
      activeRegisters = data || [];
    } else {
      activeRegisters = await db.cash_registers.filter(r => r.is_active !== false).toArray();
    }

    if (activeRegisters.length === 0) throw new Error('Aktif kasa bulunamadı');

    const registerSummaries = [];
    let totalDailyNet = 0, totalIncome = 0, totalExpense = 0, totalTransactionsCount = 0;
    const incomeTypes  = ['sale_in', 'customer_payment_in', 'deposit_in', 'opening', 'transfer_in', 'return_in'];
    const expenseTypes = ['purchase_out', 'supplier_payment_out', 'expense_out', 'withdrawal_out', 'transfer_out', 'return_out'];

    for (const register of activeRegisters) {
      const transactions = await this.getRegisterTransactionsForToday(register);
      totalTransactionsCount += transactions.length;
      const income  = transactions.filter(t => incomeTypes.includes(t.transaction_type)  || t.transaction_type === 'in').reduce((s, t) => s + Number(t.amount), 0);
      const expense = transactions.filter(t => expenseTypes.includes(t.transaction_type) || t.transaction_type === 'out').reduce((s, t) => s + Number(t.amount), 0);
      const dailyNet = (Number(register.current_balance) || 0) - (Number(register.general_balance) || 0);
      registerSummaries.push({ register_id: register.id, register_name: register.name, opening_balance: Number(register.general_balance) || 0, closing_balance: Number(register.current_balance) || 0, income, expense, daily_net: dailyNet, transaction_count: transactions.length });
      totalDailyNet += dailyNet;
      totalIncome   += income;
      totalExpense  += expense;
    }

    const netCashflow = totalIncome - totalExpense;

    if (previewOnly) {
      return { success: true, date: today, isAuto, totalIncome, totalExpense, netCashflow, totalDailyNet, registerCount: activeRegisters.length, registerSummaries };
    }

    if (totalTransactionsCount === 0) {
      console.log('Kapatılacak yeni bir işlem bulunamadı.');
      return null;
    }

    // ── Supabase: RPC ile atomik gün sonu ────────────────────────────────
    if (isSupabase()) {
      const { data, error } = await supabase.rpc('perform_day_close', {
        p_is_auto:      isAuto,
        p_triggered_by: triggeredBy
      });
      if (error) throw error;
      return { success: true, date: today, isAuto, totalIncome: Number(data.total_income), totalExpense: Number(data.total_expense), netCashflow: Number(data.net_cashflow), totalDailyNet: Number(data.total_daily_net), registerCount: activeRegisters.length, registerSummaries: data.register_summaries || registerSummaries };
    }

    // ── Dexie fallback ────────────────────────────────────────────────────
    await db.transaction('rw', db.cash_registers, db.cash_transactions, async () => {
      for (const summary of registerSummaries) {
        await db.cash_registers.update(summary.register_id, {
          general_balance: summary.closing_balance,
          last_day_close_date: today,
          last_day_close_at: now
        });
      }
      const primaryRegisterId = activeRegisters[0].id;
      const dayCloseData = { date: today, triggered_at: now, trigger_type: triggeredBy, is_auto: isAuto, total_income: Math.round(totalIncome * 100) / 100, total_expense: Math.round(totalExpense * 100) / 100, net_cashflow: Math.round(netCashflow * 100) / 100, total_daily_net: Math.round(totalDailyNet * 100) / 100, register_summaries: registerSummaries };
      const description = isAuto ? `${this.formatDateTR(today)} Otomatik Gün Sonu` : `${this.formatDateTR(today)} Manuel Gün Sonu`;
      await db.cash_transactions.add({ register_id: primaryRegisterId, transaction_type: 'day_close', amount: Math.round(totalDailyNet * 100) / 100, notes: description, balance_after: activeRegisters[0].current_balance || 0, created_at: Date.now(), is_day_close: true, is_consolidated: true, day_close_data: JSON.stringify(dayCloseData) });
    });

    return { success: true, date: today, isAuto, totalIncome, totalExpense, netCashflow, totalDailyNet, registerCount: activeRegisters.length };
  }
};
