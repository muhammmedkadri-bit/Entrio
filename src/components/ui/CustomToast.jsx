import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

const CloseIcon = ({ className }) => (
  <svg height="16" strokeLinejoin="round" viewBox="0 0 16 16" width="16" className={className}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12.4697 13.5303L13 14.0607L14.0607 13L13.5303 12.4697L9.06065 7.99999L13.5303 3.53032L14.0607 2.99999L13 1.93933L12.4697 2.46966L7.99999 6.93933L3.53032 2.46966L2.99999 1.93933L1.93933 2.99999L2.46966 3.53032L6.93933 7.99999L2.46966 12.4697L1.93933 13L2.99999 14.0607L3.53032 13.5303L7.99999 9.06065L12.4697 13.5303Z"
    />
  </svg>
);

const UndoIcon = () => (
  <svg height="16" strokeLinejoin="round" viewBox="0 0 16 16" width="16" className="fill-slate-700">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M13.5 8C13.5 4.96643 11.0257 2.5 7.96452 2.5C5.42843 2.5 3.29365 4.19393 2.63724 6.5H5.25H6V8H5.25H0.75C0.335787 8 0 7.66421 0 7.25V2.75V2H1.5V2.75V5.23347C2.57851 2.74164 5.06835 1 7.96452 1C11.8461 1 15 4.13001 15 8C15 11.87 11.8461 15 7.96452 15C5.62368 15 3.54872 13.8617 2.27046 12.1122L1.828 11.5066L3.03915 10.6217L3.48161 11.2273C4.48831 12.6051 6.12055 13.5 7.96452 13.5C11.0257 13.5 13.5 11.0336 13.5 8Z"
    />
  </svg>
);

let root = null;
let toastId = 0;

const toastStore = {
  toasts: [],
  listeners: new Set(),

  add(text, type, preserve, action, onAction, onUndoAction) {
    const id = toastId++;
    const toast = { id, text, preserve, action, onAction, onUndoAction, type };

    if (!toast.preserve) {
      toast.remaining = 3000;
      toast.start = Date.now();

      const close = () => {
        this.toasts = this.toasts.filter((t) => t.id !== id);
        this.notify();
      };

      toast.timeout = setTimeout(close, toast.remaining);

      toast.pause = () => {
        if (!toast.timeout) return;
        clearTimeout(toast.timeout);
        toast.timeout = undefined;
        toast.remaining -= Date.now() - toast.start;
      };

      toast.resume = () => {
        if (toast.timeout) return;
        toast.start = Date.now();
        toast.timeout = setTimeout(close, toast.remaining);
      };
    }

    this.toasts.push(toast);
    this.notify();
  },

  remove(id) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notify();
  },

  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  },

  notify() {
    this.listeners.forEach((fn) => fn());
  }
};

