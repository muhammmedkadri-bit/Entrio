import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  footer, 
  size = 'md',
  heightClass = '',
  bodyClassName = 'px-4 py-5 sm:p-6'
}) => {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    xl2: 'max-w-[820px]'
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <style>{`
        @keyframes _m-backdrop { from { opacity: 0; } to { opacity: 1; } }
        @keyframes _m-panel { from { opacity: 0; transform: scale(0.96) translateY(-6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
      <div 
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm"
        style={{ animation: '_m-backdrop 0.15s ease-out forwards' }}
        onClick={onClose}
      />
      <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
        <div 
          className={`relative overflow-hidden rounded-xl bg-white text-left shadow-xl sm:my-8 w-full ${sizes[size]} flex flex-col ${heightClass}`}
          style={{ animation: '_m-panel 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards', maxHeight: 'calc(100vh - 4rem)' }}
        >
          <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4 border-b border-slate-100 flex justify-between items-center shrink-0">
            <h3 className="text-lg font-semibold leading-6 text-slate-900">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="rounded-md bg-white text-slate-400 hover:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <div className={`overflow-y-auto ${heightClass ? 'flex-1' : ''} ${bodyClassName}`}>
            {children}
          </div>

          {footer && (
            <div className="bg-slate-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 border-t border-slate-100 rounded-b-xl shrink-0">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
