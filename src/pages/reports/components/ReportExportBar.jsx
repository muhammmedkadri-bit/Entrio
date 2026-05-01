import React from 'react';
import { Download, Printer } from 'lucide-react';
import { Button } from '../../../components/ui/Button';

export const ReportExportBar = ({ onDownloadCsv, reportName = 'Rapor' }) => {
  return (
    <div className="flex gap-2 hide-on-print">
      {onDownloadCsv && (
        <Button 
          variant="outline" 
          icon={Download} 
          onClick={onDownloadCsv}
          className="text-slate-600 border-slate-200 hover:bg-slate-50"
        >
          CSV İndir
        </Button>
      )}
      <Button 
        variant="outline" 
        icon={Printer} 
        onClick={() => window.print()}
        className="text-brand-600 border-brand-200 hover:bg-brand-50"
      >
        Yazdır
      </Button>
    </div>
  );
};
