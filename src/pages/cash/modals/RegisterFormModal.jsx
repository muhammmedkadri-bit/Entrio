import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import toast from '../../../components/ui/CustomToast';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { cashService } from '../../../services/cashService';

export const RegisterFormModal = ({ isOpen, onClose, registerToEdit, onSaved }) => {
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: { opening_balance: 0 }
  });

  useEffect(() => {
    if (isOpen) {
      if (registerToEdit) {
        reset(registerToEdit);
      } else {
        reset({ name: '', opening_balance: 0 });
      }
    }
  }, [isOpen, registerToEdit, reset]);

  const onSubmit = async (data) => {
    try {
      if (registerToEdit) {
        // we won't implement cash register update here according to simple plan, but just in case
        // await cashService.updateRegister(registerToEdit.id, data);
        toast.error('Kasalar şu an güncellenemez. Lütfen yeni kasa açın.');
      } else {
        await cashService.createRegister(data);
        toast.success('Yeni kasa oluşturuldu.');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Kasa kaydedilemedi.');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={registerToEdit ? 'Kasayı Düzenle' : 'Yeni Kasa Ekle'} size="sm">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        
        <Input label="Kasa Adı" {...register('name', { required: 'Kasa adı zorunludur' })} error={errors.name?.message} autoFocus placeholder="Örn: Ön Kasa 2" />

        {!registerToEdit && (
          <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200/50">
            <Input 
              label="Hazır Para / İlk Kurulum Nakdi (₺)" 
              type="number" 
              step="0.01" 
              {...register('opening_balance')} 
              hint="Kasa ilk kullanıma açılırken içine fiziki olarak başlattığınız tutardır."
            />
          </div>
        )}

        <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
          <Button variant="ghost" type="button" onClick={onClose}>İptal</Button>
          <Button type="submit">Kasayı Kaydet</Button>
        </div>
      </form>
    </Modal>
  );
};
