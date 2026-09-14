# Spec: Real invoice numbers at Mark Paid + reprint/duplicate marking

**Working Agreement: SLOW PATH.** This touches a new Cloud Function, `firestore.rules`, and the item write-path. Antigravity applies the diffs below exactly as written — do not re-derive the transaction logic or the rules predicate independently. UI-only pieces are marked "(fast-path detail)" and may be adapted to match surrounding style, but the data flow they call must not change.

**Depends on:** `receipt-parity-and-ledger-icons.md` should already be applied (this spec edits the same Operations.tsx receipt modal and Ledger row it introduced). If it isn't applied yet, apply it first, then this.

**Reference:** `BonManzE_InvoicingPaymentMethods_Scope.md` §5 and §8 (project doc) — this spec implements those sections. §8's open technical question is decided: a new Cloud Function, specifically a Firestore trigger (not a callable) — see "Why a trigger, not a callable" below.

---

## 0. Why a trigger, not a callable

§8 framed the choice as "(a) client-side `runTransaction`" vs. "(b) a new Cloud Function (`confirmPayment`)". Bhimal picked (b). Reading `functions/index.js` directly to implement it surfaced a better-fitting shape for (b) than a callable:

`onItemPaymentConfirmed` (existing, already shipped, `functions/index.js` line ~586) is a **Firestore trigger** (`onDocumentUpdated('orders/{orderId}/items/{itemId}', ...)`) that already fires exactly when an item's `paymentStatus` transitions into `'Paid'` — the same moment invoice issuance needs to happen — and already does trusted, transactional, server-side work in reaction to that transition (awarding loyalty points on the customer doc). It exists *because* `markPaid` is a plain client `writeBatch`, not a Cloud Function: the trigger is what makes the consequences of that client write trustworthy, without needing `markPaid` itself to become a callable.

Invoice numbering has the identical shape: a trusted, race-safe, server-side reaction to the same `paymentStatus → 'Paid'` transition. So this spec adds a **second, sibling trigger** on the same document path — a new Cloud Function, satisfying Bhimal's decision — rather than retiring `markPaid`'s client write in favor of a new callable. This is smaller, lower-risk (zero changes to the already-verified `markPaid`/`resetPaymentClaim` client code), and reuses a pattern already proven in this exact codebase rather than inventing a second one. If this reasoning doesn't hold up on review, the callable alternative is still fully described in the project doc's superseded open-question text and can be built instead — flag it back rather than silently doing something else.

---

## 1. `types.ts` — new fields

Add to `Entity` (after `bankReference`):
```ts
export interface Entity {
  id: string;
  name: string;
  brn: string;
  vatNumber: string;
  bankReference: string;
  invoicePrefix?: string;         // e.g. "INV-A" — set by staff in the Trading Entity form; no invoice numbers issue until this is set (see §3)
  invoiceNumberCounter?: number;  // internal running count, server-managed only — never written by any client code
  logoStoragePath?: string;
  active: boolean;
  createdAt: any;
  updatedAt: any;
}
```

Add to `OrderItem` (after `paymentResetAt`):
```ts
  // Set once, server-side only, by the issueInvoiceOnPayment Cloud Function
  // trigger (functions/index.js) the moment this item (or another item in
  // the same Mark Paid "drop") is first marked Paid. Never written by any
  // client code. Absent = this drop's invoice hasn't been issued yet (the
  // trigger hasn't landed) or the entity has no invoicePrefix configured —
  // both cases fall back to displaying the raw order/item id, same as an
  // item that predates this feature (see BonManzE_InvoicingPaymentMethods_Scope.md §6).
  invoiceNumber?: string;
  invoiceIssuedAt?: any;
  // Starts at 0 (set by the trigger alongside invoiceNumber). Incremented
  // by 1, client-side, every time a receipt view opens for an item that
  // already has an invoiceNumber — i.e. every view after the one that
  // first displayed it. 0 = original, never shown as a reprint; >0 = show
  // the REPRINT/DUPLICATE badge. See §4.
  invoiceReprintCount?: number;
```

No new `AuditLogType` needed — invoice issuance isn't a staff action, so it doesn't go through `writeAuditLog`.

