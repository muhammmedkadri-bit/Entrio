import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';
import toast from '../../components/ui/CustomToast';
import {
  ArrowLeft, Package, Barcode, Tag, Layers, TrendingUp, TrendingDown, Percent,
  Pencil, RefreshCw, Archive, Trash2, ChevronDown,
  ArrowLeftRight, ShoppingCart, Truck, Info, Warehouse,
  Search, CheckCircle, Hash
} from 'lucide-react';
import { productService } from '../../services/productService';
import { stockService } from '../../services/stockService';
import { saleService } from '../../services/saleService';
import { purchaseService } from '../../services/purchaseService';
import { categoryService } from '../../services/categoryService';
import { supplierService } from '../../services/supplierService';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { PremiumLoader } from '../../components/ui/PremiumLoader';
import { StockMovementsTab } from './tabs/detail/StockMovementsTab';
import { SalesHistoryTab } from './tabs/detail/SalesHistoryTab';
import { PurchaseHistoryTab } from './tabs/detail/PurchaseHistoryTab';
import { ProductInfoTab } from './tabs/detail/ProductInfoTab';
import { WarehousePlaceholderTab } from './tabs/detail/WarehousePlaceholderTab';
import { StockUpdateModal } from './modals/StockUpdateModal';
import { ProductFormModal } from './modals/ProductFormModal';

const fmt = (v) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(v || 0);

