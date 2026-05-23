import { useGlobalLoader } from "../../hooks/useGlobalLoader";
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import toast from '../../components/ui/CustomToast';
import { Banknote, ShoppingCart, AlertTriangle, TrendingUp, Users, ChevronRight, ArrowDownLeft, ArrowUpRight, ArrowRightLeft, Settings2, Moon, Plus, Trash2, ListChecks, Calendar, Clock, Calculator, Building2, TrendingDown, PieChart as PieChartIcon, Activity, ScanBarcode, Edit2 } from 'lucide-react';
import { CurrencyWidget } from '../../components/ui/CurrencyWidget';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { CalculatorWidget } from '../../components/ui/CalculatorModal';
import { DatePicker } from '../../components/ui/DatePicker';
import { QuickBarcodesModal } from './modals/QuickBarcodesModal';
import { TransactionDetailModal } from '../cash/modals/TransactionDetailModal';
import { reportService } from '../../services/reportService';
import { quickNotesService } from '../../services/quickNotesService';
import { settingsService } from '../../services/settingsService';
import { cashService } from '../../services/cashService';
import { useDashboardData } from '../../hooks/useDashboardData';
import { isSupabase } from '../../config/database';
import { db } from '../../db';
import { supabase } from '../../lib/supabaseClient';
import { PremiumLoader } from '../../components/ui/PremiumLoader';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';
import { MobileDashboard } from './components/MobileDashboard';

/* ─── Sabit veriler ─────────────────────────────────────── */
const PIE_COLORS = {
  cash: '#22c55e', card: '#3b82f6', credit: '#ef4444',
  transfer: '#8b5cf6', bank_transfer: '#8b5cf6',
  mixed: '#f59e0b', split: '#f59e0b',
};

const TxRowSkeleton = () => (
  <tr className="border-b border-slate-100 animate-pulse h-[46px]">
    <td className="px-4 py-2"><div className="w-20 h-6 bg-slate-200/60 rounded-full"></div></td>
    <td className="px-4 py-2"><div className="w-36 h-4 bg-slate-200/60 rounded"></div></td>
    <td className="px-4 py-2">
      <div className="flex items-center gap-2">
        <div className="w-24 h-5 bg-slate-100 rounded-md"></div>
        <div className="w-16 h-4 bg-slate-100 border border-slate-200 rounded"></div>
      </div>
    </td>
    <td className="px-4 py-2"><div className="w-10 h-4 bg-slate-100 rounded"></div></td>
    <td className="px-4 py-2 text-right"><div className="w-16 h-5 bg-slate-200/80 rounded inline-block"></div></td>
  </tr>
);

const ChartSkeleton = () => (
  <div className="flex-1 flex items-end justify-around gap-2 px-4 pb-2 animate-pulse">
    {[55, 80, 40, 70, 90, 45, 65].map((h, i) => (
      <div key={i} className="flex-1 flex flex-col justify-end gap-1">
        <div className="flex justify-around gap-0.5 items-end" style={{ height: `${h}%` }}>
          <div className="w-full bg-green-200/60 rounded-t h-full"></div>
          <div className="w-full bg-rose-200/60 rounded-t" style={{ height: `${Math.max(20, h - 30)}%` }}></div>
        </div>
        <div className="h-2.5 bg-slate-100 rounded"></div>
      </div>
    ))}
  </div>
);

