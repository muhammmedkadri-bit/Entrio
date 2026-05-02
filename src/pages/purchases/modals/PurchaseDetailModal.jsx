import React, { useState } from 'react';
import { format } from 'date-fns';
import { CreditCard, Printer, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import toast from '../../../components/ui/CustomToast';
import { Modal } from '../../../components/ui/Modal';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { purchaseService } from '../../../services/purchaseService';

export const PurchaseDetailModal = ({ isOpen, onClose, purchase, onUpdated }) => {
  const [addingPayment, setAddingPayment] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Nakit');
  const [showCancelWarning, setShowCancelWarning] = useState(false);
  
  if (!purchase) return null;

  const formatCurrency = (val) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);
  const debt = purchase.total_amount - purchase.paid_amount;

  const handlePay = async (e) => {
    e.preventDefault();
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0 || amt > debt) {
       toast.error('Geçerli bir ödeme tutarı girin (Maks: ' + debt + ')');
       return;
    }

    try {
      await purchaseService.addPayment(purchase.id, amt, payMethod, `Borç Kapama: ${purchase.purchase_number}`);
      toast.success('Ödeme başarıyla işlendi.');
      setAddingPayment(false);
      setPayAmount('');
      onUpdated();
      onClose();
    } catch (err) {
      console.error('[PurchaseDetail] Ödeme Hatası:', err);
      toast.error(err?.message || 'Ödeme kaydedilirken hata oluştu.');
    }
  };

  const handleCancel = () => {
    setShowCancelWarning(true);
  };

  const confirmCancel = async () => {
    try {
      await purchaseService.cancel(purchase.id);
      toast.success('Alış iptal edildi.');
      onUpdated();
      onClose();
    } catch (err) {
      console.error('[PurchaseDetail] İptal Hatası:', err);
      toast.error(err?.message || 'İptal işlemi başarısız.');
    } finally {
      setShowCancelWarning(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Alış Detayı - ${purchase.purchase_number}`} size="xl">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Side: Items */}
        <div className="md:col-span-2 space-y-4">
          <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl flex items-start justify-between">
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase">Tedarikçi Bilgisi</p>
              <h3 className="text-lg font-bold text-slate-800">{purchase.supplier_name || 'Muhtelif / Belirsiz'}</h3>
              {purchase.invoice_number && (
                <p className="text-sm text-slate-600 mt-1 flex items-center gap-1">
                  <FileText className="w-4 h-4"/> Fatura No: {purchase.invoice_number}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 font-semibold uppercase">İşlem Tarihi</p>
              <p className="text-sm font-bold text-slate-800">{format(purchase.created_at, 'dd.MM.yyyy HH:mm')}</p>
              <div className="mt-2">
                {purchase.status === 'received' && <Badge variant="success"><CheckCircle className="w-3 h-3 mr-1 inline"/> Teslim Alındı</Badge>}
                {purchase.status === 'cancelled' && <Badge variant="danger"><AlertTriangle className="w-3 h-3 mr-1 inline"/> İptal Edildi</Badge>}
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-500">
                <tr>
                  <th className="p-3">Ürün</th>
                  <th className="p-3 text-center">Miktar</th>
                  <th className="p-3 text-right">Birim Fiyat</th>
                  <th className="p-3 text-right">Toplam</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(purchase.items || []).map(item => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="p-3 font-medium text-slate-800">{item.name}</td>
                    <td className="p-3 text-center">{item.quantity}</td>
                    <td className="p-3 text-right">{formatCurrency(item.unit_price)}</td>
                    <td className="p-3 text-right font-bold text-slate-800">{formatCurrency(item.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side: Totals & Payments */}
        <div className="space-y-4">
          <div className="bg-brand-50 border border-brand-100 rounded-xl p-5">
            <div className="flex justify-between items-center mb-2">
              <span className="text-slate-600">Alış Toplamı:</span>
              <span className="text-lg font-bold text-slate-800">{formatCurrency(purchase.total_amount)}</span>
            </div>
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-brand-200">
              <span className="text-slate-600">Ödenen Tutar:</span>
              <span className="text-lg font-bold text-emerald-600">{formatCurrency(purchase.paid_amount)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-800 font-bold uppercase tracking-wider text-sm">Kalan Borç:</span>
              <span className={`text-2xl font-black ${debt > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                {formatCurrency(Math.max(0, debt))}
              </span>
            </div>
          </div>

          {debt > 0 && purchase.status !== 'cancelled' ? (
            !addingPayment ? (
               <Button className="w-full" icon={CreditCard} onClick={() => setAddingPayment(true)}>Yeni Ödeme Gir</Button>
            ) : (
              <form onSubmit={handlePay} className="bg-white border text-sm border-slate-200 p-4 rounded-xl space-y-3 shadow-sm">
                <h4 className="font-bold text-slate-800 mb-2 border-b pb-1">Ödeme İşlemi</h4>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Tutar (Maks: {debt})</label>
                  <Input type="number" step="0.01" max={debt} min="0.01" value={payAmount} onChange={e => setPayAmount(e.target.value)} required autoFocus />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Yöntem</label>
                  <select className="w-full px-3 py-2 border rounded-lg focus:ring-brand-500" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                    <option>Nakit</option><option>Havale/EFT</option><option>Kredi Kartı</option>
                  </select>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="ghost" type="button" onClick={() => setAddingPayment(false)} className="flex-1">İptal</Button>
                  <Button type="submit" className="flex-1">Öde</Button>
                </div>
              </form>
            )
          ) : (
            debt <= 0 && <div className="text-center p-3 text-emerald-600 font-bold bg-emerald-50 rounded-xl border border-emerald-100">Bu fatura tamamen ödenmiştir.</div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-4">
             <Button variant="outline" icon={Printer} onClick={() => window.print()} className="flex-1">Yazdır</Button>
             {purchase.status !== 'cancelled' && (
               <Button variant="danger" onClick={handleCancel} className="flex-1">İptal Et</Button>
             )}
          </div>
        </div>

      </div>

      <Modal isOpen={showCancelWarning} onClose={() => setShowCancelWarning(false)} title="Faturayı İptal Et" size="sm">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <p className="text-sm font-semibold text-red-800">
            DİKKAT: Alış faturasını iptal ediyorsunuz.
          </p>
          <p className="text-xs text-red-700 mt-1">
            Bu işlem sonucunda faturaya bağlı <strong>stok girişleri geri alınacaktır.</strong> 
          </p>
          <p className="text-xs font-bold text-red-800 mt-2">
            İptal etmek istediğinize emin misiniz? Bu işlem geri alınamaz.
          </p>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setShowCancelWarning(false)}>Geri Dön</Button>
          <Button onClick={confirmCancel} className="bg-red-500 hover:bg-red-600 text-white border-red-500">
            Evet, İptal Et
          </Button>
        </div>
      </Modal>
    </Modal>
  );
};
