/**
 * Turkish Price Parser & Formatter
 * Handles TR locale: comma as decimal separator, period as thousands separator
 * e.g.  "1.250,50" → 1250.50  |  1250.50 → "1.250,50"
 */

/**
 * Parse a Turkish-formatted price string to a float.
 * Accepts: "1.250,50" | "1250,50" | "1250.50" | "1250"
 */
export function parseTRPrice(str) {
  if (str === null || str === undefined) return 0;
  const s = String(str).trim();
  if (s === '' || s === '-') return 0;

  // If it contains a comma → TR format (comma = decimal separator)
  if (s.includes(',')) {
    // Remove all periods (thousands sep), replace comma with period (decimal sep)
    const normalized = s.replace(/\./g, '').replace(',', '.');
    const val = parseFloat(normalized);
    return isNaN(val) ? 0 : val;
  }

  // No comma: treat as plain float (period = decimal separator)
  const val = parseFloat(s.replace(/[^\d.]/g, ''));
  return isNaN(val) ? 0 : val;
}

/**
 * Format a float to Turkish price string.
 * e.g. 1250.5 → "1.250,50"
 */
export function formatTRPrice(num, decimals = 2) {
  if (num === null || num === undefined || isNaN(num)) return '0,00';
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * formatTRPrice — alias used for currency display
 */
export function formatTRCurrency(num) {
  return formatTRPrice(num, 2);
}

/**
 * onChange handler factory for text inputs using TR format.
 * Use in react-hook-form: onChange={onChangeTR(rhfOnChange)}
 * Saves the raw float to the form, keeps input as-is while typing.
 */
export function onChangeTR(rhfOnChange) {
  return (e) => {
    const raw = e.target.value;
    const float = parseTRPrice(raw);
    rhfOnChange(float);
  };
}

/**
 * onBlur handler: re-formats the input display value on blur.
 * Usage: onBlur={onBlurTR(value, inputRef)}
 */
export function onBlurTR(value, ref) {
  return () => {
    if (ref && ref.current) {
      ref.current.value = formatTRPrice(value || 0);
    }
  };
}
