import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  X, ArrowDownLeft, RefreshCw, Banknote, Building2, CreditCard,
  ChevronDown, Info, Check
} from 'lucide-react';
import { supplierService } from '../../../services/supplierService';
import { db } from '../../../db';

const fmt = (v) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(v || 0);

const METHOD_OPTIONS = [
  { value: 'cash', label: 'Nakit', icon: Banknote },
  { value: 'bank_transfer', label: 'Havale/EFT', icon: Building2 },
  { value: 'credit_card', label: 'Kredi Kartı', icon: CreditCard },
];

export const SupplierCollectionModal = ({ isOpen, onClose, supplier, onSaved }) => {
  const receivable = Math.abs(parseFloat(supplier?.balance) || 0);
  const today = new Date().toISOString().split('T')[0];

  const [type, setType] = useState('cash_collection'); // 'cash_collection' | 'offset'
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [registerId, setRegisterId] = useState(null);
  const [registers, setRegisters] = useState([]);
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && supplier) {
      setType('cash_collection');
      setAmount(receivable.toString());
      setMethod('cash');
      setDate(today);
      setDescription('');
      fetchRegisters();
      document.body.style.overflow = 'hidden';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen, supplier]);

  const fetchRegisters = async () => {
    const regs = await db.cash_registers.filter(r => r.is_active !== false).toArray();
    setRegisters(regs);
    if (regs.length > 0) setRegisterId(regs[0].id);
  };

  if (!isOpen || !supplier) return null;

  const parsedAmount = parseFloat(amount) || 0;
  const afterBalance = -receivable + parsedAmount; // supplier balance goes from negative toward 0
  const isAmountValid = parsedAmount > 0 && parsedAmount <= receivable;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAmountValid) {
      toast.error('Geçerli bir tahsilat tutarı girin. Maksimum: ' + fmt(receivable));
      return;
    }
    setLoading(true);
    try {
      await supplierService.collectFromSupplier(
        supplier.id,
        parsedAmount,
        type,
        method,
        type === 'cash_collection' ? parseInt(registerId) : null,
        date,
        description
      );
      const label = type === 'cash_collection' ? 'Tahsilat' : 'Mahsuplaşma';
      toast.success(`${fmt(parsedAmount)} ${label} kaydedildi.`);
      onSaved();
      onClose();
    } catch (err) {
      console.error('[SupplierCollection] Tahsilat Hatası:', err);
      toast.error(err?.message || 'Tahsilat kaydedilirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400 transition-all';
  const labelCls = 'flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-1.5';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-white/10 backdrop-blur-md" onClick={onClose} />

      <div
        className="relative z-10 w-full max-w-md flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        style={{
          background: 'rgba(255,255,255,0.93)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.65)',
          boxShadow: '0 20px 56px rgba(0,0,0,0.13)',
          borderRadius: 16,
          maxHeight: '90vh',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-50 border border-emerald-100">
              <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Tedarikçiden Tahsilat</h2>
              <p className="text-xs text-gray-500">{supplier.name}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
            {/* Alacak Özeti */}
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 text-center">
              <p className="text-[10px] uppercase font-bold tracking-widest text-emerald-500 mb-1">Toplam Alacak Tutarı</p>
              <div className="text-2xl font-black text-emerald-600 tracking-tight">{fmt(receivable)}</div>
            </div>

            {/* Tür Seçici */}
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  id: 'cash_collection',
                  title: 'Nakit / Havale',
                  desc: 'Kasaya giriş yapılır.',
                  icon: Banknote,
                  activeStyle: { background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.35)', boxShadow: '0 2px 8px rgba(16,185,129,0.1)' },
                  inactiveStyle: { background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(209,213,219,0.6)' },
                },
                {
                  id: 'offset',
                  title: 'Mahsuplaşma',
                  desc: 'Kasa etkilenmez.',
                  icon: RefreshCw,
                  activeStyle: { background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.35)', boxShadow: '0 2px 8px rgba(59,130,246,0.1)' },
                  inactiveStyle: { background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(209,213,219,0.6)' },
                },
              ].map(opt => {
                const Icon = opt.icon;
                const isActive = type === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setType(opt.id)}
                    style={{ ...(isActive ? opt.activeStyle : opt.inactiveStyle), borderRadius: 12, padding: 12, transition: 'all 0.15s ease', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`w-4 h-4 ${isActive ? (opt.id === 'cash_collection' ? 'text-emerald-600' : 'text-blue-600') : 'text-slate-400'}`} />
                      <span className={`text-xs font-bold ${isActive ? (opt.id === 'cash_collection' ? 'text-emerald-700' : 'text-blue-700') : 'text-slate-600'}`}>{opt.title}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">{opt.desc}</p>
                  </button>
                );
              })}
            </div>

            {/* Tutar */}
            <div>
              <label className={labelCls}>Tahsilat Tutarı (₺) <span className="text-rose-500">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm select-none">₺</span>
                <input
                  type="number" step="0.01" min="0.01" max={receivable}
                  autoFocus
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className={`${inputCls} pl-7 font-bold tabular-nums text-lg text-emerald-600`}
                  placeholder="0.00"
                />
              </div>
              <p className="text-xs font-medium text-slate-400 mt-1 ml-1">Maksimum: {fmt(receivable)}</p>
            </div>

            {/* Nakit Tahsilat ek alanlar */}
            {type === 'cash_collection' && (
              <>
                {/* Yöntem Seçici */}
                <div>
                  <label className={labelCls}>Tahsilat Yöntemi</label>
                  <div className="flex gap-2">
                    {METHOD_OPTIONS.map(opt => {
                      const Icon = opt.icon;
                      const active = method === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setMethod(opt.value)}
                          className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                            active
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm'
                              : 'bg-white/60 border-slate-200 text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Kasa Seçimi */}
                {(method === 'cash' || method === 'credit_card') && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                    <label className={labelCls}>Hangi Kasaya</label>
                    <div className="relative">
                      <select value={registerId || ''} onChange={e => setRegisterId(e.target.value)} className={`${inputCls} appearance-none pr-10 cursor-pointer`}>
                        {registers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Tarih */}
                <div>
                  <label className={labelCls}>Tahsilat Tarihi</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
                </div>
              </>
            )}

            {/* Mahsuplaşma ek alanlar */}
            {type === 'offset' && (
              <>
                <div>
                  <label className={labelCls}>Tarih</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
                </div>
                <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3">
                  <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-600">Mahsuplaşma kasa bakiyenizi etkilemez. Sadece tedarikçi cari hesabı güncellenir.</p>
                </div>
              </>
            )}

            {/* Açıklama */}
            <div>
              <label className={labelCls}>Açıklama (Opsiyonel)</label>
              <textarea
                rows={2}
                value={description}
                onChange={e => setDescription(e.target.value)}
                className={`${inputCls} resize-none`}
                placeholder={type === 'offset' ? 'Sonraki alışta mahsup edilecek, vb.' : 'Fazla ödeme iadesi, vb.'}
              />
            </div>

            {/* Önizleme */}
            {parsedAmount > 0 && (
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 space-y-1.5">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Mevcut Alacak</span>
                  <span className="font-semibold text-emerald-600">{fmt(receivable)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{type === 'offset' ? 'Mahsuplaşma' : 'Tahsilat'}</span>
                  <span className="font-semibold text-slate-600">-{fmt(parsedAmount)}</span>
                </div>
                <div className="flex justify-between text-xs border-t border-slate-200 pt-1.5">
                  <span className="font-bold text-slate-700">İşlem Sonrası</span>
                  <span className={`font-black ${afterBalance < -0.001 ? 'text-emerald-600' : afterBalance > 0.001 ? 'text-rose-600' : 'text-slate-500'}`}>
                    {fmt(Math.abs(afterBalance))}
                    {afterBalance < -0.001 ? ' (Alacaklı)' : afterBalance > 0.001 ? ' (Borcumuz)' : ' (Dengede)'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 px-5 py-4 border-t border-slate-200 bg-slate-50 flex items-center gap-2.5">
            <button type="button" onClick={onClose} className="flex-1 px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 shadow-sm active:scale-95 transition-all">
              İptal
            </button>
            <button
              type="submit"
              disabled={loading || !isAmountValid}
              className={`flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm active:scale-95 transition-all focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed ${
                type === 'offset'
                  ? 'text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 focus:ring-2 focus:ring-blue-400 focus:ring-offset-2'
                  : 'text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2'
              }`}
            >
              {type === 'offset' ? <RefreshCw className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
              {loading ? 'Kaydediliyor...' : type === 'offset' ? 'Mahsuplaşmayı Kaydet' : 'Tahsilatı Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
