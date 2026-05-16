import React, { useState, useEffect } from 'react';
import toast from '../../../components/ui/CustomToast';
import { Package, Warehouse, TrendingUp, Sparkles, AlertTriangle, PackageX } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { StatCard } from '../../../components/ui/StatCard';
import { EmptyReport } from '../components/EmptyReport';
import { ReportExportBar } from '../components/ReportExportBar';
import { reportService } from '../../../services/reportService';
import { PremiumLoader } from '../../../components/ui/PremiumLoader';
import { format } from 'date-fns';

const StockBarTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const fmt = (v) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(v);
    return (
      <div className="bg-white border border-slate-100 rounded-xl shadow-xl shadow-slate-200/60 p-3.5 text-xs min-w-[180px]">
        <p className="font-bold text-slate-700 mb-2 pb-2 border-b border-slate-100">{label}</p>
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center justify-between gap-4 mb-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.fill }} />
              <span className="text-slate-500 font-medium">{entry.name}</span>
            </div>
            <span className="font-black text-slate-800">{fmt(entry.value)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const PillLegend = ({ payload }) => (
  <div className="flex items-center justify-center gap-2 mt-3">
    {payload.map((entry, i) => (
      <span
        key={i}
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
        style={{ backgroundColor: entry.color + '20', color: entry.color }}
      >
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
        {entry.value}
      </span>
    ))}
  </div>
);

export const StockReportTab = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Stock report is primarily current state, not highly date dependent except for movement history
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const summary = await reportService.getStockReport();
      setData(summary);
    } catch(e) {
      console.error('[StockReport] Yükleme Hatası:', e);
      toast.error('Stok raporu yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleCsv = () => {
    if (!data || !data.valuationTable) return;
    const lines = ['Barkod,Urun,Kategori,Stok,Alis_Fiyati,Satis_Fiyati,Alis_Degeri,Satis_Degeri'];
    data.valuationTable.forEach(s => {
      lines.push(`${s.barcode || ''},"${s.name}",${s.category},${s.stock},${s.purchase_price},${s.sale_price},${s.purchase_value},${s.sale_value}`);
    });
    const blob = new Blob(["\uFEFF" + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Stok_Degerleme_${format(new Date(), 'ddMMyyyy')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const formatCurrency = (val) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);

  if (loading) return <div className="relative h-96 flex items-center justify-center"><PremiumLoader message="Stok ve depo verileri derleniyor..." /></div>;
  if (!data || data.totalProducts === 0) return <EmptyReport message="Sistemde listelenecek ürün / stok kaydı bulunamadı." />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center hide-on-print">
        <h2 className="text-xl font-bold text-slate-800">Depo ve Stok Değerlemesi</h2>
        <ReportExportBar onDownloadCsv={handleCsv} />
      </div>

      <div className="hidden print:block text-center border-b-2 border-black pb-4 mb-6">
         <h1 className="text-2xl font-black">STOK DEĞERLEME RAPORU</h1>
         <p className="text-sm">Tarih: {format(new Date(), 'dd.MM.yyyy HH:mm')}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard title="Aktif Ürün Çeşidi" value={data.totalProducts} icon={Package} color="slate" />
        <StatCard title="Toplam Maliyet Değeri" value={formatCurrency(data.totalPurchaseValue)} icon={Warehouse} color="brand" />
        <StatCard title="Potansiyel Satış Tutarı" value={formatCurrency(data.totalSaleValue)} icon={TrendingUp} color="emerald" />
        <StatCard title="Potansiyel Net Kâr" value={formatCurrency(data.potentialProfit)} icon={Sparkles} color={data.potentialProfit >= 0 ? 'teal' : 'red'} />
        <StatCard title="Kritik Stok Uyarıları" value={data.criticalCount} icon={AlertTriangle} color="orange" />
        <StatCard title="Tükenen Ürünler" value={data.outOfStockCount} icon={PackageX} color="red" />
      </div>

      {/* Charts & Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-2 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-700 mb-4">Kategori Bazlı Stok Yatırımı (₺)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byCategory.slice(0, 8)} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(val) => `₺${val}`} />
                <RechartsTooltip content={<StockBarTooltip />} cursor={{ fill: '#f1f5f9', radius: 6 }} />
                <Legend content={<PillLegend />} />
                <Bar dataKey="purchase_value" name="Alış Değeri" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                <Bar dataKey="sale_value" name="Satış Beklentisi" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-orange-100 bg-orange-50/50">
            <h3 className="font-bold text-orange-800 flex items-center gap-2"><AlertTriangle className="w-5 h-5"/> Kritik Stoklar</h3>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[300px] p-0">
            {data.criticalItems.length === 0 ? (
               <div className="p-8 text-center text-slate-400 text-sm">Hiçbir ürün kritik seviyeye inmemiş. Stoklar sağlıklı.</div>
            ) : (
              <ul className="divide-y divide-slate-100 px-4">
                {data.criticalItems.map((item, i) => (
                  <li key={i} className="py-3 flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-slate-800 text-sm truncate max-w-[150px]">{item.name}</p>
                      <p className="text-xs text-slate-500">Min Şart: {item.min_stock_level}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-black text-lg ${item.stock_quantity <= 0 ? 'text-red-600' : 'text-orange-500'}`}>{item.stock_quantity}</p>
                      <p className="text-[10px] text-slate-400">Kalan</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
