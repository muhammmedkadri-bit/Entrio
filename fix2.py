import sys

file_path = 'src/pages/purchases/NewPurchasePage.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

replacement = """          {/* ── LEFT COLUMN ──────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 flex flex-col gap-4">
            
            <div className="bg-white rounded-xl p-4 sm:p-5" style={{ border: '1px solid rgba(229,231,235,0.8)' }}>
              <div className="grid grid-cols-4 gap-4 mb-4">
                {/* Fiş/Fatura No is 2 columns */}
"""

# Find the exact line 441 (0-indexed) to replace
lines[441] = replacement

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)
