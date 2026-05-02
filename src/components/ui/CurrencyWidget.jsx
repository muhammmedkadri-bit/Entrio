import React, { useState, useEffect, useCallback } from 'react';
import { DollarSign, Euro, PoundSterling, Coins, LineChart } from 'lucide-react';

const CURRENCIES = [
  { key: 'USD', label: 'Dolar',   Icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-100' },
  { key: 'EUR', label: 'Euro',    Icon: Euro, color: 'text-blue-600', bg: 'bg-blue-100' },
  { key: 'GBP', label: 'Sterlin', Icon: PoundSterling, color: 'text-purple-600', bg: 'bg-purple-100' },
];

// Gold bar custom SVG since lucide doesn't have a specific gold ingot
const GoldBarIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M4 14l3.5-6h9l3.5 6H4zM4.5 15h15l1.5 3H3l1.5-3z" />
  </svg>
);

const GOLD = { key: 'GA', label: 'Gram Altın', Icon: GoldBarIcon, color: 'text-yellow-600', bg: 'bg-yellow-100' };

const fmt = (v) =>
  Number(v).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const CurrencyWidget = () => {
  const [rates, setRates]           = useState({});
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(false);
  const [calcAmount, setCalcAmount] = useState('');
  const [calcCurrency, setCalcCurrency] = useState('USD');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const fetchAll = useCallback(async () => {
    setError(false);
    try {
      const [dovizRes, altinRes] = await Promise.all([
        fetch('https://api.genelpara.com/json/?list=doviz&sembol=USD,EUR,GBP'),
        fetch('https://api.genelpara.com/json/?list=altin&sembol=GA'),
      ]);

      if (!dovizRes.ok || !altinRes.ok) throw new Error('API error');

      const [doviz, altin] = await Promise.all([dovizRes.json(), altinRes.json()]);

      // API returns data in .data property
      const merged = { ...(doviz?.data || {}), ...(altin?.data || {}) };
      setRates(merged);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(() => fetchAll(), 15 * 60_000); // refresh every 15 mins
    return () => clearInterval(interval);
  }, []); // eslint-disable-line

  const allItems = [...CURRENCIES, GOLD];
  const selectedRate = rates[calcCurrency]?.satis || 0;
  const calcResult = calcAmount ? (parseFloat(calcAmount) * parseFloat(selectedRate)) : 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[340px]">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LineChart className="w-5 h-5" style={{ color: '#7ed957' }} />
          <h3 className="font-bold text-slate-800 text-sm">Canlı Piyasalar</h3>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col divide-y divide-slate-100">
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-8">
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-[#7ed957]/30 border-t-[#7ed957] rounded-full animate-spin" />
              <span className="text-xs text-slate-400">Yükleniyor...</span>
            </div>
          </div>
        ) : error && Object.keys(rates).length === 0 ? (
          <div className="flex-1 flex items-center justify-center flex-col gap-2 text-slate-400 py-8">
            <span className="text-xs">Bağlantı hatası</span>
            <button
              onClick={() => fetchAll()}
              className="text-xs text-[#7ed957] font-semibold hover:underline"
            >
              Tekrar dene
            </button>
          </div>
        ) : (
          allItems.map((item) => {
            const data   = rates[item.key];
            const satis  = data?.satis ?? '—';
            const alis   = data?.alis  ?? '—';

            return (
              <div key={item.key} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50/80 transition-colors group">
                {/* Icon */}
                <div className={`w-8 h-8 rounded-lg ${item.bg} flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform`}>
                  <item.Icon className={`w-4 h-4 ${item.color}`} />
                </div>

                {/* Label */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-800">{item.label}</div>
                </div>

                {/* Price */}
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-black text-slate-900 tabular-nums">
                    ₺{alis !== '—' ? fmt(alis) : '—'}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">
                    Satış: ₺{satis !== '—' ? fmt(satis) : '—'}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      {/* Quick Calculator */}
      <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2 mt-auto">
        <div className="flex-1">
          <input 
            type="number"
            min="0"
            value={calcAmount}
            onChange={e => setCalcAmount(e.target.value)}
            placeholder="0.00"
            className="w-full max-w-[70px] bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#7ed957] focus:ring-1 focus:ring-[#7ed957]"
          />
        </div>
        
        <div className="relative flex-shrink-0 flex justify-center">
          <button 
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] font-bold text-slate-700 flex items-center gap-1 hover:bg-slate-50 focus:outline-none focus:border-[#7ed957] focus:ring-1 focus:ring-[#7ed957]"
          >
            {calcCurrency === 'GA' ? 'ALTIN' : calcCurrency}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </button>

          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-20 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1">
                {['USD', 'EUR', 'GBP', 'GA'].map(c => (
                  <button
                    key={c}
                    className="w-full text-left px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                    onClick={() => { setCalcCurrency(c); setDropdownOpen(false); }}
                  >
                    {c === 'GA' ? 'ALTIN' : c}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex-1 flex items-center justify-end min-w-0">
          <span className="text-[10px] text-slate-400 font-medium mr-1">=</span>
          <span className="text-xs font-black text-slate-900 truncate" title={`₺${fmt(calcResult)}`}>
            ₺{calcAmount ? fmt(calcResult) : '0,00'}
          </span>
        </div>
      </div>
    </div>
  );
};
