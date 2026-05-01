import React, { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { X, Building2, Phone, Hash, DollarSign, Save } from 'lucide-react';
import { supplierService } from '../../../services/supplierService';
import toast from 'react-hot-toast';

const inputClass =
  'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 outline-none bg-white placeholder-gray-400 transition-colors';

export const QuickCreateSupplierModal = ({ isOpen, onClose, onCreated }) => {
  const firstInputRef = useRef(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { name: '', phone: '', tax_number: '', opening_balance: '' },
  });

  useEffect(() => {
    if (isOpen) {
      reset();
      setTimeout(() => firstInputRef.current?.focus(), 80);
    }
  }, [isOpen, reset]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const onSubmit = async (data) => {
    try {
      const newSupplier = await supplierService.create({
        name:            data.name.trim(),
        phone:           data.phone.trim() || null,
        tax_number:      data.tax_number.trim() || null,
        opening_balance: parseFloat(data.opening_balance) || 0,
        is_active:       true,
      });
      toast.success(`"${newSupplier.name}" tedarikçi olarak eklendi`);
      onCreated(newSupplier);
      onClose();
    } catch (err) {
      console.error('[QuickCreateSupplier] Tedarikçi Ekleme Hatası:', err);
      toast.error('Tedarikçi eklenirken hata oluştu: ' + (err?.message || 'Bilinmeyen hata'));
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm mx-4 rounded-2xl overflow-hidden"
        style={{
          background: 'white',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.08)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b border-gray-100"
          style={{ background: 'linear-gradient(135deg, #f0fdf4, #ffffff)' }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-indigo-500" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Hızlı Tedarikçi Oluştur</h2>
              <p className="text-[10px] text-gray-400">Yeni tedarikçi ekle ve seç</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="px-5 py-4 space-y-3">
          {/* Supplier Name */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Tedarikçi Adı <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300 pointer-events-none" />
              <input
                {...register('name', { required: 'Tedarikçi adı zorunlu' })}
                ref={(el) => {
                  register('name').ref(el);
                  firstInputRef.current = el;
                }}
                type="text"
                placeholder="Tedarikçi adı veya ticaret unvanı"
                className={`${inputClass} pl-9 ${errors.name ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''}`}
              />
            </div>
            {errors.name && (
              <p className="text-[10px] text-red-500 mt-0.5">{errors.name.message}</p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Telefon
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300 pointer-events-none" />
              <input
                {...register('phone')}
                type="tel"
                placeholder="0 (5xx) xxx xx xx"
                className={`${inputClass} pl-9`}
              />
            </div>
          </div>

          {/* Tax Number */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Vergi No
            </label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300 pointer-events-none" />
              <input
                {...register('tax_number')}
                type="text"
                placeholder="Vergi kimlik numarası"
                className={`${inputClass} pl-9 font-mono`}
              />
            </div>
          </div>

          {/* Opening Balance */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Açılış Bakiyesi (₺)
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300 pointer-events-none" />
              <input
                {...register('opening_balance')}
                type="number"
                min="0"
                step="0.01"
                placeholder="Mevcut borcunuz varsa girin"
                className={`${inputClass} pl-9`}
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Bu tedarikçiye önceden borcunuz varsa girin
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 text-sm font-medium py-2 rounded-lg transition-colors"
              style={{
                background: 'rgba(239,68,68,0.07)',
                border: '1px solid rgba(239,68,68,0.18)',
                color: 'rgb(185,28,28)',
              }}
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold py-2 rounded-lg transition-all disabled:opacity-60"
              style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.92), rgba(79,70,229,0.96))',
                border: '1px solid rgba(129,140,248,0.35)',
                boxShadow: '0 4px 12px rgba(99,102,241,0.25)',
                color: 'white',
              }}
            >
              <Save className="w-3.5 h-3.5" />
              {isSubmitting ? 'Kaydediliyor...' : 'Kaydet ve Seç'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
