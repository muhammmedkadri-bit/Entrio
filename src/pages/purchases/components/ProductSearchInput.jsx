import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Barcode, Package } from 'lucide-react';
import { productService } from '../../../services/productService';

const fmt = (v) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);

export const ProductSearchInput = ({ onSelect, disabled }) => {
  const [query, setQuery]         = useState('');
  const [results, setResults]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [open, setOpen]           = useState(false);
  const [barcodeMode, setBarcodeMode] = useState(false);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Focus via F2
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'F2') { e.preventDefault(); inputRef.current?.focus(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Click outside to close
  useEffect(() => {
    const handler = (e) => {
      if (!dropdownRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim() || barcodeMode) { setResults([]); setOpen(false); return; }
    const timer = setTimeout(async () => {
      if (query.trim().length < 2) return;
      setLoading(true);
      try {
        const data = await productService.getAll({ search: query });
        setResults(data.slice(0, 12));
        setOpen(data.length > 0);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 200);
    return () => clearTimeout(timer);
  }, [query, barcodeMode]);

  const handleKeyDown = useCallback(async (e) => {
    if (e.key === 'Enter' && query.trim()) {
      e.preventDefault();
      // Try barcode exact match
      const byBarcode = await productService.getByBarcode(query.trim());
      if (byBarcode) {
        handleSelect(byBarcode);
      } else if (results.length > 0) {
        handleSelect(results[0]);
      }
    }
    if (e.key === 'Escape') { setOpen(false); setQuery(''); }
  }, [query, results]);

  const handleSelect = (product) => {
    onSelect(product);
    setQuery('');
    setResults([]);
    setOpen(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => results.length > 0 && setOpen(true)}
            disabled={disabled}
            placeholder={barcodeMode ? 'Barkod okutun veya yazın, Enter ile ekleyin...' : 'Ürün adı ile arayın veya barkod yazın (F2)'}
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-lg border border-gray-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all bg-white/80 shadow-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => { setBarcodeMode(b => !b); setQuery(''); inputRef.current?.focus(); }}
          className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-semibold border transition-all ${
            barcodeMode
              ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
              : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
          }`}
        >
          <Barcode className="w-3.5 h-3.5" />
          Barkod
        </button>
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-72 overflow-y-auto">
          {loading && (
            <div className="px-4 py-2 text-xs text-gray-400 text-center">Aranıyor...</div>
          )}
          {results.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSelect(p)}
              className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-emerald-50 transition-colors text-left border-b border-gray-50 last:border-0"
            >
              <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                <Package className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                <p className="text-[10px] text-gray-400 font-mono">{p.barcode || '—'}</p>
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
  );
};
