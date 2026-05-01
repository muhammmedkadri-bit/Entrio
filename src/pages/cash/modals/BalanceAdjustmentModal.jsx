import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { cashService } from '../../../services/cashService';

export const BalanceAdjustmentModal = ({ isOpen, onClose, register, onSaved }) => {
  const [newBalance, setNewBalance] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && register) {
      setNewBalance(register.current_balance || 0);
      setReason('');
    }
  }, [isOpen, register]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const val = parseFloat(newBalance);
    if (isNaN(val)) return toast.error('Lütfen geçerli bir bakiye girin.');

    setLoading(true);
    try {
      await cashService.adjustBalance(register.id, val, reason);
      toast.success('Kasa bakiyesi başarıyla düzeltildi.');
      onSaved();
      onClose();
    } catch (err) {
      console.error('[BalanceAdjustment] Hata:', err);
      toast.error(err?.message || 'Bakiye düzeltme sırasında bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  if (!register) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Bakiye Düzeltme - ${register.name}`} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between items-center">
          <span className="text-sm font-medium text-slate-500">Mevcut Bakiye:</span>
          <span className="text-base font-bold text-slate-800">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(register.current_balance || 0)}</span>
        </div>

        <div>
           <label className="block text-sm font-semibold text-slate-700 mb-1.5">Olması Gereken Bakiye (₺)</label>
           <input
             type="number"
             step="0.01"
             value={newBalance}
             onChange={(e) => setNewBalance(e.target.value)}
             className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 font-bold text-slate-800"
             required
             autoFocus
           />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Düzeltme Sebebi (Opsiyonel)</label>
          <input
            type="text"
            value={reason}
            onChange={e => setReason(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 text-slate-800"
            placeholder="Eksik sayım, sistemsel hata vb."
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
           <Button variant="ghost" type="button" onClick={onClose} className="hover:bg-slate-100">İptal</Button>
           <Button type="submit" isLoading={loading}>Bakiyeyi Güncelle</Button>
        </div>
      </form>
    </Modal>
  );
};
