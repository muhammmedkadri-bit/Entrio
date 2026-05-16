import React, { useState, useRef, useEffect } from 'react';
import toast from '../../../components/ui/CustomToast';
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, addDays, isSameDay, isSameMonth, isToday, startOfDay
} from 'date-fns';
import { tr } from 'date-fns/locale';
import { Modal } from '../../../components/ui/Modal';
import { cashService } from '../../../services/cashService';
import {
  Trash2, Edit2, Info, Wallet, CalendarDays, CreditCard,
  AlignLeft, X, ChevronDown, ChevronLeft, ChevronRight, ArrowRightLeft
} from 'lucide-react';

/* ─── Styles ──────────────────────────────────────────────────────────── */
const inputCls =
  'w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400 transition-all';
const labelCls = 'flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-1';
const glassBase =
  'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold backdrop-blur-sm border transition-all active:scale-95 outline-none select-none';

/* ─── Kompakt Inline Calendar ─────────────────────────────────────────── */
function CompactCalendar({ date, onChange }) {
  const [current, setCurrent] = useState(date || new Date());

  let days = [];
  let d = startOfWeek(startOfMonth(current), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(current), { weekStartsOn: 1 });
  while (d <= end) { days.push(d); d = addDays(d, 1); }

  return (
    <div className="border border-slate-200 rounded-xl bg-white p-2.5 shadow-sm">
      {/* Nav */}
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => setCurrent(subMonths(current, 1))}
          className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500">
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-[11px] font-bold text-slate-600 capitalize">
          {format(current, 'MMMM yyyy', { locale: tr })}
        </span>
        <button type="button" onClick={() => setCurrent(addMonths(current, 1))}
          className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500">
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'].map(h => (
          <div key={h} className="text-center text-[9px] font-bold text-slate-400">{h}</div>
        ))}
      </div>
      {/* Cells */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map(day => {
          const sel = date && isSameDay(day, date);
          const today = isToday(day);
          const inMonth = isSameMonth(day, current);
          return (
            <button key={day.toISOString()} type="button"
              onClick={() => onChange(startOfDay(day))}
              className={[
                'flex items-center justify-center text-[11px] rounded-full h-6 w-full transition-colors',
                !inMonth ? 'opacity-30' : '',
                sel ? 'bg-[#5da83f] text-white font-bold' : '',
                !sel && today ? 'bg-emerald-50 text-[#5da83f] font-bold' : '',
                !sel && !today && inMonth ? 'hover:bg-slate-100 text-slate-700' : '',
              ].join(' ')}>
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Register Dropdown ───────────────────────────────────────────────── */
function RegisterDropdown({ options = [], value, onChange, placeholder = 'Kasa Seçiniz...' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const selected = options.find(o => o.id === value);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(v => !v)}
        className={`${inputCls} flex items-center justify-between gap-2 cursor-pointer`}>
        <span className={selected ? 'text-slate-800' : 'text-slate-400'}>
          {selected ? selected.name : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 flex-shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-36 overflow-y-auto">
          {options.map(o => (
            <button key={o.id} type="button"
              onClick={() => { onChange(o.id); setOpen(false); }}
              className={`w-full px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-slate-50 ${value === o.id ? 'text-[#5da83f] bg-emerald-50/50' : 'text-slate-700'}`}>
              {o.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Ana Modal ─────────────────────────────────────────────────────────── */
export const TransactionDetailModal = ({ isOpen, onClose, transaction, onSaved, allRegisters = [] }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCal, setShowCal] = useState(false);
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [editData, setEditData] = useState({
    amount: 0, notes: '', date: null, register_id: '',
    // transfer için
    source_register_id: '', target_register_id: ''
  });

  useEffect(() => {
    if (transaction) {
      setEditData({
        amount: transaction.amount || 0,
        notes: transaction.notes || '',
        date: new Date(transaction.created_at),
        register_id: transaction.register_id || '',
        source_register_id: transaction.register_id || '',
        target_register_id: ''
      });
      setIsEditing(false);
      setShowCal(false);
    }
  }, [transaction]);

  if (!transaction) return null;

  const isRetailSale = transaction.transaction_type === 'sale_in';
  const isReturn = transaction.transaction_type === 'return_out' || transaction.transaction_type === 'return_in';
  const isDayClose = transaction.transaction_type === 'day_close';
  const isTransfer = transaction.transaction_type === 'transfer_out' || transaction.transaction_type === 'transfer_in';
  const isOut = ['purchase_out', 'supplier_payment_out', 'expense_out', 'withdrawal_out', 'transfer_out']
    .includes(transaction.transaction_type);

  // Only allow editing manual income/expense and transfers
  const isReadOnly = !['deposit_in', 'expense_out', 'withdrawal_out', 'transfer_in', 'transfer_out'].includes(transaction.transaction_type);

  const formatCurrency = (val) =>
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);
  const fmtDate = (ts) => {
    try { return format(new Date(ts), 'd MMMM yyyy HH:mm', { locale: tr }); } catch { return '—'; }
  };

  const handleDeleteClick = () => {
    setShowDeleteWarning(true);
  };

  const confirmDelete = async () => {
    setLoading(true);
    try {
      await cashService.deleteTransaction(transaction.id);
      toast.success('Hareket silindi, kasa bakiyeleri güncellendi.');
      onSaved(); onClose();
    } catch (e) { 
      console.error('[TransactionDetail] Silme Hatası:', e);
      toast.error(e?.message || 'Silme işlemi sırasında hata oluştu.'); 
    }
    finally { 
      setLoading(false); 
      setShowDeleteWarning(false);
    }
  };

  // Transfer düzenleme: eski transferi sil, yenisini oluştur
  const handleTransferUpdate = async () => {
    if (!editData.source_register_id || !editData.target_register_id)
      return toast.error('Kaynak ve hedef kasayı seçiniz.');
    if (editData.source_register_id === editData.target_register_id)
      return toast.error('Kaynak ve hedef kasa aynı olamaz.');
    if (!editData.amount || editData.amount <= 0)
      return toast.error('Geçerli bir tutar giriniz.');
    setLoading(true);
    try {
      // 1. Mevcut transfer çiftini sil (bakiyeyi geri alır)
      await cashService.deleteTransaction(transaction.id);
      // 2. Yeni transfer oluştur
      await cashService.transfer(
        Number(editData.source_register_id),
        Number(editData.target_register_id),
        parseFloat(editData.amount),
        editData.notes || 'Transfer (Düzeltme)'
      );
      toast.success('Transfer hareketi güncellendi.');
      onSaved(); onClose();
    } catch (e) { 
      console.error('[TransactionDetail] Transfer Güncelleme Hatası:', e);
      toast.error(e?.message || 'Transfer güncellenirken hata oluştu.'); 
    }
    finally { setLoading(false); }
  };

  const handleUpdate = async () => {
    if (isTransfer) return handleTransferUpdate();
    if (!editData.amount || editData.amount <= 0) return toast.error('Geçerli bir tutar giriniz.');
    setLoading(true);
    try {
      await cashService.updateTransaction(transaction.id, {
        amount: parseFloat(editData.amount),
        notes: editData.notes,
        created_at: editData.date ? editData.date.getTime() : transaction.created_at,
        register_id: Number(editData.register_id)
      });
      toast.success('Hareket güncellendi.');
      setIsEditing(false); onSaved(); onClose();
    } catch (e) { 
      console.error('[TransactionDetail] Güncelleme Hatası:', e);
      toast.error(e?.message || 'Hareket güncellenirken hata oluştu.'); 
    }
    finally { setLoading(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Hareket Detayı" size="md">
      <div className="space-y-4">

        {/* ── Tutar Banner ── */}
        <div className={`p-4 rounded-2xl flex flex-col items-center justify-center text-center ${isOut ? 'bg-rose-50' : 'bg-emerald-50'}`}>
          <div className="text-xs font-bold text-slate-500 mb-1 uppercase tracking-widest">
            {transaction.registerName || 'Kasa Hareketi'}
          </div>
          <div className={`text-3xl font-black ${isOut ? 'text-rose-600' : 'text-[#5da83f]'}`}>
            {isOut ? '-' : '+'}{formatCurrency(transaction.amount)}
          </div>
          <div className="mt-2 text-xs font-semibold text-slate-400 bg-white px-3 py-1 rounded-full shadow-sm border border-slate-100">
            {fmtDate(transaction.created_at)}
          </div>
        </div>

        {/* ── Parçalı Ödeme Kırılımları ── */}
        {transaction.isGrouped && transaction.siblings && transaction.siblings.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mt-4 shadow-sm">
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Tahsilat Kırılımı</span>
            </div>
            <div className="divide-y divide-slate-100">
              {transaction.siblings.map(sib => (
                <div key={sib.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                  <div className="flex flex-col">
                    <span className="text-[13px] font-semibold text-slate-700">{sib.registerName}</span>
                    <span className="text-[11px] font-medium text-slate-400 mt-0.5">{sib.notes}</span>
                  </div>
                  <span className={`text-sm font-bold ${isOut ? 'text-rose-600' : 'text-[#5da83f]'}`}>
                    {isOut ? '-' : '+'}{formatCurrency(sib.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Perakende uyarısı ── */}
        {isRetailSale && (
          <div className="bg-blue-50/50 border border-blue-200/60 text-blue-700 p-3 rounded-xl flex gap-3 items-start text-sm">
            <Info className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-500" />
            <p>Bu bir Perakende Satış işlemidir. Manuel olarak düzenlenemez veya silinemez.</p>
          </div>
        )}

        {/* ── İade uyarısı ── */}
        {isReturn && (
          <div className="bg-orange-50/60 border border-orange-200/60 text-orange-700 p-3 rounded-xl flex gap-3 items-start text-sm">
            <Info className="w-5 h-5 flex-shrink-0 mt-0.5 text-orange-500" />
            <p>Bu bir İade işlemidir. Satış iadesi üzerinden otomatik oluşturulduğu için düzenlenemez veya silinemez.</p>
          </div>
        )}

        {/* ── Günsonu uyarısı ── */}
        {isDayClose && (
          <div className="bg-blue-50/60 border border-blue-200/60 text-blue-700 p-3 rounded-xl flex gap-3 items-start text-sm">
            <Info className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-500" />
            <p>Bu bir Günsonu Kapanışı kaydıdır. Sistem tarafından otomatik oluşturulduğu için düzenlenemez veya silinemez.</p>
          </div>
        )}

        {/* ── Görünüm Modu ── */}
        {!isEditing && (
          <div>
            <label className={labelCls}>
              <AlignLeft className="w-4 h-4 text-slate-400" /> Açıklama / Not
            </label>
            <div className={`${inputCls} cursor-default`}>
              {transaction.notes || <span className="text-slate-400 italic">Açıklama girilmemiş.</span>}
            </div>
          </div>
        )}

        {/* ── Düzenleme Modu ── */}
        {isEditing && (
          <div className="space-y-3">

            {/* Transfer düzenleme */}
            {isTransfer ? (
              <>
                <div className="bg-amber-50 border border-amber-200/60 text-amber-700 p-3 rounded-xl flex gap-2 items-start text-xs">
                  <ArrowRightLeft className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p>Transfer düzenlendiğinde mevcut hareket iptal edilir ve yeniden oluşturulur. Her iki kasanın bakiyesi otomatik güncellenir.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}><Wallet className="w-4 h-4 text-slate-400" /> Çıkış Kasası</label>
                    <RegisterDropdown
                      options={allRegisters}
                      value={Number(editData.source_register_id) || undefined}
                      onChange={(val) => setEditData({ ...editData, source_register_id: val })}
                      placeholder="Çıkış Kasası..."
                    />
                  </div>
                  <div>
                    <label className={labelCls}><Wallet className="w-4 h-4 text-slate-400" /> Giriş Kasası</label>
                    <RegisterDropdown
                      options={allRegisters}
                      value={Number(editData.target_register_id) || undefined}
                      onChange={(val) => setEditData({ ...editData, target_register_id: val })}
                      placeholder="Giriş Kasası..."
                    />
                  </div>
                </div>

                <div>
                  <label className={labelCls}><CreditCard className="w-4 h-4 text-slate-400" /> Tutar (₺)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm select-none">₺</span>
                    <input type="number" step="0.01" value={editData.amount}
                      onChange={e => setEditData({ ...editData, amount: e.target.value })}
                      className={`${inputCls} pl-7 font-bold tabular-nums`} placeholder="0.00" />
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Normal düzenleme */}
                <div>
                  <label className={labelCls}><AlignLeft className="w-4 h-4 text-slate-400" /> Açıklama / Not</label>
                  <input type="text" value={editData.notes}
                    onChange={e => setEditData({ ...editData, notes: e.target.value })}
                    className={inputCls} placeholder="İşlem açıklaması girin..." />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}><Wallet className="w-4 h-4 text-slate-400" /> Kasa</label>
                    <RegisterDropdown
                      options={allRegisters}
                      value={Number(editData.register_id) || undefined}
                      onChange={(val) => setEditData({ ...editData, register_id: val })}
                    />
                  </div>
                  <div>
                    <label className={labelCls}><CalendarDays className="w-4 h-4 text-slate-400" /> Tarih</label>
                    <button type="button" onClick={() => setShowCal(v => !v)}
                      className={`${inputCls} flex items-center gap-2 cursor-pointer text-left w-full`}>
                      <CalendarDays className={`w-4 h-4 flex-shrink-0 ${showCal ? 'text-[#5da83f]' : 'text-slate-400'}`} />
                      <span className="truncate text-sm">
                        {editData.date ? format(editData.date, 'd MMM yyyy', { locale: tr }) : 'Tarih Seç'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Kompakt inline takvim */}
                {showCal && (
                  <CompactCalendar
                    date={editData.date}
                    onChange={(d) => { setEditData({ ...editData, date: d }); setShowCal(false); }}
                  />
                )}

                <div>
                  <label className={labelCls}><CreditCard className="w-4 h-4 text-slate-400" /> Tutar (₺)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm select-none">₺</span>
                    <input type="number" step="0.01" value={editData.amount}
                      onChange={e => setEditData({ ...editData, amount: e.target.value })}
                      className={`${inputCls} pl-7 font-bold tabular-nums`} placeholder="0.00" />
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Butonlar ── */}
        {!isReadOnly && (
          <div className="flex gap-3 pt-3 border-t border-slate-100">
            {isEditing ? (
              <>
                {/* İptal */}
                <button type="button" onClick={() => { setIsEditing(false); setShowCal(false); }}
                  disabled={loading}
                  className={`${glassBase} bg-white/60 text-slate-700 border-slate-200/80`}>
                  <X className="w-4 h-4" /> İptal
                </button>
                {/* Kaydet (transfer'da "Uygula") */}
                <button type="button" onClick={handleUpdate} disabled={loading}
                  className={`${glassBase} bg-[#5da83f]/12 text-[#3d7a28] border-[#5da83f]/25`}>
                  {loading ? 'Uygulanıyor...' : isTransfer ? '✓ Uygula' : '✓ Kaydet'}
                </button>
              </>
            ) : (
              <>
                {/* Sil — rose glass */}
                <button type="button" onClick={handleDeleteClick} disabled={loading}
                  className={`${glassBase} bg-rose-500/10 text-rose-700 border-rose-400/25`}>
                  <Trash2 className="w-4 h-4" />
                  Sil
                </button>
                {/* Düzenle — yeşil glass */}
                <button type="button" onClick={() => setIsEditing(true)}
                  className={`${glassBase} bg-[#5da83f]/10 text-[#3d7a28] border-[#5da83f]/25`}>
                  <Edit2 className="w-4 h-4" /> Düzenle
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <Modal isOpen={showDeleteWarning} onClose={() => setShowDeleteWarning(false)} title="İşlemi Sil" size="sm">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <p className="text-sm font-semibold text-red-800">
            DİKKAT: Bu kasa hareketini siliyorsunuz.
          </p>
          <p className="text-xs text-red-700 mt-1">
            Bu işlem sonucunda kasanın bakiyesi otomatik olarak geri alınacaktır. 
            Bu işlem kalıcıdır ve geri döndürülemez.
          </p>
          <p className="text-xs font-bold text-red-800 mt-2">
            Silmek istediğinize emin misiniz?
          </p>
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => setShowDeleteWarning(false)} className="px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 font-semibold text-sm transition-colors">İptal</button>
          <button onClick={confirmDelete} disabled={loading} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold text-sm transition-colors">
            {loading ? 'Siliniyor...' : 'Evet, Sil'}
          </button>
        </div>
      </Modal>
    </Modal>
  );
};
