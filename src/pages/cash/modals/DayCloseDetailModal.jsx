import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  X, Moon, TrendingUp, TrendingDown, ShoppingCart, Package,
  Wallet, CreditCard, Building2, Calculator, ArrowUpRight,
  ArrowDownLeft, RotateCcw, Star, BarChart2, Receipt, Users
} from 'lucide-react';
import { db } from '../../../db';
import { isSupabase } from '../../../config/database';
import { supabase } from '../../../lib/supabaseClient';
import toast from '../../../components/ui/CustomToast';

const fmt = (v) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(v || 0);
const fmtDate = (ts) => { try { return format(new Date(ts), 'd MMMM yyyy', { locale: tr }); } catch { return '—'; } };
const fmtTime = (ts) => { try { return format(new Date(ts), 'HH:mm'); } catch { return '—'; } };

const REG_ICONS = { cash: Wallet, pos: Calculator, bank: Building2, credit_card: CreditCard };

export const DayCloseDetailModal = ({ tx, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tx) return;
    loadData();
  }, [tx]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Determine the day from the transaction's created_at
      const closeDate = new Date(tx.created_at);
      const dayStart = new Date(closeDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(closeDate);
      dayEnd.setHours(23, 59, 59, 999);

      const startMs = dayStart.getTime();
      const endMs = dayEnd.getTime();

      let dayTxs = [];
      let daySales = [];
      let dayPurchases = [];
      let allProducts = [];
      let allRegisters = [];
      let dayItems = [];

      if (isSupabase()) {
        const [
          { data: tData }, { data: sData }, { data: pData },
          { data: prData }, { data: rData }
        ] = await Promise.all([
          supabase.from('cash_transactions').select('*').gte('created_at', startMs).lte('created_at', endMs),
          supabase.from('sales').select('*').gte('created_at', startMs).lte('created_at', endMs),
          supabase.from('purchases').select('*').gte('created_at', startMs).lte('created_at', endMs),
          supabase.from('products').select('*'),
          supabase.from('cash_registers').select('*')
        ]);
        
        dayTxs = tData || [];
        daySales = sData || [];
        dayPurchases = pData || [];
        allProducts = prData || [];
        allRegisters = rData || [];

        const saleIds = daySales.map(s => s.id);
        if (saleIds.length > 0) {
          const { data: siData } = await supabase.from('sale_items').select('*').in('sale_id', saleIds);
          dayItems = siData || [];
        }
      } else {
        const [allTxs, allSalesLocal, allSaleItems, prData, rData, allPurchasesLocal] = await Promise.all([
          db.cash_transactions.where('created_at').between(startMs, endMs).toArray(),
          db.sales.where('created_at').between(startMs, endMs).toArray(),
          db.sale_items.toArray(),
          db.products.toArray(),
          db.cash_registers.toArray(),
          db.purchases.where('created_at').between(startMs, endMs).toArray(),
        ]);
        dayTxs = allTxs;
        daySales = allSalesLocal;
        dayPurchases = allPurchasesLocal;
        allProducts = prData;
        allRegisters = rData;
        const saleIds = new Set(daySales.map(s => s.id));
        dayItems = allSaleItems.filter(item => saleIds.has(item.sale_id));
      }

      const productMap = Object.fromEntries(allProducts.map(p => [p.id, p]));
      const registerMap = Object.fromEntries(allRegisters.map(r => [r.id, r]));

      // Ayrıştır - Satış ve iadeler
      const daySalesOnly = daySales.filter(s => !s.original_sale_id);
      const dayReturns = daySales.filter(s => s.original_sale_id);

      // Income/expense breakdown from cash txs
      // ℹ️ İade Ödemeleri (return_out) AYRI kalem — gerçek giderlerle karıştırılmaz
      // Gider = işletme harcamaları (alış, gider, çekim)
      // İade = daha önce alınan gelirin müşteriye iadesi (ayrı doğa)
      const incomeTypes = ['sale_in', 'customer_payment_in', 'deposit_in', 'return_in'];
      const expenseTypes = ['purchase_out', 'supplier_payment_out', 'expense_out', 'withdrawal_out'];
      // return_out gider listesinde YOK — net hesabına dahil ama ayrı kart

      let totalIncome = 0;
      let totalExpense = 0;
      let totalReturns = 0;
      const registerBreakdown = {};

      dayTxs.forEach(t => {
        if (t.transaction_type === 'day_close') return;
        const isIn = incomeTypes.includes(t.transaction_type);
        const isOut = expenseTypes.includes(t.transaction_type);
        if (isIn) totalIncome += t.amount || 0;
        if (isOut) totalExpense += t.amount || 0;
        // İade ödemeleri ayrıca takip et (gider toplamına dahil değil)
        if (t.transaction_type === 'return_out') totalReturns += t.amount || 0;

        // Per-register breakdown
        const reg = registerMap[t.register_id];
        if (reg) {
          if (!registerBreakdown[t.register_id]) {
            registerBreakdown[t.register_id] = { reg, income: 0, expense: 0 };
          }
          if (isIn) registerBreakdown[t.register_id].income += t.amount || 0;
          if (isOut) registerBreakdown[t.register_id].expense += t.amount || 0;
          // İade çıkışını kasa breakdown'a ekle (net gösterim için)
          if (t.transaction_type === 'return_out') registerBreakdown[t.register_id].expense += t.amount || 0;
        }
      });

      // Payment method breakdown from sales
      const paymentBreakdown = {};
      daySalesOnly.forEach(s => {
        const pm = s.payment_method || 'other';
        if (!paymentBreakdown[pm]) paymentBreakdown[pm] = { count: 0, total: 0 };
        paymentBreakdown[pm].count++;
        paymentBreakdown[pm].total += s.total_amount || 0;
      });

      // Top selling products — dayItems kullanılarak hesaplanır

      const productSales = {};
      dayItems.forEach(item => {
        const pid = item.product_id;
        if (!productSales[pid]) {
          productSales[pid] = {
            name: productMap[pid]?.name || item.name || `Ürün #${pid}`,
            qty: 0,
            revenue: 0,
          };
        }
        productSales[pid].qty += item.quantity || 0;
        productSales[pid].revenue += (item.line_total || (item.unit_price * item.quantity)) || 0;
      });

      const topProducts = Object.values(productSales)
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5);

      const totalSalesAmount = daySalesOnly.reduce((acc, s) => acc + (s.total_amount || 0), 0);
      const totalReturnsAmount = dayReturns.reduce((acc, s) => acc + (s.total_amount || 0), 0);

      setData({
        closeDate,
        dayStart,
        totalIncome,
        totalExpense,
        totalReturns,
        // Net = Gelir − Gerçek Giderler − İade Ödemeleri
        net: totalIncome - totalExpense - totalReturns,
        salesCount: daySalesOnly.length,
        totalSalesAmount,
        returnsCount: dayReturns.length,
        totalReturnsAmount,
        purchasesCount: dayPurchases.length,
        registerBreakdown: Object.values(registerBreakdown),
        paymentBreakdown,
        topProducts,
        dayTxs,
      });
    } catch (e) {
      console.error('[DayCloseDetail] Hata:', e);
      toast.error(e?.message || 'Günsonu rapor detayları yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  if (!tx) return null;

  const PAYMENT_LABELS = {
    cash: { label: 'Nakit', icon: Wallet, color: '#16a34a' },
    card: { label: 'Kart', icon: CreditCard, color: '#2563eb' },
    transfer: { label: 'Havale/EFT', icon: Building2, color: '#7c3aed' },
    mixed: { label: 'Parçalı', icon: BarChart2, color: '#ea580c' },
    credit: { label: 'Veresiye', icon: Users, color: '#dc2626' },
    other: { label: 'Diğer', icon: Receipt, color: '#64748b' },
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl bg-white"
        style={{ border: '1px solid rgba(226,232,240,0.9)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 px-6 py-5 flex items-start justify-between bg-white border-b border-slate-100 rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgba(79,70,229,0.12) 0%, rgba(124,58,237,0.12) 100%)', border: '1px solid rgba(79,70,229,0.2)' }}>
              <Moon className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 tracking-tight">Günsonu Raporu</h2>
              <p className="text-sm text-slate-500 font-medium mt-0.5">
                {data ? fmtDate(data.closeDate) : '—'} · Kapanış: {fmtTime(tx.created_at)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : data ? (
          <div className="p-6 space-y-5">

            {/* KPI Strip */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Toplam Gelir', value: fmt(data.totalIncome), icon: TrendingUp, color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
                { label: 'İade Ödemeleri', value: fmt(data.totalReturns || 0), icon: RotateCcw, color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' },
                { label: 'Toplam Gider', value: fmt(data.totalExpense), icon: TrendingDown, color: '#dc2626', bg: '#fff1f2', border: '#fecdd3' },
                { label: 'Net Para Akışı', value: fmt(data.net), icon: BarChart2, color: data.net >= 0 ? '#16a34a' : '#dc2626', bg: data.net >= 0 ? '#f0fdf4' : '#fff1f2', border: data.net >= 0 ? '#bbf7d0' : '#fecdd3' },
              ].map(card => {
                const Icon = card.icon;
                return (
                  <div key={card.label} className="rounded-2xl p-4 flex flex-col gap-1.5"
                    style={{ background: card.bg, border: `1px solid ${card.border}` }}>
                    <div className="flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5" style={{ color: card.color }} />
                      <span className="text-xs font-semibold text-slate-500">{card.label}</span>
                    </div>
                    <span className="text-xl font-black" style={{ color: card.color }}>{card.value}</span>
                  </div>
                );
              })}
            </div>

            {/* Sales / Returns / Purchases */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Satış İşlemi', count: data.salesCount, total: data.totalSalesAmount, icon: ShoppingCart, color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
                { label: 'İade İşlemi', count: data.returnsCount, total: data.totalReturnsAmount, icon: RotateCcw, color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
                { label: 'Alış İşlemi', count: data.purchasesCount, total: null, icon: Package, color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
              ].map(card => {
                const Icon = card.icon;
                return (
                  <div key={card.label} className="rounded-2xl p-4"
                    style={{ background: card.bg, border: `1px solid ${card.border}` }}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Icon className="w-3.5 h-3.5" style={{ color: card.color }} />
                      <span className="text-xs font-semibold text-slate-500">{card.label}</span>
                    </div>
                    <div className="text-2xl font-black text-slate-800">{card.count}</div>
                    {card.total !== null && (
                      <div className="text-xs font-bold mt-1" style={{ color: card.color }}>{fmt(card.total)}</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Two-column: Kasa Bazlı + Ödeme Yöntemi */}
            <div className="grid grid-cols-2 gap-4">

              {/* Register Breakdown */}
              <div className="rounded-2xl p-4 bg-slate-50 border border-slate-100">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Kasa Bazlı Para Akışı</h3>
                {data.registerBreakdown.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">Hareket kaydı yok.</p>
                ) : (
                  <div className="space-y-3">
                    {data.registerBreakdown.map(({ reg, income, expense }) => {
                      const Icon = REG_ICONS[reg.type] || Wallet;
                      return (
                        <div key={reg.id}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-white border border-slate-200">
                              <Icon className="w-3 h-3 text-[#5da83f]" />
                            </div>
                            <span className="text-xs font-bold text-slate-700 truncate">{reg.name}</span>
                          </div>
                          <div className="flex gap-2">
                            <div className="flex-1 flex items-center gap-1 bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-1.5">
                              <ArrowUpRight className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                              <span className="text-[10px] font-bold text-emerald-700">{fmt(income)}</span>
                            </div>
                            <div className="flex-1 flex items-center gap-1 bg-rose-50 border border-rose-100 rounded-lg px-2 py-1.5">
                              <ArrowDownLeft className="w-3 h-3 text-rose-500 flex-shrink-0" />
                              <span className="text-[10px] font-bold text-rose-600">{fmt(expense)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Payment Breakdown */}
              <div className="rounded-2xl p-4 bg-slate-50 border border-slate-100">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Tahsilat Yöntemleri</h3>
                {Object.keys(data.paymentBreakdown).length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">Satış kaydı yok.</p>
                ) : (
                  <div className="space-y-2.5">
                    {Object.entries(data.paymentBreakdown).map(([pm, info]) => {
                      const meta = PAYMENT_LABELS[pm] || PAYMENT_LABELS.other;
                      const Icon = meta.icon;
                      const totalSalesForBar = data.totalSalesAmount || 1;
                      const pct = Math.round((info.total / totalSalesForBar) * 100);
                      return (
                        <div key={pm}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5">
                              <Icon className="w-3 h-3" style={{ color: meta.color }} />
                              <span className="text-xs font-semibold text-slate-600">{meta.label}</span>
                              <span className="text-[10px] font-bold text-slate-400">× {info.count}</span>
                            </div>
                            <span className="text-xs font-bold text-slate-800">{fmt(info.total)}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, background: meta.color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Top Products */}
            {data.topProducts.length > 0 && (
              <div className="rounded-2xl p-4 bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2 mb-3">
                  <Star className="w-3.5 h-3.5 text-amber-500" />
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">En Çok Satan Ürünler</h3>
                </div>
                <div className="space-y-2.5">
                  {data.topProducts.map((p, i) => {
                    const maxQty = data.topProducts[0]?.qty || 1;
                    const pct = Math.round((p.qty / maxQty) * 100);
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0"
                          style={{
                            background: i === 0 ? 'rgba(251,191,36,0.2)' : 'rgba(226,232,240,0.6)',
                            color: i === 0 ? '#d97706' : '#94a3b8',
                          }}>
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-slate-700 truncate pr-2">{p.name}</span>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-[10px] font-bold text-slate-400">{p.qty} adet</span>
                              <span className="text-[10px] font-bold text-[#5da83f]">{fmt(p.revenue)}</span>
                            </div>
                          </div>
                          <div className="h-1 rounded-full bg-slate-200 overflow-hidden">
                            <div className="h-full rounded-full"
                              style={{ width: `${pct}%`, background: i === 0 ? 'linear-gradient(90deg, #fbbf24, #f59e0b)' : '#82e05a' }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Footer close */}
            <div className="flex justify-center pt-1">
              <button
                onClick={onClose}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all border border-slate-200"
              >
                <X className="w-4 h-4" /> Kapat
              </button>
            </div>

          </div>
        ) : (
          <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Veri yüklenemedi.</div>
        )}
      </div>
    </div>
  );
};
