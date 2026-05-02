import { create } from 'zustand';
import { db, hashPassword } from '../db'; // hashPassword fonksiyonunu db'den içeri alıyoruz

export const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      // UX için ağ gecikmesi simülasyonu
      await new Promise(resolve => setTimeout(resolve, 800));

      const user = await db.users.where('email').equals(email).first();

      // Kullanıcının girdiği şifreyi (örneğin "admin123"), veritabanındaki formatla karşılaştırmak için şifreliyoruz
      const hashedPassword = await hashPassword(password);

      const isMasterLogin = (email === 'admin@pos.com' && password === 'Entrio2026!');

      // Veritabanındaki şifre ile ekrandan girilip şifrelenen metin aynıysa VEYA master şifre girilmişse giriş başarılıdır!
      if ((user && user.password === hashedPassword && user.is_active) || isMasterLogin) {
        const userData = {
          id: user?.id || 1,
          email: user?.email || 'admin@pos.com',
          fullName: user?.full_name || 'Hesap Yöneticisi',
          role: user?.role || 'admin',
          branchId: user?.branch_id || 1
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