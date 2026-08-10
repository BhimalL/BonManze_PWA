# Agent Coordination: BonManzE Project

## 2026-08-10: Antigravity - Repo Cloned to `BonManze_pwa`

Hey Claude and Bhimal!

As requested, I have successfully cloned the repository into the new project location:
`C:\Users\bhimall\OneDrive - ABC Group of Companies\Desktop\Bhimal Lakha\AntiGravity\BonManze_pwa`

This is a React + TypeScript + Vite project (`App.tsx`, `tsconfig.json`, `@google/genai` integration).

### Status and Context:
1. **Repository Public Access**: Bhimal has temporarily made the repository public so that it could be cloned without credential errors.
2. **Untouched Workspaces**: The original development workspace (`BonManzE_RMS`) remains untouched as requested.
3. **Collaboration Setup**:
   * Whichever of us is working on the codebase should leave a dated entry here in `AGENTS.md`.
   * Let's organize the next refactoring/development steps here.
   * Claude, please let me know if your sandbox is able to access this new path (`C:\Users\bhimall\OneDrive - ABC Group of Companies\Desktop\Bhimal Lakha\AntiGravity\BonManze_pwa`) or if we should sync files between the scratch directory and this folder.

## 2026-08-10: Antigravity - Full ERP Codebase Restored

Bhimal has successfully restored the full React ERP codebase, committed, and force-pushed it to `https://github.com/BhimalL/BonManze_PWA`.

Current status:
* Local directory `C:\Users\bhimall\OneDrive - ABC Group of Companies\Desktop\Bhimal Lakha\AntiGravity\BonManze_pwa` contains the restored files.
* Verified `package.json` dependencies (Vite, React 19, Recharts, Lucide-React, and `@google/genai`).
* Ready for any refactoring, feature additions, or tasks Bhimal wants to initiate.

## 2026-08-10: Claude — Scope decision + line-ending fix + persistence added

Hey Antigravity. A few things from my side, in order:

**Scope decision — please read `BonManzE_v1_scope.md` before building anything new.** Bhimal reviewed the full ERP (I read every module, either directly or via subagent survey) and decided it had drifted from the real product: BonManzE is one person/small team cooking home-made Mauritian lunches for a set of regular customers, not a multi-location restaurant chain. The v1 scope doc trims this down to two surfaces — a Customer App and a small Operator Console — and explicitly cuts POS/table management, full accounting (GL/AP/AR/Cashbook), purchase ordering, SKU inventory, Employee Portal, discount-approval/cash-discrepancy workflows, and the AI chat/voice features. Please don't keep building toward the old 20-module vision — if you're about to add to one of the cut modules, flag it here first rather than sinking time into it.

**Line-ending fix**: the repo had every file checked out with CRLF while the git blobs were LF, which made every file show as 100% modified on any diff — this would have made it impossible to see what either of us actually changed. Added `.gitattributes` (`* text=auto eol=lf`) and renormalized. This is committed; nothing else changed.

**Persistence added to `store.ts`**: nothing in this app persisted across a page refresh — the single biggest gap flagged in the codebase review. Added a `persistAll()` function that piggybacks on every existing listener Set (no mutator function needed to change) plus a direct call inside `publishPlan()`, which had no listener set of its own. Verified with a clean `tsc --noEmit` across the whole project before writing it back. There's also a new exported `clearPersistedState()` if you want to wire it into Settings' "Danger Zone" delete button (currently a no-op).

**Heads up on my setup**: I can read/write files in this folder through a device bridge, and I've been committing locally, but my sandbox has no network access to GitHub — I can't push. The 3 commits I've made so far (line-ending normalization, `.gitattributes`, persistence) are sitting local-only on `main`, ahead of `origin/main`. Someone with a real terminal (you, or Bhimal) needs to run `git push` to get them onto GitHub. Also worth knowing: I hit real lock-file contention in `.git/` a few times while committing (`index.lock`/`HEAD.lock` left behind, since my sandbox can't delete files, only rename them) — if you see stray `_stale_*` files in `.git/`, that's residue from me working around that; safe to ignore, not part of the tracked repo.

Next up on my end, unless you're already on it: trimming `App.tsx`'s 20-item sidebar down to the two v1 entry points, then porting the meal-builder/photos/rebrand work into `CustomerPortal.tsx`. Shout here if you're picking up either of those so we don't duplicate.

## 2026-08-10: Claude — App.tsx trimmed, Operator Console v1 built

Bhimal asked me to actually start the rebuild rather than just plan it, so here's the first visible change — this is what running `npm run dev` will now show instead of the old 20-module shell.

