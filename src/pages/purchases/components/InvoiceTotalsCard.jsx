import React from 'react';

const fmt = (v) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(v || 0);

export const InvoiceTotalsCard = ({
  subtotal = 0,
  discountTotal = 0,
  kdvTotal = 0,
  otvTotal = 0,
  grandTotal = 0,
  paidAmount = 0,
  paymentMethod,
  hidePaymentDetails = false,
}) => {
  const remaining = Math.max(0, Math.round((grandTotal - paidAmount) * 100) / 100);

  return (
    <div
      className="rounded-xl p-4 h-full flex flex-col bg-white"
      style={{ border: '1px solid rgba(16,185,129,0.15)' }}
    >
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Fatura Özeti</p>

      <div className="space-y-1.5 flex-1 flex flex-col justify-end mt-auto">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Ara Toplam</span>
          <span className="font-medium text-gray-700">{fmt(subtotal)}</span>
        </div>

        {discountTotal > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-900">Toplam İndirim</span>
            <span className="font-medium text-gray-900">-{fmt(discountTotal)}</span>
          </div>
        )}

        {kdvTotal > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-900">KDV Toplamı</span>
            <span className="font-medium text-gray-900">{fmt(kdvTotal)}</span>
          </div>
        )}

        {otvTotal > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-orange-500">ÖTV Toplamı</span>
            <span className="font-medium text-orange-500">{fmt(otvTotal)}</span>
          </div>
        )}

        <div
          className="flex justify-between items-center pt-3 mt-2"
          style={{ borderTop: '1px solid rgba(16,185,129,0.2)' }}
        >
          <span className="font-bold text-gray-700 text-sm uppercase tracking-wide">Genel Toplam</span>
          <span className="text-xl font-extrabold text-gray-900">{fmt(grandTotal)}</span>
        </div>

        {!hidePaymentDetails && paymentMethod && paymentMethod !== 'on_credit' && paidAmount > 0 && (
          <div className="pt-2 space-y-1.5 border-t border-dashed border-gray-200 mt-1">
            <div className="flex justify-between text-sm">
              <span className="text-emerald-600">Ödenen</span>
              <span className="font-semibold text-emerald-600">{fmt(paidAmount)}</span>
            </div>
            {remaining > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-red-500">Kalan Borç</span>
                <span className="font-semibold text-red-500">{fmt(remaining)}</span>
              </div>
            )}
            {remaining <= 0 && (
              <div className="text-center text-xs text-emerald-600 font-semibold py-1">
                ✓ Tam Ödendi
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
