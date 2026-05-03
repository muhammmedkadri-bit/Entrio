import React, { useEffect, useState } from 'react';
import { X, Package, ArrowLeftRight } from 'lucide-react';
import { format } from 'date-fns';
import { stockService } from '../../../services/stockService';
import { Badge } from '../../../components/ui/Badge';
import { PremiumLoader } from '../../../components/ui/PremiumLoader';

export const ProductDetailDrawer = ({ isOpen, onClose, product, onEditClick, onMovementClick }) => {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && product) {
      fetchMovements();
    }
  }, [isOpen, product]);

  const fetchMovements = async () => {
    setLoading(true);
    try {
      const resp = await stockService.getMovements({ product_id: product.id });
      setMovements(resp.slice(0, 10)); // keep last 10
    } catch (e) {
      console.error('[ProductDetailDrawer] Hareketleri Yükleme Hatası:', e);
      toast.error(e?.message || 'Geçmiş stok hareketleri yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  const getMovementTypeProps = (type) => {
    switch(type) {
      case 'purchase': return { label: 'Alış', variant: 'info' };
      case 'sale': return { label: 'Satış', variant: 'success' };
      case 'return_in': return { label: 'İade (G)', variant: 'info' };
      case 'return_out': return { label: 'İade (Ç)', variant: 'warning' };
      case 'adjustment_in': return { label: 'Düz. (G)', variant: 'success' };
      case 'adjustment_out': return { label: 'Düz. (Ç)', variant: 'danger' };
      default: return { label: type, variant: 'default' };
    }
  };

  if (!product) return null;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div 
        className={`fixed top-0 right-0 h-full w-full sm:w-96 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col relative ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex justify-between items-center p-4 sm:p-6 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-50 text-brand-600 rounded-lg">
              <Package className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Ürün Detayı</h3>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto hide-scrollbar">
          
          <div className="p-6 border-b border-slate-100">
            <p className="text-xs font-mono text-slate-400 mb-1">{product.barcode}</p>
            <h2 className="text-xl font-bold text-slate-800 mb-4 leading-tight">{product.name}</h2>
            
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex justify-between items-center">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">Mevcut Stok</p>
                <div className="text-2xl font-bold flex items-baseline gap-1">
                  <span className={product.stock_quantity <= 0 ? 'text-red-500' : 'text-slate-800'}>{product.stock_quantity}</span>
                  <span className="text-sm font-semibold text-slate-400">{product.unit}</span>
                </div>
              </div>
              <Badge variant={product.stock_quantity <= 0 ? 'danger' : product.stock_quantity <= product.min_stock_level ? 'warning' : 'success'}>
                {product.stock_quantity <= 0 ? 'TÜKENDİ' : product.stock_quantity <= product.min_stock_level ? 'KRİTİK' : 'YETERLİ'}
              </Badge>
            </div>
          </div>

          <div className="p-6 py-4 border-b border-slate-100 grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs text-slate-400 font-semibold uppercase">Alış Fiyatı</span>
              <div className="font-bold text-slate-800 mt-0.5">₺{product.purchase_price}</div>
            </div>
            <div>
              <span className="text-xs text-slate-400 font-semibold uppercase">Satış Fiyatı</span>
              <div className="font-bold text-brand-700 mt-0.5">₺{product.sale_price}</div>
            </div>
          </div>

          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-sm font-bold text-slate-800">Son Hareketler</h4>
            </div>
            
            {loading ? (
              
            ) : movements.length > 0 ? (
              <ul className="space-y-3">
                {movements.map(m => {
                  const props = getMovementTypeProps(m.movement_type);
                  const isInput = ['adjustment_in', 'return_in', 'purchase'].includes(m.movement_type);
                  return (
                    <li key={m.id} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div>
                        <div className="text-xs font-medium text-slate-500 mb-1">{format(m.created_at, 'dd.MM.yyyy HH:mm')}</div>
                        <Badge variant={props.variant}>{props.label}</Badge>
                      </div>
                      <div className={`font-bold ${isInput ? 'text-green-600' : 'text-red-600'}`}>
                        {isInput ? '+' : '-'}{m.quantity}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="text-center text-slate-400 py-6 border border-dashed border-slate-200 rounded-xl text-sm">
                Hareket bulunamadı.
              </div>
            )}
          </div>
        </div>

        <div className="p-4 sm:p-6 border-t border-slate-100 bg-white grid grid-cols-2 gap-3">
          <button 
            onClick={() => { onClose(); onEditClick(product); }}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors flex justify-center items-center text-sm"
          >
            Düzenle
          </button>
          <button 
            onClick={() => { onClose(); onMovementClick(product); }}
            className="px-4 py-2.5 bg-brand-50 hover:bg-brand-100 text-brand-700 font-semibold rounded-lg transition-colors flex gap-2 justify-center items-center text-sm"
          >
            <ArrowLeftRight className="w-4 h-4" /> Stok Gir / Çık
          </button>
        </div>
      </div>
    </>
  );
};
