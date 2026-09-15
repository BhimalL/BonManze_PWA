// scripts/checkInvoiceNumbering.js
//
// Read-only diagnostic: dumps every entity's invoicePrefix/invoiceNumberCounter,
// plus every Paid item's entityId/invoiceNumber/invoiceIssuedAt, so we can see
// directly whether an entity's Invoice Prefix is actually saved in Firestore
// (not just what the Settings form showed) and whether issueInvoiceOnPayment
// actually minted a number for each paid item. Makes NO writes.
//
// Firestore emulator only — same hardcoded-host guard as the project's other
// scripts/*.js diagnostic/reset scripts.
//
// HOW TO RUN:
//   1. Make sure the Firebase Emulator Suite is running (npm run emulators).
//   2. From the repo root, in a second terminal: node scripts/checkInvoiceNumbering.js

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ projectId: 'demo-bonmanze' });
const db = getFirestore();

async function run() {
  console.log('='.repeat(70));
  console.log('ENTITIES');
  console.log('='.repeat(70));
  const entitiesSnap = await db.collection('entities').get();
  entitiesSnap.docs.forEach((d) => {
    const e = d.data();
    console.log(`  ${d.id}  name=${JSON.stringify(e.name)}  invoicePrefix=${JSON.stringify(e.invoicePrefix)}  invoiceNumberCounter=${e.invoiceNumberCounter}`);
  });

  console.log();
  console.log('='.repeat(70));
  console.log('PAID ITEMS (across all orders)');
  console.log('='.repeat(70));
  const ordersSnap = await db.collection('orders').orderBy('createdAt', 'desc').limit(20).get();
  for (const orderDoc of ordersSnap.docs) {
    const order = orderDoc.data();
    const itemsSnap = await orderDoc.ref.collection('items').get();
    for (const itemDoc of itemsSnap.docs) {
      const item = itemDoc.data();
      if (item.paymentStatus !== 'Paid') continue;
      console.log(`  order=${orderDoc.id}  item=${itemDoc.id}  customer=${order.customerName}  entityId=${item.entityId}  entityName=${order.entityName}`);
      console.log(`    paymentStatus=${item.paymentStatus}  paymentMethodName=${item.paymentMethodName}  paymentReference=${item.paymentReference}`);
      console.log(`    invoiceNumber=${JSON.stringify(item.invoiceNumber)}  invoiceIssuedAt=${item.invoiceIssuedAt ? 'set' : 'MISSING'}  invoiceReprintCount=${item.invoiceReprintCount}`);
    }
  }

  process.exit(0);
}

run().catch((e) => {
  console.error('Check failed:', e);
  process.exit(1);
});
