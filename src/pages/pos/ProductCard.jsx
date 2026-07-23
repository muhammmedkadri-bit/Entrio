import React, { useState, memo } from 'react';
import { ShoppingCart, Package, Minus, Plus, CheckSquare, X, CheckCircle } from 'lucide-react';
import { BarcodeStripes } from './components/BarcodeStripes';
import { useCartStore } from '../../store/cartStore';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';

const getAddBtnClass = (disabled) => disabled
  ? "w-full py-1.5 flex items-center justify-center gap-1.5 text-[13px] font-semibold rounded-lg mt-1 bg-gray-400/10 dark:bg-slate-700/50 border border-gray-400/15 dark:border-slate-600 text-gray-500 dark:text-slate-500 cursor-not-allowed transition-all"
  : "w-full py-1.5 flex items-center justify-center gap-1.5 text-[13px] font-semibold rounded-lg mt-1 bg-brand-500/10 dark:bg-brand-500/15 backdrop-blur-sm border border-brand-500/25 dark:border-brand-500/30 text-brand-700 dark:text-brand-400 shadow-[0_2px_8px_rgba(101,196,61,0.1),inset_0_1px_0_rgba(255,255,255,0.6)] dark:shadow-none cursor-pointer transition-all hover:bg-brand-500/20 dark:hover:bg-brand-500/25";

const removeBtnClass = "w-full py-1.5 flex items-center justify-center gap-1.5 text-[13px] font-semibold rounded-lg mt-1 bg-rose-500/10 dark:bg-rose-500/15 backdrop-blur-sm border border-rose-500/25 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 shadow-[0_2px_8px_rgba(244,63,94,0.1),inset_0_1px_0_rgba(255,255,255,0.6)] dark:shadow-none cursor-pointer transition-all hover:bg-rose-500/20 dark:hover:bg-rose-500/25";

const inCartBtnClass = "w-full py-1.5 flex items-center justify-center gap-1.5 text-[13px] font-semibold rounded-lg mt-1 bg-blue-500/10 dark:bg-blue-500/15 backdrop-blur-sm border border-blue-500/22 dark:border-blue-500/30 text-blue-600 dark:text-blue-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:shadow-none cursor-default transition-all pointer-events-none";

