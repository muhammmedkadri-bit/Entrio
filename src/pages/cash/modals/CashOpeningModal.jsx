import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Calculator } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { cashService } from '../../../services/cashService';
import { DenominationCounter } from '../components/DenominationCounter';

export const CashOpeningModal = ({ isOpen, onClose, targetRegister, onSaved }) => {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [showCounter, setShowCounter] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // By default populate expected balance
      setAmount(targetRegister?.current_balance?.toString() || '0');
      setNote('');
      setShowCounter(false);
    }
  }, [isOpen, targetRegister]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const val = parseFloat(amount);
    
    if (isNaN(val) || val < 0) {
      toast.error('Geçerli bir açılış tutarı girin.');
      return;
    }
    
    setLoading(true);
    try {
      await cashService.openRegister(targetRegister.id, val, note);
      toast.success('Kasa başarıyla açıldı, güne başlandı.');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCounterChange = (sum) => {
    setAmount(sum.toString());
  };

  const formatCurrency = (val) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);

  if (!targetRegister) return null;

  const expected = targetRegister.current_balance || 0;
  const diff = (parseFloat(amount) || 0) - expected;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Kasa Açılışı / Güne Başla" size={showCounter ? "lg" : "sm"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-sm font-semibold text-slate-500 mb-1">{targetRegister.name}</p>
          <p className="text-xs uppercase tracking-widest text-slate-400 mb-0.5">Sistemde Beklenen Açılış Bakiyesi</p>
          <div className="text-xl font-bold text-slate-700">{formatCurrency(expected)}</div>
        </div>

        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <Input 
              label="Sayılan Nakit (Hemen Kasada Bulunan)" 
              type="number" 
              step="0.01" 
              value={amount} 
              onChange={e => setAmount(e.target.value)} 
              required 
              autoFocus 
              className={diff !== 0 ? 'border-amber-400 focus:ring-amber-500' : ''}
            />
          </div>
          <Button variant="outline" type="button" icon={Calculator} onClick={() => setShowCounter(!showCounter)}>Banknot Sayıcı</Button>
        </div>

        {diff !== 0 && (
          <div className={`text-sm p-3 rounded-lg border ${diff > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
            <span className="font-bold">Dikkat (Fark): </span> 
            Sistemde görünenden {formatCurrency(Math.abs(diff))} {diff > 0 ? 'fazla' : 'eksik'} para girmektesiniz. Bu fark loglanacaktır.
          </div>
        )}

        {showCounter && (
          <div className="mt-4 border-t border-slate-100 pt-4">
             <DenominationCounter onChange={handleCounterChange} />
             <p className="text-xs text-slate-400 mt-2 text-center">Sayaçta çıkan toplam doğrudan Giriş Tutarını günceller.</p>
          </div>
        )}

        <div>
           <Input label="Açılış Notu" value={note} onChange={e => setNote(e.target.value)} placeholder="Opsiyonel detay..." />
        </div>

        <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
           <Button variant="ghost" type="button" onClick={onClose}>İptal</Button>
           <Button type="submit" isLoading={loading}>Kasa Kilidini Aç</Button>
        </div>
      </form>
    </Modal>
  );
};
