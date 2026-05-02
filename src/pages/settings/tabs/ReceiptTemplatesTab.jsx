import React, { useState, useEffect } from 'react';
import { settingsService } from '../../../services/settingsService';
import toast from '../../../components/ui/CustomToast';
import { Save, CheckCircle2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';

const TEMPLATES = [
  { id: 'template_1', name: 'Klasik Termal', desc: 'Standart 80mm termal rulo dizilimi' },
  { id: 'template_2', name: 'Modern Fatura', desc: 'Daha geniş, kurumsal çizgilere sahip' },
  { id: 'template_3', name: 'Zarif Kasa', desc: 'İnce fontlar ve ortalanmış logolu' },
  { id: 'template_4', name: 'Kalın Başlıklı', desc: 'Büyük ve okunaklı üst bilgi' },
  { id: 'template_5', name: 'Kompakt Minimal', desc: 'Az yer kaplayan sıkışık liste stili' }
];

export const ReceiptTemplatesTab = () => {
  const [selected, setSelected] = useState('template_1');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTemplate();
  }, []);

  const loadTemplate = async () => {
    try {
      const tpl = await settingsService.get('receipt_template');
      if (tpl && tpl.value) {
        setSelected(tpl.value);
      }
    } catch (e) {
      console.error('[ReceiptTemplates] Yükleme Hatası:', e);
      toast.error(e?.message || 'Şablon yüklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsService.put('receipt_template', selected);
      toast.success('Varsayılan fiş şablonu güncellendi.');
    } catch (e) {
      console.error('[ReceiptTemplates] Kaydetme Hatası:', e);
      toast.error(e?.message || 'Kaydedilirken hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Yükleniyor...</div>;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in">
      <div className="p-5 border-b border-slate-100 bg-slate-50/50">
        <h2 className="text-lg font-semibold text-slate-800">Fiş Şablonları</h2>
        <p className="text-sm text-slate-500 mt-1">Yazdırılacak tahsilat fişlerinin görsel tasarımını belirleyin.</p>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {TEMPLATES.map(t => {
            const isSelected = selected === t.id;
            return (
              <div
                key={t.id}
                onClick={() => setSelected(t.id)}
                className={`relative cursor-pointer rounded-2xl border-2 transition-all duration-200 overflow-hidden ${
                  isSelected 
                    ? 'border-brand-500 shadow-md scale-[1.02]' 
                    : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50'
                }`}
              >
                {/* Visual Mockup inside */}
                <div className="h-40 bg-slate-50/50 p-4 flex flex-col items-center justify-center border-b border-slate-200">
                   <div className="w-20 bg-white shadow-sm border border-slate-200 flex flex-col p-2" style={{height: '100px'}}>
                     <div className="h-2 w-full bg-slate-200 rounded-full mb-2"></div>
                     <div className="h-1 w-3/4 mx-auto bg-slate-200 rounded-full mb-3"></div>
                     <div className="h-1 w-full bg-slate-100 rounded-full mb-1"></div>
                     <div className="h-1 w-full bg-slate-100 rounded-full mb-1"></div>
                     <div className="h-1 w-full bg-slate-100 rounded-full mb-3"></div>
                     <div className="h-1.5 w-full bg-slate-300 rounded-full mt-auto"></div>
                   </div>
                </div>

                <div className="p-4">
                  <h3 className={`font-bold text-sm ${isSelected ? 'text-brand-700' : 'text-slate-700'}`}>
                    {t.name}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1 leading-tight">{t.desc}</p>
                </div>

                {isSelected && (
                  <div className="absolute top-2 right-2 text-brand-500 bg-white rounded-full">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex justify-end">
        <Button onClick={handleSave} isLoading={saving} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-6">
          <Save className="w-4 h-4 mr-2" /> Varsayılan Olarak Kaydet
        </Button>
      </div>
    </div>
  );
};
