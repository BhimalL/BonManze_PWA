# Partner Accounts — follow-up fixes from live testing (2026-09-12)

Four items, all fast-path (UI-only or one-off data cleanup — nothing here touches `firestore.rules` or a
Cloud Function write-path, so no security review gate applies). Found during Bhimal's live click-through of
the already-shipped Partner Accounts feature (commits `d0fa8b1`, `012956a`, `0334b02` — all independently
verified, still stand as correct). None of these are regressions in that work; they're gaps the click-through
surfaced. Reference: `docs/BonManzE_PartnerAccounts_Scope.md` §5 has the full narrative.

---

## 1. Restrict the "Filter Entity" dropdown for Partner accounts

**Where:** `modules/Operations.tsx` — `filterEntitiesList` (`useMemo`, ~line 1362) and
`renderEntityFilterToggle()` (~line 5648), which is the single shared dropdown reused by Orders by Dish,
Delivery List, Payments, and Customer Directory (per `BonManzE_EntityRestrictedViews_Scope.md`'s "one
reusable entity-filter component" design).

**Problem:** for a signed-in Partner, this dropdown still shows "All Entities" plus the full unrestricted
entity list — including entities they aren't assigned to, and a pile of stray "RBAC Test Entity" rows (see
item 4). Not a security hole — the underlying Firestore listener query is already hard-locked to the
Partner's `assignedEntityIds` regardless of what's picked here (verified: `orders`/`items` queries use
`where('entityId','in', partnerEntityIds)` when `isPartner === true`, added in commit `012956a`) — but it
leaks the existence/names of other entities to an account that's supposed to know nothing beyond its own
assignment, and it doesn't match the settled requirement: "no All Entities option exposed" for Partners.

**Fix:** the `isPartner`/`partnerEntityIds` values already exist in this file (computed from `staffDocRaw` in
the listener-setup effect, ~line 912). Reuse that same derivation at component scope (or lift it if it's
currently local to the effect) so `renderEntityFilterToggle()` can branch on it:

- When `isPartner === true` and `partnerEntityIds.length === 1`: skip the `<select>` entirely and render a
  static, non-interactive label showing that one entity's name (there's nothing to choose between).
- When `isPartner === true` and `partnerEntityIds.length > 1`: build a Partner-specific options list —
  `entities.filter(e => partnerEntityIds.includes(e.id))` — with **no** `{ id: 'all', label: 'All Entities' }`
  entry prepended, unlike the regular `filterEntitiesList`.
- Everyone else's dropdown (`isPartner` false/undefined) stays exactly as it is today — full list, "All
  Entities" included.

Since `entityFilter`'s default state is `'all'` and the underlying query is already locked, this is purely a
UI/information-disclosure fix, not a functional one — confirm after the change that a Partner's screen still
shows their entity's data correctly (nothing should change there).

---

## 2. Dashboard: hide the revenue card and two quick-action buttons for Partners

**Where:** `modules/Operations.tsx` — `renderDashboard()` (~line 2429).

