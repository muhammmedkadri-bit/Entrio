import React from 'react';
import { Warehouse } from 'lucide-react';

export const WarehousePlaceholderTab = () => (
  <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
    <Warehouse className="w-14 h-14 text-gray-200" />
    <h3 className="text-base font-semibold text-gray-400">Depo Stokları</h3>
    <p className="text-sm text-gray-400 max-w-xs">
      Bu özellik çok şube / depo desteğiyle birlikte aktif edilecek.
    </p>
    <span className="text-xs font-semibold bg-gray-100 text-gray-400 px-3 py-1 rounded-full">Yakında</span>
  </div>
);
