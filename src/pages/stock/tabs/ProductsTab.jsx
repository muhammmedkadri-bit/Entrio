import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tag, AlertCircle, Package, ChevronLeft, ChevronRight, ChevronRight as Arrow, PackageX } from 'lucide-react';
import toast from '../../../components/ui/CustomToast';
import { useProducts } from '../../../hooks/useProducts';
import { useCategories } from '../../../hooks/useCategories';
import { productService } from '../../../services/productService';
import { useAppStore } from '../../../store/appStore';

const fmt = (v) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(v || 0);

const ITEMS_PER_PAGE = 10;

const ProductRowSkeleton = () => (
  <div className="grid items-center px-4 py-[13px] border-b border-slate-100 last:border-0" style={{ gridTemplateColumns: '2.5fr 1.2fr 1fr 1fr 1fr 32px' }}>
    <div className="flex items-center gap-3 min-w-0 pr-4">
      <div className="w-9 h-9 rounded-lg bg-slate-100 animate-pulse flex-shrink-0" />
      <div className="flex flex-col gap-1 w-full">
        <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4" />
        <div className="h-2.5 bg-slate-100 rounded animate-pulse w-1/2" />
      </div>
    </div>
    <div>
      <div className="h-5 bg-slate-100 rounded-full animate-pulse w-24" />
    </div>
    <div className="flex justify-end">
      <div className="h-4 bg-slate-100 rounded animate-pulse w-16" />
    </div>
    <div className="flex justify-end">
      <div className="h-4 bg-slate-100 rounded animate-pulse w-16" />
    </div>
    <div className="flex justify-center">
      <div className="h-5 bg-slate-100 rounded animate-pulse w-14" />
    </div>
    <div className="flex justify-end">
      <div className="w-4 h-4 bg-slate-100 rounded animate-pulse" />
    </div>
  </div>
);

