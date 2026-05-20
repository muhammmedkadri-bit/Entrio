import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { PremiumLoader } from '../../components/ui/PremiumLoader';
import { CheckCircle2, ShoppingCart, User as UserIcon, Banknote, CreditCard, Building2, Shuffle, SplitSquareHorizontal, UserCheck, LayoutGrid, ArrowLeftRight, X, Zap, Package, ChevronDown, ScanBarcode } from 'lucide-react';
import toast from '../../components/ui/CustomToast';
import { useCartStore } from '../../store/cartStore';
import { useAuthStore } from '../../store/authStore';
import { useProducts } from '../../hooks/useProducts';
import { useCashRegisters } from '../../hooks/useCashRegisters';
import { useCacheStore } from '../../store/cacheStore';
import { productService } from '../../services/productService';
import { saleService } from '../../services/saleService';
import { purchaseService } from '../../services/purchaseService';
import { cashService } from '../../services/cashService';
import { settingsService } from '../../services/settingsService';
import { BarcodeInput } from '../../components/ui/BarcodeInput';
import { ProductCard } from './ProductCard';
import { CartItem } from './CartItem';
import { CustomerSearchModal } from './CustomerSearchModal';
import { SupplierSearchModal } from './SupplierSearchModal';
import { ReturnSaleSelectionModal } from './ReturnSaleSelectionModal';
import { QuickProductModal } from './QuickProductModal';
import { ReceiptModal } from './ReceiptModal';
import { ProductSearchDropdown } from './components/ProductSearchDropdown';
import { QuickProductManagerModal } from './components/QuickProductManagerModal';
import { SwapConfirmModal } from './components/SwapConfirmModal';
import { CartDiscountSection } from './components/CartDiscountSection';
import { SupplierPaymentModal } from './components/SupplierPaymentModal';
import { RemoveProductModal } from './components/RemoveProductModal';
import { QuickBarcodesModal } from '../dashboard/modals/QuickBarcodesModal';
import { MobilePOS } from './components/MobilePOS';
import { db } from '../../db';
import { generateSaleNumber } from '../../utils/invoiceUtils';
import { supabase } from '../../lib/supabaseClient';
import { isSupabase } from '../../config/database';

const formatCurrency = (val) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);
const LS_KEY = 'entrio_pos_quick_products_v2';

const gridVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04 }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 15, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 350, damping: 25 } }
};

const ProductSkeleton = () => (
  <div className="p-3 bg-white border border-slate-100 rounded-xl flex flex-col h-[234px] animate-pulse shadow-sm">
    {/* Top Row: Icon & Barcode */}
    <div className="flex items-center justify-center gap-3 w-full mb-1">
      <div className="w-9 h-9 rounded-lg bg-slate-200/60 flex-shrink-0"></div>
      <div className="h-9 px-3 rounded-lg flex-1 bg-slate-100/60"></div>
    </div>
    
    {/* Name Area */}
    <div className="flex flex-col items-center justify-center my-1 h-[2.5rem] gap-1.5">
      <div className="w-4/5 h-3 bg-slate-200/70 rounded-full"></div>
      <div className="w-1/2 h-3 bg-slate-100 rounded-full"></div>
    </div>
    
    {/* Price Area */}
    <div className="flex justify-center mt-1 mb-1">
      <div className="w-20 h-5 bg-slate-200/80 rounded-md"></div>
    </div>
    
    {/* Stock Pill Area */}
    <div className="flex justify-center mb-2">
      <div className="w-16 h-5 bg-slate-100 rounded-md"></div>
    </div>
    
    {/* Bottom Block */}
    <div className="mt-auto flex flex-col justify-end items-center">
      <div className="h-8 w-full max-w-[140px] bg-slate-100 rounded-[6px] mt-2 mb-1"></div>
      <div className="h-[31px] w-full bg-slate-200/60 rounded-lg mt-1"></div>
    </div>
  </div>
);

