// scripts/testMultiEntity.js
//
// Step 8: Multi-Entity System and Resubmission security rules verification.
//
// HOW TO RUN:
//   1. Make sure the emulator suite is running (npm run emulators)
//   2. From the repo root, in a second terminal:
//        node scripts/testMultiEntity.js

import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, updateDoc } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';

import { initializeApp as adminInitializeApp } from 'firebase-admin/app';
import { getFirestore as adminGetFirestore } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

const app = initializeApp({ apiKey: 'x', projectId: 'demo-bonmanze' });
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099');
connectFirestoreEmulator(db, '127.0.0.1', 8080);
connectFunctionsEmulator(functions, '127.0.0.1', 5001);

adminInitializeApp({ projectId: 'demo-bonmanze' });
const adb = adminGetFirestore();

let failures = 0;
function check(label, cond, detail) {
  if (cond) console.log(`  PASS  ${label}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`); }
}

function iso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function mondayPlusWeeks(n) {
  const d = new Date();
  const dow = d.getDay();
  const diff = dow === 0 ? 1 : dow === 1 ? 7 : 8 - dow;
  d.setDate(d.getDate() + diff + n * 7);
  return d;
}

async function findWeekWithNoOverride() {
  for (let n = 12; n < 200; n++) {
    const monday = mondayPlusWeeks(n);
    const weekStart = iso(monday);
    const snap = await adb.collection('menuWeeks').doc(weekStart).get();
    if (!snap.exists) return monday;
  }
  throw new Error('Could not find a future week with no menuWeeks override');
}

async function main() {
  const monday = await findWeekWithNoOverride();
  const mon = iso(monday);

  console.log('\n[1] Setup: Sign in as Eleanor (real seeded customer) —');
  await signInWithEmailAndPassword(auth, 'eleanor.f@gmail.com', 'BonManzeTest2!');
  const uid = auth.currentUser.uid;

  console.log('\n[2] Verify rejected-to-pending resubmission rules flow —');
  // First, use Admin SDK to mark Eleanor as Rejected with a reason
  await adb.collection('customers').doc(uid).update({
    registrationStatus: 'Rejected',
    rejectionReason: 'stale address info'
  });

  // Signed in as the client, perform the resubmission.
  // We need to:
  // - update some customer profile fields (e.g. phone/address/etc.)
  // - reset registrationStatus to Pending
  // - clear rejectionReason (set to null)
  try {
    await updateDoc(doc(db, 'customers', uid), {
      phone: '51234567',
      registrationStatus: 'Pending',
      rejectionReason: null
    });
    check('rules allow rejected customer to clear rejectionReason and set status to Pending on resubmit', true);
  } catch (err) {
    check('rules allow rejected customer to clear rejectionReason and set status to Pending on resubmit', false, err.message);
  }

  // Verify the updated data via Admin SDK
  const updatedCustomerSnap = await adb.collection('customers').doc(uid).get();
  const updatedCustomer = updatedCustomerSnap.data();
  check('registrationStatus is Pending after resubmit', updatedCustomer.registrationStatus === 'Pending');
  check('rejectionReason is null after resubmit', updatedCustomer.rejectionReason === null);
  check('phone number was updated on resubmit', updatedCustomer.phone === '51234567');

  console.log('\n[3] Verify entity frozen snapshot stability on order reassignment —');
  // Approve Eleanor and assign her to entity-a using Admin SDK
  await adb.collection('customers').doc(uid).update({
    registrationStatus: 'Approved',
    entityId: 'entity-a'
  });

  // Place an order as Eleanor
  const confirmCheckout = httpsCallable(functions, 'confirmCheckout');
  const cartItems = [
    { curryId: 'veg', baseId: 'brice', beverageId: 'none', dessertId: 'none', deliveryDate: mon, service: 'Lunch', slotIndex: 0 }
  ];

  let orderId = '';
  try {
    const res = await confirmCheckout({ items: cartItems, type: 'Delivery', paymentScheme: 'Upfront' });
    orderId = res.data.orderId;
    check('checkout succeeds for approved customer under entity-a', true);
  } catch (err) {
    check('checkout succeeds for approved customer under entity-a', false, err.message);
  }

  if (orderId) {
    // Read the created order document
    const orderSnap = await adb.collection('orders').doc(orderId).get();
    const orderData = orderSnap.data();

    check('created order contains entityId: entity-a', orderData.entityId === 'entity-a');
    check('created order contains entityBrn: PLACEHOLDER-BRN-A', orderData.entityBrn === 'PLACEHOLDER-BRN-A');

    // Reassign Eleanor to entity-b using Admin SDK (simulates staff reassigning customer entity)
    console.log('\n[4] Reassign customer to entity-b and verify previous order stays unchanged —');
    await adb.collection('customers').doc(uid).update({
      entityId: 'entity-b'
    });

    // Re-read the order and verify the snapshot fields didn't change
    const orderSnapAfterReassign = await adb.collection('orders').doc(orderId).get();
    const orderDataAfterReassign = orderSnapAfterReassign.data();

    check('order entityId stays entity-a (not changed to entity-b)', orderDataAfterReassign.entityId === 'entity-a');
    check('order entityBrn stays PLACEHOLDER-BRN-A', orderDataAfterReassign.entityBrn === 'PLACEHOLDER-BRN-A');
    check('order entityName stays PLACEHOLDER ENTITY A LTD', orderDataAfterReassign.entityName === 'PLACEHOLDER ENTITY A LTD — replace before launch');
  }

  // Restore Eleanor's default approved/entity-a state for other scripts
  await adb.collection('customers').doc(uid).update({
    registrationStatus: 'Approved',
    entityId: 'entity-a'
  });

  console.log(`\nAll done. Failures: ${failures}`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch(console.error);
