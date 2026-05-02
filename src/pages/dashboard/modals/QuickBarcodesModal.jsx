import React, { useState, useEffect } from 'react';
import { X, Search, ChevronLeft, ChevronRight, Edit2, Maximize, ScanBarcode } from 'lucide-react';
import { db } from '../../../db';
import Barcode from 'react-barcode';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../../store/appStore';

export const QuickBarcodesModal = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const startNavigation = useAppStore(state => state.startNavigation);
  const [allProducts, setAllProducts] = useState([]);
  const [query, setQuery] = useState('');
  const [filtered, setFiltered] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadProducts();
      setQuery('');
      setCurrentPage(1);
      setSelectedProduct(null);
    }
  }, [isOpen]);

  const loadProducts = async () => {
    const products = await db.products.toArray();
    // Only products with barcodes
    const withBarcodes = products.filter(p => p.barcode && p.barcode.trim() !== '');
    setAllProducts(withBarcodes);
    setFiltered(withBarcodes);
  };

  useEffect(() => {
    setCurrentPage(1);
    if (!query.trim()) { setFiltered(allProducts); return; }
    const q = query.toLowerCase();
    setFiltered(allProducts.filter(p =>
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.barcode && p.barcode.includes(query))
    ));
  }, [query, allProducts]);

  if (!isOpen) return null;

  // Pagination Logic (5x5 grid = 25 items per page)
  const itemsPerPage = 25;
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
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
      onClick={onClose}
    >
      <div
        className="flex flex-col bg-slate-50 overflow-hidden relative shadow-2xl"
        style={{
          border: '1px solid rgba(255,255,255,0.6)',
          borderRadius: '24px',
          width: '1200px',
          height: '85vh',
          maxWidth: '95vw',
        }}
        onClick={e => e.stopPropagation()}
      >
        {selectedProduct ? (
          // FULL SCREEN BARCODE VIEW
          <div className="absolute inset-0 z-10 bg-white flex flex-col">
             <div className="flex justify-between items-center p-6 border-b border-slate-100">
               <button onClick={() => setSelectedProduct(null)} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-semibold transition-colors">
                  <ChevronLeft className="w-5 h-5" /> Geri Dön
               </button>
               <div className="flex gap-3">
                  <button onClick={() => { startNavigation(); navigate(`/stock/${selectedProduct.id}`); onClose(); }} className="flex items-center gap-2 bg-[#7ed957]/15 text-[#5da83f] px-4 py-2 rounded-xl font-bold hover:bg-[#7ed957]/25 transition-colors border border-[#7ed957]/30">
                    <Edit2 className="w-4 h-4" /> Düzenle
                  </button>
                  <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
               </div>
             </div>
             <div className="flex-1 flex flex-col items-center justify-center p-10">
               <h2 className="text-4xl font-black text-slate-800 text-center mb-12 max-w-4xl">{selectedProduct.name}</h2>
               <div className="bg-white p-8 rounded-3xl border-2 border-slate-200 shadow-2xl">
                 <Barcode value={selectedProduct.barcode} width={4} height={150} fontSize={24} background="#ffffff" lineColor="#000000" margin={20} displayValue={true} />
               </div>
             </div>
          </div>
        ) : (
          // GRID VIEW
          <>
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 bg-white shadow-sm z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#7ed957]/15 rounded-xl flex items-center justify-center border border-[#7ed957]/30">
                  <ScanBarcode className="w-5 h-5 text-[#5da83f]" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-800 tracking-tight">Hızlı Barkodlar</h2>
                  <p className="text-xs text-slate-500 font-medium">Ekrandaki barkodu okutmak için ürüne tıklayın</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative w-64">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                   <input
                     autoFocus
                     type="text"
                     placeholder="Ürün adı veya barkod..."
                     value={query}
                     onChange={e => setQuery(e.target.value)}
                     className="w-full pl-9 pr-4 py-2 text-sm border-2 border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-[#7ed957] focus:bg-white transition-all font-semibold"
                   />
                </div>
                <button 
                  onClick={() => { startNavigation(); navigate('/stock'); onClose(); }}
                  className="flex items-center gap-2 bg-[#7ed957]/15 text-[#5da83f] px-4 py-2 rounded-xl font-bold hover:bg-[#7ed957]/25 transition-colors border border-[#7ed957]/30"
                >
                  <Edit2 className="w-4 h-4" /> Ürün Ekle / Değiştir
                </button>
                <button
                  onClick={onClose}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex flex-col flex-1 overflow-hidden p-6">
               {filtered.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center">
                     <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                       <ScanBarcode className="w-8 h-8 text-slate-400" />
                     </div>
                     <p className="text-slate-700 font-bold text-lg">Barkodlu ürün bulunamadı</p>
                  </div>
               ) : (
                  <div className="flex-1 grid grid-cols-5 grid-rows-5 gap-3">
                    {currentItems.map(product => (
                        <div
                          key={product.id}
                          onClick={() => setSelectedProduct(product)}
                          className="bg-white border-2 border-slate-100 hover:border-[#7ed957] rounded-2xl flex flex-col items-center justify-center p-3 transition-all cursor-pointer hover:shadow-lg group"
                        >
                          <h3 className="text-sm font-bold text-slate-800 text-center leading-tight line-clamp-2 group-hover:text-[#5da83f] transition-colors">
                            {product.name}
                          </h3>
                          <div className="mt-2 text-[10px] font-bold tracking-wider text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100 group-hover:bg-[#7ed957]/10 group-hover:border-[#7ed957]/30 group-hover:text-[#5da83f] transition-colors">
                            {product.barcode}
                          </div>
                        </div>
                    ))}
                  </div>
               )}

               {filtered.length > 0 && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200 flex-none px-2">
                     <div className="text-sm text-slate-500 font-bold">
                       {filtered.length} ürün — Sayfa {currentPage}/{totalPages}
                     </div>
                     <div className="flex items-center gap-1.5">
                       <button
                         onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                         disabled={currentPage === 1}
                         className="w-8 h-8 flex items-center justify-center rounded-xl bg-white border-2 border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                       >
                         <ChevronLeft className="w-4 h-4" />
                       </button>
                       {renderPaginationButtons()}
                       <button
                         onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                         disabled={currentPage === totalPages}
                         className="w-8 h-8 flex items-center justify-center rounded-xl bg-white border-2 border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                       >
                         <ChevronRight className="w-4 h-4" />
                       </button>
                     </div>
                  </div>
               )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
