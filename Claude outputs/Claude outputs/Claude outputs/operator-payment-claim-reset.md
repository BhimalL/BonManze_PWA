# Feature: let staff send an unpaid claim back to the customer ("Reset")

Slow-path (money-handling write path — author verbatim, do not paraphrase).
Touches `types.ts` and `modules/Operations.tsx` only. No `firestore.rules`
change needed — see "Why no rules change" below.

## The gap

Today the Payments console (Operations → Payments tab) only has one action
on an unpaid item: **Mark Paid**. If a customer claims a payment method
(e.g. "Cash on Delivery") but then never actually pays — a no-show, cash
never handed over, a transfer that's never sent — that item sits in
"Customer claimed: ..." limbo forever. There is no way to clear the claim
and let the customer pick a method again; the only workaround today is
editing Firestore directly.

Bhimal hit this concretely: he wants to re-test the just-shipped payment
proration fix (commit `9e80597`, Rs 210 → Rs 227.01) on the same live order
`Avi Kooshee · Veg Cari Creole`, which already has a claimed "Cash on
Delivery" reference (`BMZ-PAY-449218`) sitting in Pending. He needs a way to
send that claim back so the customer can re-pay through the corrected flow.

## The fix

Add a **"Send back"** action, the mirror of `markPaid`: it clears
`paymentMethodName`/`paymentReference` on the claimed item(s), returning them
to fully Unclaimed (exactly what `CustomerPortal.tsx`'s `isUnclaimed` checks
for), and logs an audit entry. It only ever acts on items that are claimed
but not yet confirmed (`paymentStatus !== 'Paid' && paymentMethodName` set) —
an item already marked Paid needs a refund/reversal workflow, which is a
separate, bigger decision and deliberately out of scope here.

### 1. `types.ts` — add a new audit log type (~line 251-257)

**Current:**
```ts
export type AuditLogType =
  | 'ConfigChange'
  | 'RoleChange'
  | 'RegistrationDecision'
  | 'EntityReassignment'
  | 'PaymentConfirmed'
  | 'DeliveryConfirmed';
```

**Change to:**
```ts
export type AuditLogType =
  | 'ConfigChange'
  | 'RoleChange'
  | 'RegistrationDecision'
  | 'EntityReassignment'
  | 'PaymentConfirmed'
  | 'PaymentClaimReset'
  | 'DeliveryConfirmed';
```

### 2. `modules/Operations.tsx` — new pending-state (~line 398)

**Current:**
```jsx
  const [pendingPaymentKey, setPendingPaymentKey] = useState<string | null>(null);
  const [opsActionError, setOpsActionError] = useState<string | null>(null);
```

**Change to:**
```jsx
  const [pendingPaymentKey, setPendingPaymentKey] = useState<string | null>(null);
  const [pendingResetPaymentKey, setPendingResetPaymentKey] = useState<string | null>(null);
  const [opsActionError, setOpsActionError] = useState<string | null>(null);
```

### 3. `modules/Operations.tsx` — new `resetPaymentClaim` function, right after `markPaid` (~line 1779, after its closing `};`)

**Insert (new function, immediately after `markPaid`'s closing brace and before
the `// --- Meal Library` comment):**
```jsx

  // The mirror of markPaid: sends a claimed-but-unconfirmed payment back to
  // the customer so they can pick a method again — for when a customer
  // claims a method (e.g. Cash on Delivery) but never actually pays. Only
  // ever targets items that are still Pending with a claimed method; an
  // item already confirmed Paid needs a refund/reversal flow, not this, so
  // it's deliberately excluded here rather than silently un-doing a
  // confirmed payment.
  const resetPaymentClaim = async (drop: DropTask) => {
    if (currentPermissions?.payments?.edit !== true) {
      setOpsActionError('Access Denied: You do not have permission to reset payments.');
      return;
    }
    const targets = drop.items.filter(i => !!i._fsItemId && i.paymentStatus !== 'Paid' && !!i.paymentMethodName);
    if (targets.length === 0) {
      setOpsActionError('Nothing to reset — no claimed, unconfirmed items found on this order.');
      return;
    }
    setOpsActionError(null);
    setPendingResetPaymentKey(drop.key);
    try {
      const batch = writeBatch(db);
      targets.forEach(i => {
        batch.update(doc(db, 'orders', drop.orderId, 'items', i._fsItemId as string), {
          paymentMethodName: null,
          paymentReference: null,
        });
      });
      await batch.commit();
      writeAuditLog('PaymentClaimReset', `Reset payment claim (was ${drop.claimedMethod || 'unknown'}${drop.claimedReference ? `, ref ${drop.claimedReference}` : ''}) for ${targets.length} item(s), order ${drop.orderId} (${drop.customerName}) — sent back to customer for re-processing`);
    } catch (e) {
      console.error('Reset payment claim failed', e);
      setOpsActionError('Could not reset this payment claim — please try again.');
    } finally {
      setPendingResetPaymentKey(null);
    }
  };
```

