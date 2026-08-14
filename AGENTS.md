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

## 2026-08-10: Claude — My Order edit/detail, Home Order Hub, extra tags, bigger builder photo

Bhimal sent screenshots of My Order (draft + confirmed) and the builder, with five specific asks — went back to the HTML prototype's `renderHome()`/`renderMenu()`/`renderOrder()`/`updateShowcase()` for each, same mining approach as the rest of this rebuild:

**Draft cart (My Order, before confirming)** now has Edit/Remove buttons per line (reusing the same builder `editIndex` plumbing the Menu tab already had — it just wasn't wired up here) and shows the full extras breakdown (dhal/salad/beverage/dessert/note), not just curry + base.

**Home screen had a real bug, not just a preference**: `weekOverview` used to render straight from the draft `cart`, which goes back to `{}` the moment `handleCheckout` fires — so a customer who'd already confirmed their week saw "Choose your meal" on every day, with no way to tell anything was ordered. Home's "This week" grid now merges draft + confirmed (`weekOverview`, combining `cart` and the existing `thisWeekLinesWithSeq`), plus a status strip above it (draft total / outstanding balance / "all set, fully paid") with a CTA that routes to the right place — this is the closest equivalent to the prototype's home status-card / "Order Hub," built from data we already track rather than a new parallel structure.

**"Extra" tagging**: a second (or third) meal landing on the same calendar day — whether it came from the same checkout or a later, separate one — now gets an `Extra 2` / `Extra 3` badge, on both Home and My Order's confirmed list. This is sequence-within-day (`thisWeekLinesWithSeq`), matching the prototype's per-day `seq`/`tag-extra`, not sequence-within-`Order` — we don't have (and didn't rebuild) the prototype's separate `aoCart` "extra vs. replace" staging flow; there's currently no "replace" mode, only "extra." Flagging in case Bhimal wants true replace-a-meal back — it'd mean editing an already-confirmed `OrderItem` in place rather than only editing draft-cart items, which the app doesn't do anywhere yet.

**Builder**: header photo `h-48` → `h-64` (was cramped), and it now carries live overlay pills for curry / base / extras-count as you pick them — tap a pill to jump back to that section — ported from the prototype's `updateShowcase()` treatment.

Verified with a clean `tsc --noEmit`, shipped.

## 2026-08-10: Claude — My Order grouped by Order, person tags, Home status/tags

Follow-up to the round above — Bhimal clarified two things weren't actually addressed yet:

**My Order was still a flat list, not grouped by Order.** The "Extra" tag from the last round tagged multiple meals *on the same day*, but the ask was grouping by the actual `Order` record — a checkout is one order, going back later to add an extra meal creates a second, separate order, and the screen should show that as two visually distinct blocks. Added `weekOrders` (groups `thisWeekLinesWithSeq` by `order.id`, sorted by `order.timestamp`) and rebuilt the "Confirmed this week" section around it: each order is now its own card with a header (`Your order` / `Additional order 2` / …, meal count, placed-date, paid/due badge) containing its meals nested inside. The per-day "Extra N" tag is unchanged and still shows inside a group, since two meals for the same day can still land in the same order.

**"for Priya" is now a tag, not prose.** `OrderItem.notes` is still the one flat string it's always been (still didn't want to touch shared types) — added `splitNotesTag()` to pull the trailing `for X` segment back out of that string at render time, and a small `PersonTag` pill component (person icon + name) used everywhere a note shows up: My Order (draft and confirmed), the Menu tab's meal list, and Home's per-day mini cards. `mealExtrasLabel` no longer folds the note into its text for the same reason.

**Home mini cards now show order status.** They previously showed only a paid/unpaid dot; added the same status badge (Active/Completed/Preparing/etc.) used everywhere else, plus the person tag, so Home matches what My Order shows instead of a stripped-down subset.

Verified with a clean `tsc --noEmit`, shipped.

## 2026-08-10: Claude — Pay whole order, edit a confirmed meal (cutoff-gated), Home rebuilt

Three more asks from Bhimal:

**Pay whole order or per meal.** Each order group in My Order now has a "Pay order · Rs X" button in its header (`openPayOrder`) alongside the existing per-meal Pay buttons — reuses the same `payTarget: { kind: 'balance' }` shape `openPayBalance` already used for the whole week, just scoped to one order's unpaid lines. No new store function needed for this one.

**Edit a confirmed meal, gated by a 9:00 AM cutoff.** This is the gap flagged two rounds ago (prototype cutoff logic recheck) — now implemented. `isPastCutoff(deliveryDate, systemDate)` locks past delivery days outright and locks today's delivery once the real wall-clock hour hits 9 — the app's simulated "today" (`systemDate`) only moves in whole days, so the hour check has to come from the real clock, there's nothing else to check it against. Both Edit and Cancel are now gated by this on confirmed meals; once locked, the meal shows "🔒 Locked — the 9:00 AM cutoff has passed" instead of those buttons, same wording as the prototype.

