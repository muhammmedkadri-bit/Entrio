import React, { useState, useEffect } from 'react';
import toast from '../../../components/ui/CustomToast';
import { TrendingUp, Package, Wallet, Receipt, Star, Tag } from 'lucide-react';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { StatCard } from '../../../components/ui/StatCard';
import { EmptyReport } from '../components/EmptyReport';
import { ReportExportBar } from '../components/ReportExportBar';
import { reportService } from '../../../services/reportService';
import { PremiumLoader } from '../../../components/ui/PremiumLoader';
import { format } from 'date-fns';

const StatCardSkeleton = () => (
  <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-center animate-pulse">
    <div className="flex items-center justify-between mb-2">
      <div className="w-20 h-3 bg-slate-200/60 rounded"></div>
      <div className="w-8 h-8 rounded-lg bg-slate-100"></div>
    </div>
    <div className="w-24 h-6 bg-slate-200/80 rounded mt-1"></div>
    <div className="w-16 h-2.5 bg-slate-200/50 rounded mt-2"></div>
  </div>
);

const IncomeStatementSkeleton = () => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-full animate-pulse">
    <div className="w-48 h-5 bg-slate-200/60 rounded mx-auto mb-8"></div>
    <div className="space-y-6">
      <div>
        <div className="w-32 h-4 bg-slate-200/80 rounded mb-3"></div>
        <div className="flex justify-between pl-4 mb-3"><div className="w-24 h-3 bg-slate-200/60 rounded"></div><div className="w-16 h-3 bg-slate-200/60 rounded"></div></div>
        <div className="w-40 h-4 bg-slate-200/80 rounded mb-3"></div>
        <div className="flex justify-between pl-4 mb-4"><div className="w-28 h-3 bg-slate-200/60 rounded"></div><div className="w-16 h-3 bg-slate-200/60 rounded"></div></div>
        <div className="flex justify-between border-b border-dashed border-slate-200 pb-3"><div className="w-48 h-4 bg-slate-200/80 rounded"></div><div className="w-20 h-4 bg-slate-200/80 rounded"></div></div>
      </div>
      <div>
        <div className="w-40 h-4 bg-slate-200/80 rounded mb-3"></div>
        <div className="flex justify-between pl-4 mb-4"><div className="w-32 h-3 bg-slate-200/60 rounded"></div><div className="w-16 h-3 bg-slate-200/60 rounded"></div></div>
        <div className="flex justify-between border-b border-dashed border-slate-200 pb-3"><div className="w-48 h-4 bg-slate-200/80 rounded"></div><div className="w-20 h-4 bg-slate-200/80 rounded"></div></div>
      </div>
      <div>
        <div className="w-40 h-4 bg-slate-200/80 rounded mb-3"></div>
        <div className="flex justify-between pl-4"><div className="w-32 h-3 bg-slate-200/60 rounded"></div><div className="w-16 h-3 bg-slate-200/60 rounded"></div></div>
      </div>
      <div className="p-3 rounded-lg flex justify-between mt-8 bg-slate-100/50">
        <div className="w-48 h-5 bg-slate-200/80 rounded"></div>
        <div className="w-24 h-5 bg-slate-200/80 rounded"></div>
      </div>
    </div>
  </div>
);

const TrendChartSkeleton = () => (
  <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 animate-pulse">
    <div className="w-48 h-4 bg-slate-200/60 rounded mb-4"></div>
    <div className="h-64 flex items-end justify-around gap-2 pb-6 px-2 border-b border-slate-100/50 relative">
      <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200/40"></div>
      {[40, 70, 45, 90, 65, 80].map((h, i) => (
        <div key={i} className="flex-1 flex justify-center gap-1 items-end h-full relative z-10">
          <div className="w-4 bg-emerald-200/40 rounded-t" style={{ height: `${h}%` }}></div>
          <div className="w-4 bg-orange-200/40 rounded-t" style={{ height: `${Math.max(10, h - 20)}%` }}></div>
        </div>
      ))}
    </div>
    <div className="flex justify-center gap-4 mt-4">
      <div className="w-16 h-3 bg-slate-200/60 rounded-full"></div>
      <div className="w-16 h-3 bg-slate-200/60 rounded-full"></div>
      <div className="w-16 h-3 bg-slate-200/60 rounded-full"></div>
    </div>
  </div>
);

