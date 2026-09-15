import React from 'react';
import { X, Printer } from 'lucide-react';
import { Portal } from './Portal';
import { formatCurrency, SYSTEM_CONFIG } from './store';

// ---------------------------------------------------------------------------
// Shared receipt / tax-invoice modal.
//
// Before this file existed, CustomerPortal.tsx and Operations.tsx each had
// their own hand-built copy of this modal: same look, but two independently
// maintained implementations of the money math (partialLineCalcs vs
// itemAmountBreakdown) and the discount-label logic. That's the exact
// pattern that let the discountShare bug and the invoice-number reshape bug
// both slip through twice — a fix in one copy doesn't reach the other. This
// file is the single source for what a receipt shows and how it's laid out;
// callers are only responsible for gathering *which items* belong to one
// receipt (a single admin "drop", or everything sharing a customer's
// paymentReference) and normalizing them into the ReceiptData shape below.
//
// Scope note: admin's receipt still only covers one "drop" at a time here,
// same as before this refactor — it does NOT consolidate every item sharing
// a paymentReference the way the customer's own receipt already does.
// Closing that gap needs a cross-order lookup-by-reference capability that
// belongs to the (not yet built) Payments-console consolidation feature;
// bolting it onto just the receipt modal here would risk a second,
// independent implementation of that same lookup later. See
// BonManzE_Changelog.md / the Pay-ref discussion for context.
// ---------------------------------------------------------------------------

export interface ReceiptLineItem {
  key: string;
  /** e.g. "Monday" — shown before the dish name when known. */
  dayLabel?: string;
  name: string;
  qty: number;
  price: number;
  /** Free-text note detail (splitNotesTag's `detail`). */
  detail?: string;
  /** "Who this meal is for" (splitNotesTag's `person`). */
  person?: string | null;
  /** e.g. "Extra 2" — customer-side repeat-same-dish badge. */
  extraLabel?: string;
}

export interface ReceiptLineGroup {
  key: string;
  /** Shown only when a receipt spans more than one order (e.g. "Order abc123"). */
  orderLabel?: string;
  /** Shown only when a group has both Lunch and Dinner (e.g. "🌙 Dinner"). */
  serviceLabel?: string;
  items: ReceiptLineItem[];
}

export interface ReceiptDiscountLine {
  label: string;
  amount: number;
  /** Tailwind text color class; defaults to text-primary. */
  colorClass?: string;
}

export interface ReceiptEntityDetails {
  brn?: string;
  vatNumber?: string;
  address?: string;
  phone?: string;
  email?: string;
}

export interface ReceiptData {
  entityName?: string;
  entityId?: string;
  vatLabel: 'Tax invoice' | 'Receipt';
  entityDetails?: ReceiptEntityDetails;
  /** Shown only when there's no entity (falls back to the system's own VAT number). */
  fallbackVatNumber?: string;
  billToName: string;
  billToPhone?: string;
  billToEmail?: string;
  billToAddress?: string;
  /** "Invoice ref" or "Invoice refs" (plural) — caller decides based on count. */
  invoiceRefLabel: string;
  invoiceRefDisplay: string;
  /** Shown next to the invoice ref only when the receipt covers a single date. */
  dateDisplay?: string;
  paymentMethodName?: string;
  paymentReference?: string;
  groups: ReceiptLineGroup[];
  subtotal: number;
  discountLines: ReceiptDiscountLine[];
  vat: number;
  vatRate: number;
  total: number;
  anyReprinted: boolean;
}

// Recovers the real discount label for orders written before
// discountBreakdown.standardLabel existed (confirmCheckout now writes it
// directly), by pulling it out of the free-text discountReason — which
// always carried the real tier/group name — and filtering out the
// Birthday/Full-week parts. Falls back to a plain "Standard" label if
// neither source has it.
export function resolveStandardLabel(
  standardLabel: string | undefined,
  discountReason: string | undefined,
): string {
  if (standardLabel) return standardLabel;
  const raw = discountReason || '';
  const recovered = raw
    .split(', ')
    .find(p => !p.startsWith('Birthday') && !p.startsWith('Full-week') && !p.startsWith('Bulk'));
  if (recovered) {
    return recovered.replace(/\s*\(\d+(\.\d+)?%\)\s*$/, '').trim() || 'Standard';
  }
  return 'Standard';
}

// Same small "who this meal is for" pill both files already render inline
// item notes with elsewhere in their own JSX (each has its own copy — not
// part of this refactor's scope). Kept local to this component so Receipt.tsx
// has no dependency on either caller's internals.
const PersonTag: React.FC<{ name: string }> = ({ name }) => (
  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-accent/10 text-accent text-[9px] font-bold shrink-0">
    👤 {name}
  </span>
);

