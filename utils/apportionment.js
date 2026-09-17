// utils/apportionment.js
// Net-price proportional apportionment helper for BonManzE RMS

/**
 * Rounds a number to 2 decimal places using Math.round with Number.EPSILON.
 * @param {number} n
 * @returns {number}
 */
export function r2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Apportions a total collected/allocated amount proportionally across items
 * based on each item's net amount (or outstanding amount).
 *
 * Apportionment rules:
 * - Each non-last item receives r2(totalAmount * (itemNetAmount / netTotal)).
 * - The last item receives r2(totalAmount - allocatedSoFar) so that the sum of
 *   apportioned shares equals totalAmount exactly without floating point rounding errors.
 *
 * @param {Array<{ netAmount?: number } | number>} items - Array of items with netAmount property or raw net numbers
 * @param {number} totalAmount - Total amount to apportion
 * @returns {number[]} Array of apportioned shares matching the input items array
 */
export function apportionAmount(items, totalAmount) {
  if (!items || items.length === 0) return [];
  const safeTotal = Math.max(0, isNaN(totalAmount) ? 0 : totalAmount);

  const netAmounts = items.map(item =>
    typeof item === 'number' ? item : (item && typeof item.netAmount === 'number' ? item.netAmount : 0)
  );

  const netTotal = netAmounts.reduce((sum, amt) => sum + amt, 0);
  let allocated = 0;

  return netAmounts.map((net, idx) => {
    if (idx === netAmounts.length - 1) {
      const lastShare = r2(safeTotal - allocated);
      allocated += lastShare;
      return lastShare;
    }
    const share = r2(netTotal > 0 ? safeTotal * (net / netTotal) : 0);
    allocated += share;
    return share;
  });
}