export const ProductsTab = ({ search, categoryFilter, stockStatus, onEditProduct, onStockMovement }) => {
  const navigate = useNavigate();
  const { startNavigation } = useAppStore();
  const [currentPage, setCurrentPage] = useState(1);

  // Cache-aware data hooks — instant on 2nd+ visit
  const { products: rawProducts, loading } = useProducts();
  const { categories } = useCategories();

  // Enrich products with categoryName
  const allProducts = React.useMemo(() => {
    if (!rawProducts.length) return [];
    const catMap = Object.fromEntries(categories.map(c => [c.id, c.name]));
    return rawProducts.map(p => ({ ...p, categoryName: catMap[p.category_id] || 'Kategorisiz' }));
  }, [rawProducts, categories]);

  // Client-side filtering — no extra DB calls
  const products = React.useMemo(() => {
    let res = [...allProducts];
    if (search) {
      const q = search.toLowerCase();
      res = res.filter(p =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.includes(search))
      );
    }
    if (categoryFilter) res = res.filter(p => p.category_id === parseInt(categoryFilter));
    if (stockStatus && stockStatus !== 'all') {
      res = res.filter(p => {
        const min = p.min_stock_level || 0;
        if (stockStatus === 'normal') return p.stock_quantity > min;
        if (stockStatus === 'critical') return p.stock_quantity <= min && p.stock_quantity > 0;
        if (stockStatus === 'out') return p.stock_quantity <= 0;
        return true;
      });
    }
    return res;
  }, [allProducts, search, categoryFilter, stockStatus]);

  useEffect(() => { setCurrentPage(1); }, [search, categoryFilter, stockStatus]);

  const totalPages = Math.max(1, Math.ceil(products.length / ITEMS_PER_PAGE));
  const paginatedProducts = products.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, products.length);

  const renderPaginationButtons = () => {
    const maxVisible = 5;
    let s = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let e = Math.min(totalPages, s + maxVisible - 1);
    if (e - s + 1 < maxVisible) s = Math.max(1, e - maxVisible + 1);
    return Array.from({ length: e - s + 1 }, (_, i) => s + i).map(i => (
      <button
        key={i}
        onClick={() => setCurrentPage(i)}
        className={`flex items-center justify-center w-7 h-7 text-xs rounded-lg transition-colors ${
          currentPage === i
            ? 'bg-[#7ed957]/10 border border-[#7ed957]/30 text-[#5da83f] font-semibold'
            : 'sm:bg-white/20 bg-white sm:backdrop-blur-md border sm:border-white/40 border-gray-200 sm:shadow-[0_4px_16px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.7)] text-gray-500 hover:bg-gray-50'
        }`}
      >{i}</button>
    ));
  };

  const getStockStyle = (p) => {
    if (p.track_stock === false) return { bg: 'rgba(156,163,175,0.12)', text: '#4b5563', border: 'rgba(156,163,175,0.25)', label: 'Takipsiz', warn: false };
    const stock = p.stock_quantity ?? 0;
    const min = p.min_stock_level || 0;
    if (stock <= 0) return { bg: 'rgba(244,63,94,0.12)', text: '#e11d48', border: 'rgba(244,63,94,0.25)', label: `${stock} ${p.unit}`, warn: false };
    if (stock <= min) return { bg: 'rgba(249,115,22,0.12)', text: '#c2410c', border: 'rgba(249,115,22,0.25)', label: `${stock} ${p.unit}`, warn: true };
    return { bg: 'rgba(126,217,87,0.15)', text: '#5da83f', border: 'rgba(126,217,87,0.3)', label: `${stock} ${p.unit}`, warn: false };
  };

  return (
    <div className="relative pb-14">
      {/*
        Outer card: auto height so it grows to fit exactly the rows present.
        No overflow-y-auto → no internal scroll needed for ≤10 rows.
      */}
      <div className="hidden sm:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* ─── Column header ─── */}
        <div className="grid items-center px-4 py-3 border-b border-slate-100 bg-slate-50/80" style={{ gridTemplateColumns: '2.5fr 1.2fr 1fr 1fr 1fr 32px' }}>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Ürün</span>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Kategori</span>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">Alış</span>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">Satış</span>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">Stok</span>
          <span />
        </div>

        {/* ─── Rows ─── */}
        {loading ? (
          <div className="divide-y divide-slate-100">
            {[...Array(5)].map((_, i) => (
              <ProductRowSkeleton key={i} />
            ))}
          </div>
        ) : paginatedProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
            <PackageX className="w-10 h-10 opacity-30" />
            <span className="text-sm font-medium">Listelenecek ürün bulunamadı.</span>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {paginatedProducts.map(product => {
              const ss = getStockStyle(product);
              return (
                <div
                  key={product.id}
                  onClick={() => { startNavigation(); setTimeout(() => navigate(`/stock/product/${product.id}`), 150); }}
                  className="grid items-center px-4 py-[13px] hover:bg-slate-50/80 cursor-pointer transition-colors group"
                  style={{ gridTemplateColumns: '2.5fr 1.2fr 1fr 1fr 1fr 32px' }}
                >
                  {/* Product */}
                  <div className="flex items-center gap-3 min-w-0 pr-4">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#7ed957]/10 border border-[#7ed957]/20 flex-shrink-0">
                      <Package className="w-4.5 h-4.5 text-[#7ed957]" style={{ width: 18, height: 18 }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate group-hover:text-[#5da83f] transition-colors leading-tight">
                        {product.name}
                      </p>
                      <p
                        className="text-[10px] text-slate-400 font-mono mt-0.5 truncate hover:text-slate-600 transition-colors"
                        onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(product.barcode); toast.success('Barkod kopyalandı.'); }}
                        title="Panoya kopyala"
                      >
                        {product.barcode}
                      </p>
                    </div>
                  </div>

                  {/* Kategori */}
                  <div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full max-w-[148px]">
                      <Tag className="w-3 h-3 flex-shrink-0 opacity-70" />
                      <span className="truncate">{product.categoryName}</span>
                    </span>
                  </div>

                  {/* Alış */}
                  <div className="text-right">
                    <span className="text-[13px] font-semibold text-slate-400 tabular-nums">{fmt(product.purchase_price)}</span>
                  </div>

                  {/* Satış */}
                  <div className="text-right">
                    <span className="text-[14px] font-extrabold text-[#5da83f] tracking-tight tabular-nums">{fmt(product.sale_price)}</span>
                  </div>

                  {/* Stok */}
                  <div className="flex items-center justify-center gap-1.5">
                    <span
                      className="text-[11px] font-bold px-2.5 py-1 rounded-md whitespace-nowrap tabular-nums"
                      style={{ background: ss.bg, color: ss.text, border: `1px solid ${ss.border}` }}
                    >
                      {ss.label}
                    </span>
                    {ss.warn && <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                  </div>

                  {/* Arrow */}
                  <div className="flex justify-end">
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#7ed957] transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          MOBILE: Cards (sm:hidden)
      ══════════════════════════════════════════════════════════════ */}
      <div className="sm:hidden space-y-2">
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-3 h-24 animate-pulse flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-lg shrink-0"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-slate-100 rounded w-3/4"></div>
                  <div className="h-2 bg-slate-100 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : paginatedProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400">
            <PackageX className="w-8 h-8 opacity-30" />
            <p className="text-sm font-medium">Listelenecek ürün bulunamadı.</p>
          </div>
        ) : (
          paginatedProducts.map(product => {
            const ss = getStockStyle(product);
            return (
              <div
                key={product.id}
                onClick={() => { startNavigation(); setTimeout(() => navigate(`/stock/product/${product.id}`), 150); }}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden active:scale-[0.99] cursor-pointer hover:border-[#82e05a]/50 hover:shadow-sm transition-all"
              >
                {/* Header: Name, Barcode & Category */}
                <div className="flex items-start justify-between p-3 border-b border-slate-50 gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#7ed957]/10 border border-[#7ed957]/20 shrink-0">
                      <Package className="w-5 h-5 text-[#7ed957]" />
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-sm font-bold text-slate-800 leading-tight truncate">{product.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-slate-400 font-mono" onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(product.barcode); toast.success('Barkod kopyalandı.'); }}>{product.barcode}</span>
                      </div>
                    </div>
                  </div>
                  {/* Category Tag */}
                  <div className="shrink-0 mt-0.5">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                      <Tag className="w-2.5 h-2.5 opacity-70" />
                      {product.categoryName}
                    </span>
                  </div>
                </div>
                
                {/* Body: Price & Stock */}
                <div className="px-3 py-2.5 flex items-center justify-between bg-slate-50/50">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Satış Fiyatı</span>
                    <span className="text-sm font-black text-[#5da83f] tabular-nums">{fmt(product.sale_price)}</span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1.5">
                      {ss.warn && <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md tabular-nums" style={{ background: ss.bg, color: ss.text, border: `1px solid ${ss.border}` }}>
                        Stok: {ss.label}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {products.length > 0 && (
        <div className="mt-4 mb-6 sm:mb-0 sm:fixed sm:bottom-5 sm:right-6 flex items-center justify-between sm:justify-end gap-3 z-20 print:hidden">
          <span className="text-xs text-gray-400 font-semibold">
            {products.length} ürün içinde {startItem}–{endItem}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center justify-center w-7 h-7 rounded-lg sm:bg-white/20 bg-white sm:backdrop-blur-md border sm:border-white/40 border-gray-200 sm:shadow-[0_4px_16px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.7)] text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {renderPaginationButtons()}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center justify-center w-7 h-7 rounded-lg sm:bg-white/20 bg-white sm:backdrop-blur-md border sm:border-white/40 border-gray-200 sm:shadow-[0_4px_16px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.7)] text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
