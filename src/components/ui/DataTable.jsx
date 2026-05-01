import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { PremiumLoader } from './PremiumLoader';

export const DataTable = ({ columns, data, loading = false, emptyMessage = 'Veri bulunamadı.', itemsPerPage = 10, tdClassName = 'py-2.5', thClassName = 'py-3.5', onRowClick, renderExpandedRow }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRowId, setExpandedRowId] = useState(null);
  
  const totalPages = Math.ceil((data?.length || 0) / itemsPerPage);

  const paginatedData = data?.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleRowClick = (row, i) => {
    if (renderExpandedRow) {
      setExpandedRowId(expandedRowId === (row.id || i) ? null : (row.id || i));
    }
    if (onRowClick) onRowClick(row);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((col, i) => (
                <th
                  key={i}
                  className={`px-6 ${thClassName} text-left text-xs font-medium text-slate-500 uppercase tracking-wider`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {loading ? (
              <tr>
                <td colSpan={columns.length}>
                  <div className="relative h-64">
                    <PremiumLoader isOpen={true} />
                  </div>
                </td>
              </tr>
            ) : paginatedData?.length > 0 ? (
              paginatedData.map((row, i) => (
                <React.Fragment key={row.id || i}>
                  <tr 
                    onClick={() => handleRowClick(row, i)}
                    className={`${(onRowClick || renderExpandedRow) ? 'hover:bg-emerald-50/50 cursor-pointer group' : 'hover:bg-slate-50'} transition-colors ${expandedRowId === (row.id || i) ? 'bg-slate-50' : ''}`}
                  >
                    {columns.map((col, j) => (
                      <td key={j} className={`px-6 ${tdClassName} whitespace-nowrap text-sm text-slate-700`}>
                        {col.cell ? col.cell(row) : row[col.accessorKey]}
                      </td>
                    ))}
                  </tr>
                  {renderExpandedRow && expandedRowId === (row.id || i) && (
                    <tr className="bg-slate-50/80">
                      <td colSpan={columns.length} className="p-0">
                        {renderExpandedRow(row)}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <Inbox className="h-10 w-10 text-slate-300" />
                    <span>{emptyMessage}</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!loading && data?.length > itemsPerPage && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-slate-200 sm:px-6">
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-slate-700">
                Toplam <span className="font-medium">{data.length}</span> kayıttan{' '}
                <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span>-
                <span className="font-medium">{Math.min(currentPage * itemsPerPage, data.length)}</span>{' '}
                arası gösteriliyor
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-slate-300 bg-white text-sm font-medium text-slate-500 hover:bg-slate-50"
                >
                  <span className="sr-only">Önceki</span>
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-slate-300 bg-white text-sm font-medium text-slate-500 hover:bg-slate-50"
                >
                  <span className="sr-only">Sonraki</span>
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
