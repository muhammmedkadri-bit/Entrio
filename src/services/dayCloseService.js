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

  // Returns the "from" timestamp for the current day session
  async getFromMs(registers) {
    const regs = registers || [];
    const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
    const closeTimes = regs.map(r => r.last_day_close_at || 0).filter(v => v > 0);
    const minClose = closeTimes.length > 0 ? Math.min(...closeTimes) : 0;
    return minClose > 0 ? minClose : todayMidnight.getTime();
  },

  // Full Z Report data — used by DayCloseModal preview and to enrich perform_day_close
  async getZReportData(registers) {
    if (isSupabase()) {
      const fromMs = await this.getFromMs(registers || []);
      const { data, error } = await supabase.rpc('get_z_report_data', { p_from_ms: fromMs });
      if (error) throw error;
      return data;
    }

    // ── Dexie fallback ─────────────────────────────────────────────────────
    const fromMs = await this.getFromMs(registers || []);
    const nowMs = Date.now();
    const [allSales, allTxsRaw, allProducts, allSaleItemsRaw] = await Promise.all([
      db.sales.where('created_at').between(fromMs, nowMs).toArray(),
      db.cash_transactions.where('created_at').between(fromMs, nowMs).toArray(),
      db.products.toArray(),
      db.sale_items.toArray(),
    ]);
    const dayTxs = allTxsRaw.filter(t => !t.is_day_close);
    const activeSales = allSales.filter(s => s.status !== 'return' && s.status !== 'cancelled');
    const returnedSales = allSales.filter(s => s.status === 'return');
    const saleIds = new Set(activeSales.map(s => s.id));
    const dayItems = allSaleItemsRaw.filter(item => saleIds.has(item.sale_id));
    const productMap = Object.fromEntries(allProducts.map(p => [p.id, p]));

    let ciro = 0, tahsilat = 0, veresiye = 0;
    activeSales.forEach(s => {
      ciro += s.total_amount || 0;
      if (s.payment_method === 'credit') veresiye += s.total_amount || 0;
      else tahsilat += s.total_amount || 0;
    });

    let gider = 0;
    const giderCatMap = {};
    const EXPENSE_TYPES = ['purchase_out','supplier_payment_out','expense_out','withdrawal_out','return_out'];
    const CAT_LABELS = { purchase_out:'Mal Alimi', supplier_payment_out:'Tedarikci Odemesi', expense_out:'Genel Gider', withdrawal_out:'Para Cikisi', return_out:'Iade Odemesi' };
    dayTxs.forEach(t => {
      if (EXPENSE_TYPES.includes(t.transaction_type)) {
        gider += t.amount || 0;
        const cat = CAT_LABELS[t.transaction_type] || 'Diger';
        giderCatMap[cat] = (giderCatMap[cat] || 0) + (t.amount || 0);
      }
    });

    let nakitKar = 0, veresiyeKar = 0;
    const itemsBySale = {};
    dayItems.forEach(item => { if (!itemsBySale[item.sale_id]) itemsBySale[item.sale_id] = []; itemsBySale[item.sale_id].push(item); });
    activeSales.forEach(s => {
      const items = itemsBySale[s.id] || [];
      let cost = items.reduce((acc, it) => acc + (productMap[it.product_id]?.purchase_price || 0) * it.quantity, 0);
      const profit = (s.total_amount || 0) - cost;
      if (s.payment_method === 'credit') veresiyeKar += profit;
      else nakitKar += profit;
    });

    const prodSales = {};
    dayItems.forEach(item => {
      const pid = item.product_id;
      const prod = productMap[pid];
      if (!prodSales[pid]) prodSales[pid] = { name: prod?.name || item.name || `#${pid}`, adet: 0, ciro: 0, kar: 0 };
      prodSales[pid].adet += item.quantity || 0;
      prodSales[pid].ciro += item.line_total || 0;
      prodSales[pid].kar += (item.line_total || 0) - (prod?.purchase_price || 0) * item.quantity;
    });
    const top5 = Object.values(prodSales).sort((a, b) => b.adet - a.adet).slice(0, 5);

    const hourlyMap = {};
    for (let h = 8; h <= 20; h++) hourlyMap[h] = { saat: h, satis: 0, tutar: 0 };
    activeSales.forEach(s => {
      const h = new Date(Number(s.created_at)).getHours();
      if (hourlyMap[h]) { hourlyMap[h].satis++; hourlyMap[h].tutar += s.total_amount || 0; }
    });
    const saatlik = Object.values(hourlyMap);

    const odemeMap = {};
    activeSales.forEach(s => {
      const pm = s.payment_method || 'other';
      if (!odemeMap[pm]) odemeMap[pm] = { yontem: pm, adet: 0, tutar: 0 };
      odemeMap[pm].adet++; odemeMap[pm].tutar += s.total_amount || 0;
    });

    return {
      ciro: Math.round(ciro * 100) / 100,
      tahsilat: Math.round(tahsilat * 100) / 100,
      veresiye: Math.round(veresiye * 100) / 100,
      gider: Math.round(gider * 100) / 100,
      net: Math.round((tahsilat - gider) * 100) / 100,
      satis_sayi: activeSales.length,
      iade_sayi: returnedSales.length,
      iade_tutar: Math.round(returnedSales.reduce((s, r) => s + (r.total_amount || 0), 0) * 100) / 100,
      nakit_kar: Math.round(nakitKar * 100) / 100,
      veresiye_kar: Math.round(veresiyeKar * 100) / 100,
      toplam_kar: Math.round((nakitKar + veresiyeKar) * 100) / 100,
      top5,
      saatlik,
      gider_cats: Object.entries(giderCatMap).map(([kategori, tutar]) => ({ kategori, tutar })).sort((a,b) => b.tutar - a.tutar),
      odeme_dag: Object.values(odemeMap).sort((a,b) => b.tutar - a.tutar),
      from_ms: fromMs,
    };
  },

  async performDayClose({ isAuto = false, triggeredBy = 'manual' }) {
    const today = this.getLocalDateStr();
    const now = new Date().toISOString();

    if (isSupabase()) {
      const { data, error } = await supabase.rpc('perform_day_close', {
        p_is_auto: isAuto, p_triggered_by: triggeredBy
      });
      if (error) throw error;
      return { success: true, date: today, isAuto, ...data };
    }

    // ── Dexie fallback ────────────────────────────────────────────────────
    const activeRegisters = await db.cash_registers.filter(r => r.is_active !== false).toArray();
    if (activeRegisters.length === 0) throw new Error('Aktif kasa bulunamadi');

    await db.transaction('rw', db.cash_registers, db.cash_transactions, async () => {
      for (const reg of activeRegisters) {
        await db.cash_registers.update(reg.id, {
          general_balance: reg.current_balance,
          last_day_close_date: today,
          last_day_close_at: Date.now()
        });
      }
      const description = isAuto ? `${this.formatDateTR(today)} Otomatik Gun Sonu` : `${this.formatDateTR(today)} Manuel Gun Sonu`;
      await db.cash_transactions.add({
        register_id: activeRegisters[0].id,
        transaction_type: 'day_close',
        amount: 0,
        notes: description,
        created_at: Date.now(),
        is_day_close: true,
        is_consolidated: true,
      });
    });

    return { success: true, date: today, isAuto };
  }
};
