const fs = require('fs');
let code = fs.readFileSync('src/components/ui/CurrencyWidget.jsx', 'utf-8');

// Add state variables
code = code.replace(
  'const [error, setError]           = useState(false);',
  `const [error, setError]           = useState(false);\n  const [calcAmount, setCalcAmount] = useState('');\n  const [calcCurrency, setCalcCurrency] = useState('USD');`
);

// Calculate result
const calcLogic = `
  const selectedRate = rates[calcCurrency]?.satis || 0;
  const calcResult = calcAmount ? (parseFloat(calcAmount) * parseFloat(selectedRate)) : 0;
`;
code = code.replace(
  'const allItems = [...CURRENCIES, GOLD];',
  `const allItems = [...CURRENCIES, GOLD];\n${calcLogic}`
);

// Add the UI at the end
const footerUI = `
      {/* Quick Calculator */}
      <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
        <input 
          type="number"
          min="0"
          value={calcAmount}
          onChange={e => setCalcAmount(e.target.value)}
          placeholder="0.00"
          className="w-16 min-w-0 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#7ed957] focus:ring-1 focus:ring-[#7ed957]"
        />
        <div className="relative flex-shrink-0">
          <select 
            value={calcCurrency}
            onChange={e => setCalcCurrency(e.target.value)}
            className="appearance-none bg-white border border-slate-200 rounded-lg pl-2 pr-6 py-1.5 text-[11px] font-bold text-slate-700 focus:outline-none focus:border-[#7ed957] focus:ring-1 focus:ring-[#7ed957] cursor-pointer"
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="GA">ALTIN</option>
          </select>
          <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-end min-w-0">
          <span className="text-[10px] text-slate-400 font-medium mr-1">=</span>
          <span className="text-xs font-black text-slate-900 truncate" title={\`₺\${fmt(calcResult)}\`}>
            ₺{calcAmount ? fmt(calcResult) : '0,00'}
          </span>
        </div>
      </div>
    </div>
  );
};
`;

code = code.replace(
  '    </div>\n  );\n};',
  footerUI
);

fs.writeFileSync('src/components/ui/CurrencyWidget.jsx', code);
console.log('CurrencyWidget updated with calculator');
