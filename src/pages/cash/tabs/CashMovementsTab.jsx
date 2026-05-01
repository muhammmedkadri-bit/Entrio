import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Download, Moon, Sun, ChevronDown, ChevronUp } from 'lucide-react';
import { cashService } from '../../../services/cashService';
import { dayCloseService } from '../../../services/dayCloseService';
import { DataTable } from '../../../components/ui/DataTable';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';

export const CashMovementsTab = ({ registersArr }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedReg, setSelectedReg] = useState(registersArr?.[0]?.id || '');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    if (selectedReg) {
      fetchMovements();
    }
  }, [selectedReg, filterType]);

  const fetchMovements = async () => {
    setLoading(true);
    try {
      const txs = await cashService.getTransactions(parseInt(selectedReg), { type: filterType });
      setTransactions(txs);
    } catch(e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);

  const getTxStyle = (type) => {
    const map = {
      sale_in: { label: 'Satış', color: 'success' },
      purchase_out: { label: 'Alış', color: 'danger' },
      return_out: { label: 'İade', color: 'warning' },
      return_in: { label: 'İade Girişi', color: 'warning' },
      customer_payment_in: { label: 'Cari Alacak', color: 'success' },
      supplier_payment_out: { label: 'Tedarikçi Ödemesi', color: 'danger' },
      pos_card_in: { label: 'Tedarikçi Tahsilatı', color: 'success' },
      expense_out: { label: 'Gider', color: 'danger' },
      deposit_in: { label: 'Giriş', color: 'success' },
      withdrawal_out: { label: 'Çıkış', color: 'danger' },
      opening: { label: 'Açılış', color: 'default' },
      closing: { label: 'Kapanış', color: 'default' },
      day_close: { label: 'Gün Sonu', color: 'default' }
    };
    return map[type] || { label: type, color: 'default' };
  };

  const renderExpandedRow = (row) => {
    if (!row.is_day_close || !row.day_close_data) return null;
    
    let data;
    try {
      data = JSON.parse(row.day_close_data);
    } catch {
      return <div className="p-4 text-sm text-red-500">Veri okunamadı.</div>;
    }

    return (
      <div className="p-4 md:p-6 bg-slate-50 border-t border-slate-100">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-3">
            <h4 className="font-bold text-sm text-slate-800">Finansal Özet</h4>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Toplam Gelir</span>
              <span className="text-emerald-600 font-medium">+{formatCurrency(data.total_income)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Toplam Gider</span>
              <span className="text-red-600 font-medium">-{formatCurrency(data.total_expense)}</span>
            </div>
            <div className="pt-2 mt-2 border-t border-slate-100 flex justify-between">
              <span className="font-bold text-slate-800">Net Para Akışı</span>
              <span className={`font-bold ${data.net_cashflow >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatCurrency(data.net_cashflow)}
              </span>
            </div>
          </div>

          <div className="md:col-span-2 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
            <h4 className="font-bold text-sm text-slate-800 mb-3">Kasa Bazlı Döküm</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead>
                  <tr>
                    <th className="text-left text-xs text-slate-500 pb-2">Kasa</th>
                    <th className="text-right text-xs text-slate-500 pb-2">Gelir</th>
                    <th className="text-right text-xs text-slate-500 pb-2">Gider</th>
                    <th className="text-right text-xs text-slate-500 pb-2">Günlük Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.register_summaries.map(s => (
                    <tr key={s.register_id}>
                      <td className="py-2 text-sm font-medium text-slate-700">{s.register_name}</td>
                      <td className="py-2 text-sm text-right text-emerald-600">+{formatCurrency(s.income)}</td>
                      <td className="py-2 text-sm text-right text-red-600">-{formatCurrency(s.expense)}</td>
                      <td className="py-2 text-sm text-right font-bold text-slate-800">{formatCurrency(s.daily_net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const columns = [
    {
      header: 'Tarih',
      cell: (row) => format(row.created_at, 'dd.MM.yyyy HH:mm')
    },
    {
      header: 'İşlem Tipi',
      cell: (row) => {
        if (row.is_day_close) {
          const isAuto = row.notes.includes('Otomatik');
          const Icon = isAuto ? Moon : Sun;
          return (
            <div className="bg-slate-100 text-slate-600 border border-slate-200 font-semibold text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1">
              <Icon className="w-3 h-3" />
              <span>Gün Sonu</span>
            </div>
          );
        }
        const st = getTxStyle(row.transaction_type);
        return <Badge variant={st.color}>{st.label}</Badge>;
      }
    },
    {
      header: 'Açıklama',
      accessorKey: 'notes',
      cell: (row) => <span className="text-slate-600 text-sm">{row.notes || '-'}</span>
    },
    {
      header: 'Tutar',
      cell: (row) => {
        if (row.is_day_close) {
          return <span className="font-bold text-slate-800">{formatCurrency(row.amount)}</span>;
        }
        const isOut = ['purchase_out', 'supplier_payment_out', 'expense_out', 'withdrawal_out', 'return_out'].includes(row.transaction_type);
        return (
          <span className={`font-bold ${isOut ? 'text-red-600' : 'text-emerald-600'}`}>
            {isOut ? '-' : '+'}{formatCurrency(row.amount)}
          </span>
        );
      }
    },
    {
      header: 'İşlem Sonrası Bakiye',
      cell: (row) => <span className="font-mono text-slate-500 font-bold">{formatCurrency(row.balance_after)}</span>
    }
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center hide-on-print">
        <div className="flex gap-3 w-full md:w-auto">
          <select 
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50"
            value={selectedReg}
            onChange={e => setSelectedReg(e.target.value)}
          >
            {registersArr.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>

          <select 
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
          >
            <option value="all">Tüm İşlemler</option>
            <option value="opening">Açılışlar</option>
            <option value="closing">Kapanışlar</option>
            <option value="sale_in">Satışlar</option>
            <option value="expense_out">Giderler</option>
          </select>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" icon={Download} onClick={() => window.print()}>Rapor Yazdır</Button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden print:border-none">
        <div className="hidden print:block text-center p-4">
          <h2 className="text-2xl font-black">Kasa Hareketleri Raporu</h2>
          <p className="text-sm">{format(new Date(), 'dd.MM.yyyy HH:mm')}</p>
        </div>
        <DataTable 
          columns={columns} 
          data={transactions} 
          loading={loading} 
          emptyMessage="Seçili filtreye uygun hareket bulunamadı."
          renderExpandedRow={renderExpandedRow}
        />
      </div>
    </div>
  );
};
