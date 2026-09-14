# Spec: Invoice numbering + reprint marking — REBUILD (replaces the checkout-time version)

**Working Agreement: SLOW PATH.** This replaces `invoice-numbering-and-reprint-marking.md` entirely — apply this document, not that one. It's structured in two parts: **Part A reverts** the checkout-time implementation that shipped in commit `885d0f9` (confirmed wrong — invoices were being minted in `confirmCheckout` at order-placement time, on the order document, not at Mark Paid, per item/drop, as §8 of the scope doc requires). **Part B rebuilds** it correctly. Do both parts together, in one commit — a partial revert with no rebuild leaves invoice numbers off entirely; a rebuild without the revert leaves two competing invoice-number mechanisms live at once.

**Reference:** `BonManzE_InvoicingPaymentMethods_Scope.md` §5/§8 — confirmed decision: a new Cloud Function, built as a Firestore trigger sibling to `onItemPaymentConfirmed` (see "Why a trigger, not a callable" below — unchanged from the original spec).

---

## Part A — Revert the checkout-time implementation

### A1. `types.ts` — remove the two fields from `Order`

Current (`Order` interface, tail end):
```ts
  entityEmail?: string;
  entityPhone?: string;
  entityLogoStoragePath?: string;
  invoiceNumber?: string;
  invoiceReprintCount?: number;
}
```
Remove the last two lines — `Order` goes back to ending at `entityLogoStoragePath?: string;`:
```ts
  entityEmail?: string;
  entityPhone?: string;
  entityLogoStoragePath?: string;
}
```
(Part B adds the equivalent fields to `OrderItem` instead — see B1.)

### A2. `functions/index.js` — remove the invoice-minting transaction from `confirmCheckout`

Current `confirmCheckout` write block:
```js
  // ---- Write the order + its items subcollection transactionally ----
  const orderRef = db.collection('orders').doc();
  const entityRef = db.collection('entities').doc(customer.entityId);

  await db.runTransaction(async (tx) => {
    const txEntitySnap = await tx.get(entityRef);
    const txEntityData = txEntitySnap.exists ? txEntitySnap.data() : (entity || {});
    const currentCounter = (typeof txEntityData.invoiceNumberCounter === 'number' ? txEntityData.invoiceNumberCounter : 0) + 1;
    const prefix = txEntityData.invoicePrefix || entity.invoicePrefix || 'INV';
    const seqStr = String(currentCounter).padStart(9, '0');
    const invoiceNumber = `${prefix}-${seqStr}`;

    tx.update(entityRef, {
      invoiceNumberCounter: currentCounter,
      updatedAt: Timestamp.now(),
    });

    const standardLabel = (groupObj && groupRate > standardTierRate)
      ? `${groupObj.name} Group`
      : (tierObj?.name ? `${tierObj.name} Tier` : 'Standard');

    const reasonParts = [];
    if (standardDiscountRounded > 0) reasonParts.push(`${standardLabel} (${effectiveStandardRate}%)`);
    if (birthdayDiscountRounded > 0) reasonParts.push(`Birthday (${birthdayTierRate}%)`);
    if (bulkDiscountRounded > 0) reasonParts.push(`Full-week (${config.bulkDiscountRate}%)`);

    const now = Timestamp.now();
    tx.set(orderRef, {
      customerId: uid,
      customerName: customer.name || '',
      type,
      paymentScheme,
      tenderType: typeof tenderType === 'string' ? tenderType : '',
      paymentMethodName: typeof paymentMethodName === 'string' ? paymentMethodName : '',
      total,
      subtotal,
      discount: totalDiscount,
      discountBreakdown,
      discountReason: reasonParts.join(', '),
      vat,
      invoiceNumber,
      invoiceReprintCount: 0,
      createdAt: now,
      entityId: customer.entityId,
      entityName: entity.name || '',
      entityBrn: entity.brn || '',
      entityVatNumber: entity.vatNumber || '',
      entityBankReference: entity.bankReference || '',
      entityAddress: entity.address || '',
      entityEmail: entity.email || '',
      entityPhone: entity.phone || '',
      entityLogoStoragePath: entity.logoStoragePath || '',
    });
    priced.forEach((p) => {
      const { _weekStart, _service, _weekdayKey, ...itemFields } = p;
      const itemRef = orderRef.collection('items').doc();
      tx.set(itemRef, {
        ...itemFields,
        customerId: uid,
        customerName: customer.name || '',
        entityId: customer.entityId,
      });
    });
  });
```

