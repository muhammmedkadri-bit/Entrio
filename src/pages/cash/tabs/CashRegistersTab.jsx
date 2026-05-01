import React, { useState } from 'react';
import { Plus, Settings } from 'lucide-react';
import { RegisterFormModal } from '../modals/RegisterFormModal';

export const CashRegistersTab = ({ registersArr, onRegistersUpdated }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);

  const formatCurrency = (val) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      
      {registersArr.map(reg => (
        <div key={reg.id} className="bg-white border-2 border-slate-100 rounded-2xl p-6 hover:border-brand-200 transition-colors shadow-sm relative group">
          <button className="absolute top-4 right-4 p-2 text-slate-300 hover:text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity">
            <Settings className="w-5 h-5" />
          </button>
          
          <h3 className="text-xl font-bold text-slate-800 mb-4">{reg.name}</h3>
          
          <div className="mb-4">
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Mevcut Bakiye</p>
            <p className={`text-3xl font-black ${reg.current_balance < 0 ? 'text-red-500' : 'text-brand-700'}`}>
              {formatCurrency(reg.current_balance)}
            </p>
          </div>

          <div className="flex gap-2">
             <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded font-mono">ID: {reg.id}</span>
             <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-1 rounded font-bold">Aktif</span>
          </div>
        </div>
      ))}

      <button 
        onClick={() => setIsFormOpen(true)}
        className="border-2 border-dashed border-slate-300 rounded-2xl p-6 flex flex-col items-center justify-center text-slate-400 hover:text-brand-600 hover:border-brand-400 hover:bg-brand-50 transition-all min-h-[200px]"
      >
        <Plus className="w-10 h-10 mb-2" />
        <span className="font-bold">Yeni Kasa Ekle</span>
      </button>

      <RegisterFormModal 
        isOpen={isFormOpen} 
        onClose={() => setIsFormOpen(false)} 
        onSaved={onRegistersUpdated}
      />
    </div>
  );
};
