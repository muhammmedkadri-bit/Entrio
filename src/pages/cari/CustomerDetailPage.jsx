import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';
import toast from '../../components/ui/CustomToast';
import {
  ArrowLeft, User, Phone, Mail, MapPin, ChevronDown, HandCoins, Edit, Printer, Trash2, Layers, ArrowDownLeft, ArrowUpLeft, FileText
} from 'lucide-react';
import { customerService } from '../../services/customerService';
import { Button } from '../../components/ui/Button';
import { PremiumLoader } from '../../components/ui/PremiumLoader';
import { CustomerTransactionsTab } from './tabs/detail/CustomerTransactionsTab';
import { Modal } from '../../components/ui/Modal';
import { CustomerFormModal } from './modals/CustomerFormModal';
import { CollectionModal } from './modals/CollectionModal';
import { CustomerRefundModal } from './modals/CustomerRefundModal';

const fmt = (v) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(v || 0);

const TABS = [
  { id: 'transactions', label: 'Hesap Hareketleri', icon: Layers }
];

export const CustomerDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { startNavigation } = useAppStore();
  const customerId = parseInt(id);

  const [customer, setCustomer] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('transactions');

  // Dropdown states
  const [showOtherMenu, setShowOtherMenu] = useState(false);
  const otherMenuRef = useRef(null);

  // Modals
  const [showEdit, setShowEdit] = useState(false);
  const [showCollection, setShowCollection] = useState(false);
  const [showRefund, setShowRefund] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteSaving, setDeleteSaving] = useState(false);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (otherMenuRef.current && !otherMenuRef.current.contains(e.target)) setShowOtherMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const c = await customerService.getById(customerId);
      const txs = await customerService.getTransactions(customerId);
      
      setCustomer(c);
      setTransactions(txs);
    } catch(err) {
      console.error('[CustomerDetail] Veri Yükleme Hatası:', err);
      toast.error(err?.message || 'Müşteri detayları alınamadı.');
      navigate('/customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [customerId]);

  const handleDelete = async () => {
    setDeleteSaving(true);
    try {
      await customerService.delete(customerId);
      toast.success('Müşteri silindi.');
      navigate('/customers');
    } catch (e) {
      console.error('[CustomerDetail] Silme Hatası:', e);
      toast.error(e?.message || 'Müşteri silinirken hata oluştu.');
    } finally {
      setDeleteSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full gap-4 relative">
      

      {customer && (
        <>
          {/* Breadcrumb + Back */}
          <div className="print:hidden">
            <button
              onClick={() => {
                startNavigation();
                setTimeout(() => navigate('/customers'), 150);
              }}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors bg-white/60 backdrop-blur border border-white/60 shadow-sm px-3 py-1.5 rounded-xl"
            >
              <ArrowLeft className="w-4 h-4" /> Müşteriler
            </button>
          </div>

          {/* Hero Section */}
          <div
            className="rounded-2xl border p-5 relative"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(240,249,255,0.8) 100%)',
              backdropFilter: 'blur(20px)',
              borderColor: 'rgba(56,189,248,0.15)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
            }}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              {/* Left: Identity */}
              <div className="flex items-center gap-5">
                <div 
                  className="p-3 rounded-2xl flex-shrink-0 border"
                  style={{
                    background: 'rgba(56, 189, 248, 0.15)',
                    backdropFilter: 'blur(12px)',
                    borderColor: 'rgba(56, 189, 248, 0.3)',
                    boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.4)',
                  }}
                >
                  <User className="w-9 h-9" style={{ color: '#0284c7' }} strokeWidth={1.5} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    {customer.name}
                  </h1>

                  {/* Address Section */}
                  <div className="text-sm text-slate-600 flex items-center gap-1.5">
                    {customer.address || '-'}
                    {(customer.city || customer.district) && (
                      <span className="text-slate-500 font-medium ml-1">
                        ({customer.district ? `${customer.district}, ` : ''}{customer.city})
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-500">
                    {customer.phone && (
                      <span className="flex items-center gap-1 font-mono bg-white/60 px-2.5 py-1 rounded-full border border-gray-100 shadow-sm text-slate-500">
                        <Phone className="w-3.5 h-3.5 text-gray-400" /> {customer.phone}
                      </span>
                    )}
                    {customer.email && (
                      <span className="flex items-center gap-1 font-medium bg-white/60 px-2.5 py-1 rounded-full border border-gray-100 shadow-sm text-slate-500">
                        <Mail className="w-3.5 h-3.5 text-gray-400" /> {customer.email}
                      </span>
                    )}
                    {customer.tax_number && (
                      <span className="flex items-center gap-1 font-mono bg-white/60 px-2.5 py-1 rounded-full border border-gray-100 shadow-sm text-slate-500">
                        <FileText className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase mr-0.5">VKN/TC:</span> {customer.tax_number}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Actions and Balance */}
              <div className="flex flex-col items-end gap-4 print:hidden w-full md:w-auto mt-4 md:mt-0">
                <div className="flex items-center gap-3 justify-end">
                {/* Sadece toptan müşterilerde (retail olmayanlarda) eylemleri göster */}
                {customer.customer_type !== 'retail' && (
                  <>
                  {/* Dynamic Primary Button based on balance */}
                  {(() => {
                    const bal = parseFloat(customer.balance) || 0;
                    if (bal < 0) {
                      // We owe them — show İade / Mahsup (orange)
                      return (
                        <button
                          onClick={() => setShowRefund(true)}
                          className="flex items-center justify-center gap-2 px-4 py-2 h-10 text-sm font-medium rounded-xl border backdrop-blur-md shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)] transition-all"
                          style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.25)', color: 'rgb(154,52,18)' }}
                        >
                          <ArrowUpLeft className="w-4 h-4" /> İade / Mahsup
                        </button>
                      );
                    }
                    // They owe us or balanced — show Tahsilat Al (emerald/gray)
                    return (
                      <button
                        onClick={() => setShowCollection(true)}
                        className="flex items-center justify-center gap-2 px-4 py-2 h-10 text-sm font-medium rounded-xl border backdrop-blur-md shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)] transition-all"
                        style={bal > 0
                          ? { background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: 'rgb(4,120,87)' }
                          : { background: 'rgba(148,163,184,0.12)', border: '1px solid rgba(148,163,184,0.25)', color: 'rgb(100,116,139)' }
                        }
                      >
                        <ArrowDownLeft className="w-4 h-4" /> Tahsilat Al
                      </button>
                    );
                  })()}

                    {/* Diğer Dropdown */}
                    <div className="relative" ref={otherMenuRef}>
                      <button
                        onClick={() => setShowOtherMenu(v => !v)}
                        className="flex items-center justify-center gap-2 px-4 py-2 h-10 text-sm font-medium rounded-xl border bg-white/60 text-gray-600 border-gray-200 hover:bg-gray-50 transition-all"
                      >
                        Diğer <ChevronDown className={`w-4 h-4 transition-transform duration-150 ${showOtherMenu ? 'rotate-180' : ''}`} />
                      </button>

                      {showOtherMenu && (
                        <div
                          className="absolute right-0 top-full mt-1 z-50 origin-top-right animate-in fade-in zoom-in-95 duration-100"
                          style={{
                            background: 'rgba(255,255,255,0.95)',
                            backdropFilter: 'blur(16px)',
                            border: '1px solid rgba(226,232,240,0.8)',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                            borderRadius: 12,
                            padding: 4,
                            minWidth: 180,
                          }}
                        >
                          <button onClick={() => { setShowEdit(true); setShowOtherMenu(false); }} className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                            <Edit className="w-4 h-4 text-blue-500" /> Düzenle
                          </button>
                          <button onClick={() => { window.print(); setShowOtherMenu(false); }} className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                            <Printer className="w-4 h-4 text-slate-500" /> Yazdır
                          </button>
                          <div className="my-1 border-t border-gray-100" />
                          <button onClick={() => { setShowDelete(true); setShowOtherMenu(false); }} className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-500 rounded-lg hover:bg-red-50 transition-colors">
                            <Trash2 className="w-4 h-4" /> Sil
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
                </div>

                <div className="flex items-center justify-end gap-2 text-right pt-2 border-t border-sky-100/60 w-full">
                  <span className="text-sm font-bold text-slate-500">Güncel Bakiye:</span>
                  <span className={`text-2xl font-black tracking-tight ${customer.balance > 0 ? 'text-red-500' : customer.balance < 0 ? 'text-emerald-500' : 'text-slate-800'}`}>
                    {fmt(Math.abs(customer.balance))} <span className="text-sm font-bold">{customer.balance > 0 ? '(Borçlu)' : customer.balance < 0 ? '(Alacaklı)' : '(Dengede)'}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Print Only Header (Hidden on Screen) */}
            <div className="hidden print:block mb-8 text-center border-b-2 border-black pb-4 mt-8">
               <h1 className="text-2xl font-black mb-1">Cari Hesap Ekstresi</h1>
               <div className="flex justify-between items-center px-4 mt-4">
                 <p className="text-sm font-semibold">{customer.name}</p>
                 <div className="text-right">
                    <span className="text-sm font-bold mr-2">Bakiye:</span>
                    <span className={`font-black ${customer.balance > 0 ? 'text-red-600' : customer.balance < 0 ? 'text-emerald-600' : 'text-black'}`}>
                      {fmt(Math.abs(customer.balance))} {customer.balance > 0 ? '(B)' : customer.balance < 0 ? '(A)' : ''}
                    </span>
                 </div>
               </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 border-b border-gray-100 print:hidden">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all duration-150 border-b-2 -mb-px ${
                     isActive
                      ? 'border-sky-500 text-sky-600 bg-sky-50/50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="flex-1 bg-white p-4 rounded-b-xl border border-gray-100 border-t-0 print:border-none print:p-0">
            {activeTab === 'transactions' && (
              <div>
                <CustomerTransactionsTab transactions={transactions} />
              </div>
            )}
          </div>
        </>
      )}

      {/* Modals */}
      {customer && (
        <>
          <CustomerFormModal 
            isOpen={showEdit} 
            onClose={() => setShowEdit(false)} 
            customerToEdit={customer} 
            onSaved={() => { loadData(); toast.success('Müşteri güncellendi.'); }} 
          />

          <CollectionModal 
            isOpen={showCollection}
            onClose={() => setShowCollection(false)}
            customer={customer}
            onSaved={loadData}
          />

          <CustomerRefundModal
            isOpen={showRefund}
            onClose={() => setShowRefund(false)}
            customer={customer}
            onSaved={loadData}
          />

          <Modal isOpen={showDelete} onClose={() => setShowDelete(false)} title="Müşteriyi Sil" size="sm">
            <p className="text-sm text-gray-600 mb-6">Bu müşteri kalıcı olarak silinecek. Tüm geçmiş hareketleri kaybolur. Bu işlem geri alınamaz.</p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowDelete(false)}>İptal</Button>
              <Button onClick={handleDelete} isLoading={deleteSaving} className="bg-red-500 hover:bg-red-600 text-white border-red-500">Sil</Button>
            </div>
          </Modal>
        </>
      )}
    </div>
  );
};
