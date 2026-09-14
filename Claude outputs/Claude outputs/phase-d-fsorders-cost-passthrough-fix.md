# Phase D: carry `cost` through the `fsOrders` reshape (fixes blank Total Cost/Profit in the Transactions CSV)

**File:** `modules/Operations.tsx` ONLY. Apply exactly as given — no rephrasing, no "equivalent"
alternatives. This is a read/display-only fix — it does not touch Firestore, `firestore.rules`, or any
write path, and does not change what gets written to the database.

## Background — read this before making the change, it explains why the CSV was blank despite the Phase A/B/C fix being correct

Phase A/B (commits `273588f`/`b79225f`) and Phase C (commit `a11dd98`) shipped and were independently
verified against `origin/main` — the code was byte-exact to spec. Today's live testing initially showed the
Transactions CSV's new "Total Cost (Rs)" / "Profit (before VAT) (Rs)" columns blank for every row, including a
fresh test order. A long debugging session (emulator restarts, a diagnostic Node script querying the Firestore
emulator directly via `firebase-admin`) eventually proved conclusively that **the write path is correct**: a
freshly-placed test order's item document in Firestore genuinely has `"cost": 135` — the Cloud Function fix
works exactly as intended.

Yet the CSV still showed blank for that exact order. The reason is a separate bug, entirely on the read/display
side, in `Operations.tsx`.

`Operations.tsx` has two layers between the raw Firestore listener and what the Transactions tab actually
reads. A raw listener (`unsubItems`, ~line 918, feeding `fsItemDocs`) does capture every field via a full
spread (`{ ...d.data(), _fsItemId: d.id }`) — that part is fine, `cost` is present there. But a second step, the
`fsOrders` `useMemo` (~line 969), reshapes those raw item documents into the `FsOrderItem[]` shape that
`orders` state (and therefore `renderTransactionsTab`'s row-building, and the CSV export) actually consumes.
That reshape builds each item by listing fields one by one — an explicit allow-list, not a spread:

```tsx
const items: FsOrderItem[] = rawItems.map(it => ({
  itemId: it.itemId,
  name: it.name,
  qty: it.qty,
  price: it.price,
  notes: it.notes,
  deliveryDate: it.deliveryDate,
  deliveryDay: it.deliveryDay,
  serviceSlot: it.serviceSlot,
  paymentStatus: it.paymentStatus,
  status: it.status,
  paymentMethodName: it.paymentMethodName,
  paymentReference: it.paymentReference,
  isReconciled: it.isReconciled,
  _fsItemId: it._fsItemId,
  rating: it.rating,
  ratingComment: it.ratingComment,
}));
```

`cost` was added to Firestore items by the Phase A/B fix, but this allow-list was never updated to carry it
through. Because `cost` is an optional field (`cost?: number` on `OrderItem` in `types.ts`), TypeScript never
flagged the omission as an error — it just silently produces `item.cost === undefined` for every single order,
regardless of what's actually stored in Firestore. That's the entire bug: real data, dropped in transit.

(For context, in case it comes up: the CSV's "Base Selection" / "Dhal Selection" / etc. columns are unaffected
by this same gap because they're derived by parsing the `item.notes` string via `splitNotesTag()`, not read
from `baseId`/`dhalId`/etc. — those raw ID fields are *also* missing from this same allow-list, but nothing
currently reads them from `orders`, so there's no visible symptom. This fix only adds `cost` — see "Do NOT
touch" below for why the other missing fields are intentionally out of scope.)

## The fix — `Operations.tsx`, inside the `fsOrders` `useMemo` (~line 977-994)

```tsx
// BEFORE
      const items: FsOrderItem[] = rawItems.map(it => ({
        itemId: it.itemId,
        name: it.name,
        qty: it.qty,
        price: it.price,
        notes: it.notes,
        deliveryDate: it.deliveryDate,

// AFTER
      const items: FsOrderItem[] = rawItems.map(it => ({
        itemId: it.itemId,
        name: it.name,
        qty: it.qty,
        price: it.price,
        cost: it.cost,
        notes: it.notes,
        deliveryDate: it.deliveryDate,
```

That's the entire change: one line, `cost: it.cost,`, inserted right after `price: it.price,` (matching the
field order `types.ts` already uses for `OrderItem`: `price` immediately followed by `cost`). Everything
downstream — the Ledger row-building (`totalCost`/`profitBeforeVat` computation, already shipped in Phase C)
and the CSV export — already correctly handles `item.cost` being `undefined` vs. a real number. Once `cost`
actually survives this reshape, that existing logic will work exactly as designed; nothing else needs to
change.

## Do NOT touch

- Do not also add `baseId`, `dhalId`, `saladId`, `beverageId`, `dessertId`, `instructions`, `tierAtOrder`, or
  any other field currently missing from this same allow-list. Nothing downstream of `orders` reads them today
  (the CSV's selection columns come from parsing `item.notes` instead, confirmed via `splitNotesTag`), so
  adding them isn't needed to fix this bug and is out of scope here — a separate, deliberate decision if ever
  wanted, not a side effect of this fix.
- No change to `functions/index.js`, `firestore.rules`, `storage.rules`, or `types.ts` — the `cost?: number`
  field already exists on `OrderItem` (Phase C), and the Cloud Function write path is already correct and
  independently verified. This fix is purely local to the one `fsOrders` reshape in `Operations.tsx`.
- No change to the Ledger row-building logic or the CSV header/row-value code from Phase C
  (`totalCost`/`profitBeforeVat` computation, the two new CSV columns) — that code is already correct; it was
  simply never receiving `cost` in the first place.
- No change to the `useMemo`'s dependency array or any other field in the mapped object — only the one line is
  inserted.

## Verify before committing

1. `npx tsc --noEmit` clean, `vite build` clean.
2. Full automated suite (`testCheckoutFlow.js`, `testOrderEditCancel.js`, `testMultiEntity.js`,
   `testSettingsRBAC.js`).
3. Live click-through, with the Firebase emulators running continuously throughout (do not restart them
   mid-test — see note below): place a fresh order using a Main/add-ons that have a `cost` set, then export
   the Transactions CSV and confirm "Total Cost (Rs)" and "Profit (before VAT) (Rs)" now show real numbers for
   that row (Total Cost = item's cost × qty; Profit = Total before VAT − Total Cost) instead of blank.
4. Confirm a pre-existing order from before today's cost-snapshot fix (one with no `cost` field in Firestore)
   still shows correctly **blank** in both columns, not `0.00` — this fix must not change that no-retroactive-
   data behavior.
5. Confirm every other CSV column's values and positions are completely unchanged.

**Important environment note, unrelated to the code change itself:** during today's testing we found that
`npm run emulators` can silently stop running (dropping back to a plain terminal prompt with no error message)
if that terminal window is interacted with, or if a second command is run against it, while it's still meant
to be up. When verifying step 3, start the emulators in one terminal, confirm the "✔ All emulators ready!"
banner appears, then leave that terminal completely untouched and do all testing (placing orders, running
scripts) from a separate terminal/browser — otherwise a real fix can look like it failed simply because the
backend quietly stopped running underneath it.

Commit as its own fix, e.g. `fix(operations): carry cost field through fsOrders reshape so Ledger/CSV can read it`.
