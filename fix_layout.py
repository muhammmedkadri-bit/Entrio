file_path = 'src/pages/purchases/NewPurchasePage.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Lines 445-634 (0-indexed: 444-633) = the entire inner form card content
# We replace it with the new restructured content

new_content = '''            <div className="bg-white rounded-xl p-4 sm:p-5" style={{ border: '1px solid rgba(229,231,235,0.8)' }}>
              {/* Card Header */}
              <div className="flex items-center gap-2 mb-5 pb-3 border-b border-gray-100">
                <div className="w-6 h-6 rounded-md bg-indigo-50 flex items-center justify-center">
                  <Hash className="w-3.5 h-3.5 text-indigo-500" />
                </div>
                <span className="text-sm font-semibold text-gray-700">Fatura Bilgileri</span>
              </div>

              {/* Row 1: Invoice Title & Supplier */}
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div className="col-span-2">
                  <label className={labelCls}>
                    <span className="flex items-center gap-1">
                      <Hash className="w-3 h-3" /> Fatura İsmi
                    </span>
                  </label>
                  <input
                    {...register('invoice_title')}
                    type="text"
                    placeholder="Alış faturası için kısa bir isim veya açıklama"
                    className={inputCls}
                  />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3 h-3" /> Tedarikçi Arama
                    </span>
                  </label>
                  <SupplierCombobox
                    value={supplier}
                    onChange={(s) => {
                      setSupplier(s);
                      methods.setValue('supplier_id', s?.id || null);
                    }}
                    onCreateNew={() => setShowQuickCreateSupplier(true)}
                  />
                </div>
              </div>

              {/* Row 2: Invoice No + Invoice Date + Due Date */}
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div className="col-span-2">
                  <label className={labelCls}>
                    <span className="flex items-center gap-1">
                      <Hash className="w-3 h-3" /> Fiş / Fatura No
                    </span>
                  </label>
                  <input
                    {...register('invoice_number')}
                    type="text"
                    placeholder="Varsa fiş / fatura no ekleyin"
                    className={`${inputCls} font-mono`}
                  />
                </div>

                {/* Düzenleme Tarihi */}
                <div>
                  <label className={labelCls}>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Düzenleme Tarihi
                    </span>
                  </label>
                  <Controller
                    control={methods.control}
                    name="invoice_date"
                    render={({ field }) => (
                      <DatePicker
                        compact
                        allowClear={false}
                        value={{ start: new Date(field.value || Date.now()), end: new Date(field.value || Date.now()) }}
                        onChange={(val) => { if (val?.start) field.onChange(format(val.start, 'yyyy-MM-dd')); }}
                        renderTrigger={({ setIsOpen }) => (
                          <div
                            className={`${inputCls} flex items-center gap-2 cursor-pointer`}
                            onClick={() => setIsOpen(true)}
                          >
                            <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <span className="text-[13px] font-medium text-gray-700 whitespace-nowrap">
                              {field.value ? format(new Date(field.value), 'dd.MM.yyyy') : 'Tarih Seçin'}
                            </span>
                          </div>
                        )}
                      />
                    )}
                  />
                </div>

                {/* Vade Tarihi */}
                <div>
                  <label className={labelCls}>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Vade Tarihi
                    </span>
                  </label>
                  {dueDateMode === 'custom' ? (
                    <Controller
                      control={methods.control}
                      name="due_date"
                      render={({ field }) => (
                        <DatePicker
                          compact
                          allowClear={false}
                          value={field.value ? { start: new Date(field.value), end: new Date(field.value) } : null}
                          onChange={(val) => { if (val?.start) field.onChange(format(val.start, 'yyyy-MM-dd')); }}
                          renderTrigger={({ setIsOpen }) => (
                            <div className={`${inputCls} flex items-center gap-2 cursor-pointer`}>
                              <div className="flex-1 flex items-center gap-2" onClick={() => setIsOpen(true)}>
                                <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                <span className="text-[13px] font-medium text-gray-700 whitespace-nowrap">
                                  {field.value ? format(new Date(field.value), 'dd.MM.yyyy') : 'Tarih Seçin'}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); methods.setValue('due_date_mode', '0'); }}
                                className="text-gray-300 hover:text-red-400 transition-colors shrink-0"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        />
                      )}
                    />
                  ) : (
                    <Controller
                      control={control}
                      name="due_date_mode"
                      render={({ field }) => (
                        <div className={`${inputCls} flex items-center gap-2`}>
                          <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <select
                            value={field.value}
                            onChange={(e) => field.onChange(e.target.value)}
                            className="flex-1 text-[13px] font-medium text-gray-700 bg-transparent border-none outline-none cursor-pointer appearance-none truncate"
                          >
                            {DUE_OPTIONS.map(o => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                          <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0 pointer-events-none" />
                        </div>
                      )}
                    />
                  )}
                </div>
              </div>

              {/* Row 3: İskonto, Para Birimi, Stok Girişi, Ödeme Durumu */}
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div>
                  <label className={labelCls}>İskonto Listeleri</label>
                  <div className={`${inputCls} flex items-center gap-2 opacity-50 cursor-not-allowed`}>
                    <span className="flex-1 text-[13px] font-medium text-gray-500 truncate">Şimdilik Deaktif</span>
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Para Birimi</label>
                  <div className={`${inputCls} flex items-center gap-2 opacity-50 cursor-not-allowed`}>
                    <span className="flex-1 text-[13px] font-medium text-gray-500 truncate">TRY (₺)</span>
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Stok Girişi</label>
                  <div className={`${inputCls} flex items-center gap-2 opacity-50 cursor-not-allowed`}>
                    <span className="flex-1 text-[13px] font-medium text-gray-500 truncate">Şimdilik Deaktif</span>
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Ödeme Durumu</label>
                  <div className={`${inputCls} flex items-center gap-2 relative`}>
                    <select
                      {...register('payment_status')}
                      className="flex-1 text-[13px] font-medium text-gray-700 bg-transparent border-none outline-none cursor-pointer appearance-none truncate"
                    >
                      <option value="unpaid">Ödeme Yapılacak</option>
                      <option value="paid">Ödeme Yapıldı</option>
                      <option value="partial">Kısmi Ödeme</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0 pointer-events-none" />
                  </div>
                </div>
              </div>
'''

# Replace lines 444 to 633 (0-indexed), i.e. lines 445-634 (1-indexed)
del lines[444:634]
lines.insert(444, new_content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Done!")
