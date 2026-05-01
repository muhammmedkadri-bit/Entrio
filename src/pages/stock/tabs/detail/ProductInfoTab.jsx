import React from 'react';
import { format } from 'date-fns';
import { Info, DollarSign, Tag, Layers } from 'lucide-react';

const fmt = (v) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(v || 0);

const InfoRow = ({ label, children }) => (
  <div className="flex items-start justify-between gap-4 py-2.5 border-b border-gray-50 last:border-0">
    <span className="text-xs text-gray-400 font-medium min-w-[140px] flex-shrink-0">{label}</span>
    <div className="text-sm text-right text-gray-800">{children}</div>
  </div>
);

export const ProductInfoTab = ({ product, categoryName, supplierName }) => {
  if (!product) return null;

  const margin = product.purchase_price > 0
    ? ((product.sale_price - product.purchase_price) / product.purchase_price * 100).toFixed(1)
    : null;

  const marginColor =
    margin > 30 ? 'text-emerald-600' :
    margin > 10 ? 'text-yellow-600' :
    'text-red-600';

  const kdvDahilFiyat = product.sale_price * (1 + (product.tax_rate || 0) / 100);
  const karTutar = product.sale_price - product.purchase_price;
  const stockVal_purchase = product.stock_quantity * product.purchase_price;
  const stockVal_sale = product.stock_quantity * product.sale_price;

  const stockColor =
    product.stock_quantity > product.min_stock_level ? 'text-emerald-600' :
    product.stock_quantity > 0 ? 'text-orange-500' :
    'text-red-600';

  return (
    <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Left: Temel Bilgiler */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-4">
          <Info className="w-4 h-4 text-gray-400" /> Temel Bilgiler
        </h3>
        <InfoRow label="Ürün Adı"><span className="font-semibold">{product.name}</span></InfoRow>
        <InfoRow label="Barkod"><span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{product.barcode}</span></InfoRow>
        <InfoRow label="Kategori">
          <span className="inline-flex items-center gap-1 text-xs font-semibold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
            <Tag className="w-3 h-3" />{categoryName || '—'}
          </span>
        </InfoRow>
        <InfoRow label="Tedarikçi">{supplierName || '—'}</InfoRow>
        <InfoRow label="Birim">{product.unit || '—'}</InfoRow>
        <InfoRow label="Açıklama"><span className="text-gray-500 italic">{product.description || '—'}</span></InfoRow>
        <InfoRow label="Eklenme Tarihi">
          {product.created_at ? format(new Date(product.created_at), 'dd.MM.yyyy') : '—'}
        </InfoRow>
        <InfoRow label="Durum">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${product.is_active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
            {product.is_active !== false ? 'Aktif' : 'Arşivlenmiş'}
          </span>
        </InfoRow>
      </div>

      {/* Right: Fiyat & Stok */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-4">
          <DollarSign className="w-4 h-4 text-gray-400" /> Fiyat &amp; Stok
        </h3>
        <InfoRow label="Satış Fiyatı"><span className="font-bold text-indigo-600 text-base">{fmt(product.sale_price)}</span></InfoRow>
        <InfoRow label="Alış Fiyatı"><span className="font-medium text-gray-500">{fmt(product.purchase_price)}</span></InfoRow>
        <InfoRow label="KDV Oranı">%{product.tax_rate || 0}</InfoRow>
        <InfoRow label="KDV Dahil Fiyat">{fmt(kdvDahilFiyat)}</InfoRow>
        <InfoRow label="Kar Tutarı"><span className="font-semibold text-green-600">{fmt(karTutar)}</span></InfoRow>
        <InfoRow label="Kar Marjı">{margin !== null ? <span className={`font-bold ${marginColor}`}>%{margin}</span> : '—'}</InfoRow>
        <InfoRow label="Mevcut Stok">
          {product.track_stock === false ? (
            <span className="text-xs font-semibold text-slate-400 italic bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200">Stok takibi yapılmıyor</span>
          ) : (
            <span className={`font-extrabold text-base ${stockColor}`}>{product.stock_quantity} {product.unit}</span>
          )}
        </InfoRow>
        <InfoRow label="Min. Stok Uyarı">
          {product.track_stock === false ? (
            <span className="text-xs text-slate-400 italic">—</span>
          ) : (
            <span className="flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-gray-400" />{product.min_stock_level || 0} {product.unit}
            </span>
          )}
        </InfoRow>
        <InfoRow label="Stok Değeri (Alış)">{fmt(stockVal_purchase)}</InfoRow>
        <InfoRow label="Stok Değeri (Satış)">{fmt(stockVal_sale)}</InfoRow>
      </div>
    </div>
  );
};