### 4. `modules/Operations.tsx` — new "Send back" button next to Mark Paid (~line 6587-6605)

**Current:**
```jsx
                            <div className="flex items-center gap-2.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => setActivePrintDrop(drop)}
                                className="px-4 py-3 bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95 transition-all rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 cursor-pointer"
                                title="Print order ticket"
                              >
                                <Printer className="size-4" /> Print
                              </button>
                              <button
                                type="button"
                                onClick={() => setPaymentDrop(drop)}
                                disabled={pendingPaymentKey === drop.key}
                                className="px-6 py-3 bg-warning text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-warning/95 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait cursor-pointer"
                              >
                                {pendingPaymentKey === drop.key ? <Loader2 className="size-4 animate-spin" /> : <Banknote className="size-4" />}
                                {pendingPaymentKey === drop.key ? 'Marking...' : 'Mark Paid'}
                              </button>
                            </div>
```

**Change to (new button inserted between Print and Mark Paid, only shown
when there's an actual claim to reset):**
```jsx
                            <div className="flex items-center gap-2.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => setActivePrintDrop(drop)}
                                className="px-4 py-3 bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95 transition-all rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 cursor-pointer"
                                title="Print order ticket"
                              >
                                <Printer className="size-4" /> Print
                              </button>
                              {drop.claimedMethod && (
                                <button
                                  type="button"
                                  onClick={() => resetPaymentClaim(drop)}
                                  disabled={pendingResetPaymentKey === drop.key}
                                  className="px-4 py-3 bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95 transition-all rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-wait cursor-pointer"
                                  title="Send back to the customer to pick a payment method again — use this if they claimed a method but never actually paid."
                                >
                                  {pendingResetPaymentKey === drop.key ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                                  {pendingResetPaymentKey === drop.key ? 'Resetting...' : 'Send back'}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setPaymentDrop(drop)}
                                disabled={pendingPaymentKey === drop.key}
                                className="px-6 py-3 bg-warning text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-warning/95 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait cursor-pointer"
                              >
                                {pendingPaymentKey === drop.key ? <Loader2 className="size-4 animate-spin" /> : <Banknote className="size-4" />}
                                {pendingPaymentKey === drop.key ? 'Marking...' : 'Mark Paid'}
                              </button>
                            </div>
```

`RefreshCw` and `Loader2` are both already imported from `lucide-react` in
this file (used elsewhere, e.g. the "Sync with Library" button and various
loading spinners) — no new import needed.

## Why no `firestore.rules` change

Already covered by the existing "Payment edit" clause (`firestore.rules`,
the `orders/{orderId}/items/{itemId}` update rule, ~line 244-253): any
combination of `paymentStatus`/`paymentMethodName`/`paymentReference`
changes is allowed for staff with `payments.edit`, as long as the delivery
`status` field is untouched — which is exactly what this write does (only
those two fields change, set to `null`; `paymentStatus` is left as `Pending`,
`status` isn't touched at all). Setting a field to `null` via `batch.update`
(rather than deleting it) is enough to make `!item.paymentMethodName` /
`isUnclaimed` true again in `CustomerPortal.tsx`, since both already treat a
falsy value the same as absent.

## After applying

- `npx tsc --noEmit` and `npm run build`.
- Manual check, using the exact order this was built for: open Operations →
  Payments, find `Avi Kooshee · Veg Cari Creole` (claimed Cash on Delivery,
  ref `BMZ-PAY-449218`), click **Send back** — the "Customer claimed: ..."
  line and the button should disappear (item is Unclaimed again), and an
  audit log entry should appear (Settings → wherever the audit log is
  surfaced, or `auditLog` collection in the emulator) with type
  `PaymentClaimReset`. Then, as the customer, open that meal's Pay sheet
  again and confirm it now shows the corrected Rs 227.01 (proration fix from
  `customer-payment-amount-proration-fix.md`), pick Cash on Delivery again,
  and confirm the Payments console shows the new claim with the right
  amount.
- Confirm clicking **Mark Paid** still works unaffected on an item that
  hasn't been reset, and that **Send back** does not appear at all on items
  with no claim yet (nothing to reset).
