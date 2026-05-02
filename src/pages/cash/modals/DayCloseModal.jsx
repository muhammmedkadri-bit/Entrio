import React, { useState, useEffect } from 'react';
import toast from '../../../components/ui/CustomToast';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { cashService } from '../../../services/cashService';
import { dayCloseService } from '../../../services/dayCloseService';
import { ArrowRight, AlertTriangle, TrendingUp, TrendingDown, Moon, Plus, Trash2 } from 'lucide-react';
import { startOfDay, endOfDay } from 'date-fns';

export const DayCloseModal = ({ isOpen, onClose, allRegisters, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ income: 0, expense: 0, returns: 0 });
  const [transfers, setTransfers] = useState([
    { id: 1, sourceId: '', targetId: '', amount: '' }
  ]);

  useEffect(() => {
    if (isOpen) {
      loadStats();
      setTransfers([{ id: 1, sourceId: '', targetId: '', amount: '' }]);
    }
  }, [isOpen]);

  const loadStats = async () => {
    try {
      const preview = await dayCloseService.performDayClose({ previewOnly: true });
      if (preview) {
        setStats({
          income: preview.totalIncome,
          expense: preview.totalExpense,
          returns: 0 // İadeler artık ayrı tutulmayıp expense/income içine yansıtılıyor olabilir, ancak stats objesinde kalsın.
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDayClose = async () => {
    // Önce transferler varsa onları yap
    const validTransfers = transfers.filter(t => t.sourceId && t.targetId && t.amount);
    
    if (validTransfers.length > 0) {
      setLoading(true);
      for (const t of validTransfers) {
        const val = parseFloat(t.amount);
        if (isNaN(val) || val <= 0) {
          setLoading(false);
          return toast.error('Lütfen geçerli bir transfer tutarı girin.');
        }
        const sourceReg = allRegisters.find(r => r.id === parseInt(t.sourceId));
        if (!sourceReg || (sourceReg.current_balance || 0) < val) {
          setLoading(false);
          return toast.error(`"${sourceReg?.name || 'Seçili'}" kasasında yeterli bakiye yok.`);
        }
        try {
          await cashService.transfer(
            parseInt(t.sourceId), 
            parseInt(t.targetId), 
            val, 
            'Günsonu Kapanış Öncesi Transfer'
          );
          // Update the local balance for subsequent transfers from the same register
          sourceReg.current_balance -= val; 
        } catch (err) {
          setLoading(false);
          console.error('[DayClose] Transfer Hatası:', err);
          return toast.error('Transfer sırasında hata: ' + (err?.message || 'Bilinmeyen hata.'));
        }
      }
    }

    setLoading(true);
    try {
      await dayCloseService.performDayClose({ isAuto: false, triggeredBy: 'manual' });
      toast.success('Gün sonu işlemi başarıyla tamamlandı.');
      if (onSaved) onSaved();
      onClose();
    } catch (e) {
      console.error('[DayClose] Kapanış Hatası:', e);
      toast.error('Gün sonu kapatılırken hata oluştu: ' + (e?.message || 'Bilinmeyen hata.'));
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Günsonu Yap (Erken Kapatma)" maxWidth="max-w-xl">
      <div className="space-y-6 text-slate-700">
        
        {/* Info Alert */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-sm text-amber-800">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <p>
            <strong>Dikkat:</strong> Günü erken bitirdiğinizde kasalardaki tüm bakiyeler <strong>Genel Bakiye</strong>'ye aktarılacaktır. Kapanıştan sonra yapılacak satışlar bir sonraki günün bakiyesi olarak işlenir.
          </p>
        </div>

        {/* Daily Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-emerald-700">Brüt Satış Geliri</p>
              <p className="text-xl font-black text-emerald-600">{formatCurrency(stats.income)}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-200/50 flex items-center justify-center text-emerald-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-rose-700">Toplam Gider</p>
              <p className="text-xl font-black text-rose-600">{formatCurrency(stats.expense)}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-rose-200/50 flex items-center justify-center text-rose-600">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Return & Net Row */}
        <div className="grid grid-cols-1 gap-4 -mt-2">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-blue-700">Net Günlük Gelir</p>
              <p className="text-xl font-black text-blue-600">{formatCurrency(stats.income - stats.expense)}</p>
              <p className="text-[10px] text-blue-500 mt-0.5">Gelir − Gider</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-200/50 flex items-center justify-center text-blue-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Quick Transfer Form */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-slate-800 flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-brand-500" /> Kapanış Öncesi Hızlı Transferler
            </h4>
            {transfers.length < 4 && (
              <button 
                onClick={() => setTransfers([...transfers, { id: Date.now(), sourceId: '', targetId: '', amount: '' }])}
                className="text-xs font-bold text-brand-600 bg-brand-50 hover:bg-brand-100 px-2 py-1 rounded-md transition-colors flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Yeni Ekle
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Aynı anda 4 farklı transfer işlemine kadar giriş yapabilirsiniz.
          </p>

          <div className="space-y-4">
            {transfers.map((t, index) => (
              <div key={t.id} className="relative bg-white border border-slate-200 rounded-lg p-3">
                {transfers.length > 1 && (
                  <button 
                    onClick={() => setTransfers(transfers.filter(tr => tr.id !== t.id))}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-white border border-rose-200 text-rose-500 hover:bg-rose-50 rounded-full flex items-center justify-center shadow-sm transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Kaynak Kasa</label>
                    <select
                      value={t.sourceId}
                      onChange={e => {
                        const newT = [...transfers];
                        newT[index].sourceId = e.target.value;
                        setTransfers(newT);
                      }}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs font-semibold focus:ring-1 focus:ring-brand-500 outline-none"
                    >
                      <option value="">Seçiniz</option>
                      {allRegisters.map(r => (
                        <option key={r.id} value={r.id}>{r.name} ({formatCurrency(r.current_balance || 0)})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Hedef Kasa</label>
                    <select
                      value={t.targetId}
                      onChange={e => {
                        const newT = [...transfers];
                        newT[index].targetId = e.target.value;
                        setTransfers(newT);
                      }}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs font-semibold focus:ring-1 focus:ring-brand-500 outline-none"
                    >
                      <option value="">Seçiniz</option>
                      {allRegisters.filter(r => r.id !== parseInt(t.sourceId)).map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Tutar</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={t.amount}
                        onChange={e => {
                          const newT = [...transfers];
                          newT[index].amount = e.target.value;
                          setTransfers(newT);
                        }}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        className="w-full pl-6 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs font-bold focus:ring-1 focus:ring-brand-500 outline-none"
                      />
                      <span className="absolute left-2 top-1.5 text-slate-400 font-bold text-xs">₺</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            İptal
          </Button>
          <Button onClick={handleDayClose} isLoading={loading} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white">
            <Moon className="w-4 h-4" /> Günü Kapat ve Bakiyeleri Aktar
          </Button>
        </div>

      </div>
    </Modal>
  );
};
