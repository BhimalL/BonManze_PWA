// scripts/testDriverHandoverRules.js
// Verifies the driverHandovers rules (a driver's "Process handover" marker)
// and the two item writes the handover feature relies on:
//   - a driver may still stamp paymentClaimedAt on a deliver + claim write
//     (items rule clause 4 pins other fields, never this one);
//   - the cashier's confirm batch (items -> Paid + handover -> Confirmed in
//     ONE atomic commit) is allowed.
//
// Emulator hosts/project are overridable so this can run against an isolated
// emulator instance:
//   FIRESTORE_EMULATOR_HOST (default 127.0.0.1:8080)
//   FIREBASE_AUTH_EMULATOR_HOST (default 127.0.0.1:9099)
//   TEST_PROJECT_ID (default demo-bonmanze)

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const PROJECT_ID = process.env.TEST_PROJECT_ID || 'demo-bonmanze';

import { initializeApp } from 'firebase/app';
import {
  getFirestore, connectFirestoreEmulator, doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, writeBatch, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { initializeApp as adminInitializeApp, getApps as adminGetApps } from 'firebase-admin/app';
import { getAuth as adminGetAuth } from 'firebase-admin/auth';
import { getFirestore as adminGetFirestore } from 'firebase-admin/firestore';

const [fsHost, fsPort] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
const app = initializeApp({ apiKey: 'demo-emulator-key', authDomain: PROJECT_ID + '.firebaseapp.com', projectId: PROJECT_ID });
const db = getFirestore(app);
const auth = getAuth(app);
connectFirestoreEmulator(db, fsHost, Number(fsPort));
connectAuthEmulator(auth, 'http://' + process.env.FIREBASE_AUTH_EMULATOR_HOST);
if (adminGetApps().length === 0) adminInitializeApp({ projectId: PROJECT_ID });
const aauth = adminGetAuth();
const adb = adminGetFirestore();

let passed = 0;
let failed = 0;
const isDenied = (e) => e && (e.code === 'permission-denied' || (e.message && e.message.includes('PERMISSION_DENIED')));

async function assertAllowed(label, fn) {
  try { await fn(); console.log('  PASS  ' + label); passed++; }
  catch (e) { console.error('  FAIL  ' + label + ' -- ' + e.message); failed++; }
}
async function assertDenied(label, fn) {
  try {
    await fn();
    console.error('  FAIL  ' + label + ' -- expected PERMISSION_DENIED but succeeded');
    failed++;
  } catch (e) {
    if (isDenied(e)) { console.log('  PASS  ' + label); passed++; }
    else { console.error('  FAIL  ' + label + ' -- unexpected error: ' + e.message); failed++; }
  }
}

const PASS = 'Password1!';
const EMAILS = {
  driver1: 'dh-driver1@test.local',
  driver2: 'dh-driver2@test.local',
  cashier: 'dh-cashier@test.local',
  viewonly: 'dh-viewonly@test.local',
  partner: 'dh-partner@test.local',
  customer: 'dh-customer@test.local',
};
const created = [];

async function mkUser(email, staffData, customerData) {
  try { const u = await aauth.getUserByEmail(email); await aauth.deleteUser(u.uid); } catch (e) { /* none */ }
  const u = await aauth.createUser({ email, password: PASS });
  created.push(u.uid);
  if (staffData) await adb.collection('staff').doc(u.uid).set({ active: true, isOwner: false, email, ...staffData });
  if (customerData) await adb.collection('customers').doc(u.uid).set({ email, ...customerData });
  return u.uid;
}
async function signInAs(email) {
  await signOut(auth).catch(() => {});
  await signInWithEmailAndPassword(auth, email, PASS);
}

const validHandover = (uid, extra = {}) => ({
  driverId: uid,
  driverName: 'Driver One',
  itemIds: ['ord-dh-1::item-dh-1', 'ord-dh-1::item-dh-2'],
  itemCount: 2,
  total: 365.99,
  status: 'Submitted',
  submittedAt: serverTimestamp(),
  ...extra,
});

(async () => {
  console.log('\n--- driverHandovers rules + handover item writes ---\n');
  try {
    // Make sure the emulator is running the rules currently on disk.
    try {
      const fs = await import('fs');
      const path = await import('path');
      const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
      if (fs.existsSync(rulesPath)) {
        await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}:reloadRules`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ignore_errors: false, rules: { files: [{ name: 'firestore.rules', content: fs.readFileSync(rulesPath, 'utf8') }] } }),
        });
      }
    } catch (e) { console.warn('Note: could not reload firestore.rules via API:', e.message); }

    await adb.collection('roles').doc('role-dh-driver').set({ name: 'DH Driver', permissions: { deliveryList: { view: true, edit: true }, payments: { view: true, edit: false } } });
    await adb.collection('roles').doc('role-dh-driver-nopay').set({ name: 'DH Driver (no payments)', permissions: { deliveryList: { view: true, edit: true } } });
    await adb.collection('roles').doc('role-dh-cashier').set({ name: 'DH Cashier', permissions: { deliveryList: { view: true, edit: true }, payments: { view: true, edit: true } } });
    await adb.collection('roles').doc('role-dh-viewonly').set({ name: 'DH View Only', permissions: { payments: { view: true, edit: false } } });

    const d1 = await mkUser(EMAILS.driver1, { name: 'Driver One', roleId: 'role-dh-driver-nopay', isDriver: true });
    const d2 = await mkUser(EMAILS.driver2, { name: 'Driver Two', roleId: 'role-dh-driver', isDriver: true });
    const cashier = await mkUser(EMAILS.cashier, { name: 'Cashier', roleId: 'role-dh-cashier', isDriver: false });
    await mkUser(EMAILS.viewonly, { name: 'Viewer', roleId: 'role-dh-viewonly', isDriver: false });
    await mkUser(EMAILS.partner, { name: 'Partner', roleId: 'role-dh-cashier', isPartner: true, assignedEntityIds: ['entity-a'] });
    const cust = await mkUser(EMAILS.customer, null, { name: 'Customer', registrationStatus: 'Approved' });

    const created_ids = [];
    const H = (id) => doc(db, 'driverHandovers', id);

    console.log('Create');
    await signInAs(EMAILS.driver1);
    await assertAllowed('[1] driver creates a valid handover for themselves', async () => {
      const ref = doc(collection(db, 'driverHandovers'));
      await setDoc(ref, validHandover(d1));
      created_ids.push(ref.id);
    });
    await assertDenied('[2] driver cannot create a handover in another driver\'s name', () => setDoc(doc(collection(db, 'driverHandovers')), validHandover(d2)));
    await assertDenied('[3] driver cannot create it already Confirmed', () => setDoc(doc(collection(db, 'driverHandovers')), validHandover(d1, { status: 'Confirmed' })));
    await assertDenied('[4] driver cannot add extra keys (resolvedBy)', () => setDoc(doc(collection(db, 'driverHandovers')), validHandover(d1, { resolvedBy: d1 })));
    await assertDenied('[5] driver cannot back-date submittedAt (client clock)', () => setDoc(doc(collection(db, 'driverHandovers')), validHandover(d1, { submittedAt: Timestamp.fromDate(new Date('2020-01-01')) })));
    await assertDenied('[6] driver cannot create an empty handover', () => setDoc(doc(collection(db, 'driverHandovers')), validHandover(d1, { itemIds: [], itemCount: 0 })));
    await assertDenied('[7] itemCount must match itemIds', () => setDoc(doc(collection(db, 'driverHandovers')), validHandover(d1, { itemCount: 5 })));

    await signInAs(EMAILS.cashier);
    await assertDenied('[8] cashier (not a driver) cannot create a handover', () => setDoc(doc(collection(db, 'driverHandovers')), validHandover(cashier)));
    await signInAs(EMAILS.customer);
    await assertDenied('[9] customer cannot create a handover', () => setDoc(doc(collection(db, 'driverHandovers')), validHandover(cust)));

    const hid = created_ids[0];

    console.log('\nRead');
    await signInAs(EMAILS.driver1);
    await assertAllowed('[10] driver reads their own open handovers (filtered query)', async () => {
      const snap = await getDocs(query(collection(db, 'driverHandovers'), where('driverId', '==', d1), where('status', '==', 'Submitted')));
      if (snap.size !== 1) throw new Error('expected 1 handover, got ' + snap.size);
    });
    await assertDenied('[11] driver cannot list the whole collection', () => getDocs(collection(db, 'driverHandovers')));
    await signInAs(EMAILS.driver2);
    await assertDenied('[12] another driver cannot read it (even with Payments view)', () => getDoc(H(hid)));
    await assertDenied('[13] another driver cannot list everyone\'s open handovers', () => getDocs(query(collection(db, 'driverHandovers'), where('status', '==', 'Submitted'))));
    await signInAs(EMAILS.cashier);
    await assertAllowed('[14] cashier lists open handovers', async () => {
      const snap = await getDocs(query(collection(db, 'driverHandovers'), where('status', '==', 'Submitted')));
      if (snap.size < 1) throw new Error('expected at least 1');
    });
    await signInAs(EMAILS.viewonly);
    await assertAllowed('[15] Payments view-only staff can read', () => getDoc(H(hid)));
    await signInAs(EMAILS.partner);
    await assertDenied('[16] Partner staff cannot read', () => getDoc(H(hid)));
    await signInAs(EMAILS.customer);
    await assertDenied('[17] customer cannot read', () => getDoc(H(hid)));

    console.log('\nUpdate / delete');
    await signInAs(EMAILS.driver1);
    await assertDenied('[18] driver cannot confirm their own handover', () => updateDoc(H(hid), { status: 'Confirmed', resolvedAt: serverTimestamp(), resolvedBy: d1 }));
    await assertDenied('[19] driver cannot delete', () => deleteDoc(H(hid)));
    await signInAs(EMAILS.viewonly);
    await assertDenied('[20] Payments view-only staff cannot confirm', () => updateDoc(H(hid), { status: 'Confirmed', resolvedAt: serverTimestamp(), resolvedBy: cashier }));
    await signInAs(EMAILS.partner);
    await assertDenied('[21] Partner staff cannot confirm', () => updateDoc(H(hid), { status: 'Confirmed', resolvedAt: serverTimestamp(), resolvedBy: cashier }));
    await signInAs(EMAILS.cashier);
    await assertDenied('[22] cashier cannot change the itemIds', () => updateDoc(H(hid), { status: 'Confirmed', itemIds: ['x::y'], itemCount: 1, resolvedAt: serverTimestamp(), resolvedBy: cashier }));
    await assertDenied('[23] cashier cannot set an arbitrary status', () => updateDoc(H(hid), { status: 'Whatever', resolvedAt: serverTimestamp(), resolvedBy: cashier }));
    await assertDenied('[24] cashier cannot record someone else as resolver', () => updateDoc(H(hid), { status: 'Confirmed', resolvedAt: serverTimestamp(), resolvedBy: d1 }));
    await assertAllowed('[25] cashier returns a handover to the driver', () => updateDoc(H(hid), { status: 'Returned', resolvedAt: serverTimestamp(), resolvedBy: cashier }));
    await assertDenied('[26] a Returned handover cannot be confirmed afterwards', () => updateDoc(H(hid), { status: 'Confirmed', resolvedAt: serverTimestamp(), resolvedBy: cashier }));
    await assertDenied('[27] cashier cannot delete', () => deleteDoc(H(hid)));

    console.log('\nItem writes the feature relies on');
    const orderId = 'ord-dh-1';
    await adb.collection('orders').doc(orderId).set({ customerId: cust, entityId: 'entity-a', status: 'Active', total: 500 });
    const base = {
      customerId: cust, entityId: 'entity-a', name: 'Curry', price: 250, qty: 1, status: 'En route', paymentStatus: 'Pending',
      deliveryDate: '2026-10-15', serviceSlot: 'Lunch', paymentPaidAmount: null, paymentWrittenOff: null,
      invoiceNumber: null, invoiceIssuedAt: null, invoiceReprintCount: 0, assignedDriverId: d1,
    };
    const itemPath = (n) => `orders/${orderId}/items/item-dh-${n}`;
    await adb.doc(itemPath(1)).set(base);
    await adb.doc(itemPath(2)).set(base);

    await signInAs(EMAILS.driver1);
    await assertAllowed('[28] driver deliver + claim write may include paymentClaimedAt', async () => {
      await updateDoc(doc(db, itemPath(1)), {
        status: 'Completed', paymentMethodName: 'Cash on Delivery', paymentReference: 'Pay_A-000000001',
        paymentClaimedAt: new Date().toISOString(), paymentClaimedBy: 'driver', paymentClaimedByStaffId: d1,
      });
      await updateDoc(doc(db, itemPath(2)), {
        status: 'Completed', paymentMethodName: 'Cash on Delivery', paymentReference: 'Pay_A-000000001',
        paymentClaimedAt: new Date().toISOString(), paymentClaimedBy: 'driver', paymentClaimedByStaffId: d1,
      });
    });

    // fresh Submitted handover for the cashier's atomic confirm
    let hid2;
    await assertAllowed('[29] driver submits a handover for the two claimed items', async () => {
      const ref = doc(collection(db, 'driverHandovers'));
      await setDoc(ref, validHandover(d1));
      hid2 = ref.id;
    });

    await signInAs(EMAILS.cashier);
    await assertAllowed('[30] cashier confirms both items AND closes the handover in one batch', async () => {
      const batch = writeBatch(db);
      for (const n of [1, 2]) {
        batch.update(doc(db, itemPath(n)), {
          paymentStatus: 'Paid', paymentMethodName: 'Cash on Delivery', paymentPaidAmount: 250,
          paymentIssueNote: null, paymentIssueAmount: null, paymentClaimedBy: null, paymentClaimedByStaffId: null,
        });
      }
      batch.update(H(hid2), { status: 'Confirmed', resolvedAt: serverTimestamp(), resolvedBy: cashier });
      await batch.commit();
    });
    await assertAllowed('[31] the batch really changed the data', async () => {
      const i = await getDoc(doc(db, itemPath(1)));
      const h = await getDoc(H(hid2));
      if (i.data().paymentStatus !== 'Paid') throw new Error('item not Paid');
      if (h.data().status !== 'Confirmed') throw new Error('handover not Confirmed');
    });
  } catch (e) {
    console.error('Setup/teardown error:', e);
    failed++;
  } finally {
    await signOut(auth).catch(() => {});
    for (const uid of created) {
      await adb.collection('staff').doc(uid).delete().catch(() => {});
      await adb.collection('customers').doc(uid).delete().catch(() => {});
      await aauth.deleteUser(uid).catch(() => {});
    }
    for (const r of ['role-dh-driver', 'role-dh-driver-nopay', 'role-dh-cashier', 'role-dh-viewonly']) await adb.collection('roles').doc(r).delete().catch(() => {});
    const hs = await adb.collection('driverHandovers').where('driverName', 'in', ['Driver One']).get().catch(() => null);
    if (hs) for (const d of hs.docs) await d.ref.delete().catch(() => {});
    for (const n of [1, 2]) await adb.doc(`orders/ord-dh-1/items/item-dh-${n}`).delete().catch(() => {});
    await adb.collection('orders').doc('ord-dh-1').delete().catch(() => {});
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})();
