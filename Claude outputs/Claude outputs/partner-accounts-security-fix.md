# Partner Accounts — firestore.rules / confirmCheckout diff (author: Claude, verbatim)

**Status:** Reviewed Antigravity's `partner-accounts-implementation-plan.md` against the actual, current
`firestore.rules` and `functions/index.js` (not the plan's summary of them). The plan's overall shape is
approved — `isPartner`/`assignedEntityIds` on `staff/{uid}`, no new collection, `isPartnerStaff()` /
`isPartnerEntityAllowed()` helpers built on the real `isActiveStaff()`/`staffDoc()` — but per the Working
Agreement, the `firestore.rules` and `confirmCheckout` changes are write-path/security-critical, so I'm
authoring them verbatim here rather than letting them be self-authored and verified after the fact. Antigravity
should apply these three changes **exactly as given**, then build everything else in its plan (types.ts, Roles &
Staff UI, testPartnerRBAC.js) around them.

This fixes two gaps the plan's prose left open and pins down one ambiguity that would otherwise make the "hard
lock" a no-op in practice:

1. The plan never made the new `entityId` field on items immutable on update — without that, a party with
   `ordersByDish` edit could rewrite an item's `entityId` on an ordinary status-edit write and grant themselves
   access to a different entity's data on the next read. Fixed below by adding `entityId` to the same
   "must not change" field list that already protects `price`/`qty`/`name`/`customerId`.
2. The plan's reassignment guard needs to query items by `entityId + status`, a compound query with no index
   in `firestore.indexes.json` today. Added below.
3. The plan said to "require `isPartnerEntityAllowed(...)`" on the read/update rules without specifying HOW.
   It must wrap the **entire existing OR-chain** in parens (`isPartnerEntityAllowed(...) && ( ...existing... )`),
   never get added as one more `||` branch and never attached to only one clause — otherwise a Partner's
   `ordersByDish` permission alone would already satisfy the rule regardless of entity, and the lock would do
   nothing. Spelled out exactly below so there's no room to implement it differently.

No change is needed to the `staff/{uid}` update rule — it already permits any field update once
`isStaffAllowed('rolesAndStaff', 'edit')` is true, with no per-field allow-list, so `isPartner`/
`assignedEntityIds` are already writable under it. Antigravity's plan listed this as a change; it isn't one —
leave that block untouched.

---

## 1. `functions/index.js` — `confirmCheckout`

Find this block (item write, inside the `db.runTransaction` callback):

```js
    priced.forEach((p) => {
      const { _weekStart, _service, _weekdayKey, ...itemFields } = p;
      const itemRef = orderRef.collection('items').doc();
      tx.set(itemRef, {
        ...itemFields,
        customerId: uid,
        customerName: customer.name || '',
      });
    });
```

Replace with:

```js
    priced.forEach((p) => {
      const { _weekStart, _service, _weekdayKey, ...itemFields } = p;
      const itemRef = orderRef.collection('items').doc();
      tx.set(itemRef, {
        ...itemFields,
        customerId: uid,
        customerName: customer.name || '',
        // Denormalized from the parent order (same pattern as customerId
        // above) so Partner-account security rules can evaluate an item's
        // entity without a get() on its parent — see firestore.rules'
        // isPartnerEntityAllowed().
        entityId: customer.entityId,
      });
    });
```

One line added (`entityId: customer.entityId,`), nothing else touched. `customer.entityId` is already resolved
and validated earlier in this same function (it's what gets frozen onto the order itself at line ~534), so
this is reusing a value already in scope, not a new lookup.

---

## 2. `firestore.rules`

### 2a. New helper functions

Find this block (end of the shared-helpers section):

```
    // Resolves the signed-in staff member's role live (never trust a copy —
    // see the schema doc's note on why roleId stays a pointer, not a
    // denormalized permission snapshot) and checks a granular permission.
    function isStaffAllowed(groupName, permissionType) {
      return isActiveStaff()
        && exists(/databases/$(database)/documents/roles/$(staffDoc().data.roleId))
        && 'permissions' in get(/databases/$(database)/documents/roles/$(staffDoc().data.roleId)).data
        && groupName in get(/databases/$(database)/documents/roles/$(staffDoc().data.roleId)).data.permissions
        && permissionType in get(/databases/$(database)/documents/roles/$(staffDoc().data.roleId)).data.permissions[groupName]
        && get(/databases/$(database)/documents/roles/$(staffDoc().data.roleId)).data.permissions[groupName][permissionType] == true;
    }
```

Add immediately after it (still inside the shared-helpers section, before `// ---- customers/{uid} ----`):

```

    // Partner accounts (BonManzE_PartnerAccounts_Scope.md): unlike the
    // Entity-Restricted Views filter, this IS a security boundary — Partner
    // staff are external/less-trusted and must be hard-locked out of any
    // entity they aren't assigned to, enforced here, not just filtered
    // client-side in Operations.tsx.
    function isPartnerStaff() {
      return isActiveStaff() && staffDoc().data.get('isPartner', false) == true;
    }

    // true for: any non-Partner request (no-op — everyone else is
    // unaffected), OR a Partner request whose entityId is in their
    // assignedEntityIds. false for a Partner request against any other
    // entity, or against a document with no entityId at all.
    function isPartnerEntityAllowed(entityId) {
      return !isPartnerStaff() || (entityId != null && entityId in staffDoc().data.get('assignedEntityIds', []));
    }
```

### 2b. `orders/{orderId}` — read rule

Find:

```
    match /orders/{orderId} {
      allow read: if isCustomer(resource.data.customerId)
        || isStaffAllowed('ordersByDish', 'view')
        || isStaffAllowed('deliveryList', 'view')
        || isStaffAllowed('payments', 'view');
      allow create: if false; // Cloud Function only — see confirmCheckout
      allow update, delete: if false;
    }
```

Replace with:

```
    match /orders/{orderId} {
      allow read: if isPartnerEntityAllowed(resource.data.get('entityId', null))
        && (isCustomer(resource.data.customerId)
          || isStaffAllowed('ordersByDish', 'view')
          || isStaffAllowed('deliveryList', 'view')
          || isStaffAllowed('payments', 'view'));
      allow create: if false; // Cloud Function only — see confirmCheckout
      allow update, delete: if false;
    }
```

Note the parens: `isPartnerEntityAllowed(...)` ANDs onto the **whole** existing OR-chain, not onto one branch
of it. `orders/{orderId}` already carries `entityId` today (frozen at checkout, per
`BonManzE_MultiEntity_ImplementationPlan.md`), so `resource.data.get('entityId', null)` will already resolve to
a real value for every order — no backfill needed for this one.

### 2c. `items/{itemId}` — read rule

Find (top of the items match block):

```
    match /{path=**}/items/{itemId} {
      allow read: if isCustomer(resource.data.customerId)
        || isStaffAllowed('ordersByDish', 'view')
        || isStaffAllowed('deliveryList', 'view')
        || isStaffAllowed('payments', 'view');
      allow create: if false; // Cloud Function only — see confirmCheckout
```

Replace with:

```
    match /{path=**}/items/{itemId} {
      allow read: if isPartnerEntityAllowed(resource.data.get('entityId', null))
        && (isCustomer(resource.data.customerId)
          || isStaffAllowed('ordersByDish', 'view')
          || isStaffAllowed('deliveryList', 'view')
          || isStaffAllowed('payments', 'view'));
      allow create: if false; // Cloud Function only — see confirmCheckout
```

Items do **not** carry `entityId` today — only new items written after the confirmCheckout change (§1) will
have it. Legacy items with no `entityId` will read `null` here, which makes `isPartnerEntityAllowed` false for
a Partner (correctly denied — a Partner should never see pre-migration data anyway) and true for everyone else
(the `!isPartnerStaff()` no-op branch), so this is safe for existing data with no backfill required.

### 2d. `items/{itemId}` — update rule

Find the full existing `allow update: if (...)` rule (the two-branch staff/customer expression). Two changes
inside it, both additive:

**(i)** In the *staff update* branch, add `entityId` to the "must not change" list, alongside the existing
`price`/`qty`/`name`/`customerId` checks:

Find:

```
      && request.resource.data.price == resource.data.price
      && request.resource.data.qty == resource.data.qty
      && request.resource.data.name == resource.data.name
      && request.resource.data.customerId == resource.data.customerId
    ) || (
      // 2. Customer update (pay claim)
```

Replace with:

```
      && request.resource.data.price == resource.data.price
      && request.resource.data.qty == resource.data.qty
      && request.resource.data.name == resource.data.name
      && request.resource.data.customerId == resource.data.customerId
      && request.resource.data.get('entityId', null) == resource.data.get('entityId', null)
    ) || (
      // 2. Customer update (pay claim)
```

**(ii)** In the *customer update (pay claim)* branch, add the same `entityId` immutability check for symmetry
(closes the same class of gap even though there's no known exploit path through this branch today):

Find:

```
      && request.resource.data.customerId == resource.data.customerId
      && request.resource.data.deliveryDate == resource.data.deliveryDate
      && request.resource.data.serviceSlot == resource.data.serviceSlot
```

Replace with:

```
      && request.resource.data.customerId == resource.data.customerId
      && request.resource.data.get('entityId', null) == resource.data.get('entityId', null)
      && request.resource.data.deliveryDate == resource.data.deliveryDate
      && request.resource.data.serviceSlot == resource.data.serviceSlot
```

**(iii)** Wrap the whole `allow update: if (...)` expression with the Partner entity check, same pattern as the
read rules. Find the very start and end of the rule:

Find:

```
  allow update: if (
      // 1. Staff update
```

Replace with:

```
  allow update: if isPartnerEntityAllowed(resource.data.get('entityId', null)) && (
      // 1. Staff update
```

(The rule's closing `;` at the end of the existing two-branch `(...) || (...)` expression needs no change —
the added `isPartnerEntityAllowed(...) &&` just wraps one more pair of parens around what's already there.)

---

## 3. `firestore.indexes.json`

Find:

```json
    {
      "collectionGroup": "items",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "customerId", "order": "ASCENDING" },
        { "fieldPath": "deliveryDate", "order": "DESCENDING" }
      ]
    },
```

Add a new entry right after it (before the `paymentStatus`/`deliveryDate` one), for the reassignment guard's
`entityId == X AND status in [...]` query:

```json
    {
      "collectionGroup": "items",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "entityId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
```

---

## 4. After applying

- `npx tsc --noEmit` and `npm run build` — unaffected by these three files, but run anyway as always.
- `node scripts/testPartnerRBAC.js` (per the plan's Component 5) is the real test of §2 — it should now be able
  to assert both the positive case (Partner reads/edits their assigned entity's items) and the negative case
  (PERMISSION_DENIED on another entity's orders/items, including a direct attempt to change `entityId` on an
  update, which should also now fail).
- Full regression suite (`testCheckoutFlow.js`, `testOrderEditCancel.js`, `testMultiEntity.js`,
  `testSettingsRBAC.js`) — `confirmCheckout`'s output gained one new field on items; nothing existing reads or
  asserts against its absence, so these should stay green, but they're the fastest way to confirm that.
- One thing no automated test will catch: restart the emulator cleanly (single Ctrl+C, wait for "Export
  complete") before testing, per the emulator-stability note in `CHANGELOG.md`'s 2026-09-12 entry — a
  zombie/dead emulator instance was the root cause of a full day's worth of false negatives earlier this week.
