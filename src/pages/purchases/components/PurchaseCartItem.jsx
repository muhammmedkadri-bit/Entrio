import React from 'react';
import { Trash2 } from 'lucide-react';

export const PurchaseCartItem = ({ item, onUpdate, onRemove }) => {
  const formatCurrency = (val) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);

  return (
    <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-sm transition-all hover:border-brand-200">
      
      {/* Product Info */}
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-slate-800 text-sm truncate">{item.name}</h4>
        <div className="text-xs text-slate-400 font-mono mt-0.5">{item.barcode}</div>
      </div>
      
      {/* Quantity Editor */}
      <div className="flex flex-col items-center">
        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mb-0.5">Miktar</span>
        <div className="flex items-center">
          <input 
            type="number" 
            min="0.001" 
            step="0.001"
            className="w-16 h-8 text-center text-sm font-bold border-0 bg-slate-100 rounded focus:ring-2 focus:ring-brand-500 appearance-none"
            value={item.quantity}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0;
              onUpdate(item.id, { quantity: val, line_total: val * item.unit_price });
            }}
          />
        </div>
      </div>

      {/* Unit Price Editor */}
      <div className="flex flex-col items-center">
        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mb-0.5">A. Fiyatı</span>
        <div className="flex items-center">
          <input 
            type="number" 
            min="0.01" 
            step="0.01"
            className="w-20 h-8 text-center text-sm font-bold text-brand-700 border border-slate-200 rounded focus:ring-2 focus:ring-brand-500"
            value={item.unit_price}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0;
              onUpdate(item.id, { unit_price: val, line_total: val * item.quantity });
            }}
          />
        </div>
      </div>

      {/* Line Total & Action */}
      <div className="w-24 text-right flex flex-col justify-center">
        <span className="font-bold text-slate-800">{formatCurrency(item.line_total)}</span>
      </div>
      
      <button 
        onClick={() => onRemove(item.id)}
        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
        title="Listeden Çıkar"
      >
        <Trash2 className="w-4 h-4" />
      </button>

    </div>
  );
};
