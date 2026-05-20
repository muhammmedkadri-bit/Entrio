import React, { useState, useEffect } from 'react';
import { Package, Plus, ArrowLeftRight, Search, X, ChevronLeft, ChevronRight, PackageX, CheckCircle } from 'lucide-react';
import { productService } from '../../../services/productService';
import { BarcodeStripes } from './BarcodeStripes';
import { QuickCreateProductForm } from './QuickCreateProductForm';
import toast from '../../../components/ui/CustomToast';

const fmt = (v) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(v || 0);

// Module-level cache
let _qpmCache = [];
let _qpmCacheLoaded = false;

export const QuickProductManagerModal = ({
  isOpen, onClose,
  displayedProducts, onAddProduct, onStartSwap,
  initialBarcode = '',
  openOnCreate = false,
}) => {
  const [all, setAll] = useState([]);
  const [query, setQuery] = useState('');
  const [filtered, setFiltered] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const fetchProducts = async () => {
    if (_qpmCacheLoaded) {
      setAll(_qpmCache);
      setFiltered(_qpmCache);
      return;
    }
    setIsLoading(true);
    try {
      const res = await productService.getAll({});
      _qpmCache = res;
      _qpmCacheLoaded = true;
      setAll(res);
      setFiltered(res);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchProducts();
      setQuery('');
      setCurrentPage(1);
      // If triggered by a scanned barcode that was not found, go directly to create form
      if (openOnCreate || initialBarcode) {
        setShowQuickCreate(true);
      } else {
        setShowQuickCreate(false);
      }
    }
  }, [isOpen, openOnCreate, initialBarcode]);

  useEffect(() => {
    setCurrentPage(1);
    if (!query.trim()) { setFiltered(all); return; }
    const q = query.toLowerCase();
    setFiltered(all.filter(p =>
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.barcode && p.barcode.includes(query))
    ));
  }, [query, all]);

  const displayedIds = new Set(displayedProducts.map(p => p.id));

  const handleAdd = (product) => {
    if (displayedIds.has(product.id)) {
      toast('Bu ürün zaten POS ekranında!', { icon: '⚠️' });
      return;
    }
    if (displayedProducts.length >= 12) {
      toast.error('En fazla 12 hızlı ürün eklenebilir. Mevcut ürünleri değiştirmeyi deneyin.', { icon: '🛑' });
      return;
    }
    onAddProduct(product);
    toast.success(`${product.name} POS ekranına eklendi`);
  };

  const handleSwap = (product) => {
    onStartSwap(product);
    onClose();
  };

  if (!isOpen) return null;

  // Pagination Logic
  const itemsPerPage = 6;
  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const currentItems = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const renderPaginationButtons = () => {
    let pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = startPage + maxVisiblePages - 1;

    if (endPage > totalPages) {
      endPage = totalPages;
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        pages.push(
          <button
            key={i}
            onClick={() => setCurrentPage(i)}
            className={`w-7 h-7 text-xs rounded-lg flex items-center justify-center transition-all cursor-pointer ${
              currentPage === i 
                ? 'bg-brand-50 text-brand-700 border border-brand-200 font-bold shadow-sm' 
                : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {i}
          </button>
        );
    }
    return pages;
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '48px', paddingBottom: '24px',
      }}
      onClick={() => {
        if (!showQuickCreate) {
          onClose();
        }
      }}
    >
      <div
        className="h-full sm:h-[85vh] sm:max-h-[85vh] w-full sm:w-[820px] sm:max-w-[95vw] flex flex-col overflow-hidden sm:rounded-2xl shadow-2xl"
        style={{
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.6)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header (Search Input Zone) */}
        {!showQuickCreate && (
           <div className="flex-none">
             <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100/80 bg-white/50">
               <div>
                 <h2 className="text-base font-bold text-gray-800">Hızlı Ürün Ekle / Değiştir</h2>
                 <p className="text-xs text-gray-400 mt-0.5">POS ekranına ürün ekleyin veya mevcut kartlarla yer değiştirin</p>
               </div>
               <button
                 onClick={onClose}
                 className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
               >
                 <X className="w-4 h-4" />
               </button>
             </div>

             <div className="px-5 py-3 border-b border-gray-100/80 bg-white/50">
               <div className="relative flex gap-2">
                 <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      autoFocus
                      type="text"
                      placeholder="Ürün adı veya barkod..."
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white/80 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition-all"
                    />
                 </div>
                 <button 
                    onClick={() => setShowQuickCreate(true)}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      background: 'rgba(16,185,129,0.12)',
                      border: '1px solid rgba(16,185,129,0.25)',
                      color: 'rgb(4,120,87)',
                      boxShadow: '0 4px 12px rgba(16,185,129,0.1)'
                    }}
                 >
                    <Plus className="w-4 h-4" />
                    Oluştur
                 </button>
               </div>
             </div>
           </div>
        )}

        {/* Dynamic Body */}
        {showQuickCreate ? (
          <QuickCreateProductForm 
            searchQuery={query}
            initialBarcode={initialBarcode}
            hasEmptySlot={displayedProducts.length < 12}
            onClose={() => { setShowQuickCreate(false); }}
            onAddProduct={(prod) => { 
              setShowQuickCreate(false); 
              // Cache'i anında güncelle
              if (_qpmCacheLoaded) {
                 _qpmCache = [..._qpmCache, prod].sort((a,b) => a.name.localeCompare(b.name));
                 setAll(_qpmCache);
                 setFiltered(_qpmCache);
              }
              // Hemen ekle
              setTimeout(() => handleAdd(prod), 50);
            }}
          />
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden p-4">
             {isLoading ? (
               <div className="flex-1 flex flex-col items-center justify-center gap-3">
                 <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                 <p className="text-xs text-slate-400 font-medium">Ürünler yükleniyor...</p>
               </div>
             ) : filtered.length === 0 && query.length > 0 ? (
                /* Empty State */
                <div className="flex-1 flex flex-col items-center justify-center">
                   <PackageX className="w-10 h-10 text-gray-300 mb-3" />
                   <p className="text-gray-800 font-medium text-sm lg:text-base">'{query}' için ürün bulunamadı</p>
                   <p className="text-gray-400 text-xs mt-1">Bu isimde yeni bir ürün oluşturabilirsiniz</p>
                   <button
                     onClick={() => setShowQuickCreate(true)}
                     className="mt-4 flex items-center justify-center gap-2 px-5 py-2 rounded-[10px] text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
                     style={{
                       background: 'rgba(16,185,129,0.12)',
                       border: '1px solid rgba(16,185,129,0.25)',
                       color: 'rgb(4,120,87)',
                       boxShadow: '0 4px 12px rgba(16,185,129,0.1)'
                     }}
                   >
                     <Plus className="w-4 h-4" /> Hızlı Ürün Oluştur
                   </button>
                </div>
             ) : (
                /* Grid Content */
                <div className="flex-1 overflow-y-auto sm:overflow-visible pb-2">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 content-start h-full">
                    {currentItems.map(product => {
                      const isInGrid = displayedIds.has(product.id);
                    
                    // Formatting Product Name: Limit to 2 lines naturally via line-clamp-2
                    const getFormattedName = (name) => {
                      if (!name) return { line1: 'Bilinmeyen Ürün', line2: '' };
                      const words = name.trim().split(/\s+/);
                      if (words.length <= 5) return { line1: words.join(' '), line2: '' };
                      const line1 = words.slice(0, 5).join(' ');
                      const line2Words = words.slice(5);
                      if (line2Words.length <= 4) return { line1, line2: line2Words.join(' ') };
                      const line2Start = line2Words.slice(0, 4).join(' ');
                      const line2TruncatedWord = line2Words[4].substring(0, 4) + '...';
                      return { line1, line2: `${line2Start} ${line2TruncatedWord}` };
                    };
                  
                    const formattedName = getFormattedName(product?.name);

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
                        key={product.id}
                        className={`bg-white border rounded-xl flex flex-col p-3 transition-all duration-150 relative ${isInGrid ? 'border-emerald-200 bg-emerald-50/40' : 'border-gray-200 hover:border-brand-300 hover:shadow-md'}`}
                      >
                        {/* Already-in-grid badge */}
                        {isInGrid && (
                          <div className="absolute top-2 right-2 bg-emerald-100 text-emerald-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm border border-emerald-200">
                             <CheckCircle className="w-3 h-3" /> Ekli
                          </div>
                        )}

                        {/* Card content */}
                        <div className="flex flex-col items-center flex-1 w-full pt-1 px-1">
                          
                          {/* Top Row: Icon (Centered) */}
                          <div className="flex items-center justify-center w-full mb-1.5 mt-0.5">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-brand-50 border border-brand-100/50 flex-shrink-0">
                              <Package className="w-5 h-5 text-brand-500" />
                            </div>
                          </div>

                          {/* Name Area */}
                          <div className="flex flex-col items-center justify-center my-0.5 min-h-[2.5rem]">
                            <h3 className="text-sm font-semibold text-gray-800 text-center leading-tight m-0 line-clamp-1">
                              {formattedName.line1}
                            </h3>
                            {formattedName.line2 && (
                              <h3 className="text-sm font-semibold text-gray-800 text-center leading-tight m-0 mt-0.5 line-clamp-1">
                                {formattedName.line2}
                              </h3>
                            )}
                          </div>

                          {/* Price */}
                          <p className="text-base font-bold text-brand-600 mt-1 mb-1 text-center truncate">
                            {fmt(product.sale_price)}
                          </p>

                          {/* Align Stock and Barcode at bottom */}
                          <div className="mt-auto flex flex-col items-center gap-1.5 mb-1.5">
                            {/* Stock Pill Row */}
                            <div className="flex justify-center">
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

                            {/* Barcode Pill */}
                            <div 
                              className="h-9 px-3 rounded-lg flex items-center justify-center transition-all bg-white/40 border border-black/5 backdrop-blur-[4px] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
                              style={{ background: 'rgba(255, 255, 255, 0.45)' }}
                            >
                              <div className="scale-[0.85] origin-center -my-1">
                                <BarcodeStripes value={product?.barcode || ''} color="#000000" />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Footer Buttons */}
                        <div className="flex gap-1.5 mt-2 pt-2 border-t border-gray-100/50">
                          <button
                            onClick={() => handleAdd(product)}
                            disabled={isInGrid || displayedProducts.length >= 12}
                            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg transition-all"
                            style={{
                              background: isInGrid || displayedProducts.length >= 12 ? 'rgba(156,163,175,0.1)' : 'rgba(16,185,129,0.12)', 
                              border: isInGrid || displayedProducts.length >= 12 ? '1px solid rgba(156,163,175,0.2)' : '1px solid rgba(16,185,129,0.25)',
                              color: isInGrid || displayedProducts.length >= 12 ? 'rgb(107,114,128)' : 'rgb(4,120,87)',
                              padding: '5px 0', fontSize: '12px', fontWeight: 500,
                              cursor: isInGrid || displayedProducts.length >= 12 ? 'not-allowed' : 'pointer',
                              opacity: isInGrid || displayedProducts.length >= 12 ? 0.6 : 1,
                            }}
                          >
                            <Plus className="w-3.5 h-3.5" /> Ekle
                          </button>
                          <button
                            onClick={() => handleSwap(product)}
                            disabled={isInGrid}
                            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg transition-all"
                            style={{
                              background: isInGrid ? 'rgba(156,163,175,0.1)' : 'rgba(249,115,22,0.10)', 
                              border: isInGrid ? '1px solid rgba(156,163,175,0.2)' : '1px solid rgba(249,115,22,0.22)',
                              color: isInGrid ? 'rgb(107,114,128)' : 'rgb(154,52,18)',
                              padding: '5px 0', fontSize: '12px', fontWeight: 500,
                              cursor: isInGrid ? 'not-allowed' : 'pointer',
                              opacity: isInGrid ? 0.6 : 1,
                            }}
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5" /> Değiştir
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
             )}

             {/* Pagination Bar */}
             {!showQuickCreate && filtered.length > 0 && (
                <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100 flex-none px-1">
                   <div className="text-xs text-gray-500 font-medium">
                     {filtered.length} ürün — Sayfa {currentPage}/{totalPages}
                   </div>
                   <div className="flex items-center gap-1.5">
                     <button
                       onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                       disabled={currentPage === 1}
                       className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                     >
                       <ChevronLeft className="w-4 h-4" />
                     </button>
                     {renderPaginationButtons()}
                     <button
                       onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                       disabled={currentPage === totalPages}
                       className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                     >
                       <ChevronRight className="w-4 h-4" />
                     </button>
                   </div>
                </div>
             )}
          </div>
        )}
      </div>
    </div>
  );
};
