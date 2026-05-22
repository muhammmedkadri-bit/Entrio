import React from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  Banknote, ShoppingCart, TrendingUp, ArrowRightLeft,
  Plus, Edit2, Trash2, Package, RotateCcw, TrendingDown,
  CreditCard, Wallet, Building2, Receipt
} from 'lucide-react';
import {
  BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, Cell
} from 'recharts';
import { useNavigate } from 'react-router-dom';

/* ─── Transaction tipi → görsel bilgiler ──────────────────── */
const TX_META = {
  sale_in:              { label: 'Satış',    icon: ShoppingCart, color: 'bg-green-100 text-green-600',  sign: '+' },
  customer_payment_in:  { label: 'Tahsilat', icon: Banknote,     color: 'bg-emerald-100 text-emerald-600', sign: '+' },
  return_in:            { label: 'İade',     icon: RotateCcw,    color: 'bg-amber-100 text-amber-600',  sign: '' },
  return_out:           { label: 'İade',     icon: RotateCcw,    color: 'bg-amber-100 text-amber-600',  sign: '-' },
  purchase_out:         { label: 'Alış',     icon: Package,      color: 'bg-blue-100 text-blue-600',    sign: '-' },
  supplier_payment_out: { label: 'Ödeme',    icon: CreditCard,   color: 'bg-purple-100 text-purple-600',sign: '-' },
  expense_out:          { label: 'Gider',    icon: TrendingDown, color: 'bg-rose-100 text-rose-600',    sign: '-' },
  withdrawal_out:       { label: 'Para Çıkış', icon: Wallet,     color: 'bg-slate-100 text-slate-600',  sign: '-' },
  deposit_in:           { label: 'Para Giriş', icon: Wallet,     color: 'bg-teal-100 text-teal-600',    sign: '+' },
};

const getTxDescription = (tx) => {
  const type = tx.transaction_type;
  if (type === 'sale_in') {
    return tx.saleNumber ? `Fiş: ${tx.saleNumber}` : (tx.entityName || 'Satış');
  }
  if (type === 'return_in' || type === 'return_out') {
    const saleNo = tx.originalSaleNumber || tx.saleNumber;
    return saleNo ? `${saleNo} Nolu Satış İadesi` : 'İade';
  }
  if (type === 'purchase_out') {
    return tx.invoiceNumber ? `Fatura: ${tx.invoiceNumber}` : (tx.entityName || '-');
  }
  if (type === 'expense_out') {
    return tx.notes || tx.description || 'Gider';
  }
  if (type === 'supplier_payment_out') {
    return tx.entityName || tx.notes || 'Tedarikçi Ödemesi';
  }
  if (type === 'customer_payment_in') {
    return tx.entityName || tx.notes || 'Müşteri Tahsilatı';
  }
  if (type === 'deposit_in') return tx.notes || tx.description || 'Para Girişi';
  if (type === 'withdrawal_out') return tx.notes || tx.description || 'Para Çıkışı';
  return tx.notes || tx.description || '-';
};

