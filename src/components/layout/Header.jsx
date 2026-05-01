import React, { useState, useEffect } from 'react';
import { Menu, Bell, Wallet } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { cashService } from '../../services/cashService';
import { Badge } from '../ui/Badge';

export const Header = () => {
  const { toggleSidebar } = useAppStore();
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    // Fetch initial balance
    const fetchBalance = async () => {
      try {
        const registers = await cashService.getRegisters();
        const main = registers.find(r => r.name === 'Ana Kasa');
        if (main) setBalance(main.current_balance);
      } catch (err) {
        console.error(err);
      }
    };
    fetchBalance();
  }, []);

  return (
    <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-6 z-30 sticky top-0 shadow-sm print:hidden">
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="lg:hidden text-slate-500 hover:text-slate-700 focus:outline-none p-2 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <Menu className="h-6 w-6" />
        </button>
        
        <h1 className="text-xl font-semibold text-slate-800 hidden sm:block">ENTRIO Çalışma Alanı</h1>
      </div>

      <div className="flex items-center gap-6">
        {/* Kasa Bakiyesi Chip */}
        <div className="hidden md:flex items-center bg-brand-50 border border-brand-100 rounded-full px-4 py-1.5 shadow-sm transform hover:scale-105 transition-transform cursor-default">
          <Wallet className="w-4 h-4 text-brand-500 mr-2" />
          <span className="text-xs font-medium text-slate-500 mr-2 uppercase tracking-wide">Kasa Bakiyesi:</span>
          <span className="text-sm font-bold text-brand-700">
            {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(balance)}
          </span>
        </div>

        {/* Notifications */}
        <button className="relative p-2 text-slate-400 hover:text-brand-500 focus:outline-none transition-colors rounded-full hover:bg-slate-100">
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
          <Bell className="h-6 w-6" />
        </button>
      </div>
    </header>
  );
};