Editing a confirmed meal needed a real store mutator — added `editOrderItem(orderId, date, slot, updates)` in `store.ts`, same find-by-date+slot-and-not-cancelled pattern as the existing `cancelOrderItem`, recalculating the order total afterward. The harder part: `OrderItem` only stores the curry id (`itemId`) and a flattened text description, no structured base/dhal/salad/beverage/dessert fields — so reopening the builder on a confirmed meal needed `reconstructSelection()`, which matches each name in the notes string back against `MEAL_BASES`/`MEAL_DHALS`/etc. to recover ids. This works reliably today because those names are unique across categories, but it's a workaround, not a real data model — if `OrderItem` ever gets a proper structured field for the original selection, this whole function goes away. Flagging again since this is the second feature in a row (after the cancel-credit gap) that really wants one.

**Home rebuilt.** Replaced the patched-together status strip with a single status card that always shows the one most useful next thing — mirrors the prototype's home status-card state machine (nothing ordered → browse; draft in progress → review & confirm; confirmed with a balance → pay now; fully paid but something's ratable → rate meal; otherwise → all set) — plus a week-at-a-glance emoji chip row above it. Dropped the redundant bottom "Review order" button now that the status card's own CTA covers that case, so Home has one clear next action instead of two competing ones. The day-by-day grid underneath (draft/confirmed per day, Extra tags, Draft/Paid/Unpaid badges) is unchanged from last round.

Verified with a clean `tsc --noEmit`, shipped.

## 2026-08-10: Claude — Day-grouped My Order, lock badge moved up, compact status row, Home v2, real 3-state payments

Five more asks from Bhimal, the last one (payments) touching all three files:

**My Order: grouped by day within each order.** Last round grouped by Order but left each order's meals as a flat list — now nested one level further: within an order card, meals are grouped by delivery day (an order can span more than one day if you checked out Monday's and Tuesday's meals together). The 🔒 locked indicator also moved from the bottom of each meal card to right next to the day/date header, since it applies to the whole day, not each meal individually.

**One line for the tag row.** Extra tag, payment status, order status (Active/Completed/etc), and the person tag now render as one wrapping row of same-sized badges (new `StatusBadge` component) instead of two separate rows — same information, less vertical space per meal.

**Home v2 — profile card + guide card, emoji row dropped.** Bhimal didn't like the curry-emoji row from last round, so it's gone. In its place: a profile snapshot (avatar, name, tier badge, loyalty points, store credit if any, a link into the Profile tab) and a short "How BonManzE works" card (browse → confirm by Sunday noon → pay by Juice/MauCAS/cash → delivered Mon–Fri 11:30–12:00). The status card and day-by-day grid from last round are unchanged underneath.

**Payments: a real three-state lifecycle, not a customer-side toggle.** This is the biggest change. Previously, picking any payment method in the app immediately set `paymentStatus: 'Paid'` — even Cash on Delivery, before any cash had actually changed hands. Now:
- Picking a method in the app only records a *claim* (`submitPaymentClaim` in `store.ts` — sets `paymentMethodName`/`paymentReference`, leaves `paymentStatus` untouched).
- `paymentStatus` only ever becomes `'Paid'` when Operations confirms it via the Operator Console's existing Mark Paid flow (`updateOrderItemsPayment`/`updateOrderPayment` — unchanged).
- The UI now shows three states instead of two: **Unpaid** (no method chosen yet) → **Awaiting confirmation** (method claimed, nothing confirmed) → **Paid** (Operations confirmed). New helpers `isUnclaimed`/`isAwaitingConfirmation`/`paymentStatusInfo` in `CustomerPortal.tsx` drive this everywhere it shows: My Order, Home, the order-group header's Pay button (which now only appears while something's still unclaimed).
- Added a Juice/MauCAS reference flow: the app generates a `BMZ-PAY-XXXXXX` reference per payment attempt, shown with a copy button so the customer can quote it on their transfer; there's also an optional field for the customer to paste back their own bank/wallet transaction reference. Both get stored on the item as `paymentReference` — **new optional field on `OrderItem` in `types.ts`**, additive only, nothing existing reads or writes it differently.
- Operator Console's Payments tab and "Collect Payment" modal now show what the customer claimed ("Customer says: Juice / Transfer · BMZ-PAY-482913...") so Operations has something to match against a statement, and the claimed method is highlighted in the picker.

**Payment methods restricted to 3, everywhere.** `PAYMENT_METHODS` in `store.ts` still has 6 entries (Cash Drawer, Visa/MC, Juice/Transfer, Cash on Delivery, Staff Meal, MauCAS) — the first three legacy names are ERP/POS leftovers, not relevant to a delivery-only business. Added `MEAL_PLAN_PAYMENT_METHOD_NAMES` (Juice / Transfer, MauCAS, Cash on Delivery) as the one shared filter — Customer App checkout already used an equivalent local list, now imported from `store.ts` instead of duplicated; **Operator Console's payment-method picker was not filtered at all until now** and would have shown things like "Staff Meal" for a home-delivery order.

