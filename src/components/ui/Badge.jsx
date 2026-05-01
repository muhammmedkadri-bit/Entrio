import React from 'react';

export const Badge = ({ children, variant = 'gray' }) => {
  const styles = {
    success: 'bg-green-100 text-green-800 border-green-200',
    danger: 'bg-red-100 text-red-800 border-red-200',
    warning: 'bg-amber-100 text-amber-800 border-amber-200',
    info: 'bg-brand-100 text-brand-800 border-brand-200',
    gray: 'bg-slate-100 text-slate-800 border-slate-200'
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[variant]}`}>
      {children}
    </span>
  );
};
