import React from 'react';
import { Download } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '../../../components/ui/Button';

export const CariExportButton = ({ data, columns, filenamePrefix = "Cari-Liste" }) => {

  const handleExport = () => {
    if (!data || data.length === 0) return;

    const headers = columns.map(c => c.label);
    const rows = data.map(item => {
      return columns.map(col => {
        let val = typeof col.value === 'function' ? col.value(item) : item[col.value];
        if (val === null || val === undefined) val = '';
        return `"${String(val).replace(/"/g, '""')}"`;
      });
    });

    const csvContent = [
      headers.join(';'),
      ...rows.map(r => r.join(';'))
    ].join('\n');

    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filenamePrefix}-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`;
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Button variant="outline" icon={Download} onClick={handleExport}>
      Excel'e Aktar
    </Button>
  );
};
