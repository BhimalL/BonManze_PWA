// scripts/verifyDiscountShare.js
//
// Read-only verification helper: dumps the most recent order(s) and their
// `items` subcollection docs, specifically the `discountShare` field written
// by confirmCheckout, so we can confirm the per-item birthday/standard/bulk
// attribution fix actually persisted on a real (non-draft) order — not an
// estimate, the raw Firestore data. Makes NO writes.
//
// Firestore emulator only — same hardcoded-host guard as
// scripts/resetTestData.js, so this can never accidentally run against a
// real project.
//
// HOW TO RUN:
//   1. Make sure the Firebase Emulator Suite is running (npm run emulators).
//   2. From the repo root, in a second terminal: node scripts/verifyDiscountShare.js

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ projectId: 'demo-bonmanze' });
const db = getFirestore();

async function run() {
  const ordersSnap = await db.collection('orders').orderBy('createdAt', 'desc').limit(10).get();

  if (ordersSnap.empty) {
    console.log('No orders found.');
    process.exit(0);
  }

  for (const orderDoc of ordersSnap.docs) {
    const order = orderDoc.data();
    console.log('='.repeat(70));
    console.log(`Order ${orderDoc.id}  |  customer: ${order.customerName}  |  entity: ${order.entityName || '(none)'}`);
    console.log(`  subtotal=${order.subtotal}  discount=${order.discount}  vat=${order.vat}  total=${order.total}`);
    if (order.discountBreakdown) {
      console.log(`  discountBreakdown: standard=${order.discountBreakdown.standard} (${order.discountBreakdown.standardRate}%)  birthday=${order.discountBreakdown.birthday} (${order.discountBreakdown.birthdayRate}%)  bulk=${order.discountBreakdown.bulk} (${order.discountBreakdown.bulkRate}%)`);
    } else {
      console.log('  discountBreakdown: (none)');
    }

    const itemsSnap = await orderDoc.ref.collection('items').get();
    itemsSnap.docs.forEach((itemDoc) => {
      const item = itemDoc.data();
      const share = item.discountShare;
      console.log(`    - ${item.name}  price=${item.price}  deliveryDate=${item.deliveryDate}  discountShare=${share ? JSON.stringify(share) : 'MISSING'}`);
    });
  }

  process.exit(0);
}

run().catch((e) => {
  console.error('Verification failed:', e);
  process.exit(1);
});
