import React, { useState } from 'react';
import { Plus, Minus, CornerDownLeft } from 'lucide-react';
import toast from '../../../components/ui/CustomToast';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { stockService } from '../../../services/stockService';

export const StockMovementModal = ({ isOpen, onClose, product, onSaved }) => {
  const [type, setType] = useState('adjustment_in');
  const [qty, setQty] = useState('');
  const [unitPrice, setUnitPrice] = useState(product ? product.purchase_price : 0);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  // Sync when product changes
  React.useEffect(() => {
    if (product) {
      setUnitPrice(product.purchase_price);
      setQty('');
      setNotes('');
      setType('adjustment_in');
    }
  }, [product, isOpen]);

  if (!product) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    const parsedQty = parseFloat(qty);
    if (!parsedQty || parsedQty <= 0) {
      toast.error('Geçerli bir miktar girin.');
      return;
    }

    // UX override warning if adjustment_out drives below zero conceptually
    if (['adjustment_out', 'return_out'].includes(type) && product.stock_quantity - parsedQty < 0) {
      setShowWarning(true);
      return;
    }

    await executeSave(parsedQty);
  };

  const executeSave = async (parsedQty) => {
    setLoading(true);
    try {
      await stockService.addMovement(
        product.id,
        type,
        parsedQty,
        parseFloat(unitPrice) || 0,
        notes,
        'MANUAL-ADJ'
      );
      toast.success('Stok hareketi başarıyla işlendi.');
      onSaved();
      onClose();
    } catch (err) {
      console.error('[StockMovement] Kayıt hatası:', err);
      toast.error(err?.message || 'Stok hareketi kaydedilirken hata oluştu.');
    } finally {
      setLoading(false);
      setShowWarning(false);
    }
  };

  const types = [
    { value: 'adjustment_in', label: 'Giriş', icon: Plus, bgColor: 'bg-green-50 text-green-700 border-green-200' },
    { value: 'adjustment_out', label: 'Çıkış', icon: Minus, bgColor: 'bg-red-50 text-red-700 border-red-200' },
    { value: 'return_in', label: 'İade (Alış)', icon: CornerDownLeft, bgColor: 'bg-blue-50 text-blue-700 border-blue-200' }
  ];

  const currentQty = product.stock_quantity;
  const isOut = type.includes('out');
  const previewQty = isOut ? currentQty - (parseFloat(qty) || 0) : currentQty + (parseFloat(qty) || 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manuel Stok Hareketi" size="sm">
      <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl">
        <h4 className="font-bold text-slate-800">{product.name}</h4>
        <p className="text-sm text-slate-500 font-mono mt-1">{product.barcode}</p>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Hareket Türü</label>
          <div className="grid grid-cols-3 gap-2">
            {types.map(t => {
              const Icon = t.icon;
              const isActive = type === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                    isActive ? `${t.bgColor} border-current ring-2 ring-offset-2 ring-current ring-opacity-30` : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-5 h-5 mb-1" />
                  <span className="text-xs font-bold">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <Input 
            label={`Miktar (${product.unit})`} 
            type="number" 
            step="0.001" 
            min="0" 
            value={qty} 
            onChange={e => setQty(e.target.value)} 
            required 
            autoFocus 
          />
          <Input 
            label="Birim Fiyat (₺) (Opsiyonel)" 
            type="number" 
            step="0.01" 
            min="0" 
            value={unitPrice} 
            onChange={e => setUnitPrice(e.target.value)} 
          />
        </div>

        <div className="pt-2">
          <label className="block text-sm font-semibold text-slate-700 mb-1">Açıklama / Sebep</label>
          <textarea 
            rows={2}
            className="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-brand-500"
            placeholder="Kırık, dökük, sayım farkı vb."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        {/* Live Preview */}
        {qty > 0 && (
          <div className="bg-slate-800 text-slate-100 rounded-xl p-4 flex items-center justify-between mt-4">
            <span className="text-sm text-slate-400">Yeni Stok Önizlemesi</span>
            <div className="font-bold font-mono tracking-widest text-lg">
              <span className="text-slate-400 opacity-60 line-through mr-2">{currentQty}</span>
              <span className={previewQty < 0 ? 'text-red-400' : 'text-emerald-400'}>{previewQty}</span>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
          <Button variant="ghost" type="button" onClick={onClose}>İptal</Button>
          <Button type="submit" isLoading={loading}>Kaydet</Button>
        </div>
      </form>

      <Modal isOpen={showWarning} onClose={() => setShowWarning(false)} title="Negatif Stok Uyarısı" size="sm">
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
          <p className="text-sm font-semibold text-orange-800">
            DİKKAT: Stok miktarı eksiye düşecek!
          </p>
          <p className="text-xs text-orange-700 mt-1">
            Mevcut Stok: <strong>{currentQty}</strong><br/>
            Çıkan Stok: <strong>{qty}</strong>
          </p>
          <p className="text-xs text-orange-700 mt-2">
            Yine de işleme devam etmek istiyor musunuz?
          </p>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setShowWarning(false)}>İptal</Button>
          <Button onClick={() => executeSave(parseFloat(qty))} className="bg-orange-500 hover:bg-orange-600 text-white border-orange-500">
            Devam Et
          </Button>
        </div>
      </Modal>
    </Modal>
  );
};