Replace with (removes `entityRef`, the counter read/increment, and the two invoice fields on the order — **keeps** `standardLabel`/`reasonParts`, which is unrelated group-discount-naming work from a different fix and must not be touched):
```js
  // ---- Write the order + its items subcollection transactionally ----
  const orderRef = db.collection('orders').doc();

  await db.runTransaction(async (tx) => {
    const standardLabel = (groupObj && groupRate > standardTierRate)
      ? `${groupObj.name} Group`
      : (tierObj?.name ? `${tierObj.name} Tier` : 'Standard');

    const reasonParts = [];
    if (standardDiscountRounded > 0) reasonParts.push(`${standardLabel} (${effectiveStandardRate}%)`);
    if (birthdayDiscountRounded > 0) reasonParts.push(`Birthday (${birthdayTierRate}%)`);
    if (bulkDiscountRounded > 0) reasonParts.push(`Full-week (${config.bulkDiscountRate}%)`);

    const now = Timestamp.now();
    tx.set(orderRef, {
      customerId: uid,
      customerName: customer.name || '',
      type,
      paymentScheme,
      tenderType: typeof tenderType === 'string' ? tenderType : '',
      paymentMethodName: typeof paymentMethodName === 'string' ? paymentMethodName : '',
      total,
      subtotal,
      discount: totalDiscount,
      discountBreakdown,
      discountReason: reasonParts.join(', '),
      vat,
      createdAt: now,
      entityId: customer.entityId,
      entityName: entity.name || '',
      entityBrn: entity.brn || '',
      entityVatNumber: entity.vatNumber || '',
      entityBankReference: entity.bankReference || '',
      entityAddress: entity.address || '',
      entityEmail: entity.email || '',
      entityPhone: entity.phone || '',
      entityLogoStoragePath: entity.logoStoragePath || '',
    });
    priced.forEach((p) => {
      const { _weekStart, _service, _weekdayKey, ...itemFields } = p;
      const itemRef = orderRef.collection('items').doc();
      tx.set(itemRef, {
        ...itemFields,
        customerId: uid,
        customerName: customer.name || '',
        entityId: customer.entityId,
      });
    });
  });
```
`entity.invoicePrefix`/`entity.invoiceNumberCounter` are no longer read anywhere in `confirmCheckout` after this — that's correct, per §5's original design note (numbering is entirely a Mark-Paid-time concern now).

**Note for whoever reviews this:** any order placed between commit `885d0f9` and this revert landing has a real (if prematurely-issued) `invoiceNumber` on its order document. Leave those alone — do not attempt to strip `invoiceNumber` off existing orders. They're a small, known population of orders with a number issued before payment; harmless to leave as historical artifacts, not worth a data-migration script for what should be a handful of test orders in the emulator.

---

## Part B — Rebuild at Mark Paid, per item/drop, via a Cloud Function trigger

### Why a trigger, not a callable

Unchanged from the original spec: `onItemPaymentConfirmed` (existing, shipped, `functions/index.js`) is a Firestore trigger that already fires exactly when an item's `paymentStatus` transitions into `'Paid'`, and already does trusted, transactional, server-side work in reaction (loyalty points). Invoice numbering has the identical shape — a sibling trigger, not a new callable, and zero changes to `markPaid`'s client write.

### B1. `types.ts` — add three fields to `OrderItem`

Current tail of `OrderItem`:
```ts
  tierAtOrder?: string;
  entityId?: string;
}
```
Add three fields before the closing brace:
```ts
  tierAtOrder?: string;
  entityId?: string;
  // Set once, server-side only, by the issueInvoiceOnPayment Cloud Function
  // trigger (functions/index.js) the moment this item (or another item in
  // the same Mark Paid "drop") is first marked Paid. Never written by any
  // client code. Absent = this drop's invoice hasn't been issued yet (the
  // trigger hasn't landed) or the entity has no invoicePrefix configured —
  // both cases fall back to displaying the raw order/item id.
  invoiceNumber?: string;
  invoiceIssuedAt?: any;
  // Starts at 0 (set by the trigger alongside invoiceNumber). Incremented
  // by 1, client-side, every time a receipt view opens for an item that
  // already has an invoiceNumber — i.e. every view after the one that
  // first displayed it. 0 = original, never shown as a reprint; >0 = show
  // the REPRINT/DUPLICATE badge.
  invoiceReprintCount?: number;
}
```

