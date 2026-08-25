# Multi-Tier Trading Entity System — Implementation Plan (Proposed, for Antigravity's review)

**Date:** 2026-08-25
**Status:** Proposed. Nothing below is built yet — no schema, `firestore.rules`, or Cloud Function changes exist for this feature. This document is for Antigravity's technical feedback before any of it is written, following the same discipline every other decision in `BonManzE_Firestore_Schema.md` was given first: scope in full before code.
**Grounded in:** the scoping conversation recorded in `BonManzE_v1_scope.md`'s "Multi-Tier Trading Entity System" section (all five of Antigravity's original questions — entity definition, order-to-entity mapping, billing/invoicing, support routing, operator console UX — now have real answers from Bhimal), and the existing `BonManzE_Firestore_Schema.md` design this extends.

---

## 1. What this is, in one paragraph

Bhimal runs two real, currently-operating legal entities (not a future/anticipated split — confirmed as a present MRA/accounting-separation need). BonManzE needs to track which entity a given customer's orders are billed under, print the correct legal name/BRN/VAT number/bank reference/branding on that customer's invoices, and give Operations staff visibility into which entity each order/customer belongs to — without touching pricing, tax math, the Customer App's UI/UX, or support handling, none of which vary by entity. The mechanism for assigning a customer to an entity is a new staff-reviewed approval step at registration: a customer's account is not order-capable until a staff member reviews it and assigns an entity. Staff can also reassign a customer's entity later (§4).

## 2. Settled requirements (recap — full detail in `BonManzE_v1_scope.md`)

- **Entities are a legal/tax construct only.** No customer-facing branding difference in the app itself, no multi-tenant behavior, same menu/ordering flow for everyone.
- **Two entities exist today.** Not a speculative feature for a future product line — real, current legal businesses.
- **Assignment happens at staff approval of a new registration**, and can be changed by staff later if needed — not automatically, not derived from order content, not customer-selectable either way.
- **Existing seed customers stay unassigned on the emulator deliberately**, to be run through the real approval flow as the test path. Production grandfathering (existing real customers, once this points at a real Firebase project) is an explicitly separate, later decision — not covered by this plan.
- **Rejection is a state on the account, not a deletion.** Staff-entered reason, customer can edit and resubmit.
- **Notifications are in-app-only** (a badge/counter on a new Operations tab, live via `onSnapshot`) — no email/push.
- **Invoices differ by entity in: legal name, BRN/VAT number, bank/payment reference, and branding (logo).** Tax math itself is identical everywhere — VAT rate/rules don't vary by entity, only the printed registration number does.
- **`confirmCheckout`'s pricing/tax logic does not need to branch by entity.** Entity is a rendering-time and reporting-time concern, not a pricing input.
- **Support is entity-blind.** No entity-awareness needed in any support/complaint flow (none exists today anyway).
- **Operations needs real entity visibility/filtering** on Orders by Dish, Delivery List, Payments, and Customer Directory — not just at invoice time. With only two entities, this can be a simple two-way toggle plus "All," not an open-ended picker.
- **A customer's entity assignment is not permanent** — staff can correct/change it later (§4 covers how this interacts with already-issued invoices).

## 3. Still missing before this can be built (blocking, not this plan's job to answer)

- The two entities' real legal names, BRN/VAT registration numbers, bank/payment references, and logo/branding assets. The schema below has a placeholder shape; it can't be seeded with real data until Bhimal provides this.

## 4. Schema changes

### New collection: `entities/{entityId}`

