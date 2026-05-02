import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { TrendingUp, Hash, ShoppingBag, Tag, Percent, Wallet, Package } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { StatCard } from '../../../components/ui/StatCard';
import { EmptyReport } from '../components/EmptyReport';
import { ReportExportBar } from '../components/ReportExportBar';
import { reportService } from '../../../services/reportService';
import { PremiumLoader } from '../../../components/ui/PremiumLoader';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white text-slate-800 text-xs rounded-xl py-3 px-4 shadow-xl shadow-slate-200/60 border border-slate-100 backdrop-blur-md">
        <p className="font-semibold text-slate-500 mb-1">{label}</p>
        <p className="font-black text-emerald-600 text-base">
          {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(payload[0].value)}
        </p>
      </div>
    );
  }
  return null;
};

export const SalesReportTab = ({ startDate, endDate }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (startDate && endDate) {
      loadData();
    }
  }, [startDate, endDate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const summary = await reportService.getSalesSummary(startDate, endDate);
      setData(summary);
    } catch(e) {
      console.error('[SalesReport] Yükleme Hatası:', e);
      toast.error('Satış raporu yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleCsv = () => {
    if (!data || !data.rawSales) return;
    const lines = ['Tarih,Satis_No,Tutar,Iskonto,KDV,Odeme_Yontemi'];
    data.rawSales.forEach(s => {
      lines.push(`${format(s.created_at, 'dd.MM.yyyy HH:mm')},${s.sale_number || ''},${s.total_amount},${s.discount_amount},${s.tax_amount},${s.payment_method}`);
    });
    const blob = new Blob(["\uFEFF" + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Satis_Raporu_${format(startDate, 'ddMMyyyy')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const formatCurrency = (val) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);

  if (loading) return <div className="relative h-96"><PremiumLoader isOpen={true} /></div>;
  if (!data || data.totalCount === 0) return <EmptyReport message="Bu dönemde tamamlanmış herhangi bir satış bulunamadı." />;

  const PIE_COLORS = { cash: '#22c55e', card: '#3b82f6', credit: '#ef4444', mixed: '#f59e0b' };
  const paymentLabels = { cash: 'Nakit', card: 'Kredi Kartı', credit: 'Veresiye', mixed: 'Karma' };
  
  const pieData = Object.keys(data.byPaymentMethod).map(k => ({
    name: paymentLabels[k] || k,
    value: data.byPaymentMethod[k],
    color: PIE_COLORS[k] || '#8884d8'
  })).filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center hide-on-print">
        <h2 className="text-xl font-bold text-slate-800">Satış Analizi</h2>
        <ReportExportBar onDownloadCsv={handleCsv} />
      </div>

      <div className="hidden print:block text-center border-b-2 border-black pb-4 mb-6">
         <h1 className="text-2xl font-black">SATIŞ RAPORU</h1>
         <p className="text-sm">Dönem: {format(startDate, 'dd.MM.yyyy')} - {format(endDate, 'dd.MM.yyyy')}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard title="Brüt Ciro" value={formatCurrency(data.totalRevenue)} icon={TrendingUp} color="brand" />
        <StatCard title="Satış Adedi" value={data.totalCount} icon={Hash} color="blue" />
        <StatCard title="Ort. Sepet" value={formatCurrency(data.avgBasket)} icon={ShoppingBag} color="emerald" />
        <StatCard title="İskonto Toplamı" value={formatCurrency(data.totalDiscount)} icon={Tag} color="orange" />
        <StatCard title="Brüt Kâr" value={formatCurrency(data.totalGrossProfit)} icon={Wallet} color="indigo" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-2 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-700 mb-4">Günlük Satış Trendi</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.dailySeries} barSize={24}>
                <defs>
                  <linearGradient id="colorTotalBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#82e05a" stopOpacity={0.95}/>
                    <stop offset="95%" stopColor="#5da83f" stopOpacity={1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `₺${val}`} />
                <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="total" name="Günlük Ciro" fill="url(#colorTotalBar)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-700 mb-4">Ödeme Yöntemleri Dağılımı</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <RechartsTooltip />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Top Products Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-bold text-slate-800">En Çok Satan 10 Ürün</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-slate-500 border-b border-slate-100">
              <tr>
                <th className="p-3 font-semibold">Sıra</th>
                <th className="p-3 font-semibold">Ürün Adı</th>
                <th className="p-3 font-semibold">Satılan Miktar</th>
                <th className="p-3 font-semibold text-right">Ciro Katkısı</th>
                <th className="p-3 font-semibold text-right">Brüt Kâr Özeti</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.topProducts.map((p, idx) => (
                <tr 
                  key={p.id} 
                  onClick={() => navigate(`/stock/product/${p.id}`)}
                  className="hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <td className="p-3 text-slate-400 font-bold">#{idx + 1}</td>
                  <td className="p-3 font-semibold text-slate-800">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-500 flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4" strokeWidth={2.5} />
                      </div>
                      <span className="truncate">{p.name}</span>
                    </div>
                  </td>
                  <td className="p-3 text-slate-600">{p.quantity}</td>
                  <td className="p-3 text-right font-bold text-brand-600">{formatCurrency(p.revenue)}</td>
                  <td className={`p-3 text-right font-bold ${p.profit < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                    {formatCurrency(p.profit)} <span className={`text-xs font-normal ${p.profit < 0 ? 'text-red-400/80' : 'text-slate-400'}`}>({p.margin.toFixed(0)}%)</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
