import { create } from 'zustand';

const COLLAPSED_KEY = 'sidebar_collapsed';

export const useAppStore = create((set) => ({
  sidebarOpen: false,
  sidebarCollapsed: localStorage.getItem(COLLAPSED_KEY) === 'true',
  currentBranch: null,
  notifications: [],
  isNavigating: true,
  isPageLoading: false,

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  toggleCollapsed: () => set((state) => {
    const next = !state.sidebarCollapsed;
    localStorage.setItem(COLLAPSED_KEY, String(next));
    return { sidebarCollapsed: next };
  }),

  theme: localStorage.getItem('entrio_theme') || 'light',
  toggleTheme: () => set((state) => {
    const nextTheme = state.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('entrio_theme', nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    return { theme: nextTheme };
  }),

  startNavigation: () => set({ isNavigating: true }),
  stopNavigation: () => set({ isNavigating: false }),
  setPageLoading: (loading) => set({ isPageLoading: loading }),

  setCurrentBranch: (branch) => set({ currentBranch: branch }),

  addNotification: (message, type = 'info') => set((state) => {
    const newNotif = { id: Date.now(), message, type };
    return { notifications: [...state.notifications, newNotif] };
  }),

  clearNotification: (id) => set((state) => ({
    notifications: state.notifications.filter(n => n.id !== id)
  }))
}));
