# Fix: Pay sheet quotes the pre-discount, pre-VAT price instead of the order's real total

Slow-path (money-handling / payment-amount calculation — author verbatim, do not
paraphrase). Touches only `modules/CustomerPortal.tsx`. No `firestore.rules`,
Cloud Function, or schema change — this only changes what number is computed
and displayed/quoted to the customer; `commitPayment`'s actual Firestore write
(`paymentMethodName` / `paymentReference` only) is untouched.

## Root cause

Live test (2026-09-14): a customer's order had `order.subtotal = 210`,
`order.discount`, `order.vat`, and `order.total = 227.01` (confirmed correct —
this is what the order's own totals block on the same screen already shows,
`modules/CustomerPortal.tsx` ~2676-2697). But the Pay sheet — for a single
meal, for "Pay order," and for "Pay balance" — showed **Rs 210**, not
Rs 227.01. Selecting Cash on Delivery then quotes/collects the wrong (lower)
amount, which is a real problem: it's the actual number a customer transfers
or a driver is told to collect in cash.

The cause: `openPayItem`, `openPayBalance`, and `openPayOrder` (and, for
display, the `outstandingTotal` "Pay balance" figure and each order card's
"Pay order · Rs X" button label) all compute their amount as a raw
`item.qty * item.price` sum — the pre-discount, pre-VAT per-item sticker
price. `order.discount` and `order.vat` are computed once per whole order by
`confirmCheckout`, never per item, so summing raw item prices silently drops
both. Meanwhile `commitPayment` never actually writes an amount to Firestore
for real items (only `paymentMethodName`/`paymentReference`) — so today this
is purely a wrong-number-shown-to-the-customer bug, not yet a corrupted
stored value, but it's still the number that gets transferred or collected.

## Policy (confirmed with Bhimal, 2026-09-14)

Both of the following must work, correctly reflecting discount + VAT:

1. **Partial / per-item payment stays allowed** — a customer can order for a
   week and pay cash on delivery per item, one meal at a time.
2. **Whole-order-in-one-shot payment must also be supported** — paying the
   entire order's real `order.total` in a single action.

Since discount and VAT are order-level, not item-level, a partial payment
needs its own item's *prorated* share of the order's total; a payment that
happens to cover 100% of an order's remaining items should just charge that
order's own `order.total` directly (exact, zero rounding drift, and it will
always match the number the order's own totals block already shows on the
same screen).

## The fix

**Where:** `modules/CustomerPortal.tsx`, six spots, all inside the
`CustomerPortal` component.

### 1. New helpers — insert immediately before the `outstandingTotal` block (~line 1436)

`Line` (from `interface Line { order: Order; item: FsOrderItem; }`, line 1355)
is already in scope at this point in the file, so these can reference it
directly with no other type changes needed.

**Insert (as a new block, right before the existing `// "Outstanding" now
means...` comment and `outstandingTotal` useMemo):**
```jsx
  // A per-order "effective rate" that folds this order's discount + VAT into
  // one multiplier — order.total ÷ order.subtotal — so a customer paying for
  // only some of an order's meals still pays their real share of that order
  // (discount and VAT are computed once per whole order by confirmCheckout,
  // never per item). Falls back to 1 (no proration) for legacy orders that
  // predate the subtotal/discount/vat fields — same `has` guard already used
  // in the order-totals display block further down this screen.
  const orderProrationFactor = (order: Order): number => {
    const hasFinancials = typeof order.subtotal === 'number' && order.subtotal > 0;
    return hasFinancials ? order.total / (order.subtotal as number) : 1;
  };

  const round2 = (n: number) => Math.round(n * 100) / 100;

  // Turns a set of pending (unclaimed) lines into the write targets
  // (payTarget.items) and the one number actually shown/collected
  // (payTarget.amount) — grouped by order:
  //  - when every one of an order's non-cancelled items is in this pending
  //    set, that order's own order.total is charged directly for its share
  //    — exact, no rounding drift, and matches the number already shown in
  //    that order's own totals block further down this screen;
  //  - otherwise (some of the order's meals are already paid/claimed, or
  //    belong to a different week's group than the one being paid right
  //    now), only the pending subset is charged, prorated by that order's
  //    own orderProrationFactor.
  const buildPayItemsAndAmount = (pending: Line[]) => {
    const items = pending.map(l => ({
      orderId: l.order.id,
      date: l.item.deliveryDate || '',
      slot: l.item.serviceSlot || 'Lunch',
      amount: round2(l.item.qty * l.item.price * orderProrationFactor(l.order)),
      fsItemId: l.item._fsItemId,
    }));

    const byOrder = new Map<string, Line[]>();
    pending.forEach(l => {
      if (!byOrder.has(l.order.id)) byOrder.set(l.order.id, []);
      byOrder.get(l.order.id)!.push(l);
    });

    let amount = 0;
    byOrder.forEach(orderLines => {
      const order = orderLines[0].order;
      const activeOrderItemCount = order.items.filter(it => it.status !== 'Cancelled').length;
      const wholeOrderPending = orderLines.length === activeOrderItemCount;
      amount += wholeOrderPending
        ? order.total
        : orderLines.reduce((t, l) => t + round2(l.item.qty * l.item.price * orderProrationFactor(l.order)), 0);
    });

    return { items, amount: round2(amount) };
  };

```

