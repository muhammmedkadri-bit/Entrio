import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Phone, CreditCard, ChevronDown } from 'lucide-react';
import { SupplierSearchModal } from '../modals/SupplierSearchModal';

const fmt = (v) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(v || 0);

const PAYMENT_METHODS = [
  { value: 'cash',          label: 'Peşin / Nakden Ödendi' },
  { value: 'bank_transfer', label: 'Havale / EFT' },
  { value: 'credit_card',   label: 'Kredi Kartı / Mail Order' },
  { value: 'check',         label: 'Çek' },
  { value: 'on_credit',     label: 'Vadeli / Veresiye' },
];

export const SupplierSelectCard = ({
  supplier,
  onSupplierChange,
  paymentMethod,
  onPaymentMethodChange,
  paidAmount,
  onPaidAmountChange,
  grandTotal,
  readOnly = false,
  minimal = false,
  children,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm h-full flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#5da83f]" />
            <p className="text-sm font-semibold text-gray-700">Tedarikçi</p>
          </div>
          {!readOnly && supplier && (
            <button
              onClick={() => setModalOpen(true)}
              className="text-xs text-gray-400 hover:text-gray-600 font-medium transition-colors"
            >
              Değiştir
            </button>
          )}
        </div>
        
        <div className="h-px w-full bg-[#82e05a]/20 rounded-full mb-4"></div>

        {!supplier ? (
          <div className="flex flex-col items-center gap-2 py-5">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-gray-300" />
            </div>
            <p className="text-sm text-gray-400">Tedarikçi seçilmedi</p>
            {!readOnly && (
              <button
                onClick={() => setModalOpen(true)}
                className="mt-1 px-4 py-1.5 rounded-lg border border-purple-200 text-purple-600 text-xs font-semibold hover:bg-purple-50 transition-colors"
              >
                Tedarikçi Seç (F3)
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#82e05a]/15 flex items-center justify-center shrink-0 border border-[#82e05a]/30">
              <Building2 className="w-5 h-5 text-[#5da83f]" />
            </div>
            <div className="flex-1 min-w-0">
              <p 
                className="font-semibold text-gray-800 text-sm truncate hover:text-[#5da83f] cursor-pointer transition-colors"
                onClick={() => navigate(`/suppliers/${supplier.id}`)}
              >
                {supplier.name}
              </p>
              {supplier.phone && (
                <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                  <Phone className="w-3 h-3" /> {supplier.phone}
                </p>
              )}
              {supplier.balance !== undefined && (
                <p className={`text-xs font-semibold mt-1 ${supplier.balance > 0 ? 'text-red-500' : supplier.balance < 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                  Bakiye: {fmt(supplier.balance)}
                  {supplier.balance > 0 && ' (Borçlu)'}
                  {supplier.balance < 0 && ' (Alacaklı)'}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Payment Method */}
        {!minimal && (
          <>
            <div className="mt-4 pt-3 border-t border-gray-100">
          <label className="block text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1">
            <CreditCard className="w-3.5 h-3.5" /> Ödeme Yöntemi
          </label>
          {readOnly ? (
            <p className="text-sm font-medium text-gray-700">
              {PAYMENT_METHODS.find(m => m.value === paymentMethod)?.label || paymentMethod}
            </p>
          ) : (
            <div className="relative">
              <select
                value={paymentMethod}
                onChange={e => onPaymentMethodChange(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 pr-8 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100 outline-none appearance-none bg-white"
              >
                {PAYMENT_METHODS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          )}
        </div>

        {/* Paid Amount (hidden in on_credit) */}
        {paymentMethod !== 'on_credit' && (
          <div className="mt-3">
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
              Ödenen Tutar (₺)
            </label>
            {readOnly ? (
              <p className="text-sm font-semibold text-emerald-600">{fmt(paidAmount)}</p>
            ) : (
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₺</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  max={grandTotal}
                  value={paidAmount}
                  onChange={e => onPaidAmountChange(Math.min(parseFloat(e.target.value) || 0, grandTotal))}
                  className="w-full pl-7 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            )}
            <p className="text-[10px] text-gray-400 mt-0.5">Kısmi ödeme için düzenleyebilirsiniz</p>
          </div>
        )}
          </>
        )}
        
        {children && (
          <div className="mt-4 pt-3 border-t border-gray-100 empty:hidden">
            {children}
          </div>
        )}
      </div>

      <SupplierSearchModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSelect={(s) => { onSupplierChange(s); setModalOpen(false); }}
      />
    </>
  );
};
