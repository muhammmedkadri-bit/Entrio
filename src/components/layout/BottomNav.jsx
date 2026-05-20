import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Package, Menu } from 'lucide-react';
import { useAppStore } from '../../store/appStore';

export const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toggleSidebar, startNavigation } = useAppStore();

  const handleNavClick = (e, to) => {
    if (to === location.pathname) return;
    e.preventDefault();
    startNavigation();
    setTimeout(() => { navigate(to); }, 150);
  };

  const navItems = [
    { name: 'Ana Sayfa', to: '/dashboard', icon: LayoutDashboard },
    { name: 'Satış',     to: '/pos',       icon: ShoppingCart },
    { name: 'Stok',      to: '/stock',     icon: Package }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 pb-safe z-40 lg:hidden print:hidden shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <button
              key={item.name}
              onClick={(e) => handleNavClick(e, item.to)}
              className="flex-1 flex flex-col items-center justify-center h-full gap-1 touch-manipulation active:scale-95 transition-transform"
            >
              <item.icon className={`w-6 h-6 transition-colors ${isActive ? 'text-brand-600' : 'text-slate-400'}`} />
              <span className={`text-[10px] font-medium transition-colors ${isActive ? 'text-brand-600' : 'text-slate-500'}`}>
                {item.name}
              </span>
            </button>
          );
        })}
        
        {/* Menü Açma Butonu */}
        <button
          onClick={toggleSidebar}
          className="flex-1 flex flex-col items-center justify-center h-full gap-1 touch-manipulation active:scale-95 transition-transform"
        >
          <Menu className="w-6 h-6 text-slate-400" />
          <span className="text-[10px] font-medium text-slate-500">
            Daha Fazla
          </span>
        </button>
      </div>
    </div>
  );
};
