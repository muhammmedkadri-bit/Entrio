import React, { useState, useEffect } from 'react';
import { stockService } from '../../../services/stockService';
import { DataTable } from '../../../components/ui/DataTable';
import { Badge } from '../../../components/ui/Badge';
import { format } from 'date-fns';

export const MovementsTab = () => {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    fetchMovements();
  }, [filterType]);

  const fetchMovements = async () => {
    setLoading(true);
    try {
      const result = await stockService.getMovements({ type: filterType });
      setMovements(result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getMovementTypeProps = (type) => {
    switch(type) {
      case 'purchase': return { label: 'Alış', variant: 'info' };
      case 'sale': return { label: 'Satış', variant: 'success' };
      case 'return_in': return { label: 'İade (Alış)', variant: 'info' };
      case 'return_out': return { label: 'İade (Satış)', variant: 'warning' };
      case 'adjustment_in': return { label: 'Düzeltme (Giriş)', variant: 'success' };
      case 'adjustment_out': return { label: 'Düzeltme (Çıkış)', variant: 'danger' };
      default: return { label: type, variant: 'default' };
    }
  };

  const columns = [
    {
      header: 'Tarih',
      cell: (row) => format(row.created_at, 'dd.MM.yyyy HH:mm')
    },
    {
      header: 'Ürün',
      accessorKey: 'product_name'
    },
    {
      header: 'Tür',
      cell: (row) => {
        const props = getMovementTypeProps(row.movement_type);
        return <Badge variant={props.variant}>{props.label}</Badge>;
      }
    },
    {
      header: 'Miktar',
      cell: (row) => {
        const isInput = ['adjustment_in', 'return_in', 'purchase'].includes(row.movement_type);
        return (
          <span className={`font-bold ${isInput ? 'text-green-600' : 'text-red-600'}`}>
            {isInput ? '+' : '-'}{row.quantity}
          </span>
        );
      }
    },
    {
      header: 'Notlar / Referans',
      cell: (row) => (
        <div className="text-sm">
          {row.reference && <div className="font-medium text-slate-700">{row.reference}</div>}
          {row.notes && <div className="text-slate-500 text-xs">{row.notes}</div>}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-3 p-4 bg-white rounded-xl shadow-sm border border-slate-200">
        <select 
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-brand-500"
        >
          <option value="all">Tüm Hareket Türleri</option>
          <option value="sale">Satışlar</option>
          <option value="purchase">Girişler/Alışlar</option>
          <option value="adjustment_in">Manuel Girişler</option>
          <option value="adjustment_out">Manuel Çıkışlar</option>
        </select>
      </div>

      <DataTable 
        columns={columns}
        data={movements}
        loading={loading}
        emptyMessage="Seçilen kritere uygun hareket bulunamadı."
      />
    </div>
  );
};
