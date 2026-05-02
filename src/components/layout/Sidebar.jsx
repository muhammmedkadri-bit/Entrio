import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Truck, 
  Users, 
  Briefcase, 
  Calculator, 
  BarChart, 
  Settings as SettingsIcon,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import entrioLogo from '../../assets/Entriologo.svg';

const navItems = [
  { name: 'Ana Sayfa',     to: '/dashboard', icon: LayoutDashboard },
  { name: 'Hızlı Satış',   to: '/pos',       icon: ShoppingCart },
  { name: 'Stok',          to: '/stock',     icon: Package },
  { name: 'Alış Yönetimi', to: '/purchases', icon: Truck },
  { name: 'Müşteriler',    to: '/customers', icon: Users, alsoActiveFor: [/^\/sales\/\d+/] },
  { name: 'Tedarikçiler',  to: '/suppliers', icon: Briefcase },
  { name: 'Kasa & Finans', to: '/cash',      icon: Calculator },
  { name: 'Raporlar',      to: '/reports',   icon: BarChart },
  { name: 'Ayarlar',       to: '/settings',  icon: SettingsIcon }
];

export const Sidebar = () => {
  const { sidebarOpen, toggleSidebar, sidebarCollapsed, toggleCollapsed, startNavigation } = useAppStore();
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  const collapsed = sidebarCollapsed;

  const handleNavClick = (e, to) => {
    if (to === location.pathname) return;
    e.preventDefault();
    if (window.innerWidth < 1024) toggleSidebar();
    startNavigation();
    setTimeout(() => { navigate(to); }, 150);
  };

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/80 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50 bg-white border-r border-slate-200
          lg:translate-x-0 lg:static lg:inset-0 flex flex-col print:hidden
          overflow-hidden
          transition-[width,transform] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]
          will-change-[width,transform]
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          ${collapsed ? 'w-14' : 'w-60'}
        `}
      >

        {/* ── Logo Area ── */}
        <div className="flex items-center h-16 bg-slate-50 border-b border-slate-200 relative overflow-hidden flex-shrink-0">
          
          {/* Expanded logo — fades/slides out when collapsing */}
          <div
            className="absolute inset-0 flex items-center px-4 transition-opacity duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
            style={{
              opacity: collapsed ? 0 : 1,
              pointerEvents: collapsed ? 'none' : 'auto',
            }}
          >
            <div
              className="w-[140px] h-[48px] mix-blend-darken -ml-1 flex-shrink-0"
              style={{
                backgroundImage: `url(${entrioLogo})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat'
              }}
            />
          </div>

          {/* Collapsed icon — fades/scales in when collapsing */}
          <div
            className="absolute inset-0 flex items-center justify-center transition-opacity duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
            style={{
              opacity: collapsed ? 1 : 0,
              pointerEvents: collapsed ? 'auto' : 'none',
            }}
          >
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"
              className="drop-shadow-[0_0_6px_rgba(130,224,90,0.2)]">
              <circle cx="16" cy="16" r="13" fill="#82e05a"/>
              <path d="M16 10V22M10 16H22" stroke="white" strokeWidth="3" strokeLinecap="round"/>
            </svg>
          </div>

          {/* Mobile close button */}
          {!collapsed && (
            <button
              onClick={toggleSidebar}
              className="lg:hidden absolute right-3 text-slate-400 hover:text-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-200">
          {navItems.map((item) => {
            const extraActive = item.alsoActiveFor?.some(re => re.test(location.pathname)) ?? false;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={(e) => handleNavClick(e, item.to)}
                className={({ isActive }) => {
                  const active = isActive || extraActive;
                  return [
                    'flex items-center py-2.5 text-sm font-medium rounded-xl transition-colors duration-100 group relative overflow-hidden',
                    collapsed ? 'justify-center px-0' : 'px-3 gap-3',
                    active
                      ? 'bg-brand-50 text-brand-600 border border-brand-100'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent',
                  ].join(' ');
                }}
              >
                {({ isActive }) => {
                  const active = isActive || extraActive;
                  return (
                    <>
                      {active && !collapsed && (
                        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-brand-500 rounded-r-full" />
                      )}
                      <item.icon
                        className={`w-5 h-5 flex-shrink-0 transition-transform duration-100 ${
                          active ? 'scale-110 text-brand-600' : 'text-slate-500 group-hover:scale-110 group-hover:text-brand-600'
                        }`}
                      />
                      {/* Nav label — fades with sidebar width */}
                      <span
                        className="relative z-10 truncate whitespace-nowrap transition-[opacity,max-width] duration-150 ease-in-out"
                        style={{
                          maxWidth: collapsed ? 0 : 160,
                          opacity: collapsed ? 0 : 1,
                          overflow: 'hidden',
                        }}
                      >
                        {item.name}
                      </span>

                      {/* Collapsed tooltip */}
                      {collapsed && (
                        <span
                          className="pointer-events-none absolute left-full ml-3 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-150 z-[200]"
                          style={{
                            top: '50%',
                            transform: 'translateY(-50%) translateX(4px)',
                            background: '#1e293b',
                            color: '#f1f5f9',
                          }}
                        >
                          {item.name}
                        </span>
                      )}
                    </>
                  );
                }}
              </NavLink>
            );
          })}
        </nav>

        {/* ── Collapse Toggle ── */}
        <div className="border-t border-slate-200 px-2 py-2 flex-shrink-0">
          <button
            onClick={toggleCollapsed}
            className={`w-full flex items-center rounded-lg py-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors text-sm ${
              collapsed ? 'justify-center' : 'gap-2 px-3'
            }`}
            title={collapsed ? 'Genişlet' : 'Daralt'}
          >
            <div className="transition-transform duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
              style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}>
              <ChevronRight className="w-4 h-4" />
            </div>
            <span
              className="whitespace-nowrap transition-[opacity,max-width] duration-150 ease-in-out overflow-hidden"
              style={{ maxWidth: collapsed ? 0 : 120, opacity: collapsed ? 0 : 1 }}
            >
              Menüyü Daralt
            </span>
          </button>
        </div>

        {/* ── User Card ── */}
        <div className={`border-t border-slate-200 flex-shrink-0 transition-all duration-200 ${collapsed ? 'p-2' : 'p-3'}`}>
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {user?.fullName?.charAt(0) || 'U'}
            </div>
            {/* User info — fades with sidebar */}
            <div
              className="flex-1 overflow-hidden transition-[opacity,max-width] duration-150 ease-in-out"
              style={{ maxWidth: collapsed ? 0 : 200, opacity: collapsed ? 0 : 1 }}
            >
              <p className="text-xs font-semibold text-slate-900 truncate">{user?.fullName}</p>
              <p className="text-[10px] text-slate-500 truncate capitalize">{user?.role}</p>
            </div>
          </div>
          {/* Logout button */}
          <div
            className="overflow-hidden transition-[opacity,max-height] duration-150 ease-in-out"
            style={{ maxHeight: collapsed ? 0 : 48, opacity: collapsed ? 0 : 1 }}
          >
            <button
              onClick={logout}
              className="mt-2 w-full flex items-center justify-center px-3 py-1.5 bg-white hover:bg-red-50 text-slate-600 hover:text-red-500 text-xs font-medium rounded-lg transition-all border border-slate-200 hover:border-red-500/20 shadow-sm"
            >
              Çıkış Yap
            </button>
          </div>
          {/* Collapsed logout icon */}
          <div
            className="overflow-hidden transition-[opacity,max-height] duration-150 ease-in-out mt-1"
            style={{ maxHeight: collapsed ? 40 : 0, opacity: collapsed ? 1 : 0 }}
          >
            <button
              onClick={logout}
              title="Çıkış Yap"
              className="w-full flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-500 transition-colors text-xs font-bold mx-auto"
            >
              ✕
            </button>
          </div>
        </div>

      </div>
    </>
  );
};