const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);
  const [shownIds, setShownIds] = useState([]);
  const [isHovered, setIsHovered] = useState(false);

  const measureRef = (toast) => (node) => {
    if (node && toast.measuredHeight == null) {
      toast.measuredHeight = node.getBoundingClientRect().height;
      toastStore.notify();
    }
  };

  useEffect(() => {
    setToasts([...toastStore.toasts]);
    return toastStore.subscribe(() => {
      setToasts([...toastStore.toasts]);
    });
  }, []);

  useEffect(() => {
    const unseen = toasts.filter(t => !shownIds.includes(t.id)).map(t => t.id);
    if (unseen.length > 0) {
      requestAnimationFrame(() => {
        setShownIds(prev => [...prev, ...unseen]);
      });
    }
  }, [toasts]);

  const lastVisibleCount = 3;
  const lastVisibleStart = Math.max(0, toasts.length - lastVisibleCount);

  // Position: TOP-CENTER (instead of bottom-right)
  const getFinalTransform = (index, length) => {
    if (index === length - 1) return "none";
    const offset = length - 1 - index;
    let translateY = toasts[length - 1]?.measuredHeight || 63;
    for (let i = length - 1; i > index; i--) {
      if (isHovered) {
        translateY += (toasts[i - 1]?.measuredHeight || 63) + 10;
      } else {
        translateY += 20; // compact stack when not hovered
      }
    }
    const z = -offset;
    const scale = isHovered ? 1 : (1 - 0.05 * offset);
    // Since it's top-centered, we translate downwards instead of upwards
    return `translate3d(0, ${translateY}px, ${z}px) scale(${scale})`;
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    toastStore.toasts.forEach((t) => t.pause?.());
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    toastStore.toasts.forEach((t) => t.resume?.());
  };

  const visibleToasts = toasts.slice(lastVisibleStart);
  const containerHeight = visibleToasts.reduce((acc, toast) => acc + (toast.measuredHeight ?? 63), 0);

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none w-[420px] max-w-[90vw]"
      style={{ height: containerHeight, perspective: '1000px' }}
    >
      <div
        className="relative pointer-events-auto w-full flex justify-center"
        style={{ height: containerHeight }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {toasts.map((toast, index) => {
          const isVisible = index >= lastVisibleStart;
          
          let bgClass = '';
          let textClass = '';
          let iconClass = '';
          
          switch(toast.type) {
            case 'success': bgClass = 'bg-[#7ed957]'; textClass = 'text-white'; iconClass = 'fill-white'; break;
            case 'error': bgClass = 'bg-rose-600'; textClass = 'text-white'; iconClass = 'fill-white'; break;
            case 'warning': bgClass = 'bg-amber-500'; textClass = 'text-white'; iconClass = 'fill-white'; break;
            default: bgClass = 'bg-slate-800'; textClass = 'text-white'; iconClass = 'fill-slate-400'; break;
          }

          return (
            <div
              key={toast.id}
              ref={measureRef(toast)}
              className={`absolute top-0 shadow-lg rounded-xl leading-[21px] p-4 h-fit ${bgClass} ${textClass} ${isVisible ? "opacity-100" : "opacity-0"} ${index < lastVisibleStart ? "pointer-events-none" : ""}`}
              style={{
                width: 420,
                transition: "all .35s cubic-bezier(.25,.75,.6,.98)",
                transformOrigin: 'top center',
                transform: shownIds.includes(toast.id)
                  ? getFinalTransform(index, toasts.length)
                  : "translate3d(0, -100%, 150px) scale(1)" // animate from top
              }}
            >
              <div className="flex flex-col text-[.875rem] font-medium">
                <div className="w-full flex items-center justify-between gap-4">
                  <span className="flex-1">{toast.text}</span>
                  {!toast.action && (
                    <div className="flex gap-1 shrink-0">
                      {toast.onUndoAction && (
                        <button
                          className="hover:bg-black/10 p-1.5 rounded-lg transition-colors flex items-center justify-center"
                          onClick={() => {
                            toast.onUndoAction?.();
                            toastStore.remove(toast.id);
                          }}
                        >
                          <UndoIcon />
                        </button>
                      )}
                      <button
                        className="hover:bg-black/10 p-1.5 rounded-lg transition-colors flex items-center justify-center"
                        onClick={() => toastStore.remove(toast.id)}
                      >
                        <CloseIcon className={iconClass} />
                      </button>
                    </div>
                  )}
                </div>
                {toast.action && (
                  <div className="w-full flex items-center justify-end gap-2 mt-2">
                    <button
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg hover:bg-black/10 transition-colors"
                      onClick={() => toastStore.remove(toast.id)}
                    >
                      Kapat
                    </button>
                    <button
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                      onClick={() => {
                        if (toast?.onAction) toast.onAction();
                        toastStore.remove(toast.id);
                      }}
                    >
                      {toast.action}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const mountContainer = () => {
  if (root) return;
  const el = document.createElement("div");
  el.className = "fixed top-4 left-1/2 -translate-x-1/2 z-[9999]";
  document.body.appendChild(el);
  root = createRoot(el);
  root.render(<ToastContainer />);
};

// Exporting standard API matching react-hot-toast for drop-in replacement
export const toast = Object.assign(
  (text) => {
    mountContainer();
    toastStore.add(text, "message");
  },
  {
    success: (text) => { mountContainer(); toastStore.add(text, "success"); },
    error: (text) => { mountContainer(); toastStore.add(text, "error"); },
    loading: (text) => { mountContainer(); toastStore.add(text, "message"); }, // fallback
    dismiss: () => {}, // mock
  }
);

export default toast;
