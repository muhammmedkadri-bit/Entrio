import React, { useState, useEffect } from 'react';
import { Package, Search, X, ChevronLeft, ChevronRight, PackageX, CheckCircle, ArrowRight, Layers, Save } from 'lucide-react';
import { productService } from '../../../services/productService';
import { stockService } from '../../../services/stockService';
import toast from '../../../components/ui/CustomToast';

export const BulkStockUpdateModal = ({ isOpen, onClose, onSaved }) => {
  const [all, setAll] = useState([]);
  const [query, setQuery] = useState('');
  const [filtered, setFiltered] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [inputs, setInputs] = useState({});
  const [savingId, setSavingId] = useState(null);

  const fetchProducts = async () => {
    try {
      const res = await productService.getAll({});
      // Filter out products that don't track stock
      const trackable = res.filter(p => p.track_stock !== false);
      setAll(trackable);
      setFiltered(trackable);
    } catch (e) {
      console.error('[BulkStockUpdate] Ürünleri Yükleme Hatası:', e);
      toast.error('Ürünler yüklenemedi: ' + (e?.message || 'Bilinmeyen hata'));
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchProducts();
      setQuery('');
      setCurrentPage(1);
      setInputs({});
    }
  }, [isOpen]);

  useEffect(() => {
    setCurrentPage(1);
    if (!query.trim()) { setFiltered(all); return; }
    const q = query.toLowerCase();
    setFiltered(all.filter(p =>
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.barcode && p.barcode.includes(query))
    ));
  }, [query, all]);

  const handleInputChange = (id, val) => {
    setInputs(prev => ({ ...prev, [id]: val }));
  };

  const handleSave = async (product) => {
    const val = inputs[product.id];
    if (!val || val.trim() === '') {
      toast.error('Lütfen yeni bir stok miktarı girin.');
      return;
    }
    const newStock = parseFloat(val);
    if (isNaN(newStock) || newStock < 0) {
      toast.error('Geçerli bir stok girin.');
      return;
    }
    const current = product.stock_quantity || 0;
    if (newStock === current) {
      toast('Stok zaten bu miktarda.', { icon: 'ℹ️' });
      setInputs(prev => { const n = { ...prev }; delete n[product.id]; return n; });
      return;
    }

    setSavingId(product.id);
    const delta = newStock - current;
    const movType = delta >= 0 ? 'adjustment_in' : 'adjustment_out';
    
    try {
      await stockService.addMovement(product.id, movType, Math.abs(delta), 0, `Toplu Güncelleme`);
      toast.success(`${product.name} stoğu güncellendi.`);
      
      // Update local state
      const updated = { ...product, stock_quantity: newStock };
      setAll(prev => prev.map(p => p.id === product.id ? updated : p));
      setFiltered(prev => prev.map(p => p.id === product.id ? updated : p));
      
      setInputs(prev => { const n = { ...prev }; delete n[product.id]; return n; });
      if (onSaved) onSaved();
    } catch (e) {
      console.error('[BulkStockUpdate] Kayıt Hatası:', e);
      toast.error('Güncelleme hatası: ' + (e?.message || 'Bilinmeyen hata'));
    } finally {
      setSavingId(null);
    }
  };

  if (!isOpen) return null;

  // Pagination Logic
  const itemsPerPage = 8;
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
      onClick={onClose}
    >
      <div
        className="h-[85vh] max-h-[85vh] flex flex-col overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.6)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.15)',
          borderRadius: '16px',
          width: '820px',
          maxWidth: '95vw',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-none">
          <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100/80 bg-white/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                <Layers className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-800">Toplu Stok Güncelleme</h2>
                <p className="text-xs text-gray-400 mt-0.5">Ürünlerin güncel stok miktarlarını hızlıca değiştirin</p>
              </div>
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
                   placeholder="Ürün adı veya barkod ile ara..."
                   value={query}
                   onChange={e => setQuery(e.target.value)}
                   className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white/80 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                 />
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Body */}
        <div className="flex flex-col flex-1 overflow-hidden p-4">
           {filtered.length === 0 && query.length > 0 ? (
              /* Empty State */
              <div className="flex-1 flex flex-col items-center justify-center">
                 <PackageX className="w-10 h-10 text-gray-300 mb-3" />
                 <p className="text-gray-800 font-medium text-sm lg:text-base">'{query}' için ürün bulunamadı</p>
              </div>
           ) : (
              /* List Content */
              <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-gray-200">
                {currentItems.map(product => {
                  const currentStock = product.stock_quantity || 0;
                  const inputValue = inputs[product.id] !== undefined ? inputs[product.id] : '';
                  const isDirty = inputValue !== '' && parseFloat(inputValue) !== currentStock && !isNaN(parseFloat(inputValue));
                  const isSaving = savingId === product.id;

                  let stockStyle = { bg: 'rgba(16,185,129,0.12)', text: '#059669', border: 'rgba(16,185,129,0.25)' };
                  if (currentStock <= 0) {
                    stockStyle = { bg: 'rgba(244,63,94,0.12)', text: '#e11d48', border: 'rgba(244,63,94,0.25)' };
                  } else if (currentStock <= 5) {
                    stockStyle = { bg: 'rgba(249,115,22,0.12)', text: '#c2410c', border: 'rgba(249,115,22,0.25)' };
                  }

                  return (
                    <div
                      key={product.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all gap-3 sm:gap-0"
                    >
                      {/* Product Info */}
                      <div className="flex items-center gap-3 w-full sm:w-auto sm:flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gray-50 border border-gray-100 flex-shrink-0">
                          <Package className="w-5 h-5 text-gray-400" />
                        </div>
                        <div className="min-w-0 flex-1 pr-4">
                          <h3 className="text-sm font-bold text-gray-800 truncate">{product.name}</h3>
                          <div className="text-[11px] text-gray-500 flex items-center gap-2 mt-0.5 font-mono">
                            {product.barcode}
                          </div>
                        </div>
                      </div>
                      
                      {/* Stock Update Controls */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-5 w-full sm:w-auto flex-shrink-0 bg-slate-50/50 sm:bg-transparent p-2 sm:p-0 rounded-lg sm:rounded-none">
                        
                        {/* Current Stock */}
                        <div className="flex flex-col items-end sm:items-end">
                          <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Mevcut</span>
                          <span
                            className="text-sm font-bold px-2.5 py-0.5 rounded-md flex items-center justify-center min-w-[60px]"
                            style={{
                              background: stockStyle.bg, color: stockStyle.text, border: `1px solid ${stockStyle.border}`,
                            }}
                          >
                            {currentStock} <span className="text-[10px] font-medium ml-1 opacity-80">{product.unit}</span>
                          </span>
                        </div>

                        <ArrowRight className="w-4 h-4 text-gray-300 shrink-0" />

                        {/* New Stock Input */}
                        <div className="flex flex-col items-start sm:items-start flex-1 sm:flex-initial">
                           <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Yeni Stok</span>
                           <div className="flex items-center gap-2 w-full sm:w-auto">
                             <div className="relative flex-1 sm:flex-none">
                               <input 
                                 type="number"
                                 placeholder={currentStock}
                                 value={inputValue}
                                 onChange={e => handleInputChange(product.id, e.target.value)}
                                 onKeyDown={e => { if (e.key === 'Enter') handleSave(product); }}
                                 className="w-full sm:w-20 px-2 py-1 text-center text-sm font-bold text-gray-800 border-2 border-gray-200 rounded-lg focus:ring-0 focus:border-blue-400 outline-none transition-colors"
                               />
                             </div>
                             <button
                               onClick={() => handleSave(product)}
                               disabled={!isDirty || isSaving}
                               className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border shrink-0 ${
                                 isDirty && !isSaving
                                   ? 'bg-blue-500 text-white border-blue-600 hover:bg-blue-600 shadow-sm'
                                   : 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                               }`}
                             >
                               {isSaving ? (
                                 <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                               ) : (
                                 <Save className="w-3.5 h-3.5" />
                               )}
                               Kaydet
                             </button>
                           </div>
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>
           )}

           {/* Pagination Bar */}
           {filtered.length > 0 && (
              <div className="flex items-center justify-between mt-auto pt-3 pb-20 sm:pb-0 border-t border-gray-100 flex-none px-1">
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
      </div>
    </div>
  );
};
