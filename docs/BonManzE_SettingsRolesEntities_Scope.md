# Settings, Roles & Staff, and Trading Entity Management — Scope (v1, for review)

**Date:** 2026-08-25
**Status:** Reviewed by Antigravity, one design fork settled with Bhimal directly (§5). A few smaller open questions remain (§3/§4) before this is a final build plan, same process the Multi-Entity feature went through (`BonManzE_v1_scope.md` → debate → `BonManzE_MultiEntity_ImplementationPlan.md`). No code should be written against this document until those remaining items are settled.
**Grounded in:** a fresh read of `modules/Operations.tsx` (`renderSettingsTab`, commit `7eb7580`) and `modules/store.ts`, plus the RBAC schema already designed in `BonManzE_Firestore_Schema.md` §1/§2/§3 (`roles/{roleId}`, `staff/{uid}`, permission keys) and the `entities/{entityId}` schema from `BonManzE_MultiEntity_ImplementationPlan.md` §4 — both of which exist in Firestore today but have **no in-app UI at all**. Right now the only ways to touch them are the Firebase Emulator UI directly, or one-off scripts (`scripts/seedBootstrap.js`, `scripts/seedEntities.js`).

---

## 0. Why this came up

Bhimal asked two direct questions: "where do I do the entity/company setup?" and "where can I create, edit, delete, manage system users — Roles & Permissions?" The honest answer to both is **nowhere, today** — every staff account, every role, and both trading entities exist only because a script or the emulator's raw Firestore browser put them there. That's fine for a single-operator build phase; it stops being fine the moment a second real staff member needs an account, or the two entities' real legal details need to go in before launch.

Bhimal also asked whether the current Settings tab structure is enterprise-grade. Short answer: **the individual sub-tabs are well-built, but the tab as a whole is missing three things any real multi-staff operation needs, and has one confirmed bug.** Details below, since they directly shape how the new pieces fit in.

## 1. Settings tab — current-state assessment

`renderSettingsTab` (`Operations.tsx`) has seven sub-tabs today: Identity, Delivery & Cut-offs, Tax & Offerings, Loyalty Tiers, Customer Groups, Icon Library, Danger Zone. Each individual sub-tab is solid — consistent card/form styling, sensible validation, live Firestore writes (not mock data) for everything except Danger Zone. That part isn't the concern.

What's missing, in order of how much it matters:

**No staff/role management UI at all.** `roles/{roleId}` and `staff/{uid}` were designed on 2026-08-12 specifically to be managed from a Settings tab (`BonManzE_Firestore_Schema.md` decision #1) — that tab was never built. Today, creating a second staff account, deactivating someone, or changing what a role can do all require hand-editing Firestore. That's the single biggest gap for "enterprise grade," because it means the RBAC system that already exists server-side (`isStaffAllowed`, permission keys) is completely unmanageable without direct database access.

**No client-side permission gating.** Confirmed by grep: `isStaffAllowed`/`permissions[` appear in the actual `Operations.tsx` code exactly zero times outside a single comment. Every signed-in staff member — regardless of role — sees every tab and can attempt every action; `firestore.rules` is the only thing actually stopping a lower-privileged action from succeeding, and it does so by silently failing the write rather than the UI ever hiding the button. That's workable with one staff account (today's reality) but won't hold up once kitchen/delivery roles exist per the plan already on record (`BonManzE_MultiEntity_ImplementationPlan.md` §2) — a delivery-role staff member would see the full Settings tab, the ability to attempt (and get rejected from) config changes, etc. Enterprise-grade RBAC UIs hide what a role can't do, not just block it after the click.

**No audit trail.** `auditLog/{id}` was designed 2026-08-12 explicitly to attribute config changes and payment/delivery status changes to a real staff member (`BonManzE_Firestore_Schema.md`, closing Backend Requirements items 3 and 4). Grep confirms zero writes to that collection anywhere in the codebase, even after all the Multi-Entity build work (entity reassignment, registration approval/rejection — exactly the kind of consequential action an audit log exists for). Right now there is no record of who approved which customer, who changed a VAT rate, or who reassigned a customer's entity.

