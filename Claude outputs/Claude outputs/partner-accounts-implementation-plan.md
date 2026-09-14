# Partner Accounts Implementation Plan

This plan implements **Partner Accounts** as specified in `docs/BonManzE_PartnerAccounts_Scope.md`. Partner accounts allow external kitchen teams to access **Orders by Dish** for their assigned Trading Entities only, with strict server-side security rules enforcement in `firestore.rules` and guarded entity reassignment in Roles & Staff.

## User Review Required

> [!IMPORTANT]
> - **Security Enforcement**: Partner restrictions are enforced at the database level (`firestore.rules`) in addition to UI filtering. A partner account querying Firestore directly cannot read or update orders/items outside their `assignedEntityIds`.
> - **No New Collection**: As settled in scope, partner fields (`isPartner: boolean`, `assignedEntityIds: string[]`) live directly on `staff/{uid}`. No top-level `partners` collection or `partnerId` field is created.
> - **Guarded Entity Reassignment**: Unassigning an entity from a partner staff member is blocked if there are active or preparing items belonging to that entity.

## Proposed Changes

---

### Component 1: Type Definitions (`types.ts`)

#### [MODIFY] [types.ts](file:///C:/Users/bhimall/BonManze_pwa/types.ts)
- Add `isPartner?: boolean` and `assignedEntityIds?: string[]` to the `StaffMember` interface.

---

### Component 2: Cloud Functions (`functions/index.js`)

#### [MODIFY] [functions/index.js](file:///C:/Users/bhimall/BonManze_pwa/functions/index.js)
- Update `createStaffMember` callable function to accept optional `isPartner` (boolean) and `assignedEntityIds` (array of strings) in `request.data`. Validate and write them to the `staff/{uid}` document.
- Update `confirmCheckout` transaction to include `entityId: customer.entityId` on created order item documents in `orders/{orderId}/items`, so item documents directly carry `entityId` for security rule evaluations.

---

### Component 3: Security Rules (`firestore.rules`)

#### [MODIFY] [firestore.rules](file:///C:/Users/bhimall/BonManze_pwa/firestore.rules)
- Add helper functions `isPartnerStaff()` and `isPartnerEntityAllowed(entityId)`:
  ```cel
  function isPartnerStaff() {
    return isActiveStaff() && staffDoc().data.get('isPartner', false) == true;
  }

  function isPartnerEntityAllowed(entityId) {
    return !isPartnerStaff() || (entityId != null && entityId in staffDoc().data.get('assignedEntityIds', []));
  }
  ```
- Update `orders/{orderId}` read rule to require `isPartnerEntityAllowed(resource.data.get('entityId', null))`.
- Update `orders/{orderId}/items/{itemId}` read and status update rules to require `isPartnerEntityAllowed(resource.data.get('entityId', null))`.
- Update `staff/{uid}` update rule to allow staff management of `isPartner` and `assignedEntityIds` by authorized staff (`rolesAndStaff.edit`).

---

### Component 4: Operations Console & Staff Management UI (`modules/Operations.tsx`)

#### [MODIFY] [Operations.tsx](file:///C:/Users/bhimall/BonManze_pwa/modules/Operations.tsx)
- **Staff Provisioning Modal**:
  - Add "Partner Account" toggle checkbox.
  - When checked, render multi-select checkboxes for all active trading entities.
  - Pass `isPartner` and `assignedEntityIds` payload to `createStaffMember` callable.
- **Staff Edit Modal**:
  - Add "Partner Account" toggle and `assignedEntityIds` multi-select checkboxes.
  - **Reassignment Guard**: When saving staff edits, compare previous `assignedEntityIds` with new selection. If an entity is being removed, query active/preparing items for that entity. If any exist, block saving and display an alert notification.
- **Partner View Restricting**:
  - When signed-in staff member has `isPartner === true`, automatically restrict `Orders by Dish` data view and entity selector dropdown to `currentStaff.assignedEntityIds`.

---

### Component 5: Automated Verification Script (`scripts/testPartnerRBAC.js`)

#### [NEW] [testPartnerRBAC.js](file:///C:/Users/bhimall/BonManze_pwa/scripts/testPartnerRBAC.js)
- Automated verification script using Firebase Client & Admin SDKs against the local emulator suite:
  1. Provision a Partner staff member assigned to `entity-a`.
  2. Create test orders under `entity-a` and `entity-b`.
  3. Assert Partner staff can read and update status on `entity-a` items.
  4. Assert Partner staff direct read/update on `entity-b` orders/items is rejected by security rules (`PERMISSION_DENIED`).
  5. Assert unassigning `entity-a` while active/preparing orders exist is blocked.

---

## Verification Plan

### Automated Tests
- Run `npx tsc --noEmit` and `npm run build` to ensure type safety and clean build.
- Run `node scripts/testPartnerRBAC.js` against the running emulator suite to verify security rules and staff provisioning logic.
- Run regression suite (`testCheckoutFlow.js`, `testOrderEditCancel.js`, `testMultiEntity.js`, `testSettingsRBAC.js`).

### Manual Verification
- In Operations Settings -> Roles & Staff, create a new Partner staff account with `isPartner: true` and assign to Entity A.
- Sign in as the Partner staff account, verify only "Orders by Dish" is visible.
- Verify dish orders are filtered to Entity A only.
- Test marking a dish as "Start Cooking" (`Active` -> `Preparing`).
- In an Admin account, attempt to remove Entity A assignment while cooking is in progress; verify the action is blocked with the guard alert.