const ProductProfitTableSkeleton = () => (
  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-pulse">
    <div className="p-3 border-b border-slate-100 bg-slate-50">
      <div className="w-48 h-4 bg-slate-200/60 rounded"></div>
    </div>
    <table className="w-full text-left text-xs">
      <thead className="border-b border-slate-100">
        <tr>
          <th className="p-2"><div className="w-16 h-3 bg-slate-200/60 rounded"></div></th>
          <th className="p-2"><div className="w-10 h-3 bg-slate-200/60 rounded ml-auto"></div></th>
          <th className="p-2"><div className="w-12 h-3 bg-slate-200/60 rounded ml-auto"></div></th>
          <th className="p-2"><div className="w-16 h-3 bg-slate-200/60 rounded ml-auto"></div></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {[...Array(5)].map((_, i) => (
          <tr key={i}>
            <td className="p-2"><div className="w-24 h-3 bg-slate-200/60 rounded"></div></td>
            <td className="p-2"><div className="w-6 h-3 bg-slate-200/60 rounded ml-auto"></div></td>
            <td className="p-2"><div className="w-10 h-3 bg-slate-200/60 rounded ml-auto"></div></td>
            <td className="p-2"><div className="w-16 h-3 bg-emerald-200/60 rounded ml-auto"></div></td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const ProfitLossSkeleton = () => (
  <div className="space-y-6">
    <div className="flex justify-between items-center">
      <div className="w-64 h-6 bg-slate-200/60 rounded animate-pulse"></div>
      <div className="w-24 h-8 bg-slate-200/60 rounded-lg animate-pulse"></div>
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
      {[...Array(6)].map((_, i) => <StatCardSkeleton key={`stat-${i}`} />)}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <IncomeStatementSkeleton />
      <div className="space-y-6">
        <TrendChartSkeleton />
        <ProductProfitTableSkeleton />
      </div>
    </div>
  </div>
);

export const ProfitLossTab = ({ startDate, endDate }) => {
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
      const summary = await reportService.getProfitLoss(startDate, endDate);
      setData(summary);
    } catch(e) {
      console.error('[ProfitLossReport] Yükleme Hatası:', e);
      toast.error('Kâr / Zarar raporu yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleCsv = () => {
    if (!data || !data.productProfitability) return;
    const lines = ['Urun,Satis_Adedi,Ciro,Maliyet,Brut_Kar,Kar_Marji'];
    data.productProfitability.forEach(s => {
      lines.push(`${s.name},${s.qty},${s.revenue},${s.cost},${s.grossProfit},%${s.margin.toFixed(0)}`);
    });
    const blob = new Blob(["\uFEFF" + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Karlilik_Izlemi_${format(startDate, 'ddMMyyyy')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const formatCurrency = (val) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);

  if (loading) return <ProfitLossSkeleton />;
  if (!data) return <EmptyReport message="Hata." />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center hide-on-print">
        <h2 className="text-xl font-bold text-slate-800">Kâr / Zarar & Gelir Tablosu</h2>
        <ReportExportBar onDownloadCsv={handleCsv} />
      </div>

      <div className="hidden print:block text-center border-b-2 border-black pb-4 mb-6">
         <h1 className="text-2xl font-black">GELİR TABLOSU VE KÂRLILIK</h1>
         <p className="text-sm">Dönem: {format(startDate, 'dd.MM.yyyy')} - {format(endDate, 'dd.MM.yyyy')}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <StatCard title="Brüt Ciro (Satışlar)" value={formatCurrency(data.revenue)} icon={TrendingUp} color="brand" />
        <StatCard title="Satılan Mal Maliyeti (SMM)" value={formatCurrency(data.cogs)} icon={Package} color="orange" />
        <StatCard title="Brüt Kâr" value={formatCurrency(data.grossProfit)} sub={`Ort. Marj: %${data.grossMargin.toFixed(1)}`} icon={Wallet} color="emerald" />
        <StatCard title="Genel İşletme Gideri" value={formatCurrency(data.expenses)} icon={Receipt} color="red" />
        <StatCard title="Uygulanan İskontolar" value={formatCurrency(data.discounts)} icon={Tag} color="slate" />
        <StatCard title="Net Dönem Kârı" value={formatCurrency(data.netProfit)} sub={`Net Marj: %${data.netMargin.toFixed(1)}`} icon={Star} color={data.netProfit >= 0 ? 'emerald' : 'red'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Income Statement (Gelir Tablosu) */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 print:shadow-none print:border-none">
          <h3 className="font-bold text-slate-800 mb-6 text-center text-lg underline underline-offset-4">GELİR TABLOSU (ÖZET)</h3>
          
          <div className="space-y-4 font-mono text-sm leading-relaxed text-slate-700">
            {/* SATIŞLAR */}
            <div>
              <p className="font-bold text-black mb-1">A. BRÜT SATIŞLAR</p>
              <div className="flex justify-between pl-4"><span>Yurtiçi Satışlar</span><span>{formatCurrency(data.revenue)}</span></div>
              <p className="font-bold text-black mt-2 mb-1">B. SATIŞ İNDİRİMLERİ (-)</p>
              <div className="flex justify-between pl-4 text-red-600"><span>Satış İskontoları</span><span>({formatCurrency(data.discounts)})</span></div>
              <div className="flex justify-between font-bold text-brand-700 mt-2 border-b border-dashed border-slate-300 pb-2">
                <span>C. NET SATIŞLAR (A-B)</span><span>{formatCurrency(data.netRevenue)}</span>
              </div>
            </div>

            {/* MALİYET */}
            <div>
              <p className="font-bold text-black mb-1">D. SATIŞLARIN MALİYETİ (-)</p>
              <div className="flex justify-between pl-4 text-orange-600"><span>Satılan Ticari Mallar (COGS)</span><span>({formatCurrency(data.cogs)})</span></div>
              <div className="flex justify-between font-bold text-emerald-700 mt-2 border-b border-dashed border-slate-300 pb-2">
                <span>E. BRÜT SATIŞ KÂRI (C-D)</span><span>{formatCurrency(data.grossProfit)}</span>
              </div>
            </div>

            {/* GİDERLER */}
            <div>
              <p className="font-bold text-black mb-1">F. FAALİYET GİDERLERİ (-)</p>
              <div className="flex justify-between pl-4 text-red-600"><span>Genel Yönetim / İşletme Gideri</span><span>({formatCurrency(data.expenses)})</span></div>
            </div>

            {/* NET */}
            <div className={`p-3 rounded font-black text-lg flex justify-between mt-6 ${data.netProfit >= 0 ? 'bg-emerald-50 text-emerald-800 border fill-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
              <span>DÖNEM NET KÂRI (E-F)</span>
              <span>{formatCurrency(data.netProfit)}</span>
            </div>
          </div>
        </div>

        {/* Charts and Tables */}
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-700 mb-4">Gelişim ve Kârlılık Bandı</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.trend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(val) => `₺${val}`} />
                  <RechartsTooltip formatter={(val) => formatCurrency(val)} />
                  <Legend iconType="circle" />
                  <Bar dataKey="revenue" name="Ciro" fill="#65c43d" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cogs" name="Maliyet" fill="#fb923c" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="profit" name="Brüt Kâr" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hide-on-print">
            <div className="p-3 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-800 text-sm">Ürün Bazlı Brüt Kârlılık Analizi (Top)</h3>
            </div>
            <div className="overflow-x-auto max-h-[250px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-500 bg-white sticky top-0 border-b border-slate-100 z-10">
                  <tr>
                    <th className="p-2">Ürün</th>
                    <th className="p-2 text-right">Miktar</th>
                    <th className="p-2 text-right">Maliyet</th>
                    <th className="p-2 text-right">Brüt Kâr</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.productProfitability.map((p, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2 font-bold text-slate-700 truncate max-w-[120px]" title={p.name}>{p.name}</td>
                      <td className="p-2 text-right text-slate-500">{p.qty}</td>
                      <td className="p-2 text-right text-slate-400">{formatCurrency(p.cost)}</td>
                      <td className="p-2 text-right text-emerald-600 font-bold">
                        {formatCurrency(p.grossProfit)} <span className="opacity-50 font-normal">({p.margin.toFixed(0)}%)</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