**The Danger Zone button is very likely a broken no-op that reports false success.** This is worth flagging as a bug, not just a design gap. `handleDangerReset` calls `clearAllOrders()` and `resetCustomerLoyalty()` from `modules/store.ts` — both of those mutate the legacy mock-data arrays `ACTIVE_ORDERS`/`GLOBAL_CUSTOMERS`, which are disconnected from the real data driving the rest of the app: `Operations.tsx` populates its actual `customers` and orders state from live `onSnapshot(collection(db, 'customers'))` / `onSnapshot(collection(db, 'orders'))` listeners, not from those arrays. There's even a code comment in `Operations.tsx` (dated 2026-08-13, on `handleMarkDelivered`) documenting this exact class of bug being found and fixed once already for a different button — the Danger Zone button was apparently missed. On top of that, `BonManzE_Firestore_Schema.md` decision #4 (2026-08-12) explicitly says the Danger Zone "does not carry into the real backend" — so functionally, whether or not it's fixed to actually touch Firestore, its presence contradicts a decision already on record. Recommend it come out entirely (see §7, non-goals) rather than be repaired.

Net assessment: the *content* quality of Settings is good — consistent, real, Firestore-backed for the parts that matter. What keeps it from being "enterprise grade" is governance: no one owns who can do what (no staff/role UI, no UI-level permission enforcement) and no one can see who did what (no audit log). Those three plus the Danger Zone bug are the concrete findings this scope addresses.

## 2. Proposed fit within the existing Settings structure

Two new sub-tabs, added to the existing `settingsSubTab` union alongside `identity | delivery | tax | loyalty | groups | icons | danger`:

