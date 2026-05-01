import React, { useState } from 'react';
import { ShoppingCart, Package, Minus, Plus, CheckSquare, X, CheckCircle } from 'lucide-react';
import { BarcodeStripes } from './components/BarcodeStripes';
import { useCartStore } from '../../store/cartStore';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';

const glassAddBtnStyle = (disabled) => disabled ? {
  background: 'rgba(156,163,175,0.1)',
  border: '1px solid rgba(156,163,175,0.15)',
  color: 'rgba(156,163,175,0.6)',
  boxShadow: 'none',
  cursor: 'not-allowed',
  borderRadius: '8px',
  width: '100%',
  padding: '6px 0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '5px',
  fontSize: '13px',
  fontWeight: '600',
  marginTop: '4px',
  transition: 'all 0.15s ease',
} : {
  background: 'rgba(16,185,129,0.12)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  border: '1px solid rgba(16,185,129,0.25)',
  boxShadow: '0 2px 8px rgba(16,185,129,0.1), inset 0 1px 0 rgba(255,255,255,0.6)',
  borderRadius: '8px',
  color: 'rgb(4,120,87)',
  fontWeight: '600',
  fontSize: '13px',
  width: '100%',
  padding: '6px 0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '5px',
  cursor: 'pointer',
  transition: 'all 0.2s ease-in-out',
  marginTop: '4px',
};

const glassRemoveBtnStyle = {
  background: 'rgba(244,63,94,0.12)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  border: '1px solid rgba(244,63,94,0.25)',
  boxShadow: '0 2px 8px rgba(244,63,94,0.1), inset 0 1px 0 rgba(255,255,255,0.6)',
  borderRadius: '8px',
  color: 'rgb(225,29,72)',
  fontWeight: '600',
  fontSize: '13px',
  width: '100%',
  padding: '6px 0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '5px',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  marginTop: '4px',
};

const glassInCartBtnStyle = {
  background: 'rgba(59,130,246,0.10)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  border: '1px solid rgba(59,130,246,0.22)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
  borderRadius: '8px',
  color: 'rgb(37,99,235)',
  fontWeight: '600',
  fontSize: '13px',
  width: '100%',
  padding: '6px 0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '5px',
  pointerEvents: 'none',
  transition: 'all 0.2s ease-in-out',
  marginTop: '4px',
};

