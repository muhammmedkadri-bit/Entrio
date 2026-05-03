import React, { useState, useEffect, useRef } from 'react';
import { Package, ShoppingCart, Minus, Plus } from 'lucide-react';
import { BarcodeStripes } from './BarcodeStripes';

const glassAddBtn = {
  background: 'rgba(16,185,129,0.12)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  border: '1px solid rgba(16,185,129,0.25)',
  boxShadow: '0 2px 8px rgba(16,185,129,0.12), inset 0 1px 0 rgba(255,255,255,0.6)',
  borderRadius: '8px',
  color: 'rgb(4,120,87)',
  fontSize: '12px',
  fontWeight: '500',
  padding: '6px 10px',
  whiteSpace: 'nowrap',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
};

function DropdownRow({ product, onAdd, isHighlighted, rowRef }) {
  const [qty, setQty] = useState(1);
  const formatCurrency = (v) =>
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(v || 0);

  const rawStock = product?.stock_quantity;
  const hasNoTracking = rawStock === null || rawStock === undefined || product?.is_tracking_stock === false || product?.track_stock === false;
  const stock = rawStock || 0;
  
  let stockStyle = { bg: 'rgba(16,185,129,0.12)', text: '#059669', border: 'rgba(16,185,129,0.25)', label: `Stok: ${stock}` };
  if (hasNoTracking) {
    stockStyle = { bg: 'rgba(156,163,175,0.12)', text: '#4b5563', border: 'rgba(156,163,175,0.25)', label: 'Stok: Takipsiz' };
  } else if (stock <= 0) {
    stockStyle = { bg: 'rgba(244,63,94,0.12)', text: '#e11d48', border: 'rgba(244,63,94,0.25)', label: `Stok: ${stock}` };
  } else if (stock <= 5) {
    stockStyle = { bg: 'rgba(249,115,22,0.12)', text: '#c2410c', border: 'rgba(249,115,22,0.25)', label: `Stok: ${stock}` };
  }

  return (
    <div
      ref={rowRef}
      className={`flex items-center justify-between px-3 py-2 transition-colors cursor-pointer ${isHighlighted ? 'bg-brand-50/50' : 'hover:bg-white/60'}`}
      onClick={() => { onAdd(product, 1); }}
    >
      {/* Left */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div 
          className="h-9 px-3 rounded-lg flex items-center justify-center transition-all bg-white/40 border border-black/5 backdrop-blur-[4px] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] flex-shrink-0"
          style={{ background: 'rgba(255, 255, 255, 0.45)' }}
        >
          <Package className="w-5 h-5 text-gray-400" />
        </div>
        
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-gray-800 line-clamp-1">{product.name}</div>
        </div>
        
        {/* Price Pill */}
        <span className="text-sm font-black text-brand-700 bg-brand-50 px-2.5 py-1 rounded-lg border border-brand-100 flex-shrink-0 whitespace-nowrap shadow-sm">
          {formatCurrency(product.sale_price)}
        </span>

        {/* Stock Pill */}
        <span
          className="text-[10px] font-bold px-2.5 py-1 rounded-md flex items-center justify-center whitespace-nowrap shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex-shrink-0"
          style={{
            background: stockStyle.bg,
            color: stockStyle.text,
            border: `1px solid ${stockStyle.border}`,
          }}
        >
          {stockStyle.label}
        </span>
      </div>

      {/* Right: qty + add */}
      <div className="flex items-center gap-2 flex-shrink-0 ml-4" onClick={e => e.stopPropagation()}>
        {/* Qty pill */}
        <div className="flex items-stretch h-[32px] rounded-lg shadow-sm">
          <button
            onClick={() => setQty(q => Math.max(1, q - 1))}
            className="w-8 flex items-center justify-center rounded-l-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-500 transition-colors"
          >
            <Minus className="w-3 h-3" />
          </button>
          <div className="w-10 border-y border-gray-200 bg-white flex items-center justify-center text-sm font-bold text-gray-700 select-none">
            {qty}
          </div>
          <button
            onClick={() => setQty(q => q + 1)}
            className="w-8 flex items-center justify-center rounded-r-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-500 transition-colors"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        {/* Add btn */}
        <button
          style={glassAddBtn}
          onClick={() => onAdd(product, qty)}
        >
          <ShoppingCart className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export const ProductSearchDropdown = ({ query, results, onAdd, onClose }) => {
  const [highlighted, setHighlighted] = useState(0);
  const dropdownRef = useRef(null);
  const rowRefs = useRef([]);

  // Keyboard nav
  useEffect(() => {
    const handler = (e) => {
      if (!results.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlighted(h => Math.min(h + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlighted(h => Math.max(h - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onAdd(results[highlighted], 1);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [results, highlighted, onAdd, onClose]);

  useEffect(() => { setHighlighted(0); }, [query]);

  if (!query || results.length === 0) {
    if (!query) return null;
    return (
      <div
        onMouseDown={(e) => e.preventDefault()}
        style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
          background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.6)',
          boxShadow: '0 16px 40px rgba(0,0,0,0.12)',
          borderRadius: '12px', overflow: 'hidden',
        }}
      >
        <div className="px-4 py-6 text-center text-sm text-gray-400 font-medium">Ürün bulunamadı</div>
      </div>
    );
  }

  return (
    <div
      ref={dropdownRef}
      onMouseDown={(e) => e.preventDefault()}
      style={{
        position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.6)',
        boxShadow: '0 16px 40px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.08)',
        borderRadius: '12px', overflow: 'hidden', maxHeight: '360px', overflowY: 'auto',
      }}
    >
      <div className="px-4 py-2 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between backdrop-blur-md sticky top-0 z-10">
        <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Ürün Önerileri</span>
        <span className="text-[10px] text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full font-bold">{results.length} Sonuç</span>
      </div>
      <div className="divide-y divide-gray-100/60">
        {results.map((p, i) => (
          <DropdownRow
            key={p.id}
            product={p}
            isHighlighted={i === highlighted}
            rowRef={el => rowRefs.current[i] = el}
            onAdd={(prod, qty) => {
              onAdd(prod, qty);
              onClose();
            }}
          />
        ))}
      </div>
    </div>
  );
};
