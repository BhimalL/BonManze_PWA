// One-off diagnostic — settles why "Partner-assigned only" / "No partner assigned" on Orders by
// Dish appear inverted for Rik's Kitchen. Reads the exact live Firestore data the new filter logic
// depends on, with no interpretation — just prints raw field values so there's no ambiguity about
// what's actually stored vs. what the UI shows.

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

initializeApp({ projectId: 'demo-bonmanze' });

const db = getFirestore();

async function run() {
  console.log('=== Trading Entities ===');
  const entities = await db.collection('entities').get();
  entities.forEach(d => console.log(`  ${d.id} -> "${d.data().name}" (active: ${d.data().active})`));

  console.log('\n=== Staff with isPartner === true ===');
  const staff = await db.collection('staff').get();
  staff.forEach(d => {
    const s = d.data();
    if (s.isPartner === true) {
      console.log(`  ${d.id} (${s.name}): isPartner=${JSON.stringify(s.isPartner)}, active=${JSON.stringify(s.active)}, assignedEntityIds=${JSON.stringify(s.assignedEntityIds)}`);
    }
  });
  console.log('(if nothing printed above, no staff doc currently has isPartner === true)');

  console.log('\n=== All orders and their items entityId ===');
  const orders = await db.collection('orders').get();
  for (const orderDoc of orders.docs) {
    const items = await orderDoc.ref.collection('items').get();
    for (const itemDoc of items.docs) {
      const it = itemDoc.data();
      console.log(`  order ${orderDoc.id} / item ${itemDoc.id}: name="${it.name}", deliveryDate=${it.deliveryDate}, entityId=${JSON.stringify(it.entityId)}, customerId=${it.customerId}`);
    }
  }
}

run().catch(console.error);
