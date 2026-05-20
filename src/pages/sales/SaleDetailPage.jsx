import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';
import { useCartStore } from '../../store/cartStore';
import toast from '../../components/ui/CustomToast';
import {
  ArrowLeft, FileText, Calendar, Printer, ShoppingCart,
  ChevronDown, CheckCircle, Package, User, CreditCard,
  Banknote, Building, Hash, Receipt, Tag, History, Landmark, Clock, Undo2
} from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

import { saleService } from '../../services/saleService';
import { cashService } from '../../services/cashService';
import { db } from '../../db';
import { PremiumLoader } from '../../components/ui/PremiumLoader';
import { Modal } from '../../components/ui/Modal';
import { SelectDropdown } from '../../components/ui/DropdownMenu';
import { DatePicker } from '../../components/ui/DatePicker';
import { Button } from '../../components/ui/Button';
import { InvoiceTotalsCard } from '../purchases/components/InvoiceTotalsCard';

/* ── Formatters ─────────────────────────────────────────────────────────── */
const fmt  = (v) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
const fmtC = (v) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(v || 0);
const fmtDate = (d) => { try { return d ? format(new Date(d), 'dd.MM.yyyy HH:mm', { locale: tr }) : '—'; } catch { return '—'; } };
const fmtDateShort = (d) => { try { return d ? format(new Date(d), 'dd.MM.yyyy', { locale: tr }) : '—'; } catch { return '—'; } };

const METHOD_LABELS = {
  cash:     'Nakit',
  card:     'Kredi Kartı',
  transfer: 'Havale / EFT',
  mixed:    'Karma Ödeme',
  credit:   'Veresiye',
};

const METHOD_ICON = {
  cash:     Banknote,
  card:     CreditCard,
  transfer: Building,
  mixed:    CreditCard,
};

