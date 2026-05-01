import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Delete, X } from 'lucide-react';

export const CalculatorWidget = ({ onClose }) => {
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');
  const [hasNewValue, setHasNewValue] = useState(false);

  // ... rest of the state logic ...
  // Keep handleNum, handleOp, calculate, handleClear, handleDelete, handleDot

  const handleNum = (num) => {
    if (display === '0' || hasNewValue) {
      setDisplay(num);
      setHasNewValue(false);
    } else {
      if (display.length < 10) setDisplay(display + num);
    }
  };

  const handleOp = (op) => {
    setEquation(display + ' ' + op + ' ');
    setHasNewValue(true);
  };

  const calculate = () => {
    if (!equation) return;
    try {
      let toEval = equation + display;
      toEval = toEval.replace(/x/g, '*').replace(/÷/g, '/').replace(/%/g, '*0.01');
      const result = new Function('return ' + toEval)();
      let finalRes = result.toString();
      if (finalRes.includes('.')) finalRes = parseFloat(result.toFixed(4)).toString();
      setDisplay(finalRes);
      setEquation('');
      setHasNewValue(true);
    } catch (e) {
      setDisplay('Hata');
      setHasNewValue(true);
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setEquation('');
    setHasNewValue(false);
  };

  const handleDelete = () => {
    if (hasNewValue) return;
    if (display.length > 1) setDisplay(display.slice(0, -1));
    else setDisplay('0');
  };

  const handleDot = () => {
    if (hasNewValue) {
      setDisplay('0.');
      setHasNewValue(false);
    } else if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key;
      // Number keys
      if (/^[0-9]$/.test(key)) {
        e.preventDefault();
        handleNum(key);
      } 
      // Operators
      else if (key === '+' || key === '-' || key === '*' || key === '/' || key === '%') {
        e.preventDefault();
        handleOp(key);
      } 
      // Equals
      else if (key === 'Enter' || key === '=') {
        e.preventDefault();
        calculate();
      } 
      // Backspace
      else if (key === 'Backspace') {
        e.preventDefault();
        handleDelete();
      } 
      // Escape
      else if (key === 'Escape') {
        if (onClose) {
          e.preventDefault();
          onClose();
        }
      } 
      // Decimal point
      else if (key === '.' || key === ',') {
        e.preventDefault();
        handleDot();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [display, equation, hasNewValue]);

  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden w-[320px]">
      <div className="p-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
        <span className="font-bold text-sm text-slate-700 ml-1">Hesap Makinesi</span>
        {onClose && (
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="p-4 flex flex-col gap-4 items-center">
        {/* Ekran */}
        <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col items-end justify-center h-24 shadow-inner">
          <div className="text-xs text-slate-400 font-medium h-4">{equation}</div>
          <div className="text-3xl font-black text-slate-800 tracking-tight overflow-hidden text-ellipsis w-full text-right">{display}</div>
        </div>

        {/* Tuş Takımı */}
        <div className="grid grid-cols-4 gap-2 w-full">
          <button onClick={handleClear} className="p-3 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl font-bold text-lg transition-colors">AC</button>
          <button onClick={handleDelete} className="p-3 bg-slate-200 text-slate-700 hover:bg-slate-300 rounded-xl font-bold flex items-center justify-center transition-colors"><Delete className="w-5 h-5" /></button>
          <button onClick={() => handleOp('%')} className="p-3 bg-brand-50 text-brand-600 hover:bg-brand-100 rounded-xl font-black text-xl transition-colors">%</button>
          <button onClick={() => handleOp('/')} className="p-3 bg-brand-50 text-brand-600 hover:bg-brand-100 rounded-xl font-black text-xl transition-colors">÷</button>

          <button onClick={() => handleNum('7')} className="p-3 bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 rounded-xl font-bold text-xl transition-colors shadow-sm">7</button>
          <button onClick={() => handleNum('8')} className="p-3 bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 rounded-xl font-bold text-xl transition-colors shadow-sm">8</button>
          <button onClick={() => handleNum('9')} className="p-3 bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 rounded-xl font-bold text-xl transition-colors shadow-sm">9</button>
          <button onClick={() => handleOp('*')} className="p-3 bg-brand-50 text-brand-600 hover:bg-brand-100 rounded-xl font-black text-xl transition-colors">×</button>

          <button onClick={() => handleNum('4')} className="p-3 bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 rounded-xl font-bold text-xl transition-colors shadow-sm">4</button>
          <button onClick={() => handleNum('5')} className="p-3 bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 rounded-xl font-bold text-xl transition-colors shadow-sm">5</button>
          <button onClick={() => handleNum('6')} className="p-3 bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 rounded-xl font-bold text-xl transition-colors shadow-sm">6</button>
          <button onClick={() => handleOp('-')} className="p-3 bg-brand-50 text-brand-600 hover:bg-brand-100 rounded-xl font-black text-2xl transition-colors">-</button>

          <button onClick={() => handleNum('1')} className="p-3 bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 rounded-xl font-bold text-xl transition-colors shadow-sm">1</button>
          <button onClick={() => handleNum('2')} className="p-3 bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 rounded-xl font-bold text-xl transition-colors shadow-sm">2</button>
          <button onClick={() => handleNum('3')} className="p-3 bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 rounded-xl font-bold text-xl transition-colors shadow-sm">3</button>
          <button onClick={() => handleOp('+')} className="p-3 bg-brand-50 text-brand-600 hover:bg-brand-100 rounded-xl font-black text-2xl transition-colors">+</button>

          <button onClick={() => handleNum('0')} className="col-span-2 p-3 bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 rounded-xl font-bold text-xl transition-colors shadow-sm">0</button>
          <button onClick={handleDot} className="p-3 bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 rounded-xl font-bold text-xl transition-colors shadow-sm">,</button>
          <button onClick={calculate} className="p-3 bg-brand-500 text-white hover:bg-brand-600 rounded-xl font-black text-2xl transition-colors shadow-md shadow-brand-500/20">=</button>
        </div>
      </div>
    </div>
  );
};
