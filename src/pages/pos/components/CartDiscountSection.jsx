import React from 'react';
import { Tag } from 'lucide-react';
import { useCartStore } from '../../../store/cartStore';

export const CartDiscountSection = () => {
  const {
    discountEnabled, toggleDiscount,
    discountType, setDiscountType,
    discountValue, setDiscountValue,
    discountReason, setDiscountReason,
    calculateTotals
  } = useCartStore();

  const { subtotal, discountAmount } = calculateTotals();

  // Reset value when type changes, or handle conversion? Usually resetting is safer.
  const handleTypeToggle = (type) => {
    if (type !== discountType) {
      setDiscountType(type);
      setDiscountValue(0);
    }
  };

  const handleValueChange = (e) => {
    let val = parseFloat(e.target.value) || 0;
    if (val < 0) val = 0;
    
    if (discountType === 'percent' && val > 100) val = 100;
    if (discountType === 'amount' && val > subtotal) val = subtotal;

    setDiscountValue(val);
  };

  const fmt = (v) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(v);

  return (
    <div 
      className="border-t border-slate-200 transition-colors duration-200"
      style={{ backgroundColor: discountEnabled ? 'rgba(126,217,87,0.04)' : 'transparent' }}
    >
      <div className="p-3">
        {/* Header Row */}
        <div className="flex items-center justify-between cursor-pointer select-none" onClick={toggleDiscount}>
          <div className="flex items-center gap-2">
            <Tag className={`w-4 h-4 ${discountEnabled ? 'text-brand-500' : 'text-slate-400'}`} />
            <span className={`text-sm font-semibold ${discountEnabled ? 'text-brand-700' : 'text-slate-600'}`}>
              Sepet İskontosu
            </span>
          </div>
          {/* Toggle Switch */}
          <div className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-200 ease-in-out ${discountEnabled ? 'bg-brand-500' : 'bg-slate-300'}`}>
            <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-200 ease-in-out ${discountEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
          </div>
        </div>

        {/* Expanded Area */}
        {discountEnabled && (
          <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-3">
              {/* Pill Toggle */}
              <div className="flex p-0.5 bg-slate-100 rounded-lg border border-slate-200/60">
                <button
                  type="button"
                  onClick={() => handleTypeToggle('percent')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${discountType === 'percent' ? 'bg-brand-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeToggle('amount')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${discountType === 'amount' ? 'bg-brand-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  ₺
                </button>
              </div>

              {/* Input */}
              <div className="flex-1 flex items-baseline gap-2">
                <input
                  type="number"
                  min="0"
                  step={discountType === 'percent' ? "1" : "0.01"}
                  value={discountValue || ''}
                  onChange={handleValueChange}
                  placeholder="0"
                  className="w-full text-right font-bold text-lg border-b-2 border-brand-200 focus:border-brand-500 bg-transparent outline-none text-brand-700 placeholder-brand-200/50 transition-colors"
                  style={{ MozAppearance: 'textfield' }} // hide spinner in firefox
                />
              </div>
              
              {/* Calculated Display */}
              <div className="w-20 text-xs font-semibold text-slate-400 text-right">
                {discountType === 'percent' 
                  ? `= ${fmt(discountAmount)}` 
                  : `= %${subtotal > 0 ? ((discountValue/subtotal)*100).toFixed(1) : '0'}`
                }
              </div>
            </div>

            <input
              type="text"
              placeholder="İskonto Nedeni (opsiyonel)"
              value={discountReason}
              onChange={(e) => setDiscountReason(e.target.value)}
              className="w-full text-xs text-slate-600 placeholder-slate-400 bg-transparent border-b border-slate-200 focus:border-brand-400 outline-none pb-1 transition-colors"
            />
          </div>
        )}
      </div>
    </div>
  );
};
