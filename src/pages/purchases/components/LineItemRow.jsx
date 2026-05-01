import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useFormContext, useWatch, Controller } from 'react-hook-form';
import { Trash2, Package, Search, X } from 'lucide-react';
import { productService } from '../../../services/productService';
import { calcLine, r2 } from '../../../utils/purchaseMath';
import { formatTRPrice, parseTRPrice } from '../../../utils/trPriceParser';

const UNITS = ['Adet', 'Kg', 'Gram', 'Litre', 'ml', 'Metre', 'Paket', 'Kutu', 'Çift'];
const KDV_OPTIONS = [0, 1, 10, 20];
const OTV_OPTIONS = [0, 25, 45, 50, 60, 80];

const fmt = formatTRPrice;

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export const LineItemRow = ({ index, field, onRemove, canRemove, isLast, onTabFromLast }) => {
  const { register, control, setValue, getValues } = useFormContext();

  /* ── watched values for live calc ─────────────────────────────────────── */
  const watched = useWatch({ control, name: `items.${index}` });

  const calc = calcLine({
    quantity:       watched?.quantity       || 0,
    unit_price:     watched?.unit_price     || 0,
    discount_type:  watched?.discount_type  || 'percent',
    discount_value: watched?.discount_value || 0,
    kdv_rate:       watched?.kdv_rate       || 0,
    otv_rate:       watched?.otv_rate       || 0,
  });

  /* ── product search state ────────────────────────────────────────────── */
  const [searchQuery, setSearchQuery] = useState(watched?.name || '');
  const [searchResults, setSearchResults] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [isNewProduct, setIsNewProduct] = useState(watched?.isNewProduct || false);
  const [productSelected, setProductSelected] = useState(!!(watched?.product_id));

  const searchRef   = useRef(null);
  const dropdownRef = useRef(null);
  const priceRef    = useRef(null);
  const qtyRef      = useRef(null);

  const debouncedQuery = useDebounce(searchQuery, 200);

  /* ── search execution ────────────────────────────────────────────────── */
  useEffect(() => {
    if (!debouncedQuery.trim() || productSelected) {
      setSearchResults([]);
      setDropdownOpen(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    productService.getAll({ search: debouncedQuery }).then(data => {
      if (cancelled) return;
      const sliced = (data || []).slice(0, 10);
      setSearchResults(sliced);
      setDropdownOpen(true);
      setIsNewProduct(sliced.length === 0 && debouncedQuery.trim().length > 0);
      setValue(`items.${index}.isNewProduct`, sliced.length === 0 && debouncedQuery.trim().length > 0);
    }).catch(() => {}).finally(() => { if (!cancelled) setSearching(false); });
    return () => { cancelled = true; };
  }, [debouncedQuery, productSelected, index, setValue]);

  /* ── click outside to close dropdown ────────────────────────────────── */
  useEffect(() => {
    const handler = (e) => {
      if (!dropdownRef.current?.contains(e.target) && !searchRef.current?.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ── select existing product ─────────────────────────────────────────── */
  const selectProduct = useCallback((product) => {
    setSearchQuery(product.name);
    setDropdownOpen(false);
    setProductSelected(true);
    setIsNewProduct(false);
    setValue(`items.${index}.product_id`,     product.id,                    { shouldDirty: true });
    setValue(`items.${index}.name`,           product.name,                  { shouldDirty: true });
    setValue(`items.${index}.barcode`,        product.barcode || '',          { shouldDirty: true });
    setValue(`items.${index}.stock_quantity`, product.stock_quantity || 0,    { shouldDirty: true });
    setValue(`items.${index}.unit`,           product.unit || 'Adet',        { shouldDirty: true });
    setValue(`items.${index}.unit_price`,     product.purchase_price || 0,   { shouldDirty: true });
    setValue(`items.${index}.kdv_rate`,       product.tax_rate || 0,         { shouldDirty: true });
    setValue(`items.${index}.quantity`,       1,                             { shouldDirty: true });
    setValue(`items.${index}.isNewProduct`,   false);

    // Update price input display
    if (priceRef.current) {
      priceRef.current.value = fmt(product.purchase_price || 0);
    }
    // Focus quantity after selection
    setTimeout(() => qtyRef.current?.focus(), 50);
  }, [index, setValue]);

  /* ── clear product selection ─────────────────────────────────────────── */
  const clearProduct = useCallback(() => {
    setSearchQuery('');
    setProductSelected(false);
    setIsNewProduct(false);
    setValue(`items.${index}.product_id`, null);
    setValue(`items.${index}.name`, '');
    setValue(`items.${index}.isNewProduct`, false);
    setTimeout(() => searchRef.current?.focus(), 50);
  }, [index, setValue]);

  /* ── sync name to searchQuery when typing (new product) ─────────────── */
  const handleSearchChange = useCallback((e) => {
    const val = e.target.value;
    setSearchQuery(val);
    setProductSelected(false);
    setValue(`items.${index}.name`, val, { shouldDirty: true });
    setValue(`items.${index}.product_id`, null);
  }, [index, setValue]);

  /* ── price input: TR format ──────────────────────────────────────────── */
  const handlePriceChange = useCallback((e) => {
    const raw = e.target.value;
    const float = parseTRPrice(raw);
    setValue(`items.${index}.unit_price`, float, { shouldDirty: true });
  }, [index, setValue]);

  const handlePriceBlur = useCallback(() => {
    const val = getValues(`items.${index}.unit_price`) || 0;
    if (priceRef.current) priceRef.current.value = fmt(val);
  }, [index, getValues]);

  /* ── Tab from last input: add new row ────────────────────────────────── */
  const handleLineTotalKeyDown = useCallback((e) => {
    if (e.key === 'Tab' && !e.shiftKey && isLast) {
      e.preventDefault();
      onTabFromLast?.();
    }
  }, [isLast, onTabFromLast]);

  /* ── discount type toggle ────────────────────────────────────────────── */
  const discountType = watched?.discount_type || 'percent';

  return (
    <div
      className="grid items-center py-2 border-b border-gray-50 group hover:bg-gray-50/40 transition-colors"
      style={{ gridTemplateColumns: '1fr 75px 90px 110px 110px 80px 120px 40px', gap: '0.75rem' }}
    >
      {/* ── Product Search ──────────────────────────────────────────────── */}
      <div className="relative" ref={dropdownRef}>
        {productSelected ? (
          <div className="flex flex-col h-[42px] px-3 bg-emerald-50/40 border border-emerald-100 rounded-lg group/prod relative justify-center">
            <div className="flex items-center gap-2">
              <Package className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="flex-1 text-sm font-semibold text-gray-800 truncate min-w-0 pr-6">
                {watched?.name}
              </span>
            </div>
            {(watched?.barcode || watched?.stock_quantity !== undefined) && (
              <div className="flex items-center gap-2 mt-[1px] ml-5.5 leading-none">
                {watched?.barcode && (
                  <span className="text-[10px] text-gray-400 font-mono">
                    Barkod: {watched.barcode}
                  </span>
                )}
                {watched?.barcode && watched?.stock_quantity !== undefined && (
                  <span className="text-[10px] text-gray-300">|</span>
                )}
                {watched?.stock_quantity !== undefined && (
                  <span className="text-[10px] text-gray-400">
                    Stok: {watched.stock_quantity}
                  </span>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={clearProduct}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300 pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => searchResults.length > 0 && setDropdownOpen(true)}
              placeholder="Ürün veya hizmet ara..."
              className="w-full pl-7 pr-16 h-[42px] text-sm bg-transparent border border-gray-200 rounded-lg focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100 outline-none placeholder-gray-300 transition-colors"
            />
            {/* New product badge */}
            {isNewProduct && searchQuery.trim() && (
              <span
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ background: '#fef3c7', color: '#b45309' }}
              >
                Yeni Ürün
              </span>
            )}
            {searching && !isNewProduct && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            )}
          </div>
        )}

        {/* Dropdown */}
        {dropdownOpen && searchResults.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden max-h-56 overflow-y-auto"
          >
            {searchResults.map(p => (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); selectProduct(p); }}
                className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-emerald-50 text-left border-b border-gray-50 last:border-0 transition-colors"
              >
                <Package className="w-3 h-3 text-emerald-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                  {p.barcode && (
                    <p className="text-[10px] font-mono text-gray-400">{p.barcode}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold text-gray-700">₺{fmt(p.purchase_price)}</p>
                  <p className="text-[10px] text-gray-400">Stok: {p.stock_quantity ?? 0}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Quantity ───────────────────────────────────────────────────── */}
      <input
        ref={qtyRef}
        type="number"
        min="0.001"
        step="0.001"
        {...register(`items.${index}.quantity`, { valueAsNumber: true, min: 0.001 })}
        className="text-center text-sm font-semibold h-[42px] px-3 rounded-lg border border-gray-200 bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-100 outline-none w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-all"
      />

      {/* ── Unit ───────────────────────────────────────────────────────── */}
      <Controller
        control={control}
        name={`items.${index}.unit`}
        render={({ field }) => (
          <select
            {...field}
            className="text-sm font-semibold h-[42px] px-3 rounded-lg border border-gray-200 bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-100 outline-none w-full cursor-pointer text-gray-700 transition-all text-center"
          >
            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        )}
      />

      {/* ── Unit Price ──────────────────────────────────────────────────── */}
      <div>
        <input
          ref={priceRef}
          type="text"
          defaultValue={watched?.unit_price ? fmt(watched.unit_price) : ""}
          onChange={handlePriceChange}
          onBlur={handlePriceBlur}
          placeholder="Birim Fiyat"
          className="text-center text-sm font-semibold h-[42px] px-3 rounded-lg border border-gray-200 bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-100 outline-none w-full transition-all"
        />
      </div>

      {/* ── Discount ────────────────────────────────────────────────────── */}
      <div className="flex items-center">
        <div className="relative w-full h-[42px] flex items-center border border-gray-200 bg-white rounded-lg focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-100 transition-all overflow-hidden">
          <button
            type="button"
            onClick={() => {
              const next = discountType === 'amount' ? 'percent' : 'amount';
              setValue(`items.${index}.discount_type`, next, { shouldDirty: true });
              setValue(`items.${index}.discount_value`, 0, { shouldDirty: true });
            }}
            className="flex-shrink-0 w-8 h-full text-[10px] font-bold text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-center border-r border-gray-200"
          >
            {discountType === 'amount' ? '₺' : '%'}
          </button>
          <input
            type="number"
            min="0"
            step="0.01"
            {...register(`items.${index}.discount_value`, { valueAsNumber: true })}
            className="flex-1 text-center text-sm font-semibold px-3 h-full bg-transparent outline-none w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
      </div>

      {/* ── KDV % ───────────────────────────────────────────────────────── */}
      <Controller
        control={control}
        name={`items.${index}.kdv_rate`}
        render={({ field }) => (
          <select
            {...field}
            onChange={e => field.onChange(parseInt(e.target.value))}
            className="text-sm font-semibold h-[42px] px-3 rounded-lg border border-gray-200 bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-100 outline-none w-full cursor-pointer text-gray-700 transition-all text-center"
          >
            {KDV_OPTIONS.map(r => <option key={r} value={r}>%{r}</option>)}
          </select>
        )}
      />



      {/* ── Line Total ─────────────────────────────────────────────────── */}
      <div
        className="text-right outline-none flex flex-col justify-center h-[42px] items-end"
        tabIndex={0}
        onKeyDown={handleLineTotalKeyDown}
      >
        <span className="text-sm font-semibold text-gray-800">
          ₺{fmt(r2(calc.lineTotal))}
        </span>
        {calc.kdvAmount > 0 && (
          <p className="text-[10px] text-gray-400">KDV ₺{fmt(r2(calc.kdvAmount))}</p>
        )}
      </div>

      {/* ── Delete ──────────────────────────────────────────────────────── */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-500 disabled:pointer-events-none disabled:opacity-0"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
