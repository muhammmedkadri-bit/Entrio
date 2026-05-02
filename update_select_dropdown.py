file_path = 'src/components/ui/DropdownMenu.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

old_return = """  return (
    <DropdownMenu>"""
new_return = """  return (
    <DropdownMenu className="w-full">"""

content = content.replace(old_return, new_return)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated SelectDropdown")
