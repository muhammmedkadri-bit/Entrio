import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray, useWatch, FormProvider } from 'react-hook-form';
import {
  ArrowLeft, Save, X, ShoppingBag, UserCircle, Hash, Calendar,
  PenLine, CreditCard, Search, Building2, Mail, Phone,
  Plus, Minus, ChevronDown, FileText, Package, Truck, Receipt,
  Banknote, Wallet, SplitSquareHorizontal, Landmark, Clock, CheckCircle2, PieChart
} from 'lucide-react';
import toast from '../../components/ui/CustomToast';
import { format, addDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import { purchaseService } from '../../services/purchaseService';
import { cashService } from '../../services/cashService';
import { DatePicker } from '../../components/ui/DatePicker';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, SelectDropdown } from '../../components/ui/DropdownMenu';
import { AnimatedDropdown } from '../../components/ui/AnimatedDropdown';
import { Controller } from 'react-hook-form';
import { supplierService } from '../../services/supplierService';
import { productService } from '../../services/productService';
import { LineItemRow } from './components/LineItemRow';
import { QuickCreateSupplierModal } from './modals/QuickCreateSupplierModal';
import { calculateTotals, r2 } from '../../utils/purchaseMath';
import { formatTRPrice, parseTRPrice } from '../../utils/trPriceParser';

/* ── helpers ─────────────────────────────────────────────────────────────── */
const fmt = formatTRPrice;
const today = () => format(new Date(), 'yyyy-MM-dd');

const inputCls =
  'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-100 outline-none bg-white placeholder-gray-400 transition-colors';

const labelCls =
  'block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1';

const DUE_OPTIONS = [
  { value: '0',    label: 'Peşin (Aynı Gün)', days: 0  },
  { value: '7',    label: '7 Gün',             days: 7  },
  { value: '15',   label: '15 Gün',            days: 15 },
  { value: '30',   label: '30 Gün',            days: 30 },
  { value: 'custom', label: 'Özel Tarih…'              },
];

const PAYMENT_METHODS = [
  { value: 'cash',          label: 'Nakit',                       icon: 'cash' },
  { value: 'bank_transfer', label: 'Havale / EFT',                icon: 'bank' },
  { value: 'credit_card',   label: 'Kredi Kartı / Mail Order',    icon: 'card' },
  { value: 'split',         label: 'Parçalı Ödeme',               icon: 'split' },
];

const defaultItem = (overrides = {}) => ({
  product_id:     null,
  name:           '',
  barcode:        '',
  quantity:       1,
  unit:           'Adet',
  unit_price:     0,
  discount_type:  'percent',
  discount_value: 0,
  kdv_rate:       20,
  otv_rate:       0,
  isNewProduct:   false,
  ...overrides,
});

