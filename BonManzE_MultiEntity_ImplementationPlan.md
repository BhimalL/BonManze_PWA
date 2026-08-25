# Multi-Tier Trading Entity System — Implementation Plan (v2, finalized after Antigravity's technical review)

**Date:** 2026-08-25
**Status:** Design finalized. No schema, `firestore.rules`, or Cloud Function changes exist for this feature yet — this is still the plan to build from, not a record of what's built. Every open design question has now been debated and settled (see §12).
**Grounded in:** the scoping conversation recorded in `BonManzE_v1_scope.md`'s "Multi-Tier Trading Entity System" section (all five of Antigravity's original questions — entity definition, order-to-entity mapping, billing/invoicing, support routing, operator console UX — have real answers from Bhimal), and the existing `BonManzE_Firestore_Schema.md` design this extends.

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
- **A customer's entity assignment is not permanent** — staff can correct/change it later.
- **Real future staff differentiation is coming** — Bhimal confirmed the plan is admin / kitchen / delivery roles, not just himself forever. This directly shaped the permission-key decision in §6.

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
**Staff-read only (`isActiveStaff()`), not public** — final, after debate (see §12 Q2). No client ever needs a live read of this collection for rendering an invoice; a customer's own client never reads `entities` at all. Staff read it only to populate the entity picker (registration approval, reassignment) and the Operator Console's entity filter. Write gated by `manageConfig` (§6) — editing legal/tax identity is the same tier of sensitive, infrequent action as VAT settings/loyalty tiers, which `manageConfig` already covers.

### `customers/{uid}` — new fields

```
entityId: string (optional)              // → entities/{entityId} — set at approval, staff-changeable afterward
registrationStatus: 'Pending' | 'Approved' | 'Rejected'   // NEW — replaces "account exists = can order"
rejectionReason: string (optional)        // staff-entered, shown to the customer on their pending screen
```
Both `entityId` and `registrationStatus` join the existing ⚠ server-write-only field set (`points`/`storeCredit`/`tier`/`ltv`) in `firestore.rules` — a customer must never be able to self-approve or self-assign an entity. The one customer-initiated exception is the resubmission path: a customer whose status is `Rejected` needs to be able to flip it back toward review after editing their profile. Recommend modeling this as the customer being allowed to set `registrationStatus` from `Rejected` to `Pending` only (never to `Approved`, never from `Approved` to anything), enforced as an explicit state-transition check in the rule rather than a blanket unlock — the same "narrow, explicit allowed transition" style already used for the customer's payment-claim rule (decision #11 in `BonManzE_Firestore_Schema.md`).

`entityId` is staff-writable at any time after approval, not just once — a customer is not permanently locked to their initial entity; staff can correct/reassign it later (e.g. if the wrong one was picked at approval, or the customer's real-world arrangement changes). Same staff-gated write path as the initial approval, no separate mechanism.

`registerCustomer` (the existing callable) changes to write `registrationStatus: 'Pending'` and no `entityId` on every new account, instead of the account being immediately order-capable.

### `orders/{orderId}` — new fields (revised after debate — see §12 Q2)

```
entityId: string             // frozen at checkout time from customers/{customerId}.entityId
entityName: string            // \
entityBrn: string             //  | denormalized snapshot of the entity's display fields,
entityVatNumber: string       //  | frozen at checkout time — same pattern as customerName
entityBankReference: string   //  | being denormalized onto the order today
entityLogoStoragePath: string (optional)  // /
```
**All of these are frozen onto the order at `confirmCheckout` time, not just `entityId`.** Freezing `entityId` alone was the original plan, but debating Q2 (§12) surfaced a cleaner design: rather than a client resolving `order.entityId` against a live (or public) read of `entities` to render an invoice, `confirmCheckout` denormalizes the actual display fields onto the order itself, exactly the way `customerName` is already denormalized onto orders today so nothing needs a parent lookup to render. Two real benefits over the entityId-only version: (1) no client — customer or staff — needs to read the `entities` collection live to render a receipt, so `entities` can stay strictly staff-read (§4), closing the public-read exposure question entirely rather than just narrowing it; (2) invoice stability gets *stronger*, not just preserved — if an entity's legal details are ever corrected (a BRN typo fixed, a bank reference changed), every already-issued invoice stays byte-for-byte exactly as it was issued, not merely "pointing at the right entity ID whose current fields happen to be shown." This mirrors the project's own `tierAtOrder` precedent for the same underlying problem (resolving a value live at the wrong time produces retroactively-changing results — see `BonManzE_Firestore_Schema.md` §4).

`confirmCheckout` also needs a new precondition: **reject checkout entirely if the customer's `registrationStatus !== 'Approved'`** (or `entityId` is unset) — a pending or rejected customer should not be able to place an order at all, which is the actual point of the approval gate. This is a small addition to the Function's existing validation pass, not new architecture.

## 5. Cloud Functions / write paths

Following the project's own established pattern (`BonManzE_Firestore_Schema.md`'s Working Agreement: a Cloud Function only when server-computed integrity is genuinely needed; a direct client write, gated by `firestore.rules`, when the rules can already enforce the invariant):

