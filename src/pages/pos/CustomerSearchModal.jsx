import React, { useState, useEffect, useRef } from 'react';
import { Search, UserPlus, X, ChevronLeft, ChevronRight, User } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { customerService } from '../../services/customerService';
import toast from '../../components/ui/CustomToast';

// Module-level cache — survives re-opens, zero DB round-trips after first load
let _customerCache = [];
let _customerCacheLoaded = false;

export const CustomerSearchModal = ({ isOpen, onClose, onSelect }) => {
  const [searchTerm, setSearchTerm]   = useState('');
  const [customers, setCustomers]     = useState([]);
  const [showForm, setShowForm]       = useState(false);
  const [formData, setFormData]       = useState({ name: '', phone: '' });
  const [saving, setSaving]           = useState(false);
  const [page, setPage]               = useState(1);
  const [isLoading, setIsLoading]     = useState(false);
  const ITEMS_PER_PAGE = 10;

  // In-memory cache — loaded once per open, filtered synchronously
  const allRef = useRef([]);

  // Load all customers once when modal opens (no loading-state flash)
  useEffect(() => {
    if (!isOpen) return;
    setSearchTerm('');
    setShowForm(false);
    setFormData({ name: '', phone: '' });

    // If already cached, show instantly and DO NOT refresh in background unless explicitly told
    if (_customerCacheLoaded) {
      allRef.current = _customerCache;
      setCustomers(_customerCache.slice(0, 10));
      return;
    }

    setIsLoading(true);
    customerService.getAll().then(all => {
      _customerCache = all;
      _customerCacheLoaded = true;
      _customerCacheLoaded = true;
      allRef.current = all;
      setCustomers(all.slice(0, 10));
    }).finally(() => setIsLoading(false));
  }, [isOpen]);

  // Synchronous in-memory filter — zero DB round-trips, no flicker
  useEffect(() => {
    if (!isOpen) return;
    setPage(1); // Reset page on new search
    const q = searchTerm.trim().toLowerCase();
    if (!q) {
      setCustomers(allRef.current);
    } else {
      setCustomers(
        allRef.current
          .filter(c =>
            (c.name  && c.name.toLowerCase().includes(q)) ||
            (c.phone && c.phone.includes(searchTerm.trim()))
          )
      );
    }
  }, [searchTerm, isOpen]);

  const totalPages = Math.ceil(customers.length / ITEMS_PER_PAGE);
  const paginatedCustomers = customers.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const handleSaveNewCustomer = async () => {
    if (!formData.name.trim()) { toast.error('Müşteri adı zorunlu.'); return; }
    setSaving(true);
    try {
      const newCustomer = await customerService.create({
        name: formData.name.trim(),
        phone: formData.phone.trim() || null,
        customer_type: 'wholesale',
        balance: 0,
        is_active: true
      });
      // Yeni müşteriyi cache'e dahil et
      if (_customerCacheLoaded) {
          _customerCache = [..._customerCache, newCustomer].sort((a,b) => a.name.localeCompare(b.name));
          allRef.current = _customerCache;
          setCustomers(_customerCache.slice(0, 10));
      }
      toast.success('Müşteri eklendi!');
      onSelect(newCustomer);
      onClose();
    } catch (e) {
      console.error('[CustomerSearchModal] Yeni Müşteri Ekleme Hatası:', e);
      toast.error('Müşteri eklenemedi: ' + (e?.message || 'Bilinmeyen hata'));
    } finally {
      setSaving(false);
    }
  };

  const balanceClass = (b) => {
    if (b > 0) return 'text-red-600 bg-red-50';
    if (b < 0) return 'text-green-600 bg-green-50';
    return 'text-slate-500 bg-slate-100';
  };

  const fmt = (v) =>
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Math.abs(v || 0));

  // ── shared input class (matches app theme) ────────────────────────────────
  const inputCls =
    'block w-full border border-slate-300 rounded-lg bg-white placeholder-slate-400 ' +
    'focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ' +
    'text-sm shadow-sm transition-all px-3 py-2.5';

  const renderPaginationButtons = () => {
    let pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2));
    let endPage = startPage + maxVisiblePages - 1;

    if (endPage > totalPages) {
      endPage = totalPages;
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        pages.push(
          <button
            key={i}
            onClick={() => setPage(i)}
            className={`w-7 h-7 text-xs rounded-lg flex items-center justify-center transition-all cursor-pointer ${
              page === i 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold shadow-sm' 
                : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {i}
          </button>
        );
    }
    return pages;
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <User className="w-4 h-4 text-emerald-600" />
          </div>
          <span>Müşteri Bul / Ekle</span>
        </div>
      } 
      size="xl2" 
      heightClass="h-[85vh]" 
      bodyClassName="p-0 flex flex-col"
    >
      <div className="flex flex-col h-full p-3 space-y-2 bg-slate-50/50">

        {/* ── Quick-add form ───────────────────────────────────────────── */}
        {showForm ? (
          <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-bold text-brand-800">Yeni Müşteri</p>
              <button onClick={() => setShowForm(false)} className="text-brand-400 hover:text-brand-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Ad Soyad *</label>
              <input
                autoFocus
                type="text"
                value={formData.name}
                onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleSaveNewCustomer()}
                className={inputCls}
                placeholder="Müşteri adı..."
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Telefon (opsiyonel)</label>
              <input
                type="text"
                value={formData.phone}
                onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleSaveNewCustomer()}
                className={inputCls}
                placeholder="05xx..."
              />
            </div>

            <Button onClick={handleSaveNewCustomer} isLoading={saving} className="w-full">
              Kaydet ve Seç
            </Button>
          </div>

        ) : (
          <div className="flex flex-col h-full space-y-2 overflow-hidden">
            {/* ── Search row ─────────────────────────────────────────── */}
            <div className="flex gap-2 shrink-0">
              <div className="relative flex-1 group">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors pointer-events-none" />
                <input
                  type="text"
                  autoFocus
                  placeholder="İsim veya telefon ile ara..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className={`${inputCls} pl-10`}
                />
              </div>
              <Button variant="outline" icon={UserPlus} onClick={() => setShowForm(true)} title="Yeni Müşteri Ekle">
                Yeni
              </Button>
            </div>

            {/* ── Customer list ──────────────────────────────────────── */}
            <div className="border border-slate-200 bg-white rounded-lg overflow-y-auto flex-1 custom-scrollbar">
              {isLoading ? (
                <div className="flex items-center justify-center h-full py-12">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs text-slate-400 font-medium">Müşteriler yükleniyor...</p>
                  </div>
                </div>
              ) : paginatedCustomers.length > 0 ? (
                <ul className="divide-y divide-slate-200 flex flex-col h-full">
                  {paginatedCustomers.map(c => (
                    <li
                      key={c.id}
                      className="p-3 border-b last:border-0 border-slate-100 hover:bg-slate-50 cursor-pointer flex flex-col sm:flex-row justify-between sm:items-center transition-colors group gap-2 sm:gap-0"
                      onClick={() => { onSelect(c); onClose(); }}
                    >
                      <div className="flex items-center justify-between sm:justify-start gap-3 sm:flex-1">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20">
                            <User className="w-4 h-4 text-emerald-600" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-slate-800 group-hover:text-emerald-600 transition-colors">{c.name}</span>
                            <span className="text-[11px] text-slate-500 sm:hidden">{c.phone || '-'}</span>
                          </div>
                        </div>
                        {/* Mobile Balance */}
                        <div className="sm:hidden">
                          {c.balance > 0 ? (
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold tracking-tight ${balanceClass(c.balance)}`}>Borç: {fmt(c.balance)}</span>
                          ) : c.balance < 0 ? (
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold tracking-tight ${balanceClass(c.balance)}`}>Alacak: {fmt(Math.abs(c.balance))}</span>
                          ) : (
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold tracking-tight ${balanceClass(0)}`}>Bakiye: ₺0</span>
                          )}
                        </div>
                      </div>

                      {/* Center: Phone (Desktop) */}
                      <div className="hidden sm:block flex-1 text-center">
                        <div className="text-xs text-slate-500">{c.phone || '-'}</div>
                      </div>

                      {/* Right: Balance (Desktop) */}
                      <div className="hidden sm:flex flex-1 justify-end">
                        {c.balance > 0 ? (
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold tracking-tight ${balanceClass(c.balance)}`}>Borçlu: {fmt(c.balance)}</span>
                        ) : c.balance < 0 ? (
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold tracking-tight ${balanceClass(c.balance)}`}>Alacaklı: {fmt(Math.abs(c.balance))}</span>
                        ) : (
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold tracking-tight ${balanceClass(0)}`}>Bakiye: ₺0</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-6 text-center">
                  <p className="text-slate-500 text-sm mb-3">Müşteri bulunamadı.</p>
                  <Button size="sm" variant="outline" icon={UserPlus} onClick={() => setShowForm(true)}>
                    Yeni Müşteri Ekle
                  </Button>
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            {customers.length > 0 && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-200 shrink-0">
                <span className="text-xs text-slate-500 font-medium">
                  {customers.length} müşteri — Sayfa {page}/{totalPages}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {renderPaginationButtons()}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
