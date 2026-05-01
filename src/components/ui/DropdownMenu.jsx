import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';

function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

/* ── Context ─────────────────────────────────────────────────────────────── */
const DropdownContext = React.createContext({});

/* ── Root ────────────────────────────────────────────────────────────────── */
export function DropdownMenu({ children, className = '' }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <DropdownContext.Provider value={{ open, setOpen }}>
      <div className={cn("relative", className || "inline-block")} ref={ref}>
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

/* ── Trigger ─────────────────────────────────────────────────────────────── */
export function DropdownMenuTrigger({ children, asChild = false, className = '' }) {
  const { open, setOpen } = React.useContext(DropdownContext);

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: (e) => {
        e.preventDefault();
        setOpen(!open);
        children.props.onClick?.(e);
      },
      'aria-expanded': open,
      'aria-haspopup': 'menu',
    });
  }

  return (
    <button
      type="button"
      className={cn(
        'flex items-center justify-between gap-2 w-full text-sm border border-gray-200 rounded-lg px-3 py-2',
        'focus:border-emerald-500 focus:ring-1 focus:ring-emerald-100 outline-none bg-white placeholder-gray-400 transition-colors',
        'hover:bg-gray-50 cursor-pointer',
        open && 'border-emerald-500 ring-1 ring-emerald-100',
        className,
      )}
      onClick={() => setOpen(!open)}
      aria-expanded={open}
      aria-haspopup="menu"
    >
      {children}
      <ChevronDown
        className={cn('w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200', open && 'rotate-180')}
      />
    </button>
  );
}

/* ── Content ─────────────────────────────────────────────────────────────── */
export function DropdownMenuContent({ children, className = '', sideOffset = 4, align = 'start' }) {
  const { open } = React.useContext(DropdownContext);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.97 }}
          transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          style={{ marginTop: sideOffset }}
          className={cn(
            'absolute z-50 min-w-full overflow-hidden rounded-lg border border-gray-200 bg-white p-1',
            'shadow-lg shadow-black/5 origin-top',
            align === 'end' ? 'right-0' : 'left-0',
            className,
          )}
          role="menu"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Item ────────────────────────────────────────────────────────────────── */
export function DropdownMenuItem({ children, onClick, disabled = false, selected = false, className = '' }) {
  const { setOpen } = React.useContext(DropdownContext);

  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={() => {
        if (!disabled) {
          onClick?.();
          setOpen(false);
        }
      }}
      className={cn(
        'relative flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors',
        'hover:bg-emerald-50 hover:text-emerald-700 focus:bg-emerald-50 focus:text-emerald-700',
        selected && 'bg-emerald-50/50 text-emerald-700 font-medium',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
    >
      {children}
      {selected && <Check className="ml-auto w-3.5 h-3.5 text-emerald-500 shrink-0" />}
    </button>
  );
}

/* ── Label ───────────────────────────────────────────────────────────────── */
export function DropdownMenuLabel({ children, className = '' }) {
  return (
    <div className={cn('px-2 py-1.5 text-xs font-medium text-gray-400', className)}>
      {children}
    </div>
  );
}

/* ── Separator ───────────────────────────────────────────────────────────── */
export function DropdownMenuSeparator({ className = '' }) {
  return <div className={cn('-mx-1 my-1 h-px bg-gray-100', className)} />;
}

/* ── Group ───────────────────────────────────────────────────────────────── */
export function DropdownMenuGroup({ children }) {
  return <div role="group">{children}</div>;
}

/* ── SelectDropdown — convenience wrapper for simple value lists ─────────── */
export function SelectDropdown({ value, onChange, options = [], placeholder = 'Seçiniz', className = '', disabled = false }) {
  const selected = options.find(o => (o.value ?? o.id) === value);

  return (
    <DropdownMenu className="w-full">
      <DropdownMenuTrigger className={cn('font-normal text-gray-700', disabled && 'opacity-50 pointer-events-none', className)}>
        <span className="flex items-center gap-2 truncate">
          {selected?.icon && <span className="flex items-center text-emerald-500">{selected.icon}</span>}
          {selected ? selected.label : placeholder}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {options.map(o => (
          <DropdownMenuItem
            key={o.value ?? o.id}
            selected={(o.value ?? o.id) === value}
            onClick={() => onChange(o.value ?? o.id)}
          >
            {o.icon && <span className="flex items-center">{o.icon}</span>}
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
