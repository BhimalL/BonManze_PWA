// One-off, EMULATOR-ONLY helper for test data.
//
// Orders snapshot the trading entity's details (name, BRN, VAT no., address,
// phone, email, bank reference, logo) and each item snapshots the customer's
// delivery address and phone at the moment confirmCheckout runs. Editing an
// entity or customer afterwards does not change orders already placed, which
// is correct for issued tax invoices but awkward for test data.
//
// This script re-copies the CURRENT entity details onto existing orders and
// fills in missing delivery contact on existing items.
//
//   node scripts/refreshOrderSnapshots.js            (dry run, prints changes)
//   node scripts/refreshOrderSnapshots.js --apply    (writes)
//   add --skip-invoiced to leave orders that already have an issued invoice
//   number untouched (what real life would do).
//
// Refuses to run unless FIRESTORE_EMULATOR_HOST is set, so it can never touch
// production data.
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host) {
  console.error('Refusing to run: FIRESTORE_EMULATOR_HOST is not set. This script is for the emulator only.');
  console.error('PowerShell:  $env:FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080"');
  process.exit(1);
}

const apply = process.argv.includes('--apply');
const skipInvoiced = process.argv.includes('--skip-invoiced');

initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'demo-bonmanze' });
const db = getFirestore();

const ENTITY_FIELDS = {
  entityName: 'name',
  entityBrn: 'brn',
  entityVatNumber: 'vatNumber',
  entityBankReference: 'bankReference',
  entityAddress: 'address',
  entityEmail: 'email',
  entityPhone: 'phone',
  entityLogoStoragePath: 'logoStoragePath',
};

const entityCache = new Map();
const customerCache = new Map();
const getEntity = async (id) => {
  if (!id) return null;
  if (!entityCache.has(id)) {
    const s = await db.collection('entities').doc(id).get();
    entityCache.set(id, s.exists ? s.data() : null);
  }
  return entityCache.get(id);
};
const getCustomer = async (id) => {
  if (!id) return null;
  if (!customerCache.has(id)) {
    const s = await db.collection('customers').doc(id).get();
    customerCache.set(id, s.exists ? s.data() : null);
  }
  return customerCache.get(id);
};

let ordersChanged = 0;
let itemsChanged = 0;
let ordersSkipped = 0;

const orders = await db.collection('orders').get();
for (const orderDoc of orders.docs) {
  const o = orderDoc.data();
  const itemsSnap = await orderDoc.ref.collection('items').get();

  const invoiced = itemsSnap.docs.some(d => !!d.data().invoiceNumber);
  if (skipInvoiced && invoiced) { ordersSkipped++; continue; }

  // --- entity snapshot on the order
  const entity = await getEntity(o.entityId);
  if (entity) {
    const patch = {};
    for (const [orderField, entityField] of Object.entries(ENTITY_FIELDS)) {
      const next = entity[entityField] || '';
      if ((o[orderField] || '') !== next) patch[orderField] = next;
    }
    if (Object.keys(patch).length) {
      ordersChanged++;
      console.log(`order ${orderDoc.id}${invoiced ? ' (invoiced)' : ''}: ${Object.keys(patch).join(', ')}`);
      if (apply) await orderDoc.ref.update(patch);
    }
  }

  // --- delivery contact on the items
  const customer = await getCustomer(o.customerId);
  if (customer) {
    const first = Array.isArray(customer.addresses) ? customer.addresses[0] : null;
    const address = first ? [first.street, first.city].filter(Boolean).join(', ') : '';
    const phone = typeof customer.phone === 'string' ? customer.phone : '';
    for (const itemDoc of itemsSnap.docs) {
      const it = itemDoc.data();
      const patch = {};
      if (it.deliveryAddress === undefined && address) patch.deliveryAddress = address;
      if (it.customerPhone === undefined && phone) patch.customerPhone = phone;
      if (Object.keys(patch).length) {
        itemsChanged++;
        console.log(`  item ${orderDoc.id}/${itemDoc.id}: ${Object.keys(patch).join(', ')}`);
        if (apply) await itemDoc.ref.update(patch);
      }
    }
  }
}

console.log(`\n${apply ? 'APPLIED' : 'DRY RUN'}: ${ordersChanged} order(s) and ${itemsChanged} item(s) ${apply ? 'updated' : 'would change'}; ${ordersSkipped} invoiced order(s) skipped.`);
if (!apply) console.log('Re-run with --apply to write these changes.');
process.exit(0);
