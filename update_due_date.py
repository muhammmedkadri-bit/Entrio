import sys
import os

file_path = 'src/pages/purchases/NewPurchasePage.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add definitions at the top
import_tr = "import { tr } from 'date-fns/locale';"
import_dropdown = "import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../../components/ui/DropdownMenu';"

if import_tr not in content:
    content = content.replace("import { format, addDays } from 'date-fns';", f"import {{ format, addDays }} from 'date-fns';\n{import_tr}")

if import_dropdown not in content:
    content = content.replace("import { DatePicker } from '../../components/ui/DatePicker';", f"import {{ DatePicker }} from '../../components/ui/DatePicker';\n{import_dropdown}")

# 2. Add DueDateDropdown component definition JUST BEFORE NewPurchasePage
due_date_component = """/* ── DueDateDropdown ───────────────────────────────────────────────────────── */
const DueDateDropdown = ({ methods, DUE_OPTIONS }) => {
  const mode = useWatch({ control: methods.control, name: 'due_date_mode' });
  const date = useWatch({ control: methods.control, name: 'due_date' });
  
  const [pickerOpen, setPickerOpen] = useState(false);

  const displayLabel = useMemo(() => {
    if (mode === 'custom') {
      if (pickerOpen) return 'Özel Tarih Seçin';
      return date ? format(new Date(date), 'd MMMM yyyy', { locale: tr }) : 'Özel Tarih Seçin';
    }
    return DUE_OPTIONS.find(o => o.value === mode)?.label || 'Seçiniz';
  }, [mode, date, pickerOpen, DUE_OPTIONS]);

  return (
    <div className="w-full block">
      <Controller
        control={methods.control}
        name="due_date"
        render={({ field }) => (
          <DatePicker
            compact
            allowClear={false}
            value={field.value ? { start: new Date(field.value), end: new Date(field.value) } : null}
            onChange={(val) => {
              if (val?.start) {
                field.onChange(format(val.start, 'yyyy-MM-dd'));
                methods.setValue('due_date_mode', 'custom');
              }
            }}
            popupAlignment="right"
            renderTrigger={({ isOpen, setIsOpen }) => {
              useEffect(() => { setPickerOpen(isOpen); }, [isOpen]);

              return (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className={`${inputCls} flex items-center justify-between w-full h-[40px] px-3`}>
                      <div className="flex items-center gap-2 overflow-hidden">
                        <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="text-[13px] font-medium text-gray-700 truncate">{displayLabel}</span>
                      </div>
                      <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-full min-w-[200px]">
                    {DUE_OPTIONS.map(o => (
                      <DropdownMenuItem 
                        key={o.value} 
                        selected={mode === o.value}
                        onClick={() => {
                          methods.setValue('due_date_mode', o.value);
                          if (o.value === 'custom') {
                             setIsOpen(true);
                          } else {
                             setIsOpen(false);
                          }
                        }}
                      >
                        {o.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            }}
          />
        )}
      />
    </div>
  );
};
"""

if "const DueDateDropdown =" not in content:
    content = content.replace("export const NewPurchasePage = () => {", f"{due_date_component}\nexport const NewPurchasePage = () => {{")

# 3. Replace the Vade Tarihi inside NewPurchasePage
# We find the section by isolating it
old_vade_tarihi = """                {/* Vade Tarihi */}
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
                </div>"""

new_vade_tarihi = """                {/* Vade Tarihi */}
                <div>
                  <label className={labelCls}>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Vade Tarihi
                    </span>
                  </label>
                  <DueDateDropdown methods={methods} DUE_OPTIONS={DUE_OPTIONS} />
                </div>"""

if old_vade_tarihi in content:
    content = content.replace(old_vade_tarihi, new_vade_tarihi)
    print("Replaced Vade Tarihi section")
else:
    print("FAILED to replace Vade Tarihi section")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
