# Cleanup: show 2 decimal places on every raw price/amount display

**Date:** 2026-09-14
**Files touched:** `modules/CustomerPortal.tsx`, `modules/Operations.tsx`. No backend/rules change — display only.
**Reported by:** Bhimal, noticed the receipt's line-item prices showed as whole numbers (`Rs255`) while the subtotal/discount/VAT/total lines right below correctly showed two decimals (`Rs 255.00`). Asked for the same cleanup applied everywhere this pattern appears, not just the receipt.

## The pattern

Both files already import and use `formatCurrency` (from `modules/store.ts`) in plenty of places — it renders `"{SYSTEM_CONFIG.currencySymbol} {value formatted with thousands separators and exactly 2 decimal places}"` (e.g. `"Rs 1,234.56"`). But a number of spots instead hardcode the literal text `Rs ` followed by a raw, unformatted number — no decimals, no thousands separator. Every one of these should switch to `formatCurrency(...)`, dropping the hardcoded `Rs ` since the helper already includes it. This also means these prices track `SYSTEM_CONFIG.currencySymbol` correctly if it's ever changed in Settings, instead of a hardcoded string.

## Exact changes

**`modules/CustomerPortal.tsx`:**

1. Line 2598: `Rs {special.regularPrice}` → `{formatCurrency(special.regularPrice)}`
2. Line 2599: `Rs {c.price}` → `{formatCurrency(c.price)}`
3. Line 2619: `Rs {mealPrice(m, d.key, activeService, activeWeekStart)}` → `{formatCurrency(mealPrice(m, d.key, activeService, activeWeekStart))}`
4. Line 2665: `Rs {mealPrice(m, d.key, service, week.start)}` → `{formatCurrency(mealPrice(m, d.key, service, week.start))}`
5. Line 2792: `Rs {line.item.price}` → `{formatCurrency(line.item.price)}`
6. Line 2919: `Rs {line.item.price}` → `{formatCurrency(line.item.price)}` (same text as #5, different location — both occurrences of this exact JSX need the change, not just one)
7. Line 3169: `Rs {line.item.price}` → `{formatCurrency(line.item.price)}`
8. Line 3284: `Rs {special.regularPrice}` → `{formatCurrency(special.regularPrice)}`
9. Line 3285: `Rs {c.price}` → `{formatCurrency(c.price)}`
10. Line 3369: `Rs {mealPrice(builder.sel, builder.day.key, builder.service, builder.weekStart)}` → `{formatCurrency(mealPrice(builder.sel, builder.day.key, builder.service, builder.weekStart))}`
11. Line 3730 (the receipt line-item that started this): `Rs {line.item.price}` → `{formatCurrency(line.item.price)}`

**`modules/Operations.tsx`:**

12. Line 2656: `Rs {activeWeekFinancials.collected}` → `{formatCurrency(activeWeekFinancials.collected)}`
13. Line 2657: `Rs {activeWeekFinancials.outstanding} outstanding` → `{formatCurrency(activeWeekFinancials.outstanding)} outstanding` (keep the trailing " outstanding" text, only the number part changes)
14. Line 7697: `Rs {editCustomer.ltv?.toLocaleString() || '0'}` → `{formatCurrency(editCustomer.ltv || 0)}` (preserves the existing "falls back to 0 when unset" behavior — `formatCurrency` handles the formatting `.toLocaleString()` was doing, plus adds the 2-decimal guarantee `.toLocaleString()` alone didn't provide)
15. Line 7707: `Rs {editCustomer.storeCredit || 0}` → `{formatCurrency(editCustomer.storeCredit || 0)}`
16. Line 7946 (the receipt line-item that started this): `Rs {item.price}` → `{formatCurrency(item.price)}`

Every one of these 16 spots keeps the exact same surrounding JSX (className, conditional wrappers, etc.) — only the price expression itself changes, per the before/after pairs above. Nothing else in either file should change. Both files already have `formatCurrency` imported (confirmed — it's used elsewhere in each file already), so no new import is needed.

## Not touched, and why

This was reported specifically about price/amount display. It doesn't touch:
- Any calculation logic (discounts, VAT, totals) — purely how already-correct numbers are displayed.
- `qty`/count displays, dates, ratings, or anything that isn't a currency amount.
- The subtotal/discount/VAT/total lines that already correctly use `.toFixed(2)` inline (e.g. `Rs {displaySubtotal.toFixed(2)}`) — those already show 2 decimals correctly and don't need `formatCurrency`, though switching them too would be a reasonable follow-up for full consistency if Bhimal wants it later. Not included here since only the un-formatted spots were reported.
