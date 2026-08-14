# BonManzE — Changelog Against v1 Scope

Running record of what ships in `BonManze_PWA`, checked against `BonManzE_v1_scope.md`. Purpose: catch scope drift early rather than after it compounds (see the RMS Assessment for what unchecked drift produced last time).

This file lives in the repo (not the Claude Project) so entries are normal git commits — small diffs via the usual Claude/Antigravity commit flow — instead of a full-document rewrite every time. It moved here from the Claude Project doc `claude/BonManzE_Changelog.md` on 2026-08-12 after that doc's every-entry full-rewrite was flagged as a real cost problem. See `BonManzE_Working_Agreement.md` for the reasoning and the updated convention.

---

## 2026-08-10 — Operations Redesign (Antigravity)

**Commit:** [`15e05fb`](https://github.com/BhimalL/BonManze_PWA/commit/15e05fb31a89c890731f8f7027d14d2325ce2550)
**Verified:** `npx tsc --noEmit` clean, pushed to `main`.

**Changes:**
- **Meal Storage refactor** — `WEEKLY_CURRY_MENU` moved from a static constant into a reactive, subscribable `store.ts` value (same pattern as `LOYALTY_TIERS`). `CustomerPortal.tsx` now subscribes live instead of reading a snapshot. Operator Console's Menu tab gets inline pencil-icon edits (name/description/price) that propagate to the Customer App without a reload.
- **Orders by Dish** — scoped to the current week, with a "Cook today" section highlighted.
- **Delivery List** — defaults to today, with day-chips to preview upcoming days.
- **Payments** — grouped chronologically (oldest first); paid/historical balances collapsed under a toggle.
- **Customers tab** — now shows points and store credit balances per CRM record.
- Dish photos rendered inline in Orders and Delivery lists.

**Assessment against v1 scope:**
- Menu store refactor, Orders-by-Dish, Delivery List, and Payments changes all map directly onto the trimmed Operator Console screens the scope doc calls for ("This week's menu," "Orders by dish," "delivery list," "trimmed Cashier"). No shift/till/Z-report machinery pulled back in — good.
- Does not touch any cut module (Accounting, PO, Inventory, Employee Portal, POS/table logic) or regress the persistence gap — no sign of drift back toward the 20-module vision.
- **Flagged, not blocking:** "store credit balances" on the Customers tab wasn't in the v1 scope (which specified contacts, order history, loyalty tier only) — worth a second look if it implies new reconciliation logic rather than reusing an existing field. Inline dish photos in Orders/Delivery are additive polish, not requested, but low-risk.
- Persistence status: not part of this commit specifically. **Correction (2026-08-11):** an earlier note here claimed persistence was "still outstanding" project-wide after this point — that was wrong. Per `AGENTS.md`, a full `localStorage`-backed persistence layer (`persistAll()` in `store.ts`) was added the same day (2026-08-10), covering orders, customers, config, and everything else in this doc going forward. See the correction entry near the middle of this changelog for the one real gap that was found (menu overrides) and has since been fixed.

---

## 2026-08-10 — Dinner Offering & Receipt Regrouping (Claude, committed by Antigravity)

**Commit:** [`6644b71`](https://github.com/BhimalL/BonManze_PWA/commit/6644b7163d3f3160530edcebd65c0b6304f27657)
**Verified:** `npx tsc --noEmit` clean (both mid-build and on the final live copy), `npm run build` clean, pushed to `main` by Antigravity.

**Changes:**
- **Dinner offering (new)** — a second, independently toggleable offering alongside Lunch, built as fully parallel state rather than generalizing Lunch's existing code into a multi-service abstraction:
  - `store.ts`: `SYSTEM_CONFIG.dinnerEnabled` (defaults `true`), plus a full parallel `WEEKLY_DINNER_MENU` + `subscribeToDinnerMenu` + `updateDinnerCurryOption`, mirroring `WEEKLY_CURRY_MENU` exactly.
  - `CustomerPortal.tsx`: Dinner gets its own draft cart, weekly menu, and meal builder; a Lunch/Dinner tab switcher on the Menu tab (shown only when enabled); checkout tags Dinner items `serviceSlot: 'Dinner'`/`'Dinner-2'`, same convention as Lunch. Same 9:00 AM same-day cutoff as Lunch — no separate cutoff config added, since Lunch's own cutoff doesn't read from `SYSTEM_CONFIG.cutoffTime` either.
  - `Operations.tsx`: a "Dinner offering" toggle on the Menu tab (Operations-only, never customer-facing) flips `dinnerEnabled`; a Dinner menu-editing grid (same inline pencil-edit UI as Lunch) appears underneath when enabled. "Orders by Dish" now keys by service + name, not name alone, so same-named Lunch/Dinner dishes no longer get summed together.
- **My Order / Receipt regrouping** — Draft, Confirmed ("My Order"), and the receipt/invoice all now nest **Order → Offering (Lunch/Dinner) → Day**, via a shared `groupByOrderServiceDay()` helper, instead of grouping by day alone. A receipt can span more than one order (a "Pay balance" claim settles everything outstanding at once) — the item table shows an "Order …" sub-header when that happens, and a Lunch/Dinner sub-header when a receipt or order spans both offerings.

**Assessment against v1 scope:**
- Matches the v1 scope doc's own "Future direction" preview almost exactly: it called Dinner "the cheap extension... mostly a menu-authoring and cutoff-time change... not new architecture," and that's what shipped — no new backend, no new cutoff logic, no new abstraction layer over Lunch.
- Parallel-state choice (separate `dinnerCart`/`WEEKLY_DINNER_MENU` rather than a composite service key threaded through the existing cart) was a deliberate lower-risk tradeoff over generalizing ~15 existing `cart[...]` call sites — consistent with the "avoid enterprise scope creep" posture elsewhere in this doc.
- Does not touch any cut module. **Correction (2026-08-11):** the persistence layer already existed by this point (added 2026-08-10, see correction note above) — it was not "still outstanding."
- No blocking flags.

---

## 2026-08-11 — Two-Week Ordering, Week-Specific Menus, Home Redesign, Dynamic Cutoff & Guide (Claude)

**Commit:** landed split across [`0304305`](https://github.com/BhimalL/BonManze_PWA/commit/0304305c82353b38414e4511ec698f9bae62bb12) (the `store.ts`/`Operations.tsx` portions — `cutoffDayOffset`, per-service delivery windows) and [`ad9364f`](https://github.com/BhimalL/BonManze_PWA/commit/ad9364f072f3cc8431a8216ddcf4b5b651f9a1f6) (the `CustomerPortal.tsx` portions — two-week ordering, Home redesign, guide, meal builder fixes, Menu photo cards). See the commit-split note at the end of the next entry — neither commit's message actually mentions this entry's work, since both commits were staged by file rather than by feature.
**Verified:** `npx tsc --noEmit` clean, independently reproduced by Claude against the pushed `origin/main` HEAD.

**Changes:**
- **Two-week ordering** — customers can now browse and order This Week and Next Week, for both Lunch and Dinner. `orderableWeeks` bundles both weeks everywhere "everything orderable" needs walking (cart totals, checkout, Draft/Confirmed rendering), so widening the horizon further later means extending one array, not touching every call site.
- **Week-specific menu overrides** — `WEEKLY_CURRY_MENU`/`WEEKLY_DINNER_MENU` renamed and rebuilt on a shared `createWeeklyMenuStore(defaultMenu)` factory: any week without an explicit edit automatically falls back to the default rotation; editing a week (not just "next") seeds an override for just that week. Chosen over a manual "Current/Next" two-slot model per Bhimal's explicit answer ("Automatic, tied to the calendar"). **Note:** this override data had a persistence gap, fixed 2026-08-11 (see entry below).
- **Full-week bulk discount** now scoped per calendar week (5 covered days within one week earns that week's discount only, not summed across both weeks) — a judgment call flagged to Bhimal rather than re-confirmed.
- **Home page redesign** — welcome/profile hero rebuilt with a gradient + glassmorphism treatment (blurred color blobs, frosted "arriving today" panel); the this-week-only dish-photo carousel replaced with "Order for..." shortcut tiles (one per week × offering combination, real dish photos, tapping jumps straight to that week/offering in the Menu tab).
- **Dynamic order cutoff & delivery windows** — `SYSTEM_CONFIG.cutoffTime` default corrected from an unused `14:00` to `09:00` (matching what was actually enforced), plus a new `cutoffDayOffset` (0 = delivery day, -1 = day before, etc., editable from Operations) and per-service `lunchDeliveryWindow`/`dinnerDeliveryWindow`. The Customer App's Home status card, lock toasts, and guide now all read these live instead of hardcoded copy ("Sunday noon," "11:30–12:00," "9:00 AM") that had drifted from the real rule.
- **"New Here?" guide** redesigned from a flat numbered list into an icon-led card, now covering both ordering weeks and both offerings instead of implying "this week's Lunch only."
- **Meal builder fixes** — added a confirmation popup when skipping a free extra (dhal/salad), so it isn't lost by accident (paid extras like beverage/dessert don't trigger it); extras now render as individual tags (photo header pills, "Make it yours" section summary) instead of a cumulative "N extras" count; added a short dish description under the builder's main photo.
- **Menu tab** — the day-by-day curry-browsing list redesigned into 3-per-row photo cards with dish name/description/price overlaid on the image. (This same treatment was first tried on My Order's Draft/Confirmed lists, then explicitly reverted back to the original text-row layout per Bhimal's correction — the photo-card treatment belongs on Menu, not My Order.)

**Assessment against v1 scope:**
- All of this is refinement of already-in-scope Customer App features (weekly ordering, the meal builder, menu browsing) — no new modules, no backend changes.
- Visual polish (Home hero, guide, Menu photo cards) falls under the scope doc's "nice-to-have, keep if low-cost" allowance — additive, not architectural.
- Does not touch any cut module. **Correction (2026-08-11):** the general persistence layer already existed by this point — the actual gap was narrower (menu overrides only), and has since been closed; see the entries below.
- No blocking flags.

---

## 2026-08-11 — Navigation Refactor & Visual Refresh: Contact Us Tab, Profile Drawer, Floating Nav (Antigravity, reviewed by Claude)

**Commit:** landed split across the same two commits as the entry above — [`0304305`](https://github.com/BhimalL/BonManze_PWA/commit/0304305c82353b38414e4511ec698f9bae62bb12) "Implement dynamic contact support details configuration in store and Operations console" and [`ad9364f`](https://github.com/BhimalL/BonManze_PWA/commit/ad9364f072f3cc8431a8216ddcf4b5b651f9a1f6) "Refactor Customer App navigation... and apply visual refresh", both on `main`.
**Verified:** `npx tsc --noEmit` clean, independently reproduced by Claude against the pushed `origin/main` HEAD (`git log` confirms `HEAD -> main, origin/main` on `ad9364f`). `npm run build` exit 0 on Antigravity's machine; fails in Claude's cloud device-bridge sandbox with a known, unrelated rollup native-binary error — an environment quirk of that bridge, not a code defect.
- **Commit-split note (flagged, not blocking):** both commits were staged with `git add <specific files>` rather than by feature, and both files (`store.ts`/`Operations.tsx`, and `CustomerPortal.tsx`/`index.html`) each carried uncommitted work from *both* this entry and the "Two-Week Ordering" entry above at the time of staging. So `0304305`'s message only describes the new `supportPhone`/`supportEmail` fields but its diff also contains the entire `cutoffDayOffset`/delivery-window addition from the prior entry; `ad9364f`'s message only describes the nav/visual refresh but its diff also contains the entire two-week-ordering/Home-redesign/meal-builder/Menu-photo-card work. Confirmed by inspecting each commit's diff directly, not just the message. Nothing is broken by this — both commits are individually clean and buildable — but a future `git revert` of either commit would take out both feature sets at once, not just the one named in its message. Worth being more deliberate about `git add` scoping matching intended commit boundaries next time; not worth rewriting already-pushed history over.

**Changes:**
- **Brand ochre color swap** — `SYSTEM_CONFIG`'s Tailwind `secondary` token changed from a clashing blue (`#1d9ec9`) to a warm ochre (`#D8A037`). Confirmed the only usage site in the codebase was the Home hero's gradient and blur blob, so this is fully contained to that one component — doesn't touch Operations.
- **Header avatar dropdown** — the avatar is now interactive (View Profile / Log Out), with a click-outside overlay to dismiss. Replaces an unlabeled arrow-icon button that logged out immediately with no confirmation — a real usability fix, not just a rearrangement.
- **Profile demoted from a persistent tab to a full-screen slide-up drawer** (`profileOpen`) — reuses all existing Profile content (loyalty tier card, referral code copy, delivery address, order history) wholesale rather than rebuilding it, avoiding regressions in already-working logic.
- **Bottom nav restructured** to Home / Menu / My Order / Contact Us, now a floating glassmorphic pill (`fixed`, `backdrop-blur-xl`) with iOS safe-area bottom padding; degrades gracefully to a near-solid white bar on browsers without `backdrop-filter` support since the background itself is `bg-white/95`. **Later refined (2026-08-11, Claude, committed in `f3a5a14` below):** the fixed nav was found to overlap the last scrolled card on some screens — `<main>`'s bottom padding increased to guarantee clearance — and the flat tint was changed to a light `from-primary/10 via-white/95 to-secondary/10` gradient per Bhimal's request, to make the bar more visually distinguishable from the page behind it.
- **New Contact Us tab** — WhatsApp deep link (phone sanitized to digits-only, auto-prepends Mauritius's `230` country code for local 8-digit numbers) and a `mailto:` link, both reading live from two new `SYSTEM_CONFIG` fields (`supportPhone`, `supportEmail`) editable from Operations; plus a dynamic hours/delivery-window card reusing the cutoff/delivery config from the prior entry.
- **Slide-up animation** — the meal builder and the new Profile drawer both animate in via a new CSS keyframe (`translateY(100%)` → `0`, 0.28s) instead of appearing instantly. This was originally scoped in the plan but shipped missing in the first pass; caught in review and added in a follow-up round.
- **Meal builder glow scoped down** — the "selected" glow-ring treatment proposed in the original design audit was restricted to just the Curry and Base cards per review feedback, leaving the repeated dhal/salad/beverage/dessert chips with their original, simpler border treatment so a row with several selections doesn't read as uniformly "glowing."
- **`package-lock.json` committed** for the first time (bundled into `0304305`), locking dependency versions across working copies going forward.

**Assessment against v1 scope:**
- Pure Customer App polish plus one genuinely useful addition — a real support channel, which fits a small boutique home-delivery business better than a persistent Profile tab a customer opens rarely.
- Loyalty/referral engagement hooks (the concern with demoting Profile) remain visible without opening the drawer, since Home already surfaces a Loyalty progress card and a "Refer a friend" quick-action tile — this change doesn't bury them further.
- **Confirmed (2026-08-11):** `supportPhone`/`supportEmail` are editable from Operations' Business branding card (`brandForm.supportPhone`/`supportEmail`) — already fully configurable, not hardcoded. Bhimal should still swap in the real, final contact values there before customers see them; the mechanism itself needs no further work.
- Does not touch any cut module. **Correction (2026-08-11):** see the persistence-gap correction below.
- No blocking flags.

---

## 2026-08-11 — Menu-Override Persistence Fix, and Correction to Prior "Persistence Outstanding" Notes (Claude)

**Commit:** [`cc0967d`](https://github.com/BhimalL/BonManze_PWA/commit/cc0967db39c314bac2786105a8726ada0b79d85d) "Implement local storage persistence for weekly menu overrides", pushed to `main` by Antigravity.
**Verified:** `npx tsc --noEmit` and `npm run build` clean on Antigravity's machine; independently confirmed by Claude against the pushed commit — `git show --stat cc0967d` touches only `modules/store.ts` (30 insertions, 1 deletion), and the diff contains exactly the described change (`LUNCH_MENU_OVERRIDES`/`DINNER_MENU_OVERRIDES` fields, `getSnapshot`/`hydrate`/`addRawListener` on `createWeeklyMenuStore`) — commit message matches its diff this time, file-level split worked cleanly since this round's two changes happened to land in two different files.
**Context:** while answering Bhimal's question about how "next week's" menu becomes "this week's" and what happens to a customer's My Order after fulfillment, direct code review surfaced two things:
1. Every prior entry in this changelog repeated a stale claim that the localStorage persistence layer was "still outstanding." That was wrong — per `AGENTS.md`, `persistAll()`/`PERSIST_KEY` in `store.ts` was added on 2026-08-10 and has been persisting orders, customers, config, and everything else in this doc ever since. Corrected inline in each entry above.
2. The one real gap: the two week-specific menu override stores (`lunchMenuStore`/`dinnerMenuStore`'s internal `overrides`, added as part of the "Week-Specific Menu overrides" work above) were never added to the `PersistedState` snapshot. Practical effect: if Operations set up a custom menu for a future week, it would silently revert to the default rotation on any refresh before that week arrived — no error, easy to mistake for "I forgot to save."

**Fix:** `createWeeklyMenuStore` gained `getSnapshot()`/`hydrate()`/`addRawListener()`; both menu stores are now included in `persistAll()`'s snapshot and the module-load hydration block, the same mechanism every other piece of state already uses. No other behavior changed.

**Decision (Bhimal, "as a professional business & being practical"):** fix the persistence gap now (small, contained, matches the existing pattern) rather than leave same-day-only editing as an accepted limitation. **Verified live by Bhimal** on the running app: set a custom Next Week menu in Operations, refreshed, confirmed it survived. The Order History 10-item display cap was raised in the same discussion and initially deferred as low priority — see the next entry, where it was revisited and changed the same day.

**Assessment against v1 scope:** Bug fix to existing persistence infrastructure, not a new feature — no scope impact. No blocking flags.

---

## 2026-08-11 — Order History: Rolling 3-Month Window Instead of a 10-Item Cap (Claude)

**Commit:** [`f3a5a14`](https://github.com/BhimalL/BonManze_PWA/commit/f3a5a1479032b003e88179231d427bf8f7491f72) "Refactor order history to show 3-month window and visual curry selection grid", pushed to `main` by Antigravity.
**Verified:** `npx tsc --noEmit` and `npm run build` clean on Antigravity's machine; independently confirmed by Claude against the pushed commit — `git show --stat f3a5a14` touches only `modules/CustomerPortal.tsx` (45 insertions, 13 deletions).
- **Commit-message scoping note (flagged, not blocking — same pattern as the earlier nav-refactor commits):** the message names only the Order History window and the curry photo grid, but the diff also contains three other small fixes that were sitting uncommitted in this file before this session started: the floating nav's padding/gradient fix, the Lunch service badge on Draft cart cards, and the meal-note defaulting to the signed-in customer's name. Confirmed directly in the diff (`grep` for `from-primary/10 via-white`, `bg-accent/10 text-accent`, `currentUser.firstName`, all present). Nothing is broken — the commit is clean and buildable, and the file-level split this round correctly kept it isolated from the unrelated `store.ts` persistence fix above — but the instructions given to Antigravity explicitly asked for all of this file's changes to be listed in the message, and that didn't fully happen. Noting the pattern since it's now happened twice; not worth amending an already-pushed commit message over.

**Context:** the earlier persistence-fix entry flagged Order History's hard `pastLines.slice(0, 10)` cap (no pagination, nothing past the 10 most recent past orders was ever visible) as low-priority and deferred. Bhimal revisited it and asked for a change: keep the underlying order data forever (which the app already does — nothing in `ACTIVE_ORDERS` is ever deleted by any code path, so full history was never actually at risk), but change what the customer *sees* in Profile's Order History from a fixed count to a rolling 3-month window.

**Fix (all in `modules/CustomerPortal.tsx`, this commit):**
- Added an `addMonths(dateStr, months)` helper alongside the existing `addDays` (same whole-calendar-unit approach, so it behaves correctly across 28/30/31-day months rather than approximating with a fixed day count).
- `pastLines` now filters on `item.deliveryDate >= addMonths(systemDate, -3)` in addition to the existing "before this week, not cancelled" checks, and the render no longer does `.slice(0, 10)` — every order within the 3-month window shows, however many that is.
- Added a small "Last 3 months" label next to the "Order history" heading so the window is visible to the customer, not just an invisible cutoff.
- No backend/data change needed — `ACTIVE_ORDERS` already retains every order indefinitely; this was purely a display-layer filter change from "most recent 10" to "most recent 3 months."
- (Also in this commit, previously uncommitted — see scoping note above) floating nav padding/gradient fix, Lunch service badge fix, meal-note default-to-signed-in-user, and the meal builder's curry-selection photo grid.

**Assessment against v1 scope:** Small, contained UX change to an already-in-scope Customer App screen — no new modules, no data-model change. No blocking flags.

---

## 2026-08-11 — Operations Console Redesign: Sidebar SaaS Layout, Dashboard, Settings Hub, Real Date Default (Antigravity, reviewed by Claude)

**Commits:** [`3eb13f9`](https://github.com/BhimalL/BonManze_PWA/commit/3eb13f99519a2005d45634a221e6eec0290261a3) "Initialize MOCK_TODAY dynamically with real date and export getRealTodayISO helper" (`store.ts` only) and [`88f2c44`](https://github.com/BhimalL/BonManze_PWA/commit/88f2c4470967f3660130246c1510a3d4123bd7df) "Redesign Operations Console: left sidebar navigation layout, Overview Dashboard, Settings Hub, date warning banner, searchable CRM, and double-confirmation payment triggers" (`Operations.tsx` only), both on `main`.
**Verified:** `npx tsc --noEmit` and `npm run build` clean on Antigravity's machine; independently confirmed by Claude — `git show --stat` on both commits shows a clean one-file-each split (`store.ts`: 11 insertions/2 deletions; `Operations.tsx`: 955 insertions/578 deletions), `git status` clean after push, `HEAD -> main, origin/main` on `88f2c44`. Line-by-line read of the actual diff confirmed every item below is genuinely present, not just described in the message — and this time the commit message itself correctly inventories everything in the diff (the under-description pattern flagged on the last two rounds did not recur here).

**Context:** the Operations Console had grown organically while focus was on the Customer App — a flat horizontal-tab layout with global settings (branding, order cutoff/delivery windows, VAT, the Dinner offering toggle) scattered across unrelated tabs (mostly hiding inside "Payments"), no overview/dashboard, and a visual style sharing nothing with the Customer App's redesigned look. Bhimal asked for a UI/UX review; Claude did an independent pass over the code, Antigravity proposed a redesign, both were reconciled (see prior conversation — not a separate changelog entry) before this build.

**Changes:**
- **Persistent left sidebar** replaces the horizontal tab strip, grouped into **Operations** (Dashboard, Menu Planner, Orders by Dish, Delivery List, Payments, Customer Directory) and **Configuration** (Settings) — plus a labeled "⚡ Testing Controls" widget pinned to the sidebar bottom (date override input + "Reset to Real Today" button), replacing the bare, unlabeled date picker that used to sit in the main header.
- **Dashboard** is the new default landing tab (previously "Orders by Dish" opened by default), showing exactly four KPI tiles — Today's Cook Count, Deliveries Pending, Awaiting Confirmation, This Week's Revenue — plus an honest "System is configured to run entirely in local storage. All changes are saved on your local device" note, addressing the multi-device-sync caveat below without pretending it's solved.
- **Settings Hub** consolidates every scattered config card into one place, in three sections: Brand Identity & Support Contact, Delivery Rules & Order Cutoffs, and Offerings & Tax/VAT (the Dinner offering toggle now lives here, correctly reclassified as a system setting rather than menu content). A single unified dirty-state floating bar ("You have unsaved configuration changes" — Save/Discard) replaces the three separate per-card save buttons that previously risked a silently-lost edit if you edited one card and clicked into another without saving.
- **`store.ts`: real "today" default.** `MOCK_TODAY` previously defaulted to a hardcoded string (`'2026-01-27'`) with no fallback to the real device clock — production would have needed someone to manually advance the date every day forever. Now defaults via a new exported `getRealTodayISO()` helper; the manual override is preserved (via existing hydration) purely as a testing affordance. Because a saved override still persists across reloads, a stale test date could in principle resurface — but a header banner (`⚠️ Testing date active: [date]`, with an inline Reset link) is now rendered outside any single tab's view, so it's visible from every screen in the console, not just the Testing Controls widget — turning "silently stuck on a stale date" into "impossible to miss."
- **Week-range headers** ("Week of Monday, Aug 10") added to both Menu Planner and Delivery List, computed off the actual week being viewed/edited (tracks the This/Next selector on Menu Planner).
- **Double-confirmation scoped to money only** — inside the Collect Payment modal, clicking a payment method arms it ("Confirm [Method]?"); a second click commits. Verified this is tracked per-button (`confirmPaymentId === m.id`), so clicking a different method mid-confirmation switches which one is armed rather than misfiring the first. "Mark Delivered" deliberately stays a single click, per Bhimal's call that routine high-frequency actions shouldn't carry the same friction as ones involving money.
- **Searchable Customer Directory** — filters by name, tier, phone, email, or address (street/city), a superset of the originally-requested name/address/tier.
- **Visual palette merge** — background swapped from a cool slate (`bg-[#f8fafb]`) to the Customer App's warm cream family (`bg-[#FAF6EE]`), sidebar active-state and primary actions in the brand green, `border-[#E7E0D0]`/`rounded-2xl`/`rounded-3xl` card language matched to the Customer App.

**Known, accepted trade-off (not a bug):** the Dinner offering toggle and VAT on/off switch previously committed immediately; both are now folded into the same unified draft-until-saved Settings flow as everything else. Practical effect: flipping Dinner off in Settings without saving immediately hides the Dinner grid in Menu Planner (since that view reads the local draft state), even though nothing is actually live yet on the Customer App. Not a silent trap — the floating "unsaved changes" bar is global, not scoped to the Settings screen, so it stays visible as a reminder regardless of which tab you're on. Accepted as the right trade-off for the simpler one-save model.

**Explicitly out of scope for this redesign (tracked separately):** true multi-device sync. Bhimal confirmed the real deployment target is ~10 staff each on their own separate device, and this app has no backend of any kind (confirmed via search — no `fetch`/API calls anywhere) — `localStorage` never syncs between two devices. Antigravity's dashboard note above sets honest expectations rather than claiming this is solved; a real fix requires an actual shared backend/database, which is intentionally deferred to a later, separate phase (per Bhimal's "dev mode first, backend once the UI/UX and functions are proven" strategy). See the project's `BonManzE_Backend_Requirements.md` doc for the running list of what that phase will need to address (this item, the real-date-default follow-through, staff login/identity, and config audit logging).

**Assessment against v1 scope:** Operator Console UX/IA overhaul, no new backend or data model — matches the "trimmed Operator Console" the scope doc calls for, just organized better. No blocking flags.

---

## 2026-08-11 — Meal Library Linking, Icon Library, Dish Photos, Base/Beverage/Dessert Rework (Claude, committed by Antigravity)

**Commit:** [`e4fd37f`](https://github.com/BhimalL/BonManze_PWA/commit/e4fd37ffdb30bd1e600f42e9b16d0e1d038b0126) "Link menu dishes to Meal Library, add Icon Library and dish photos, rework Base/Beverage/Dessert options", pushed to `main` by Antigravity.
**Verified:** `npx tsc --noEmit` clean and `npm run build` clean on Antigravity's machine (both re-run by Antigravity immediately before commit, on top of Claude's own `tsc --noEmit` pass earlier the same round); independently confirmed by Claude against the pushed commit — `git show --stat e4fd37f` and `git log origin/main -1` both checked directly against the device, matching exactly the 5 files requested (`modules/store.ts`, `modules/Operations.tsx`, `modules/CustomerPortal.tsx` modified; `modules/Portal.tsx`, `modules/IconPicker.tsx` new) with no scope drift — `git status` clean after push. Note: Antigravity's own chat summary of the run quoted a garbled/incorrect commit hash; the hash above is the one independently read off `git log`/`origin/main`, not the one Antigravity reported.

**Context:** the Meal Library (Mains catalog) had been introduced in the prior round but wasn't yet linked to the live Menu Planner, its editor still exposed name/description as editable even when a day-slot dish was drawn from the Library, dish photos had no upload path, Base only supported a single flat "Base Group" dropdown (unlike the checkbox-based applicable+narrow pattern already used for Dhal/Salad), and every emoji/icon field across Operations was a raw free-text input. Bhimal reported this via screenshots plus a follow-on request for a reusable Icon Library.

**Changes:**
- **Day-slot dish editor locked to the Library.** When a day-slot dish carries a `mainId` (i.e., it's drawn from a Meal Library Main rather than freehand), its name and description fields are now read-only — only Price stays editable, since price is the one thing legitimately varied per day/slot. The "Library price Rs 95.00 — set lower for a special price" hint was reworded and moved to its own line below Save/Cancel rather than crowded next to the price field.
- **Menu-to-library migration now links, not just creates.** `migrateMenuToLibrary()` in `store.ts` previously only created a Main per distinct dish name; it now also backfills every existing day-slot dish — across the default rotation and every saved week override — with the matching Main's `mainId`, skipping any dish that's already linked. Lunch and Dinner are still walked as separate canonical pools (unchanged from the original migration) so same-named-but-differently-priced dishes across services aren't conflated into one Main.
- **Modal backdrop clipping fixed.** The Main Editor, Main Picker, and Collect Payment modals in Operations were being visually clipped to the admin console's `overflow: hidden` main-content column — the dimmed/blurred backdrop stopped short of the sidebar instead of covering the full screen. Fixed with a new `Portal` component (`modules/Portal.tsx`) that renders modal content straight to `document.body`, sidestepping the clipping ancestor; applied to all three affected modals. `CustomerPortal.tsx`'s modals were left untouched since that layout wasn't reported broken.
- **Dish photo upload** added to the Main Editor (base64, capped at 1.5MB), with `dishPhotoFor()` widened to accept either a dish object (preferring its `photoUrl`) or a bare id string (falling back to the existing protein-family guess), so every existing call site kept working unchanged.
- **Base redesigned to match Dhal/Salad.** The single "Base Group" dropdown was replaced with a "Base applicable" checkbox plus a narrow-to-specific-items checklist — the same applicable+narrow pattern Dhal and Salad already used. Beverage and Dessert gained the same "applicable" checkbox (they previously only supported narrowing, with no way to turn the category off entirely for a given dish). A backward-compatible fallback (`dishBaseOptionIds`) derives an equivalent item list from any dish's legacy `baseGroup` value when no explicit `baseOptionIds` is set, so dishes configured before this change (e.g. a bread-restricted dish) keep behaving the same without a data migration.
- **Latent bug fixed, not user-reported:** the `*OptionIds` narrowing fields (added in the prior round) were fully editable in the Main Editor but were never actually read on the customer-facing side — `filterAddOnOptions` existed in `store.ts` but wasn't called anywhere in `CustomerPortal.tsx`, so restricting a dish's dhal/salad/beverage/dessert options had zero visible effect. Wired into all four ChipRows; found while extending the same applicable+narrow pattern to Base.
- **Icon Library (new).** A curated, admin-managed set of ~30 food-delivery emoji, with the same CRUD pattern as the existing Add-on catalogs, under a new Settings → Icons tab. Every free-text emoji `<input>` across Operations (Main icon, both Add-on Catalog emoji fields) was replaced with `IconPickerButton` (`modules/IconPicker.tsx`), which opens a searchable picker modal over the library instead.

**Assessment against v1 scope:** All refinement of the already-in-scope Meal Library / Menu Planner / Operations admin surface — no new modules, no backend changes, no drift toward anything the v1 scope doc cut. The `filterAddOnOptions` fix is a correctness fix to existing, already-approved scope (option narrowing was part of the original Add-on Catalog design), not new functionality. No blocking flags.

**Open loop, resolved in the next entry:** the "Import from existing menu" button in the Meal Library tab was intentionally kept in place this round rather than removed as Bhimal requested, because the linking half of the migration didn't exist yet when his 16 Mains were first imported — those Mains existed but weren't linked to the Menu Planner. It turned out a deeper bug (Main edits never propagating to already-placed day-slot dishes at all — see the next entry) made this moot; the button has since been removed for good, replaced by an automatic one-time migration.

---

## 2026-08-11 — Meal Library Config Now Resolves Live From the Linked Main; Builder Gating & Free-Item Fixes; Automatic Migration (Claude, committed by Antigravity)

**Commit:** [`e9268ca`](https://github.com/BhimalL/BonManze_PWA/commit/e9268cacd30f78fc51253cbfd5ed3ce5447ae0e9) "Resolve Meal Library config live from linked Main, fix Add-to-order gating, generalize free-item flagging, auto-run library migration", pushed to `main` by Antigravity.
**Verified:** `npx tsc --noEmit` clean (Claude's own pass before handoff, and Antigravity's independent pass before commit) and `npm run build` clean on Antigravity's machine; independently confirmed by Claude against the pushed commit — `git show --stat e9268ca` and `git log origin/main -1` both checked directly against the device, matching exactly the 4 files intended (`modules/store.ts`, `modules/Operations.tsx`, `modules/CustomerPortal.tsx`, `vite.config.ts`, all modified) with no scope drift. As with the prior entry, Antigravity's own chat summary quoted a garbled commit hash; the hash above is the one read directly off `git log`.

**Context:** Bhimal reported that after restarting the dev server, the Meal Library showed "No Mains yet" despite having imported 16 Mains the previous round, and — via screenshots — that unticking a category (Dhal) on a Main had no effect on the Customer App's meal builder for a dish linked to that Main, even though Base narrowing appeared to work. He also asked for the "Import from existing menu" button to be permanently retired, for Add-to-order to stop requiring a Base/Dhal/Salad pick when a dish doesn't actually offer one, for the free-item-skip warning to generalize beyond a hardcoded Dhal/Salad assumption, and for "No dhal"/"No salad" to read "None" like Beverage/Dessert.

**Root cause (the empty Library):** `vite.config.ts` pinned dev server port 3000 but without `strictPort`, so if that port was ever already held (e.g. a previous `npm run dev` process not fully exited), Vite would silently start on 3001 instead — and this app's entire persisted state (`localStorage`) is scoped per browser origin, which includes the port. A silent port change strands every existing record (Mains, orders, customers) under the old origin, reading as data loss when it's actually just unreachable from the new URL. This risk applied to the whole app, not just the Library — worth knowing given `ACTIVE_ORDERS`/`GLOBAL_CUSTOMERS` live in the same store.

**Root cause (config not propagating):** confirmed by reading `pickMainForDay` in `Operations.tsx` — picking a Main into a day-slot copied its fields *once*, at that moment, with an explicit prior-round code comment defending this as deliberate ("one-time copy, not a live reference... same snapshot philosophy as the weekly menu overrides themselves"). Editing the Main afterward never touched already-placed days. This applied uniformly to Base/Dhal/Salad/Beverage/Dessert and photo — Base "appearing to work" was reported impression, not a real exception; every category was equally stale, this just hadn't surfaced yet for Base.

**Fix:**
- **`resolveDish()` (new, `store.ts`)** — given a day-slot dish, looks up its linked Main (if `mainId` is set) and returns a merged object with the Main's *current* `baseGroup`/`baseApplicable`/`baseOptionIds`/`dhalApplicable`/`dhalOptionIds`/`saladApplicable`/`saladOptionIds`/`beverageApplicable`/`beverageOptionIds`/`dessertApplicable`/`dessertOptionIds` — everything else (id, name, desc, emoji, price, mainId) stays the day-slot's own value. Deliberately scoped this way: price is meant to be per-day-overridable (specials), and name/desc are a separate, smaller concern Bhimal didn't raise this round — flagged to him as a scoping call he can override.
- Applied at every point `CustomerPortal.tsx` looks up a dish for applicable/narrowing checks: `selectCurry`, `sectionComplete`, `commitBuilder`, and the meal builder's `selectedCurry`.
- `dishPhotoFor()` now also checks the linked Main's `photoUrl` internally (day-slot dishes have no photo-upload UI of their own, so without this a Main's uploaded photo would never actually display anywhere it's been placed on the menu) — fixes every call site for free, plus a stray `dishPhotoFor(c.id)` in Operations' Menu Planner grid that was passing a bare id and losing photo entirely.
- **Add-to-order gating (`sectionComplete`)** — now correctly skips the Base/Dhal/Salad requirement when the (now-live) applicable flag says a category doesn't apply; additionally, Base gets a new check for "applicable but narrowed to zero actual items," since Base has no "None" escape valve the way Dhal/Salad do and would otherwise block forever with nothing to pick.
- **Free-item forfeiture check (`commitBuilder`)** — previously hardcoded "Dhal/Salad are always free, Beverage/Dessert are always paid, never flagged." Replaced with a data-driven check per category: flags a skipped category only if at least one of its available (post-narrowing) options is actually free (price 0/undefined) — catches cases like Mineral Water or Coconut Cake being free beverage/dessert options that were previously never protected by the warning.
- **"No dhal"/"No salad"** chip labels changed to "None", matching Beverage/Dessert.
- **Migration retired from a manual button to automatic.** New `MENU_LIBRARY_MIGRATED` persisted flag; `migrateMenuToLibrary()` now runs itself once, right after hydration, on any installation where the flag isn't set (fresh origin or one that never completed it) — self-heals the current empty-Library state on next load regardless of whether it was caused by the port issue or something else. The Operations "Import from existing menu" button and its result banner have been removed.
- **`vite.config.ts`: `strictPort: true`** added, so a taken port fails the dev server start loudly instead of silently relocating and stranding data.

**Assessment against v1 scope:** Bug fixes and gating corrections to already-in-scope Meal Library / meal builder behavior, plus one dev-environment hardening change (`strictPort`) — no new modules, no backend change, no scope drift. The scoping decision to leave name/desc/price as the day-slot's own (not live-resolved) is a judgment call, flagged to Bhimal rather than silently assumed. No blocking flags.

---

## 2026-08-11 — Main Name/Description Cleanup, CSV Import Linked to the Meal Library, Danger-Zone Orders/Loyalty Reset (Claude, committed by Antigravity)

**Commit:** [`fb0a4cd`](https://github.com/BhimalL/BonManze_PWA/commit/fb0a4cd03c513e5daad4d4390861ae236c849911) "Clean up migrated Main names/descriptions, link CSV-imported dishes to the Meal Library, add orders/loyalty reset", pushed to `main` by Antigravity.
**Verified:** `npx tsc --noEmit` clean (Claude's own pass before handoff); independently confirmed by Claude against the pushed commit — `git log -1`, `git log origin/main -1`, and `git show --stat HEAD` all checked directly against the device, matching exactly the 2 files intended (`modules/store.ts`, `modules/Operations.tsx`, 157 insertions / 3 deletions total) with no scope drift, `git status` clean after push. **Notable this round:** Antigravity's own self-reported commit hash matched the independently-verified hash exactly — the two prior rounds (`e4fd37f`, `e9268ca`) both had garbled self-reports; this is the first round without that issue.

**Context:** after confirming the previous round's fixes had actually taken effect (once the dev server/browser were properly restarted — see the prior entry), Bhimal asked for three more things: strip the "(Lunch)"/"(Dinner)" suffixes off Main names and expand the short descriptions to match; make sure the Menu Planner's CSV import path also links into the Meal Library, not just the manual migration; and clear all existing orders plus customer loyalty points/store credit so testing could start from a clean slate.

**Changes:**
- **Main name/description cleanup (`store.ts`), auto-run once.** New `cleanupMainDishContentOnce()`, gated by a persisted `MAIN_DISH_CONTENT_CLEANED` flag and run from the hydration IIFE alongside the existing library migration — additive/idempotent, safe to auto-run (unlike the destructive reset below, which never auto-runs). For every Main whose name matches the migration's own `(Lunch)`/`(Dinner)` suffix pattern, the suffix is stripped and the description is replaced from a curated `MAIN_DISH_DESCRIPTION_REWRITES` table (hand-written, distinguishing lunch vs. dinner copy for all 8 dish types the migration produces: Veg, Chicken, Fish, Lentil, Prawn, Beef, Shrimp, Paneer). A stray/manually-added Main that doesn't match the suffix pattern (e.g. one with a typo'd name) only gets its name mechanically cleaned, never a description rewrite — there's no confident source for what a hand-entered Main's description should say, so it's left alone rather than guessed at.
- **CSV menu import now links to the Meal Library (`Operations.tsx`).** `parseMenuCSV`/`handleCsvFileChange` previously created pure freehand day-slot dishes with no `mainId`, bypassing the Library entirely (a longstanding gap, not a regression — the CSV path had never been wired up, unlike the manual "Add Main" flow). New `linkMenuDishesToLibrary(menu)` matches each imported dish by name (case-insensitive) against existing Mains, or creates a new Main on the fly when no match exists, using a local `Map` (not React state) to correctly dedupe repeated same-named rows within a single import before any state-driven re-render could occur. Every dish coming through a CSV import is now `resolveDish()`-eligible like any other Library-linked dish.
- **Danger Zone: clear orders & reset loyalty (new, manual, double-confirmed).** New `clearAllOrders()` and `resetCustomerLoyalty()` in `store.ts` — deliberately never auto-run (unlike the two additive migrations above), since this is destructive. Wired to a new "Danger Zone" card at the bottom of Settings' general sub-tab in Operations, behind an arm-then-confirm button ("Clear orders & reset loyalty" → "Confirm — this cannot be undone," reverting if the button loses focus without a second click). Scoped narrowly and documented inline (in both the store functions and the UI copy) to touch only `ACTIVE_ORDERS` and each customer's `points`/`storeCredit` — customer records, addresses, tiers, lifetime value, the Meal Library, and the Menu Planner are all explicitly left untouched.

**Assessment against v1 scope:** Content cleanup, an import-path bug fix, and one scoped, manually-triggered maintenance action — no new modules, no backend change, no scope drift. The Danger Zone reset is an operator convenience for testing/launch prep, not a customer-facing feature, and is intentionally excluded from every auto-run migration path. No blocking flags.

---

## 2026-08-11 — Root-Caused: Default Rotation Silently Lost Its Meal Library Link on Every Reload (Claude, committed by Antigravity)

**Commit:** [`a6a0841`](https://github.com/BhimalL/BonManze_PWA/commit/a6a0841049bc0994b36c4069fdade322fa3b75f6) "Decouple Meal Library dish-linking from the one-time Main-creation migration", pushed to `main` by Antigravity.
**Verified:** `npx tsc --noEmit` clean (Claude's own pass before handoff, and Antigravity's independent pass before commit) and `npm run build` clean on Antigravity's machine; independently confirmed by Claude against the pushed commit — `git log -1`, `git log origin/main -1`, and `git show --stat HEAD` all checked directly against the device, matching exactly the 1 file intended (`modules/store.ts`, 75 insertions / 1 deletion) with no scope drift, `git status` clean after push. Antigravity's self-reported hash matched the independently-verified one exactly again — two clean rounds in a row now.

**Context:** despite three previous rounds of fixes (the `e4fd37f`/`e9268ca`/`fb0a4cd` entries above), Bhimal reported — for a third time — that the Menu Planner still didn't appear to be pulling dish config from the Meal Library, and asked to have the day-slot dishes cleared and manually re-picked from the Library as a workaround. Rather than apply that workaround (which would only have patched what was visible in that moment, not the underlying cause), Claude did a full source read of the migration/linking/persistence code to find the actual root cause first.

**Root cause (the real one, previously missed):** `WEEKLY_LUNCH_MENU_DEFAULT`/`WEEKLY_DINNER_MENU_DEFAULT` — the fallback rotation shown for "This Week"/"Next Week"/any week nobody has explicitly edited in Operations — are plain hardcoded literals in `store.ts`, never part of `PersistedState`. Only week *overrides* (`LUNCH_MENU_OVERRIDES`/`DINNER_MENU_OVERRIDES`, seeded the moment a week is explicitly edited) are saved to `localStorage`. The `e9268ca`-round migration correctly linked every day-slot dish to its Meal Library Main by mutating these two default-rotation objects in place — but that mutation lived only in that page load's memory. The very next reload (or dev-server restart) rebuilt both constants fresh from source, `mainId`-less again, while the persisted `MENU_LIBRARY_MIGRATED` flag (added the same round, specifically to stop the migration from re-running and re-creating duplicate Mains) also silently blocked the *linking* half from ever running again. Net effect: any day using the untouched default rotation lost its Meal Library link on every single reload, forever, from the first successful migration onward — explaining precisely why this kept resurfacing after every prior fix touched the migration logic itself but never the reload path.

**Fix (`modules/store.ts` only):**
- Split the migration's two responsibilities apart. `migrateMenuToLibrary()` still creates Mains exactly once (gated by `MENU_LIBRARY_MIGRATED`, unchanged), but now also captures the name→Main-id links it computes into two new persisted maps, `LUNCH_DEFAULT_LINK_MAP`/`DINNER_DEFAULT_LINK_MAP`.
- New `relinkDefaultRotationToLibrary()` replays those persisted maps onto the (freshly rebuilt, unlinked) default-rotation constants on **every** load — deliberately ungated, unlike every other one-time migration in this file. Cheap and idempotent: skips any dish that already has a `mainId`, and skips a link whose Main id no longer exists (e.g., deleted from the Library since the map was captured).
- Both new maps added to `PersistedState`/`persistAll()`/the hydration restore block, same mechanism as everything else already persisted.

**Assessment against v1 scope:** Root-cause bug fix to already-in-scope Meal Library / Menu Planner linking — no new modules, no backend change, no scope drift. This should be the last round needed on this specific issue: the fix addresses why the link kept disappearing, not just re-establishing it for the weeks currently visible. Bhimal should verify after a full dev-server restart + fresh browser tab (the established verification step for this project) that This Week/Next Week/Week+2 all show dishes correctly gated/narrowed per their linked Main. No blocking flags.

---

## 2026-08-11 — One-Time Menu Planner Clear, for a Clean Re-Pick from the Meal Library (Claude, committed by Antigravity)

**Commit:** [`80149d7`](https://github.com/BhimalL/BonManze_PWA/commit/80149d772762e6d3aae4897ac9195a1fc5eed369) "Add one-time script to clear the Menu Planner for a clean re-pick from the Meal Library", pushed to `main` by Antigravity.
**Verified:** `npx tsc --noEmit` clean (Claude's own pass before handoff) and `npm run build` clean on Antigravity's machine; independently confirmed by Claude against the pushed commit — `git log -1`, `git log origin/main -1`, and `git show --stat HEAD` all checked directly against the device, matching exactly the 1 file intended (`modules/store.ts`, 56 insertions / 1 deletion) with no scope drift, `git status` clean after push. Antigravity's self-reported hash matched the independently-verified one exactly — third clean round in a row now.

**Context:** even after the `a6a0841` root-cause fix above, Bhimal wanted to verify the Meal Library linking directly rather than trust the explanation — asking to empty the Menu Planner and re-pick every dish from the Library by hand, one at a time, so each pick could be checked against the fix live. He explicitly asked for this as a one-time script (not a permanent UI feature) — an earlier in-progress attempt at a permanent "Clear Menu Planner" Danger Zone button was discarded mid-implementation once this was clarified, and never committed.

**Fix (`modules/store.ts` only):**
- New `clearMenuPlannerOnce()`, guarded by a persisted `MENU_PLANNER_CLEARED_ONCE` flag. Empties every week that already has an override (past, present, future) via `setLunchWeekMenu`/`setDinnerWeekMenu`, and additionally force-empties This Week/Next Week/Week+2 by name (computed via a new local `mondayOfWeek()` helper off `MOCK_TODAY`) even if they had no override yet — otherwise `forWeek()` would fall back to the still-populated `WEEKLY_LUNCH_MENU_DEFAULT`/`WEEKLY_DINNER_MENU_DEFAULT`, which is not empty.
- Deliberately called only from the hydration IIFE's "existing persisted state" branch, never the fresh-install branch — a brand-new installation has nothing to clear and should keep showing the intended default rotation, not start blank forever. This is the key design difference from the earlier auto-run migrations in this file, which run from both branches.
- Only touches Menu Planner day-slot dishes (`LUNCH_MENU_OVERRIDES`/`DINNER_MENU_OVERRIDES`) — never the Meal Library (Mains), `ACTIVE_ORDERS`, or `GLOBAL_CUSTOMERS`.

**Assessment against v1 scope:** One-time maintenance script for verification purposes, not a feature — no new modules, no backend change, no scope drift, no permanent UI surface added. Bhimal should verify after a full dev-server restart + fresh browser tab that the Menu Planner comes up completely empty (This Week/Next Week/Week+2, both Lunch and Dinner) and then re-pick each day's dish from the Meal Library via "Add dish," checking gating/narrowing/photos against the `a6a0841` fix as he goes. No blocking flags.

---

## 2026-08-11 — Customer App Crash Fix (Empty Menu Day), and a Second Pass to Actually Clear Dinner's Overrides (Claude, committed by Antigravity)

**Commit:** [`0b96b2c`](https://github.com/BhimalL/BonManze_PWA/commit/0b96b2cef7b70e7f85e7f38a5d13d8a62d3052a7) "Fix dishPhotoFor crash and re-clear Dinner Menu Planner overrides", pushed to `main` by Antigravity.
**Verified:** `npx tsc --noEmit` clean (both on Claude's device-bridge pass before handoff and on Antigravity's machine before commit) and `npm run build` clean on Antigravity's machine; independently confirmed by Claude directly on the device — `git log -1 --format="%H"` and `git show --stat HEAD` both matched Antigravity's self-reported hash exactly (`modules/store.ts`, 44 insertions / 1 deletion), `git status` clean after push. (A `git fetch origin main` on the device hit a transient proxy/network error unrelated to the commit itself — the local hash and diffstat were independently confirmed regardless, and Antigravity's own push+status output already reported success.)

**Context:** after the `80149d7` one-time clear above went live, Bhimal reported two things from the original browser: a hard crash logging into the Customer app (`Cannot read properties of undefined (reading 'id')` in `dishPhotoFor`), and that Dinner's Menu Planner still showed real dish names/prices for This Week/Next Week/Week+2 — i.e., not actually cleared — while Lunch had correctly gone empty.

**Root cause 1 (the crash):** the Home screen's "Order for..." shortcut tiles (`orderShortcuts` in `CustomerPortal.tsx`) grab `.MON[0]` from a week's menu to show a representative dish photo. Once a day could legitimately be empty (the new clear script sets every day to `[]`), that lookup could return `undefined`, which `dishPhotoFor()` had never been written to expect — it assumed a `CurryOption` or an id string was always passed, and crashed dereferencing `.id`.

**Root cause 2 (Dinner not clearing):** a live diagnostic run in the browser console (read-only, no code path involved — just inspecting the actual persisted `localStorage` state) found that Dinner's overrides for This Week and Next Week were missing entirely (silently falling through to the hardcoded default rotation, which is why real dish names/prices kept showing), while Week+2's Dinner override existed but held a stale 15-dish menu instead of the intended empty one — all three of Lunch's forced weeks, by contrast, came out correctly empty. Extensive line-by-line comparison of the Lunch and Dinner code paths in `clearMenuPlannerOnce`, `setLunchWeekMenu`/`setDinnerWeekMenu`, and `createWeeklyMenuStore` found them genuinely identical — no asymmetry visible in the source to explain the split. Rather than keep searching for a cause that isn't reproducible from reading the code, this round applies a second, targeted, one-time correction instead.

**Fix (`modules/store.ts` only):**
- **`dishPhotoFor()`** — added an early `if (!dish) return '/dishes/chicken.jpg';` guard and widened its parameter type to `CurryOption | string | undefined | null`, so a day with nothing planned degrades to a sensible default photo instead of crashing. No other behavior changed.
- **`fixDinnerOverridesOnce()` (new)** — a second one-time patch, gated by its own persisted flag (`DINNER_OVERRIDE_FIX_ONCE`, independent of `MENU_PLANNER_CLEARED_ONCE`), called right after `clearMenuPlannerOnce()` in the hydration IIFE's existing-installation branch only. Directly force-sets Dinner's three current weeks (This Week/Next Week/Week+2, via the same `mondayOfWeek()` helper) to an empty override, mirroring exactly what already worked for Lunch. No-ops on a fresh install (nothing to fix) and never re-runs once it's fired.

**Assessment against v1 scope:** A crash fix plus a second, narrower one-time maintenance pass on top of the prior entry's clear script — no new modules, no backend change, no scope drift, no permanent UI surface added. The Dinner-clearing asymmetry's root mechanism remains unexplained at the source-code level; this fix corrects the observed data directly rather than papering over a live symptom, and is the second (last-resort) one-time patch on the same underlying request. Bhimal should verify after a full dev-server restart + fresh browser tab that Dinner's This Week/Next Week/Week+2 now show empty "Add dish" slots exactly like Lunch, and that logging into the Customer app no longer crashes. No blocking flags.

---

## 2026-08-12 — Firebase Local Emulator Suite Added, Ahead of the Backend + Firestore Build (Claude, committed by Antigravity)

**Commit:** [`b38d65d`](https://github.com/BhimalL/BonManze_PWA/commit/b38d65d5c20536e4ed5490beb5d2fae10e0e29f8) "Add Firebase Local Emulator Suite config (Firestore + Auth + Emulator UI, demo project)", pushed to `main` by Antigravity.
**Verified:** independently confirmed by Claude directly against the device — `git log -1 --format="%H"` and `git show --stat HEAD` both matched Antigravity's self-reported hash exactly (4 files, 42 insertions: `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`), and `git status --short` confirms `modules/store.ts` (a separate, still-pending change — see below) was correctly left unstaged. No `tsc`/build check needed — none of these are TypeScript/app source files.

**Context:** tonight's Dinner Menu Planner debugging session (see the two entries above) ran long partly because neither Claude nor Antigravity could inspect the actual browser storage directly — every check meant asking Bhimal to paste a console script and relay the output back. That, plus the already-documented multi-device staff-sync gap (`BonManzE_Backend_Requirements.md`, item 1), led Bhimal to decide BonManzE should move from client-only `localStorage` to a real backend + database. He specified Firebase/Google Cloud for hosting — his own call, not something Claude proposed. After weighing SQLite vs. Cloud Firestore vs. Cloud SQL against that hosting choice, the agreed direction is **Cloud Firestore + Firebase Auth + Firebase Hosting**, with Cloud Functions reserved for logic that must run server-side (payments, loyalty-point calculations). Reasoning, for the record: the current data model already works entirely by plain id lookup (`array.find(d => d.id === x)`, `dish.mainId`) and never does a SQL-style join, so it maps onto Firestore's document model at least as naturally as it would onto normalized SQL tables; Firestore's free tier plausibly covers this business's real order volume for a long time, versus Cloud SQL's real minimum monthly cost with no meaningful free tier; and Firestore's live listeners solve the multi-device sync gap essentially for free, no polling loop or websocket server to build. Bhimal also asked about developing locally against SQLite and converting to Firestore at deploy time — this was explicitly discussed and rejected: SQL and Firestore aren't a mechanical swap (different query model, different security model), so that plan would mean building the backend twice, with the riskier rebuild landing right before real customers use it. Instead, local development runs against the **Firebase Local Emulator Suite** — a real local Firestore + Auth, no cloud project or billing needed yet, same code and rules in dev and production. "Deploying" later is just pointing the app at real Firestore instead of the emulator, not converting anything.

**This commit (`modules/store.ts` untouched):**
- `firebase.json` — declares the Firestore, Auth, and Emulator UI emulators (ports 8080 / 9099 / 4000), `singleProjectMode: true`.
- `.firebaserc` — points at a `demo-bonmanze` project id, which the Firestore/Auth emulators accept with no real Firebase project, no Google login, and no billing account — both deliberately deferred until actual deployment, not needed for local dev.
- `firestore.rules` — starting point is locked down (`allow read, write: if false` for every document), not a permissive placeholder. Rules get opened up per-collection, deliberately, as the schema is designed and reviewed — per the new `BonManzE_Working_Agreement.md`'s standard for this project.
- `firestore.indexes.json` — empty starting point; no composite indexes needed yet.

**Environment setup (not a repo change — done by Antigravity directly on Bhimal's machine, no review handoff needed per the working agreement's tooling-vs-code-change distinction):** `firebase-tools` installed globally (`npm install -g firebase-tools`, v15.26.0). The Firestore/Auth emulators need a Java Runtime Environment (11+), which wasn't present and couldn't be installed via `winget` (the standard MSI installer needs admin elevation, which Bhimal's work laptop doesn't have — install failed with exit code 1602, a cancelled-elevation code). Worked around with a portable, no-admin install instead: Temurin 21 JRE downloaded directly from Adoptium as a zip and extracted to `C:\Users\bhimall\.java`, with `JAVA_HOME` and the JRE's `bin` folder added to Bhimal's **user-level** environment PATH specifically (not system-level, which would have needed admin) — confirmed working via `java -version` (Temurin 21.0.12+8).

**Assessment against v1 scope:** Infrastructure setup for the agreed backend phase, not an app feature — no scope impact on the Customer App or Operator Console as they exist today. **Flagged at the time, now closed by the next entry:** the Dinner Menu Planner override issue from the two entries above was still unconfirmed as of this commit — Bhimal's most recent live test then ("it is still the same thing") came after `0b96b2c`. A further-hardened fix was already authored and `tsc`-verified at that point, staged but uncommitted; see the entry directly below for its commit and verification.

**Next step:** design the Firestore collection structure (orders, customers, Meal Library, staff) before writing any server or client Firestore code.

---

## 2026-08-12 — Dinner Menu Planner Override Fix, Hardened with Visible Logging and a Broader Clear (Claude, committed by Antigravity)

**Commit:** [`174727c`](https://github.com/BhimalL/BonManze_PWA/commit/174727cd7d2a9bbc461330f249081ebfcadc2dda) "Harden Dinner Menu Planner override fix with visible logging and broader clear", pushed to `main` by Antigravity.
**Verified:** independently confirmed by Claude directly against the device — `git log -1 --format="%H %s"` matched Antigravity's self-reported hash and message exactly, `git show --stat HEAD` shows only `modules/store.ts` (17 lines changed, 15 insertions / 2 deletions), and `git status --short` was empty afterward (working tree fully clean). This was a **Verified** entry, not initially a **Confirmed working** one — see the distinction below (established the same day): the code was correct and pushed, but the behavior itself was not yet confirmed working.

**Context:** the `0b96b2c` entry's `fixDinnerOverridesOnce()` was written to force-clear Dinner's three current weeks (This Week/Next Week/Week+2), mirroring what already worked for Lunch — but its root mechanism for why Dinner kept diverging from Lunch in the first place was never actually found (see that entry's root-cause note), and Bhimal's most recent live check at the time ("it is still the same thing") left it unresolved whether the fix had actually taken effect or simply hadn't been tested yet under a real restart. Rather than keep guessing from the outside, this round hardens the same fix so its own outcome is directly observable in the browser console instead of requiring another round of console-paste diagnostics.

**Fix (`modules/store.ts` only, inside `fixDinnerOverridesOnce()`):**
- Added `console.log`/`console.warn` visibility: logs a clear "already ran, skipping" line if the `DINNER_OVERRIDE_FIX_ONCE` flag is already set, or a "ran — Dinner overrides forced empty for [weeks]" line listing exactly which weeks were touched when it actually fires. Either way, the next full restart + fresh tab now answers "did this run, and what did it do" directly from the console, with no separate diagnostic script needed.
- Broadened the clear itself: in addition to force-emptying the three named current weeks (This Week/Next Week/Week+2, unchanged from `0b96b2c`), it now also walks every key already present in `dinnerMenuStore.getSnapshot()` and force-sets each to an empty week (`Object.keys(...).forEach(w => setDinnerWeekMenu(w, {...EMPTY_WEEK}))`) — so any other stray Dinner override sitting outside the three named weeks (which would explain a persistent mismatch that pure guessing at the root cause hadn't turned up) gets cleared too, not just the three weeks the original fix assumed were the only ones that mattered.
- No changes to Lunch's path, the crash fix (`dishPhotoFor`), or anything outside this one function.

**Assessment against v1 scope:** Continuation of the same one-time maintenance/bug-fix track as the two entries above it — no new modules, no backend change, no scope drift, no permanent UI surface added. This turned out **not** to be the fix that actually worked — see the next entry for what happened and how it was ultimately closed. No blocking flags.

**Next step (unchanged):** design the Firestore collection structure (orders, customers, Meal Library, staff) before writing any server or client Firestore code.

---

## 2026-08-12 — Dinner Menu Planner Override: Root Cause Traced to a Poisoned One-Time Flag; Closed Manually, Not by Code (Claude + Bhimal)

**Commit:** [`e106d320`](https://github.com/BhimalL/BonManze_PWA/commit/e106d3203740a51af7f36d87174a5a7cde23d487) "Fix Dinner override fix never running: broadened clear shared a flag already persisted true", pushed to `main` by Antigravity — **this commit's code did not end up being what actually fixed the problem.** See below.
**Verified (the commit):** independently confirmed by Claude directly against the device — `git log -1 --format="%H %s"` matched Antigravity's self-report exactly, `git show --stat HEAD` shows only `modules/store.ts` (41 lines changed, 40 insertions / 1 deletion), `git status --short` clean, `npx tsc --noEmit` clean.
**Confirmed working (the actual fix):** by Bhimal, live — screenshots after manual cleanup show all three weeks (This Week, Next Week, Week After Next), both Lunch and Dinner, showing empty "Add dish" placeholders on every day. This is the real closure of the issue; the commit above is not.

**Context:** after `174727c`'s hardened fix still didn't clear Dinner (Bhimal's screenshot showed This Week's Dinner fully populated while Lunch was correctly empty), direct code review of `createWeeklyMenuStore`/`setWeekMenu`/`fixDinnerOverridesOnce` found the actual mechanism this time: the hardened function reused the exact same persisted flag (`DINNER_OVERRIDE_FIX_ONCE`) as the original, narrower version of itself from `0b96b2c`. Since that flag was already `true` from the first version's run, every later reload — including with the hardened body in place — hit the early-return guard and skipped the broadened clear without ever executing it. `e106d320` added a second, independent flag (`DINNER_OVERRIDE_FIX_V2_ONCE`) so the broadened logic would get to run once regardless of the old flag's state.

**What actually happened after that commit:** a full restart + fresh tab showed the console logging `fixDinnerOverridesOnceV2 already ran on this installation — skipping` — on what should have been its first-ever run. A read-only diagnostic script (pasted into the browser console, reading the raw persisted state directly) confirmed the real state: `LUNCH_MENU_OVERRIDES['2026-08-17']` was a proper empty week (`{MON:[],TUE:[],...}`), but `DINNER_MENU_OVERRIDES['2026-08-17']` was `undefined` — not empty, **absent entirely** — while all three Dinner fix flags (`DINNER_OVERRIDE_FIX_ONCE`, `DINNER_OVERRIDE_FIX_V2_ONCE`) and `MENU_PLANNER_CLEARED_ONCE` were all persisted `true`.

A second source read confirmed the write mechanics themselves are genuinely symmetric between Lunch and Dinner — same `createWeeklyMenuStore` factory, same `weekStart` string computed once and used for both `setLunchWeekMenu`/`setDinnerWeekMenu` calls in the same loop iteration inside every one of the fix functions — and `Operations.tsx`'s Dinner-vs-Lunch code paths are unified via `service === 'Dinner' ? X : Y` selection, not hand-duplicated, so there's no UI-side auto-repopulation logic specific to Dinner either. Given the flags say "done" but the data says "never written," the most likely explanation is environmental, not a logic bug: `store.ts`'s hydration code is known (per `BonManzE_Working_Agreement.md`'s restart rule) to behave unreliably under Vite's hot-module-reload. If the dev server was still running when `e106d320`'s file change landed on disk, an uncontrolled HMR-triggered re-execution of the hydration IIFE could have run — and partially or inconsistently completed — before Bhimal's controlled restart, consuming the one-shot flag without the write actually surviving. This wasn't independently proven (would require reproducing the exact timing), and at four rounds deep on what's fundamentally a one-time testing convenience, it wasn't worth a fifth automated attempt to prove it.

**Resolution:** rather than write a third flag and hope the sequencing goes cleanly this time, Bhimal manually deleted every dish from Dinner's three weeks (This Week/Next Week/Week+2) via the existing, already-well-tested trash-icon "remove dish" UI control — the same feature used throughout the app, not a new code path. Confirmed via screenshots: all three weeks, both services, fully empty.

**Assessment against v1 scope:** No scope impact — this was entirely maintenance/data cleanup on already-in-scope Menu Planner functionality, closed via existing UI rather than new code. `e106d320`'s code remains in the repo; it's harmless (a one-time flag-gated function that will simply no-op forever now) but did not end up being the actual fix — noted here so a future reader doesn't mistake its presence for proof the bug was resolved in code. **This closes the Dinner Menu Planner override saga** that ran across `a6a0841`, `80149d7`, `0b96b2c`, `174727c`, and `e106d320` — five rounds, only the last of which (manual, not automated) actually worked. Lesson for future one-time migration/fix scripts in this codebase: verify the *data*, not just the flag, before calling a fix confirmed — and stop the dev server before any `store.ts` change lands, not just restart after, to rule out stray HMR execution as a variable.

**Next step:** design the Firestore collection structure (orders, customers, Meal Library, staff) before writing any server or client Firestore code.

---

## 2026-08-12 — Changelog Moved From Claude Project Doc to This Repo File (Claude)

**Not a code commit** — this is a process change, logged here for continuity.

**Context:** Bhimal flagged that this session was burning far more tokens/credits than comparable sessions on another project. The specific, identifiable cause: the changelog previously lived as a Claude Project doc (`claude/BonManzE_Changelog.md`), and that tool has no in-place patch/append capability — every single new entry required resending the *entire* multi-day changelog just to add one entry at the bottom. That cost had already caused two separate placeholder/overwrite mistakes earlier in this project's history (accidentally replacing the whole document instead of extending it), which is itself a symptom of the same underlying problem.

**Change:** the changelog now lives here, in the repo, as `CHANGELOG.md` — committed via the normal Claude/Antigravity git flow like any other file. New entries are small diffs (an `Edit` appending a section, verified, committed, pushed), not full-document rewrites. The old Claude Project doc (`claude/BonManzE_Changelog.md`) has been replaced with a short pointer to this file and is no longer updated.

**Assessment against v1 scope:** No scope impact — tooling/process change only.

---

## 2026-08-12 — Firestore v1 Schema Designed; Security Rules, Indexes, and Bootstrap Seed Shipped and Confirmed Working (Claude + Bhimal, committed by Antigravity)

**Commits:** [`b89bca6`](https://github.com/BhimalL/BonManze_PWA/commit/b89bca6d3aa349ef62c4b549a027592343237e5a) "Add Firestore security rules and composite indexes for v1 schema", [`bf99735`](https://github.com/BhimalL/BonManze_PWA/commit/bf997351347240cd5f282235869cf7c2f774e93c) "Add one-time seed script to bootstrap the Owner role and staff account", [`72eadb4`](https://github.com/BhimalL/BonManze_PWA/commit/72eadb4dedba01db34c696cd8b642db195cd79c8) "Fix seedBootstrap.js: use ES module import syntax instead of require (repo is type: module)", all pushed to `main` by Antigravity.
**Verified (all three commits):** independently confirmed by Claude directly against the device — `git log`/`git show --stat`/`git status --short` all checked after each push, diffs matched exactly what was intended (`firestore.rules` + `firestore.indexes.json` only in the first; `scripts/seedBootstrap.js` only in the other two), working tree clean after each.
**Confirmed working (the seed script, live):** Bhimal ran `node scripts/seedBootstrap.js` against the running emulator suite and got back a real Owner role ID (`7ZMEyYO9AV2pk8gKJIdI`), a real Auth UID (`6GyDLzEC0gfYMVvNaA0eTizaq0Ky`), and a staff doc linking them — not just clean code, an actual bootstrapped account sitting in the emulator's database. The Firestore emulator itself was independently confirmed to accept the new rules cleanly too: two separate `npx firebase emulators:start` runs both printed `Rules updated` with no compile error.

**Context:** first real backend work on BonManzE, following the Firestore/Auth/Hosting decision recorded in the `b38d65d` entry above. Claude designed a full v1 Firestore schema (`claude/BonManzE_Firestore_Schema.md`, a Claude Project doc — not this file, since it's a living design reference rather than a changelog entry) grounded directly in `BonManzE_v1_scope.md`, `BonManzE_Backend_Requirements.md`, and a line-by-line read of the current `store.ts`/`types.ts` data model — deliberately excluding every RMS-era type the v1 scope doc already cut (PurchaseOrder, Discrepancy, ShiftState, PettyCash, POS sessions, Table/Reservation). Bhimal made three real decisions during review, all reflected in the shipped rules: roles & permissions are a configurable system (a `roles` collection with a flat, extensible permission map) rather than a fixed flat/two-tier split, to be managed from a future Settings tab; the default weekly menu rotation moves into Firestore too (`menuDefaults`), closing a real gap where it's currently hardcoded in `store.ts`; and customer login is username + password (a new `usernames` lookup collection resolves a typed username to the email Firebase Auth actually needs, since Firebase Auth has no native username provider) rather than phone OTP, avoiding an SMS provider and cost. The Danger Zone reset (clear orders / reset loyalty) was explicitly dropped from the real backend — Bhimal's call, on the reasoning that it only ever existed because the mocked build's test data lived in disposable `localStorage`, and a bulk-wipe control pointed at real Firestore data is a different risk with no real operational need behind it.

**A real bug fixed during design, not after:** the current `Order` type has no `customerId` — orders link to customers by a free-text `customerName` string alone, which would silently break on two same-named customers or a display-name change. Every order/item document in the new schema carries a real `customerId` reference; `customerName` is kept only as a denormalized display copy.

**Key modeling decision:** order line items live in an `orders/{orderId}/items/{itemId}` subcollection, not embedded in the order document as they are today — because a single checkout can span multiple days and both offerings, but every Operator Console v1 screen (Orders by Dish, Delivery List, Payments) needs to query at the item level by `deliveryDate` across every customer at once. Firestore can't partially match an embedded array by one field, so items are split out and queried via a collection-group query instead, with `customerId`/`deliveryDate`/`serviceSlot`/`status` duplicated onto each item so both the security rules and the query itself never need to reach up to the parent order.

**A mistake that shipped, then got caught by Bhimal actually running it:** the first draft of `seedBootstrap.js` used `require()`. Claude's own testing before sending it caught one real bug this way (the installed `firebase-admin` v14 dropped the old `admin.firestore()`/`admin.auth()` API the script was first written against — caught by actually loading the package and checking its exports, not by assuming the API) but missed a second: the test ran in a scratch sandbox folder with no `package.json`, so `require()` worked fine there — it never hit this repo's actual `package.json`, which has `"type": "module"` and makes Node treat every `.js` file as an ES module with no `require` available. That mismatch only surfaced when Bhimal ran the real command against the real repo and hit the live error. Fixed by switching to `import` syntax; this repo's specific ESM setting is now called out directly in the script's own comments so the same class of mistake doesn't recur. Lesson: testing a script's logic in isolation doesn't verify it against the target repo's actual module system — that needs checking directly (a quick look at `package.json`) before assuming a syntax pattern will run as-is.

**What server-side logic still needs writing, not yet started:** order-total computation and loyalty point/tier/store-credit updates, both flagged in the schema doc as Cloud Functions using the Admin SDK — a customer's own client must never be trusted to write those fields directly.

**Assessment against v1 scope:** Backend architecture work, not a Customer App or Operator Console feature — no scope impact on either surface as they exist today. This is the first piece of the real backend (Backend Requirements item 1, multi-device sync) actually under construction, not just decided.

**Next step:** migrate the small "whole-list" config docs (`config/system`, `loyaltyTiers`, `customerGroups`, the five add-on catalogs, `iconLibrary`) into Firestore — the simplest pieces of the schema, chosen to go first per the build sequence in `BonManzE_Firestore_Schema.md`.

---

## 2026-08-12 — Emulator Data Persistence: a OneDrive Conflict Found and Fixed, Now Confirmed Working End-to-End (Claude + Bhimal, committed by Antigravity)

**Commits:** [`6710ebf`](https://github.com/BhimalL/BonManze_PWA/commit/6710ebfcaef1315b00ddd8a0f83d9b55ba1d02cc) "Add npm run emulators script with export-on-exit/import so emulator data survives a restart", [`97a1926`](https://github.com/BhimalL/BonManze_PWA/commit/97a1926916219a6ef2362d3ec877118f1d98cb33) "Move emulator export/import path outside OneDrive sync scope (fixes export EPERM)", [`cdabf84`](https://github.com/BhimalL/BonManze_PWA/commit/cdabf843ce659d67aebb81fe6ee7e2f9767454af) "Set seed email/name to bhimalonly@gmail.com / BhimalL; keep password as a placeholder", all pushed to `main` by Antigravity.
**Verified (all three commits):** independently confirmed by Claude directly against the device — diffs matched exactly what was intended each time, working tree clean after each.
**Confirmed working (the full cycle, live):** Bhimal ran the actual stop → export → restart → import cycle end-to-end. First attempt (`6710ebf`, exporting to a path inside the OneDrive-synced repo folder) failed both times it was tried, with `EPERM: operation not permitted, rename ...`. Second attempt, after `97a1926` moved the export/import path to `%LOCALAPPDATA%\BonManzE\emulator-data`, succeeded cleanly: shutdown printed `Export complete`, and the next `npm run emulators` printed `Importing data from C:\Users\bhimall\AppData\Local\BonManzE\emulator-data\...` for both Firestore and Auth. Bhimal confirmed via the emulator UI (screenshots) that the seeded `roles`/`staff` docs from `cdabf84`'s run — role `XVIZQQFyf93UxNcYttpq` ("Owner", all five permissions `true`) and staff `v7W6qcZRwavErmlk0nW4EomMncpE` (`bhimalonly@gmail.com` / `BhimalL`, `roleId` correctly pointing at that role) — were still present after the restart, byte-for-byte the same as before it.

**Root cause of the EPERM:** this repo lives inside a OneDrive-synced Desktop folder (`OneDrive - ABC Group of Companies\Desktop\...`). Firebase's export writes to a temp folder first, then does an atomic rename onto the target export directory. OneDrive's sync driver actively watches and locks files under that tree, which blocked the rename. Same underlying cause as the multi-minute `npm install firebase-admin` earlier this session — not a Firebase bug, a structural conflict between "this repo's folder is inside a live-synced cloud folder" and "some tools need to atomically rename files inside it."

**A mistake made and corrected in the same round:** Claude initially told Bhimal that stopping the *old* emulator session (started before the `%LOCALAPPDATA%` fix existed) would still save its data via the export, reasoning that the fix would apply retroactively. That's wrong — an `--export-on-exit` flag has to be present on the process *when it starts* to take effect on that process's shutdown; a running process doesn't pick up a `package.json` change made after it launched. The seeded account from that session was lost as a result — caught and disclosed immediately, and recovered in under a minute by re-running `scripts/seedBootstrap.js`, which is safe to re-run by design. No real cost, but worth being exact about restart semantics next time rather than assuring a shortcut works without checking it.

**Also this round:** `scripts/seedBootstrap.js`'s placeholder owner identity (`bhimal@bonmanze.local` / generic name) was updated to Bhimal's real name and email (`BhimalL` / `bhimalonly@gmail.com`) per his request. Password was deliberately kept as a placeholder rather than the real value he initially gave — flagged to him that the script (and its real password, if used) would end up in plain text in git history, and he chose to keep setting the real password by hand in the emulator's Auth UI instead, same as before.

**Housekeeping, not committed (nothing to commit — local machine state only):** several stray `firebase-export-<timestamp>/` folders and a stale `.git/index.lock` accumulated on Bhimal's machine across this session's failed export attempts and interrupted git operations; both are untracked/local-only and were left for Bhimal to delete manually via File Explorer rather than fought over the device bridge, which lacks delete permission on his mounted folder.

**Assessment against v1 scope:** Local dev tooling reliability, not an app feature — no scope impact. This closes out tonight's Firestore bootstrap arc: rules, indexes, roles/staff schema, and now durable local dev data are all in place and confirmed working, not just written.

**Next step (unchanged):** migrate the small "whole-list" config docs into Firestore — see the entry above.

---

## 2026-08-12 — Config Docs Migrated to Firestore: system config, loyalty tiers, customer groups, five add-on catalogs, icon library (Claude + Bhimal, committed by Antigravity)

**Commit:** [`0c5585c`](https://github.com/BhimalL/BonManze_PWA/commit/0c5585c) "Add migration script for system config, loyalty tiers, customer groups, add-on catalogs, and icon library", pushed to `main` by Antigravity.
**Verified (the commit):** independently confirmed by Claude directly against the device — diff contains only `scripts/migrateConfigDocs.js` (new file), working tree clean afterward.
**Confirmed working (live):** Bhimal ran `node scripts/migrateConfigDocs.js` against the running emulator and got all 9 expected `Wrote ...` lines plus `Done. 9 config docs written to the emulator.`, then spot-checked two of the nine directly in the Firestore emulator UI: `loyaltyTiers/current.items[0]` shows `birthdayDiscount: 5`, `color: "bg-orange-600"`, `id: "t1"`, `multiplier: 1`, `name: "Bronze"` — an exact match for the Bronze tier in `modules/store.ts`'s `LOYALTY_TIERS`; `config/system` shows `activeServices: ["Breakfast","Lunch","Dinner"]`, `bulkDiscountEnabled: true`, `bulkDiscountRate: 5`, `businessLogoUrl: ""`, `businessName: "BonManzE"` — an exact match for `SYSTEM_CONFIG`. The emulator UI sidebar also confirmed all 9 target collections exist (`config`, `customerGroups`, `iconLibrary`, `loyaltyTiers`, `mealBases`, `mealBeverages`, `mealDesserts`, `mealDhals`, `mealSalads`), alongside the `staff`/`roles` docs from the earlier bootstrap step.

**Context:** step 3 of the build sequence in `BonManzE_Firestore_Schema.md` — the simplest pieces of the schema, chosen to go first. `scripts/migrateConfigDocs.js` is a one-time, safe-to-re-run script (fixed document IDs, plain `.set()`, no auto-generated IDs to guard against duplicating) that copies 9 "whole-list" config values verbatim from their current hardcoded home in `modules/store.ts` into 9 fixed-ID Firestore documents: `config/system`, and a `{ items: [...] }` shape for `loyaltyTiers/current`, `customerGroups/current`, `mealBases/current`, `mealDhals/current`, `mealSalads/current`, `mealBeverages/current`, `mealDesserts/current`, and `iconLibrary/current` (30 icon entries). Source values were read fresh from the device immediately before writing the script, not from memory, specifically to avoid the kind of stale-copy mistake that's bitten this migration work before.

**Why the visual spot-check mattered, not just the script's own "Wrote ..." log lines:** a `.set()` call reports success even if the shape written doesn't match what the security rules or client code actually expect — no error would ever surface a wrong field name or a flattened array that should have been nested under `items`. Checking the actual documents in the emulator UI against the real `store.ts` source, field by field, is what turns "the script ran" into "the data is right."

**Assessment against v1 scope:** Backend architecture work, not a Customer App or Operator Console feature — no scope impact. Third piece of the Firestore build sequence now shipped and confirmed working (after rules/indexes/bootstrap, then persistence tooling); config content that customers and staff read every session is no longer solely a hardcoded constant.

**Next step:** migrate the Meal Library and Menu Planner content (`mains`, `menuDefaults`, `menuWeeks`) into Firestore — step 4 of the build sequence.

---

## 2026-08-12 — Firebase Storage Added to the Stack; Meal Library (Mains) and Menu Planner (Defaults + Week Overrides) Migrated to Firestore, Confirmed Working (Claude + Bhimal, committed by Antigravity)

**Commits:** [`9930edd`](https://github.com/BhimalL/BonManze_PWA/commit/9930edd4e9f7e7d7db794dc68ba958e16f696fa2) "Add Firebase Storage emulator and rules for dish photos", [`088050d`](https://github.com/BhimalL/BonManze_PWA/commit/088050d00d3a121b2ace56024cfe893919af20ef) "Add migration script for Meal Library Mains and Menu Planner content", both pushed to `main` by Antigravity.
**Verified (both commits):** independently confirmed by Claude directly against the device — `9930edd` touches only `firebase.json`/`storage.rules` (69 insertions), `088050d` touches only `scripts/migrateMenuLibrary.js` and its two `scripts/data/` files (676 insertions), `origin/main` matches, working tree clean of tracked changes afterward.
**Confirmed working (live):** the emulator restart printed a clean Storage emulator startup (downloaded `cloud-storage-rules-runtime-v1.1.3.jar`, listed Storage at `127.0.0.1:9199` in the "All emulators ready" table, no rules-compile error) — confirms `storage.rules` is syntactically valid, the same tier of confidence `firestore.rules` got early on. `node scripts/migrateMenuLibrary.js` then ran clean: uploaded the one custom dish photo (555,456 bytes — exact match to the source PNG decoded locally beforehand), wrote all 18 `mains/{mainId}` docs, `menuDefaults/current`, and 6 `menuWeeks/{weekStart}` docs. Bhimal spot-checked all three surfaces in the emulator UI: the `mains/main-msq22wrd-f3q0` ("DiPain Sausice") doc shows `photoStoragePath` with no leftover `photoUrl`; `menuWeeks/2026-08-10`'s Lunch/TUE entry matches the real day-slot dish exactly; `menuDefaults/current`'s full lunch+dinner dump shows every dish across all five weekdays correctly `mainId`-linked to the right Main (same name resolving to different Mains for Lunch vs. Dinner, e.g. Veg Curry → two distinct ids); and the Storage tab shows `dishPhotos/mains/main-msq22wrd-f3q0.png` at 555.46 kB rendering as the actual uploaded photo.

**Context:** step 4 of the build sequence in `BonManzE_Firestore_Schema.md`. Unlike the config-docs migration, this data isn't hardcoded in `store.ts` — Mains and week overrides are live state built up through the app's own UI and persisted to Bhimal's browser `localStorage`. Exported once via a small console script run against the actual dev app (not the emulator), landing 18 Mains and 6 weeks each of Lunch/Dinner overrides (`2026-08-09` through `2026-08-24`) into `scripts/data/menuLibraryExport.json`.

**A real architecture gap found mid-migration, not guessed at in advance:** one Main ("DiPain Sausice") had a custom-uploaded photo stored as a ~740KB base64 data URL — safely under Firestore's 1MiB document cap today, but fragile (any other future photo risks tipping a document over that hard limit with no graceful failure). Flagged to Bhimal directly rather than silently deciding; he chose to set up Firebase Storage properly rather than ship the base64 as-is or drop the photo. This added real scope to step 4: `firebase.json`/`storage.rules` (a new emulator, port 9199, with `manageMenu`-gated write / public read, mirroring `firestore.rules`' `isStaffAllowed()` pattern via Storage Rules' cross-service `firestore.get()`/`firestore.exists()` access — noted in the rules file itself as compile-verified but not yet behaviorally verified, since Admin SDK writes bypass rules the same way they always have for Firestore; that real test waits until client code actually reads/writes Storage). `mains/{mainId}` and day-slot `CurryOption` docs now carry `photoStoragePath` (a Storage object path) instead of `photoUrl` for any dish with a custom photo — the app's own photo-upload UI still writes base64 directly today, a separate follow-up flagged in the schema doc, not done as part of this data migration.

**Testing before shipping, without a live emulator:** Claude's own sandbox can reach npm/package registries but not `storage.googleapis.com` directly, so the Firestore/Storage emulator binaries couldn't be downloaded there to run a true end-to-end test before delivery. Compensated by testing everything that didn't require the emulator itself: script syntax (`node --check`), JSON validity, the base64 photo decoding to a real, correctly-sized PNG, and — most importantly — the actual data-transformation logic (photo substitution, default-rotation Main-linking, override-week preservation including the fully-empty weeks) run directly against the real exported data and checked by hand before ever reaching Bhimal's machine. This caught nothing wrong, but the live run on Bhimal's actual emulator was still the first real proof, consistent with this project's "verified vs. confirmed working" distinction — the gap was disclosed upfront rather than presented as already proven.

**A data-shape wrinkle worth remembering, not fixed here:** today, Lunch and Dinner week overrides are two fully independent stores — a week can have one service overridden and not the other, falling back to that service's own default. A single `menuWeeks/{weekStart}` doc preserves this by omitting whichever service key has no override for that week, rather than force-filling it with a snapshot of the current default (which would stop tracking future default changes for that week). No client code reads `menuWeeks` yet, so the actual per-key fallback logic still needs writing when the app is wired to Firestore for real — noted in the schema doc so it isn't lost.

**Assessment against v1 scope:** Backend architecture work, not a Customer App or Operator Console feature — no scope impact. Fourth piece of the Firestore build sequence shipped and confirmed working, with Storage now a permanent part of the stack alongside Firestore and Auth.

**Next step:** `customers` + `usernames` + the `registerCustomer` Cloud Function — step 5 of the build sequence.

---

## 2026-08-13 — Step 5 Scoped Backend-First: registerCustomer Cloud Function + 3 Mock Customers Seeded as Real Accounts (Claude + Bhimal, committed by Antigravity)

**Commits:** [`d068cc0`](https://github.com/BhimalL/BonManze_PWA/commit/d068cc0c236cae50316e85399cd56dd69d23baac) "Add Cloud Functions setup with registerCustomer callable", [`92955bb`](https://github.com/BhimalL/BonManze_PWA/commit/92955bb62c548f80092d81db33293183e5850a9d) "Add seed script for the 3 mock customers as real accounts", both pushed to `main` by Antigravity.
**Verified (both commits):** independently confirmed by Claude directly against the device — `d068cc0` touches only `firebase.json` (the `functions` block), `functions/package.json`, `functions/index.js`; `92955bb` touches only `scripts/seedCustomers.js`; working tree clean of tracked changes after each.
**Confirmed working (live):** restarting the emulator suite (after `npm install` inside `functions/`, a separate package from root) loaded `functions/index.js` cleanly — `functions[us-central1-registerCustomer]: http function initialized` — confirming the Cloud Function compiles and wires up correctly under the real Functions emulator, stronger proof than the offline `node --check` available while authoring it. `node scripts/seedCustomers.js` then ran clean: created 3 real Auth users (Marcus Sterling, Eleanor Fant, Sarah Connor) plus their `customers`/`{uid}` and `usernames`/`{username}` docs, with tier/group display names correctly mapped to schema ids (Marcus: Diamond→`t4`, VIP→`g3`; Eleanor: Bronze→`t1`, Corporate→`g2`; Sarah: Silver→`t2`, ABC Motors Co Ltd→`g1`) — spot-checked in the emulator UI's `usernames` collection (`eleanor`, `marcus`, `sarah` all present).

**Not yet live-verified:** `registerCustomer`'s actual logic (input validation, the username-claim transaction, the Auth-user rollback on failure) has only been confirmed to *load* — it hasn't been *invoked*, because the Customer App has no Firebase Web SDK client wiring yet to call a callable function through. That's separate work for whenever the login/registration UI gets built (see below).

**Context — why this step got rescoped mid-flight:** starting step 5 (`customers`/`usernames`/`registerCustomer` per the build sequence) surfaced that there's no real Customer App login today — `CustomerPortal.tsx`'s "login" is a mock picker over `subscribeToCustomers()`, and the Firebase Web SDK has never been installed client-side at all. Claude flagged three ways to scope the rest of step 5 (ship registration UI now / stub something minimal / backend-first and defer the UI); Bhimal chose backend-first — deliver `registerCustomer` and real seed data today, leave the actual login/registration screens (Web SDK install, real username+password UI, replacing the mock picker) to a dedicated future session rather than rushed into this one.

**A near-miss with emulator data, caught and explained, not just fixed:** partway through today's session, the Meal Library/Menu Planner data from 2026-08-12 (`mains`, `menuDefaults`, `menuWeeks`) was found missing after a fresh `npm run emulators` restart — only `customers`/`usernames` showed up in Firestore's root collection list. Root cause: `--export-on-exit` only fires on a *clean* shutdown (`Ctrl+C`, allowed to finish), and yesterday's session ended without one — nothing was ever written to `%LOCALAPPDATA%\BonManzE\emulator-data`, so today's restart had nothing to import. Nothing was actually lost — the real source of truth is the already-committed `scripts/migrateMenuLibrary.js` + `scripts/data/*` files, not the emulator's transient database — so re-running that script restored everything (18 `mains` docs, `menuDefaults/current`, 6 `menuWeeks` docs, the photo re-uploaded to Storage). Bhimal then proved the fix end-to-end: a clean `Ctrl+C` printed `Creating export directory ... Export complete`, and the next restart printed explicit `Importing data from ...` lines for both Firestore and Auth, with all of today's and yesterday's data present without re-running any script. This is a distinct incident from the OneDrive/EPERM persistence issue fixed on 2026-08-12 — same `--export-on-exit`/`--import` mechanism, a different failure mode (unclean shutdown vs. a locked target path) — worth remembering as a pair: **always stop the emulator with `Ctrl+C` in its own terminal, not by closing the window.**

**Assessment against v1 scope:** Backend architecture work, not a Customer App feature yet — no scope impact. `registerCustomer` and real customer accounts are in place and confirmed working at the infrastructure level; the actual registration/login experience customers would use remains explicitly deferred, not forgotten.

**Next step:** the Customer App login/registration UI (Firebase Web SDK install, real username+password screens calling `registerCustomer`, replacing the mock customer-picker) — a dedicated future session. Longer-term, per the build sequence: step 6, `orders`/`orders/{id}/items` + checkout/payment-confirmation Cloud Functions.

---

## 2026-08-13 — Real Firebase Login/Registration Ships for the Customer App; registerCustomer Invoked Live for the First Time (Claude + Bhimal, committed by Antigravity)

**Commits:** [`271a28c`](https://github.com/BhimalL/BonManze_PWA/commit/271a28cac33861fe247e7984ca57a30120e2f269) "Add real Firebase login/registration for the Customer App", [`c063b9e`](https://github.com/BhimalL/BonManze_PWA/commit/c063b9e4b1473574b0e0842d133ff9b9dd493747) "Add firebase (client SDK) as a dependency", both pushed to `main` by Antigravity.
**Verified (both commits):** independently confirmed by Claude directly against the device — `271a28c` touches only `firebaseClient.ts` (new), `modules/CustomerPortal.tsx`, and `tsconfig.json`; `c063b9e` touches only `package.json`/`package-lock.json`; working tree clean of tracked changes after each.
**Confirmed working (live):** Bhimal ran `npm install firebase`, restarted the dev server, and — for the first time ever — logged into the Customer App as all 3 seeded customers (Marcus/Eleanor/Sarah) through the real login form, then used **Sign Up** to self-register a brand-new customer ("Neji Lakha") end-to-end. Neji's profile came out exactly as `registerCustomer`'s logic should produce it with no seed data behind it: 0 points, Rs 0.00 store credit, tier defaulted to Bronze (`t1`), "1000 pts to Silver" progress bar, 0%/5% discounts matching Bronze's real definition — none of that data existed anywhere before this session; it's the direct output of the Cloud Function's own validation → Auth-user creation → transactional `customers`+`usernames` write, run live for the first time (previously only confirmed to *load* in the emulator, see the prior entry). Marcus's login separately confirmed the tier/group id→name translation works: the header showed "Diamond Member" with 15%/25% discounts and referral code `MARC-VIP-1`, an exact match to his seed data — not "t4 Member," which is what it would have shown without that translation step. Moving between all 4 accounts in one session (3 logins + 1 registration) also exercises `signOut` and re-login correctly, since that's only possible if each session actually cleared before the next began.

**What shipped:** `firebaseClient.ts` (new) — the first time this app's actual React client talks to Firebase directly, rather than through an Admin-SDK Node script. Wired to the local emulator suite in dev via `import.meta.env.DEV` (Auth/Firestore/Functions on their usual ports); there's no real Firebase project yet, so production config is a placeholder pending step 7. `CustomerPortal.tsx`'s old mock "pick a customer card" screen (`customers.map(c => <button onClick={() => setCurrentUser(c)}>)`) is replaced with a real login form (username → `usernames/{username}` lookup → `signInWithEmailAndPassword`) and a registration form (calls the `registerCustomer` callable, then signs in with the same credentials since the Function's Admin-SDK-created account doesn't hand the browser a session on its own). `tsconfig.json` gained `vite/client` in its `types` array — needed for `import.meta.env` to type-check; `npx tsc --noEmit` was otherwise failing on that alone before this was added.

**A real data-shape mismatch found and fixed, not glossed over:** Firestore stores a customer's `tier`/`group` as schema ids (`"t4"`, `"g3"` — see `scripts/seedCustomers.js`/`functions/index.js`), but every part of this app built before Firestore existed expects a display *name* (`"Diamond"`, `"VIP"`) to match against `loyaltyTiers`/`customerGroups`. Logging in a real Firestore customer as-is would have shown "t4 Member" in the header instead of "Diamond Member" — caught during design (flagged to Bhimal before writing any code) and fixed with a small translation step: `currentUser` is now derived from the raw Firestore doc via `loyaltyTiers.find(t => t.id === raw.tier)?.name`, re-run whenever the raw doc or the tiers/groups arrays change (its own `useEffect`, not resolved inline inside the auth listener, specifically so it never runs against a stale closure).

**Deliberately narrow scope, disclosed upfront:** only login and the customer's own profile now read from Firestore. Orders, cart, and the menu itself are untouched — still 100% the local `store.ts` mock, since `orders`/`orders/{id}/items` don't exist in Firestore yet (step 6). A real Firebase-authenticated customer placing an order today writes to the local mock store the same as before; that history won't retroactively appear once step 6 ships, and they won't show up in Operations' Customer CRM tab either (that still reads the local store, not Firestore `customers`). Not a bug — a known interim state, agreed with Bhimal before writing any code, closing when step 6 and the eventual "point the whole app at Firestore" step (§6/step 7 of the build sequence) happen.

**Pre-delivery verification, beyond the usual:** this is the first client-side (not Admin SDK) Firebase code in the project, so it got checked harder than usual before reaching Bhimal's machine — a full scratch install of the app's actual dependencies (including the newly-added `firebase` package) plus every source file it touches, then both `npx tsc --noEmit` and `npx vite build` run clean end-to-end in Claude's own sandbox. That check caught two real bugs before delivery: `import.meta.env` didn't type-check without `vite/client` in `tsconfig.json` (see above), and `connectAuthEmulator` takes one full URL string (`'http://127.0.0.1:9099'`) unlike `connectFirestoreEmulator`/`connectFunctionsEmulator`, which both take separate `host, port` arguments — an inconsistency in the Firebase SDK itself that a runtime-only test would have caught as a thrown error on the very first page load, not before it ever left the sandbox.

**Assessment against v1 scope:** Customer App UI work, not scope drift — this is exactly the login/registration screen the v1 scope always called for, just built on the real backend instead of a mock. Step 5's originally-deferred piece is now done; `registerCustomer` has gone from "written" to "confirmed loading" to genuinely "confirmed working," the last rung on this project's verification ladder.

**Next step:** step 6 of the build sequence — `orders`/`orders/{id}/items` + the checkout-confirmation and payment-confirmation Cloud Functions. Also outstanding: wiring the rest of the Customer App (orders, cart, menu) to Firestore, and giving Operations' Customer CRM tab visibility into real Firestore customers — both explicitly deferred, not forgotten, per this entry's scope note above.

---

## 2026-08-13 — Step 6 Backend Delivered: confirmCheckout + onItemPaymentConfirmed Cloud Functions, firestore.rules Tightened (Claude, pending Bhimal's live emulator run)

**Files changed (not yet committed by Antigravity):** `firestore.rules`, `functions/index.js` (2 new exports added: `confirmCheckout`, `onItemPaymentConfirmed`), `scripts/testCheckoutFlow.js` (new).

**A real security gap found while scoping this step, fixed before writing any new Function code:** `orders/{orderId}` and its `items/{itemId}` subcollection have allowed direct client `create` since the very first rules commit (step 1 of the build sequence), with **no restriction on the `total`/`price` fields** — a client could submit any total it wanted, directly contradicting `BonManzE_Firestore_Schema.md` §4's stated design ("a Function recomputes the total... that recomputed value is what actually gets written"). This predates this session; found while reading the rules to scope step 6, not something that was ever exercised (no checkout flow existed yet to expose it in practice). Fixed by changing both `create` rules to `if false` — order/item creation is now Cloud-Function-only (`confirmCheckout`, via the Admin SDK, which bypasses these rules). `read` and the existing staff `update` rule (mark paid/delivered, price/qty/name/customerId frozen) are unchanged.

**What shipped:**
- **`confirmCheckout`** (callable) — a customer submits *what* they're ordering (dish id, add-on selections, delivery date, service, a same-day slot index) per item; the Function prices every item server-side from the currently published menu (`menuWeeks/{weekStart}`, falling back to `menuDefaults/current` per-service exactly like the client's `forWeek()` helpers) plus the current add-on catalogs, replicates `CustomerPortal.tsx`'s `cartTotals` discount-stacking logic exactly (tier vs. group standard discount, birthday discount, the Lunch-only-coverage bulk discount applied to the full Lunch+Dinner week subtotal, VAT last), and writes `orders/{orderId}` + its `items` subcollection transactionally. The client never submits a price or a total — only what was ordered.
- **`onItemPaymentConfirmed`** (Firestore trigger, not callable) — fires when any order item's `paymentStatus` transitions into `'Paid'` (the write staff already make via the existing rules-gated client update). Awards `points += round(price × tier.multiplier)` — the `LoyaltyTier.multiplier` field that has existed in `store.ts` since before this Function but was confirmed (via grep) to be completely unused anywhere until now — adds the same amount to `ltv`, and upgrades `tier` if the new points total crosses a higher tier's `pointsThreshold` (never downgrades).

**Two judgment calls made and disclosed, not silently decided:**
1. **Pricing source is the day-slot menu document, not the linked Main.** `store.ts`'s own `resolveDish()` comment is explicit that a day-slot dish's `price` is intentionally per-day, never resolved live from `mains/{mainId}` — confirmed and followed here, so `confirmCheckout` reads `menuWeeks`/`menuDefaults`, not `mains`, for pricing.
2. **Points/ltv accrue on each item's own (undiscounted) `price` field, not a pro-rated share of the order's discounted+VAT total.** No existing points-earning logic exists anywhere in the codebase to mirror (confirmed via grep — only the cancellation/refund path touches `storeCredit` today), so this is new design, not a port. The alternative (splitting the order-level discount/VAT back across items to find each item's "amount actually paid") is a defensible design too, just meaningfully more complex, and wasn't clearly called for by anything in the schema doc. Worth Bhimal's explicit sign-off if the simpler basis isn't what he had in mind.

**Verification, and an honest limitation of it:** this project's sandbox environment can reach npm's registry (used for last round's `tsc`/`vite build` check) but **not** `storage.googleapis.com`, which is where the Firestore/Functions emulator binaries are hosted — confirmed by a direct `curl`, which got a 403 from the sandbox's network proxy. That means, unlike previous rounds, **no live emulator run was possible before delivery this time.** Compensated with what could be verified without one: `node --check` + an actual module-load of the new `functions/index.js` (real imports, not just syntax), and — most importantly — the exact discount-stacking and tier-upgrade arithmetic extracted verbatim and unit-tested against independently hand-computed expected values across several cases (full-week bulk discount vs. 4-of-5-days no-discount, group-beats-tier, birthday-only-on-the-matching-item, tier-upgrade-crosses-threshold, top-tier-never-downgrades) — all passed. What could **not** be proven here is the live Firestore/Functions wiring itself (the actual `db.runTransaction` calls, the rules enforcement, the trigger actually firing under a real emulator). `scripts/testCheckoutFlow.js` (delivered alongside this entry) is built to close that gap on Bhimal's machine, which already has the emulator binaries downloaded from earlier sessions: it signs in as the real seeded Eleanor Fant account, builds a full Mon-Fri Lunch cart (+1 Dinner item) using real `menuDefaults` ids on a week chosen specifically to have no `menuWeeks` override, independently recomputes the expected price/discount/total without reusing any of `functions/index.js`'s own code, and asserts against the Function's actual response — plus checks that an unknown dish id is rejected, that a direct client `orders` create now fails with `permission-denied` (proving the rules fix), that marking every item Paid awards the right points/ltv and upgrades Eleanor from Bronze to Silver, and that re-marking an already-Paid item doesn't double-award.

**One disclosed gap in the test's own coverage:** step 5 of the test (marking items Paid) writes via the Admin SDK rather than signing in as staff and doing it through the client, because the bootstrap staff password (`scripts/seedBootstrap.js`) may have been changed by hand since seeding, per that script's own comment — this script has no way to know the current value. The write shape is identical to what a real staff client update produces, so the trigger's own behavior is tested faithfully either way; what's *not* independently re-proven here is the staff-permission rule gate itself, which is a simple boolean/equality check with no new logic in this round.

**Deliberately still deferred, not forgotten:** the real Customer App cart/checkout UI is not wired to `confirmCheckout` yet, and Operations' order screens are not wired to read `orders`/`items` yet — both explicitly out of scope for this round (agreed with Bhimal before writing any code), same "backend proven, UI wiring is separate work" split as step 5.

**Update — Bhimal's live run (2026-08-13) found a real bug, since fixed:** the emulator picked up both new functions and the tightened rules cleanly (`functions[us-central1-confirmCheckout]: http function initialized`, `functions[us-central1-onItemPaymentConfirmed]: firestore function initialized`, `firestore: Rules updated`, no compile errors), and `scripts/testCheckoutFlow.js` passed 12 of 13 checks on the first run. The one failure was real: marking all 6 of Eleanor's items Paid at once awarded 1159 points instead of the expected 1115 — a 44-point overshoot that traced to `round(220 x 1.2) - 220`. Root cause: `onItemPaymentConfirmed` re-read the customer's **live** tier on every trigger invocation, and each item's `paymentStatus` update fires its own independent trigger -- so once an earlier item in the same batch pushed Eleanor's points past the Silver threshold, a later item in that same batch (processing order across independent Cloud Functions triggers isn't guaranteed) got charged at the new 1.2x multiplier instead of the 1x she was actually on when she placed the order. Same order, potentially different point totals depending on nothing more meaningful than trigger scheduling.

**Fix:** `confirmCheckout` now freezes `tierAtOrder` onto every item at checkout time; `onItemPaymentConfirmed` computes the multiplier from that frozen value instead of re-reading the customer's current tier at payment time. Verified the fix directly: replayed the exact failing scenario (same 6 prices, same starting points/tier) through 4 different processing orders in a standalone simulation -- all 4 now converge on identical results (1415 points, tier `t2`), where before the fix they would have diverged. `scripts/unitTestMath.js`'s existing checks (unaffected by this change) still all pass. Updated `functions/index.js` re-delivered to Bhimal's machine; re-running `testCheckoutFlow.js` is the next step.

**Confirmed working (live), 2026-08-13:** after restoring the emulator's seed data (a separate, unrelated near-miss — see below) and restarting with the fixed `functions/index.js`, `node scripts/testCheckoutFlow.js` passed all 13 checks: subtotal/discount/total math correct (Rs 1115 subtotal, Rs 167.25 standard discount, Rs 55.75 bulk discount, Rs 1025.80 total), the order + 6 items written with server-computed pricing, an unknown dish id rejected, a direct client `orders` create rejected with `permission-denied` (the rules fix holds), and — the one that mattered most — marking all 6 items Paid took Eleanor from 300 to exactly 1415 points (300 + 1115, at the correct 1x Bronze multiplier throughout) and upgraded her to Silver, with no double-award on a repeat mark-paid. `confirmCheckout` and `onItemPaymentConfirmed` are now genuinely proven end-to-end, not just reviewed by hand — same rung on this project's verification ladder as `registerCustomer` reached in the prior entry.

**A separate, unrelated near-miss during this same verification pass:** the first re-run after restarting the emulator hit `auth/user-not-found` for Eleanor's account — the restart's `npm run emulators` (confirmed to be the correct script, with `--export-on-exit`/`--import` both present) came up with an empty Auth/Firestore emulator, no "Importing data from ..." lines at all in the startup log. The likely cause: whatever happened during the *previous* restart (before this verification pass) didn't complete a clean export, so there was nothing for this restart to import — the same category of near-miss as the 2026-08-13 entry earlier today, a different specific trigger. Fixed the same way: re-ran all four seed scripts (`seedBootstrap.js`, `migrateConfigDocs.js`, `migrateMenuLibrary.js`, `seedCustomers.js`), all idempotent, all confirmed clean. Same standing reminder applies: always stop the emulator with `Ctrl+C` in its own terminal and let the export finish before closing anything.

**Next step:** commit the three changed/new files (`firestore.rules`, `functions/index.js`, `scripts/testCheckoutFlow.js`) via Antigravity, then decide whether to wire the real Customer App checkout UI to `confirmCheckout` next, or tackle something else.

---

## 2026-08-13 — firestore.rules / functions/index.js / scripts/testCheckoutFlow.js Committed (Antigravity)

**Commit:** [`914137e`](https://github.com/BhimalL/BonManze_PWA/commit/914137e7c2d7393d1e09accc478836423177d80f) "Step 6 backend: confirmCheckout + onItemPaymentConfirmed, tierAtOrder fix, tightened rules" — 3 files, 554 insertions, 11 deletions, pushed to `main` by Antigravity.
**Verified:** confirmed directly against the device (`git status --short`, `git log -1`, `git show --stat`) rather than trusting the relayed confirmation alone — exact match on files/line counts. Working tree clean of tracked changes afterward.

Closes the "Also pending: committing..." item from the previous entry. Step 6's backend half (`confirmCheckout`, `onItemPaymentConfirmed`, the `tierAtOrder` fix, the tightened `orders`/`items` create rules) is now fully shipped: written, live-tested (13/13 checks), and committed.

---

## 2026-08-13 — Customer App Checkout + Order History Wired to Real Firestore (Claude's own call, Bhimal delegated "what's next")

**Files changed (not yet committed by Antigravity, not yet live-tested by Bhimal):** `modules/CustomerPortal.tsx`.

**Why this task, not something else:** after the previous entry's commit landed, Bhimal was asked whether to wire the Customer App checkout UI to `confirmCheckout` next, address Operations' Customer CRM visibility into real customers, or verify Storage's cross-service rules — and said "I'll let you decide." Chose the checkout UI wiring: it's the most direct payoff from step 6's backend work (already proven live, sitting unused by the actual customer-facing screen), and the natural next rung after step 5's login UI.

**Investigated before writing any code, not assumed:** two things changed the scope from "just wire the button."
1. **Operations' menu-editing UI (`Operations.tsx`) has zero Firestore wiring at all** — confirmed by reading the code; every menu/price edit (`updateMainDish`, `addBaseOption`, etc.) mutates only a local in-memory array, never Firestore. `confirmCheckout` prices from Firestore's `menuWeeks`/`menuDefaults`/add-on-catalog documents, a one-time snapshot from the 2026-08-12 migration with no live sync since. **If any menu/price content has been edited in Operations since that migration, customer-facing pricing and what `confirmCheckout` actually charges have silently diverged** — flagged directly to Bhimal, not yet answered.
2. **Wiring checkout alone would have made a customer's own order invisible immediately after placing it.** `myOrders` (the source for "My Order" and Profile's order history) filters a completely separate local mock `orders` array, disconnected from Firestore. So this round's scope was expanded, before any code was written, to cover both checkout submission *and* order-history reading — not checkout alone.

**What shipped:**
- **`handleCheckout` rewritten** to call `confirmCheckout` (the callable proven working in the prior two entries) via `httpsCallable`, with `type: 'Meal Plan'` and `paymentScheme: 'Per-Delivery'` (matching the value already hardcoded in the mock flow — no new payment-scheme UI). On success, clears both carts and switches to the order view; the new Firestore listeners (below) surface the new order automatically, no local state push needed. On failure, shows an inline error banner and a toast rather than failing silently. The "Confirm order" button now shows a loading spinner and is disabled while the call is in flight.
- **Two new live `onSnapshot` listeners** — one on `orders` filtered by `customerId == uid`, one on a `collectionGroup('items')` query also filtered by `customerId == uid` (the exact query shape that field was duplicated onto every item to support, per the schema doc's own design). A new `firestoreOrders` memo reshapes the raw listener data into the app's existing `Order`/`OrderItem` TypeScript types, and `myOrders` now concatenates the local mock with this real data. **No changes were needed to any existing rendering code** ("My Order" tab, the receipt sheet, Profile drawer's order history, the week-grouping logic) — it all already only needed `Order`-shaped objects and doesn't care where they came from.
- **Edit/Cancel/Pay controls hidden for real orders.** `editOrderItem`/`cancelOrderItem`/`submitPaymentClaim` all mutate the local mock store by order id and would silently do nothing (or worse) against a real Firestore order id. A `firestoreOrderIds` set gates all 4 reachable call sites; real orders show short explanatory read-only text ("Contact us to change" / "{amount} due · contact us") instead of non-functional buttons. Wiring these to real Cloud Functions is separate follow-up work, not done this round.

**Verification, and an honest limitation of it:** checked before delivery, matching the effort of every prior round — `npx tsc --noEmit` and `npx vite build` both clean in Claude's own sandbox scratch copy, and a manual read-through of the existing `thisWeekLines`/`weekOrders`/`pastLines`/`paymentGroups` derivations confirming they rely only on fields (`item.status`, `item.deliveryDate`, `order.id`, `order.timestamp`, `item.paymentStatus`, `item.paymentReference`, `item.qty`, `item.price`) that the new Firestore reconstruction populates correctly, cross-checked directly against what `confirmCheckout` actually writes in `functions/index.js`. **What could not be checked here:** this is UI work with no synthetic test script behind it (unlike `confirmCheckout` itself, which has `testCheckoutFlow.js`) — the actual checkout button and order-history screen have not been exercised against a live emulator + running app. That's the next step, on Bhimal's machine.

**Deliberately still deferred, not forgotten:** Operations' order screens (Orders by Dish, Delivery List, Payments) are still not wired to real `orders`/`items`; Operations' Customer CRM tab still has no visibility into real Firestore customers; the menu-data drift risk above is unresolved; the Edit/Cancel/Pay actions above are hidden, not implemented, for real orders.

**Next step:** Bhimal to run `npm run dev` + the emulator and place a real order through the Customer App as one of the seeded customers, confirming it appears correctly in "My Order" and that the totals/points match what `confirmCheckout` computes. Once confirmed working live, commit `modules/CustomerPortal.tsx` via Antigravity.

---

## 2026-08-13 — Real Bug Found on Bhimal's First Live Checkout: Collection-Group Query Denied by firestore.rules (Claude, fixed same day)

**Files changed (not yet committed by Antigravity):** `firestore.rules`.

**What happened:** Bhimal placed a real order through the Customer App's new checkout — the order didn't appear in "My Order" afterward. The browser console showed the real cause directly: `order items listener failed FirebaseError: false for 'list' @ [the deny-everything catch-all's line]`.

**Root cause:** the `items` subcollection's security rule was written nested inside `orders/{orderId}`'s own `match` block — correct-looking, and correct for direct single-document access where the order id is already known (e.g. staff marking one item Paid). But the Customer App's new order-history listener reads items via a **collection-group query** (`collectionGroup('items')`, filtered by `customerId`) specifically so it can see every order's items without already knowing which order ids exist — and Firestore does not apply a rule nested under a specific parent path to a collection-group `list` request. The request instead fell through to the deny-everything catch-all rule at the bottom of the file, so the items listener got `permission-denied`, `fsItemDocs` stayed empty, and the order rendered with zero items — invisible in "My Order" even though the order document itself (in the top-level `orders` collection, a normal query, unaffected) was created correctly.

**Fix:** moved the `items` rule out of the nested `match /orders/{orderId} { match /items/{itemId} {...} } }` form and into a top-level `match /{path=**}/items/{itemId} { ... }` block — Firestore's documented pattern for a rule meant to apply across a whole collection group. This form covers both the collection-group query and ordinary direct get/update access to a single item; no other rule logic changed (same read/create/update/delete conditions as before).

**Verification, and its limit:** confirmed brace/paren balance and structure by hand (no live emulator available in this sandbox — network-blocked, same limitation as every prior rules-touching round). This is a well-documented, standard Firestore Rules pattern for collection-group access, not a novel construct. **Not yet confirmed against the real emulator** — that's the next step, on Bhimal's machine.

**Next step:** with the emulator already running, dropping in the new `firestore.rules` should hot-reload automatically (watch terminal 1 for `+  firestore: Rules updated`, no compile error). Refresh the Customer App page afterward to re-establish the order-history listeners (a failed `onSnapshot` doesn't automatically retry after rules change) — the order Bhimal already placed should then appear in "My Order" immediately, since the order document itself was already there; only the items were unreadable. If it still doesn't show, check the console again for a fresh error.

---

## 2026-08-13 — Confirmed Working (Live): Real Checkout + Order History, After the Rules Fix

Bhimal re-ran the checkout after the `firestore.rules` fix above landed and refreshed the page: the order (Chicken Curry, Rs 120, Monday) now appears correctly in "My Order" — right amount, right dish, tagged UNPAID/ACTIVE, with "CONTACT US TO CHANGE" shown in place of Edit/Pay/Cancel controls (the gating for real Firestore-origin orders working exactly as designed). No permission errors in the browser console this time. This closes out the last open item from the two entries above — the Customer App's checkout + order-history wiring is now genuinely proven live, not just `tsc`/`vite build`-clean.

**Next step:** commit `firestore.rules` and `modules/CustomerPortal.tsx` via Antigravity.

---

## 2026-08-13 — firestore.rules / modules/CustomerPortal.tsx Committed (Antigravity)

**Commit:** [`6e32fb4`](https://github.com/BhimalL/BonManze_PWA/commit/6e32fb48aa839e280244bf29436e655962f7e45a) "Wire Customer App checkout + order history to Firestore" — 2 files, 215 insertions, 67 deletions, pushed to `main` by Antigravity.
**Verified:** confirmed directly against the device (`git status --short`, `git log -1`, `git show --stat`, and `git log -1 origin/main` to confirm the push actually landed, not just a local commit) — exact match on hash/files/line counts.

Closes out this round: the Customer App's checkout + order-history wiring (and the `firestore.rules` collection-group fix it surfaced) is now written, live-tested, and committed — same bar as every other piece of this backend so far.

**Next:** scoping Operations' Firestore wiring (Customer CRM tab + order screens) — Bhimal delegated the decision on ordering; committing first, scoping next.

---

## 2026-08-13 — Operations: Staff Login Gate + Real Firestore Read-Side Wiring

**What changed (`modules/Operations.tsx`):**
- Added a staff sign-in gate. Operations now requires signing in with a
  Firebase Auth account that has a matching `staff/{uid}` document with
  `active: true` (checked via `onAuthStateChanged` + `getDoc`). Anyone
  without one is signed back out immediately with an explanatory error,
  rather than being left half-authenticated.
- Added an email/password sign-in screen (shown when not signed in) and a
  loading spinner (shown while the auth check is running) — both render
  before the existing Operations console JSX, placed as early returns
  after all hooks so React's rules of hooks stay satisfied.
- "Exit Console" in the sidebar now signs the staff user out (`signOut`)
  before returning to the landing screen, instead of just navigating away
  while still authenticated.
- Once signed in, Operations' Customer CRM, Orders by Dish, Delivery List,
  and Payments tabs now read real data from Firestore (`customers` and
  `orders` collections, plus a `collectionGroup('items')` listener for
  order line items) instead of the local mock store. This is a swap, not a
  merge — matching the same call `CustomerPortal.tsx` already made for its
  own order history — so existing mock/demo orders and customers no longer
  appear in Operations.
- `tier`/`group` on customers come back from Firestore as schema ids
  (e.g. `t4`, `g3`); these are translated to display names using the
  existing `LOYALTY_TIERS`/`CUSTOMER_GROUPS` mock constants purely as a
  static id→name lookup table (the same trick `CustomerPortal.tsx` uses).
- "Mark Delivered" (Delivery List) and "Mark Paid" (Payments) are now
  disabled with an explanatory tooltip. Their underlying handlers still
  only mutate the old local mock order array, so against now-100%
  Firestore-sourced orders they would always silently fail — same
  discipline already applied to `CustomerPortal.tsx`'s Edit/Cancel/Pay
  controls. Wiring these to real writes is follow-up work.

**Prerequisite already in place:** `scripts/seedBootstrap.js` (already run
earlier) created an "Owner" role and a staff account for Bhimal via the
Admin SDK:
- email: `bhimalonly@gmail.com`
- password: `ChangeMe123!` (placeholder — change this in the emulator's
  Auth UI, or in the Firebase console once this goes to a real project)

**Verified before delivery:** `npx tsc --noEmit` and `npx vite build` both
pass clean against the edited file in a scratch mirror.

**Not yet done:** wiring "Mark Delivered"/"Mark Paid" to real Firestore
writes (currently disabled); committing this file via Antigravity.

## 2026-08-13 — Confirmed Working (Live): Staff Login + Operations Read-Side Firestore Wiring

Bhimal signed in to Operations with the seeded staff account
(`bhimalonly@gmail.com`) after restarting the emulator with an imported
data snapshot (the emulator had started blank the first time — no
`--import` flag — losing all customers/staff/orders created earlier;
recovered by importing `firebase-export-1786608580510RZAfuh`, which had
everything including Neji Lakha's registration).

Confirmed live in the browser:
- Customer Directory shows real Firestore customers with correct
  tier/points/credit — Neji Lakha (Bronze, 0 orders — she only
  registered, never checked out), Eleanor Fant (Silver, 1 real order,
  Rs 29,515.00), Sarah Connor, Marcus Sterling (Diamond) all displaying
  correctly with ids translated to display names.
- Orders by Dish, Delivery List, and Payments tabs (which depend on the
  org-wide `collectionGroup('items')` listener — the same query shape
  that hit the collection-group rules bug earlier this session) loaded
  with no console errors — no `permission-denied`, no listener failures.
- No Firestore/Auth-related console errors at all after the emulator
  restart. Remaining console entries (Tailwind CDN dev warning, a browser
  extension's "Extension context invalidated" errors, a click-handler
  timing violation) are unrelated to this app's code.

**Also confirmed:** the Cloud Functions emulator, which failed to load on
the first (blank) `emulators:start` run, loaded cleanly
(`confirmCheckout`, `onItemPaymentConfirmed`, `registerCustomer` all
initialized) once restarted — that first failure looks like a one-off,
not a real regression.

**Operational note for future sessions:** running `firebase emulators:start`
without `--import`/`--export-on-exit` starts completely blank — no
staff/customer/order data survives a restart otherwise. Restart with:
`npx firebase emulators:start --import=./firebase-export-1786608580510RZAfuh --export-on-exit=./firebase-export-1786608580510RZAfuh`
to both load and keep saving to the same snapshot going forward.

**Next step:** hand `modules/Operations.tsx` to Antigravity to commit.

## 2026-08-13 — Mark Delivered / Mark Paid Wired to Real Firestore Writes, Confirmed Live

**Commit:** [`295125a`](https://github.com/BhimalL/BonManze_PWA/commit/295125a1004f9dfca04ba18e36f98a8a89234d77)
**Verified:** `npx tsc --noEmit` clean, `vite build` clean, pushed to `main`.

**What changed (`modules/Operations.tsx`):**
- "Mark Delivered" (Delivery List) and "Mark Paid" (Payments) now perform
  real batched Firestore writes to the relevant `orders/{orderId}/items`
  documents (`status: 'Completed'` / `paymentStatus: 'Paid'` +
  `paymentMethodName`) instead of being disabled placeholders. Both show a
  loading spinner while in flight and a red inline error banner if the
  write fails.
- The items listener now carries each item's real Firestore document id
  (`_fsItemId`) through to the UI — needed because `confirmCheckout`
  writes items with an auto-generated id, not the `itemId` data field
  (which is just which dish/curry it is). Without this there was no way
  to build a `doc()` reference back to the exact item to update.
- No new Cloud Function was needed for either action — `firestore.rules`'
  existing `manageOrders` rule already allowed staff to change
  `status`/`paymentStatus` directly, as long as price/qty/name/customerId
  don't move, so a batch of plain client updates is enough. The parent
  order's own `paymentStatus` rollup (something the old mock also wrote)
  has no real equivalent — Operations derives it live from the items
  listener already, so it doesn't need a separate write.

**Confirmed working end-to-end, live, same day:** placed a fresh real
order through the Customer App as Neji Lakha (2 meals, Rs 210 total —
Monday Chicken Curry Rs 120, Tuesday DiPain Sausice Rs 90), then in
Operations marked the Monday item both Delivered and Paid. Confirmed in
Neji's own live Customer App view (not just Operations): the Monday item
flipped to `PAID`/`COMPLETED` with a receipt button, "Pay Balance"
correctly dropped from Rs 210.00 to Rs 90.00 (the remaining unpaid
Tuesday item), and her Customer Directory card picked up the
`onItemPaymentConfirmed` loyalty trigger's side effect (120 points, Rs
120.00 lifetime value) with no console errors. This is the first fully
real, staff-initiated payment/delivery confirmation to flow through the
whole stack — checkout, staff action, Firestore trigger, and the
customer's own live view — in one unbroken chain.

**Found along the way, not a bug:** an existing `orders` document
(customerName "Eleanor Fant", `type: "Delivery"`) never showed up in
Payments/Delivery List — traced to `scripts/testCheckoutFlow.js` hardcoding
`type: 'Delivery'` for its own test runs, which Operations' Meal-Plan-only
filter correctly excludes. Not a real order, left in place as harmless
test data (can be cleared via the Emulator UI's "Clear all data" if it
gets in the way later).

**Confirmed isolated, not systemic:** an earlier checkout attempt failed
with `"dish-msrgh4sz-8pm6" is not on the Lunch menu for 2026-08-13` — a
real `confirmCheckout` validation working as intended. Swapping that one
dish for a different one and re-confirming succeeded immediately, so this
was specific to that one dish, not the broader menu-drift risk flagged
earlier — worth a closer look at that specific dish's Firestore id later,
but not urgent.

**Next round, by Bhimal's choice:** the Customer App's own "Pay"/"Pay
order" buttons (`submitPaymentClaim`) are still hidden for real orders —
same reason Mark Delivered/Paid were disabled before this round, the
handler only mutates the local mock store. Wiring that up so customers
can self-report a payment claim (Juice/MauCAS reference, etc.) for
Operations to confirm is the next scoped piece of work.

---

## 2026-08-13 — Customer App "Pay"/"Pay order"/"Pay balance" Wired to Real Firestore Writes, Confirmed Live

**Verified:** `npx tsc --noEmit` clean, `vite build` clean.
**Commit:** [`2dc393b`](https://github.com/BhimalL/BonManze_PWA/commit/2dc393bafb857279a78e4a29166e768903ed3cfc) "Wire Customer App payment submission to real Firestore", pushed to `main` by Antigravity.

**What changed (`modules/CustomerPortal.tsx`, `firestore.rules`):**
- "Pay" (per meal), "Pay order," and "Pay balance" now perform a real
  batched Firestore write to `paymentMethodName`/`paymentReference` on the
  relevant `orders/{orderId}/items` document(s), instead of being hidden
  for real orders. `paymentStatus` itself is never touched from here —
  choosing a method only records a claim, exactly like the old mock; only
  Operations' own Mark Paid (wired the previous round) can ever confirm a
  payment.
- Same `_fsItemId` gap Operations.tsx had before its own round — the
  items listener here didn't carry the item's real Firestore document id
  either. Fixed the same way: `_fsItemId` rides through `FsOrderItem`
  (extending `OrderItem`) from the listener through the `firestoreOrders`
  reshape memo and the `Line` interface, so `commitPayment` can build a
  real `doc()` reference. A target with no `_fsItemId` is mock demo
  history and still goes through the old local-store `submitPaymentClaim`
  — so a "Pay balance" spanning both a real order and mock history (the
  UI doesn't rule this out, even if unlikely in practice) settles every
  line correctly either way.
- **New `firestore.rules` clause was required this round** — unlike Mark
  Delivered/Paid, which reused the existing staff-only `manageOrders`
  update rule, there was previously NO customer-write path for items at
  all. Added a second `allow update` clause, `||`'d with the staff one:
  a customer may update their own item only while `paymentStatus !=
  'Paid'`, and only if `paymentStatus`/`price`/`qty`/`name`/`status`/
  `customerId`/`deliveryDate`/`serviceSlot` all stay unchanged — leaving
  only `paymentMethodName`/`paymentReference` free to move. Chosen over a
  new Cloud Function since the rule change is small, narrowly scoped, and
  keeps the write a plain client batch like Mark Delivered/Paid.
- Loading spinner + inline error banner added to the payment sheet's
  confirm button, same pattern as the Mark Delivered/Paid round.
- The Pay/Pay order buttons' `!firestoreOrderIds.has(...)` gate (and the
  now-dead "contact us" fallback badge) were removed since both now write
  correctly for real orders. Edit/Cancel remain gated/hidden for real
  orders — out of scope this round, still mock-store-only.

**Confirmed working end-to-end, live, same day, by Bhimal:** placed the
`firestore.rules` clause and `CustomerPortal.tsx` changes, restarted the
emulators to pick up the new rules (rules only reload on restart, not
hot), signed in as Neji, tapped Pay on the remaining Rs 90 Tuesday meal,
picked a payment method and confirmed. The claim showed up correctly in
Operations' Payments tab awaiting Mark Paid; confirming it there flipped
the item to Paid in both Operations and Neji's own Customer App view —
same three-way verification standard as the Mark Delivered/Paid round.

**Found along the way, not part of this round's code:** the emulator
restart initially came up without last session's data (Neji's order,
customers, staff, menus) because it was started with a plain `firebase
emulators:start` rather than `npm run emulators` — the latter is the only
one that points `--import`/`--export-on-exit` at
`%LOCALAPPDATA%\BonManzE\emulator-data` (moved there in the first place
because OneDrive's sync driver blocks the atomic rename Firebase's export
needs on exit — see `.gitignore`'s note on `.emulator-data/`). The prior
session's data was recovered from a `firebase-export-<timestamp>` folder
that auto-saved to the repo root on exit (an artifact of running the bare
command), imported once to reseed the canonical `%LOCALAPPDATA%` location,
then `npm run emulators` continued working normally. No code change; a
process reminder — always start emulators via `npm run emulators`, never
the raw `firebase emulators:start`, in this OneDrive-synced repo.

**Next step:** hand `modules/CustomerPortal.tsx` and `firestore.rules` to
Antigravity to commit.

## 2026-08-13 — Meal Library / Menu Planner / Add-On Catalogs / Icon Library Wired to Real Firestore (Bhimal's choice: "Meal Library/Menu Planner" → "Everything in one round")

**Verified:** `npx tsc --noEmit` clean, `vite build` clean. Not yet
live-tested by Bhimal or committed via Antigravity as of this write-up.

**Why this round looked different from the last few:** every prior
Firestore-wiring round (orders, customers, payments) wired a component's
own `onSnapshot` listener directly in `Operations.tsx`/`CustomerPortal.tsx`.
That pattern doesn't work cleanly here — `store.ts`'s `resolveDish()`/
`specialPriceInfo()`/`filterAddOnOptions()` are plain functions, shared
verbatim by both apps, that read `MAIN_DISHES`/the five add-on catalogs
directly as module-level bindings, not as parameters. Duplicating
listeners into both components would have meant duplicating or exporting
those utilities too — a bigger, riskier change. Instead, every
`onSnapshot` listener now lives inside `store.ts` itself and writes
straight into the same exported `let` bindings those functions already
read, so every existing call site in both files keeps working completely
unchanged (confirmed via grep that `CustomerPortal.tsx` does import
several of the five catalogs as raw bindings directly, not just through
`subscribeToX` — this is exactly why the fix had to live where it does).

**What changed (`modules/store.ts`):**
- `MAIN_DISHES` (`mains/{mainId}`, one doc per Main) — `addMainDish`/
  `updateMainDish`/`removeMainDish` now `setDoc`/`updateDoc`/`deleteDoc`
  for real, synced back via a `collection(db, 'mains')` listener.
- The weekly Lunch/Dinner menu stores (`menuWeeks/{weekStart}`,
  `menuDefaults/current`) — the shared `createWeeklyMenuStore` factory
  was restructured: `update`/`addDish`/`removeDish`/`setWeekMenu` now
  `setDoc(..., {merge:true})` just their own service's key (`lunch` or
  `dinner`) onto the week's doc, leaving the other service's key on the
  same doc untouched. A single shared `menuWeeks` collection listener
  feeds both stores' local override state, and a `menuDefaults/current`
  listener supplies the fallback — read-only from the client, since
  Operations' Menu Planner never edits an abstract "default," only a real
  calendar week (confirmed via `activeMenuWeekStart`).
- The five add-on catalogs (`mealBases`/`mealDhals`/`mealSalads`/
  `mealBeverages`/`mealDesserts`) and `iconLibrary` — each a single
  `{ items: [...], updatedAt }` doc at `.../current`, already seeded by
  `scripts/migrateConfigDocs.js` and already read server-side by
  `confirmCheckout`. Add/update/remove now read-modify-write the whole
  `items` array via `setDoc`.
- `iconLibrary/current`'s read is staff-only in `firestore.rules`
  (`isActiveStaff()` — it's an admin-only picker, never customer-facing),
  but `store.ts` loads unconditionally in both apps. A signed-in customer
  session was going to fail that one read every time — correct per the
  rule, but it would have logged an unhandled `permission-denied` error
  to the console on every customer page load. Fixed with a no-op error
  callback on that specific listener.
- **A real, latent data-integrity risk removed, not just left alone:**
  `store.ts` carried a chain of one-time, `localStorage`-flag-gated
  migration/cleanup passes from the mock-data era (`migrateMenuToLibrary`,
  `cleanupMainDishContentOnce`, `relinkDefaultRotationToLibrary`,
  `clearMenuPlannerOnce`, `fixDinnerOverridesOnce`/`V2`) that ran
  automatically at module load. Every one of those called a mutator that
  now writes to Firestore for real — left in place, any of them
  re-firing on a fresh browser profile or cleared `localStorage` (their
  "ran once" flags live client-side, so a fresh profile has none set)
  would have replayed old mock-era fixups (duplicate Mains, a force-
  emptied real planned week) straight onto the real, already-seeded
  production data. All removed, along with the now-dead
  `LUNCH_DEFAULT_LINK_MAP`/`DINNER_DEFAULT_LINK_MAP`/
  `MENU_LIBRARY_MIGRATED`/etc. flags. `persistAll()`/`PersistedState`
  also dropped the menu-content fields entirely — restoring any of them
  from a stale `localStorage` snapshot on load would just mask real
  Firestore data for a moment — and `getSnapshot()`/`hydrate()`/
  `addRawListener()` (only ever used by that persistence path) were
  removed from the weekly-menu-store factory along with them.
- `firestore.rules` needed **no changes** — every collection above
  already had exactly the `manageMenu`-gated write / public (or
  staff-only, for icons) read rules this round needed, from the original
  rules-drafting pass; confirmed present by a fresh read this round.

**What changed (`modules/Operations.tsx`):**
- ~30 mutator call sites (Mains ×3, Menu Planner ×5 per service ×2
  services, 5 catalogs' generic add/update/remove ×3, Icon Library ×3,
  plus reuse-week and CSV-import) now route through one new shared
  `runMenuWrite()` helper instead of building ~15 separate per-action
  spinner/error UIs. It reuses the `opsActionError` banner state already
  added for Mark Delivered/Mark Paid — now also rendered at the top of
  the Menu Planner tab, the Meal Library tab, and Settings → Icons.
- A stale comment referencing the now-deleted `migrateMenuToLibrary`/
  `runMenuLibraryMigrationOnce` was rewritten to describe the real
  current wiring instead.

**Known, non-blocking residual gap:** `CustomerPortal.tsx` doesn't force
a re-render specifically when the five add-on catalogs/Mains/Icon Library
change value (it only bumps a tick for Lunch/Dinner menu placement
changes). Values are always correct the next time anything re-renders —
this is a live-binding read, not a stale copy — just not guaranteed to
repaint the instant Operations saves a catalog edit while a customer's
app is already open and idle. Not fixed this round; noted in the schema
doc's open items if it's ever worth revisiting.

**Not done this round, deliberately out of scope:** dish-photo upload
still writes base64 directly (unrelated pre-existing gap, tracked
separately in the schema doc); Meal Library Main editor's photo field
itself was untouched.

**Next step:** live-test against the local emulator (add/edit/remove a
Main, a day-slot dish, a catalog entry, an icon; try a CSV import; check
the customer-facing menu still renders correctly), then hand
`modules/store.ts` and `modules/Operations.tsx` to Antigravity to commit.

**Real bug found on Bhimal's first live edit, fixed same day:** editing an
existing Main (Paneer Curry) threw `Function updateDoc() called with
invalid data. Unsupported field value: undefined (found in field cost in
document mains/main-...)`. Root cause: every optional field across this
file (`MainDish.cost`/`photoUrl`, `CurryOption.baseOptionIds`/etc.,
`AddOnOption.price`/`up`/`group`) has always used `field: undefined` to
mean "no value" — harmless for a plain JS object/spread (the mock era),
but the Firestore SDK rejects a literal `undefined` anywhere in written
data outright. `saveMainEditor`'s patch object unconditionally includes
`baseGroup: undefined`, so this fired on every single Main edit, not just
this one. Nothing was written to Firestore when this happened — the SDK
rejects the payload client-side before any network call, so no data was
at risk. **Fixed** with two small helpers in `store.ts`: `dropUndefined()`
(strips undefined-valued keys/array entries recursively — correct for
`setDoc`, and for the menu-week arrays that get fully replaced on every
write regardless) and `toUpdatePayload()` (converts an explicit `undefined`
in an `updateDoc` call into Firestore's `deleteField()` sentinel instead of
just dropping the key — needed so "clear this field" still actually clears
it in Firestore, rather than silently leaving the prior value in place).
Applied to every write path in the file: `addMainDish`/`updateMainDish`,
the weekly-menu-store's `writeWeek` (covers `update`/`addDish`/`removeDish`/
`setWeekMenu` for both services), and all five add-on catalogs' + Icon
Library's add/update/remove. `tsc`/`vite build` both clean after the fix.
Updated `store.ts` delivered to the device; not yet re-tested live or
committed via Antigravity as of this write-up.

**Second observation from Bhimal's live test, fixed same day:** once a
draft order was confirmed, the "My Order" screen's day header collapsed
from a full date (e.g. "Tuesday, Aug 11" — what the pre-confirmation
draft view shows) down to just the abbreviated weekday ("MON"). Root
cause: `CustomerPortal.tsx`'s `groupByOrderServiceDay` (used only for
confirmed orders) built each day-group's `label` straight from
`OrderItem.deliveryDay`, a terse weekday string, instead of computing a
full date the way the draft view's `getThisWeekDays` does from the day's
actual date. **Fixed** by adding `formatFullDateLabel()` — the same
`toLocaleDateString('en-US', { weekday: 'long', month: 'short', day:
'numeric' })` formatting `getThisWeekDays` already uses, applied to
`line.item.deliveryDate` (parsed from y/m/d components, not
`new Date(dateStr)`, to avoid a UTC-parsing timezone shift landing on the
wrong day) — and using it in place of the raw `deliveryDay` field, with a
fallback to the old abbreviated label if a date is ever missing/
unparseable. `tsc`/`vite build` both clean. Updated `CustomerPortal.tsx`
delivered to the device; not yet re-tested live or committed via
Antigravity as of this write-up.
