import React, { useState } from 'react';
import { Settings, Users, Building2, Tag, FileText } from 'lucide-react';
import { CategoriesTab } from '../stock/tabs/CategoriesTab';
import { AuthOpsTab } from './tabs/AuthOpsTab';
import { CompanyInfoTab } from './tabs/CompanyInfoTab';
import { ReceiptTemplatesTab } from './tabs/ReceiptTemplatesTab';
import { ClearDataTab } from './tabs/ClearDataTab';
import { Trash2 } from 'lucide-react';

export const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState('auth_ops');

  const tabs = [
    { id: 'auth_ops', label: 'Giriş İşlemleri', icon: Users },
    { id: 'company_info', label: 'Şirket Bilgileri', icon: Building2 },
    { id: 'receipt_templates', label: 'Fiş Şablonları', icon: FileText },
    { id: 'categories', label: 'Kategoriler', icon: Tag },
    { id: 'clear_data', label: 'Verileri Sil', icon: Trash2 }
  ];

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
      
      {/* Header */}
      <div className="flex-none p-6 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center border border-slate-200/60 shadow-sm">
              <Settings className="w-6 h-6 text-slate-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Sistem Ayarları</h1>
              <p className="text-sm text-slate-500 font-medium mt-0.5">Kullanıcı, şirket, kategori ve yazdırma konfigürasyonları</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col p-6 overflow-hidden min-h-0">
        {/* Tabs */}
        <div className="flex-none flex space-x-1 bg-slate-200/50 p-1.5 rounded-xl w-full sm:w-fit mb-6 overflow-x-auto hide-scrollbar">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 whitespace-nowrap px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                isActive ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-y-auto pr-2 rounded-xl">
          {activeTab === 'auth_ops' && <AuthOpsTab />}
          {activeTab === 'company_info' && <CompanyInfoTab />}
          {activeTab === 'receipt_templates' && <ReceiptTemplatesTab />}
          {activeTab === 'categories' && <CategoriesTab />}
          {activeTab === 'clear_data' && <ClearDataTab />}
        </div>
      </div>
    </div>
  );
};
