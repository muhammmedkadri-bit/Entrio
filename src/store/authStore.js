import { create } from 'zustand';
import { db } from '../db';

export const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      // Simulate network delay for UX
      await new Promise(resolve => setTimeout(resolve, 800));

      const user = await db.users.where('email').equals(email).first();

      if (user && user.password === password && user.is_active) {
        const userData = {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          branchId: user.branch_id
        };

        localStorage.setItem('retailpos_user', JSON.stringify(userData));
        set({ user: userData, isAuthenticated: true, isLoading: false });
        return { success: true };
      } else {
        throw new Error('Geçersiz e-posta veya şifre.');
      }
    } catch (error) {
      set({ isLoading: false });
      return { success: false, error: error.message };
    }
  },

  logout: () => {
    localStorage.removeItem('retailpos_user');
    set({ user: null, isAuthenticated: false });
  },

  initAuth: () => {
    const storedUser = localStorage.getItem('retailpos_user');
    if (storedUser) {
      set({ user: JSON.parse(storedUser), isAuthenticated: true, isLoading: false });
    } else {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  updateUserSession: (newUserData) => {
    set((state) => {
      if (!state.user) return state;
      const updatedUser = { ...state.user, ...newUserData };
      localStorage.setItem('retailpos_user', JSON.stringify(updatedUser));
      return { user: updatedUser };
    });
  }
}));