### 2. `outstandingTotal` (~line 1439-1442)

**Current:**
```jsx
  const outstandingTotal = useMemo(
    () => thisWeekLines.filter(l => l.item.status !== 'Cancelled' && isUnclaimed(l.item)).reduce((t, l) => t + l.item.qty * l.item.price, 0),
    [thisWeekLines]
  );
```

**Change to:**
```jsx
  const outstandingTotal = useMemo(
    () => buildPayItemsAndAmount(thisWeekLines.filter(l => l.item.status !== 'Cancelled' && isUnclaimed(l.item))).amount,
    [thisWeekLines]
  );
```

### 3. `openPayItem` (~line 1459-1473)

**Current:**
```jsx
  const openPayItem = (line: Line) => {
    setPayMethod(null);
    setCustomerRef('');
    setPaymentError(null);
    setPayTarget({
      kind: 'item',
      orderId: line.order.id,
      date: line.item.deliveryDate || '',
      slot: line.item.serviceSlot || 'Lunch',
      amount: line.item.qty * line.item.price,
      what: `${line.item.deliveryDay || ''} · ${line.item.name}`,
      ref: generateRef(),
      fsItemId: line.item._fsItemId,
    });
  };
```

**Change to (only the `amount:` line changes):**
```jsx
  const openPayItem = (line: Line) => {
    setPayMethod(null);
    setCustomerRef('');
    setPaymentError(null);
    setPayTarget({
      kind: 'item',
      orderId: line.order.id,
      date: line.item.deliveryDate || '',
      slot: line.item.serviceSlot || 'Lunch',
      amount: round2(line.item.qty * line.item.price * orderProrationFactor(line.order)),
      what: `${line.item.deliveryDay || ''} · ${line.item.name}`,
      ref: generateRef(),
      fsItemId: line.item._fsItemId,
    });
  };
```

### 4. `openPayBalance` (~line 1475-1488)

**Current:**
```jsx
  const openPayBalance = () => {
    const pending = thisWeekLines.filter(l => isUnclaimed(l.item));
    if (!pending.length) return;
    setPayMethod(null);
    setCustomerRef('');
    setPaymentError(null);
    setPayTarget({
      kind: 'balance',
      items: pending.map(l => ({ orderId: l.order.id, date: l.item.deliveryDate || '', slot: l.item.serviceSlot || 'Lunch', amount: l.item.qty * l.item.price, fsItemId: l.item._fsItemId })),
      amount: pending.reduce((t, l) => t + l.item.qty * l.item.price, 0),
      what: `${pending.length} unpaid meal${pending.length !== 1 ? 's' : ''} · full balance`,
      ref: generateRef()
    });
  };
```

