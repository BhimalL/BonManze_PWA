// scripts/resetTestData.js
//
// Dev/test-only reset: wipes every order (and its items/invoiceAssignments
// subcollections), resets each customer back to a clean starting state
// (points/ltv/storeCredit zeroed, tier back to the lowest-threshold tier,
// lastOrder cleared), and clears the auditLogs collection — so a full
// manual QA pass can start from a genuinely clean slate with nothing left
// pointing at deleted history. Never touches roles, staff, entities,
// menu/catalog config, or the rest of a customer's profile (name/email/
// phone/group/birthday/addresses/entityId/registrationStatus).
//
// Firestore emulator only — hardcodes the emulator host, same guard
// scripts/cleanupFixtures.js and scripts/seedCustomers.js already use, so
// this can never accidentally run against a real project.
//
// Tier reset: picks whichever tier in loyaltyTiers/current has the lowest
// pointsThreshold (the same "items" array shape confirmCheckout already
// reads) and sets every customer's `tier` to that tier's id — this is the
// "start of the loyalty ladder," not a hardcoded tier name, so it stays
// correct even if the tier list is ever edited in Settings. If
// loyaltyTiers/current has no tiers at all, tier is left untouched for
// every customer and a warning is printed (nothing to reset to).
//
// HOW TO RUN:
//   1. Make sure the Firebase Emulator Suite is running (npm run emulators).
//   2. From the repo root, in a second terminal: node scripts/resetTestData.js

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

initializeApp({ projectId: 'demo-bonmanze' });
const db = getFirestore();

// Recursively deletes every document in a collection, including each
// document's subcollections — Firestore doesn't cascade-delete
// subcollections on its own, and orders/{orderId} currently has two:
// `items` (always present) and `invoiceAssignments` (new, from the
// invoice-numbering rebuild — only present on orders paid since c0be600).
async function deleteCollectionDeep(collectionRef) {
  const snap = await collectionRef.get();
  for (const doc of snap.docs) {
    const subcollections = await doc.ref.listCollections();
    for (const sub of subcollections) {
      await deleteCollectionDeep(sub);
    }
    await doc.ref.delete();
  }
  return snap.size;
}

// Flat collection, no subcollections expected — plain batched-ish delete
// (one at a time is fine at test-data volumes; matches the simple style
// scripts/cleanupFixtures.js already uses for its own deletes).
async function deleteCollectionFlat(collectionRef) {
  const snap = await collectionRef.get();
  for (const doc of snap.docs) {
    await doc.ref.delete();
  }
  return snap.size;
}

async function findBaseTierId() {
  const tiersSnap = await db.collection('loyaltyTiers').doc('current').get();
  const tiers = (tiersSnap.data() || {}).items || [];
  if (tiers.length === 0) return null;
  const lowest = tiers.reduce((min, t) =>
    (typeof t.pointsThreshold === 'number' && t.pointsThreshold < min.pointsThreshold) ? t : min
  , tiers[0]);
  return lowest.id || null;
}

async function run() {
  console.log('Deleting all orders (and items/invoiceAssignments subcollections)...');
  const orderCount = await deleteCollectionDeep(db.collection('orders'));
  console.log(`Deleted ${orderCount} order(s).`);

  console.log('Clearing auditLogs...');
  const auditCount = await deleteCollectionFlat(db.collection('auditLogs'));
  console.log(`Deleted ${auditCount} audit log entr${auditCount === 1 ? 'y' : 'ies'}.`);

  const baseTierId = await findBaseTierId();
  if (!baseTierId) {
    console.warn('loyaltyTiers/current has no tiers — customer tier will be left untouched.');
  } else {
    console.log(`Resetting customer tier to base tier: ${baseTierId}`);
  }

  console.log('Resetting customers: points/ltv/storeCredit to 0, lastOrder cleared' + (baseTierId ? ', tier reset to base' : '') + '...');
  const customersSnap = await db.collection('customers').get();
  let customerCount = 0;
  for (const doc of customersSnap.docs) {
    const update = {
      points: 0,
      ltv: 0,
      storeCredit: 0,
      lastOrder: FieldValue.delete(),
    };
    if (baseTierId) update.tier = baseTierId;
    await doc.ref.update(update);
    customerCount += 1;
  }
  console.log(`Reset ${customerCount} customer(s).`);

  console.log('Done. Orders and auditLogs cleared; customer points/ltv/storeCredit/lastOrder reset' + (baseTierId ? ' and tier reset to base' : '') + '. Group, entity assignment, and registration status were left untouched.');
  process.exit(0);
}

run().catch((e) => {
  console.error('Reset failed:', e);
  process.exit(1);
});
