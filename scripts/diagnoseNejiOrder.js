// scripts/diagnoseNejiOrder.js
//
// ONE-SHOT READ-ONLY DIAGNOSTIC — no writes, safe to run any time.
// Purpose: answer two open questions about a specific customer's order/receipt
// by reading the actual data directly, instead of guessing:
//   1. Does this customer have a `birthday` on file that falls on the same
//      month/day as the delivery date shown on her receipt, and does her
//      loyalty tier actually carry a nonzero birthday-discount rate?
//   2. Do her orders predate today's `discountBreakdown`/`round2` fix
//      (i.e. no stored `discountBreakdown` field, and/or a `createdAt`
//      timestamp before today)?
//
// Run against the LOCAL EMULATOR (must already be running — e.g. via
// `node scripts/runEmulators.cjs` or `firebase emulators:start`):
//   node scripts/diagnoseNejiOrder.js
//
// Prints everything relevant as JSON so nothing is silently summarized away.

import { initializeApp as adminInitializeApp } from 'firebase-admin/app';
import { getFirestore as adminGetFirestore } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
adminInitializeApp({ projectId: 'demo-bonmanze' }); // matches scripts/checkIndexes.js
const db = adminGetFirestore();

function tsToIso(v) {
  if (!v) return v;
  if (typeof v.toDate === 'function') return v.toDate().toISOString();
  return v;
}

async function main() {
  console.log('--- 1. Searching customers collection for a name matching "neji" ---');
  const customersSnap = await db.collection('customers').get();
  const matches = [];
  customersSnap.forEach((doc) => {
    const d = doc.data();
    const haystack = `${d.firstName || ''} ${d.lastName || ''} ${d.name || ''}`.toLowerCase();
    if (haystack.includes('neji')) {
      matches.push({ uid: doc.id, ...d });
    }
  });

  if (matches.length === 0) {
    console.log('NO CUSTOMER FOUND matching "neji". Total customers in this emulator data:', customersSnap.size);
    console.log('All customer names present:', customersSnap.docs.map(d => `${d.data().firstName || ''} ${d.data().lastName || ''} ${d.data().name || ''}`.trim()));
    process.exit(0);
  }

  for (const c of matches) {
    console.log('\n=== CUSTOMER MATCH ===');
    console.log(JSON.stringify({ ...c, createdAt: tsToIso(c.createdAt), updatedAt: tsToIso(c.updatedAt) }, null, 2));

    console.log('\n--- 2. Full loyaltyTiers collection (to find her tier\'s birthday-discount rate) ---');
    const tiersSnap = await db.collection('loyaltyTiers').get();
    tiersSnap.forEach((doc) => {
      console.log(`loyaltyTiers/${doc.id}:`, JSON.stringify(doc.data(), null, 2));
    });

    console.log(`\n--- 3. All orders where customerId == ${c.uid} ---`);
    const ordersSnap = await db.collection('orders').where('customerId', '==', c.uid).get();
    if (ordersSnap.empty) {
      console.log('No orders found for this customerId.');
    }
    for (const orderDoc of ordersSnap.docs) {
      const o = orderDoc.data();
      console.log(`\norders/${orderDoc.id}:`);
      console.log(JSON.stringify({
        ...o,
        createdAt: tsToIso(o.createdAt),
        updatedAt: tsToIso(o.updatedAt),
        hasDiscountBreakdown: Object.prototype.hasOwnProperty.call(o, 'discountBreakdown'),
      }, null, 2));

      const itemsSnap = await db.collection('orders').doc(orderDoc.id).collection('items').get();
      itemsSnap.forEach((itemDoc) => {
        const it = itemDoc.data();
        console.log(`  items/${itemDoc.id}: deliveryDate=${it.deliveryDate}, serviceSlot=${it.serviceSlot}, tierAtOrder=${it.tierAtOrder}, status=${it.status}`);
      });
    }
  }

  console.log('\nDone.');
  process.exit(0);
}

main().catch((e) => {
  console.error('Script crashed:', e);
  process.exit(1);
});
