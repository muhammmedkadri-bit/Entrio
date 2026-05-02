import React, { useState, useEffect } from 'react';
import toast from '../../../components/ui/CustomToast';
import { Calculator } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { cashService } from '../../../services/cashService';
import { DenominationCounter } from '../components/DenominationCounter';

export const CashClosingModal = ({ isOpen, onClose, targetRegister, onSaved }) => {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [action, setAction] = useState('keep_all');
  const [floatAmount, setFloatAmount] = useState('0');
  
  const [showCounter, setShowCounter] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAmount(targetRegister?.current_balance?.toString() || '0');
      setNote('');
      setAction('keep_all');
      setFloatAmount('0');
      setShowCounter(false);
    }
  }, [isOpen, targetRegister]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const val = parseFloat(amount);
    
    if (isNaN(val) || val < 0) {
      toast.error('Geçerli bir sayım tutarı girin.');
      return;
    }

    if (action === 'keep_float') {
       const floatVal = parseFloat(floatAmount);
       if (isNaN(floatVal) || floatVal < 0 || floatVal > val) {
         toast.error('Kasada bırakılacak tutar (fon), sayılan toplam nakitten büyük olamaz.');
         return;
       }
    }
    
    setLoading(true);
    try {
      await cashService.closeRegister(targetRegister.id, val, action, parseFloat(floatAmount) || 0, note);
      toast.success('Kasa başarıyla kapatıldı. Gün sonu raporu oluşturuldu.');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);

  if (!targetRegister) return null;

  const expected = targetRegister.current_balance || 0;
  const counted = parseFloat(amount) || 0;
  const diff = counted - expected;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Z Raporu / Gün Sonu Kapanış" size={showCounter ? 'xl' : 'lg'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div className="space-y-4 border-r border-slate-100 pr-4">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">1. Beklenen Z (Sistem)</h3>
            
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
              <p className="text-xs text-slate-500 mb-0.5">Sistemdeki Tüm Alışverişlerin Sonucu (Tahmini Kasa)</p>
              <div className="text-3xl font-black text-brand-700">{formatCurrency(expected)}</div>
            </div>

            <div className="space-y-3">
              <Input 
                label="Fiili Sayılan Tutar (Gerçek Nakit)" 
                type="number" 
                step="0.01" 
                value={amount} 
                onChange={e => setAmount(e.target.value)} 
                required 
                className="text-lg font-bold h-12"
              />
              <Button variant="outline" type="button" icon={Calculator} onClick={() => setShowCounter(!showCounter)} className="w-full">
                Bozukluk ve Banknot Sayıcıyı Kullan
              </Button>
            </div>

            {diff !== 0 && (
              <div className={`text-sm p-3 rounded-lg border flex flex-col items-center justify-center text-center ${diff > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                <span className="font-bold text-lg">{formatCurrency(Math.abs(diff))} {diff > 0 ? 'Kasa Fazlası' : 'Kasa Eksiği'} Tespit Edildi</span>
                <span className="text-xs opacity-80 mt-1">Bu fark kapanışa not olarak loglanacaktır. Kayıpları gidermek istiyorsanız kapatmadan önce eksik/fazla tahsilat fişi oluşturabilirsiniz.</span>
              </div>
            )}
            {diff === 0 && (
              <div className="text-slate-500 text-sm text-center p-2 bg-slate-50 border border-slate-100 rounded">
                Sistem ile sayım tamamen dengede.
              </div>
            )}

            <Input label="Kapanış İzahı (Varsa Kayıp Nedeni vb.)" value={note} onChange={e => setNote(e.target.value)} />

          </div>

          <div className="space-y-4 pt-4 md:pt-0">
            {showCounter ? (
               <DenominationCounter onChange={(sum) => setAmount(sum.toString())} />
            ) : (
             <div className="flex flex-col h-full"> 
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide mb-3">2. Gelir Teslimatı Aksiyonu</h3>
              <p className="text-xs text-slate-500 mb-4">Mevcut nakdi (sayılan tutarı) gece güvende bırakmak veya patrona teslim etmek için ne yapılacağına karar verin.</p>
              
              <div className="space-y-3 flex-1">
                <label className={`block p-3 border rounded-xl cursor-pointer ${action === 'keep_all' ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <input type="radio" value="keep_all" checked={action === 'keep_all'} onChange={() => setAction('keep_all')} className="text-brand-600 focus:ring-brand-500" />
                    <span className="font-bold text-slate-800 text-sm">Hepsini Kasada Bırak</span>
                  </div>
                  <p className="text-xs text-slate-500 ml-6">Sayılan {formatCurrency(counted)} nakit direkt sonraki sabaha devreder.</p>
                </label>

                <label className={`block p-3 border rounded-xl cursor-pointer ${action === 'withdraw_all' ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <input type="radio" value="withdraw_all" checked={action === 'withdraw_all'} onChange={() => setAction('withdraw_all')} className="text-brand-600 focus:ring-brand-500" />
                    <span className="font-bold text-slate-800 text-sm">Hepsini Çek (Teslim Et)</span>
                  </div>
                  <p className="text-xs text-slate-500 ml-6">Para kasadan sistemce çıkarılır. Sabah 0₺ ile kasa açılır.</p>
                </label>

                <label className={`block p-3 border rounded-xl cursor-pointer ${action === 'keep_float' ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <input type="radio" value="keep_float" checked={action === 'keep_float'} onChange={() => setAction('keep_float')} className="text-brand-600 focus:ring-brand-500" />
                    <span className="font-bold text-slate-800 text-sm">Kasa Fonu (Bozukluk) Bırak</span>
                  </div>
                  <p className="text-xs text-slate-500 ml-6 mb-2">Örn: Yalnızca sabah için 500₺ bozukluk içeride kalır, kalan çekilir.</p>
                  {action === 'keep_float' && (
                    <div className="ml-6 flex items-center gap-2">
                       <Input type="number" step="0.01" value={floatAmount} onChange={e => setFloatAmount(e.target.value)} className="w-32 h-8 text-sm" placeholder="Bırakılacak" />
                       <span className="text-xs font-bold text-red-500">Çekilecek nakit: {formatCurrency(Math.max(0, counted - (parseFloat(floatAmount) || 0)))}</span>
                    </div>
                  )}
                </label>
              </div>
             </div> 
            )}
          </div>

        </div>

        <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-6">
           <Button variant="ghost" type="button" onClick={onClose}>İptal</Button>
           <Button type="submit" variant="danger" isLoading={loading}>Kapanış Raporunu Kes ve Kilitle</Button>
        </div>
      </form>
    </Modal>
  );
};