```
name: string                    // legal business name, printed on invoices
brn: string                     // Business Registration Number
vatNumber: string                // VAT registration number
bankReference: string            // payment/bank reference printed on invoices
logoStoragePath: string (optional)   // Storage path, same pattern as mains/{mainId}.photoStoragePath
active: boolean                  // deactivate without deleting history if an entity ever winds down
createdAt, updatedAt: Timestamp
```
Staff-read (`isActiveStaff()` — Operations needs this for the entity filter and for resolving an order's entity to a display name), write gated by a permission key (§6 below discusses whether that's a new `manageEntities` key or folds into `manageConfig` — recommend a dedicated key, mirroring why `manageRoles` got its own key: editing legal/tax identity is exactly the kind of sensitive, infrequent action that shouldn't ride along with routine config edits). No public/customer read — entity legal details aren't customer-facing (an invoice is rendered server-side or from a frozen snapshot, not read live by the customer's own client — see below).

### `customers/{uid}` — new fields

```
entityId: string (optional)              // → entities/{entityId} — set at approval, staff-changeable afterward
registrationStatus: 'Pending' | 'Approved' | 'Rejected'   // NEW — replaces "account exists = can order"
rejectionReason: string (optional)        // staff-entered, shown to the customer on their pending screen
```
Both `entityId` and `registrationStatus` join the existing ⚠ server-write-only field set (`points`/`storeCredit`/`tier`/`ltv`) in `firestore.rules` — a customer must never be able to self-approve or self-assign an entity. The one customer-initiated exception is the resubmission path: a customer whose status is `Rejected` needs to be able to flip it back toward review after editing their profile. Recommend modeling this as the customer being allowed to set `registrationStatus` from `Rejected` to `Pending` only (never to `Approved`, never from `Approved` to anything), enforced as an explicit state-transition check in the rule rather than a blanket unlock — the same "narrow, explicit allowed transition" style already used for the customer's payment-claim rule (decision #11 in `BonManzE_Firestore_Schema.md`).

`entityId` is **staff-writable at any time after approval, not just once** — confirmed 2026-08-25: a customer is not permanently locked to their initial entity, and staff can correct/reassign it later (e.g. if the wrong one was picked at approval, or the customer's real-world arrangement changes). This is the same staff-gated write path as the initial approval, no separate mechanism needed.

`registerCustomer` (the existing callable) changes to write `registrationStatus: 'Pending'` and no `entityId` on every new account, instead of the account being immediately order-capable.

### `orders/{orderId}` — new field

```
entityId: string     // frozen at checkout time from customers/{customerId}.entityId
```
**This freeze is now a required design element, not just a stylistic preference**, given entity reassignment is confirmed possible (§2/above): if `entityId` were resolved live from the customer document at invoice-render time instead of frozen at order-creation time, reassigning a customer to the other entity would silently rewrite which legal business *every one of their past invoices* appears to have been issued by — a real problem for a legal/tax document, not just a display glitch. Freezing it onto the order at `confirmCheckout` time means a reassignment only affects orders placed *after* the change; every already-issued invoice keeps the entity it was actually issued under. This mirrors the project's own established precedent for exactly this class of problem — `tierAtOrder` was added specifically because resolving a live value at the wrong time produced non-deterministic, retroactively-changing results (see `BonManzE_Firestore_Schema.md` §4's `onItemPaymentConfirmed` bug writeup).

`confirmCheckout` also needs a new precondition: **reject checkout entirely if the customer's `registrationStatus !== 'Approved'`** (or `entityId` is unset) — a pending or rejected customer should not be able to place an order at all, which is the actual point of the approval gate. This is a small addition to the Function's existing validation pass, not new architecture.

## 5. Cloud Functions / write paths

Following the project's own established pattern (`BonManzE_Firestore_Schema.md`'s Working Agreement: a Cloud Function only when server-computed integrity is genuinely needed; a direct client write, gated by `firestore.rules`, when the rules can already enforce the invariant):

- **Approve a pending registration** (staff action, from the new Pending Registrations tab): a direct client batch write setting `entityId` + `registrationStatus: 'Approved'`, gated by `isStaffAllowed(<permission key>)`. No server-computed value is involved — staff is picking one of two known, staff-visible entities — so this doesn't need a callable Function, consistent with how Mark Delivered/Mark Paid turned out not to need one (decision #10).
- **Reject a pending registration**: same reasoning — a direct client write setting `registrationStatus: 'Rejected'` + `rejectionReason` (free text staff types).
- **Reassign an already-approved customer's entity**: same staff-gated direct write as approval, just editing `entityId` on an already-`Approved` customer. No new mechanism — see §4.
- **Customer resubmission**: a direct client write from the Customer App, `registrationStatus: 'Rejected' → 'Pending'`, alongside whatever profile fields they edited — gated by the narrow state-transition rule described in §4.
- **`confirmCheckout`**: gains the `registrationStatus === 'Approved'` precondition and the `entityId` freeze described in §4. This is the one genuinely required change to existing server-side logic.
- **`registerCustomer`**: gains `registrationStatus: 'Pending'` on every new account (no `entityId`).

No new Cloud Function is proposed for the approve/reject/resubmit/reassign actions themselves — they fit the "rules already enforce it" pattern the project has used consistently since decision #10. Antigravity: flag if there's a reason one of these needs server-side logic beyond what a rules-gated write can express (e.g. if approval should ever trigger a side effect like a welcome notification — out of scope today per the notifications answer in §2, but worth naming if that changes).

## 6. Security rules and permissions

New considerations for `firestore.rules`:

- `customers/{uid}` `create`: no client-set `entityId`/`registrationStatus` (server/Function sets `registrationStatus: 'Pending'` via `registerCustomer`; direct client `create` of a customer doc shouldn't exist anyway, per the existing registration flow).
- `customers/{uid}` `update`: staff branch (gated by the new permission key, see below) may set `entityId` and `registrationStatus` freely, at any time — this covers initial approval and later reassignment identically; customer's own branch may only perform the narrow `Rejected → Pending` transition alongside their own editable profile fields, and must never touch `entityId`.
- `entities/{entityId}`: staff-read, write gated by a permission key.
- `orders/{orderId}` `create`: already Cloud-Function-only (`allow create: if false`, per the existing rule) — `confirmCheckout` writes `entityId` as part of the same trusted write path that already handles `total`, no new rule needed here beyond making sure the field is included in what the Function writes.

**New permission key — recommend `manageRegistrations`, not folding into `manageCustomers`.** Approving/rejecting/reassigning a registration's entity is a materially different, higher-stakes action than editing a customer's existing directory fields (name/phone/address) — the same reasoning `manageRoles` was given its own key for (a role could have every day-to-day permission except this one). `manageConfig` gates entity *record* edits (creating/editing the two `entities` documents themselves — legal name, BRN, VAT, bank ref), the same way it already gates VAT/loyalty-tier/branding config. Antigravity: this is a judgment call with only one real user today (Bhimal has every permission regardless) — flag if the extra key is overkill and folding into `manageCustomers`/`manageConfig` is preferable for simplicity.

## 7. Operator Console (`Operations.tsx`) UI changes

- **New "Pending Registrations" tab.** Live `onSnapshot` on `customers` filtered by `registrationStatus == 'Pending'`, same pattern as every other Operations listener. Shows the registrant's submitted profile info, an entity picker (two options, given §2), an Approve action, and a Reject action with a free-text reason field. Tab label carries a live count badge (the in-app notification requirement from §2).
- **Existing four screens (Orders by Dish, Delivery List, Payments, Customer Directory)** each get an entity indicator (badge/column) and a filter control. Given exactly two entities, recommend a simple three-way toggle (Entity A / Entity B / All) rather than a multi-select or dropdown built for an arbitrary number — sized to what's actually needed, not built for hypothetical future entity counts.
- **Customer Directory** additionally needs: (a) `registrationStatus` shown for customers who aren't yet Approved, so staff have one place to see the full lifecycle, not just the dedicated Pending tab; (b) a way to change an already-Approved customer's `entityId` (the reassignment path from §4/§5) — likely the simplest place to put this is right alongside the existing entity badge on that customer's row/detail view, not a separate screen.

## 8. Customer App (`CustomerPortal.tsx`) UI changes

- **New "awaiting confirmation" screen**, shown in place of the normal app when `registrationStatus === 'Pending'` — mirrors the existing gating pattern already used for signed-out/staff-only states.
- **Rejection state**: shows the staff-entered `rejectionReason`, with the existing profile-edit form available and a resubmit action that performs the `Rejected → Pending` write from §5.
- **No other Customer App change.** Per §2, entities are invisible to the ordering experience itself — no entity picker, no entity-specific branding anywhere in the customer-facing app, and no customer-visible indication if staff reassign their entity later.

## 9. Invoice/receipt rendering

Wherever an invoice or receipt is currently rendered (client-side, from `order` + `items` data — the existing receipt sheet in `CustomerPortal.tsx`/Operations' equivalent), it needs to resolve `order.entityId` → the corresponding `entities/{entityId}` document's `name`/`brn`/`vatNumber`/`bankReference`/`logoStoragePath` and print those instead of (or alongside) whatever generic business info is hardcoded today. Since `entityId` is frozen on the order (§4) — and stays frozen even if the customer is later reassigned — this is a straightforward lookup against the `entities` collection (which both apps can read — staff directly, and the customer's own client would need read access scoped to *their own orders'* entity at minimum; simplest is public-read on `entities` for just the display fields, since legal business name/VAT number being publicly visible on a receipt is not a meaningful information leak — Antigravity: flag if this should instead be a narrower rule).

## 10. Suggested build sequence

1. Seed the two real `entities` documents once Bhimal provides the legal details (§3).
2. `firestore.rules`: `entities` collection rules, `customers/{uid}` field-lock updates (`entityId`/`registrationStatus`/`rejectionReason`), the narrow customer resubmission transition rule.
3. `registerCustomer`: add `registrationStatus: 'Pending'`.
4. `confirmCheckout`: add the `Approved`-only precondition and the `entityId` freeze.
5. Operations: new Pending Registrations tab (approve/reject writes, live count badge), the entity filter/badge added to the four existing screens, and the reassignment control on Customer Directory.
6. Customer App: awaiting-confirmation screen, rejection + resubmit UI.
7. Invoice/receipt rendering: resolve and print entity fields from the frozen `order.entityId`.
8. Regression-test against the existing seed customers exactly as scoped in `BonManzE_v1_scope.md`: leave them unassigned, run each through the real Pending Registrations approval flow, confirm a rejected-then-resubmitted customer's flow end to end, confirm `confirmCheckout` genuinely blocks a Pending/Rejected customer, and confirm reassigning an already-approved customer's entity does NOT change the `entityId` on any of their pre-existing orders.

## 11. Explicit non-goals (for the avoidance of doubt)

- No pricing or VAT-rate branching by entity anywhere in `confirmCheckout` — confirmed identical tax math per §2.
- No entity-awareness in any support/complaint flow, present or future — confirmed entity-blind per §2.
- No Customer App branding/UI change by entity — same app, same experience, for every customer regardless of entity.
- No automatic/derived entity assignment (e.g., from order type or product line) — confirmed manual, staff-driven, for this round, whether at initial approval or a later reassignment. Revisit only if/when the dinner-delivery or meal-kit product lines actually launch and need their own entity mapping logic — not before, per this project's standing discipline against building ahead of validated need.
- No retroactive rewrite of past invoices on reassignment — confirmed via the `entityId` freeze in §4.

## 12. Open questions for Antigravity specifically

- Is a dedicated `manageRegistrations` permission key (§6) worth the added complexity given there's currently one staff user with every permission anyway, or should this fold into an existing key?
- Any concern with public-read on `entities`' display fields for receipt rendering (§9), versus a narrower staff/owning-customer-only read rule?
- Any concern with putting the entity-reassignment control directly on Customer Directory (§7) rather than as a dedicated action/screen, given it's expected to be rare?