---

## 2. `functions/index.js` — new trigger, `issueInvoiceOnPayment`

Insert this immediately after `onItemPaymentConfirmed` (i.e. after the closing `});` that currently sits at line ~640, before the `// Helper: Calculate net order total...` comment). Do not modify `onItemPaymentConfirmed` itself.

```js
// ============================================================================
// issueInvoiceOnPayment — Firestore trigger, sibling to onItemPaymentConfirmed
// above (same document path, same trigger event: paymentStatus transitions
// INTO 'Paid'). Separate function, not folded into onItemPaymentConfirmed,
// so this piece can be reviewed/rolled back independently of the
// already-verified loyalty-points trigger.
//
// Per BonManzE_InvoicingPaymentMethods_Scope.md §8: an order's real invoice
// number is issued at Mark Paid, not at checkout, because one Meal Plan
// order can be paid off across several separate Mark Paid actions (a
// "drop" — one order + one deliveryDate + one serviceSlot, matching
// DropTask in Operations.tsx). A single Mark Paid click can mark several
// items Paid at once (every item in one drop) — those items must share
// ONE invoice number, not one each. This trigger fires once per item, so
// it coordinates via a small per-drop assignment doc
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

  // Same drop-key shape as DropTask in Operations.tsx
  // (`${orderId}-${deliveryDate}-${serviceSlot}`), reconstructed here from
  // fields already frozen onto the item at checkout — no new field needed
  // on the item, and no dependency on markPaid's client code at all.
  const deliveryDate = after.deliveryDate || 'none';
  const serviceSlot = after.serviceSlot || 'none';
  const dropDocId = `${deliveryDate}__${serviceSlot}`.replace(/[/\s]+/g, '_');

  const itemRef = event.data.after.ref;
  const entityRef = db.collection('entities').doc(entityId);
  const assignmentRef = db.collection('orders').doc(orderId).collection('invoiceAssignments').doc(dropDocId);

  await db.runTransaction(async (tx) => {
    // Re-read the item inside the transaction: if a previous invocation of
    // this same trigger (redelivery) already set invoiceNumber since the
    // outer check above ran, stop — never re-issue.
    const itemSnapNow = await tx.get(itemRef);
    if (!itemSnapNow.exists || itemSnapNow.data().invoiceNumber) return;

    const assignmentSnap = await tx.get(assignmentRef);
    let invoiceNumber, invoiceIssuedAt;

    if (assignmentSnap.exists) {
      // Another item in the same drop already minted this drop's number —
      // reuse it, no counter increment.
      const a = assignmentSnap.data();
      invoiceNumber = a.invoiceNumber;
      invoiceIssuedAt = a.invoiceIssuedAt;
    } else {
      const entitySnap = await tx.get(entityRef);
      if (!entitySnap.exists) return;
      const entity = entitySnap.data();
      const prefix = entity.invoicePrefix;
      if (!prefix || typeof prefix !== 'string' || !prefix.trim()) {
        // Entity has no invoicePrefix configured yet — per §6 (no
        // retroactive/invented numbering), skip. Receipt falls back to the
        // raw order id, same as before this feature existed.
        return;
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

Notes for review:
- `invoiceAssignments` is a new subcollection under `orders/{orderId}`, written only by this trigger via the Admin SDK (which bypasses `firestore.rules` entirely, same as every other Admin SDK write in this file) — see §3 for the explicit deny rule to add anyway, matching this codebase's existing style of documenting Cloud-Function-only paths rather than leaving them merely unreachable.
- This does not touch `onItemPaymentConfirmed`, `markPaid`, or `resetPaymentClaim` at all. `cancelOrderItem`/refund logic is unaffected — an item cancelled or refunded after invoicing keeps its already-issued `invoiceNumber` (no retraction logic here; not asked for, and retracting an issued invoice number is a bigger question than this scope covers).
- Items with no `deliveryDate`/`serviceSlot` (shouldn't currently occur for anything `confirmCheckout` creates, since it only handles `'Delivery'`/`'Meal Plan'` orders, both of which always set these) fall into a single `none__none` drop per order — harmless, but flag to Antigravity if any current data path creates entity-owned items without these fields, since that would silently share one invoice number across unrelated items.

---

## 3. `firestore.rules` — two changes

**3a. Explicit deny for the new internal collection**, added right after the existing `items` match block (after its closing `}` around line 292, before "Everything else stays locked down by default"):

```
    // invoiceAssignments/{dropDocId} — internal bookkeeping for
    // issueInvoiceOnPayment (functions/index.js), written only via the
    // Admin SDK inside a transaction. No client, staff or customer, ever
    // reads or writes this directly — the item's own invoiceNumber field is
    // the public-facing copy. Explicit deny, matching how orders/{orderId}
    // documents its Cloud-Function-only paths above rather than leaving
    // this only implicitly unreachable.
    match /orders/{orderId}/invoiceAssignments/{dropDocId} {
      allow read, write: if false;
    }
