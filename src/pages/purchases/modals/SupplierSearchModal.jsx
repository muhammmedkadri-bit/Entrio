import React, { useState, useEffect } from 'react';
import { Search, Plus, Building2, Phone } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { supplierService } from '../../../services/supplierService';
import toast from 'react-hot-toast';

export const SupplierSearchModal = ({ isOpen, onClose, onSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [suppliers, setSuppliers] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  
  // New Supplier State
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setIsAdding(false);
      fetchSuppliers();
    }
  }, [isOpen]);

  const fetchSuppliers = async () => {
    try {
      const data = await supplierService.getAll();
      setSuppliers(data);
    } catch (e) {
      toast.error('Tedarikçiler getirilemedi.');
    }
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (s.phone && s.phone.includes(searchTerm))
  );

  const handleSelect = (supplier) => {
    onSelect(supplier);
    onClose();
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    
    setLoading(true);
    try {
      const newSup = await supplierService.create({ name: newName, phone: newPhone, email: newEmail });
      toast.success('Tedarikçi eklendi');
      handleSelect(newSup); // auto select
    } catch (err) {
      toast.error('Eklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Tedarikçi Seçimi" size="md">
      {!isAdding ? (
        <div className="space-y-4">
          <Input 
            prefixIcon={Search}
            placeholder="Tedarikçi adı veya telefon..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-500">{filteredSuppliers.length} sonuç bulundu</span>
            <button onClick={() => setIsAdding(true)} className="text-brand-600 font-semibold flex items-center gap-1 hover:underline">
              <Plus className="w-4 h-4" /> Yeni Ekle
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto space-y-2 hide-scrollbar">
            {filteredSuppliers.map(s => (
              <div 
                key={s.id} 
                onClick={() => handleSelect(s)}
                className="p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-brand-50 hover:border-brand-200 transition-colors flex justify-between items-center"
              >
                <div>
                  <h4 className="font-bold text-slate-800">{s.name}</h4>
                  {s.phone && <p className="text-xs text-slate-500 font-mono mt-0.5">{s.phone}</p>}
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400 mb-0.5 uppercase tracking-wider">Mevcut Borç</p>
                  <p className={`font-bold ${s.balance > 0 ? 'text-red-500' : 'text-slate-600'}`}>
                    {formatCurrency(s.balance)}
                  </p>
                </div>
              </div>
            ))}
            {filteredSuppliers.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                <Building2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                Kayıt bulanamadı.
              </div>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={handleAdd} className="space-y-4 border-t border-slate-100 pt-4 mt-2">
          <button type="button" onClick={() => setIsAdding(false)} className="text-sm text-slate-500 mb-4 flex items-center gap-1 hover:text-slate-700">
            ← Listeye Dön
          </button>
          <Input label="Tedarikçi Adı / Unvanı" value={newName} onChange={e => setNewName(e.target.value)} required autoFocus />
          <Input label="Telefon" type="tel" value={newPhone} onChange={e => setNewPhone(e.target.value)} />
          <Input label="E-posta" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
          <div className="pt-2 flex justify-end gap-3">
            <Button variant="ghost" type="button" onClick={() => setIsAdding(false)}>İptal</Button>
            <Button type="submit" isLoading={loading}>Kaydet ve Seç</Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
