import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Briefcase, Menu, Plus, FileText, ArrowLeftRight, PackagePlus, X, ShoppingCart } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useCartStore } from '../../store/cartStore';

export const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toggleSidebar, startNavigation } = useAppStore();
  const setPosMode = useCartStore(state => state.setPosMode);
  const [isActionOpen, setIsActionOpen] = useState(false);
  const sheetRef = useRef(null);

  // Dışarı tıklanınca kapat
  useEffect(() => {
    const handleClick = (e) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target)) {
        setIsActionOpen(false);
      }
    };
    if (isActionOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isActionOpen]);

  const handleNavClick = (to) => {
    if (to === location.pathname) return;
    startNavigation();
    setTimeout(() => { navigate(to); }, 150);
  };

  const handleAction = (action) => {
    setIsActionOpen(false);
    startNavigation();
    setTimeout(() => {
      switch (action) {
        case 'purchase_invoice': navigate('/purchases/new'); break;
        case 'sale':   setPosMode('sale');     navigate('/pos'); break;
        case 'return': setPosMode('return');   navigate('/pos'); break;
        case 'quick_purchase': setPosMode('purchase'); navigate('/pos'); break;
        default: break;
      }
    }, 50);
  };

  const leftItems = [
    { name: 'Ana Sayfa', to: '/dashboard', icon: LayoutDashboard },
    { name: 'Müşteriler',     to: '/customers',       icon: Users },
  ];
  const rightItems = [
    { name: 'Tedarikçiler', to: '/suppliers', icon: Briefcase },
  ];

  const NavBtn = ({ item }) => {
    const isActive = location.pathname === item.to;
    return (
      <button
        onClick={() => handleNavClick(item.to)}
        className="flex-1 flex flex-col items-center justify-center h-full gap-1 touch-manipulation active:scale-95 transition-transform"
      >
        <item.icon className={`w-6 h-6 transition-colors ${isActive ? 'text-[#5da83f]' : 'text-slate-400'}`} />
        <span className={`text-[10px] font-medium transition-colors ${isActive ? 'text-[#5da83f]' : 'text-slate-500'}`}>
          {item.name}
        </span>
      </button>
    );
  };

  return (
    <>
      {/* Action Sheet Overlay */}
      {isActionOpen && (
        <div className="fixed inset-0 bg-black/40 z-[9998] lg:hidden" onClick={() => setIsActionOpen(false)} />
      )}

      {/* Action Sheet */}
      <div
        ref={sheetRef}
        className={`fixed left-0 right-0 z-[9999] lg:hidden transition-all duration-300 ease-in-out ${
          isActionOpen ? 'bottom-16 opacity-100' : 'bottom-16 opacity-0 pointer-events-none translate-y-4'
        }`}
      >
        <div className="mx-4 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden divide-y divide-slate-100">
          <button
            onClick={() => handleAction('purchase_invoice')}
            className="flex items-center gap-3 w-full px-5 py-4 hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-semibold text-sm"
          >
            <div className="w-9 h-9 rounded-xl bg-[#5da83f]/10 text-[#5da83f] flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            Alış Faturası Oluştur
          </button>
          <button
            onClick={() => handleAction('sale')}
            className="flex items-center gap-3 w-full px-5 py-4 hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-semibold text-sm"
          >
            <div className="w-9 h-9 rounded-xl bg-[#5da83f]/10 text-[#5da83f] flex items-center justify-center shrink-0">
              <ShoppingCart className="w-4 h-4" />
            </div>
            Satış Oluştur
          </button>
          <button
            onClick={() => handleAction('return')}
            className="flex items-center gap-3 w-full px-5 py-4 hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-semibold text-sm"
          >
            <div className="w-9 h-9 rounded-xl bg-[#5da83f]/10 text-[#5da83f] flex items-center justify-center shrink-0">
              <ArrowLeftRight className="w-4 h-4" />
            </div>
            İade Oluştur
          </button>
          <button
            onClick={() => handleAction('quick_purchase')}
            className="flex items-center gap-3 w-full px-5 py-4 hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-semibold text-sm"
          >
            <div className="w-9 h-9 rounded-xl bg-[#5da83f]/10 text-[#5da83f] flex items-center justify-center shrink-0">
              <PackagePlus className="w-4 h-4" />
            </div>
            Hızlı Alış Oluştur
          </button>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40 lg:hidden print:hidden shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center h-16 relative">

          {/* Sol ikonlar */}
          {leftItems.map(item => <NavBtn key={item.name} item={item} />)}

          {/* Merkez + Butonu */}
          <div className="flex-1 flex items-center justify-center">
            <button
              onClick={() => setIsActionOpen(v => !v)}
              className={`absolute -top-5 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 border-4 border-white ${
                isActionOpen
                  ? 'bg-slate-700 shadow-slate-400/40 rotate-45'
                  : 'bg-[#5da83f] shadow-[#5da83f]/40'
              }`}
            >
              <Plus className="w-7 h-7 text-white" strokeWidth={2.5} />
            </button>
          </div>

          {/* Sağ ikonlar */}
          {rightItems.map(item => <NavBtn key={item.name} item={item} />)}

          {/* Menü */}
          <button
            onClick={toggleSidebar}
            className="flex-1 flex flex-col items-center justify-center h-full gap-1 touch-manipulation active:scale-95 transition-transform"
          >
            <Menu className="w-6 h-6 text-slate-400" />
            <span className="text-[10px] font-medium text-slate-500">Daha Fazla</span>
          </button>
        </div>
      </div>
    </>
  );
};
