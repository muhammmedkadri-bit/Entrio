import React, { useState, useEffect } from 'react';
import { Users, User, Plus, Search, ChevronRight, ChevronLeft, UserX } from 'lucide-react';
import toast from '../../components/ui/CustomToast';
import { CariBalanceBadge } from './components/CariBalanceBadge';
import { CustomerFormModal } from './modals/CustomerFormModal';
import { CollectionModal } from './modals/CollectionModal';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';
import { useCustomers } from '../../hooks/useCustomers';

const CustomerRowSkeleton = () => (
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

export const CustomersPage = () => {
  const navigate = useNavigate();
  const { startNavigation } = useAppStore();

  // ── Realtime-aware data ────────────────────────────────────────────────
  // useCustomers subscribes to the 'customers' cache key.
  // When Supabase Realtime fires a change, the cache is invalidated
  // and the hook re-fetches automatically — no manual polling needed.
  const { customers: allCustomers, loading, summary, refetch } = useCustomers();

  const [currentPage, setCurrentPage] = useState(1);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [balanceFilter, setBalanceFilter] = useState('');

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState(null);

  const [isCollectionOpen, setIsCollectionOpen] = useState(false);
  const [customerForCollection, setCustomerForCollection] = useState(null);

  const customers = React.useMemo(() => {
    let res = [...allCustomers];
    
    if (search) {
      const q = search.toLowerCase();
      res = res.filter(c => 
        (c.name && c.name.toLowerCase().includes(q)) || 
        (c.phone && c.phone.includes(q)) || 
        (c.email && c.email.toLowerCase().includes(q))
      );
    }
    
    if (typeFilter && typeFilter !== 'all') {
      res = res.filter(c => c.customer_type === typeFilter);
    }
    
    if (balanceFilter) {
      res = res.filter(c => {
        if (balanceFilter === 'receivable') return c.balance > 0;
        if (balanceFilter === 'debt') return c.balance < 0;
        if (balanceFilter === 'zero') return c.balance === 0;
        return true;
      });
    }
    
    return res;
  }, [allCustomers, search, typeFilter, balanceFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, typeFilter, balanceFilter]);

  const openForm = (c = null) => {
    setCustomerToEdit(c);
    setIsFormOpen(true);
  };

  const totalPages = Math.max(1, Math.ceil(customers.length / ITEMS_PER_PAGE));
  const paginated = customers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, customers.length);

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
            <Users className="w-6 h-6 text-[#7ed957]" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Müşteriler</h1>
            <p className="text-sm text-slate-500">Müşteri hesap özetleri, alacak takibi ve tahsilat işlemleri.</p>
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
            placeholder="Müşteri Ara..."
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
          <span className="hidden sm:inline">Müşteri Ekle</span>
        </button>
      </div>

      {/* ── List / Cards ────────────────────────────────────────────────── */}
      <div className="relative pb-20 sm:pb-14">
        {/* DESKTOP: Table */}
        <div className="hidden sm:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Column Header */}
          <div className="grid items-center px-4 py-3 border-b border-slate-100 bg-slate-50/80" style={{ gridTemplateColumns: '1.5fr 1fr 1fr 32px' }}>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Müşteri</span>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">Telefon</span>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right pr-4">Bakiye</span>
            <span />
          </div>

          {/* Rows */}
          {loading ? (
            <div className="divide-y divide-slate-100">
              {[...Array(5)].map((_, i) => (
                <CustomerRowSkeleton key={i} />
              ))}
            </div>
          ) : paginated.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
              <UserX className="w-10 h-10 opacity-30" />
              <span className="text-sm font-medium">Listelenecek müşteri bulunamadı.</span>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {paginated.map(customer => (
                <div
                  key={customer.id}
                  onClick={() => { startNavigation(); setTimeout(() => navigate(`/customers/${customer.id}`), 150); }}
                  className="grid items-center px-4 py-[13px] hover:bg-slate-50/80 cursor-pointer transition-colors group"
                  style={{ gridTemplateColumns: '1.5fr 1fr 1fr 32px' }}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-4">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#7ed957]/10 border border-[#7ed957]/20 flex-shrink-0">
                      <User className="w-4.5 h-4.5 text-[#7ed957]" style={{ width: 18, height: 18 }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate group-hover:text-[#5da83f] transition-colors leading-tight">{customer.name}</p>
                    </div>
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-bold text-slate-600">{customer.phone || '—'}</span>
                  </div>
                  <div className="flex justify-end pr-2">
                    <CariBalanceBadge balance={customer.balance} entityType="customer" size="sm" />
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
              <UserX className="w-10 h-10 opacity-30" />
              <span className="text-sm font-medium">Listelenecek müşteri bulunamadı.</span>
            </div>
          ) : (
            paginated.map(customer => (
              <button
                key={customer.id}
                onClick={() => { startNavigation(); setTimeout(() => navigate(`/customers/${customer.id}`), 150); }}
                className="w-full bg-white rounded-xl border border-slate-200 hover:border-[#7ed957]/50 hover:shadow-md active:scale-[0.99] transition-all text-left group"
              >
                <div className="flex items-center gap-3 p-3.5">
                  <div className="w-11 h-11 rounded-xl bg-[#7ed957]/10 border border-[#7ed957]/20 flex items-center justify-center shrink-0 group-hover:bg-[#7ed957]/20 transition-colors">
                    <User className="w-5 h-5 text-[#5da83f]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-slate-800 group-hover:text-[#5da83f] transition-colors truncate">{customer.name}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{customer.phone || 'Telefon yok'}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <CariBalanceBadge balance={customer.balance} entityType="customer" size="sm" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#7ed957] transition-colors shrink-0" />
                </div>
              </button>
            ))
          )}
        </div>

        {/* Pagination */}
        {customers.length > 0 && (
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-gray-400 hidden sm:block">
              {customers.length} müşteri içinde {startItem}–{endItem} gösteriliyor
            </span>
            <span className="text-xs text-gray-400 sm:hidden font-semibold">
              {customers.length} müşteri — Sayfa {currentPage}/{totalPages}
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

      <CustomerFormModal 
        isOpen={isFormOpen} 
        onClose={() => setIsFormOpen(false)} 
        customerToEdit={customerToEdit}
        onSaved={refetch}
      />

      <CollectionModal 
        isOpen={isCollectionOpen}
        onClose={() => setIsCollectionOpen(false)}
        customer={customerForCollection}
        onSaved={refetch}
      />
    </div>
  );
};

