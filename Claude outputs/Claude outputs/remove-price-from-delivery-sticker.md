# Remove price from the Delivery Sticker print-out

**File:** `modules/Operations.tsx` ONLY. Apply exactly as given. Display-only change to a print template —
no data model, no Firestore, no rules, no write path involved.

## Background

Bhimal's decision: the printed Delivery Sticker (Delivery List tab → "Print Lunch/Dinner Stickers", the
`activePrintService` overlay) should keep the customer's name (needed to know whose order it is) but should
not show item prices — this is customer/margin-adjacent information that has no reason to be on a slip of
paper that could end up misplaced or seen by the customer. This applies to every sticker printed, for every
staff member — not specific to any one feature or role.

## The fix — inside the sticker's item list (~line 7082-7086)

```tsx
// BEFORE
                            <div key={idx} className="space-y-0.5">
                              <div className="flex justify-between font-bold text-slate-950">
                                <span>{item.qty}x {item.name}</span>
                                <span>Rs {item.price * item.qty}</span>
                              </div>
                              {detail && <p className="text-[10px] text-slate-500 leading-tight pl-2">↳ {detail}</p>}

// AFTER
                            <div key={idx} className="space-y-0.5">
                              <div className="font-bold text-slate-950">
                                {item.qty}x {item.name}
                              </div>
                              {detail && <p className="text-[10px] text-slate-500 leading-tight pl-2">↳ {detail}</p>}
```

That's the whole change: the price `<span>` is removed, and since there's now only one piece of text in that
row, `flex justify-between` (which existed only to push the price to the right edge) is dropped along with it
— everything else in the row (the detail line, the person tag, the instructions tag right below) is untouched.

## Do NOT touch

- Nothing else in the sticker template — customer name, phone, date, service, payment status, and delivery
  address all stay exactly as they are today. This is price only.
- Nothing in the Transactions CSV, the Ledger, or any other price/cost display anywhere else in the app —
  this is scoped to this one print template only.
- No change to `calculateItemsTotal`, `confirmCheckout`, or any Cloud Function — this is a pure display change
  in one React component.

## Verify before committing

1. `npx tsc --noEmit` clean, `vite build` clean.
2. Live click-through: Delivery List tab → Print Lunch (or Dinner) Stickers → confirm each ticket shows
   `{qty}x {dish name}` with no price anywhere on it, and that customer name, phone, date, service, payment
   status, and address are all still present exactly as before.

Commit as its own fix, e.g. `fix(operations): remove item prices from printed Delivery Stickers`.
