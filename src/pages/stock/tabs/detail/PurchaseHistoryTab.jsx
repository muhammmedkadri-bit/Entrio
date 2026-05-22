import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../../../store/appStore';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Package, CircleDollarSign, BarChart2, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

const fmt = (v) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(v || 0);
const fmtDate = (ts) => { try { return format(new Date(ts), 'd MMMM yyyy HH:mm', { locale: tr }); } catch { return '—'; } };

const STATUS_LABELS = {
  received: { label: 'Teslim Alındı', color: 'bg-emerald-100 text-emerald-700' },
  pending: { label: 'Beklemede', color: 'bg-yellow-100 text-yellow-700' },
  cancelled: { label: 'İptal', color: 'bg-red-100 text-red-700' },
};



const ITEMS_PER_PAGE = 10;

export const PurchaseHistoryTab = ({ purchaseHistory = [], product }) => {
  const navigate = useNavigate();
  const { startNavigation } = useAppStore();
  const [page, setPage] = useState(1);

  const totalQty = useMemo(() => purchaseHistory.reduce((s, pi) => s + (pi.quantity || 0), 0), [purchaseHistory]);
  const totalAmount = useMemo(() => purchaseHistory.reduce((s, pi) => s + (pi.line_total || 0), 0), [purchaseHistory]);
  const avgPrice = totalQty > 0 ? totalAmount / totalQty : 0;
  const lastPurchase = purchaseHistory[0];

  const totalPages = Math.ceil(purchaseHistory.length / ITEMS_PER_PAGE);
  const paginated = purchaseHistory.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const renderPaginationButtons = () => {
    const maxVisible = 5;
    let startPage = Math.max(1, page - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    const buttons = [];
    for (let i = startPage; i <= endPage; i++) {
      buttons.push(
        <button
          key={i}
          onClick={() => setPage(i)}
          className={`flex items-center justify-center w-7 h-7 text-xs rounded-lg transition-colors ${
            page === i
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-600 font-semibold'
              : 'border border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}
        >
          {i}
        </button>
      );
    }
    return buttons;
  };

  return (
    <div className="pt-1 pb-10 relative">
      {/* Desktop Table — shrinks to content */}
      <div className="hidden sm:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {[
                { label: 'Fatura No', width: 'w-[15%]' },
                { label: 'Tedarikçi', width: 'w-[22%]' },
                { label: 'Alış Tarihi', width: 'w-[15%]' },
                { label: 'Alınan Miktar', width: 'w-[13%]' },
                { label: 'Alış Fiyatı', width: 'w-[15%]' },
                { label: 'Fatura Toplamı', width: 'w-[15%]' },
                { label: 'Durum', width: 'auto' }
              ].map(h => (
                <th key={h.label} className={`text-left px-4 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap ${h.width}`}>{h.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {paginated.length === 0 && (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400 text-sm">Alış kaydı bulunamadı.</td></tr>
            )}
            {paginated.map((pi, i) => {
              const st = STATUS_LABELS[pi.status] || { label: pi.status || '—', color: 'bg-gray-100 text-gray-600' };
              return (
                <tr 
                  key={pi.id || i} 
                  onClick={() => {
                    startNavigation();
                    setTimeout(() => navigate(`/purchases/${pi.purchase_id}`), 150);
                  }}
                  className="hover:bg-gray-100/80 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-[11.5px] whitespace-nowrap text-xs text-slate-900 font-semibold tabular-nums">
                    <span className="text-[#10b981] font-mono transition-colors">
                      {pi.purchase_number}
                    </span>
                  </td>
                  <td className="px-4 py-[11.5px] text-xs text-gray-800 font-bold whitespace-nowrap truncate max-w-[150px]" title={pi.supplier_name || '—'}>{pi.supplier_name || '—'}</td>
                  <td className="px-4 py-[11.5px] whitespace-nowrap text-xs font-medium text-gray-500">{fmtDate(pi.created_at)}</td>
                  <td className="px-4 py-[11.5px] font-bold tabular-nums whitespace-nowrap">
                    <span className="text-emerald-600">+{pi.quantity} {product?.unit}</span>
                  </td>
                  <td className="px-4 py-[11.5px] text-gray-500 tabular-nums">{fmt(pi.unit_price)}</td>
                  <td className="px-4 py-[11.5px] font-bold text-gray-800 tabular-nums whitespace-nowrap">{fmt(pi.line_total)}</td>
                  <td className="px-3 py-[11.5px] whitespace-nowrap">
                    <div className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full whitespace-nowrap ${st.color}`}>
                      <span className="uppercase tracking-wide">{st.label}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List */}
      <div className="sm:hidden space-y-2">
        {paginated.length === 0 && (
          <div className="text-center py-10 bg-white rounded-xl border border-slate-200 text-gray-400 text-sm">
            Alış kaydı bulunamadı.
          </div>
        )}
        {paginated.map((pi, i) => {
          const st = STATUS_LABELS[pi.status] || { label: pi.status || '—', color: 'bg-gray-100 text-gray-600' };

          return (
            <div
              key={pi.id || i}
              onClick={() => {
                startNavigation();
                setTimeout(() => navigate(`/purchases/${pi.purchase_id}`), 150);
              }}
              className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm transition-colors active:scale-95 cursor-pointer"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full mb-1 ${st.color}`}>
                    <span>{st.label}</span>
                  </div>
                  <div className="text-sm font-bold text-gray-800 line-clamp-1">{pi.supplier_name || 'Bilinmeyen'}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{fmtDate(pi.created_at)}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-emerald-600">
                    +{pi.quantity} {product?.unit}
                  </div>
                  <div className="text-sm font-bold text-gray-800 mt-1">{fmt(pi.line_total)}</div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-xs">
                <span className="text-gray-500">Fatura No:</span>
                <span className="font-mono text-[#10b981] font-semibold">{pi.purchase_number}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {purchaseHistory.length > 0 && (
        <div className="fixed bottom-[72px] sm:bottom-5 left-4 sm:left-auto right-4 sm:right-6 flex items-center justify-between sm:justify-end gap-3 z-20 bg-white/80 sm:bg-transparent backdrop-blur-md sm:backdrop-blur-none p-2 sm:p-0 rounded-xl sm:rounded-none border sm:border-none border-slate-200 shadow-sm sm:shadow-none">
          <span className="text-xs text-gray-400 font-medium ml-2 sm:ml-0">
            <span className="sm:hidden">Sayfa {page}/{totalPages}</span>
            <span className="hidden sm:inline">{purchaseHistory.length} kayıt içinde {(page - 1) * ITEMS_PER_PAGE + 1}-{Math.min(page * ITEMS_PER_PAGE, purchaseHistory.length)}</span>
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 bg-white hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="hidden sm:flex items-center gap-1.5">
              {renderPaginationButtons()}
            </div>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 bg-white hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
