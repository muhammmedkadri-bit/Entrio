const fs = require('fs');
const file = 'src/pages/purchases/NewPurchasePage.jsx';
const content = fs.readFileSync(file, 'utf8');

const lines = content.split('\n');

const replacement = `              {/* Row 3: İskonto, Para Birimi, Stok Girişi, Ödeme Durumu */}
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div>
                  <label className={labelCls}>İskonto Listeleri</label>
                  <SelectDropdown
                    disabled
                    value="disabled"
                    options={[{ value: 'disabled', label: 'Şimdilik Deaktif' }]}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className={labelCls}>Para Birimi</label>
                  <SelectDropdown
                    disabled
                    value="try"
                    options={[{ value: 'try', label: 'TRY (₺)' }]}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className={labelCls}>Stok Girişi</label>
                  <SelectDropdown
                    disabled
                    value="disabled"
                    options={[{ value: 'disabled', label: 'Şimdilik Deaktif' }]}
                    className="w-full"
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
                          { id: 'unpaid', label: 'Ödeme Yapılacak' },
                          { id: 'paid', label: 'Ödeme Yapıldı' },
                          { id: 'partial', label: 'Kısmi Ödeme' }
                        ]}
                        className="w-full"
                      />
                    )}
                  />
                </div>
              </div>`;

lines.splice(548, (642 - 549) + 1, replacement);

fs.writeFileSync(file, lines.join('\n'), 'utf8');
console.log('Fixed');
