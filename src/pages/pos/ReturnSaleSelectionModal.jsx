import React, { useState, useEffect } from 'react';
import { Search, History, ArrowLeftRight, X, ChevronLeft, ChevronRight, FileText, Receipt } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { PremiumLoader } from '../../components/ui/PremiumLoader';
import { db } from '../../db';
import { useCartStore } from '../../store/cartStore';
import { saleService } from '../../services/saleService';
import { isSupabase } from '../../config/database';
import toast from '../../components/ui/CustomToast';

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
      let allSales;
      if (isSupabase()) {
        allSales = await saleService.getAll({ customer_id: customerId });
      } else {
        allSales = await db.sales
          .where('customer_id')
          .equals(customerId)
          .reverse()
          .sortBy('created_at');
      }
      const validSales = allSales.filter(s => s.status !== 'returned' && s.status !== 'cancelled' && s.status !== 'return');
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
      let items;
      if (isSupabase()) {
        const fullSale = await saleService.getById(sale.id);
        items = fullSale?.items || [];
      } else {
        items = await db.sale_items.where('sale_id').equals(sale.id).toArray();
      }

      if (!items || items.length === 0) {
        toast.error('Bu fişte iade edilecek ürün bulunamadı.');
        return;
      }
      clearCart(true);
      setReturnSaleId(sale.id);

      for (const item of items) {
        let product;
        if (isSupabase()) {
          const { supabase } = await import('../../lib/supabaseClient');
          const { data } = await supabase.from('products').select('*').eq('id', item.product_id).single();
          product = data;
        } else {
          product = await db.products.get(item.product_id);
        }
        if (product) {
          addItem(product, item.quantity);
          const effectivePrice = item.quantity > 0
            ? Math.round((item.line_total / item.quantity) * 100) / 100
            : item.unit_price;
          useCartStore.getState().updateItemPrice(product.id, effectivePrice);
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

  useEffect(() => { setPage(1); }, [searchTerm]);

  const formatCurrency = (val) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);
  const formatDate = (dt) => new Date(dt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
  const formatTime = (dt) => new Date(dt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  const renderPaymentBadge = (method) => {
    let label = method;
    let colorClass = 'bg-slate-100 text-slate-600 border-slate-200';
    const normalizedMethod = (method || '').toUpperCase();

    if (normalizedMethod === 'CASH' || normalizedMethod === 'NAKİT' || normalizedMethod === 'NAKIT') {
      label = 'Nakit'; colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    } else if (normalizedMethod === 'CARD' || normalizedMethod === 'KART') {
      label = 'K.Kartı'; colorClass = 'bg-blue-50 text-blue-700 border-blue-200';
    } else if (normalizedMethod === 'TRANSFER' || normalizedMethod === 'HAVALE') {
      label = 'Havale'; colorClass = 'bg-purple-50 text-purple-700 border-purple-200';
    } else if (normalizedMethod === 'MIXED' || normalizedMethod === 'PARÇALI') {
      label = 'Parçalı'; colorClass = 'bg-orange-50 text-orange-700 border-orange-200';
    } else if (normalizedMethod === 'CREDIT' || normalizedMethod === 'VERESİYE') {
      label = 'Veresiye'; colorClass = 'bg-rose-50 text-rose-700 border-rose-200';
    } else if (normalizedMethod === 'SUPPLIER' || normalizedMethod === 'SUPPLIER_PAYMENT') {
      label = 'Tedarikçi'; colorClass = 'bg-indigo-50 text-indigo-700 border-indigo-200';
    }

    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${colorClass}`}>
        {label}
      </span>
    );
  };

  const renderPaginationButtons = () => {
    let pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    if (endPage - startPage < maxVisiblePages - 1) startPage = Math.max(1, endPage - maxVisiblePages + 1);

    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => setPage(i)}
          className={`w-8 h-8 text-xs rounded-lg flex items-center justify-center transition-all cursor-pointer font-bold ${
            page === i 
              ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/30' 
              : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          {i}
        </button>
      );
    }
    return pages;
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="w-full sm:w-[820px] sm:max-w-[95vw] sm:rounded-2xl rounded-t-3xl bg-white flex flex-col shadow-2xl overflow-hidden"
        style={{
          maxHeight: 'calc(100vh - 60px)',
          height: 'calc(100vh - 60px)',
          animation: 'slideUp 0.25s cubic-bezier(0.16,1,0.3,1) forwards',
        }}
        onClick={e => e.stopPropagation()}
      >
        <style>{`@keyframes slideUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }`}</style>

        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center border border-orange-100">
              <Receipt className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">İade Edilecek Satışı Seç</h2>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Fişe tıklayarak iade başlatın</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col flex-1 overflow-hidden bg-slate-50">
          {!customerId ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center">
                <History className="w-8 h-8 text-slate-300" />
              </div>
              <div>
                <p className="text-slate-700 font-semibold">Müşteri Seçilmedi</p>
                <p className="text-sm text-slate-400 mt-1">Geçmiş işlemleri görmek için önce bir <b>müşteri</b> seçin.</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col flex-1 overflow-hidden p-3 gap-3">
              <div className="relative shrink-0">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Fiş numarası ile ara..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-400 shadow-sm transition-all"
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pb-1">
                {loading ? (
                  <div className="flex flex-col items-center justify-center h-40 gap-3">
                    <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs text-slate-400 font-medium">Fişler yükleniyor...</p>
                  </div>
                ) : paginatedSales.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 gap-3">
                    <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center">
                      <FileText className="w-6 h-6 text-slate-300" />
                    </div>
                    <p className="text-slate-500 font-semibold text-sm">
                      {searchTerm ? `"${searchTerm}" ile eşleşen fiş yok` : 'Müşteriye ait fiş bulunamadı'}
                    </p>
                  </div>
                ) : (
                  paginatedSales.map(sale => (
                    <button
                      key={sale.id}
                      onClick={() => handleSelectSale(sale)}
                      className="w-full bg-white rounded-xl border border-slate-200 hover:border-orange-300 hover:shadow-md active:scale-[0.99] transition-all text-left group"
                    >
                      <div className="flex items-center gap-3 p-3.5">
                        <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0 group-hover:bg-orange-100 transition-colors">
                          <FileText className="w-5 h-5 text-orange-500" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm text-slate-800 group-hover:text-orange-600 transition-colors truncate">
                            {sale.sale_number || 'İsimsiz İşlem'}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs text-slate-400">{formatDate(sale.created_at)}</span>
                            <span className="text-[10px] text-slate-300">•</span>
                            <span className="text-xs text-slate-400">{formatTime(sale.created_at)}</span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="font-black text-sm text-slate-900">{formatCurrency(sale.total_amount)}</span>
                          {renderPaymentBadge(sale.payment_method)}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>

              {filteredSales.length > 0 && totalPages > 1 && (
                <div className="flex items-center justify-between pt-3 pb-14 sm:pb-2 border-t border-slate-200 shrink-0">
                  <span className="text-xs text-slate-500 font-semibold">
                    {filteredSales.length} fiş — Sayfa {page}/{totalPages}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {renderPaginationButtons()}
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
    </div>
  );
};
