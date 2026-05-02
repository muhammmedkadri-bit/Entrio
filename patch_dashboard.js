const fs = require('fs');
let code = fs.readFileSync('src/pages/dashboard/Dashboard.jsx', 'utf-8');

// 1. Add import
if (!code.includes('TransactionDetailModal')) {
  code = code.replace(
    "import { QuickNotesWidget } from '../../components/ui/QuickNotesWidget';",
    "import { QuickNotesWidget } from '../../components/ui/QuickNotesWidget';\nimport { TransactionDetailModal } from '../cash/modals/TransactionDetailModal';"
  );
}

// 2. Add states
if (!code.includes('selectedTransaction')) {
  code = code.replace(
    'const [loading, setLoading] = useState(true);',
    "const [loading, setLoading] = useState(true);\n  const [selectedTransaction, setSelectedTransaction] = useState(null);\n  const [allRegisters, setAllRegisters] = useState([]);"
  );
}

// 3. Fetch registers
if (!code.includes('setAllRegisters(registers)')) {
  code = code.replace(
    'const customers = await db.customers.toArray();',
    "const customers = await db.customers.toArray();\n      const registers = await db.cash_registers.filter(r => r.is_active !== false).toArray();\n      setAllRegisters(registers);"
  );
}

// 4. Update click handler
code = code.replace(
  /} else {\n\s*navigate\('\/cash'\);\n\s*}/g,
  `} else {\n                        setSelectedTransaction(tx);\n                      }`
);

// 5. Add Modal before closing root div
if (!code.includes('<TransactionDetailModal')) {
  code = code.replace(
    '      {/* Close space-y-6 flex-1 */}\n      </div>',
    `      {/* Close space-y-6 flex-1 */}\n      </div>\n\n      <TransactionDetailModal\n        isOpen={!!selectedTransaction}\n        onClose={() => setSelectedTransaction(null)}\n        transaction={selectedTransaction}\n        onSaved={() => {\n          setSelectedTransaction(null);\n          fetchData();\n        }}\n        allRegisters={allRegisters}\n      />`
  );
}

fs.writeFileSync('src/pages/dashboard/Dashboard.jsx', code);
console.log('Dashboard patched.');
