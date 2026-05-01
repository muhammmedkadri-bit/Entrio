import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../../../store/appStore';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Minus, RefreshCw, FileText, Truck } from 'lucide-react';

const fmt = (v) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(v || 0);
const fmtDate = (ts) => { try { return format(new Date(ts), 'd MMMM yyyy HH:mm', { locale: tr }); } catch { return '—'; } };

const MOVEMENT_LABELS = {
  purchase: { label: 'Alış', color: 'bg-sky-50 text-sky-600 border border-sky-200', icon: Truck },
  sale: { label: 'Satış', color: 'bg-[#82e05a]/15 text-[#5da83f] border border-[#82e05a]/30 backdrop-blur-md shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)]', icon: FileText },
  out: { label: 'Satış', color: 'bg-[#82e05a]/15 text-[#5da83f] border border-[#82e05a]/30 backdrop-blur-md shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)]', icon: FileText },
  adjustment_in: { label: 'Manuel Stok Girişi', color: 'bg-teal-100 text-teal-700', icon: Plus },
  adjustment_out: { label: 'Manuel Stok Çıkışı', color: 'bg-rose-50 text-rose-600 border border-rose-200', icon: Minus },
  return_in: { label: 'İade Girişi', color: 'bg-cyan-100 text-cyan-700', icon: Plus },
  return_out: { label: 'İade Çıkışı', color: 'bg-red-100 text-red-700', icon: Minus },
  transfer: { label: 'Transfer', color: 'bg-purple-100 text-purple-700', icon: RefreshCw },
};

const INPUT_TYPES = ['purchase', 'adjustment_in', 'return_in'];
const isInput = (type) => INPUT_TYPES.includes(type);

const ITEMS_PER_PAGE = 10;

export const StockMovementsTab = ({ movements = [], product }) => {
  const navigate = useNavigate();
  const { startNavigation } = useAppStore();
  const [page, setPage] = useState(1);

  const totalPages = Math.ceil(movements.length / ITEMS_PER_PAGE);
  const paginated = movements.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

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
                { label: 'Müşteri / Tedarikçi', width: 'w-[22%]' },
                { label: 'Hareket Türü', width: 'w-[18%]' },
                { label: 'Fiş / Fatura No', width: 'w-[15%]' },
                { label: 'Miktar', width: 'w-[15%]' },
                { label: 'Satış fiyatı', width: 'w-[15%]' },
                { label: 'Tarih / Saat', width: 'w-[15%]' }
              ].map(h => (
                <th key={h.label} className={`text-left px-4 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap ${h.width}`}>{h.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {paginated.length === 0 && (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400 text-sm">Stok hareketi bulunamadı.</td></tr>
            )}
            {paginated.map((m, i) => {
              const meta = MOVEMENT_LABELS[m.movement_type] || { label: m.movement_type, color: 'bg-gray-100 text-gray-600' };
              const input = isInput(m.movement_type);
              return (
                <tr 
                  key={m.id || i} 
                  onClick={() => {
                    if (m.reference_id && ['sale', 'out'].includes(m.movement_type)) {
                      startNavigation();
                      setTimeout(() => navigate(`/sales/${m.reference_id}`), 150);
                    } else if (m.reference_id && m.movement_type === 'return_in') {
                      // Navigate to the original sale, not the return receipt
                      startNavigation();
                      setTimeout(() => navigate(`/sales/${m.original_sale_id || m.reference_id}`), 150);
                    } else if (m.reference_id && ['purchase', 'return_out'].includes(m.movement_type)) {
                      startNavigation();
                      setTimeout(() => navigate(`/purchases/${m.reference_id}`), 150);
                    }
                  }}
                  className={`transition-colors ${m.reference_id ? 'cursor-pointer hover:bg-gray-100/80' : 'hover:bg-gray-50/80'}`}
                >
                  {/* Müşteri / Tedarikçi */}
                  <td className="px-4 py-[11.5px] text-xs text-gray-800 font-bold whitespace-nowrap truncate max-w-[150px]" title={m.counterparty || '—'}>
                    {m.counterparty || '—'}
                  </td>
                  {/* Hareket Türü */}
                  <td className="px-3 py-[11.5px] whitespace-nowrap">
                    <div className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${meta.color}`}>
                      {meta.icon && <meta.icon className="w-3 h-3 flex-shrink-0" />}
                      <span>{meta.label}</span>
                    </div>
                  </td>
                  {/* Fiş / Fatura */}
                  <td className="px-4 py-[11.5px] whitespace-nowrap text-xs font-semibold tabular-nums">
                    {(['sale', 'out'].includes(m.movement_type) && m.reference)
                      ? <span className="font-mono text-[#10b981]">{m.reference}</span>
                      : (m.movement_type === 'return_in')
                        ? <span className="font-mono text-[#10b981]">
                            {m.original_sale_number || m.reference || '—'}
                          </span>
                        : (['purchase', 'return_out'].includes(m.movement_type) && m.reference)
                          ? <span className="font-mono text-[#10b981]">{m.reference}</span>
                          : <span className="text-slate-300">—</span>}
                  </td>
                  {/* Miktar */}
                  <td className="px-4 py-[11.5px] font-bold tabular-nums whitespace-nowrap">
                    <span className="text-slate-900">
                      {input ? '+' : '-'}{m.quantity} {product?.unit}
                    </span>
                  </td>
                  {/* Birim Fiyat */}
                  <td className="px-4 py-[11.5px] text-gray-500 tabular-nums">{m.unit_price ? fmt(m.unit_price) : '—'}</td>
                  {/* Tarih / Saat */}
                  <td className="px-4 py-[11.5px] whitespace-nowrap text-xs font-medium text-gray-500">{fmtDate(m.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination — fixed to page bottom-right */}
      {movements.length > 0 && (
        <div className="fixed bottom-5 right-6 flex items-center gap-3 z-20">
          <span className="text-xs text-gray-400">
            {movements.length} kayıt içinde {(page - 1) * ITEMS_PER_PAGE + 1}-{Math.min(page * ITEMS_PER_PAGE, movements.length)} gösteriliyor
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
