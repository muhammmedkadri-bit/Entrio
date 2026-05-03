import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../../../store/appStore';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Hash, CircleDollarSign, BarChart2, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';

const fmt = (v) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(v || 0);
const fmtDate = (ts) => { try { return format(new Date(ts), 'd MMMM yyyy HH:mm', { locale: tr }); } catch { return '—'; } };

const PAYMENT_LABELS = {
  cash: { label: 'Nakit', color: 'bg-emerald-100 text-emerald-700' },
  card: { label: 'Kredi Kartı', color: 'bg-blue-100 text-blue-700' },
  transfer: { label: 'Havale/EFT', color: 'bg-purple-100 text-purple-700' },
  mixed: { label: 'Parçalı Ödeme', color: 'bg-orange-100 text-orange-700' },
  credit: { label: 'Veresiye', color: 'bg-red-100 text-red-700' },
};



const ITEMS_PER_PAGE = 10;

export const SalesHistoryTab = ({ salesHistory = [], product }) => {
  const navigate = useNavigate();
  const { startNavigation } = useAppStore();
  const [page, setPage] = useState(1);

  const totalQty = useMemo(() => salesHistory.reduce((s, si) => s + (si.quantity || 0), 0), [salesHistory]);
  const totalRevenue = useMemo(() => salesHistory.reduce((s, si) => s + (si.line_total || 0), 0), [salesHistory]);
  const avgPrice = totalQty > 0 ? totalRevenue / totalQty : 0;
  const totalProfit = useMemo(() =>
    salesHistory.reduce((s, si) => {
      const cost = (product?.purchase_price || 0) * (si.quantity || 0);
      return s + ((si.line_total || 0) - cost);
    }, 0),
    [salesHistory, product]);

  const totalPages = Math.ceil(salesHistory.length / ITEMS_PER_PAGE);
  const paginated = salesHistory.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

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
      {/* Table — shrinks to content */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {[
                { label: 'Fiş No', width: 'w-[12%]' },
                { label: 'Müşteri', width: 'w-[18%]' },
                { label: 'Satış Tarihi', width: 'w-[15%]' },
                { label: 'Satılan Miktar', width: 'w-[10%]' },
                { label: 'Satış Fiyatı', width: 'w-[10%]' },
                { label: 'İskonto', width: 'w-[10%]' },
                { label: 'Fiş Toplamı', width: 'w-[12%]' },
                { label: 'Kar', width: 'w-[10%]' },
                { label: 'Ödeme', width: 'auto' }
              ].map(h => (
                <th key={h.label} className={`text-left px-4 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap ${h.width}`}>{h.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {paginated.length === 0 && (
              <tr><td colSpan={9} className="text-center py-10 text-gray-400 text-sm">Satış kaydı bulunamadı.</td></tr>
            )}
            {paginated.map((si, i) => {
              const sale = si.sale || {};
              const cost = (product?.purchase_price || 0) * (si.quantity || 0);
              const profit = (si.line_total || 0) - cost;
              const payMethod = sale.payment_method || si.payment_method || '';
              const pm = PAYMENT_LABELS[payMethod] || { label: payMethod || '—', color: 'bg-gray-100 text-gray-600' };
              const saleNumber = sale.sale_number || si.sale_number || '—';
              const customerName = si.customer_name || sale.customer_name || (sale.customer_id && sale.customer_id !== 1 ? `Müşteri #${sale.customer_id}` : 'Perakende');
              const createdAt = sale.created_at || si.created_at;
              const saleId = si.sale_id || sale.id;
              return (
                <tr 
                  key={si.id || i} 
                  onClick={() => {
                    if (!saleId) return;
                    startNavigation();
                    setTimeout(() => navigate(`/sales/${saleId}`), 150);
                  }}
                  className={`transition-colors ${saleId ? 'hover:bg-gray-100/80 cursor-pointer' : 'hover:bg-gray-50/80'}`}
                >
                  <td className="px-4 py-[11.5px] whitespace-nowrap text-xs text-slate-900 font-semibold tabular-nums">
                    <span className="text-[#10b981] font-mono transition-colors">
                      {saleNumber}
                    </span>
                  </td>
                  <td className="px-4 py-[11.5px] text-xs text-gray-800 font-bold whitespace-nowrap truncate max-w-[150px]" title={customerName}>{customerName}</td>
                  <td className="px-4 py-[11.5px] whitespace-nowrap text-xs font-medium text-gray-500">{fmtDate(createdAt)}</td>
                  <td className="px-4 py-[11.5px] font-bold tabular-nums whitespace-nowrap">
                    <span className="text-slate-900">-{si.quantity} {product?.unit}</span>
                  </td>
                  <td className="px-4 py-[11.5px] text-gray-500 tabular-nums">{fmt(si.unit_price)}</td>
                  <td className="px-4 py-[11.5px] text-red-500 tabular-nums">{si.discount > 0 ? `-${fmt(si.discount)}` : '—'}</td>
                  <td className="px-4 py-[11.5px] font-bold text-gray-800 tabular-nums whitespace-nowrap">{fmt(si.line_total)}</td>
                  <td className="px-4 py-[11.5px] text-xs font-bold tabular-nums whitespace-nowrap" style={{ color: profit >= 0 ? '#16a34a' : '#dc2626' }}>{fmt(profit)}</td>
                  <td className="px-3 py-[11.5px] whitespace-nowrap">
                    <div className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full whitespace-nowrap ${pm.color}`}>
                      <span className="uppercase tracking-wide">{pm.label}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination — fixed to page bottom-right */}
      {salesHistory.length > 0 && (
        <div className="fixed bottom-5 right-6 flex items-center gap-3 z-20">
          <span className="text-xs text-gray-400">
            {salesHistory.length} kayıt içinde {(page - 1) * ITEMS_PER_PAGE + 1}-{Math.min(page * ITEMS_PER_PAGE, salesHistory.length)} gösteriliyor
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            {renderPaginationButtons()}
            
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
