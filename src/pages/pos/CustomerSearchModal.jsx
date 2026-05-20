import React, { useState, useEffect, useRef } from 'react';
import { Search, UserPlus, X, ChevronLeft, ChevronRight, User, Users } from 'lucide-react';
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
  const allRef = useRef([]);

  useEffect(() => {
    if (!isOpen) return;
    setSearchTerm('');
    setShowForm(false);
    setFormData({ name: '', phone: '' });
    if (_customerCacheLoaded) {
      allRef.current = _customerCache;
      setCustomers(_customerCache);
      return;
    }
    setIsLoading(true);
    customerService.getAll().then(all => {
      _customerCache = all;
      _customerCacheLoaded = true;
      allRef.current = all;
      setCustomers(all);
    }).finally(() => setIsLoading(false));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setPage(1);
    const q = searchTerm.trim().toLowerCase();
    setCustomers(!q ? allRef.current : allRef.current.filter(c =>
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(searchTerm.trim()))
    ));
  }, [searchTerm, isOpen]);

  const totalPages = Math.max(1, Math.ceil(customers.length / ITEMS_PER_PAGE));
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
      if (_customerCacheLoaded) {
        _customerCache = [..._customerCache, newCustomer].sort((a, b) => a.name.localeCompare(b.name));
        allRef.current = _customerCache;
        setCustomers(_customerCache);
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

  const balanceBadge = (b) => {
    if (b > 0) return { label: `Borç: ${fmt(b)}`, cls: 'bg-red-50 text-red-700 border-red-200' };
    if (b < 0) return { label: `Alacak: ${fmt(Math.abs(b))}`, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    return { label: 'Bakiye: ₺0', cls: 'bg-slate-100 text-slate-500 border-slate-200' };
  };

  const fmt = (v) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Math.abs(v || 0));

  const renderPageBtns = () => {
    const max = 5;
    let start = Math.max(1, page - Math.floor(max / 2));
    let end = Math.min(totalPages, start + max - 1);
    if (end - start < max - 1) start = Math.max(1, end - max + 1);
    return Array.from({ length: end - start + 1 }, (_, idx) => {
      const i = start + idx;
      return (
        <button key={i} onClick={() => setPage(i)}
          className={`w-8 h-8 text-xs rounded-lg flex items-center justify-center font-bold transition-all ${
            page === i ? 'bg-brand-500 text-white shadow-sm shadow-brand-500/30' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
          }`}>
          {i}
        </button>
      );
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <style>{`@keyframes slideUpC { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }`}</style>
      <div
        className="w-full sm:w-[820px] sm:max-w-[95vw] sm:rounded-2xl rounded-t-3xl bg-white flex flex-col shadow-2xl overflow-hidden"
        style={{ maxHeight: 'calc(100vh - 60px)', height: 'calc(100vh - 60px)', animation: 'slideUpC 0.25s cubic-bezier(0.16,1,0.3,1) forwards' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center border border-brand-100">
              <Users className="w-5 h-5 text-brand-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">Müşteri Seç</h2>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Arayın veya yeni müşteri ekleyin</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                style={{ background: 'rgba(126,217,87,0.1)', border: '1px solid rgba(126,217,87,0.25)', color: 'rgb(58,128,36)' }}
              >
                <UserPlus className="w-4 h-4" /> Yeni
              </button>
            )}
            <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col flex-1 overflow-hidden bg-slate-50">
          {showForm ? (
            /* ── Quick-add form ── */
            <div className="flex-1 overflow-y-auto p-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-brand-50 border border-brand-100 flex items-center justify-center">
                      <UserPlus className="w-4 h-4 text-brand-500" />
                    </div>
                    <p className="text-sm font-bold text-slate-800">Yeni Müşteri</p>
                  </div>
                  <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-400 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1.5">Ad Soyad <span className="text-red-500">*</span></label>
                  <input autoFocus type="text" value={formData.name}
                    onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleSaveNewCustomer()}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400 transition-all"
                    placeholder="Müşteri adı..." />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1.5">Telefon <span className="text-slate-400">(opsiyonel)</span></label>
                  <input type="text" value={formData.phone}
                    onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleSaveNewCustomer()}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400 transition-all"
                    placeholder="05xx..." />
                </div>
                <button
                  onClick={handleSaveNewCustomer}
                  disabled={saving}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white bg-brand-500 hover:bg-brand-600 shadow-sm shadow-brand-500/30 active:scale-[0.98] transition-all disabled:opacity-60"
                >
                  {saving ? 'Kaydediliyor...' : 'Kaydet ve Seç'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col flex-1 overflow-hidden p-3 gap-3">
              {/* Search */}
              <div className="relative shrink-0">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input type="text" autoFocus placeholder="İsim veya telefon ile ara..."
                  value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400 shadow-sm transition-all" />
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto space-y-2 pb-1">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center h-40 gap-3">
                    <div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs text-slate-400 font-medium">Müşteriler yükleniyor...</p>
                  </div>
                ) : paginatedCustomers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 gap-3">
                    <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center">
                      <User className="w-6 h-6 text-slate-300" />
                    </div>
                    <p className="text-slate-500 font-semibold text-sm">
                      {searchTerm ? `"${searchTerm}" ile eşleşen müşteri yok` : 'Henüz müşteri eklenmemiş'}
                    </p>
                    <button onClick={() => setShowForm(true)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                      style={{ background: 'rgba(126,217,87,0.1)', border: '1px solid rgba(126,217,87,0.25)', color: 'rgb(58,128,36)' }}>
                      <UserPlus className="w-3.5 h-3.5" /> Yeni Müşteri Ekle
                    </button>
                  </div>
                ) : (
                  paginatedCustomers.map(c => {
                    const badge = balanceBadge(c.balance);
                    return (
                      <button key={c.id} onClick={() => { onSelect(c); onClose(); }}
                        className="w-full bg-white rounded-xl border border-slate-200 hover:border-brand-300 hover:shadow-md active:scale-[0.99] transition-all text-left group">
                        <div className="flex items-center gap-3 p-3.5">
                          <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center shrink-0 group-hover:bg-brand-100 transition-colors">
                            <User className="w-5 h-5 text-brand-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm text-slate-800 group-hover:text-brand-600 transition-colors truncate">{c.name}</div>
                            <div className="text-xs text-slate-400 mt-0.5">{c.phone || 'Telefon yok'}</div>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${badge.cls}`}>{badge.label}</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Pagination */}
              {customers.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between pt-3 pb-14 sm:pb-2 border-t border-slate-200 shrink-0">
                  <span className="text-xs text-slate-500 font-semibold">{customers.length} müşteri — Sayfa {page}/{totalPages}</span>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {renderPageBtns()}
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