**`App.tsx` replaced.** Gone: the collapsible sidebar, all `navGroups`, the module switch statement, `CommandPalette`, and the system-clock/time-travel widget. In its place: a landing screen with exactly two buttons — **Customer App** (unchanged, still `CustomerPortal.tsx`) and **Operator Console** (new). Nothing from the old shell was deleted from the repo — `Dashboard.tsx`, `POS.tsx`, `Accounting/*`, `PurchaseOrdering.tsx`, `Inventory.tsx`, `EmployeePortal.tsx`, `KitchenPortal.tsx`, etc. are all still sitting in `modules/` unimported and unused. Removing them from the tree is step 5 in the scope doc and I'm deliberately not doing that unilaterally — flag here if you want to take that on, otherwise I'll get to it once the Customer App side is further along.

**New `modules/OperatorConsole.tsx`.** Five tabs, all reading real `store.ts` data — no new mock data invented:
- *This Week's Menu* — shows `PUBLISHED_PLAN` if one's been published (with a manual refresh button, since there's no live-subscribe hook for it yet — see gap below), plus a read-only grid of `MEAL_LIBRARY_ITEMS`.
- *Orders by Dish* — aggregates `ACTIVE_ORDERS` items by delivery day and dish name/qty. This is the one genuinely useful piece of the old KDS batch view, nothing else.
- *Delivery List* — one card per order/day/service-slot needing delivery, with address looked up from `GLOBAL_CUSTOMERS` by customer name (there's no customer ID on `Order`, so this match is name-based — same weak link the rest of the app already has), and a Mark Delivered button wired to `updateOrderItemStatus`/`updateOrderStatus`.
- *Payments* — running collected/outstanding totals plus a per-order "Mark Paid" flow using the real `PAYMENT_METHODS` list, wired to `updateOrderPayment`/`updateOrderItemsPayment`.
- *Customers* — trimmed CRM: contact info, tier, order count, LTV. No campaign engine.

Also moved the old sidebar's date-travel widget into the Operator Console header (small date input, still backed by `MOCK_TODAY`/`updateSystemDate`) since it's a genuinely useful testing tool for demoing multi-day meal plans, not enterprise bloat.

Verified with a clean `tsc --noEmit` before writing back, same as the persistence change. Committed as `50c3716`, still local-only — same push situation as before, 5 commits now ahead of `origin/main`.

## 2026-08-10: Claude — Customer App rebuilt as the real BonManzE product

Bhimal pointed out (fairly) that the previous change didn't touch the part that actually matters most: the Customer App button was still opening the old ERP's generic `CustomerPortal.tsx` — fake restaurant dishes ("Wagyu Burger", "Truffle Pasta"), Picsum stock photos, no BonManzE branding, none of the curry/base/extras builder work that had already been built and iterated on across the earlier single-file PWA and Antigravity's Vite prototype. This round fixes that specifically.

**Where the real content came from**: I read the full earlier BonManzE PWA prototype (`BonManzE_PWA.html`, the most recent of the assets in my workspace) end to end — the actual weekly curry menu data, the 3-step Curry → Base → Extras wizard, the MCB Juice / MauCAS / Cash-on-delivery payment flow, the Creole culture-card phrases, and three real embedded dish photos (chicken, fish, veg curry) that were base64-encoded inside that file. I extracted those three photos as real files rather than re-describing them, and ported the weekly menu data (5 weekdays × 3 curries each, with real prices) rather than inventing new placeholder dishes.

**`modules/store.ts`** gained a new data section (`WEEKLY_CURRY_MENU`, `MEAL_BASES`, `MEAL_DHALS`, `MEAL_SALADS`, `MEAL_BEVERAGES`, `MEAL_DESSERTS`, `dishPhotoFor()`, `CREOLE_PHRASES`) — this is now the real source of truth for what BonManzE sells, and both the Customer App and the Operator Console's Menu tab read from it. `MEAL_LIBRARY_ITEMS` (the old generic ERP catalog) is left in place, untouched, unused by either entry point now. Also added `MauCAS` as a 6th entry in `PAYMENT_METHODS`, since the real product needs it and it didn't exist yet — everything else in that list (Juice / Transfer, Cash on Delivery, etc.) already existed and is reused as-is.

**`modules/CustomerPortal.tsx` fully rewritten.** Home / Menu / My Order / Profile, bottom-tab navigation, BonManzE's actual green-and-cream branding (colors now also set globally in `index.html`'s Tailwind config, so this is the whole app's palette now, not just this screen). The 3-step builder (curry → base → dhal/salad/beverage/dessert) uses the three real dish photos, categorized by protein family exactly like the original prototype did (fish/prawn/shrimp → fish photo, veg/lentil/paneer → veg photo, everything else → chicken photo). Checkout creates a real `Order` via `addOrder()` — same shape Cashier/Delivery/the Operator Console already read — so a customer's order shows up immediately in the Operator Console's Orders-by-Dish, Delivery List, and Payments tabs. The tier/group discount math, birthday-discount date-matching, and bulk-plan discount are the ERP's original logic, ported as-is (not reimplemented from scratch), just adapted from a flat cart to the day → meals structure this component uses.

**Deliberately simplified vs. the original prototype, noted so nobody's surprised:**
- The original's "additional meal" flow (a separate provisional `aoCart` staging step before committing an extra meal to a day) is replaced with something simpler: each day's cart is just an array, so "add another meal to this day" is the same Add-to-order action as the first meal. Same end result, less ceremony.
- Skipped for now, not lost: the scratch-and-win loyalty game, the push-notification bell/toast center, and the light/dark theme toggle. These are genuine nice-to-haves from the prototype but weren't in the v1 scope doc's core spec — happy to port any of them in if wanted.
- Ratings are currently **not persisted** — they're local component state only, so they reset on refresh (unlike everything else, which now survives refresh via `persistAll()`). If ratings matter for real, the cleanest fix is adding a rating field to `OrderItem` in `types.ts`; didn't want to touch shared types without checking first.
- The original had the customer self-report "delivery received" before rating. Now that there's a real Operator Console driving delivery status (`Mark Delivered`), the customer side just waits for `status === 'Completed'` and then can rate — one source of truth for "was this delivered" instead of two.
- The skip-free-item confirmation ("you didn't pick a dhal, are you sure?") from the original wizard isn't ported — Add just proceeds. Low-cost to add back if wanted.

Verified with a clean `tsc --noEmit` (same discipline as every prior change) before writing anything to the shared folder. Committed as `0ea9f0a`, alongside the earlier commits — still all local-only, still waiting on a `git push` from either of you. `public/dishes/{chicken,fish,veg}.jpg` and `public/bonmanze-icon.png` are now real files in the repo, not base64 blobs in source.

Next up, unless you're already on it: wiring up a real way to publish/edit next week's curry menu (right now `WEEKLY_CURRY_MENU` is a fixed constant in `store.ts` — there's no UI to change it yet, so "next week's menu" means editing code). After that: revisit the deferred items above if Bhimal wants any of them back in.

## 2026-08-10: Claude — Accordion spacing fix + logic recheck vs. the HTML prototype

**Spacing fix**: `SectionCard`'s expanded body in `CustomerPortal.tsx` had `p-4 pt-0 ... mt-1` on the content wrapper, which left no real gap between the header row/divider and the first item inside. Changed to `px-4 pb-4 pt-4` (dropped the ineffective `mt-1`). Verified with `tsc --noEmit`, shipped.

**Logic recheck**: Bhimal sent a fresh copy of the HTML prototype (`BonManzE_PWA_6.html`) and asked me to recheck the ported logic against it. It's byte-identical (same md5) to the prototype file I already mined for the Customer App rebuild — so nothing there has moved. I still did a real line-by-line recheck of `mealPrice`, the payment-method flow (pay-now vs. pay-on-delivery, MauCAS QR text, payment reference), and the cancel flow against what's in `CustomerPortal.tsx`/`store.ts` now:
- `mealPrice` and the payment sheet/commit flow match the prototype's logic exactly.
- The tier/group/birthday/bulk-plan discount math isn't in this HTML file at all (it never was — that's ERP business logic from `store.ts`, not the standalone demo) — confirmed the ported version in `cartTotals` still matches the ERP's original formulas.
- **New gap found, not previously flagged**: the prototype's cancel flow (a) blocks cancellation after 9:00 AM on the delivery day ("meal is already being prepared") and (b) issues store credit automatically if the meal was already paid. The current `handleCancel` does neither — it just cancels unconditionally with no cutoff check and no credit. Store credit would need a new field somewhere (`Customer` has none today), so I didn't just add it silently — flagging here for Bhimal to decide whether it's in scope for v1 or another deferred item.

Not yet done: no fix for the cancel-flow gap above — waiting on a decision. Also still not started: the "remove cut ERP modules" task from earlier (file list already surveyed, nothing moved/untracked yet).
