import React, { useState } from 'react';
import { FileText, Calendar, Hash, FolderOpen, Truck, ChevronDown, ChevronRight } from 'lucide-react';
import { addDays, format } from 'date-fns';

const DUE_QUICK = [
  { label: 'Aynı Gün', days: 0 },
  { label: '7 Gün',    days: 7 },
  { label: '15 Gün',   days: 15 },
  { label: '30 Gün',   days: 30 },
];

export const InvoiceDetailsCard = ({
  invoiceDate,
  dueDate,
  invoiceNumber,
  waybillNumber,
  waybillDate,
  onInvoiceDateChange,
  onDueDateChange,
  onInvoiceNumberChange,
  onWaybillNumberChange,
  onWaybillDateChange,
  readOnly = false,
}) => {
  const [waybillOpen, setWaybillOpen] = useState(false);

  const handleQuickDue = (days) => {
    if (!onDueDateChange) return;
    const base = invoiceDate ? new Date(invoiceDate) : new Date();
    onDueDateChange(format(addDays(base, days), 'yyyy-MM-dd'));
  };

  const inputClass = "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 outline-none bg-white";
  const labelClass = "block text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1";

  return (
    <>
      {/* Invoice Details Card */}
      <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-4 h-4 text-indigo-500" />
          <p className="text-sm font-semibold text-gray-700">Fatura Detayları</p>
        </div>

        <div className="space-y-3">
          {/* Invoice Date */}
          <div>
            <label className={labelClass}>
              <Calendar className="w-3.5 h-3.5" /> Fatura Tarihi
            </label>
            {readOnly ? (
              <p className="text-sm font-medium text-gray-700">{invoiceDate || '—'}</p>
            ) : (
              <input
                type="date"
                value={invoiceDate || ''}
                onChange={e => onInvoiceDateChange(e.target.value)}
                className={inputClass}
              />
            )}
          </div>

          {/* Due Date */}
          <div>
            <label className={labelClass}>
              <Calendar className="w-3.5 h-3.5" /> Vade Tarihi
            </label>
            {readOnly ? (
              <p className="text-sm font-medium text-gray-700">{dueDate || '—'}</p>
            ) : (
              <>
                <input
                  type="date"
                  value={dueDate || ''}
                  onChange={e => onDueDateChange(e.target.value)}
                  className={inputClass}
                />
                <div className="flex gap-1 flex-wrap mt-1.5">
                  {DUE_QUICK.map(opt => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => handleQuickDue(opt.days)}
                      className="text-[10px] px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-gray-500 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-colors font-medium"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Invoice Number */}
          <div>
            <label className={labelClass}>
              <Hash className="w-3.5 h-3.5" /> Tedarikçi Fatura No
            </label>
            {readOnly ? (
              <p className="text-sm font-mono text-indigo-600 font-medium">{invoiceNumber || <span className="text-gray-400 italic">—</span>}</p>
            ) : (
              <>
                <input
                  type="text"
                  value={invoiceNumber || ''}
                  onChange={e => onInvoiceNumberChange(e.target.value)}
                  placeholder="Fatura no giriniz (opsiyonel)"
                  className={`${inputClass} font-mono`}
                />
                <p className="text-[10px] text-gray-400 mt-0.5">Tedarikçi faturasındaki numarayı giriniz</p>
              </>
            )}
          </div>

          {/* Category (disabled hint) */}
          <div>
            <label className={labelClass}>
              <FolderOpen className="w-3.5 h-3.5" /> Gider Kategorisi
            </label>
            <div className="relative">
              <select disabled className={`${inputClass} opacity-50 cursor-not-allowed`}>
                <option>Seçiniz (opsiyonel)</option>
              </select>
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5">Gider kategorileri yakında aktif edilecek</p>
          </div>
        </div>
      </div>

      {/* Waybill Card (collapsible) */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm mt-3 overflow-hidden">
        <button
          type="button"
          onClick={() => setWaybillOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-blue-500" />
            <p className="text-sm font-semibold text-gray-700">İrsaliye Bilgileri</p>
            {(waybillNumber || waybillDate) && (
              <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-semibold">Dolu</span>
            )}
          </div>
          {waybillOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </button>

        {waybillOpen && (
          <div className="px-4 pb-4 space-y-3 border-t border-gray-100">
            <div>
              <label className={`${labelClass} mt-3`}>İrsaliye No</label>
              {readOnly ? (
                <p className="text-sm font-mono text-gray-700">{waybillNumber || '—'}</p>
              ) : (
                <input
                  type="text"
                  value={waybillNumber || ''}
                  onChange={e => onWaybillNumberChange(e.target.value)}
                  placeholder="Örn: ABC2024000000123"
                  className={`${inputClass} font-mono`}
                />
              )}
            </div>
            <div>
              <label className={labelClass}>İrsaliye Tarihi</label>
              {readOnly ? (
                <p className="text-sm text-gray-700">{waybillDate || '—'}</p>
              ) : (
                <input
                  type="date"
                  value={waybillDate || ''}
                  onChange={e => onWaybillDateChange(e.target.value)}
                  className={inputClass}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};
