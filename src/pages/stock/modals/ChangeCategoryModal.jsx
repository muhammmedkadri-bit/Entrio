import React, { useState } from 'react';
import { Tag, Check, Loader2 } from 'lucide-react';
import toast from '../../../components/ui/CustomToast';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { productService } from '../../../services/productService';

export const ChangeCategoryModal = ({ isOpen, onClose, product, categories = [], onSaved }) => {
  const [selected, setSelected] = useState(product?.category_id || null);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (product) setSelected(product.category_id || null);
  }, [product, isOpen]);

  const handleSave = async () => {
    if (selected === product?.category_id) { onClose(); return; }
    setLoading(true);
    try {
      await productService.update(product.id, { category_id: selected });
      toast.success('Kategori güncellendi.');
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Kategori Değiştir" size="sm">
      <p className="text-xs text-gray-400 mb-4">Ürünün kategorisini değiştirmek için aşağıdan seçin.</p>
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {categories.map(cat => {
          const isActive = selected === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelected(cat.id)}
              className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${
                isActive
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                  : 'border-gray-100 hover:border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm font-medium">{cat.name}</span>
              </div>
              {isActive && <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
            </button>
          );
        })}
        {categories.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-4">Kategori bulunamadı.</p>
        )}
      </div>
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
        <Button variant="ghost" onClick={onClose}>İptal</Button>
        <Button onClick={handleSave} isLoading={loading} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Kaydet'}
        </Button>
      </div>
    </Modal>
  );
};
