import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';
import { Building2, TrendingDown, TrendingUp, Scale, Plus, HandCoins, Edit, Trash2, Search, ChevronLeft, ChevronRight, Building } from 'lucide-react';
import toast from '../../components/ui/CustomToast';
import { StatCard } from '../../components/ui/StatCard';
import { DataTable } from '../../components/ui/DataTable';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { CariBalanceBadge } from './components/CariBalanceBadge';
import { SupplierFormModal } from './modals/SupplierFormModal';
import { PaymentModal } from './modals/PaymentModal';
import { useSuppliers } from '../../hooks/useSuppliers';

const SupplierRowSkeleton = () => (
  <div className="grid items-center px-4 py-[13px] border-b border-slate-100 last:border-0" style={{ gridTemplateColumns: '1.5fr 1fr 1fr 32px' }}>
    <div className="flex items-center gap-3 min-w-0 pr-4">
      <div className="w-9 h-9 rounded-lg bg-slate-100 animate-pulse flex-shrink-0" />
      <div className="h-4 bg-slate-100 rounded animate-pulse w-32" />
    </div>
    <div className="flex justify-center">
      <div className="h-4 bg-slate-100 rounded animate-pulse w-24" />
    </div>
    <div className="flex justify-end pr-2">
      <div className="h-6 bg-slate-100 rounded-full animate-pulse w-20" />
    </div>
    <div className="flex justify-end">
      <div className="w-4 h-4 bg-slate-100 rounded animate-pulse" />
    </div>
  </div>
);

const ITEMS_PER_PAGE = 10;

