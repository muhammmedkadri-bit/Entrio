import React from 'react';

export const StatCard = ({ title, value, icon: Icon, change, trend = 'neutral', colorTheme = 'brand' }) => {
  const trendColors = {
    up: 'text-green-600 bg-green-50 rounded-full px-2 py-0.5 text-xs font-semibold',
    down: 'text-red-600 bg-red-50 rounded-full px-2 py-0.5 text-xs font-semibold',
    neutral: 'text-slate-500 bg-slate-100 rounded-full px-2 py-0.5 text-xs font-semibold'
  };

  const bgColors = {
    brand: 'bg-brand-50 border-brand-100',
    grass: 'bg-[#7ed957]/15 border-[#7ed957]/40',
    green: 'bg-green-50 border-green-100',
    emerald: 'bg-emerald-50 border-emerald-100',
    red: 'bg-red-50 border-red-100',
    rose: 'bg-rose-50 border-rose-100',
    amber: 'bg-amber-50 border-amber-100',
    slate: 'bg-slate-50 border-slate-100'
  };

  const iconColors = {
    brand: 'text-brand-600',
    grass: 'text-[#3a8024]',
    green: 'text-green-600',
    emerald: 'text-emerald-600',
    red: 'text-red-600',
    rose: 'text-rose-600',
    amber: 'text-amber-600',
    slate: 'text-slate-600'
  };

  return (
    <div className={`overflow-hidden rounded-xl border shadow-sm ${bgColors[colorTheme]}`}>
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            {Icon && <Icon className={`h-6 w-6 ${iconColors[colorTheme]}`} aria-hidden="true" />}
          </div>
          <div className="ml-4 w-0 flex-1">
            <dl>
              <dt className="truncate text-sm font-medium text-slate-500">{title}</dt>
              <dd className="flex items-baseline mt-1">
                <div className="text-2xl font-semibold text-slate-900">{value}</div>
                {change && (
                  <div className={`ml-2 flex items-baseline ${trendColors[trend]}`}>
                    {change}
                  </div>
                )}
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
};
