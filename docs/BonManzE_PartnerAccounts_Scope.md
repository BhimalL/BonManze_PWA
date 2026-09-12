# BonManzE — Partner Accounts: Scope (v2 — settled, ready for Antigravity's technical review)

**Date:** 2026-09-12 (v1 drafted same day; v2 below folds in Bhimal's direct answers to every open question in
v1)
**Status:** Scope settled directly with Bhimal. Ready for Antigravity's technical review before any code or
rules are written, same process every other feature in this project has gone through.

## 0. Why this came up, and how the design got here

Bhimal raised the idea of letting the business work with outside operators who aren't full BonManzE staff —
originally framed as "subcontractors": create one, assign it to a Trading Entity, and decide whether it
handles Kitchen, Delivery, or both. Per Bhimal's explicit correction, these are called **Partners**, not
subcontractors, and a Partner can have a small team of staff under it, not just one person.

The design went through several rounds of correction — first with Antigravity (three rounds, catching a
proposed unrequested `commissionRate` field, a redundant/driftable `partnerId` on orders instead of deriving
from the existing frozen `entityId`, and a custom-Auth-claims RBAC approach this codebase has never used
anywhere), then a v1 scope draft with five open questions, then a direct round with Bhimal that substantially
simplified the whole feature (this document). Kept here as the record of how the design narrowed, not because
any of it needs re-litigating.

**Explicitly distinct from something already shipped:** this is not the same thing as
`BonManzE_EntityRestrictedViews_Scope.md` (built and verified 2026-09-10). That feature is an optional,
switchable *view filter* for regular in-house staff — anyone can filter down to one entity or back to "All,"
with nothing actually blocked, because regular staff are trusted with the full org's data regardless. Partner
accounts are a **hard lock** for staff who are not fully trusted with the full org's data: a Partner staff
member must not be able to see or act on any entity other than the ones they're assigned to, and must not be
able to see anything outside the one screen they need — enforced, not just hidden in the UI (see §4).

## 1. Settled requirements

- **Terminology:** "Partner," never "subcontractor," anywhere in code, UI copy, or docs.
- **A Partner-type staff account can be one of several people** — a small team, not a single login.
- **Kitchen only — no Partner-run delivery.** Bhimal has decided delivery stays unified in-house (avoids
  payment-collection complications and other operational risk of an outside party handling delivery). This
  removes an entire dimension from the original ask ("Kitchen, Delivery, or both") — Partner staff are always
  Kitchen-scoped, full stop. No delivery scope value exists to choose.
- **Screen access: Orders by Dish only, nothing else.** No Meal Library, no Delivery List, no Payments, no
  Customer Directory, no Settings, no Transactions Ledger. Confirmed this needs no new screen-hiding mechanism
  at all — it's exactly what the existing Roles & Staff permission system already does: a "Partner" Role with
  only `ordersByDish: {view: true, edit: true}` set and every other permission group off achieves this today,
  demonstrated directly in the Roles & Staff UI already. **Edit is required, not just View** — Bhimal confirmed
  Partner kitchen staff need to be able to mark "Start Cooking" themselves, not just look at the list.
- **No customer PII exposure — and this is already true today.** Orders by Dish was checked directly against
  the live source: it shows no price and no customer phone/address at all, only an anonymized "for [name]" tag
  pulled from the order's own notes field (not the customer's real account details). Bhimal's original privacy
  concern is already satisfied by this screen's existing design — nothing further needs to change here.
- **The Delivery Sticker price question was separate from Partners entirely.** Bhimal confirmed the printed
  Delivery Sticker he was referring to is the *existing* one used by in-house delivery staff (Delivery List
  tab) — not something Partners will ever see, since Partners don't get Delivery List access at all. Removing
  item prices from that sticker (keeping customer name, phone, date, address — a general policy call, not
  partner-specific) has already shipped as its own fix, independent of this feature: commit `0edba09`
  (`fix(operations): remove item prices from printed Delivery Stickers`), verified against `origin/main`.
- **A Partner staff member can be assigned to multiple entities**, not just one — this is a change from the
  original "locked to exactly one entity" framing in v1. The lock is which entities they can see Orders by Dish
  data for, as a set, not a single value.
