import React, { useState, useEffect } from 'react';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subMonths, subYears, startOfYear, endOfYear } from 'date-fns';
import { Calendar } from 'lucide-react';

export const DateRangePicker = ({ onChange, defaultRange = 'this_month' }) => {
  const [activeRange, setActiveRange] = useState(defaultRange);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const ranges = [
    { label: 'Bugün', value: 'today' },
    { label: 'Dün', value: 'yesterday' },
    { label: 'Bu Hafta', value: 'this_week' },
    { label: 'Bu Ay', value: 'this_month' },
    { label: 'Geçen Ay', value: 'last_month' },
    { label: 'Bu Yıl', value: 'this_year' },
    { label: 'Özel', value: 'custom' },
  ];

  useEffect(() => {
    if (activeRange !== 'custom') {
      applyPreset(activeRange);
    }
  }, [activeRange]);

  const applyPreset = (preset) => {
    const now = new Date();
    let start, end;

    switch (preset) {
      case 'today':
        start = startOfDay(now);
        end = endOfDay(now);
        break;
      case 'yesterday':
        start = startOfDay(subDays(now, 1));
        end = endOfDay(subDays(now, 1));
        break;
      case 'this_week':
        start = startOfWeek(now, { weekStartsOn: 1 });
        end = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'this_month':
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case 'last_month':
        start = startOfMonth(subMonths(now, 1));
        end = endOfMonth(subMonths(now, 1));
        break;
      case 'this_year':
        start = startOfYear(now);
        end = endOfYear(now);
        break;
      default:
        start = startOfMonth(now);
        end = endOfMonth(now);
    }
    
    onChange(start, end);
  };

  const handleCustomApply = () => {
    if (customStart && customEnd) {
       onChange(startOfDay(new Date(customStart)), endOfDay(new Date(customEnd)));
    }
  };

  return (
    <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-200 hide-on-print flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="flex flex-wrap gap-2 justify-center md:justify-start flex-1 w-full">
        {ranges.map(r => (
           <button 
             key={r.value}
             onClick={() => setActiveRange(r.value)}
             className={`px-3 py-1.5 text-sm font-semibold rounded-full transition-colors ${activeRange === r.value ? 'bg-brand-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
           >
             {r.label}
           </button>
        ))}
      </div>

      {activeRange === 'custom' && (
        <div className="flex items-center gap-2 w-full md:w-auto mt-2 md:mt-0 bg-slate-50 p-2 rounded-lg border border-slate-200">
           <Calendar className="w-4 h-4 text-slate-400" />
           <input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)} className="text-sm bg-transparent outline-none focus:ring-0 w-32 border-none" />
           <span className="text-slate-400">-</span>
           <input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)} className="text-sm bg-transparent outline-none focus:ring-0 w-32 border-none" />
           <button onClick={handleCustomApply} className="bg-brand-100 text-brand-700 px-3 py-1 text-sm font-bold rounded hover:bg-brand-200">Uygula</button>
        </div>
      )}
    </div>
  );
};
