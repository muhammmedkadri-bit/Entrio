import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ShoppingCart, ArrowLeftRight, PackagePlus, FileText, X } from 'lucide-react';
import { useCartStore } from '../../store/cartStore';
import { useAppStore } from '../../store/appStore';

export const GlobalFAB = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const setPosMode = useCartStore(state => state.setPosMode);
  const startNavigation = useAppStore(state => state.startNavigation);
  const isNavigating = useAppStore(state => state.isNavigating);
  const isPageLoading = useAppStore(state => state.isPageLoading);
  const menuRef = useRef(null);
  const [hasSpinner, setHasSpinner] = useState(false);

  useEffect(() => {
    const checkSpinner = () => {
      // Catch standard spinners (.animate-spin) and PremiumLoader (.animate-loaderAnim)
      const spinner = document.querySelector('.animate-spin, .animate-loaderAnim');
      setHasSpinner(!!spinner);
    };
    checkSpinner();
    const observer = new MutationObserver(checkSpinner);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleAction = (action) => {
    setIsOpen(false);
    startNavigation(); // Start the premium loader animation

    // Add a tiny delay to let the loader render before freezing the main thread for navigation
    setTimeout(() => {
      switch (action) {
        case 'purchase_invoice':
          navigate('/purchases/new');
          break;
        case 'sale':
          setPosMode('sale');
          navigate('/pos');
          break;
        case 'return':
          setPosMode('return');
          navigate('/pos');
          break;
        case 'quick_purchase':
          setPosMode('purchase');
          navigate('/pos');
          break;
        default:
          break;
      }
    }, 50);
  };

  return (
    <div 
      className={`fixed bottom-[60px] lg:bottom-0 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center transition-all duration-300 ${
        (isNavigating || isPageLoading || hasSpinner) ? 'opacity-0 translate-y-full pointer-events-none' : (isOpen ? 'translate-y-0' : 'translate-y-[40%] hover:translate-y-0')
      }`} 
      ref={menuRef}
    >
      
      {/* Menu Options */}
      {isOpen && (
        <div className="absolute bottom-full mb-3 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col p-1.5 animate-in slide-in-from-bottom-4 fade-in duration-200 divide-y divide-[#5da83f]/10">
          <button 
            onClick={() => handleAction('purchase_invoice')}
            className="flex items-center gap-3 w-full px-4 py-3 hover:bg-[#5da83f]/5 text-slate-700 rounded-xl transition-colors font-semibold text-sm group"
          >
            <div className="w-8 h-8 rounded-lg bg-[#5da83f]/10 text-[#5da83f] flex items-center justify-center group-hover:scale-110 transition-transform">
              <FileText className="w-4 h-4" />
            </div>
            Alış Faturası Oluştur
          </button>

          <button 
            onClick={() => handleAction('sale')}
            className="flex items-center gap-3 w-full px-4 py-3 hover:bg-[#5da83f]/5 text-slate-700 rounded-xl transition-colors font-semibold text-sm group"
          >
            <div className="w-8 h-8 rounded-lg bg-[#5da83f]/10 text-[#5da83f] flex items-center justify-center group-hover:scale-110 transition-transform">
              <ShoppingCart className="w-4 h-4" />
            </div>
            Satış Oluştur
          </button>

          <button 
            onClick={() => handleAction('return')}
            className="flex items-center gap-3 w-full px-4 py-3 hover:bg-[#5da83f]/5 text-slate-700 rounded-xl transition-colors font-semibold text-sm group"
          >
            <div className="w-8 h-8 rounded-lg bg-[#5da83f]/10 text-[#5da83f] flex items-center justify-center group-hover:scale-110 transition-transform">
              <ArrowLeftRight className="w-4 h-4" />
            </div>
            İade Oluştur
          </button>

          <button 
            onClick={() => handleAction('quick_purchase')}
            className="flex items-center gap-3 w-full px-4 py-3 hover:bg-[#5da83f]/5 text-slate-700 rounded-xl transition-colors font-semibold text-sm group"
          >
            <div className="w-8 h-8 rounded-lg bg-[#5da83f]/10 text-[#5da83f] flex items-center justify-center group-hover:scale-110 transition-transform">
              <PackagePlus className="w-4 h-4" />
            </div>
            Hızlı Alış Oluştur
          </button>
        </div>
      )}

      {/* FAB Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-16 h-12 bg-[#5da83f] hover:bg-[#4b8a32] text-white rounded-t-2xl flex items-center justify-center pt-1 shadow-[0_-4px_15px_rgba(93,168,63,0.3)] transition-all"
      >
        {isOpen ? <X className="w-6 h-6 mb-1" /> : <Plus className="w-6 h-6 mb-1" />}
      </button>

    </div>
  );
};
