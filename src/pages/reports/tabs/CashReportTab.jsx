import React, { useState, useEffect, startTransition } from 'react';
import toast from '../../../components/ui/CustomToast';
import { ArrowDownLeft, ArrowUpRight, TrendingUp, Landmark } from 'lucide-react';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { StatCard } from '../../../components/ui/StatCard';
import { EmptyReport } from '../components/EmptyReport';
import { ReportExportBar } from '../components/ReportExportBar';
import { reportService } from '../../../services/reportService';
import { PremiumLoader } from '../../../components/ui/PremiumLoader';
import { format } from 'date-fns';

const fmtCur = (val) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val || 0);

const PIE_PALETTE = {
  'Tedarikçiye Ödemeler': { color: '#3b82f6', bg: '#dbeafe' },
  'Gider':                 { color: '#ef4444', bg: '#fee2e2' },
  'İade Ödemeleri':       { color: '#f97316', bg: '#ffedd5' },
};

const PieTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const entry = payload[0];
  const name = entry.name;
  const val  = entry.value;
  const style = PIE_PALETTE[name] || { color: '#64748b', bg: '#f1f5f9' };
  const total = payload[0]?.payload?.payload ? undefined : undefined; // not needed
  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-xl shadow-slate-200/50 p-4 min-w-[180px]">
      <div
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-3"
        style={{ backgroundColor: style.bg, color: style.color }}
      >
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: style.color }} />
        {name}
      </div>
      <p className="text-xl font-black text-slate-800">{fmtCur(val)}</p>
      <p className="text-[11px] text-slate-400 mt-0.5">Dönem toplamı</p>
    </div>
  );
};

const fmt = (val) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val || 0);

const PILL_STYLES = {
  income:  { label: 'Giriş',           bg: '#d1fae5', color: '#059669' },
  expense: { label: 'Çıkış',           bg: '#ffe4e6', color: '#f43f5e' },
  returns: { label: 'İade Ödemeleri',   bg: '#dbeafe', color: '#3b82f6' },
  balance: { label: 'Net Bakiye',      bg: '#dcfce7', color: '#16a34a' },
};

const ORDER = ['income', 'expense', 'returns', 'balance'];

const CashTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const map = {};
  payload.forEach(p => { map[p.dataKey] = p.value; });
  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-xl shadow-slate-200/60 p-4 min-w-[210px]">
      <p className="font-bold text-slate-700 text-xs mb-3 pb-2 border-b border-slate-100">{label}</p>
      {ORDER.map(key => {
        const s = PILL_STYLES[key];
        const val = map[key];
        if (val === undefined) return null;
        return (
          <div key={key} className="flex items-center justify-between gap-3 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold" style={{ backgroundColor: s.bg, color: s.color }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
            <span className="font-black text-slate-800 text-xs">{fmt(val)}</span>
          </div>
        );
      })}
    </div>
  );
};

export const CashReportTab = ({ startDate, endDate }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (startDate && endDate) {
      loadData();
    }
  }, [startDate, endDate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const summary = await reportService.getCashReport(startDate, endDate);
      startTransition(() => setData(summary));
    } catch(e) {
      console.error('[CashReport] Yükleme Hatası:', e);
      toast.error('Kasa raporu yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleCsv = () => {
    if (!data || !data.dailySeries) return;
    const lines = ['Tarih,Giris,Cikis,Net_Aralik_Bakiyesi'];
    data.dailySeries.forEach(s => {
      lines.push(`${s.date},${s.income},${s.expense},${s.balance}`);
    });
    const blob = new Blob(["\uFEFF" + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Kasa_Akisi_${format(startDate, 'ddMMyyyy')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const formatCurrency = (val) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);

  if (loading) return <div className="relative h-96 flex items-center justify-center"><PremiumLoader message="Kasa ve nakit akışı verileri derleniyor..." /></div>;
  if (!data) return <EmptyReport message="Hata." />;

  const getColor = (name) => (PIE_PALETTE[name]?.color || '#94a3b8');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center hide-on-print">
        <h2 className="text-xl font-bold text-slate-800">Nakit Akışı (Kasa) Analizi</h2>
        <ReportExportBar onDownloadCsv={handleCsv} />
      </div>

      <div className="hidden print:block text-center border-b-2 border-black pb-4 mb-6">
         <h1 className="text-2xl font-black">NAKİT AKIŞ (KASA) RAPORU</h1>
         <p className="text-sm">Dönem: {format(startDate, 'dd.MM.yyyy')} - {format(endDate, 'dd.MM.yyyy')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Dönem İçi Giriş" value={formatCurrency(data.totalIncome)} icon={ArrowDownLeft} color="emerald" />
        <StatCard title="Dönem İçi Çıkış" value={formatCurrency(data.totalExpense)} icon={ArrowUpRight} color="red" />
        <StatCard title="İade Ödemeleri" value={formatCurrency(data.totalReturns || 0)} icon={ArrowUpRight} color="orange" />
        <StatCard title="Aralık Net Akışı" value={formatCurrency(data.netFlow)} icon={TrendingUp} color={data.netFlow >= 0 ? 'emerald' : 'orange'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-2 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-700 mb-1">Nakit Akış Takvimi</h3>
          <p className="text-[11px] text-slate-400 mb-3">Gelir (yeşil) · Gider (kırmızı) · İade Ödemesi (turuncu)</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.dailySeries}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(val) => `₺${val}`} />
                <YAxis yAxisId="right" orientation="right" hide />
                <RechartsTooltip content={<CashTooltip />} cursor={{ fill: '#f8fafc' }} />
                <Legend iconType="circle" />
                <Bar yAxisId="left" dataKey="income" name="Giriş (Gelir)" fill="#10b981" barSize={16} radius={[2, 2, 0, 0]} />
                <Bar yAxisId="left" dataKey="returns" name="İade Ödemesi" fill="#3b82f6" barSize={16} radius={[2, 2, 0, 0]} />
                <Bar yAxisId="left" dataKey="expense" name="Çıkış (Gider)" fill="#f43f5e" barSize={16} radius={[2, 2, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="balance" name="Net Bakiye" stroke="#65c43d" strokeWidth={3} dot={false} strokeOpacity={0.4} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-700 mb-4">Çıkış / Gider Türleri</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.expenseBreakdown} innerRadius={60} outerRadius={85} paddingAngle={5} dataKey="value" nameKey="name">
                  {data.expenseBreakdown.map((entry, index) => <Cell key={`cell-${index}`} fill={getColor(entry.name)} />)}
                </Pie>
                <RechartsTooltip content={<PieTooltip />} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
            {data.expenseBreakdown.length === 0 && (
              <div className="text-center text-slate-400 text-sm mt-4">Kayıtlı gider yok.</div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
