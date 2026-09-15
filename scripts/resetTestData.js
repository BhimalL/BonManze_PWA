// One-off Admin SDK utility — full transaction reset for a clean persistence test.
//
// Scope (confirmed with Bhimal 2026-09-13): deletes every order + item, resets every
// customer's loyalty stats back to their registration-time baseline (matches
// functions/index.js's registerCustomer defaults exactly: points:0, storeCredit:0,
// tier:'t1' (Bronze), ltv:0), and removes the transaction-linked audit log entries
// (PaymentConfirmed/DeliveryConfirmed) that referenced the now-deleted orders.
//
// Deliberately untouched: customers' own profile fields (name/email/phone/addresses/
// registrationStatus/gdprConsent/referenceCode/avatar), staff, roles, entities, menu
// data, config, and ConfigChange/RoleChange audit log entries — none of those are
// transaction byproducts.
//
// Run this against a LIVE emulator only (it needs a real Firestore connection to read/
// write against) — start it in its own terminal window while `npm run emulators` is
// already up and showing "All emulators ready!", not before. After it finishes and you've
// confirmed the counts below, do the usual single Ctrl+C / wait-for-"Export complete"
// clean shutdown so this clean state is what gets persisted for the next test.

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

initializeApp({ projectId: 'demo-bonmanze' });

const db = getFirestore();

async function run() {
  console.log('Starting full transaction reset...\n');

  // 1. Delete every order and its items subcollection.
  const orders = await db.collection('orders').get();
  console.log(`Found ${orders.size} order document(s).`);
  let itemsDeleted = 0;
  for (const orderDoc of orders.docs) {
    const items = await orderDoc.ref.collection('items').get();
    for (const itemDoc of items.docs) {
      await itemDoc.ref.delete();
      itemsDeleted++;
      console.log(`  Deleted item: orders/${orderDoc.id}/items/${itemDoc.id}`);
    }
    await orderDoc.ref.delete();
    console.log(`Deleted order: ${orderDoc.id}`);
  }
  console.log(`\nOrders deleted: ${orders.size}. Items deleted: ${itemsDeleted}.\n`);

  // 2. Reset every customer's loyalty stats to the registration baseline.
  const customers = await db.collection('customers').get();
  console.log(`Found ${customers.size} customer document(s).`);
  for (const custDoc of customers.docs) {
    const before = custDoc.data();
    await custDoc.ref.update({ points: 0, storeCredit: 0, tier: 't1', ltv: 0 });
    console.log(
      `Reset loyalty stats: customers/${custDoc.id} (${before.name || before.email}) ` +
      `[was points=${before.points}, ltv=${before.ltv}, tier=${before.tier}, storeCredit=${before.storeCredit}]`
    );
  }
  console.log(`\nCustomers reset: ${customers.size}.\n`);

  // 3. Delete transaction-linked audit log entries only.
  const auditSnap = await db.collection('auditLog').get();
  const targets = auditSnap.docs.filter(d =>
    ['PaymentConfirmed', 'DeliveryConfirmed'].includes(d.data().type)
  );
  console.log(`Found ${targets.length} transaction-linked audit log entr(ies) out of ${auditSnap.size} total.`);
  for (const auditDoc of targets) {
    await auditDoc.ref.delete();
    console.log(`Deleted audit log entry: ${auditDoc.id} (${auditDoc.data().type})`);
  }
  console.log(`\nAudit log entries deleted: ${targets.length}.\n`);

  // Verification
  const remainingOrders = await db.collection('orders').get();
  const remainingCustomers = await db.collection('customers').get();
  const remainingAudit = await db.collection('auditLog').get();
  console.log('=== Verification ===');
  console.log(`Remaining orders: ${remainingOrders.size} (expected 0)`);
  console.log(`Remaining auditLog entries: ${remainingAudit.size} (ConfigChange/RoleChange only, expected unchanged)`);
  console.log(`Customers (${remainingCustomers.size}):`);
  remainingCustomers.forEach(d => {
    const c = d.data();
    console.log(`  - ${d.id} (${c.name}): points=${c.points}, ltv=${c.ltv}, tier=${c.tier}, storeCredit=${c.storeCredit}`);
  });
}

run().catch(console.error);
