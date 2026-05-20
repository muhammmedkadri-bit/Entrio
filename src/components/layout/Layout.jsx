import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { AnimatePresence } from 'framer-motion';
import { PremiumLoader } from '../ui/PremiumLoader';
import { GlobalFAB } from '../ui/GlobalFAB';
import { useAppStore } from '../../store/appStore';
import { useDayCloseScheduler } from '../../hooks/useDayCloseScheduler';

const titleMap = {
  '/dashboard': 'Entrio',
  '/pos': 'Entrio I Hızlı Satış',
  '/stock': 'Entrio I Stok',
  '/purchases': 'Entrio I Alış Yönetimi',
  '/customers': 'Entrio I Müşteriler',
  '/suppliers': 'Entrio I Tedarikçiler',
  '/cash': 'Entrio I Kasa Ve Finans',
  '/reports': 'Entrio I Raporlar',
  '/settings': 'Entrio I Ayarlar'
};

export const Layout = () => {
  const location = useLocation();
  const isPos = location.pathname === '/pos';
  const { isNavigating, stopNavigation, isPageLoading } = useAppStore();
  const navTimerRef = React.useRef(null);

  // Otomatik gün sonu servisini çalıştır
  useDayCloseScheduler();

  React.useEffect(() => {
    const title = titleMap[location.pathname] || 'Entrio';
    document.title = title;
  }, [location.pathname]);

  // isNavigating flag controls the initial mount overlay.
  // It stops quickly so that the page mounts, but isPageLoading keeps it open until data is fully loaded.
  React.useEffect(() => {
    if (isNavigating) {
      clearTimeout(navTimerRef.current);
      navTimerRef.current = setTimeout(() => stopNavigation(), 300);
    }
    return () => clearTimeout(navTimerRef.current);
  }, [isNavigating, location.pathname, stopNavigation]);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans print:bg-white print:h-auto print:overflow-visible">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden relative print:overflow-visible">
        <main className={`flex-1 overflow-y-auto ${isPos ? 'p-2' : 'p-3'} pb-20 lg:pb-3 scroll-smooth z-0 print:p-0 print:overflow-visible`}>
          <div className={`relative ${isPos ? 'h-full flex flex-col' : 'h-full animate-in fade-in duration-300'} print:max-w-none`}>
            <Outlet />
          </div>
        </main>
        {/* Render loader over the entire flex column body, edge-to-edge */}
        <PremiumLoader isOpen={isNavigating || isPageLoading} />
        
        {/* Global Quick Action FAB */}
        <GlobalFAB />
        
        {/* Mobile Bottom Navigation */}
        <BottomNav />
      </div>
    </div>
  );
};
