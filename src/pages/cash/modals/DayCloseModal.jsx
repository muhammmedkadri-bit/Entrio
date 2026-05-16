import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  Moon, TrendingUp, TrendingDown, Star, ShoppingCart, RotateCcw, Shield,
  BarChart2, Clock, ArrowRight, Plus, Trash2, Wallet, CreditCard, Building2,
  Calculator, X, CheckCircle, Package
} from 'lucide-react';
import { cashService } from '../../../services/cashService';
import { dayCloseService } from '../../../services/dayCloseService';
import toast from '../../../components/ui/CustomToast';

const fmt = (v) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(v || 0);
const PAYMENT_LABELS = {
  cash: { label: 'Nakit', color: '#16a34a' },
  card: { label: 'Kart', color: '#2563eb' },
  transfer: { label: 'Havale/EFT', color: '#7c3aed' },
  mixed: { label: 'Parçalı', color: '#ea580c' },
  credit: { label: 'Veresiye', color: '#dc2626' },
  other: { label: 'Diğer', color: '#64748b' },
};
const REG_ICONS = { cash: Wallet, pos: Calculator, bank: Building2, credit_card: CreditCard };

// ── Mini Horizontal Bar ──────────────────────────────────────────────────────
const MiniBar = ({ value, max, color = '#7ed957', label, sublabel }) => {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-slate-600 truncate pr-2">{label}</span>
        <span className="text-xs font-bold text-slate-800 whitespace-nowrap">{sublabel}</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
};

// ── Hourly Heatmap ───────────────────────────────────────────────────────────
const HourlyChart = ({ saatlik }) => {
  if (!saatlik || saatlik.length === 0) return null;
  const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 8..20
  const dataMap = {};
  saatlik.forEach(h => { dataMap[h.saat] = h; });
  const maxSales = Math.max(...saatlik.map(h => Number(h.satis || 0)), 1);
  return (
    <div className="flex items-end gap-1 h-14">
      {hours.map(h => {
        const d = dataMap[h];
        const sales = d ? Number(d.satis) : 0;
        const pct = Math.max(4, Math.round((sales / maxSales) * 100));
        return (
          <div key={h} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full rounded-t-sm transition-all duration-500 relative group"
              style={{ height: `${pct}%`, minHeight: 4, background: sales > 0 ? 'linear-gradient(180deg,#7ed957,#5da83f)' : '#e2e8f0' }}>
              {sales > 0 && (
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                  {sales} sat.
                </div>
              )}
            </div>
            <span className="text-[9px] text-slate-400 font-medium">{h}</span>
          </div>
        );
      })}
    </div>
  );
};

