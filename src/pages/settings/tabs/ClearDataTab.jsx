import React, { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { ClearDataModal } from '../modals/ClearDataModal';

export const ClearDataTab = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-800">Verileri Sil (Fabrika Ayarlarına Dön)</h2>
          <p className="text-xs text-slate-500 mt-0.5">Tüm işlemsel verileri ve kayıtları kalıcı olarak sistemden kaldırın.</p>
        </div>
      </div>

      <div className="p-8">
        <div className="max-w-2xl mx-auto border-2 border-rose-100 bg-rose-50 rounded-2xl p-6 text-center shadow-sm">
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-500">
            <AlertTriangle className="w-8 h-8" />
          </div>
          
          <h3 className="text-lg font-bold text-slate-800 mb-2">Tüm Verileri Kalıcı Olarak Sil</h3>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed max-w-xl mx-auto">
            Bu işlem; kullanıcı hesaplarınız ve temel ayarlar <strong className="text-rose-600">hariç</strong> sistemdeki <strong className="text-rose-600">her şeyi</strong> (ürünler, müşteriler, kasalar, satışlar, alışlar) silecektir. Verileriniz kalıcı olarak silinecek olup bu işlemin <strong className="font-extrabold text-rose-600">geri dönüşü yoktur</strong>.
          </p>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-all active:scale-95 shadow-md bg-rose-500 hover:bg-rose-600"
          >
            <Trash2 className="w-4.5 h-4.5" />
            Tüm Verileri Sil
          </button>
        </div>
      </div>

      <ClearDataModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};
