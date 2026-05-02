import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Search, Plus, Eye, Download, FileText } from 'lucide-react';
import { purchaseService } from '../../../services/purchaseService';
import { DataTable } from '../../../components/ui/DataTable';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { PurchaseDetailModal } from '../modals/PurchaseDetailModal';
import toast from '../../../components/ui/CustomToast';

export const PurchaseListTab = ({ onNewPurchase }) => {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Selection/Detail State
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [isDetailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    fetchPurchases();
  }, []);

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const data = await purchaseService.getAll();
      setPurchases(data);
    } catch (err) {
      toast.error('Alış faturaları getirilemedi.');
    } finally {
      setLoading(false);
    }
  };

  const handleView = async (id) => {
    try {
      const full = await purchaseService.getById(id);
      setSelectedPurchase(full);
      setDetailOpen(true);
    } catch (e) {
      toast.error('Detaylar alınamadı.');
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);

  const columns = [
    {
      header: 'Fatura No',
      cell: (row) => (
        <button onClick={() => handleView(row.id)} className="font-mono font-semibold text-slate-700 hover:text-indigo-600 hover:underline">
          {row.invoice_number
            ? <span className="text-indigo-600">{row.invoice_number}</span>
            : <span className="text-slate-400">—</span>}
        </button>
      )
    },
    {
      header: 'Tarih',
      cell: (row) => format(row.created_at, 'dd.MM.yyyy HH:mm')
    },
    {
      header: 'Tedarikçi',
      accessorKey: 'supplier_name',
      cell: (row) => row.supplier_name || <span className="text-slate-400">Muhtelif</span>
    },
    {
      header: 'Toplam Tutar',
      cell: (row) => <span className="font-bold text-slate-800">{formatCurrency(row.total_amount)}</span>
    },
    {
      header: 'Ödenen',
      cell: (row) => <span className="font-bold text-emerald-600">{formatCurrency(row.paid_amount)}</span>
    },
    {
      header: 'Kalan Borç',
      cell: (row) => {
        const debt = row.total_amount - row.paid_amount;
        return <span className={`font-bold ${debt > 0 ? 'text-red-600' : 'text-slate-400'}`}>{formatCurrency(Math.max(0, debt))}</span>
      }
    },
    {
      header: 'Durum',
      cell: (row) => {
        if (row.status === 'received') return <Badge variant="success">Alındı</Badge>;
        if (row.status === 'cancelled') return <Badge variant="danger">İptal</Badge>;
        return <Badge>{row.status}</Badge>;
      }
    },
    {
      header: 'İşlem',
      cell: (row) => (
        <button onClick={() => handleView(row.id)} className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded" title="Görüntüle">
          <Eye className="w-5 h-5" />
        </button>
      )
    }
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-4 p-4 bg-white rounded-xl shadow-sm border border-slate-200 hide-on-print">
        <div className="flex gap-3 text-slate-500 font-semibold text-sm items-center">
          <FileText className="w-5 h-5" /> Fatura Geçmişi
        </div>
        <div className="flex gap-2">
          <Button variant="outline" icon={Download} onClick={() => window.print()}>Yazdır</Button>
          <Button icon={Plus} onClick={onNewPurchase}>Yeni Fatura (Hızlı Alış)</Button>
        </div>
      </div>

      <DataTable 
        columns={columns}
        data={purchases}
        loading={loading}
        emptyMessage="Listelenecek alış faturası bulunamadı."
      />

      <PurchaseDetailModal 
        isOpen={isDetailOpen}
        onClose={() => setDetailOpen(false)}
        purchase={selectedPurchase}
        onUpdated={fetchPurchases}
      />
    </div>
  );
};