- **Approve a pending registration** (staff action, from the new Pending Registrations tab): a direct client batch write setting `entityId` + `registrationStatus: 'Approved'`, gated by `isStaffAllowed('manageRegistrations')` (§6). No server-computed value is involved — staff is picking one of two known, staff-visible entities — so this doesn't need a callable Function, consistent with how Mark Delivered/Mark Paid turned out not to need one (decision #10).
- **Reject a pending registration**: same reasoning — a direct client write setting `registrationStatus: 'Rejected'` + `rejectionReason` (free text staff types).
- **Reassign an already-approved customer's entity**: same staff-gated direct write as approval, just editing `entityId` on an already-`Approved` customer. No new mechanism.
- **Customer resubmission**: a direct client write from the Customer App, `registrationStatus: 'Rejected' → 'Pending'`, alongside whatever profile fields they edited — gated by the narrow state-transition rule described in §4.
- **`confirmCheckout`**: gains the `registrationStatus === 'Approved'` precondition and the full entity-snapshot freeze described in §4 (`entityId` + `entityName`/`entityBrn`/`entityVatNumber`/`entityBankReference`/`entityLogoStoragePath`). This is the one genuinely required change to existing server-side logic.
- **`registerCustomer`**: gains `registrationStatus: 'Pending'` on every new account (no `entityId`).

No new Cloud Function is proposed for the approve/reject/resubmit/reassign actions themselves — they fit the "rules already enforce it" pattern the project has used consistently since decision #10.

## 6. Security rules and permissions (revised after debate — see §12 Q1)

New considerations for `firestore.rules`:

- `customers/{uid}` `create`: no client-set `entityId`/`registrationStatus` (server/Function sets `registrationStatus: 'Pending'` via `registerCustomer`; direct client `create` of a customer doc shouldn't exist anyway, per the existing registration flow).
- `customers/{uid}` `update`: staff branch (gated by `manageRegistrations`, see below) may set `entityId` and `registrationStatus` freely, at any time — this covers initial approval and later reassignment identically; customer's own branch may only perform the narrow `Rejected → Pending` transition alongside their own editable profile fields, and must never touch `entityId`.
- `entities/{entityId}`: staff-read only (`isActiveStaff()`), write gated by `manageConfig`.
- `orders/{orderId}` `create`: already Cloud-Function-only (`allow create: if false`, per the existing rule) — `confirmCheckout` writes the full entity snapshot as part of the same trusted write path that already handles `total`; no new rule needed beyond making sure those fields are included in what the Function writes.

**New permission key: `manageRegistrations` — final decision, kept separate from `manageCustomers`.** Antigravity's initial recommendation was to fold registration approval/rejection/reassignment into the existing `manageCustomers` key, reasoning that with a single staff user today (Bhimal, who has every permission regardless) a dedicated key is pure overhead. That held up fine as an argument about *today*, but Bhimal confirmed the real near-term plan is admin/kitchen/delivery staff roles, not permanent single-operator status — and `manageCustomers` is already defined as a broad, routine permission ("customer directory edits"). Folding registration approval into it would mean any future staff role granted ordinary customer-editing rights (e.g. a delivery role that needs to fix an address) automatically also gets the power to approve new customers and decide which legal entity bears the tax liability for their orders — a materially more consequential action bundled into routine data entry. That's exactly the privilege-escalation risk `manageRoles` was already given its own key to prevent ("a role could have every day-to-day permission except this one"), and the cost of a dedicated key is genuinely trivial — the `roles` collection's flat permission map was explicitly designed so new keys don't need a migration (`BonManzE_Firestore_Schema.md` §3). Given real staff differentiation is actually coming, not hypothetical, `manageRegistrations` stays its own key. `manageConfig` continues to gate the `entities` *records* themselves (creating/editing the two legal entities' name/BRN/VAT/bank ref) — that part of Antigravity's proposal is adopted as-is, since it's genuinely the same tier of action as other things `manageConfig` already covers.

## 7. Operator Console (`Operations.tsx`) UI changes

- **New "Pending Registrations" tab.** Live `onSnapshot` on `customers` filtered by `registrationStatus == 'Pending'`, same pattern as every other Operations listener. Shows the registrant's submitted profile info, an entity picker (two options, given §2, populated from the staff-read `entities` collection), an Approve action, and a Reject action with a free-text reason field. Tab label carries a live count badge (the in-app notification requirement from §2).
- **Existing four screens (Orders by Dish, Delivery List, Payments, Customer Directory)** each get an entity indicator (badge/column) and a filter control. Given exactly two entities, recommend a simple three-way toggle (Entity A / Entity B / All) rather than a multi-select or dropdown built for an arbitrary number — sized to what's actually needed, not built for hypothetical future entity counts.
- **Customer Directory** additionally needs: (a) `registrationStatus` shown for customers who aren't yet Approved, so staff have one place to see the full lifecycle, not just the dedicated Pending tab; (b) a way to change an already-Approved customer's `entityId` (the reassignment path from §4/§5) — placed inline on that customer's row/detail view (an entity badge with an edit control), not a separate screen, since reassignment is expected to be rare. No debate on this placement — confirmed with Antigravity's own reasoning.

## 8. Customer App (`CustomerPortal.tsx`) UI changes

- **New "awaiting confirmation" screen**, shown in place of the normal app when `registrationStatus === 'Pending'` — mirrors the existing gating pattern already used for signed-out/staff-only states.
- **Rejection state**: shows the staff-entered `rejectionReason`, with the existing profile-edit form available and a resubmit action that performs the `Rejected → Pending` write from §5.
- **No other Customer App change.** Per §2, entities are invisible to the ordering experience itself — no entity picker, no entity-specific branding anywhere in the customer-facing app, and no customer-visible indication if staff reassign their entity later (a reassignment only affects future orders — see §4).

## 9. Invoice/receipt rendering (revised after debate — see §12 Q2)

Wherever an invoice or receipt is currently rendered (client-side, from `order` + `items` data — the existing receipt sheet in `CustomerPortal.tsx`/Operations' equivalent), it now reads the entity display fields directly off the `order` document (`entityName`/`entityBrn`/`entityVatNumber`/`entityBankReference`/`entityLogoStoragePath`, denormalized at checkout per §4) instead of looking up `entities/{entityId}` at all. **No client — customer or staff — needs read access to the `entities` collection to render a receipt.** This is simpler than either option originally posed in §12 (a public read, or a narrower owning-customer-only rule): there's no rule to write here at all, because there's no live read in the render path. `entities` stays staff-read-only (§4/§6), used only by Operations for the entity picker and filter.

## 10. Suggested build sequence

1. Seed the two real `entities` documents once Bhimal provides the legal details (§3).
2. `firestore.rules`: `entities` collection rules (staff-read, `manageConfig`-write), `customers/{uid}` field-lock updates (`entityId`/`registrationStatus`/`rejectionReason`), the narrow customer resubmission transition rule, the new `manageRegistrations` permission key.
3. `registerCustomer`: add `registrationStatus: 'Pending'`.
4. `confirmCheckout`: add the `Approved`-only precondition and the full entity-snapshot freeze (`entityId` + display fields).
5. Operations: new Pending Registrations tab (approve/reject writes, live count badge), the entity filter/badge added to the four existing screens, and the reassignment control on Customer Directory.
6. Customer App: awaiting-confirmation screen, rejection + resubmit UI.
7. Invoice/receipt rendering: read entity fields directly off the order document — no `entities` lookup needed client-side.
8. Regression-test against the existing seed customers exactly as scoped in `BonManzE_v1_scope.md`: leave them unassigned, run each through the real Pending Registrations approval flow, confirm a rejected-then-resubmitted customer's flow end to end, confirm `confirmCheckout` genuinely blocks a Pending/Rejected customer, and confirm reassigning an already-approved customer's entity does NOT change the entity snapshot on any of their pre-existing orders.

## 11. Explicit non-goals (for the avoidance of doubt)

- No pricing or VAT-rate branching by entity anywhere in `confirmCheckout` — confirmed identical tax math per §2.
- No entity-awareness in any support/complaint flow, present or future — confirmed entity-blind per §2.
- No Customer App branding/UI change by entity — same app, same experience, for every customer regardless of entity.
- No automatic/derived entity assignment (e.g., from order type or product line) — confirmed manual, staff-driven, for this round, whether at initial approval or a later reassignment. Revisit only if/when the dinner-delivery or meal-kit product lines actually launch and need their own entity mapping logic — not before, per this project's standing discipline against building ahead of validated need.
- No retroactive rewrite of past invoices on reassignment or on a later correction to an entity's own legal details — confirmed via the full entity-snapshot freeze in §4.
- No live or public client read of the `entities` collection anywhere — confirmed via the denormalization design in §4/§9.

## 12. Design questions — debated and resolved 2026-08-25

Antigravity reviewed this plan and proposed answers to three open questions; each was then debated directly with Bhimal rather than accepted as given, since two of the three had a real trade-off underneath the surface-level simplicity argument.

**Q1 — dedicated permission key, or fold into `manageCustomers`?** Antigravity proposed folding registration approval/reassignment into `manageCustomers` (simpler with one staff user today). Resolved: kept as a separate `manageRegistrations` key instead, because Bhimal confirmed real future staff differentiation (admin/kitchen/delivery) is actually coming — folding it in would let any future role with routine customer-edit rights also approve registrations and assign legal-entity tax liability, the exact privilege-bundling risk `manageRoles` already has its own key to avoid. See §6 for the full reasoning.

**Q2 — public read on `entities`, or narrower?** Antigravity proposed public-read, reasoning the fields are receipt-facing anyway. Resolved: neither public-read nor a narrower rule — the better fix was to denormalize the entity's display fields onto the order at checkout (mirroring the existing `customerName` pattern), so no client ever needs to read `entities` live at all. This closes the "is `bankReference` sensitive enough to worry about" question entirely rather than just narrowing the exposure, and makes historical invoices more robust, not just adequately protected. See §4/§9.

**Q3 — reassignment control placement.** Antigravity proposed placing it inline on Customer Directory rather than a dedicated screen. No counter-argument surfaced — adopted as proposed. See §7.
