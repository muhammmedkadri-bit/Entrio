import React, { useState } from 'react';
import { startOfMonth, endOfMonth } from 'date-fns';
import { ShoppingCart, Package, Users, Landmark, BarChart2 } from 'lucide-react';
import { DateRangePicker } from './components/DateRangePicker';

import { SalesReportTab } from './tabs/SalesReportTab';
import { StockReportTab } from './tabs/StockReportTab';
import { CariReportTab } from './tabs/CariReportTab';
import { CashReportTab } from './tabs/CashReportTab';


export const ReportsPage = () => {
  const [activeTab, setActiveTab] = useState('sales');

  const [dateRange, setDateRange] = useState({
    startDate: startOfMonth(new Date()),
    endDate: endOfMonth(new Date())
  });

  const handleDateChange = (start, end) => {
    setDateRange({ startDate: start, endDate: end });
  };

  const tabs = [
    { id: 'sales',       label: 'Satış Raporları',      icon: ShoppingCart },
    { id: 'stock',       label: 'Stok ve Depo',          icon: Package },
    { id: 'cari',        label: 'Cari Hesaplar',         icon: Users },
    { id: 'cash',        label: 'Kasa (Nakit Akışı)',    icon: Landmark },

  ];

  return (
    <div className="flex flex-col h-full gap-3">

      {/* ── Single Hero Header ─────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 hide-on-print shrink-0 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#82e05a]/20 flex items-center justify-center">
                <BarChart2 className="w-5 h-5 text-[#5da83f]" />
              </div>
              Raporlar & Analizler
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Sistemdeki tüm verilerinizi gelişmiş grafiklerle izleyebilir, detaylı çıktı alabilirsiniz.
            </p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
          {/* Edge-to-edge scrollable container on mobile */}
          <div className="w-full -mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="flex space-x-2 bg-slate-100/80 p-1.5 rounded-xl overflow-x-auto hide-scrollbar snap-x snap-mandatory shrink-0 pb-1.5">
              {tabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`shrink-0 snap-start flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                    isActive
                      ? 'bg-white text-brand-700 shadow-sm border border-slate-200/50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
          
          <div
            className={`w-full sm:w-auto shrink-0 ${activeTab === 'stock' ? 'opacity-50 pointer-events-none' : ''}`}
            title={activeTab === 'stock' ? 'Stok değerlemesi her zaman güncel tutarına tabidir' : ''}
          >
            <DateRangePicker onChange={handleDateChange} defaultRange="this_month" variant="compact" />
          </div>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto pb-6">
        {activeTab === 'sales'       && <SalesReportTab    startDate={dateRange.startDate} endDate={dateRange.endDate} />}
        {activeTab === 'stock'       && <StockReportTab />}
        {activeTab === 'cari'        && <CariReportTab />}
        {activeTab === 'cash'        && <CashReportTab     startDate={dateRange.startDate} endDate={dateRange.endDate} />}

      </div>

    </div>
  );
};
