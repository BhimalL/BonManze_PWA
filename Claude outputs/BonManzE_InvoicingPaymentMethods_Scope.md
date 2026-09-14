# BonManzE — Invoicing (Order/Invoice Numbering), Entity Contact Details & Managed Payment Methods: Scope

**Date:** 2026-09-10
**Status:** Scope drafted with Bhimal directly, following a content review of the receipt (which surfaced the underlying gaps this document scopes) and a live-caught bug (a dead "Payment Instructions" bank-transfer block firing on a Cash-on-Delivery receipt, using placeholder entity data — see §6, handled as its own fast-path fix, independent of everything else here). Ready for Antigravity's technical review before any of §1–§5 is built, matching how every other feature in this project (Multi-Entity, Granular Permissions, Entity-Restricted Views) got a real review before code was written against its scope doc.

## Why this now

Reviewing the receipt's actual content (not its look, which Bhimal is happy with) surfaced three real gaps, in order of discovery:

1. The receipt's "Invoice ref" is not a real invoice number — it's Firestore's raw auto-generated document ID (e.g. `Dpkri7CTcWksP8RAzV2T`), because nothing in the app has ever generated a proper one.
2. Trading Entities have no address, email, or phone on file at all — confirmed directly against the Add/Edit Entity form in `Operations.tsx`, which today only has four fields: Entity Name, BRN, VAT Number, Bank Reference (plus a logo upload).
3. Payment methods are not a real managed thing — `PaymentMethod`/`subscribeToPaymentMethods`/`updatePaymentMethods` all exist in `store.ts`, but `PAYMENT_METHODS` is a hardcoded in-memory array (not Firestore-backed at all), `updatePaymentMethods` is never called by any UI, and there is no Settings tab to manage methods, no per-entity acceptance, and no per-method configuration (e.g. which phone number Juice should quote).

All three are genuinely separate pieces of work, but they compound naturally — a real invoice number is entity-scoped, entity contact details belong on the same record, and per-entity payment configuration is the same "entity owns its own billing identity" idea applied to a third field. Scoped together here rather than as three disconnected tickets.

## 1. Settled requirements

