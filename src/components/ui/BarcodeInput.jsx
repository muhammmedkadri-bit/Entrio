import React, { useRef, useState, useEffect } from 'react';
import { Camera, Search, X } from 'lucide-react';
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

  // Keep refs for always-fresh values inside event closure
  const currentValRef = useRef(currentVal);
  useEffect(() => { currentValRef.current = currentVal; }, [currentVal]);

  const bufferRef = useRef('');
  // Make scanTimeout a ref so it can be cleared from anywhere (including value-reset effect)
  const scanTimeoutRef = useRef(null);

  // ─── CRITICAL FIX: when controlled value becomes '' (modal closed / reset),
  //   immediately flush the buffer + pending timeout so the next barcode scan
  //   starts from a completely clean slate.
  useEffect(() => {
    if (currentVal === '' || currentVal == null) {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }
      bufferRef.current = '';
    }
  }, [currentVal]);

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
        if (scanTimeoutRef.current) {
          clearTimeout(scanTimeoutRef.current);
          scanTimeoutRef.current = null;
        }

        if (bufferRef.current.length > 3) {
          e.preventDefault();
          e.stopPropagation();
          const scanned = bufferRef.current;
          bufferRef.current = '';   // clear immediately before async work
          onScan(scanned);
          return;
        }

        if (currentValRef.current) {
          e.preventDefault();
          const val = currentValRef.current;
          bufferRef.current = '';
          onScan(val);
          if (!isControlled) setInternalInput('');
          if (onChange) onChange({ target: { value: '' } });
          return;
        }

        bufferRef.current = '';
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        bufferRef.current += e.key;

        if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = setTimeout(() => {
          // Human-typing fallback — fires only if no Enter came within 40 ms
          if (bufferRef.current) {
            const newVal = (currentValRef.current || '') + bufferRef.current;
            bufferRef.current = '';
            if (!isControlled) setInternalInput(newVal);
            if (onChange) onChange({ target: { value: newVal } });
          }
          scanTimeoutRef.current = null;
        }, 40);
      }
    };

    input.addEventListener('keydown', handleKeydown, true);

    return () => {
      input.removeEventListener('keydown', handleKeydown, true);
      // DO NOT clear bufferRef here — doing so causes the first-char race condition.
      // Buffer is only cleared: (a) after a successful scan, (b) when value resets to ''.
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }
    };
  }, [isControlled, onChange, onScan, inputRef]);

  // ─── Focus handler — also clears buffer for safety ───────────────────────
  const handleFocusInternal = (e) => {
    // Small guard: only clear if we're not in the middle of a fast scan
    // (bufferRef would have chars if scanner already started firing)
    if (!bufferRef.current) {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }
    }
    onFocus?.(e);
  };

  const glassButtonStyle = {
    background: 'rgba(126,217,87,0.1)',
    border: '1px solid rgba(126,217,87,0.2)',
    boxShadow: '0 2px 8px rgba(126,217,87,0.08), inset 0 1px 0 rgba(255,255,255,0.6)',
    color: 'rgb(58,128,36)', 
    fontSize: '12px', 
    fontWeight: '500',
    padding: '5px 12px', 
    borderRadius: '8px', 
    cursor: 'pointer',
    display: 'flex', 
    alignItems: 'center', 
    gap: '6px', 
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
  };

  return (
    <div className={`flex flex-col ${className}`}>
      {useCamera ? (
        <div className="relative rounded-lg overflow-hidden border-2 border-brand-500 bg-black aspect-video">
          <video ref={videoRef} className="w-full h-full object-cover" />
          <button 
            onClick={() => setUseCamera(false)}
            className="absolute top-2 right-2 px-3 py-1 bg-red-500 text-white rounded-md text-xs font-semibold shadow-lg hover:bg-red-600 transition-colors"
          >
            İptal
          </button>
          <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
            <div className="w-48 h-10 border-2 border-green-500"></div>
          </div>
        </div>
      ) : (
        <div className="relative flex-1 group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
          </div>
          <input
            ref={inputRef}
            type="text"
            className="block w-full pl-10 pr-24 py-3 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-500 focus:outline-none focus:placeholder-slate-400 focus:ring-1 focus:ring-brand-500 focus:border-brand-500 sm:text-sm shadow-sm transition-all"
            placeholder={placeholder}
            value={currentVal}
            onChange={handleChange}
            onKeyDown={() => {}}
            onFocus={handleFocusInternal}
            onBlur={onBlur}
            autoFocus
          />
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
            <button 
              type="button"
              onClick={() => setUseCamera(true)}
              style={glassButtonStyle}
              className="hover:bg-brand-100/50"
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