**Change to:**
```jsx
  const openPayBalance = () => {
    const pending = thisWeekLines.filter(l => isUnclaimed(l.item));
    if (!pending.length) return;
    setPayMethod(null);
    setCustomerRef('');
    setPaymentError(null);
    const { items, amount } = buildPayItemsAndAmount(pending);
    setPayTarget({
      kind: 'balance',
      items,
      amount,
      what: `${pending.length} unpaid meal${pending.length !== 1 ? 's' : ''} · full balance`,
      ref: generateRef()
    });
  };
```

### 5. `openPayOrder` (~line 1493-1506)

**Current:**
```jsx
  const openPayOrder = (lines: (Line & { seq: number })[]) => {
    const pending = lines.filter(l => isUnclaimed(l.item));
    if (!pending.length) return;
    setPayMethod(null);
    setCustomerRef('');
    setPaymentError(null);
    setPayTarget({
      kind: 'balance',
      items: pending.map(l => ({ orderId: l.order.id, date: l.item.deliveryDate || '', slot: l.item.serviceSlot || 'Lunch', amount: l.item.qty * l.item.price, fsItemId: l.item._fsItemId })),
      amount: pending.reduce((t, l) => t + l.item.qty * l.item.price, 0),
      what: `${pending.length} unpaid meal${pending.length !== 1 ? 's' : ''} · this order`,
      ref: generateRef()
    });
  };
```

**Change to:**
```jsx
  const openPayOrder = (lines: (Line & { seq: number })[]) => {
    const pending = lines.filter(l => isUnclaimed(l.item));
    if (!pending.length) return;
    setPayMethod(null);
    setCustomerRef('');
    setPaymentError(null);
    const { items, amount } = buildPayItemsAndAmount(pending);
    setPayTarget({
      kind: 'balance',
      items,
      amount,
      what: `${pending.length} unpaid meal${pending.length !== 1 ? 's' : ''} · this order`,
      ref: generateRef()
    });
  };
```

### 6. The two "Pay order · Rs X" button-label spots (~line 2583 and ~line 2714)

These are exact duplicates of each other — one in the "This week" order list,
one in the "Next week" order list — each computing the amount shown on the
`Pay order · {formatCurrency(orderUnclaimedTotal)}` button. Apply the same
change to both so the label always matches what tapping the button actually
charges (via `openPayOrder`, already fixed above).

**Current (appears twice, identical):**
```jsx
                    const orderUnclaimedTotal = orderUnclaimed.reduce((t, l) => t + l.item.price, 0);
```

**Change to (both occurrences):**
```jsx
                    const orderUnclaimedTotal = buildPayItemsAndAmount(orderUnclaimed).amount;
```

## Why this is safe

- `commitPayment`'s Firestore write is untouched — this only changes the
  `amount` value computed and displayed/quoted before that write happens.
- The "whole order pending → use `order.total` directly" branch means the
  common case (paying a whole order, or a whole week where every order in it
  is being paid off at once) produces the *exact* stored total, with no
  proration rounding involved at all.
- The prorated branch only applies to genuinely partial payments (some of an
  order's meals already paid, or — for an order that happens to span both
  displayed weeks — a "Pay order" tap from just one week's card), and is
  scoped per-order, so one order's discount/VAT never bleeds into another
  order's share.
- Legacy orders without `subtotal`/`discount`/`vat` (pre-dating those fields)
  get `orderProrationFactor === 1`, i.e. unchanged behavior — same fallback
  guard already used in this file's own order-totals display block.

## After applying

- `npx tsc --noEmit` and `npm run build` — this file only.
- Manual re-test of the exact scenario Bhimal ran: an order with a discount
  and VAT (subtotal 210, total 227.01) —
  1. Pay a single meal from that order → Pay sheet should show that meal's
     prorated share of 227.01, not its raw price.
  2. Pay the rest of that same order in one shot ("Pay order") once it's the
     only thing left unpaid → should show exactly Rs 227.01.
  3. With a fresh, fully-unpaid order that has the same discount/VAT shape,
     tap "Pay order" straight away (100% of the order pending) → should show
     exactly `order.total`, matching the order's own totals block on the same
     screen.
  4. "Pay balance" across multiple orders (some fully unpaid, some partially
     paid) → total should equal the sum of each order's correct share as
     above, not a flat raw-price sum.