```

**3b. New OR-branch on the `items` update rule**, so staff can bump `invoiceReprintCount` on an already-Paid item without also having to touch a payment field (today's "Payment edit" branch requires `paymentStatus`/`paymentMethodName`/`paymentReference` to be the thing that changed — a reprint-count-only write matches neither existing staff branch and is currently rejected). Add as a new `) || (` branch inside the existing `isPartnerEntityAllowed(...) && (...)` group for `match /{path=**}/items/{itemId}`, after branch 2 ("Customer update (pay claim)") and before the closing `);`:

```
        ) || (
          // 3. Reprint-count bump (Operations Payments/paid-history view or
          // the Transactions Ledger re-opening an already-issued receipt).
          // The only field this branch may touch is invoiceReprintCount;
          // every other field — including invoiceNumber/invoiceIssuedAt
          // themselves, which only issueInvoiceOnPayment's Admin SDK write
          // may set — must stay exactly as-is. Gated on 'payments','view'
          // rather than 'edit': this is a read-triggered bookkeeping bump,
          // not a payment action, and every surface that can open this
          // receipt already requires 'payments','view' to get there.
          isStaffAllowed('payments', 'view')
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

No rules change is needed for the **customer's own** reprint-count bump (CustomerPortal viewing their own receipt): the existing "2. Customer update (pay claim)" branch pins a specific field list and does not restrict fields outside it, so `invoiceReprintCount` already passes through there today, the same way `paymentResetAt` did before any rule existed for it. Confirm this by re-reading that branch before assuming — don't add a redundant branch for it.

No rules change is needed for `entities/{entityId}.invoiceNumberCounter`/`invoicePrefix` either: `invoicePrefix` is edited by staff through the existing `isStaffAllowed('tradingEntities','edit')` whole-document write rule (see the entity-contact-fields spec), and `invoiceNumberCounter` is only ever touched by the trigger's Admin SDK transaction above, which bypasses rules entirely — do not add a field-level rule attempting to block client writes to it; it's unreachable from any client code path once §1's `types.ts` comment is followed (no UI reads/writes it directly).

---

## 4. Receipt display: fallback, and the REPRINT/DUPLICATE badge

Applies to **all three** receipt-rendering surfaces: `CustomerPortal.tsx`'s receipt modal (`receiptTarget`), `Operations.tsx`'s Payments-tab receipt modal (`activeReceiptDrop`, from `receipt-parity-and-ledger-icons.md`), and the Ledger's reprint view (same modal, opened via the new Ledger icon from that same spec).

**4a. Display rule.** Wherever "Invoice ref"/"Invoice refs" currently prints `orderIds.join(', ')` (CustomerPortal, ~line 3524) or the item's raw id (Operations receipt modal, per `receipt-parity-and-ledger-icons.md`), change to: show the item's `invoiceNumber` when every line in the receipt has one; otherwise fall back to the existing raw-id display exactly as today (mixed state — some lines invoiced, some not — should be rare/nonexistent in practice since same-drop items are issued together, but don't crash on it; fall back to raw ids for the whole receipt if any line lacks a number, don't show a partial mix).

```tsx
const allInvoiced = receiptTarget.lines.every(l => !!l.item.invoiceNumber);
const invoiceRefDisplay = allInvoiced
  ? Array.from(new Set(receiptTarget.lines.map(l => l.item.invoiceNumber))).join(', ')
  : orderIds.join(', ');
```
(fast-path detail: adapt variable naming to whatever the surrounding block already uses — CustomerPortal's `orderIds`/`receiptGroups` locals vs. Operations' `activeReceiptDrop.items`/`breakdowns` locals are named differently; the logic is what must match, not the exact variable names.)

**4b. REPRINT/DUPLICATE badge.** Show directly under the "Tax invoice"/"Receipt" label (CustomerPortal ~line 3500; Operations receipt modal, equivalent spot per `receipt-parity-and-ledger-icons.md`'s parity fix) when any line's `invoiceReprintCount > 0`:

```tsx
{receiptTarget.lines.some(l => (l.item.invoiceReprintCount || 0) > 0) && (
  <p className="text-[10px] font-black uppercase text-amber-600 tracking-widest mt-1 border border-amber-300 bg-amber-50 rounded px-1.5 py-0.5 inline-block">
    Reprint / Duplicate
  </p>
)}
```
(fast-path detail: colors/exact classes may be adapted to match the app's existing badge/tag styling — e.g. the "wasReset" tag style already shipped in Operations.tsx — as long as it's visually unmistakable from the normal receipt header, not the same weight as body text.)

**4c. Incrementing the count.** Fire once, when the receipt view opens — not on every re-render. Use Firestore's atomic `increment(1)` (import from `firebase/firestore`), and only for lines that already have an `invoiceNumber` (nothing to mark as a reprint before the original has actually been issued):

```ts
import { increment } from 'firebase/firestore';

// Call this from the handler that OPENS the receipt (setReceiptTarget(...)
// in CustomerPortal.tsx; setActiveReceiptDrop(...) in Operations.tsx and
// the new Ledger icon handler from receipt-parity-and-ledger-icons.md) —
// not from a render-time effect, so it fires exactly once per open, not
// once per re-render while the modal is displayed.
const bumpReprintCountOnOpen = (orderId: string, lines: { item: OrderItem }[]) => {
  lines.forEach(l => {
    if (l.item.invoiceNumber && l.item._fsItemId) {
      updateDoc(doc(db, 'orders', orderId, 'items', l.item._fsItemId), {
        invoiceReprintCount: increment(1),
      }).catch(e => console.error('Reprint-count bump failed (non-fatal)', e));
    }
  });
};
```
Call this immediately after setting the modal's open-state, using the value being rendered (i.e. the badge in 4b reflects the count as it was *before* this call's increment lands — the view that first shows `invoiceReprintCount === 0` never shows the badge, and only the next open shows it). Do not await this call or block the modal opening on it; a failure here should never prevent someone from seeing/printing a receipt (hence `.catch` swallowing to a console log only, matching how non-critical writes elsewhere in this codebase — e.g. `writeAuditLog` calls — are treated as best-effort).

For Operations/Ledger, gate this the same way the underlying write is gated by `firestore.rules` §3b — i.e. only attempt it when `currentPermissions?.payments?.view === true` (skip silently otherwise; the rule would reject it anyway, and this avoids a console error for a viewer who technically shouldn't be here at all, matching this codebase's existing pattern of checking `currentPermissions` before attempting writes rather than depending on rules alone to fail closed).

---

## 5. What this spec deliberately does not do

- Does not freeze a full snapshot of subtotal/discount/vat/total at issuance time — §8(3) in the project doc flags this as the eventual direction (a truly immutable invoice) but explicitly not required to ship (1)+(2). Both receipts still recompute the money breakdown live from the order/item's current data every time they're opened; only the invoice number itself and the reprint marker are now frozen/tracked.
- Does not add any UI for staff to view or edit an entity's `invoiceNumberCounter` — it's internal and server-managed only, per §1's comment. `invoicePrefix` is the only new entity field staff set directly (covered in the entity-contact-fields spec, since it shares the same Trading Entity form edit).
- Does not touch `cancelOrderItem` or any refund path — an invoice, once issued, is not un-issued by a later cancellation/refund on the same item.
