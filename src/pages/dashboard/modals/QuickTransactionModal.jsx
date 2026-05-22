import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  TrendingUp, TrendingDown, X, Check, ChevronDown,
  Calendar, Banknote, FileText, Wallet, Building2,
  CreditCard, Loader2
} from 'lucide-react';
import toast from '../../../components/ui/CustomToast';
import { cashService } from '../../../services/cashService';

/* ─── Kasa ikonu ─────────────────────────────────────────── */
const RegisterIcon = ({ type }) => {
  const cls = 'w-4 h-4 flex-shrink-0';
  if (type === 'pos' || type === 'credit_card') return <CreditCard className={cls} />;
  if (type === 'bank') return <Building2 className={cls} />;
  return <Wallet className={cls} />;
};

/* ─── Kasa renk sınıfı ───────────────────────────────────── */
const registerColorClass = (type) => {
  if (type === 'pos' || type === 'credit_card') return 'bg-blue-100 text-blue-600';
  if (type === 'bank') return 'bg-indigo-100 text-indigo-600';
  return 'bg-emerald-100 text-emerald-700';
};

const fmt = (v) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(v || 0);

/* ─── Ana Bileşen ─────────────────────────────────────────── */
export const QuickTransactionModal = ({ isOpen, onClose, allRegisters = [], onSaved }) => {
  const [mode, setMode] = useState('income'); // 'income' | 'expense'
  const [amount, setAmount] = useState('');
  const [registerId, setRegisterId] = useState('');
  const [description, setDescription] = useState('');
  const [txDate, setTxDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [txTime, setTxTime] = useState(format(new Date(), 'HH:mm'));
  const [loading, setLoading] = useState(false);
  const [showRegisterDropdown, setShowRegisterDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const amountRef = useRef(null);

  // Swipe-to-close state
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [dragY, setDragY] = useState(0);

  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientY);
  };

  const onTouchMove = (e) => {
    const currentY = e.targetTouches[0].clientY;
    setTouchEnd(currentY);
    if (touchStart && currentY > touchStart) {
      setDragY(currentY - touchStart);
    }
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) {
      setDragY(0);
      return;
    }
    const distance = touchEnd - touchStart;
    if (distance > minSwipeDistance) {
      onClose();
    }
    setDragY(0);
    setTouchStart(null);
    setTouchEnd(null);
  };

  // Aktif kasalar (kredi kartı hariç gelir, tümü gider için)
  const activeRegisters = allRegisters.filter(r =>
    r.is_active !== false && r.type !== 'credit_card'
  );

  // Modal açıldığında default kasa seç ve formu sıfırla
  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setDescription('');
      setTxDate(format(new Date(), 'yyyy-MM-dd'));
      setTxTime(format(new Date(), 'HH:mm'));
      setLoading(false);
      setShowRegisterDropdown(false);
      // Varsayılan nakit kasayı bul
      const defaultCash = activeRegisters.find(r => r.is_default_for === 'cash' && r.type === 'cash')
        || activeRegisters.find(r => r.type === 'cash')
        || activeRegisters[0];
      setRegisterId(defaultCash?.id || '');
      setTimeout(() => amountRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Dropdown dışına tıklandığında kapat
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowRegisterDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, []);

  // Scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const mainEl = document.querySelector('main');
      if (mainEl) mainEl.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      const mainEl = document.querySelector('main');
      if (mainEl) mainEl.style.overflow = '';
    }
    return () => { 
      document.body.style.overflow = '';
      const mainEl = document.querySelector('main');
      if (mainEl) mainEl.style.overflow = ''; 
    };
  }, [isOpen]);

  const selectedRegister = activeRegisters.find(r => String(r.id) === String(registerId));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount.replace(',', '.'));
    if (!parsedAmount || parsedAmount <= 0) {
      toast.error('Geçerli bir tutar giriniz.');
      return;
    }
    if (!registerId) {
      toast.error('Lütfen bir kasa seçiniz.');
      return;
    }

    // Seçilen tarih + saati timestamp'e çevir
    const dateTimeStr = `${txDate}T${txTime}:00`;
    const transactionTs = new Date(dateTimeStr).getTime();

    setLoading(true);
    try {
      const txType = mode === 'income' ? 'deposit_in' : 'expense_out';
      const label = mode === 'income' ? 'Hızlı Gelir' : 'Hızlı Gider';
      const notes = description.trim() || label;

      await cashService.addTransaction(registerId, txType, parsedAmount, notes, transactionTs);

      toast.success(
        mode === 'income'
          ? `${fmt(parsedAmount)} gelir başarıyla eklendi.`
          : `${fmt(parsedAmount)} gider başarıyla eklendi.`
      );
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(err.message || 'İşlem kaydedilemedi.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isIncome = mode === 'income';

  /* Renk paleti modele göre */
  const palette = isIncome
    ? {
        gradFrom: 'from-emerald-500',
        gradTo: 'to-green-600',
        activeBg: 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30',
        inactiveBg: 'bg-white/20 text-white/70',
        ring: 'focus:ring-emerald-400',
        border: 'border-emerald-400',
        btn: 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30',
        icon: TrendingUp,
        label: 'Hızlı Gelir',
        placeholder: 'Gelir açıklaması (opsiyonel)',
      }
    : {
        gradFrom: 'from-rose-500',
        gradTo: 'to-rose-600',
        activeBg: 'bg-rose-500 text-white shadow-lg shadow-rose-500/30',
        inactiveBg: 'bg-white/20 text-white/70',
        ring: 'focus:ring-rose-400',
        border: 'border-rose-400',
        btn: 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/30',
        icon: TrendingDown,
        label: 'Hızlı Gider',
        placeholder: 'Gider açıklaması (opsiyonel)',
      };

  const ModeIcon = palette.icon;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
        style={{ touchAction: 'none' }}
      />

      {/* Bottom Sheet */}
      <div 
        className="relative w-full bg-white rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[92vh] flex flex-col overflow-hidden"
        style={{ transform: `translateY(${dragY > 0 ? dragY : 0}px)` }}
      >

        {/* ── Header Gradient ── */}
        <div 
          className={`bg-gradient-to-r ${palette.gradFrom} ${palette.gradTo} px-5 pt-5 pb-6 flex-shrink-0 touch-none`}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Drag handle */}
          <div className="flex justify-center mb-4 cursor-grab active:cursor-grabbing">
            <div className="w-10 h-1 bg-white/40 rounded-full" />
          </div>

          {/* Title row */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                <ModeIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-white font-bold text-lg leading-none">{palette.label}</h2>
                <p className="text-white/70 text-xs mt-0.5">Hızlı işlem kaydı</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center active:scale-90 transition-transform"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Mode Toggle */}
          <div className="flex gap-2 bg-white/15 rounded-2xl p-1">
            <button
              type="button"
              onClick={() => setMode('income')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                isIncome ? 'bg-white text-emerald-600 shadow-md' : 'text-white/80 hover:bg-white/10'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Gelir
            </button>
            <button
              type="button"
              onClick={() => setMode('expense')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                !isIncome ? 'bg-white text-rose-600 shadow-md' : 'text-white/80 hover:bg-white/10'
              }`}
            >
              <TrendingDown className="w-4 h-4" />
              Gider
            </button>
          </div>
        </div>

        {/* ── Form Body ── */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 pt-5 pb-6 space-y-4">

          {/* Tutar */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Tutar
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">₺</span>
              <input
                ref={amountRef}
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                placeholder="0,00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className={`w-full pl-9 pr-4 py-4 text-2xl font-black text-slate-800 bg-slate-50 border-2 rounded-2xl outline-none transition-all focus:bg-white focus:ring-4 focus:ring-offset-0 ${
                  isIncome
                    ? 'border-slate-200 focus:border-emerald-400 focus:ring-emerald-400/20'
                    : 'border-slate-200 focus:border-rose-400 focus:ring-rose-400/20'
                }`}
                required
              />
            </div>
          </div>

          {/* Kasa Seçimi */}
          <div ref={dropdownRef} className="relative">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              <Banknote className="w-3 h-3 inline mr-1" />
              Kasa
            </label>
            <button
              type="button"
              onClick={() => setShowRegisterDropdown(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 hover:border-slate-300 active:scale-[0.99] transition-all"
            >
              {selectedRegister ? (
                <div className="flex items-center gap-3">
                  <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${registerColorClass(selectedRegister.type)}`}>
                    <RegisterIcon type={selectedRegister.type} />
                  </span>
                  <div className="text-left">
                    <p className="font-bold text-slate-800 leading-none">{selectedRegister.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{fmt(selectedRegister.current_balance)}</p>
                  </div>
                </div>
              ) : (
                <span className="text-slate-400">Kasa seçin...</span>
              )}
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showRegisterDropdown ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown listesi */}
            {showRegisterDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-10 animate-in slide-in-from-top-2 duration-150">
                {activeRegisters.length === 0 ? (
                  <p className="text-center text-sm text-slate-400 py-4">Aktif kasa bulunamadı.</p>
                ) : (
                  activeRegisters.map(reg => (
                    <button
                      key={reg.id}
                      type="button"
                      onClick={() => { setRegisterId(reg.id); setShowRegisterDropdown(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left ${
                        String(reg.id) === String(registerId) ? 'bg-slate-50' : ''
                      }`}
                    >
                      <span className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${registerColorClass(reg.type)}`}>
                        <RegisterIcon type={reg.type} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 text-sm truncate">{reg.name}</p>
                        <p className="text-xs text-slate-400">{fmt(reg.current_balance)}</p>
                      </div>
                      {String(reg.id) === String(registerId) && (
                        <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Açıklama */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              <FileText className="w-3 h-3 inline mr-1" />
              Açıklama
            </label>
            <input
              type="text"
              placeholder={palette.placeholder}
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={120}
              className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-sm font-medium text-slate-700 placeholder-slate-400 outline-none focus:bg-white focus:border-slate-300 focus:ring-4 focus:ring-slate-100 transition-all"
            />
          </div>

          {/* Tarih & Saat */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              <Calendar className="w-3 h-3 inline mr-1" />
              Tarih &amp; Saat
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={txDate}
                max={format(new Date(), 'yyyy-MM-dd')}
                onChange={e => setTxDate(e.target.value)}
                className="flex-1 px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-sm font-medium text-slate-700 outline-none focus:bg-white focus:border-slate-300 focus:ring-4 focus:ring-slate-100 transition-all"
              />
              <input
                type="time"
                value={txTime}
                onChange={e => setTxTime(e.target.value)}
                className="w-28 px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-sm font-medium text-slate-700 outline-none focus:bg-white focus:border-slate-300 focus:ring-4 focus:ring-slate-100 transition-all"
              />
            </div>
          </div>

          {/* Submit Butonu */}
          <div className="pt-4 pb-20">
            <button
              type="submit"
              disabled={loading || !amount || !registerId}
              className={`w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl text-white font-bold text-base shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none ${palette.btn}`}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <ModeIcon className="w-5 h-5" />
              )}
              {loading ? 'Kaydediliyor...' : `${palette.label} Ekle`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
