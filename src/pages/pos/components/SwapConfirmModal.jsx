import React from 'react';
import { ArrowLeftRight, Check, X, Package } from 'lucide-react';

const fmt = (v) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(v || 0);

export const SwapConfirmModal = ({ isOpen, candidate, target, onConfirm, onCancel }) => {
  if (!isOpen || !candidate || !target) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.6)',
          boxShadow: '0 20px 48px rgba(0,0,0,0.14)',
          borderRadius: '14px',
          padding: '24px',
          width: '420px',
          maxWidth: '90vw',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="flex justify-center mb-3">
          <div className="w-12 h-12 bg-brand-50 rounded-full flex items-center justify-center">
            <ArrowLeftRight className="w-6 h-6 text-brand-500" />
          </div>
        </div>

        <h3 className="text-base font-bold text-gray-800 text-center mb-4">Ürün Değiştirilecek</h3>

        {/* Cards comparison */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 bg-red-50/80 border border-red-200 rounded-lg p-3 text-center">
            <p className="text-[10px] text-red-400 font-semibold uppercase tracking-wider mb-1">Çıkacak</p>
            <Package className="w-5 h-5 text-red-300 mx-auto mb-1" />
            <p className="text-xs font-semibold text-gray-700 line-clamp-2">{target.name}</p>
            <p className="text-xs text-brand-600 font-bold mt-1">{fmt(target.sale_price)}</p>
          </div>
          <div className="flex-shrink-0">
            <ArrowLeftRight className="w-5 h-5 text-gray-300" />
          </div>
          <div className="flex-1 bg-emerald-50/80 border border-emerald-200 rounded-lg p-3 text-center">
            <p className="text-[10px] text-emerald-500 font-semibold uppercase tracking-wider mb-1">Girecek</p>
            <Package className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
            <p className="text-xs font-semibold text-gray-700 line-clamp-2">{candidate.name}</p>
            <p className="text-xs text-brand-600 font-bold mt-1">{fmt(candidate.sale_price)}</p>
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center mb-4">
          Bu işlem geri alınamaz. Devam etmek istiyor musunuz?
        </p>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '8px 0', borderRadius: '10px',
              background: 'rgba(156,163,175,0.15)', border: '1px solid rgba(156,163,175,0.2)',
              color: '#6b7280', fontSize: '13px', fontWeight: '500', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
              transition: 'all 0.15s ease',
            }}
          >
            <X className="w-4 h-4" /> İptal
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, padding: '8px 0', borderRadius: '10px',
              background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
              boxShadow: '0 4px 12px rgba(16,185,129,0.15)',
              color: 'rgb(4,120,87)', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
              transition: 'all 0.15s ease',
            }}
          >
            <Check className="w-4 h-4" /> Evet, Değiştir
          </button>
        </div>
      </div>
    </div>
  );
};
