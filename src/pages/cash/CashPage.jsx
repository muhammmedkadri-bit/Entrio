import React, { useState, useEffect } from 'react';
import toast from '../../components/ui/CustomToast';
import { Wallet } from 'lucide-react';
import { cashService } from '../../services/cashService';
import { CashDashboardTab } from './tabs/CashDashboardTab';

export const CashPage = () => {
  const [registers, setRegisters] = useState([]);

  useEffect(() => {
    loadRegisters();
  }, []);

  const loadRegisters = async () => {
    try {
      const data = await cashService.getRegisters();
      setRegisters(data);
    } catch(err) {
      console.error('[CashPage] Kasalar yüklenirken hata:', err);
      toast.error(err?.message || 'Kasalar yüklenemedi.');
    }
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hide-on-print">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#82e05a]/20 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-[#5da83f]" />
            </div>
            Kasa ve Finans
          </h1>
          <p className="text-sm text-slate-500 mt-1">Nakit akışını ve tahsilatları bu menüden izleyebilirsiniz.</p>
        </div>
      </div>

      <div className="flex-1 mt-2">
        <CashDashboardTab registers={registers} onRegisterChanged={loadRegisters} />
      </div>
    </div>
  );
};
