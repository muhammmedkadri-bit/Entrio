import React, { useState } from 'react';
import { Plus, Minus, Target, ArrowRight } from 'lucide-react';
import toast from '../../../components/ui/CustomToast';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { stockService } from '../../../services/stockService';
import { productService } from '../../../services/productService';

const TYPES = [
  { value: 'adjustment_in', label: 'Stok Ekle', icon: Plus, color: 'border-emerald-400 bg-emerald-50 text-emerald-700', ring: 'ring-emerald-200' },
  { value: 'adjustment_out', label: 'Stok Çıkar', icon: Minus, color: 'border-red-400 bg-red-50 text-red-700', ring: 'ring-red-200' },
  { value: 'set_exact', label: 'Kesin Miktar', icon: Target, color: 'border-blue-400 bg-blue-50 text-blue-700', ring: 'ring-blue-200' },
];

export const StockUpdateModal = ({ isOpen, onClose, product, onSaved }) => {
  const [type, setType] = useState('adjustment_in');
  const [qty, setQty] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  React.useEffect(() => {
    if (isOpen) { setType('adjustment_in'); setQty(''); setNotes(''); }
  }, [isOpen]);

  if (!product) return null;

  const parsedQty = parseFloat(qty) || 0;
  const current = product.stock_quantity;
  const preview =
    type === 'adjustment_in' ? current + parsedQty :
    type === 'adjustment_out' ? current - parsedQty :
    parsedQty;

  let previewGlass = '';
  let previewTextColor = '';
  if (type === 'adjustment_in') {
    previewGlass = 'bg-[#82e05a]/15 text-[#5da83f] border-[#82e05a]/30';
    previewTextColor = 'text-[#5da83f]';
  } else if (type === 'adjustment_out') {
    previewGlass = 'bg-rose-500/10 border-rose-500/30 text-rose-600';
    previewTextColor = 'text-rose-600';
  } else {
    previewGlass = 'bg-blue-500/10 border-blue-500/30 text-blue-600';
    previewTextColor = 'text-blue-600';
  }

  const handleSave = async () => {
    if (parsedQty <= 0) { toast.error('Geçerli bir miktar girin.'); return; }
    if (type === 'adjustment_out' && current - parsedQty < 0) {
      setShowWarning(true);
      return;
    }
    await executeSave();
  };

  const executeSave = async () => {
    setLoading(true);
    try {
      if (type === 'set_exact') {
        // Calculate delta and record as adjustment
        const delta = parsedQty - current;
        const movType = delta >= 0 ? 'adjustment_in' : 'adjustment_out';
        await stockService.addMovement(product.id, movType, Math.abs(delta), 0, notes || `Kesin miktar: ${parsedQty}`);
      } else {
        await stockService.addMovement(product.id, type, parsedQty, 0, notes);
      }
      toast.success('Stok güncellendi.');
      onSaved();
      onClose();
    } catch (e) {
      console.error('[StockUpdate] Kayıt hatası:', e);
      toast.error(e?.message || 'Stok güncellenirken hata oluştu.');
    } finally {
      setLoading(false);
      setShowWarning(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Stok Güncelle" size="sm">
      {/* Current Stock Display */}
      <div className="mb-5 p-4 bg-slate-50 border border-slate-200 rounded-xl text-center">
        <p className="text-xs text-gray-400 mb-1">Mevcut Stok</p>
        <p className="text-3xl font-extrabold text-gray-800 tabular-nums">
          {current} <span className="text-base font-medium text-gray-400">{product.unit}</span>
        </p>
      </div>

      {/* Type selection */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {TYPES.map(t => {
          const Icon = t.icon;
          const isActive = type === t.value;
          return (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                isActive ? `${t.color} ring-2 ring-offset-1 ${t.ring}` : 'border-gray-100 text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-5 h-5 mb-1" />
              <span className="text-xs font-bold">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Quantity */}
      <div className="mt-2">
        <label className="block text-xs font-semibold text-gray-600 mb-2">
          {type === 'set_exact' ? `Hedef Stok Miktarı (${product.unit})` : `Miktar (${product.unit})`}
        </label>
        <div className="relative">
          <input
            type="number" step="0.001" min="0"
            value={qty} onChange={e => setQty(e.target.value)}
            autoFocus
            className="w-full text-center text-3xl font-extrabold rounded-2xl border-2 border-slate-200 bg-white py-4 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/20 transition-all tabular-nums text-gray-800"
            placeholder="0"
          />
        </div>
      </div>

      {/* Preview */}
      {parsedQty > 0 && (
        <div className={`mt-4 flex items-center justify-center gap-3 py-3 px-4 rounded-xl border backdrop-blur-md shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)] transition-all ${previewGlass}`}>
          <span className="font-mono font-bold text-lg opacity-60 line-through">{current}</span>
          <ArrowRight className="w-4 h-4 opacity-70" />
          <span className={`font-mono font-extrabold text-2xl ${previewTextColor}`}>
            {Math.round(preview * 1000) / 1000}
          </span>
          <span className="opacity-70 text-sm font-medium">{product.unit}</span>
        </div>
      )}

      {/* Notes */}
      <div className="mt-4">
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notlar / Sebep</label>
        <textarea
          rows={2}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:ring-2 focus:ring-emerald-400 focus:outline-none resize-none"
          placeholder="Sayım farkı, kırık, iade vb."
          value={notes} onChange={e => setNotes(e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-gray-100">
        <Button variant="ghost" onClick={onClose}>İptal</Button>
        <Button onClick={handleSave} isLoading={loading}>Kaydet</Button>
      </div>

      <Modal isOpen={showWarning} onClose={() => setShowWarning(false)} title="Negatif Stok Uyarısı" size="sm">
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
          <p className="text-sm font-semibold text-orange-800">
            DİKKAT: Stok miktarı eksiye düşecek!
          </p>
          <p className="text-xs text-orange-700 mt-1">
            Mevcut Stok: <strong>{current}</strong><br/>
            Yeni Stok Önizlemesi: <strong>{preview}</strong>
          </p>
          <p className="text-xs text-orange-700 mt-2">
            Yine de işleme devam etmek istiyor musunuz?
          </p>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setShowWarning(false)}>İptal</Button>
          <Button onClick={executeSave} className="bg-orange-500 hover:bg-orange-600 text-white border-orange-500">
            Devam Et
          </Button>
        </div>
      </Modal>
    </Modal>
  );
};
