file_path = 'src/pages/purchases/NewPurchasePage.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace popupAlignment="right"
if 'popupAlignment="right"' in content:
    content = content.replace('popupAlignment="right"', '')

# Update DropdownMenu to use className="w-full"
# In DueDateDropdown:
old_dropdown_start = """              return (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>"""
new_dropdown_start = """              return (
                <DropdownMenu className="w-full">
                  <DropdownMenuTrigger asChild>"""

if old_dropdown_start in content:
    content = content.replace(old_dropdown_start, new_dropdown_start)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updates applied to NewPurchasePage")
