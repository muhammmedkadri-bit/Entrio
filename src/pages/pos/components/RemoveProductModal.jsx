import React from 'react';
import { Trash2, X } from 'lucide-react';

export const RemoveProductModal = ({ isOpen, product, onConfirm, onCancel }) => {
  if (!isOpen || !product) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(4px)' }}
      onClick={onCancel}
    >
      <div
        className="mx-4 w-full max-w-sm"
        style={{
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.65)',
          boxShadow: '0 20px 48px rgba(0,0,0,0.13)',
          borderRadius: '16px',
          padding: '24px',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="w-12 h-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-4">
          <Trash2 className="w-5 h-5 text-red-400" />
        </div>

        {/* Title */}
        <p className="text-base font-semibold text-gray-800 text-center">
          Hızlı Üründen Kaldır
        </p>

        {/* Product name */}
        <p className="text-sm font-medium text-indigo-600 text-center mt-1 leading-snug px-2">
          {product.name}
        </p>

        {/* Description */}
        <p className="text-xs text-gray-400 text-center mt-2 leading-relaxed px-2">
          Bu ürün hızlı ürün listesinden kaldırılacak. Ürünün kendisi ve stok bilgisi etkilenmez.
        </p>

        {/* Buttons */}
        <div className="flex gap-2 mt-5">
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              background: 'rgba(156,163,175,0.12)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(156,163,175,0.2)',
              borderRadius: '10px',
              color: 'rgb(107,114,128)',
              padding: '9px 0',
              fontWeight: '500',
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Vazgeç
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              background: 'rgba(239,68,68,0.10)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(239,68,68,0.25)',
              boxShadow: '0 2px 8px rgba(239,68,68,0.12), inset 0 1px 0 rgba(255,255,255,0.5)',
              borderRadius: '10px',
              color: 'rgb(185,28,28)',
              padding: '9px 0',
              fontWeight: '600',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Kaldır
          </button>
        </div>
      </div>
    </div>
  );
};
