import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';
import { useCacheStore } from '../../store/cacheStore';
import toast from '../../components/ui/CustomToast';
import {
  ArrowLeft, Building2, Phone, Mail, MapPin, ChevronDown, ArrowUpRight,
  ArrowDownLeft, Edit, Printer, Trash2, Layers, FileText, MoreVertical
} from 'lucide-react';
import { supplierService } from '../../services/supplierService';
import { Button } from '../../components/ui/Button';
import { PremiumLoader } from '../../components/ui/PremiumLoader';
import { SupplierTransactionsTab } from './tabs/detail/SupplierTransactionsTab';
import { Modal } from '../../components/ui/Modal';
import { SupplierFormModal } from './modals/SupplierFormModal';
import { PaymentModal } from './modals/PaymentModal';
import { SupplierCollectionModal } from './modals/SupplierCollectionModal';

const fmt = (v) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(v || 0);

const TABS = [{ id: 'transactions', label: 'Hesap Hareketleri', icon: Layers }];

export const SupplierDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { startNavigation } = useAppStore();
  const supplierId = parseInt(id);

  const [supplier, setSupplier]     = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState('transactions');
  const [showOtherMenu, setShowOtherMenu] = useState(false);
  const [showEdit, setShowEdit]     = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showCollection, setShowCollection] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const mobileMenuRef  = useRef(null);
  const desktopMenuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      const inM = mobileMenuRef.current  && mobileMenuRef.current.contains(e.target);
      const inD = desktopMenuRef.current && desktopMenuRef.current.contains(e.target);
      if (!inM && !inD) setShowOtherMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const setCache           = useCacheStore(s => s.setCache);
  const isSuppliersValid   = useCacheStore(s => s._cache['suppliers']?.valid);
  const isTxsValid         = useCacheStore(s => s._cache['supplier_transactions']?.valid);

  useEffect(() => {
    if (isSuppliersValid === false || isTxsValid === false) loadData();
  }, [isSuppliersValid, isTxsValid]);

  const loadData = async () => {
    setLoading(true);
    try {
      const s   = await supplierService.getById(supplierId);
      const txs = await supplierService.getTransactions(supplierId);
      setSupplier(s);
      setTransactions(txs);
      setCache('supplier_transactions', { dummy: true });
    } catch (err) {
      console.error('[SupplierDetail] Veri Yükleme Hatası:', err);
      toast.error(err?.message || 'Tedarikçi detayları alınamadı.');
      navigate('/suppliers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [supplierId]);

  const handleDelete = async () => {
    setDeleteSaving(true);
    try {
      await supplierService.delete(supplierId);
      toast.success('Tedarikçi silindi.');
      navigate('/suppliers');
    } catch (e) {
      toast.error(e?.message || 'Tedarikçi silinirken hata oluştu.');
    } finally {
      setDeleteSaving(false);
    }
  };

  const bal      = parseFloat(supplier?.balance) || 0;
  // Supplier balance semantics: positive = we owe them, negative = they owe us
  const balColor = bal > 0 ? 'text-rose-500' : bal < 0 ? 'text-emerald-600' : 'text-slate-700';
  const balLabel = bal > 0 ? 'Biz Borçluyuz' : bal < 0 ? 'Alacaklıyız' : 'Dengede';

  const OtherMenu = () => (
    <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden min-w-[160px]">
      <button onClick={() => { setShowEdit(true); setShowOtherMenu(false); }}
        className="flex items-center gap-2.5 w-full px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
        <Edit className="w-4 h-4 text-blue-500" /> Düzenle
      </button>
      <button onClick={() => { window.print(); setShowOtherMenu(false); }}
        className="flex items-center gap-2.5 w-full px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
        <Printer className="w-4 h-4 text-slate-400" /> Yazdır
      </button>
      <div className="border-t border-slate-100" />
      <button onClick={() => { setShowDelete(true); setShowOtherMenu(false); }}
        className="flex items-center gap-2.5 w-full px-4 py-3 text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors">
        <Trash2 className="w-4 h-4" /> Sil
      </button>
    </div>
  );

  const ActionBtn = ({ full = false }) => {
    const cls = `${full ? 'w-full' : ''} flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all active:scale-[0.98]`;
    if (bal < 0) return (
      <button onClick={() => setShowCollection(true)} className={cls}
        style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: 'rgb(4,120,87)' }}>
        <ArrowDownLeft className="w-4 h-4" /> Tahsilat Al
      </button>
    );
    return (
      <button onClick={() => setShowPayment(true)} className={cls}
        style={bal > 0
          ? { background: 'rgba(93,168,63,0.12)', border: '1px solid rgba(130,224,90,0.35)', color: '#3d7a28' }
          : { background: 'rgba(148,163,184,0.12)', border: '1px solid rgba(148,163,184,0.3)', color: 'rgb(100,116,139)' }
        }>
        <ArrowUpRight className="w-4 h-4" /> Ödeme Yap
      </button>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <PremiumLoader />
      </div>
    );
  }

  if (!supplier) return null;

  return (
    <div className="flex flex-col gap-3 pb-20 sm:pb-4">

      {/* ── Back button ── */}
      <div className="print:hidden">
        <button
          onClick={() => { startNavigation(); setTimeout(() => navigate('/suppliers'), 150); }}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors bg-white/60 backdrop-blur border border-white/60 shadow-sm px-3 py-1.5 rounded-xl"
        >
          <ArrowLeft className="w-4 h-4" /> Tedarikçiler
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          MOBILE HERO  ·  < 640 px
      ══════════════════════════════════════════════════════════════ */}
      <div className="block sm:hidden print:hidden bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

        {/* Row 1 — Avatar / Name / Contact / ⋮ */}
        <div className="flex items-start gap-3 p-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 mt-0.5">
            <Building2 className="w-6 h-6 text-blue-500" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-black text-slate-900 leading-snug truncate">{supplier.name}</h1>
            <div className="flex flex-col gap-0.5 mt-1">
              {supplier.phone && (
                <span className="flex items-center gap-1 text-xs text-slate-500 font-medium">
                  <Phone className="w-3 h-3 text-slate-400 shrink-0" />{supplier.phone}
                </span>
              )}
              {supplier.email && (
                <span className="flex items-center gap-1 text-xs text-slate-500 font-medium">
                  <Mail className="w-3 h-3 text-slate-400 shrink-0" />{supplier.email}
                </span>
              )}
              {supplier.address && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <MapPin className="w-3 h-3 shrink-0" />{supplier.address}
                  {(supplier.district || supplier.city) && ` (${[supplier.district, supplier.city].filter(Boolean).join(', ')})`}
                </span>
              )}
              {supplier.tax_number && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <FileText className="w-3 h-3 shrink-0" />
                  <span className="font-bold text-slate-400 text-[10px] uppercase">VKN/TC:</span> {supplier.tax_number}
                </span>
              )}
            </div>
          </div>
          <div className="relative shrink-0" ref={mobileMenuRef}>
            <button onClick={() => setShowOtherMenu(v => !v)}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors">
              <MoreVertical className="w-4 h-4" />
            </button>
            {showOtherMenu && <OtherMenu />}
          </div>
        </div>

        {/* Row 2 — Balance */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-b border-slate-100">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Güncel Bakiye</span>
          <span className={`text-lg font-black tabular-nums ${balColor}`}>
            {fmt(Math.abs(bal))}
            <span className="text-[11px] font-semibold ml-1.5 opacity-70">({balLabel})</span>
          </span>
        </div>

        {/* Row 3 — Action button */}
        <div className="p-3">
          <ActionBtn full />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          DESKTOP HERO  ·  ≥ 640 px
      ══════════════════════════════════════════════════════════════ */}
      <div className="hidden sm:block print:block rounded-2xl border p-5"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(240,249,255,0.8) 100%)',
          backdropFilter: 'blur(20px)',
          borderColor: 'rgba(56,189,248,0.15)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="p-3 rounded-2xl flex-shrink-0 border"
              style={{ background: 'rgba(56,189,248,0.15)', backdropFilter: 'blur(12px)', borderColor: 'rgba(56,189,248,0.3)', boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.4)' }}>
              <Building2 className="w-9 h-9" style={{ color: '#0284c7' }} strokeWidth={1.5} />
            </div>
            <div className="flex flex-col gap-1.5">
              <h1 className="text-xl font-bold text-gray-900">{supplier.name}</h1>
              <div className="text-sm text-slate-600 flex items-center gap-1.5">
                {supplier.address || '-'}
                {(supplier.city || supplier.district) && (
                  <span className="text-slate-500 font-medium ml-1">
                    ({supplier.district ? `${supplier.district}, ` : ''}{supplier.city})
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-500">
                {supplier.phone && (
                  <span className="flex items-center gap-1 font-mono bg-white/60 px-2.5 py-1 rounded-full border border-gray-100 shadow-sm text-slate-500">
                    <Phone className="w-3.5 h-3.5 text-gray-400" /> {supplier.phone}
                  </span>
                )}
                {supplier.email && (
                  <span className="flex items-center gap-1 font-medium bg-white/60 px-2.5 py-1 rounded-full border border-gray-100 shadow-sm text-slate-500">
                    <Mail className="w-3.5 h-3.5 text-gray-400" /> {supplier.email}
                  </span>
                )}
                {supplier.tax_number && (
                  <span className="flex items-center gap-1 font-mono bg-white/60 px-2.5 py-1 rounded-full border border-gray-100 shadow-sm text-slate-500">
                    <FileText className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase mr-0.5">VKN/TC:</span> {supplier.tax_number}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-4 print:hidden w-full md:w-auto mt-4 md:mt-0">
            <div className="flex items-center gap-3 justify-end">
              <ActionBtn />
              <div className="relative" ref={desktopMenuRef}>
                <button onClick={() => setShowOtherMenu(v => !v)}
                  className="flex items-center justify-center gap-2 px-4 py-2 h-10 text-sm font-medium rounded-xl border bg-white/60 text-gray-600 border-gray-200 hover:bg-gray-50 transition-all">
                  Diğer <ChevronDown className={`w-4 h-4 transition-transform ${showOtherMenu ? 'rotate-180' : ''}`} />
                </button>
                {showOtherMenu && <OtherMenu />}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 text-right pt-2 border-t border-sky-100/60 w-full">
              <span className="text-sm font-bold text-slate-500">Güncel Bakiye:</span>
              <span className={`text-2xl font-black tracking-tight ${balColor}`}>
                {fmt(Math.abs(bal))}
                <span className="text-sm font-bold ml-1">({balLabel})</span>
              </span>
            </div>
          </div>
        </div>

        <div className="hidden print:block mb-8 text-center border-b-2 border-black pb-4 mt-8">
          <h1 className="text-2xl font-black mb-1">Cari Hesap Ekstresi (Tedarikçi)</h1>
          <div className="flex justify-between items-center px-4 mt-4">
            <p className="text-sm font-semibold">{supplier.name}</p>
            <div className="text-right">
              <span className="text-sm font-bold mr-2">Bakiye:</span>
              <span className={`font-black ${bal > 0 ? 'text-red-600' : bal < 0 ? 'text-emerald-600' : 'text-black'}`}>
                {fmt(Math.abs(bal))} {bal > 0 ? '(Biz Borçluyuz)' : bal < 0 ? '(Alacaklıyız)' : ''}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab Navigation ── */}
      <div className="flex gap-1 border-b border-gray-100 print:hidden">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all duration-150 border-b-2 -mb-px ${
                isActive ? 'border-sky-500 text-sky-600 bg-sky-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}>
              <Icon className="w-4 h-4" /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ── */}
      <div className="bg-white p-3 sm:p-4 rounded-b-xl border border-gray-100 border-t-0 print:border-none print:p-0">
        {activeTab === 'transactions' && <SupplierTransactionsTab transactions={transactions} />}
      </div>

      {/* ── Modals ── */}
      <SupplierFormModal isOpen={showEdit} onClose={() => setShowEdit(false)} supplierToEdit={supplier}
        onSaved={() => { loadData(); toast.success('Tedarikçi güncellendi.'); }} />
      <PaymentModal isOpen={showPayment} onClose={() => setShowPayment(false)} supplier={supplier} onSaved={loadData} />
      <SupplierCollectionModal isOpen={showCollection} onClose={() => setShowCollection(false)} supplier={supplier} onSaved={loadData} />
      <Modal isOpen={showDelete} onClose={() => setShowDelete(false)} title="Tedarikçiyi Sil" size="sm">
        <p className="text-sm text-gray-600 mb-6">Bu tedarikçi kalıcı olarak silinecek. Tüm geçmiş hareketleri kaybolur. Bu işlem geri alınamaz.</p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setShowDelete(false)}>İptal</Button>
          <Button onClick={handleDelete} isLoading={deleteSaving} className="bg-red-500 hover:bg-red-600 text-white border-red-500">Sil</Button>
        </div>
      </Modal>
    </div>
  );
};