export const SuppliersPage = () => {
  const navigate = useNavigate();
  const { startNavigation } = useAppStore();

  // ── Realtime-aware data ────────────────────────────────────────────────
  const { suppliers: allSuppliers, loading, summary, refetch } = useSuppliers();

  const [currentPage, setCurrentPage] = useState(1);

  // Filters
  const [search, setSearch] = useState('');
  const [balanceFilter, setBalanceFilter] = useState('');

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [supplierToEdit, setSupplierToEdit] = useState(null);

  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [supplierForPayment, setSupplierForPayment] = useState(null);

  const suppliers = React.useMemo(() => {
    let res = [...allSuppliers];
    
    if (search) {
      const q = search.toLowerCase();
      res = res.filter(s => 
        (s.name && s.name.toLowerCase().includes(q)) || 
        (s.phone && s.phone.includes(q)) || 
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.tax_number && s.tax_number.includes(q))
      );
    }
    
    if (balanceFilter) {
      res = res.filter(s => {
        if (balanceFilter === 'debt') return s.balance > 0; // biz borçluyuz
        if (balanceFilter === 'receivable') return s.balance < 0; // biz alacaklıyız
        if (balanceFilter === 'zero') return s.balance === 0;
        return true;
      });
    }
    
    return res;
  }, [allSuppliers, search, balanceFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, balanceFilter]);

  const openForm = (s = null) => {
    setSupplierToEdit(s);
    setIsFormOpen(true);
  };

  const totalPages = Math.max(1, Math.ceil(suppliers.length / ITEMS_PER_PAGE));
  const paginated = suppliers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, suppliers.length);

  const renderPaginationButtons = () => {
    const maxVisible = 5;
    let s = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let e = Math.min(totalPages, s + maxVisible - 1);
    if (e - s + 1 < maxVisible) s = Math.max(1, e - maxVisible + 1);
    return Array.from({ length: e - s + 1 }, (_, i) => s + i).map(i => (
      <button
        key={i}
        onClick={() => setCurrentPage(i)}
        className={`flex items-center justify-center w-7 h-7 text-xs rounded-lg transition-colors ${
          currentPage === i
            ? 'bg-[#7ed957]/10 border border-[#7ed957]/30 text-[#5da83f] font-semibold'
            : 'bg-white/20 backdrop-blur-md border border-white/40 shadow-[0_4px_16px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.7)] text-gray-500 hover:bg-white/40'
        }`}
      >{i}</button>
    ));
  };

  return (
    <div className="flex flex-col h-full gap-4">
      
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#7ed957]/10 border border-[#7ed957]/20 flex-shrink-0">
            <Building2 className="w-6 h-6 text-[#7ed957]" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Tedarikçiler</h1>
            <p className="text-sm text-slate-500">Tedarikçi hesap özetleri, borç takibi ve ödeme işlemleri.</p>
          </div>
        </div>
      </div>

      {/* ── Toolbar ────────────────────────────────────────────────── */}
      <div className="flex flex-row items-center gap-2 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
        {/* Search */}
        <div className="relative flex-1 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
          <input
            type="text"
            placeholder="Tedarikçi Ara..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="block w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-sm shadow-sm transition-all"
          />
        </div>
        {/* Add button */}
        <button
          onClick={() => openForm(null)}
          className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-bold bg-white border border-[#7ed957] rounded-lg text-[#7ed957] hover:bg-[#7ed957]/10 shadow-sm active:scale-95 transition-all outline-none whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Tedarikçi Ekle</span>
        </button>
      </div>

      {/* ── List / Cards ────────────────────────────────────────────────── */}
      <div className="relative pb-20 sm:pb-14">
        {/* DESKTOP: Table */}
        <div className="hidden sm:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Column Header */}
          <div className="grid items-center px-4 py-3 border-b border-slate-100 bg-slate-50/80" style={{ gridTemplateColumns: '1.5fr 1fr 1fr 32px' }}>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tedarikçi Unvanı</span>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">Telefon</span>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right pr-4">Bakiye</span>
            <span />
          </div>

          {/* Rows */}
          {loading ? (
            <div className="divide-y divide-slate-100">
              {[...Array(5)].map((_, i) => (
                <SupplierRowSkeleton key={i} />
              ))}
            </div>
          ) : paginated.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
              <Building className="w-10 h-10 opacity-30" />
              <span className="text-sm font-medium">Listelenecek tedarikçi bulunamadı.</span>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {paginated.map(supplier => (
                <div
                  key={supplier.id}
                  onClick={() => { startNavigation(); setTimeout(() => navigate(`/suppliers/${supplier.id}`), 150); }}
                  className="grid items-center px-4 py-[13px] hover:bg-slate-50/80 cursor-pointer transition-colors group"
                  style={{ gridTemplateColumns: '1.5fr 1fr 1fr 32px' }}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-4">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#7ed957]/10 border border-[#7ed957]/20 flex-shrink-0">
                      <Building2 className="w-4.5 h-4.5 text-[#7ed957]" style={{ width: 18, height: 18 }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate group-hover:text-[#5da83f] transition-colors leading-tight">{supplier.name}</p>
                    </div>
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-bold text-slate-600">{supplier.phone || '—'}</span>
                  </div>
                  <div className="flex justify-end pr-2">
                    <CariBalanceBadge balance={supplier.balance} entityType="supplier" size="sm" />
                  </div>
                  <div className="flex justify-end">
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#7ed957] transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* MOBILE: Cards */}
        <div className="sm:hidden space-y-2">
          {loading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3 animate-pulse">
                <div className="w-11 h-11 rounded-xl bg-slate-100 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-100 rounded w-36" />
                  <div className="h-3 bg-slate-100 rounded w-24" />
                </div>
                <div className="h-6 bg-slate-100 rounded-full w-20" />
              </div>
            ))
          ) : paginated.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <Building className="w-10 h-10 opacity-30" />
              <span className="text-sm font-medium">Listelenecek tedarikçi bulunamadı.</span>
            </div>
          ) : (
            paginated.map(supplier => (
              <button
                key={supplier.id}
                onClick={() => { startNavigation(); setTimeout(() => navigate(`/suppliers/${supplier.id}`), 150); }}
                className="w-full bg-white rounded-xl border border-slate-200 hover:border-blue-300/60 hover:shadow-md active:scale-[0.99] transition-all text-left group"
              >
                <div className="flex items-center gap-3 p-3.5">
                  <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                    <Building2 className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-slate-800 group-hover:text-blue-600 transition-colors truncate">{supplier.name}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{supplier.phone || 'Telefon yok'}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <CariBalanceBadge balance={supplier.balance} entityType="supplier" size="sm" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors shrink-0" />
                </div>
              </button>
            ))
          )}
        </div>

        {/* Pagination */}
        {suppliers.length > 0 && (
          <div className="mt-4 mb-6 sm:mb-0 sm:fixed sm:bottom-5 sm:right-6 flex items-center justify-between sm:justify-end gap-3 z-20 print:hidden">
            <span className="text-xs text-gray-400 hidden sm:block">
              {suppliers.length} tedarikçi içinde {startItem}–{endItem} gösteriliyor
            </span>
            <span className="text-xs text-gray-400 sm:hidden font-semibold">
              {suppliers.length} tedarikçi — Sayfa {currentPage}/{totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {renderPaginationButtons()}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <SupplierFormModal 
        isOpen={isFormOpen} 
        onClose={() => setIsFormOpen(false)} 
        supplierToEdit={supplierToEdit}
        onSaved={refetch}
      />

      <PaymentModal 
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        supplier={supplierForPayment}
        onSaved={refetch}
      />
    </div>
  );
};
