import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { cashService } from '../../../services/cashService';

export const TransferModal = ({ isOpen, onClose, sourceRegister, allRegisters, onSaved }) => {
  const [targetId, setTargetId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const availableTargets = allRegisters.filter(r => r.id !== sourceRegister?.id);

  useEffect(() => {
    if (isOpen) {
      setTargetId(availableTargets.length > 0 ? availableTargets[0].id : '');
      setAmount('');
      setDescription('');
    }
  }, [isOpen, sourceRegister, allRegisters]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!targetId) return toast.error('Lütfen hedef kasa seçin.');
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return toast.error('Lütfen geçerli bir tutar girin.');

    if ((sourceRegister.current_balance || 0) < val) {
      return toast.error('Kaynak kasada yeterli bakiye yok.');
    }

    setLoading(true);
    try {
      await cashService.transfer(sourceRegister.id, parseInt(targetId), val, description);
      toast.success('Transfer başarıyla gerçekleştirildi.');
      onSaved();
      onClose();
    } catch (err) {
      console.error('[Transfer] Hata:', err);
      toast.error(err?.message || 'Transfer sırasında beklenmeyen bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  if (!sourceRegister) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Transfer - ${sourceRegister.name}`} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex flex-col gap-1">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Kaynak Kasa Bakiyesi</span>
          <span className="text-lg font-bold text-slate-800">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(sourceRegister.current_balance || 0)}</span>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Hedef Kasa / Hesap</label>
          <select
            value={targetId}
            onChange={e => setTargetId(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 text-slate-800 font-medium"
            required
          >
            <option value="" disabled>Seçiniz...</option>
            {availableTargets.map(r => (
              <option key={r.id} value={r.id}>{r.name} ({new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(r.current_balance || 0)})</option>
            ))}
          </select>
        </div>

        <div>
           <label className="block text-sm font-semibold text-slate-700 mb-1.5">Transfer Tutarı (₺)</label>
           <input
             type="number"
             step="0.01"
             min="0.01"
             max={sourceRegister.current_balance || 0.01}
             value={amount}
             onChange={(e) => setAmount(e.target.value)}
             className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 font-bold text-slate-800"
             required
             placeholder="0.00"
           />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Açıklama (Opsiyonel)</label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 text-slate-800"
            placeholder="Elden teslim, pos virmanı vb."
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
           <Button variant="ghost" type="button" onClick={onClose} className="hover:bg-slate-100">İptal</Button>
           <Button type="submit" isLoading={loading}>Transferi Gerçekleştir</Button>
        </div>
      </form>
    </Modal>
  );
};
