import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatedDropdown } from '../../components/ui/AnimatedDropdown';
import { FilterChipDropdown } from '../../components/ui/FilterChipDropdown';
import { DatePicker } from '../../components/ui/DatePicker';
import {
  Plus, ShoppingBag, CheckCircle, Clock,
  Building2, Eye, Trash2, ChevronLeft, ChevronRight, Zap, Filter, Calendar, Tag, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format, parseISO, isAfter, isSameDay, isWithinInterval, startOfDay, endOfDay, subDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import { purchaseService } from '../../services/purchaseService';
import { supplierService } from '../../services/supplierService';
import { PremiumLoader } from '../../components/ui/PremiumLoader';
import { Search } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useCartStore } from '../../store/cartStore';

// ── Hooks ──────────────────────────────────────────────────────────────────
function useClickOutside(ref, handler) {
  useEffect(() => {
    const listener = (event) => {
      if (!ref.current || ref.current.contains(event.target)) return;
      handler(event);
    };
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler]);
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(v || 0);

const fmtDateLong = (d) => {
  if (!d) return '—';
  try {
    const date = typeof d === 'number' ? new Date(d) : parseISO(d);
    return format(date, 'd MMMM yyyy HH:mm', { locale: tr });
  } catch { return '—'; }
};

const fmtDateShort = (d) => {
  if (!d) return '—';
  try { return format(typeof d === 'number' ? new Date(d) : parseISO(d), 'dd.MM.yyyy'); }
  catch { return '—'; }
};

const PAYMENT_STATUS = {
  all:          { label: 'Tümü' },
  paid:         { label: 'Ödenmiş' },
  overdue:      { label: 'Vadesi Geçen' },
  pending_due:  { label: 'Vadesi Gelmemiş' },
  due_unknown:  { label: 'Vadesi Bilinmeyen' },
};

const ITEMS_PER_PAGE = 10;

function SummaryCard({ icon: Icon, title, value, sub, color }) {
  const colors = {
    blue:   { bg: 'from-blue-500/10  to-blue-400/5',   border: 'border-blue-100',   icon: 'bg-blue-100   text-blue-600',   val: 'text-blue-700'  },
    emerald:{ bg: 'from-emerald-500/10 to-emerald-400/5', border: 'border-emerald-100', icon: 'bg-emerald-100 text-emerald-600', val: 'text-emerald-700' },
    orange: { bg: 'from-orange-500/10 to-orange-400/5', border: 'border-orange-100', icon: 'bg-orange-100  text-orange-600', val: 'text-orange-700' },
  }[color] || {};

  return (
    <div className={`rounded-2xl border p-4 bg-gradient-to-br ${colors.bg} ${colors.border} flex items-center gap-4`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors.icon} shrink-0`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gray-500 mb-0.5">{title}</p>
        <p className={`text-lg font-extrabold ${colors.val} truncate`}>{value}</p>
        {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export const PurchasesPage = () => {
  const navigate = useNavigate();
  const { startNavigation } = useAppStore();
  const setPosMode = useCartStore(s => s.setPosMode);
  const [purchases, setPurchases]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [summary, setSummary]         = useState({ count: 0, totalAmount: 0, paidAmount: 0, pendingDebt: 0 });
  const [highestDebtInfo, setHighestDebtInfo] = useState({ name: 'Yok', amount: 0 });

  // Filters
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange]     = useState({ start: startOfDay(subDays(new Date(), 30)), end: endOfDay(new Date()) });
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Filter Toggle Logic
  const [activeFilters, setActiveFilters] = useState(['date']); // default visible
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target)) {
        setIsFilterMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleFilter = (filterName) => {
    if (filterName === 'category') {
      toast('Kategorizasyon özelliği çok yakında!', { icon: '📦' });
      return;
    }
    setActiveFilters(prev => {
      if (prev.includes(filterName)) {
        if (filterName === 'status') setStatusFilter('all');
        if (filterName === 'date') setDateRange({start: null, end: null});
        return prev.filter(f => f !== filterName);
      }
      return [...prev, filterName];
    });
    setIsFilterMenuOpen(false);
  };

  // Pagination
  const [page, setPage] = useState(1);

  // ── Load ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [data, sum, sups] = await Promise.all([
        purchaseService.getAll(),
        purchaseService.getMonthSummary(),
        supplierService.getAll(),
      ]);
      setPurchases(data);
      setSummary(sum);

      // Find highest debt supplier
      let maxDebt = 0;
      let maxName = 'Yok';
      sups.forEach(s => {
        if (s.balance > maxDebt) {
          maxDebt = s.balance;
          maxName = s.name;
        }
      });
      setHighestDebtInfo({ name: maxName, amount: maxDebt });
      
    } catch (e) {
      console.error('[PurchasesPage] Veriler yüklenemedi:', e);
      toast.error(e?.message || 'Veriler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  // ── Filter ──────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let res = [...purchases];

    if (search) {
      const q = search.toLowerCase();
      res = res.filter(p => 
        (p.invoice_number && p.invoice_number.toLowerCase().includes(q)) ||
        (p.supplier_name && p.supplier_name.toLowerCase().includes(q))
      );
    }

    if (statusFilter !== 'all') {
      const today = new Date();
      res = res.filter(p => {
        const isPaid = p.payment_status === 'paid';
        const d = p.due_date ? parseISO(p.due_date) : null;
        
        switch (statusFilter) {
          case 'paid': 
            return isPaid;
          case 'overdue': 
            return !isPaid && d && isAfter(today, d) && !isSameDay(today, d);
          case 'pending_due': 
            return !isPaid && d && (!isAfter(today, d) || isSameDay(today, d));
          case 'due_unknown': 
            return !isPaid && !d;
          default:
            return true;
        }
      });
    }

    if (dateRange?.start && dateRange?.end) {
      const s = startOfDay(dateRange.start);
      const e = endOfDay(dateRange.end);
      res = res.filter(p => {
        const d = p.invoice_date ? parseISO(p.invoice_date) : new Date(p.created_at);
        return isWithinInterval(d, { start: s, end: e });
      });
    }
    return res;
  }, [purchases, statusFilter, dateRange, search]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated  = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  useEffect(() => { setPage(1); }, [statusFilter, dateRange, search]);

  // Pagination UI Helpers (copied from ProductsTab)
  const renderPaginationButtons = () => {
    const maxVisible = 5;
    let startPage = Math.max(1, page - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    const buttons = [];
    for (let i = startPage; i <= endPage; i++) {
      buttons.push(
        <button
          key={i}
          onClick={() => setPage(i)}
          className={`flex items-center justify-center w-7 h-7 text-xs rounded-lg transition-colors ${
            page === i
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-600 font-semibold'
              : 'bg-white/20 backdrop-blur-md border border-white/40 shadow-[0_4px_16px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.7)] text-gray-500 hover:bg-white/40' // glassmorphism gray
          }`}
        >
          {i}
        </button>
      );
    }
    return buttons;
  };

  const startItem = (page - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(page * ITEMS_PER_PAGE, filtered.length);

  // Delete handled via detail modal

  // ── Due date cell ─────────────────────────────────────────────────────────
  const renderDueDate = (p) => {
    if (!p.due_date) return <span className="text-gray-400">—</span>;
    const today = new Date();
    try {
      const d = parseISO(p.due_date);
      if (p.payment_status === 'paid') return <span className="text-gray-400">{fmtDateShort(p.due_date)}</span>;
      if (isAfter(today, d) && !isSameDay(today, d)) {
        return <span className="font-bold text-red-600">{fmtDateShort(p.due_date)} ⚠</span>;
      }
      if (isSameDay(today, d)) {
        return <span className="font-semibold text-orange-500">{fmtDateShort(p.due_date)}</span>;
      }
      return <span className="text-gray-500">{fmtDateShort(p.due_date)}</span>;
    } catch { return <span className="text-gray-400">{p.due_date}</span>; }
  };

  return (
    <div className="flex flex-col h-full gap-4">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-50 border border-emerald-100 flex-shrink-0">
            <ShoppingBag className="w-6 h-6 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Alış Yönetimi</h1>
            <p className="text-sm text-slate-500">Tedarikçi faturalarınızı yönetin ve stok girişlerinizi takip edin.</p>
          </div>
        </div>
      </div>

      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
        
        {/* Left Side: Search */}
        <div className="flex items-center w-full lg:w-auto">
          {/* Search Box */}
          <div className="relative w-full sm:w-64 flex-shrink-0 group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
            <input 
              type="text" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tedarikçi veya fatura no ara..." 
              className="block w-full pl-10 pr-4 py-[11px] border border-slate-300 rounded-lg bg-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm shadow-sm transition-all text-ellipsis overflow-hidden whitespace-nowrap"
            />
          </div>
        </div>

        {/* Right Side: Active Filters + Buttons */}
        <div className="flex items-center justify-end gap-2 flex-wrap sm:flex-nowrap w-full lg:w-auto">
          
          {/* Aktif Filtreler */}
          {(activeFilters.includes('status') || activeFilters.includes('date')) && (
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto justify-end">
              {activeFilters.includes('status') && (
                <FilterChipDropdown
                  icon={Filter}
                  label="Durum Seçin"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  onClear={() => toggleFilter('status')}
                  options={[
                    { id: 'all', label: 'Tüm Durumlar' },
                    { id: 'paid', label: 'Ödenmiş' },
                    { id: 'overdue', label: 'Vadesi Geçen' },
                    { id: 'pending_due', label: 'Vadesi Gelmemiş' },
                    { id: 'due_unknown', label: 'Vadesi Bilinmeyen' },
                  ]}
                />
              )}

              {activeFilters.includes('date') && (
                <div className="flex items-center gap-1.5 py-2.5 px-3 bg-white border border-slate-200 hover:bg-slate-50 transition-colors rounded-lg shadow-sm whitespace-nowrap h-full">
                  <DatePicker 
                    value={dateRange}
                    onChange={setDateRange}
                    renderTrigger={({ isOpen, setIsOpen, value: val }) => {
                      return (
                        <button
                          onClick={() => setIsOpen(!isOpen)}
                          className="text-sm text-slate-700 bg-transparent flex items-center gap-2 outline-none font-semibold transition-colors"
                        >
                          <Calendar className="w-4 h-4 text-emerald-600" />
                          {val?.start && val?.end ? `${val.start.toLocaleDateString('tr-TR')} - ${val.end.toLocaleDateString('tr-TR')}` : "Tarih Seçiniz"}
                        </button>
                      )
                    }}
                  />
                  <div className="h-4 w-px bg-slate-200 mx-1"></div>
                  <div 
                    onClick={() => toggleFilter('date')}
                    className="text-slate-400 hover:text-red-500 cursor-pointer p-0.5 rounded transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Native Filtre Butonu */}
            <div className="relative" ref={filterMenuRef}>
              <button
                onClick={() => setIsFilterMenuOpen(o => !o)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-emerald-600 bg-emerald-50/10 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/10 shadow-sm transition-all whitespace-nowrap"
              >
                <Filter className="w-4 h-4" />
                Filtrele
                {activeFilters.length > 0 && (
                  <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-emerald-500 text-white text-[10px] font-bold px-1">
                    {activeFilters.length}
                  </span>
                )}
              </button>
              {isFilterMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 z-50 w-52 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden py-1">
                  {[
                    { id: 'status', label: 'Durum Filtresi', Icon: Filter },
                    { id: 'date', label: 'Tarih Aralığı', Icon: Calendar },
                    { id: 'category', label: 'Kategori (Yakında)', Icon: Tag },
                  ].map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      onClick={() => toggleFilter(id)}
                      className="w-full px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                    >
                      <span className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-slate-400" />
                        {label}
                      </span>
                      {activeFilters.includes(id) && (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Aktif</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setPosMode('purchase');
                startNavigation();
                setTimeout(() => navigate('/pos'), 150);
              }}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-sky-50/50 backdrop-blur-sm border border-sky-100 rounded-lg text-sky-600 hover:bg-sky-100 shadow-sm active:scale-95 transition-all outline-none whitespace-nowrap"
            >
              <Zap className="w-4 h-4 fill-sky-500" />
              Hızlı Alış
            </button>

            <button
              onClick={() => navigate('/purchases/new')}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold bg-[#10b981] hover:bg-[#059669] text-white rounded-lg shadow-sm transition-all whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Alış Faturası
            </button>
          </div>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div className="relative pb-14 mt-1 flex-1">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Column Header */}
          <div className="grid items-center px-4 py-3 border-b border-slate-100 bg-slate-50/80" style={{ gridTemplateColumns: '1.2fr 2fr 1.2fr 1.2fr 1.5fr 32px' }}>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Fatura No</span>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tedarikçi</span>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Fatura Tarihi</span>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Vade Tarihi</span>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right pr-4">Kalan Meblağ</span>
            <span />
          </div>

          {/* Rows */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
              <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Yükleniyor...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
              <ShoppingBag className="w-10 h-10 opacity-30" />
              <span className="text-sm font-medium">Hiç fatura bulunmuyor</span>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {paginated.map(p => (
                <div
                  key={p.id}
                  onClick={() => { startNavigation(); setTimeout(() => navigate(`/purchases/${p.id}`), 150); }}
                  className="grid items-center px-4 py-[13px] hover:bg-slate-50/80 cursor-pointer transition-colors group h-[62px]"
                  style={{ gridTemplateColumns: '1.2fr 2fr 1.2fr 1.2fr 1.5fr 32px' }}
                >
                  {/* Fatura No */}
                  <div className="min-w-0 pr-4">
                    {p.invoice_number
                      ? <span className="font-mono text-sm font-bold text-[#10b981] truncate block">{p.invoice_number}</span>
                      : <span className="text-slate-400 font-bold text-sm">—</span>}
                  </div>

                  {/* Tedarikçi */}
                  <div className="flex items-center gap-1.5 min-w-0 pr-4">
                    {p.supplier_name
                      ? <><Building2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /><span className="text-sm font-bold text-slate-800 truncate group-hover:text-emerald-600 transition-colors">{p.supplier_name}</span></>
                      : <span className="text-slate-400 italic text-sm truncate">Bilinmiyor</span>}
                  </div>

                  {/* Fatura Tarihi */}
                  <div>
                    <span className="text-sm font-medium text-slate-700">{fmtDateLong(p.invoice_date)}</span>
                  </div>

                  {/* Vade Tarihi */}
                  <div>
                    <span className="text-sm">{renderDueDate(p)}</span>
                  </div>

                  {/* Kalan Meblağ */}
                  <div className="flex justify-end pr-2">
                    <span className={`font-bold text-base tabular-nums ${p.remaining === 0 ? 'text-slate-300' : 'text-slate-900'}`}>{fmt(p.remaining)}</span>
                  </div>

                  {/* Chevron */}
                  <div className="flex justify-end">
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-400 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {filtered.length > 0 && (
          <div className="fixed bottom-5 right-6 flex items-center gap-3 z-20">
            <span className="text-xs text-gray-400">
              {filtered.length} fatura içinde {startItem}–{endItem} gösteriliyor
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/20 backdrop-blur-md border border-white/40 shadow-[0_4px_16px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.7)] text-gray-500 hover:bg-white/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {renderPaginationButtons()}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/20 backdrop-blur-md border border-white/40 shadow-[0_4px_16px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.7)] text-gray-500 hover:bg-white/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
