import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User as UserIcon, ShoppingCart, ArrowLeftRight, Package, 
  ScanBarcode, ChevronUp, CheckCircle2, Banknote, CreditCard, 
  Building2, SplitSquareHorizontal, Plus, Minus, Trash2
} from 'lucide-react';
import { BarcodeInput } from '../../../components/ui/BarcodeInput';
import { ProductSearchDropdown } from './ProductSearchDropdown';
import { ProductCard } from '../ProductCard';

const formatCurrency = (val) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);

export const MobilePOS = ({
  // Auth & Modes
  posMode, setPosMode,
  // Entities
  selectedCustomer, selectedSupplier,
  setCustomerModalOpen, setSupplierSearchOpen,
  cashRegisters = [], selectedRegisters = {}, setSelectedRegisters,
  // Cart
  items, addItem, removeItem, updateQty, clearCart, updateItemPrice,
  total,
  // Payments
  paymentMethod, handlePaymentSelect, handleCheckout, isProcessing,
  cashAmount, setCashAmount, cardAmount, setCardAmount, transferAmount, setTransferAmount,
  // Search & Barcode
  searchQuery, setSearchQuery, dropdownResults, showDropdown, setShowDropdown,
  handleAddProduct, handleScan,
  // Grid
  displayedProducts, isGridLoading, ProductSkeleton,
  swapMode, handleGridCardClickForSwap, selectedProductId, handleSelectProduct, handleRemoveRequest, removingIds,
  // Modals
  setQuickBarcodesOpen, setQpmOpen,
  // Returns
  setReturnSaleSearchOpen
}) => {
  const [cartOpen, setCartOpen] = useState(false);
  const cartItemCount = items.reduce((acc, item) => acc + item.quantity, 0);

  const paymentOptions = [
    { id: 'cash', label: 'Nakit', icon: Banknote, color: 'text-[#3a8024]', bg: 'bg-[#7ed957]/15', border: 'border-[#7ed957]/40' },
    { id: 'card', label: 'Kredi Kartı', icon: CreditCard, color: 'text-blue-700', bg: 'bg-blue-500/15', border: 'border-blue-500/40' },
    { id: 'transfer', label: 'Havale', icon: Building2, color: 'text-purple-700', bg: 'bg-purple-500/15', border: 'border-purple-500/40' },
    { id: 'mixed', label: 'Parçalı', icon: SplitSquareHorizontal, color: 'text-orange-700', bg: 'bg-orange-500/15', border: 'border-orange-500/40' },
    { id: 'credit', label: posMode === 'purchase' ? 'Ted. Öde' : 'Veresiye', icon: UserIcon, color: 'text-rose-700', bg: 'bg-rose-500/15', border: 'border-rose-500/40' },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50 relative pb-[80px]">
      {/* HEADER */}
      <div className="flex items-center justify-between p-3 bg-white border-b border-slate-200 shrink-0">
        <div 
          className="flex items-center gap-2 flex-1"
          onClick={() => posMode === 'purchase' ? setSupplierSearchOpen(true) : setCustomerModalOpen(true)}
        >
          <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center text-brand-600">
            <UserIcon className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase">
              {posMode === 'purchase' ? 'TEDARİKÇİ' : 'MÜŞTERİ'}
            </span>
            <span className="text-sm font-bold text-slate-800 truncate max-w-[150px]">
              {posMode === 'purchase' ? (selectedSupplier?.name || 'Seçilmedi') : (selectedCustomer?.name || 'Seçilmedi')}
            </span>
          </div>
        </div>

        <div className="flex bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => { setPosMode('sale'); clearCart(true); }}
            className={`p-1.5 rounded-md ${posMode === 'sale' ? 'bg-white shadow-sm text-brand-600' : 'text-slate-500'}`}
          >
            <ShoppingCart className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setPosMode('return'); clearCart(true); setReturnSaleSearchOpen(true); }}
            className={`p-1.5 rounded-md ${posMode === 'return' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500'}`}
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setPosMode('purchase'); clearCart(true); }}
            className={`p-1.5 rounded-md ${posMode === 'purchase' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
          >
            <Package className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* SEARCH & CHIPS */}
      <div className="px-3 pt-3 pb-2 bg-white shrink-0 relative z-40">
        <div className="relative">
          {showDropdown && <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)}></div>}
          <div className="relative z-50">
            <BarcodeInput
              onScan={posMode === 'return' ? undefined : handleScan}
              value={searchQuery}
              onChange={posMode === 'return' ? undefined : e => setSearchQuery(e.target.value)}
              onFocus={posMode === 'return' ? undefined : () => searchQuery && setShowDropdown(true)}
              placeholder={posMode === 'return' ? 'İade modunda devre dışı' : 'Barkod okut veya ara...'}
            />
            {showDropdown && (
              <div className="mt-1">
                <ProductSearchDropdown
                  query={searchQuery}
                  results={dropdownResults}
                  onAdd={handleAddProduct}
                  onClose={() => { setShowDropdown(false); setSearchQuery(''); }}
                />
              </div>
            )}
          </div>
        </div>
        
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setQuickBarcodesOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-xs font-semibold whitespace-nowrap"
          >
            <ScanBarcode className="w-3.5 h-3.5" /> Barkodlar
          </button>
          <button
            onClick={() => setQpmOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-xs font-semibold whitespace-nowrap"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" /> Ürün Ekle/Değiş
          </button>
        </div>
      </div>

      {/* PRODUCT GRID */}
      <div className="flex-1 overflow-y-auto p-3">
        {isGridLoading ? (
           <div className="grid grid-cols-2 gap-2">
             {[...Array(6)].map((_, i) => <ProductSkeleton key={`skeleton-${i}`} />)}
           </div>
        ) : displayedProducts.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pb-[20px]">
            {displayedProducts.map((p, idx) => (
              <div key={p.id} onClick={swapMode ? () => handleGridCardClickForSwap(p, idx) : undefined}>
                <ProductCard
                  product={p}
                  isSelected={selectedProductId === p.id}
                  onSelect={handleSelectProduct}
                  onRemove={handleRemoveRequest}
                  onAdd={swapMode ? () => {} : handleAddProduct}
                  posMode={posMode}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center mt-10 text-slate-400">
            <ShoppingCart className="w-10 h-10 mb-2 opacity-50" />
            <p className="text-sm text-center px-4">Ürün bulunamadı. "Ürün Ekle" butonu ile ekleyebilirsiniz.</p>
          </div>
        )}
      </div>

      {/* FLOATING CART BAR */}
      <div 
        className="fixed bottom-[75px] left-3 right-3 bg-slate-900 text-white rounded-2xl p-3 flex items-center justify-between shadow-2xl z-[45]"
        onClick={() => setCartOpen(true)}
      >
        <div className="flex flex-col pl-1">
          <span className="text-xs text-slate-300 font-medium">Toplam</span>
          <span className="text-lg font-black">{formatCurrency(total)}</span>
        </div>
        <div className="flex items-center gap-3">
          {cartItemCount > 0 && (
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
              {cartItemCount}
            </div>
          )}
          <span className="text-sm font-bold">Sepeti Gör</span>
          <ChevronUp className="w-5 h-5" />
        </div>
      </div>

      {/* CART BOTTOM SHEET */}
      <AnimatePresence>
        {cartOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60]"
              onClick={() => setCartOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              drag="y"
              dragConstraints={{ top: 0 }}
              onDragEnd={(e, info) => {
                if (info.offset.y > 100) setCartOpen(false);
              }}
              className="fixed inset-x-0 bottom-0 bg-white rounded-t-3xl z-[70] flex flex-col max-h-[90vh]"
            >
              <div className="flex justify-center pt-3 pb-1" onClick={() => setCartOpen(false)}>
                <div className="w-12 h-1.5 rounded-full bg-slate-200"></div>
              </div>
              
              <div className="px-5 pb-3 flex justify-between items-center border-b border-slate-100">
                <h2 className="text-lg font-bold text-slate-800">Sepet Özeti</h2>
                <button onClick={() => clearCart(true)} className="text-xs font-semibold text-red-500 p-2">
                  Temizle
                </button>
              </div>

              {/* Cart Items */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {items.length === 0 ? (
                  <div className="text-center text-slate-400 py-6">Sepetiniz boş</div>
                ) : (
                  items.map(item => (
                    <div key={item.id} className="flex gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="font-bold text-sm text-slate-800 line-clamp-1">{item.product.name}</div>
                        <div 
                          className="text-xs text-brand-600 font-bold px-1.5 py-0.5 rounded bg-brand-50 inline-block mt-0.5 w-fit"
                          onClick={() => {
                            if (updateItemPrice) {
                              const newPriceStr = window.prompt('Yeni birim fiyatını girin:', item.unit_price || item.product.sale_price);
                              if (newPriceStr !== null) {
                                const newPrice = parseFloat(newPriceStr.replace(',', '.'));
                                if (!isNaN(newPrice) && newPrice >= 0) {
                                  updateItemPrice(item.product.id, newPrice);
                                }
                              }
                            }
                          }}
                        >
                          {formatCurrency(item.unit_price || item.product.sale_price)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => item.quantity <= 1 ? removeItem(item.product.id) : updateQty(item.product.id, item.quantity - 1)} className="w-7 h-7 flex items-center justify-center bg-white rounded-lg border border-slate-200 shadow-sm">
                          {item.quantity <= 1 ? <Trash2 className="w-3.5 h-3.5 text-red-500" /> : <Minus className="w-3.5 h-3.5" />}
                        </button>
                        <span className="font-bold text-sm w-4 text-center">{item.quantity}</span>
                        <button onClick={() => updateQty(item.product.id, item.quantity + 1)} className="w-7 h-7 flex items-center justify-center bg-white rounded-lg border border-slate-200 shadow-sm text-brand-600">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Payment Area */}
              <div className="p-4 bg-white border-t border-slate-200 pb-28">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-slate-500 text-sm font-medium">Ödenecek Tutar</span>
                  <span className="text-xl font-black text-slate-900">{formatCurrency(total)}</span>
                </div>
                
                {/* Horizontal Scrolling Payment Chips */}
                <div className="flex overflow-x-auto gap-2 mb-3 pb-2 scrollbar-hide">
                  {paymentOptions.map(opt => {
                    const isActive = paymentMethod === opt.id;
                    const isMixed = paymentMethod === 'mixed';
                    const isCreditBtn = opt.id === 'credit';
                    const isDisabled = isCreditBtn && posMode === 'sale' && selectedCustomer?.id === 1;
                    const isDimmed = !isActive && !isMixed;
                    const opts = opt.id === 'cash' ? cashRegisters.filter(r => r.type === 'cash') :
                                 opt.id === 'card' ? cashRegisters.filter(r => r.type === 'pos') :
                                 opt.id === 'transfer' ? cashRegisters.filter(r => r.type === 'bank') : [];

                    return (
                      <div key={opt.id} className="flex flex-col gap-1 shrink-0 w-24">
                        <button
                          onClick={() => !isDisabled && handlePaymentSelect(opt.id)}
                          disabled={isDisabled}
                          className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all h-[60px] ${
                            isActive ? `${opt.border} ${opt.bg}` : 'border-slate-100 bg-slate-50'
                          } ${isDimmed || isDisabled ? 'opacity-50' : ''} ${isDisabled ? 'cursor-not-allowed grayscale' : ''}`}
                        >
                          <opt.icon className={`w-4 h-4 mb-1 ${isActive ? opt.color : 'text-slate-400'}`} />
                          <span className={`text-[10px] font-bold ${isActive ? opt.color : 'text-slate-600'} whitespace-nowrap`}>{opt.label}</span>
                        </button>
                        
                        {(isActive || isMixed) && opt.id !== 'mixed' && opts.length > 0 && (
                          <select
                            value={selectedRegisters?.[opt.id] || ''}
                            onChange={(e) => setSelectedRegisters && setSelectedRegisters(prev => ({ ...prev, [opt.id]: e.target.value }))}
                            className="w-full text-[9px] font-semibold text-slate-600 bg-white border border-slate-200 rounded-md p-1 focus:outline-none focus:ring-1 focus:ring-brand-500 truncate"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="">Kasa Seç</option>
                            {opts.map(r => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Mixed Payment Inputs */}
                {paymentMethod === 'mixed' && (
                  <div className="grid grid-cols-3 gap-2 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 mb-1 block">Nakit</label>
                      <input 
                        type="number" 
                        value={cashAmount} 
                        onChange={e => setCashAmount(e.target.value)} 
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-semibold focus:outline-none focus:border-brand-500"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 mb-1 block">Kredi K.</label>
                      <input 
                        type="number" 
                        value={cardAmount} 
                        onChange={e => setCardAmount(e.target.value)} 
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-semibold focus:outline-none focus:border-brand-500"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 mb-1 block">Havale</label>
                      <input 
                        type="number" 
                        value={transferAmount} 
                        onChange={e => setTransferAmount(e.target.value)} 
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-semibold focus:outline-none focus:border-brand-500"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                )}

                <button
                  onClick={() => {
                    setCartOpen(false);
                    setTimeout(() => handleCheckout(), 300);
                  }}
                  disabled={isProcessing || items.length === 0}
                  className="w-full h-12 bg-brand-500 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg shadow-brand-500/30 active:scale-[0.98] transition-transform disabled:opacity-50 disabled:active:scale-100"
                >
                  {isProcessing ? 'İşleniyor...' : (
                    <>
                      <CheckCircle2 className="w-5 h-5" /> Siparişi Tamamla
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
