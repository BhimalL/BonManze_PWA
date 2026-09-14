# BonManzE — Invoicing, Payment Methods & Related Fixes: Full Test Guide

**Date:** 2026-09-14
**Covers:** Everything built and fixed this session — Steps 0–4 of the Invoicing/Payment Methods scope, the entity-listener persistence bug fix, discount stacking, the Dispatch-timing fix, and the currency decimal-formatting cleanup.
**Data state:** Run this after your emulator restart, on the freshly reset data (`scripts/resetTestData.js` was already run — 0 orders, all customers at 0 points/ltv/storeCredit, base tier).
**How to use this:** Go through in order — later steps build on earlier ones (an entity needs an Invoice Prefix before Step 4's numbering can be tested, for instance). After each numbered check, tell me what you saw; I'll confirm it against the source or flag anything that looks wrong before you move to the next one.

---

## 0. Before you start

- [ ] Confirm the Build badge reads `5fcbd83` (or newer) after your restart — confirms you're testing current code, not a stale cached bundle.
- [ ] Confirm `resetTestData.js`'s effects are visible: Payments tab shows Rs 0 collected / Rs 0 outstanding, no paid history.

## 1. Entity configuration (Settings → Trading Entities)

- [ ] Open Rik's Kitchen (or whichever entity you use for testing) and confirm it has: Address, Email, Phone, **Invoice Prefix** (e.g. `INV-A`) all filled in. If Invoice Prefix is blank, set one now — Step 4's invoice numbering silently skips minting a number for any entity without one (by design, not a bug), so this has to be set before testing invoice numbers below.
- [ ] Confirm the entity's Invoice Number Counter starts at 0 (or whatever baseline you want — the next Mark Paid will produce sequence 1).
- [ ] Confirm the same entity has a Payment Methods checklist and, for at least one checked method, a key/value config block (e.g. a phone number for Juice) — this is Step 3 and hasn't been deep-verified yet, only spot-checked by grep. Add a config value and save; reopen the entity and confirm it's still there (this is exactly the kind of field that silently vanished before the entity-listener bug was fixed, so it's worth specifically re-confirming here).

## 2. Payment Methods (Settings → Payment Methods)

- [ ] Confirm the managed list loads (not the old hardcoded six-entry array) — add a new test method, confirm it appears immediately, then retire it and confirm it disappears from new-selection pickers but doesn't affect anything already using it.

## 3. Checkout — discount stacking (as the customer)

Set up a test customer whose **tier** has both a standard and birthday discount rate, and whose **group** (if any) has a higher standard rate than their tier — that lets you see the "max of tier/group" rule in action. Set their birthday to match a date you'll order for.

- [ ] Order a single meal on a date matching their birthday, in a week that is **not** a full Lunch week. Confirm the pre-checkout total shows Standard discount (at whichever of tier/group is higher) **and** Birthday discount, both applied, but no Full-Week discount.
- [ ] Order a full Lunch week (all 5 weekdays covered) including one birthday-date meal. Confirm all three discounts stack additively on that one meal's line and the week's total reflects Standard + Birthday + Bulk, matching the "6%+5%+5%=16%"-style stacking described earlier.
- [ ] Confirm the confirmed total after checkout (the Cloud Function's real number) matches what the pre-checkout preview showed, to the cent.

## 4. Cooking → Delivery progression (Operations)

- [ ] Orders by Dish tab: click **Start Cooking** for a day/service with Active orders — confirm it flips to Preparing and the button becomes **Mark Ready**.
- [ ] Click **Mark Ready** — confirm it flips to Ready and the header shows "✓ Cooked" with no more action button on this tab.
- [ ] Delivery List tab, same drop: confirm **Dispatch** now appears (it shouldn't have appeared before Ready — that was the bug we just fixed). Click it — confirm status flips to En route and the card shows the "En Route" pill.
- [ ] Click **Mark Delivered** — confirms it flips to Completed/Delivered on both tabs.
- [ ] As a negative check: confirm Dispatch does **not** appear for a drop still Active or Preparing (only after Ready).

## 5. Customer payment claim, including combined payment

- [ ] As the customer, claim payment on a **single** meal via the per-item Pay button. Confirm it shows "Awaiting confirmation" (not Paid) afterward, and that Operations' Payments tab shows "Customer claimed: [method]" with the reference on that exact drop.
- [ ] As the customer, use **Pay order** or **Pay Day** to claim multiple meals in one action. Confirm every covered meal shows "Awaiting confirmation," and confirm in Operations that **each** covered drop independently shows "Customer claimed: [method]" — this is the specific thing that looked like it wasn't working earlier in this session (it turned out to be a different, already-paid order causing the confusion, not an actual bug, but worth re-confirming cleanly now on fresh data).

## 6. Staff confirmation — Mark Paid and invoice numbering (Operations → Payments)

- [ ] Mark Paid on a drop that has **no** existing claim — confirm the Collect Payment modal requires you to pick a method, and afterward the drop moves to Paid.
- [ ] Mark Paid on a drop that **does** have a customer claim — confirm the claimed method is visually highlighted/pre-selected in the modal.
- [ ] Immediately after confirming, open that drop's **Receipt** and confirm the "Invoice ref" is a real formatted number (`INV-A-000000001`-style, not a raw Firestore ID) — this only works if Step 1's Invoice Prefix is set (see Section 1).
- [ ] Mark Paid on a **multi-item drop** from one Mark Paid click (an order with two items in the same date+slot) — confirm both items get Paid together and share **one** invoice number.
- [ ] Mark Paid on **two separate drops for the same customer, same day, different slot** (like the Lunch/Lunch-2 case from earlier) — confirm they get **two different** invoice numbers, since each is its own drop.

## 7. Reprint / duplicate marking

- [ ] Open the receipt for an already-Paid, already-invoiced drop a **second** time (either from Operations' paid history or the customer's own order history). Confirm a "Duplicate / Reprint" badge now appears where it didn't on the first view.
- [ ] Confirm the invoice number and the underlying figures (subtotal/discount/VAT/total) are identical between the first and second view — only the badge should differ.
- [ ] Do this from **both** Operations and the Customer App for the same drop, and confirm both show the reprint badge once either one has been viewed a second time (they share the same `invoiceReprintCount` field on the item).

## 8. Pro-rated single-item receipts

- [ ] Take a multi-item order where a discount applied at checkout (from Section 3). Open the receipt for just **one** item/drop out of that order (not the whole order).
- [ ] Confirm the discount and VAT shown are that item's proportional share of the order's total discount — not the full order's discount amount. (E.g., a Rs 100 item inside a Rs 500 order with Rs 50 total discount should show roughly Rs 10 of discount, not Rs 50.)

## 9. Currency formatting spot-check

- [ ] Look at a receipt line item, the menu/dish price tags, the cart line items, the Dashboard's "This Week's Revenue" tile, and a customer's LTV/Store Credit in their Edit Customer panel. Confirm every one of these now shows exactly 2 decimal places (e.g. `Rs 259.44`, never `Rs 259` or a long floating-point tail like `Rs 227.01000000000002`).

## 10. Partner Accounts smoke test (already closed, quick re-check only)

This feature was fully verified and closed on 2026-09-14 before today's data reset — a quick smoke test is enough, not a full re-verification.

- [ ] Sign in as a Partner account, confirm the sidebar still shows only Orders by Dish (plus Dashboard, minus the Revenue card and Manage Curries/Delivery List quick actions), and confirm Start Cooking still works for their assigned entity.

---

**As you go:** tell me what happened at each checkbox — pass, fail, or anything that looks off (a number that doesn't add up, a badge that didn't appear, an error message). I'll check the relevant source directly for anything that doesn't match what's expected here, the same way we've been doing all session, rather than guessing from the description alone.