- **"Roles & Staff"** — gated by `manageRoles` (already defined in the v1 permission key set, currently unused in code). Two panels: a Roles list (name + permission checkboxes, add/edit/delete, matching the existing Icon Library's inline-edit-table pattern) and a Staff list (name/email/role dropdown/active toggle, matching the Customer Groups pattern for add/edit).
- **"Trading Entities"** — gated by `manageConfig` (the same key that already covers VAT, cutoffs, branding, loyalty tiers — entity legal/tax identity is the same tier of sensitive-but-infrequent action, per `BonManzE_MultiEntity_ImplementationPlan.md` §6). One panel: the two (or more, later) entity records — name/BRN/VAT/bank reference/logo — editable in place, same form style as Identity's Business Name/Logo section.

Both slot in as ordinary sub-tabs, no restructuring of the existing seven needed. Danger Zone is proposed for removal as part of this same round (§7) rather than kept alongside the new tabs.

## 3. Roles & Staff management — settled vs. open

**What's already settled** (schema exists, no new design needed): `roles/{roleId}` (`name`, `permissions: {[key]: boolean}`), `staff/{uid}` (`name`, `email`, `roleId` — live reference, not copied — `active`, `createdAt`), and the v1 permission key set (`manageMenu`, `manageOrders`, `manageCustomers`, `manageConfig`, `manageRoles`, `manageRegistrations`). The flat permission map was deliberately designed so adding a new key later needs no migration.

**Open questions** (need Bhimal's answers before build, same as the Multi-Entity plan's §12):

- **Can a role be deleted while staff are still assigned to it?** Recommend: no — block deletion (or require reassigning affected staff first) rather than leaving `staff/{uid}.roleId` pointing at nothing, which `isStaffAllowed` would need to handle gracefully (default-deny) either way.
- **Can the last remaining `manageRoles`-holder deactivate or de-permission themselves?** Worth a guard against locking everyone out of Roles & Staff entirely (mirrors the "bootstrap problem" already flagged in the schema doc for the very first Owner role/account).
- **Staff deactivation vs. deletion** — recommend deactivate-only (`active: false`) in the UI, consistent with the schema's own stated reasoning ("deactivate without deleting the account/history"); no delete action for staff docs.

## 4. Trading Entity management — settled vs. open

**What's already settled:** `entities/{entityId}` schema (`name`, `brn`, `vatNumber`, `bankReference`, `logoStoragePath` optional, `active`), staff-read/`manageConfig`-write rules, and the full denormalization design (§4/§9 of the Multi-Entity plan) meaning this UI only ever touches the `entities` collection itself — it has no interaction with the order/checkout path, which already reads its own frozen snapshot.

**Open questions:**

- **Can a third entity be added through this UI**, or is it hard-scoped to editing exactly the two that exist (`entity-a`/`entity-b`)? The v1 scope doc already anticipates more entities eventually (the three-product-line roadmap), so recommend building this as a real add/edit list, not a fixed two-record form — low extra cost now, avoids a second build later.
- **Logo upload** — Identity's existing logo field is base64-embedded with no Storage backend (per the current Identity sub-tab). `BonManzE_Firestore_Schema.md` decision #5 already says Storage joined the stack for dish photos; recommend entity logos use real Storage upload (`logoStoragePath`, matching the schema field name already chosen) rather than repeating Identity's base64 pattern — worth confirming since it's a small inconsistency to fix while building this new form rather than after.
- **Deactivating an entity** — `active: boolean` exists in the schema for exactly this ("deactivate without deleting history if an entity ever winds down"). Confirm the intended effect: should a deactivated entity simply disappear from the entity picker used in Pending Registrations approval, while still rendering correctly on historical orders that reference it? (Answer implied by the denormalization design is yes — flagging to make it explicit.)

## 5. Decisions settled 2026-08-25

Antigravity reviewed §1-§4 and agreed with the assessment and the Roles & Staff / Trading Entities fit as proposed. It also proposed answers to the open questions above; those are recorded here, including the one point where its proposal was overridden after being put to Bhimal directly (the same "propose → debate → settle" pattern the Multi-Entity plan's §12 used).

- **Danger Zone removal — final, no debate.** Both Claude and Antigravity agree it should come out entirely rather than be repaired. See §7.
- **Client-side permission gating — in scope for this round.** Antigravity's proposed shape (hide/disable tabs and actions a role can't use; a friendly "Access Denied" message if a role deep-links to something it can't use) is adopted.
- **`auditLog` writes — in scope for this round, as one unified helper.** A single `writeAuditLog(action, targetId, details)` function, called from every place a consequential staff action happens (config changes, registration approve/reject, role/staff changes, and — extending naturally to close the pre-existing gap — payment/delivery confirmation, which already had a reserved `auditLog` type with nothing writing to it). One coherent pass, not four separate ones.
- **Staff account creation/password — settled with Bhimal directly, Antigravity's proposal overridden.** Antigravity proposed a pending-record-by-email + self-registration + first-sign-in UID-linking flow. That's a materially different design than what's already on record — `BonManzE_Backend_Requirements.md`'s "~10 known people Bhimal provisions himself... no self-serve signup flow needed for staff" — and would need its own new server-side email-verification/matching logic, not just a form. Put to Bhimal directly: **confirmed the simpler path** — the admin (Bhimal, or whoever holds `manageRoles` later) sets a temporary password when creating the staff record in the new UI, same as the existing `seedBootstrap.js` bootstrap pattern, and communicates it to the new staff member out-of-band. No self-serve staff signup, no new email-verification flow.

## 6. Suggested build sequence (draft — mirrors §10 of the Multi-Entity plan)

1. Settle the open questions in §3/§4 above.
2. Add the two new `settingsSubTab` entries and their gating (`manageRoles`, `manageConfig`) to `renderSettingsTab`.
3. Build the Trading Entities sub-tab (simpler — one collection, no cross-cutting UI gating concerns) and verify against the emulator, replacing the need for `scripts/seedEntities.js` for anything beyond initial bootstrap.
4. Build the Roles sub-tab (create/edit/delete roles, permission checkboxes).
5. Build the Staff sub-tab (create/edit/deactivate staff, role assignment) — depends on step 4 existing so the role dropdown has real data.
6. Add client-side permission gating across `Operations.tsx` (hide tabs/actions a role can't use), using the roles data this feature just made manageable — confirmed in scope for this round, §5.
7. Add `auditLog` writes via the unified helper, for all four reserved types — confirmed in scope for this round, §5.
8. Remove the Danger Zone sub-tab entirely (see §7).
9. Regression test: verify a newly-created non-Owner role with a narrow permission set actually sees/can-do only what it should, both in the UI (step 6) and against `firestore.rules` (already enforced server-side regardless).

## 7. Explicit non-goals / recommendations

- **Remove the Danger Zone sub-tab**, rather than fix `handleDangerReset` to write to real Firestore data. A one-click bulk-wipe of real customer/order data was already decided against on 2026-08-12 (`BonManzE_Firestore_Schema.md` decision #4); the button's current disconnected-mock-data state means it's not doing anything today, but also isn't doing nothing safely — it reports false success ("All orders cleared") to whoever clicks it, which is arguably worse than either fixing it or removing it. Recommend removal, consistent with the existing decision.
- No self-serve staff signup — provisioning stays Bhimal-driven, consistent with Backend Requirements' existing "~10 known people" framing.
- No change to how `staff/{uid}.roleId` resolves (already a live reference, not a copy — correct as designed, see the Meal Library Mains precedent cited in the schema doc for why).
- No entity-awareness changes anywhere in checkout/pricing — out of scope, already settled by the Multi-Entity plan.
