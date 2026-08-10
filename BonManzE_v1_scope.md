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

## Open assumptions (correct me if wrong)

This assumes no dine-in service, no formal accounting requirement, and either no employees or few enough that a simple delivery list covers scheduling. If any of those are wrong, the corresponding "cut" item should move back into scope.
