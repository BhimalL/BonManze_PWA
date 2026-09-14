# Feature: view the delivery note and receipt for already-paid items

Fast-path in the strict sense (read-only display, no new writes, no schema
change) — but it computes money figures (subtotal/discount/VAT), so this is
still authored verbatim rather than handed to Antigravity as a loose spec,
the same caution applied to the payment-amount proration fix earlier this
session. Touches `modules/Operations.tsx` only.

## The gap

The "N paid" history section of the Payments console (Operations → Payments
→ the collapsed list at the bottom) shows only a customer name, the items,
the total, and a plain "Paid" badge — no way to see the delivery ticket or
the receipt that was issued for that payment. The unpaid list above it
already has a working "Print" button (the delivery ticket modal, via
`activePrintDrop`); paid items have no equivalent, and there's no receipt
view in Operations at all today (only `CustomerPortal.tsx` has one, for the
customer's own use).

## The fix

1. Add the same **Print** button already used on unpaid items to each paid
   item — it's the same delivery-ticket modal, already payment-status-aware
   (`activePrintDrop.paymentStatus === 'Paid' ? 'Paid' : 'Unpaid'` is already
   handled in that modal), so no new modal is needed for this half.
2. Add a new **Receipt** button + modal, built from the order's own
   `subtotal`/`discount`/`vat`/`total` proportioned to just this drop's
   items — reusing the exact same per-item proration math `itemNetAmount`
   already uses (and that the Transactions Ledger / paymentSummary rely on),
   so the figure a staff member sees here can never drift from what the
   Ledger already agrees on. `itemNetAmount` is refactored to be a thin
   wrapper over a new `itemAmountBreakdown` helper that also exposes the
   discount/VAT split — the net result is unchanged, it's just decomposed
   for display.

### 1. Import `Receipt` icon (~line 38)

**Current:**
```ts
  Printer,
  FileSpreadsheet,
```

**Change to:**
```ts
  Printer,
  Receipt,
  FileSpreadsheet,
```

### 2. New state, alongside the other print-modal state (~line 401-402)

**Current:**
```jsx
  const [activePrintDrop, setActivePrintDrop] = useState<DropTask | null>(null);
  const [activePrintService, setActivePrintService] = useState<{ date: string; service: 'Lunch' | 'Dinner'; drops: DropTask[] } | null>(null);
```

**Change to:**
```jsx
  const [activePrintDrop, setActivePrintDrop] = useState<DropTask | null>(null);
  const [activePrintService, setActivePrintService] = useState<{ date: string; service: 'Lunch' | 'Dinner'; drops: DropTask[] } | null>(null);
  const [activeReceiptDrop, setActiveReceiptDrop] = useState<DropTask | null>(null);
```

### 3. `itemAmountBreakdown` helper, `itemNetAmount` becomes a wrapper (~line 1414-1428)

**Current:**
```jsx
  // An order's discount/VAT are computed once across the WHOLE order (see
  // confirmCheckout), not per item — so any view that needs a per-item or
  // per-drop money figure has to reconstruct that item's fair share the
  // same way the Transactions Ledger already does below, or it silently
  // shows the item's raw pre-discount/pre-VAT menu price instead of what
  // the customer actually owes/paid. Shared by drops, paymentDrops, and
  // paymentSummary so all three agree with the Ledger and the receipt.
  const itemNetAmount = (order: Order, item: OrderItem) => {
    const orderSubtotal = order.subtotal || order.items.reduce((sum, it) => sum + (it.price * it.qty), 0);
    const itemTotal = item.qty * item.price;
    const proportion = orderSubtotal > 0 ? (itemTotal / orderSubtotal) : 0;
    const itemDiscount = (order.discount || 0) * proportion;
    const itemVat = (order.vat || 0) * proportion;
    return itemTotal - itemDiscount + itemVat;
  };
```

**Change to:**
```jsx
  // An order's discount/VAT are computed once across the WHOLE order (see
  // confirmCheckout), not per item — so any view that needs a per-item or
  // per-drop money figure has to reconstruct that item's fair share the
  // same way the Transactions Ledger already does below, or it silently
  // shows the item's raw pre-discount/pre-VAT menu price instead of what
  // the customer actually owes/paid. Shared by drops, paymentDrops,
  // paymentSummary, and the Payments-console receipt view so all of them
  // agree with the Ledger.
  const itemAmountBreakdown = (order: Order, item: OrderItem) => {
    const orderSubtotal = order.subtotal || order.items.reduce((sum, it) => sum + (it.price * it.qty), 0);
    const gross = item.qty * item.price;
    const proportion = orderSubtotal > 0 ? (gross / orderSubtotal) : 0;
    const discount = (order.discount || 0) * proportion;
    const vat = (order.vat || 0) * proportion;
    return { gross, discount, vat, net: gross - discount + vat };
  };

  const itemNetAmount = (order: Order, item: OrderItem) => itemAmountBreakdown(order, item).net;
```

### 4. Paid-history card — Print + Receipt buttons (~line 6681-6697)

**Current:**
```jsx
                        <p className="text-sm font-black text-primary mt-1">{formatCurrency(drop.total)}</p>
                        {drop.items.some(i => i.rating) && (
                          <div className="mt-3 bg-warning/[0.03] border border-warning/10 rounded-2xl p-3 space-y-2 text-[11px] text-slate-600 font-medium">
                            {drop.items.filter(i => i.rating).map((i, idx) => (
                              <div key={idx} className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5 font-bold text-slate-700">
                                  <span className="flex items-center gap-0.5 text-warning font-black"><Star className="size-3.5 fill-warning text-warning" /> {i.rating}★</span>
                                  <span>on {i.name}</span>
                                </div>
                                {i.ratingComment && <p className="text-slate-500 font-medium italic pl-5">"{i.ratingComment}"</p>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="shrink-0 px-4 py-2 bg-success/10 text-success rounded-xl text-[10px] font-black uppercase tracking-widest font-black">Paid</span>
                    </div>
```

**Change to:**
```jsx
                        <p className="text-sm font-black text-primary mt-1">{formatCurrency(drop.total)}</p>
                        {drop.items.some(i => i.rating) && (
                          <div className="mt-3 bg-warning/[0.03] border border-warning/10 rounded-2xl p-3 space-y-2 text-[11px] text-slate-600 font-medium">
                            {drop.items.filter(i => i.rating).map((i, idx) => (
                              <div key={idx} className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5 font-bold text-slate-700">
                                  <span className="flex items-center gap-0.5 text-warning font-black"><Star className="size-3.5 fill-warning text-warning" /> {i.rating}★</span>
                                  <span>on {i.name}</span>
                                </div>
                                {i.ratingComment && <p className="text-slate-500 font-medium italic pl-5">"{i.ratingComment}"</p>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => setActivePrintDrop(drop)}
                          className="px-4 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95 transition-all rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 cursor-pointer"
                          title="Print delivery ticket"
                        >
                          <Printer className="size-4" /> Print
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveReceiptDrop(drop)}
                          className="px-4 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95 transition-all rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 cursor-pointer"
                          title="View the receipt issued for this payment"
                        >
                          <Receipt className="size-4" /> Receipt
                        </button>
                        <span className="px-4 py-2 bg-success/10 text-success rounded-xl text-[10px] font-black uppercase tracking-widest font-black">Paid</span>
                      </div>
                    </div>
```

### 5. New Receipt modal — insert right after the `activePrintDrop` modal's closing (~line 7249-7251)

**Current:**
```jsx
        </Portal>
      )}

      {activePrintService && (
```

**Change to (new modal inserted between the two existing ones):**
```jsx
        </Portal>
      )}

      {activeReceiptDrop && (() => {
        const order = orders.find(o => o.id === activeReceiptDrop.orderId);
        const cust = getCustomer(activeReceiptDrop.customerName);
        const breakdowns = order ? activeReceiptDrop.items.map(item => itemAmountBreakdown(order, item)) : [];
        const subtotal = breakdowns.reduce((s, b) => s + b.gross, 0);
        const discount = breakdowns.reduce((s, b) => s + b.discount, 0);
        const vat = breakdowns.reduce((s, b) => s + b.vat, 0);
        const total = breakdowns.reduce((s, b) => s + b.net, 0);
        const first = activeReceiptDrop.items[0];
        return (
          <Portal>
            <div className="fixed inset-0 z-[10000] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto bmz-receipt-overlay">
              <style>{`
                @media print {
                  body * { visibility: hidden !important; }
                  .bmz-receipt-overlay, .bmz-receipt-overlay * { visibility: visible !important; }
                  .bmz-receipt-overlay { position: fixed; inset: 0; margin: 0; padding: 0; background: white; }
                  .bmz-no-print { display: none !important; }
                }
              `}</style>
              <div className="bg-white rounded-[32px] w-full max-w-sm shadow-2xl overflow-x-hidden overflow-y-auto max-h-[85vh] p-6">
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2.5">
                    {SYSTEM_CONFIG.businessLogoUrl && (
                      <img src={SYSTEM_CONFIG.businessLogoUrl} alt={SYSTEM_CONFIG.businessName} className="size-9 rounded-lg object-cover shrink-0" />
                    )}
                    <div>
                      <p className="text-lg font-black text-slate-900">{activeReceiptDrop.entityName || (entities.find(e => e.id === activeReceiptDrop.entityId)?.name) || SYSTEM_CONFIG.businessName}</p>
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{SYSTEM_CONFIG.businessTagline}</p>
                    </div>
                  </div>
                  <button onClick={() => setActiveReceiptDrop(null)} className="bmz-no-print p-1.5 text-slate-400 hover:text-danger"><X className="size-5" /></button>
                </div>
                <p className="text-[10px] font-black uppercase text-primary tracking-widest mt-3">{SYSTEM_CONFIG.vatEnabled ? 'Tax invoice' : 'Receipt'}</p>
                {order?.entityId ? (
                  <div className="text-[10px] text-slate-400 mt-1 space-y-0.5">
                    {order.entityBrn && <p>BRN: {order.entityBrn}</p>}
                    {order.entityVatNumber && <p>VRN: {order.entityVatNumber}</p>}
                  </div>
                ) : (
                  SYSTEM_CONFIG.vatEnabled && SYSTEM_CONFIG.vatNumber && (
                    <p className="text-[10px] text-slate-400 mt-0.5">VRN {SYSTEM_CONFIG.vatNumber}</p>
                  )
                )}

                <div className="border-t border-dashed border-slate-300 mt-3 pt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <div>
                    <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-1">Bill to</p>
                    <p className="font-black text-slate-800">{activeReceiptDrop.customerName}</p>
                    {cust?.phone && <p className="text-slate-500 mt-0.5">{cust.phone}</p>}
                    {cust?.addresses?.[0] && <p className="text-slate-500 mt-0.5">{cust.addresses[0].street}, {cust.addresses[0].city}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-1">Invoice ref</p>
                    <p className="font-mono text-slate-600">{activeReceiptDrop.orderId}</p>
                    {order?.timestamp && <p className="text-slate-500 mt-1">{new Date(order.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
                  </div>
                </div>

                {(first?.paymentMethodName || first?.paymentReference) && (
                  <div className="border-t border-dashed border-slate-300 mt-3 pt-3 space-y-1 text-xs">
                    {first?.paymentMethodName && (
                      <div className="flex justify-between"><span className="text-slate-400 font-bold">Payment method</span><span className="text-slate-600">{first.paymentMethodName}</span></div>
                    )}
                    {first?.paymentReference && (
                      <div className="flex justify-between gap-3"><span className="text-slate-400 font-bold shrink-0">Payment ref</span><span className="text-slate-600 text-right break-all">{first.paymentReference}</span></div>
                    )}
                  </div>
                )}

                <div className="border-t border-dashed border-slate-300 mt-3 pt-3">
                  <div className="flex text-[9px] font-black uppercase text-slate-400 tracking-widest pb-2">
                    <span className="flex-1">Description</span>
                    <span className="w-8 text-center shrink-0">Qty</span>
                    <span className="w-16 text-right shrink-0">Amount</span>
                  </div>
                  <div className="space-y-3">
                    {activeReceiptDrop.items.map((item, idx) => (
                      <div key={idx} className={idx > 0 ? 'pt-3 border-t border-[#F0EADD] flex items-start gap-2' : 'flex items-start gap-2'}>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-800">{item.name}</p>
                        </div>
                        <span className="w-8 text-center text-xs text-slate-600 shrink-0">{item.qty}</span>
                        <span className="w-16 text-right text-xs font-black text-slate-900 shrink-0">Rs {item.price}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-[#E7E0D0] space-y-1 text-[11px]">
                  <div className="flex justify-between text-slate-500 font-bold"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                  {discount > 0 && <div className="flex justify-between text-primary font-bold"><span>Discount{order?.discountReason ? ` (${order.discountReason})` : ''}</span><span>-{formatCurrency(discount)}</span></div>}
                  {vat > 0 && <div className="flex justify-between text-slate-500 font-bold"><span>VAT ({SYSTEM_CONFIG.vatRate}%)</span><span>{formatCurrency(vat)}</span></div>}
                  <div className="flex justify-between text-slate-900 font-black pt-1.5 border-t border-[#E7E0D0] text-xs"><span>Total paid</span><span>{formatCurrency(total)}</span></div>
                </div>

                <p className="text-center text-[10px] text-slate-400 mt-4">Thank you for ordering with {SYSTEM_CONFIG.businessName} 🌿</p>

                <div className="bmz-no-print mt-5 flex gap-2">
                  <button onClick={() => setActiveReceiptDrop(null)} className="flex-1 py-2 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer">Close</button>
                  <button onClick={() => window.print()} className="flex-1 py-2 bg-primary text-white hover:bg-primary/95 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer">Print / Save PDF</button>
                </div>
              </div>
            </div>
          </Portal>
        );
      })()}

      {activePrintService && (
```

`orders`, `getCustomer`, `entities`, `SYSTEM_CONFIG`, `formatCurrency`, `X`,
`Portal` are all already in scope/imported in this file (the same pattern
the existing print-ticket modal above it already uses for `getCustomer` and
`entities`) — no other new imports needed beyond `Receipt` (step 1).

## Why the money figures on this receipt are safe

- Per-item `gross`/`discount`/`vat` come from `itemAmountBreakdown`, the
  exact same formula `itemNetAmount` already used (and that `drops`,
  `paymentDrops`, and `paymentSummary` all already agree on) — just exposed
  in parts instead of collapsed into one net number. `itemNetAmount` itself
  becomes a one-line wrapper around it, so there's no risk of the two
  formulas drifting apart later.
- The receipt only ever renders for a `paidDrops` entry — an order whose
  items are already `paymentStatus: 'Paid'` — so this is a pure read of
  already-settled data; nothing here writes anything.

## After applying

- `npx tsc --noEmit` and `npm run build`.
- On the same test order used throughout this session (`Avi Kooshee`,
  subtotal 210 / total 227.01, now Paid): expand "1 paid" in Payments,
  confirm **Print** opens the existing delivery-ticket modal (already
  correctly labelled "Paid" there) and **Receipt** opens the new modal
  showing Subtotal Rs 210.00, Discount -Rs 12.60, VAT Rs 29.61, Total paid
  Rs 227.01 — matching the customer's own receipt and the Transactions
  Ledger exactly.
- Confirm an order with no discount/VAT (legacy or a plain order) still
  renders a sensible receipt (no Discount/VAT lines shown, Subtotal equals
  Total).
