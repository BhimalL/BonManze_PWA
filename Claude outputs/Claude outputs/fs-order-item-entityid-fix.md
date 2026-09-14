# Fix: order items are missing `entityId` on the client — root cause of the inverted partner filter

Fast-path (a type field + a reshape field, both additive; no `firestore.rules`/Cloud Function/schema
change — `entityId` is already written onto every item document by `confirmCheckout`, this just carries
it through to the client's in-memory shape where it's never existed until now).

**Root cause:** `modules/Operations.tsx`'s `fsOrders` reshape (~line 984) turns raw Firestore item docs
into the app's internal `FsOrderItem`/`OrderItem` shape. That mapping (~line 992-1010) explicitly lists
every field it copies over, and `entityId` was never one of them — even though `confirmCheckout` has
written `entityId` onto every item document since the original Partner Accounts work, and the raw
Firestore data genuinely has it (confirmed via `scripts/diagnosePartnerFilterMismatch.js` against the
live emulator: item `entityId="entity-b"`, matching Rik's Kitchen). `entityId` is also not declared on the
`OrderItem` interface in `types.ts` at all — only `Order` (the order-level type) has it.

This means every `item.entityId` read anywhere in the app that goes through this reshape has always been
`undefined`, regardless of what's actually stored. Nothing surfaced this until the Orders by Dish partner
filter, which is the first code to actually read `item.entityId` on this reshaped data (the existing
Partner-scoping query filters at the Firestore query level using the raw stored field directly, never
touching this client-side shape; the Delivery List's entity badges read `entityId` off the *order*, which
this same reshape does carry through correctly — it's specifically the *item*-level field that's missing).

## 1. Add `entityId` to the `OrderItem` type

**Where:** `types.ts`, the `OrderItem` interface (~line 147-172).

**Current (end of interface, ~line 171):**
```ts
  instructions?: string;
  tierAtOrder?: string;
}
```

**Change to:**
```ts
  instructions?: string;
  tierAtOrder?: string;
  entityId?: string;
}
```

## 2. Carry `entityId` through the reshape

**Where:** `modules/Operations.tsx`, `fsOrders`'s item-mapping (~line 992-1010).

**Current:**
```jsx
const items: FsOrderItem[] = rawItems.map(it => ({
  itemId: it.itemId,
  name: it.name,
  qty: it.qty,
  price: it.price,
  cost: it.cost,
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

**Change to (one new line, `entityId: it.entityId,`):**
```jsx
const items: FsOrderItem[] = rawItems.map(it => ({
  itemId: it.itemId,
  name: it.name,
  qty: it.qty,
  price: it.price,
  cost: it.cost,
  notes: it.notes,
  deliveryDate: it.deliveryDate,
  deliveryDay: it.deliveryDay,
  serviceSlot: it.serviceSlot,
  paymentStatus: it.paymentStatus,
  status: it.status,
  paymentMethodName: it.paymentMethodName,
  paymentReference: it.paymentReference,
  isReconciled: it.isReconciled,
  entityId: it.entityId,
  _fsItemId: it._fsItemId,
  rating: it.rating,
  ratingComment: it.ratingComment,
}));
```

No changes needed to `entitiesWithActivePartner` or the two filter checks in `dishesByDay` (~line
1448-1449) — that logic is already correct; it was just reading a field that never had a value.

## After applying

- `npx tsc --noEmit` and `npm run build` — both files.
- Manual check: with the emulator running, re-check "Partner-assigned only" on Orders by Dish — it should
  now show Rik's Kitchen's order (since Partner_1 is actively assigned there), and "No partner assigned"
  should now hide it. If a second test order exists for an entity with no partner assigned, confirm the
  reverse holds for that one.
