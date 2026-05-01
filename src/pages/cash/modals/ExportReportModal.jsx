import React, { useState } from 'react';
import toast from 'react-hot-toast';
import {
  format, startOfDay, endOfDay, subDays, startOfMonth, startOfYear, endOfMonth,
  addMonths, subMonths, startOfWeek, endOfWeek, addDays, isSameDay, isSameMonth, isToday
} from 'date-fns';
import { tr } from 'date-fns/locale';
import { Download, Calendar, X, FileSpreadsheet, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { cashService } from '../../../services/cashService';
import * as XLSX from 'xlsx';

const TIME_RANGES = [
  { id: 'today', label: 'Bugün' },
  { id: 'yesterday', label: 'Dün' },
  { id: 'week', label: 'Son 7 Gün' },
  { id: 'month', label: 'Bu Ay' },
  { id: 'year', label: 'Bu Yıl' },
  { id: 'custom', label: 'Özel Tarih' }
];

const inputCls =
  'w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400 transition-all';
const labelCls = 'block text-sm font-semibold text-slate-700 mb-1.5';

/* ─── Kompakt Inline Calendar ─────────────────────────────────────────── */
function CompactCalendar({ date, onChange }) {
  const [current, setCurrent] = React.useState(date || new Date());

  let days = [];
  let d = startOfWeek(startOfMonth(current), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(current), { weekStartsOn: 1 });
  while (d <= end) { days.push(d); d = addDays(d, 1); }

  return (
    <div className="border border-slate-200 rounded-xl bg-white p-2.5 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => setCurrent(subMonths(current, 1))}
          className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500">
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-[11px] font-bold text-slate-600 capitalize">
          {format(current, 'MMMM yyyy', { locale: tr })}
        </span>
        <button type="button" onClick={() => setCurrent(addMonths(current, 1))}
          className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500">
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'].map(h => (
          <div key={h} className="text-center text-[9px] font-bold text-slate-400">{h}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map(day => {
          const sel = date && isSameDay(day, date);
          const today = isToday(day);
          const inMonth = isSameMonth(day, current);
          return (
            <button key={day.toISOString()} type="button"
              onClick={() => onChange(startOfDay(day))}
              className={[
                'flex items-center justify-center text-[11px] rounded-full h-6 w-full transition-colors',
                !inMonth ? 'opacity-30' : '',
                sel ? 'bg-[#5da83f] text-white font-bold' : '',
                !sel && today ? 'bg-emerald-50 text-[#5da83f] font-bold' : '',
                !sel && !today && inMonth ? 'hover:bg-slate-100 text-slate-700' : '',
              ].join(' ')}>
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Register Dropdown ───────────────────────────────────────────────── */
function RegisterDropdown({ options = [], value, onChange }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const selected = options.find(o => o.id.toString() === value) || (value === 'all' ? {name: 'Tüm Kasalar (Genel Rapor)', id: 'all'} : null);

  return (
    <div ref={ref} className="relative z-50">
      <button type="button" onClick={() => setOpen(v => !v)}
        className={`${inputCls} flex items-center justify-between gap-2 cursor-pointer`}>
        <span className={selected ? 'text-slate-800' : 'text-slate-400'}>
          {selected ? selected.name : 'Kasa Seçiniz...'}
        </span>
        <ChevronDown className={`w-4 h-4 flex-shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-60 overflow-y-auto">
          <button type="button"
            onClick={() => { onChange('all'); setOpen(false); }}
            className={`w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors ${value === 'all' ? 'bg-emerald-50/50 text-[#5da83f]' : 'text-slate-700'}`}>
            Tüm Kasalar (Genel Rapor)
          </button>
          {options.map(o => (
            <button key={o.id} type="button"
              onClick={() => { onChange(o.id.toString()); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors ${value === o.id.toString() ? 'bg-emerald-50/50 text-[#5da83f]' : 'text-slate-700'}`}>
              {o.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const ExportReportModal = ({ isOpen, onClose, registers }) => {
  const [range, setRange] = useState('today');
  const [selectedReg, setSelectedReg] = useState('all');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [loading, setLoading] = useState(false);

  const getDates = () => {
    const today = new Date();
    switch (range) {
      case 'today': return { start: startOfDay(today), end: endOfDay(today) };
      case 'yesterday': {
        const y = subDays(today, 1);
        return { start: startOfDay(y), end: endOfDay(y) };
      }
      case 'week': return { start: startOfDay(subDays(today, 7)), end: endOfDay(today) };
      case 'month': return { start: startOfMonth(today), end: endOfDay(today) };
      case 'year': return { start: startOfYear(today), end: endOfDay(today) };
      case 'custom': return { start: startOfDay(startDate), end: endOfDay(endDate) };
      default: return { start: startOfDay(today), end: endOfDay(today) };
    }
  };

  const handleExport = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { start, end } = getDates();
      
      let txs = [];
      if (selectedReg === 'all') {
        for (const r of registers) {
          const t = await cashService.getTransactions(r.id);
          txs = txs.concat(t.map(x => ({ ...x, registerName: r.name })));
        }
      } else {
        txs = await cashService.getTransactions(parseInt(selectedReg));
        const rName = registers.find(r => r.id === parseInt(selectedReg))?.name || '';
        txs = txs.map(x => ({ ...x, registerName: rName }));
      }

      // Tarihe göre filtrele
      txs = txs.filter(t => t.created_at >= start.getTime() && t.created_at <= end.getTime());
      
      if (txs.length === 0) {
        toast.error('Seçilen aralıkta hareket bulunamadı.');
        setLoading(false);
        return;
      }

      // Excel verisine dönüştür
      const data = txs.sort((a, b) => b.created_at - a.created_at).map(t => ({
        'Kasa / Hesap': t.registerName,
        'Tarih': format(new Date(t.created_at), 'dd.MM.yyyy HH:mm'),
        'Hareket Tipi': t.transaction_type.includes('_in') ? 'Gelir' : t.transaction_type.includes('_out') ? 'Gider' : 'Düzeltme',
        'Açıklama': t.notes || '-',
        'Tutar (TL)': t.amount * (t.transaction_type.includes('_out') ? -1 : 1),
        'İşlem Sonrası Bakiye': t.balance_after
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);

      // Sütun genişlikleri
      ws['!cols'] = [
        { wch: 20 }, { wch: 18 }, { wch: 15 }, { wch: 40 }, { wch: 15 }, { wch: 20 }
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Kasa Hareketleri');
      
      const fileName = `Kasa_Raporu_${format(start, 'dd-MM-yyyy')}_${format(end, 'dd-MM-yyyy')}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      toast.success('Rapor başarıyla indirildi.');
      onClose();
    } catch (err) {
      console.error('[ExportReport] Rapor oluşturma hatası:', err);
      toast.error(err?.message || 'Rapor oluşturulurken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Kasa Raporu İndir" size="md">
      <form onSubmit={handleExport} className="space-y-5">
        
        {/* Kasa Seçimi */}
        <div>
          <label className={labelCls}>Kasa Seçimi</label>
          <RegisterDropdown 
            options={registers} 
            value={selectedReg} 
            onChange={setSelectedReg} 
          />
        </div>

        {/* Tarih Aralığı Hazır Seçenekler */}
        <div>
          <label className={labelCls}>Tarih Aralığı</label>
          <div className="grid grid-cols-3 gap-2">
            {TIME_RANGES.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRange(r.id)}
                className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                  range === r.id 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-2 ring-emerald-400/20' 
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Özel Tarih Seçiciler */}
        {range === 'custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl relative z-40">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-2 block">Başlangıç Tarihi</label>
              <CompactCalendar date={startDate} onChange={setStartDate} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-2 block">Bitiş Tarihi</label>
              <CompactCalendar date={endDate} onChange={setEndDate} />
            </div>
          </div>
        )}

        {/* Butonlar */}
        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 transition-all">
            <X className="w-4 h-4" /> İptal
          </button>
          <button type="submit" disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-[#5da83f] text-white hover:bg-[#4b8a32] transition-all disabled:opacity-70 shadow-sm">
            <FileSpreadsheet className="w-4 h-4" />
            {loading ? 'Hazırlanıyor...' : 'Excel İndir'}
          </button>
        </div>

      </form>
    </Modal>
  );
};
