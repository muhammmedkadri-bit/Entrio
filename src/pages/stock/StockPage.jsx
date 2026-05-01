import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Package, Download, Plus, Filter, Tag, Activity, X, Layers } from 'lucide-react';
import toast from 'react-hot-toast';
import { ProductsTab } from './tabs/ProductsTab';
import { ProductFormModal } from './modals/ProductFormModal';
import { StockMovementModal } from './modals/StockMovementModal';
import { ProductDetailDrawer } from './drawers/ProductDetailDrawer';
import { BulkStockUpdateModal } from './modals/BulkStockUpdateModal';
import { productService } from '../../services/productService';
import { categoryService } from '../../services/categoryService';
import { BarcodeInput } from '../../components/ui/BarcodeInput';
import { FilterChipDropdown } from '../../components/ui/FilterChipDropdown';
import { PremiumLoader } from '../../components/ui/PremiumLoader';

export const StockPage = () => {

  // Hoisted Filter States
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [stockStatus, setStockStatus] = useState(null);
  const [categories, setCategories] = useState([]);

  // Loading overlay state
  const [isLoading, setIsLoading] = useState(false);
  const loadingTimerRef = useRef(null);

  const triggerLoader = useCallback(() => {
    setIsLoading(true);
    clearTimeout(loadingTimerRef.current);
    loadingTimerRef.current = setTimeout(() => setIsLoading(false), 800);
  }, []);

  // Trigger loader on filter changes
  const handleCategoryChange = useCallback((val) => {
    triggerLoader();
    setCategoryFilter(val);
  }, [triggerLoader]);

  const handleStockStatusChange = useCallback((val) => {
    triggerLoader();
    setStockStatus(val);
  }, [triggerLoader]);

  useEffect(() => () => clearTimeout(loadingTimerRef.current), []);
  
  // Custom Filter Menu States
  const [activeFilters, setActiveFilters] = useState([]); // ['category', 'stockStatus']
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef(null);

  // Close filter menu if clicked outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target)) {
        setIsFilterMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleFilter = (filterName) => {
    setActiveFilters(prev => {
      if (prev.includes(filterName)) {
        // Remove filter and reset its value
        if (filterName === 'category') setCategoryFilter(null);
        if (filterName === 'stockStatus') setStockStatus(null);
        return prev.filter(f => f !== filterName);
      }
      // Add filter
      return [...prev, filterName];
    });
    setIsFilterMenuOpen(false);
  };

  // Modal States
  const [isProductFormOpen, setProductFormOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState(null);
  
  const [isMovementModalOpen, setMovementModalOpen] = useState(false);
  const [productForMovement, setProductForMovement] = useState(null);
  
  const [isDetailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [productForDetail, setProductForDetail] = useState(null);

  const [isBulkUpdateModalOpen, setBulkUpdateModalOpen] = useState(false);

  // Trigger re-fetches for tabs
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    categoryService.getAll().then(setCategories).catch(e => {
      console.error('[StockPage] Kategori Yükleme Hatası:', e);
      toast.error(e?.message || 'Kategoriler yüklenemedi.');
    });
  }, [refreshKey]);

  // Handlers
  const handleEditProduct = (prod) => {
    setProductToEdit(prod);
    setProductFormOpen(true);
  };

  const handleStockMovement = (prod) => {
    setProductForMovement(prod);
    setMovementModalOpen(true);
  };

  const handleRowClick = (prod) => {
    setProductForDetail(prod);
    setDetailDrawerOpen(true);
  };

  const handleExportCSV = async () => {
    try {
      await productService.exportToCSV({
        search,
        category_id: categoryFilter ? parseInt(categoryFilter) : null,
        stockStatus: stockStatus === 'all' || stockStatus === null ? null : stockStatus
      });
      toast.success('CSV dosyası indirildi.');
    } catch (e) {
      console.error('[StockPage] CSV Dışa Aktarma Hatası:', e);
      toast.error(e?.message || 'CSV dosyası oluşturulurken bir hata oluştu.');
    }
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header and Top Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-50 border border-emerald-100 flex-shrink-0">
            <Package className="w-6 h-6 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Stok</h1>
            <p className="text-sm text-slate-500">Ürünlerinizi, stok hareketlerini ve envanterinizi yönetin.</p>
          </div>
        </div>

      </div>

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
        
        {/* Left Side: Search */}
        <div className="flex flex-col sm:flex-row items-center justify-start gap-3 w-full lg:w-auto">
          {/* Search */}
          <div className="w-full sm:w-96 flex-shrink-0">
            <BarcodeInput 
              onScan={(val) => setSearch(val)}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Barkod veya ürün adı..."
              className="bg-transparent"
            />
          </div>
        </div>

        {/* Right Side: active filter chips + action buttons — tek satır, kayma yok */}
        <div className="flex items-center justify-end gap-2 flex-wrap sm:flex-nowrap w-full lg:w-auto">

          {/* Aktif filtre chip'leri — tema uyumlu custom dropdown */}
          {activeFilters.includes('category') && (
            <FilterChipDropdown
              icon={Tag}
              label="Kategori Seçin"
              value={categoryFilter || ''}
              onChange={handleCategoryChange}
              onClear={() => toggleFilter('category')}
              options={[
                { id: '', label: 'Tüm Kategoriler' },
                ...categories.map(c => ({ id: String(c.id), label: c.name }))
              ]}
            />
          )}
          {activeFilters.includes('stockStatus') && (
            <FilterChipDropdown
              icon={Activity}
              label="Stok Durumu"
              value={stockStatus || ''}
              onChange={handleStockStatusChange}
              onClear={() => toggleFilter('stockStatus')}
              options={[
                { id: '', label: 'Tüm Stok Durumları' },
                { id: 'normal', label: 'Yeterli Stok' },
                { id: 'critical', label: 'Kritik Stok' },
                { id: 'out', label: 'Tükenmiş' },
              ]}
            />
          )}

          {/* Buton grubu — hepsi aynı yükseklik py-2.5, hiç kayma yok */}
          <div className="flex items-center gap-2 shrink-0">

            {/* Native Filtre butonu — AnimatedDropdown sarmalayıcısı yok */}
            <div className="relative" ref={filterMenuRef}>
              <button
                onClick={() => setIsFilterMenuOpen(o => !o)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-sm transition-all whitespace-nowrap"
              >
                <Filter className="w-4 h-4" />
                Filtre
                {activeFilters.length > 0 && (
                  <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-[#5da83f] text-white text-[10px] font-bold px-1">
                    {activeFilters.length}
                  </span>
                )}
              </button>
              {isFilterMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 z-50 w-52 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden py-1">
                  {[
                    { id: 'category', label: 'Kategori', Icon: Tag },
                    { id: 'stockStatus', label: 'Stok Durumu', Icon: Activity },
                  ].map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      onClick={() => toggleFilter(id)}
                      className="w-full px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                    >
                      <span className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-slate-400" />
                        {label}
                      </span>
                      {activeFilters.includes(id) && (
                        <span className="text-[10px] font-bold text-[#5da83f] bg-[#82e05a]/10 px-1.5 py-0.5 rounded">Aktif</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-sm transition-all whitespace-nowrap"
            >
              <Download className="w-4 h-4" /> Excel
            </button>

            <button
              onClick={() => setBulkUpdateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-sm transition-all whitespace-nowrap"
            >
              <Layers className="w-4 h-4" /> Toplu Stok Güncelleme
            </button>

            <button
              onClick={() => handleEditProduct(null)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold bg-[#5da83f] hover:bg-[#4b8a32] text-white rounded-lg shadow-sm transition-all whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> Yeni Ürün
            </button>
          </div>

        </div>
      </div>

      {/* Tabs Content */}
      <div className="flex-1 mt-1 relative">
        <ProductsTab 
          key={refreshKey}
          search={search}
          categoryFilter={categoryFilter}
          stockStatus={stockStatus}
          onEditProduct={handleEditProduct}
          onStockMovement={handleStockMovement}
        />
        <PremiumLoader isOpen={isLoading} />
      </div>

      {/* Modals & Drawers */}
      <ProductFormModal 
        isOpen={isProductFormOpen}
        onClose={() => setProductFormOpen(false)}
        productToEdit={productToEdit}
        onSaved={() => setRefreshKey(prev => prev + 1)}
      />

      <StockMovementModal 
        isOpen={isMovementModalOpen}
        onClose={() => setMovementModalOpen(false)}
        product={productForMovement}
        onSaved={() => setRefreshKey(prev => prev + 1)}
      />

      <ProductDetailDrawer 
        isOpen={isDetailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
        product={productForDetail}
        onEditClick={handleEditProduct}
        onMovementClick={handleStockMovement}
      />

      <BulkStockUpdateModal 
        isOpen={isBulkUpdateModalOpen}
        onClose={() => setBulkUpdateModalOpen(false)}
        onSaved={() => setRefreshKey(prev => prev + 1)}
      />
    </div>
  );
};
