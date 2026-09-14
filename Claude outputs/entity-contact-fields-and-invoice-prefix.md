# Spec: Entity address/email/phone + invoicePrefix — form, checkout snapshot, receipt header

**Working Agreement: SLOW PATH for §2 (the `confirmCheckout` change) — this is a Cloud Function edit, author it exactly. The Trading Entity form additions (§1) are fast-path UI following an existing pattern; build them to match, field names and behavior must be exact.**

**Reference:** `BonManzE_InvoicingPaymentMethods_Scope.md` §1/§2/§7 step 2 (contact fields), §5 (`invoicePrefix`, bundled in here since it's the same form/same entity document).

---

## 1. `types.ts` — `Entity` gains four fields

```ts
export interface Entity {
  id: string;
  name: string;
  brn: string;
  vatNumber: string;
  bankReference: string;
  address?: string;
  email?: string;
  phone?: string;
  invoicePrefix?: string;         // see invoice-numbering-and-reprint-marking.md §1 — placed here since it's edited on the same form
  invoiceNumberCounter?: number;  // server-managed only — see invoice-numbering-and-reprint-marking.md; the form never reads/writes this
  logoStoragePath?: string;
  active: boolean;
  createdAt: any;
  updatedAt: any;
}
```
All four (`address`/`email`/`phone`/`invoicePrefix`) are plain optional strings, free text, no format validation — matching how `brn`/`vatNumber`/`bankReference` are handled today (no validation on those either).

Add to `Order` (alongside the existing `entityBrn`/`entityVatNumber`/`entityBankReference`/`entityLogoStoragePath` snapshot fields):
```ts
  entityAddress?: string;
  entityEmail?: string;
  entityPhone?: string;
```

---

## 2. `functions/index.js` — extend `confirmCheckout`'s entity snapshot

In `confirmCheckout` (around line 534-539), the order's `tx.set(orderRef, {...})` call currently writes:
```js
      entityId: customer.entityId,
      entityName: entity.name || '',
      entityBrn: entity.brn || '',
      entityVatNumber: entity.vatNumber || '',
      entityBankReference: entity.bankReference || '',
      entityLogoStoragePath: entity.logoStoragePath || '',
```
Change to:
```js
      entityId: customer.entityId,
      entityName: entity.name || '',
      entityBrn: entity.brn || '',
      entityVatNumber: entity.vatNumber || '',
      entityBankReference: entity.bankReference || '',
      entityAddress: entity.address || '',
      entityEmail: entity.email || '',
      entityPhone: entity.phone || '',
      entityLogoStoragePath: entity.logoStoragePath || '',
```
Nothing else in `confirmCheckout` changes — `invoicePrefix`/`invoiceNumberCounter` are deliberately **not** read or snapshotted here; they're consumed only by the `issueInvoiceOnPayment` trigger at Mark Paid time (`invoice-numbering-and-reprint-marking.md`), not at checkout.

No `firestore.rules` change: `entities/{entityId}` writes are already an unrestricted whole-document `allow write: if isStaffAllowed('tradingEntities', 'edit')` — adding fields to the document doesn't need a new rule.

---

## 3. Trading Entity Add/Edit modal (`Operations.tsx`) — add the three fields

**3a. Form state** — `entityForm` (line ~801) gains the three new keys:
```ts
const [entityForm, setEntityForm] = useState({ name: '', brn: '', vatNumber: '', bankReference: '', address: '', email: '', phone: '', invoicePrefix: '' });
```
Every place `entityForm` is reset (the "Add New Entity" button handler ~line 5412, and the "Edit" button handler ~line 5444) must set all eight keys, not just the original four — e.g.:
```ts
onClick={() => { setEditingEntityId(null); setEntityForm({ name: '', brn: '', vatNumber: '', bankReference: '', address: '', email: '', phone: '', invoicePrefix: '' }); setEntityLogoFile(null); setShowAddEntityModal(true); }}
```
and
```ts
setEntityForm({ name: entity.name, brn: entity.brn, vatNumber: entity.vatNumber, bankReference: entity.bankReference, address: entity.address || '', email: entity.email || '', phone: entity.phone || '', invoicePrefix: entity.invoicePrefix || '' });
```

**3b. Form fields** — the modal body (~line 5532) currently maps over `(['name', 'brn', 'vatNumber', 'bankReference'] as const)`. Extend the tuple and the label lookup:
```tsx
{(['name', 'brn', 'vatNumber', 'bankReference', 'address', 'email', 'phone', 'invoicePrefix'] as const).map(f => (
  <div key={f}>
    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
      {f === 'vatNumber' ? 'VAT Number'
        : f === 'brn' ? 'BRN'
        : f === 'bankReference' ? 'Bank Reference'
        : f === 'invoicePrefix' ? 'Invoice Prefix'
        : f === 'address' ? 'Address'
        : f === 'email' ? 'Email'
        : f === 'phone' ? 'Phone'
        : 'Entity Name'}
    </label>
    <input
      type={f === 'email' ? 'email' : 'text'}
      value={entityForm[f]}
      onChange={e => setEntityForm(prev => ({ ...prev, [f]: e.target.value }))}
      className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
      placeholder={f === 'invoicePrefix' ? 'e.g. INV-A' : undefined}
    />
  </div>
))}
```
(fast-path detail: `address` is free text here, a single-line input matching every other field on this form — not a structured street/city/zip like `CustomerAddress`. Keep it a single field; this form has no precedent for multi-field addresses and the receipt only needs to print it as one block of text.)

**3c. Save handler** — the `payload` object (~line 5563-5570) gains the four fields:
```ts
const payload: Record<string, unknown> = {
  name: entityForm.name.trim(),
  brn: entityForm.brn.trim(),
  vatNumber: entityForm.vatNumber.trim(),
  bankReference: entityForm.bankReference.trim(),
  address: entityForm.address.trim(),
  email: entityForm.email.trim(),
  phone: entityForm.phone.trim(),
  invoicePrefix: entityForm.invoicePrefix.trim(),
  updatedAt: Timestamp.now(),
  ...(logoStoragePath ? { logoStoragePath } : {})
};
```
No change to the create/update branching below it (`updateDoc`/`setDoc` calls are unaffected — they already spread `payload` as-is).

**3d. Entity list row** — the Trading Entities list (~line 5437, which today shows `Bank ref: {entity.bankReference}`) gets one more line, only when set (these are genuinely optional — many entities may go a while without a prefix or contact info configured):
```tsx
{entity.invoicePrefix && <p className="text-[10px] text-slate-300 font-medium">Invoice prefix: {entity.invoicePrefix}</p>}
```
(fast-path detail: whether to also surface address/email/phone in this compact list row, versus only in the edit modal, is a judgment call — the modal is authoritative either way. Showing invoice prefix in the list is the one addition that matters operationally, since staff scanning this list will want to spot at a glance which entities aren't numbering invoices yet.)

---

## 4. Receipt header — show entity address/email/phone, and use entity name in the thank-you line

Applies to both `CustomerPortal.tsx`'s receipt modal and `Operations.tsx`'s receipt modal (the latter per `receipt-parity-and-ledger-icons.md`'s parity fix — apply this addition to both so they stay identical, consistent with that spec's own goal).

**4a. Header block** — where the receipt currently prints (CustomerPortal ~line 3501-3505):
```tsx
{receiptTarget.order.entityId ? (
  <div className="text-[10px] text-slate-400 mt-1 space-y-0.5">
    {receiptTarget.order.entityBrn && <p>BRN: {receiptTarget.order.entityBrn}</p>}
    {receiptTarget.order.entityVatNumber && <p>VRN: {receiptTarget.order.entityVatNumber}</p>}
  </div>
) : (
```
add the three new fields inside the same block, after the existing two:
```tsx
{receiptTarget.order.entityId ? (
  <div className="text-[10px] text-slate-400 mt-1 space-y-0.5">
    {receiptTarget.order.entityBrn && <p>BRN: {receiptTarget.order.entityBrn}</p>}
    {receiptTarget.order.entityVatNumber && <p>VRN: {receiptTarget.order.entityVatNumber}</p>}
    {receiptTarget.order.entityAddress && <p>{receiptTarget.order.entityAddress}</p>}
    {receiptTarget.order.entityPhone && <p>{receiptTarget.order.entityPhone}</p>}
    {receiptTarget.order.entityEmail && <p>{receiptTarget.order.entityEmail}</p>}
  </div>
) : (
```
Mirror the same three additions in Operations' receipt modal wherever it renders the equivalent BRN/VRN block against `order.entityBrn`/`order.entityVatNumber` (per `receipt-parity-and-ledger-icons.md`, this block should already be structurally identical to CustomerPortal's after that spec is applied).

**4b. Thank-you line entity name fix** — this was already flagged as a bug in `receipt-parity-and-ledger-icons.md` (hardcoded `SYSTEM_CONFIG.businessName`); repeating it here since it's the same "use the entity, not the platform brand" idea as this whole spec. If not already applied: change the thank-you line in both receipts from
```tsx
{SYSTEM_CONFIG.businessName}
```
to
```tsx
{receiptTarget.order.entityName || SYSTEM_CONFIG.businessName}
```
(substituting the correct local variable name for Operations' modal — `activeReceiptDrop`'s resolved `order`, not `receiptTarget`). Do not apply this twice if `receipt-parity-and-ledger-icons.md` already shipped it — check the current source first.

---

## 5. What this spec deliberately does not do

- Does not backfill `entityAddress`/`entityEmail`/`entityPhone`/etc. onto any already-placed order — consistent with the project's standing no-retroactive-snapshot rule (`tierAtOrder`, invoice numbers). An order placed before this ships simply has no entity address/phone to show; the receipt block above already handles that (empty string → the `&&` guards just don't render that line).
- Does not validate email/phone format — matches this form's existing total absence of validation on BRN/VAT/bank reference.
- Does not touch `acceptedPaymentMethodIds`/`paymentMethodConfig` — those are `per-entity-payment-config.md`, a separate spec, even though they'll eventually live on the same edit modal.
