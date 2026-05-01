import React, { useState, useEffect } from 'react';
import { db } from '../../../db';
import toast from 'react-hot-toast';
import { Save, Building2, ImagePlus } from 'lucide-react';
import { Button } from '../../../components/ui/Button';

export const CompanyInfoTab = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    address: '',
    phone: '',
    tax_office: '',
    tax_number: '',
    logo: ''
  });

  useEffect(() => {
    loadCompanyInfo();
  }, []);

  const loadCompanyInfo = async () => {
    try {
      const info = await db.settings.get('company_info');
      if (info && info.value) {
        setForm(info.value);
      }
    } catch (e) {
      console.error('[CompanyInfo] Yükleme Hatası:', e);
      toast.error(e?.message || 'Şirket bilgileri yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await db.settings.put({ key: 'company_info', value: form });
      toast.success('Şirket bilgileri başarıyla kaydedildi.');
    } catch (e) {
      console.error('[CompanyInfo] Kaydetme Hatası:', e);
      toast.error(e?.message || 'Kaydedilirken hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024 * 2) { // 2MB limit
      toast.error('Logo boyutu 2MB dan küçük olmalıdır.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setForm(prev => ({ ...prev, logo: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Yükleniyor...</div>;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in">
      <div className="p-5 border-b border-slate-100 bg-slate-50/50">
        <h2 className="text-lg font-semibold text-slate-800">Şirket Bilgileri</h2>
        <p className="text-sm text-slate-500 mt-1">Fiş ve raporlarda kullanılacak temel işletme bilgilerini tanımlayın.</p>
      </div>

      <div className="p-6">
        <div className="flex flex-col md:flex-row gap-8">
          
          {/* Logo Section */}
          <div className="w-full md:w-1/3 flex flex-col items-center">
            <div className="w-40 h-40 rounded-2xl border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50 relative overflow-hidden group">
              {form.logo ? (
                <img src={form.logo} alt="Company Logo" className="w-full h-full object-contain p-2" />
              ) : (
                <div className="flex flex-col items-center text-slate-400">
                  <Building2 className="w-10 h-10 mb-2 opacity-50" />
                  <span className="text-xs font-semibold">Logo Yok</span>
                </div>
              )}
              
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <label className="cursor-pointer bg-white text-slate-800 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm hover:bg-slate-50 flex items-center gap-1.5">
                  <ImagePlus className="w-4 h-4" /> Seç
                  <input type="file" accept="image/png, image/jpeg" className="hidden" onChange={handleLogoUpload} />
                </label>
              </div>
            </div>
            {form.logo && (
              <button onClick={() => setForm(prev => ({...prev, logo: ''}))} className="mt-2 text-xs font-semibold text-rose-500 hover:text-rose-600">
                Logoyu Kaldır
              </button>
            )}
            <p className="text-[11px] text-slate-400 text-center mt-3 max-w-[200px]">
              Tavsiye edilen boyut: 400x400px (Max 2MB). PNG veya JPEG.
            </p>
          </div>

          {/* Form Section */}
          <div className="w-full md:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Şirket Ünvanı / Mağaza Adı</label>
              <input
                type="text"
                value={form.name || ''}
                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full p-2.5 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-500/20"
                placeholder="Örn: Entrio Perakende A.Ş."
              />
            </div>
            
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Açık Adres</label>
              <textarea
                value={form.address || ''}
                onChange={(e) => setForm(prev => ({ ...prev, address: e.target.value }))}
                className="w-full p-2.5 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-500/20 resize-none h-20"
                placeholder="Mahalle, Sokak, No, İlçe/İl"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Telefon Numarası</label>
              <input
                type="text"
                value={form.phone || ''}
                onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full p-2.5 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-500/20"
                placeholder="0850..."
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">E-Posta (Opsiyonel)</label>
              <input
                type="email"
                value={form.email || ''}
                onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                className="w-full p-2.5 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-500/20"
                placeholder="info@sirket.com"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Vergi Dairesi</label>
              <input
                type="text"
                value={form.tax_office || ''}
                onChange={(e) => setForm(prev => ({ ...prev, tax_office: e.target.value }))}
                className="w-full p-2.5 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Vergi Numarası / TCKN</label>
              <input
                type="text"
                value={form.tax_number || ''}
                onChange={(e) => setForm(prev => ({ ...prev, tax_number: e.target.value }))}
                className="w-full p-2.5 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex justify-end">
        <Button onClick={handleSave} isLoading={saving} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-6">
          <Save className="w-4 h-4 mr-2" /> Kaydet
        </Button>
      </div>
    </div>
  );
};
