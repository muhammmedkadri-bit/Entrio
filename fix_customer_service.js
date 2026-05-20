const fs = require('fs');
const file = '/Users/m.k./Desktop/Entrio/src/services/customerService.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Fix the missing closing brace for if (salesData && salesData.length > 0)
// This missing brace is after `txs = combinedTxs;` in the Supabase block.
content = content.replace(
  `            txs = combinedTxs;\n\n        if (filters.startDate`,
  `            txs = combinedTxs;\n        }\n\n        if (filters.startDate`
);

// 2. Add the getTime helper at the top of getTransactions
content = content.replace(
  `  async getTransactions(customerId, filters = {}) {\n    try {\n      if (isSupabase()) {`,
  `  async getTransactions(customerId, filters = {}) {\n    try {\n      const getTime = (val) => { if (!val) return 0; const n = Number(val); if (!isNaN(n)) return n; return new Date(val).getTime() || 0; };\n\n      if (isSupabase()) {`
);

// 3. Replace Number(a.created_at) with getTime(a.created_at) globally in getTransactions
// We'll just replace 'Number(a.created_at)' -> 'getTime(a.created_at)' and 'Number(b.created_at)' -> 'getTime(b.created_at)'
content = content.replace(/Number\(a\.created_at\)/g, 'getTime(a.created_at)');
content = content.replace(/Number\(b\.created_at\)/g, 'getTime(b.created_at)');

// 4. Also fix new Date(getTime(s.created_at)) replacing new Date(Number(s.created_at))
content = content.replace(/new Date\(Number\(s\.created_at\)\)/g, 'new Date(getTime(s.created_at))');

// 5. Also replace new Date(t.created_at) if it exists
content = content.replace(/Number\(t\.created_at\)/g, 'getTime(t.created_at)');

fs.writeFileSync(file, content);
console.log("Fixed!");