### B2. `functions/index.js` — new trigger, `issueInvoiceOnPayment`

Insert immediately after `onItemPaymentConfirmed`'s closing `});`, before the `// Helper: Calculate net order total...` comment:

```js
// ============================================================================
// issueInvoiceOnPayment — Firestore trigger, sibling to onItemPaymentConfirmed
// above (same document path, same trigger event: paymentStatus transitions
// INTO 'Paid'). Separate function so this piece can be reviewed/rolled back
// independently of the already-verified loyalty-points trigger.
//
// Per BonManzE_InvoicingPaymentMethods_Scope.md §8: an order's real invoice
// number is issued at Mark Paid, not at checkout (an earlier attempt at this,
// commit 885d0f9, issued it inside confirmCheckout instead — reverted; see
// invoice-numbering-rebuild.md Part A). One Mark Paid click can mark several
// items Paid at once (every item in one drop — one order + one deliveryDate
// + one serviceSlot, matching DropTask in Operations.tsx) — those items must
// share ONE invoice number, not one each. This trigger fires once per item,
// so it coordinates via a small per-drop assignment doc
// (orders/{orderId}/invoiceAssignments/{dropDocId}) written inside the same
// transaction that increments the entity's counter: whichever item's
// trigger invocation reaches that transaction first mints the number and
// writes the assignment doc; every other item in the same drop (including
// this same item if the trigger ever retries/redelivers) reads the
// existing assignment doc back and reuses its number. Firestore serializes
// transactions that touch the same document, so this is race-safe under
// concurrent invocations without any client-side change to markPaid.
// ============================================================================
export const issueInvoiceOnPayment = onDocumentUpdated('orders/{orderId}/items/{itemId}', async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();

  if (!after || after.paymentStatus !== 'Paid' || before?.paymentStatus === 'Paid') {
    return; // only the transition INTO Paid issues an invoice, and only once
  }
  if (after.invoiceNumber) {
    return; // already issued (defends against at-least-once trigger redelivery)
  }

  const entityId = after.entityId;
  const orderId = event.params.orderId;
  const itemId = event.params.itemId;
  if (!entityId) {
    return; // no entity on this item — nothing to number against, leave unset (raw-id fallback)
  }

  const deliveryDate = after.deliveryDate || 'none';
  const serviceSlot = after.serviceSlot || 'none';
  const dropDocId = `${deliveryDate}__${serviceSlot}`.replace(/[/\s]+/g, '_');

  const itemRef = event.data.after.ref;
  const entityRef = db.collection('entities').doc(entityId);
  const assignmentRef = db.collection('orders').doc(orderId).collection('invoiceAssignments').doc(dropDocId);

  await db.runTransaction(async (tx) => {
    const itemSnapNow = await tx.get(itemRef);
    if (!itemSnapNow.exists || itemSnapNow.data().invoiceNumber) return;

    const assignmentSnap = await tx.get(assignmentRef);
    let invoiceNumber, invoiceIssuedAt;

    if (assignmentSnap.exists) {
      const a = assignmentSnap.data();
      invoiceNumber = a.invoiceNumber;
      invoiceIssuedAt = a.invoiceIssuedAt;
    } else {
      const entitySnap = await tx.get(entityRef);
      if (!entitySnap.exists) return;
      const entity = entitySnap.data();
      const prefix = entity.invoicePrefix;
      if (!prefix || typeof prefix !== 'string' || !prefix.trim()) {
        return; // no invoicePrefix configured yet — skip, raw-id fallback on the receipt
      }
      const nextSeq = (entity.invoiceNumberCounter || 0) + 1;
      invoiceNumber = `${prefix.trim()}-${String(nextSeq).padStart(9, '0')}`;
      invoiceIssuedAt = Timestamp.now();
      tx.update(entityRef, { invoiceNumberCounter: nextSeq });
      tx.set(assignmentRef, {
        invoiceNumber,
        invoiceIssuedAt,
        orderId,
        deliveryDate,
        serviceSlot,
        entityId,
      });
    }

    tx.update(itemRef, {
      invoiceNumber,
      invoiceIssuedAt,
      invoiceReprintCount: 0,
    });
  });
});
```

### B3. `firestore.rules` — two additions

**B3a. Explicit deny for `invoiceAssignments`**, right after the `items` match block closes (same spot as before):
```
    match /orders/{orderId}/invoiceAssignments/{dropDocId} {
      allow read, write: if false;
    }
```

