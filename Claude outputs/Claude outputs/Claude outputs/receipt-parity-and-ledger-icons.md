# Fix: receipt parity across Customer/Operations, and Ledger preview icons

Fast-path in the strict sense (display-only — no schema, no writes), still
authored verbatim because it touches the same money-figure rendering as the
proration/receipt work earlier this session. Touches `modules/CustomerPortal.tsx`
and `modules/Operations.tsx` only.

This is the bounded, ship-now slice of Bhimal's latest feedback. It does
**not** cover: entity address/contact fields, per-entity configurable
invoice/payment-ref numbering (both already tracked, unbuilt, in the project
doc `BonManzE_InvoicingPaymentMethods_Scope.md`), or auto-generating a
persisted/immutable invoice record with reprint marking when an item is
marked Paid (a new, bigger design question raised separately — see the
accompanying chat message, not this spec).

## 1. Thank-you line should name the entity, not always "BonManzE"

Both receipts hardcode `SYSTEM_CONFIG.businessName` here, even though the
header two inches above it already correctly shows the entity's own name
with a fallback chain — the thank-you line just never got the same
treatment.

### `modules/CustomerPortal.tsx` (~line 3631)

**Current:**
```jsx
                <p className="text-center text-[10px] text-slate-400 mt-5">Thank you for ordering with {SYSTEM_CONFIG.businessName} 🌿</p>
```

**Change to:**
```jsx
                <p className="text-center text-[10px] text-slate-400 mt-5">Thank you for ordering with {receiptTarget.order.entityName || SYSTEM_CONFIG.businessName} 🌿</p>
```

### `modules/Operations.tsx` (~line 7392)

**Current:**
```jsx
                <p className="text-center text-[10px] text-slate-400 mt-4">Thank you for ordering with {SYSTEM_CONFIG.businessName} 🌿</p>
```

**Change to:**
```jsx
                <p className="text-center text-[10px] text-slate-400 mt-4">Thank you for ordering with {activeReceiptDrop.entityName || (entities.find(e => e.id === activeReceiptDrop.entityId)?.name) || SYSTEM_CONFIG.businessName} 🌿</p>
```

(Same fallback chain already used for this modal's header name two lines up
— nothing new introduced.)

## 2. Operations' receipt should read exactly like the customer's

Two concrete differences, both in `modules/Operations.tsx`'s receipt modal:
the item line is missing the day-prefix/detail-note/person-tag the customer
receipt shows, and the discount line uses a different wording
("Discount (Standard: 6%, Birthday: 5%, Bulk: 0%)") instead of the
customer receipt's per-type breakdown lines ("Standard discount (6%)",
"Birthday discount (X%)", etc.). Both are fixed by mirroring the exact
patterns `CustomerPortal.tsx`'s own receipt already uses for the same data.

### 2a. Item rows (~line 7373-7381)

**Current:**
```jsx
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
```

**Change to (adds the day prefix, the notes detail line, and a person tag —
the same three things the customer's own receipt already shows for the same
item):**
```jsx
                  <div className="space-y-3">
                    {activeReceiptDrop.items.map((item, idx) => {
                      const { detail, person } = splitNotesTag(item.notes);
                      return (
                        <div key={idx} className={idx > 0 ? 'pt-3 border-t border-[#F0EADD]' : ''}>
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-800">{item.deliveryDay ? `${item.deliveryDay} · ` : ''}{item.name}</p>
                              {detail && <p className="text-[11px] text-slate-400 mt-0.5">{detail}</p>}
                            </div>
                            <span className="w-8 text-center text-xs text-slate-600 shrink-0">{item.qty}</span>
                            <span className="w-16 text-right text-xs font-black text-slate-900 shrink-0">Rs {item.price}</span>
                          </div>
                          {person && (
                            <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                              <PersonTag name={person} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
```

`splitNotesTag` and `PersonTag` are already used elsewhere in this same
file (the print-ticket modal and the Payments cards above it) — no new
imports needed.

### 2b. Discount line, prorated per-type (~line 7385-7390)

