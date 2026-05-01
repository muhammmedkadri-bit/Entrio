import * as React from "react"
import { motion, AnimatePresence, MotionConfig } from "framer-motion"
import { ChevronDown, X, Search } from "lucide-react"

export function cn(...classes) {
  return classes.filter(Boolean).join(" ")
}

export function useClickAway(ref, handler) {
  React.useEffect(() => {
    const listener = (event) => {
      if (!ref.current || ref.current.contains(event.target)) {
        return
      }
      handler(event)
    }

    document.addEventListener("mousedown", listener)
    document.addEventListener("touchstart", listener)

    return () => {
      document.removeEventListener("mousedown", listener)
      document.removeEventListener("touchstart", listener)
    }
  }, [ref, handler])
}

const IconWrapper = ({ icon: Icon, isHovered, color, className = "mr-2" }) => {
  if (!Icon) return null;
  return (
    <motion.div 
      className={`relative flex items-center justify-center ${className}`} 
      initial={false} 
      animate={{ scale: isHovered ? 1.15 : 1 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
    >
      <Icon 
        className="w-4 h-4 transition-colors duration-200" 
        style={{ color: isHovered ? (color || '#10b981') : 'currentColor' }}
      />
    </motion.div>
  );
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      when: "beforeChildren",
      staggerChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: -5 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
}

export function AnimatedDropdown({ 
  label, 
  icon: MainIcon, 
  options = [], 
  value, 
  onChange, 
  onClear,
  badgeCount = 0,
  placeholder = "Seçiniz",
  searchable = false,
  searchPlaceholder = "Filtrele...",
  className = "",
  triggerClassName = ""
}) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [hoveredOption, setHoveredOption] = React.useState(null)
  const [searchQuery, setSearchQuery] = React.useState("")
  const dropdownRef = React.useRef(null)

  React.useEffect(() => {
    if (!isOpen) setSearchQuery("");
  }, [isOpen]);

  const filteredOptions = React.useMemo(() => {
    if (!searchable || !searchQuery.trim()) return options;
    return options.filter(opt => opt.label.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [options, searchable, searchQuery]);

  useClickAway(dropdownRef, () => setIsOpen(false))

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      setIsOpen(false)
    }
  }

  // Find currently selected option for rendering
  const selectedOption = options.find(opt => opt.id === value)

  const isFilterType = onClear !== undefined; // If it has onClear, it's a dismissible filter
  
  return (
    <MotionConfig reducedMotion="user">
      <div className={cn("relative inline-block", className?.includes('w-full') ? "w-full" : "w-full sm:w-auto")} ref={dropdownRef}>
        <div className={cn("flex items-center gap-1", className?.includes('w-full') ? "w-full" : "")}>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className={triggerClassName || cn(
              "flex items-center justify-between px-3 h-full text-[13px] font-medium rounded-lg shadow-sm border transition-all outline-none",
              className?.includes('w-full') ? "w-full" : "",
              isFilterType
                ? (isOpen ? "bg-slate-50 text-slate-800 border-slate-300 ring-2 ring-slate-200" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50")
                : (badgeCount > 0 || isOpen ? "bg-brand-50 text-brand-700 border-brand-200 ring-2 ring-brand-100" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"),
              className || "h-[40px]"
            )}
            aria-expanded={isOpen}
            aria-haspopup="true"
          >
            <span className="flex items-center gap-1.5 truncate">
              {MainIcon && (
                <div className="relative flex items-center justify-center mr-1 shrink-0">
                  <MainIcon className="w-4 h-4" />
                  {badgeCount > 0 && (
                    <span className="flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-brand-500 text-white text-[10px] font-bold absolute -top-2.5 -right-2.5 ring-2 ring-white">
                      {badgeCount}
                    </span>
                  )}
                </div>
              )}
              {isFilterType && selectedOption ? selectedOption.label : label}
            </span>
            {isFilterType && (
              <div className="flex items-center ml-2 border-l border-slate-200 pl-2 gap-1.5 shrink-0">
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    onClear();
                  }}
                  className="text-slate-400 hover:text-red-500 transition-colors p-0.5 rounded"
                  title="Filtreyi Temizle"
                >
                  <X className="w-3.5 h-3.5" />
                </div>
              </div>
            )}
          </button>
        </div>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{
                opacity: 1,
                y: 0,
                height: "auto",
                transition: {
                  type: "spring",
                  stiffness: 500,
                  damping: 30,
                  mass: 1,
                },
              }}
              exit={{
                opacity: 0,
                y: -10,
                height: 0,
                transition: {
                  type: "spring",
                  stiffness: 500,
                  damping: 30,
                  mass: 1,
                },
              }}
              className="absolute right-0 sm:left-0 top-full mt-2 z-50 w-64 origin-top"
              onKeyDown={handleKeyDown}
            >
              <div className="w-full rounded-xl border border-slate-200 bg-white p-1 shadow-xl overflow-hidden" style={{ borderRadius: 12 }}>
                {searchable && (
                  <div className="px-1 pt-1 pb-2 border-b border-slate-100/50 mb-1">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={searchPlaceholder}
                        autoFocus
                        className="w-full text-sm pl-8 pr-3 py-2 bg-slate-50 border border-slate-200/50 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all text-slate-700 placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                )}
                <div className="max-h-64 overflow-y-auto custom-scrollbar">
                  <motion.div 
                    className="py-1 relative" 
                    variants={containerVariants} 
                    initial="hidden" 
                    animate="visible"
                  >
                    <motion.div
                      layoutId={`hover-highlight-${label}`}
                      className="absolute inset-x-1 bg-slate-100 rounded-lg"
                      initial={false}
                      animate={{
                        y: hoveredOption !== null ? filteredOptions.findIndex(c => (c.id !== undefined ? c.id : c.value) === hoveredOption) * 44 + 4 : -100,
                        height: 40,
                        opacity: hoveredOption !== null ? 1 : 0
                      }}
                      transition={{
                        type: "spring",
                        bounce: 0.15,
                        duration: 0.4,
                      }}
                    />
                    {filteredOptions.length === 0 ? (
                      <div className="px-3 py-4 text-center text-sm text-slate-400">
                        Sonuç bulunamadı
                      </div>
                    ) : (
                      filteredOptions.map((option) => {
                        const id = option.id !== undefined ? option.id : option.value;
                        const isSelected = value === id;
                        return (
                          <motion.button
                            key={id}
                            onClick={() => {
                              onChange(id);
                              setIsOpen(false);
                            }}
                            onHoverStart={() => setHoveredOption(id)}
                            onHoverEnd={() => setHoveredOption(null)}
                            className={cn(
                              "relative flex w-full items-center px-3 py-2.5 h-11 text-sm rounded-lg",
                              "transition-colors duration-150",
                              "focus:outline-none",
                              isSelected || hoveredOption === id
                                ? "text-slate-900 font-medium"
                                : "text-slate-600 font-medium whitespace-nowrap overflow-hidden text-ellipsis",
                              isSelected && "bg-slate-50"
                            )}
                            whileTap={{ scale: 0.98 }}
                            variants={itemVariants}
                          >
                            <IconWrapper
                              icon={option.icon}
                              isHovered={hoveredOption === id}
                              color={option.color}
                              className="mr-2"
                            />
                            <span className="flex-1 text-left truncate">{option.label}</span>
                            <IconWrapper
                              icon={option.rightIcon}
                              isHovered={hoveredOption === id}
                              color={option.color}
                              className="ml-2"
                            />
                            {isSelected && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="ml-2 w-1.5 h-1.5 rounded-full bg-emerald-500"
                              />
                            )}
                          </motion.button>
                        );
                      })
                    )}
                  </motion.div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  )
}
