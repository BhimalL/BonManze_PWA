# BonManzE — Partner Accounts: Scope (v2 — settled, ready for Antigravity's technical review)

**Date:** 2026-09-12 (v1 drafted same day; v2 below folds in Bhimal's direct answers to every open question in
v1)
**Status:** Scope settled directly with Bhimal. Ready for Antigravity's technical review before any code or
rules are written, same process every other feature in this project has gone through.

**Status update (2026-09-12, later same day):** built, independently verified (rules, `confirmCheckout`,
indexes, types, UI, and the entity-scoped query fix all confirmed against actual source and `origin/main`, not
just Antigravity's self-report), and now partway through a live manual click-through with Bhimal. One real bug
found and still open (the entity filter dropdown), and one requirement amended based on what testing surfaced
(Dashboard access) — see §5. Not yet closed; §5 is the live record of where this stands.

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
- **Screen access: Orders by Dish, plus a non-financial Dashboard — nothing else.** No Meal Library, no
  Delivery List, no Payments, no Customer Directory, no Settings, no Transactions Ledger. **Amended 2026-09-12
  — see §5:** Dashboard access was originally meant to be excluded too, but live testing found it was never
  gated by the permission system in the first place (a pre-existing, unrelated architectural gap this feature
  exposed rather than introduced). Bhimal's call once he saw it: leave Dashboard visible for Partners rather
  than add a new exclusion, since its stat cards are already correctly entity-scoped for free — but hide the
  "This Week's Revenue" card and the "Manage Curries"/"Delivery List" quick-action buttons (both financial or
  lead to screens Partners can't open anyway). Orders by Dish itself needs both View and Edit — Bhimal
  confirmed Partner kitchen staff need to be able to mark "Start Cooking" themselves, not just look at the
  list.
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

**Resolved during build (2026-09-12):** Firestore rules aren't filters over query results — a rule whose
truth depends on `resource.data` fields the query itself doesn't constrain causes the *entire* query to be
denied, not silently filtered. The first implementation pass hardened `firestore.rules` correctly but left
`Operations.tsx`'s live listeners (`onSnapshot(collection(db,'orders'))`,
`onSnapshot(collectionGroup(db,'items'))`) unconstrained, which meant a Partner account's queries were being
denied outright rather than scoped — Orders by Dish would have rendered completely empty. Fixed by
conditionally querying `where('entityId','in', assignedEntityIds)` when the signed-in staff member is a
Partner (commit `012956a`), with query-level automated test coverage added afterward (`testPartnerRBAC.js`,
commit `0334b02`) so this specific class of bug can't regress silently.

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

## 5. Live verification log (2026-09-12) — findings, fixes applied, and what's still open

Build was reviewed before implementation (Antigravity's implementation plan was read in full, not approved
off a summary), and every commit below was independently verified against `git reflog` + `origin/main` +
direct source read, per the Working Agreement — not taken on self-report.

**Implemented and verified clean:**
- `firestore.rules`: `isPartnerStaff()`/`isPartnerEntityAllowed()` helpers, hard-gated read/update rules on
  `orders/{orderId}` and `items/{itemId}`, and an `entityId` immutability check on item updates (added during
  review — the original plan would have let a party with `ordersByDish` edit silently rewrite an item's
  `entityId` to escape the lock).
- `functions/index.js`: `confirmCheckout` denormalizes `entityId` onto each item write;
  `createStaffMember` validates and writes `isPartner`/`assignedEntityIds`.
- `firestore.indexes.json`: composite index for the reassignment guard's `entityId`+`status` query (the guard
  ended up implemented client-side against already-loaded listener state instead, so this index isn't
  currently exercised — harmless to keep).
- `types.ts`, Roles & Staff UI (Partner toggle, entity multi-select, reassignment guard), `testPartnerRBAC.js`
  (12 assertions: direct-doc reads/writes, the `entityId` immutability rule, and — added after a real gap was
  found — query-level checks that a constrained query returns exactly the assigned entity's data and an
  unconstrained one is rejected outright).
- The query-scoping fix described in §3's "Resolved during build" note.

Commits, in order: `d0fa8b1` (rules/functions/UI/types/first test pass) → `012956a` (query-scoping fix) →
`0334b02` (query-level test coverage).

**Live click-through findings (in progress with Bhimal, `partner1@gmail.com` / Entity A only):**
- Confirmed working: sidebar correctly shows only Orders by Dish (plus Dashboard, see below) — Meal Library,
  Delivery List, Payments, Customer Directory, Settings, Transactions Ledger all absent. Start Cooking
  (Active → Preparing) works and the status persists, confirmed from the admin's own view afterward.
- **Bug found, not yet fixed:** the "Filter Entity" dropdown on Orders by Dish was never restricted for
  Partners — it still shows "All Entities" and the full entity list (including Entity B and several stray
  "RBAC Test Entity" rows left behind by test scripts reusing auto-generated IDs instead of a fixed test
  fixture id). Not a security hole — the underlying listener query is still hard-locked to the Partner's
  assigned entity regardless of what's picked in that dropdown — but it leaks other entities' names to an
  account that shouldn't know they exist, and doesn't match the "no All Entities option exposed" requirement
  in §4 point 3. Fix: hide the dropdown for Partners (replace with a static label) or rebuild it to only list
  their own assigned entities with no "All" choice.
- **Bug found, not yet fixed:** the Dashboard's welcome banner reads the hardcoded string `"Welcome back,
  Bhimal"` rather than the signed-in user's actual name — a pre-existing, unrelated cosmetic bug that surfaced
  during this testing because a different account was signed in.
- **Amendment settled (see §1):** Dashboard access itself turned out to be ungated for every staff account
  (`hasTabPermission()`'s `dashboard` case unconditionally returns `true` — there's no "dashboard" entry in the
  granular permission system at all, since it was built as a universal landing page before Partners existed).
  Bhimal's decision on seeing this live: keep Dashboard for Partners rather than add a new exclusion, since
  its stat cards (`todayCookCount`, `todayDeliveriesPending`, `pendingPaymentClaimsCount`,
  `activeWeekFinancials`) all derive from the same already-entity-scoped `orders`/`lines` data — but hide the
  "This Week's Revenue" card and the "Manage Curries"/"Delivery List" quick-action buttons (the latter two
  currently lead a Partner straight into an "Access Denied" screen, which is safe but a dead end).
- Not yet run: steps 7-9 of the manual walkthrough (Admin attempting to unassign Entity A from the Partner
  while an order is Active/Preparing — should be blocked; clearing that order and confirming the unassignment
  then succeeds).

**Pending:** one consolidated fix spec covering the entity-picker restriction, the Dashboard changes just
settled, the hardcoded welcome-text fix, and cleanup of the stray "RBAC Test Entity" test data (plus making the
RBAC test scripts use a fixed, reusable entity id instead of creating a new one every run) — to be written
once the reassignment-guard steps above are done, so it goes to Antigravity as one batch.
