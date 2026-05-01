import React, { useState, useEffect } from 'react';

const denominations = [
  { value: 200, label: '200₺', color: 'bg-brand-100 text-brand-700' },
  { value: 100, label: '100₺', color: 'bg-blue-100 text-blue-700' },
  { value: 50, label: '50₺', color: 'bg-orange-100 text-orange-700' },
  { value: 20, label: '20₺', color: 'bg-green-100 text-green-700' },
  { value: 10, label: '10₺', color: 'bg-red-100 text-red-700' },
  { value: 5, label: '5₺', color: 'bg-stone-200 text-stone-700' },
  { value: 1, label: '1₺', color: 'bg-slate-200 text-slate-700' },
  { value: 0.5, label: '0.50₺', color: 'bg-slate-100 text-slate-600' },
  { value: 0.25, label: '0.25₺', color: 'bg-slate-100 text-slate-600' }
];

export const DenominationCounter = ({ onChange }) => {
  const [counts, setCounts] = useState(() => {
    const init = {};
    denominations.forEach(d => init[d.value] = '');
    return init;
  });

  const [total, setTotal] = useState(0);

  useEffect(() => {
    let sum = 0;
    Object.keys(counts).forEach(val => {
      const count = parseInt(counts[val]) || 0;
      sum += parseFloat(val) * count;
    });
    setTotal(sum);
    if (onChange) onChange(sum);
  }, [counts]);

  const handleChange = (val, ev) => {
    setCounts(prev => ({ ...prev, [val]: ev.target.value }));
  };

  const formatCurrency = (amount) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount);

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 hide-on-print">
      <h4 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider">Detaylı Kasa Sayımı</h4>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
        {denominations.map(d => {
          const count = parseInt(counts[d.value]) || 0;
          const rowTotal = count * d.value;
          
          return (
            <div key={d.value} className="flex items-center gap-3">
              <div className={`w-14 h-8 flex items-center justify-center rounded font-bold text-sm ${d.color}`}>
                {d.label}
              </div>
              <span className="text-slate-400 text-sm font-bold">X</span>
              <input 
                type="number" 
                min="0" 
                placeholder="0"
                className="w-16 px-2 py-1 h-8 text-center text-sm border border-slate-300 rounded focus:ring-2 focus:ring-brand-500 font-bold"
                value={counts[d.value]}
                onChange={(e) => handleChange(d.value, e)}
              />
              <span className="text-slate-400 text-sm font-bold">=</span>
              <div className="w-20 text-right font-bold text-slate-700 text-sm">
                {rowTotal > 0 ? formatCurrency(rowTotal) : '-'}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center">
        <span className="text-slate-500 font-bold uppercase tracking-widest text-sm">Sayım Toplamı</span>
        <span className="text-2xl font-black text-brand-700 bg-brand-50 px-3 py-1 rounded-lg border border-brand-100">
          {formatCurrency(total)}
        </span>
      </div>
    </div>
  );
};
