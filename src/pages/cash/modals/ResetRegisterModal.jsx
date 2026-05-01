import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { cashService } from '../../../services/cashService';
import { RotateCcw } from 'lucide-react';

export const ResetRegisterModal = ({ isOpen, onClose, register, onSaved }) => {
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!register) return;
    setLoading(true);
    try {
      await cashService.resetRegister(register.id);
      toast.success('Kasa başarıyla sıfırlandı.');
      onSaved();
      onClose();
    } catch (err) {
      console.error('[ResetRegister] Kasa sıfırlama hatası:', err);
      toast.error(err?.message || 'Kasa sıfırlanırken beklenmeyen bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  if (!register) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Kasayı Sıfırla" size="sm">
      <div className="flex flex-col items-center text-center pb-2 pt-4">
        <div className="w-16 h-16 bg-[#82e05a]/20 rounded-full flex items-center justify-center mb-5 border-[6px] border-[#82e05a]/10">
          <RotateCcw className="w-7 h-7 text-[#5da83f]" />
        </div>
        <h3 className="text-xl font-extrabold text-slate-800 mb-2">Emin misiniz?</h3>
        <p className="text-[13px] font-medium text-slate-500 mb-8 px-2 leading-relaxed">
          <strong className="text-slate-700 font-extrabold">{register.name}</strong> adlı kasanın bakiyesini <strong className="text-slate-700 font-extrabold">0.00₺</strong> olarak sıfırlamak üzeresiniz. Bu işlem verilerinizi silmez, sadece bakiyeyi eşitleyen bir düzeltme fişi oluşturur.
        </p>

        <div className="flex w-full gap-3">
          <Button variant="ghost" className="flex-1 hover:bg-slate-100 font-bold" onClick={onClose} disabled={loading}>
            Vazgeç
          </Button>
          <Button 
            className="flex-1 bg-[#5da83f] hover:bg-[#4b8a32] text-white font-bold border-none" 
            onClick={handleReset} 
            isLoading={loading}
          >
            Evet, Sıfırla
          </Button>
        </div>
      </div>
    </Modal>
  );
};
