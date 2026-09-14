# Spec: Payment Methods become a real, Firestore-backed managed collection

**Working Agreement: mixed.** §1 (`types.ts` permission key) and §2 (`store.ts` data layer + seeding) are SLOW PATH — author exactly, this is the write-path/schema change. §3 (`firestore.rules`) is SLOW PATH — author exactly. §4/§5 (Settings UI tab, Roles & Staff wiring, retiring `MEAL_PLAN_PAYMENT_METHOD_NAMES` in the two filter call-sites) are fast-path — build to match the existing Loyalty Tiers pattern exactly (same list/add/edit-modal shape, same permission-gating pattern), field names and behavior below are not negotiable even though the JSX itself is.

**Reference:** `BonManzE_InvoicingPaymentMethods_Scope.md` §3, §7 step 3.

---

## 1. `types.ts` — new permission key

`RolePermissions` gains one key, inserted after `tradingEntities` (alphabetical/grouping doesn't matter, this file has no fixed order):
```ts
export interface RolePermissions {
  menuPlanner: PermissionPair;
  mealLibrary: PermissionPair;
  ordersByDish: PermissionPair;
  deliveryList: PermissionPair;
  payments: PermissionPair;
  customerDirectory: PermissionPair;
  pendingRegistrations: PermissionPair;
  transactionsLedger: { view: boolean };
  generalConfig: PermissionPair;
  loyaltyTiers: PermissionPair;
  customerGroups: PermissionPair;
  iconLibrary: PermissionPair;
  rolesAndStaff: PermissionPair;
  tradingEntities: PermissionPair;
  paymentMethods: PermissionPair;
}
```
`PaymentMethod` itself (also in `types.ts`) is unchanged — its shape (`id`/`name`/`icon`/`isActive`/`type`/`applicableTo`) is already correct; only where it lives is changing.

---

## 2. `store.ts` — make `PAYMENT_METHODS` Firestore-backed, mirroring `LOYALTY_TIERS` exactly

Today `PAYMENT_METHODS` (line ~182) is a plain in-memory array with no Firestore doc behind it at all — `subscribeToPaymentMethods`/`updatePaymentMethods` (lines ~1882, ~1932) are real listener plumbing, but nothing keeps them in sync with Firestore, and `updatePaymentMethods` never persists anything remotely (only to `localStorage` via the existing `persistAll()` mechanism, same as every other legacy in-memory store). `loyaltyTiers` solved this exact problem already — mirror it field-for-field.

**2a. `updatePaymentMethods` becomes async and writes through:**
```ts
export const updatePaymentMethods = async (methods: PaymentMethod[]) => {
  PAYMENT_METHODS = [...methods];
  paymentMethodListeners.forEach(l => l([...PAYMENT_METHODS]));
  await setDoc(doc(db, 'paymentMethods', 'current'), { items: dropUndefined(PAYMENT_METHODS), updatedAt: serverTimestamp() });
};
```
(Every existing call site of `updatePaymentMethods` — there are none today per the project doc's own finding, "no button anywhere calls `updatePaymentMethods`" — so this signature change has no other call sites to update yet; the new Settings tab in §4 is the first caller, and must `await` it / handle its rejection the same way the Loyalty Tiers panel's save handler already does for `updateLoyaltyTiers`.)

**2b. New top-level `onSnapshot`, added right next to the existing `loyaltyTiers` one (~line 2010), seeding the doc once from today's hardcoded array if it doesn't exist yet — so this doesn't silently depend on a human opening the new Settings tab and clicking Save before real payment data starts flowing:**
```ts
onSnapshot(doc(db, 'paymentMethods', 'current'), snap => {
  if (!snap.exists()) {
    // First run in this environment — seed from today's hardcoded six-entry
    // default so nothing currently offered at checkout disappears on
    // cutover. One-time; every subsequent load finds the doc and skips this.
    setDoc(doc(db, 'paymentMethods', 'current'), { items: dropUndefined(PAYMENT_METHODS), updatedAt: serverTimestamp() })
      .catch(e => console.error('Failed to seed paymentMethods/current', e));
    return;
  }
  PAYMENT_METHODS = (snap.data().items || []) as PaymentMethod[];
  paymentMethodListeners.forEach(l => l([...PAYMENT_METHODS]));
});
```
Place this near the existing `onSnapshot(doc(db, 'loyaltyTiers', 'current'), ...)` block (~line 2010) so the two Firestore-backed catalogs stay visibly grouped in the file, matching how `customerGroups` presumably sits next to it too.

**2c. `subscribeToPaymentMethods` itself needs no change** — it's already just local pub/sub over whatever `PAYMENT_METHODS` currently holds; 2b is what makes that array real now instead of static.

**2d. `PersistedState`/`persistAll`/hydrate-on-load** — no change needed. `PAYMENT_METHODS` staying in that interface and in the hydrate/persist lists is correct and intentional: it's the same "local cache, Firestore is the real source of truth once `onSnapshot` fires" pattern `LOYALTY_TIERS` already uses (confirmed directly — `LOYALTY_TIERS` is *also* still in `PersistedState` today, sitting right alongside `PAYMENT_METHODS`). Do not remove `PAYMENT_METHODS` from `PersistedState` as part of this change.

**2e. `MEAL_PLAN_PAYMENT_METHOD_NAMES` is retired** (the constant itself, and both its call sites — see §5). Delete the constant and its comment block (~lines 191-196) once both call sites no longer reference it. Do not delete it first and leave the call sites broken mid-commit — same file, one commit, both changes together.

---

## 3. `firestore.rules` — new collection

Add after the existing `entities/{entityId}` match block (~line 214), before the `orders`/`items` section:
```
    match /paymentMethods/{docId} {
      allow read: if true; // customers need this to render the Pay sheet, same reasoning as config/loyaltyTiers
      allow write: if isStaffAllowed('paymentMethods', 'edit');
    }
```

---

## 4. Settings — new "Payment Methods" sub-tab (fast-path, mirror Loyalty Tiers exactly)

**4a. Manifest additions** in `Operations.tsx` (both are simple single-entry array additions, ~line 312 and ~line 325):
```ts
const SETTINGS_SUB_TABS = [
  ...
  { key: 'paymentMethods'  as const, permGroup: 'paymentMethods'   },
];
```
```ts
const PERM_GROUPS = [
  ...
  { key: 'paymentMethods'       as const, label: 'Payment Methods',      hasEdit: true  },
];
```
And the sub-tab label map (~line 4354, alongside `tradingEntities: 'Trading Entities',`):
```ts
paymentMethods: 'Payment Methods',
```

**4b. Panel body** — a new `settingsSubTab === 'paymentMethods'` branch, built the same shape as the existing Loyalty Tiers panel (list of current methods with add/edit, backed by a modal form): name, icon (reuse the existing `IconPicker.tsx` component the same way Loyalty Tiers/Meal Library already do, if it does), type (`'Cash' | 'Card' | 'Digital' | 'Voucher'` — a simple select), applicable order types (a multi-select or checkbox group over `'Dine-In' | 'Takeout' | 'Delivery' | 'Meal Plan'`), and active/retired (a toggle, not a delete button — see §3 of the project doc for why: a retired method must keep displaying correctly wherever it's already recorded, so there is deliberately no delete action anywhere in this panel).

Save handler calls `await updatePaymentMethods(nextArray)` (the whole array, add/edit/retire all go through the same call — matching how `updateLoyaltyTiers` works, not a per-item Firestore write).

**4c. Roles & Staff wiring** — `paymentMethods` now appears automatically in the permission table via `PERM_GROUPS` (4a); no separate work needed beyond that array entry, since the role editor already iterates `PERM_GROUPS` generically (confirmed by its use for `tradingEntities`, the most recently added group, requiring no bespoke UI of its own).

---

## 5. Retiring `MEAL_PLAN_PAYMENT_METHOD_NAMES` — both call sites

**5a. `Operations.tsx` (~line 6947)**, the Payments-tab confirm dropdown:
```tsx
// before
{paymentMethods.filter(m => m.isActive && MEAL_PLAN_PAYMENT_METHOD_NAMES.includes(m.name)).map(m => {
// after
{paymentMethods.filter(m => m.isActive && m.applicableTo.includes('Meal Plan')).map(m => {
```

**5b. `CustomerPortal.tsx`'s `applicablePaymentMethods`** (~line 1502-1503):
```tsx
// before
const applicablePaymentMethods = useMemo(
  () => paymentMethods.filter(m => m.isActive && MEAL_PLAN_PAYMENT_METHOD_NAMES.includes(m.name)),
// after
const applicablePaymentMethods = useMemo(
  () => paymentMethods.filter(m => m.isActive && m.applicableTo.includes('Meal Plan')),
```
(Keep whatever the useMemo's dependency array and closing already are — only the filter predicate inside changes.)

Both call sites currently filter for the Meal Plan side of the business specifically (per the existing comment at the constant's definition) — `applicableTo.includes('Meal Plan')` is the direct field-driven equivalent of what the name-list was standing in for, nothing else about either call site's behavior changes. Remove the now-unused `MEAL_PLAN_PAYMENT_METHOD_NAMES` import from both files' import blocks once neither references it.

---

## 6. What this spec deliberately does not do

- Does not add `acceptedPaymentMethodIds`/`paymentMethodConfig` filtering by entity — that's `per-entity-payment-config.md`, layered on top of this one (that spec assumes this one has already shipped: a real `paymentMethods` collection to filter, not the old hardcoded array).
- Does not change the six seeded methods' data (names/icons/types) — cutover is a pure lift-and-shift of today's hardcoded array into Firestore, not a content edit.
- Does not add a "delete" action anywhere — retire (`isActive: false`) only, per the project doc's non-goals.
