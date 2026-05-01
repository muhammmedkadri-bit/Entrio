import React from 'react';
import { AlertTriangle } from 'lucide-react';

export const CriticalStockBanner = ({ lowStockCount, onClick }) => {
  if (!lowStockCount || lowStockCount === 0) return null;

  return (
    <div 
      onClick={onClick}
      className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-4 rounded-r-lg shadow-sm cursor-pointer hover:bg-amber-100 transition-colors flex items-center justify-between group"
    >
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
        </div>
        <div className="ml-3">
          <p className="text-sm text-amber-700 font-medium">
            Dikkat: {lowStockCount} adet ürün kritik stok seviyesinin altında veya tükendi.
          </p>
        </div>
      </div>
      <div>
        <span className="text-xs font-semibold text-amber-600 group-hover:underline">
          Hemen İncele →
        </span>
      </div>
    </div>
  );
};
