import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export const Drawer = ({ isOpen, onClose, title, children, width = 'max-w-md', borderLeft = false }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end print:static print:z-auto print:block">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity print:hidden" 
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className={`relative w-full ${width} bg-white h-full shadow-2xl flex flex-col transform transition-transform duration-300 print:w-full print:max-w-none print:shadow-none ${borderLeft ? 'border-l-4 border-l-brand-500' : ''}`}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 print:hidden">
          <h2 className="text-xl font-bold text-slate-800">{title}</h2>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto print:overflow-visible">
          {children}
        </div>
      </div>
    </div>
  );
};
