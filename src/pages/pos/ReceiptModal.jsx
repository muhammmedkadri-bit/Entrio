import React, { useState, useEffect } from 'react';
import { Printer, CheckCircle, RotateCcw } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { format } from 'date-fns';
import { settingsService } from '../../services/settingsService';

export const ReceiptModal = ({ isOpen, onClose, saleDetails }) => {
  const [companyInfo, setCompanyInfo] = useState({});
  const [template, setTemplate] = useState('template_1');

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      const cInfo = await settingsService.get('company_info');
      const tInfo = await settingsService.get('receipt_template');
      if (cInfo && cInfo.value) setCompanyInfo(cInfo.value);
      if (tInfo && tInfo.value) setTemplate(tInfo.value);
    } catch (error) {
      console.error('Ayarlar yuklenemedi', error);
    }
  };

  useEffect(() => {
    const handleKeydown = (e) => {
      if (e.key === 'F4' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [isOpen, onClose]);

  if (!isOpen || !saleDetails) return null;

  const formatCurrency = (val) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);

  const printDocument = () => {
    window.print();
  };

  const footer = (
    <div className="flex gap-3 justify-end w-full print:hidden">
      <Button variant="secondary" icon={Printer} onClick={printDocument}>Yazdır</Button>
      <Button icon={RotateCcw} onClick={onClose}>Yeni Satış (F4 / ESC)</Button>
    </div>
  );

  const renderTemplate1 = () => (
    <div id="receipt-print-area" className="mx-auto max-w-sm bg-white p-4 border border-dashed border-slate-300 print:border-none print:w-full print:max-w-none print:p-0 font-mono text-sm leading-tight text-slate-800">
      <div className="text-center mb-4">
        {companyInfo.logo && <img src={companyInfo.logo} alt="Logo" className="w-16 h-16 object-contain mx-auto mb-2 grayscale" />}
        <h1 className="font-bold text-lg">{companyInfo.name || 'ENTRIO POS LTD. ŞTİ.'}</h1>
        <p className="text-xs mt-1 whitespace-pre-wrap">{companyInfo.address || 'Merkez Şube'}</p>
        {(companyInfo.tax_office || companyInfo.tax_number) && (
          <p className="text-xs mt-0.5">{companyInfo.tax_office || ''} VD: {companyInfo.tax_number || ''}</p>
        )}
        <p className="text-xs">Tel: {companyInfo.phone || '0555 555 55 55'}</p>
      </div>

      <div className="border-b border-dashed border-slate-400 pb-2 mb-2 text-xs">
        <div className="flex justify-between"><span>Tarih:</span><span>{saleDetails.created_at ? format(saleDetails.created_at, 'dd.MM.yyyy HH:mm') : '-'}</span></div>
        <div className="flex justify-between"><span>Fiş No:</span><span className="font-mono font-semibold text-indigo-600">{saleDetails.sale_number || `#${saleDetails.id}`}</span></div>
        <div className="flex justify-between"><span>Müşteri:</span><span className="truncate max-w-[150px] text-right">{saleDetails.customerName || 'Perakende Müşteri'}</span></div>
        <div className="flex justify-between"><span>Kasiyer:</span><span>{saleDetails.cashierName || 'Kasiyer'}</span></div>
      </div>

      <div className="mb-2">
        {saleDetails.items?.map((item, idx) => (
          <div key={idx} className="mb-2">
            <div className="font-semibold">{item.name || `Ürün ID: ${item.product_id}`}</div>
            <div className="flex justify-between text-xs">
              <span>{item.quantity} x {formatCurrency(item.unit_price)}</span>
              <span>{formatCurrency(item.line_total)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-dashed border-slate-400 pt-2 text-sm">
        {saleDetails.discount > 0 && (
          <div className="flex justify-between text-red-600 mb-1">
            <span>İskonto</span><span>-{formatCurrency(saleDetails.discount)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-base mt-1">
          <span>GENEL TOPLAM</span><span>{formatCurrency(saleDetails.total_amount)}</span>
        </div>
      </div>

      <div className="border-t border-b border-dashed border-slate-400 py-2 my-2 text-xs flex justify-between">
        <span>Ödeme Tipi:</span><span>{saleDetails.payment_method?.toUpperCase()}</span>
      </div>

      <div className="text-center mt-6 text-xs font-medium">
        <p>BİZİ TERCİH ETTİĞİNİZ İÇİN</p>
        <p>TEŞEKKÜR EDERİZ</p>
      </div>
    </div>
  );

  const renderTemplate2 = () => (
    <div id="receipt-print-area" className="mx-auto max-w-sm bg-white p-6 border border-slate-200 shadow-sm print:border-none print:shadow-none print:w-full font-sans text-sm text-slate-800">
      <div className="flex justify-between items-start border-b border-slate-200 pb-4 mb-4">
        <div>
          <h1 className="font-black text-xl text-slate-900 uppercase">{companyInfo.name || 'ENTRIO POS'}</h1>
          <p className="text-xs text-slate-500 mt-1 max-w-[180px]">{companyInfo.address}</p>
        </div>
        {companyInfo.logo && <img src={companyInfo.logo} alt="Logo" className="w-12 h-12 object-contain" />}
      </div>

      <div className="flex justify-between text-xs text-slate-500 mb-6">
        <div>
          <p className="font-bold text-slate-700">Tahsilat Fişi</p>
          <p>{saleDetails.sale_number || `#${saleDetails.id}`}</p>
        </div>
        <div className="text-right">
          <p>{saleDetails.created_at ? format(saleDetails.created_at, 'dd.MM.yyyy') : '-'}</p>
          <p>{saleDetails.created_at ? format(saleDetails.created_at, 'HH:mm') : '-'}</p>
        </div>
      </div>

      <div className="space-y-3 mb-6">
        {saleDetails.items?.map((item, idx) => (
          <div key={idx} className="flex justify-between items-center text-sm">
            <div className="flex-1">
              <p className="font-semibold">{item.name}</p>
              <p className="text-xs text-slate-500">{item.quantity} Adet x {formatCurrency(item.unit_price)}</p>
            </div>
            <p className="font-bold">{formatCurrency(item.line_total)}</p>
          </div>
        ))}
      </div>

      <div className="border-t-2 border-slate-900 pt-4 mb-6">
        {saleDetails.discount > 0 && (
          <div className="flex justify-between text-rose-500 font-medium mb-1 text-sm">
            <span>İndirim</span><span>-{formatCurrency(saleDetails.discount)}</span>
          </div>
        )}
        <div className="flex justify-between items-end">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Toplam Tutar</p>
            <p className="text-2xl font-black">{formatCurrency(saleDetails.total_amount)}</p>
          </div>
          <div className="text-right text-xs font-semibold text-slate-500 uppercase bg-slate-100 px-3 py-1.5 rounded-lg">
            {saleDetails.payment_method}
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-slate-400">
        <p>{companyInfo.tax_office && `${companyInfo.tax_office} VD - `}{companyInfo.tax_number}</p>
        <p className="mt-1">Teşekkürler!</p>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="İşlem Özeti"
      size="md"
      footer={footer}
    >
      <div className="flex flex-col items-center mb-6 print:hidden">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-2">
          <CheckCircle className="w-10 h-10 text-green-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Satış Tamamlandı!</h2>
        <p className="text-slate-500">Satış <span className="font-mono font-semibold text-indigo-600">{saleDetails.sale_number || `#${saleDetails.id}`}</span> başarıyla kaydedildi.</p>
      </div>

      {template === 'template_2' || template === 'template_4' ? renderTemplate2() : renderTemplate1()}
    </Modal>
  );
};
