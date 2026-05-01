import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { cashService } from '../../services/cashService';
import { CashDashboardTab } from './tabs/CashDashboardTab';

export const CashPage = () => {
  const [registers, setRegisters] = useState([]);

  const loadRegisters = async () => {
    try {
      const data = await cashService.getRegisters();
      setRegisters(data);
    } catch(err) {
      console.error('[CashPage] Kasalar yüklenirken hata:', err);
      toast.error(err?.message || 'Kasalar yüklenemedi.');
    }
  };

  useEffect(() => {
    loadRegisters();
  }, []);

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hide-on-print">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Kasa ve Finans</h1>
          <p className="text-sm text-slate-500 mt-1">Nakit akışını ve tahsilatları bu menüden izleyebilirsiniz.</p>
        </div>
      </div>

      <div className="flex-1 mt-2">
        <CashDashboardTab registers={registers} onRegisterChanged={loadRegisters} />
      </div>
    </div>
  );
};
