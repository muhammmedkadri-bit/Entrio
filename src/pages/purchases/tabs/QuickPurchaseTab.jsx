import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Trash2, Building2, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { productService } from '../../../services/productService';
import { purchaseService } from '../../../services/purchaseService';
import { PurchaseCartItem } from '../components/PurchaseCartItem';
import { SupplierSearchModal } from '../modals/SupplierSearchModal';
import { PurchaseSuccessModal } from '../modals/PurchaseSuccessModal';
import { ProductFormModal } from '../../stock/modals/ProductFormModal';
import { Modal } from '../../../components/ui/Modal';

export const QuickPurchaseTab = () => {
  // Left Panel State
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  
  // Right Panel (Cart) State
  const [cart, setCart] = useState([]);
  const [supplier, setSupplier] = useState(null);
  const [invoiceNo, setInvoiceNo] = useState('');
  
  // Payment Options
  const [paymentType, setPaymentType] = useState('full'); // full, partial, credit
  const [paidNow, setPaidNow] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Nakit');

  // Modals
  const [isSupplierModalOpen, setSupplierModalOpen] = useState(false);
  const [isSuccessModalOpen, setSuccessModalOpen] = useState(false);
  const [successSummary, setSuccessSummary] = useState(null);
  const [isNewProductModalOpen, setNewProductModalOpen] = useState(false);
  const [showClearWarning, setShowClearWarning] = useState(false);
  const [showAnonWarning, setShowAnonWarning] = useState(false);

  const barcodeInputRef = useRef(null);

  // Focus barcode input via shortcut F2
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
      }
      if (e.key === 'F3') {
        e.preventDefault();
        setSupplierModalOpen(true);
      }
      if (e.key === 'F9') {
        e.preventDefault();
        handleComplete();
      }
      if (e.key === 'F12') {
        e.preventDefault();
        if (cart.length > 0) {
          setShowClearWarning(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, supplier, paymentType, paidNow, paymentMethod]);

  // Debounced Search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search.trim().length >= 2 || !search) {
        fetchProducts(search);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchProducts = async (query = '') => {
    setLoadingProducts(true);
    try {
      const resp = await productService.getAll({ search: query });
      setProducts(resp.slice(0, 20)); // Keep limit for speed
    } catch(e) {
      toast.error('Ürünler yüklenemedi.');
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleBarcodeSubmit = async (e) => {
    if (e.key === 'Enter' && search.trim()) {
      const match = products.find(p => p.barcode === search.trim());
      if (match) {
        addToCart(match);
        setSearch('');
      } else {
        // Find in DB specifically
        const exactMatch = await productService.getByBarcode(search.trim());
        if (exactMatch) {
          addToCart(exactMatch);
          setSearch('');
        } else {
          toast.error('Girdiğiniz barkod ile ürün bulunamadı. Lütfen yeni ürün ekleyin.', { duration: 4000 });
          // Optional: automatically open product modal with barcode filled (requires prop drill).
          // For simplicity, just prompt visually.
        }
      }
    }
  };

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product_id === product.id);
      if (existing) {
        return prev.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1, line_total: (i.quantity + 1) * i.unit_price } : i);
      }
      return [{
        product_id: product.id,
        name: product.name,
        barcode: product.barcode,
        unit: product.unit,
        quantity: 1,
        unit_price: product.purchase_price || 0,
        line_total: product.purchase_price || 0
      }, ...prev];
    });
  };

  const updateCartItem = (id, newVals) => {
    setCart(prev => prev.map(i => i.product_id === id ? { ...i, ...newVals } : i));
  };

  const removeCartItem = (id) => {
    setCart(prev => prev.filter(i => i.product_id !== id));
  };

  // Totals Computing
  const subtotal = cart.reduce((acc, i) => acc + (i.line_total || 0), 0);
  // Simplified tax logic: mapping to overall total since individual items tax isn't managed deeply in purchase UI design requested.
  const totalAmount = subtotal;

  const handleComplete = async () => {
    if (cart.length === 0) {
      toast.error('Sepet boş. Lütfen ürün seçiniz.');
      return;
    }

    if (!supplier && paymentType !== 'full') {
      toast.error('Tedarikçi seçmeden işlemi veresiye/kısmi ödeme yapamazsınız.');
      return;
    }

    let pNow = 0;
    if (paymentType === 'full') pNow = totalAmount;
    else if (paymentType === 'partial') {
      pNow = parseFloat(paidNow);
      if (!pNow || pNow <= 0 || pNow > totalAmount) {
         toast.error('Lütfen geçerli bir kısmi ödeme tutarı giriniz.');
         return;
      }
    }

    if (!supplier) {
       setShowAnonWarning(true);
       return;
    }

    await executePurchase(pNow);
  };

  const executePurchase = async (pNow) => {
    try {
      const pData = {
        supplier_id: supplier?.id || null,
        supplier_name: supplier?.name || null,
        total_amount: totalAmount,
        invoice_number: invoiceNo
      };
      
      const res = await purchaseService.create(pData, cart, { paidNow: pNow, method: paymentMethod });
      
      setSuccessSummary({
        purchase_number: res.purchase_number,
        supplier_name: supplier?.name,
        invoice_number: invoiceNo,
        item_count: cart.length,
        total_amount: totalAmount,
        paid_amount: pNow
      });
      setSuccessModalOpen(true);
      
      // Reset
      setCart([]);
      setSupplier(null);
      setInvoiceNo('');
      setSearch('');
      setPaymentType('full');
      setPaidNow('');
      setShowAnonWarning(false);
      
    } catch(err) {
      console.error('[QuickPurchase] Hata:', err);
      toast.error(err?.message || 'Alış kaydedilirken hata oluştu.');
      setShowAnonWarning(false);
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);

  return (
    <div className="flex flex-col md:flex-row gap-4 h-[calc(100vh-140px)] min-h-[600px] hide-on-print">
      
      {/* LEFT PANEL - Product Search (%55) */}
      <div className="w-full md:w-[55%] flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <Input 
            ref={barcodeInputRef}
            prefixIcon={Search}
            placeholder="Barkod veya Ürün Ara (Enter ile ekle F2)"
            className="flex-1"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleBarcodeSubmit}
          />
          <Button variant="outline" icon={Plus} onClick={() => setNewProductModalOpen(true)}>Yeni Hızlı Ürün</Button>
        </div>
        
        <div className="flex-1 overflow-y-auto hide-scrollbar p-2">
          {loadingProducts ? (
            <div className="text-center text-slate-400 py-10">Aranıyor...</div>
          ) : products.length > 0 ? (
            <div className="grid grid-cols-1 gap-2">
              {products.map(p => (
                <div key={p.id} className="flex justify-between items-center p-3 hover:bg-slate-50 border border-transparent border-dashed hover:border-slate-300 rounded-lg cursor-pointer" onClick={() => addToCart(p)}>
                  <div>
                    <h5 className="font-bold text-slate-800 text-sm">{p.name}</h5>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">{p.barcode}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400 font-semibold mb-0.5 uppercase tracking-wider">Son Alış</p>
                    <p className="font-bold text-slate-700">{formatCurrency(p.purchase_price)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-slate-400 py-12">
              <Search className="w-10 h-10 mx-auto mb-3 opacity-20" />
              Ürün bulunamadı. <br/><span className="text-xs mt-2 block">Kayıtlı olmayan bir ürüne sahipseniz ilk önce Onu Stok modülüne ekleyin.</span>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL - Cart (%45) */}
      <div className="w-full md:w-[45%] flex flex-col gap-4">
        
        {/* Supplier Header */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setSupplierModalOpen(true)}>
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl ${supplier ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-400'}`}>
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-0.5">Tedarikçi (F3)</p>
              <h4 className={`font-bold ${supplier ? 'text-brand-900 text-base' : 'text-slate-400 text-sm'}`}>
                {supplier ? supplier.name : 'Seçilmedi (Anonim İşlem)'}
              </h4>
            </div>
          </div>
          {supplier && (
            <div className={`text-right ${supplier.balance > 0 ? 'text-red-600' : 'text-slate-600'}`}>
               <p className="text-xs font-semibold uppercase opacity-60">Mevcut Borç</p>
               <p className="font-bold">{formatCurrency(supplier.balance)}</p>
            </div>
          )}
        </div>

        {/* Cart List */}
        <div className="flex-1 bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col min-h-0">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">Alış Sepeti <span className="bg-slate-100 text-slate-500 text-xs px-2 py-1 rounded">{cart.length}</span></h3>
            {cart.length > 0 && <button className="text-xs text-red-500 font-semibold hover:underline" onClick={() => setShowClearWarning(true)}>Sepeti Boşalt (F12)</button>}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 hide-scrollbar pr-2 mb-4">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-100 rounded-xl">
                 <Search className="w-10 h-10 opacity-20 mb-3" />
                 Sol taraftan barkod okutun veya seçin.
              </div>
            ) : (
              cart.map((item) => (
                <PurchaseCartItem 
                  key={item.product_id} 
                  item={item} 
                  onUpdate={updateCartItem} 
                  onRemove={removeCartItem} 
                />
              ))
            )}
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-4">
             <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Tedarikçi Fatura No</label>
                  <input
                    type="text"
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 font-mono placeholder:font-sans placeholder:text-slate-400"
                    placeholder="Fatura no giriniz (opsiyonel)"
                    value={invoiceNo}
                    onChange={e => setInvoiceNo(e.target.value)}
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5 ml-0.5">Tedarikçi faturasındaki numarayı giriniz. Boş bırakılabilir.</p>
               </div>
               <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Ödeme Yöntemi</label>
                  <select 
                    className="w-full px-3 py-1.5 text-sm border-slate-300 rounded-lg font-bold" 
                    value={paymentType} onChange={e => setPaymentType(e.target.value)}
                  >
                    <option value="full">Peşin / Nakden Ödendi</option>
                    <option value="partial">Kısmi Ödeme (Bazısı Kalan)</option>
                    <option value="credit">Veresiye (Borca At)</option>
                  </select>
               </div>
             </div>

             {paymentType === 'partial' && (
               <div className="flex gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                  <Input type="number" placeholder="Ödenen Miktar Girin" value={paidNow} onChange={e => setPaidNow(e.target.value)} className="flex-1" />
                  <div className="flex-1 flex flex-col justify-center text-right pr-2">
                    <span className="text-xs text-slate-500">Kalan Borca Atılacak</span>
                    <span className="font-bold text-red-500">{formatCurrency(Math.max(0, totalAmount - (parseFloat(paidNow) || 0)))}</span>
                  </div>
               </div>
             )}

             {['full', 'partial'].includes(paymentType) && (
               <div className="flex gap-2 items-center text-sm">
                 <span className="text-slate-500 font-semibold w-24">Araç Türü:</span>
                 <select className="flex-1 bg-white border border-slate-200 rounded py-1 px-2" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                   <option>Nakit</option>
                   <option>Banka / Havale / Çek</option>
                 </select>
               </div>
             )}

             <div className="text-center py-4 bg-brand-50 border border-brand-100 rounded-xl">
               <span className="text-sm font-black tracking-widest text-brand-400 block mb-1">GENEL TOPLAM</span>
               <span className="text-3xl font-black text-brand-900">{formatCurrency(totalAmount)}</span>
             </div>

             <Button 
               className="w-full h-14 text-lg font-bold tracking-wider" 
               icon={Save}
               onClick={handleComplete}
               disabled={cart.length === 0}
             >
               ALIŞ FATURASINI KAYDET (F9)
             </Button>
          </div>
        </div>

      </div>

      <SupplierSearchModal 
        isOpen={isSupplierModalOpen} 
        onClose={() => setSupplierModalOpen(false)} 
        onSelect={setSupplier} 
      />
      
      <PurchaseSuccessModal 
        isOpen={isSuccessModalOpen} 
        onClose={() => setSuccessModalOpen(false)} 
        summary={successSummary} 
      />

      <ProductFormModal 
        isOpen={isNewProductModalOpen} 
        onClose={() => setNewProductModalOpen(false)} 
        onSaved={() => fetchProducts(search)}
      />

      <Modal isOpen={showClearWarning} onClose={() => setShowClearWarning(false)} title="Sepeti Temizle" size="sm">
        <p className="text-sm text-gray-600 mb-6">Alış sepetini tamamen temizlemek istediğinize emin misiniz? Bu işlem geri alınamaz.</p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setShowClearWarning(false)}>İptal</Button>
          <Button onClick={() => { setCart([]); setShowClearWarning(false); }} className="bg-red-500 hover:bg-red-600 text-white border-red-500">Sepeti Boşalt</Button>
        </div>
      </Modal>

      <Modal isOpen={showAnonWarning} onClose={() => setShowAnonWarning(false)} title="Anonim İşlem Uyarısı" size="sm">
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
          <p className="text-sm font-semibold text-orange-800">
            Tedarikçi seçilmedi!
          </p>
          <p className="text-xs text-orange-700 mt-1">
            Tedarikçi seçmeden işlemi kaydettiğinizde, bu alış <strong>belgesiz kasa çıkışı</strong> olarak kaydedilecektir. Kısmi veya veresiye ödeme yapılamaz.
          </p>
          <p className="text-xs font-bold text-orange-800 mt-2">
            Yine de devam etmek istiyor musunuz?
          </p>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setShowAnonWarning(false)}>Geri Dön</Button>
          <Button onClick={() => { 
            let pNow = totalAmount; 
            if (paymentType === 'partial') pNow = parseFloat(paidNow) || 0;
            executePurchase(pNow); 
          }} className="bg-orange-500 hover:bg-orange-600 text-white border-orange-500">
            Devam Et
          </Button>
        </div>
      </Modal>

    </div>
  );
};