export const ProductCard = ({ product = {}, onAdd = () => {}, isSelected = false, onSelect = () => {}, onRemove = () => {}, isWiggleMode = false, index = 0 }) => {
  const [quantity, setQuantity] = useState(1);
  const [editingQty, setEditingQty] = useState(false);
  const [iconHovered, setIconHovered] = useState(false);
  const navigate = useNavigate();
  const { startNavigation } = useAppStore();

  // Check if product is in cart (using specific selector to avoid wide re-renders)
  const isInCart = useCartStore(state => state.items.some(item => item.product.id === product.id));

  const handleAdd = () => {
    if (!isInCart) {
      onAdd(product, quantity);
      setQuantity(1);
    }
  };

  const handleIconClick = (e) => {
    e.stopPropagation();
    if (onSelect) onSelect(product);
  };

  const formatCurrency = (val) =>
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val || 0);

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

  // Formatting Product Name: 5 words line 1, 4 words line 2 + partial 5th word
  const getFormattedName = (name) => {
    if (!name) return { line1: 'Bilinmeyen Ürün', line2: '' };
    const words = name.trim().split(/\s+/);
    if (words.length <= 5) return { line1: words.join(' '), line2: '' };
    
    const line1 = words.slice(0, 5).join(' ');
    const line2Words = words.slice(5);
    
    if (line2Words.length <= 4) {
      return { line1, line2: line2Words.join(' ') };
    }
    
    const line2Start = line2Words.slice(0, 4).join(' ');
    const line2TruncatedWord = line2Words[4].substring(0, 4) + '...';
    
    return { line1, line2: `${line2Start} ${line2TruncatedWord}` };
  };

  const formattedName = getFormattedName(product?.name);

  return (
    <div
      className="p-3 bg-white border rounded-xl flex flex-col transition-[border-color,box-shadow] duration-150 cursor-default"
      style={{
        borderColor: isSelected ? 'rgba(244,63,94,0.5)' : 'rgb(229,231,235)',
        boxShadow: isSelected
          ? '0 0 0 2px rgba(244,63,94,0.15), 0 4px 12px rgba(244,63,94,0.1)'
          : undefined,
      }}
    >
      {/* Top Row: Icon & Barcode (Centered) */}
      <div className="flex items-center justify-center gap-3 w-full mb-1 grayscale-0">
        <button
          onClick={handleIconClick}
          onMouseEnter={() => setIconHovered(true)}
          onMouseLeave={() => setIconHovered(false)}
          title={isSelected ? 'Seçimi kaldır' : 'Listeden kaldırmak için seç'}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 focus:outline-none hover:scale-110 shadow-sm flex-shrink-0 
            ${isSelected ? 'bg-rose-50 border-1.5 border-rose-300 shadow-rose-100' : 'bg-brand-50 border-1.5 border-transparent hover:border-brand-200 hover:bg-brand-100/50'}
          `}
        >
          {isSelected ? (
            <CheckSquare className="w-5 h-5 text-rose-500" strokeWidth={2.5} />
          ) : (
            <Package className={`w-5 h-5 transition-colors duration-200 ${iconHovered ? 'text-brand-500' : 'text-brand-400'}`} />
          )}
        </button>

        <div 
          className="h-9 px-3 rounded-lg flex items-center justify-center transition-all bg-white/40 border border-black/5 backdrop-blur-[4px] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
          style={{ background: 'rgba(255, 255, 255, 0.45)' }}
        >
          <div className="scale-[0.85] origin-center -my-1">
            <BarcodeStripes value={product?.barcode || ''} color="#000000" />
          </div>
        </div>
      </div>

      {/* Name Area — fixed height to prevent card expansion */}
      <div 
        className="flex flex-col items-center justify-center my-1 h-[2.5rem] overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          startNavigation();
          navigate(`/stock/product/${product.id}`);
        }}
      >
        <h3 className="text-sm font-semibold text-gray-800 text-center leading-tight m-0 line-clamp-2 px-1 hover:text-brand-600 transition-colors">
          {product?.name || 'Bilinmeyen Ürün'}
        </h3>
      </div>

      {/* Price */}
      <p className="text-base font-bold text-brand-600 mt-1 mb-1 text-center truncate">
        {formatCurrency(product?.sale_price || 0)}
      </p>

      {/* Stock Pill Row */}
      <div className="flex justify-center mb-2">
        <span
          className="text-[10px] font-bold px-2.5 py-1 rounded-md flex items-center justify-center whitespace-nowrap shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
          style={{
            background: stockStyle.bg,
            color: stockStyle.text,
            border: `1px solid ${stockStyle.border}`,
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
        >
          {stockStyle.label}
        </span>
      </div>

      {/* Bottom Block */}
      <div className="mt-auto flex flex-col justify-end">
        {isSelected ? (
          <div className="animate-in fade-in duration-200">
            {/* Same exact margin & height as Qty pill to prevent jumping */}
            <div className="flex items-center justify-center mt-2 mb-1 pointer-events-none opacity-0 h-8">
              <div className="w-6 h-6" />
            </div>
            
            <button
              onClick={(e) => { e.stopPropagation(); if (onRemove) onRemove(); }}
              style={glassRemoveBtnStyle}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(244,63,94,0.18)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'rgba(244,63,94,0.12)'}
            >
              <X className="w-3.5 h-3.5" strokeWidth={3} />
              Listeden Kaldır
            </button>
          </div>
        ) : (
          <div>
            {/* Qty Row */}
            {!isInCart ? (
              <div className="flex items-stretch justify-center mt-2 mb-1 h-8">
                 <div className="flex items-stretch justify-center shadow-[0_1px_2px_rgba(0,0,0,0.03)] rounded-[6px] h-full w-full max-w-[140px]">
                   <button
                     onClick={() => setQuantity(q => Math.max(1, q - 1))}
                     disabled={quantity <= 1}
                     className="w-7 flex items-center justify-center rounded-l-[6px] border border-gray-200 bg-white/60 hover:bg-gray-100 active:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-40"
                   >
                     <Minus className="w-3 h-3" strokeWidth={2.5} />
                   </button>
                   {editingQty ? (
                     <input
                       type="number"
                       autoFocus
                       value={quantity}
                       onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 1) setQuantity(v); }}
                       onBlur={() => setEditingQty(false)}
                       onKeyDown={e => { if (e.key === 'Enter') setEditingQty(false); }}
                       className="w-full h-full min-w-[30px] border-y border-gray-200 bg-white/80 text-center text-xs font-bold text-gray-700 outline-none flex-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                     />
                   ) : (
                     <div
                       onClick={() => setEditingQty(true)}
                       className="w-full h-full min-w-[30px] border-y border-gray-200 bg-white/80 flex items-center justify-center text-xs font-bold text-gray-700 select-none cursor-text flex-1 transition-colors hover:bg-gray-50"
                     >
                       {quantity}
                     </div>
                   )}
                   <button
                     onClick={() => setQuantity(q => q + 1)}
                     className="w-7 flex items-center justify-center rounded-r-[6px] border border-gray-200 bg-white/60 hover:bg-gray-100 active:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
                   >
                     <Plus className="w-3 h-3" strokeWidth={2.5} />
                   </button>
                 </div>
               </div>
            ) : (
              <div className="flex items-stretch justify-center mt-2 mb-1 h-8 opacity-0 pointer-events-none">
                 <div className="h-full w-full max-w-[140px]" />
              </div>
            )}

            {/* Add Button / In Cart Button */}
            <button 
              onClick={isInCart ? undefined : handleAdd} 
              style={isInCart ? glassInCartBtnStyle : glassAddBtnStyle(false)}
            >
              {isInCart ? (
                <><CheckCircle className="w-3.5 h-3.5" /> Sepette</>
              ) : (
                <><ShoppingCart className="w-3.5 h-3.5" /> Sepete Ekle</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