**B3b. New OR-branch on the `items` update rule**, so staff can bump `invoiceReprintCount` on an already-Paid item without touching a payment field. Add as a new `) || (` branch inside the `items` update rule's `isPartnerEntityAllowed(...) && (...)` group, after branch 2 ("Customer update (pay claim)"):
```
        ) || (
          // 3. Reprint-count bump (Operations Payments/paid-history view, or
          // the customer's own receipt re-view). Only invoiceReprintCount
          // may change; invoiceNumber/invoiceIssuedAt themselves are set
          // only by issueInvoiceOnPayment's Admin SDK write, never by a
          // client, so both are pinned equal here too.
          (isStaffAllowed('payments', 'view') || isCustomer(resource.data.customerId))
          && request.resource.data.get('invoiceReprintCount', null) != resource.data.get('invoiceReprintCount', null)
          && request.resource.data.paymentStatus == resource.data.paymentStatus
          && request.resource.data.get('paymentMethodName', null) == resource.data.get('paymentMethodName', null)
          && request.resource.data.get('paymentReference', null) == resource.data.get('paymentReference', null)
          && request.resource.data.status == resource.data.status
          && request.resource.data.price == resource.data.price
          && request.resource.data.qty == resource.data.qty
          && request.resource.data.name == resource.data.name
          && request.resource.data.customerId == resource.data.customerId
          && request.resource.data.get('entityId', null) == resource.data.get('entityId', null)
          && request.resource.data.get('invoiceNumber', null) == resource.data.get('invoiceNumber', null)
          && request.resource.data.get('invoiceIssuedAt', null) == resource.data.get('invoiceIssuedAt', null)
        )
```
(This one branch covers both the staff-side bump, from Operations, and the customer's own bump, from CustomerPortal — simpler than adding the customer half implicitly through branch 2, and explicit about exactly what's allowed to change.)

No rules change needed for `entities/{entityId}.invoiceNumberCounter`: only the trigger's Admin SDK transaction touches it, which bypasses rules entirely.

---

## Part C — Fix both receipts to read the real, item-level fields

### C1. `Operations.tsx` — remove the broken order-level wiring, wire to items instead

Current (in the `activeReceiptDrop` receipt modal — the duplicate/reprint badge and the "Invoice ref" line):
```tsx
                <div className="flex items-center justify-between mt-3">
                  <p className="text-[10px] font-black uppercase text-primary tracking-widest">{SYSTEM_CONFIG.vatEnabled ? 'Tax invoice' : 'Receipt'}</p>
                  {Boolean(order?.invoiceReprintCount && order.invoiceReprintCount > 0) && (
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 text-[9px] font-black uppercase tracking-wider">
                      Duplicate / Reprint #{order?.invoiceReprintCount}
                    </span>
                  )}
                </div>
```
and
```tsx
                  <div className="text-right">
                    <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-1">Invoice ref</p>
                    <p className="font-mono text-slate-600">{order?.invoiceNumber || activeReceiptDrop.orderId}</p>
                    {order?.timestamp && <p className="text-slate-500 mt-1">{new Date(order.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
                  </div>
```
Replace both with item-level equivalents. Add, right before the `return (` of this modal's IIFE (or wherever the existing `order`/`cust`/`breakdowns` locals are computed — same spot), two new locals:
```ts
const allInvoiced = activeReceiptDrop.items.every(i => !!i.invoiceNumber);
const invoiceRefDisplay = allInvoiced
  ? Array.from(new Set(activeReceiptDrop.items.map(i => i.invoiceNumber))).join(', ')
  : activeReceiptDrop.orderId;
const anyReprinted = activeReceiptDrop.items.some(i => (i.invoiceReprintCount || 0) > 0);
```
Then:
```tsx
                <div className="flex items-center justify-between mt-3">
                  <p className="text-[10px] font-black uppercase text-primary tracking-widest">{SYSTEM_CONFIG.vatEnabled ? 'Tax invoice' : 'Receipt'}</p>
                  {anyReprinted && (
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 text-[9px] font-black uppercase tracking-wider">
                      Duplicate / Reprint
                    </span>
                  )}
                </div>
```
```tsx
                  <div className="text-right">
                    <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-1">Invoice ref</p>
                    <p className="font-mono text-slate-600">{invoiceRefDisplay}</p>
                    {order?.timestamp && <p className="text-slate-500 mt-1">{new Date(order.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
                  </div>
```
(Dropped the `#{count}` from the badge — with several items each carrying their own count, a single number on the badge would be misleading; "Duplicate / Reprint" alone, shown whenever any line has been viewed more than once, is accurate. If a per-line count is wanted later, it belongs next to each item row, not the header badge — not required here.)

