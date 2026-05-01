import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';
import { Building2, TrendingDown, TrendingUp, Scale, Plus, HandCoins, Edit, Trash2, Search, ChevronLeft, ChevronRight, Building } from 'lucide-react';
import toast from 'react-hot-toast';
import { StatCard } from '../../components/ui/StatCard';
import { DataTable } from '../../components/ui/DataTable';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { CariBalanceBadge } from './components/CariBalanceBadge';
import { supplierService } from '../../services/supplierService';
import { SupplierFormModal } from './modals/SupplierFormModal';
import { PaymentModal } from './modals/PaymentModal';

const ITEMS_PER_PAGE = 10;

export const SuppliersPage = () => {
  const navigate = useNavigate();
  const { startNavigation } = useAppStore();

  const [allSuppliers, setAllSuppliers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  // Filters
  const [search, setSearch] = useState('');
  const [balanceFilter, setBalanceFilter] = useState('');

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [supplierToEdit, setSupplierToEdit] = useState(null);

  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [supplierForPayment, setSupplierForPayment] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await supplierService.getAll({});
      setAllSuppliers(data);
      
      const sum = await supplierService.getSummary();
      setSummary(sum);
    } catch(err) {
      console.error('[SuppliersPage] Yükleme Hatası:', err);
      toast.error(err?.message || 'Tedarikçiler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

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
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-600 font-semibold'
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
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-50 border border-emerald-100 flex-shrink-0">
            <Building2 className="w-6 h-6 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Tedarikçiler</h1>
            <p className="text-sm text-slate-500">Tedarikçi hesap özetleri, borç takibi ve ödeme işlemleri.</p>
          </div>
        </div>
      </div>

      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
        
        {/* Left Side: Search */}
        <div className="flex flex-col sm:flex-row items-center justify-start gap-3 w-full lg:w-auto">
          <div className="relative w-full sm:w-96 group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Tedarikçi Ara..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              className="block w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-500 focus:outline-none focus:placeholder-slate-400 focus:ring-1 focus:ring-brand-500 focus:border-brand-500 sm:text-sm shadow-sm transition-all"
            />
          </div>
        </div>

        {/* Right Side: Action Buttons */}
        <div className="flex items-center gap-2 flex-shrink-0 h-[46px] ml-auto">
          <button
            onClick={() => openForm(null)}
            className="flex items-center gap-2 px-4 py-3 h-full text-sm font-bold bg-[#10b981] hover:bg-[#059669] text-white rounded-lg shadow-sm transition-all whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Tedarikçi Ekle
          </button>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div className="relative pb-14">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Column Header */}
          <div className="grid items-center px-4 py-3 border-b border-slate-100 bg-slate-50/80" style={{ gridTemplateColumns: '1.5fr 1fr 1fr 32px' }}>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tedarikçi Unvanı</span>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">Telefon</span>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right pr-4">Bakiye</span>
            <span />
          </div>

          {/* Rows */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
              <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Yükleniyor...</span>
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
                  {/* Left: Icon + Name */}
                  <div className="flex items-center gap-3 min-w-0 pr-4">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-emerald-50 border border-emerald-100 flex-shrink-0">
                      <Building2 className="w-4.5 h-4.5 text-emerald-500" style={{ width: 18, height: 18 }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate group-hover:text-emerald-600 transition-colors leading-tight">
                        {supplier.name}
                      </p>
                    </div>
                  </div>

                  {/* Telefon */}
                  <div className="text-center">
                    <span className="text-sm font-bold text-slate-600">{supplier.phone || '—'}</span>
                  </div>

                  {/* Bakiye */}
                  <div className="flex justify-end pr-2">
                    <CariBalanceBadge balance={supplier.balance} entityType="supplier" size="sm" />
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
        {suppliers.length > 0 && (
          <div className="fixed bottom-5 right-6 flex items-center gap-3 z-20">
            <span className="text-xs text-gray-400">
              {suppliers.length} tedarikçi içinde {startItem}–{endItem} gösteriliyor
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/20 backdrop-blur-md border border-white/40 shadow-[0_4px_16px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.7)] text-gray-500 hover:bg-white/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {renderPaginationButtons()}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/20 backdrop-blur-md border border-white/40 shadow-[0_4px_16px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.7)] text-gray-500 hover:bg-white/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
        onSaved={fetchData}
      />

      <PaymentModal 
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        supplier={supplierForPayment}
        onSaved={fetchData}
      />
    </div>
  );
};