/* ══════════════════════════════════════════════════════════════════════════ */
export const SaleDetailPage = () => {
  const { id } = useParams();
  const saleId = Number(id);
  const navigate = useNavigate();
  const { startNavigation } = useAppStore();
  const { clearCart, setPosMode, setReturnSaleId, setCustomer: setCartCustomer, addItem } = useCartStore();

  const [sale, setSale]         = useState(null);
  const [returnSale, setReturnSale] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading]   = useState(true);

  const [payments, setPayments] = useState([]);
  const [cashRegisters, setCashRegisters] = useState([]);

  // Payment Modal State
  const [paymentModal, setPaymentModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payAccountId, setPayAccountId] = useState('');
  const [payDate, setPayDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [payNotes, setPayNotes] = useState('');

  const [showOtherMenu, setShowOtherMenu] = useState(false);
  const otherMenuRef = useRef(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /* Close dropdowns on outside click */
  useEffect(() => {
    const handler = (e) => {
      if (otherMenuRef.current && !otherMenuRef.current.contains(e.target)) setShowOtherMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ── Load data ─────────────────────────────────────────────────────────── */
  const loadAll = async () => {
    setLoading(true);
    try {
      const [saleData, payms, regs] = await Promise.all([
        saleService.getById(saleId),
        saleService.getSalePayments(saleId),
        cashService.getRegisters(),
      ]);

      // Enrich items with product names — use Supabase if available
      let productMap = {};
      if (saleData.items && saleData.items.length > 0) {
        const productIds = [...new Set(saleData.items.map(i => i.product_id))];
        try {
          const { supabase } = await import('../../lib/supabaseClient');
          const { data: products } = await supabase
            .from('products')
            .select('id, name, unit, tax_rate')
            .in('id', productIds);
          if (products) productMap = Object.fromEntries(products.map(p => [p.id, p]));
        } catch {
          // Dexie fallback
          for (const pid of productIds) {
            const p = await db.products.get(Number(pid)).catch(() => null);
            if (p) productMap[pid] = p;
          }
        }
      }

      const enrichedItems = (saleData.items || []).map(item => ({
        ...item,
        productName: productMap[item.product_id]?.name || item.name || `Ürün #${item.product_id}`,
        productUnit: productMap[item.product_id]?.unit || 'Adet',
        kdv_rate: item.kdv_rate ?? productMap[item.product_id]?.tax_rate ?? 0,
      }));

      setSale({ ...saleData, items: enrichedItems });
      setPayments(payms || []);
      setCashRegisters(regs || []);

      // Load customer — try Supabase first
      if (saleData.customer_id && saleData.customer_id !== 1) {
        try {
          const { supabase } = await import('../../lib/supabaseClient');
          const { data: cust } = await supabase
            .from('customers')
            .select('id, name, phone, email, balance')
            .eq('id', saleData.customer_id)
            .maybeSingle();
          setCustomer(cust || null);
        } catch {
          const c = await db.customers.get(saleData.customer_id).catch(() => null);
          setCustomer(c || null);
        }
      }

      // Load return sale if any — try Supabase first
      try {
        const { supabase } = await import('../../lib/supabaseClient');
        const { data: retSales } = await supabase
          .from('sales')
          .select('id, sale_number, payment_method, total_amount, status, created_at')
          .eq('original_sale_id', saleId)
          .eq('status', 'return')
          .maybeSingle();
        if (retSales) setReturnSale(retSales);
      } catch {
        const ret = await db.sales.where('original_sale_id').equals(Number(saleId)).first().catch(() => null);
        if (ret && ret.status === 'returned') setReturnSale(ret);
      }
    } catch (e) {
      toast.error('Satış detayı yüklenemedi: ' + e.message);
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, [saleId]);

  /* ── Return ─────────────────────────────────────────────────────────────── */
  const handleReturn = async () => {
    try {
      clearCart();
      setPosMode('return');
      setReturnSaleId(saleId);

      // Load customer via Supabase first, Dexie fallback
      if (sale.customer_id && sale.customer_id !== 1) {
        try {
          const { supabase } = await import('../../lib/supabaseClient');
          const { data: cust } = await supabase.from('customers').select('*').eq('id', sale.customer_id).maybeSingle();
          if (cust) setCartCustomer(cust);
        } catch {
          const c = await db.customers.get(sale.customer_id).catch(() => null);
          if (c) setCartCustomer(c);
        }
      }

      for (const item of sale.items) {
        let product;
        try {
          const { supabase } = await import('../../lib/supabaseClient');
          const { data } = await supabase.from('products').select('*').eq('id', item.product_id).maybeSingle();
          product = data;
        } catch {
          product = await db.products.get(item.product_id).catch(() => null);
        }
        if (product) {
          addItem(product, item.quantity);
          // Use net effective price (line_total / qty) = what was actually paid after any discount
          const effectivePrice = item.quantity > 0
            ? Math.round(((item.line_total || item.unit_price * item.quantity) / item.quantity) * 100) / 100
            : item.unit_price;
          useCartStore.getState().updateItemPrice(product.id, effectivePrice);
        }
      }

      startNavigation();
      setTimeout(() => navigate('/pos'), 150);
    } catch (e) {
      toast.error('İade işlemi başlatılamadı: ' + e.message);
    }
  };


  /* ── Delete ─────────────────────────────────────────────────────────────── */
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await db.sales.delete(saleId);
      toast.success('Satış fişi silindi.');
      navigate(-1);
    } catch (e) {
      toast.error('Silinemedi: ' + e.message);
    } finally {
      setDeleting(false);
    }
  };

  /* ── Totals ──────────────────────────────────────────────────────────────── */
  const subtotal  = sale?.items?.reduce((s, i) => s + (i.unit_price * i.quantity), 0) || 0;
  const discount  = sale?.discount || 0;
  const grandTotal = sale?.total_amount || 0;
  const kdvTotal = sale?.items?.reduce((acc, i) => {
    const rate = i.kdv_rate || 0;
    if (!rate) return acc;
    const itemSub = i.line_total || (i.unit_price * i.quantity);
    return acc + (itemSub - (itemSub / (1 + (rate / 100))));
  }, 0) || 0;
  const paidAmount = sale?.paid_amount !== undefined ? sale.paid_amount : grandTotal; // legacy sales are fully paid
  const remaining = Math.max(0, grandTotal - paidAmount);

  /* ── Payments ───────────────────────────────────────────────────────────── */
  const handlePayment = async (e) => {
    e.preventDefault();
    try {
      const amt = parseFloat(payAmount);
      if (!amt || amt <= 0) return toast.error('Geçerli bir tutar girin.');
      if (amt > remaining + 0.01) return toast.error('Ödenen tutar kalan borçtan fazla olamaz.');
      
      await saleService.addPayment(saleId, amt, payMethod, payNotes, payAccountId || null, payDate);
      toast.success('Tahsilat başarıyla eklendi.');
      setPaymentModal(false);
      setPayAmount('');
      setPayNotes('');
      loadAll();
    } catch (e) {
      toast.error(e.message);
    }
  };

  /* ── Print ──────────────────────────────────────────────────────────────── */
  const handlePrint = () => window.print();

  /* ── Pill helper ─────────────────────────────────────────────────────────── */
  const Pill = ({ icon: Icon, label, value, color = 'gray' }) => {
    const colors = {
      gray:   'bg-gray-50 border-gray-200 text-gray-600',
      green:  'bg-[#82e05a]/10 border-[#82e05a]/30 text-[#4a9430]',
      blue:   'bg-blue-50 border-blue-200 text-blue-600',
      orange: 'bg-orange-50 border-orange-200 text-orange-600',
    };
    return (
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${colors[color]}`}>
        {Icon && <Icon className="w-3 h-3 shrink-0" />}
        <span className="text-gray-400">{label}:</span>
        <span>{value}</span>
      </div>
    );
  };

  /* ════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="flex flex-col gap-4 h-full relative">
      {loading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-xl">
          <PremiumLoader />
        </div>
      )}

      {sale && (
        <>
          {/* ── Back button ───────────────────────────────────────────── */}
          <div className="print:hidden">
            <button
              onClick={() => { startNavigation(); setTimeout(() => navigate(-1), 150); }}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors bg-white border border-gray-200 shadow-sm px-3 py-1.5 rounded-xl"
            >
              <ArrowLeft className="w-4 h-4" />
              Geri
            </button>
          </div>

          {/* ── Hero Header ──────────────────────────────────────────── */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              {/* Left: icon + title + pills */}
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#82e05a]/15 text-[#5da83f] flex items-center justify-center shrink-0 border border-[#82e05a]/30">
                  <Receipt className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    Perakende Satış
                  </h1>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <Pill icon={Hash} label="Fiş No" value={sale.sale_number || `#${sale.id}`} color="green" />
                    {returnSale && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700 border border-orange-200">
                        <Undo2 className="w-3 h-3" /> İade Edildi
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: actions */}
              <div className="flex items-center gap-2 print:hidden">
                {!loading && sale.status !== 'returned' && !sale.original_sale_id && !returnSale && (
                  <button
                    onClick={handleReturn}
                    className="flex items-center gap-1.5 text-sm font-bold px-3 py-2 rounded-xl border border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-600 transition-all shadow-sm"
                  >
                    <Undo2 className="w-4 h-4" />
                    İade Et
                  </button>
                )}

                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-all"
                >
                  <Printer className="w-4 h-4" />
                  Yazdır
                </button>

                <div className="relative" ref={otherMenuRef}>
                  <button
                    onClick={() => setShowOtherMenu(v => !v)}
                    className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-all"
                  >
                    Diğer <ChevronDown className={`w-4 h-4 transition-transform ${showOtherMenu ? 'rotate-180' : ''}`} />
                  </button>
                  {showOtherMenu && (
                    <div
                      className="absolute right-0 top-full mt-1 z-50 origin-top-right"
                      style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(16px)', border: '1px solid rgba(226,232,240,0.8)', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', borderRadius: 12, padding: 4, minWidth: 170 }}
                    >
                      <button onClick={() => { handlePrint(); setShowOtherMenu(false); }} className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                        <Printer className="w-4 h-4 text-slate-500" /> Yazdır
                      </button>
                      <div className="my-1 border-t border-gray-100" />
                      <button onClick={() => { setShowDeleteConfirm(true); setShowOtherMenu(false); }} className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-500 rounded-lg hover:bg-red-50 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg> Sil
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Two-column layout ─────────────────────────────────────── */}
          <div className="flex gap-5 items-start">

            {/* ── LEFT — Items + Notes ───────────────────────────────── */}
            <div className="flex-1 min-w-0 flex flex-col gap-4">

              {/* Items card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5">
                {/* Card header */}
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-[#82e05a]/15 flex items-center justify-center">
                      <Package className="w-3.5 h-3.5 text-[#5da83f]" />
                    </div>
                    <span className="text-sm font-semibold text-gray-700">Ürün ve Hizmetler</span>
                  </div>
                  <span className="text-xs bg-gray-100 text-gray-500 font-semibold px-2 py-0.5 rounded-full">
                    {sale.items?.length || 0} kalem
                  </span>
                </div>

                {/* Items table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        {['ÜRÜN / HİZMET', 'MİKTAR', 'BİRİM', 'BİRİM FİYAT', 'İSKONTO', 'KDV', 'TOPLAM'].map(h => (
                          <th key={h} className={`pb-2 pt-2 text-[10px] font-bold text-gray-400 tracking-wide px-3 first:pl-0 last:pr-0 ${
                            h === 'TOPLAM' ? 'text-right' :
                            (h === 'MİKTAR' || h === 'İSKONTO' || h === 'KDV') ? 'text-center' : 'text-left'
                          }`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {sale.items?.map((item, idx) => {
                        const itemSubtotal = item.unit_price * item.quantity;
                        const itemDiscount = itemSubtotal - (item.line_total || itemSubtotal);
                        return (
                          <tr 
                            key={idx} 
                            className="group transition-colors"
                          >
                            <td className="py-3 px-2 pl-0">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-md bg-[#82e05a]/10 flex items-center justify-center shrink-0">
                                  <ShoppingCart className="w-3 h-3 text-[#5da83f]" />
                                </div>
                                <span 
                                  className="font-medium text-gray-800 text-sm hover:text-[#5da83f] cursor-pointer transition-colors"
                                  onClick={() => { startNavigation(); setTimeout(() => navigate(`/stock/product/${item.product_id}`), 150); }}
                                >
                                  {item.productName}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-2 text-center text-gray-600 font-medium">{item.quantity}</td>
                            <td className="py-3 px-2 text-gray-500">{item.productUnit}</td>
                            <td className="py-3 px-2 font-medium text-gray-800">₺{fmt(item.unit_price)}</td>
                            <td className="py-3 px-2 text-center">
                              <div className="flex justify-center">
                                {itemDiscount > 0.01 ? (
                                  <span className="text-xs font-semibold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">-₺{fmt(itemDiscount)}</span>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-2 text-center">
                              {item.kdv_rate > 0
                                ? <span className="text-xs bg-[#82e05a]/15 border border-[#82e05a]/30 text-[#5da83f] px-2 py-0.5 rounded-md font-semibold">%{item.kdv_rate}</span>
                                : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="py-3 px-2 pr-0 text-right font-bold text-gray-800">₺{fmt(item.line_total || itemSubtotal)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Notes & Totals Grid moved inside the card */}
                <div className="flex gap-6 items-stretch pt-6 mt-2 border-t border-gray-100 justify-end" style={{ marginRight: '-16px' }}>
                  {/* Notes (Satış Notları) - only shown if there's a note */}
                  {sale.notes && (
                    <div className="flex-1 flex flex-col">
                      <div className="flex items-center gap-2 mb-3">
                        <FileText className="w-5 h-5 text-gray-400" />
                        <h3 className="text-base font-medium text-gray-500">Satış Notları</h3>
                      </div>
                      <p className="flex-1 text-[15px] text-gray-500 leading-relaxed font-normal bg-white p-4 rounded-xl border border-gray-100 shadow-sm">{sale.notes}</p>
                    </div>
                  )}

                  {/* Totals */}
                  <div style={{ width: '360px', minWidth: '320px' }} className="flex flex-col">
                    <InvoiceTotalsCard
                      subtotal={subtotal}
                      discountTotal={discount}
                      kdvTotal={kdvTotal}
                      otvTotal={0}
                      grandTotal={grandTotal}
                      paidAmount={paidAmount}
                      paymentMethod={sale.payment_method}
                      hidePaymentDetails={true}
                    />
                  </div>
                </div>
              </div>

              {/* ── Fatura / Tahsilat Hareketleri (Moved inside Left Column) ── */}
              <div className="bg-white border border-gray-200/60 rounded-2xl shadow-sm overflow-hidden print:hidden mt-2">
                <div className="px-5 py-4 border-b border-gray-50">
                  <div className="flex items-center gap-2">
                    <History className="w-5 h-5 text-[#5da83f]" />
                    <h2 className="text-base font-bold text-gray-800">Satış ve Tahsilat Hareketleri</h2>
                  </div>
                </div>
                
                {(() => {
                  const movementsList = (() => {
                    const items = [{
                      id: 'init',
                      method: 'Satış Gerçekleşti',
                      notes: 'Satış Fişi Oluşturuldu',
                      date: sale.created_at,
                      amount: grandTotal,
                      isAdd: true,
                      isReturn: false,
                    }];

                    const pmsAsc = [...payments].sort((a, b) => new Date(a.date) - new Date(b.date));
                    pmsAsc.forEach(p => {
                      items.push({
                        id: p.id,
                        method: p.method,
                        notes: p.notes,
                        date: p.date,
                        amount: p.amount,
                        isAdd: false,
                        isReturn: p.isReturn || false,
                        register: p.register,
                      });
                    });

                    // Calculate running balance: only payment rows reduce the balance; returns always show 0
                    let bal = grandTotal;
                    items[0].remaining = bal;
                    for (let i = 1; i < items.length; i++) {
                      if (items[i].isReturn) {
                        // Return row always shows 0 remaining (debt is cleared)
                        items[i].remaining = 0;
                      } else {
                        bal -= items[i].amount;
                        items[i].remaining = Math.max(0, bal);
                      }
                    }
                    
                    return items.reverse();
                  })();

                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-gray-50 text-xs font-semibold text-gray-500">
                          <tr className="bg-gray-50/80 border-b border-gray-100">
                            <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Hareket Türü</th>
                            <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Kasa</th>
                            <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Açıklama</th>
                            <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Tarih</th>
                            <th className="px-5 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Tutar(₺)</th>
                            <th className="px-5 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Kalan Fatura Tutarı</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {movementsList.map(mov => {
                            let bgClass = 'bg-emerald-50 text-emerald-700 border border-emerald-100';
                            let Icon = CreditCard;
                            let methodLabel = mov.method;
                            let amountColor = 'text-emerald-600';
                            let amountPrefix = '-';

                            if (mov.isAdd) {
                              bgClass = 'bg-blue-50 text-blue-700 border border-blue-100';
                              Icon = FileText;
                              amountColor = 'text-gray-900';
                              amountPrefix = '';
                            } else if (mov.isReturn) {
                              bgClass = 'bg-orange-50 text-orange-700 border border-orange-200';
                              Icon = Undo2;
                              methodLabel = 'İade';
                              amountColor = 'text-orange-600';
                              amountPrefix = '+';
                            } else {
                              const method = String(mov.method || '');
                              if (method.includes('Havale') || method.includes('EFT') || method.includes('Banka') || method.includes('bank') || method.includes('transfer')) {
                                Icon = Landmark;
                                methodLabel = 'Havale / EFT';
                              } else if (method.includes('Nakit') || method.includes('cash')) {
                                Icon = Banknote;
                                methodLabel = 'Nakit';
                              } else if (method.includes('Kredi') || method.includes('POS') || method.includes('card') || method.includes('credit_card')) {
                                methodLabel = 'Kredi Kartı';
                              } else if (method.includes('Çek')) {
                                methodLabel = 'Çek';
                              }
                            }

                            let displayNotes = mov.notes;
                            if (!mov.isAdd && !mov.isReturn && displayNotes && displayNotes.startsWith('Satış (')) {
                              displayNotes = 'Tahsilat';
                            }

                            return (
                            <tr key={mov.id} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-5 py-4">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] font-bold ${bgClass}`}>
                                  <Icon className="w-3.5 h-3.5"/>
                                  {methodLabel}
                                </span>
                              </td>
                              <td className="px-5 py-4 text-[13px] font-semibold text-gray-700">
                                {mov.register ? (cashRegisters.find(r => r.id === mov.register)?.name || mov.register) : '—'}
                              </td>
                              <td className="px-5 py-4 text-[14px] font-medium text-gray-600">{displayNotes}</td>
                              <td className="px-5 py-4 text-[14px] font-medium text-gray-500">{fmtDate(mov.date)}</td>
                              <td className="px-5 py-4 text-right font-bold text-gray-900 text-[15px]">
                                <span className={amountColor}>{amountPrefix}₺{fmt(mov.amount)}</span>
                              </td>
                              <td className="px-5 py-4 text-right font-bold text-gray-600 text-[15px]">₺{fmt(mov.remaining)}</td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>

            </div>

            {/* ── RIGHT — Customer + Payment summary ────────────────── */}
            <div className="w-[280px] shrink-0 flex flex-col gap-4 print:hidden">

              {/* Customer card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-4 h-4 text-[#5da83f]" />
                  <span className="text-sm font-semibold text-gray-700">Müşteri</span>
                </div>
                {customer ? (
                  <div className="flex flex-col gap-1">
                    <p 
                      className="font-bold text-gray-900 hover:text-[#5da83f] cursor-pointer inline-block transition-colors"
                      onClick={() => { startNavigation(); setTimeout(() => navigate(`/customers/${customer.id}`), 150); }}
                    >
                      {customer.name}
                    </p>
                    {customer.phone && <p className="text-xs text-gray-500">📞 {customer.phone}</p>}
                    {customer.email && <p className="text-xs text-gray-500">✉ {customer.email}</p>}
                    {customer.balance !== 0 && (
                      <p className={`text-xs font-bold mt-1 ${customer.balance > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                        Bakiye: {fmtC(Math.abs(customer.balance))} {customer.balance > 0 ? '(Borçlu)' : '(Alacaklı)'}
                      </p>
                    )}
                    {remaining > 0 && sale.status !== 'cancelled' && (
                      <button
                        onClick={() => { setPayAmount(remaining); setPaymentModal(true); }}
                        className="mt-3 flex justify-center items-center gap-2 w-full px-4 py-2.5 text-sm font-semibold rounded-lg border bg-emerald-50 text-emerald-600 border-emerald-200/60 hover:bg-emerald-100 hover:border-emerald-300 transition-all"
                      >
                        <CreditCard className="w-4 h-4" /> Tahsilat Ekle
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    <p className="text-sm text-gray-400">Perakende Müşteri</p>
                    {remaining > 0 && sale.status !== 'cancelled' && !loading && (
                      <button
                        onClick={() => { setPayAmount(remaining); setPaymentModal(true); }}
                        className="mt-3 flex justify-center items-center gap-2 w-full px-4 py-2.5 text-sm font-semibold rounded-lg border bg-emerald-50 text-emerald-600 border-emerald-200/60 hover:bg-emerald-100 hover:border-emerald-300 transition-all"
                      >
                        <CreditCard className="w-4 h-4" /> Tahsilat Ekle
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Payment card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className="w-4 h-4 text-[#5da83f]" />
                  <span className="text-sm font-semibold text-gray-700">Ödeme Bilgileri</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Yöntem</span>
                    <span className="font-semibold text-gray-700">{METHOD_LABELS[sale.payment_method] || sale.payment_method || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Tutar</span>
                    <span className="font-bold text-[#4a9430]">₺{fmt(grandTotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Tarih/Saat</span>
                    <span className="font-medium text-gray-600">{sale.created_at ? format(new Date(sale.created_at), 'd MMMM yyyy HH:mm', { locale: tr }) : '—'}</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
                  <span className="text-gray-500 text-xs font-medium">Durum</span>
                  {returnSale ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                      <Undo2 className="w-3 h-3" />
                      İade Edildi
                    </span>
                  ) : remaining > 0 && sale.status !== 'cancelled' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                      <Clock className="w-3 h-3" />
                      Bekliyor
                    </span>
                  ) : sale.status === 'cancelled' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                      İptal Edildi
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                      <CheckCircle className="w-3 h-3" />
                      Tamamlandı
                    </span>
                  )}
                </div>
              </div>

              {/* Return Info Card */}
              {returnSale && (
                <div className="bg-orange-50 rounded-xl border border-orange-200 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Undo2 className="w-4 h-4 text-orange-500" />
                    <span className="text-sm font-semibold text-orange-700">İade Bilgileri</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-orange-600">Yöntem</span>
                      <span className="font-semibold text-orange-800">{METHOD_LABELS[returnSale.payment_method] || returnSale.payment_method || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-orange-600">Tutar</span>
                      <span className="font-bold text-orange-700">₺{fmt(returnSale.total_amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-orange-600">Tarih/Saat</span>
                      <span className="font-medium text-orange-700">{returnSale.created_at ? format(new Date(returnSale.created_at), 'd MMMM yyyy HH:mm', { locale: tr }) : '—'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── PRINTABLE RECEIPT ──────────────────────────────────────── */}
          <div id="receipt-print-area" className="hidden print:block mx-auto max-w-sm bg-white p-4 font-mono text-sm leading-tight text-slate-800">
            <div className="text-center mb-2">
              <h1 className="font-bold text-base print:text-[12px]">ENTRIO</h1>
              <p className="text-xs print:text-[9px] mt-1">Merkez Şube</p>
            </div>
            <div className="border-b border-dashed border-slate-400 pb-1 mb-1 text-xs print:text-[9px]">
              <div className="flex justify-between"><span>Tarih:</span><span>{fmtDate(sale.created_at)}</span></div>
              <div className="flex justify-between"><span>Fiş No:</span><span className="font-semibold">{sale.sale_number}</span></div>
              <div className="flex justify-between"><span>Müşteri:</span><span className="truncate max-w-[120px] print:max-w-[80px] text-right">{customer?.name || 'Perakende Müşteri'}</span></div>
            </div>
            <div className="mb-1">
              {sale.items?.map((item, idx) => (
                <div key={idx} className="mb-1.5">
                  <div className="font-semibold print:text-[10px] whitespace-normal break-words leading-tight">{item.productName}</div>
                  <div className="flex justify-between text-xs print:text-[9px] mt-0.5">
                    <span>{item.quantity} x ₺{fmt(item.unit_price)}</span>
                    <span>₺{fmt(item.line_total)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-dashed border-slate-400 pt-1 text-sm print:text-[10px]">
              {discount > 0 && (
                <div className="flex justify-between text-red-600 mb-1 print:text-[9px]"><span>İskonto</span><span>-₺{fmt(discount)}</span></div>
              )}
              <div className="flex justify-between font-bold text-base print:text-[11px] mt-1"><span>TOPLAM</span><span>₺{fmt(grandTotal)}</span></div>
            </div>
            <div className="border-t border-b border-dashed border-slate-400 py-1 my-1 text-xs print:text-[9px] flex justify-between">
              <span>Ödeme:</span>
              <span>{METHOD_LABELS[sale.payment_method] || sale.payment_method}</span>
            </div>
            <div className="text-center mt-4 text-xs print:text-[8px] font-medium">
              <p>BİZİ TERCİH ETTİĞİNİZ İÇİN</p>
              <p>TEŞEKKÜR EDERİZ</p>
            </div>
          </div>

          {/* ── Payment Modal ──────────────────────────────────────────────── */}
          <Modal isOpen={paymentModal} onClose={() => setPaymentModal(false)} title="Tahsilat Ekle" size="md">
            <form onSubmit={handlePayment} className="space-y-4">
              <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100/50">
                <p className="text-[13px] text-gray-500 font-medium mb-1">
                  Kalan Tahsilat Tutarı
                </p>
                <p className="text-xl font-bold text-emerald-600">₺{fmt(remaining)}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Tahsilat Yöntemi</label>
                  <SelectDropdown
                    value={payMethod}
                    onChange={v => {
                      setPayMethod(v);
                      setPayAccountId(''); // reset account id on method change
                    }}
                    options={[
                      { value: 'cash', label: 'Nakit Kasa' },
                      { value: 'bank_transfer', label: 'Havale / EFT / Banka' },
                      { value: 'credit_card', label: 'Kredi Kartı / POS' }
                    ]}
                    className="w-full shadow-sm text-[14px]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Tarih</label>
                  <DatePicker
                    compact
                    allowClear={false}
                    popupAlignment="top"
                    value={{ start: new Date(payDate), end: new Date(payDate) }}
                    onChange={(val) => { if (val?.start) setPayDate(format(val.start, 'yyyy-MM-dd')); }}
                    renderTrigger={({ setIsOpen }) => (
                      <div
                        className="flex items-center gap-1.5 bg-white w-full text-[14px] font-medium border border-gray-200 rounded-xl px-3 py-2.5 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all cursor-pointer shadow-sm"
                        onClick={() => setIsOpen(true)}
                      >
                        <Calendar className="w-4 h-4 text-emerald-600/70 shrink-0" />
                        <span className="text-[14px] font-medium text-gray-700 whitespace-nowrap">
                          {payDate ? format(new Date(payDate), 'd MMMM yyyy', { locale: tr }) : format(new Date(), 'd MMMM yyyy', { locale: tr })}
                        </span>
                      </div>
                    )}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                    {payMethod === 'cash' ? 'Kasa Seçin' : payMethod === 'bank_transfer' ? 'Banka Seçin' : 'POS Seçin'}
                  </label>
                  <SelectDropdown
                    value={payAccountId}
                    onChange={setPayAccountId}
                    options={[
                      { value: '', label: 'Varsayılan Hesap (Otomatik)' },
                      ...cashRegisters
                        .filter(r => payMethod === 'cash' ? r.type === 'cash' : payMethod === 'bank_transfer' ? r.type === 'bank' : r.type === 'pos')
                        .map(r => ({ value: String(r.id), label: r.name }))
                    ]}
                    className="w-full shadow-sm text-[14px]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Tutar</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">₺</span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={payAmount}
                      onChange={e => setPayAmount(e.target.value)}
                      className="w-full pl-7 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-[15px] font-bold text-gray-900 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none shadow-sm transition-all"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Açıklama / Not</label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                  placeholder="İsteğe bağlı not..."
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-[14px] focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none shadow-sm transition-all"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <Button type="button" variant="ghost" onClick={() => setPaymentModal(false)} className="flex-1 rounded-xl">İptal</Button>
                <Button type="submit" variant="primary" className="flex-1 rounded-xl shadow-md">Kaydet</Button>
              </div>
            </form>
          </Modal>

          {/* ── Delete Confirm Modal ── */}
          <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Satış Fişini Sil" size="sm">
            <p className="text-sm text-gray-600 mb-6">Bu satış fişi kalıcı olarak silinecek. Bu işlem geri alınamaz.</p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>İptal</Button>
              <Button onClick={handleDelete} isLoading={deleting} className="bg-red-500 hover:bg-red-600 text-white border-red-500">Sil</Button>
            </div>
          </Modal>
        </>
      )}
    </div>
  );
};
