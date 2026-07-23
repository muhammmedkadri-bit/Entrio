import React, { useRef, useState, useEffect } from 'react';
import { Camera, Search } from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/library';

export const BarcodeInput = ({ 
  onScan, 
  className = '', 
  value, 
  onChange, 
  onFocus, 
  onBlur, 
  inputRef,
  placeholder = 'Barkod okutun veya yazın... (Enter)'
}) => {
  const [useCamera, setUseCamera] = useState(false);
  const [internalInput, setInternalInput] = useState('');
  const videoRef = useRef(null);
  const codeReader = useRef(new BrowserMultiFormatReader());

  const isControlled = value !== undefined;
  const currentVal = isControlled ? value : internalInput;
  const handleChange = isControlled ? onChange : (e) => setInternalInput(e.target.value);

  // Always-fresh ref so the keydown closure reads current value without stale closure
  const currentValRef = useRef(currentVal);
  useEffect(() => { currentValRef.current = currentVal; }, [currentVal]);

  // Scanner chars accumulate here between keystrokes
  const bufferRef = useRef('');
  // Timeout ref — accessible outside the closure for explicit clearing
  const scanTimeoutRef = useRef(null);

  // Camera
  useEffect(() => {
    let active = true;
    if (useCamera && videoRef.current) {
      codeReader.current.decodeFromVideoDevice(null, videoRef.current, (result) => {
        if (result && active) {
          onScan(result.getText());
          setUseCamera(false);
        }
      }).catch(console.error);
    }
    return () => {
      active = false;
      codeReader.current.reset();
    };
  }, [useCamera, onScan]);

  // ─── Keydown capture ─────────────────────────────────────────────────────
  useEffect(() => {
    const input = inputRef?.current;
    if (!input) return;

    const handleKeydown = (e) => {
      if (e.key === 'Enter') {
        // Stop any pending human-typing timeout
        if (scanTimeoutRef.current) {
          clearTimeout(scanTimeoutRef.current);
          scanTimeoutRef.current = null;
        }

        // ★ KEY FIX: combine whatever is in the visible input value AND the
        //   internal buffer.  This handles the race where the 40 ms "human
        //   typing" timeout fired mid-scan and moved some chars to currentVal
        //   while the rest are still in bufferRef.
        const combined = (currentValRef.current || '') + bufferRef.current;
        bufferRef.current = '';

        if (combined.trim().length > 0) {
          e.preventDefault();
          e.stopPropagation();

          // Reset controlled/internal value to empty
          if (!isControlled) setInternalInput('');
          if (onChange) onChange({ target: { value: '' } });

          onScan(combined.trim());
        }
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        bufferRef.current += e.key;

        // Clear any previous timeout so we don't flush mid-scan
        if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);

        // Human-typing fallback: if no Enter arrives within 80 ms, treat as
        // manual input and move chars to the visible input field.
        // 80 ms > typical scanner inter-char gap (< 10 ms) but < human typing speed
        scanTimeoutRef.current = setTimeout(() => {
          if (bufferRef.current) {
            const newVal = (currentValRef.current || '') + bufferRef.current;
            bufferRef.current = '';
            if (!isControlled) setInternalInput(newVal);
            if (onChange) onChange({ target: { value: newVal } });
          }
          scanTimeoutRef.current = null;
        }, 80);
      }
    };

    input.addEventListener('keydown', handleKeydown, true);

    return () => {
      input.removeEventListener('keydown', handleKeydown, true);
      // ★ Do NOT clear bufferRef here — clearing it in cleanup caused the
      //   first-char race condition when the effect re-ran due to prop changes.
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }
    };
  }, [isControlled, onChange, onScan, inputRef]);

  const btnClass = "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer bg-brand-50/50 dark:bg-brand-500/10 hover:bg-brand-100/50 dark:hover:bg-brand-500/20 border border-brand-200/50 dark:border-brand-500/20 text-brand-700 dark:text-brand-400 shadow-sm dark:shadow-none";

  return (
    <div className={`flex flex-col ${className}`}>
      {useCamera ? (
        <div className="relative rounded-lg overflow-hidden border-2 border-brand-500 bg-black h-64 sm:h-72 w-full flex items-center justify-center">
          <video ref={videoRef} className="w-full h-full object-cover" />
          <button
            onClick={() => setUseCamera(false)}
            className="absolute top-3 right-3 px-4 py-2 bg-red-500 text-white rounded-lg text-xs font-bold shadow-xl hover:bg-red-600 transition-colors z-10"
          >
            Kapat
          </button>
          
          {/* A large semi-transparent overlay just to indicate the scan area instead of a tiny box */}
          <div className="absolute inset-0 border-[40px] border-black/30 pointer-events-none"></div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[80%] h-[60%] border-2 border-green-500/50 rounded-xl relative">
              {/* Corner brackets */}
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-green-500 rounded-tl-xl"></div>
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-green-500 rounded-tr-xl"></div>
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-green-500 rounded-bl-xl"></div>
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-green-500 rounded-br-xl"></div>
              
              <div className="absolute -bottom-8 left-0 right-0 text-center text-white text-[10px] font-medium drop-shadow-md">
                Barkodu çerçevenin içine hizalayın
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative flex-1 group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400 dark:text-slate-500 group-focus-within:text-brand-500 transition-colors" />
          </div>
          <input
            ref={inputRef}
            type="text"
            className="block w-full pl-10 pr-24 py-3 border border-slate-200 dark:border-slate-700/60 rounded-lg leading-5 bg-white dark:bg-slate-800/90 text-gray-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:placeholder-slate-400 dark:focus:placeholder-slate-500 focus:ring-1 focus:ring-brand-500 focus:border-brand-500 sm:text-sm shadow-sm transition-all"
            placeholder={placeholder}
            value={currentVal}
            onChange={handleChange}
            onKeyDown={() => {}}
            onFocus={onFocus}
            onBlur={onBlur}
            autoFocus
          />
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
            <button
              type="button"
              onClick={() => setUseCamera(true)}
              className={btnClass}
            >
              <Camera className="w-4 h-4" />
              Tara
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
