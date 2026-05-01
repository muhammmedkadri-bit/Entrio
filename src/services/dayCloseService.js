import { db } from '../db';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

export const dayCloseService = {
  /**
   * Yerel tarihi YYYY-MM-DD formatında döndürür (UTC kaymasını önler)
   */
  getLocalDateStr() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  },

  /**
   * ISO timestamp — yerel saat ile (timezone safe)
   */
  getLocalDateTimeStr() {
    return new Date().toISOString();
  },

  /**
   * Türkçe tarih formatı (örn: 4 Nisan 2026)
   */
  formatDateTR(dateStr) {
    if (!dateStr) return '';
    try {
      return format(new Date(dateStr), 'd MMMM yyyy', { locale: tr });
    } catch {
      return dateStr;
    }
  },

  /**
   * Belirli bir kasanın BUGÜN kapatılıp kapatılmadığını kontrol eder.
   */
  isAlreadyClosedToday(register) {
    return register.last_day_close_date === this.getLocalDateStr();
  },

  /**
   * Gün sonu gerekiyor mu? (En az bir aktif kasa henüz kapatılmamışsa true döner)
   */
  async needsDayClose() {
    const today = this.getLocalDateStr();
    const registers = await db.cash_registers.filter(r => r.is_active !== false).toArray();
    return registers.some(r => r.last_day_close_date !== today);
  },

  /**
   * Kasa için bugünün işlemlerini DOĞRU tarih filtresiyle getirir.
   */
  async getRegisterTransactionsForToday(register) {
    const today = this.getLocalDateStr();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartISO = todayStart.toISOString();

    let fromTimestamp;
    if (!register.last_day_close_date || register.last_day_close_date < today) {
      fromTimestamp = todayStartISO;
    } else {
      // Bugün zaten kapatılmış — son kapanıştan sonrasını getir
      fromTimestamp = register.last_day_close_at || todayStartISO;
    }

    const txs = await db.cash_transactions
      .where('register_id').equals(register.id)
      .toArray();

    // Zaman ve is_day_close kontrolü
    return txs.filter(t => 
      new Date(t.created_at).getTime() > new Date(fromTimestamp).getTime() && 
      !t.is_day_close
    );
  },

  /**
   * Ana gün sonu fonksiyonu — manuel ve otomatik için tek giriş noktası
   * @param {Object} options 
   * @param {boolean} options.isAuto - Otomatik olarak mı tetiklendi?
   * @param {string} options.triggeredBy - 'manual' | 'auto_midnight' | 'app_open_recovery'
   * @param {boolean} options.previewOnly - Kayıt atmadan sadece önizleme sonucu döner
   */
  async performDayClose({ isAuto = false, triggeredBy = 'manual', previewOnly = false }) {
    const today = this.getLocalDateStr();
    const now = this.getLocalDateTimeStr();
    const activeRegisters = await db.cash_registers.filter(r => r.is_active !== false).toArray();

    if (activeRegisters.length === 0) {
      throw new Error('Aktif kasa bulunamadı');
    }

    // Check if there are ANY transactions to close
    // We will do this after we fetch transactions for all active registers.
    // So we don't prematurely exit.

    const registerSummaries = [];
    let totalDailyNet = 0;
    let totalIncome = 0;
    let totalExpense = 0;
    let totalTransactionsCount = 0;

    // Her kasa için net hesaplama
    for (const register of activeRegisters) {
      const transactions = await this.getRegisterTransactionsForToday(register);
      totalTransactionsCount += transactions.length;

      // Gelir işlemleri
      const incomeTypes = ['sale_in', 'customer_payment_in', 'deposit_in', 'opening', 'transfer_in', 'return_in'];
      const income = transactions
        .filter(t => incomeTypes.includes(t.transaction_type) || t.transaction_type === 'in')
        .reduce((sum, t) => sum + t.amount, 0);

      // Gider işlemleri
      const expenseTypes = ['purchase_out', 'supplier_payment_out', 'expense_out', 'withdrawal_out', 'transfer_out', 'return_out'];
      const expense = transactions
        .filter(t => expenseTypes.includes(t.transaction_type) || t.transaction_type === 'out')
        .reduce((sum, t) => sum + t.amount, 0);

      // Net = mevcut bakiye - general_balance (son gün sonu referansı)
      const dailyNet = (register.current_balance || 0) - (register.general_balance || 0);

      registerSummaries.push({
        register_id: register.id,
        register_name: register.name,
        opening_balance: register.general_balance || 0,
        closing_balance: register.current_balance || 0,
        income,
        expense,
        daily_net: dailyNet,
        transaction_count: transactions.length
      });

      totalDailyNet += dailyNet;
      totalIncome += income;
      totalExpense += expense;
    }

    const netCashflow = totalIncome - totalExpense;

    if (totalTransactionsCount === 0 && !previewOnly) {
      console.log('Kapatılacak yeni bir işlem bulunamadı.');
      return null;
    }

    if (previewOnly) {
      return {
        success: true,
        date: today,
        isAuto,
        totalIncome,
        totalExpense,
        netCashflow,
        totalDailyNet,
        registerCount: activeRegisters.length,
        registerSummaries
      };
    }

    // general_balance Güncelleme — Dexie Transaction İçinde
    await db.transaction('rw', db.cash_registers, db.cash_transactions, async () => {
      // 3A: Her kasanın general_balance ve last_day_close alanlarını güncelle
      for (const summary of registerSummaries) {
        await db.cash_registers.update(summary.register_id, {
          general_balance: summary.closing_balance,
          last_day_close_date: today,
          last_day_close_at: now
        });
      }

      // 3B: Tek konsolide gün sonu fişi kes (ilk aktif kasaya bağlı)
      const primaryRegisterId = activeRegisters[0].id;
      const dayCloseData = {
        date: today,
        triggered_at: now,
        trigger_type: triggeredBy,
        is_auto: isAuto,
        total_income: Math.round(totalIncome * 100) / 100,
        total_expense: Math.round(totalExpense * 100) / 100,
        net_cashflow: Math.round(netCashflow * 100) / 100,
        total_daily_net: Math.round(totalDailyNet * 100) / 100,
        register_summaries: registerSummaries
      };

      const description = isAuto
        ? `${this.formatDateTR(today)} Otomatik Gün Sonu`
        : `${this.formatDateTR(today)} Manuel Gün Sonu`;

      await db.cash_transactions.add({
        register_id: primaryRegisterId,
        transaction_type: 'day_close',
        amount: Math.round(totalDailyNet * 100) / 100,
        notes: description,
        balance_after: activeRegisters[0].current_balance || 0,
        created_at: Date.now(), // timestamp representation for index sorting
        is_day_close: true,
        is_consolidated: true,
        day_close_data: JSON.stringify(dayCloseData)
      });
    });

    return {
      success: true,
      date: today,
      isAuto,
      totalIncome,
      totalExpense,
      netCashflow,
      totalDailyNet,
      registerCount: activeRegisters.length
    };
  }
};