/* ─── Tooltip (Günlük Analiz) ─────────────────────────────── */
const MobileChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const fmt = (v) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(v || 0);
  return (
    <div className="bg-white border border-slate-100 rounded-xl shadow-lg p-3 text-xs min-w-[140px]">
      <p className="font-bold text-slate-700 mb-2 pb-1 border-b border-slate-100">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex justify-between items-center gap-3 mt-1">
          <span className={`font-semibold ${p.dataKey === 'income' ? 'text-green-600' : 'text-rose-500'}`}>
            {p.dataKey === 'income' ? 'Gelir' : 'Gider'}
          </span>
          <span className="font-black text-slate-800">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

/* ─── Son İşlemler kartı ───────────────────────────────────── */
const MobileTransactionCard = ({ tx, onClick }) => {
  if (tx.isEmpty) return <div className="h-14 rounded-xl bg-slate-50 mb-2 border border-dashed border-slate-200" />;

  const meta = TX_META[tx.transaction_type] || {
    label: 'İşlem', icon: Receipt, color: 'bg-slate-100 text-slate-600', sign: ''
  };
  const Icon = meta.icon;
  const desc = getTxDescription(tx);
  const fmt = (v) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Math.abs(v || 0));
  const amountColor = meta.sign === '+' ? 'text-green-600' : meta.sign === '-' ? 'text-rose-600' : 'text-slate-800';

  return (
    <div
      onClick={onClick}
      className="flex items-center p-3 bg-white border border-slate-100 rounded-xl mb-2 active:scale-[0.98] transition-transform shadow-sm cursor-pointer"
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 mr-3 ${meta.color}`}>
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-slate-800 text-sm truncate">{meta.label}</h4>
        <p className="text-xs text-slate-500 truncate mt-0.5">{desc}</p>
      </div>
      <div className="text-right ml-2 shrink-0">
        <div className={`font-bold text-sm ${amountColor}`}>
          {meta.sign}{fmt(tx.displayAmount)}
        </div>
        <div className="text-[10px] text-slate-400 mt-0.5">
          {format(new Date(tx.created_at || new Date()), 'HH:mm')}
        </div>
      </div>
    </div>
  );
};

/* ─── Ana bileşen ─────────────────────────────────────────── */
export const MobileDashboard = ({
  companyName,
  companyLogo,
  currentTime,
  salesSummary,
  cashReport,
  allRegisters = [],
  recentTransactions,
  quickNotes,
  onAddNote,
  onDeleteNote,
  charts,
  onTxClick // We might still use this as fallback, but let's handle click locally
}) => {
  const navigate = useNavigate();
  const handleNav = (path) => navigate(path);

  const [selectedMobileTx, setSelectedMobileTx] = React.useState(null);
  const [translateY, setTranslateY] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);
  const dragStartY = React.useRef(0);
  const currentTranslateY = React.useRef(0);
  const isDraggingRef = React.useRef(false);
  const handleRef = React.useRef(null);

  /* ── Scroll lock: target <main> (the real scroll container), not body ── */
  React.useEffect(() => {
    const mainEl = document.querySelector('main');
    if (!mainEl) return;
    if (selectedMobileTx) {
      mainEl.style.overflowY = 'hidden';
    } else {
      mainEl.style.overflowY = '';
    }
    return () => {
      mainEl.style.overflowY = '';
    };
  }, [selectedMobileTx]);

  /* ── Non-passive drag handlers for the notch handle ── */
  React.useEffect(() => {
    const handle = handleRef.current;
    if (!handle || !selectedMobileTx) return;

    const onStart = (e) => {
      dragStartY.current = e.touches[0].clientY;
      isDraggingRef.current = true;
      setIsDragging(true);
    };

    const onMove = (e) => {
      if (!isDraggingRef.current) return;
      // Must call preventDefault() to stop iOS from scrolling behind the sheet.
      // This only works with a non-passive listener.
      if (e.cancelable) e.preventDefault();
      const diff = e.touches[0].clientY - dragStartY.current;
      if (diff > 0) {
        currentTranslateY.current = diff;
        setTranslateY(diff);
      }
    };

    const onEnd = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
      if (currentTranslateY.current > 100) {
        setSelectedMobileTx(null);
      }
      setTranslateY(0);
      currentTranslateY.current = 0;
      dragStartY.current = 0;
    };

    handle.addEventListener('touchstart', onStart, { passive: true });
    handle.addEventListener('touchmove', onMove, { passive: false }); // non-passive!
    handle.addEventListener('touchend', onEnd);

    return () => {
      handle.removeEventListener('touchstart', onStart);
      handle.removeEventListener('touchmove', onMove);
      handle.removeEventListener('touchend', onEnd);
    };
  }, [selectedMobileTx]); // Re-attach every time the sheet opens (handle remounts)


  /* Bugünkü gelir/gider (son eleman = bugün) */
  const todayData = charts?.dailyIncomeExpense?.[charts.dailyIncomeExpense.length - 1] || { income: 0, expense: 0 };
  const todayIncome  = todayData.income  || 0;
  const todayExpense = todayData.expense || 0;

  /* Net Bakiye: nakit + pos + banka kasaları toplamı */
  const netBalance = allRegisters
    .filter(r => ['cash', 'pos', 'bank'].includes(r.type))
    .reduce((sum, r) => sum + (r.current_balance || 0), 0);

  const fmt = (v) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(v || 0);

  return (
    <div className="flex flex-col gap-4 pb-4 relative">

      {/* ── HEADER ── */}
      <div className="flex justify-between items-end px-1 pt-2">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">{companyName}</h1>
          <p className="text-sm text-slate-500 font-medium">{format(currentTime, 'd MMMM yyyy, EEEE', { locale: tr })}</p>
        </div>
        {companyLogo ? (
          <img src={companyLogo} alt="Logo" className="h-10 object-contain drop-shadow-sm" />
        ) : (
          <div className="bg-[#5da83f]/10 text-[#5da83f] p-2 rounded-xl">
            <Banknote className="w-6 h-6" />
          </div>
        )}
      </div>

      {/* ── SWIPEABLE STATS ── */}
      <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-2 -mx-2 px-2 scrollbar-hide">

        {/* Bugünkü Gelir */}
        <div className="snap-center shrink-0 w-[80%] bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-2xl p-4 shadow-md">
          <div className="flex justify-between items-start mb-2">
            <div className="bg-white/20 p-2 rounded-lg"><ShoppingCart size={18} /></div>
            <span className="text-xs font-semibold bg-white/20 px-2 py-1 rounded-full">Bugün</span>
          </div>
          <p className="text-sm text-green-100 font-medium">Bugünkü Toplam Gelir</p>
          <h2 className="text-2xl font-black mt-0.5">{fmt(todayIncome)}</h2>
        </div>

        {/* Bugünkü Gider */}
        <div className="snap-center shrink-0 w-[80%] bg-gradient-to-br from-rose-500 to-rose-600 text-white rounded-2xl p-4 shadow-md">
          <div className="flex justify-between items-start mb-2">
            <div className="bg-white/20 p-2 rounded-lg"><TrendingDown size={18} /></div>
            <span className="text-xs font-semibold bg-white/20 px-2 py-1 rounded-full">Bugün</span>
          </div>
          <p className="text-sm text-rose-100 font-medium">Bugünkü Toplam Gider</p>
          <h2 className="text-2xl font-black mt-0.5">{fmt(todayExpense)}</h2>
        </div>

        {/* Net Bakiye */}
        <div className="snap-center shrink-0 w-[80%] bg-gradient-to-br from-indigo-600 to-brand-700 text-white rounded-2xl p-4 shadow-md">
          <div className="flex justify-between items-start mb-2">
            <div className="bg-white/20 p-2 rounded-lg"><Building2 size={18} /></div>
            <span className="text-xs font-semibold bg-white/20 px-2 py-1 rounded-full">Kasa</span>
          </div>
          <p className="text-sm text-indigo-100 font-medium">Net Bakiye</p>
          <h2 className="text-2xl font-black mt-0.5">{fmt(netBalance)}</h2>
          <p className="text-[11px] text-indigo-200 mt-1">Nakit + POS + Banka</p>
        </div>
      </div>

      {/* ── QUICK ACTIONS GRID ── */}
      <div className="grid grid-cols-2 gap-3 mt-1">
        <button
          onClick={() => handleNav('/pos')}
          className="flex flex-col items-center justify-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm active:scale-95 transition-transform"
        >
          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-2">
            <ShoppingCart size={24} />
          </div>
          <span className="font-semibold text-sm text-slate-800">Hızlı Satış</span>
        </button>
        <button
          onClick={() => handleNav('/cash')}
          className="flex flex-col items-center justify-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm active:scale-95 transition-transform"
        >
          <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-full flex items-center justify-center mb-2">
            <ArrowRightLeft size={24} />
          </div>
          <span className="font-semibold text-sm text-slate-800">Gelir / Gider</span>
        </button>
      </div>

      {/* ── GÜNLÜK ANALİZ CHART ── */}
      {charts?.dailyIncomeExpense?.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm mt-1">
          <h3 className="font-bold text-slate-800 text-sm mb-1 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#5da83f]" /> Günlük Analiz
          </h3>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
              <span className="text-[11px] text-slate-500 font-medium">Gelir</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
              <span className="text-[11px] text-slate-500 font-medium">Gider</span>
            </div>
          </div>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.dailyIncomeExpense} barGap={2} barCategoryGap="25%">
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <Tooltip
                  content={<MobileChartTooltip />}
                  cursor={{ fill: 'rgba(148,163,184,0.08)' }}
                />
                <Bar dataKey="income"  fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="expense" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── HIZLI NOTLAR ── */}
      <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm mt-1">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <Edit2 className="w-4 h-4 text-yellow-500" /> Hızlı Notlar
          </h3>
        </div>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            id="mobile-note-input"
            placeholder="Kısa not ekle..."
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#5da83f]"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.target.value.trim()) {
                onAddNote(e.target.value.trim());
                e.target.value = '';
              }
            }}
          />
          <button
            onClick={() => {
              const input = document.getElementById('mobile-note-input');
              if (input?.value.trim()) { onAddNote(input.value.trim()); input.value = ''; }
            }}
            className="bg-[#5da83f] text-white p-2 rounded-xl active:scale-95 transition-transform"
          >
            <Plus size={20} />
          </button>
        </div>
        <div className="space-y-2">
          {quickNotes?.length > 0 ? (
            quickNotes.slice(0, 4).map(note => (
              <div key={note.id} className="flex items-center justify-between bg-yellow-50/60 border border-yellow-100 rounded-lg p-2.5">
                <span className="text-sm text-slate-700 truncate mr-2">{note.text}</span>
                <button onClick={() => onDeleteNote(note.id)} className="text-rose-400 p-1 shrink-0 active:scale-90 transition-transform">
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-400 text-center py-2">Henüz not eklenmemiş.</p>
          )}
        </div>
      </div>

      {/* ── SON İŞLEMLER ── */}
      <div className="mt-1 pb-24">
        <div className="flex justify-between items-center mb-3 px-1">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-slate-400" /> Son İşlemler
          </h3>
        </div>
        <div>
          {recentTransactions?.filter(t => !t.isEmpty).length > 0 ? (
            recentTransactions.map((tx, idx) => (
              <MobileTransactionCard key={tx.id || idx} tx={tx} onClick={() => !tx.isEmpty && setSelectedMobileTx(tx)} />
            ))
          ) : (
            <div className="text-center py-6 bg-white border border-slate-100 rounded-xl">
              <p className="text-sm text-slate-400">Bugün henüz işlem yapılmadı.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── MOBILE QUICK VIEW MODAL ── */}
      {selectedMobileTx && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in"
            onClick={() => setSelectedMobileTx(null)}
          />
          
          {/* Bottom Sheet Modal */}
          <div 
            className="relative bg-white w-full rounded-t-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom duration-300"
            style={{
              transform: `translateY(${translateY}px)`,
              transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Handle / drag notch — listeners attached imperatively (non-passive) */}
            <div
              ref={handleRef}
              className="w-full py-3 cursor-grab active:cursor-grabbing flex justify-center shrink-0 bg-white select-none"
              style={{ touchAction: 'none' }}
            >
              <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
            </div>
            
            {/* Scrollable Container */}
            <div className="flex-1 overflow-y-auto px-5 pb-28 pt-2">
              {(() => {
                const tx = selectedMobileTx;
                const meta = TX_META[tx.transaction_type] || { label: 'İşlem', icon: Receipt, color: 'bg-slate-100 text-slate-600', sign: '' };
                const Icon = meta.icon;
                const desc = getTxDescription(tx);
                const amountColor = meta.sign === '+' ? 'text-green-600' : meta.sign === '-' ? 'text-rose-600' : 'text-slate-800';
                
                // Define navigation paths based on type
                let navPath = null;
                if (tx.transaction_type === 'sale_in') navPath = tx.sale_id || tx.reference_id ? `/sales/${tx.sale_id || tx.reference_id}` : '/sales';
                else if (tx.transaction_type === 'purchase_out') navPath = tx.purchase_id || tx.reference_id ? `/purchases/${tx.purchase_id || tx.reference_id}` : '/purchases';
                else if (tx.transaction_type === 'return_in' || tx.transaction_type === 'return_out') navPath = tx.originalSaleId ? `/sales/${tx.originalSaleId}` : null;
                
                return (
                  <div className="flex flex-col">
                    {/* Header: Icon & Type */}
                    <div className="flex items-center gap-3 mb-6">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${meta.color}`}>
                        <Icon size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-lg">{meta.label} Detayı</h3>
                        <p className="text-sm font-medium text-slate-500">{format(new Date(tx.created_at || new Date()), 'd MMMM yyyy HH:mm', { locale: tr })}</p>
                      </div>
                    </div>

                    {/* Info List & Amount Card container */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-slate-50 rounded-2xl p-4 flex flex-col justify-center border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">İşlem Tutarı</span>
                        <span className={`text-2xl font-black tracking-tight ${amountColor}`}>
                          {meta.sign}{fmt(tx.displayAmount)}
                        </span>
                      </div>
                      <div className="bg-slate-50 rounded-2xl p-4 flex flex-col justify-center border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">Ödeme / Yöntem</span>
                        <span className="text-sm font-bold text-slate-700 leading-tight uppercase tracking-wide">
                          {tx.paymentMethodLabel || '-'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 mb-6 px-1">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Açıklama / Not</span>
                        <span className="text-sm font-semibold text-slate-800 mt-0.5 leading-snug">{desc}</span>
                      </div>
                      {tx.entityName && (
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Cari Hesap</span>
                          <span className="text-sm font-semibold text-slate-800 mt-0.5">{tx.entityName}</span>
                        </div>
                      )}
                    </div>

                    {/* Thermal Receipt Preview (If items exist) */}
                    {tx.items && tx.items.length > 0 && (
                      <div className="mb-6 relative mx-1 drop-shadow-sm">
                        <div className="bg-[#fdfbf7] border border-slate-300 rounded-sm p-4 font-mono text-slate-800 relative z-10">
                          {/* Header */}
                          <div className="text-center mb-3">
                            <h4 className="font-bold text-[13px] tracking-widest">{companyName?.toUpperCase() || 'ENTRIO'}</h4>
                            <p className="text-[10px] mt-1 text-slate-500 font-semibold">Fiş Önizlemesi</p>
                          </div>
                          
                          <div className="border-b border-dashed border-slate-400 pb-2 mb-2 text-[10px] flex justify-between font-semibold">
                            <span>{format(new Date(tx.created_at || new Date()), 'dd/MM/yyyy HH:mm')}</span>
                            <span>Fiş: {tx.saleNumber || tx.invoiceNumber || '-'}</span>
                          </div>
                          
                          {/* Items */}
                          <div className="flex flex-col max-h-[180px] overflow-y-auto mb-2 pr-1">
                            {tx.items.map((item, idx) => (
                              <div key={idx} className="flex flex-col text-[11px] mb-2 last:mb-0">
                                <span className="font-bold leading-tight truncate">{item.productName}</span>
                                <div className="flex justify-between items-end mt-0.5">
                                  <span className="text-slate-600 font-medium">{item.quantity} x {fmt(item.unit_price)}</span>
                                  <span className="font-bold">{fmt(item.line_total)}</span>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Totals */}
                          <div className="border-t border-dashed border-slate-400 pt-2 mt-2">
                            <div className="flex justify-between text-[13px] font-black">
                              <span>TOPLAM</span>
                              <span>{fmt(tx.displayAmount)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="mt-2">
                      {navPath ? (
                        <button 
                          onClick={() => {
                            setSelectedMobileTx(null);
                            handleNav(navPath);
                          }}
                          className="w-full py-4 rounded-xl font-bold text-white bg-[#5da83f] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-500/20"
                        >
                          <Receipt size={18} /> Detaylı Fişi Gör
                        </button>
                      ) : (
                        <button 
                          onClick={() => setSelectedMobileTx(null)}
                          className="w-full py-4 rounded-xl font-bold text-slate-600 bg-slate-100 active:scale-[0.98] transition-all"
                        >
                          Kapat
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
