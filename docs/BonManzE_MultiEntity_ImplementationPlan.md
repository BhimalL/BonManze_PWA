# Implementation Plan — Multi-Tier Trading Entity System

We are starting the build phase for the Multi-Tier Trading Entity System. This plan follows the build sequence specified in §10 of [BonManzE_MultiEntity_ImplementationPlan.md](file:///c:/Users/bhimall/OneDrive%20-%20ABC%20Group%20of%20Companies/Desktop/Bhimal%20Lakha/AntiGravity/BonManze_pwa/BonManzE_MultiEntity_ImplementationPlan.md).

## Proposed Changes and Build Sequence

We will execute the following steps in order, committing and pushing after each step:

### 1. Seed Placeholder Entities Documents, Update Owner Permissions & Backfill Seed Customers
- **Goal**: 
  - Seed the `entities` collection with the Entity A and Entity B placeholder documents using `scripts/seedEntities.js`.
  - Update `ALL_PERMISSIONS` in `scripts/seedBootstrap.js` to include `manageRegistrations: true`.
  - Patch the live `Owner` role document in Firestore to have `permissions.manageRegistrations = true`.
  - Backfill all existing customers in the Firestore emulator (including Marcus, Eleanor, Sarah, and Neji) with `registrationStatus: 'Pending'` and no `entityId` so they can be run through the manual approval flow and display in the new Operations tab.
- **Files**:
  - [NEW] [`scripts/seedEntities.js`](file:///c:/Users/bhimall/OneDrive%20-%20ABC%20Group%20of%20Companies/Desktop/Bhimal%20Lakha/AntiGravity/BonManze_pwa/scripts/seedEntities.js)
  - [MODIFY] [`scripts/seedBootstrap.js`](file:///c:/Users/bhimall/OneDrive%20-%20ABC%20Group%20of%20Companies/Desktop/Bhimal%20Lakha/AntiGravity/BonManze_pwa/scripts/seedBootstrap.js)

### 2. Update Firestore Security Rules and TypeScript Types
- **Goal**: Update `firestore.rules` and `types.ts` to support the new schema, entity restrictions, and the new `manageRegistrations` permission key.
- **Files**:
  - [MODIFY] [`firestore.rules`](file:///c:/Users/bhimall/OneDrive%20-%20ABC%20Group%20of%20Companies/Desktop/Bhimal%20Lakha/AntiGravity/BonManze_pwa/firestore.rules)
  - [MODIFY] [`types.ts`](file:///c:/Users/bhimall/OneDrive%20-%20ABC%20Group%20of%20Companies/Desktop/Bhimal%20Lakha/AntiGravity/BonManze_pwa/types.ts)

### 3. Update `registerCustomer` Cloud Function
- **Goal**: Initialize `registrationStatus` as `'Pending'` for new signups.
- **Files**:
  - [MODIFY] [`functions/index.js`](file:///c:/Users/bhimall/OneDrive%20-%20ABC%20Group%20of%20Companies/Desktop/Bhimal%20Lakha/AntiGravity/BonManze_pwa/functions/index.js)

### 4. Update `confirmCheckout` Cloud Function
- **Goal**: Add checking that `registrationStatus === 'Approved'` and freeze/denormalize entity fields onto the order.
- **Files**:
  - [MODIFY] [`functions/index.js`](file:///c:/Users/bhimall/OneDrive%20-%20ABC%20Group%20of%20Companies/Desktop/Bhimal%20Lakha/AntiGravity/BonManze_pwa/functions/index.js)

### 5. Operator Console (Operations UI) Changes
- **Goal**: Implement the "Pending Registrations" tab (with live count badge), entity filters on existing tabs, and the inline entity reassignment on Customer Directory.
- **Files**:
  - [MODIFY] [`modules/Operations.tsx`](file:///c:/Users/bhimall/OneDrive%20-%20ABC%20Group%20of%20Companies/Desktop/Bhimal%20Lakha/AntiGravity/BonManze_pwa/modules/Operations.tsx)

### 6. Customer App UI Changes
- **Goal**: Show "Awaiting Confirmation" screen for pending customers and rejection reason + edit/resubmit UI for rejected customers.
- **Files**:
  - [MODIFY] [`modules/CustomerPortal.tsx`](file:///c:/Users/bhimall/OneDrive%20-%20ABC%20Group%20of%20Companies/Desktop/Bhimal%20Lakha/AntiGravity/BonManze_pwa/modules/CustomerPortal.tsx)

### 7. Invoice & Receipt Rendering
- **Goal**: Read the denormalized entity fields off the order document for rendering instead of loading from the `entities` collection live.
- **Files**:
  - [MODIFY] [`modules/CustomerPortal.tsx`](file:///c:/Users/bhimall/OneDrive%20-%20ABC%20Group%20of%20Companies/Desktop/Bhimal%20Lakha/AntiGravity/BonManze_pwa/modules/CustomerPortal.tsx)
  - [MODIFY] [`modules/Operations.tsx`](file:///c:/Users/bhimall/OneDrive%20-%20ABC%20Group%20of%20Companies/Desktop/Bhimal%20Lakha/AntiGravity/BonManze_pwa/modules/Operations.tsx)

### 8. Regression-testing
- **Goal**: Write/update regression tests to verify that checkout is blocked for pending/rejected customers, that approved signups can order, that the entity snapshot is correctly denormalized, and that reassignment doesn't retroactively modify existing orders.
- **Files**:
  - [NEW/MODIFY] [`scripts/testMultiEntity.js`](file:///c:/Users/bhimall/OneDrive%20-%20ABC%20Group%20of%20Companies/Desktop/Bhimal%20Lakha/AntiGravity/BonManze_pwa/scripts/testMultiEntity.js)

## Verification Plan

We will run the automated tests against a local Firebase Emulator suite instance.
- Run `npm run dev` to verify TypeScript compilation and build.
- Run `npx tsc --noEmit` to verify type safety.
- Run `node scripts/testMultiEntity.js` to execute automated integration tests.
