import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';
import toast from '../../components/ui/CustomToast';
import {
  ArrowLeft, FileText, Hash, Calendar, Tag, Printer, Pencil, CreditCard,
  Trash2, ChevronDown, CheckCircle, Package, ShoppingCart, Search, Layers, TrendingUp, TrendingDown,
  Info, DollarSign, History, Landmark, Banknote, User
} from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

import { purchaseService } from '../../services/purchaseService';
import { categoryService } from '../../services/categoryService';
import { cashService } from '../../services/cashService';
import { useCacheStore } from '../../store/cacheStore';

import { Modal } from '../../components/ui/Modal';
import { PremiumLoader } from '../../components/ui/PremiumLoader';
import { SupplierSelectCard } from './components/SupplierSelectCard';
import { InvoiceTotalsCard } from './components/InvoiceTotalsCard';
import { Button } from '../../components/ui/Button';
import { DatePicker } from '../../components/ui/DatePicker';
import { SelectDropdown } from '../../components/ui/DropdownMenu';

const fmt = (v) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
const fmtDate = (d) => { try { return d ? format(new Date(d), 'dd.MM.yyyy') : '—'; } catch { return '—'; } };

const STATUS_BADGE = {
  received:  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700"><CheckCircle className="w-3 h-3" />Alındı</span>,
  cancelled: <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">İptal Edildi</span>,
};


