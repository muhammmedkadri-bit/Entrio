import React, { useState, useEffect, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import {
  ArrowLeft, Save, PackagePlus, Package, Hash, ScanBarcode,
  LayoutGrid, Box, BadgeDollarSign, ShoppingCart, BadgeMinus,
  TrendingDown, Barcode, Plus, Check, X, PackageCheck, PackageX
} from 'lucide-react';
import toast from '../../../components/ui/CustomToast';
import { productService } from '../../../services/productService';
import { categoryService } from '../../../services/categoryService';

// ── EAN-13 generator ──────────────────────────────────────────────────────────
const generateEAN13 = () => {
  const prefix = '200';
  const rnd = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
  const code12 = prefix + rnd;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(code12[i], 10) * (i % 2 === 0 ? 1 : 3);
  return code12 + ((10 - (sum % 10)) % 10);
};

const formatCurrency = (v) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(parseFloat(v) || 0);

const DEFAULT_UNITS = ['Adet', 'Kg', 'Gram', 'Litre', 'ml', 'Metre', 'Paket', 'Kutu'];
const UNITS_KEY = 'entrio_custom_units';
const loadUnits = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(UNITS_KEY) || '[]');
    const merged = [...DEFAULT_UNITS];
    saved.forEach(u => { if (!merged.includes(u)) merged.push(u); });
    return merged;
  } catch { return DEFAULT_UNITS; }
};
const saveUnit = (u) => {
  try {
    const saved = JSON.parse(localStorage.getItem(UNITS_KEY) || '[]');
    if (!saved.includes(u)) { saved.push(u); localStorage.setItem(UNITS_KEY, JSON.stringify(saved)); }
  } catch {}
};

// ── Inline select dropdown ─────────────────────────────────────────────────────
const InlineSelect = ({ value, onChange, options, placeholder, addLabel, onAdd }) => {
  const [open, setOpen]       = useState(false);
  const [adding, setAdding]   = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving]   = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false); setAdding(false); setNewName(''); setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const selectedLabel = options.find(o => String(o.id) === String(value))?.label;
  const filteredOptions = options.filter(opt => opt.id === '' || opt.label.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const added = await onAdd(newName.trim());
      onChange(added.id);
      setAdding(false); setNewName(''); setOpen(false); setSearchQuery('');
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const inputCls = 'w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400 transition-all';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium transition-all hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400"
      >
        <span className={selectedLabel ? 'text-slate-800' : 'text-slate-400'}>
          {selectedLabel || placeholder}
        </span>
        <svg className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-[300] w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden flex flex-col max-h-64">
          <div className="p-2 border-b border-slate-100 shrink-0">
            <input
              type="text"
              autoFocus
              placeholder="Ara..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-2.5 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {filteredOptions.map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => { onChange(opt.id); setOpen(false); setSearchQuery(''); }}
                className="w-full px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between gap-2 transition-colors"
              >
                <span>{opt.label}</span>
                {String(opt.id) === String(value) && (
                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                )}
              </button>
            ))}
            {filteredOptions.length === 0 && (
              <p className="px-3 py-3 text-xs text-slate-400 text-center">Sonuç bulunamadı</p>
            )}
          </div>
          <div className="border-t border-slate-100 p-2">
            {!adding ? (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                {addLabel}
              </button>
            ) : (
              <div className="flex gap-1.5">
                <input
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); handleAdd(); }
                    if (e.key === 'Escape') { setAdding(false); setNewName(''); }
                  }}
                  className="flex-1 px-2 py-1.5 text-sm border border-emerald-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400 min-w-0"
                  placeholder="İsim girin..."
                />
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={saving || !newName.trim()}
                  className="px-2.5 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-600 disabled:opacity-40 transition-colors shrink-0"
                >
                  {saving ? '…' : 'Ekle'}
                </button>
                <button
                  type="button"
                  onClick={() => { setAdding(false); setNewName(''); }}
                  className="px-2 py-1.5 bg-slate-100 text-slate-500 rounded-lg text-xs hover:bg-slate-200 transition-colors shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────
