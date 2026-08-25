# BonManzE v1 — What We Actually Need

**Date:** 2026-08-10
**Why this exists:** The ERP build (`BonManze_PWA` repo) grew into a 20+ module restaurant-management system. Bhimal's call: that's scope creep away from the real product. This document defines what BonManzE v1 actually is, so Claude, Antigravity, and Bhimal are building toward the same target instead of continuing to expand the enterprise version.

## The real product, restated

One person (or a very small team) cooking home-made Mauritian lunches and delivering them to a set of regular customers — not a multi-location restaurant chain. Weekly ordering, day-by-day meal customization, delivery, payment. Everything in scope should be sized to that.

## Two surfaces, not twenty modules

### 1. Customer App
The polished, customer-facing ordering experience — this is what's been iterated on across Claude's single-file PWA, Antigravity's Vite build, and the ERP's `CustomerPortal.tsx`. v1 scope:

- Weekly menu browsing, day-by-day ordering
- Meal builder: curry + base + extras (dhal / salad / beverage / dessert) — the 3-step wizard, real dish photography, and rebrand already built should be ported in here
- Cart spanning multiple days/the week, additional meals per day
- Checkout: payment method (MCB Juice / MauCAS / Cash) × timing (pay now / pay at door)
- Order status tracking, delivery confirmation, rating
- Profile: order history, loyalty (keep the ERP's tier/discount math — it's genuinely correct and worth reusing, not rebuilding), referral code
- Nice-to-have, keep if low-cost: culture card / local-flavor touches

### 2. Operator Console
One simple view for whoever runs the kitchen/delivery (Bhimal). Replaces roughly eight enterprise modules with four much smaller ones:

- **This week's menu** — what's on offer and at what price. A trimmed version of MealLibrary/Planner: no ingredient-level costing catalog, just "here's this week's menu."
- **Orders by dish** — how many of each curry are needed, by day. The one genuinely useful piece of KitchenPortal's batch view; nothing else from the KDS.
- **Orders by customer / delivery list** — who gets what, delivery address, mark-as-delivered. A trimmed DeliveryPortal.
- **Payments** — who's paid and by what method, who owes, a running total. A trimmed Cashier: no shift/till/audit-log machinery, no Z-reports.
- **Customer list** — contacts, order history, loyalty tier. A trimmed CRM: no campaign engine, no "Engagement Hub."

## Cut entirely (not deferred — removed from scope)