const StatCard = ({ label, value, icon: Icon, colorClass, iconColorClass }) => (
  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${colorClass}`}>
    <Icon className={`w-3.5 h-3.5 ${iconColorClass || 'opacity-70'}`} />
    <span className="text-xs font-medium opacity-70">{label}:</span>
    <span className="text-xs font-bold tabular-nums ml-0.5">{value}</span>
  </div>
);

const TABS = [
  { id: 'stock_movements', label: 'Stok Hareketleri', icon: ArrowLeftRight },
  { id: 'sales', label: 'Satış Hareketleri', icon: ShoppingCart },
  { id: 'purchases', label: 'Alış Hareketleri', icon: Truck },
  { id: 'warehouse', label: 'Depo Stokları', icon: Warehouse, disabled: true },
];

export const ProductDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { startNavigation } = useAppStore();
  const productId = parseInt(id);

  const [product, setProduct] = useState(null);
  const [movements, setMovements] = useState([]);
  const [salesHistory, setSalesHistory] = useState([]);
  const [purchaseHistory, setPurchaseHistory] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('stock_movements');

  // Dropdown / popup states
  const [showOtherMenu, setShowOtherMenu] = useState(false);
  const [showCatPopup, setShowCatPopup] = useState(false);
  const [catSearch, setCatSearch] = useState('');

  const otherMenuRef = useRef(null);
  const catPopupRef = useRef(null);

  // Modals
  const [showEdit, setShowEdit] = useState(false);
  const [showStockUpdate, setShowStockUpdate] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteBlocked, setDeleteBlocked] = useState(false);
  const [archiveSaving, setArchiveSaving] = useState(false);
  const [deleteSaving, setDeleteSaving] = useState(false);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (otherMenuRef.current && !otherMenuRef.current.contains(e.target)) setShowOtherMenu(false);
      if (catPopupRef.current && !catPopupRef.current.contains(e.target)) {
        setShowCatPopup(false);
        setCatSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [prod, movs, sales, purchases, cats, supps] = await Promise.all([
        productService.getById(productId),
        stockService.getMovements({ product_id: productId }),
        saleService.getByProductId(productId),
        purchaseService.getByProductId(productId),
        categoryService.getAll(),
        supplierService.getAll ? supplierService.getAll() : Promise.resolve([]),
      ]);
      setProduct(prod);
      setMovements(movs);
      setSalesHistory(sales);
      setPurchaseHistory(purchases);
      setCategories(cats);
      setSuppliers(supps);
      setDeleteBlocked(sales.length > 0 || purchases.length > 0 || movs.length > 0);
    } catch (e) {
      console.error('[ProductDetail] Yükleme hatası:', e);
      toast.error('Ürün detayı yüklenemedi: ' + (e?.message || 'Bilinmeyen hata'));
      navigate('/stock');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, [productId]);

  const categoryName = categories.find(c => c.id === product?.category_id)?.name || '—';
  const supplierName = suppliers.find(s => s.id === product?.supplier_id)?.name || '—';

  const margin = product && product.purchase_price > 0
    ? ((product.sale_price - product.purchase_price) / product.purchase_price * 100).toFixed(1)
    : null;
  const marginColor =
    margin > 30 ? 'text-emerald-600 bg-emerald-50 border-emerald-200' :
    margin > 10 ? 'text-yellow-600 bg-yellow-50 border-yellow-200' :
    'text-red-600 bg-red-50 border-red-200';

  const stockColor =
    !product ? '' :
    product.stock_quantity > (product.min_stock_level || 0) ? 'text-[#5da83f] bg-white border-[#82e05a]/30 shadow-sm' :
    product.stock_quantity > 0 ? 'text-[#5da83f] bg-white border-[#82e05a]/30 shadow-sm' :
    'text-[#5da83f] bg-white border-[#82e05a]/30 shadow-sm';

  const handleCategorySelect = async (cat) => {
    if (cat.id === product.category_id) { setShowCatPopup(false); return; }
    try {
      await productService.update(productId, { category_id: cat.id });
      setProduct(prev => ({ ...prev, category_id: cat.id }));
      toast.success('Kategori güncellendi.');
      setShowCatPopup(false);
      setCatSearch('');
    } catch (e) {
      console.error('[ProductDetail] Kategori güncelleme hatası:', e);
      toast.error(e?.message || 'Kategori güncellenirken beklenmeyen bir hata oluştu.');
    }
  };

  const handleToggleArchive = async () => {
    setArchiveSaving(true);
    try {
      await productService.update(productId, { is_active: !product.is_active });
      toast.success(product.is_active ? 'Ürün arşivlendi.' : 'Ürün aktive edildi.');
      setShowArchive(false);
      loadAll();
    } catch (e) {
      console.error('[ProductDetail] Arşivleme hatası:', e);
      toast.error(e?.message || 'Ürün arşivlenirken beklenmeyen bir hata oluştu.');
    } finally {
      setArchiveSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleteSaving(true);
    try {
      await productService.delete(productId);
      toast.success('Ürün silindi.');
      navigate('/stock');
    } catch (e) {
      console.error('[ProductDetail] Silme hatası:', e);
      toast.error(e?.message || 'Ürün silinirken beklenmeyen bir hata oluştu.');
    } finally {
      setDeleteSaving(false);
    }
  };

  const filteredCats = categories.filter(c =>
    c.name.toLowerCase().includes(catSearch.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full gap-4 relative">
      

      {product && (
        <>
          {/* Breadcrumb + Back */}
          <div>
            <button
              onClick={() => {
                startNavigation();
                setTimeout(() => navigate('/stock'), 150);
              }}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors bg-white/60 backdrop-blur border border-white/60 shadow-sm px-3 py-1.5 rounded-xl"
            >
              <ArrowLeft className="w-4 h-4" /> Stok Yönetimi
            </button>
          </div>

          {/* Hero Section */}
          <div
            className="rounded-2xl border p-5 relative z-50"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(240,253,244,0.8) 100%)',
              backdropFilter: 'blur(20px)',
              borderColor: 'rgba(16,185,129,0.15)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
            }}
          >
            <div className="flex items-start justify-between gap-6 flex-wrap relative">
              {/* Left: Identity */}
              <div className="flex items-start gap-4 relative z-[110]">
                <div 
                  className="p-3 rounded-2xl flex-shrink-0 border"
                  style={{
                    background: 'rgba(130, 224, 90, 0.15)',
                    backdropFilter: 'blur(12px)',
                    borderColor: 'rgba(130, 224, 90, 0.3)',
                    boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.4)',
                  }}
                >
                  <Package className="w-9 h-9" style={{ color: '#82e05a' }} strokeWidth={1.5} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <h1 className="text-xl font-bold text-gray-900">{product.name}</h1>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                    <span className="flex items-center gap-1 font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full border border-gray-200">
                      <Barcode className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate max-w-[120px]">{product.barcode}</span>
                    </span>
                    {product.sku && (
                      <span className="flex items-center gap-1 font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full border border-gray-200">
                        <Hash className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate max-w-[100px]">{product.sku}</span>
                      </span>
                    )}
                    {/* Category Pill Dropdown */}
                    <div className="relative z-[120]" ref={catPopupRef}>
                      <button
                        onClick={() => { setShowCatPopup(v => !v); setShowOtherMenu(false); setCatSearch(''); }}
                        className={`inline-flex items-center gap-1 text-xs font-medium font-sans px-2 py-0.5 rounded-full border cursor-pointer select-none transition-all ${
                          showCatPopup
                            ? 'bg-[#82e05a]/25 text-[#5da83f] border-[#82e05a]/40 backdrop-blur-md shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)]'
                            : 'bg-[#82e05a]/15 text-[#5da83f] border-[#82e05a]/30 backdrop-blur-md shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)] hover:bg-[#82e05a]/25 hover:border-[#82e05a]/40'
                        }`}
                      >
                        <Tag className="w-3 h-3 shrink-0" />
                        <span className="truncate max-w-[120px]">{categoryName}</span>
                        <ChevronDown className={`w-3 h-3 shrink-0 transition-transform duration-150 ${showCatPopup ? 'rotate-180' : ''}`} />
                      </button>

                      {/* Category Popup */}
                      {showCatPopup && (
                        <div
                          className="absolute left-0 top-full mt-1 z-[9999]"
                          style={{
                            background: 'rgba(255,255,255,0.96)',
                            backdropFilter: 'blur(20px)',
                            border: '1px solid rgba(226,232,240,0.8)',
                            boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
                            borderRadius: 12,
                            padding: 6,
                            minWidth: 200,
                            maxHeight: 280,
                            overflowY: 'auto',
                          }}
                        >
                          <div className="flex items-center gap-2 px-2 py-1.5 mb-1 border border-gray-100 rounded-lg bg-gray-50">
                            <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <input
                              autoFocus
                              value={catSearch}
                              onChange={e => setCatSearch(e.target.value)}
                              placeholder="Kategori ara..."
                              className="text-xs bg-transparent outline-none w-full text-gray-700 placeholder-gray-400"
                            />
                          </div>
                          {filteredCats.map(cat => {
                            const isActive = cat.id === product.category_id;
                            return (
                              <button
                                key={cat.id}
                                onClick={() => handleCategorySelect(cat)}
                                className={`flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg transition-colors text-left ${
                                  isActive ? 'bg-emerald-50 text-emerald-700 font-medium' : 'hover:bg-gray-50 text-gray-700'
                                }`}
                              >
                                <Tag className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
                                <span className="flex-1">{cat.name}</span>
                                {isActive && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                              </button>
                            );
                          })}
                          {filteredCats.length === 0 && (
                            <p className="text-xs text-gray-400 text-center py-3">Kategori bulunamadı.</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-2 relative z-[100]">
                <button
                  onClick={() => setShowEdit(true)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-xl border bg-[#82e05a]/15 text-[#5da83f] border-[#82e05a]/30 backdrop-blur-md shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)] hover:bg-[#82e05a]/25 hover:border-[#82e05a]/40 transition-all"
                >
                  <Pencil className="w-4 h-4" /> Düzenle
                </button>

                {/* Diğer Dropdown */}
                <div className="relative z-[100]" ref={otherMenuRef}>
                  <button
                    onClick={() => { setShowOtherMenu(v => !v); setShowCatPopup(false); }}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-xl border bg-white/60 text-gray-600 border-gray-200 hover:bg-gray-50 transition-all"
                  >
                    Diğer <ChevronDown className={`w-4 h-4 transition-transform duration-150 ${showOtherMenu ? 'rotate-180' : ''}`} />
                  </button>

                  {showOtherMenu && (
                    <div
                      className="absolute right-0 top-full mt-1 z-[9999]"
                      style={{
                        background: 'rgba(255,255,255,0.95)',
                        backdropFilter: 'blur(16px)',
                        border: '1px solid rgba(226,232,240,0.8)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                        borderRadius: 12,
                        padding: 4,
                        minWidth: 180,
                      }}
                    >
                      <button onClick={() => { setShowStockUpdate(true); setShowOtherMenu(false); }} className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                        <RefreshCw className="w-4 h-4 text-emerald-500" /> Stok Güncelle
                      </button>
                      <button onClick={() => { setShowArchive(true); setShowOtherMenu(false); }} className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                        <Archive className="w-4 h-4 text-orange-400" /> {product.is_active ? 'Arşivle' : 'Arşivden Çıkar'}
                      </button>
                      <div className="my-1 border-t border-gray-100" />
                      <button onClick={() => { setShowDelete(true); setShowOtherMenu(false); }} className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-500 rounded-lg hover:bg-red-50 transition-colors">
                        <Trash2 className="w-4 h-4" /> Sil
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-2 mt-5 pt-4 border-t border-emerald-100/60 flex-wrap">
              {product.track_stock === false ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-slate-500 bg-slate-50 border-slate-200">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs font-medium opacity-70">Mevcut Stok:</span>
                  <span className="text-xs font-bold ml-0.5 italic text-slate-400">Stok takibi yapılmıyor</span>
                </div>
              ) : (
                <StatCard label="Mevcut Stok" value={`${product.stock_quantity} ${product.unit}`} icon={Layers} colorClass={`${stockColor} border`} iconColorClass="text-[#5da83f]" />
              )}
              <StatCard label="Satış" value={fmt(product.sale_price)} icon={TrendingUp} colorClass="text-gray-600 bg-gray-50 border-gray-200" iconColorClass="text-[#82e05a]" />
              <StatCard label="Alış" value={fmt(product.purchase_price)} icon={TrendingDown} colorClass="text-gray-600 bg-gray-50 border-gray-200" iconColorClass="text-rose-500" />
              <StatCard label="Stok Değeri (Alış)" value={fmt((product.stock_quantity || 0) * (product.purchase_price || 0))} icon={Layers} colorClass="text-gray-600 bg-gray-50 border-gray-200" iconColorClass="text-purple-500" />
            </div>
          </div>

          {/* Tab Navigation — no badges */}
          <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md pt-2 pb-1 mb-2 flex gap-1 border-b border-gray-100 overflow-x-auto scrollbar-hide whitespace-nowrap -mx-4 px-4 sm:mx-0 sm:px-0">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => !tab.disabled && setActiveTab(tab.id)}
                  disabled={tab.disabled}
                  title={tab.disabled ? 'Yakında aktif edilecek' : ''}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all duration-150 border-b-2 -mb-px shrink-0 ${
                    tab.disabled
                      ? 'text-gray-300 border-transparent cursor-not-allowed opacity-50'
                      : isActive
                      ? 'border-emerald-500 text-emerald-600 bg-emerald-50/50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="flex-1">
            {activeTab === 'stock_movements' && <StockMovementsTab movements={movements} product={product} />}
            {activeTab === 'sales' && <SalesHistoryTab salesHistory={salesHistory} product={product} />}
            {activeTab === 'purchases' && <PurchaseHistoryTab purchaseHistory={purchaseHistory} product={product} />}
            {activeTab === 'warehouse' && <WarehousePlaceholderTab />}
          </div>
        </>
      )}

      {/* Modals */}
      {product && (
        <>
          <ProductFormModal isOpen={showEdit} onClose={() => setShowEdit(false)} productToEdit={product} onSaved={() => { loadAll(); toast.success('Ürün güncellendi.'); }} />

          <StockUpdateModal isOpen={showStockUpdate} onClose={() => setShowStockUpdate(false)} product={product} onSaved={loadAll} />

          <Modal isOpen={showArchive} onClose={() => setShowArchive(false)} title={product.is_active ? 'Ürünü Arşivle' : 'Arşivden Çıkar'} size="sm">
            <p className="text-sm text-gray-600 mb-6">
              {product.is_active ? 'Bu ürün arşivlenecek. POS ekranında ve aramada görünmeyecek. Stok ve satış geçmişi korunur.' : 'Bu ürün yeniden aktif edilecek ve tüm listelerde görünür hale gelecek.'}
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowArchive(false)}>İptal</Button>
              <Button onClick={handleToggleArchive} isLoading={archiveSaving} className={product.is_active ? 'bg-orange-500 hover:bg-orange-600 text-white border-orange-500' : ''}>
                {product.is_active ? 'Arşivle' : 'Aktif Et'}
              </Button>
            </div>
          </Modal>

          <Modal isOpen={showDelete} onClose={() => setShowDelete(false)} title="Ürünü Sil" size="sm">
            {deleteBlocked ? (
              <div className="rounded-xl bg-orange-50 border border-orange-200 p-4 mb-4">
                <p className="text-sm font-semibold text-orange-700 mb-1">Bu ürün silinemez!</p>
                <p className="text-xs text-orange-600">Satış, alış veya stok hareketi geçmişi bulunuyor. Silmek yerine arşivlemeyi kullanın.</p>
              </div>
            ) : (
              <p className="text-sm text-gray-600 mb-6">Bu ürün kalıcı olarak silinecek. Bu işlem geri alınamaz.</p>
            )}
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowDelete(false)}>İptal</Button>
              {!deleteBlocked
                ? <Button onClick={handleDelete} isLoading={deleteSaving} className="bg-red-500 hover:bg-red-600 text-white border-red-500">Sil</Button>
                : <Button onClick={() => { setShowDelete(false); setShowArchive(true); }} className="bg-orange-500 hover:bg-orange-600 text-white border-orange-500">Arşivle</Button>
              }
            </div>
          </Modal>
        </>
      )}
    </div>
  );
};
