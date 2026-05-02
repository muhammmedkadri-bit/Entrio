import re

with open('src/pages/dashboard/Dashboard.jsx', 'r') as f:
    content = f.read()

# The wrapper we want to replace is from:
# <div className="space-y-6 flex-1">
#   <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
#
# to the end of the Right Col

start_idx = content.find('<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">')

# Let's extract individual components by their known wrapper tags.
chart_start = content.find('<div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 h-[340px] flex flex-col">')
chart_end = content.find('<div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">', chart_start)
chart_html = content[chart_start:chart_end].strip()

son5_start = chart_end
son5_end = content.find('</div>\n\n        <div className="space-y-6 flex flex-col">', son5_start)
son5_html = content[son5_start:son5_end].strip()
# Remove the trailing </div> which closes the lg:col-span-2 wrapper
son5_html = son5_html[:son5_html.rfind('</div>')].strip()

satis_start = content.find('<div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col" style={{ minHeight: 200 }}>')
satis_end = content.find('<div className="flex-shrink-0">', satis_start)
satis_html = content[satis_start:satis_end].strip()

currency_start = satis_end
currency_end = content.find('<div className="bg-[#fef9c3] rounded-2xl shadow-sm border border-[#fef08a] overflow-hidden flex flex-col flex-1">', currency_start)
# we actually don't want the <div className="flex-shrink-0"> wrapper for currency widget since it has its own column now
# currency_html is just <CurrencyWidget />
currency_html = '<CurrencyWidget />'

hizli_start = currency_end
hizli_end = content.find('</div>\n        {/* Close grid */}', hizli_start)
hizli_html = content[hizli_start:hizli_end].strip()
# remove the trailing </div> which closes space-y-6 flex flex-col
hizli_html = hizli_html[:hizli_html.rfind('</div>')].strip()

new_layout = f"""<div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <div className="xl:col-span-2 flex flex-col h-full">
            {chart_html}
          </div>
          <div className="xl:col-span-1 flex flex-col h-full">
            {satis_html}
          </div>
          <div className="xl:col-span-1 flex flex-col h-full">
            {currency_html}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <div className="xl:col-span-3">
            {son5_html}
          </div>
          <div className="xl:col-span-1 flex flex-col min-h-[300px]">
            {hizli_html}
          </div>
        </div>"""

# Now replace the original layout with the new one
full_wrapper_end = content.find('        {/* Close grid */}\n        </div>', start_idx) + len('        {/* Close grid */}\n        </div>')

new_content = content[:start_idx] + new_layout + content[full_wrapper_end:]

with open('src/pages/dashboard/Dashboard.jsx', 'w') as f:
    f.write(new_content)

print("Layout updated.")
