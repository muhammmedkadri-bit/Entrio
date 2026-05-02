import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { ArrowDownLeft, ArrowUpRight, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Filter, MoreVertical, Edit2, Settings2, ArrowRightLeft, RotateCcw, History, Trash2, Archive, Wallet, CreditCard, Building2, Calculator, LayoutGrid, Download, FileText, Moon, Star } from 'lucide-react';
import { db } from '../../../db';
import { StatCard } from '../../../components/ui/StatCard';
import { EditRegisterModal } from '../modals/EditRegisterModal';
import { ExportReportModal } from '../modals/ExportReportModal';
import { BalanceAdjustmentModal } from '../modals/BalanceAdjustmentModal';
import { TransferModal } from '../modals/TransferModal';
import { ResetRegisterModal } from '../modals/ResetRegisterModal';
import { CreateRegisterModal } from '../modals/CreateRegisterModal';
import { TransactionDetailModal } from '../modals/TransactionDetailModal';
import { DayCloseModal } from '../modals/DayCloseModal';
import { cashService } from '../../../services/cashService';
import toast from 'react-hot-toast';

import { ManualTransactionModal } from '../modals/ManualTransactionModal';
import { DayCloseDetailModal } from '../modals/DayCloseDetailModal';

const ITEMS_PER_PAGE = 10;
const CARDS_PER_PAGE = 5;