export const QuickCreateProductForm = ({ searchQuery, onClose, onAddProduct, hasEmptySlot, initialBarcode = '' }) => {
  const [categories, setCategories] = useState([]);
  const [units, setUnits]           = useState(loadUnits);
  const [loading, setLoading]       = useState(false);
  const [trackStock, setTrackStock] = useState(true);
  const [categoryId, setCategoryId] = useState('');
  const [unit, setUnit]             = useState('Adet');

  const { register, handleSubmit, setValue, control, formState: { errors } } = useForm({
    defaultValues: {
      name: searchQuery || '',
      sku: '', barcode: '',
      purchase_price: 0, sale_price: 0,
      tax_rate: 20, stock_quantity: 0, min_stock_level: 5,
    },
  });

  const watchPurchase = useWatch({ control, name: 'purchase_price', defaultValue: 0 });
  const watchSale     = useWatch({ control, name: 'sale_price', defaultValue: 0 });
  const watchTax      = useWatch({ control, name: 'tax_rate', defaultValue: 20 });

  const loadCategories = () =>
    categoryService.getAll().then(setCategories).catch(() => toast.error('Kategoriler yüklenemedi'));

  useEffect(() => { loadCategories(); }, []);

  // Pre-fill barcode when triggered from a scanner scan
  useEffect(() => {
    if (initialBarcode) {
      setValue('barcode', initialBarcode);
    }
  }, [initialBarcode, setValue]);

  const handleAddCategory = async (name) => {
    const id = await categoryService.create({ name, parent_id: null });
    await loadCategories();
    toast.success(`"${name}" kategorisi eklendi.`);
    return { id: String(id), label: name };
  };

  const handleAddUnit = async (name) => {
    setUnits(prev => prev.includes(name) ? prev : [...prev, name]);
    saveUnit(name);
    toast.success(`"${name}" birimi eklendi.`);
    return { id: name, label: name };
  };

  const handleBarcodeGenerate = (e) => {
    e.preventDefault();
    setValue('barcode', generateEAN13());
    toast.success('Barkod üretildi.');
  };

  const onSubmit = async (formData, mode) => {
    setLoading(true);
    try {
      const payload = {
        name: formData.name,
        barcode: formData.barcode || null,
        category_id: categoryId ? parseInt(categoryId) : null,
        supplier_id: null,
        unit,
        track_stock: trackStock,
        purchase_price: parseFloat(formData.purchase_price) || 0,
        sale_price:     parseFloat(formData.sale_price) || 0,
        tax_rate:       parseFloat(formData.tax_rate) || 20,
        stock_quantity: trackStock ? (parseFloat(formData.stock_quantity) || 0) : 0,
        min_stock_level: trackStock ? (parseFloat(formData.min_stock_level) || 0) : 0,
        is_active: true,
      };

      const newProduct = await productService.create(payload);
      toast.success(`${payload.name} başarıyla oluşturuldu`);

      if (mode === 'add' && hasEmptySlot) {
        // newProduct is the full created object from Supabase
        onAddProduct(newProduct);
      } else {
        onClose();
      }
    } catch (err) {
      toast.error(err.message || 'Ürün oluşturulurken hata oluştu');
    } finally { setLoading(false); }
  };

  // Calculated margins
  const cost      = parseFloat(watchPurchase) || 0;
  const price     = parseFloat(watchSale) || 0;
  const taxRate   = parseFloat(watchTax) || 0;
  const taxAmount = price * (taxRate / 100);
  const netSale   = price - taxAmount;
  const marginAmt = netSale - cost;
  const marginPct = cost > 0 ? (marginAmt / cost) * 100 : 0;

  const inputCls = 'w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400 transition-all';
  const labelCls = 'flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-1';

  const categoryOptions = categories.map(c => ({ id: String(c.id), label: c.name }));
  const unitOptions     = units.map(u => ({ id: u, label: u }));

  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-white flex-shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors active:scale-95"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Aramaya Dön
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-50 border border-emerald-100">
            <Package className="w-4 h-4 text-emerald-500" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Hızlı Ürün Oluştur</h2>
        </div>
      </div>

      {/* Form Body */}
      <form className="flex flex-col flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">

          {/* Ürün Adı */}
          <div>
            <label className={labelCls}><Package className="w-4 h-4 text-slate-400" /> Ürün Adı <span className="text-rose-500">*</span></label>
            <input
              autoFocus type="text"
              {...register('name', { required: 'Ürün adı zorunludur' })}
              className={`${inputCls} ${errors.name ? '!border-rose-400 !ring-rose-400/50' : ''}`}
              placeholder="Örn: Vavana Lavanta Klima Kokusu"
            />
            {errors.name && <p className="text-xs text-rose-500 mt-1">{errors.name.message}</p>}
          </div>

          {/* SKU + Barkod */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}><Hash className="w-4 h-4 text-slate-400" /> Stok Kodu (SKU)</label>
              <input type="text" {...register('sku')} placeholder="Opsiyonel" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}><ScanBarcode className="w-4 h-4 text-slate-400" /> Barkod</label>
              <div className="flex gap-2">
                <input type="text" {...register('barcode')} placeholder="Otomatik üretilir"
                  className={`${inputCls} flex-1`} />
                <button type="button" onClick={handleBarcodeGenerate}
                  className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-all active:scale-95"
                  title="EAN-13 Otomatik Üret">
                  <Barcode className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Kategori + Birim */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}><LayoutGrid className="w-4 h-4 text-slate-400" /> Kategori</label>
              <InlineSelect
                value={categoryId}
                onChange={setCategoryId}
                options={[{ id: '', label: 'Seçiniz...' }, ...categoryOptions]}
                placeholder="Seçiniz..."
                addLabel="Yeni Kategori Ekle"
                onAdd={handleAddCategory}
              />
            </div>
            <div>
              <label className={labelCls}><Box className="w-4 h-4 text-slate-400" /> Birim</label>
              <InlineSelect
                value={unit}
                onChange={setUnit}
                options={unitOptions}
                placeholder="Adet"
                addLabel="Yeni Birim Ekle"
                onAdd={handleAddUnit}
              />
            </div>
          </div>

          {/* Stok Takibi */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={`${labelCls} !mb-0`}>
                <PackageCheck className="w-4 h-4 text-slate-400" /> Stok Takibi
              </label>
            </div>
            <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setTrackStock(true)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
                  trackStock ? 'bg-white text-emerald-600 shadow-sm border border-black/5' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <PackageCheck className="w-3.5 h-3.5" /> Takip Edilsin
              </button>
              <button
                type="button"
                onClick={() => setTrackStock(false)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
                  !trackStock ? 'bg-white text-slate-600 shadow-sm border border-black/5' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <PackageX className="w-3.5 h-3.5" /> Takip Edilmesin
              </button>
            </div>
            {!trackStock && (
              <p className="text-xs text-slate-400 mt-1.5">Bu ürün satıldığında stok miktarı değişmeyecek.</p>
            )}
          </div>

          {/* Başlangıç Stoğu + Min. Stok */}
          {trackStock && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}><TrendingDown className="w-4 h-4 text-slate-400" /> Başlangıç Stoğu</label>
                <input type="number" step="0.001" {...register('stock_quantity')} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}><TrendingDown className="w-4 h-4 text-slate-400" /> Kritik Stok Seviyesi</label>
                <input type="number" step="0.001" {...register('min_stock_level')} className={inputCls} />
              </div>
            </div>
          )}

          {/* Alış + Satış + KDV */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}><ShoppingCart className="w-4 h-4 text-slate-400" /> Alış Fiyatı (₺)</label>
              <input type="number" step="0.01" min="0" {...register('purchase_price')} className={inputCls} placeholder="0.00" />
            </div>
            <div>
              <label className={`${labelCls} text-emerald-700`}>
                <BadgeDollarSign className="w-4 h-4 text-emerald-500" /> Satış Fiyatı (₺) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500 font-bold text-sm select-none">₺</span>
                <input
                  type="number" step="0.01" min="0"
                  {...register('sale_price', { required: 'Satış fiyatı zorunludur' })}
                  className={`${inputCls} pl-7 font-bold text-emerald-700 !border-emerald-200 focus:!border-emerald-400 !bg-emerald-50/50`}
                  placeholder="0.00"
                />
              </div>
              {errors.sale_price && <p className="text-xs text-rose-500 mt-1">{errors.sale_price.message}</p>}
            </div>
            <div>
              <label className={labelCls}><BadgeMinus className="w-4 h-4 text-slate-400" /> KDV Oranı (%)</label>
              <select {...register('tax_rate')} className={inputCls}>
                {[0, 1, 10, 20].map(tx => <option key={tx} value={tx}>%{tx}</option>)}
              </select>
            </div>
          </div>

          {/* Net Kar / Marjı / KDV Dahil */}
          <div className="bg-brand-50/50 rounded-xl p-4 border border-brand-100 grid grid-cols-3 divide-x divide-brand-100">
            <div className="text-center pr-4">
              <span className="block text-[10px] uppercase text-brand-400 font-bold tracking-wider mb-1">Net Kar</span>
              <span className={`text-base font-bold ${marginAmt >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {formatCurrency(marginAmt)}
              </span>
            </div>
            <div className="text-center px-4">
              <span className="block text-[10px] uppercase text-brand-400 font-bold tracking-wider mb-1">Kar Marjı</span>
              <span className={`text-base font-bold ${marginPct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                %{marginPct.toFixed(1)}
              </span>
            </div>
            <div className="text-center pl-4">
              <span className="block text-[10px] uppercase text-brand-400 font-bold tracking-wider mb-1">KDV Dahil Satış</span>
              <span className="text-base font-bold text-slate-800">{formatCurrency(price)}</span>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-4 sm:px-5 py-4 pb-24 sm:pb-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
          <div className="flex gap-2.5 w-full sm:w-auto">
            <button type="button" onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 shadow-sm active:scale-95 transition-all">
              İptal
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleSubmit((d) => onSubmit(d, 'save_only'))}
              className="flex-[1.5] sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 shadow-sm active:scale-95 transition-all disabled:opacity-60"
            >
              <Save className="w-4 h-4 shrink-0" /> <span className="whitespace-nowrap truncate">Sadece Kaydet</span>
            </button>
          </div>
          <button
            type="button"
            disabled={loading || !hasEmptySlot}
            onClick={handleSubmit((d) => onSubmit(d, 'add'))}
            title={!hasEmptySlot ? 'Hızlı ürün kartlarında boş yer yok' : ''}
            className={`w-full sm:w-auto flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 ${
              hasEmptySlot
                ? 'text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100'
                : 'text-slate-400 bg-slate-100 border border-slate-200 cursor-not-allowed opacity-60'
            }`}
          >
            <PackagePlus className="w-4 h-4 shrink-0" /> <span className="whitespace-nowrap truncate">Kaydet ve Listeye Ekle</span>
          </button>
        </div>
      </form>
    </div>
  );
};
