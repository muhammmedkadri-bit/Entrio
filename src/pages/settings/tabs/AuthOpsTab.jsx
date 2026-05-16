import React, { useState, useEffect } from 'react';
import { db, hashPassword } from '../../../db';
import { useAuthStore } from '../../../store/authStore';
import toast from '../../../components/ui/CustomToast';
import { Edit2, Save, X, User, UserPlus, Mail, Lock, ChevronDown } from 'lucide-react';

const inputCls = 'w-full pl-10 pr-4 py-2.5 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-400 bg-slate-50 border-2 border-slate-200 focus:bg-white focus:border-[#5da83f] focus:ring-4 focus:ring-[#5da83f]/10 outline-none transition-all';
const labelCls = 'block text-xs font-semibold text-slate-500 mb-1.5';

function RoleSelect({ value, onChange }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full appearance-none pl-4 pr-10 py-2.5 rounded-xl text-sm font-medium text-slate-800 bg-slate-50 border-2 border-slate-200 focus:bg-white focus:border-[#5da83f] focus:ring-4 focus:ring-[#5da83f]/10 outline-none transition-all cursor-pointer"
      >
        <option value="admin">Yönetici</option>
        <option value="cashier">Kasiyer</option>
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
    </div>
  );
}

export const AuthOpsTab = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [addingNew, setAddingNew] = useState(false);
  const [newForm, setNewForm] = useState({ full_name: '', email: '', password: '', role: 'cashier' });
  const { user: currentUser, updateUserSession } = useAuthStore();

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    try {
      const allUsers = await db.users.toArray();
      setUsers(allUsers);
    } catch (e) {
      console.error('[AuthOps] Yükleme Hatası:', e);
      toast.error(e?.message || 'Kullanıcılar yüklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (u) => { setEditingId(u.id); setEditForm({ ...u, password: '' }); };
  const handleCancelEdit = () => { setEditingId(null); setEditForm({}); };

  const handleSave = async (id) => {
    if (!editForm.email || !editForm.full_name) return toast.error('İsim ve e-posta zorunludur.');
    try {
      const updateData = {
        email: editForm.email,
        full_name: editForm.full_name,
        role: editForm.role
      };
      if (editForm.password && editForm.password.trim().length > 0) {
        updateData.password = await hashPassword(editForm.password.trim());
      }
      await db.users.update(id, updateData);
      if (currentUser?.id === id) {
        updateUserSession({ email: editForm.email, fullName: editForm.full_name, role: editForm.role });
      }
      toast.success('Kullanıcı bilgileri güncellendi.');
      setEditingId(null);
      loadUsers();
    } catch (e) { 
      console.error('[AuthOps] Güncelleme Hatası:', e);
      toast.error(e?.message || 'Güncellenirken hata oluştu'); 
    }
  };

  const handleAddUser = async () => {
    if (!newForm.full_name.trim()) return toast.error('Kullanıcı adı zorunludur.');
    if (!newForm.email.trim()) return toast.error('E-posta zorunludur.');
    if (!newForm.password.trim() || newForm.password.length < 4) return toast.error('Şifre en az 4 karakter olmalıdır.');
    try {
      const existing = await db.users.where('email').equals(newForm.email.trim().toLowerCase()).first();
      if (existing) return toast.error('Bu e-posta adresi zaten kullanımda.');
      const hashedPassword = await hashPassword(newForm.password.trim());
      await db.users.add({
        email: newForm.email.trim().toLowerCase(),
        full_name: newForm.full_name.trim(),
        password: hashedPassword,
        role: newForm.role,
        branch_id: 1,
        is_active: true
      });
      toast.success('Yeni kullanıcı eklendi.');
      setAddingNew(false);
      setNewForm({ full_name: '', email: '', password: '', role: 'cashier' });
      loadUsers();
    } catch (e) { 
      console.error('[AuthOps] Ekleme Hatası:', e);
      toast.error(e?.message || 'Kullanıcı eklenirken hata oluştu'); 
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Yükleniyor...</div>;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-800">Giriş ve Kullanıcı İşlemleri</h2>
          <p className="text-xs text-slate-500 mt-0.5">Sisteme giriş yapan hesapların e-posta, şifre ve rol bilgilerini yönetin.</p>
        </div>
        <button
          onClick={() => { setAddingNew(true); setEditingId(null); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all active:scale-95 shadow-md"
          style={{ background: 'linear-gradient(135deg,#5da83f,#4a8f34)', boxShadow: '0 4px 12px rgba(93,168,63,0.3)' }}
        >
          <UserPlus className="w-4 h-4" />
          Yeni Kullanıcı
        </button>
      </div>

      <div className="p-6 space-y-4">
        {/* Add new user form */}
        {addingNew && (
          <div className="border-2 border-[#5da83f]/40 bg-[#5da83f]/5 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(93,168,63,0.15)' }}>
                <UserPlus className="w-4 h-4" style={{ color: '#5da83f' }} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">Yeni Kullanıcı Ekle</p>
                <p className="text-xs text-slate-500">Sisteme yeni bir kullanıcı hesabı tanımlayın.</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Görünür İsim</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" placeholder="Mehdi" value={newForm.full_name}
                    onChange={e => setNewForm(p => ({ ...p, full_name: e.target.value }))}
                    className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>E-posta (Giriş ID)</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="email" placeholder="kullanici@sirket.com" value={newForm.email}
                    onChange={e => setNewForm(p => ({ ...p, email: e.target.value }))}
                    className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Şifre</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" placeholder="min. 4 karakter" value={newForm.password}
                    onChange={e => setNewForm(p => ({ ...p, password: e.target.value }))}
                    className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Rol</label>
                <RoleSelect value={newForm.role} onChange={v => setNewForm(p => ({ ...p, role: v }))} />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
                <button onClick={() => setAddingNew(false)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all">
                  <X className="w-4 h-4" /> İptal
                </button>
                <button onClick={handleAddUser}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all active:scale-95"
                  style={{ background: 'linear-gradient(135deg,#5da83f,#4a8f34)' }}>
                  <Save className="w-4 h-4" /> Kaydet
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Existing users */}
        {users.map((u) => {
          const isEditing = editingId === u.id;
          return (
            <div key={u.id} className="border border-slate-200 rounded-2xl overflow-hidden hover:border-slate-300 transition-colors">
              {/* User header */}
              <div className="flex items-center gap-3 px-5 py-4 bg-slate-50">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: u.role === 'admin' ? 'rgba(93,168,63,0.15)' : 'rgba(99,102,241,0.1)' }}>
                  <User className="w-5 h-5" style={{ color: u.role === 'admin' ? '#5da83f' : '#6366f1' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{u.full_name}</p>
                  <p className="text-xs text-slate-500">{u.role === 'admin' ? 'Hesap Yöneticisi' : 'Kasiyer'}</p>
                </div>
                {!isEditing && (
                  <button onClick={() => handleEditClick(u)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-all">
                    <Edit2 className="w-3.5 h-3.5" /> Düzenle
                  </button>
                )}
              </div>

              {/* View mode */}
              {!isEditing && (
                <div className="grid grid-cols-3 gap-4 px-5 py-3 border-t border-slate-100">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-0.5">E-Posta</span>
                    <span className="text-sm font-medium text-slate-700">{u.email}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-0.5">Şifre</span>
                    <span className="text-sm font-medium text-slate-500 tracking-widest">••••••••</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-0.5">Durum</span>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                      Aktif
                    </span>
                  </div>
                </div>
              )}

              {/* Edit mode */}
              {isEditing && (
                <div className="p-5 border-t border-slate-100 bg-white">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Görünür İsim</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="text" value={editForm.full_name || ''}
                          onChange={e => setEditForm(p => ({ ...p, full_name: e.target.value }))}
                          className={inputCls} />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>E-posta</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="email" value={editForm.email || ''}
                          onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))}
                          className={inputCls} />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Şifre (Değiştirmek için yazın)</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="text" value={editForm.password || ''}
                          onChange={e => setEditForm(p => ({ ...p, password: e.target.value }))}
                          placeholder="Boş bırakırsanız değişmez"
                          className={inputCls} />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Rol</label>
                      <RoleSelect value={editForm.role || 'cashier'} onChange={v => setEditForm(p => ({ ...p, role: v }))} />
                    </div>
                    <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
                      <button onClick={handleCancelEdit}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all">
                        <X className="w-4 h-4" /> İptal
                      </button>
                      <button onClick={() => handleSave(u.id)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all active:scale-95"
                        style={{ background: 'linear-gradient(135deg,#5da83f,#4a8f34)' }}>
                        <Save className="w-4 h-4" /> Kaydet
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