The order's `discountBreakdown` (standard/birthday/bulk, each with its own
rate) is stored once per whole order — same as `discount`/`vat`/`total` —
so it's prorated by this drop's own share exactly the way `subtotal`/
`discount`/`vat`/`total` already are, using the same proportion the
Transactions Ledger itself already computes this way (`renderTransactionsTab`,
`const proportion = orderSubtotal > 0 ? (itemTotal / orderSubtotal) : 0`).

**Current:**
```jsx
        const first = activeReceiptDrop.items[0];
        return (
```

**Change to (three new prorated breakdown values computed alongside the
existing `subtotal`/`discount`/`vat`/`total`):**
```jsx
        const first = activeReceiptDrop.items[0];
        const orderSubtotalForBreakdown = order ? (order.subtotal || order.items.reduce((s, it) => s + (it.price * it.qty), 0)) : 0;
        const dropProportion = orderSubtotalForBreakdown > 0 ? (subtotal / orderSubtotalForBreakdown) : 0;
        const standardDiscount = (order?.discountBreakdown?.standard || 0) * dropProportion;
        const birthdayDiscount = (order?.discountBreakdown?.birthday || 0) * dropProportion;
        const bulkDiscount = (order?.discountBreakdown?.bulk || 0) * dropProportion;
        return (
```

**Current (~line 7387):**
```jsx
                  {discount > 0 && <div className="flex justify-between text-primary font-bold"><span>Discount{order?.discountReason ? ` (${order.discountReason})` : ''}</span><span>-{formatCurrency(discount)}</span></div>}
```

**Change to:**
```jsx
                  {order?.discountBreakdown ? (
                    <>
                      {standardDiscount > 0 && (
                        <div className="flex justify-between text-primary font-bold"><span>Standard discount ({order.discountBreakdown.standardRate}%)</span><span>-{formatCurrency(standardDiscount)}</span></div>
                      )}
                      {birthdayDiscount > 0 && (
                        <div className="flex justify-between text-primary font-bold"><span>Birthday discount ({order.discountBreakdown.birthdayRate}%)</span><span>-{formatCurrency(birthdayDiscount)}</span></div>
                      )}
                      {bulkDiscount > 0 && (
                        <div className="flex justify-between text-primary font-bold"><span>Full-week discount ({order.discountBreakdown.bulkRate}%)</span><span>-{formatCurrency(bulkDiscount)}</span></div>
                      )}
                    </>
                  ) : (
                    discount > 0 && <div className="flex justify-between text-primary font-bold"><span>Discount{order?.discountReason ? ` (${order.discountReason})` : ''}</span><span>-{formatCurrency(discount)}</span></div>
                  )}
```

## 3. Transactions Ledger — two icon-only preview buttons per row

Reuses the exact `activePrintDrop`/`activeReceiptDrop` modals already built
(no new modal) — each Ledger row builds a one-item `DropTask` on the fly and
opens the same viewer the Payments tab uses.

### 3a. Carry the real item onto each Ledger row (~line 3882-3915, 3948-3981)

The row-builder loop already has the real `item`/`o` (order) in scope when
it pushes each row — just keep a reference to them.

**Current (type literal, ~line 3910-3915):**
```jsx
      paymentStatus: string;
      paymentMethod: string;
      paymentRef: string;
      deliveryStatus: string;
      rating?: number;
      ratingComment?: string;
      serviceSlot: string;
    }[] = [];
```

**Change to:**
```jsx
      paymentStatus: string;
      paymentMethod: string;
      paymentRef: string;
      deliveryStatus: string;
      rating?: number;
      ratingComment?: string;
      serviceSlot: string;
      _item: OrderItem;
    }[] = [];
```

**Current (push, ~line 3974-3981):**
```jsx
          paymentStatus: item.paymentStatus || o.paymentStatus || 'Pending',
          paymentMethod: item.paymentMethodName || o.paymentMethodName || '',
          paymentRef: item.paymentReference || '',
          deliveryStatus: item.status || 'Active',
          rating: item.rating,
          ratingComment: item.ratingComment,
          serviceSlot: item.serviceSlot || 'Lunch'
        });
```