- **Order/invoice reference numbering becomes real and configurable per entity** — a proper formatted number (per-entity prefix + a continuous 9-digit sequence, no reset), not Firestore's raw document ID, generated at checkout and frozen onto the order the same way every other entity field already is.
- **Trading Entities gain address, email, and phone fields**, which flow onto the receipt the same way name/BRN/VAT/bank reference already do (denormalized at checkout, so a later edit to an entity's address never rewrites an already-issued receipt — the same historical-accuracy principle this project has followed since `tierAtOrder`).
- **Payment methods become a real managed collection**, with a new Settings tab to add, edit, and retire them (not hard-delete — see §3's reasoning).
- **Each entity configures which payment methods it accepts**, and **configures each accepted method's own details** (e.g. which phone number Juice should quote for that entity) — because separate trading entities are separate legal businesses with their own bank accounts and wallet numbers, this is per-entity-per-method, not one global config per method.
- Two open questions were originally left to Claude's judgment, decided in §4/§5; the invoice-numbering one was then simplified further by Bhimal directly (§5 — no reset, no year, continuous 9-digit sequence):
  - Whether invoice numbers reset each year — **superseded: no reset at all, per Bhimal's direct instruction.**
  - Whether retiring a payment method hides it everywhere or only from new selections — decided in §4, unchanged.

## 2. Technical grounding (current state, read directly from source)

**`Entity` (`types.ts`) today:**
```ts
export interface Entity {
  id: string;
  name: string;
  brn: string;
  vatNumber: string;
  bankReference: string;
  logoStoragePath?: string;
  active: boolean;
  createdAt: any;
  updatedAt: any;
}
```
No address, email, or phone field exists. `firestore.rules` gates `entities/{entityId}` writes on `isStaffAllowed('tradingEntities', 'edit')` — the same permission this scope's new entity fields will be written under, no new permission key needed for §2/§4's entity-side additions.

**`Order` (`types.ts`) today** carries the checkout-time entity snapshot (`entityId`, `entityName`, `entityBrn`, `entityVatNumber`, `entityBankReference`, `entityLogoStoragePath`), written once by the `confirmCheckout` Cloud Function and never re-read live from `entities/{entityId}` — this is the existing pattern §2 and §5's new order fields extend, not a new idea.

**`PaymentMethod` (`types.ts`) today:**
```ts
export interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  isActive: boolean;
  type: 'Cash' | 'Card' | 'Digital' | 'Voucher';
  applicableTo: ('Dine-In' | 'Takeout' | 'Delivery' | 'Meal Plan')[];
}
```
The shape is already sound. What's missing is anywhere it actually lives: `PAYMENT_METHODS` in `store.ts` is a plain `export let` array — not a Firestore collection, no `firestore.rules` entry exists for it at all (confirmed by grep — `paymentMethods` matches nothing in the rules file today). `subscribeToPaymentMethods`/`updatePaymentMethods` are real listener plumbing sitting unused; no button anywhere calls `updatePaymentMethods`. Both apps currently filter available methods against a second hardcoded list, `MEAL_PLAN_PAYMENT_METHOD_NAMES = ['Juice / Transfer', 'MauCAS', 'Cash on Delivery']`, rather than each method's own `applicableTo`/`isActive` fields — a shortcut this scope removes in favor of using the fields that already exist for exactly this purpose.

**Precedent this scope reuses rather than reinvents:**
- `loyaltyTiers`/`customerGroups` are each a single Firestore document holding the whole list (`BonManzE_Firestore_Schema.md`'s own description: "2 single docs, same 'whole list' reasoning as the add-on catalogs") — §3's new `paymentMethods` collection follows the identical shape.
- `roles/{roleId}.permissions` is a flat, extensible string-keyed map specifically so new keys can be added later without a schema migration — §4's per-method config re-uses this exact idea rather than hardcoding a fixed field set per payment-method type.
- Retired Trading Entities are excluded from *new*-assignment pickers but stay visible/filterable in historical and reporting views (`BonManzE_EntityRestrictedViews_Scope.md` §1) — §4's retired-payment-method behavior is the same rule applied to a new entity type, not a new policy invented for this doc.
- Every entity-derived receipt field today is a checkout-time snapshot, never a live lookup, specifically so a later correction never rewrites an already-issued document — §2 and §5 both follow this without exception.

## 3. Payment Methods: a real managed collection

- **New Firestore doc**, `paymentMethods` (single document holding a `PaymentMethod[]`, mirroring `loyaltyTiers`/`customerGroups`), seeded once from today's hardcoded six-entry array so nothing currently offered at checkout disappears on cutover.
- **New permission key, `paymentMethods` (view/edit pair)** — added to the `RolePermissions` schema and the Roles & Staff UI, and to `firestore.rules`:
  ```
  match /paymentMethods/{docId} {
    allow read: if true; // customers need this to render the Pay sheet, same reasoning as config/loyaltyTiers
    allow write: if isStaffAllowed('paymentMethods', 'edit');
  }
  ```
- **New Settings sub-tab, "Payment Methods,"** reusing the existing Loyalty Tiers/Customer Groups list-plus-add/edit-modal UI pattern: name, icon, type, applicable order types, and active/retired — not a delete button. A method is **retired, never deleted**, for the same reason Trading Entities and staff already work this way: an order/item's `paymentMethodName` is a plain string snapshot, and deleting the method it references out from under it would leave old receipts, Payments-tab rows, and the Transactions Ledger holding a name with nothing behind it.
- `MEAL_PLAN_PAYMENT_METHOD_NAMES` is retired as a concept — every place that filtered against it (`CustomerPortal.tsx`'s `applicablePaymentMethods`, Operations' Payments-tab confirm dropdown) switches to filtering the real methods by their own `isActive` + `applicableTo` fields instead.

## 4. Per-entity payment configuration, and the two delegated design decisions

**New `Entity` fields:**
```ts
acceptedPaymentMethodIds?: string[];               // absent/empty = accept every active method applicable to the order type — see fallback note below
paymentMethodConfig?: { [paymentMethodId: string]: Record<string, string> };
```
`acceptedPaymentMethodIds` is deliberately optional-with-a-permissive-fallback: an entity that never gets this configured (every entity that exists before this ships) keeps offering every active, applicable method exactly as today — this is not a feature that can silently narrow anyone's payment options by simply shipping.

`paymentMethodConfig` is a flat, per-method key/value map — not a fixed schema — for the same reason `roles/{roleId}.permissions` is flat: Juice needs a phone number, MauCAS might need a merchant ID or QR reference, Cash needs nothing at all, and a payment method type invented next year needs whatever it needs without a schema migration. The Trading Entity edit form gets a small generic key/value editor per accepted method (label + value pairs), not a hardcoded field per method type — with a suggested-label hint where one's obvious (e.g. "Phone number" pre-filled as a hint for a method literally named "Juice") purely as a UX nicety, not a structural requirement.

**Where this is configured:** the existing Trading Entity Add/Edit modal in Settings gains a checklist of active payment methods (which this entity accepts) and, per checked method, an expandable config block for that method's own details.

**Checkout/pay-sheet filtering** (`CustomerPortal.tsx`'s `applicablePaymentMethods`, and Operations' Payments-tab confirm dropdown) both add one more filter pass on top of the existing `isActive`/`applicableTo` checks: when the order/item's entity has a non-empty `acceptedPaymentMethodIds`, only those show; otherwise, unchanged behavior (all applicable active methods).

**Delegated decision — retiring a payment method:** retiring one (`isActive: false`) removes it from every *new-selection* surface immediately — the Customer App's Pay sheet and Operations' Payments-tab confirmation dropdown — but changes nothing about how it displays wherever it's already been recorded: an order/item whose `paymentMethodName` already references it keeps showing that name normally on receipts, in the Payments tab, and in the Transactions Ledger (including CSV export), forever. This is not a new policy — it's the exact rule this project already applies to retired Trading Entities, applied here to a second entity type for consistency rather than inventing a second convention.

**Delegated decision — non-goal flagged alongside this:** the existing `entityBankReference` field is left exactly as-is in this round, not folded into the new `paymentMethodConfig` mechanism — see §6's non-goals for why, and for what a future "real Bank Transfer method" would look like if ever wanted.

## 5. Order/invoice numbering

**Revised 2026-09-10, after discussion with Bhimal — simpler than the original draft below the line.** No yearly reset, no year embedded at all: each entity gets its own prefix and a single continuous 9-digit sequence that never resets, full stop. Kept intentionally simple rather than exposing reset/padding as separate configurable knobs — one thing is entity-configurable (the prefix), everything else is a fixed, generous format that won't need revisiting.

**New `Entity` fields:**
```ts
invoicePrefix: string;          // free text, e.g. "INV-A" — entity sets this directly, no derivation from name/BRN
invoiceNumberCounter: number;    // internal running count, not user-edited — see counter mechanics below
```
**Matching `SYSTEM_CONFIG` fields** (`defaultInvoicePrefix`/`defaultInvoiceNumberCounter`) cover orders with no assigned entity, the same fallback relationship the receipt already has for the VAT number when no entity is set.

**Counter mechanics:** `invoiceNumberCounter` is a single running integer on the entity document (no year-keying, no map — one number). `confirmCheckout` reads, increments, and writes it inside a single Firestore transaction — the same reason `total`/`subtotal`/`vat` are server-computed rather than client-written today: two customers checking out at the same instant must never be able to claim the same number, which a client-side counter cannot guarantee.

**Composed format:** `{prefix}-{sequence, zero-padded to 9 digits}` — e.g. `INV-A-000000143`. Nine digits gives roughly a billion invoices per entity before it would ever need revisiting, which for this business is effectively "never" — not a number chosen to be tight, deliberately chosen to be a non-issue. This composed string is written once onto the order (`invoiceNumber: string`) at checkout, frozen forever exactly like every other entity-derived order field — a later change to an entity's prefix never touches an already-issued number.

**Receipt change:** "Invoice ref"/"Invoice refs" displays `order.invoiceNumber` when present, falling back to the raw order ID for any order that predates this feature (see §6 — no retroactive numbering).

---
*Original draft (superseded by the revision above, kept for the record): proposed a per-entity yearly reset, defaulted on, with the year embedded in the printed number (`INV-A-2026-0143`) and an entity-level toggle to turn reset off. Reasoning at the time was that the entities exist for MRA/tax compliance and a resetting invoice book is the conventional shape for that kind of business — a reasonable case, but Bhimal opted for the simpler continuous-9-digit scheme instead once he saw the option written out, which removes the reset-boundary/fiscal-year question entirely rather than needing to answer it.*

## 6. Explicit non-goals

- **No retroactive invoice numbers.** Orders placed before this ships keep showing their raw Firestore document ID as "Invoice ref" — consistent with this project's standing rule against rewriting history (entity snapshot freeze, `tierAtOrder`, the ratings-lock-after-submission precedent).
- **No literal "Bank Transfer" payment method is being built or restored.** Reviewing the receipt's content this session found its existing "Payment Instructions" block (bank name + reference + "quote this ref") firing on every receipt regardless of how the customer actually paid — including a live Cash-on-Delivery order — while printing placeholder entity data ("PLACEHOLDER-BANK-A"). That block is being removed outright as a fast-path fix, independent of and prior to everything else in this document; `entityBankReference` itself is left untouched, not migrated into the new `paymentMethodConfig` mechanism. If a genuine manual-bank-transfer payment method is ever wanted, it's a natural fit for the system this document builds — its own `paymentMethods` entry, with per-entity bank details living in that entity's `paymentMethodConfig` — but that's future work, not required to close this scope.
- **No invoice-number reset at all, of any kind** (calendar-year, fiscal-year, or otherwise) — a deliberate simplification Bhimal chose directly over the originally-drafted yearly-reset design; see §5.
- **No hard delete of payment methods** — retire/reactivate only, matching Trading Entities and staff.
- **No change to the actual payment-collection mechanics** (the Juice-app handoff, the MauCAS QR scan) — this scope is about who can accept what, and how each entity's version of a method is labeled/configured, not about rebuilding how a payment is actually made.
- **No entity-specific Customer App branding beyond the receipt** — the new address/email/phone fields are receipt content only, consistent with the Multi-Entity plan's existing non-goal that entities stay invisible to the ordering experience itself.

## 7. Suggested build sequence

1. **Independent, fast-path, ship immediately:** remove the dead "Payment Instructions" bank-transfer block from the receipt (§6) — pure UI removal, no schema change, doesn't need to wait for anything below.
2. **Entity contact fields:** add `address`/`email`/`phone` to `Entity` + the Trading Entity form; extend `confirmCheckout`'s existing entity-snapshot freeze to denormalize these three onto the order the same way as the current four; add them to the receipt header block.
3. **Payment Methods as a real collection:** new `paymentMethods` document (seeded from today's hardcoded array), new `paymentMethods` permission key + Roles & Staff wiring, new Settings sub-tab (list/add/edit/retire), `firestore.rules` entry, and retiring `MEAL_PLAN_PAYMENT_METHOD_NAMES` in favor of each method's own fields.
4. **Per-entity payment configuration:** `acceptedPaymentMethodIds` + `paymentMethodConfig` on `Entity`; the Trading Entity form's method checklist + per-method config editor; both apps' method-filtering logic updated to respect an entity's accepted list (with the permissive empty-list fallback).
5. **Invoice/order numbering:** the entity + `SYSTEM_CONFIG` prefix/counter fields, the transactional per-entity counter, `confirmCheckout`'s composed-and-frozen `invoiceNumber` (prefix + continuous 9-digit sequence, no reset), and the receipt's ref display switching over (with the no-retroactive-numbering fallback for older orders).
6. **Manual QA pass**, the step every feature in this project has learned not to skip: place real orders against two entities with different prefixes and confirm the printed numbers match and keep incrementing correctly across multiple orders for the same entity; retire a payment method and confirm it disappears from both pick-lists while an already-placed order using it still displays correctly everywhere historical; confirm an entity with no `acceptedPaymentMethodIds` set still offers every method it did before this shipped (no silent regression for entities that existed before this feature).

**Working Agreement note:** essentially all of §2–§5 touches either `firestore.rules`, a Cloud Function (`confirmCheckout`), or a new write-path (payment-method eligibility, invoice-number generation) — squarely the slow path. Claude authors these; Antigravity executes the exact commits. Only item 1 above (the dead receipt block) is fast-path and can proceed on Antigravity's own authority independent of the rest of this document's timeline.