POS terminal, table management, dine-in/takeout floor logic (no dine-in service exists). Kitchen Display System station analytics, bump-time metrics, printer status. The full accounting suite (General Ledger, Payables, Receivables, Cashbook — nobody's filing double-entry books for this). Purchase Ordering / supplier workflows (buying ingredients is a market trip, not a formal PO). SKU-level Inventory Management. Employee Portal with shift scheduling and badges (unless there are actual employees whose scheduling needs that much ceremony). Cash Discrepancy and Discount Approval workflows (they exist to route decisions to a manager who isn't the owner). The AI Assistant chat, Voice Control, and Command Palette (novelties on a system that's about to be four screens, not twenty).

## Deferred, not cut (revisit only if it becomes a real pain point)

Ingredient-level inventory tracking — only if running out of stock mid-week becomes an actual problem. A real backend/database — only if this needs multi-device sync, multiple concurrent operators, or outgrows a single device. For now, a persisted single-device app is enough.

## The one gap to fix regardless of scope

All three existing codebases (Claude's PWA, Antigravity's Vite build, the ERP) forget everything on page refresh — no persistence anywhere. This should be fixed early, before more feature work: add localStorage-backed persistence to `store.ts` (or its equivalent in whatever becomes the v1 base) so a day's orders and payments survive a reload. Building more surface on a store that resets itself just compounds the eventual rework.

## Recommended base to build v1 on

The ERP's `CustomerPortal.tsx` + `store.ts` data model, not a rebuild from scratch — its loyalty/discount math and data flow (Planner → CustomerPortal → orders → Cashier) are real and already correct. Rebuild it visually with the 3-step builder, real photos, and rebrand from the prototypes. The Operator Console is new — a small set of screens composing `store.ts`'s existing real order/customer/meal-library data, not a resurrection of the enterprise modules that were already stubbed out.

Practically, this means retiring `App.tsx`'s 20-item sidebar shell in favor of two entry points: Customer App, Operator Console.

## Suggested sequencing

1. Add localStorage-backed persistence to `store.ts` — small, foundational, do first.
2. Trim `App.tsx`'s shell down to the two entry points.
3. Port the builder, real photos, and rebrand into `CustomerPortal.tsx`.
4. Build the trimmed Operator Console (orders-by-dish, delivery list, payments, customer list).
5. Remove the cut modules from the codebase rather than leaving them half-built — a half-finished Accounting module sitting in the tree invites more time spent "finishing" something that shouldn't exist in v1.
6. Record this decision in `AGENTS.md` so Antigravity isn't still building toward the old 20-module vision.

## Future direction (2026-08-10, deferred — not in scope for v1)

Bhimal's long-term vision: three revenue streams, not one — this week's cooked lunch delivery (the current v1 scope), a cooked dinner delivery service, and a "dinner in a kit" (self-cook meal kit) offering. Recorded here so the vision isn't lost, but deliberately not started until v1 (lunch) has actually run with real customers — building ahead of validated need is exactly the mistake that produced the 20-module RMS this document exists to undo.

**Dinner delivery — the cheap extension.** Same fulfillment model as lunch: cook it, deliver it, get paid for it. The data model already has a loose hook for this — `OrderItem.serviceSlot` is a free-text string (currently only ever "Lunch"/"Lunch-2"), and a `SYSTEM_CONFIG.activeServices: ['Breakfast', 'Lunch', 'Dinner']` array already exists, unused, left over from the original RMS scaffold. Adding dinner would mostly be a menu-authoring and cutoff-time change (a second cutoff for a second delivery window each day), not new architecture.

**Meal kits — reopens deferred scope, not a menu category.** A kit is raw or prepped ingredients plus a recipe card, not a cooked meal — which makes knowing ingredient stock on hand a hard requirement, not a nice-to-have. That's exactly the ingredient-level inventory tracking this document deferred above ("only if running out of stock mid-week becomes an actual problem"). Kits also need new content (recipe cards), different packaging/cold-chain handling than a hot lunch, and a new `Order.type` value the model doesn't have yet (currently `'Dine-In' | 'Takeout' | 'Delivery' | 'Meal Plan'`). Treat this as closer to a second product than a feature — don't build it opportunistically alongside dinner.

**When to revisit:** once lunch has run long enough with real customers to know the operational rhythm actually works (the Home/Operator Console loop, payment reconciliation, delivery cadence) — not before.

## Multi-Tier Trading Entity System (2026-08-25, scoping closed — all 5 questions settled)

**Where this comes from, and a provenance correction worth keeping on record:** Antigravity proposed a "Multi-Tier Trading Entity System" on its own initiative during a 2026-08-16/17 session and framed it around five questions: entity definition, order-to-entity mapping, billing/invoicing, support routing, and operator console UX. `BonManzE_Firestore_Schema.md` flagged the proposal as an open item and deliberately refused to start any schema/rules/Cloud-Function work on it until it got the same scoping discipline every other decision in that document was given first. Worth recording explicitly: the original framing of this feature (language like "segment billing/invoicing/support routing across multiple legal entities") was never an established requirement from Bhimal — it was a prior session's own paraphrase of Antigravity's vague proposal, carried forward as if it were settled fact, until this round's scoping conversation actually checked. That's precisely the failure mode this document's own discipline exists to catch (see the RMS-assessment history behind this whole document), and it's why every one of the five questions below got answered for real by Bhimal rather than assumed from the original proposal text.

**Confirmed real, not speculative:** two legal entities are actually operating today (not merely anticipated for a future product line) — a genuine current MRA/accounting-separation need, not building ahead of validated need. This closes the one real scope-sizing risk this section originally flagged: whether this was worth building as v1 work at all, versus deferring alongside dinner/meal-kits the way this document's own "Future direction" section does for genuinely speculative expansion. It isn't speculative — it proceeds as real v1 work.

**What "entity" means here (Q1, entity definition).** Entities are a legal/tax construct, not a customer-facing brand or a multi-tenant/white-label system. The Customer App itself doesn't change per entity — the same menu, the same ordering flow, the same look and feel. What changes is which legal business is on record as having sold and billed a given order.

**Registration and entity assignment (Q2, order-to-entity mapping).** A new customer registration no longer produces an immediately-orderable account. Registering puts the customer into a pending state — they see an "awaiting confirmation" screen — until a staff member reviews and approves them through a new Pending Registrations tab in Operations, fed live via the same `onSnapshot` pattern every other Operations view already uses. Entity assignment happens at this approval step, as a staff decision between the two real entities confirmed above, not automatically at registration time and not derived from anything about the order itself. **Confirmed 2026-08-25: this assignment is not permanent — staff can reassign a customer's entity later** (e.g. to correct a mistake, or if their real-world arrangement changes), using the same staff-gated write path as the initial approval. Already-issued invoices are unaffected by a later reassignment — they keep the entity they were actually issued under, by design (the order-level `entityId` is frozen at checkout time rather than resolved live from the customer record; see the implementation plan for the full reasoning, which mirrors this project's own `tierAtOrder`-freeze precedent).

For the existing seed customers on the emulator (Marcus Sterling, Eleanor Fant, Sarah Connor, Neji Lakha): leave them unassigned/without an entity when this ships, and run them through the real Pending Registrations approval flow by hand rather than writing new seed data for this. This exercises the actual end-to-end flow (customer sees "awaiting confirmation," staff approves, customer can then order) using data already understood, and is a better test than a synthetic fixture. This is explicitly a *testing* decision, not a production one: BonManzE only runs against `demo-bonmanze` today, with no real Firebase project and no live paying customers, so there's nothing at risk in leaving seed data unassigned right now.

