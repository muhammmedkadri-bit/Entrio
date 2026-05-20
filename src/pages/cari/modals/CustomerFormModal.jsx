import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from '../../../components/ui/CustomToast';
import { X, Save, Users, Hash, Phone, CircleDollarSign, MapPin, FileText } from 'lucide-react';
import { customerService } from '../../../services/customerService';

export const CustomerFormModal = ({ isOpen, onClose, customerToEdit, onSaved }) => {
  const [loading, setLoading] = useState(false);

  // default type is 'retail' since we removed it from the UI but backend might still need it.
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: { customer_type: 'retail', opening_balance: 0 }
  });

  useEffect(() => {
    if (isOpen) {
      if (customerToEdit) {
        reset(customerToEdit);
      } else {
        // Keep retail as default behind the scenes
        reset({ name: '', customer_type: 'retail', phone: '', opening_balance: 0 });
      }
    }
  }, [isOpen, customerToEdit, reset]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      if (customerToEdit) {
        await customerService.update(customerToEdit.id, data);
        toast.success('Müşteri güncellendi.');
      } else {
        await customerService.create(data);
        toast.success('Yeni müşteri eklendi.');
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error('[CustomerForm] Kayıt Hatası:', err);
      toast.error(err?.message || 'Müşteri kaydedilemedi.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const inputCls = "w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400 transition-all";
  const labelCls = "flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-white/10 transition-opacity backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div
        className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-white flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-50 border border-emerald-100">
              <Users className="w-4 h-4 text-emerald-500" />
            </div>
            <h2 className="text-base font-bold text-slate-900">
              {customerToEdit ? 'Müşteriyi Düzenle' : 'Yeni Müşteri Ekle'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

            {/* Müşteri Adı */}
            <div>
              <label className={labelCls}><Hash className="w-4 h-4 text-slate-400" /> Adı / Unvanı <span className="text-rose-500">*</span></label>
              <input
                autoFocus
                type="text"
                {...register('name', { required: 'Ad zorunludur' })}
                className={`${inputCls} ${errors.name ? '!border-rose-400 !ring-rose-400/50' : ''}`}
                placeholder="Örn: Ahmet Yılmaz"
              />
              {errors.name && <p className="text-xs text-rose-500 mt-1">{errors.name.message}</p>}
            </div>

            {/* Telefon */}
            <div>
              <label className={labelCls}><Phone className="w-4 h-4 text-slate-400" /> Telefon</label>
              <input
                type="tel"
                {...register('phone')}
                className={inputCls}
                placeholder="Örn: 0555 555 5555"
              />
            </div>

            {/* Vergi No */}
            <div>
              <label className={labelCls}><FileText className="w-4 h-4 text-slate-400" /> Vergi Numarası / TC Kimlik</label>
              <input type="text" {...register('tax_number')} className={inputCls} placeholder="Örn: 1234567890" />
            </div>

            {/* İl / İlçe */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}><MapPin className="w-4 h-4 text-slate-400" /> İl</label>
                <input type="text" {...register('city')} className={inputCls} placeholder="Örn: İstanbul" />
              </div>
              <div>
                <label className={labelCls}><MapPin className="w-4 h-4 text-slate-400" /> İlçe</label>
                <input type="text" {...register('district')} className={inputCls} placeholder="Örn: Kadıköy" />
              </div>
            </div>

            {/* Adres */}
            <div>
              <label className={labelCls}><MapPin className="w-4 h-4 text-slate-400" /> Açık Adres</label>
              <textarea {...register('address')} rows="2" className={`${inputCls} resize-none`} placeholder="Tam adres bilgisi" />
            </div>

            {/* Açılış Bakiyesi */}
            {!customerToEdit && (
              <div>
                <label className={labelCls}><CircleDollarSign className="w-4 h-4 text-slate-400" /> Açılış Bakiyesi (Bize Borçlu) ₺</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm select-none">₺</span>
                  <input
                    type="number"
                    step="0.01"
                    {...register('opening_balance')}
                    className={`${inputCls} pl-7 font-bold tabular-nums`}
                    placeholder="0.00"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1.5 leading-snug">
                  Eğer müşterinin geçmişten gelen ve şu an size ödemesi gereken bir borcu varsa ekleyebilirsiniz.
                </p>
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="flex-shrink-0 px-5 py-4 pb-16 sm:pb-4 border-t border-slate-200 bg-slate-50 flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 shadow-sm active:scale-95 transition-all"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 shadow-sm active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4 shrink-0" />
              {loading ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
