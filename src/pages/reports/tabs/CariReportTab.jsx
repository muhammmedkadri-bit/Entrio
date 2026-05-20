import React, { useState, useEffect, startTransition } from 'react';
import toast from '../../../components/ui/CustomToast';
import { Users, Building2, TrendingUp, TrendingDown, AlertCircle, UserCheck, UserX, Crown, PhoneCall } from 'lucide-react';
import { StatCard } from '../../../components/ui/StatCard';
import { EmptyReport } from '../components/EmptyReport';
import { ReportExportBar } from '../components/ReportExportBar';
import { reportService } from '../../../services/reportService';
import { useCacheStore } from '../../../store/cacheStore';
import { PremiumLoader } from '../../../components/ui/PremiumLoader';
import { format } from 'date-fns';

const StatCardSkeleton = () => (
  <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-center animate-pulse">
    <div className="flex items-center justify-between mb-2">
      <div className="w-24 h-3 bg-slate-200/60 rounded"></div>
      <div className="w-8 h-8 rounded-lg bg-slate-100"></div>
    </div>
    <div className="w-32 h-6 bg-slate-200/80 rounded mt-1"></div>
  </div>
);

const TopDebtorsSkeleton = () => (
  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-pulse">
    <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
      <div className="w-4 h-4 rounded-full bg-slate-200/60"></div>
      <div className="w-40 h-4 bg-slate-200/60 rounded"></div>
    </div>
    <ul className="divide-y divide-slate-50">
      {[...Array(5)].map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="w-7 h-7 rounded-full bg-slate-200/60 shrink-0"></div>
          <div className="flex-1">
            <div className="w-32 h-4 bg-slate-200/60 rounded mb-2"></div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full"></div>
          </div>
          <div className="text-right flex flex-col items-end">
            <div className="w-16 h-4 bg-red-200/60 rounded mb-1"></div>
            <div className="w-10 h-2.5 bg-slate-200/60 rounded"></div>
          </div>
        </li>
      ))}
    </ul>
  </div>
);

const InsightsSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    <div className="rounded-xl p-4 border flex items-center gap-4 bg-slate-50 border-slate-100">
      <div className="w-12 h-12 rounded-full bg-slate-200/60 shrink-0"></div>
      <div className="flex-1">
        <div className="w-32 h-3 bg-slate-200/60 rounded mb-1.5"></div>
        <div className="w-48 h-5 bg-slate-200/80 rounded mb-1"></div>
        <div className="w-24 h-6 bg-red-200/60 rounded"></div>
      </div>
    </div>
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
      <div className="w-32 h-4 bg-slate-200/60 rounded mb-4"></div>
      <div>
        <div className="flex justify-between mb-1.5">
          <div className="w-24 h-3 bg-slate-200/60 rounded"></div>
          <div className="w-8 h-3 bg-slate-200/60 rounded"></div>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full"></div>
      </div>
      <div className="pt-2 grid grid-cols-2 gap-3">
        <div className="bg-slate-50 rounded-xl p-3 flex flex-col items-center">
          <div className="w-5 h-5 rounded-full bg-slate-200/60 mb-2"></div>
          <div className="w-12 h-6 bg-slate-200/80 rounded mb-1"></div>
          <div className="w-20 h-3 bg-slate-200/60 rounded"></div>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 flex flex-col items-center">
          <div className="w-5 h-5 rounded-full bg-slate-200/60 mb-2"></div>
          <div className="w-12 h-6 bg-slate-200/80 rounded mb-1"></div>
          <div className="w-20 h-3 bg-slate-200/60 rounded"></div>
        </div>
      </div>
      <div className="border-t border-slate-100 pt-3 flex justify-between items-center">
        <div className="w-24 h-3 bg-slate-200/60 rounded"></div>
        <div className="w-16 h-4 bg-slate-200/80 rounded"></div>
      </div>
    </div>
  </div>
);

const CariReportSkeleton = () => (
  <div className="space-y-6">
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div className="w-64 h-10 bg-slate-200/60 rounded-xl animate-pulse"></div>
      <div className="w-24 h-8 bg-slate-200/60 rounded-lg animate-pulse"></div>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {[...Array(3)].map((_, i) => <StatCardSkeleton key={`stat-${i}`} />)}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <TopDebtorsSkeleton />
      <InsightsSkeleton />
    </div>
  </div>
);

