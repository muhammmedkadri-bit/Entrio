import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * Tema uyumlu filtre chip dropdown bileşeni.
 * py-2.5 ile diğer toolbar butonlarıyla piksel-mükemmel hizalı.
 * Tarayıcı native select yerine özel açılır panel kullanır.
 */
export const FilterChipDropdown = ({
  icon: Icon,
  label,
  value,
  options = [],
  onChange,
  onClear,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find((o) => o.id === value);

  return (
    <div className="relative" ref={ref}>
      {/* Chip row: label button + clear button */}
      <div className="flex items-center bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 pl-3 pr-2 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          {Icon && <Icon className="w-4 h-4 text-slate-400 shrink-0" />}
          <span className="whitespace-nowrap">{selected ? selected.label : label}</span>
        </button>

        <button
          type="button"
          onClick={onClear}
          className="px-2 py-2.5 text-slate-400 hover:text-red-500 transition-colors border-l border-slate-200"
          title="Filtreyi Kaldır"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 min-w-[180px] bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden py-1">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                onChange(opt.id);
                setOpen(false);
              }}
              className="w-full px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between gap-4 transition-colors"
            >
              <span>{opt.label}</span>
              {value === opt.id && (
                <span className="text-[#5da83f] font-bold text-xs">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
