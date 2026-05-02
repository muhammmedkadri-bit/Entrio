import re

file_path = 'src/pages/purchases/NewPurchasePage.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove "Kısmi Ödeme" from payment_status
old_status_options = """                        options={[
                          { value: 'unpaid', label: 'Ödeme Yapılacak' },
                          { value: 'paid', label: 'Ödeme Yapıldı' },
                          { value: 'partial', label: 'Kısmi Ödeme' }
                        ]}"""
new_status_options = """                        options={[
                          { value: 'unpaid', label: 'Ödeme Yapılacak' },
                          { value: 'paid', label: 'Ödeme Yapıldı' }
                        ]}"""
content = content.replace(old_status_options, new_status_options)

# 2. Update split state
old_split_state = "  const [splitRows, setSplitRows]                 = useState([{ method: 'cash', account_id: null, amount: '' }]);"
new_split_state = """  const [splitState, setSplitState] = useState({
    cash: { amount: '', account_id: null, notes: '' },
    bank_transfer: { amount: '', account_id: null, notes: '' },
    credit_card: { amount: '', account_id: null, notes: '' },
    date: today()
  });

  const updateSplit = (method, field, value) => {
    setSplitState(prev => ({
      ...prev,
      [method]: { ...prev[method], [field]: value }
    }));
  };"""
content = content.replace(old_split_state, new_split_state)

# 3. Prevent auto calculating paid amount if partial
old_paid_amount_effect = """  /* ── paid_amount auto-fill ──────────────────────────────────────────── */
  useEffect(() => {
    if (paymentStatus === 'paid') {
      setValue('paid_amount', fmt(r2(totals.grandTotal)));
    } else if (paymentStatus === 'unpaid') {
      setValue('paid_amount', '');
    }
  }, [paymentStatus, totals.grandTotal, setValue]);"""
new_paid_amount_effect = """  /* ── paid_amount auto-fill ──────────────────────────────────────────── */
  useEffect(() => {
    if (paymentStatus === 'paid') {
      setValue('paid_amount', fmt(r2(totals.grandTotal)));
    } else if (paymentStatus === 'unpaid') {
      setValue('paid_amount', '');
    }
  }, [paymentStatus, totals.grandTotal, setValue]);

  // Aggregate paid amounts when using split
  useEffect(() => {
    if (paymentMethod === 'split' && paymentStatus !== 'unpaid') {
        const c = parseTRPrice(splitState.cash.amount) || 0;
        const b = parseTRPrice(splitState.bank_transfer.amount) || 0;
        const cr = parseTRPrice(splitState.credit_card.amount) || 0;
        setValue('paid_amount', fmt(r2(c + b + cr)));
    }
  }, [splitState, paymentMethod, paymentStatus, setValue]);"""
content = content.replace(old_paid_amount_effect, new_paid_amount_effect)

# 4. Replace the "Parçalı Ödeme" render branch in JSX
# We need to find the part starting with /* ─── Parçalı ödeme ─────────────────────────────────── */
import sys

start_marker = "/* ─── Parçalı ödeme ─────────────────────────────────── */"
end_marker = "  {/* Row 4: Extra Buttons & Dedicated Info Panels */}"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print("Could not find Parçalı Ödeme section markers!")
    sys.exit(1)

# Backtrack the end_idx to include the closing div }
# Wait, the conditional branch is:
# ) : (
#   <div className="space-y-2">...</div>
# )}
# </div> )}