Verified with a clean `tsc --noEmit` across `CustomerPortal.tsx`, `OperatorConsole.tsx`, `store.ts`, and `types.ts`, shipped.

## 2026-08-10: Antigravity — Store credit gap resolved

**Store credit refund on cancel**:
* Modified `cancelOrderItem` in `modules/store.ts` to inspect the cancelled item's `paymentStatus`.
* If the item was already `'Paid'`, set its `paymentStatus` to `'Refunded'` and call `updateCustomerRecord` to add the calculated total amount of the cancelled meal (`price * qty` + VAT if enabled) back to the customer's `storeCredit`.

**CustomerPortal currentUser sync**:
* Added a `useEffect` hook in `modules/CustomerPortal.tsx` to automatically re-sync `currentUser` from the `customers` state array whenever it changes. This ensures customers see their updated loyalty points and store credit instantly without having to log out and re-log back in.

**Refund UI integration**:
* Updated the `paymentStatusInfo` helper in `modules/CustomerPortal.tsx` to handle the `'Refunded'` state explicitly, returning a `"Refunded"` label with a warning tone.
* Updated `handleCancel` in `modules/CustomerPortal.tsx` to display a customized toast message showing the exact refund amount added (e.g. `"Meal cancelled · Rs X credit added"`) if a paid meal was cancelled.

Verified that the whole project compiles with a clean `npx tsc --noEmit` check.


## 2026-08-10: Claude — Legacy RMS modules removed from the build

Bhimal asked to strip out the full-RMS modules that were never part of BonManzE's scope (a weekly meal-plan delivery app), keeping only the three files the app actually uses.

**Removed from git tracking (`git rm --cached`) and moved out of `components/`/`modules/`:** `AIAssistant.tsx`, `CommandPalette.tsx`, `VoiceIntelligence.tsx` (components/); `Accounting.tsx` + `Accounting/{Cashbook,GeneralLedger,Payables,Receivables}.tsx`, `CRM.tsx`, `CashManagement/Discrepancies.tsx`, `Dashboard.tsx`, `DeliveryPortal.tsx`, `EmployeePortal.tsx`, `Inventory.tsx`, `KDS.tsx`, `KitchenPortal.tsx`, `KitchenProgress.tsx`, `Management/DiscountApprovals.tsx`, `MealLibrary.tsx`, `POS.tsx`, `Planner.tsx`, `Production.tsx`, `PurchaseOrdering.tsx`, `SalesOrders/Cashier.tsx`, `ServicePortal.tsx`, `Settings.tsx` (modules/) — 25 files total. **Kept:** `CustomerPortal.tsx`, `OperatorConsole.tsx`, `store.ts`.

Two things worth knowing:
1. The actual git removal ended up folded into the `8bc1843` store-credit commit rather than its own commit — my `git rm --cached` had already staged the deletions in this shared working copy's index before that commit ran, so `git commit` picked up both sets of changes at once. HEAD's tree is correct either way (the 25 files are gone from tracking), just flagging it so nobody goes looking for a dedicated "remove modules" commit in the log.
2. This sandbox can't delete files outright, so the 25 physical files aren't gone from disk — they're moved into a new `_deleted_modules/` folder at the repo root (same `components/`/`modules/` subpaths preserved inside it), which is now `.gitignore`d. **Bhimal: safe to delete the whole `_deleted_modules/` folder via Windows Explorer whenever convenient** — nothing in the app references it.

Verified with a clean `npx tsc --noEmit` (no imports pointed at any removed file), shipped.

## 2026-08-10: Antigravity — Exclude _deleted_modules in tsconfig.json

* Added `_deleted_modules` to the `"exclude"` list in `tsconfig.json` to prevent type-checking errors for the moved modules, since `tsc` default behavior includes all files in the project root recursively.
* Cleaned up empty legacy directories (`components/`, empty subfolders under `modules/`) from the local working copy.

Verified with a clean `npx tsc --noEmit` check.

## 2026-08-10: Antigravity — Dinner Offering & Receipt Regrouping

Implemented the Dinner offering and My Order/Receipt regrouping changes:

**1. Dinner Offering Integration**:
* **`modules/store.ts`**:
  * Added `SYSTEM_CONFIG.dinnerEnabled` (defaulting to `true`).
  * Declared a mutable reactive `WEEKLY_DINNER_MENU` store value along with `subscribeToDinnerMenu` and `updateDinnerCurryOption` helper functions to mirror the lunch menu behavior.
  * Added custom business branding properties to the config (`businessName`, `businessTagline`, `businessLogoUrl`).
* **`modules/CustomerPortal.tsx`**:
  * Added a separate `dinnerCart` state and independent builder to manage dinner selections cleanly.
  * Rendered a Lunch/Dinner tab switcher in the Menu view (gated by `dinnerEnabled`).
  * Ensured dinner checkout items are correctly labeled with `serviceSlot` (e.g. `'Dinner'`).
