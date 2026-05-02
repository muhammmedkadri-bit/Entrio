import React, { useState, useEffect } from 'react';
import toast from '../../../components/ui/CustomToast';
import { Banknote, Plus, Minus } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { DatePicker } from '../../../components/ui/DatePicker';
import { cashService } from '../../../services/cashService';
import { format } from 'date-fns';

export const ManualTransactionModal = ({ isOpen, onClose, targetRegister, initialDirection = 'out', onSaved }) => {
  const [dateObj, setDateObj] = useState(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setDescription('');
      setDateObj({ start: new Date(), end: new Date() });
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const val = parseFloat(amount);
    
    if (isNaN(val) || val <= 0) {
      toast.error('Lütfen geçerli bir tutar girin.');
      return;
    }

    if (!description.trim()) {
      toast.error('Lütfen bir açıklama girin.');
      return;
    }
    
    setLoading(true);
    try {
      const type = initialDirection === 'in' ? 'deposit_in' : 'expense_out';
      const txDate = dateObj?.start || new Date();
      
      await cashService.addTransaction(targetRegister.id, type, val, description, txDate);
      toast.success(`${initialDirection === 'in' ? 'Gelir' : 'Gider'} başarıyla kaydedildi.`);
      
      onSaved();
      onClose();
    } catch (err) {
      console.error('[ManualTransaction] Hata:', err);
      toast.error(err?.message || 'İşlem kaydedilirken beklenmeyen bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  if (!targetRegister) return null;

  const titlePrefix = initialDirection === 'in' ? 'Gelir Ekle' : 'Gider Ekle';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${titlePrefix} - ${targetRegister.name}`} size="sm">
      <form onSubmit={handleSubmit} className="space-y-5">
        
        {/* Info Text */}
        <div className={`p-4 rounded-xl flex flex-col items-center justify-center text-center gap-2.5 border ${initialDirection === 'in' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'}`}>
          <div className={`p-2.5 rounded-full relative flex items-center justify-center ${initialDirection === 'in' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            <Banknote className="w-6 h-6" />
            <div className={`absolute -bottom-1 -right-1 rounded-full p-0.5 text-white ${initialDirection === 'in' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
              {initialDirection === 'in' ? <Plus className="w-3.5 h-3.5" strokeWidth={3} /> : <Minus className="w-3.5 h-3.5" strokeWidth={3} />}
            </div>
          </div>
          <div className="text-[13px] font-medium leading-relaxed max-w-[280px]">
            Bu ekrandan kasanıza manuel olarak bağımsız bir <strong className="font-extrabold">{initialDirection === 'in' ? 'gelir (giriş)' : 'gider (çıkış)'}</strong> işlemi ekleyebilirsiniz.
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Date Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">İşlem Tarihi</label>
            <DatePicker 
               value={dateObj} 
               onChange={(val) => setDateObj(val ? { start: val.start, end: val.start } : { start: new Date(), end: new Date() })} 
               allowClear={false}
            />
          </div>

          {/* Amount Input */}
          <div>
             <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tutar</label>
             <div className="relative">
               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                 <span className="text-slate-400 font-bold">₺</span>
               </div>
               <input
                 type="number"
                 step="0.01"
                 min="0.01"
                 value={amount}
                 onChange={(e) => setAmount(e.target.value)}
                 className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-[#5da83f] focus:ring-2 focus:ring-[#5da83f]/20 transition-all font-black text-slate-800 h-[42px]"
                 placeholder="0.00"
                 required
                 autoFocus
               />
             </div>
          </div>
        </div>

        {/* Description Input */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Açıklama</label>
          <textarea 
            rows={3} 
            className="w-full border border-slate-200 bg-slate-50 rounded-xl p-3 outline-none focus:bg-white focus:border-[#5da83f] focus:ring-2 focus:ring-[#5da83f]/20 transition-all text-sm text-slate-800 resize-none"
            placeholder={initialDirection === 'in' ? 'Satış geliri, avans vb.' : 'Kargo ücreti, ofis gideri vb.'}
            value={description}
            onChange={e => setDescription(e.target.value)}
            required
          />
        </div>

        <div className="pt-2 flex justify-end gap-3 border-t border-slate-100 mt-2">
           <Button variant="ghost" type="button" onClick={onClose} className="hover:bg-slate-100">İptal</Button>
           <Button type="submit" isLoading={loading} className="bg-[#5da83f] hover:bg-[#4b8a32] text-white border-none shadow-sm">Kaydet</Button>
        </div>
      </form>
    </Modal>
  );
};
