import React, { useState, useEffect, useRef } from 'react';
import { Search, Building2, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { supplierService } from '../../services/supplierService';
import toast from '../../components/ui/CustomToast';

// Module-level cache
let _supplierCache = [];
let _supplierCacheLoaded = false;

export const SupplierSearchModal = ({ isOpen, onClose, onSelect }) => {
  const [searchTerm, setSearchTerm]   = useState('');
  const [suppliers, setSuppliers]     = useState([]);
  const [showForm, setShowForm]       = useState(false);
  const [formData, setFormData]       = useState({ name: '', phone: '' });
  const [saving, setSaving]           = useState(false);
  const [page, setPage]               = useState(1);
  const ITEMS_PER_PAGE = 10;

  // In-memory cache — loaded once per open, filtered synchronously (no loading flash)
  const allRef = useRef([]);

  useEffect(() => {
    if (!isOpen) return;
    setSearchTerm('');
    setShowForm(false);
    setFormData({ name: '', phone: '' });

    if (_supplierCacheLoaded) {
      allRef.current = _supplierCache;
      setSuppliers(_supplierCache.slice(0, 10));
      return;
    }

    supplierService.getAll().then(all => {
      _supplierCache = all;
      _supplierCacheLoaded = true;
      allRef.current = all;
      setSuppliers(all.slice(0, 10));
    });
  }, [isOpen]);

  // Synchronous in-memory filter
  useEffect(() => {
    if (!isOpen) return;
    setPage(1);
    const q = searchTerm.trim().toLowerCase();
    if (!q) {
      setSuppliers(allRef.current);
    } else {
      setSuppliers(
        allRef.current
          .filter(s =>
            (s.name  && s.name.toLowerCase().includes(q)) ||
            (s.phone && s.phone.includes(searchTerm.trim()))
          )
      );
    }
  }, [searchTerm, isOpen]);

  const totalPages = Math.ceil(suppliers.length / ITEMS_PER_PAGE);
  const paginatedSuppliers = suppliers.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const handleSaveNewSupplier = async () => {
    if (!formData.name.trim()) { toast.error('Tedarikçi adı zorunlu.'); return; }
    setSaving(true);
    try {
      const newSupplier = await supplierService.create({
        name: formData.name.trim(),
        phone: formData.phone.trim() || null,
        balance: 0,
        is_active: true
      });
      if (_supplierCacheLoaded) {
          _supplierCache = [..._supplierCache, newSupplier].sort((a,b) => a.name.localeCompare(b.name));
          allRef.current = _supplierCache;
          setSuppliers(_supplierCache.slice(0, 10));
      }
      toast.success('Tedarikçi eklendi!');
      onSelect(newSupplier);
      onClose();
    } catch (e) {
      console.error('[SupplierSearchModal] Yeni Tedarikçi Ekleme Hatası:', e);
      toast.error('Tedarikçi eklenemedi: ' + (e?.message || 'Bilinmeyen hata'));
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
            <Building2 className="w-4 h-4 text-emerald-600" />
          </div>
          <span>Tedarikçi Bul / Ekle</span>
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
              <p className="text-sm font-bold text-brand-800">Yeni Tedarikçi</p>
              <button onClick={() => setShowForm(false)} className="text-brand-400 hover:text-brand-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Firma Adı *</label>
              <input
                autoFocus
                type="text"
                value={formData.name}
                onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleSaveNewSupplier()}
                className={inputCls}
                placeholder="Tedarikçi firma adı..."
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Telefon (opsiyonel)</label>
              <input
                type="text"
                value={formData.phone}
                onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleSaveNewSupplier()}
                className={inputCls}
                placeholder="05xx..."
              />
            </div>

            <Button onClick={handleSaveNewSupplier} isLoading={saving} className="w-full">
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
              <Button variant="outline" icon={Building2} onClick={() => setShowForm(true)} title="Yeni Tedarikçi Ekle">
                Yeni
              </Button>
            </div>

            {/* ── Supplier list ──────────────────────────────────────── */}
            <div className="border border-slate-200 bg-white rounded-lg overflow-y-auto flex-1 custom-scrollbar">
              {paginatedSuppliers.length > 0 ? (
                <ul className="divide-y divide-slate-200 flex flex-col h-full">
                  {paginatedSuppliers.map(s => (
                    <li
                      key={s.id}
                      className="h-[10%] px-3 hover:bg-slate-50 cursor-pointer flex justify-between items-center transition-colors group"
                      onClick={() => { onSelect(s); onClose(); }}
                    >
                      {/* Left: Icon + Name */}
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20">
                          <Building2 className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div className="text-sm font-semibold text-slate-800 group-hover:text-emerald-600 transition-colors">
                          {s.name}
                        </div>
                      </div>

                      {/* Center: Phone */}
                      <div className="flex-1 text-center">
                        <div className="text-xs text-slate-500">{s.phone || '-'}</div>
                      </div>

                      {/* Right: Balance */}
                      <div className="flex-1 flex justify-end">
                        {s.balance > 0 ? (
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold tracking-tight ${balanceClass(s.balance)}`}>
                            Borçlu: {fmt(s.balance)}
                          </span>
                        ) : s.balance < 0 ? (
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold tracking-tight ${balanceClass(s.balance)}`}>
                            Alacaklı: {fmt(Math.abs(s.balance))}
                          </span>
                        ) : (
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold tracking-tight ${balanceClass(0)}`}>
                            Bakiye: ₺0
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-8 text-center flex flex-col items-center justify-center">
                  <p className="text-slate-500 text-sm mb-3">Tedarikçi bulunamadı.</p>
                  <Button size="sm" variant="outline" icon={Building2} onClick={() => setShowForm(true)}>
                    Yeni Tedarikçi Ekle
                  </Button>
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            {suppliers.length > 0 && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-200 shrink-0">
                <span className="text-xs text-slate-500 font-medium">
                  {suppliers.length} tedarikçi — Sayfa {page}/{totalPages}
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