const PieChartSkeleton = () => (
  <div className="flex items-center gap-4 flex-1 mt-2 animate-pulse">
    <div className="flex-shrink-0 w-[100px] h-[100px] rounded-full bg-slate-200/60"></div>
    <div className="flex-1 flex flex-col gap-2">
      {[1,2,3].map(i => (
        <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 border border-slate-100">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-300 flex-shrink-0"></div>
          <div className="flex flex-1 items-center justify-between">
            <div className="w-20 h-3 bg-slate-200/60 rounded"></div>
            <div className="w-6 h-5 bg-slate-200/80 rounded"></div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const NotesSkeleton = () => (
  <ul className="flex-1 flex flex-col gap-2 animate-pulse">
    {[1,2,3,4,5].map(i => (
      <li key={i} className="flex-1 bg-white/60 px-3 py-2 rounded-lg flex items-center border border-[#fde047]/50 min-h-[46px]">
        <div className="w-2/3 h-3.5 bg-yellow-200/80 rounded"></div>
      </li>
    ))}
  </ul>
);

const PIE_NAMES = {
  cash: 'Nakit', card: 'Kredi Kartı', credit: 'Veresiye',
  transfer: 'Havale/EFT', bank_transfer: 'Havale/EFT',
  mixed: 'Parçalı Ödeme', split: 'Parçalı Ödeme',
};
const PAYMENT_LABEL = { cash: 'Nakit', card: 'Kredi Kartı', credit: 'Veresiye', transfer: 'Havale/EFT', bank_transfer: 'Havale/EFT' };
const formatCurrencyStatic = (val) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val ?? 0);
/** Güvenli tarih formatlama — geçersiz tarih undefined/null verse çökmez */
const safeFormat = (date, fmt, opts) => {
  try {
    if (!date) return '—';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '—';
    return format(d, fmt, opts);
  } catch { return '—'; }
};

/* ─── Tooltip bileşenleri — render dışında tanımlı ─────── */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white p-3 rounded-xl shadow-lg border border-slate-100 text-sm min-w-[150px]">
      <p className="font-bold text-slate-800 mb-3 border-b border-slate-50 pb-2">{label}</p>
      <div className="flex flex-col gap-2">
        {payload.map((entry, index) => {
          const isIncome = entry.name === 'income';
          return (
            <div key={index} className="flex items-center justify-between gap-4">
              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${isIncome ? 'bg-[#65c43d]/10 text-[#65c43d]' : 'bg-rose-500/10 text-rose-500'}`}>
                {isIncome ? 'Gelir' : 'Gider'}
              </span>
              <span className={`font-black tracking-tight ${isIncome ? 'text-[#65c43d]' : 'text-rose-500'}`}>
                {formatCurrencyStatic(entry.value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const CustomPieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-white p-3 rounded-xl shadow-lg border border-slate-100 text-sm min-w-[150px]">
      <p className="font-bold text-slate-800 mb-3 border-b border-slate-50 pb-2 flex items-center gap-2">
        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: data.color }} />
        {data.name}
      </p>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-500 font-medium">İşlem Adedi:</span>
          <span className="font-bold text-slate-700">{data.value}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-500 font-medium">Toplam Tutar:</span>
          <span className="font-bold text-brand-600">{formatCurrencyStatic(data.amount)}</span>
        </div>
      </div>
    </div>
  );
};

export const Dashboard = () => {
  const navigate = useNavigate();
  const startNavigation = useAppStore(state => state.startNavigation);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [companyName, setCompanyName] = useState(() => localStorage.getItem('entrio_company_name') || 'İşletme Özeti');
  const [companyLogo, setCompanyLogo] = useState(() => localStorage.getItem('entrio_company_logo') || null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showCalculator, setShowCalculator] = useState(false);
  const [showQuickBarcodes, setShowQuickBarcodes] = useState(false);

  const [charts, setCharts] = useState({ dailyIncomeExpense: [], todayPie: [] });

  // ── Cache-aware dashboard data hook ─────────────────────────────────
  const { cashReport, salesSummary, allTxs, registers: hookRegisters, loading, refetch } = useDashboardData();
  useGlobalLoader(loading);

  // Track per-section readiness so skeletons show even on cached (loading=false) loads
  const [isChartsReady, setIsChartsReady] = useState(false);
  const [isTxReady, setIsTxReady] = useState(false);
  const [isNotesReady, setIsNotesReady] = useState(false);

  // Once data has been shown once, never go back to skeleton state (prevents double-loader on Realtime refresh)
  const hasShownChartsRef = useRef(false);
  const hasShownTxRef = useRef(false);

  // Keep allRegisters in sync with hook
  const [allRegisters, setAllRegisters] = useState([]);
  useEffect(() => {
    if (hookRegisters.length > 0) setAllRegisters(hookRegisters);
  }, [hookRegisters]);


  const [quickNotes, setQuickNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  // Notları sayfa yüklenirken al
  useEffect(() => {
    quickNotesService.getAll().then(notes => {
      setQuickNotes(notes);
      setIsNotesReady(true);
    });
  }, []);

  const addNote = async (e) => {
    e.preventDefault();
    if(!newNote.trim()) return;
    try {
      const added = await quickNotesService.add(newNote);
      const notes = [added, ...quickNotes].slice(0, 5);
      setQuickNotes(notes);
      if (!isSupabase()) quickNotesService.saveLocal(notes);
      setNewNote('');
    } catch (err) {
      console.error('Not eklenemedi:', err);
    }
  };

  const handleMobileAddNote = async (text) => {
    if(!text.trim()) return;
    try {
      const added = await quickNotesService.add(text);
      const notes = [added, ...quickNotes].slice(0, 5);
      setQuickNotes(notes);
      if (!isSupabase()) quickNotesService.saveLocal(notes);
    } catch (err) {
      console.error('Not eklenemedi:', err);
    }
  };

  const removeNote = async (id) => {
    try {
      await quickNotesService.delete(id);
      const notes = quickNotes.filter(n => n.id !== id);
      setQuickNotes(notes);
      if (!isSupabase()) quickNotesService.saveLocal(notes);
    } catch (err) {
      console.error('Not silinemedi:', err);
    }
  };

  const saveEditedNote = async (id) => {
    if (!editingNoteText.trim()) {
      setEditingNoteId(null);
      return;
    }
    try {
      await quickNotesService.update(id, editingNoteText);
      const notes = quickNotes.map(n => n.id === id ? { ...n, text: editingNoteText } : n);
      setQuickNotes(notes);
      if (!isSupabase()) quickNotesService.saveLocal(notes);
      setEditingNoteId(null);
    } catch (err) {
      console.error('Not güncellenemedi:', err);
    }
  };

  // ── Derive charts whenever cashReport / salesSummary change ─────────
  useEffect(() => {
    if (!cashReport || !salesSummary) return;
    // Only show skeleton if this is the very first load
    if (!hasShownChartsRef.current) setIsChartsReady(false);

    const pieData = Object.keys(salesSummary.byPaymentMethod)
      .filter(k => (salesSummary.byPaymentMethod[k].count || 0) > 0)
      .map(k => ({
        name:   PIE_NAMES[k]  || k,
        value:  salesSummary.byPaymentMethod[k].count  || 0,
        amount: salesSummary.byPaymentMethod[k].amount || 0,
        color:  PIE_COLORS[k] || '#94a3b8',
      }));

    setCharts({
      dailyIncomeExpense: cashReport.dailySeries.map(d => ({
        ...d,
        income: Math.max(0, d.income - d.returns)
      })),
      todayPie: pieData
    });
    hasShownChartsRef.current = true;
    setIsChartsReady(true);
  }, [cashReport, salesSummary]);

  // ── Enrich recent transactions whenever allTxs changes ──────────────
  useEffect(() => {
    if (!allTxs || allTxs.length === 0) return;
    // Only show skeleton if this is the very first load
    if (!hasShownTxRef.current) setIsTxReady(false);

    const allowedTypes = ['sale_in','purchase_out','return_in','return_out','expense_out','supplier_payment_out','withdrawal_out','customer_payment_in','deposit_in'];
    const rawFiltered = allTxs.filter(t => allowedTypes.includes(t.transaction_type));

    const saleIds = new Set();
    const purchaseIds = new Set();
    const customerIds = new Set();
    const supplierIds = new Set();

    for (const t of rawFiltered) {
      if (t.sale_id)     saleIds.add(t.sale_id);
      if (t.reference_id) {
        if (t.transaction_type === 'sale_in' || t.transaction_type.startsWith('return')) saleIds.add(t.reference_id);
        if (t.transaction_type === 'purchase_out') purchaseIds.add(t.reference_id);
      }
      if (t.purchase_id) purchaseIds.add(t.purchase_id);
      if (t.customer_id) customerIds.add(t.customer_id);
      if (t.supplier_id) supplierIds.add(t.supplier_id);
    }

    const fetchBulk = async (table, ids) => {
      if (ids.length === 0) return [];
      if (isSupabase()) {
        const { data } = await supabase.from(table).select('*').in('id', ids);
        return data || [];
      }
      return await db[table].bulkGet(ids);
    };

    const enrichTxs = async () => {
      const [salesArr, purchasesArr, customersArr, suppliersArr] = await Promise.all([
        fetchBulk('sales', [...saleIds]),
        fetchBulk('purchases', [...purchaseIds]),
        fetchBulk('customers', [...customerIds]),
        fetchBulk('suppliers', [...supplierIds]),
      ]);

      const salesMap     = Object.fromEntries(salesArr.filter(Boolean).map(s => [s.id, s]));
      const purchasesMap = Object.fromEntries(purchasesArr.filter(Boolean).map(p => [p.id, p]));
      const custMap      = Object.fromEntries(customersArr.filter(Boolean).map(c => [c.id, c.name]));
      const supMap       = Object.fromEntries(suppliersArr.filter(Boolean).map(s => [s.id, s.name]));

      const uniqueTxsMap = new Map();
      const uniqueTxs = [];

      for (const t of rawFiltered) {
        if (uniqueTxs.length >= 5) break;
        let parentKey = '', parentRecord = null, originalSaleRecord = null, pMethodLabel = '';

        if (t.transaction_type === 'sale_in') {
          const sId = t.sale_id || t.reference_id;
          parentKey = sId ? `sale_${sId}` : `tx_${t.id}`;
          if (sId) parentRecord = salesMap[sId];
        } else if (t.transaction_type === 'purchase_out') {
          const pId = t.purchase_id || t.reference_id;
          parentKey = pId ? `purchase_${pId}` : `tx_${t.id}`;
          if (pId) parentRecord = purchasesMap[pId];
        } else if (t.transaction_type === 'return_out' || t.transaction_type === 'return_in') {
          const rId = t.reference_id;
          parentKey = `return_${rId || t.id}`;
          if (rId) {
            parentRecord = salesMap[rId];
            if (parentRecord?.original_sale_id) originalSaleRecord = salesMap[parentRecord.original_sale_id];
          }
        } else {
          parentKey = `tx_${t.reference_id || t.id}`;
        }

        if (uniqueTxsMap.has(parentKey)) continue;
        uniqueTxsMap.set(parentKey, true);

        let displayAmount = Math.abs(t.amount);
        if (parentRecord) {
          displayAmount = parentRecord.total_amount || Math.abs(t.amount);
          pMethodLabel = PAYMENT_LABEL[parentRecord.payment_method] || 'Parçalı';
        } else {
          pMethodLabel = PAYMENT_LABEL[t.payment_method] || 'Kasa';
        }

        let eName = '';
        if (t.transaction_type === 'sale_in' || t.transaction_type === 'customer_payment_in') {
          const cId = t.customer_id || parentRecord?.customer_id;
          if (cId) eName = custMap[cId] || '';
        } else if (t.transaction_type === 'purchase_out' || t.transaction_type === 'supplier_payment_out') {
          const sId = t.supplier_id || parentRecord?.supplier_id;
          if (sId) eName = supMap[sId] || '';
        } else if (t.transaction_type === 'return_in' || t.transaction_type === 'return_out') {
          const cId = t.customer_id || parentRecord?.customer_id || originalSaleRecord?.customer_id;
          eName = cId ? (custMap[cId] || '') : (t.supplier_id ? (supMap[t.supplier_id] || '') : '');
        }

        uniqueTxs.push({ ...t, displayAmount, paymentMethodLabel: pMethodLabel, entityName: eName,
          originalSaleId: originalSaleRecord?.id || null,
          originalSaleNumber: originalSaleRecord?.sale_number || null,
          saleNumber: parentRecord?.sale_number || null,
          invoiceNumber: parentRecord?.invoice_number || null,
          items: parentRecord?.items || null,
        });
      }

      while (uniqueTxs.length < 5) uniqueTxs.push({ id: `empty_${uniqueTxs.length}`, isEmpty: true });
      setRecentTransactions(uniqueTxs);
      hasShownTxRef.current = true;
      setIsTxReady(true);
    };

    enrichTxs().catch(console.error);
  }, [allTxs]);

  // ── Company info + clock (one-time mount) ────────────────────────────
  useEffect(() => {
    settingsService.get('company_info').then(cInfo => {
      if (cInfo?.value?.name) {
        setCompanyName(cInfo.value.name);
        localStorage.setItem('entrio_company_name', cInfo.value.name);
      }
      if (cInfo?.value?.logo !== undefined) {
        setCompanyLogo(cInfo.value.logo);
        localStorage.setItem('entrio_company_logo', cInfo.value.logo || '');
      }
    }).catch(() => {});
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // formatCurrency bileşen içi alias (render'da kullanım için)
  const formatCurrency = formatCurrencyStatic;

  return (
    <>
      <div className="block lg:hidden h-full">
        <MobileDashboard 
          companyName={companyName}
          companyLogo={companyLogo}
          currentTime={currentTime}
          salesSummary={salesSummary}
          cashReport={cashReport}
          allRegisters={allRegisters}
          recentTransactions={recentTransactions}
          quickNotes={quickNotes}
          onAddNote={handleMobileAddNote}
          onDeleteNote={removeNote}
          onEditNote={saveEditedNote}
          onTxSaved={() => refetch(true)}
          charts={charts}
          onTxClick={(tx) => setSelectedTransaction(tx)}
        />
      </div>

      <div className="hidden lg:flex -mt-3 pb-[46px] flex-col h-full relative">
      
      {/* Dashboard Header - H-16 aligns exactly with Sidebar top border */}
      <div className="h-auto md:h-16 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-50">
        <div className="flex items-center">
          <div className="h-11 bg-white border border-slate-200 shadow-sm rounded-xl flex items-center gap-3 px-3">
            {/* Logo */}
            <div className="w-8 h-8 flex items-center justify-center overflow-hidden flex-shrink-0">
              {companyLogo ? (
                <img src={companyLogo} alt="Company Logo" className="w-full h-full object-contain" />
              ) : (
                <Building2 className="w-5 h-5 text-[#7ed957]" />
              )}
            </div>
            {/* Divider */}
            <div className="w-px h-5 bg-slate-200 flex-shrink-0" />
            {/* Name */}
            <h2 className="text-[16px] font-black tracking-tight text-slate-900 leading-none whitespace-nowrap pr-1">
              {companyName}
            </h2>
          </div>
        </div>

        {/* Right side horizontal toolbar */}
        <div className="flex flex-wrap items-center gap-2 relative z-50">
           
           {/* DatePicker Dropdown */}
           <DatePicker
             value={{ start: currentTime, end: currentTime }}
             onChange={() => {}} // Sadece görüntüleme amaçlı takvim
             popupAlignment="bottom"
             hideApplyButton={true}
             viewOnly={true}
             renderTrigger={({ isOpen, setIsOpen }) => (
               <div 
                 onClick={() => setIsOpen(!isOpen)} 
                 className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100 whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors"
               >
                 <Calendar className="w-4 h-4 text-[#5da83f]" />
                 <span className="text-sm font-bold text-slate-700">{format(currentTime, 'dd MMMM EEEE', { locale: tr })}</span>
               </div>
             )}
           />

           <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100 whitespace-nowrap">
             <Clock className="w-4 h-4 text-[#5da83f]" />
             <span className="text-sm font-bold text-slate-700">{format(currentTime, 'HH:mm')}</span>
           </div>

           {/* Calculator Popover */}
           <div className="relative">
             <button 
               onClick={() => setShowCalculator(!showCalculator)}
               className={`flex items-center gap-2 px-3 py-2 rounded-xl border whitespace-nowrap transition-colors ${
                 showCalculator 
                   ? 'bg-[#5da83f] text-white border-[#5da83f]' 
                   : 'bg-slate-50 border-slate-100 text-slate-700 hover:bg-slate-100'
               }`}
             >
               <Calculator className={`w-4 h-4 ${showCalculator ? 'text-white' : 'text-[#5da83f]'}`} /> 
               <span className="text-sm font-bold">Hesap Makinesi</span>
             </button>

             {showCalculator && (
               <div className="absolute right-0 top-full mt-3 z-50 animate-in slide-in-from-top-2 fade-in">
                 <CalculatorWidget onClose={() => setShowCalculator(false)} />
               </div>
             )}
           </div>

        </div>
      </div>


      {/* Main Content Area - Starts at exactly the same vertical line as sidebar menu items */}
      <div className="flex flex-col gap-4 flex-1">
        
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          <div className="xl:col-span-2 flex flex-col h-full">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 h-[340px] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#7ed957]" />
                Günlük Gelir - Gider Analizi
              </h3>
              <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#65c43d] inline-block rounded-full" />Gelir</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-rose-500 inline-block rounded-full" />Gider</span>
              </div>
            </div>
            <div className="flex-1 w-full min-h-0 outline-none focus:outline-none [&_svg]:outline-none [&_.recharts-wrapper]:outline-none">
              {isChartsReady ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts.dailyIncomeExpense} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={2}>
                    <defs>
                      <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#65c43d" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#65c43d" stopOpacity={0.3}/>
                      </linearGradient>
                      <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#f43f5e" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.3}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `₺${v >= 1000 ? (v/1000).toFixed(0)+'K' : v}`} width={48} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                    <Bar dataKey="income" name="income" fill="url(#incomeGrad)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="expense" name="expense" fill="url(#expenseGrad)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ChartSkeleton />
              )}
            </div>
          </div>
          </div>
          <div className="xl:col-span-1 flex flex-col h-full">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[340px]">
             <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
               <PieChartIcon className="w-4 h-4 text-[#7ed957]" />
               Satış Tahsilat Tipleri
             </h3>
             {isChartsReady ? (
               charts.todayPie.length > 0 ? (
                <div className="flex items-center gap-4 flex-1 mt-2">
                  {/* Pie chart — sol */}
                  <div className="flex-shrink-0" style={{ width: 100, height: 100 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={charts.todayPie} innerRadius={25} outerRadius={45} paddingAngle={2} dataKey="value" animationDuration={300}>
                          {charts.todayPie.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                        </Pie>
                        <Tooltip content={<CustomPieTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Kategoriler — sağ, 1 sütunlu grid */}
                  <div className="flex-1 grid grid-cols-1 gap-2">
                    {charts.todayPie.map(p => (
                      <div key={p.name} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                        <div className="flex flex-1 items-center justify-between min-w-0">
                          <span className="text-[11px] uppercase font-bold text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis mr-2" title={p.name}>{p.name}</span>
                          <span className="text-sm font-black text-slate-800">{p.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Bugün ödeme kaydı yok.</div>
              )
             ) : (
               <PieChartSkeleton />
             )}
          </div>
          </div>
          <div className="xl:col-span-1 flex flex-col h-full">
            <CurrencyWidget />
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 flex-1">
          <div className="xl:col-span-3 flex flex-col">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-full min-h-[380px] flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><ListChecks className="w-4 h-4 text-[#7ed957]"/> Son 5 İşlem</h3>
            </div>
            <div className="overflow-auto flex-1 relative">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50/80 sticky top-0 z-10 backdrop-blur-sm">
                  <tr>
                    <th className="px-4 py-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-100">Hareket Türü</th>
                    <th className="px-4 py-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-100">Hareket Açıklaması</th>
                    <th className="px-4 py-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-100">Müşteri / Kasa</th>
                    <th className="px-4 py-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-100">Saat</th>
                    <th className="px-4 py-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-100 text-right">Meblağ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!isTxReady ? (
                    [...Array(5)].map((_, i) => <TxRowSkeleton key={`skeleton-${i}`} />)
                  ) : recentTransactions.map(tx => {
                    const isOut = ['purchase_out', 'return_out', 'expense_out', 'supplier_payment_out', 'withdrawal_out'].includes(tx.transaction_type);
                    
                    let pillClass = '';
                    let typeLabel = '';
                    let IconComponent = isOut ? ArrowDownLeft : ArrowUpRight;
                    if (tx.transaction_type === 'sale_in') IconComponent = ShoppingCart;
                    
                    if (tx.transaction_type === 'sale_in' || tx.transaction_type === 'customer_payment_in' || tx.transaction_type === 'deposit_in') {
                      pillClass = 'bg-[#82e05a]/15 text-[#5da83f] border border-[#82e05a]/30 backdrop-blur-md shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)]';
                      typeLabel = tx.transaction_type === 'sale_in' ? 'Satış' : 'Gelir';
                    } else if (tx.transaction_type === 'purchase_out' || tx.transaction_type === 'supplier_payment_out' || tx.transaction_type === 'expense_out' || tx.transaction_type === 'withdrawal_out') {
                      pillClass = 'bg-rose-50 text-rose-600 border border-rose-200';
                      typeLabel = tx.transaction_type === 'purchase_out' ? 'Alış' : 'Gider';
                    } else if (tx.transaction_type === 'return_in') {
                      pillClass = 'bg-cyan-50 text-cyan-600 border border-cyan-200';
                      typeLabel = 'İade Girişi';
                    } else if (tx.transaction_type === 'return_out') {
                      pillClass = 'bg-orange-50 text-orange-600 border border-orange-200';
                      typeLabel = 'İade Çıkışı';
                    }

                    let desc = tx.notes || '';
                    if (!desc) {
                      if (tx.transaction_type === 'sale_in') desc = 'Satış Geliri';
                      else if (tx.transaction_type === 'purchase_out') desc = 'Alış Ödemesi';
                      else if (tx.transaction_type === 'return_in') desc = 'İade Girişi';
                      else if (tx.transaction_type === 'return_out') desc = 'İade Çıkışı';
                      else if (tx.transaction_type === 'expense_out') desc = 'Gider';
                      else if (tx.transaction_type === 'supplier_payment_out') desc = 'Tedarikçi Ödemesi';
                      else if (tx.transaction_type === 'customer_payment_in') desc = 'Cari Tahsilat';
                      else if (tx.transaction_type === 'withdrawal_out') desc = 'Para Çıkışı';
                      else if (tx.transaction_type === 'deposit_in') desc = 'Para Girişi';
                      else desc = 'İşlem';
                    }
                    // For return_out: show original sale number in description
                    if (tx.transaction_type === 'return_out' || tx.transaction_type === 'return_in') {
                      desc = `İade: ${tx.originalSaleNumber || tx.notes || 'İade Çıkışı'}`;
                    }

                    const handleRowClick = () => {
                      if (tx.transaction_type === 'sale_in') {
                        startNavigation();
                        const sId = tx.sale_id || tx.reference_id;
                        navigate(sId ? `/sales/${sId}` : '/sales');
                      } else if (tx.transaction_type === 'purchase_out') {
                        startNavigation();
                        const pId = tx.purchase_id || tx.reference_id;
                        navigate(pId ? `/purchases/${pId}` : '/cash');
                      } else if (tx.transaction_type === 'return_out' || tx.transaction_type === 'return_in') {
                        startNavigation();
                        navigate(tx.originalSaleId ? `/sales/${tx.originalSaleId}` : '/cash');
                      } else {
                        setSelectedTransaction(tx);
                      }
                    };

                    return tx.isEmpty ? (
                      <tr key={tx.id} className="h-[46px] border-b border-transparent">
                        <td colSpan="5"></td>
                      </tr>
                    ) : (
                      <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer border-b border-slate-100 last:border-0" onClick={handleRowClick}>
                        <td className="px-4 py-2">
                          <div className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${pillClass}`}>
                            <IconComponent className="w-3 h-3 flex-shrink-0" />
                            <span>{typeLabel}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <div className="font-bold text-slate-700 max-w-[200px] truncate">{desc}</div>
                        </td>
                        <td className="px-4 py-2 text-xs">
                          <div className="flex items-center gap-2">
                            {tx.entityName ? (
                              <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60">{tx.entityName}</span>
                            ) : (
                              <span className="font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">—</span>
                            )}
                            {tx.paymentMethodLabel && (
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                                {tx.paymentMethodLabel}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-xs font-medium text-slate-500">
                           {safeFormat(tx.created_at, 'HH:mm')}
                        </td>
                        <td className={`px-4 py-2 text-right font-bold tabular-nums ${isOut || tx.amount < 0 ? 'text-rose-600' : 'text-[#5da83f]'}`}>
                          {isOut || tx.amount < 0 ? '-' : '+'}{formatCurrency(tx.displayAmount)}
                        </td>
                      </tr>
                    );
                  })}
                  {isTxReady && recentTransactions.filter(t => !t.isEmpty).length === 0 && (
                    <tr><td colSpan="5" className="p-8 text-center text-slate-400 text-sm">Son işlem kaydı yok.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
        
        <div className="xl:col-span-2 flex flex-col h-full">
            <div className="bg-[#fef9c3] rounded-2xl shadow-sm border border-[#fef08a] overflow-hidden flex flex-col h-full min-h-[380px]">
            <div className="p-4 border-b border-[#fde047] bg-[#fef08a]/50">
              <h3 className="font-bold text-[#854d0e] text-sm tracking-wide">Hızlı Notlar</h3>
            </div>
            <div className="p-4 flex-1 flex flex-col overflow-y-auto">
              <form onSubmit={addNote} className="mb-4 flex flex-shrink-0 bg-white/60 border border-[#fde047] rounded-lg focus-within:ring-2 focus-within:ring-[#eab308] overflow-hidden shadow-sm">
                <input 
                  type="text" 
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  placeholder="Hızlı not ekle..."
                  className="flex-1 bg-transparent px-4 py-2.5 text-sm font-medium text-[#713f12] placeholder-[#a16207]/50 focus:outline-none"
                />
                <button type="submit" className="px-4 flex items-center justify-center bg-[#fde047]/30 text-[#a16207] hover:text-[#713f12] hover:bg-[#fde047]/70 transition-colors border-l border-[#fde047]/50">
                  <Plus className="w-5 h-5" />
                </button>
              </form>
              <ul className="flex-1 flex flex-col gap-2">
                {!isNotesReady ? <NotesSkeleton /> : quickNotes.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-[#a16207]/50 min-h-[160px]">
                    <div className="w-12 h-12 bg-[#fde047]/30 rounded-2xl flex items-center justify-center mb-3">
                      <Edit2 className="w-6 h-6 text-[#ca8a04]" />
                    </div>
                    <p className="text-sm font-semibold text-[#854d0e]">Henüz not eklenmemiş</p>
                    <p className="text-xs text-[#a16207]/70 mt-0.5">Gündelik notlarınızı buradan takip edin</p>
                  </div>
                ) : [...quickNotes, ...Array(Math.max(0, 5 - quickNotes.length)).fill({ isEmpty: true })].map((n, idx) => {
                  if (n.isEmpty) {
                    return <li key={`empty_${idx}`} className="flex-1 bg-transparent p-3 rounded-lg border border-transparent min-h-[46px]"></li>;
                  }
                  return (
                    <li key={n.id} className="w-full bg-white/60 px-3 py-2 rounded-lg flex items-center justify-between group border border-[#fde047] hover:border-[#eab308] transition-colors min-h-[46px]">
                      {editingNoteId === n.id ? (
                        <div className="flex-1 w-full mr-2">
                          <input 
                            autoFocus
                            type="text" 
                            value={editingNoteText}
                            onChange={(e) => setEditingNoteText(e.target.value)}
                            onKeyDown={(e) => { if(e.key === 'Enter') saveEditedNote(n.id); if(e.key === 'Escape') setEditingNoteId(null); }}
                            onBlur={() => saveEditedNote(n.id)}
                            className="w-full bg-white border border-[#fde047] rounded-md px-2 py-1 text-sm font-medium text-[#713f12] outline-none focus:ring-2 focus:ring-[#eab308]"
                          />
                        </div>
                      ) : (
                        <p 
                          className="flex-1 text-sm font-medium text-[#854d0e] whitespace-pre-wrap leading-tight cursor-pointer px-2 py-1 min-h-[28px] flex items-center"
                          onClick={() => { setEditingNoteId(n.id); setEditingNoteText(n.text); }}
                          title="Düzenlemek için tıkla"
                        >
                          {n.text}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                        <button 
                          onClick={() => { setEditingNoteId(n.id); setEditingNoteText(n.text); }} 
                          className="p-1.5 rounded-md bg-[#fef08a] text-[#854d0e] hover:bg-[#fde047] hover:text-[#713f12] transition-colors"
                          title="Düzenle"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => removeNote(n.id)} 
                          className="p-1.5 rounded-md bg-rose-100 text-rose-600 hover:bg-rose-200 transition-colors"
                          title="Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
        {/* Close bottom grid */}
        </div>
      {/* Close space-y-6 flex-1 */}
      </div>

      <TransactionDetailModal
        isOpen={!!selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
        transaction={selectedTransaction}
        onSaved={() => {
          setSelectedTransaction(null);
          loadDashboard();
        }}
        allRegisters={allRegisters}
      />

      <QuickBarcodesModal 
        isOpen={showQuickBarcodes} 
        onClose={() => setShowQuickBarcodes(false)} 
      />
      </div>
    </>
  );
};