export const CariReportTab = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('customer');

  // Realtime Cache Binding
  const setCache = useCacheStore(s => s.setCache);
  const isCustomersValid = useCacheStore(s => s._cache['customers']?.valid);
  const isSuppliersValid = useCacheStore(s => s._cache['suppliers']?.valid);

  useEffect(() => {
    loadData();
  }, [mode, isCustomersValid, isSuppliersValid]);

  const loadData = async () => {
    setLoading(true);
    try {
      const summary = await reportService.getCariReport(mode);
      startTransition(() => setData(summary));
      
      // Register dummy valid cache so Realtime invalidations can trigger updates
      if (mode === 'customer') {
        setCache('customers', { dummy: true });
      } else {
        setCache('suppliers', { dummy: true });
      }
    } catch(e) {
      console.error('[CariReport] Yükleme Hatası:', e);
      toast.error('Cari rapor yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleCsv = () => {
    if (!data || !data.balanceTable) return;
    const lines = ['CariAd,Telefon,Bakiye'];
    data.balanceTable.forEach(s => {
      lines.push(`"${s.name}",${s.phone || ''},${s.endBalance}`);
    });
    const blob = new Blob(["\uFEFF" + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Cari_Rapor_${mode}_${format(new Date(), 'ddMMyyyy')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const fmt = (val) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val || 0);

  if (loading) return <CariReportSkeleton />;
  if (!data) return <EmptyReport message="Beklenmedik bir hata hesaplamayı durdurdu." />;

  const isCust = mode === 'customer';
  const totalBalance = isCust ? data.totalReceivable : data.totalPayable;
  const totalEntities = data.balanceTable.length;
  const debtorRatio = totalEntities > 0 ? (data.debtorCount / totalEntities) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header & Toggle */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hide-on-print">
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setMode('customer')}
            className={`flex items-center gap-2 px-4 py-2 font-bold rounded-lg transition-all text-sm ${isCust ? 'bg-white shadow-sm text-brand-700' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Users className="w-4 h-4" /> Müşterilerden Alacaklar
          </button>
          <button
            onClick={() => setMode('supplier')}
            className={`flex items-center gap-2 px-4 py-2 font-bold rounded-lg transition-all text-sm ${!isCust ? 'bg-white shadow-sm text-red-700' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Building2 className="w-4 h-4" /> Tedarikçilere Borçlar
          </button>
        </div>
        <ReportExportBar onDownloadCsv={handleCsv} />
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard
          title={isCust ? 'Toplam Alacağımız' : 'Toplam Borcumuz'}
          value={fmt(totalBalance)}
          icon={isCust ? TrendingUp : TrendingDown}
          color={isCust ? 'emerald' : 'red'}
        />
        <StatCard
          title={isCust ? 'Borçlu Müşteri' : 'Borçlu Tedarikçi'}
          value={data.debtorCount}
          icon={AlertCircle}
          color="orange"
        />
        <StatCard
          title="Ortalama Borç"
          value={fmt(data.avgDebt)}
          icon={isCust ? TrendingUp : TrendingDown}
          color="slate"
        />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Top 5 Debtors */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-500" />
            <h3 className="font-bold text-slate-800">
              {isCust ? 'En Yüksek 5 Borçlu Müşteri' : 'En Yüksek 5 Alacaklı Tedarikçi'}
            </h3>
          </div>
          {data.top5Debtors.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              {isCust ? 'Hiçbir müşterinin borcu bulunmuyor.' : 'Hiçbir tedarikçiye borcunuz bulunmuyor.'}
            </div>
          ) : (
            <ul className="divide-y divide-slate-50">
              {data.top5Debtors.map((d, i) => {
                const pct = totalBalance > 0 ? (d.balance / totalBalance) * 100 : 0;
                const rankColors = ['text-amber-500', 'text-slate-400', 'text-orange-400', 'text-slate-300', 'text-slate-300'];
                return (
                  <li key={d.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                    <span className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-black shrink-0 bg-slate-100 ${rankColors[i]}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 text-sm truncate">{d.name}</p>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1">
                        <div className="bg-red-400 h-1.5 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-red-500 text-sm">{fmt(d.balance)}</p>
                      <p className="text-[10px] text-slate-400">%{pct.toFixed(1)} pay</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Insight cards */}
        <div className="space-y-4">

          {/* Highest debtor highlight */}
          {data.highestDebtor && (
            <div className={`rounded-xl p-4 border flex items-center gap-4 ${isCust ? 'bg-red-50 border-red-100' : 'bg-orange-50 border-orange-100'}`}>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${isCust ? 'bg-red-100 text-red-500' : 'bg-orange-100 text-orange-500'}`}>
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">
                  {isCust ? 'En Yüksek Borçlu Müşteri' : 'En Yüksek Alacaklı Tedarikçi'}
                </p>
                <p className="font-black text-slate-800 truncate">{data.highestDebtor.name}</p>
                <p className={`text-xl font-black mt-0.5 ${isCust ? 'text-red-600' : 'text-orange-600'}`}>
                  {fmt(data.highestDebtor.balance)}
                </p>
              </div>
            </div>
          )}

          {/* Stats breakdown */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
            <h4 className="font-bold text-slate-700 text-sm mb-4">
              {isCust ? 'Müşteri Portföy Özeti' : 'Tedarikçi Portföy Özeti'}
            </h4>

            {/* Debtor ratio bar */}
            <div>
              <div className="flex justify-between text-xs font-medium text-slate-500 mb-1.5">
                <span>{isCust ? 'Borçlu Müşteri Oranı' : 'Borçlu Tedarikçi Oranı'}</span>
                <span className="font-black text-slate-800">%{debtorRatio.toFixed(1)}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-red-400 h-2 rounded-full transition-all" style={{ width: `${Math.min(debtorRatio, 100)}%` }} />
              </div>
            </div>

            <div className="pt-2 grid grid-cols-2 gap-3">
              <div className="bg-emerald-50 rounded-xl p-3 text-center">
                <UserCheck className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                <p className="text-2xl font-black text-emerald-700">{data.cleanCount}</p>
                <p className="text-xs text-emerald-600 font-semibold">{isCust ? 'Borçsuz Müşteri' : 'Alacaksız Tedarikçi'}</p>
              </div>
              <div className="bg-red-50 rounded-xl p-3 text-center">
                <UserX className="w-5 h-5 text-red-400 mx-auto mb-1" />
                <p className="text-2xl font-black text-red-600">{data.debtorCount}</p>
                <p className="text-xs text-red-500 font-semibold">{isCust ? 'Borçlu Müşteri' : 'Borçlu Tedarikçi'}</p>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3 flex justify-between items-center">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-medium">
                <PhoneCall className="w-4 h-4 text-brand-500" />
                <span>{isCust ? 'Toplam Müşteri' : 'Toplam Tedarikçi'}</span>
              </div>
              <span className="font-black text-slate-800 text-sm">{totalEntities} kayıt</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
