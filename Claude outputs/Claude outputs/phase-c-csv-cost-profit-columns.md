# Phase C: add "Total Cost" and "Profit (before VAT)" columns to the Transactions CSV export

**Files:** `types.ts` and `modules/Operations.tsx` ONLY. Apply exactly as given — no rephrasing, no
"equivalent" alternatives. Display/export-only, no write-path involved — this reads the `cost` field the
`confirmCheckout`/`editOrderItemSelection` fix already snapshots onto order items, it doesn't write anything.

## Background

The Cloud Functions fix that shipped and was verified today (`273588f`/`b79225f`) already writes a `cost`
field onto every new order item in Firestore. The raw runtime data already carries it (Operations' `items`
listener spreads every field via `{ ...d.data(), _fsItemId: d.id }`), but the `OrderItem` TypeScript interface
was never updated to declare it — referencing `item.cost` anywhere in `Operations.tsx` will fail `tsc
--noEmit` until that's added. This is Change 0 below.

Per the confirmed decision from when the `cost` field was first added: orders placed before this shipped
simply have no `cost` on their items — no retroactive rewrite. So "Total Cost"/"Profit (before VAT)" must show
**blank**, not `0.00`, for any item where `cost` is `undefined` — `0.00` would misleadingly claim "this cost
nothing" rather than "we don't have this data."

This is CSV-export-only, per what was actually asked for — no new on-screen table columns or summary tiles
(matches the earlier decision to keep the Ledger's on-screen summary to the existing 5 tiles, nothing added).

## Change 0 — `types.ts`: declare `cost` on `OrderItem` (~line 147-152)

```ts
// BEFORE
export interface OrderItem {
  _fsItemId?: string;
  itemId: string;
  name: string;
  qty: number;
  price: number;
  notes?: string;

// AFTER
export interface OrderItem {
  _fsItemId?: string;
  itemId: string;
  name: string;
  qty: number;
  price: number;
  cost?: number;
  notes?: string;
```

## Change 1 — `Operations.tsx`: add the two fields to the Ledger row type (~line 3805)

```tsx
// BEFORE
      bulkDiscount: number;
      bulkRate: number;
      totalBeforeVat: number;
      vat: number;
      totalWithTax: number;

// AFTER
      bulkDiscount: number;
      bulkRate: number;
      totalBeforeVat: number;
      totalCost?: number;
      profitBeforeVat?: number;
      vat: number;
      totalWithTax: number;
```

## Change 2 — `Operations.tsx`: compute and push the two values (~line 3839-3866)

```tsx
// BEFORE
        const totalBeforeVat = itemTotal - itemDiscount;
        const itemVat = (o.vat || 0) * proportion;
        const itemNetTotal = totalBeforeVat + itemVat;

        rows.push({
          orderId: o.id,
          entityId: o.entityId || '',
          entityName,
          timestamp: o.timestamp,
          deliveryDate: item.deliveryDate || item.deliveryDay || '',
          customerName: o.customerName,
          customerPhone: cust?.phone || '',
          itemName: item.name,
          notes: item.notes,
          qty: item.qty,
          price: item.price,
          itemTotal: itemTotal,
          discount: itemDiscount,
          discountReason: o.discountReason || '',
          standardDiscount,
          standardRate,
          birthdayDiscount,
          birthdayRate,
          bulkDiscount,
          bulkRate,
          totalBeforeVat,
          vat: itemVat,
          totalWithTax: itemNetTotal,

// AFTER
        const totalBeforeVat = itemTotal - itemDiscount;
        const itemVat = (o.vat || 0) * proportion;
        const itemNetTotal = totalBeforeVat + itemVat;
        // Blank (undefined), not 0, when this item predates the cost-
        // snapshot fix — 0 would falsely claim "this cost nothing." Cost is
        // per-unit (same convention as price), so multiply by qty.
        const totalCost = item.cost !== undefined ? item.cost * item.qty : undefined;
        const profitBeforeVat = totalCost !== undefined ? totalBeforeVat - totalCost : undefined;

        rows.push({
          orderId: o.id,
          entityId: o.entityId || '',
          entityName,
          timestamp: o.timestamp,
          deliveryDate: item.deliveryDate || item.deliveryDay || '',
          customerName: o.customerName,
          customerPhone: cust?.phone || '',
          itemName: item.name,
          notes: item.notes,
          qty: item.qty,
          price: item.price,
          itemTotal: itemTotal,
          discount: itemDiscount,
          discountReason: o.discountReason || '',
          standardDiscount,
          standardRate,
          birthdayDiscount,
          birthdayRate,
          bulkDiscount,
          bulkRate,
          totalBeforeVat,
          totalCost,
          profitBeforeVat,
          vat: itemVat,
          totalWithTax: itemNetTotal,
```

## Change 3 — `Operations.tsx`: add the two CSV headers (~line 2170, inside `exportTransactionsCSV`)

```tsx
// BEFORE
      'Bulk Discount (Rs)',
      'Bulk Rate (%)',
      'Total before VAT (Rs)',
      'VAT Share (Rs)',

// AFTER
      'Bulk Discount (Rs)',
      'Bulk Rate (%)',
      'Total before VAT (Rs)',
      'Total Cost (Rs)',
      'Profit (before VAT) (Rs)',
      'VAT Share (Rs)',
```

## Change 4 — `Operations.tsx`: add the two CSV row values, in the same order (~line 2239)

```tsx
// BEFORE
        r.bulkDiscount.toFixed(2),
        r.bulkRate.toString(),
        r.totalBeforeVat.toFixed(2),
        r.vat.toFixed(2),

// AFTER
        r.bulkDiscount.toFixed(2),
        r.bulkRate.toString(),
        r.totalBeforeVat.toFixed(2),
        r.totalCost !== undefined ? r.totalCost.toFixed(2) : '',
        r.profitBeforeVat !== undefined ? r.profitBeforeVat.toFixed(2) : '',
        r.vat.toFixed(2),
```

## Do NOT touch

- No on-screen table column or summary tile for cost/profit — CSV export only, per what was actually asked
  for.
- `calculateItemsTotal` in `functions/index.js`, or anything else in the Cloud Functions — this only reads
  the already-snapshotted `cost` field, nothing server-side changes.
- The row-building loop's other fields, sort order, or the CSV's existing column order/positions — only the
  two new columns are inserted, nothing else moves.

## Verify before committing

1. `npx tsc --noEmit` clean, `vite build` clean.
2. Full automated suite (`testCheckoutFlow.js`, `testOrderEditCancel.js`, `testMultiEntity.js`,
   `testSettingsRBAC.js`).
3. Live click-through: place a fresh order using a Main/add-ons that have a `cost` set, export the
   Transactions CSV, and confirm "Total Cost (Rs)" and "Profit (before VAT) (Rs)" show correct numbers for
   that row (Total Cost = item's cost × qty; Profit = Total before VAT − Total Cost).
4. Confirm a pre-existing order placed before today's cost-snapshot fix shows **blank** in both new columns
   for its rows, not `0.00`.
5. Confirm every other existing column's values and positions are completely unchanged.

Commit as its own fix, e.g. `feat(operations): add Total Cost and Profit (before VAT) columns to Transactions CSV export`.