**Fix the Print button** — it currently does a doomed direct client write to `orders/{orderId}` (blocked by `firestore.rules`'s unconditional `allow update, delete: if false` on that collection, so the write is silently rejected every time — this is why reprint counts have never actually incremented). Current:
```tsx
                  <button
                    onClick={async () => {
                      if (order?.id) {
                        try {
                          await updateDoc(doc(db, 'orders', order.id), {
                            invoiceReprintCount: (order.invoiceReprintCount || 0) + 1,
                            updatedAt: Timestamp.now(),
                          });
                        } catch (e) {
                          console.warn('Failed to increment invoice reprint count', e);
                        }
                      }
                      window.print();
                    }}
```
Replace with a write to each item document instead (permitted by B3b above), gated the same way this file already gates writes on `currentPermissions`:
```tsx
                  <button
                    onClick={async () => {
                      if (currentPermissions?.payments?.view === true) {
                        activeReceiptDrop.items.forEach(i => {
                          if (i.invoiceNumber && i._fsItemId) {
                            updateDoc(doc(db, 'orders', activeReceiptDrop.orderId, 'items', i._fsItemId), {
                              invoiceReprintCount: increment(1),
                            }).catch(e => console.error('Reprint-count bump failed (non-fatal)', e));
                          }
                        });
                      }
                      window.print();
                    }}
```
`increment` comes from `firebase/firestore` — add to the existing import line from that module if not already imported in this file.

### C2. `CustomerPortal.tsx` — wire in for the first time (never done)

**Add the same two locals**, computed alongside the existing `receiptTotal`/`receiptGroups`/etc. block (near where `orderIds` is computed):
```ts
const allInvoiced = receiptTarget.lines.every(l => !!l.item.invoiceNumber);
const invoiceRefDisplay = allInvoiced
  ? Array.from(new Set(receiptTarget.lines.map(l => l.item.invoiceNumber))).join(', ')
  : orderIds.join(', ');
const anyReprinted = receiptTarget.lines.some(l => (l.item.invoiceReprintCount || 0) > 0);
```

**Badge** — under the "Tax invoice"/"Receipt" label:
```tsx
                <p className="text-[10px] font-black uppercase text-primary tracking-widest mt-3">{vatOn ? 'Tax invoice' : 'Receipt'}</p>
                {anyReprinted && (
                  <p className="text-[10px] font-black uppercase text-amber-700 tracking-widest mt-1 border border-amber-300 bg-amber-50 rounded px-1.5 py-0.5 inline-block">
                    Duplicate / Reprint
                  </p>
                )}
```

**Invoice ref display** — current:
```tsx
                    <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-1">{orderIds.length > 1 ? 'Invoice refs' : 'Invoice ref'}</p>
                    <p className="font-mono text-slate-600">{orderIds.join(', ')}</p>
```
Replace the second line only:
```tsx
                    <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-1">{orderIds.length > 1 ? 'Invoice refs' : 'Invoice ref'}</p>
                    <p className="font-mono text-slate-600">{invoiceRefDisplay}</p>
```

**Bump on open** — the only call site that opens this receipt is `setReceiptTarget({ order: line.order, lines: paymentGroups.get(key) || [line] });`. Change to bump reprint counts right after setting the target:
```tsx
setReceiptTarget({ order: line.order, lines: paymentGroups.get(key) || [line] });
(paymentGroups.get(key) || [line]).forEach(l => {
  if (l.item.invoiceNumber && l.item._fsItemId) {
    updateDoc(doc(db, 'orders', l.order.id, 'items', l.item._fsItemId), {
      invoiceReprintCount: increment(1),
    }).catch(e => console.error('Reprint-count bump failed (non-fatal)', e));
  }
});
```
`increment` from `firebase/firestore` — add to this file's existing import from that module if not already present. This call is fire-and-forget (not awaited), matching Operations' version — a failed bump should never block the customer from seeing their receipt.

---

## What this rebuild deliberately does not do

Same non-goals as the original spec: no frozen money-breakdown snapshot at issuance (receipts still recompute live), no UI to view/edit `invoiceNumberCounter` directly, no retroactive numbering for anything issued under the reverted checkout-time mechanism or predating this feature entirely, no change to `cancelOrderItem`/refund logic.