- **No separate `partners` collection.** Given "multiple entities per person" (not "one entity per shared
  Partner group") and Bhimal's preference to manage this entirely from the existing Roles & Staff screen, the
  simplest model is two new fields directly on `staff/{uid}`:
  ```
  staff/{uid}
    ...existing fields...
    isPartner?: boolean          // true for Partner-team staff, unset/false for regular in-house staff
    assignedEntityIds?: string[] // which entities this Partner staff member can see, when isPartner is true
  ```
  Created, edited, and deleted from the same Roles & Staff screen and staff create/edit flow already used for
  every other staff member — no new top-level Settings area, no new CRUD screen. **Known tradeoff, accepted by
  Bhimal:** there's no single shared record to bulk-reassign if an entire outside team's entity assignment
  changes at once — each staff member is edited individually. Fine at "small team" scale; worth reconsidering
  only if the number of Partner staff grows substantially.
- **Reassignment is allowed, with one guard.** Adding an entity to a Partner staff member's
  `assignedEntityIds` is always free. **Removing** one is blocked while that entity still has any order with
  at least one item in `Active` or `Preparing` status (not yet fully cooked/completed/cancelled) — mirroring
  the existing guarded-delete pattern already used for Trading Entities (blocks deletion while referenced,
  suggests Retire instead). This prevents cutting off a Partner's visibility into an entity mid-service, while
  still allowing changes once nothing is outstanding.
- **No commission or payout model, no financial fields of any kind** on the Partner staff record. If a
  commission model is ever wanted, that's a separate, future scope document.

## 2. Non-goals for this round

- No commission or payout model for Partners.
- No customer-facing changes — Partners are an Operations-side/staff concept only; nothing in
  `CustomerPortal.tsx` is affected.
- No Partner involvement in delivery, payments, or any customer data beyond what Orders by Dish already shows.
- No change to how Kitchen Display System (KDS) was previously scoped — that's a separate, already-deferred
  decision (`BonManzE_v1_scope.md`), not reopened by this document.
- No changes to the existing Entity-Restricted Operations Views feature — it stays exactly as shipped, as an
  optional filter for regular in-house staff. Partners are a separate, additive, hard-lock mechanism layered on
  the same underlying `entityId` data, not a replacement for it.

## 3. One open technical point, flagged for Antigravity's review rather than settled here

The existing Entity-Restricted Views filter is explicitly **not** a security boundary — any regular staff
member can already read any entity's data; the filter is a convenience only, because all in-house staff are
equally trusted. Partner accounts are different by design: they exist specifically to lock out an external,
less-trusted party from data outside their assignment. That means `isPartner`/`assignedEntityIds` **must be
enforced in `firestore.rules`** (and wherever the Orders by Dish data is actually queried/read), not just
filtered client-side in `Operations.tsx` — a client-side-only filter would leave every other entity's order
data readable by a Partner account that queried Firestore directly, defeating the point of a hard lock. Exact
rule structure (per-document `list` rule checking `resource.data.entityId` against a `get()`'d
`assignedEntityIds` array, most likely, mirroring how `isStaffAllowed()` already does live lookups) is left to
Antigravity's implementation plan — flagging the *requirement* here, not prescribing the rule syntax.

## 4. Suggested build sequence

1. Add `isPartner`/`assignedEntityIds` fields to `staff/{uid}` and the Roles & Staff create/edit UI (a
   checkbox + multi-select of active entities, shown only when relevant).
2. `firestore.rules` (and `storage.rules` if the Orders by Dish read path touches Storage-backed data) —
   enforce the hard entity lock server-side per §3, not just client-side.
3. `Operations.tsx` — when the signed-in staff member has `isPartner === true`, Orders by Dish's data-fetching
   filters to `assignedEntityIds` with no "All entities" option exposed (distinct from, and layered on top of,
   the existing optional `entityFilter` toggle everyone else gets).
4. Guarded reassignment — block removing an entity from `assignedEntityIds` while it has any
   Active/Preparing order, same shape as the existing guarded Trading Entity delete.
5. A "Partner" Role (as already demonstrated in the Roles & Staff screenshot) with `ordersByDish: {view: true,
   edit: true}` and every other permission group off — this part needs no new code, just using the existing
   Role system as designed.
6. Automated test coverage: a Partner staff account should be able to view and start cooking for its assigned
   entities only, and confirmed blocked (both in the UI and via a direct Firestore rules test) from any other
   entity's data and any other screen.
