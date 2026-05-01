import React, { useState, useEffect } from 'react';
import { Plus, Tag, Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { categoryService } from '../../../services/categoryService';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';

export const CategoriesTab = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#65c43d');
  const [deleteCatConfirm, setDeleteCatConfirm] = useState(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const data = await categoryService.getAll();
      setCategories(data);
    } catch(e) {
      toast.error('Kategoriler alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      if (editingCat) {
        await categoryService.update(editingCat.id, { name, color });
        toast.success('Kategori güncellendi.');
      } else {
        await categoryService.create({ name, color });
        toast.success('Yeni kategori oluşturuldu.');
      }
      setModalOpen(false);
      fetchCategories();
    } catch(err) {
      console.error('[CategoriesTab] Kayıt Hatası:', err);
      toast.error(err?.message || 'Kayıt işlemi başarısız.');
    }
  };

  const confirmDelete = async () => {
    if (!deleteCatConfirm) return;
    try {
      await categoryService.delete(deleteCatConfirm.id);
      toast.success('Kategori silindi.');
      fetchCategories();
    } catch (err) {
      console.error('[CategoriesTab] Silme Hatası:', err);
      toast.error(err?.message || 'Kategori silinemedi.');
    } finally {
      setDeleteCatConfirm(null);
    }
  };

  const openForm = (cat = null) => {
    setEditingCat(cat);
    setName(cat ? cat.name : '');
    setColor(cat ? (cat.color || '#65c43d') : '#65c43d');
    setModalOpen(true);
  };

  const colors = ["#65c43d", "#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#64748b"];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Kategori Yönetimi</h3>
          <p className="text-sm text-slate-500">Ürünlerinizi organize edin.</p>
        </div>
        <Button icon={Plus} onClick={() => openForm(null)}>Yeni Kategori</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-400">Yükleniyor...</div>
        ) : categories.length > 0 ? (
          categories.map(cat => (
            <div key={cat.id} className="bg-white p-5 rounded-2xl border border-slate-200 flex items-center justify-between group hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-opacity-10" style={{ backgroundColor: `${cat.color || '#65c43d'}20`, color: cat.color || '#65c43d' }}>
                  <Tag className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800">{cat.name}</h4>
                </div>
              </div>
              <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openForm(cat)} className="text-slate-400 hover:text-brand-600 p-1"><Edit className="w-4 h-4"/></button>
                <button onClick={() => setDeleteCatConfirm(cat)} className="text-slate-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4"/></button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-xl border border-dashed border-slate-300">
            <Tag className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>Henüz kategori bulunmuyor.</p>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editingCat ? "Kategori Düzenle" : "Yeni Kategori Ekle"} size="sm">
        <form onSubmit={handleSave} className="space-y-4">
          <Input 
            label="Kategori Adı" 
            placeholder="Örn: İçecekler" 
            value={name} 
            onChange={e => setName(e.target.value)} 
            required 
            autoFocus 
          />
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Tema Rengi</label>
            <div className="flex flex-wrap gap-2">
              {colors.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${color === c ? 'border-slate-800 scale-110' : 'border-transparent hover:scale-110'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-4 mt-6 border-t border-slate-100">
            <Button variant="ghost" onClick={() => setModalOpen(false)} type="button">İptal</Button>
            <Button type="submit">Kaydet</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!deleteCatConfirm} onClose={() => setDeleteCatConfirm(null)} title="Kategoriyi Sil" size="sm">
        <p className="text-sm text-gray-600 mb-6">
          "{deleteCatConfirm?.name}" kategorisini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setDeleteCatConfirm(null)}>İptal</Button>
          <Button onClick={confirmDelete} className="bg-red-500 hover:bg-red-600 text-white border-red-500">Sil</Button>
        </div>
      </Modal>
    </div>
  );
}