**Decision (settled with Bhimal, recorded in the scope doc §1/§5):** Partners keep Dashboard access — it was
never actually gated by the permission system to begin with (`hasTabPermission()`'s `case 'dashboard': return
true;`, ~line 586-587, applies to every signed-in staff member unconditionally; there's no "dashboard" entry
in the granular permission system at all, since this predates Partners existing). No change needed to
`hasTabPermission()` — leave that `case 'dashboard': return true;` exactly as is.

The four KPI cards (`todayCookCount`, `todayDeliveriesPending`, `pendingPaymentClaimsCount`,
`activeWeekFinancials`, all defined ~line 2389-2427) are already correctly entity-scoped for free — they
derive from `lines` (~line 1377), which reads from `orders`, which is already restricted to the Partner's
assigned entity by the query fix in item 1's linked commit. No data-layer change needed here at all.

**What to actually hide, when `isPartner === true`:**
- The "This Week's Revenue" KPI card (~line 2511-2521) — financial data, not appropriate for an external
  party regardless of entity scoping.
- The "Manage Curries" button (~line 2458-2463, `onClick={() => setTab('menu')}`) and the "Delivery List"
  button (~line 2464-2469, `onClick={() => setTab('delivery')}`) — both currently drop a Partner straight into
  an "Access Denied" screen (confirmed via screenshot during testing), since Partners have no permission for
  either tab. Safe today, but a dead-end UX; just don't render them for a Partner.

Leave "Today's Cook Count," "Deliveries Pending," and "Awaiting Confirmation" visible and untouched.

---

## 3. Fix the hardcoded "Welcome back, Bhimal" text

**Where:** `modules/Operations.tsx`, line 2452, inside `renderDashboard()`.

**Problem:** it's a literal hardcoded string, `<h2 ...>Welcome back, Bhimal</h2>` — not a template reading the
signed-in user's actual name. Pre-existing, unrelated to Partner Accounts; surfaced only because a different
account was signed in during this round of testing.

**Fix:** read the signed-in staff member's own name — `staffDocRaw?.name` is already loaded (it's the
`staff/{uid}` document's `name` field, set at account creation by `createStaffMember`) and is the right source
of truth here, not `staffAuthUser?.displayName` (Firebase Auth's own display name, which duplicates the same
value at creation time but could drift if `staffDocRaw.name` is ever edited later without touching Auth).
Fall back to something generic ("Welcome back") if `staffDocRaw?.name` is somehow unavailable, rather than
showing "undefined."

---

## 4. Clean up stray "RBAC Test Entity" documents in the emulator's persisted data

**Not a code bug** — both places `testSettingsRBAC.js` writes to the `entities` collection
(`entities/test-entity-rbac`, line 223, and `entities/entity-hack`, line 272) already use fixed, deterministic
document IDs via `setDoc`, so re-running that script does **not** create new duplicates; it just overwrites
the same two documents each time. The ~9 duplicate "RBAC Test Entity" rows seen in the Filter Entity dropdown
are leftover from before those fixed IDs were adopted (auto-generated-ID documents from early test runs),
persisted forward ever since through the emulator's `--import=emulator-data` / `--export-on-exit=emulator-data`
cycle (per the emulator-stability note in `CHANGELOG.md`'s 2026-09-12 entry) — nothing has ever deleted them.

**Fix:** a one-off cleanup script (same shape as the existing `scripts/cleanupFixtures.js`, which already
does exactly this kind of by-name Admin SDK cleanup for stale `roles`/`staff` docs from an earlier round) that:

```js
const stray = await db.collection('entities').where('name', '==', 'RBAC Test Entity').get();
for (const doc of stray.docs) {
  await doc.ref.delete();
  console.log(`Deleted stray entity doc: ${doc.id}`);
}
```

Run once against the current emulator data (**after** Bhimal cleanly stops and reflects the emulator so this
runs against the real persisted state, not a stale in-memory copy — same "single Ctrl+C, wait for Export
complete" discipline as every other emulator interaction this project). Safe to delete all matches, including
`test-entity-rbac` itself if its `name` field matches — it's regenerated cleanly the next time
`testSettingsRBAC.js` runs, since that write is idempotent.

No test script changes needed — this is purely a one-time data cleanup, not a recurring bug to prevent.

---

## After applying

- `npx tsc --noEmit` and `npm run build` — items 1-3 touch only `Operations.tsx`.
- No automated test covers items 1-3 (they're presentational); the manual check is: sign in as `partner1@gmail.com`
  again, confirm the Filter Entity control shows only their assigned entity (or a static label, if just one),
  confirm the Dashboard has no revenue card and no Manage Curries/Delivery List buttons, and confirm the
  welcome banner shows "Partner_1" rather than "Bhimal."
- Item 4 is a one-off script run, not a commit to application code — but do commit the cleanup script itself
  to `scripts/` alongside the other one-off cleanup scripts already there, for the same reason
  `cleanupFixtures.js` was kept rather than run-and-discarded: a record of what was cleaned up and why.
