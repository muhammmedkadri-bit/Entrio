import sys

file_path = 'src/pages/purchases/NewPurchasePage.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_layout = """              {/* Row 1: Invoice Title & Supplier Selection */}
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
                    className={`${inputCls} h-[40px] px-3 border border-gray-200 rounded-lg w-full bg-white outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100 transition-all text-[13px] font-medium text-gray-700`}
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

              {/* Row 2: Fiş/Fatura No & Dates */}
              <div className="grid grid-cols-4 gap-4 mb-4">
                {/* Fiş/Fatura No is 2 columns */}
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
                    className={`${inputCls} h-[40px] px-3 border border-gray-200 rounded-lg w-full font-mono bg-white outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100 transition-all text-[13px] text-gray-700`}
                  />
                </div>
                {/* Düzenleme Tarihi + Vade Tarihi — joined group */}
                <div className="col-span-2">
                  <div className="flex items-center gap-1 mb-1">
                    <Calendar className="w-3 h-3 text-gray-400" />
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Tarihler</span>
                  </div>
                  <div className="flex h-[40px] rounded-lg overflow-hidden border border-gray-200 bg-white divide-x divide-gray-200 focus-within:border-emerald-400 focus-within:ring-1 focus-within:ring-emerald-100 transition-all">
                    {/* Düzenleme Tarihi */}
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
                              className="flex items-center gap-2 px-3 h-full cursor-pointer flex-1 group hover:bg-gray-50/50"
                              onClick={() => setIsOpen(true)}
                            >
                              <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              <div className="flex flex-col min-w-0">
                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider leading-none mb-0.5">Düzenleme</span>
                                <span className="text-[13px] font-medium text-gray-700 whitespace-nowrap">{field.value ? format(new Date(field.value), 'dd.MM.yyyy') : 'Tarih Seçin'}</span>
                              </div>
                            </div>
                          )}
                        />
                      )}
                    />

                    {/* Vade Tarihi */}
                    <div className="flex items-center flex-1 relative bg-white">
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
                                <div className="flex items-center gap-2 px-3 h-full cursor-pointer w-full hover:bg-gray-50/50">
                                  <div className="flex flex-col flex-1 min-w-0" onClick={() => setIsOpen(true)}>
                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider leading-none mb-0.5">Vade</span>
                                    <span className="text-[13px] font-medium text-gray-700 whitespace-nowrap">{field.value ? format(new Date(field.value), 'dd.MM.yyyy') : 'Tarih Seçin'}</span>
                                  </div>
                                  <div className="h-4 w-px bg-gray-200 mx-1 shrink-0" />
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); methods.setValue('due_date_mode', '0'); }}
                                    className="text-gray-400 hover:text-red-500 transition-colors shrink-0 p-1"
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
                            <div className="flex items-center gap-2 px-3 h-full w-full hover:bg-gray-50/50">
                              <div className="flex flex-col flex-1 min-w-0">
                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider leading-none mb-0.5">Vade</span>
                                <select
                                  value={field.value}
                                  onChange={(e) => field.onChange(e.target.value)}
                                  className="text-[13px] font-medium text-gray-700 bg-transparent border-none outline-none cursor-pointer appearance-none w-full truncate h-full py-0"
                                >
                                  {DUE_OPTIONS.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                  ))}
                                </select>
                              </div>
                              <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0 pointer-events-none" />
                            </div>
                          )}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 3: İskonto, Para Birimi, Stok Girişi, Ödeme Durumu */}
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div>
                  <label className={labelCls}>İskonto Listeleri</label>
                  <AnimatedDropdown
                    disabled
                    value="disabled"
                    options={[{ id: 'disabled', label: 'Şimdilik Deaktif' }]}
                    className="w-full h-[40px]"
                  />
                </div>
                <div>
                  <label className={labelCls}>Para Birimi</label>
                  <AnimatedDropdown
                    disabled
                    value="try"
                    options={[{ id: 'try', label: 'TRY (₺)' }]}
                    className="w-full h-[40px]"
                  />
                </div>
                <div>
                  <label className={labelCls}>Stok Girişi</label>
                  <AnimatedDropdown
                    disabled
                    value="disabled"
                    options={[{ id: 'disabled', label: 'Şimdilik Deaktif' }]}
                    className="w-full h-[40px]"
                  />
                </div>
                <div>
                  <label className={labelCls}>Ödeme Durumu</label>
                  <Controller
                    control={control}
                    name="payment_status"
                    render={({ field }) => (
                      <AnimatedDropdown
                        value={field.value}
                        onChange={field.onChange}
                        options={[
                          { id: 'unpaid', label: 'Ödeme Yapılacak' },
                          { id: 'paid', label: 'Ödeme Yapıldı' },
                          { id: 'partial', label: 'Kısmi Ödeme' }
                        ]}
                        className="w-full h-[40px]"
                      />
                    )}
                  />
                </div>
              </div>
"""

del lines[445:602]
lines.insert(445, new_layout)

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

