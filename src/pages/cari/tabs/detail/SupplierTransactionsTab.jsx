import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, ArrowDownLeft, ArrowUpRight, CopyMinus, RotateCcw, FileText, RefreshCw, ShoppingCart } from 'lucide-react';

const fmt = (v) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(v || 0);
const fmtDate = (ts) => { try { return format(new Date(ts), 'd MMMM yyyy HH:mm', { locale: tr }); } catch { return '—'; } };

const TX_META = {
  purchase:   { label: 'Ürün Alımı',     color: 'bg-[#82e05a]/10 text-[#5da83f] border border-[#82e05a]/30 backdrop-blur-md shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)]', icon: ShoppingCart, isPositive: true },
  payment:    { label: 'Ödeme',          color: 'bg-rose-500/10 text-rose-600 border border-rose-500/20 backdrop-blur-md shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)]', icon: ArrowUpRight, isPositive: false },
  return:     { label: 'İade',            color: 'bg-purple-500/10 text-purple-600 border border-purple-500/20 backdrop-blur-md shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)]', icon: RotateCcw, isPositive: false },
  adjustment: { label: 'Açılış Bakiyesi', color: 'bg-slate-500/10 text-slate-600 border border-slate-500/20 backdrop-blur-md shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)]', icon: FileText, isPositive: false },
  debt:       { label: 'Devir Bakiye',  color: 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 backdrop-blur-md shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)]', icon: FileText, isPositive: true },
  collection: { label: 'Tahsilat',      color: 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 backdrop-blur-md shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)]', icon: ArrowDownLeft, isPositive: false },
  offset:     { label: 'Mahsuplaşma',  color: 'bg-blue-500/10 text-blue-600 border border-blue-500/20 backdrop-blur-md shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)]', icon: RefreshCw, isPositive: false },
};

const ITEMS_PER_PAGE = 10;

export const SupplierTransactionsTab = ({ transactions = [] }) => {
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  const totalPages = Math.ceil(transactions.length / ITEMS_PER_PAGE);
  const paginated = transactions.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

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
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {[
                { label: 'İşlem Türü', width: 'w-[15%]' },
                { label: 'Fatura No', width: 'w-[15%]' },
                { label: 'Açıklama', width: 'w-[25%]' },
                { label: 'Tarih', width: 'w-[15%]' },
                { label: 'Tutar', width: 'w-[15%]' },
                { label: 'Kalan Bakiye', width: 'w-[15%]' }
              ].map(h => (
                <th key={h.label} className={`text-left px-4 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap ${h.width}`}>{h.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {paginated.length === 0 && (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400 text-sm">Hesap hareketi bulunmuyor.</td></tr>
            )}
            {paginated.map((tx, i) => {
              const meta = TX_META[tx.transaction_type] || { label: tx.transaction_type, color: 'bg-gray-100 text-gray-600', icon: CopyMinus, isPositive: false };
              const isPurchase = tx.transaction_type === 'purchase';
              const handleRowClick = () => {
                if (isPurchase && tx.reference_id) {
                  navigate(`/purchases/${tx.reference_id}`);
                }
              };
              return (
                <tr
                  key={tx.id || i}
                  onClick={isPurchase && tx.reference_id ? handleRowClick : undefined}
                  className={`transition-colors ${
                    isPurchase && tx.reference_id
                      ? 'hover:bg-[#82e05a]/5 cursor-pointer'
                      : 'hover:bg-gray-50/80'
                  }`}
                >
                  {/* İşlem Türü */}
                  <td className="px-3 py-[11.5px] whitespace-nowrap">
                    <div className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${meta.color}`}>
                      {meta.icon && <meta.icon className="w-3 h-3 flex-shrink-0" />}
                      <span>{meta.label}</span>
                    </div>
                  </td>
                  {/* Fatura No */}
                  <td className="px-4 py-[11.5px] whitespace-nowrap text-xs text-slate-900 font-semibold tabular-nums">
                    {isPurchase && tx.invoice_number ? (
                      <span className="font-mono bg-[#82e05a]/10 text-[#5da83f] px-2 py-0.5 rounded border border-[#82e05a]/25 flex items-center gap-1 w-fit">
                        <FileText className="w-3 h-3" />
                        {tx.invoice_number}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  {/* Açıklama */}
                  <td className="px-4 py-[11.5px] text-xs text-gray-600 font-medium truncate max-w-[200px]">
                    {isPurchase
                      ? (tx.invoice_title || 'Alış Faturası')
                      : (tx.notes || '—')
                    }
                  </td>
                  {/* Tarih */}
                  <td className="px-4 py-[11.5px] whitespace-nowrap text-xs font-medium text-gray-500">{fmtDate(tx.created_at)}</td>
                  {/* Tutar */}
                  <td className="px-4 py-[11.5px] font-bold tabular-nums whitespace-nowrap">
                    <span className="text-slate-800">
                      {fmt(Math.abs(tx.amount))}
                    </span>
                  </td>
                  {/* Kalan Bakiye */}
                  <td className="px-4 py-[11.5px] text-gray-600 font-semibold tabular-nums">{fmt(tx.balance_after)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {transactions.length > 0 && (
        <div className="fixed bottom-5 right-6 flex items-center gap-3 z-20 print:hidden">
          <span className="text-xs text-gray-400">
            {transactions.length} kayıt içinde {(page - 1) * ITEMS_PER_PAGE + 1}-{Math.min(page * ITEMS_PER_PAGE, transactions.length)} gösteriliyor
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
