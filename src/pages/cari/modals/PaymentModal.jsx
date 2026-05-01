import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { X, HandCoins, CircleDollarSign, Check, ChevronDown, ListPlus, Banknote } from 'lucide-react';
import { supplierService } from '../../../services/supplierService';
import { db } from '../../../db'; // To fetch cash registers

export const PaymentModal = ({ isOpen, onClose, supplier, onSaved }) => {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Nakit');
  const [description, setDescription] = useState('');
  const [registerId, setRegisterId] = useState(1);
  const [registers, setRegisters] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setMethod('Nakit');
      setDescription('');
      fetchRegisters();
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const fetchRegisters = async () => {
    const regs = await db.cash_registers.filter(r => r.is_active !== false).toArray();
    setRegisters(regs);
    if (regs.length > 0) setRegisterId(regs[0].id);
  };

  if (!isOpen || !supplier) return null;

  const debt = parseFloat(supplier.balance) || 0;
  const formatCurrency = (val) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const val = parseFloat(amount);
    
    if (!val || val <= 0) {
      toast.error('Geçerli bir ödeme tutarı girin.');
      return;
    }
    
    setLoading(true);
    try {
      const regId = parseInt(registerId) || null;
      const result = await supplierService.makePayment(supplier.id, val, method, regId, description);
      
      const allocCount = result.allocations?.length || 0;
      if (result.overpayment > 0) {
        toast.success(
          `Ödeme kaydedildi. ${allocCount} faturaya dağıtıldı. ₺${result.overpayment.toFixed(2)} cari avans olarak kaydedildi.`,
          { duration: 4000 }
        );
      } else if (allocCount > 0) {
        toast.success(`Ödeme kaydedildi. ${allocCount} fatura${allocCount > 1 ? 'ya' : 'ya'} dağıtıldı. ✓`);
      } else {
        toast.success('Ödeme başarıyla kaydedildi.');
      }
      
      onSaved();
      onClose();
    } catch (err) {
      console.error('[SupplierPayment] Ödeme Hatası:', err);
      toast.error(err?.message || 'Ödeme kaydedilirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const showRegisterSelect = ['Nakit', 'Kredi Kartı'].includes(method);

  const inputCls = "w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-400/50 focus:border-rose-400 transition-all";
  const labelCls = "flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-1.5";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-white/10 transition-opacity backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div
        className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-white flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-rose-50 border border-rose-100">
              <HandCoins className="w-4 h-4 text-rose-500" />
            </div>
            <h2 className="text-base font-bold text-slate-900">
              Ödeme Yap
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

            {/* Tedarikçi Bakiye Özeti */}
            <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-4 text-center">
              <p className="text-sm font-bold text-slate-600 mb-1">{supplier.name}</p>
              <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1.5">Mevcut Borcumuz</p>
              <div className={`text-2xl font-black tracking-tight ${debt > 0 ? 'text-rose-500' : debt < 0 ? 'text-emerald-500' : 'text-slate-800'}`}>
                {formatCurrency(Math.abs(debt))} <span className="text-sm">{debt > 0 ? '(Biz Borçluyuz)' : debt < 0 ? '(Alacaklıyız)' : ''}</span>
              </div>
            </div>

            {/* Tutar */}
            <div>
              <label className={labelCls}><CircleDollarSign className="w-4 h-4 text-slate-400" /> Ödenen Tutar ₺ <span className="text-rose-500">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm select-none">₺</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  autoFocus
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className={`${inputCls} pl-7 font-bold tabular-nums text-lg text-rose-600`}
                  placeholder="0.00"
                />
              </div>
              {debt > 0 && <p className="text-xs font-medium text-slate-400 mt-1.5 ml-1">Önerilen Maksimum: {debt}₺</p>}
            </div>

            {/* Ödeme Yöntemi */}
            <div>
              <label className={labelCls}><Banknote className="w-4 h-4 text-slate-400" /> Ödeme Yöntemi</label>
              <div className="relative">
                <select 
                  value={method} 
                  onChange={e => setMethod(e.target.value)} 
                  className={`${inputCls} appearance-none pr-10 cursor-pointer`}
                >
                  <option>Nakit</option>
                  <option>Kredi Kartı</option>
                  <option>Banka Havalesi / EFT</option>
                  <option>Çek</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Hesap / Kasa Seçimi */}
            {showRegisterSelect && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                <label className={labelCls}><ListPlus className="w-4 h-4 text-slate-400" /> Hesaptan / Kasadan Çıkış</label>
                <div className="relative">
                  <select 
                    value={registerId} 
                    onChange={e => setRegisterId(e.target.value)} 
                    className={`${inputCls} appearance-none pr-10 cursor-pointer`}
                  >
                    {registers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>
            )}

            {/* Açıklama / Not */}
            <div>
              <label className={labelCls}>Açıklama / Not (Opsiyonel)</label>
              <textarea 
                rows={2} 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                className={`${inputCls} resize-none`} 
                placeholder="Örn: Ekim ayı malzeme ödemesi" 
              />
            </div>

          </div>

          {/* Footer */}
          <div className="flex-shrink-0 px-5 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 shadow-sm active:scale-95 transition-all"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 shadow-sm active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" />
              {loading ? 'Kaydediliyor...' : 'Ödemeyi Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