new_split_jsx = """/* ─── Parçalı ödeme ─────────────────────────────────── */
                    <div className="space-y-4">
                      {/* Yöntem başlığı satırı */}
                      <div>
                        <label className={labelCls}>Ödeme Yöntemi</label>
                        <Controller
                          control={control}
                          name="payment_method"
                          render={({ field }) => (
                            <div className="w-48">
                              <SelectDropdown
                                value={field.value}
                                onChange={field.onChange}
                                options={PAYMENT_METHODS.map(m => ({ value: m.value, label: m.label }))}
                                className="w-full shadow-sm text-[13px]"
                              />
                            </div>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-4 gap-4 bg-white p-3 rounded-xl border border-gray-100">
                        {/* Nakit */}
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-1.5 pb-1 border-b border-gray-50">
                            <Banknote className="w-4 h-4 text-emerald-600" />
                            <span className="font-semibold text-gray-700 text-sm">Nakit</span>
                          </div>
                          <input
                            type="text"
                            placeholder="Tutar (₺)"
                            value={splitState.cash.amount}
                            onChange={(e) => updateSplit('cash', 'amount', e.target.value)}
                            className={`${inputCls} text-right font-semibold`}
                          />
                          <SelectDropdown
                            placeholder="Kasa Seçin"
                            value={splitState.cash.account_id ? String(splitState.cash.account_id) : ''}
                            onChange={(v) => updateSplit('cash', 'account_id', v ? parseInt(v) : null)}
                            options={cashRegisters.filter(r => r.type === 'cash' || r.type === 'general').map(r => ({ value: String(r.id), label: r.name }))}
                            className="w-full shadow-sm text-[13px]"
                          />
                          <input
                            type="text"
                            placeholder="Açıklama girin..."
                            value={splitState.cash.notes}
                            onChange={(e) => updateSplit('cash', 'notes', e.target.value)}
                            className={inputCls}
                          />
                        </div>

                        {/* Havale / EFT */}
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-1.5 pb-1 border-b border-gray-50">
                            < Landmark className="w-4 h-4 text-blue-600" />
                            <span className="font-semibold text-gray-700 text-sm">Havale / EFT</span>
                          </div>
                          <input
                            type="text"
                            placeholder="Tutar (₺)"
                            value={splitState.bank_transfer.amount}
                            onChange={(e) => updateSplit('bank_transfer', 'amount', e.target.value)}
                            className={`${inputCls} text-right font-semibold`}
                          />
                          <SelectDropdown
                            placeholder="Banka Seçin"
                            value={splitState.bank_transfer.account_id ? String(splitState.bank_transfer.account_id) : ''}
                            onChange={(v) => updateSplit('bank_transfer', 'account_id', v ? parseInt(v) : null)}
                            options={cashRegisters.filter(r => r.type === 'bank').map(r => ({ value: String(r.id), label: r.name }))}
                            className="w-full shadow-sm text-[13px]"
                          />
                          <input
                            type="text"
                            placeholder="Açıklama girin..."
                            value={splitState.bank_transfer.notes}
                            onChange={(e) => updateSplit('bank_transfer', 'notes', e.target.value)}
                            className={inputCls}
                          />
                        </div>

                        {/* Kredi Kartı */}
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-1.5 pb-1 border-b border-gray-50">
                            <CreditCard className="w-4 h-4 text-purple-600" />
                            <span className="font-semibold text-gray-700 text-sm">Kredi Kartı / Mail Order</span>
                          </div>
                          <input
                            type="text"
                            placeholder="Tutar (₺)"
                            value={splitState.credit_card.amount}
                            onChange={(e) => updateSplit('credit_card', 'amount', e.target.value)}
                            className={`${inputCls} text-right font-semibold`}
                          />
                          <SelectDropdown
                            placeholder="POS Seçin"
                            value={splitState.credit_card.account_id ? String(splitState.credit_card.account_id) : ''}
                            onChange={(v) => updateSplit('credit_card', 'account_id', v ? parseInt(v) : null)}
                            options={cashRegisters.filter(r => r.type === 'pos').map(r => ({ value: String(r.id), label: r.name }))}
                            className="w-full shadow-sm text-[13px]"
                          />
                          <input
                            type="text"
                            placeholder="Açıklama girin..."
                            value={splitState.credit_card.notes}
                            onChange={(e) => updateSplit('credit_card', 'notes', e.target.value)}
                            className={inputCls}
                          />
                        </div>

                        {/* Ödeme Tarihi */}
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-1.5 pb-1 border-b border-gray-50">
                            <Calendar className="w-4 h-4 text-orange-600" />
                            <span className="font-semibold text-gray-700 text-sm">Ödeme Tarihi</span>
                          </div>
                          <div className="w-full block">
                            <DatePicker
                              compact
                              allowClear={false}
                              value={{ start: splitState.date ? new Date(splitState.date) : new Date(), end: splitState.date ? new Date(splitState.date) : new Date() }}
                              onChange={(val) => {
                                if (val?.start) setSplitState(prev => ({ ...prev, date: format(val.start, 'yyyy-MM-dd') }));
                              }}
                              renderTrigger={({ setIsOpen }) => (
                                <div
                                  className={`${inputCls} flex items-center gap-2 cursor-pointer h-[40px] px-3`}
                                  onClick={() => setIsOpen(true)}
                                >
                                  <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                  <span className="text-[13px] font-medium text-gray-700 whitespace-nowrap">
                                    {splitState.date ? format(new Date(splitState.date), 'dd.MM.yyyy') : 'Tarih Seçin'}
                                  </span>
                                </div>
                              )}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

"""

# Be very careful to replace correctly up to the row 4 comment.
# Actually, I can use a simpler replacement if I just target the exact old parcali odeme block.
import re

content = re.sub(
    r'/\*\s*─── Parçalı ödeme ──────────────.*?\)\}\s*</div>\s*\)\}\s*</div>\s*\)\}',
    new_split_jsx + '              ',
    content,
    flags=re.DOTALL
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
