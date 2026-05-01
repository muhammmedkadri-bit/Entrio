import React, { useState, useRef } from 'react';
import { Minus, Plus, Trash2, Package } from 'lucide-react';

const formatCurrency = (val) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val ?? 0);

export const CartItem = ({ item, onUpdateQty, onRemove, onUpdatePrice }) => {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const inputRef = useRef(null);

  const handleQtyChange = (e) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 0) {
      if (val === 0) onRemove(item.product.id);
      else onUpdateQty(item.product.id, val);
    }
  };

  const startEdit = () => {
    setInputVal(item.product.sale_price.toString());
    setEditing(true);
    // autoFocus input handle’s focus — setTimeout kaldırıldı
  };

  const commitEdit = () => {
    const val = parseFloat(inputVal);
    if (!isNaN(val) && val > 0) {
      onUpdatePrice && onUpdatePrice(item.product.id, val);
    }
    setEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') setEditing(false);
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-white border border-slate-200 rounded-xl hover:border-brand-300 transition-colors">
      {/* Product Info */}
      <div className="flex items-center gap-2 flex-1 min-w-0 mb-2 sm:mb-0 w-full">
        <Package className="w-4 h-4 text-brand-400 flex-shrink-0 self-center" />
        <div className="flex flex-col justify-center min-w-0">
          <h4 className="text-sm font-semibold text-slate-800 line-clamp-1">{item.product.name}</h4>
          <div className="text-xs text-slate-400 mt-0.5 font-mono">{item.product.barcode}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">

        {/* Qty pill — matches ProductCard style */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => {
              if (item.quantity > 1) onUpdateQty(item.product.id, item.quantity - 1);
              else onRemove(item.product.id);
            }}
            className="w-6 h-6 flex items-center justify-center rounded-l-md border border-gray-200 bg-white/60 hover:bg-white active:bg-gray-50 text-gray-500 hover:text-gray-700 transition-colors"
            style={{ backdropFilter: 'blur(4px)' }}
          >
            <Minus className="w-3 h-3" />
          </button>
          <input
            type="number"
            className="w-8 h-6 text-center text-xs font-semibold text-gray-700 border-y border-gray-200 bg-white/80 focus:outline-none focus:bg-white"
            value={item.quantity}
            onChange={handleQtyChange}
            min="0"
          />
          <button
            type="button"
            onClick={() => onUpdateQty(item.product.id, item.quantity + 1)}
            className="w-6 h-6 flex items-center justify-center rounded-r-md border border-gray-200 bg-white/60 hover:bg-white active:bg-gray-50 text-gray-500 hover:text-gray-700 transition-colors"
            style={{ backdropFilter: 'blur(4px)' }}
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        {/* Editable Line Total */}
        <div className="min-w-[5rem] text-right" title="Birim fiyatı değiştirmek için tıkla">
          {editing ? (
            <input
              ref={inputRef}
              type="number"
              value={inputVal}
              min="0"
              step="0.01"
              onChange={e => setInputVal(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleKeyDown}
              className="w-20 text-right text-sm font-bold text-brand-600 bg-transparent border-0 border-b-2 border-brand-500 focus:outline-none"
              autoFocus
            />
          ) : (
            <button
              onClick={startEdit}
              className="text-sm font-bold text-slate-800 border-0 border-b-2 border-transparent hover:border-brand-200 pb-px transition-colors cursor-text"
            >
              {formatCurrency(item.lineTotal)}
            </button>
          )}
        </div>

        {/* Delete */}
        <button
          onClick={() => onRemove(item.product.id)}
          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          title="Sil"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