const ProductCardInner = ({ product = {}, onAdd = () => {}, isSelected = false, onSelect = () => {}, onRemove = () => {}, isWiggleMode = false, index = 0, posMode = 'sale' }) => {
  const [quantity, setQuantity] = useState(1);
  const [editingQty, setEditingQty] = useState(false);
  const [iconHovered, setIconHovered] = useState(false);
  const navigate = useNavigate();
  const { startNavigation } = useAppStore();

  const isInCart = useCartStore(state => state.items.some(item => item.product.id === product.id));
  const isReturnMode = posMode === 'return';

  const handleAdd = () => {
    if (!isInCart && !isReturnMode) {
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
  
  let stockClass = "bg-brand-500/10 dark:bg-brand-500/15 text-brand-700 dark:text-brand-400 border-brand-500/25 dark:border-brand-500/30";
  let stockLabel = `Stok: ${stock}`;
  if (hasNoTracking) {
    stockClass = "bg-slate-500/10 dark:bg-slate-400/10 text-slate-600 dark:text-slate-400 border-slate-500/25 dark:border-slate-500/30";
    stockLabel = 'Stok: Takipsiz';
  } else if (stock <= 0) {
    stockClass = "bg-rose-500/10 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/25 dark:border-rose-500/30";
  } else if (stock <= 5) {
    stockClass = "bg-orange-500/10 dark:bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/25 dark:border-orange-500/30";
  }

  const getFormattedName = (name) => {
    if (!name) return { line1: 'Bilinmeyen Ürün', line2: '' };
    const words = name.trim().split(/\s+/);
    if (words.length <= 5) return { line1: words.join(' '), line2: '' };
    const line1 = words.slice(0, 5).join(' ');
    const line2Words = words.slice(5);
    if (line2Words.length <= 4) return { line1, line2: line2Words.join(' ') };
    return { line1, line2: `${line2Words.slice(0, 4).join(' ')} ${line2Words[4].substring(0, 4)}...` };
  };

  const formattedName = getFormattedName(product?.name);

  return (
    <div
      className={`p-3 bg-white dark:bg-slate-800/90 border rounded-xl flex flex-col transition-[border-color,box-shadow,background-color] duration-150 cursor-default ${isSelected ? 'border-rose-400 dark:border-rose-500/50 shadow-[0_0_0_2px_rgba(244,63,94,0.15),0_4px_12px_rgba(244,63,94,0.1)] dark:shadow-[0_0_0_2px_rgba(244,63,94,0.25)]' : 'border-slate-200 dark:border-slate-700/60'}`}
    >
      {/* Top Row: Icon & Barcode (Centered) */}
      <div className="flex items-center justify-center gap-3 w-full mb-1 grayscale-0">
        <button
          onClick={handleIconClick}
          onMouseEnter={() => setIconHovered(true)}
          onMouseLeave={() => setIconHovered(false)}
          title={isSelected ? 'Seçimi kaldır' : 'Listeden kaldırmak için seç'}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 focus:outline-none hover:scale-110 shadow-sm flex-shrink-0 
            ${isSelected ? 'bg-rose-50 dark:bg-rose-500/10 border-1.5 border-rose-300 dark:border-rose-500/30 shadow-rose-100 dark:shadow-none' : 'bg-brand-50 dark:bg-slate-700/50 border-1.5 border-transparent hover:border-brand-200 dark:hover:border-slate-500 hover:bg-brand-100/50 dark:hover:bg-slate-700'}
          `}
        >
          {isSelected ? (
            <CheckSquare className="w-5 h-5 text-rose-500 dark:text-rose-400" strokeWidth={2.5} />
          ) : (
            <Package className={`w-5 h-5 transition-colors duration-200 ${iconHovered ? 'text-brand-500 dark:text-slate-300' : 'text-brand-400 dark:text-slate-400'}`} />
          )}
        </button>

        <div 
          className="h-9 px-3 rounded-lg flex items-center justify-center transition-all bg-white/40 dark:bg-white border border-black/5 dark:border-transparent backdrop-blur-[4px] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:shadow-none"
        >
          <div className="scale-[0.85] origin-center -my-1">
            <BarcodeStripes value={product?.barcode || ''} color="#000000" />
          </div>
        </div>
      </div>

      {/* Name Area */}
      <div 
        className="flex flex-col items-center justify-center my-1 h-[2.5rem] overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          startNavigation();
          navigate(`/stock/product/${product.id}`);
        }}
      >
        <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-200 text-center leading-tight m-0 line-clamp-2 px-1 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
          {product?.name || 'Bilinmeyen Ürün'}
        </h3>
      </div>

      {/* Price */}
      <p className="text-base font-bold text-brand-600 dark:text-brand-400 mt-1 mb-1 text-center truncate">
        {formatCurrency(product?.sale_price || 0)}
      </p>

      {/* Stock Pill Row */}
      <div className="flex justify-center mb-2">
        <span
          className={`text-[10px] font-bold px-2.5 py-1 rounded-md flex items-center justify-center whitespace-nowrap shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-none border backdrop-blur-sm ${stockClass}`}
        >
          {stockLabel}
        </span>
      </div>

      {/* Bottom Block */}
      <div className="mt-auto flex flex-col justify-end">
        {isSelected ? (
          <div className="animate-in fade-in duration-200">
            <div className="flex items-center justify-center mt-2 mb-1 pointer-events-none opacity-0 h-8">
              <div className="w-6 h-6" />
            </div>
            
            <button
              onClick={(e) => { e.stopPropagation(); if (onRemove) onRemove(); }}
              className={removeBtnClass}
            >
              <X className="w-3.5 h-3.5" strokeWidth={3} />
              Listeden Kaldır
            </button>
          </div>
        ) : (
          <div>
            {!isInCart ? (
              <div className="flex items-stretch justify-center mt-2 mb-1 h-8">
                 <div className="flex items-stretch justify-center shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-none rounded-[6px] h-full w-full max-w-[140px]">
                   <button
                     onClick={() => setQuantity(q => Math.max(1, q - 1))}
                     disabled={quantity <= 1}
                     className="w-7 flex items-center justify-center rounded-l-[6px] border border-gray-200 dark:border-slate-600/60 bg-white/60 dark:bg-slate-700/50 hover:bg-gray-100 dark:hover:bg-slate-600 active:bg-gray-200 dark:active:bg-slate-500 text-gray-500 dark:text-slate-300 hover:text-gray-700 dark:hover:text-white transition-colors disabled:opacity-40"
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
                       className="w-full h-full min-w-[30px] border-y border-gray-200 dark:border-slate-600/60 bg-white/80 dark:bg-slate-800/80 text-center text-xs font-bold text-gray-700 dark:text-slate-200 outline-none flex-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                     />
                   ) : (
                     <div
                       onClick={() => setEditingQty(true)}
                       className="w-full h-full min-w-[30px] border-y border-gray-200 dark:border-slate-600/60 bg-white/80 dark:bg-slate-800/80 flex items-center justify-center text-xs font-bold text-gray-700 dark:text-slate-200 select-none cursor-text flex-1 transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/80"
                     >
                       {quantity}
                     </div>
                   )}
                   <button
                     onClick={() => setQuantity(q => q + 1)}
                     className="w-7 flex items-center justify-center rounded-r-[6px] border border-gray-200 dark:border-slate-600/60 bg-white/60 dark:bg-slate-700/50 hover:bg-gray-100 dark:hover:bg-slate-600 active:bg-gray-200 dark:active:bg-slate-500 text-gray-500 dark:text-slate-300 hover:text-gray-700 dark:hover:text-white transition-colors"
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

            <button 
              onClick={isInCart || isReturnMode ? undefined : handleAdd} 
              className={isInCart ? inCartBtnClass : getAddBtnClass(isReturnMode)}
              title={isReturnMode ? 'İade modunda yeni ürün eklenemez' : undefined}
            >
              {isInCart ? (
                <><CheckCircle className="w-3.5 h-3.5" /> Sepette</>
              ) : isReturnMode ? (
                <><ShoppingCart className="w-3.5 h-3.5 opacity-40" /> Devre Dışı</>
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

// Only re-render when visual data changes; ignore stable callback references.
const areEqual = (prev, next) =>
  prev.isSelected     === next.isSelected     &&
  prev.posMode        === next.posMode        &&
  prev.product.id     === next.product.id     &&
  prev.product.stock_quantity === next.product.stock_quantity &&
  prev.product.sale_price     === next.product.sale_price     &&
  prev.product.name           === next.product.name;

export const ProductCard = memo(ProductCardInner, areEqual);