/* ─── Integrated Payment Card: button + inline register picker ─────────── */
const PaymentCard = ({ btn, isActive, isDimmed, activeStyle, regOptions, selectedReg, onSelect, onRegChange }) => {
  const Icon = btn.icon;
  const [regOpen, setRegOpen] = useState(false);
  const regRef = useRef(null);
  const hasRegs = regOptions && regOptions.length > 0;
  const selectedRegObj = hasRegs ? regOptions.find(r => String(r.id) === String(selectedReg)) : null;

  useEffect(() => {
    const h = (e) => { if (regRef.current && !regRef.current.contains(e.target)) setRegOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const inactiveStyle = {
    background: 'rgba(248,250,252,0.85)',
    borderColor: isDimmed ? '#b8c4ce' : 'rgba(203,213,225,0.9)',
    backdropFilter: 'blur(8px)',
    boxShadow: isDimmed ? 'none' : '0 1px 4px rgba(0,0,0,0.05)',
    opacity: isDimmed ? 0.65 : 1,
    filter: isDimmed ? 'grayscale(0.35)' : 'none',
    transform: isDimmed ? 'scale(0.99)' : 'scale(1)',
  };

  return (
    <div
      className="relative flex rounded-xl border overflow-visible transition-all duration-200"
      style={isActive ? { ...activeStyle, backdropFilter: 'blur(8px)' } : inactiveStyle}
    >
      {/* Left: payment selector */}
      <button
        type="button"
        onClick={onSelect}
        className="flex-1 flex items-center gap-2 p-2 text-left active:scale-[0.97] transition-transform min-w-0"
      >
        <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(148,163,184,0.12)' }}>
          <Icon className="w-3.5 h-3.5" style={{ color: isActive ? 'currentColor' : '#94a3b8' }} />
        </div>
        <div className="flex flex-col flex-1 min-w-0 pr-3">
          <span className="text-[10px] xl:text-[11px] font-bold leading-tight whitespace-nowrap">{btn.label.replace('\n', ' ')}</span>
          {hasRegs && (
            <span className="text-[8px] xl:text-[9px] font-semibold truncate mt-[1px]"
              style={{ opacity: isActive ? 0.7 : 0.45 }}>
              {selectedRegObj ? selectedRegObj.name : (regOptions.length > 0 ? regOptions[0].name : '')}
            </span>
          )}
        </div>

      </button>

      {/* Right: register picker trigger */}
      {hasRegs ? (
        <div ref={regRef} className="relative flex-shrink-0">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setRegOpen(v => !v); }}
            className="h-full px-2 flex items-center justify-center transition-colors"
            style={{
              borderLeft: isActive ? '1.5px solid rgba(255,255,255,0.45)' : '1px solid rgba(203,213,225,0.85)',
              color: isActive ? 'currentColor' : '#94a3b8',
            }}
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${regOpen ? 'rotate-180' : ''}`} />
          </button>

          {regOpen && (
            <div className="absolute z-[9999] bottom-full right-0 mb-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden min-w-[130px] animate-in fade-in slide-in-from-bottom-2 origin-bottom">
              {regOptions.map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => { onRegChange(String(r.id)); setRegOpen(false); }}
                  className={`w-full px-3 py-2 text-left text-[11px] font-semibold transition-colors hover:bg-slate-50 ${String(selectedReg) === String(r.id) ? 'text-[#5da83f] bg-[#f0fdf4]' : 'text-slate-600'}`}
                >
                  {r.name}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="w-7 flex-shrink-0" />
      )}
    </div>
  );
};


export const POSPage = () => {
  const { user } = useAuthStore();
  const {
    items, selectedCustomer, selectedSupplier, paymentMethod,
    posMode, setPosMode, returnSaleId, setReturnSaleId, setSupplier,
    addItem, removeItem, updateQty, updateItemPrice,
    clearCart, setCustomer, setPaymentMethod,
    discountType, discountValue, discountEnabled, discountReason
  } = useCartStore();

  const { subtotal, discountAmount, total } = useMemo(() => {
    const sub = items.reduce((sum, item) => sum + item.lineTotal, 0);
    
    let disc = 0;
    if (discountEnabled && discountValue > 0) {
      if (discountType === 'percent') {
        disc = Math.round((sub * (discountValue / 100)) * 100) / 100;
        disc = Math.min(disc, sub);
      } else if (discountType === 'amount') {
        disc = Math.min(discountValue, sub);
      }
    }

    const totalVal = Math.round((sub - disc) * 100) / 100;

    return { 
      subtotal: sub, 
      discountAmount: disc, 
      total: totalVal 
    };
  }, [items, discountType, discountValue, discountEnabled]);

  // ── Smart search state ─────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownResults, setDropdownResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  // ── Payment state ──────────────────────────────────────────────────────────
  const [cashAmount, setCashAmount] = useState('');
  const [cardAmount, setCardAmount] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // ── Modal state ────────────────────────────────────────────────────────────
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [quickProductModalOpen, setQuickProductModalOpen] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [qpmOpen, setQpmOpen] = useState(false);              // QuickProductManager
  const [quickBarcodesOpen, setQuickBarcodesOpen] = useState(false);  // QuickBarcodes
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [supplierSearchOpen, setSupplierSearchOpen] = useState(false);
  const [returnSaleSearchOpen, setReturnSaleSearchOpen] = useState(false);
  const [scannedNotFound, setScannedNotFound] = useState('');
  const [saleResult, setSaleResult] = useState(null);

  // ── Swap state ─────────────────────────────────────────────────────────────
  const [swapMode, setSwapMode] = useState(false);
  const [swapCandidate, setSwapCandidate] = useState(null);   // product coming in
  const [swapTarget, setSwapTarget] = useState(null);         // product being replaced
  const [swapConfirmOpen, setSwapConfirmOpen] = useState(false);

  // ── Selection state (for removal) ──────────────────────────────────────────
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [removeModalOpen, setRemoveModalOpen] = useState(false);
  const [removingIds, setRemovingIds] = useState(new Set()); // exit animation

  // ── Cash registers for payment ─────────────────────────────────────────────
  const [cashRegisters, setCashRegisters] = useState([]);
  // Per-payment-method selected register id
  const [selectedRegisters, setSelectedRegisters] = useState({ cash: '', card: '', transfer: '' });

  // ── Refs ───────────────────────────────────────────────────────────────────
  const barcodeWrapperRef = useRef(null);
  const searchInputRef = useRef(null);

  // Barkod çift okuma (debounce) koruması için hafıza referansı
  const lastScanRef = useRef({ code: '', time: 0 });

  // ── Product grid state — powered by cache-aware hook ─────────────────────
  const { products: allProducts, loading, applyStockDeduction } = useProducts();

  // Initialize displayedProducts SYNCHRONOUSLY from cache → zero flash on 2nd visit
  const [displayedProducts, setDisplayedProducts] = useState(() => {
    const cached = useCacheStore.getState().getCache('products');
    if (!cached || cached.length === 0) return [];
    let savedIds = [];
    try { savedIds = JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { savedIds = []; }
    if (savedIds.length > 0) {
      const idMap = new Map(cached.map(p => [p.id, p]));
      const restored = savedIds.map(id => idMap.get(id)).filter(Boolean);
      return restored.length > 0 ? restored : cached.slice(0, 12);
    }
    return cached.slice(0, 12);
  });

  const [isGridLoading, setIsGridLoading] = useState(() => {
    const cached = useCacheStore.getState().getCache('products');
    return !cached || cached.length === 0;
  });

  // Zaten başlatılıp başlatılmadığını izle
  const isInitializedRef = useRef(false);
  // Async sync tamamlanana kadar persist'i blokla (yanlış liste Supabase'e yazılmasın)
  const isReadyToSaveRef = useRef(false);
  // Snapshot of current displayed IDs for comparison inside async callbacks
  const displayedIdsRef = useRef([]);
  useEffect(() => { displayedIdsRef.current = displayedProducts.map(p => p.id); }, [displayedProducts]);

  // Restore displayed products from DB/localStorage once allProducts is loaded
  useEffect(() => {
    let mounted = true;
    
    if (!loading && !isInitializedRef.current) {
      isInitializedRef.current = true;
      isReadyToSaveRef.current = false; // reset before async fetch
      
      const syncQuickSales = async () => {
        try {
          let savedIds = [];
          if (isSupabase()) {
            try {
              const setting = await settingsService.get(LS_KEY);
              if (setting && setting.value && Array.isArray(setting.value)) {
                savedIds = setting.value;
                localStorage.setItem(LS_KEY, JSON.stringify(savedIds));
              } else {
                try { savedIds = JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { savedIds = []; }
              }
            } catch {
              try { savedIds = JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { savedIds = []; }
            }
          } else {
            try { savedIds = JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { savedIds = []; }
          }

          if (mounted && savedIds.length > 0) {
            const currentIds = displayedIdsRef.current;
            const isSame =
              savedIds.length === currentIds.length &&
              savedIds.every((id, i) => id === currentIds[i]);
            if (!isSame) {
              const idMap = new Map(allProducts.map(p => [p.id, p]));
              const restored = savedIds.map(id => idMap.get(id)).filter(Boolean);
              setDisplayedProducts(restored);
            }
          }
        } catch (e) {
          console.error('Hızlı satış senkronizasyon hatası:', e);
        } finally {
          if (mounted) {
            isReadyToSaveRef.current = true; // async sync done → safe to persist now
            setIsGridLoading(false);
          }
        }
      };

      syncQuickSales();
    }
    
    return () => { mounted = false; };
  }, [allProducts, loading]);

  // ── Supabase Realtime Subscription for Quick Products ──────────────────────
  useEffect(() => {
    if (!isSupabase()) return;

    const channel = supabase.channel('settings_quick_products')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for all changes (INSERT, UPDATE)
          schema: 'public',
          table: 'settings',
          filter: `key=eq.${LS_KEY}`
        },
        (payload) => {
          const newIds = payload.new?.value;
          if (newIds && Array.isArray(newIds)) {
            // Check if it's actually different from what we are displaying
            const currentIds = displayedIdsRef.current;
            const isSame = newIds.length === currentIds.length && newIds.every((id, i) => id === currentIds[i]);
            if (!isSame) {
              const idMap = new Map(useCacheStore.getState().getCache('products')?.map(p => [p.id, p]) || []);
              const restored = newIds.map(id => idMap.get(id)).filter(Boolean);
              setDisplayedProducts(restored);
              localStorage.setItem(LS_KEY, JSON.stringify(newIds)); // keep local sync
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Update stock quantities selectively without full re-render
  useEffect(() => {
    if (!allProducts || allProducts.length === 0) return;
    setDisplayedProducts(prev => {
      let changed = false;
      const idMap = new Map(allProducts.map(p => [p.id, p]));
      const next = prev.map(p => {
        const fresh = idMap.get(p.id);
        if (fresh && fresh.stock_quantity !== p.stock_quantity) {
          changed = true;
          return { ...p, stock_quantity: fresh.stock_quantity };
        }
        return p;
      });
      return changed ? next : prev;
    });
  }, [allProducts]);

  // ── Cash registers — via useCashRegisters hook (cache-aware) ─────────────
  const { registers: hookRegisters } = useCashRegisters();
  useEffect(() => {
    if (!hookRegisters || hookRegisters.length === 0) return;
    setCashRegisters(hookRegisters);
    setSelectedRegisters(prev => ({
      cash:     prev.cash     || hookRegisters.find(r => r.type === 'cash' && r.is_active !== false)?.id || '',
      card:     prev.card     || hookRegisters.find(r => r.type === 'pos'  && r.is_active !== false)?.id || '',
      transfer: prev.transfer || hookRegisters.find(r => r.type === 'bank' && r.is_active !== false)?.id || '',
    }));
  }, [hookRegisters]);

  // Persist displayed product IDs to DB and localStorage — only after async sync completes
  useEffect(() => {
    if (!isInitializedRef.current || !isReadyToSaveRef.current) return;
    const ids = displayedProducts.map(p => p.id);
    localStorage.setItem(LS_KEY, JSON.stringify(ids));
    
    // Arka planda DB'ye kaydet (ayarlar tablosuna)
    settingsService.put(LS_KEY, ids).catch(e => {
      console.error('Hızlı satış DB kayıt hatası:', e);
    });
  }, [displayedProducts]);


  // ── Smart search debounce ──────────────────────────────────────────────────
  useEffect(() => {
    if (!searchQuery.trim()) {
      setDropdownResults([]);
      setShowDropdown(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const results = await productService.searchByNameOrBarcode(searchQuery);
        setDropdownResults(results.slice(0, 8));
        setShowDropdown(results.length > 0 || searchQuery.length > 0);
      } catch (e) {
        console.error('[POS] Arama Hatası:', e);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ── Keyboard Shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (customerModalOpen || quickProductModalOpen || receiptModalOpen || qpmOpen) return;
      if (swapMode && e.key === 'Escape') { cancelSwap(); return; }
      if (selectedProductId && e.key === 'Escape') { setSelectedProductId(null); return; }

      switch (e.key) {
        case 'F2':
          e.preventDefault();
          focusSearch();
          break;
        case 'F3':
          e.preventDefault();
          setCustomerModalOpen(true);
          break;
        case 'F5': e.preventDefault(); handlePaymentSelect('cash'); break;
        case 'F6': e.preventDefault(); handlePaymentSelect('card'); break;
        case 'F7': e.preventDefault(); handlePaymentSelect('transfer'); break;
        case 'F8': e.preventDefault(); handlePaymentSelect('mixed'); break;
        case 'F9': e.preventDefault(); handlePaymentSelect('credit'); break;
        case 'F10': e.preventDefault(); setSupplierModalOpen(true); break;
        case 'Enter':
          if (items.length > 0 && !e.target.closest('input, textarea') && !showDropdown) {
            e.preventDefault();
            handleCheckout();
          }
          break;
        case 'F12':
          e.preventDefault();
          if (items.length > 0) {
            // window.confirm bloklarıcı olduğundan toast+useCartStore doğrudan kullanıldı
            clearCart();
            toast('Sepet temizlendi', { icon: '🗑️', duration: 2000 });
          }
          break;
        case 'Delete':
          if (items.length > 0 && !e.target.closest('input, textarea')) {
            const lastItem = items[items.length - 1];
            removeItem(lastItem.product.id);
            toast.success('Son ürün silindi');
          }
          break;
        case 'Escape':
          if (showDropdown) { setShowDropdown(false); setSearchQuery(''); }
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, customerModalOpen, quickProductModalOpen, receiptModalOpen, qpmOpen, supplierModalOpen, paymentMethod, cashAmount, cardAmount, transferAmount, total, selectedCustomer, showDropdown, swapMode, selectedProductId]);

  // ── Global Barcode Capture: redirect stray keypresses to search input ──────
  useEffect(() => {
    const handleGlobalKey = (e) => {
      // Skip if any modal open or a special key
      if (customerModalOpen || quickProductModalOpen || receiptModalOpen || qpmOpen || supplierModalOpen) return;
      // Skip if focus is already inside an input / textarea / select / button
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'button') return;
      // Skip modifier combos, function keys, and non-printable
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key.length !== 1) return;
      // Redirect the character into the barcode input
      const input = barcodeWrapperRef.current?.querySelector('input') || searchInputRef.current;
      if (input) {
        input.focus();
        // Let the character flow naturally into the focused input
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [customerModalOpen, quickProductModalOpen, receiptModalOpen, qpmOpen, supplierModalOpen]);

  const focusSearch = () => {
    const input = barcodeWrapperRef.current?.querySelector('input') || searchInputRef.current;
    if (input) input.focus();
  };

  // ── Barcode scan (Enter on pure numeric input) ─────────────────────────────
  const handleScan = async (code) => {
    const now = Date.now();

    // YENİ: Zaman Kalkanı (Debounce Kontrolü)
    // Aynı barkod 600ms içinde tekrar gelirse yoksay
    if (code === lastScanRef.current.code && now - lastScanRef.current.time < 600) {
      console.log('[POS] Çift okuma engellendi:', code); // Arka planda geliştirici için bilgi mesajı
      return;
    }

    // Son okutulan barkodu ve zamanını hafızaya kaydet
    lastScanRef.current = { code, time: now };

    try {
      const product = await productService.getByBarcode(code);
      if (product) {
        handleAddProduct(product, 1);
        setSearchQuery('');
        setShowDropdown(false);
      } else {
        // Clear the search field immediately so the barcode char doesn't linger
        setSearchQuery('');
        setShowDropdown(false);
        // Open the Quick Product Manager in create mode with the scanned barcode pre-filled
        setScannedNotFound(code);
        setQpmOpen(true);
      }
    } catch (e) {
      console.error('[POS] Barkod Tarama Hatası:', e);
      toast.error(e?.message || 'Barkod okunurken hata oluştu.');
    }
  };

  const handleAddProduct = (product, qty = 1) => {
    addItem(product, qty);
    setSearchQuery('');
    setShowDropdown(false);
    focusSearch();
  };

  // ── Payment ────────────────────────────────────────────────────────────────
  const handlePaymentSelect = (method) => {
    setPaymentMethod(method);
    if (method === 'cash') setCashAmount(total.toString());
    if (method === 'card') setCardAmount(total.toString());
    if (method === 'transfer') setTransferAmount(total.toString());
    if (method === 'mixed') { setCashAmount(''); setCardAmount(''); setTransferAmount(''); }
    if (method === 'credit') {
      if (posMode === 'purchase') {
        if (!selectedSupplier) {
          toast.error('Veresiye alış için bir tedarikçi seçmelisiniz.');
          setSupplierSearchOpen(true);
        }
      } else {
        if (!selectedCustomer || selectedCustomer.customer_type === 'retail') {
          toast.error('Veresiye işlem için kayıtlı bir müşteri seçmelisiniz.');
          setCustomerModalOpen(true);
        }
      }
    }
  };

  const handleCheckout = async () => {
    if (items.length === 0) { toast.error('Sepet boş!'); return; }
    if (posMode !== 'purchase' && paymentMethod === 'credit' && selectedCustomer?.customer_type === 'retail') {
      toast.error('Perakende müşteriye veresiye işlem yapılamaz.'); return;
    }
    if (posMode === 'purchase' && !selectedSupplier) {
      toast.error('Alış işlemi yapabilmek için lütfen bir tedarikçi seçin.'); return;
    }
    if (posMode === 'purchase' && paymentMethod === 'credit' && !selectedSupplier) {
      toast.error('Veresiye alış için bir tedarikçi seçmelisiniz.'); return;
    }
    if (posMode === 'return' && !returnSaleId) {
      toast.error('İade işlemi için öncelikle geçmiş bir satış fişi seçmelisiniz.'); return;
    }

    let pCash = 0, pCard = 0, pCredit = 0, pTransfer = 0;
    if (paymentMethod === 'cash') {
      pCash = total;
    } else if (paymentMethod === 'card') {
      pCard = total;
    } else if (paymentMethod === 'transfer') {
      pTransfer = total;
    } else if (paymentMethod === 'credit') {
      pCredit = total;
    } else if (paymentMethod === 'mixed') {
      pCash = parseFloat(cashAmount) || 0;
      pCard = parseFloat(cardAmount) || 0;
      pTransfer = parseFloat(transferAmount) || 0;
      const sum = pCash + pCard + pTransfer;
      if (sum < total) {
        const remaining = total - sum;
        if (posMode !== 'purchase' && selectedCustomer?.customer_type === 'retail') {
          toast.error(`Perakende müşteriye eksik tutar veresiye yazılamaz! Kalan: ${formatCurrency(remaining)}`);
          return;
        }
        if (posMode === 'purchase' && !selectedSupplier) {
          toast.error('Veresiye tutar için tedarikçi seçili olmalıdır.');
          return;
        }
        // Kalan tutar veresiye olarak işlenir (onay gerektirmez, kullanıcı zaten karma ödeme seçti)
        pCredit = remaining;
        toast(`${formatCurrency(remaining)} tutar veresiye olarak kaydedildi`, { icon: '⚠️', duration: 3000 });
      }
    }

    setIsProcessing(true);
    try {
      const paymentData = { method: paymentMethod, cashAmount: pCash, cardAmount: pCard, transferAmount: pTransfer, creditAmount: pCredit };

      if (posMode === 'purchase') {
        const purchaseData = {
          supplier_id: selectedSupplier?.id || 1,
          total_amount: total,
          status: pCredit > 0 && pCredit === total ? 'pending' : (pCredit > 0 ? 'partial' : 'completed'),
        };
        const purchaseItems = items.map(item => ({
          product_id: item.product.id, name: item.product.name,
          quantity: item.quantity, unit_price: item.product.purchase_price || item.product.sale_price,
        }));
        let mappedMethod = paymentMethod;
        if (paymentMethod === 'card') mappedMethod = 'credit_card';
        if (paymentMethod === 'transfer') mappedMethod = 'bank_transfer';
        if (paymentMethod === 'mixed') mappedMethod = 'split';

        const purchasePaymentData = {
          paidNow: pCash + pCard + pTransfer,
          method: mappedMethod,
          splits: {
            cash: { amount: pCash },
            credit_card: { amount: pCard },
            bank_transfer: { amount: pTransfer },
          }
        };

        await purchaseService.create(purchaseData, purchaseItems, purchasePaymentData);
        toast.success('Alış işlemi başarıyla tamamlandı!');
      } else if (posMode === 'return') {
        const returnData = {
          // Do NOT send sale_number — SQL generates IAD- prefix automatically
          customer_id: selectedCustomer?.id || 1,
          original_sale_id: returnSaleId,
          total_amount: total,
        };
        const returnItemsData = items.map(item => ({
          product_id: item.product.id, name: item.product.name,
          quantity: item.quantity,
          // Derive unit_price from lineTotal/quantity (cart items don't store unit_price directly)
          unit_price: item.unit_price ?? (item.quantity > 0 ? Math.round((item.lineTotal / item.quantity) * 100) / 100 : item.product.sale_price || 0),
          line_total: item.lineTotal,
        }));
        await saleService.createReturn(returnData, returnItemsData, paymentData);

        toast.success('İade başarıyla tamamlandı!');
      } else {
        const customNumber = await generateSaleNumber();
        const saleData = {
          sale_number: customNumber,
          customer_id: selectedCustomer?.id || 1,
          total_amount: total,
          discount_amount: discountAmount || 0,
          discount_type: discountType,
          discount_reason: discountReason || '',
          subtotal: subtotal
        };

        // Proportionally distribute the cart-level discount across items
        const rawItems = items.map(item => ({
          product_id: item.product.id,
          name: item.product.name,
          quantity: item.quantity,
          unit_price: item.product.sale_price,
          gross_total: item.lineTotal,
        }));

        const totalGross = rawItems.reduce((s, i) => s + i.gross_total, 0);

        let distributedDiscount = 0;
        const saleItemsData = rawItems.map((item, idx) => {
          let itemDiscount = 0;
          if (discountAmount > 0 && totalGross > 0) {
            if (idx === rawItems.length - 1) {
              // Last item absorbs rounding residual
              itemDiscount = Math.round((discountAmount - distributedDiscount) * 100) / 100;
            } else {
              itemDiscount = Math.round((discountAmount * (item.gross_total / totalGross)) * 100) / 100;
              distributedDiscount += itemDiscount;
            }
          }
          const netLineTotal = Math.round((item.gross_total - itemDiscount) * 100) / 100;
          return {
            product_id: item.product_id,
            name: item.name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount: itemDiscount,
            line_total: netLineTotal,
          };
        });
        const result = await saleService.create(saleData, saleItemsData, paymentData);

        // Optimistic stock deduction — instantly update POS grid without waiting for Realtime
        applyStockDeduction(saleItemsData.map(i => ({ product_id: i.product_id, quantity: i.quantity })));

        setSaleResult({
          id: result.saleId,
          sale_number: result.saleNumber,
          created_at: Date.now(),
          customerName: selectedCustomer?.name, cashierName: user?.fullName,
          items: saleItemsData, total_amount: total, discount_amount: discountAmount, payment_method: paymentMethod,
        });
        setReceiptModalOpen(true);
        toast.success('Satış başarıyla tamamlandı!');
      }

      // Always clear cart after any successful operation (sale, return, purchase)
      clearCart(true); setCashAmount(''); setCardAmount(''); setTransferAmount('');
      if (posMode !== 'sale') {
        useCartStore.getState().setPosMode('sale');
      }
    } catch (error) {
      console.error('[POS] Ödeme hatası:', error);
      toast.error(error?.message || 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Tedarikçi ödemesiyle birlikte satışı tamamla ───────────────────────────
  const handleSupplierPaymentComplete = async (registerId) => {
    if (items.length === 0) return;
    setIsProcessing(true);
    try {
      const paymentData = {
        method: 'card', cashAmount: 0, cardAmount: total, transferAmount: 0, creditAmount: 0,
        overrideRegisterId: registerId,
      };
      const customNumber = await generateSaleNumber();
      const saleData = {
        sale_number: customNumber,
        customer_id: selectedCustomer?.id || 1,
        total_amount: total,
        discount_amount: discountAmount || 0,
        discount_type: discountType,
        discount_reason: discountReason || '',
        subtotal: subtotal,
      };
      const saleItemsData = items.map(item => ({
        product_id: item.product.id, name: item.product.name,
        quantity: item.quantity, unit_price: item.product.sale_price, line_total: item.lineTotal,
      }));
      const result = await saleService.create(saleData, saleItemsData, paymentData);
      setSaleResult({
        id: result.saleId,
        sale_number: result.saleNumber,
        created_at: Date.now(),
        customerName: selectedCustomer?.name, cashierName: user?.fullName,
        items: saleItemsData, total_amount: total, discount_amount: discountAmount, payment_method: 'card',
      });
      setReceiptModalOpen(true);
      
      // Optimistic stock deduction for supplier payment sale
      applyStockDeduction(saleItemsData.map(i => ({ product_id: i.product_id, quantity: i.quantity })));

      clearCart(true); setCashAmount(''); setCardAmount(''); setTransferAmount('');
      toast.success('Tedarikçi ödemeli satış tamamlandı!');
    } catch (error) {
      console.error('[POS] Tedarikçi ödemesi hatası:', error);
      toast.error(error?.message || 'Tedarikçi ödemesi sırasında bir hata oluştu.');
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Quick Product Manager ──────────────────────────────────────────────────
  const handleQPMAdd = (product) => {
    setDisplayedProducts(prev => {
      if (prev.find(p => p.id === product.id)) return prev;
      return [...prev, product];
    });
  };

  const handleStartSwap = (candidate) => {
    setSwapCandidate(candidate);
    setSwapMode(true);
    setQpmOpen(false);
  };

  const handleGridCardClickForSwap = (product, index) => {
    if (!swapMode) return;
    setSwapTarget({ ...product, _index: index });
    setSwapConfirmOpen(true);
  };

  const confirmSwap = () => {
    if (!swapCandidate || !swapTarget) return;
    if (swapCandidate.id === swapTarget.id) {
      toast('Aynı ürünü kendinizle değiştiremezsiniz', { icon: '⚠️' });
      cancelSwap();
      return;
    }
    setDisplayedProducts(prev =>
      prev.map((p, i) => i === swapTarget._index ? swapCandidate : p)
    );
    toast.success(`${swapTarget.name} → ${swapCandidate.name} ile değiştirildi`);
    cancelSwap();
  };

  const cancelSwap = () => {
    setSwapMode(false);
    setSwapCandidate(null);
    setSwapTarget(null);
    setSwapConfirmOpen(false);
  };

  // ── Selection / Remove handlers ───────────────────────────────────────────
  const handleSelectProduct = (product) => {
    if (!product || !product.id) return;
    setSelectedProductId(prev => prev === product.id ? null : product.id);
  };

  const handleRemoveRequest = () => {
    setRemoveModalOpen(true);
  };

  const handleRemoveConfirm = () => {
    if (!selectedProductId) return;
    const target = displayedProducts.find(p => p.id === selectedProductId);
    if (!target) return;

    // start exit animation
    setRemovingIds(prev => new Set(prev).add(selectedProductId));
    setTimeout(() => {
      setDisplayedProducts(prev => prev.filter(p => p.id !== selectedProductId));
      setRemovingIds(prev => { const s = new Set(prev); s.delete(selectedProductId); return s; });
      setSelectedProductId(null);
    }, 200);

    toast(`${target.name} hızlı listeden kaldırıldı`, { duration: 2000, icon: '🗑️' });
    setRemoveModalOpen(false);
  };

  const handleRemoveCancel = () => {
    setRemoveModalOpen(false);
  };

  const isRetailCustomer = posMode === 'purchase' ? !selectedSupplier : (!selectedCustomer || selectedCustomer.customer_type === 'retail');

  const topPayments = [
    { id: 'cash', label: 'Nakit', shortcut: 'F5', icon: Banknote },
    { id: 'card', label: 'Kart', shortcut: 'F6', icon: CreditCard },
    { id: 'transfer', label: 'Havale/EFT', shortcut: 'F7', icon: Building2 },
    { id: 'mixed', label: 'Parçalı\nÖdeme', shortcut: 'F8', icon: SplitSquareHorizontal },
  ];

  const paymentActiveStyle = {
    cash: { background: 'rgba(126,217,87,0.15)', border: '1px solid rgba(126,217,87,0.35)', boxShadow: '0 4px 12px rgba(126,217,87,0.2)', color: '#3a8024' },
    card: { background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.35)', boxShadow: '0 4px 12px rgba(59,130,246,0.2)', color: '#1d4ed8' },
    transfer: { background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.35)', boxShadow: '0 4px 12px rgba(139,92,246,0.2)', color: '#7e22ce' },
    mixed: { background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.35)', boxShadow: '0 4px 12px rgba(249,115,22,0.2)', color: '#c2410c' },
  };

  const paymentInactiveStyle = {
    background: 'rgba(255,255,255,0.45)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.65)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)', color: '#9ca3af',
  };


  return (
    <>
    <div className="hidden lg:flex gap-2 h-full overflow-hidden print:hidden">

      {/* ── LEFT PANEL ─────────────────────────────────────────────────────── */}
      <div className="flex-[3] flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">

        {/* Search Header */}
        <div className="p-2 border-b border-slate-200 bg-slate-50 relative z-40" ref={barcodeWrapperRef}>
          <div className="flex items-center gap-2">
            {/* Smart search input */}
            <div className="relative flex-1">
              <BarcodeInput
                onScan={posMode === 'return' ? undefined : handleScan}
                value={searchQuery}
                onChange={posMode === 'return' ? undefined : e => setSearchQuery(e.target.value)}
                onFocus={posMode === 'return' ? undefined : () => searchQuery && setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                inputRef={posMode === 'return' ? undefined : searchInputRef}
                placeholder={posMode === 'return' ? 'İade modunda barkod okutma devre dışı' : undefined}
              />
              {/* Dropdown */}
              {showDropdown && (
                <ProductSearchDropdown
                  query={searchQuery}
                  results={dropdownResults}
                  onAdd={handleAddProduct}
                  onClose={() => { setShowDropdown(false); setSearchQuery(''); }}
                />
              )}
            </div>

            {/* Hızlı Barkodlar Button */}
            <button
              onClick={() => setQuickBarcodesOpen(true)}
              style={{
                background: 'rgba(126,217,87,0.1)',
                border: '1px solid rgba(126,217,87,0.2)',
                boxShadow: '0 2px 8px rgba(126,217,87,0.08), inset 0 1px 0 rgba(255,255,255,0.6)',
                color: 'rgb(58,128,36)', fontSize: '12px', fontWeight: '600',
                padding: '0 12px', height: '42px', borderRadius: '8px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
              className="hover:bg-brand-50 hover:scale-[1.02]"
            >
              <ScanBarcode style={{ width: 14, height: 14 }} />
              Hızlı Barkodlar
            </button>

            {/* Add/Swap Quick Product Manager Button */}
            <button
              onClick={() => setQpmOpen(true)}
              style={{
                background: 'rgba(126,217,87,0.1)',
                border: '1px solid rgba(126,217,87,0.2)',
                boxShadow: '0 2px 8px rgba(126,217,87,0.08), inset 0 1px 0 rgba(255,255,255,0.6)',
                color: 'rgb(58,128,36)', fontSize: '12px', fontWeight: '600',
                padding: '0 12px', height: '42px', borderRadius: '8px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
              className="hover:bg-brand-50 hover:scale-[1.02]"
            >
              <ArrowLeftRight style={{ width: 14, height: 14 }} />
              Hızlı Ürün Ekle / Değiştir
            </button>
          </div>
        </div>

        {/* Swap mode banner */}
        {swapMode && (
          <div
            style={{
              background: 'rgba(126,217,87,0.08)', backdropFilter: 'blur(12px)',
              borderBottom: '1px solid rgba(126,217,87,0.2)',
              padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px',
              color: '#3a8024', fontSize: '13px', fontWeight: '500',
            }}
          >
            <ArrowLeftRight style={{ width: 15, height: 15 }} />
            <span className="flex-1">Hangi ürünle değiştirilsin? Bir karta tıklayın.</span>
            <button
              onClick={cancelSwap}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                color: '#b91c1c', padding: '3px 10px', borderRadius: 6, cursor: 'pointer',
              }}
            >
              <X style={{ width: 13, height: 13 }} /> İptal
            </button>
          </div>
        )}

        {/* Product Grid Area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50">

          {/* Grid Content */}
          <div className="flex-1 overflow-y-auto p-2">
            {isGridLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                {[...Array(12)].map((_, i) => <ProductSkeleton key={`skeleton-${i}`} />)}
              </div>
            ) : displayedProducts.length > 0 ? (
              <motion.div 
                variants={gridVariants}
                initial="hidden"
                animate="show"
                className={`grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 relative ${swapMode ? 'relative' : ''}`}
              >
                {displayedProducts.map((p, idx) => (
                  <motion.div
                    variants={cardVariants}
                    animate={removingIds.has(p.id) ? { opacity: 0, scale: 0, transition: { duration: 0.2 } } : undefined}
                    key={p.id}
                    className={swapMode ? 'relative cursor-pointer' : 'relative z-20'}
                    onClick={swapMode ? () => handleGridCardClickForSwap(p, idx) : undefined}
                  >
                    <ProductCard
                      product={p}
                      isSelected={selectedProductId === p.id}
                      onSelect={handleSelectProduct}
                      onRemove={handleRemoveRequest}
                      onAdd={swapMode ? () => { } : handleAddProduct}
                      posMode={posMode}
                    />
                    {swapMode && (
                      <div
                        style={{
                          position: 'absolute', inset: 0, borderRadius: '12px',
                          background: 'rgba(126,217,87,0.08)',
                          border: '2px solid transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s ease',
                          cursor: 'pointer',
                        }}
                        className="hover:!border-brand-400 hover:!bg-brand-50/30 hover:scale-[1.02]"
                      >
                        <span
                          style={{
                            background: 'rgba(126,217,87,0.12)', backdropFilter: 'blur(8px)',
                            border: '1px solid rgba(126,217,87,0.25)', borderRadius: '8px',
                            color: '#3a8024', fontSize: 11, fontWeight: 600, padding: '4px 10px',
                          }}
                        >
                          Bu kartla değiştir
                        </span>
                      </div>
                    )}
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-3">
                <ShoppingCart className="w-12 h-12 opacity-50" />
                <p>Ürün bulunamadı. "Hızlı Ürün" ile ekleyebilirsiniz.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* ── RIGHT PANEL ────────────────────────────────────────────────────── */}
      <div className="flex-[2] flex flex-col bg-slate-50 rounded-xl border border-slate-200 shadow-sm overflow-hidden">

        {/* Top Section: Entity & Mode */}
        <div className="flex border-b border-slate-200 bg-white min-h-[72px]">
          {/* Entity Selector (Left Half) */}
          <div
            className="flex-1 p-3 border-r border-slate-100 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors group overflow-hidden"
            onClick={() => posMode === 'purchase' ? setSupplierSearchOpen(true) : setCustomerModalOpen(true)}
            title={posMode === 'purchase' ? "Tedarikçi Değiştir" : "Müşteri Değiştir (F3)"}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 shrink-0 bg-brand-100 rounded-full flex items-center justify-center text-brand-600 group-hover:bg-brand-600 group-hover:text-white transition-colors">
                <UserIcon className="w-5 h-5" />
              </div>
              <div className="min-w-0 pr-2">
                <p className="text-[10px] font-black text-slate-400 tracking-[0.1em] uppercase">
                  {posMode === 'purchase' ? 'SEÇİLİ TEDARİKÇİ' : 'SEÇİLİ MÜŞTERİ'}
                </p>
                <p className="text-sm font-bold text-slate-800 truncate">
                  {posMode === 'purchase' ? (selectedSupplier?.name || 'Seçilmedi') : (selectedCustomer?.name || 'Seçilmedi')}
                </p>
              </div>
            </div>
            <div className="shrink-0 flex flex-col items-end gap-1">
              {posMode !== 'purchase' && selectedCustomer?.balance > 0 && (
                <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded truncate max-w-[80px]">Borç: {formatCurrency(selectedCustomer.balance)}</span>
              )}
              {posMode !== 'purchase' && selectedCustomer?.balance < 0 && (
                <span className="text-[10px] font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded truncate max-w-[80px]">Alacak: {formatCurrency(Math.abs(selectedCustomer.balance))}</span>
              )}
            </div>
          </div>

          {/* Mode Selector (Right Half) */}
          <div className="flex-1 p-2 flex items-center justify-center gap-1.5 bg-slate-50/50">
            <button
              onClick={() => { setPosMode('sale'); setReturnSaleId(null); clearCart(true); }}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-lg border text-[11px] font-bold transition-all h-full ${posMode === 'sale' ? 'bg-brand-50 border-brand-200 text-brand-700 shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
            >
              <ShoppingCart className="w-4 h-4 mb-0.5" />
              Satış
            </button>
            <button
              onClick={() => { setPosMode('return'); clearCart(true); setReturnSaleSearchOpen(true); }}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-lg border text-[11px] font-bold transition-all h-full ${posMode === 'return' ? 'bg-orange-50 border-orange-200 text-orange-700 shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
            >
              <ArrowLeftRight className="w-4 h-4 mb-0.5" />
              İade
            </button>
            <button
              onClick={() => { setPosMode('purchase'); setReturnSaleId(null); clearCart(true); }}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-lg border text-[11px] font-bold transition-all h-full ${posMode === 'purchase' ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
            >
              <Package className="w-4 h-4 mb-0.5" />
              Alış
            </button>
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-100/50">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4">
              <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center">
                <ShoppingCart className="w-10 h-10" />
              </div>
              <p className="text-center px-6">Sepet boş.<br />Ürün eklemek için barkod okutun veya listeden tıklayın.</p>
            </div>
          ) : (
            items.map(item => (
              <CartItem
                key={item.product.id}
                item={item}
                onUpdateQty={updateQty}
                onRemove={removeItem}
                onUpdatePrice={updateItemPrice}
              />
            ))
          )}
        </div>

        <CartDiscountSection />

        {/* Totals & Payment Section - SPLIT LAYOUT RESTORED */}
        <div className="bg-white border-t border-slate-200 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] z-10 p-4">
          <div className="flex gap-6 items-stretch">

            {/* LEFT: Payment Options — 1x1 Grid */}
            <div className="flex-[1] flex flex-col gap-2">
              <div className="grid grid-cols-1 gap-1.5 h-full">
                {/* Seçim Durumları Hesaplaması */}
                {(() => {
                  const isAnyMainPayment = paymentMethod === 'cash' || paymentMethod === 'card' || paymentMethod === 'transfer' || paymentMethod === 'mixed';
                  const isCredit = paymentMethod === 'credit';
                  const isSupplier = supplierModalOpen;
                  const anySelected = isAnyMainPayment || isCredit || isSupplier;

                  return (
                    <>
                      {/* 4 Ana Buton */}
                      {topPayments.map(btn => {
                        const isActive = paymentMethod === btn.id;
                        const isDimmed = anySelected && !isActive;
                        const regOptions = cashRegisters.filter(r => {
                          if (btn.id === 'cash') return r.type === 'cash';
                          if (btn.id === 'card') return r.type === 'pos';
                          if (btn.id === 'transfer') return r.type === 'bank';
                          return false;
                        });
                        return (
                          <PaymentCard
                            key={btn.id}
                            btn={btn}
                            isActive={isActive}
                            isDimmed={isDimmed}
                            activeStyle={paymentActiveStyle[btn.id] || {}}
                            regOptions={btn.id !== 'mixed' ? regOptions : []}
                            selectedReg={selectedRegisters[btn.id] || ''}
                            onSelect={() => handlePaymentSelect(btn.id)}
                            onRegChange={val => setSelectedRegisters(prev => ({ ...prev, [btn.id]: val }))}
                          />
                        );
                      })}

                      {/* "Veresiye" ve "Tedarikçiye" Butonları */}
                      <div className="grid grid-cols-2 gap-1.5">
                        <div
                          className="relative flex rounded-xl border overflow-visible transition-all duration-200 h-full"
                          style={paymentMethod === 'credit'
                            ? { background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#b91c1c', boxShadow: '0 2px 8px rgba(239,68,68,0.15)' }
                            : (posMode === 'return' || (posMode === 'sale' && isRetailCustomer))
                              ? { background: 'rgba(241,245,249,0.6)', borderColor: 'transparent', color: '#cbd5e1', cursor: 'not-allowed' }
                              : {
                                background: 'rgba(248,250,252,0.85)',
                                borderColor: (anySelected && !isCredit) ? '#cbd5e1' : 'rgba(226,232,240,0.9)',
                                color: '#64748b', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                                opacity: (anySelected && !isCredit) ? 0.6 : 1,
                                filter: (anySelected && !isCredit) ? 'grayscale(0.6)' : 'none',
                                transform: (anySelected && !isCredit) ? 'scale(0.98)' : 'scale(1)'
                              }
                          }
                        >
                          <button
                            onClick={() => !(posMode === 'return' || (posMode === 'sale' && isRetailCustomer)) && handlePaymentSelect('credit')}
                            disabled={posMode === 'return' || (posMode === 'sale' && isRetailCustomer)}
                            className="flex-1 flex items-center gap-2 p-2 text-left active:scale-[0.97] min-w-0 transition-transform"
                          >
                            <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ background: paymentMethod === 'credit' ? 'rgba(255,255,255,0.25)' : 'rgba(148,163,184,0.12)' }}>
                              <UserCheck className="w-3.5 h-3.5" style={{ color: paymentMethod === 'credit' ? 'currentColor' : '#94a3b8' }} />
                            </div>
                            <div className="flex flex-col flex-1 min-w-0">
                              <span className="text-[10px] xl:text-[11px] font-bold leading-tight">Veresiye</span>
                            </div>

                          </button>
                          <div className="w-4 flex-shrink-0" />
                        </div>

                        <div
                          className="relative flex rounded-xl border overflow-visible transition-all duration-200 h-full"
                          style={supplierModalOpen
                            ? { background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.35)', color: '#854d0e', boxShadow: '0 2px 8px rgba(234,179,8,0.15)' }
                            : (posMode === 'purchase' || posMode === 'return' || items.length === 0)
                              ? { background: 'rgba(241,245,249,0.6)', borderColor: 'transparent', color: '#cbd5e1', cursor: 'not-allowed' }
                              : {
                                background: 'rgba(248,250,252,0.85)',
                                borderColor: (anySelected && !isSupplier) ? '#cbd5e1' : 'rgba(226,232,240,0.9)',
                                color: '#64748b', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                                opacity: (anySelected && !isSupplier) ? 0.6 : 1,
                                filter: (anySelected && !isSupplier) ? 'grayscale(0.6)' : 'none',
                                transform: (anySelected && !isSupplier) ? 'scale(0.98)' : 'scale(1)'
                              }
                          }
                        >
                          <button
                            onClick={() => !(posMode === 'purchase' || posMode === 'return' || items.length === 0) && setSupplierModalOpen(true)}
                            disabled={posMode === 'purchase' || posMode === 'return' || items.length === 0}
                            className="flex-1 flex items-center gap-2 p-2 text-left active:scale-[0.97] min-w-0 transition-transform"
                          >
                            <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ background: supplierModalOpen ? 'rgba(255,255,255,0.25)' : 'rgba(148,163,184,0.12)' }}>
                              <Building2 className="w-3.5 h-3.5" style={{ color: supplierModalOpen ? 'currentColor' : '#94a3b8' }} />
                            </div>
                            <div className="flex flex-col flex-1 min-w-0 pr-3">
                              <span className="text-[10px] xl:text-[11px] font-bold leading-tight">Tedarikçiye<br />Ödeme</span>
                            </div>
                            <span className="absolute top-1.5 right-8 text-[8px] font-black" style={{ opacity: 0.25 }}>F10</span>
                          </button>
                          <div className="w-7 flex-shrink-0" />
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* RIGHT: Price Summary */}
            <div className="flex-1 flex flex-col bg-slate-50/50 p-4 rounded-3xl border border-slate-100 justify-between">
              <div className="space-y-2">
                <div className={`flex justify-between text-sm text-slate-500 font-semibold ${discountAmount <= 0 ? 'pb-2 border-b border-slate-200/50' : ''}`}>
                  <span>Ara Toplam</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-red-500 font-bold pb-2 border-b border-slate-200/50">
                    <span>İskonto</span>
                    <span>-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                <div className="pt-4 flex flex-col items-end mt-auto">
                  <span className="text-[10px] font-black text-brand-500 uppercase tracking-[0.2em] mb-1 opacity-70">
                    {posMode === 'return' ? 'İade Edilecek Tutar' : posMode === 'purchase' ? 'Ödenecek Tutar' : 'Ödenecek Tutar'}
                  </span>
                  <span className="text-4xl font-black text-slate-900 tracking-tighter leading-none">
                    {formatCurrency(total)}
                  </span>
                </div>
              </div>

              {/* Clear Cart Button */}
              <button
                onClick={() => {
                  if (items.length === 0) return;
                  clearCart();
                  setCashAmount('');
                  setCardAmount('');
                  setTransferAmount('');
                  toast('Sepet temizlendi', { icon: '🗑️', duration: 2000 });
                }}
                disabled={items.length === 0}
                className="w-full h-10 mt-3 flex items-center justify-center gap-2 rounded-2xl text-sm font-bold tracking-tight transition-all duration-300"
                style={items.length === 0 ? {
                  background: '#f1f5f9', color: '#cbd5e1', border: 'none', cursor: 'not-allowed',
                } : {
                  background: 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(220,38,38,0.12) 100%)',
                  color: '#dc2626',
                  border: '1.5px solid rgba(239,68,68,0.25)',
                  boxShadow: '0 2px 8px rgba(239,68,68,0.1)',
                }}
              >
                <X className="w-4 h-4 shrink-0" />
                Sepeti Temizle
              </button>

              {/* Action Button */}
              <button
                onClick={!isProcessing && items.length > 0 && !(paymentMethod === 'credit' && isRetailCustomer) ? handleCheckout : undefined}
                disabled={items.length === 0 || (paymentMethod === 'credit' && isRetailCustomer) || isProcessing}
                className="w-full h-14 mt-3 flex items-center justify-center gap-3 rounded-2xl text-lg font-black tracking-tight transition-all duration-300 shadow-xl"
                style={(items.length === 0 || (paymentMethod === 'credit' && isRetailCustomer)) ? {
                  background: '#e2e8f0', color: '#94a3b8', border: 'none', cursor: 'not-allowed',
                } : {
                  background: posMode === 'return' ? 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' : posMode === 'purchase' ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  boxShadow: posMode === 'return' ? '0 10px 25px -8px rgba(249,115,22,0.5)' : posMode === 'purchase' ? '0 10px 25px -8px rgba(59,130,246,0.5)' : '0 10px 25px -8px rgba(16,185,129,0.5)',
                }}
              >
                {isProcessing
                  ? <div className="w-6 h-6 border-3 border-white/40 border-t-white rounded-full animate-spin" />
                  : <><CheckCircle2 className="w-6 h-6 shrink-0" /> {posMode === 'return' ? 'İADEYİ TAMAMLA' : posMode === 'purchase' ? 'ALIŞI TAMAMLA' : 'SATIŞI TAMAMLA'}</>
                }
              </button>
            </div>
          </div>

          {/* Mixed inputs - Detailed View */}
          {paymentMethod === 'mixed' && (
            <div className="mt-4 pt-4 border-t border-slate-100 animate-in slide-in-from-top-4 duration-300">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block ml-1">Nakit Tutar</label>
                  <input type="number" value={cashAmount} onChange={e => setCashAmount(e.target.value)}
                    className="w-full font-bold p-3 bg-slate-50 border border-slate-200 rounded-xl text-md focus:bg-white focus:ring-2 focus:ring-brand-100 focus:border-brand-400 outline-none transition-all" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block ml-1">Kart Tutarı</label>
                  <input type="number" value={cardAmount} onChange={e => setCardAmount(e.target.value)}
                    className="w-full font-bold p-3 bg-slate-50 border border-slate-200 rounded-xl text-md focus:bg-white focus:ring-2 focus:ring-brand-100 focus:border-brand-400 outline-none transition-all" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block ml-1">Havale / EFT</label>
                  <input type="number" value={transferAmount} onChange={e => setTransferAmount(e.target.value)}
                    className="w-full font-bold p-3 bg-slate-50 border border-slate-200 rounded-xl text-md focus:bg-white focus:ring-2 focus:ring-brand-100 focus:border-brand-400 outline-none transition-all" />
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-sm text-slate-500 font-bold">Toplam Girilen: <span className="text-slate-900 text-lg">{formatCurrency((parseFloat(cashAmount) || 0) + (parseFloat(cardAmount) || 0) + (parseFloat(transferAmount) || 0))}</span></span>
                {(() => {
                  const sum = (parseFloat(cashAmount) || 0) + (parseFloat(cardAmount) || 0) + (parseFloat(transferAmount) || 0);
                  if (Math.abs(sum - total) < 0.01) return <span className="px-3 py-1 bg-emerald-500 text-white rounded-full text-xs font-black shadow-sm">ÖDEME TAMAM ✓</span>;
                  if (sum < total) return <span className="px-3 py-1 bg-orange-500 text-white rounded-full text-xs font-black shadow-sm">KALAN: {formatCurrency(total - sum)}</span>;
                  return <span className="px-3 py-1 bg-red-500 text-white rounded-full text-xs font-black shadow-sm">FAZLA: {formatCurrency(sum - total)}</span>;
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
      
      {/* ── MOBILE POS ── */}
      <div className="block lg:hidden h-full">
        <MobilePOS
          posMode={posMode} setPosMode={setPosMode}
          selectedCustomer={selectedCustomer} selectedSupplier={selectedSupplier}
          setCustomerModalOpen={setCustomerModalOpen} setSupplierSearchOpen={setSupplierSearchOpen}
          items={items} addItem={addItem} removeItem={removeItem} updateQty={updateQty} clearCart={clearCart}
          total={total} subtotal={subtotal} discountAmount={discountAmount} discountType={discountType} discountValue={discountValue} discountEnabled={discountEnabled}
          paymentMethod={paymentMethod} handlePaymentSelect={handlePaymentSelect} handleCheckout={handleCheckout} isProcessing={isProcessing}
          searchQuery={searchQuery} setSearchQuery={setSearchQuery} dropdownResults={dropdownResults} showDropdown={showDropdown} setShowDropdown={setShowDropdown}
          handleAddProduct={handleAddProduct} handleScan={handleScan} searchInputRef={searchInputRef} focusSearch={focusSearch}
          displayedProducts={displayedProducts} isGridLoading={isGridLoading} ProductSkeleton={ProductSkeleton}
          swapMode={swapMode} handleGridCardClickForSwap={handleGridCardClickForSwap} selectedProductId={selectedProductId} handleSelectProduct={handleSelectProduct} handleRemoveRequest={handleRemoveRequest} removingIds={removingIds}
          setQuickBarcodesOpen={setQuickBarcodesOpen} setQpmOpen={setQpmOpen}
          setReturnSaleSearchOpen={setReturnSaleSearchOpen}
        />
      </div>
    
      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <CustomerSearchModal isOpen={customerModalOpen} onClose={() => setCustomerModalOpen(false)} onSelect={setCustomer} />
      <SupplierSearchModal isOpen={supplierSearchOpen} onClose={() => setSupplierSearchOpen(false)} onSelect={setSupplier} />
      <ReturnSaleSelectionModal
        isOpen={returnSaleSearchOpen}
        onClose={() => setReturnSaleSearchOpen(false)}
        customerId={selectedCustomer?.id}
      />

      <QuickProductModal
        isOpen={quickProductModalOpen}
        onClose={() => setQuickProductModalOpen(false)}
        initialBarcode={scannedNotFound}
        onProductAdded={(prod) => { initLoad(); handleAddProduct(prod); }}
      />

      <ReceiptModal
        isOpen={receiptModalOpen}
        onClose={() => { setReceiptModalOpen(false); focusSearch(); }}
        saleDetails={saleResult}
      />

      <QuickProductManagerModal
        isOpen={qpmOpen}
        onClose={() => { setQpmOpen(false); setScannedNotFound(''); setSearchQuery(''); lastScanRef.current = { code: '', time: 0 }; }}
        displayedProducts={displayedProducts}
        onAddProduct={handleQPMAdd}
        onStartSwap={handleStartSwap}
        initialBarcode={scannedNotFound}
        openOnCreate={!!scannedNotFound}
      />

      <SwapConfirmModal
        isOpen={swapConfirmOpen}
        candidate={swapCandidate}
        target={swapTarget}
        onConfirm={confirmSwap}
        onCancel={cancelSwap}
      />

      <SupplierPaymentModal
        isOpen={supplierModalOpen}
        onClose={() => setSupplierModalOpen(false)}
        defaultAmount={total}
        onComplete={handleSupplierPaymentComplete}
      />

      <RemoveProductModal
        isOpen={removeModalOpen}
        product={displayedProducts.find(p => p.id === selectedProductId)}
        onConfirm={handleRemoveConfirm}
        onCancel={handleRemoveCancel}
      />

      <QuickBarcodesModal
        isOpen={quickBarcodesOpen}
        onClose={() => setQuickBarcodesOpen(false)}
        onAddToCart={(product) => {
          handleAddProduct(product, 1);
        }}
      />
    </>
  );
};