**Change to:**
```jsx
          paymentStatus: item.paymentStatus || o.paymentStatus || 'Pending',
          paymentMethod: item.paymentMethodName || o.paymentMethodName || '',
          paymentRef: item.paymentReference || '',
          deliveryStatus: item.status || 'Active',
          rating: item.rating,
          ratingComment: item.ratingComment,
          serviceSlot: item.serviceSlot || 'Lunch',
          _item: item
        });
```

### 3b. New header cell (~line 4243)

**Current:**
```jsx
                    <th className="px-5 py-4 min-w-[120px]">Rating & Feedback</th>
                  </tr>
```

**Change to:**
```jsx
                    <th className="px-5 py-4 min-w-[120px]">Rating & Feedback</th>
                    <th className="px-5 py-4 min-w-[70px]"></th>
                  </tr>
```

### 3c. New row cell — two icon buttons, no labels (~line 4314-4335)

**Current:**
```jsx
                      <td className="px-5 py-3">
                        {r.rating !== undefined ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-0.5">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={`size-3 ${i < r.rating! ? 'fill-warning text-warning' : 'text-slate-200'}`}
                                />
                              ))}
                            </div>
                            {r.ratingComment && (
                              <p className="text-[10px] text-slate-500 font-medium italic leading-snug break-words max-w-[150px]">
                                "{r.ratingComment}"
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 italic font-normal">No rating yet</span>
                        )}
                      </td>
                    </tr>
                  ))}
```

**Change to:**
```jsx
                      <td className="px-5 py-3">
                        {r.rating !== undefined ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-0.5">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={`size-3 ${i < r.rating! ? 'fill-warning text-warning' : 'text-slate-200'}`}
                                />
                              ))}
                            </div>
                            {r.ratingComment && (
                              <p className="text-[10px] text-slate-500 font-medium italic leading-snug break-words max-w-[150px]">
                                "{r.ratingComment}"
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 italic font-normal">No rating yet</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setActivePrintDrop({
                              key: `ledger-${r.orderId}-${idx}`,
                              orderId: r.orderId,
                              customerName: r.customerName,
                              date: r.deliveryDate,
                              slot: r.serviceSlot,
                              items: [r._item],
                              total: r.totalWithTax,
                              paymentStatus: r.paymentStatus as 'Paid' | 'Pending' | 'Refunded',
                              entityId: r.entityId,
                              entityName: r.entityName,
                            })}
                            className="p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                            title="View delivery ticket"
                          >
                            <Truck className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => r.paymentStatus === 'Paid' && setActiveReceiptDrop({
                              key: `ledger-${r.orderId}-${idx}`,
                              orderId: r.orderId,
                              customerName: r.customerName,
                              date: r.deliveryDate,
                              slot: r.serviceSlot,
                              items: [r._item],
                              total: r.totalWithTax,
                              paymentStatus: r.paymentStatus as 'Paid' | 'Pending' | 'Refunded',
                              entityId: r.entityId,
                              entityName: r.entityName,
                            })}
                            disabled={r.paymentStatus !== 'Paid'}
                            className="p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed cursor-pointer"
                            title={r.paymentStatus === 'Paid' ? 'View receipt' : 'No payment confirmed yet'}
                          >
                            <Receipt className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
```

`Truck` and `Receipt` are both already imported in this file (`Truck` from
the very first icon import block; `Receipt` from the paid-history change
earlier this session). No new imports needed.

## After applying

- `npx tsc --noEmit` and `npm run build`.
- Open the same test order (`Avi Kooshee`, Rs 227.01) in both the customer
  app and Operations → Payments → paid history → Receipt, side by side —
  the item line, the discount line wording, and the thank-you line's
  business/entity name should now read identically.
- In the Transactions Ledger, confirm the new unlabeled icon pair appears
  after Rating & Feedback: the truck icon opens the delivery ticket for any
  row; the receipt icon opens the receipt only for a Paid row (greyed out
  and inert with a tooltip explanation on an unpaid one).