export const CashDashboardTab = ({ registers = [], onRegisterChanged }) => {
  const [activeCategory, setActiveCategory] = useState('all');
  const [summary, setSummary] = useState(null);
  const [monthlySummary, setMonthlySummary] = useState({ income: 0, expense: 0 });
  const [recentTxs, setRecentTxs] = useState([]);
  const [page, setPage] = useState(1);

  // Modals
  const [isManualTxOpen, setManualTxOpen] = useState(false);
  const [selectedReg, setSelectedReg] = useState(null);
  const [manualTxDirection, setManualTxDirection] = useState('in');

  const [openMenuId, setOpenMenuId] = useState(null);
  const [editModalReg, setEditModalReg] = useState(null);
  const [adjustModalReg, setAdjustModalReg] = useState(null);
  const [transferModalReg, setTransferModalReg] = useState(null);
  const [resetModalReg, setResetModalReg] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [dayCloseModalOpen, setDayCloseModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [detailModalTx, setDetailModalTx] = useState(null);
  const [dayCloseDetailTx, setDayCloseDetailTx] = useState(null);
  const [deleteConfirmReg, setDeleteConfirmReg] = useState(null);
  const [archiveConfirmReg, setArchiveConfirmReg] = useState(null);
  const scrollRef = useRef(null);
  const [cardPage, setCardPage] = useState(0);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    if (registers && registers.length > 0) {
      setPage(1);
      loadDashboard();
    }
  }, [registers, activeCategory]);

  const getFilteredRegisters = () => {
    if (activeCategory === 'all') return registers;
    return registers.filter(r => {
      if (activeCategory === 'cash') {
        return r.type === 'cash' || !r.type || r.name?.toLowerCase().includes('ana kasa');
      }
      return r.type === activeCategory;
    });
  };

  const loadDashboard = async () => {
    try {
      const filteredRegisters = getFilteredRegisters();
      
      let combinedSum = {
        totals: {
          sale_in: 0, customer_payment_in: 0, deposit_in: 0, return_in: 0,
          purchase_out: 0, supplier_payment_out: 0, expense_out: 0, withdrawal_out: 0, return_out: 0
        }
      };
      let allTxs = [];

      for (const reg of filteredRegisters) {
        const sum = await cashService.getDailySummary(reg.id, new Date());
        for (const key in sum.totals) {
           combinedSum.totals[key] += sum.totals[key] || 0;
        }

        const txs = await cashService.getTransactions(reg.id);
        // append register name to tx
        txs.forEach(t => t.registerName = reg.name);
        allTxs = allTxs.concat(txs);
      }

      // sort combined txs
      allTxs.sort((a, b) => b.created_at - a.created_at);

      // Müşteri / Tedarikçi eşleştirme
      const customers = await db.customers.toArray();
      const suppliers = await db.suppliers.toArray();
      const sales = await db.sales.toArray();
      const purchases = await db.purchases.toArray();
      const customerMap = Object.fromEntries(customers.map(c => [c.id, c.name]));
      const supplierMap = Object.fromEntries(suppliers.map(s => [s.id, s.name]));
      const saleMap = Object.fromEntries(sales.map(s => [s.id, s.customer_id]));
      const purchaseMap = Object.fromEntries(purchases.map(p => [p.id, p.supplier_id]));

      let mIncome = 0;
      let mExpense = 0;
      const currentMonthStart = new Date();
      currentMonthStart.setDate(1);
      currentMonthStart.setHours(0, 0, 0, 0);

      allTxs.forEach(t => {
        t.entityName = null;
        if (t.transaction_type === 'sale_in' || t.transaction_type === 'customer_payment_in') {
          const custId = t.customer_id || (t.reference_id && saleMap[t.reference_id]) || (t.sale_id && saleMap[t.sale_id]);
          if (custId && customerMap[custId]) t.entityName = customerMap[custId];
        } else if (t.transaction_type === 'supplier_payment_out' || t.transaction_type === 'purchase_out') {
          const supId = t.supplier_id || (t.purchase_id && purchaseMap[t.purchase_id]);
          if (supId && supplierMap[supId]) t.entityName = supplierMap[supId];
        } else if (t.transaction_type === 'return_out' || t.transaction_type === 'return_in') {
          // Find the return receipt sale, then from it get original_sale_id -> customer
          const retSale = sales.find(s => s.id === t.reference_id);
          const origSale = retSale?.original_sale_id ? sales.find(s => s.id === retSale.original_sale_id) : null;
          const custId = t.customer_id || retSale?.customer_id || origSale?.customer_id;
          if (custId && customerMap[custId]) t.entityName = customerMap[custId];
          // Attach original sale number for desc usage
          t._origSaleNumber = origSale?.sale_number || retSale?.sale_number || null;
        }

        // Aylık toplamlar — return_out is NOT counted as expense (it neutralises a prior income)
        if (t.created_at >= currentMonthStart.getTime()) {
          if (t.transaction_type === 'return_out') {
            mIncome -= t.amount || 0;
          } else if (t.transaction_type.includes('_in') || t.transaction_type === 'in') {
            mIncome += t.amount || 0;
          } else if (t.transaction_type.includes('_out') || t.transaction_type === 'out') {
            mExpense += t.amount || 0;
          }
        }
      });



      let finalTxs = allTxs.filter(t => !(t.transaction_type === 'day_close' && t.amount === 0));

      // Group split payments only in 'all' view to prevent balance confusion
      if (activeCategory === 'all') {
        const grouped = [];
        const seen = new Set();

        finalTxs.forEach(t => {
          if (seen.has(t.id)) return;
          
          if (t.reference_id && t.notes && t.notes.includes('Parçalı')) {
            const siblings = finalTxs.filter(x => 
              x.reference_id === t.reference_id && 
              x.transaction_type === t.transaction_type && 
              x.notes?.includes('Parçalı') &&
              Math.abs(x.created_at - t.created_at) < 5000
            );
            
            if (siblings.length > 1) {
              const totalAmt = siblings.reduce((sum, s) => sum + s.amount, 0);
              const isReturn = t.transaction_type === 'return_out';
              const combinedNotes = isReturn 
                ? `Karma Ödeme İadesi (${siblings.map(s => s.registerName).join(' + ')})`
                : `Karma Ödeme Tahsilatı (${siblings.map(s => s.registerName).join(' + ')})`;
              
              const combinedTx = {
                ...t,
                id: `grouped_${t.id}`,
                amount: totalAmt,
                notes: combinedNotes,
                registerName: 'Çoklu Kasa',
                isGrouped: true,
                siblings: siblings
              };
              grouped.push(combinedTx);
              siblings.forEach(s => seen.add(s.id));
            } else {
              grouped.push(t);
              seen.add(t.id);
            }
          } else {
            grouped.push(t);
            seen.add(t.id);
          }
        });
        finalTxs = grouped;
      }

      setSummary(combinedSum);
      setMonthlySummary({ income: mIncome, expense: mExpense });
      setRecentTxs(finalTxs);
    } catch (e) {
      console.error('[CashDashboard] Kasa özeti alınamadı:', e);
      toast.error(e?.message || 'Kasa özeti alınırken bir hata oluştu.');
    }
  };

  const handleSaved = () => {
    onRegisterChanged(); // this will trigger useEffect via registers prop update
  };

  const openManualTx = (reg, direction) => {
    setSelectedReg(reg);
    setManualTxDirection(direction);
    setManualTxOpen(true);
  };

  const formatCurrency = (val) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);
  const fmtDate = (ts) => { try { return format(new Date(ts), 'd MMMM yyyy HH:mm', { locale: tr }); } catch { return '—'; } };

  const scrollCards = (dir) => {
    const regs = getFilteredRegisters();
    const maxPage = Math.ceil(regs.length / CARDS_PER_PAGE) - 1;
    setCardPage(p => Math.max(0, Math.min(maxPage, p + dir)));
  };

  const openMenu = (e, regId) => {
    e.stopPropagation();
    if (openMenuId === regId) { setOpenMenuId(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, left: rect.right - 208 });
    setOpenMenuId(regId);
  };

  const handleDeleteRegister = async (reg) => {
    try {
      await cashService.deleteRegister(reg.id);
      toast.success(`"${reg.name}" kasası silindi.`);
      handleSaved();
    } catch (e) {
      console.error('[CashDashboard] Kasa silme hatası:', e);
      toast.error(e?.message || 'Kasa silinirken beklenmeyen bir hata oluştu.');
    } finally {
      setDeleteConfirmReg(null);
    }
  };

  const handleArchiveRegister = async (reg) => {
    try {
      await cashService.archiveRegister(reg.id);
      toast.success(`"${reg.name}" kasası arşivlendi.`);
      handleSaved();
    } catch (e) {
      console.error('[CashDashboard] Kasa arşivleme hatası:', e);
      toast.error(e?.message || 'Kasa arşivlenirken beklenmeyen bir hata oluştu.');
    } finally {
      setArchiveConfirmReg(null);
    }
  };

  const handleSetDefault = async (reg) => {
    try {
      await cashService.setDefaultRegister(reg.id);
      toast.success(`"${reg.name}" kendi türü için varsayılan yapıldı.`);
      handleSaved();
    } catch (e) {
      console.error('[CashDashboard] Kasa varsayılan yapma hatası:', e);
      toast.error(e?.message || 'Varsayılan kasa ayarlanırken bir hata oluştu.');
    }
  };

  if (!registers || registers.length === 0) return <div className="p-8 text-center text-slate-400">Tanımlı kasa bulunamadı. Lütfen "Kasalar / Şubeler" sekmesinden kasa oluşturun.</div>;

  // Cash flow bar math
  const inTotal = (summary?.totals.sale_in || 0) + (summary?.totals.customer_payment_in || 0) + (summary?.totals.deposit_in || 0) + (summary?.totals.return_in || 0) - (summary?.totals.return_out || 0);
  const outTotal = (summary?.totals.purchase_out || 0) + (summary?.totals.supplier_payment_out || 0) + (summary?.totals.expense_out || 0) + (summary?.totals.withdrawal_out || 0);
  const totalFlow = inTotal + outTotal || 1; 

  const inPerc = (inTotal / totalFlow) * 100;

  // Pagination Logic
  const totalPages = Math.ceil(recentTxs.length / ITEMS_PER_PAGE) || 1;
  const paginatedTxs = recentTxs.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

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

  const CATEGORY_META = {
    all:         { icon: LayoutGrid, label: 'Tümü' },
    cash:        { icon: Wallet,     label: 'Nakit' },
    pos:         { icon: Calculator, label: 'POS' },
    bank:        { icon: Building2,  label: 'Banka Hesapları' },
    credit_card: { icon: CreditCard, label: 'Kredi Kartı' },
  };

  const categories = Object.entries(CATEGORY_META).map(([id, v]) => ({ id, ...v }));

  const getRegIcon = (type) => {
    const icons = { cash: Wallet, pos: Calculator, bank: Building2, credit_card: CreditCard };
    const Icon = icons[type] || Wallet;
    return <Icon className="w-3.5 h-3.5 text-[#5da83f] flex-shrink-0" />;
  };

  return (
    <div className="space-y-6 pb-8">
      
      {/* Category Filters & Add Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2 p-1 bg-slate-200/50 rounded-xl w-fit overflow-x-auto max-w-full">
          {categories.map(cat => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`whitespace-nowrap flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold rounded-lg transition-all ${
                  activeCategory === cat.id
                    ? 'bg-white text-slate-800 shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-300/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5 text-[#5da83f]" />
                {cat.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
          <button 
            onClick={() => setDayCloseModalOpen(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold rounded-xl transition-colors shadow-sm"
          >
            <Moon className="w-4 h-4" /> Günsonu Yap
          </button>
          <button 
            onClick={() => setExportModalOpen(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" /> Rapor İndir
          </button>
          <button 
            onClick={() => setCreateModalOpen(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-[#5da83f] hover:bg-[#4b8a32] text-white text-sm font-bold rounded-xl transition-colors shadow-sm"
          >
            <span className="text-lg leading-none">+</span> Yeni Kasa Ekle
          </button>
        </div>
      </div>

      {/* Register Cards — Paginated, always 5 visible */}
      {(() => {
        const regs = getFilteredRegisters();
        const maxPage = Math.max(0, Math.ceil(regs.length / CARDS_PER_PAGE) - 1);
        const safeCardPage = Math.min(cardPage, maxPage);
        const visible = regs.slice(safeCardPage * CARDS_PER_PAGE, (safeCardPage + 1) * CARDS_PER_PAGE);

        return (
          <div className="flex items-stretch gap-3">
            {/* Left nav */}
            <button
              onClick={() => scrollCards(-1)}
              disabled={safeCardPage === 0}
              className="w-8 flex-shrink-0 flex items-center justify-center bg-white border border-slate-200 rounded-xl shadow-sm text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-30 disabled:cursor-not-allowed self-stretch"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Cards grid — no overflow, no scroll */}
            <div className="flex-1 grid gap-4" style={{ gridTemplateColumns: `repeat(${CARDS_PER_PAGE}, 1fr)` }}>
              {visible.map(reg => (
                <div key={reg.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col hover:shadow-md transition-shadow min-w-0 min-h-[210px]">
                  
                  {/* Üst: Kasa Adı + Menü */}
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {getRegIcon(reg.type)}
                        <h3 className="text-sm font-bold text-slate-700 truncate">{reg.name}</h3>
                        {reg.is_default_for && (
                          <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-amber-200 ml-1 flex-shrink-0" title="Varsayılan Kasa">
                            ★
                          </span>
                        )}
                      </div>
                      {reg.type === 'credit_card' && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {reg.billing_day && <span className="text-[9px] font-bold bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded-md border border-rose-100">Kesim: {reg.billing_day}. Gün</span>}
                          {reg.due_day && <span className="text-[9px] font-bold bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded-md border border-rose-100">Son Ödeme: {reg.due_day}. Gün</span>}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => openMenu(e, reg.id)}
                      className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors flex-shrink-0 ml-1 mt-[-2px]"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Orta: Bakiye Blokları — flex-1 ile üst ve alta eşit mesafe */}
                  <div className="flex-1 flex flex-col justify-center py-4 gap-2">
                    {/* Günün Bakiyesi veya Kalan Limit */}
                    {(() => {
                      if (reg.type === 'credit_card') {
                        const limit = reg.credit_limit || 0;
                        const balance = reg.current_balance || 0;
                        const remaining = limit + balance;
                        return (
                          <div className={`text-2xl font-black tracking-tight leading-none ${
                            remaining < 0 ? 'text-red-500' : 'text-slate-800'
                          }`}>
                            {formatCurrency(remaining)}
                            <span className="text-[10px] font-semibold text-slate-400 ml-1.5 align-middle">kalan limit</span>
                          </div>
                        );
                      }
                      
                      const genBal  = reg.general_balance ?? reg.current_balance ?? 0;
                      const dailyNet = (reg.current_balance ?? 0) - genBal;
                      return (
                        <div className={`text-2xl font-black tracking-tight leading-none ${
                          dailyNet < 0 ? 'text-red-500' : dailyNet === 0 ? 'text-slate-400' : 'text-slate-800'
                        }`}>
                          {formatCurrency(dailyNet)}
                          <span className="text-[10px] font-semibold text-slate-400 ml-1.5 align-middle">bugün</span>
                        </div>
                      );
                    })()}

                    {/* Toplam Bakiye / Mevcut Borç */}
                    <div className="text-[11px] font-semibold text-slate-500 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100 flex items-center justify-between">
                      <span>{reg.type === 'credit_card' ? 'Güncel Borç:' : 'Toplam Bakiye:'}</span>
                      <span className={(reg.current_balance ?? 0) < 0 ? 'text-red-500 font-bold' : 'text-slate-700 font-bold'}>
                        {reg.type === 'credit_card' ? formatCurrency(Math.abs(reg.current_balance ?? 0)) : formatCurrency(reg.current_balance ?? 0)}
                      </span>
                    </div>
                  </div>

                  {/* Alt: Gelir / Gider Butonları */}
                  <div className="flex gap-2">
                    <button onClick={() => openManualTx(reg, 'in')} className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-bold bg-[#82e05a]/15 text-[#5da83f] hover:bg-[#82e05a]/25 rounded-xl transition-all border border-[#82e05a]/30">
                      <ArrowDownLeft className="w-3.5 h-3.5" /> {reg.type === 'credit_card' ? 'Ödeme' : 'Gelir'}
                    </button>
                    <button onClick={() => openManualTx(reg, 'out')} className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-bold bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl transition-all border border-rose-200">
                      <ArrowUpRight className="w-3.5 h-3.5" /> Gider
                    </button>
                  </div>
                </div>
              ))}
              {/* Empty filler cells to keep grid shape */}
              {Array.from({ length: CARDS_PER_PAGE - visible.length }).map((_, i) => (
                <div key={`empty-${i}`} className="rounded-2xl border-2 border-dashed border-slate-100 bg-slate-50/30" />
              ))}
              {regs.length === 0 && (
                <div className="col-span-5 p-8 text-center text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-sm">
                  Bu kategoride tanımlı kasa bulunmamaktadır.
                </div>
              )}
            </div>

            {/* Right nav */}
            <button
              onClick={() => scrollCards(1)}
              disabled={safeCardPage >= maxPage}
              className="w-8 flex-shrink-0 flex items-center justify-center bg-white border border-slate-200 rounded-xl shadow-sm text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-30 disabled:cursor-not-allowed self-stretch"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        );
      })()}

      {/* Dropdown menu — position:fixed, above everything */}
      {openMenuId && (
        <div
          className="fixed w-52 bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5"
          style={{ top: menuPos.top, left: menuPos.left, zIndex: 99999 }}
          onClick={e => e.stopPropagation()}
        >
          {(() => {
            const reg = getFilteredRegisters().find(r => r.id === openMenuId);
            if (!reg) return null;
            return (
              <>
                {!reg.is_default_for && (
                  <button onClick={() => { handleSetDefault(reg); setOpenMenuId(null); }} className="w-full px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-400" /> Varsayılan Yap
                  </button>
                )}
                <button onClick={() => { setEditModalReg(reg); setOpenMenuId(null); }} className="w-full px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-slate-400" /> Düzenle
                </button>
                <button onClick={() => { setAdjustModalReg(reg); setOpenMenuId(null); }} className="w-full px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-slate-400" /> Bakiye Düzeltme
                </button>
                <button onClick={() => { setTransferModalReg(reg); setOpenMenuId(null); }} className="w-full px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4 text-slate-400" /> Transfer
                </button>
                <div className="h-px bg-slate-100 my-1" />
                <button onClick={() => { setResetModalReg(reg); setOpenMenuId(null); }} className="w-full px-3 py-2 text-left text-sm font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-rose-500" /> Kasayı Sıfırla
                </button>
                <div className="h-px bg-slate-100 my-1" />
                <button onClick={() => { setArchiveConfirmReg(reg); setOpenMenuId(null); }} className="w-full px-3 py-2 text-left text-sm font-medium text-amber-600 hover:bg-amber-50 flex items-center gap-2">
                  <Archive className="w-4 h-4 text-amber-500" /> Arşivle
                </button>
                <button onClick={() => { setDeleteConfirmReg(reg); setOpenMenuId(null); }} className="w-full px-3 py-2 text-left text-sm font-medium text-rose-700 hover:bg-rose-50 flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-rose-600" /> Sil
                </button>
              </>
            );
          })()}
        </div>
      )}

      {/* Sil Onay Popup */}
      {deleteConfirmReg && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setDeleteConfirmReg(null)} />
          <div className="relative z-10 bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Kasayı Sil</h3>
                <p className="text-xs text-slate-500 mt-0.5">"{deleteConfirmReg.name}" kalıcı olarak silinecek.</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3 leading-relaxed">
              Bu işlem geri alınamaz. Kasada hareket varsa silinemez, yalnızca arşivlenebilir.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmReg(null)} className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-slate-50 text-slate-700 border border-slate-200 transition-all active:scale-95">İptal</button>
              <button onClick={() => handleDeleteRegister(deleteConfirmReg)} className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-rose-500/10 text-rose-700 border border-rose-400/25 backdrop-blur-sm transition-all active:scale-95">Sil</button>
            </div>
          </div>
        </div>
      )}

      {/* Arşivle Onay Popup */}
      {archiveConfirmReg && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setArchiveConfirmReg(null)} />
          <div className="relative z-10 bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
                <Archive className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Kasayı Arşivle</h3>
                <p className="text-xs text-slate-500 mt-0.5">"{archiveConfirmReg.name}" pasife alınacak.</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3 leading-relaxed">
              Arşivlenen kasa listeden kaldırılır ancak geçmiş hareketleri korunur. İstediğinizde yeniden aktive edebilirsiniz.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setArchiveConfirmReg(null)} className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-slate-50 text-slate-700 border border-slate-200 transition-all active:scale-95">İptal</button>
              <button onClick={() => handleArchiveRegister(archiveConfirmReg)} className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-amber-500/10 text-amber-700 border border-amber-400/25 backdrop-blur-sm transition-all active:scale-95">Arşivle</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Bugünkü Toplam Gelir" value={formatCurrency(inTotal)} icon={TrendingUp} colorTheme="emerald" />
        <StatCard title="Bugünkü Toplam Gider" value={formatCurrency(outTotal)} icon={TrendingDown} colorTheme="rose" />
        <StatCard title="Bu Ayki Toplam Gelir" value={formatCurrency(monthlySummary.income)} icon={TrendingUp} colorTheme="emerald" />
        <StatCard title="Bu Ayki Toplam Gider" value={formatCurrency(monthlySummary.expense)} icon={TrendingDown} colorTheme="rose" />
      </div>

      {/* Premium Cash Flow Bar */}
      <div className="relative overflow-hidden bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-6">
        {/* Ambient background glows removed per user request */}
        
        <div className="flex justify-between items-end mb-5 relative z-10">
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Bugünkü Para Akışı</h3>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-2xl font-black ${(inTotal - outTotal) >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>
                {formatCurrency(inTotal - outTotal)}
              </span>
              <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">NET</span>
            </div>
          </div>
          <div className="text-right">
             <div className="flex items-center justify-end gap-5 text-[11px] font-bold uppercase tracking-wider">
               <div className="flex items-center gap-1.5">
                 <div className="w-2 h-2 rounded-full bg-[#5da83f] shadow-[0_0_8px_rgba(93,168,63,0.5)]"></div>
                 <span className="text-slate-500">Gelir: <span className="text-[#5da83f] ml-0.5">{formatCurrency(inTotal)}</span></span>
               </div>
               <div className="flex items-center gap-1.5">
                 <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"></div>
                 <span className="text-slate-500">Gider: <span className="text-rose-500 ml-0.5">{formatCurrency(outTotal)}</span></span>
               </div>
             </div>
          </div>
        </div>

        <div className="relative z-10 h-3 w-full rounded-full overflow-hidden flex bg-slate-100 shadow-inner">
          {inTotal > 0 && (
            <div 
              style={{ width: `${inPerc}%` }} 
              className="relative h-full transition-all duration-1000 ease-out bg-gradient-to-r from-[#82e05a] to-[#5da83f]"
            ></div>
          )}
          {outTotal > 0 && (
            <div 
              style={{ width: `${100 - inPerc}%` }} 
              className="relative h-full transition-all duration-1000 ease-out bg-gradient-to-l from-rose-400 to-rose-500"
            ></div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 flex items-center gap-2"><History className="w-4 h-4 text-[#5da83f]" /> Son Hareketler</h3>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
            <tr>
              <th className="p-3">Hareket Tipi</th>
              <th className="p-3">Açıklama</th>
              <th className="p-3 whitespace-nowrap">Müşteri / Tedarikçi</th>
              <th className="p-3">Tarih / Saat</th>
              <th className="p-3">Kasa</th>
              <th className="p-3 text-right">Tutar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedTxs.map(tx => {
              const isOut = ['purchase_out', 'supplier_payment_out', 'expense_out', 'withdrawal_out', 'transfer_out'].includes(tx.transaction_type);
              const isReturn = tx.transaction_type === 'return_out';
              const isTransfer = tx.transaction_type === 'transfer_out' || tx.transaction_type === 'transfer_in';
              const isAdj = tx.transaction_type === 'balance_adjustment';
              const isDayClose = tx.transaction_type === 'day_close';
              
              let pillClass = '';
              let typeLabel = '';
              let IconComponent = (isOut || isReturn) ? ArrowDownLeft : ArrowUpRight;
              
              if (isDayClose) {
                 pillClass = 'bg-blue-100 text-blue-700 border border-blue-200';
                 typeLabel = 'Günsonu';
                 IconComponent = Moon;
              } else if (isTransfer) {
                 pillClass = 'bg-blue-50 text-blue-600 border border-blue-200';
                 typeLabel = 'Transfer';
                 IconComponent = ArrowRightLeft;
              } else if (isAdj) {
                 pillClass = 'bg-amber-50 text-amber-600 border border-amber-200';
                 typeLabel = 'Düzeltme';
                 IconComponent = Settings2;
              } else if (isReturn) {
                 pillClass = 'bg-orange-50 text-orange-600 border border-orange-200';
                 typeLabel = 'İade';
              } else if (isOut) {
                 pillClass = 'bg-rose-50 text-rose-600 border border-rose-200';
                 typeLabel = 'Gider';
              } else {
                 pillClass = 'bg-[#82e05a]/15 text-[#5da83f] border border-[#82e05a]/30 backdrop-blur-md shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)]';
                 typeLabel = 'Gelir';
              }

              let desc = tx.notes || '';
              if (isReturn) {
                // Show original sale number for returns
                desc = tx._origSaleNumber ? `İade: ${tx._origSaleNumber}` : (tx.notes || 'İade Çıkışı');
              } else if (!desc) {
                if (tx.transaction_type === 'sale_in') desc = 'Satış Geliri';
                else if (tx.transaction_type === 'customer_payment_in') desc = 'Cari Tahsilat';
                else if (tx.transaction_type === 'purchase_out') desc = 'Alış Ödemesi';
                else if (tx.transaction_type === 'supplier_payment_out') desc = 'Tedarikçi Ödemesi';
                else if (tx.transaction_type === 'expense_out') desc = 'Gider';
                else if (tx.transaction_type === 'deposit_in') desc = 'Para Girişi';
                else if (tx.transaction_type === 'withdrawal_out') desc = 'Para Çıkışı';
                else if (tx.transaction_type === 'day_close') desc = 'Gün Kapanışı';
                else desc = 'Diğer İşlem';
              }

              return (
                <tr key={tx.id} onClick={() => {
                  if (tx.transaction_type === 'day_close') {
                    setDayCloseDetailTx(tx);
                  } else {
                    setDetailModalTx(tx);
                  }
                }} className="hover:bg-slate-50 transition-colors cursor-pointer">
                  <td className="p-3 whitespace-nowrap">
                    <div className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${pillClass}`}>
                      <IconComponent className="w-3 h-3 flex-shrink-0" />
                      <span>{typeLabel}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="text-xs font-semibold text-slate-700 max-w-[200px] truncate" title={desc}>{desc}</div>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    {tx.entityName ? (
                      <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">{tx.entityName}</span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td className="p-3 text-xs font-medium text-slate-500 whitespace-nowrap">{fmtDate(tx.created_at)}</td>
                  <td className="p-3 text-xs whitespace-nowrap">
                    <span className="bg-slate-100 text-slate-600 font-semibold px-2.5 py-1 rounded-md">{tx.registerName}</span>
                  </td>
                  <td className={`p-3 text-right font-bold tabular-nums whitespace-nowrap ${isOut || isReturn || tx.amount < 0 ? 'text-rose-600' : 'text-[#5da83f]'}`}>
                    {isOut || isReturn || tx.amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(tx.amount || 0))}
                  </td>
                </tr>
              )
            })}
            {recentTxs.length === 0 && (
              <tr><td colSpan="6" className="text-center p-8 text-slate-400">Bu filtrelere uygun işlem bulunamadı.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bottom Right relative to table */}
      {recentTxs.length > 0 && (
        <div className="flex justify-end items-center gap-3 mt-4">
          <span className="text-xs text-gray-400">
            {recentTxs.length} kayıt içinde {(page - 1) * ITEMS_PER_PAGE + 1}-{Math.min(page * ITEMS_PER_PAGE, recentTxs.length)} gösteriliyor
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

      <ManualTransactionModal isOpen={isManualTxOpen} onClose={() => setManualTxOpen(false)} targetRegister={selectedReg} initialDirection={manualTxDirection} onSaved={handleSaved} />
      <EditRegisterModal isOpen={!!editModalReg} onClose={() => setEditModalReg(null)} register={editModalReg} onSaved={handleSaved} />
      <BalanceAdjustmentModal isOpen={!!adjustModalReg} onClose={() => setAdjustModalReg(null)} register={adjustModalReg} onSaved={handleSaved} />
      <TransferModal isOpen={!!transferModalReg} onClose={() => setTransferModalReg(null)} sourceRegister={transferModalReg} allRegisters={registers} onSaved={handleSaved} />
      <ResetRegisterModal isOpen={!!resetModalReg} onClose={() => setResetModalReg(null)} register={resetModalReg} onSaved={handleSaved} />
      <CreateRegisterModal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} onSaved={handleSaved} />
      <TransactionDetailModal isOpen={!!detailModalTx} onClose={() => setDetailModalTx(null)} transaction={detailModalTx} onSaved={handleSaved} allRegisters={registers} />
      
      <ExportReportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        registers={registers}
      />
      <DayCloseModal 
        isOpen={dayCloseModalOpen}
        onClose={() => setDayCloseModalOpen(false)}
        allRegisters={registers}
        onSaved={() => {
          // Günsonu sonrası: Bugünkü gelir/gider anında sıfırla
          setSummary({
            totals: {
              sale_in: 0, customer_payment_in: 0, deposit_in: 0, return_in: 0,
              purchase_out: 0, supplier_payment_out: 0, expense_out: 0, withdrawal_out: 0, return_out: 0
            }
          });
          // Güncel kasa kayıtlarını yeniden yükle (general_balance güncellendi)
          handleSaved();
        }}
      />
      {dayCloseDetailTx && (
        <DayCloseDetailModal
          tx={dayCloseDetailTx}
          onClose={() => setDayCloseDetailTx(null)}
        />
      )}
    </div>
  );
};
