import React from 'react';
import { BarChart2 } from 'lucide-react';

export const EmptyReport = ({ message = "Seçilen tarih aralığında gösterilecek veri bulunamadı." }) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-center">
      <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 mb-4">
        <BarChart2 className="w-8 h-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-bold text-slate-700 mb-1">Veri Yok</h3>
      <p className="text-sm text-slate-500 max-w-sm">
        {message} Lütfen filtreleri kontrol edin veya farklı bir tarih seçin.
      </p>
    </div>
  );
};
