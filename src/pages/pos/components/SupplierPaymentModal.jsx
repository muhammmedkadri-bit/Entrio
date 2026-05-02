import React, { useState, useEffect } from 'react';
import { Building2, X, Search, CreditCard, Check } from 'lucide-react';
import { supplierService } from '../../../services/supplierService';
import { db } from '../../../db';
import toast from '../../../components/ui/CustomToast';

const fmt = (v) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(v || 0);

export const SupplierPaymentModal = ({ isOpen, onClose, defaultAmount = 0, onComplete }) => {
  const [suppliers, setSuppliers]           = useState([]);
  const [query, setQuery]                   = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [registers, setRegisters]           = useState([]);
  const [selectedRegisterId, setSelectedRegisterId] = useState(null);
  const [amount, setAmount]                 = useState('');
  const [description, setDescription]       = useState('');
  const [loading, setLoading]               = useState(false);

  // Load suppliers + registers on open
  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setSelectedSupplier(null);
    setDescription('');
    setAmount(defaultAmount > 0 ? defaultAmount.toFixed(2) : '');

    Promise.all([
      supplierService.getAll(),
      db.cash_registers.filter(r => r.is_active !== false).toArray(),
    ]).then(([supList, regList]) => {
      setSuppliers(supList);
      setRegisters(regList);
      // Default: POS/card register
      const cardReg = regList.find(r => r.is_default_for === 'card') || regList[0];
      if (cardReg) setSelectedRegisterId(cardReg.id);
    });
  }, [isOpen]);

  // Keep amount in sync when cart total changes while modal is open
  useEffect(() => {
    if (isOpen && defaultAmount > 0) setAmount(defaultAmount.toFixed(2));
  }, [defaultAmount, isOpen]);

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(query.toLowerCase())
  );

  const handleSave = async () => {
    if (!selectedSupplier) { toast.error('Lütfen bir tedarikçi seçin.'); return; }
    if (!amount || parseFloat(amount) <= 0) { toast.error('Geçerli bir tutar girin.'); return; }
    if (!selectedRegisterId) { toast.error('Lütfen bir kasa seçin.'); return; }

    setLoading(true);
    try {
      await supplierService.makePayment(
        selectedSupplier.id,
        parseFloat(amount),
        'Kredi Kartı / Mail Order',
        selectedRegisterId,
        description || `POS Tedarikçi Ödemesi: ${selectedSupplier.name}`,
        false // saleService gelir hareketi oluşturacak
      );
      // Satışı tamamla — seçilen kasayı geçir (gelir aynı kasaya gidecek)
      if (onComplete) await onComplete(selectedRegisterId);
      toast.success(`${selectedSupplier.name} için ${fmt(parseFloat(amount))} ödeme kaydedildi.`);
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          boxShadow: '0 24px 64px rgba(0,0,0,0.16)',
          borderRadius: '16px',
          width: '520px', maxWidth: '95vw',
          maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
              <Building2 className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Tedarikçiye Ödeme</h2>
              <p className="text-xs text-slate-500 mt-0.5">Kasaya gelir + tedarikçiye gider olarak kaydedilir</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Content ────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Supplier selector */}
          {!selectedSupplier ? (
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-slate-700">Tedarikçi Seçin</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Tedarikçi adı ara..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 outline-none transition-all text-sm"
                />
              </div>
              <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
                {filtered.map(sup => (
                  <div
                    key={sup.id}
                    onClick={() => setSelectedSupplier(sup)}
                    className="flex items-center justify-between p-3 rounded-xl cursor-pointer border bg-white border-slate-100 hover:border-yellow-200 hover:bg-yellow-50/40 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-yellow-100/60 rounded-lg flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-yellow-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{sup.name}</p>
                        <p className={`text-xs mt-0.5 ${sup.balance > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                          Bakiyesi: {fmt(sup.balance || 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && (
                  <p className="text-center py-4 text-sm text-slate-400">Tedarikçi bulunamadı</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-yellow-700 uppercase tracking-wider">Seçili Tedarikçi</p>
                  <p className="text-base font-bold text-slate-800">{selectedSupplier.name}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSupplier(null)}
                className="px-3 py-1.5 text-xs font-bold text-yellow-700 bg-yellow-100 hover:bg-yellow-200 rounded-lg transition-colors"
              >
                Değiştir
              </button>
            </div>
          )}

          {selectedSupplier && (
            <>
              {/* Amount */}
              <div className="space-y-1.5">
                <label className="flex justify-between text-sm font-semibold text-slate-700">
                  <span>Ödeme Tutarı (₺)</span>
                  {selectedSupplier.balance > 0 && (
                    <button
                      className="text-xs text-yellow-600 hover:underline font-medium"
                      onClick={() => setAmount(selectedSupplier.balance.toFixed(2))}
                    >
                      Tüm Borcu Öde ({fmt(selectedSupplier.balance)})
                    </button>
                  )}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 text-lg font-semibold bg-white border border-slate-200 rounded-xl focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 outline-none transition-all"
                />
                {selectedSupplier.balance > 0 && (
                  <p className="text-xs text-slate-400">
                    Mevcut Borç: {fmt(selectedSupplier.balance)}
                  </p>
                )}
              </div>

              {/* Payment method — only card */}
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-700">Ödeme Yöntemi</label>
                <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                  <CreditCard className="w-5 h-5 text-blue-600 shrink-0" />
                  <span className="text-sm font-semibold text-blue-700">Kredi Kartı / Mail Order</span>
                </div>
              </div>

              {/* Register selector */}
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-700">Kasa Seçin</label>
                <div className="grid grid-cols-2 gap-2">
                  {registers.map(reg => (
                    <button
                      key={reg.id}
                      onClick={() => setSelectedRegisterId(reg.id)}
                      className={`flex flex-col items-start gap-0.5 p-3 rounded-xl border text-left transition-all ${
                        selectedRegisterId === reg.id
                          ? 'bg-yellow-50 border-yellow-300 text-yellow-800'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-xs font-bold">{reg.name}</span>
                      <span className="text-[11px] opacity-60">{fmt(reg.current_balance)}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-700">Açıklama (opsiyonel)</label>
                <input
                  type="text"
                  placeholder="Fatura no vb."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 outline-none"
                />
              </div>

              {/* Summary */}
              {parseFloat(amount) > 0 && selectedRegisterId && (
                <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 text-sm space-y-1.5">
                  <div className="flex justify-between text-yellow-900">
                    <span className="opacity-70">Tedarikçi:</span>
                    <span className="font-semibold">{selectedSupplier.name}</span>
                  </div>
                  <div className="flex justify-between text-yellow-900">
                    <span className="opacity-70">Kasa → Gelir:</span>
                    <span className="font-semibold text-emerald-600">+{fmt(parseFloat(amount))}</span>
                  </div>
                  <div className="flex justify-between text-yellow-900">
                    <span className="opacity-70">Kasa → Gider:</span>
                    <span className="font-semibold text-red-500">-{fmt(parseFloat(amount))}</span>
                  </div>
                  <div className="flex justify-between pt-2 mt-1 border-t border-yellow-200 text-yellow-900">
                    <span className="opacity-70">Tedarikçi Kalan Borç:</span>
                    <span className="font-bold">
                      {fmt(Math.max((selectedSupplier.balance || 0) - parseFloat(amount), 0))}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────────── */}
        <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/60 rounded-b-[16px]">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            İptal
          </button>
          <button
            onClick={handleSave}
            disabled={!selectedSupplier || !amount || parseFloat(amount) <= 0 || !selectedRegisterId || loading}
            className="flex items-center gap-2 px-6 py-2 text-sm font-semibold text-white bg-yellow-500 rounded-xl shadow-sm hover:bg-yellow-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <Check className="w-4 h-4" />
            {loading ? 'İşleniyor...' : 'Ödemeyi Kaydet ve Satışı Tamamla'}
          </button>
        </div>
      </div>
    </div>
  );
};
