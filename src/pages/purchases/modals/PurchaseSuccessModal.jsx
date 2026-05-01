import React from 'react';
import { PackageCheck, Printer, CheckCircle2, Factory } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';

export const PurchaseSuccessModal = ({ isOpen, onClose, summary }) => {
  if (!summary) return null;

  const formatCurrency = (val) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" hideCloseButton>
      <div className="text-center print:text-left print:p-0">
        
        {/* Screen Only Header */}
        <div className="print:hidden">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-800 mb-1">Alış Kaydedildi</h2>
          <p className="text-slate-500 font-mono text-sm mb-6">{summary.purchase_number}</p>
        </div>

        {/* Print Layout */}
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 print:bg-white print:border-none print:p-0">
          
          <div className="hidden print:block text-center mb-6">
            <h1 className="text-2xl font-black text-black">ALIŞ FATURASI</h1>
            <p className="font-mono text-sm">{summary.purchase_number}</p>
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex justify-between items-center text-sm border-b border-slate-200 pb-2 border-dashed">
              <span className="text-slate-500 flex items-center gap-1"><Factory className="w-4 h-4"/> Tedarikçi</span>
              <span className="font-bold text-slate-800">{summary.supplier_name || 'Yok / Muhtelif'}</span>
            </div>
            {summary.invoice_number && (
              <div className="flex justify-between items-center text-sm border-b border-slate-200 pb-2 border-dashed">
                <span className="text-slate-500">Tedarikçi Fatura No</span>
                <span className="font-bold text-slate-800">{summary.invoice_number}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-sm border-b border-slate-200 pb-2 border-dashed">
              <span className="text-slate-500 flex items-center gap-1"><PackageCheck className="w-4 h-4"/> Stok Etkisi</span>
              <span className="font-bold text-emerald-600">+{summary.item_count} Kalem Ürün</span>
            </div>
            <div className="flex justify-between items-center text-lg pt-2 mt-2">
              <span className="text-slate-500 font-bold">Toplam Tutar</span>
              <span className="font-black text-slate-800">{formatCurrency(summary.total_amount)}</span>
            </div>
            <div className="flex justify-between items-center text-sm pt-1">
              <span className="text-slate-500">Kasa Ödemesi</span>
              <span className="font-bold text-slate-800">{formatCurrency(summary.paid_amount)}</span>
            </div>
            {summary.total_amount - summary.paid_amount > 0 && (
              <div className="flex justify-between items-center text-sm pt-1 pb-2">
                <span className="text-slate-500 text-red-500">Tedarikçi Borcuna Eklenen</span>
                <span className="font-bold text-red-600">{formatCurrency(summary.total_amount - summary.paid_amount)}</span>
              </div>
            )}
          </div>
          
          <div className="text-xs text-center text-slate-400 px-4 print:text-black mt-8">
            <p>Bu fiş sistem tarafından bilgi amaçlı oluşturulmuştur.</p>
            <p>{new Date().toLocaleString('tr-TR')}</p>
          </div>
        </div>

        {/* Screen Only Footer */}
        <div className="mt-6 flex gap-3 print:hidden">
          <Button variant="outline" className="flex-1" icon={Printer} onClick={() => window.print()}>Yazdır</Button>
          <Button className="flex-1" onClick={onClose}>Yeni İşlem</Button>
        </div>

      </div>
    </Modal>
  );
};
