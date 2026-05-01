import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '../../../components/ui/Modal';
import { cashService } from '../../../services/cashService';
import { Building2, Wallet, CreditCard, X, Check, Calculator } from 'lucide-react';

const inputCls =
  'w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400 transition-all';
const labelCls = 'flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-1';

const CATEGORIES = [
  { id: 'cash',        label: 'Nakit',       icon: Wallet,     color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', ring: 'ring-emerald-300' },
  { id: 'pos',         label: 'POS',         icon: Calculator, color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-200',    ring: 'ring-blue-300' },
  { id: 'bank',        label: 'Banka',       icon: Building2,  color: 'text-violet-600',  bg: 'bg-violet-50',  border: 'border-violet-200',  ring: 'ring-violet-300' },
  { id: 'credit_card', label: 'Kredi Kartı', icon: CreditCard, color: 'text-rose-600',    bg: 'bg-rose-50',    border: 'border-rose-200',    ring: 'ring-rose-300' },
];

export const EditRegisterModal = ({ isOpen, onClose, register, onSaved }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState('cash');
  const [billingDay, setBillingDay] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && register) {
      setName(register.name || '');
      setType(register.type || 'cash');
      setBillingDay(register.billing_day || '');
      setDueDay(register.due_day || '');
      setCreditLimit(register.credit_limit || '');
    }
  }, [isOpen, register]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Kasa adı boş olamaz.');
    setLoading(true);
    try {
      const payload = { name: name.trim(), type };
      if (type === 'credit_card') {
        payload.billing_day = billingDay ? parseInt(billingDay, 10) : null;
        payload.due_day = dueDay ? parseInt(dueDay, 10) : null;
        payload.credit_limit = creditLimit ? parseFloat(creditLimit) : 0;
      }
      
      await cashService.updateRegister(register.id, payload);
      toast.success('Kasa başarıyla güncellendi.');
      onSaved();
      onClose();
    } catch (err) {
      console.error('[EditRegister] Hata:', err);
      toast.error(err?.message || 'Kasa güncellenirken beklenmeyen bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  if (!register) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Kasayı Düzenle" size="sm">
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Kasa Adı */}
        <div>
          <label className={labelCls}>Kasa / Hesap Adı</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            className={inputCls} required autoFocus />
        </div>

        {/* Kategori */}
        <div>
          <label className={labelCls}>Kategori</label>
          <div className="grid grid-cols-4 gap-2">
            {CATEGORIES.map(cat => {
              const active = type === cat.id;
              const Icon = cat.icon;
              return (
                <button key={cat.id} type="button" onClick={() => setType(cat.id)}
                  className={[
                    'flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border-2 transition-all text-center',
                    active
                      ? `${cat.bg} ${cat.border} ${cat.color} ring-2 ${cat.ring} shadow-sm`
                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-white hover:border-slate-300'
                  ].join(' ')}>
                  <Icon className={`w-5 h-5 ${active ? cat.color : 'text-slate-400'}`} />
                  <span className="text-[10px] font-bold leading-tight">{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Kredi Kartı Özel Alanları */}
        {type === 'credit_card' && (
          <div className="grid grid-cols-2 gap-3 p-3 bg-rose-50/50 border border-rose-100 rounded-xl">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Kredi Limiti (₺)</label>
              <input type="number" step="0.01" value={creditLimit} onChange={e => setCreditLimit(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-rose-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-400/50 focus:border-rose-400 font-bold tabular-nums"
                placeholder="0.00" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Hesap Kesim Günü</label>
              <input type="number" min="1" max="31" value={billingDay} onChange={e => setBillingDay(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-rose-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-400/50 focus:border-rose-400"
                placeholder="Örn: 15" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Son Ödeme Günü</label>
              <input type="number" min="1" max="31" value={dueDay} onChange={e => setDueDay(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-rose-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-400/50 focus:border-rose-400"
                placeholder="Örn: 25" />
            </div>
          </div>
        )}

        {/* Butonlar */}
        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold backdrop-blur-sm bg-white/60 text-slate-700 border border-slate-200/80 active:scale-95 transition-all outline-none">
            <X className="w-4 h-4" /> İptal
          </button>
          <button type="submit" disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold backdrop-blur-sm bg-[#5da83f]/12 text-[#3d7a28] border border-[#5da83f]/30 active:scale-95 transition-all outline-none disabled:opacity-60">
            <Check className="w-4 h-4" />
            {loading ? 'Kaydediliyor...' : 'Güncelle'}
          </button>
        </div>

      </form>
    </Modal>
  );
};