* **`modules/Operations.tsx`**:
  * Integrated a "Dinner offering" toggle on the Menu tab to switch `SYSTEM_CONFIG.dinnerEnabled` live.
  * Created a dinner menu-editing grid (inline pencil-edit UI) that appears when Dinner is enabled.
  * Fixed the "Orders by Dish" aggregation to group by `serviceSlot` and name rather than name alone, preventing lunch and dinner dishes of the same name from summing up together.

**2. Grouping & Layout Improvements**:
* **`modules/CustomerPortal.tsx`**:
  * Restructured My Order (Draft & Confirmed) and invoice receipts to group by Order $\rightarrow$ Offering (Lunch/Dinner) $\rightarrow$ Day.
  * Added a unified helper `groupByOrderServiceDay()` to ensure layout consistency across all three receipt/order views.
  * Surfaced visual indicators when a receipt spans multiple orders or service slots.

Verified that the whole project builds and compiles perfectly with no warnings/errors.



## 2026-08-10: Claude — Home page rebuilt around dish photos, loyalty progress, and a quick-action grid

Bhimal's ask: review everything already built across the other tabs and use it to make Home feel like a modern, customer-centric food-app front page instead of a form. Previous Home was a static greeting → profile strip → permanent 4-line "how it works" card → status card → a 7-card day-by-day grid, all text.

**Dynamic hero.** If a meal is `Active` and its `deliveryDate` is today, the hero becomes that dish's real photo (`dishPhotoFor`) with "Arriving today · 11:30–12:00" and a "+N more" count if there's more than one. Otherwise it falls back to the existing Creole-phrase greeting card. Nothing new in the data model — just reading `thisWeekLinesWithSeq` differently (new `todaysArrivingLines` memo).

**Loyalty progress bar.** Replaced the flat "{tier} · {points} pts" text with a fill bar showing points earned toward the next tier's `pointsThreshold` (new `loyaltyProgress` memo — sorts `LOYALTY_TIERS` by threshold since it isn't guaranteed sorted, finds the customer's current tier, computes % into the next one). Top-tier customers see "you've reached the top tier" instead of a bar that would overflow.

**"This week's curries" photo strip.** A horizontal scroll of 5 cards (one per weekday), each with that day's first curry's real photo, name, price, and a "+N more" tag if the day has other options — tapping opens the builder for that day. This is the first place Home has shown any food photography; previously all of it lived in the Menu tab and the builder.

**Quick actions replace the day-by-day grid.** Bhimal's call: instead of a separate 7-card "This week" grid, fold that into one tile ("My Orders") inside a quick-action row. The tile shows a dish thumbnail (confirmed meal if there is one this week, else the first draft, else a plain bag icon) and a one-line count ("3 meals this week" / "2 in draft" / "No orders yet"), and taps through to My Order same as before. Alongside it: Browse menu and Refer a friend (copies the code right from Home, no detour to Profile) always show; Pay now (if `outstandingTotal > 0`) and Rate last meal (if there's an unrated completed meal) only show when there's actually something to do — same conditions the status card already uses, just as a persistent tile instead of only a banner.

**Guide card collapses.** "How BonManzE works" is now a one-line collapsed row that expands on tap (`guideOpen` state, defaults closed) instead of a permanent full-height card — repeat customers don't need the 4-step explainer taking up scroll space every single visit.

Removed the now-unused `weekOverview` memo (only consumer was the day grid this replaces).

Verified with a clean `npx tsc --noEmit`, shipped.

## 2026-08-10: Claude — Personal welcome hero, Profile shows points/credit, and a regression fix

**Regression caught and fixed first.** While making this round's changes I noticed my last commit (`8ee1c0f`, the Home rebuild) had silently reverted three things Antigravity added in `8bc1843`: the `paymentStatusInfo` `'Refunded'` branch, the currentUser-resync `useEffect`, and the refund-amount cancel toast. Cause: I edit `CustomerPortal.tsx` from a local canonical copy in my own sandbox rather than the live file directly, and that copy hadn't been refreshed since before Antigravity's store-credit commit — so shipping it clobbered their changes even though I never touched that code. Re-applied all three (import of `calculateTotal`, the `Refunded` status label, the sync effect, the toast) — this commit includes that fix. Lesson for next time: diff against the live device file before shipping a change that's been sitting in a local copy across a gap, not just against what I remember changing.