/* ── Supplier Combobox ───────────────────────────────────────────────────── */
const SupplierCombobox = ({ value, onChange, onCreateNew }) => {
  const [query, setQuery]       = useState(value?.name || '');
  const [results, setResults]   = useState([]);
  const [open, setOpen]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const inputRef  = useRef(null);
  const wrapRef   = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (value) { setQuery(value.name); }
    else       { setQuery(''); }
  }, [value]);

  const search = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const all = await supplierService.getAll();
      const filtered = all.filter(s =>
        s.name.toLowerCase().includes(q.toLowerCase()) ||
        (s.tax_number && s.tax_number.includes(q)) ||
        (s.phone && s.phone.includes(q))
      ).slice(0, 8);
      setResults(filtered);
      setOpen(true);
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!value) {
      const t = setTimeout(() => search(query), 200);
      return () => clearTimeout(t);
    }
  }, [query, value, search]);

  const fmtCur = (v) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(v || 0);

  return (
    <div ref={wrapRef} className="relative">
      {value ? (
        <div className="flex items-center gap-2 px-3 py-2 border border-indigo-100 bg-indigo-50/40 rounded-lg">
          <Building2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span className="flex-1 text-sm font-semibold text-gray-800 truncate">{value.name}</span>
          {value.balance !== undefined && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
              value.balance > 0  ? 'bg-red-50 text-red-500 border border-red-100'
            : value.balance < 0  ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
            :                      'bg-gray-50 text-gray-400 border border-gray-100'
            }`}>
              {fmtCur(Math.abs(value.balance))} {value.balance > 0 ? 'Borç' : value.balance < 0 ? 'Alacak' : 'Sıfır'}
            </span>
          )}
          <button type="button" onClick={() => onChange(null)} className="text-gray-300 hover:text-red-400 transition-colors shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); }}
            onFocus={() => { if (results.length > 0) setOpen(true); }}
            placeholder="Tedarikçi veya vergi no ara..."
            id="supplier-search-input"
            className={`${inputCls} pl-9`}
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          )}
        </div>
      )}

      {open && results.length > 0 && !value && (
        <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden max-h-64 overflow-y-auto">
          {results.map(s => (
            <button
              key={s.id}
              type="button"
              onMouseDown={() => { onChange(s); setOpen(false); }}
              className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-indigo-50 text-left border-b border-gray-50 last:border-0 transition-colors"
            >
              <Building2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{s.name}</p>
                {s.tax_number && <p className="text-[10px] font-mono text-gray-400">{s.tax_number}</p>}
              </div>
              <span className={`text-xs font-bold shrink-0 ${s.balance > 0 ? 'text-red-500' : s.balance < 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                {fmtCur(s.balance)}
              </span>
            </button>
          ))}
          <button
            type="button"
            onMouseDown={() => { setOpen(false); onCreateNew(); }}
            className="flex items-center gap-1.5 text-[13px] font-semibold text-emerald-600 bg-white border border-emerald-200 mt-2 mx-2 px-3 py-1.5 hover:bg-emerald-50 hover:border-emerald-300 rounded-lg transition-all w-[calc(100%-16px)] justify-center cursor-pointer shadow-sm active:scale-95 mb-2"
          >
            Yeni Tedarikçi Oluştur
          </button>
        </div>
      )}
      {open && results.length === 0 && !value && query.trim().length > 0 && !loading && (
        <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden">
          <p className="px-4 py-3 text-sm text-gray-400 text-center">Sonuç bulunamadı</p>
          <button
            type="button"
            onMouseDown={() => { setOpen(false); onCreateNew(); }}
            className="flex items-center gap-1.5 text-[13px] font-semibold text-emerald-600 bg-white border border-emerald-200 mt-2 mx-2 px-3 py-1.5 hover:bg-emerald-50 hover:border-emerald-300 rounded-lg transition-all w-[calc(100%-16px)] justify-center cursor-pointer shadow-sm active:scale-95 mb-2"
          >
            Yeni Tedarikçi Oluştur
          </button>
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════════ */
/*  Main Page                                                                 */
/* ══════════════════════════════════════════════════════════════════════════ */
/* ── DueDateDropdown ───────────────────────────────────────────────────────── */
const DueDateDropdown = ({ methods, DUE_OPTIONS }) => {
  const mode = useWatch({ control: methods.control, name: 'due_date_mode' });
  const date = useWatch({ control: methods.control, name: 'due_date' });
  
  const [pickerOpen, setPickerOpen] = useState(false);

  const displayLabel = useMemo(() => {
    if (mode === 'custom') {
      if (pickerOpen) return 'Özel Tarih Seçin';
      return date ? format(new Date(date), 'd MMMM yyyy', { locale: tr }) : 'Özel Tarih Seçin';
    }
    return DUE_OPTIONS.find(o => o.value === mode)?.label || 'Seçiniz';
  }, [mode, date, pickerOpen, DUE_OPTIONS]);

  return (
    <div className="w-full block">
      <Controller
        control={methods.control}
        name="due_date"
        render={({ field }) => (
          <DatePicker
            compact
            allowClear={false}
            value={field.value ? { start: new Date(field.value), end: new Date(field.value) } : null}
            onChange={(val) => {
              if (val?.start) {
                field.onChange(format(val.start, 'yyyy-MM-dd'));
                methods.setValue('due_date_mode', 'custom');
              }
            }}
            
            renderTrigger={({ isOpen, setIsOpen }) => {
              useEffect(() => { setPickerOpen(isOpen); }, [isOpen]);

              return (
                <DropdownMenu className="w-full">
                  <DropdownMenuTrigger asChild>
                    <button type="button" className={`${inputCls} flex items-center justify-between w-full h-[40px] px-3 bg-white hover:bg-gray-50 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-100 transition-colors`}>
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        <Calendar className="w-4 h-4 text-emerald-600/70 shrink-0" />
                        <span className="text-[13px] font-medium text-gray-700 truncate">{displayLabel}</span>
                      </div>
                      <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-full min-w-[200px]">
                    {DUE_OPTIONS.map(o => (
                      <DropdownMenuItem 
                        key={o.value} 
                        selected={mode === o.value}
                        onClick={() => {
                          methods.setValue('due_date_mode', o.value);
                          if (o.value === 'custom') {
                             setIsOpen(true);
                          } else {
                             setIsOpen(false);
                          }
                        }}
                      >
                        {o.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            }}
          />
        )}
      />
    </div>
  );
};

export const NewPurchasePage = () => {
  const navigate = useNavigate();

  const methods = useForm({
    defaultValues: {
      invoice_title:   '',
      invoice_number:  '',
      supplier_id:     null,
      invoice_date:    today(),
      due_date_mode:   '0',    // '0' | '7' | '15' | '30' | 'custom'
      due_date:        today(),
      payment_status:  'unpaid',
      payment_method:  'cash',
      payment_account_id: null,
      paid_amount:     '',
      split_payments:  [],
      waybill_number:  '',
      waybill_date:    '',
      notes:           '',
      category_id:     '',
      responsible_user_id: '',
      items: [defaultItem()],
    },
  });

  const { control, register, handleSubmit, watch, setValue, getValues, formState: { isSubmitting } } = methods;

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  /* ── state ──────────────────────────────────────────────────────────── */
  const [supplier, setSupplier]                   = useState(null);
  const [showQuickCreateSupplier, setShowQuickCreateSupplier] = useState(false);
  const [extraInfoState, setExtraInfoState]       = useState({ efatura: false, siparis: false, irsaliye: false });
  const [saving, setSaving]                       = useState(false);
  const [cashRegisters, setCashRegisters]         = useState([]);
  const [splitState, setSplitState] = useState({
    cash: { amount: '', account_id: null, notes: '' },
    bank_transfer: { amount: '', account_id: null, notes: '' },
    credit_card: { amount: '', account_id: null, notes: '' },
    date: today()
  });

  const updateSplit = (method, field, value) => {
    setSplitState(prev => ({
      ...prev,
      [method]: { ...prev[method], [field]: value }
    }));
  };

  /* ── watch values ────────────────────────────────────────────────────── */
  const watchedItems      = useWatch({ control, name: 'items' });
  const paymentStatus     = watch('payment_status');
  const paymentMethod     = watch('payment_method');
  const invoiceDate       = watch('invoice_date');
  const dueDateMode       = watch('due_date_mode');
  const paymentAccountId  = watch('payment_account_id');

  /* ── load cash registers ────────────────────────────────────────────── */
  useEffect(() => {
    cashService.getRegisters().then(setCashRegisters).catch(() => {});
  }, []);

  /* ── due date auto-fill ─────────────────────────────────────────────── */
  useEffect(() => {
    if (dueDateMode === 'custom') return;
    const days  = parseInt(dueDateMode) || 0;
    const base  = invoiceDate ? new Date(invoiceDate) : new Date();
    setValue('due_date', format(addDays(base, days), 'yyyy-MM-dd'));
  }, [dueDateMode, invoiceDate, setValue]);

  /* ── totals ─────────────────────────────────────────────────────────── */
  const totals = useMemo(() => calculateTotals(watchedItems || []), [watchedItems]);

  /* ── paid_amount auto-fill ──────────────────────────────────────────── */
  useEffect(() => {
    if (paymentStatus === 'paid') {
      setValue('paid_amount', fmt(r2(totals.grandTotal)));
    } else if (paymentStatus === 'unpaid') {
      setValue('paid_amount', '');
    }
  }, [paymentStatus, totals.grandTotal, setValue]);

  // Aggregate paid amounts when using split
  useEffect(() => {
    if (paymentMethod === 'split' && paymentStatus !== 'unpaid') {
        const c = parseTRPrice(splitState.cash.amount) || 0;
        const b = parseTRPrice(splitState.bank_transfer.amount) || 0;
        const cr = parseTRPrice(splitState.credit_card.amount) || 0;
        setValue('paid_amount', fmt(r2(c + b + cr)));
    }
  }, [splitState, paymentMethod, paymentStatus, setValue]);

  /* ── keyboard shortcuts ──────────────────────────────────────────────── */
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'F3') {
        e.preventDefault();
        document.getElementById('supplier-search-input')?.focus();
      }
      if (e.key === 'F9') {
        e.preventDefault();
        handleSubmit(onSubmit)();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  /* ── smart inheritance — add row ─────────────────────────────────────── */
  const addRow = useCallback(() => {
    const items     = getValues('items');
    const lastIndex = items.length - 1;
    const last      = items[lastIndex] || {};
    append(defaultItem({
      unit:           last.unit           || 'Adet',
      kdv_rate:       last.kdv_rate       ?? 20,
      discount_type:  last.discount_type  || 'percent',
      discount_value: last.discount_value || 0,
    }));
    // Focus new row's first input after render
    setTimeout(() => {
      const inputs = document.querySelectorAll('[data-new-row-focus]');
      if (inputs.length) inputs[inputs.length - 1]?.focus();
    }, 80);
  }, [append, getValues]);

  /* ── save transaction ───────────────────────────────────────────────── */
  const onSubmit = async (data) => {
    const items = data.items || [];

    // Validation
    if (items.length === 0) { toast.error('En az 1 kalem eklemelisiniz.'); return; }

    const invalid = items.find(i => (i.quantity || 0) <= 0);
    if (invalid) { toast.error('Miktar 0\'dan büyük olmalıdır.'); return; }

    const newWithoutName = items.find(i => i.isNewProduct && !i.name?.trim());
    if (newWithoutName) { toast.error('Yeni ürün satırlarında ürün adı zorunlu.'); return; }

    setSaving(true);
    try {
      // Step 1: Create new products first
      const processedItems = await Promise.all(items.map(async (item) => {
        if (item.isNewProduct && !item.product_id) {
          const newProduct = await productService.create({
            name:           item.name.trim(),
            unit:           item.unit || 'Adet',
            purchase_price: item.unit_price || 0,
            sale_price:     item.unit_price || 0,
            tax_rate:       item.kdv_rate   || 0,
            stock_quantity: 0,
            is_active:      true,
          }).catch(async () => {
            // Fallback to getAll and create if service.create isn't defined
            const { db } = await import('../../db');
            const id = await db.products.add({
              name:           item.name.trim(),
              unit:           item.unit || 'Adet',
              purchase_price: item.unit_price || 0,
              sale_price:     item.unit_price || 0,
              tax_rate:       item.kdv_rate   || 0,
              stock_quantity: 0,
              is_active:      true,
              created_at:     Date.now(),
            });
            return { id };
          });
          return { ...item, product_id: newProduct.id };
        }
        return item;
      }));

      const paidNow = parseTRPrice(data.paid_amount) || 0;

      await purchaseService.create(
        {
          invoice_number:  data.invoice_number  || null,
          invoice_date:    data.invoice_date     || today(),
          due_date:        data.due_date         || today(),
          supplier_id:     supplier?.id          || null,
          supplier_name:   supplier?.name        || null,
          waybill_number:  data.waybill_number   || null,
          waybill_date:    data.waybill_date     || null,
          notes:           data.notes            || null,
          invoice_title:   data.invoice_title    || null,
          siparis_no:      data.siparis_no       || null,
          siparis_date:    data.siparis_date     || null,
        },
        processedItems.map(i => ({
          product_id:     i.product_id,
          name:           i.name,
          quantity:       parseFloat(i.quantity) || 1,
          unit:           i.unit || 'Adet',
          unit_price:     parseFloat(i.unit_price) || 0,
          discount_type:  i.discount_type  || 'percent',
          discount_value: parseFloat(i.discount_value) || 0,
          kdv_rate:       parseFloat(i.kdv_rate) || 0,
          otv_rate:       parseFloat(i.otv_rate) || 0,
        })),
        {
          paidNow: data.payment_status !== 'unpaid' ? paidNow : 0,
          method:  data.payment_method || 'cash',
          splits:  data.payment_method === 'split' ? splitState : null,
        }
      );

      const newCount = items.filter(i => i.isNewProduct).length;
      toast.success(
        `Fatura kaydedildi — ${items.length} kalem stoğa eklendi${newCount > 0 ? `, ${newCount} yeni ürün oluşturuldu` : ''} ✓`
      );
      navigate('/purchases');
    } catch (err) {
      toast.error(err.message || 'Kayıt sırasında bir hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  const paidAmountNum = parseTRPrice(watch('paid_amount')) || 0;
  const remainingDebt = r2(totals.grandTotal - paidAmountNum);
  const showPaymentFields = paymentStatus === 'paid' || paymentStatus === 'partial';

  /* ══════════════════════════════════════════════════════════════════════ */
  return (
    <FormProvider {...methods}>
      <div className="flex flex-col h-full gap-4">
        {/* ── BACK BUTTON PILL ────────────────────────────────────────────── */}
        <div className="flex">
          <button
            onClick={() => navigate('/purchases')}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors bg-white border border-gray-200 shadow-sm px-3 py-1.5 rounded-xl"
          >
            <ArrowLeft className="w-4 h-4 text-gray-500" />
            Alış Faturaları
          </button>
        </div>

        {/* ── PAGE HEADER SETTINGS ────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5 flex items-start justify-between">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-xl bg-[#82e05a]/15 text-[#5da83f] flex items-center justify-center shrink-0 border border-[#82e05a]/30">
               <FileText className="w-6 h-6" />
             </div>
             <div>
               <h1 className="text-xl font-bold text-gray-900">Yeni Alış Faturası</h1>
               <p className="text-sm text-gray-500 mt-0.5">Tedarikçi faturanızı kaydedin ve stoğu güncelleyin</p>
             </div>
          </div>
          {/* Right actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/purchases')}
              className="flex items-center gap-1.5 text-sm font-medium"
              style={{
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 10, color: 'rgb(185,28,28)', padding: '8px 16px',
              }}
            >
              <X className="w-4 h-4" />
              İptal
            </button>
            <button
              type="button"
              onClick={handleSubmit(onSubmit)}
              disabled={saving || isSubmitting || fields.length === 0}
              className="flex items-center gap-1.5 text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 rounded-xl px-5 py-2 shadow-sm"
              style={{ background: 'linear-gradient(135deg, #5da83f 0%, #4a9430 100%)', boxShadow: '0 2px 8px rgba(93,168,63,0.35)' }}
            >
              <Save className="w-4 h-4" />
              {saving ? 'Kaydediliyor...' : 'Alış Faturasını Kaydet'}
              <span className="text-[10px] font-normal ml-1 opacity-70 bg-white/20 rounded px-1 py-0.5">F9</span>
            </button>
          </div>
        </div>

        {/* ── TWO COLUMN LAYOUT ─────────────────────────────────────────── */}
        <div className="flex gap-5 items-start">

          {/* ── LEFT COLUMN ──────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 flex flex-col gap-4">
            
            <div className="bg-white rounded-xl p-4 sm:p-5" style={{ border: '1px solid rgba(229,231,235,0.8)' }}>
              {/* Card Header */}
              <div className="flex items-center gap-2 mb-5 pb-3 border-b border-gray-100">
                <div className="w-6 h-6 rounded-md bg-[#82e05a]/15 flex items-center justify-center">
                  <Hash className="w-3.5 h-3.5 text-[#5da83f]" />
                </div>
                <span className="text-sm font-semibold text-gray-700">Fatura Bilgileri</span>
              </div>

              {/* Row 1: Fatura İsmi & Tedarikçi */}
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div className="col-span-2">
                  <label className={labelCls}>
                    <span className="flex items-center gap-1">
                      <Hash className="w-3 h-3" /> Fatura İsmi
                    </span>
                  </label>
                  <input
                    {...register('invoice_title')}
                    type="text"
                    placeholder="Alış faturası için kısa bir isim veya açıklama"
                    className={`${inputCls} h-[40px] bg-white`}
                  />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3 h-3" /> Tedarikçi Arama
                    </span>
                  </label>
                  <SupplierCombobox
                    value={supplier}
                    onChange={(s) => {
                      setSupplier(s);
                      methods.setValue('supplier_id', s?.id || null);
                    }}
                    onCreateNew={() => setShowQuickCreateSupplier(true)}
                  />
                </div>
              </div>

              {/* Row 2: Invoice No + Invoice Date + Due Date */}
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div className="col-span-2">
                  <label className={labelCls}>
                    <span className="flex items-center gap-1">
                      <Hash className="w-3 h-3" /> Fiş / Fatura No
                    </span>
                  </label>
                  <input
                    {...register('invoice_number')}
                    type="text"
                    placeholder="Varsa fiş / fatura no ekleyin"
                    className={`${inputCls} font-mono h-[40px] bg-white`}
                  />
                </div>

                {/* Düzenleme Tarihi */}
                <div>
                  <label className={labelCls}>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Düzenleme Tarihi
                    </span>
                  </label>
                  <Controller
                    control={methods.control}
                    name="invoice_date"
                    render={({ field }) => (
                      <div className="w-full block">
                        <DatePicker
                          compact
                          allowClear={false}
                          popupAlignment="top"
                          value={{ start: new Date(field.value || Date.now()), end: new Date(field.value || Date.now()) }}
                          onChange={(val) => { if (val?.start) field.onChange(format(val.start, 'yyyy-MM-dd')); }}
                          renderTrigger={({ setIsOpen }) => (
                            <div
                              className={`${inputCls} flex items-center gap-1.5 h-[40px] px-3 cursor-pointer bg-white hover:bg-gray-50 border-gray-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-100 transition-colors`}
                              onClick={() => setIsOpen(true)}
                            >
                              <Calendar className="w-4 h-4 text-emerald-600/70 shrink-0" />
                              <span className="text-[13px] font-medium text-gray-700 whitespace-nowrap">
                                {field.value ? format(new Date(field.value), 'd MMMM yyyy', { locale: tr }) : format(new Date(), 'd MMMM yyyy', { locale: tr })}
                              </span>
                            </div>
                          )}
                        />
                      </div>
                    )}
                  />
                </div>

                {/* Vade Tarihi */}
                <div>
                  <label className={labelCls}>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Vade Tarihi
                    </span>
                  </label>
                  <DueDateDropdown methods={methods} DUE_OPTIONS={DUE_OPTIONS} />
                </div>
              </div>

              {/* Row 3: İskonto, Para Birimi, Stok Girişi — 3 equal cols, Ödeme Durumu moved to totals */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className={labelCls}>İskonto Listeleri</label>
                  <SelectDropdown
                    disabled
                    value="disabled"
                    options={[{ value: 'disabled', label: 'Şimdilik Deaktif' }]}
                    className="w-full h-[40px] shadow-sm text-[13px] text-gray-500"
                  />
                </div>
                <div>
                  <label className={labelCls}>Para Birimi</label>
                  <SelectDropdown
                    disabled
                    value="try"
                    options={[{ value: 'try', label: 'TRY (₺)' }]}
                    className="w-full h-[40px] shadow-sm text-[13px] text-gray-500"
                  />
                </div>
                <div>
                  <label className={labelCls}>Stok Girişi</label>
                  <SelectDropdown
                    disabled
                    value="disabled"
                    options={[{ value: 'disabled', label: 'Şimdilik Deaktif' }]}
                    className="w-full h-[40px] shadow-sm text-[13px] text-gray-500"
                  />
                </div>
              </div>



              {/* Row 4: Extra Buttons & Dedicated Info Panels */}
              <div className="flex flex-col gap-2 pt-2">
                
                {/* E-Fatura Row */}
                <div className="flex gap-4 items-center">
                  <div className="w-40 shrink-0">
                    <button
                      type="button"
                      onClick={() => setExtraInfoState(p => ({ ...p, efatura: !p.efatura }))}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold border rounded-lg transition-colors text-left h-[34px] ${extraInfoState.efatura ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                      <Plus className={`w-3.5 h-3.5 shrink-0 transition-transform ${extraInfoState.efatura ? 'rotate-45 text-emerald-500' : 'text-gray-400'}`} />
                      e-Fatura Bilgileri
                    </button>
                  </div>
                  <div className={`flex-1 flex items-center rounded-lg border border-dashed px-3 overflow-hidden transition-all h-[34px] ${extraInfoState.efatura ? 'bg-emerald-50/40 border-emerald-200' : 'bg-gray-50/80 border-gray-200'}`}>
                    {!extraInfoState.efatura ? (
                       <div className="flex items-center gap-2 text-gray-400 animate-in fade-in">
                         <Receipt className="w-4 h-4 text-emerald-500/70" />
                         <span className="text-xs font-medium whitespace-nowrap">e-Fatura detaylarını girmek için yandaki butona tıklayın...</span>
                       </div>
                    ) : (
                       <div className="flex items-center gap-3 w-full animate-in fade-in">
                         <div className="flex items-center gap-2 flex-1">
                           <span className="text-xs font-semibold text-emerald-700 whitespace-nowrap">Seri:</span>
                           <input type="text" {...register('efatura_seri')} placeholder="GIB" maxLength={3} className={`${inputCls} h-[26px] py-0 px-2 text-xs bg-white w-full uppercase font-mono`} />
                         </div>
                         <div className="flex items-center gap-2 flex-1">
                           <span className="text-xs font-semibold text-emerald-700 whitespace-nowrap">Sıra No:</span>
                           <input type="text" {...register('efatura_sira')} placeholder="2024000000001" maxLength={13} className={`${inputCls} h-[26px] py-0 px-2 text-xs bg-white w-full font-mono`} />
                         </div>
                       </div>
                    )}
                  </div>
                </div>

                {/* Sipariş Row */}
                <div className="flex gap-4 items-center">
                  <div className="w-40 shrink-0">
                    <button
                      type="button"
                      onClick={() => setExtraInfoState(p => ({ ...p, siparis: !p.siparis }))}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold border rounded-lg transition-colors text-left h-[34px] ${extraInfoState.siparis ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                      <Plus className={`w-3.5 h-3.5 shrink-0 transition-transform ${extraInfoState.siparis ? 'rotate-45 text-emerald-500' : 'text-gray-400'}`} />
                      Sipariş Bilgileri
                    </button>
                  </div>
                  <div className={`flex-1 flex items-center rounded-lg border border-dashed px-3 transition-all h-[34px] ${extraInfoState.siparis ? 'bg-emerald-50/40 border-emerald-200' : 'bg-gray-50/80 border-gray-200'}`}>
                    {!extraInfoState.siparis ? (
                       <div className="flex items-center gap-2 text-gray-400 animate-in fade-in">
                         <Package className="w-4 h-4 text-emerald-500/70" />
                         <span className="text-xs font-medium whitespace-nowrap">Sipariş numarası ve tarihi girmek için yandaki butona tıklayın...</span>
                       </div>
                    ) : (
                       <div className="flex items-center gap-3 w-full animate-in fade-in">
                         <div className="flex items-center gap-2 flex-1">
                           <span className="text-xs font-semibold text-emerald-700 whitespace-nowrap">Sipariş No:</span>
                           <input type="text" {...register('siparis_no')} placeholder="SP-2024..." className={`${inputCls} h-[26px] py-0 px-2 text-xs bg-white w-full`} />
                         </div>
                         <div className="flex items-center gap-2 flex-1">
                           <span className="text-xs font-semibold text-emerald-700 whitespace-nowrap">Sipariş Tarihi:</span>
                           <Controller
                             control={control}
                             name="siparis_date"
                             render={({ field }) => (
                               <DatePicker
                                 compact
                                 allowClear={false}
                                 value={{ start: new Date(field.value || Date.now()), end: new Date(field.value || Date.now()) }}
                                 onChange={(val) => {
                                   if (val?.start) field.onChange(format(val.start, 'yyyy-MM-dd'));
                                 }}
                                 renderTrigger={({ setIsOpen }) => (
                                   <div onClick={() => setIsOpen(true)} className={`${inputCls} flex items-center gap-1.5 h-[26px] py-0 px-2 text-xs bg-white w-full cursor-pointer border-emerald-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-100`}>
                                     <Calendar className="w-3 h-3 text-emerald-600/70 shrink-0" />
                                     <span className="whitespace-nowrap text-gray-700 font-medium">{field.value ? format(new Date(field.value), 'd MMMM yyyy', { locale: tr }) : format(new Date(), 'd MMMM yyyy', { locale: tr })}</span>
                                   </div>
                                 )}
                               />
                             )}
                           />
                         </div>
                       </div>
                    )}
                  </div>
                </div>

                {/* İrsaliye Row */}
                <div className="flex gap-4 items-center">
                  <div className="w-40 shrink-0">
                    <button
                      type="button"
                      onClick={() => setExtraInfoState(p => ({ ...p, irsaliye: !p.irsaliye }))}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold border rounded-lg transition-colors text-left h-[34px] ${extraInfoState.irsaliye ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                      <Plus className={`w-3.5 h-3.5 shrink-0 transition-transform ${extraInfoState.irsaliye ? 'rotate-45 text-emerald-500' : 'text-gray-400'}`} />
                      İrsaliye Bilgileri
                    </button>
                  </div>
                  <div className={`flex-1 flex items-center rounded-lg border border-dashed px-3 transition-all h-[34px] ${extraInfoState.irsaliye ? 'bg-emerald-50/40 border-emerald-200' : 'bg-gray-50/80 border-gray-200'}`}>
                    {!extraInfoState.irsaliye ? (
                       <div className="flex items-center gap-2 text-gray-400 animate-in fade-in">
                         <Truck className="w-4 h-4 text-emerald-500/70" />
                         <span className="text-xs font-medium whitespace-nowrap">İrsaliye numarası ve tarihi girmek için yandaki butona tıklayın...</span>
                       </div>
                    ) : (
                       <div className="flex items-center gap-3 w-full animate-in fade-in">
                         <div className="flex items-center gap-2 flex-1">
                           <span className="text-xs font-semibold text-emerald-700 whitespace-nowrap">İrsaliye No:</span>
                           <input {...methods.register('waybill_number')} type="text" placeholder="İRS-2024..." className={`${inputCls} font-mono h-[26px] py-0 px-2 text-xs border-emerald-200 focus:border-emerald-500 focus:ring-emerald-500 bg-white`} />
                         </div>
                         <div className="flex items-center gap-2 flex-1">
                           <span className="text-xs font-semibold text-emerald-700 whitespace-nowrap">İrsaliye Tarihi:</span>
                           <Controller
                             control={methods.control}
                             name="waybill_date"
                             render={({ field }) => (
                               <DatePicker
                                 compact
                                 allowClear={false}
                                 value={{ start: new Date(field.value || Date.now()), end: new Date(field.value || Date.now()) }}
                                 onChange={(val) => {
                                   if (val?.start) {
                                     field.onChange(format(val.start, 'yyyy-MM-dd'));
                                   }
                                 }}
                                 renderTrigger={({ setIsOpen }) => (
                                   <div 
                                     className={`${inputCls} h-[26px] py-0 px-2 flex items-center gap-1.5 cursor-pointer text-xs border-emerald-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-100 bg-white w-full`}
                                     onClick={() => setIsOpen(true)}
                                   >
                                     <Calendar className="w-3 h-3 text-emerald-600/70 shrink-0" />
                                     <span className="whitespace-nowrap text-gray-700 font-medium">{field.value ? format(new Date(field.value), 'd MMMM yyyy', { locale: tr }) : format(new Date(), 'd MMMM yyyy', { locale: tr })}</span>
                                   </div>
                                 )}
                               />
                             )}
                           />
                         </div>
                       </div>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* ── CARD 2: Line Items ───────────────────────────────────── */}
            <div
              className="bg-white rounded-xl p-5 mb-4"
              style={{ border: '1px solid rgba(229,231,235,0.8)' }}
            >
              <div className="flex items-center gap-2 mb-4">
                <ShoppingBag className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-semibold text-gray-700">Fatura Kalemleri</span>
                <span className="ml-auto text-[10px] font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {fields.length} kalem
                </span>
              </div>

              {/* Table header */}
              <div
                className="grid items-center text-[10px] font-bold text-gray-400 uppercase tracking-widest pb-3 border-b border-gray-100 mb-2"
                style={{ gridTemplateColumns: '1fr 75px 90px 110px 110px 80px 120px 40px', gap: '0.75rem' }}
              >
                <span className="text-left">Ürün / Hizmet</span>
                <span className="text-center">Miktar</span>
                <span className="text-center">Birim</span>
                <span className="text-center">Birim Fiyat (₺)</span>
                <span className="text-center">İskonto</span>
                <span className="text-center">KDV %</span>
                <div className="text-right">Toplam</div>
                <span />
              </div>

              {/* Rows */}
              {fields.map((field, index) => (
                <LineItemRow
                  key={field.id}
                  field={field}
                  index={index}
                  onRemove={() => remove(index)}
                  canRemove={fields.length > 1}
                  isLast={index === fields.length - 1}
                  onTabFromLast={addRow}
                />
              ))}

              {/* Add row */}
              <button
                type="button"
                onClick={addRow}
                className="flex items-center gap-1 text-[13px] font-semibold text-emerald-600 bg-white border border-emerald-200 mt-3 px-3 py-1.5 hover:bg-emerald-50 hover:border-emerald-300 rounded-lg transition-all w-fit cursor-pointer shadow-sm active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                Yeni Satır Ekle
              </button>

              {/* ── INSIDE LINE ITEMS CARD: Notes + Totals Footer ───────────────────────── */}
              <div className="mt-8 pt-6 border-t border-gray-200 flex justify-between items-start gap-6">
                {/* Left: Notes + Payment Details */}
                <div className="flex-1 flex flex-col gap-4">
                  {/* Ödeme Durumu Dropdown */}
                  <div className="w-1/2">
                    <label className={labelCls}>
                      <span className="flex items-center gap-1">
                        <Wallet className="w-3 h-3 text-emerald-500" /> Ödeme Durumu
                      </span>
                    </label>
                    <Controller
                      control={control}
                      name="payment_status"
                      render={({ field }) => (
                        <SelectDropdown
                          value={field.value}
                          onChange={field.onChange}
                          options={[
                            { value: 'unpaid', label: 'Ödeme Yapılacak', icon: <Clock className="w-4 h-4" /> },
                            { value: 'paid', label: 'Ödeme Yapıldı', icon: <CheckCircle2 className="w-4 h-4" /> },
                            { value: 'partial', label: 'Kısmi Ödeme', icon: <PieChart className="w-4 h-4" /> }
                          ]}
                          className="w-full shadow-sm text-[13px] text-gray-700 font-medium"
                        />
                      )}
                    />
                  </div>

                  {/* Payment Details Panel / Placeholder */}
                  {showPaymentFields ? (
                    <div className="w-full p-4 bg-gradient-to-br from-emerald-50/60 to-emerald-50/20 border border-emerald-100 rounded-xl space-y-4 relative overflow-visible">
                      {/* Decorative Background Icon */}
                      <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none">
                         <Wallet className="w-24 h-24" />
                      </div>
                      <div className="flex items-center gap-2 relative z-10 mb-2">
                        <Wallet className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm font-bold text-emerald-700 uppercase tracking-wide">Ödeme Detayları</span>
                      </div>

                      {paymentMethod !== 'split' ? (
                        <div className="space-y-4 relative z-10">
                          {/* Top Row: Ödeme Yöntemi ve Tarih */}
                          <div className="flex items-start gap-6">
                            <div className="w-48 shrink-0">
                              <label className={labelCls}>Ödeme Yöntemi</label>
                              <Controller
                                control={control}
                                name="payment_method"
                                render={({ field }) => (
                                  <SelectDropdown
                                    value={field.value}
                                    onChange={(v) => { field.onChange(v); setValue('payment_account_id', null); }}
                                    options={PAYMENT_METHODS.map(m => ({ value: m.value, label: m.label }))}
                                    className="w-full shadow-sm text-[13px]"
                                  />
                                )}
                              />
                            </div>
                            <div className="w-48 shrink-0">
                              <label className={labelCls}>Ödeme Tarihi</label>
                              <Controller
                                control={control}
                                name="payment_date"
                                render={({ field }) => (
                                  <DatePicker compact allowClear={false} popupAlignment="top"
                                    value={{ start: field.value ? new Date(field.value) : new Date(), end: field.value ? new Date(field.value) : new Date() }}
                                    onChange={(val) => { if (val?.start) field.onChange(format(val.start, 'yyyy-MM-dd')); }}
                                    renderTrigger={({ setIsOpen }) => (
                                      <div className={`${inputCls} flex items-center gap-1.5 h-[40px] px-3 cursor-pointer bg-white hover:bg-gray-50 transition-colors`} onClick={() => setIsOpen(true)}>
                                        <Calendar className="w-4 h-4 text-emerald-600/70 shrink-0" />
                                        <span className="text-[13px] font-medium text-gray-700 whitespace-nowrap">{field.value ? format(new Date(field.value), 'd MMMM yyyy', { locale: tr }) : format(new Date(), 'd MMMM yyyy', { locale: tr })}</span>
                                      </div>
                                    )}
                                  />
                                )}
                              />
                            </div>
                          </div>

                          {/* Bottom Row: Kasa, Tutar, Açıklama */}
                          <div className="flex items-start gap-4">
                            <div className="w-64 shrink-0">
                              <label className={labelCls}>
                                {paymentMethod === 'cash' ? 'Kasa Seçin' :
                                 paymentMethod === 'bank_transfer' ? 'Banka Seçin' :
                                 paymentMethod === 'credit_card' ? 'POS Seçin' : 'Hesap Seçin'}
                              </label>
                              <Controller
                                control={control}
                                name="payment_account_id"
                                render={({ field }) => {
                                  const filtered = cashRegisters.filter(r => {
                                    if (paymentMethod === 'cash') return r.type === 'cash' || r.type === 'general';
                                    if (paymentMethod === 'bank_transfer') return r.type === 'bank';
                                    if (paymentMethod === 'credit_card') return r.type === 'pos';
                                    return true;
                                  });
                                  return (
                                    <SelectDropdown
                                      value={field.value ? String(field.value) : ''}
                                      onChange={(v) => field.onChange(v ? parseInt(v) : null)}
                                      placeholder="Hesap Seçin"
                                      options={filtered.map(r => ({ value: String(r.id), label: r.name }))}
                                      className="w-full shadow-sm text-[13px]"
                                    />
                                  );
                                }}
                              />
                            </div>
                            <div className="w-40 shrink-0">
                              <label className={labelCls}>Tutar (₺)</label>
                              <input
                                {...register('paid_amount')}
                                type="text"
                                placeholder="0,00"
                                disabled={paymentStatus === 'paid'}
                                className={`${inputCls} text-right font-semibold ${paymentStatus === 'paid' ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-60' : ''}`}
                              />
                            </div>
                            <div className="flex-1">
                              <label className={labelCls}>Açıklama</label>
                              <input
                                {...register('payment_notes')}
                                type="text"
                                placeholder="..."
                                className={inputCls}
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4 relative z-10">
                          {/* Top Row: Dropdown, Date */}
                          <div className="flex items-start gap-6">
                            <div className="w-48 shrink-0">
                              <label className={labelCls}>Ödeme Yöntemi</label>
                              <Controller
                                control={control}
                                name="payment_method"
                                render={({ field }) => (
                                  <SelectDropdown
                                    value={field.value}
                                    onChange={field.onChange}
                                    options={PAYMENT_METHODS.map(m => ({ value: m.value, label: m.label }))}
                                    className="w-full shadow-sm text-[13px]"
                                  />
                                )}
                              />
                            </div>
                            <div className="w-48 shrink-0">
                              <label className={labelCls}>Ödeme Tarihi</label>
                              <DatePicker compact allowClear={false}
                                value={{ start: splitState.date ? new Date(splitState.date) : new Date(), end: splitState.date ? new Date(splitState.date) : new Date() }}
                                onChange={(val) => { if (val?.start) setSplitState(prev => ({ ...prev, date: format(val.start, 'yyyy-MM-dd') })); }}
                                renderTrigger={({ setIsOpen }) => (
                                  <div className={`${inputCls} flex items-center gap-2 cursor-pointer h-[40px] px-3 bg-white`} onClick={() => setIsOpen(true)}>
                                    <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                    <span className="text-[13px] font-medium text-gray-700 whitespace-nowrap">{splitState.date ? format(new Date(splitState.date), 'dd.MM.yyyy') : 'Tarih Seçin'}</span>
                                  </div>
                                )}
                              />
                            </div>
                          </div>

                          {/* Split Payment Rows */}
                          <div className="bg-white rounded-lg border border-emerald-100 shadow-sm divide-y divide-gray-100">
                            {/* Nakit */}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center p-3 gap-3">
                              <div className="w-40 flex items-center gap-2 shrink-0">
                                <Banknote className="w-4 h-4 text-emerald-600" />
                                <span className="font-semibold text-gray-700 text-sm">Nakit</span>
                              </div>
                              <div className="flex-1 flex items-center gap-3 w-full">
                                <div className="w-32 shrink-0">
                                  <input type="text" placeholder="Tutar (₺)" value={splitState.cash.amount} onChange={(e) => updateSplit('cash', 'amount', e.target.value)} className={`${inputCls} text-right font-semibold`} />
                                </div>
                                <div className="w-56 shrink-0">
                                  <SelectDropdown placeholder="Kasa Seçin" value={splitState.cash.account_id ? String(splitState.cash.account_id) : ''} onChange={(v) => updateSplit('cash', 'account_id', v ? parseInt(v) : null)} options={cashRegisters.filter(r => r.type === 'cash' || r.type === 'general').map(r => ({ value: String(r.id), label: r.name }))} className="w-full shadow-sm text-[13px]" />
                                </div>
                                <div className="flex-1">
                                  <input type="text" placeholder="Açıklama..." value={splitState.cash.notes} onChange={(e) => updateSplit('cash', 'notes', e.target.value)} className={inputCls} />
                                </div>
                              </div>
                            </div>
                            
                            {/* Havale / EFT */}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center p-3 gap-3">
                              <div className="w-40 flex items-center gap-2 shrink-0">
                                <Landmark className="w-4 h-4 text-blue-600" />
                                <span className="font-semibold text-gray-700 text-sm">Havale / EFT</span>
                              </div>
                              <div className="flex-1 flex items-center gap-3 w-full">
                                <div className="w-32 shrink-0">
                                  <input type="text" placeholder="Tutar (₺)" value={splitState.bank_transfer.amount} onChange={(e) => updateSplit('bank_transfer', 'amount', e.target.value)} className={`${inputCls} text-right font-semibold`} />
                                </div>
                                <div className="w-56 shrink-0">
                                  <SelectDropdown placeholder="Banka Seçin" value={splitState.bank_transfer.account_id ? String(splitState.bank_transfer.account_id) : ''} onChange={(v) => updateSplit('bank_transfer', 'account_id', v ? parseInt(v) : null)} options={cashRegisters.filter(r => r.type === 'bank').map(r => ({ value: String(r.id), label: r.name }))} className="w-full shadow-sm text-[13px]" />
                                </div>
                                <div className="flex-1">
                                  <input type="text" placeholder="Açıklama..." value={splitState.bank_transfer.notes} onChange={(e) => updateSplit('bank_transfer', 'notes', e.target.value)} className={inputCls} />
                                </div>
                              </div>
                            </div>

                            {/* Kredi Kartı */}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center p-3 gap-3">
                              <div className="w-40 flex items-center gap-2 shrink-0">
                                <CreditCard className="w-4 h-4 text-purple-600" />
                                <span className="font-semibold text-gray-700 text-sm">K.Kartı / Mail Order</span>
                              </div>
                              <div className="flex-1 flex items-center gap-3 w-full">
                                <div className="w-32 shrink-0">
                                  <input type="text" placeholder="Tutar (₺)" value={splitState.credit_card.amount} onChange={(e) => updateSplit('credit_card', 'amount', e.target.value)} className={`${inputCls} text-right font-semibold`} />
                                </div>
                                <div className="w-56 shrink-0">
                                  <SelectDropdown placeholder="POS Seçin" value={splitState.credit_card.account_id ? String(splitState.credit_card.account_id) : ''} onChange={(v) => updateSplit('credit_card', 'account_id', v ? parseInt(v) : null)} options={cashRegisters.filter(r => r.type === 'pos').map(r => ({ value: String(r.id), label: r.name }))} className="w-full shadow-sm text-[13px]" />
                                </div>
                                <div className="flex-1">
                                  <input type="text" placeholder="Açıklama..." value={splitState.credit_card.notes} onChange={(e) => updateSplit('credit_card', 'notes', e.target.value)} className={inputCls} />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-full flex items-center p-4 bg-gray-50/30 border border-dashed border-gray-200 rounded-xl min-h-[72px]">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-white border border-gray-100 flex items-center justify-center shadow-sm">
                          <Wallet className="w-4 h-4 text-gray-400" />
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-gray-500">Ödeme işlemi yapılmayacaktır</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">Bu fatura için herhangi bir ödeme kaydı oluşturulmuyor.</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tedarikçi Notları - Moved below Payment Details */}
                  <div className="w-full">
                    <label className={labelCls}>Tedarikçi Notları</label>
                    <textarea
                      {...register('notes')}
                      rows={4}
                      placeholder="Fatura hakkında notlar..."
                      className="w-full text-sm border border-gray-100 rounded-lg p-2.5 resize-none focus:outline-none focus:border-gray-300 bg-gray-50/50 placeholder-gray-400"
                    />
                  </div>
                </div>

                {/* Right: Totals */}
                <div className="flex-shrink-0 flex flex-col gap-1.5" style={{ width: 'calc(110px + 80px + 120px + 40px + (3 * 0.75rem))' }}>
                  <div 
                    className="grid items-center text-sm text-gray-600 py-1"
                    style={{ gridTemplateColumns: '1fr 120px 40px', gap: '0.75rem' }}
                  >
                    <span className="text-right text-gray-400 font-medium whitespace-nowrap">Ara Toplam</span>
                    <span className="font-semibold text-right text-gray-800">₺{fmt(r2(totals.subtotal))}</span>
                    <span />
                  </div>
                  {totals.totalLineDiscount > 0.001 && (
                    <div 
                      className="grid items-center text-sm text-red-500 py-1 border-t border-gray-50"
                      style={{ gridTemplateColumns: '1fr 120px 40px', gap: '0.75rem' }}
                    >
                      <span className="text-right text-red-400 whitespace-nowrap">Toplam İskonto</span>
                      <span className="font-medium text-right">-₺{fmt(r2(totals.totalLineDiscount))}</span>
                      <span />
                    </div>
                  )}
                  {totals.totalKdv > 0.001 && (
                    <div 
                      className="grid items-center text-sm text-purple-600 py-1 border-t border-gray-50"
                      style={{ gridTemplateColumns: '1fr 120px 40px', gap: '0.75rem' }}
                    >
                      <span className="text-right text-purple-400 whitespace-nowrap">Toplam KDV</span>
                      <span className="font-semibold text-right">₺{fmt(r2(totals.totalKdv))}</span>
                      <span />
                    </div>
                  )}
                  {totals.totalOtv > 0.001 && (
                    <div 
                      className="grid items-center text-sm text-orange-500 py-1 border-t border-gray-50"
                      style={{ gridTemplateColumns: '1fr 120px 40px', gap: '0.75rem' }}
                    >
                      <span className="text-right text-orange-400 whitespace-nowrap">Toplam ÖTV</span>
                      <span className="font-medium text-right">₺{fmt(r2(totals.totalOtv))}</span>
                      <span />
                    </div>
                  )}
                  
                  {/* Genel Toplam */}
                  <div className="border-t-2 border-emerald-100 pt-3 mt-1">
                    <div className="grid items-center" style={{ gridTemplateColumns: '1fr 120px 40px', gap: '0.75rem' }}>
                      {/* Label block */}
                      <div className="flex items-center justify-end">
                        <span className="text-[15px] font-bold text-emerald-600 uppercase tracking-wider whitespace-nowrap">Genel Toplam</span>
                      </div>
                      
                      {/* Price cell */}
                      <span className="text-right text-[22px] font-bold text-emerald-600">₺{fmt(r2(totals.grandTotal))}</span>
                      <span />
                    </div>
                  </div>

                  {showPaymentFields && (
                    <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
                      <div 
                        className="grid items-center text-sm text-emerald-600 py-1"
                        style={{ gridTemplateColumns: '1fr 120px 40px', gap: '0.75rem' }}
                      >
                        <span className="text-right opacity-70 whitespace-nowrap">Ödenen</span>
                        <span className="font-medium text-right text-emerald-700">₺{fmt(r2(paidAmountNum))}</span>
                        <span />
                      </div>
                      {remainingDebt > 0.001 && (
                        <div 
                          className="grid items-center text-sm text-red-500 py-1"
                          style={{ gridTemplateColumns: '1fr 120px 40px', gap: '0.75rem' }}
                        >
                          <span className="text-right text-red-400 whitespace-nowrap">Kalan Borç</span>
                          <span className="font-bold text-right">₺{fmt(r2(remainingDebt))}</span>
                          <span />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN (sticky) ────────────────────────────────────── */}
          <div className="w-72 flex-shrink-0 sticky top-4 flex flex-col gap-3">

            {/* Supplier Card */}
            <div
              className="bg-white rounded-xl p-4"
              style={{ border: '1px solid rgba(229,231,235,0.8)' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <UserCircle className="w-4 h-4 text-[#5da83f]" />
                <span className="text-sm font-semibold text-gray-700">Tedarikçi Bilgileri</span>
              </div>

              {!supplier ? (
                <div className="flex flex-col items-center gap-2 py-6 text-gray-300 text-center">
                  <UserCircle className="w-12 h-12" />
                  <p className="text-sm font-medium text-gray-400">Tedarikçi Seçilmedi</p>
                  <p className="text-xs text-gray-300">Lütfen soldan tedarikçi seçiniz</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-base font-semibold text-gray-900">{supplier.name}</p>

                  {supplier.email && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <Mail className="w-3.5 h-3.5" />
                      <span>{supplier.email}</span>
                    </div>
                  )}
                  {supplier.phone && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <Phone className="w-3.5 h-3.5" />
                      <span>{supplier.phone}</span>
                    </div>
                  )}
                  {supplier.tax_number && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 font-mono">
                      <Hash className="w-3.5 h-3.5" />
                      <span>{supplier.tax_number}</span>
                    </div>
                  )}

                  <div className="border-t border-gray-100 pt-2 mt-2">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Cari Durum</p>
                    {supplier.balance > 0 ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-red-500">
                          ₺{fmt(r2(Math.abs(supplier.balance)))}
                        </span>
                        <span className="text-[10px] font-semibold bg-red-50 text-red-500 border border-red-100 px-1.5 py-0.5 rounded-full">
                          Borcumuz Var
                        </span>
                      </div>
                    ) : supplier.balance < 0 ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-emerald-600">
                          ₺{fmt(r2(Math.abs(supplier.balance)))}
                        </span>
                        <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100 px-1.5 py-0.5 rounded-full">
                          Alacaklıyız
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] font-semibold bg-gray-50 text-gray-400 border border-gray-100 px-1.5 py-0.5 rounded-full">
                        Bakiye Yok
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Category & Responsible Card */}
            <div
              className="bg-white rounded-xl p-4"
              style={{ border: '1px solid rgba(229,231,235,0.8)' }}
            >
              <div className="mb-3">
                <label className={labelCls}>Fatura Kategorisi</label>
                <div className="relative">
                  <select
                    {...register('category_id')}
                    disabled
                    className={`${inputCls} opacity-50 cursor-not-allowed appearance-none pr-8`}
                  >
                    <option value="">Kategori Seçiniz</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none" />
                </div>
                <p className="text-[10px] text-gray-300 mt-0.5">Gider kategorileri yakında eklenecek</p>
              </div>

              <div>
                <label className={labelCls}>Fatura Sorumlusu (Plasiyer)</label>
                <div className="relative">
                  <select
                    {...register('responsible_user_id')}
                    className={`${inputCls} appearance-none pr-8`}
                  >
                    <option value="">Sorumlu Seçiniz</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Quick Create Supplier Modal */}
      <QuickCreateSupplierModal
        isOpen={showQuickCreateSupplier}
        onClose={() => setShowQuickCreateSupplier(false)}
        onCreated={(newSupplier) => setSupplier(newSupplier)}
      />
    </FormProvider>
  );
};
