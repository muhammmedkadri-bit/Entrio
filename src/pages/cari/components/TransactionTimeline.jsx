import React from 'react';
import { format } from 'date-fns';
import { ArrowDownLeft, ArrowUpRight, CopyMinus, RotateCcw } from 'lucide-react';

export const TransactionTimeline = ({ transactions, type = 'customer' }) => {
  if (!transactions || transactions.length === 0) {
    return <div className="text-center text-slate-400 py-8">Bakiye hareketi bulunmuyor.</div>;
  }

  const formatCurrency = (val) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);

  const getIconAndColor = (txType) => {
    switch(txType) {
      case 'purchase':
      case 'sale':
        return { icon: ArrowUpRight, color: 'text-blue-500', bg: 'bg-blue-100' };
      case 'payment':
        return { icon: ArrowDownLeft, color: 'text-green-500', bg: 'bg-green-100' };
      case 'return':
        return { icon: RotateCcw, color: 'text-orange-500', bg: 'bg-orange-100' };
      case 'adjustment':
        return { icon: CopyMinus, color: 'text-slate-500', bg: 'bg-slate-100' };
      default:
        return { icon: CopyMinus, color: 'text-slate-500', bg: 'bg-slate-100' };
    }
  };

  const getLabel = (txType) => {
    if (type === 'customer') {
      const map = { sale: 'Satış', payment: 'Tahsilat', return: 'İade', adjustment: 'Düzeltme' };
      return map[txType] || txType;
    } else {
      const map = { purchase: 'Alış', payment: 'Ödeme', return: 'İade', adjustment: 'Düzeltme' };
      return map[txType] || txType;
    }
  };

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {transactions.map((tx, idx) => {
          const isLast = idx === transactions.length - 1;
          const styleProps = getIconAndColor(tx.transaction_type);
          const Icon = styleProps.icon;
          
          return (
            <li key={tx.id}>
              <div className="relative pb-8">
                {!isLast ? (
                  <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-200" aria-hidden="true"></span>
                ) : null}
                <div className="relative flex space-x-3">
                  <div>
                    <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${styleProps.bg} ${styleProps.color}`}>
                      <Icon className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                    <div>
                      <p className="text-sm text-slate-800 font-bold mb-0.5">
                        {getLabel(tx.transaction_type)} 
                        {tx.reference_id && <span className="ml-2 px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-xs font-mono">#{tx.reference_id}</span>}
                      </p>
                      <p className="text-sm text-slate-500">{tx.notes}</p>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <div className={`text-sm font-bold ${['sale', 'purchase'].includes(tx.transaction_type) ? 'text-red-600' : 'text-emerald-600'}`}>
                        {['sale', 'purchase'].includes(tx.transaction_type) ? '+' : '-'}{formatCurrency(tx.amount)}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        Sonraki Bakiye: <span className="font-semibold text-slate-600">{formatCurrency(tx.balance_after)}</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {format(tx.created_at, 'dd.MM HH:mm')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
