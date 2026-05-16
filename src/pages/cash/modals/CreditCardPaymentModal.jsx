import React, { useState, useEffect } from 'react';
import toast from '../../../components/ui/CustomToast';
import { CreditCard, ArrowUpRight, ArrowRight } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { DatePicker } from '../../../components/ui/DatePicker';
import { cashService } from '../../../services/cashService';

export const CreditCardPaymentModal = ({ isOpen, onClose, targetRegister, onSaved }) => {
  const [dateObj, setDateObj] = useState(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [sourceRegId, setSourceRegId] = useState('');
  const [registers, setRegisters] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setDescription('');
      setDateObj({ start: new Date(), end: new Date() });
      setSourceRegId('');
      
      cashService.getRegisters().then(regs => {
        // Sadece nakit ve banka kasalarını kaynak olarak göster
        const sources = regs.filter(r => r.type === 'cash' || r.type === 'bank' || r.type === 'general');
        setRegisters(sources);
        if (sources.length > 0) setSourceRegId(sources[0].id.toString());
      }).catch(err => console.error("Kasa listesi alınamadı:", err));
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const val = parseFloat(amount);
    
    if (isNaN(val) || val <= 0) {
      toast.error('Lütfen geçerli bir tutar girin.');
      return;
    }

    if (!sourceRegId) {
      toast.error('Lütfen ödemenin yapılacağı kaynak kasayı seçin.');
      return;
    }
    
    setLoading(true);
    try {
      const txDate = dateObj?.start || new Date();
      await cashService.creditCardPayment(targetRegister.id, sourceRegId, val, description, txDate);
      toast.success('Kredi kartı ödemesi başarıyla kaydedildi.');
      
      onSaved();
      onClose();
    } catch (err) {
      console.error('[CreditCardPayment] Hata:', err);
      toast.error(err?.message || 'Ödeme kaydedilirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  if (!targetRegister) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Kredi Kartı Ödemesi - ${targetRegister.name}`} size="sm">
      <form onSubmit={handleSubmit} className="space-y-5">
        
        {/* Info Text */}
        <div className="p-4 rounded-xl flex flex-col items-center justify-center text-center gap-2.5 border bg-[#82e05a]/10 border-[#82e05a]/30 text-[#4b8a32]">
          <div className="p-2.5 rounded-full relative flex items-center justify-center bg-[#82e05a]/20 text-[#5da83f]">
            <CreditCard className="w-6 h-6" />
            <div className="absolute -bottom-1 -right-1 rounded-full p-0.5 text-white bg-[#5da83f]">
              <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={3} />
            </div>
          </div>
          <div className="text-[13px] font-medium leading-relaxed max-w-[280px]">
            Seçtiğiniz kaynak kasadan <strong className="font-extrabold text-[#3a6b27]">çıkış (gider)</strong> yapılarak, kredi kartı borcunuz <strong className="font-extrabold text-[#3a6b27]">kapatılacaktır</strong>.
          </div>
        </div>

        <div className="space-y-4">
          {/* Source Register Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Ödeme Yapılacak Kasa</label>
            <div className="relative">
              <select
                value={sourceRegId}
                onChange={(e) => setSourceRegId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-[#5da83f] focus:ring-2 focus:ring-[#5da83f]/20 transition-all font-semibold text-slate-800 appearance-none h-[42px]"
                required
              >
                <option value="" disabled>Kasa Seçin...</option>
                {registers.map(reg => (
                  <option key={reg.id} value={reg.id}>{reg.name} ({reg.type === 'bank' ? 'Banka' : 'Nakit'})</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <ArrowRight className="w-4 h-4 rotate-90" />
              </div>
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
               <label className="block text-sm font-semibold text-slate-700 mb-1.5">Ödenecek Tutar</label>
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
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Açıklama (İsteğe Bağlı)</label>
            <textarea 
              rows={2} 
              className="w-full border border-slate-200 bg-slate-50 rounded-xl p-3 outline-none focus:bg-white focus:border-[#5da83f] focus:ring-2 focus:ring-[#5da83f]/20 transition-all text-sm text-slate-800 resize-none"
              placeholder="Ekstre ödemesi, erken ödeme vb."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
        </div>

        <div className="pt-2 flex justify-end gap-3 border-t border-slate-100 mt-2">
           <Button variant="ghost" type="button" onClick={onClose} className="hover:bg-slate-100">İptal</Button>
           <Button type="submit" isLoading={loading} className="bg-[#5da83f] hover:bg-[#4b8a32] text-white border-none shadow-sm">Ödemeyi Kaydet</Button>
        </div>
      </form>
    </Modal>
  );
};