export const PurchaseDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { startNavigation } = useAppStore();
  const purchaseId = parseInt(id);

  const [purchase, setPurchase] = useState(null);
  const [payments, setPayments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Dropdown / popup states
  const [showOtherMenu, setShowOtherMenu] = useState(false);
  const [showCatPopup, setShowCatPopup] = useState(false);
  const [catSearch, setCatSearch] = useState('');

  const otherMenuRef = useRef(null);
  const catPopupRef = useRef(null);

  // Modals
  const [paymentModal, setPaymentModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payNotes, setPayNotes] = useState('');
  const [payAccountId, setPayAccountId] = useState('');
  const [payDate, setPayDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [cashRegisters, setCashRegisters] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (otherMenuRef.current && !otherMenuRef.current.contains(e.target)) setShowOtherMenu(false);
      if (catPopupRef.current && !catPopupRef.current.contains(e.target)) {
        setShowCatPopup(false);
        setCatSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Realtime bindings ────────────────────────────────────────────────
  const setCache = useCacheStore(s => s.setCache);
  const isPurchasesValid = useCacheStore(s => s._cache['purchases']?.valid);

  // Re-fetch automatically when global cache is invalidated by Realtime
  useEffect(() => {
    if (isPurchasesValid === false) {
      loadAll();
    }
  }, [isPurchasesValid]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const minWait = new Promise(r => setTimeout(r, 1300));

      const [prod, payms, cats, regs] = await Promise.all([
        purchaseService.getById(purchaseId),
        purchaseService.getPurchasePayments(purchaseId),
        categoryService.getAll(),
        cashService.getRegisters(),
        minWait,
      ]);
      setPurchase(prod);
      setPayments(payms);
      setCategories(cats);
      setCashRegisters(regs || []);
      
      // Invalidate purchases cache so returning to PurchasesPage triggers a fresh array fetch if needed
      useCacheStore.getState().invalidate('purchases');
    } catch (e) {
      toast.error('Fatura detayı yüklenemedi: ' + e.message);
      navigate('/purchases');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, [purchaseId]);

  const categoryName = categories.find(c => c.id === purchase?.category_id)?.name || 'Fatura Kategorisi Seç';

  const handleCategorySelect = async (cat) => {
    if (purchase && cat.id === purchase.category_id) { setShowCatPopup(false); return; }
    try {
      await purchaseService.updateCategory(purchaseId, cat.id);
      setPurchase(prev => ({ ...prev, category_id: cat.id }));
      toast.success('Kategori güncellendi.');
      setShowCatPopup(false);
      setCatSearch('');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) { toast.error('Geçerli bir tutar girin.'); return; }
    setActionLoading(true);
    try {
      await purchaseService.addPayment(purchaseId, amt, payMethod, payNotes, payAccountId || null, payDate);
      toast.success('Ödeme kaydedildi.');
      setPaymentModal(false);
      setPayAmount('');
      setPayNotes('');
      setPayAccountId('');
      loadAll();
    } catch (err) {
      toast.error(err.message);
    } finally { setActionLoading(false); }
  };

  const handleDelete = async () => {
    setActionLoading(true);
    try {
      await purchaseService.cancel(purchaseId);
      // Cache'i temizle → listeye dönünce usePurchases taze veri çeker
      useCacheStore.getState().invalidate('purchases');
      toast.success('Fatura iptal edildi.');
      startNavigation();
      setTimeout(() => navigate('/purchases'), 150);
    } catch (err) {
      toast.error(err.message);
    } finally { setActionLoading(false); }
  };

  if (loading) return <div className="relative h-screen"></div>;
  if (!purchase) return null;

  const filteredCats = categories.filter(c =>
    c.name.toLowerCase().includes(catSearch.toLowerCase())
  );

  const subtotal    = purchase.subtotal || purchase.total_amount || 0;
  const discount    = purchase.discount_amount || 0;
  const kdv         = purchase.kdv_amount || 0;
  const otv         = purchase.otv_amount || 0;
  const grandTotal  = purchase.total_amount || 0;
  const paid        = purchase.paid_amount || 0;
  const remaining   = Math.max(0, Math.round((grandTotal - paid) * 100) / 100);

  return (
    <div className="flex flex-col gap-4 h-full relative">
      <div className="flex-1 pb-20">
        <div className="flex flex-col gap-4 w-full relative">
          
          {/* ─ Back Button ─ */}
          <div className="print:hidden">
            <button
              onClick={() => {
                startNavigation();
                setTimeout(() => navigate('/purchases'), 150);
              }}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors bg-white border border-gray-200 shadow-sm px-3 py-1.5 rounded-xl"
            >
              <ArrowLeft className="w-4 h-4" /> Geri
            </button>
          </div>

          {/* ─ Hero Section ─ */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5 print:hidden">
            <div className="flex items-start justify-between gap-4">
              {/* Left: Identity */}
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#82e05a]/15 text-[#5da83f] flex items-center justify-center shrink-0 border border-[#82e05a]/30">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    {purchase.invoice_title || 'Alış Faturası'}
                  </h1>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold bg-[#82e05a]/10 border-[#82e05a]/30 text-[#4a9430]">
                      <Hash className="w-3 h-3 shrink-0" />
                      <span className="text-gray-400">Fatura No:</span>
                      <span>{purchase.invoice_number || `ALI-${purchase.id}`}</span>
                    </span>
                    {purchase.invoice_date && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold bg-gray-50 border-gray-200 text-gray-600">
                        <Calendar className="w-3 h-3 shrink-0" />
                        <span className="text-gray-400">Tarih:</span>
                        <span>{fmtDate(purchase.invoice_date)}</span>
                      </span>
                    )}
                    {purchase.due_date && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold bg-orange-50 border-orange-200 text-orange-600">
                        <Calendar className="w-3 h-3 shrink-0" />
                        <span className="text-gray-400">Vade:</span>
                        <span>{fmtDate(purchase.due_date)}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-2 print:hidden">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-all"
                >
                  <Printer className="w-4 h-4" /> Yazdır
                </button>

                {/* Diğer Dropdown */}
                <div className="relative" ref={otherMenuRef}>
                  <button
                    onClick={() => { setShowOtherMenu(v => !v); setShowCatPopup(false); }}
                    className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-all"
                  >
                    Diğer <ChevronDown className={`w-4 h-4 transition-transform ${showOtherMenu ? 'rotate-180' : ''}`} />
                  </button>

                  {showOtherMenu && (
                    <div
                      className="absolute right-0 top-full mt-1 z-50 origin-top-right"
                      style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(16px)', border: '1px solid rgba(226,232,240,0.8)', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', borderRadius: 12, padding: 4, minWidth: 170 }}
                    >
                      <button onClick={() => { navigate(`/purchases/edit/${purchase.id}`); setShowOtherMenu(false); }} className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                        <Pencil className="w-4 h-4 text-slate-500" /> Düzenle
                      </button>
                      <div className="my-1 border-t border-gray-100" />
                      <button onClick={() => { setDeleteConfirm(true); setShowOtherMenu(false); }} className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-500 rounded-lg hover:bg-red-50 transition-colors" disabled={purchase.status === 'cancelled'}>
                        <Trash2 className="w-4 h-4" /> İptal Et
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ─ Print Header ─ */}
          <div className="hidden print:block mt-4 mb-4">
            <h1 className="text-2xl font-bold text-gray-900">ALIŞ FATURASI</h1>
            <p className="text-sm text-gray-500 mt-1">
              {purchase.invoice_number && `Fatura No: ${purchase.invoice_number} · `}
              Tarih: {fmtDate(purchase.invoice_date)} · Vade: {fmtDate(purchase.due_date)}
            </p>
          </div>

          {/* ─ Main Content ─ */}
          <div className="flex gap-5 items-start">
            
            {/* Left Column */}
            <div className="flex-1 min-w-0 flex flex-col gap-4">
              
              {/* Items Table */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-[#82e05a]/15 flex items-center justify-center">
                      <Package className="w-3.5 h-3.5 text-[#5da83f]" />
                    </div>
                    <span className="text-sm font-semibold text-gray-700">Ürün ve Hizmetler</span>
                  </div>
                  <span className="text-xs bg-gray-100 text-gray-500 font-semibold px-2 py-0.5 rounded-full">
                    {(purchase.items || []).length} kalem
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        {['ÜRÜN / HİZMET', 'MİKTAR', 'BİRİM', 'BİRİM FİYAT', 'İSKONTO', 'KDV', 'TUTAR'].map(h => (
                          <th key={h} className={`pb-2 pt-2 text-[10px] font-bold text-gray-400 tracking-wide px-3 first:pl-0 last:pr-0 ${
                            h === 'TUTAR' ? 'text-right' :
                            h === 'MİKTAR' ? 'text-center' : 'text-left'
                          }`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {(purchase.items || []).map((item, i) => (
                        <tr key={i} className="group transition-colors">
                          <td className="py-3 px-2 pl-0">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-md bg-[#82e05a]/10 flex items-center justify-center shrink-0">
                                <ShoppingCart className="w-3 h-3 text-[#5da83f]" />
                              </div>
                              <span
                                className="font-medium text-gray-800 text-sm hover:text-[#5da83f] cursor-pointer transition-colors"
                                onClick={() => { startNavigation(); setTimeout(() => navigate(`/stock/product/${item.product_id}`), 150); }}
                              >
                                {item.name}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-2 text-center text-gray-600 font-medium">{item.quantity}</td>
                          <td className="py-3 px-2 text-gray-500">{item.unit || 'adet'}</td>
                          <td className="py-3 px-2 font-medium text-gray-800">₺{fmt(item.unit_price)}</td>
                          <td className="py-3 px-2">
                            {item.discount_percent > 0
                              ? <span className="text-xs bg-[#82e05a]/15 border border-[#82e05a]/30 text-[#5da83f] px-2 py-0.5 rounded-md font-semibold">%{item.discount_percent}</span>
                              : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="py-3 px-2">
                            {item.kdv_rate > 0
                              ? <span className="text-xs bg-[#82e05a]/15 border border-[#82e05a]/30 text-[#5da83f] px-2 py-0.5 rounded-md font-semibold">%{item.kdv_rate}</span>
                              : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="py-3 px-2 pr-0 text-right font-bold text-gray-800">₺{fmt(item.line_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Notes & Totals */}
                <div className="flex gap-6 items-stretch pt-6 mt-2 border-t border-gray-100 justify-end" style={{ marginRight: '-16px' }}>
                  {/* Notes - only when present */}
                  {purchase.notes && (
                    <div className="flex-1 flex flex-col">
                      <div className="flex items-center gap-2 mb-3">
                        <FileText className="w-5 h-5 text-gray-400" />
                        <h3 className="text-base font-medium text-gray-500">Fatura Notları</h3>
                      </div>
                      <p className="flex-1 text-[15px] text-gray-500 leading-relaxed font-normal bg-white p-4 rounded-xl border border-gray-100 shadow-sm">{purchase.notes}</p>
                    </div>
                  )}

                  {/* Totals */}
                  <div style={{ width: '360px', minWidth: '320px' }} className="flex flex-col">
                    <InvoiceTotalsCard
                      subtotal={subtotal}
                      discountTotal={discount}
                      kdvTotal={kdv}
                      otvTotal={otv}
                      grandTotal={grandTotal}
                      paidAmount={paid}
                      paymentMethod={purchase.payment_method}
                      hidePaymentDetails={true}
                    />
                  </div>
                </div>
              </div>

              {/* Fatura Hareketleri / Ödemeler */}
              <div className="bg-white border border-gray-200/60 rounded-xl shadow-sm overflow-hidden print:hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <History className="w-5 h-5 text-[#5da83f]" />
                    <h2 className="text-sm font-semibold text-gray-700">Fatura Hareketleri</h2>
                  </div>
                </div>
                
                {(() => {
                  const movementsList = (() => {
                    const items = [{
                      id: 'init',
                      method: 'Fatura Oluşturuldu',
                      notes: 'Alış Gerçekleşti',
                      date: purchase.created_at || purchase.invoice_date,
                      amount: grandTotal,
                      isAdd: true,
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
                        register: p.register,
                      });
                    });

                    let bal = grandTotal;
                    items[0].remaining = bal;
                    for (let i = 1; i < items.length; i++) {
                        bal -= items[i].amount;
                        items[i].remaining = Math.max(0, bal);
                    }
                    
                    return items.reverse();
                  })();

                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
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

                            if (mov.isAdd) {
                              bgClass = 'bg-blue-50 text-blue-700 border border-blue-100';
                              Icon = FileText;
                            } else {
                              if (mov.method.includes('Havale') || mov.method.includes('EFT') || mov.method.includes('Banka')) {
                                Icon = Landmark;
                                methodLabel = 'Havale / EFT';
                              } else if (mov.method.includes('Nakit')) {
                                Icon = Banknote;
                                methodLabel = 'Nakit';
                              } else if (mov.method.includes('Kredi Kartı') || mov.method.includes('POS')) {
                                methodLabel = 'Kredi Kartı';
                              } else if (mov.method.includes('Çek')) {
                                methodLabel = 'Çek';
                              }
                            }

                            return (
                            <tr key={mov.id} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-5 py-4">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] font-bold ${bgClass}`}>
                                  <Icon className="w-3.5 h-3.5"/>
                                  {methodLabel}
                                </span>
                              </td>
                              <td className="px-5 py-4 text-[13px] font-semibold text-gray-700">{mov.register || '—'}</td>
                              <td className="px-5 py-4 text-[14px] font-medium text-gray-600">{mov.notes}</td>
                              <td className="px-5 py-4 text-[14px] font-medium text-gray-500">{fmtDate(mov.date)}</td>
                              <td className="px-5 py-4 text-right font-bold text-gray-900 text-[15px]">
                                <span className={!mov.isAdd ? "text-emerald-600" : ""}>{mov.isAdd ? '' : '-'}{fmt(mov.amount)}</span>
                              </td>
                              <td className="px-5 py-4 text-right font-bold text-gray-600 text-[15px]">{fmt(mov.remaining)}</td>
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

            {/* Right Column: Supplier Card */}
            <div className="w-[280px] shrink-0 space-y-4 flex flex-col print:hidden">
              {/* Supplier card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-4 h-4 text-[#5da83f]" />
                  <span className="text-sm font-semibold text-gray-700">Tedarikçi</span>
                </div>
                {purchase.supplier ? (
                  <div className="flex flex-col gap-1">
                    <p 
                      className="font-bold text-gray-900 hover:text-[#5da83f] cursor-pointer inline-block transition-colors"
                      onClick={() => { startNavigation(); setTimeout(() => navigate(`/suppliers/${purchase.supplier.id}`), 150); }}
                    >
                      {purchase.supplier.name}
                    </p>
                    {purchase.supplier.phone && <p className="text-xs text-gray-500">📞 {purchase.supplier.phone}</p>}
                    {purchase.supplier.email && <p className="text-xs text-gray-500">✉ {purchase.supplier.email}</p>}
                    {purchase.supplier.balance !== 0 && (
                      <p className={`text-xs font-bold mt-1 ${purchase.supplier.balance > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                        Bakiye: ₺{fmt(Math.abs(purchase.supplier.balance))} {purchase.supplier.balance > 0 ? '(Borçlu)' : '(Alacaklı)'}
                      </p>
                    )}
                    {remaining > 0 && purchase.status !== 'cancelled' && (
                      <button
                        onClick={() => { setPayAmount(remaining); setPaymentModal(true); }}
                        className="mt-3 flex justify-center items-center gap-2 w-full px-4 py-2.5 text-sm font-semibold rounded-lg border bg-emerald-50 text-emerald-600 border-emerald-200/60 hover:bg-emerald-100 hover:border-emerald-300 transition-all"
                      >
                        <CreditCard className="w-4 h-4" /> Ödeme Ekle
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    <p className="text-sm text-gray-400">Genel Tedarikçi</p>
                    {remaining > 0 && purchase.status !== 'cancelled' && (
                      <button
                        onClick={() => { setPayAmount(remaining); setPaymentModal(true); }}
                        className="mt-3 flex justify-center items-center gap-2 w-full px-4 py-2.5 text-sm font-semibold rounded-lg border bg-emerald-50 text-emerald-600 border-emerald-200/60 hover:bg-emerald-100 hover:border-emerald-300 transition-all"
                      >
                        <CreditCard className="w-4 h-4" /> Ödeme Ekle
                      </button>
                    )}
                  </div>
                )}
              </div>
              
              <div className="bg-white border text-base border-gray-100 rounded-xl shadow-sm p-4 relative z-10 w-full">
                <div ref={catPopupRef} className="relative">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" /> Fatura Kategorisi
                  </label>
                  <button
                    onClick={() => { setShowCatPopup(v => !v); setShowOtherMenu(false); setCatSearch(''); }}
                    className={`flex items-center justify-between w-full text-sm font-medium font-sans px-3 py-2.5 rounded-lg border cursor-pointer select-none transition-all shadow-sm ${
                      showCatPopup
                        ? 'bg-gray-50 text-gray-800 border-gray-300'
                        : 'bg-white text-gray-800 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {categoryName}
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-150 ${showCatPopup ? 'rotate-180' : ''}`} />
                  </button>

                  {showCatPopup && (
                    <div
                      className="absolute left-0 right-0 top-full mt-1 z-50 w-full"
                      style={{
                        background: 'rgba(255,255,255,0.98)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(226,232,240,0.8)',
                        boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
                        borderRadius: 12,
                        padding: 6,
                        maxHeight: 280,
                        overflowY: 'auto',
                      }}
                    >
                      <div className="flex items-center gap-2 px-2 py-1.5 mb-1 border border-gray-100 rounded-lg bg-gray-50">
                        <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <input
                          autoFocus
                          value={catSearch}
                          onChange={e => setCatSearch(e.target.value)}
                          placeholder="Kategori ara..."
                          className="text-xs bg-transparent outline-none w-full text-gray-700 placeholder-gray-400"
                        />
                      </div>
                      {filteredCats.map(cat => {
                        const isActive = purchase && cat.id === purchase.category_id;
                        return (
                          <button
                            key={cat.id}
                            onClick={() => handleCategorySelect(cat)}
                            className={`flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg transition-colors text-left ${
                              isActive ? 'bg-emerald-50 text-emerald-700 font-medium' : 'hover:bg-gray-50 text-gray-700'
                            }`}
                          >
                            <Tag className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
                            <span className="flex-1">{cat.name}</span>
                            {isActive && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                          </button>
                        );
                      })}
                      {filteredCats.length === 0 && (
                        <p className="text-xs text-gray-400 text-center py-3">Kategori bulunamadı.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── Payment Modal ──────────────────────────────────────────────── */}
      <Modal isOpen={paymentModal} onClose={() => setPaymentModal(false)} title="Ödeme Ekle" size="md">
        <form onSubmit={handlePayment} className="space-y-4">
          <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100/50">
            <p className="text-[13px] text-gray-500 font-medium mb-1">
              Fatura Kalan Borç
            </p>
            <p className="text-xl font-bold text-red-600">₺{fmt(remaining)}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Ödeme Yöntemi</label>
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
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Ödeme Tarihi</label>
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
                placeholder="(Varsayılan Kasa)"
                value={payAccountId}
                onChange={v => setPayAccountId(v)}
                options={cashRegisters
                  .filter(r => {
                    if (payMethod === 'cash') return r.type === 'cash' || r.type === 'general';
                    if (payMethod === 'bank_transfer') return r.type === 'bank';
                    if (payMethod === 'credit_card') return r.type === 'pos';
                    return true;
                  })
                  .map(r => ({ value: String(r.id), label: r.name }))
                }
                className="w-full shadow-sm text-[14px]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Tutar (₺)</label>
              <input
                type="number"
                min="0.01"
                max={remaining > 0 ? remaining : undefined}
                step="0.01"
                required
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                className="w-full text-[14px] font-bold border border-emerald-200 bg-emerald-50/30 rounded-xl px-3 py-2.5 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-right"
              />
            </div>
          </div>

          <div>
             <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Açıklama</label>
             <input
               type="text"
               placeholder="Ödeme açıklaması..."
               value={payNotes}
               onChange={e => setPayNotes(e.target.value)}
               className="w-full text-[14px] font-medium border border-gray-200 rounded-xl px-3 py-2.5 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
             />
          </div>
          <div className="flex gap-3 pt-3 border-t border-gray-100">
            <button type="button" onClick={() => setPaymentModal(false)} className="flex-1 py-2.5 text-[15px] rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-bold transition-colors">
              İptal
            </button>
            <button type="submit" disabled={actionLoading} className="flex-1 py-2.5 text-[15px] rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold transition-colors disabled:opacity-50">
              {actionLoading ? 'İşleniyor...' : 'Ödemeyi Kaydet'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Delete Confirm Modal ──────────────────────────────────────── */}
      <Modal isOpen={deleteConfirm} onClose={() => setDeleteConfirm(false)} title="Faturayı İptal Et" size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-100">
            <Trash2 className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
            <p className="text-[15px] font-medium text-red-800 leading-snug">
              Bu alış faturası iptal edilecek ve stokları geri alınacaktır. Bu işlem geri alınamaz.
            </p>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setDeleteConfirm(false)} className="flex-1 py-2.5 text-[15px] rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-bold transition-colors">
              Vazgeç
            </button>
            <button onClick={handleDelete} disabled={actionLoading} className="flex-1 py-2.5 text-[15px] rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold transition-colors disabled:opacity-50 shadow-sm shadow-red-500/20">
              {actionLoading ? 'İptal Ediliyor...' : 'Evet, İptal Et'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