**Home's first card is now a personal "Welcome back."** Bhimal's ask: the very first thing on Home should make the customer feel recognized, not generic. Merged the old separate greeting-hero and profile-snapshot-row into one card — avatar, "Welcome back, {name}!", tier badge, store credit chip, the Creole phrase, and (if something's arriving today) a highlight strip with that dish's photo folded in underneath rather than displacing the personal greeting like last round's version did. A small "Profile →" link sits top-right.

**Profile now shows points and store credit.** Neither was shown anywhere in the Profile tab before this — only as a small chip on Home, which just got trimmed down. Added a Points / Store Credit stat pair right under the avatar card, and the same loyalty progress bar (points to next tier) inside the tier card, so Profile is a complete picture of the account, not just discounts and perks.

Verified with a clean `npx tsc --noEmit`, shipped.

## 2026-08-10: Claude — "Operator Console" renamed to "Operations"

Bhimal's call: "Operator Console" read like leftover call-center/ERP language for what's really a one-person kitchen management screen. Renamed everywhere:

- `modules/OperatorConsole.tsx` → `modules/Operations.tsx` (component `OperatorConsole` → `Operations`, props interface `OperatorConsoleProps` → `OperationsProps`)
- `App.tsx`: import updated, `View` union's `'operator'` → `'operations'`, landing-page tile label "Operator Console" → "Operations"
- The in-app header title (top of the console itself) → "Operations"

No behavior changed, purely the name. The old `OperatorConsole.tsx` is untracked and moved into `_deleted_modules/modules/` (same reason as the earlier module cleanup — this sandbox can't delete files outright). Safe to remove from `_deleted_modules/` along with the rest whenever convenient.

Verified with a clean `npx tsc --noEmit`, shipped.

## 2026-08-10: Claude — Operations full redesign (menu editing, today-scoping, payments grouping, customer financials)

Bhimal's ask: take Operations as far as Home got — review it end to end and rebuild. Findings and fixes:

**The real bug: nothing was scoped to "today."** Operations has always had a date control at the top explicitly labeled as driving "today" for the rest of the app, but Orders by Dish, Delivery List, and Payments never actually filtered by it — they showed every order ever placed, forever. Harmless with a handful of test orders, but the Delivery List in particular would eventually become an undifferentiated pile of every future week's delivery mixed in with today's. Fixed:
- **Orders by Dish** and **Delivery List** are now scoped to the current week (`weekDateKeys`, derived from the date control) — these two tabs answer "what do I cook/deliver," not "show me history."
- **Delivery List** additionally defaults to *today specifically* (a day-chip row — Mon–Fri, tap to peek at another day — `activeDeliveryDay`), since delivery is a same-day concern, not a week-ahead one.
- **Orders by Dish** shows the whole week (useful for shopping/prep-ahead) but puts today's card first with a "Cook today" badge, since that's the urgent one.
- **Payments** deliberately stays unscoped — an unpaid meal from three days ago is still owed — but is now grouped by delivery date, oldest-first, which is what actually makes the claimed-payment-reference feature (added a few rounds ago) useful: scanning a date-ordered list against a bank statement. Paid items collapse into a "N paid" history toggle instead of cluttering the main view.

**Menu tab is now actually editable.** The old version had a comment admitting "editing next week's curries here is the next piece of work, not built yet." Built it: tap a pencil on any curry to edit its name, description, or price inline, Save/Cancel. This needed `WEEKLY_CURRY_MENU` in `store.ts` to become a real mutable store value (`const` → `let`, plus `subscribeToWeeklyMenu`/`updateCurryOption`, same pattern as `LOYALTY_TIERS`/`CUSTOMER_GROUPS`) instead of a hardcoded constant — and `CustomerPortal.tsx` now subscribes to it too (`weeklyMenu` state) rather than importing the static value, so a price edit shows up on the Customer App immediately, not after a reload. `mealPrice`/`mealSummaryLabel` moved from module-level pure functions into the component (closing over `weeklyMenu`) specifically so none of their ~10 existing call sites needed to change.

**Customers tab now shows points and store credit**, matching what Profile/Home already surface — previously the only place in the whole app to check a customer's balances was the code itself.

**Dead code removed.** `drops`/`paymentDrops` had a branch building drop cards for non-`'Meal Plan'` orders — leftover from the RMS scaffold, unreachable since the Customer App only ever creates `'Meal Plan'` orders. Removed, along with the now-always-true `isMealPlan` field.

**Also added:** dish photos on Orders-by-Dish rows and Delivery cards, for the same reason Home got them — it was the one screen left with zero food photography.

**Near-miss worth recording:** while checking the Payments tab's handling of refunded items, I discovered my local canonical copy of `store.ts` had drifted from this repo's actual `store.ts` — specifically, it was missing the entire `cancelOrderItem` store-credit refund logic from `8bc1843`, because I'd been editing a copy that predated that commit and never diffed it against the live file before this round. Caught it before shipping by staging and diffing the live file first; no data was lost, but it's the second time this exact failure mode has almost happened (the first was `CustomerPortal.tsx` a few rounds back). Going forward: diff any file against the live device copy before editing it, not just before the ones already burned once.

Verified with a clean `npx tsc --noEmit` on both the local build and the live copy, shipped.

## 2026-08-11: Antigravity — Visual Refresh, Floating Bottom Nav, and Header Dropdown Refactoring

Implemented styling updates and restructured the customer navigation flow:

**1. Slide-up Modal Animations**:
* **`index.html`**: Added a smooth, spring-like slide-up transition animation (`.animate-slide-up` with `@keyframes slide-up`) inside the main `<style>` block.
* **`modules/CustomerPortal.tsx`**: Applied the `animate-slide-up` class to both the Meal Builder modal and the new Profile Drawer modal, ensuring they slide up natively rather than snapping instantly.

**2. Brand Ochre Color Swap**:
* **`index.html`**: Swapped out the clashing blue secondary color (`#1d9ec9`) in the Tailwind config with a warm brand ochre gold (`#D8A037`), aligning the Home hero card gradient and background blobs with the earthy food identity.

**3. Interactive Avatar & Dropdown Menu**:
* **`modules/CustomerPortal.tsx`**:
  * Replaced the header log-out back arrow (`ArrowLeft`) with a clickable user avatar button.
  * Added a floating, absolute dropdown menu toggle under the avatar featuring **View Profile** and **Log Out** actions.
  * Added a click-outside detection overlay to dismiss the dropdown when tapping anywhere else.

**4. Relocating Profile & Bottom Nav Restructuring**:
* **`modules/CustomerPortal.tsx`**:
  * Removed the bottom 'Profile' navigation tab.
  * Moved the entire Profile JSX layout wholesale (loyalty points bar, discounts stats, referral code clipboard copy button, address info, and past order history) into a dedicated full-screen slide-up drawer modal (`profileOpen`).
  * Replaced the bottom Profile navigation tab with **Contact Us** (using Lucide's `MessageSquare` icon).
  * Styled the bottom tab navigation bar to float glassmorphically over the layout (`fixed bottom-5 left-1/2 ...`) with safe-area bottom padding for iOS swipe-bars and white fallback transparency for legacy browsers.

**5. Dynamic Contact Support & WhatsApp Sanitization**:
* **`modules/store.ts`**: Added `supportPhone` and `supportEmail` to `SYSTEM_CONFIG` and enabled updates inside `updateSystemConfig`.
* **`modules/Operations.tsx`**: Added input fields in the settings tab (Business branding section) to update Support Phone and Email dynamically.
* **`modules/CustomerPortal.tsx`**: Read contact details dynamically from the config. Sanitized WhatsApp links by stripping spaces and signs, and prepended Mauritian country code (`230`) if it's a standard local 8-digit number.

Verified type compilation checks (`npx tsc --noEmit`) and Vite production bundling (`npm run build`) passed with zero errors.


## 2026-08-14: Antigravity — Firestore Backend, Service-Specific Cutoffs & Cancelled Order Display

This session continued the Firestore/Cloud Functions integration and added two new user-facing features.

### What was done

**1. Firestore Transaction Fix (`functions/index.js`)**
* The `cancelOrderItem` and `editOrderItemSelection` Cloud Functions had a Firestore transaction violation: writes (`tx.update`, `tx.set`) were being called before reads (`tx.get`). Strict Firestore requires all reads inside a transaction to precede any writes. Moved all `tx.get()` calls to the top of each transaction block before any write calls.

**2. Emulator Clock Override (`functions/index.js`)**
* Added `getOverrideDate(request)` helper that extracts `systemDate` from request payload only when `FUNCTIONS_EMULATOR === 'true'`, preserving real wall-clock time for hour/minute accuracy.
* Updated `getMauritiusDateTime` and `checkCutoffPassed` to accept a `systemDateOverride` parameter — used during emulator testing so the Operator Console's testing date picker is respected by backend functions.
* The customer app passes its `systemDate` state in every Cloud Function call payload (`confirmCheckout`, `cancelOrderItem`, `editOrderItemSelection`).

**3. Service-Specific Cutoffs (Lunch vs. Dinner)**

Previously, one shared pair of fields (`orderCutoffTime`/`cancelCutoffTime`) governed all services. Now Lunch and Dinner have fully independent cutoffs:

* **`modules/store.ts`**: Added 8 new fields to `SYSTEM_CONFIG`:
  * `lunchOrderCutoffTime` / `lunchOrderCutoffDayOffset` (default: `12:00`, day offset `-1` = day before)
  * `lunchCancelCutoffTime` / `lunchCancelCutoffDayOffset` (default: `09:00`, same day)
  * `dinnerOrderCutoffTime` / `dinnerOrderCutoffDayOffset` (default: `12:00`, same day)
  * `dinnerCancelCutoffTime` / `dinnerCancelCutoffDayOffset` (default: `14:00`, same day)
  * The `onSnapshot` config listener maps these from Firestore with cascading fallbacks to legacy keys.
  * `updateSystemConfig` was updated to copy all 8 fields into the in-memory `SYSTEM_CONFIG` object (without this the form would reset on every save — this was a bug that was found and fixed).

* **`modules/Operations.tsx`**: The *Delivery Rules & Order Cutoffs* settings card now shows two sub-sections: **☀️ Lunch Service Cut-offs** and **🌙 Dinner Service Cut-offs** (Dinner section is only visible when `dinnerEnabled` is true). All 8 new fields have their own inputs, dirty-check, save, and discard handlers.

* **`functions/index.js`**: `confirmCheckout`, `cancelOrderItem`, and `editOrderItemSelection` each now:
  1. Detect the item's service slot (`Dinner` vs. anything else = `Lunch`)
  2. Resolve the correct config key (`dinnerOrderCutoffTime` or `lunchOrderCutoffTime` etc.)
  3. Enforce the service-appropriate cutoff, with cascading fallbacks to legacy unified keys.

* **`modules/CustomerPortal.tsx`**: `isPastOrderCutoff` and `isPastCancelCutoff` now accept a `service: 'Lunch' | 'Dinner' | Service` parameter and look up the correct Lunch or Dinner thresholds. All call sites pass the appropriate service. Cutoff day-phrase helpers (`orderCutoffDayPhrase`, `cancelCutoffDayPhrase`) also take service as a parameter.

**4. Cancelled Items Remain Visible in Customer App (`modules/CustomerPortal.tsx`)**

Previously, cancelled `OrderItem`s were filtered out of every derived list (`thisWeekLines`, `pastLines`) and simply disappeared. Now:
* Both `thisWeekLines` and `pastLines` include cancelled items.
* `thisWeekLinesWithSeq` assigns `seq: -1` to cancelled items so they don't increment the "Extra 2 / Extra 3" sequence counter for active meals.
* `outstandingTotal` and `awaitingConfirmationLines` explicitly filter out `status === 'Cancelled'` items so balances stay correct.
* Cancelled meals render with: ~~line-through~~ muted text, a red `Cancelled` StatusBadge, a `Refunded` or `No payment due` payment badge, and no Pay/Edit/Cancel action buttons.
* `paymentStatusInfo()` was extended to handle cancelled items (returns `slate` tone instead of `danger`).

**5. Staff CRM Permission Fix (`firestore.rules`)**
* `/customers/{uid}` update rule now allows staff with `manageCustomers` permission to modify the `tier` field. Customers can still update their own document but cannot change `tier`, `points`, `storeCredit`, or `ltv`.

**6. Integration Test (`scripts/testOrderEditCancel.js`)**
* Script verifies checkout → edit selection → mark paid → cancel, checking: order total update, item status `Cancelled`, payment status `Refunded`, and store credit refund — all pass.

### Key Architecture Notes for Next Agent

* **`SYSTEM_CONFIG` is the single source of truth for all runtime config**. It's an in-memory plain object that starts with static defaults and is overwritten by the live Firestore `onSnapshot` listener at `config/system`. If you add a new config key, you must add it to (a) the `SYSTEM_CONFIG` initialiser, (b) the `onSnapshot` `Object.assign` block with fallbacks, AND (c) the `updateSystemConfig` function's per-field `if` assignments — missing (c) causes settings to appear to save but reset on the next snapshot event.
* **Cutoff enforcement is dual-layer**: The Cloud Functions enforce it server-side (cannot be bypassed), and the Customer Portal also enforces it client-side for UX (greying/disabling the UI before the backend rejects). Keep both in sync when changing cutoff logic.
* **`OrderItem.serviceSlot`** is the field used to determine Lunch vs. Dinner service in both the backend functions and the client helpers. It's a string like `'Lunch'` or `'Dinner'`. The check is `serviceSlot.startsWith('Dinner')`.
* **Payment lifecycle**: Customer → selects method → `submitPaymentClaim` (sets `paymentMethodName`/`paymentReference`, status stays `'Pending'`) → Operations confirms → `updateOrderItemsPayment` (sets `paymentStatus: 'Paid'`). Only Operations can set `Paid`. A cancelled prepaid item becomes `paymentStatus: 'Refunded'` and `storeCredit` is incremented on the customer document (transactionally, in the Cloud Function).
* **Testing date override**: The Operator Console has a date picker in the header that writes `MOCK_TODAY` to `localStorage`. Cloud Functions respect this during emulator runs only (`FUNCTIONS_EMULATOR === 'true'`) via the `systemDate` payload field. In production, the functions always use real Mauritius wall-clock time (`Indian/Mauritius` timezone via `Intl.DateTimeFormat`).
* **Commits**: `aafab71` (service cutoffs + cancelled items), `b25fc2c` (settings save fix) — both pushed to `origin/main`.

## 2026-08-14: Antigravity — Week-based Customer Order segregation, Always-on service tags, Operations Filters and service grouping

This session implemented customer app UX feedback and added week/day/service filtering to the Operations Console.

### What was done

**1. Customer App: My Order Week-Based Segregation (`modules/CustomerPortal.tsx`)**
* Split confirmed customer orders into distinct **This week** and **📅 Next week** visual blocks.
* If a customer has no orders scheduled for next week, the next week section remains hidden.

**2. Customer App: Always-On Service Tags (`modules/CustomerPortal.tsx`)**
* Removed the conditional check that only showed the `Lunch` or `Dinner` tags when multiple services existed in the same order. Confirmed orders now always display their respective service slots (`Lunch` or `Dinner`) clearly.

**3. Operations: Orders by Dish Service Grouping (`modules/Operations.tsx`)**
* Rebuilt the *Orders by Dish* card layout to group items by service slot per day. Dishes for a selected day are now grouped under a `☀️ Lunch` or `🌙 Dinner` sub-card within the main day card rather than listed flat.

**4. Operations: Orders by Dish filters (`modules/Operations.tsx`)**
* Added filter states: `ordersWeekFilter` ('this'/'next'), `ordersDayFilter` (specific date or 'all'), and `ordersServiceFilter` ('all'/'Lunch'/'Dinner').
* Implemented a filter bar above the dishes grid.
* Extended the aggregation logic of `dishesByDay` to support both this week and next week dates (mapping `allOrdersDays`).

**5. Operations: Delivery List Filters & Service Grouping (`modules/Operations.tsx`)**
* Extended the `drops` calculation to cover the next week (`allOrdersDateKeys`).
* Added filter states: `deliveryWeekFilter` ('this'/'next') and `deliveryServiceFilter` ('all'/'Lunch'/'Dinner').
* Built a new filter card at the top of the Delivery tab matching the Orders tab styling, featuring:
  * A week toggle ("This week" / "Next week").
  * Active day picker pills (which shift automatically to Monday-Friday dates of the selected week).
  * A service filter row (when Dinner is enabled in the configuration).
* Rebuilt the list to group the day's drops into a `☀️ Lunch` section and a `🌙 Dinner` section (each displaying drop counts), grouping orders dynamically under their service slots.
* Fixed address retrieval logic: resolved customer's primary address `cust?.addresses[0]` directly, replacing the legacy invalid typescript reference to the non-existent `deliveryAddressId`.

### Key Architecture Notes
* **Operations Filter States**: Orders tab uses `ordersWeekFilter`/`ordersDayFilter`/`ordersServiceFilter`. Delivery tab uses `deliveryWeekFilter`/`deliveryDayOverride` (which determines `activeDeliveryDayDate` inside `deliveryDaysForWeek` dynamically)/`deliveryServiceFilter`.
* **TypeScript Compilation**: All code verified with `npx tsc --noEmit` and resolves successfully with zero errors.
* **Commits**: `3465d86` (orders filters + week split), `864f8a3` (delivery list filters, grouping by service inside days, address fix) — both pushed to `origin/main`.

## 2026-08-14: Antigravity — Persisted Meal Ratings, Customer Comments & Security Rules Updates

This session implemented Option 1: Persisted Meal Ratings with customer comment reviews, updating database schemas, security rules, and console integration.

### What was done

**1. Data Model Extension (`types.ts`)**
* Extended the `OrderItem` interface to include optional `rating?: number;` and `ratingComment?: string;` fields.

**2. Customer Portal: Firestore Updates & Review Dialog (`modules/CustomerPortal.tsx`)**
* Imported `updateDoc` from `firebase/firestore`.
* Extended `rateTarget` and updated `openRating` to capture `fsItemId` (the Firestore item document ID) along with `orderId`.
* Rewrote `submitRating` to perform a direct Firestore `updateDoc` on the target order item (`orders/{orderId}/items/{itemId}`) when available, with a fallback to the local component state map for mock orders.
* Added a `rateComment` state variable and built a text area block inside the Rating modal/sheet to collect optional feedback.
* Connected submission loading states (`ratingSubmitting`) to disable inputs and display a spinner during database writes.
* Refactored loop rating references in both "This week" and "Next week" views to check `line.item.rating` (live database values) before falling back to local memory.

**3. Firestore Security Rules Update (`firestore.rules`)**
* Modified the `/orders/{orderId}/items/{itemId}` update rules to allow customers to update their own documents even when the item is already `Paid` (required since ratings are only allowed on paid, completed orders).
* Ensured safety by restricting the customer from modifying critical order details (price, qty, name, status, dates, etc.) and blocking updates to payment fields (`paymentMethodName`/`paymentReference`) once payment is confirmed.

**4. Operations: Paid History Feedback Loop (`modules/Operations.tsx`)**
* Embedded customer reviews directly into the Payments tab under **Paid History**.
* If a customer has rated any item in a completed drop, a styled feedback block renders beneath their drop description showing the star count (`★`) and their review comment.

### Key Architecture Notes
* **Rating Storage**: Ratings are stored directly in the `OrderItem` subcollection. Since the client listens to orders/items live via snapshot collection group queries, rating changes update the UI seamlessly.
* **Security Constraints**: Customers are permitted to update `rating` and `ratingComment` on any item they own, but payment details are locked down once `paymentStatus == 'Paid'`.
* **Commits**: `053200e` (ratings persistence + rules + Operations view), `0aa8f8e` (rules evaluation get() fix) — pushed to `origin/main`.

