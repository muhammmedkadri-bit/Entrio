import React, { useState, useEffect } from 'react';
import { X, Search, ChevronLeft, ChevronRight, ScanBarcode, CheckCircle, Plus, Package, ArrowLeft } from 'lucide-react';
import { isSupabase } from '../../../config/database';
import { db } from '../../../db';
import { supabase } from '../../../lib/supabaseClient';
import Barcode from 'react-barcode';

// ─── Ürünleri getir (Supabase veya Dexie) ────────────────────────────────────
async function fetchAllProducts() {
  if (isSupabase()) {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, barcode, sale_price, stock_quantity, track_stock')
      .order('name');
    if (error) throw error;
    return data || [];
  }
  return await db.products.orderBy('name').toArray();
}

const BARCODE_PER_PAGE  = 25;
const PICKER_PER_PAGE   = 15;

export const QuickBarcodesModal = ({ isOpen, onClose, onAddToCart }) => {
  // ── Barkod Grid state ────────────────────────────────────────────────────
  const [allProducts, setAllProducts]   = useState([]);
  const [query, setQuery]               = useState('');
  const [filtered, setFiltered]         = useState([]);
  const [currentPage, setCurrentPage]   = useState(1);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [addedId, setAddedId]           = useState(null);
  const [isLoading, setIsLoading]       = useState(false);

  // ── Ürün Ekle Picker state ───────────────────────────────────────────────
  const [showPicker, setShowPicker]     = useState(false);
  const [pickerQuery, setPickerQuery]   = useState('');
  const [pickerPage, setPickerPage]     = useState(1);
  const [pinnedIds, setPinnedIds]       = useState(new Set());
  const [allStockProducts, setAllStockProducts] = useState([]);

  // ── Load ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setCurrentPage(1);
      setSelectedProduct(null);
      setAddedId(null);
      setShowPicker(false);
      setPickerQuery('');
      setPickerPage(1);
      loadProducts();
    }
  }, [isOpen]);

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const products = await fetchAllProducts();
      setAllStockProducts(products);
      const withBarcodes = products.filter(p => p.barcode && p.barcode.trim() !== '');
      setAllProducts(withBarcodes);
      setFiltered(withBarcodes);
    } catch (e) {
      console.error('[QuickBarcodesModal] Yükleme hatası:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Barkod grid filter ───────────────────────────────────────────────────
  useEffect(() => {
    setCurrentPage(1);
    if (!query.trim()) { setFiltered(allProducts); return; }
    const q = query.toLowerCase();
    setFiltered(allProducts.filter(p =>
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.barcode && p.barcode.includes(query))
    ));
  }, [query, allProducts]);

  // ── Pinned products (manually added from picker) ─────────────────────────
  // Pinned = products added from picker, merged with already-barcoded list
  const pinnedProducts = allStockProducts.filter(p =>
    pinnedIds.has(p.id) && p.barcode && p.barcode.trim() !== '' && !allProducts.find(b => b.id === p.id)
  );
  const displayedBarcodeProducts = [...pinnedProducts, ...filtered];

  // ── Cart add ─────────────────────────────────────────────────────────────
  const handleAddToCartFromBarcode = (product) => {
    if (onAddToCart) {
      onAddToCart(product);
      setAddedId(product.id);
      setTimeout(() => setAddedId(null), 1200);
    }
  };

  // ── Picker ───────────────────────────────────────────────────────────────
  const pickerProducts = allStockProducts.filter(p => p.barcode && p.barcode.trim() !== '');
  const pickerFiltered = pickerProducts.filter(p => {
    if (!pickerQuery.trim()) return true;
    const q = pickerQuery.toLowerCase();
    return (p.name && p.name.toLowerCase().includes(q)) ||
           (p.barcode && p.barcode.includes(pickerQuery));
  });
  const pickerTotalPages = Math.max(1, Math.ceil(pickerFiltered.length / PICKER_PER_PAGE));
  const pickerItems = pickerFiltered.slice((pickerPage - 1) * PICKER_PER_PAGE, pickerPage * PICKER_PER_PAGE);

  const handlePickerAdd = (product) => {
    setPinnedIds(prev => new Set([...prev, product.id]));
  };

  // ── Pagination helpers ───────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(displayedBarcodeProducts.length / BARCODE_PER_PAGE));
  const currentItems = displayedBarcodeProducts.slice((currentPage - 1) * BARCODE_PER_PAGE, currentPage * BARCODE_PER_PAGE);

  const renderPageBtns = (cur, total, setCur) => {
    const pages = [];
    const max = 5;
    let start = Math.max(1, cur - Math.floor(max / 2));
    let end = start + max - 1;
    if (end > total) { end = total; start = Math.max(1, end - max + 1); }
    for (let i = start; i <= end; i++) {
      pages.push(
        <button key={i} onClick={() => setCur(i)}
          className={`w-7 h-7 text-xs rounded-lg flex items-center justify-center transition-all ${
            cur === i ? 'bg-[#7ed957]/20 text-[#5da83f] border border-[#7ed957]/40 font-bold' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
          }`}
        >{i}</button>
      );
    }
    return pages;
  };

  if (!isOpen) return null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
      onClick={onClose}
    >
      <div
        className="flex flex-col bg-slate-50 overflow-hidden relative shadow-2xl w-full h-full sm:w-[95vw] sm:h-[85vh] lg:w-[1200px] sm:rounded-[24px]"
        style={{ border: '1px solid rgba(255,255,255,0.6)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── FULLSCREEN BARCODE VIEW ───────────────────────────────────── */}
        {selectedProduct ? (
          <div className="absolute inset-0 z-10 bg-white flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <button onClick={() => setSelectedProduct(null)} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-semibold transition-colors">
                <ChevronLeft className="w-5 h-5" /> Geri Dön
              </button>
              <div className="flex gap-3">
                {onAddToCart && (
                  <button
                    onClick={() => handleAddToCartFromBarcode(selectedProduct)}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl font-bold transition-colors border"
                    style={{ background: 'rgba(126,217,87,0.12)', border: '1px solid rgba(126,217,87,0.3)', color: 'rgb(58,128,36)' }}
                  >
                    {addedId === selectedProduct.id ? <CheckCircle className="w-4 h-4" /> : <ScanBarcode className="w-4 h-4" />}
                    {addedId === selectedProduct.id ? 'Eklendi!' : 'Sepete Ekle'}
                  </button>
                )}
                <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-10">
              <h2 className="text-2xl lg:text-4xl font-black text-slate-800 text-center mb-8 lg:mb-12 max-w-4xl">{selectedProduct.name}</h2>
              <div className="bg-white p-6 lg:p-8 rounded-3xl border-2 border-slate-200 shadow-2xl overflow-hidden w-full max-w-md flex justify-center">
                <Barcode value={selectedProduct.barcode} width={2.5} height={100} fontSize={20} background="#ffffff" lineColor="#000000" margin={10} displayValue={true} />
              </div>
            </div>
          </div>
        ) : showPicker ? (
          /* ── ÜRÜN SEÇİCİ VIEW ─────────────────────────────────────────── */
          <div className="flex flex-col h-full">
            {/* Picker Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-200 bg-white shadow-sm gap-4 sm:gap-0">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={() => { setShowPicker(false); setPickerQuery(''); setPickerPage(1); }}
                  className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-semibold transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-10 h-10 bg-[#7ed957]/15 rounded-xl flex items-center justify-center border border-[#7ed957]/30 shrink-0">
                  <Package className="w-5 h-5 text-[#5da83f]" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-black text-slate-800 tracking-tight">Ürün Seç</h2>
                  <p className="text-xs text-slate-500 font-medium">Hızlı barkodlar listesine ekle</p>
                </div>
                {/* Mobile close button at top right */}
                <button onClick={onClose} className="sm:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors shrink-0">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Ürün adı veya barkod..."
                    value={pickerQuery}
                    onChange={e => { setPickerQuery(e.target.value); setPickerPage(1); }}
                    className="w-full pl-9 pr-4 py-2 text-sm border-2 border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-[#7ed957] focus:bg-white transition-all font-semibold"
                  />
                </div>
                <button onClick={onClose} className="hidden sm:flex w-10 h-10 items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors shrink-0">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Picker List */}
            <div className="flex flex-col flex-1 overflow-hidden p-6">
              {isLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 border-2 border-[#7ed957] border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-slate-400 font-medium">Ürünler yükleniyor...</p>
                </div>
              ) : pickerFiltered.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3">
                  <Package className="w-10 h-10 text-slate-300" />
                  <p className="text-slate-500 font-semibold">Ürün bulunamadı</p>
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto space-y-2">
                    {pickerItems.map(product => {
                      const alreadyPinned = pinnedIds.has(product.id);
                      return (
                        <div
                          key={product.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between bg-white rounded-xl border border-slate-200 p-3 hover:border-[#7ed957]/50 hover:shadow-sm transition-all gap-3 sm:gap-0"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-9 h-9 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100 flex-shrink-0">
                              <Package className="w-4 h-4 text-slate-400" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-800 truncate">{product.name}</p>
                              <p className="text-[10px] font-mono text-slate-400 mt-0.5">{product.barcode}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0 sm:ml-4 w-full sm:w-auto">
                            <span className="text-sm font-black text-[#5da83f]">
                              {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(product.sale_price || 0)}
                            </span>
                            <button
                              onClick={() => handlePickerAdd(product)}
                              disabled={alreadyPinned}
                              className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all w-24 sm:w-auto ${
                                alreadyPinned
                                  ? 'bg-[#7ed957]/15 text-[#5da83f] border border-[#7ed957]/30 cursor-default'
                                  : 'bg-white border border-[#7ed957]/40 text-[#5da83f] hover:bg-[#7ed957]/10 active:scale-95'
                              }`}
                            >
                              {alreadyPinned ? <CheckCircle className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                              {alreadyPinned ? 'Eklendi' : 'Ekle'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Picker Pagination */}
                  {pickerTotalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200 flex-none">
                      <div className="text-sm text-slate-500 font-bold">{pickerFiltered.length} ürün — Sayfa {pickerPage}/{pickerTotalPages}</div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setPickerPage(p => Math.max(1, p - 1))} disabled={pickerPage === 1}
                          className="w-8 h-8 flex items-center justify-center rounded-xl bg-white border-2 border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        {renderPageBtns(pickerPage, pickerTotalPages, setPickerPage)}
                        <button onClick={() => setPickerPage(p => Math.min(pickerTotalPages, p + 1))} disabled={pickerPage === pickerTotalPages}
                          className="w-8 h-8 flex items-center justify-center rounded-xl bg-white border-2 border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          /* ── BARKOD GRID VIEW ─────────────────────────────────────────── */
          <>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-200 bg-white shadow-sm z-10 gap-4 sm:gap-0">
              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#7ed957]/15 rounded-xl flex items-center justify-center border border-[#7ed957]/30 shrink-0">
                    <ScanBarcode className="w-5 h-5 text-[#5da83f]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-800 tracking-tight">Hızlı Barkodlar</h2>
                    <p className="text-[10px] sm:text-xs text-slate-500 font-medium line-clamp-1">Ürüne tıklayarak barkodunu görüntüleyin</p>
                  </div>
                </div>
                {/* Mobile close button */}
                <button onClick={onClose} className="sm:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors shrink-0">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={() => { setShowPicker(true); setPickerQuery(''); setPickerPage(1); }}
                  className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-[#7ed957] text-white rounded-xl font-bold hover:bg-[#6cc549] transition-colors shadow-sm shrink-0 text-sm"
                >
                  <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Ürün Ekle</span><span className="sm:hidden">Ekle</span>
                </button>
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Ara..."
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-sm border-2 border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-[#7ed957] focus:bg-white transition-all font-semibold"
                  />
                </div>
                <button onClick={onClose} className="hidden sm:flex w-10 h-10 items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors shrink-0">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex flex-col flex-1 overflow-hidden p-6">
              {isLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3">
                  <div className="w-10 h-10 border-2 border-[#7ed957] border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-slate-400 font-medium">Barkodlar yükleniyor...</p>
                </div>
              ) : displayedBarcodeProducts.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                    <ScanBarcode className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="text-slate-700 font-bold text-lg">Barkodlu ürün bulunamadı</p>
                  <p className="text-slate-400 text-sm mt-1">Ürün eklemek için "Ürün Ekle" butonuna tıklayın</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto sm:overflow-visible">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 h-full content-start lg:grid-rows-5">
                    {currentItems.map(product => (
                      <div
                        key={product.id}
                        onClick={() => setSelectedProduct(product)}
                        className={`bg-white border-2 hover:border-[#7ed957] rounded-2xl flex flex-col items-center justify-center p-3 transition-all cursor-pointer hover:shadow-lg group min-h-[100px] ${
                          pinnedIds.has(product.id) ? 'border-[#7ed957]/40 bg-[#7ed957]/5' : 'border-slate-100'
                        }`}
                      >
                        <h3 className="text-sm font-bold text-slate-800 text-center leading-tight line-clamp-2 group-hover:text-[#5da83f] transition-colors">
                          {product.name}
                        </h3>
                        <div className="mt-2 text-[10px] font-bold tracking-wider text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100 group-hover:bg-[#7ed957]/10 group-hover:border-[#7ed957]/30 group-hover:text-[#5da83f] transition-colors max-w-full truncate">
                          {product.barcode}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!isLoading && displayedBarcodeProducts.length > 0 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200 flex-none px-2">
                  <div className="text-sm text-slate-500 font-bold">{displayedBarcodeProducts.length} ürün — Sayfa {currentPage}/{totalPages}</div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                      className="w-8 h-8 flex items-center justify-center rounded-xl bg-white border-2 border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {renderPageBtns(currentPage, totalPages, setCurrentPage)}
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                      className="w-8 h-8 flex items-center justify-center rounded-xl bg-white border-2 border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
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