**Production grandfathering — decided 2026-08-25 (previously flagged here as a separate future conversation).** The moment this app points at a real Firebase project, every real customer who registered before this feature shipped would otherwise be stuck unable to order until reviewed — Bhimal's resolution is to personally review and assign an entity to each of them himself, through the same Pending Registrations approval screen built for new signups. No bulk-approve script or special migration Cloud Function — the ordinary approval flow *is* the grandfathering mechanism, just run manually across the existing customer base once, at go-live.

Rejection is a state on the existing account, not a deletion — the customer's username is already claimed, so they can't simply register again from scratch even if they wanted to. A staff-entered rejection reason (free text) shows on their awaiting-confirmation screen, and they can edit their profile details and resubmit for another look rather than hitting a dead end. Whether resubmission needs rate-limiting (e.g. no more than once a day, to prevent spamming staff) is an open minor detail, not a blocker.

Notifications start as an in-app badge/counter only — a number on the Pending Registrations tab, live via the same `onSnapshot` pattern as everything else in Operations. No email or push in v1; that's cheap, consistent with the rest of the app, and needs no new infrastructure. Worth layering an email nudge on top later only if BonManzE's volume grows to where staff might miss a pending approval for hours — not a v1 concern.

**Billing/invoicing segmentation (Q3).** What differs per entity on an invoice or receipt is more than just compliance fields: the legal business name, BRN/VAT registration number, and payment/bank reference, plus entity-specific branding (its own logo/letterhead), not merely a swapped name on an otherwise-identical template. Tax treatment itself does not differ — VAT math (rate and rules) is identical across every entity; only the printed VAT registration number changes per entity. Practically, this means `confirmCheckout`'s pricing and tax calculation logic does not need to branch by entity at all — the entity a customer/order is assigned to is purely a concern for invoice/receipt rendering (which legal name, registration number, bank reference, and branding get printed), not for what gets charged.

The reason separate entities are needed at all is a combination of three things, not a single driver: MRA/tax compliance (multiple registered legal businesses, each filing its own taxes under its own registration number — confirmed above as a real, current arrangement, not an anticipated one), accounting separation (clean revenue-stream separation for bookkeeping even where not strictly legally required), and anticipating the three-product-line roadmap already recorded in this document's own "Future direction" section above (this week's cooked lunch delivery, a cooked dinner delivery service, a "dinner in a kit" self-cook offering) — where each product line plausibly becomes its own entity over time, on top of the two that already exist. That last point matters for the data model: it suggests entity assignment may eventually need to key off product line/order type rather than staying a fixed per-customer default forever, though nothing has been decided yet about exactly how or when that would happen (also see "Still open" below).

**Support routing (Q4).** Support is entity-blind. A complaint, a refund request, or a general support query is handled the same way regardless of which entity technically issued the order — entity is purely a backend/invoicing distinction, invisible to how support gets handled. No entity field is needed anywhere in a support/complaint flow. (Moot in practice today anyway — there's no formal support/complaint tracking in BonManzE yet; this answer just means one doesn't need to be built with entity-awareness baked in if one is ever added.)

**Operator Console UX (Q5).** Staff do need entity visibility and filtering in Operations — this is not purely an invoice-time concern. Orders by Dish, Delivery List, Payments, and the Customer Directory should be filterable by (or at least clearly show) which entity an order or customer belongs to, for day-to-day operational reasons beyond just generating a receipt. This is a real UI scope item, not just a schema field: every one of those four Operator Console screens needs an entity column/badge and a filter control added. With exactly two entities confirmed above, this filter can stay as simple as a two-way toggle (plus "All") rather than an open-ended picker — sized to the real number in play, not built more elaborately than needed. Customer Directory also needs a way for staff to change an already-approved customer's entity, per the reassignment answer above.

**No remaining blockers.** The two entities' real legal names/BRN/VAT numbers/bank references/logos are still pending — Bhimal provided obviously-fake placeholder values instead (see `BonManzE_MultiEntity_ImplementationPlan.md` §3) so build work isn't gated on real business data, on the explicit understanding the placeholders get swapped for real details before production go-live.

**Not started:** no Firestore schema, security rules, or Cloud Function work for this feature yet. `BonManzE_MultiEntity_ImplementationPlan.md` (2026-08-25, v2) is the technical implementation plan reflecting all five settled answers above plus the debated resolution of Antigravity's technical-review questions — mirrored into the repo (`BonManzE_MultiEntity_ImplementationPlan.md` at repo root) alongside a synced, up-to-date copy of this scope document, since the repo's own copy of this file had gone stale since 2026-08-10.

## Open assumptions (correct me if wrong)

This assumes no dine-in service, no formal accounting requirement, and either no employees or few enough that a simple delivery list covers scheduling. If any of those are wrong, the corresponding "cut" item should move back into scope.
