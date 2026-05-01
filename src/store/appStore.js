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
