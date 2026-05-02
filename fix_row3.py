file_path = 'src/pages/purchases/NewPurchasePage.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

old_import = "import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../../components/ui/DropdownMenu';"
new_import = "import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, SelectDropdown } from '../../components/ui/DropdownMenu';"

if old_import in content:
    content = content.replace(old_import, new_import)

old_row_3 = """              {/* Row 3: İskonto, Para Birimi, Stok Girişi, Ödeme Durumu */}
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
              </div>"""

new_row_3 = """              {/* Row 3: İskonto, Para Birimi, Stok Girişi, Ödeme Durumu */}
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div>
                  <label className={labelCls}>İskonto Listeleri</label>
                  <SelectDropdown
                    disabled
                    value="disabled"
                    options={[{ value: 'disabled', label: 'Şimdilik Deaktif' }]}
                    className="w-full h-[40px] shadow-sm text-[13px] text-gray-500"
                  />
                </div>
                <div>
                  <label className={labelCls}>Para Birimi</label>
                  <SelectDropdown
                    disabled
                    value="try"
                    options={[{ value: 'try', label: 'TRY (₺)' }]}
                    className="w-full h-[40px] shadow-sm text-[13px] text-gray-500"
                  />
                </div>
                <div>
                  <label className={labelCls}>Stok Girişi</label>
                  <SelectDropdown
                    disabled
                    value="disabled"
                    options={[{ value: 'disabled', label: 'Şimdilik Deaktif' }]}
                    className="w-full h-[40px] shadow-sm text-[13px] text-gray-500"
                  />
                </div>
                <div>
                  <label className={labelCls}>Ödeme Durumu</label>
                  <Controller
                    control={control}
                    name="payment_status"
                    render={({ field }) => (
                      <SelectDropdown
                        value={field.value}
                        onChange={field.onChange}
                        options={[
                          { value: 'unpaid', label: 'Ödeme Yapılacak' },
                          { value: 'paid', label: 'Ödeme Yapıldı' },
                          { value: 'partial', label: 'Kısmi Ödeme' }
                        ]}
                        className="w-full h-[40px] shadow-sm text-[13px] text-gray-700 font-medium"
                      />
                    )}
                  />
                </div>
              </div>"""

if old_row_3 in content:
    content = content.replace(old_row_3, new_row_3)
    print("Row 3 successfully updated!")
else:
    print("Could not find row 3 block")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
