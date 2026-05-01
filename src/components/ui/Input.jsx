import React from 'react';

export const Input = React.forwardRef(({
  label,
  error,
  prefixIcon: PrefixIcon,
  suffixIcon: SuffixIcon,
  className = '',
  ...props
}, ref) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        {PrefixIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <PrefixIcon className="h-5 w-5 text-slate-400" />
          </div>
        )}
        <input
          ref={ref}
          className={`
            block w-full rounded-lg border-slate-300 shadow-sm
            focus:ring-brand-500 focus:border-brand-500 sm:text-sm
            disabled:bg-slate-100 disabled:text-slate-500
            ${PrefixIcon ? 'pl-10' : ''}
            ${SuffixIcon ? 'pr-10' : ''}
            ${error ? 'border-red-300 text-red-900 focus:ring-red-500 focus:border-red-500' : 'border-slate-300'}
            ${className}
          `}
          {...props}
        />
        {SuffixIcon && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <SuffixIcon className="h-5 w-5 text-slate-400" />
          </div>
        )}
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';
