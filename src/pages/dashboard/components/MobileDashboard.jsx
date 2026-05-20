import React from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { 
  Banknote, ShoppingCart, TrendingUp, Users, ArrowRightLeft, 
  Plus, Edit2, Trash2, CheckCircle, Package 
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import { useNavigate } from 'react-router-dom';

const MobileTransactionCard = ({ tx, onClick }) => {
  const isSale = tx.type === 'sale';
  const isExpense = tx.type === 'expense';
  
  return (
    <div 
      onClick={onClick}
      className="flex items-center p-3 bg-white border border-slate-100 rounded-xl mb-2 active:scale-[0.98] transition-transform shadow-sm"
    >
      {/* Icon/Avatar */}
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 mr-3 ${
        isSale ? 'bg-green-100 text-green-600' : 
        isExpense ? 'bg-rose-100 text-rose-600' : 
        'bg-brand-100 text-brand-600'
      }`}>
        {isSale ? <ShoppingCart size={18} /> : 
         isExpense ? <ArrowRightLeft size={18} /> : 
         <Banknote size={18} />}
      </div>
      
      {/* Detail */}
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-slate-800 text-sm truncate">
          {isSale ? 'Satış' : isExpense ? 'Gider' : 'Kasa İşlemi'}
        </h4>
        <p className="text-xs text-slate-500 truncate mt-0.5">
          {tx.description || tx.sale_number || tx.category || 'İşlem'}
        </p>
      </div>
      
      {/* Amount & Time */}
      <div className="text-right ml-2 shrink-0">
        <div className={`font-bold text-sm ${isSale ? 'text-green-600' : isExpense ? 'text-rose-600' : 'text-slate-800'}`}>
          {isSale ? '+' : isExpense ? '-' : ''}
          {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Math.abs(tx.amount || 0))}
        </div>
        <div className="text-[10px] text-slate-400 mt-0.5">
          {format(new Date(tx.created_at || new Date()), 'HH:mm')}
        </div>
      </div>
    </div>
  );
};

export const MobileDashboard = ({
  companyName,
  currentTime,
  salesSummary,
  cashReport,
  recentTransactions,
  quickNotes,
  onAddNote,
  onDeleteNote,
  onEditNote,
  charts,
  onTxClick
}) => {
  const navigate = useNavigate();

  const handleNav = (path) => {
    navigate(path);
  };

  const totalBalance = cashReport?.cash_amount + cashReport?.card_amount + cashReport?.transfer_amount;

  return (
    <div className="flex flex-col gap-4 pb-4">
      {/* ── HEADER ── */}
      <div className="flex justify-between items-end px-1 pt-2">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">{companyName}</h1>
          <p className="text-sm text-slate-500 font-medium">{format(currentTime, 'd MMMM yyyy, EEEE', { locale: tr })}</p>
        </div>
        <div className="bg-brand-50 text-brand-600 p-2 rounded-xl">
          <Banknote className="w-6 h-6" />
        </div>
      </div>

      {/* ── SWIPEABLE STATS ── */}
      <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-2 -mx-2 px-2 scrollbar-hide">
        {/* Satış Özeti */}
        <div className="snap-center shrink-0 w-[85%] bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-2xl p-4 shadow-md">
          <div className="flex justify-between items-start mb-2">
            <div className="bg-white/20 p-2 rounded-lg"><ShoppingCart size={20} /></div>
            <span className="text-xs font-semibold bg-white/20 px-2 py-1 rounded-full">Bugün</span>
          </div>
          <p className="text-sm text-green-100 font-medium">Toplam Satış</p>
          <h2 className="text-2xl font-black mt-0.5">
            {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(salesSummary?.amount || 0)}
          </h2>
        </div>

        {/* Kasa Özeti */}
        <div className="snap-center shrink-0 w-[85%] bg-gradient-to-br from-brand-600 to-indigo-700 text-white rounded-2xl p-4 shadow-md">
          <div className="flex justify-between items-start mb-2">
            <div className="bg-white/20 p-2 rounded-lg"><Banknote size={20} /></div>
            <span className="text-xs font-semibold bg-white/20 px-2 py-1 rounded-full">Kasa</span>
          </div>
          <p className="text-sm text-brand-100 font-medium">Toplam Bakiye</p>
          <h2 className="text-2xl font-black mt-0.5">
            {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(totalBalance || 0)}
          </h2>
        </div>
      </div>

      {/* ── QUICK ACTIONS GRID ── */}
      <div className="grid grid-cols-2 gap-3 mt-1">
        <button 
          onClick={() => handleNav('/pos')}
          className="flex flex-col items-center justify-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm active:scale-95 transition-transform"
        >
          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-2">
            <ShoppingCart size={24} />
          </div>
          <span className="font-semibold text-sm text-slate-800">Hızlı Satış</span>
        </button>
        
        <button 
          onClick={() => handleNav('/cash')}
          className="flex flex-col items-center justify-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm active:scale-95 transition-transform"
        >
          <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-full flex items-center justify-center mb-2">
            <ArrowRightLeft size={24} />
          </div>
          <span className="font-semibold text-sm text-slate-800">Gelir / Gider</span>
        </button>
      </div>

      {/* ── MINI CHART ── */}
      {charts?.dailyIncomeExpense?.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm mt-1">
          <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center">
            <TrendingUp className="w-4 h-4 mr-2 text-brand-500" /> Haftalık Trend
          </h3>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts.dailyIncomeExpense}>
                <defs>
                  <linearGradient id="colorIncMobile" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="income" stroke="#10b981" fillOpacity={1} fill="url(#colorIncMobile)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── QUICK NOTES ── */}
      <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm mt-1">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-slate-800 text-sm flex items-center">
            <Edit2 className="w-4 h-4 mr-2 text-yellow-500" /> Hızlı Notlar
          </h3>
        </div>
        
        <div className="flex gap-2 mb-3">
          <input 
            type="text" 
            id="mobile-note-input"
            placeholder="Kısa not ekle..." 
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onAddNote(e.target.value);
                e.target.value = '';
              }
            }}
          />
          <button 
            onClick={() => {
              const input = document.getElementById('mobile-note-input');
              if(input && input.value) {
                onAddNote(input.value);
                input.value = '';
              }
            }}
            className="bg-brand-600 text-white p-2 rounded-xl active:scale-95 transition-transform"
          >
            <Plus size={20} />
          </button>
        </div>

        <div className="space-y-2">
          {quickNotes?.length > 0 ? (
            quickNotes.slice(0, 3).map(note => (
              <div key={note.id} className="flex items-center justify-between bg-yellow-50/50 border border-yellow-100 rounded-lg p-2.5">
                <span className="text-sm text-slate-700 truncate mr-2">{note.text}</span>
                <button onClick={() => onDeleteNote(note.id)} className="text-rose-400 p-1">
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-400 text-center py-2">Henüz not eklenmemiş.</p>
          )}
        </div>
      </div>

      {/* ── RECENT TRANSACTIONS ── */}
      <div className="mt-2">
        <div className="flex justify-between items-end mb-3 px-1">
          <h3 className="font-bold text-slate-800 text-sm flex items-center">
            <ArrowRightLeft className="w-4 h-4 mr-2 text-slate-400" /> Son İşlemler
          </h3>
          <button onClick={() => handleNav('/cash')} className="text-xs text-brand-600 font-semibold">Tümü</button>
        </div>
        
        <div>
          {recentTransactions?.length > 0 ? (
            recentTransactions.map((tx, idx) => (
              <MobileTransactionCard key={tx.id || idx} tx={tx} onClick={() => onTxClick(tx)} />
            ))
          ) : (
            <div className="text-center py-6 bg-white border border-slate-100 rounded-xl">
              <p className="text-sm text-slate-400">Bugün henüz işlem yapılmadı.</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