export const DayCloseModal = ({ isOpen, onClose, allRegisters, onSaved }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState(null);
  const [transfers, setTransfers] = useState([{ id: 1, sourceId: '', targetId: '', amount: '' }]);

  useEffect(() => {
    if (isOpen) {
      loadData();
      setTransfers([{ id: 1, sourceId: '', targetId: '', amount: '' }]);
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    try {
      const d = await dayCloseService.getZReportData(allRegisters);
      setData(d);
    } catch (e) {
      console.error('[DayCloseModal] Veri hatası:', e);
      toast.error('Z raporu verileri yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  const handleDayClose = async () => {
    const validTransfers = transfers.filter(t => t.sourceId && t.targetId && t.amount);
    setSaving(true);

    // 1. Transferler
    for (const t of validTransfers) {
      const val = parseFloat(t.amount);
      if (isNaN(val) || val <= 0) { setSaving(false); return toast.error('Geçerli bir transfer tutarı girin.'); }
      const sourceReg = allRegisters.find(r => r.id === parseInt(t.sourceId));
      if (!sourceReg || (sourceReg.current_balance || 0) < val) {
        setSaving(false);
        return toast.error(`"${sourceReg?.name || 'Seçili'}" kasasında yeterli bakiye yok.`);
      }
      try {
        await cashService.transfer(parseInt(t.sourceId), parseInt(t.targetId), val, 'Z Raporu Cash Drop Transferi');
        sourceReg.current_balance -= val;
      } catch (err) {
        setSaving(false);
        return toast.error('Transfer hatası: ' + (err?.message || 'Bilinmeyen hata.'));
      }
    }

    // 2. Gün Sonu
    try {
      await dayCloseService.performDayClose({ isAuto: false, triggeredBy: 'manual' });
      toast.success('Gün kapatıldı ve Z Raporu kaydedildi.');
      if (onSaved) onSaved();
      onClose();
    } catch (e) {
      toast.error('Gün sonu hatası: ' + (e?.message || 'Bilinmeyen hata.'));
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start sm:items-center justify-center p-2 sm:p-4"
      style={{ background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[95vh] overflow-y-auto rounded-3xl shadow-2xl bg-white"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between rounded-t-3xl"
          style={{ background: 'linear-gradient(135deg,#1e293b 0%,#0f172a 100%)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Moon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-black text-white tracking-tight">Z Raporu & Gün Sonu</h2>
              <p className="text-xs text-slate-400 mt-0.5">{format(new Date(), 'd MMMM yyyy EEEE', { locale: tr })}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Loading ─────────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center h-72 gap-3">
            <div className="w-9 h-9 border-2 border-slate-200 border-t-slate-700 rounded-full animate-spin" />
            <p className="text-sm text-slate-400 font-medium">Z Raporu hesaplanıyor...</p>
          </div>
        ) : data ? (
          <div className="p-5 space-y-5">

            {/* ── 1. Finansal Özet ──────────────────────────────────────────────── */}
            <section>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">💰 Finansal Özet</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Günlük Ciro', sub: `Veresiye: ${fmt(data.veresiye)}`, value: data.ciro, color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', icon: TrendingUp },
                  { label: 'Nakit Tahsilat', sub: `${data.satis_sayi} satış`, value: data.tahsilat, color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', icon: Wallet },
                  { label: 'Toplam Gider', sub: 'Tüm Çıkışlar', value: data.gider, color: '#be123c', bg: '#fff1f2', border: '#fecdd3', icon: TrendingDown },
                  { label: 'Net Nakit Akışı', sub: 'Tahsilat − Gider', value: data.net, color: data.net >= 0 ? '#15803d' : '#be123c', bg: data.net >= 0 ? '#f0fdf4' : '#fff1f2', border: data.net >= 0 ? '#bbf7d0' : '#fecdd3', icon: BarChart2 },
                ].map(card => {
                  const Icon = card.icon;
                  return (
                    <div key={card.label} className="rounded-2xl p-4" style={{ background: card.bg, border: `1px solid ${card.border}` }}>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Icon className="w-3.5 h-3.5" style={{ color: card.color }} />
                        <span className="text-xs font-semibold text-slate-500">{card.label}</span>
                      </div>
                      <div className="text-xl font-black" style={{ color: card.color }}>{fmt(card.value)}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{card.sub}</div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ── 2. Kârlılık ─────────────────────────────────────────────────── */}
            <section>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">📊 Kârlılık (AOM Bazlı)</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl p-4 bg-emerald-50 border border-emerald-100">
                  <p className="text-xs font-semibold text-slate-500 mb-1">Nakit Kâr</p>
                  <p className="text-xl font-black text-emerald-700">{fmt(data.nakit_kar)}</p>
                  <p className="text-[10px] text-emerald-500 mt-1">✓ Tahsil Edildi</p>
                </div>
                <div className="rounded-2xl p-4 bg-amber-50 border border-amber-100">
                  <p className="text-xs font-semibold text-slate-500 mb-1">Veresiye Kâr</p>
                  <p className="text-xl font-black text-amber-600">{fmt(data.veresiye_kar)}</p>
                  <p className="text-[10px] text-amber-500 mt-1">⏳ Bekleyen</p>
                </div>
                <div className="rounded-2xl p-4 bg-slate-50 border border-slate-200">
                  <p className="text-xs font-semibold text-slate-500 mb-1">Toplam Kâr</p>
                  <p className="text-xl font-black text-slate-800">{fmt(data.toplam_kar)}</p>
                  <p className="text-[10px] text-slate-400 mt-1">Kağıt üzerinde</p>
                </div>
              </div>
            </section>

            {/* ── 3. Güvenlik & Fire + Top 5 ──────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              {/* Güvenlik */}
              <section className="rounded-2xl p-4 bg-slate-50 border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <Shield className="w-3 h-3" /> Güvenlik & Fire
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className={`rounded-xl p-3 ${data.iade_sayi > 0 ? 'bg-orange-50 border border-orange-200' : 'bg-white border border-slate-100'}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <RotateCcw className={`w-3 h-3 ${data.iade_sayi > 0 ? 'text-orange-500' : 'text-slate-300'}`} />
                      <span className="text-[10px] font-bold text-slate-500">İade</span>
                    </div>
                    <p className={`text-2xl font-black ${data.iade_sayi > 0 ? 'text-orange-600' : 'text-slate-300'}`}>{data.iade_sayi}</p>
                    <p className={`text-[10px] font-bold mt-0.5 ${data.iade_sayi > 0 ? 'text-orange-500' : 'text-slate-300'}`}>{fmt(data.iade_tutar)}</p>
                  </div>
                  <div className="rounded-xl p-3 bg-white border border-slate-100">
                    <div className="flex items-center gap-1.5 mb-1">
                      <ShoppingCart className="w-3 h-3 text-slate-400" />
                      <span className="text-[10px] font-bold text-slate-500">Satış</span>
                    </div>
                    <p className="text-2xl font-black text-slate-800">{data.satis_sayi}</p>
                    <p className="text-[10px] font-bold text-slate-400 mt-0.5">{fmt(data.ciro)}</p>
                  </div>
                </div>
              </section>

              {/* Top 5 */}
              <section className="rounded-2xl p-4 bg-slate-50 border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <Star className="w-3 h-3 text-amber-400" /> En Çok Satan 5 Ürün
                </p>
                {!data.top5 || data.top5.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">Satış verisi yok.</p>
                ) : (
                  <div className="space-y-2.5">
                    {data.top5.map((p, i) => (
                      <MiniBar key={i}
                        value={Number(p.adet)}
                        max={Number(data.top5[0]?.adet || 1)}
                        color={i === 0 ? '#f59e0b' : '#7ed957'}
                        label={`${i + 1}. ${p.name}`}
                        sublabel={`${p.adet} adet · ${fmt(p.ciro)}`}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* ── 4. Gider Kategorileri + Ödeme Dağılımı ──────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              {/* Gider Dağılımı */}
              <section className="rounded-2xl p-4 bg-slate-50 border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <TrendingDown className="w-3 h-3" /> Gider Analizi
                </p>
                {!data.gider_cats || data.gider_cats.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">Gider kaydı yok.</p>
                ) : (
                  <div className="space-y-2.5">
                    {data.gider_cats.map((g, i) => (
                      <MiniBar key={i}
                        value={Number(g.tutar)}
                        max={Number(data.gider_cats[0]?.tutar || 1)}
                        color="#f43f5e"
                        label={g.kategori}
                        sublabel={fmt(g.tutar)}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* Ödeme Dağılımı */}
              <section className="rounded-2xl p-4 bg-slate-50 border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <Package className="w-3 h-3" /> Tahsilat Yöntemleri
                </p>
                {!data.odeme_dag || data.odeme_dag.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">Satış kaydı yok.</p>
                ) : (
                  <div className="space-y-2.5">
                    {data.odeme_dag.map((pm, i) => {
                      const meta = PAYMENT_LABELS[pm.yontem] || PAYMENT_LABELS.other;
                      return (
                        <MiniBar key={i}
                          value={Number(pm.tutar)}
                          max={Number(data.ciro || 1)}
                          color={meta.color}
                          label={`${meta.label} (×${pm.adet})`}
                          sublabel={fmt(pm.tutar)}
                        />
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            {/* ── 5. Saatlik Yoğunluk ─────────────────────────────────────────── */}
            <section className="rounded-2xl p-4 bg-slate-50 border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                <Clock className="w-3 h-3" /> Saatlik Satış Yoğunluğu
              </p>
              <HourlyChart saatlik={data.saatlik} />
            </section>

            {/* ── 6. Kasa Durumu ──────────────────────────────────────────────── */}
            {data.kasalar && data.kasalar.length > 0 && (
              <section>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">🏦 Kasa Durumu</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {data.kasalar.map(k => {
                    const Icon = REG_ICONS[k.tur] || Wallet;
                    const net = Number(k.net || (k.kapanis - k.acilis));
                    return (
                      <div key={k.id || k.ad} className="rounded-xl bg-white border border-slate-200 p-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-4 h-4 text-emerald-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-700 truncate">{k.ad}</p>
                          <p className="text-[10px] text-slate-400">Günlük Net: <span className={`font-bold ${net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmt(net)}</span></p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-black text-slate-800">{fmt(k.kapanis)}</p>
                          <p className="text-[10px] text-slate-400">Kapanış</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── 7. Cash Drop (İsteğe Bağlı Transferler) ─────────────────────── */}
            <section className="rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <p className="text-xs font-bold text-slate-700 flex items-center gap-2">
                  <ArrowRight className="w-4 h-4 text-brand-500" />
                  Kapanış Öncesi Cash Drop (İsteğe Bağlı)
                </p>
                {transfers.length < 4 && (
                  <button
                    onClick={() => setTransfers([...transfers, { id: Date.now(), sourceId: '', targetId: '', amount: '' }])}
                    className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Ekle
                  </button>
                )}
              </div>
              <div className="p-4 space-y-3 bg-white">
                <p className="text-[11px] text-slate-500">Günü kapatmadan önce kasalar arasında transfer yapabilirsiniz (ör: nakit kasadan banka hesabına).</p>
                {transfers.map((t, index) => (
                  <div key={t.id} className="relative bg-slate-50 border border-slate-200 rounded-xl p-3">
                    {transfers.length > 1 && (
                      <button
                        onClick={() => setTransfers(transfers.filter(tr => tr.id !== t.id))}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-white border border-rose-200 text-rose-500 hover:bg-rose-50 rounded-full flex items-center justify-center shadow-sm transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { key: 'sourceId', label: 'Kaynak Kasa', filter: null },
                        { key: 'targetId', label: 'Hedef Kasa', filter: parseInt(t.sourceId) },
                      ].map(({ key, label, filter }) => (
                        <div key={key}>
                          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">{label}</label>
                          <select
                            value={t[key]}
                            onChange={e => {
                              const next = [...transfers];
                              next[index][key] = e.target.value;
                              setTransfers(next);
                            }}
                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-emerald-500 outline-none"
                          >
                            <option value="">Seçiniz</option>
                            {allRegisters.filter(r => filter ? r.id !== filter : true).map(r => (
                              <option key={r.id} value={r.id}>{r.name} ({fmt(r.current_balance || 0)})</option>
                            ))}
                          </select>
                        </div>
                      ))}
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Tutar</label>
                        <div className="relative">
                          <input
                            type="number"
                            value={t.amount}
                            onChange={e => {
                              const next = [...transfers];
                              next[index].amount = e.target.value;
                              setTransfers(next);
                            }}
                            placeholder="0.00"
                            min="0" step="0.01"
                            className="w-full pl-6 pr-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:ring-1 focus:ring-emerald-500 outline-none"
                          />
                          <span className="absolute left-2 top-1.5 text-slate-400 font-bold text-xs">₺</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Actions ─────────────────────────────────────────────────────── */}
            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all"
              >
                İptal
              </button>
              <button
                onClick={handleDayClose}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                {saving ? 'Kapatılıyor...' : 'Günü Kapat ve Devret'}
              </button>
            </div>

          </div>
        ) : (
          <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Veri yüklenemedi.</div>
        )}
      </div>
    </div>
  );
};
