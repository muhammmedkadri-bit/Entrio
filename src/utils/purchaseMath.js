/**
 * Purchase Math Engine
 * Cascading calculation: Gross → Line Discount → ÖTV → KDV base → KDV → Line Total
 * Precision: NO rounding at intermediate steps. Only formatTRPrice() on display.
 */

/**
 * Calculate a single line item.
 * @param {object} item - { quantity, unit_price, discount_type, discount_value, kdv_rate, otv_rate }
 * @returns {object} - All calculated field values (floats, unrounded)
 */
export function calcLine(item) {
  const qty       = parseFloat(item.quantity)   || 0;
  const price     = parseFloat(item.unit_price) || 0;
  const discVal   = parseFloat(item.discount_value) || 0;
  const kdvRate   = parseFloat(item.kdv_rate)   || 0;
  const otvRate   = parseFloat(item.otv_rate)   || 0;

  // Step 1: Gross
  const gross = qty * price;

  // Step 2: Discount
  let discountAmount;
  if (item.discount_type === 'amount') {
    discountAmount = Math.min(discVal, gross);
  } else {
    // percent
    discountAmount = gross * (discVal / 100);
  }
  const netLine = gross - discountAmount;

  // Step 3: ÖTV (applied to net line, before KDV)
  const otvAmount = netLine * (otvRate / 100);

  // Step 4: KDV base = net + ÖTV
  const kdvBase = netLine + otvAmount;

  // Step 5: KDV
  const kdvAmount = kdvBase * (kdvRate / 100);

  // Step 6: Line total
  const lineTotal = kdvBase + kdvAmount;

  return {
    gross,
    discountAmount,
    netLine,
    otvAmount,
    kdvBase,
    kdvAmount,
    lineTotal,
  };
}

/**
 * Calculate invoice totals from all items + optional global discount.
 * @param {array}  items          - Array of line item objects
 * @param {number} globalDiscountRate  - Percentage (0-100) applied after line discounts
 * @returns {object} - All totals (floats, unrounded)
 */
export function calculateTotals(items = [], globalDiscountRate = 0) {
  let sumGross          = 0;
  let sumLineDiscount   = 0;
  let sumNetLine        = 0;

  // First pass: gross, line discounts
  const lines = items.map(item => {
    const calc = calcLine(item);
    sumGross        += calc.gross;
    sumLineDiscount += calc.discountAmount;
    sumNetLine      += calc.netLine;
    return calc;
  });

  // Global discount applied to sumNetLine
  const globalDiscountAmount = sumNetLine * (globalDiscountRate / 100);
  const netAfterGlobal       = sumNetLine - globalDiscountAmount;

  // Global discount ratio to scale each line proportionally
  const globalRatio = sumNetLine > 0 ? netAfterGlobal / sumNetLine : 1;

  // Second pass: ÖTV and KDV on global-discounted net lines
  let sumOtv = 0;
  let sumKdv = 0;

  lines.forEach((calc, i) => {
    const item = items[i];
    const scaledNet = calc.netLine * globalRatio;
    const kdvRate   = parseFloat(item.kdv_rate) || 0;
    const otvRate   = parseFloat(item.otv_rate)  || 0;

    const otvAmt = scaledNet * (otvRate / 100);
    const kdvBase = scaledNet + otvAmt;
    const kdvAmt  = kdvBase * (kdvRate / 100);

    sumOtv += otvAmt;
    sumKdv += kdvAmt;
  });

  const grandTotal = netAfterGlobal + sumOtv + sumKdv;

  return {
    subtotal:           sumGross,
    totalLineDiscount:  sumLineDiscount,
    globalDiscountAmount,
    netAfterAllDiscounts: netAfterGlobal,
    totalOtv:           sumOtv,
    totalKdv:           sumKdv,
    grandTotal,
  };
}

/**
 * Get line total display value (rounded to 2 decimals for display only)
 */
export function r2(v) {
  return Math.round((v || 0) * 100) / 100;
}
