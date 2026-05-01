import React, { useState, useEffect } from 'react';
import { Search, History, ArrowLeftRight, X, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { PremiumLoader } from '../../components/ui/PremiumLoader';
import { db } from '../../db';
import { useCartStore } from '../../store/cartStore';
import toast from 'react-hot-toast';

export const ReturnSaleSelectionModal = ({ isOpen, onClose, customerId }) => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  
  const { clearCart, addItem, setReturnSaleId } = useCartStore();

  useEffect(() => {
    if (isOpen && customerId) {
      setSearchTerm('');
      setPage(1);
      fetchCustomerSales();
    }
  }, [isOpen, customerId]);

  const fetchCustomerSales = async () => {
    setLoading(true);
    try {
      const allSales = await db.sales
        .where('customer_id')
        .equals(customerId)
        .reverse()
        .sortBy('created_at');
        
      // Exclude already returned sales
      const validSales = allSales.filter(s => s.status !== 'returned');
      setSales(validSales.slice(0, 50));
    } catch (error) {
      console.error('[ReturnSaleSelectionModal] Geçmiş Satışları Yükleme Hatası:', error);
      toast.error(error?.message || 'Geçmiş satışlar yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSale = async (sale) => {
    try {
      const items = await db.sale_items.where('sale_id').equals(sale.id).toArray();
      if (!items || items.length === 0) {
        toast.error('Bu fişte iade edilecek ürün bulunamadı.');
        return;
      }
      clearCart(true);
      setReturnSaleId(sale.id);
      
      for (const item of items) {
        const product = await db.products.get(item.product_id);
        if (product) {
          addItem(product, item.quantity);
          useCartStore.getState().updateItemPrice(product.id, item.unit_price);
        }
      }
      
      toast.success(`${sale.sale_number} numaralı fiş iade için sepete eklendi.`);
      onClose();
    } catch (e) {
      console.error('[ReturnSaleSelectionModal] Fiş Seçim Hatası:', e);
      toast.error(e?.message || 'Fiş detayları yüklenirken hata oluştu.');
    }
  };

  const filteredSales = sales.filter(s => {
    const saleNum = s.sale_number || '';
    return saleNum.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const totalPages = Math.ceil(filteredSales.length / ITEMS_PER_PAGE);
  const paginatedSales = filteredSales.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  // Reset to page 1 on search
  useEffect(() => { setPage(1); }, [searchTerm]);

  const formatCurrency = (val) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);

  const renderPaymentBadge = (method) => {
    let label = method;
    let colorClass = 'bg-slate-50 text-slate-600 border-slate-200';

    const normalizedMethod = (method || '').toUpperCase();

    if (normalizedMethod === 'CASH' || normalizedMethod === 'NAKİT' || normalizedMethod === 'NAKIT') {
      label = 'Nakit';
      colorClass = 'bg-emerald-50 text-emerald-600 border-emerald-200';
    } else if (normalizedMethod === 'CARD' || normalizedMethod === 'KART') {
      label = 'Kredi Kartı';
      colorClass = 'bg-blue-50 text-blue-600 border-blue-200';
    } else if (normalizedMethod === 'TRANSFER' || normalizedMethod === 'HAVALE') {
      label = 'Havale / Eft';
      colorClass = 'bg-purple-50 text-purple-600 border-purple-200';
    } else if (normalizedMethod === 'MIXED' || normalizedMethod === 'PARÇALI') {
      label = 'Parçalı Ödeme';
      colorClass = 'bg-orange-50 text-orange-600 border-orange-200';
    } else if (normalizedMethod === 'CREDIT' || normalizedMethod === 'VERESİYE') {
      label = 'Veresiye';
      colorClass = 'bg-rose-50 text-rose-600 border-rose-200';
    } else if (normalizedMethod === 'SUPPLIER' || normalizedMethod === 'SUPPLIER_PAYMENT') {
      label = 'Tedarikçiye Ödeme';
      colorClass = 'bg-indigo-50 text-indigo-600 border-indigo-200';
    }

    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${colorClass}`}>
        {label}
      </span>
    );
  };

  const renderPaginationButtons = () => {
    let pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2));
    let endPage = startPage + maxVisiblePages - 1;

    if (endPage > totalPages) {
      endPage = totalPages;
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        pages.push(
          <button
            key={i}
            onClick={() => setPage(i)}
            className={`w-7 h-7 text-xs rounded-lg flex items-center justify-center transition-all cursor-pointer ${
              page === i 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold shadow-sm' 
                : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {i}
          </button>
        );
    }
    return pages;
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <FileText className="w-4 h-4 text-emerald-600" />
          </div>
          <span>İade Edilecek Satışı Seç</span>
        </div>
      } 
      size="xl2" 
      heightClass="h-[85vh]" 
      bodyClassName="p-0 flex flex-col"
    >
      <div className="flex flex-col h-full p-3 space-y-2 bg-slate-50/50">
        {!customerId ? (
        <div className="p-6 text-center text-slate-500">
          <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Geçmiş işlemleri görmek için lütfen önce bir <b>Müşteri</b> seçin.</p>
        </div>
      ) : (
        <div className="flex flex-col h-full space-y-2 overflow-hidden">
          <div className="relative group shrink-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors pointer-events-none" />
            <input
              type="text"
              autoFocus
              placeholder="Fiş no ile ara..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="block w-full border border-slate-300 rounded-lg bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm shadow-sm transition-all px-3 py-2.5 pl-10"
            />
          </div>

          <div className="border border-slate-200 bg-white rounded-lg overflow-y-auto flex-1 custom-scrollbar relative">
            {loading ? (
              <div className="relative h-48">
                <PremiumLoader isOpen={true} />
              </div>
            ) : paginatedSales.length > 0 ? (
              <ul className="divide-y divide-slate-200 flex flex-col h-full">
                {paginatedSales.map(sale => (
                  <li
                    key={sale.id}
                    className="h-[10%] px-3 hover:bg-slate-50 cursor-pointer flex justify-between items-center transition-colors group"
                    onClick={() => handleSelectSale(sale)}
                  >
                    {/* Left: Icon + Invoice No */}
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20">
                        <FileText className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="font-bold text-sm text-slate-800 group-hover:text-emerald-600 transition-colors">
                        {sale.sale_number || 'İsimsiz İşlem'}
                      </div>
                    </div>

                    {/* Center: Date */}
                    <div className="flex-1 text-center">
                      <div className="text-xs text-slate-500">{new Date(sale.created_at).toLocaleDateString('tr-TR')}</div>
                      <div className="text-[10px] text-slate-400">{new Date(sale.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>

                    {/* Right: Amount + Pill */}
                    <div className="flex-1 flex flex-col items-end justify-center gap-0.5">
                      <div className="font-bold text-sm text-slate-900 leading-none">{formatCurrency(sale.total_amount)}</div>
                      {renderPaymentBadge(sale.payment_method)}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-8 text-center text-slate-500 text-sm">
                <p>Müşteriye ait uygun satış bulunamadı.</p>
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          {filteredSales.length > 0 && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-200 shrink-0">
              <span className="text-xs text-slate-500 font-medium">
                {filteredSales.length} fiş — Sayfa {page}/{totalPages}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {renderPaginationButtons()}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </Modal>
  );
};
