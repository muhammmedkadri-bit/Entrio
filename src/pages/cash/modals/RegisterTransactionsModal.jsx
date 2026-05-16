import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  X, ArrowUpRight, ArrowDownLeft, ArrowRightLeft, Moon,
  Settings2, ChevronLeft, ChevronRight
} from 'lucide-react';
import { isSupabase } from '../../../config/database';
import { supabase } from '../../../lib/supabaseClient';
import { db } from '../../../db';

const fmt = (v) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(v || 0);
const fmtDate = (ts) => { try { return format(new Date(Number(ts)), 'd MMM yyyy HH:mm', { locale: tr }); } catch { return '—'; } };
const PAGE_SIZE = 10;

const TX_META = {
  sale_in:               { label: 'Satış Geliri',      color: 'bg-emerald-50 text-emerald-700 border-emerald-200', isIncome: true },
  customer_payment_in:   { label: 'Cari Tahsilat',     color: 'bg-emerald-50 text-emerald-700 border-emerald-200', isIncome: true },
  deposit_in:            { label: 'Para Girişi',        color: 'bg-emerald-50 text-emerald-700 border-emerald-200', isIncome: true },
  return_in:             { label: 'İade Girişi',        color: 'bg-emerald-50 text-emerald-700 border-emerald-200', isIncome: true },
  transfer_in:           { label: 'Transfer Girişi',    color: 'bg-blue-50 text-blue-700 border-blue-200',           isIncome: true },
  purchase_out:          { label: 'Mal Alımı',          color: 'bg-rose-50 text-rose-700 border-rose-200',           isIncome: false },
  supplier_payment_out:  { label: 'Tedarikçi Ödemesi', color: 'bg-rose-50 text-rose-700 border-rose-200',           isIncome: false },
  expense_out:           { label: 'Gider',              color: 'bg-rose-50 text-rose-700 border-rose-200',           isIncome: false },
  withdrawal_out:        { label: 'Para Çıkışı',        color: 'bg-rose-50 text-rose-700 border-rose-200',           isIncome: false },
  return_out:            { label: 'İade Çıkışı',        color: 'bg-orange-50 text-orange-700 border-orange-200',     isIncome: false },
  transfer_out:          { label: 'Transfer Çıkışı',   color: 'bg-blue-50 text-blue-700 border-blue-200',           isIncome: false },
  credit_payment_in:     { label: 'K.Kartı Tahsilatı', color: 'bg-slate-100 text-slate-700 border-slate-200',         isIncome: true },
  balance_adjustment:    { label: 'Bakiye Düzeltme',   color: 'bg-slate-100 text-slate-600 border-slate-200',       isIncome: null },
  day_close:             { label: 'Günsonu',           color: 'bg-slate-100 text-slate-700 border-slate-200',       isIncome: null },
};

export const RegisterTransactionsModal = ({ register, onClose }) => {
  const [txs, setTxs]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage]   = useState(1);

  useEffect(() => {
    if (!register) return;
    loadTxs();
  }, [register]);

  const loadTxs = async () => {
    setLoading(true);
    try {
      let data = [];
      if (isSupabase()) {
        const { data: rows, error } = await supabase
          .from('cash_transactions')
          .select('*')
          .eq('register_id', register.id)
          .order('created_at', { ascending: false })
          .limit(300);
        if (error) throw error;
        data = rows || [];
      } else {
        const all = await db.cash_transactions.where('register_id').equals(Number(register.id)).toArray();
        data = all.sort((a, b) => b.created_at - a.created_at);
      }
      setTxs(data);
      setPage(1);
    } catch (e) {
      console.error('[RegisterTxModal]', e);
    } finally {
      setLoading(false);
    }
  };

  if (!register) return null;

  const totalPages = Math.ceil(txs.length / PAGE_SIZE) || 1;
  const paginated  = txs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const renderPaginationButtons = () => {
    let pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2));
    let endPage = startPage + maxVisiblePages - 1;

    if (endPage > totalPages) {
      endPage = totalPages;
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        pages.push(
          <button
            key={i}
            onClick={() => setPage(i)}
            className={`w-7 h-7 text-xs rounded-lg flex items-center justify-center transition-all cursor-pointer ${
              page === i 
                ? 'bg-[#7ed957]/15 text-[#3a8024] border border-[#7ed957]/40 font-bold shadow-sm' 
                : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {i}
          </button>
        );
    }
    return pages;
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3"
      style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl shadow-2xl bg-white overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div>
            <h2 className="font-black text-slate-800 text-sm">{register.name} — Hareketler</h2>
            <p className="text-xs text-slate-400 mt-0.5">{txs.length} kayıt</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-200 text-slate-500 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto min-h-[480px]">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-7 h-7 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
            </div>
          ) : txs.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Hareket bulunamadı.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-100 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tür</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Açıklama</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tarih</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tutar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#7ed957]/30">
                {paginated.map(tx => {
                  const meta = TX_META[tx.transaction_type] || { label: tx.transaction_type, color: 'bg-slate-50 text-slate-600 border-slate-200', isIncome: null };
                  const isOut = meta.isIncome === false;
                  const isNeutral = meta.isIncome === null;
                  return (
                    <tr key={tx.id} className="hover:bg-[#7ed957]/5 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.color}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 max-w-[200px] truncate">{tx.notes || '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDate(tx.created_at)}</td>
                      <td className={`px-4 py-3 text-right font-bold tabular-nums text-sm ${isNeutral ? 'text-slate-500' : isOut ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {isNeutral ? '' : isOut ? '-' : '+'}{fmt(Math.abs(tx.amount || 0))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50">
            <span className="text-xs text-slate-400">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, txs.length)} / {txs.length}</span>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition-all">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              {renderPaginationButtons()}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition-all">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