export function ReceiptModal({
  data,
  onClose,
  onPrint,
}: {
  data: ReceiptData;
  onClose: () => void;
  /** Caller decides whether/how to bump invoiceReprintCount before printing (admin-only today). */
  onPrint: () => void;
}) {
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
                <p className="text-lg font-black text-slate-900">{data.entityName || SYSTEM_CONFIG.businessName}</p>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{SYSTEM_CONFIG.businessTagline}</p>
              </div>
            </div>
            <button onClick={onClose} className="bmz-no-print p-1.5 text-slate-400 hover:text-danger"><X className="size-5" /></button>
          </div>
          <div className="flex items-center justify-between mt-3">
            <p className="text-[10px] font-black uppercase text-primary tracking-widest">{data.vatLabel}</p>
            {data.anyReprinted && (
              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 text-[9px] font-black uppercase tracking-wider">
                Duplicate / Reprint
              </span>
            )}
          </div>
          {data.entityId ? (
            <div className="text-[10px] text-slate-400 mt-1 space-y-0.5">
              {data.entityDetails?.brn && <p>BRN: {data.entityDetails.brn}</p>}
              {data.entityDetails?.vatNumber && <p>VRN: {data.entityDetails.vatNumber}</p>}
              {data.entityDetails?.address && <p>{data.entityDetails.address}</p>}
              {data.entityDetails?.phone && <p>{data.entityDetails.phone}</p>}
              {data.entityDetails?.email && <p>{data.entityDetails.email}</p>}
            </div>
          ) : (
            SYSTEM_CONFIG.vatEnabled && data.fallbackVatNumber && (
              <p className="text-[10px] text-slate-400 mt-0.5">VRN {data.fallbackVatNumber}</p>
            )
          )}

          <div className="border-t border-dashed border-slate-300 mt-3 pt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <div>
              <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-1">Bill to</p>
              <p className="font-black text-slate-800">{data.billToName}</p>
              {data.billToPhone && <p className="text-slate-500 mt-0.5">{data.billToPhone}</p>}
              {data.billToEmail && <p className="text-slate-500 mt-0.5 break-all">{data.billToEmail}</p>}
              {data.billToAddress && <p className="text-slate-500 mt-0.5">{data.billToAddress}</p>}
            </div>
            <div className="text-right">
              <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-1">{data.invoiceRefLabel}</p>
              <p className="font-mono text-slate-600">{data.invoiceRefDisplay}</p>
              {data.dateDisplay && <p className="text-slate-500 mt-1">{data.dateDisplay}</p>}
            </div>
          </div>

          {(data.paymentMethodName || data.paymentReference) && (
            <div className="border-t border-dashed border-slate-300 mt-3 pt-3 space-y-1 text-xs">
              {data.paymentMethodName && (
                <div className="flex justify-between"><span className="text-slate-400 font-bold">Payment method</span><span className="text-slate-600">{data.paymentMethodName}</span></div>
              )}
              {data.paymentReference && (
                <div className="flex justify-between gap-3"><span className="text-slate-400 font-bold shrink-0">Payment ref</span><span className="text-slate-600 text-right break-all">{data.paymentReference}</span></div>
              )}
            </div>
          )}

          <div className="border-t border-dashed border-slate-300 mt-3 pt-3">
            <div className="flex text-[9px] font-black uppercase text-slate-400 tracking-widest pb-2">
              <span className="flex-1">Description</span>
              <span className="w-8 text-center shrink-0">Qty</span>
              <span className="w-16 text-right shrink-0">Amount</span>
            </div>
            <div className="space-y-4">
              {data.groups.map(group => (
                <div key={group.key}>
                  {group.orderLabel && (
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1.5">{group.orderLabel}</p>
                  )}
                  {group.serviceLabel && (
                    <p className="text-[9px] font-black uppercase text-accent tracking-widest mb-1.5">{group.serviceLabel}</p>
                  )}
                  <div className="space-y-3">
                    {group.items.map((item, idx) => (
                      <div key={item.key} className={idx > 0 ? 'pt-3 border-t border-[#F0EADD]' : ''}>
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-800">{item.dayLabel ? `${item.dayLabel} · ` : ''}{item.name}</p>
                            {item.detail && <p className="text-[11px] text-slate-400 mt-0.5">{item.detail}</p>}
                          </div>
                          <span className="w-8 text-center text-xs text-slate-600 shrink-0">{item.qty}</span>
                          <span className="w-16 text-right text-xs font-black text-slate-900 shrink-0">{formatCurrency(item.price)}</span>
                        </div>
                        {(item.extraLabel || item.person) && (
                          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                            {item.extraLabel && <span className="px-1.5 py-0.5 rounded bg-accent/10 text-accent text-[9px] font-black uppercase">{item.extraLabel}</span>}
                            {item.person && <PersonTag name={item.person} />}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-[#E7E0D0] space-y-1 text-[11px]">
            <div className="flex justify-between text-slate-500 font-bold"><span>Subtotal</span><span>{formatCurrency(data.subtotal)}</span></div>
            {data.discountLines.map((d, i) => (
              <div key={i} className={`flex justify-between font-bold ${d.colorClass || 'text-primary'}`}>
                <span>{d.label}</span><span>-{formatCurrency(d.amount)}</span>
              </div>
            ))}
            {data.vat > 0 && <div className="flex justify-between text-slate-500 font-bold"><span>VAT ({data.vatRate}%)</span><span>{formatCurrency(data.vat)}</span></div>}
            <div className="flex justify-between text-slate-900 font-black pt-1.5 border-t border-[#E7E0D0] text-xs"><span>Total paid</span><span>{formatCurrency(data.total)}</span></div>
          </div>

          <p className="text-center text-[10px] text-slate-400 mt-4">Thank you for ordering with {data.entityName || SYSTEM_CONFIG.businessName} 🌿</p>

          <div className="bmz-no-print mt-5 flex gap-2">
            <button onClick={onClose} className="flex-1 py-2 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer">Close</button>
            <button onClick={onPrint} className="flex-1 py-2 bg-primary text-white hover:bg-primary/95 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 cursor-pointer">
              <Printer className="size-3.5" /> Print / Save PDF
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
