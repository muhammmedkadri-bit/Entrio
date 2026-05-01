import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '../../../components/ui/Modal';
import { cashService } from '../../../services/cashService';
import { Building2, Wallet, CreditCard, PlusCircle, CircleDollarSign, X, Check, Calendar, Calculator } from 'lucide-react';

const inputCls =
  'w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400 transition-all';
const labelCls = 'flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-1';

const CATEGORIES = [
  { id: 'cash',        label: 'Nakit',        icon: Wallet,       desc: 'Fiziksel para kasası',     color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', ring: 'ring-emerald-300' },
  { id: 'pos',         label: 'POS',          icon: Calculator,   desc: 'POS / Kart terminali',     color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-200',    ring: 'ring-blue-300' },
  { id: 'bank',        label: 'Banka',        icon: Building2,    desc: 'Banka / Havale hesabı',    color: 'text-violet-600',  bg: 'bg-violet-50',  border: 'border-violet-200',  ring: 'ring-violet-300' },
  { id: 'credit_card', label: 'Kredi Kartı',  icon: CreditCard,   desc: 'Kredi kartı borç takibi', color: 'text-rose-600',    bg: 'bg-rose-50',    border: 'border-rose-200',    ring: 'ring-rose-300' },
];

export const CreateRegisterModal = ({ isOpen, onClose, onSaved }) => {
  const [formData, setFormData] = useState({
    name: '', type: 'cash', opening_balance: '',
    credit_limit: '', billing_day: '', due_day: ''
  });
  const [loading, setLoading] = useState(false);

  const isCreditCard = formData.type === 'credit_card';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return toast.error('Kasa adı zorunludur.');
    setLoading(true);
    try {
      const balance = parseFloat(formData.opening_balance) || 0;
      await cashService.createRegister({
        name: formData.name.trim(),
        type: formData.type,
        current_balance: isCreditCard ? -(Math.abs(balance)) : balance,
        opening_balance: balance,
        ...(isCreditCard && {
          credit_limit: parseFloat(formData.credit_limit) || 0,
          billing_day: parseInt(formData.billing_day) || null,
          due_day: parseInt(formData.due_day) || null,
        }),
        is_active: true
      });
      toast.success('Kasa başarıyla oluşturuldu.');
      onSaved();
      onClose();
      setFormData({ name: '', type: 'cash', opening_balance: '', credit_limit: '', billing_day: '', due_day: '' });
    } catch (error) {
      console.error('[CreateRegister] Kasa oluşturma hatası:', error);
      toast.error(error?.message || 'Kasa oluşturulurken hata meydana geldi.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({ name: '', type: 'cash', opening_balance: '', credit_limit: '', billing_day: '', due_day: '' });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Yeni Kasa / Hesap Ekle" size="md">
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Kasa Adı */}
        <div>
          <label className={labelCls}><PlusCircle className="w-4 h-4 text-slate-400" /> Kasa / Hesap Adı</label>
          <input type="text" autoFocus value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className={inputCls} placeholder="Örn: Merkez Kasa, Garanti BBVA, Akbank Kredi" required />
        </div>

        {/* Kategori — 4 kart (2x2) */}
        <div>
          <label className={labelCls}><Building2 className="w-4 h-4 text-slate-400" /> Kategori</label>
          <div className="grid grid-cols-4 gap-2">
            {CATEGORIES.map(cat => {
              const active = formData.type === cat.id;
              const Icon = cat.icon;
              return (
                <button key={cat.id} type="button"
                  onClick={() => setFormData({ ...formData, type: cat.id })}
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

        {/* Kredi Kartı Özel Alanlar */}
        {isCreditCard && (
          <div className="space-y-3 bg-rose-50/50 border border-rose-200/60 rounded-xl p-4">
            <p className="text-xs font-bold text-rose-600 mb-2">Kredi Kartı Bilgileri</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}><CircleDollarSign className="w-4 h-4 text-slate-400" /> Kredi Limiti (₺)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm select-none">₺</span>
                  <input type="number" step="0.01" value={formData.credit_limit}
                    onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                    className={`${inputCls} pl-7 font-bold tabular-nums`} placeholder="0.00" />
                </div>
              </div>
              <div>
                <label className={labelCls}><CircleDollarSign className="w-4 h-4 text-slate-400" /> Açılış Borcu (₺)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm select-none">₺</span>
                  <input type="number" step="0.01" value={formData.opening_balance}
                    onChange={(e) => setFormData({ ...formData, opening_balance: e.target.value })}
                    className={`${inputCls} pl-7 font-bold tabular-nums`} placeholder="0.00" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}><Calendar className="w-4 h-4 text-slate-400" /> Hesap Kesim Günü</label>
                <input type="number" min="1" max="31" value={formData.billing_day}
                  onChange={(e) => setFormData({ ...formData, billing_day: e.target.value })}
                  className={inputCls} placeholder="Örn: 15" />
              </div>
              <div>
                <label className={labelCls}><Calendar className="w-4 h-4 text-slate-400" /> Son Ödeme Günü</label>
                <input type="number" min="1" max="31" value={formData.due_day}
                  onChange={(e) => setFormData({ ...formData, due_day: e.target.value })}
                  className={inputCls} placeholder="Örn: 5" />
              </div>
            </div>
          </div>
        )}

        {/* Başlangıç Bakiyesi (kredi kartı hariç) */}
        {!isCreditCard && (
          <div>
            <label className={labelCls}><CircleDollarSign className="w-4 h-4 text-slate-400" /> Başlangıç Bakiyesi (₺)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm select-none">₺</span>
              <input type="number" step="0.01" value={formData.opening_balance}
                onChange={(e) => setFormData({ ...formData, opening_balance: e.target.value })}
                className={`${inputCls} pl-7 font-bold tabular-nums`} placeholder="0.00" />
            </div>
            <p className="text-xs text-slate-400 mt-1.5 leading-snug">
              Kasanın mevcut bakiyesi varsa buraya girin, yoksa boş bırakabilirsiniz.
            </p>
          </div>
        )}

        {/* Butonlar */}
        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <button type="button" onClick={handleClose}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold backdrop-blur-sm bg-white/60 text-slate-700 border border-slate-200/80 active:scale-95 transition-all outline-none">
            <X className="w-4 h-4" /> İptal
          </button>
          <button type="submit" disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold backdrop-blur-sm bg-[#5da83f]/12 text-[#3d7a28] border border-[#5da83f]/30 active:scale-95 transition-all outline-none disabled:opacity-60">
            <Check className="w-4 h-4" />
            {loading ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>

      </form>
    </Modal>
  );
};
