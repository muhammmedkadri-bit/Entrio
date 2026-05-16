import React, { useState } from 'react';
import toast from '../../../components/ui/CustomToast';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { AlertTriangle, Lock } from 'lucide-react';
import { db, hashPassword } from '../../../db';
import { useAuthStore } from '../../../store/authStore';
import { isSupabase } from '../../../config/database';
import { supabase } from '../../../lib/supabaseClient';

export const ClearDataModal = ({ isOpen, onClose }) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, signOut } = useAuthStore();

  const handleClear = async (e) => {
    e.preventDefault();
    if (!password) {
      toast.error('Lütfen şifrenizi girin.');
      return;
    }

    setLoading(true);
    try {
      const hashedInput = await hashPassword(password);
      
      // 1. Verify Password
      // Master şifre de çalışsın
      const isMasterLogin = (user.email === 'admin@pos.com' && password === 'Entrio2026!');
      
      if (!isMasterLogin) {
        if (isSupabase()) {
          const { data, error } = await supabase.rpc('verify_user_password', {
            p_email: user.email,
            p_password: hashedInput
          });
          if (error || !data) throw new Error('Şifre doğrulanamadı.');
        } else {
          const currentUser = await db.users.where('email').equals(user.email).first();
          if (!currentUser || currentUser.password !== hashedInput) {
            throw new Error('Girdiğiniz şifre hatalı.');
          }
        }
      }

      // 2. Wipe Database
      if (isSupabase()) {
        const { error } = await supabase.rpc('wipe_all_data');
        if (error) throw error;
      } else {
        await db.transaction('rw', 
          db.sales, db.sale_items, db.purchases, db.purchase_items,
          db.cash_transactions, db.cash_registers,
          db.stock_movements, db.products, db.categories,
          db.customers, db.customer_transactions,
          db.suppliers, db.supplier_transactions,
        async () => {
          await db.sales.clear();
          await db.sale_items.clear();
          await db.purchases.clear();
          await db.purchase_items.clear();
          await db.cash_transactions.clear();
          await db.cash_registers.clear();
          await db.stock_movements.clear();
          await db.products.clear();
          await db.categories.clear();
          await db.customers.clear();
          await db.customer_transactions.clear();
          await db.suppliers.clear();
          await db.supplier_transactions.clear();
          
          // Re-seed default data
          await db.customers.add({ id: 1, name: 'Perakende Müşteri', customer_type: 'retail', balance: 0, is_active: true });
          
          const today = new Date().toISOString().split('T')[0];
          await db.cash_registers.bulkAdd([
            { name: 'Nakit Kasa', type: 'cash', is_default_for: 'cash', current_balance: 0, general_balance: 0, last_day_close_date: today, last_day_close_at: null, is_active: true },
            { name: 'POS Hesabı 1', type: 'pos', is_default_for: 'card', current_balance: 0, general_balance: 0, last_day_close_date: today, last_day_close_at: null, is_active: true },
            { name: 'Banka Hesabı 1', type: 'bank', is_default_for: 'transfer', current_balance: 0, general_balance: 0, last_day_close_date: today, last_day_close_at: null, is_active: true }
          ]);
          
          await db.categories.bulkAdd([
            { name: 'Genel', color: '#65c43d', icon: 'tag' },
            { name: 'Gıda', color: '#22c55e', icon: 'shopping-bag' },
            { name: 'Elektronik', color: '#3b82f6', icon: 'cpu' },
            { name: 'Giyim', color: '#f59e0b', icon: 'shirt' }
          ]);
        });
      }

      toast.success('Tüm veriler başarıyla silindi.');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      
    } catch (err) {
      console.error('[ClearData]', err);
      toast.error(err?.message || 'Veriler silinirken hata oluştu.');
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Sistemi Sıfırla (Fabrika Ayarları)" size="sm">
      <form onSubmit={handleClear} className="space-y-5">
        <div className="p-4 rounded-xl flex flex-col items-center justify-center text-center gap-3 border bg-rose-50 border-rose-200 text-rose-700">
          <div className="p-3 rounded-full bg-rose-100 text-rose-600">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div className="text-[13px] font-medium leading-relaxed max-w-[280px]">
            <strong className="font-extrabold text-rose-800">DİKKAT:</strong> Bu işlem kullanıcı hesaplarınız haricindeki 
            <strong className="font-extrabold text-rose-800"> tüm ürünleri, müşterileri, kasaları, satış ve iade verilerini</strong> kalıcı olarak silecektir. Geri alınamaz.
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">İşlemi onaylamak için şifrenizi girin</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="password"
              placeholder="Giriş şifreniz"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-400 bg-slate-50 border-2 border-slate-200 focus:bg-white focus:border-rose-400 focus:ring-4 focus:ring-rose-400/10 outline-none transition-all"
              autoFocus
            />
          </div>
        </div>

        <div className="pt-2 flex justify-end gap-3 border-t border-slate-100 mt-2">
           <Button variant="ghost" type="button" onClick={onClose} className="hover:bg-slate-100">Vazgeç</Button>
           <Button type="submit" isLoading={loading} className="bg-rose-500 hover:bg-rose-600 text-white border-none shadow-sm">
             Tüm Verileri Sil
           </Button>
        </div>
      </form>
    </Modal>
  );
};
