# Walkthrough: Multi-Tier Trading Entity System

The Multi-Tier Trading Entity System has been fully implemented, integrated, and verified against the Firestore Emulator suite. All steps from the implementation plan have been completed.

## 1. Database Seeding & Setup
- Created `entities/entity-a` and `entities/entity-b` placeholder documents with correct active status and unset `logoStoragePath` fields.
- Backfilled all 4 seed customer documents in Firestore to `'Pending'` registration status and cleared legacy entity fields.
- Configured the live `Owner` role in Firestore with `manageRegistrations = true` permissions.

## 2. Security Rules & TypeScript Definition Updates
- Constrained the `manageRegistrations` role to only allow updates to the specific registration fields:
  ```javascript
  request.resource.data.diff(resource.data).affectedKeys().hasOnly(['entityId', 'registrationStatus', 'rejectionReason', 'updatedAt'])
  ```
- Allowed customer resubmission rules-gating, permitting transitioning `registrationStatus` from `'Rejected'` to `'Pending'` and clearing `rejectionReason` (setting it to `null`).
- Declared complete TS typings for `Entity`, `Customer`, and `Order` documents in `types.ts`.

## 3. Cloud Functions Enhancements
- Updated `registerCustomer` to default the initial registration status to `'Pending'` for all new registrations.
- Configured `confirmCheckout` to assert that the customer's account is `'Approved'` and has an assigned `entityId`. Denormalized the entity legal name, BRN, VAT number, and bank reference snapshot directly onto the resulting `Order` document.

## 4. UI Adaptations (Operator Console & Customer App)
- **Operator Console**: Added a new **Pending Registrations** tab displaying customer registration details, an entity radio selector, and Approve/Reject controls. Integrated entity filters throughout Delivery List, Payments, Orders by Dish, and Customers tabs.
- **Customer App**: Added "Awaiting Approval" and "Rejection Resubmission" status views. Updated printable receipts to render from frozen order snapshots instead of live entity lookups.

## 5. Verification Results
All three automated regression test suites have been verified clean against the live, freshly-restarted emulator:
1. `testCheckoutFlow.js` validates that:
   - Checkouts fail for unapproved customers (returned error code matches expectation).
   - Checkouts succeed for approved customers.
   - The generated order carries frozen legal entity names, BRN, VRN, and bank reference snapshot values.
   - All standard/birthday/bulk discounts calculate correctly.
2. `testOrderEditCancel.js` validates that item status transitions (cancelled/refunded) and note details continue to edit/reconstruct correctly.
3. `testMultiEntity.js` (new) validates:
   - **Resubmission Flow**: A customer document updated via Client SDK with `registrationStatus: 'Pending'` and `rejectionReason: null` succeeds under our updated `firestore.rules`.
   - **Order Assignment Stability**: When a customer's entity is reassigned to another entity, pre-existing orders remain frozen at their original snapshot values.

## 6. UI Walkthrough Fixes
The following visual and functional fixes have been implemented after the manual walkthrough:
- **Rejection Modal Fixes**: Wrapped the Reject Customer dialog inside `<Portal>` with full-screen `bg-slate-900/70 backdrop-blur-md z-[9999]` styling (preventing clipping outside the main content wrapper) and replaced `bg-error` with `bg-red-600` so the button text is visible.
- **Resubmission Profile Details**: Expanded the resubmit form in `CustomerPortal.tsx` to allow editing `First Name`, `Last Name`, and `Email Address` in addition to `Phone Number` and `Addresses` (resolving cases where users need to correct typoed contact details).
- **Assigned Trading Entity CRM Selector**: Removed the inline edit selector dropdown from the Customer Directory table cell and added it as a clean select dropdown in the main **Edit Customer CRM** details modal.
