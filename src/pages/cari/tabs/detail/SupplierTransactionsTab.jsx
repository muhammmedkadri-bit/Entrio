import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, ArrowDownLeft, ArrowUpRight, CopyMinus, RotateCcw, FileText, RefreshCw, ShoppingCart, Search } from 'lucide-react';

const fmt = (v) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(v || 0);
const fmtDate = (ts) => { try { return format(new Date(ts), 'd MMM yyyy HH:mm', { locale: tr }); } catch { return '—'; } };
const fmtDateShort = (ts) => { try { return format(new Date(ts), 'd MMM yyyy', { locale: tr }); } catch { return '—'; } };

const TX_META = {
  purchase:   { label: 'Ürün Alımı',     color: 'bg-[#82e05a]/10 text-[#5da83f] border border-[#82e05a]/30', icon: ShoppingCart, isPositive: true },
  payment:    { label: 'Ödeme',          color: 'bg-rose-500/10 text-rose-600 border border-rose-500/20', icon: ArrowUpRight, isPositive: false },
  return:     { label: 'İade',            color: 'bg-purple-500/10 text-purple-600 border border-purple-500/20', icon: RotateCcw, isPositive: false },
  adjustment: { label: 'Açılış Bakiyesi', color: 'bg-slate-500/10 text-slate-600 border border-slate-500/20', icon: FileText, isPositive: false },
  debt:       { label: 'Devir Bakiye',  color: 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/20', icon: FileText, isPositive: true },
  collection: { label: 'Tahsilat',      color: 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20', icon: ArrowDownLeft, isPositive: false },
  offset:     { label: 'Mahsuplaşma',  color: 'bg-blue-500/10 text-blue-600 border border-blue-500/20', icon: RefreshCw, isPositive: false },
};

const ITEMS_PER_PAGE = 10;

export const SupplierTransactionsTab = ({ transactions = [] }) => {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  const filteredTransactions = useMemo(() => {
    if (!searchTerm.trim()) return transactions;
    const lowerQ = searchTerm.toLowerCase();
    return transactions.filter(tx =>
      (tx.invoice_number && tx.invoice_number.toLowerCase().includes(lowerQ)) ||
      (tx.reference_id && String(tx.reference_id).includes(lowerQ)) ||
      (tx.notes && tx.notes.toLowerCase().includes(lowerQ)) ||
      (tx.invoice_title && tx.invoice_title.toLowerCase().includes(lowerQ))
    );
  }, [transactions, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE));
  const paginated = filteredTransactions.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  React.useEffect(() => { setPage(1); }, [searchTerm]);

  const renderPageBtns = () => {
    const max = 5;
    let start = Math.max(1, page - Math.floor(max / 2));
    let end = Math.min(totalPages, start + max - 1);
    if (end - start < max - 1) start = Math.max(1, end - max + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => {
      const idx = start + i;
      return (
        <button key={idx} onClick={() => setPage(idx)}
          className={`w-7 h-7 flex items-center justify-center text-xs rounded-lg transition-colors ${
            page === idx ? 'bg-emerald-50 border border-emerald-200 text-emerald-600 font-semibold' : 'border border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}>
          {idx}
        </button>
      );
    });
  };

  return (
    <div className="pt-1 pb-20 sm:pb-10 relative">
      {/* ── Search bar ── */}
      <div className="flex items-center justify-between mb-4 gap-2">
        <h2 className="text-sm font-bold text-slate-800 hidden sm:block">Hesap Hareketleri</h2>
        <div className="relative flex-1 sm:flex-none">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Fatura no veya açıklama..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full sm:w-64 pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
          />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          DESKTOP: Table (hidden on mobile)
      ══════════════════════════════════════════════════════════════ */}
      <div className="hidden sm:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
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
              const meta = TX_META[tx.transaction_type] || { label: tx.transaction_type, color: 'bg-gray-100 text-gray-600', icon: CopyMinus };
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
                  <td className="px-3 py-[11.5px] whitespace-nowrap">
                    <div className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${meta.color}`}>
                      {meta.icon && <meta.icon className="w-3 h-3 flex-shrink-0" />}
                      <span>{meta.label}</span>
                    </div>
                  </td>
                  <td className="px-4 py-[11.5px] whitespace-nowrap text-xs text-slate-900 font-semibold tabular-nums">
                    {isPurchase && (tx.invoice_number || tx.reference_id) ? (
                      <span className="font-mono bg-[#82e05a]/10 text-[#5da83f] px-2 py-0.5 rounded border border-[#82e05a]/25 flex items-center gap-1 w-fit">
                        <FileText className="w-3 h-3" />
                        {tx.invoice_number || `#${tx.reference_id}`}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-[11.5px] text-xs text-gray-600 font-medium truncate max-w-[200px]" title={tx.notes || '—'}>
                    {isPurchase ? (tx.invoice_title || 'Alış Faturası') : (tx.notes || '—')}
                  </td>
                  <td className="px-4 py-[11.5px] whitespace-nowrap text-xs font-medium text-gray-500">{fmtDate(tx.created_at)}</td>
                  <td className="px-4 py-[11.5px] font-bold tabular-nums whitespace-nowrap">
                    <span className="text-slate-800">
                      {fmt(Math.abs(tx.amount))}
                    </span>
                  </td>
                  <td className="px-4 py-[11.5px] text-gray-600 font-semibold tabular-nums">{fmt(tx.balance_after)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          MOBILE: Cards (sm:hidden)
      ══════════════════════════════════════════════════════════════ */}
      <div className="sm:hidden space-y-2">
        {paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400">
            <Search className="w-8 h-8 opacity-30" />
            <p className="text-sm font-medium">Hesap hareketi bulunamadı.</p>
          </div>
        ) : (
          paginated.map((tx, i) => {
            const meta = TX_META[tx.transaction_type] || { label: tx.transaction_type, color: 'bg-gray-100 text-gray-600', icon: CopyMinus };
            const isPurchase = tx.transaction_type === 'purchase';
            const Icon = meta.icon || CopyMinus;
            const balAfter = parseFloat(tx.balance_after) || 0;
            const handleRowClick = () => {
              if (isPurchase && tx.reference_id) {
                navigate(`/purchases/${tx.reference_id}`);
              }
            };

            return (
              <div
                key={tx.id || i}
                onClick={isPurchase && tx.reference_id ? handleRowClick : undefined}
                className={`bg-white rounded-xl border border-slate-200 overflow-hidden ${isPurchase && tx.reference_id ? 'active:scale-[0.99] cursor-pointer hover:border-[#82e05a]/50 hover:shadow-sm' : ''} transition-all`}
              >
                {/* Card header: type badge + date */}
                <div className="flex items-center justify-between px-3.5 pt-3 pb-2">
                  <div className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${meta.color}`}>
                    <Icon className="w-3 h-3 shrink-0" />
                    {meta.label}
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">{fmtDateShort(tx.created_at)}</span>
                </div>

                {/* Card body */}
                <div className="px-3.5 pb-3 flex items-end justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Fiş no */}
                    {isPurchase && (tx.invoice_number || tx.reference_id) && (
                      <div className="flex items-center gap-1 mb-1">
                        <span className="font-mono text-[11px] bg-[#82e05a]/10 text-[#5da83f] px-2 py-0.5 rounded border border-[#82e05a]/20">
                          {tx.invoice_number || `#${tx.reference_id}`}
                        </span>
                      </div>
                    )}
                    {/* Notes */}
                    {(tx.notes || tx.invoice_title) && (
                      <p className="text-xs text-slate-500 truncate">
                        {isPurchase ? (tx.invoice_title || 'Alış Faturası') : tx.notes}
                      </p>
                    )}
                    {/* Balance after */}
                    <p className="text-[11px] text-slate-400 mt-1">
                      Sonraki bakiye: <span className={`font-semibold ${balAfter > 0 ? 'text-red-500' : balAfter < 0 ? 'text-emerald-500' : 'text-slate-500'}`}>{fmt(balAfter)}</span>
                    </p>
                  </div>
                  {/* Amount */}
                  <div className="text-right shrink-0">
                    <span className="text-base font-black text-slate-800 tabular-nums">{fmt(Math.abs(tx.amount))}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Pagination ── */}
      {filteredTransactions.length > ITEMS_PER_PAGE && (
        <div className="mt-4 flex items-center justify-between print:hidden">
          <span className="text-xs text-gray-400 font-semibold">
            {filteredTransactions.length} kayıt — Sayfa {page}/{totalPages}
          </span>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            {renderPageBtns()}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

