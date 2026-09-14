# Fix: "Send back" leaves no trace — nothing shows a claim was reset

Slow-path (money-handling write path — author verbatim, do not paraphrase).
Touches `types.ts`, `modules/Operations.tsx`, and `modules/CustomerPortal.tsx`.
No `firestore.rules` change needed — see "Why no rules change" below.

## The gap

After using the just-shipped "Send back" button (commit `20c044a`), the item
just reverts to looking exactly like one nobody has ever touched — no
"Customer claimed" tag (correct, there's no claim anymore), but also nothing
showing staff *did* just reset it. Bhimal's ask: either a tag/alert saying
the payment was sent back to the customer, or the "Send back" button itself
staying visible in a greyed-out "Re-Sent" state. Implementing both, since
they reinforce each other and the cost is small.

## The fix

Add a `paymentResetAt` timestamp field to the item, written by
`resetPaymentClaim` (mirrors how `markPaid` doesn't just flip a status but
also leaves a trail) and cleared by the customer's own `commitPayment` once
they re-claim a method (so the "sent back" state doesn't linger once it's
been acted on). The Payments console derives a `wasReset` flag per drop from
it and uses that to show the tag / swap the button.

### 1. `types.ts` — new field on `OrderItem` (~line 158-163)

**Current:**
```ts
  paymentStatus?: 'Paid' | 'Pending' | 'Refunded'; 
  status?: 'Active' | 'Preparing' | 'Cancelled' | 'Ready' | 'En route' | 'Delivered' | 'Completed';
  isReconciled?: boolean;
  paymentMethodName?: string;
  paymentReference?: string;
```

**Change to:**
```ts
  paymentStatus?: 'Paid' | 'Pending' | 'Refunded'; 
  status?: 'Active' | 'Preparing' | 'Cancelled' | 'Ready' | 'En route' | 'Delivered' | 'Completed';
  isReconciled?: boolean;
  paymentMethodName?: string;
  paymentReference?: string;
  // Set by Operations' "Send back" action (resetPaymentClaim) when a
  // claimed-but-unconfirmed payment is reset so the customer can pick a
  // method again; cleared by the customer's own commitPayment once they
  // re-claim. Lets the Payments console show "sent back, awaiting the
  // customer" instead of the item silently looking untouched.
  paymentResetAt?: any;
```

### 2. `modules/Operations.tsx` — import `serverTimestamp` (~line 48)

**Current:**
```ts
import { doc, getDoc, setDoc, deleteDoc, collection, collectionGroup, onSnapshot, writeBatch, updateDoc, Timestamp, query, where, limit, getDocs } from 'firebase/firestore';
```

**Change to:**
```ts
import { doc, getDoc, setDoc, deleteDoc, collection, collectionGroup, onSnapshot, writeBatch, updateDoc, Timestamp, query, where, limit, getDocs, serverTimestamp } from 'firebase/firestore';
```

### 3. `modules/Operations.tsx` — `DropTask` gets a `wasReset` flag (~line 256-272)

**Current:**
```jsx
interface DropTask {
  key: string;
  orderId: string;
  customerName: string;
  date?: string;
  slot?: string;
  items: FsOrderItem[];
  total: number;
  paymentStatus: 'Paid' | 'Pending' | 'Refunded';
  // What the customer told the app when they picked a payment method —
  // a claim, not a confirmed payment. Lets Operations match a Juice/MauCAS
  // transfer against a bank/wallet statement before confirming.
  claimedMethod?: string;
  claimedReference?: string;
  entityId?: string;
  entityName?: string;
}
```

**Change to:**
```jsx
interface DropTask {
  key: string;
  orderId: string;
  customerName: string;
  date?: string;
  slot?: string;
  items: FsOrderItem[];
  total: number;
  paymentStatus: 'Paid' | 'Pending' | 'Refunded';
  // What the customer told the app when they picked a payment method —
  // a claim, not a confirmed payment. Lets Operations match a Juice/MauCAS
  // transfer against a bank/wallet statement before confirming.
  claimedMethod?: string;
  claimedReference?: string;
  // True when a claim on this drop was sent back (resetPaymentClaim) and
  // the customer hasn't re-claimed a method since — lets the Payments
  // console show that distinctly from "never claimed at all".
  wasReset?: boolean;
  entityId?: string;
  entityName?: string;
}
```

### 4. `modules/Operations.tsx` — derive `wasReset` in `paymentDrops` (~line 1580-1587)

**Current:**
```jsx
        map[key].items.push(item);
        map[key].total += itemNetAmount(o, item);
        if (item.paymentStatus === 'Pending') map[key].paymentStatus = 'Pending';
        if (item.paymentStatus !== 'Paid' && item.paymentMethodName && !map[key].claimedMethod) {
          map[key].claimedMethod = item.paymentMethodName;
          map[key].claimedReference = item.paymentReference;
        }
      });
```

**Change to:**
```jsx
        map[key].items.push(item);
        map[key].total += itemNetAmount(o, item);
        if (item.paymentStatus === 'Pending') map[key].paymentStatus = 'Pending';
        if (item.paymentStatus !== 'Paid' && item.paymentMethodName && !map[key].claimedMethod) {
          map[key].claimedMethod = item.paymentMethodName;
          map[key].claimedReference = item.paymentReference;
        }
        if (item.paymentStatus !== 'Paid' && !item.paymentMethodName && item.paymentResetAt) {
          map[key].wasReset = true;
        }
      });
```

### 5. `modules/Operations.tsx` — `resetPaymentClaim` writes the timestamp (~line 1804-1807)

**Current:**
```jsx
        batch.update(doc(db, 'orders', drop.orderId, 'items', i._fsItemId as string), {
          paymentMethodName: null,
          paymentReference: null,
        });
```

**Change to:**
```jsx
        batch.update(doc(db, 'orders', drop.orderId, 'items', i._fsItemId as string), {
          paymentMethodName: null,
          paymentReference: null,
          paymentResetAt: serverTimestamp(),
        });
```

### 6. `modules/Operations.tsx` — the tag and the button (~line 6619-6645)

**Current:**
```jsx
                              <p className="text-sm font-black text-primary mt-1">{formatCurrency(drop.total)}</p>
                              {drop.claimedMethod && (
                                <p className="text-[11px] text-[#B4703A] font-bold mt-1 bg-[#B4703A]/5 px-2.5 py-1 rounded-lg border border-[#B4703A]/10 inline-block">
                                  Customer claimed: {drop.claimedMethod}{drop.claimedReference ? ` (Ref: ${drop.claimedReference})` : ''}
                                </p>
                              )}
                            </div>
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

**Change to (new tag branch for `wasReset`; the Send-back button becomes a
three-way branch — active when there's a live claim, a disabled "Re-Sent"
state when it was reset and nothing's been claimed since, hidden otherwise):**
```jsx
                              <p className="text-sm font-black text-primary mt-1">{formatCurrency(drop.total)}</p>
                              {drop.claimedMethod && (
                                <p className="text-[11px] text-[#B4703A] font-bold mt-1 bg-[#B4703A]/5 px-2.5 py-1 rounded-lg border border-[#B4703A]/10 inline-block">
                                  Customer claimed: {drop.claimedMethod}{drop.claimedReference ? ` (Ref: ${drop.claimedReference})` : ''}
                                </p>
                              )}
                              {!drop.claimedMethod && drop.wasReset && (
                                <p className="text-[11px] text-slate-500 font-bold mt-1 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 inline-block">
                                  ↩ Sent back to customer — awaiting new payment method
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => setActivePrintDrop(drop)}
                                className="px-4 py-3 bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95 transition-all rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 cursor-pointer"
                                title="Print order ticket"
                              >
                                <Printer className="size-4" /> Print
                              </button>
                              {drop.claimedMethod ? (
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
                              ) : drop.wasReset ? (
                                <button
                                  type="button"
                                  disabled
                                  className="px-4 py-3 bg-slate-100 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 cursor-default opacity-70"
                                  title="Sent back to the customer — waiting for them to pick a payment method again."
                                >
                                  <RefreshCw className="size-4" /> Re-Sent
                                </button>
                              ) : null}
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

### 7. `modules/CustomerPortal.tsx` — clear it on re-claim (~line 1586-1594)

**Current:**
```jsx
      if (realTargets.length > 0) {
        const batch = writeBatch(db);
        realTargets.forEach(t => {
          batch.update(doc(db, 'orders', t.orderId, 'items', t.fsItemId as string), {
            paymentMethodName: payMethod.name,
            paymentReference: finalRef,
          });
        });
        await batch.commit();
      }
```

**Change to:**
```jsx
      if (realTargets.length > 0) {
        const batch = writeBatch(db);
        realTargets.forEach(t => {
          batch.update(doc(db, 'orders', t.orderId, 'items', t.fsItemId as string), {
            paymentMethodName: payMethod.name,
            paymentReference: finalRef,
            paymentResetAt: null,
          });
        });
        await batch.commit();
      }
```

## Why no rules change

`firestore.rules`'s `orders/{orderId}/items/{itemId}` update rule (the
"Payment edit" clause for staff, and the "Customer update (pay claim)"
clause) is a blocklist — it only pins specific fields to stay equal
(`price`, `qty`, `status`, etc.); anything not named, `paymentResetAt`
included, is free to change under both clauses exactly like
`paymentMethodName`/`paymentReference` already are. No rule edit needed.

## After applying

- `npx tsc --noEmit` and `npm run build`.
- Re-run the same order this whole thread has been testing on: claim Cash
  on Delivery as the customer, click **Send back** in Operations — the
  claimed-tag should be replaced by "↩ Sent back to customer — awaiting new
  payment method," and the button area should show a greyed, disabled
  **Re-Sent** in place of the live "Send back" button.
- As the customer, pick a payment method again on that same meal — back in
  Operations, the tag/button should flip straight back to the live
  "Customer claimed: ..." + active "Send back" state (not show both at
  once).
- Confirm an item that was never claimed (and never reset) still shows
  neither tag nor button, same as before this change.
