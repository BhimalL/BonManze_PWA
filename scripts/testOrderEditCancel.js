// scripts/testOrderEditCancel.js
// Live verification for editOrderItemSelection + cancelOrderItem.
// Reuses the Eleanor Fant signed-in session.

import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDoc } from 'firebase/firestore';
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
function approx(a, b, eps = 0.01) { return Math.abs(a - b) < eps; }
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
  const tueD = new Date(monday);
  tueD.setDate(tueD.getDate() + 1);
  const tue = iso(tueD);

  console.log(`Using week starting ${mon}`);
  console.log('\n[1] Sign in as Eleanor and place a fresh order —');
  await signInWithEmailAndPassword(auth, 'eleanor.f@gmail.com', 'BonManzeTest2!');

  const cartItems = [
    { curryId: 'veg', baseId: 'brice', beverageId: 'none', dessertId: 'none', deliveryDate: mon, service: 'Lunch', slotIndex: 0 }, // 130 + 15 = 145
    { curryId: 'chk', baseId: 'wrice', beverageId: 'none', dessertId: 'none', deliveryDate: tue, service: 'Lunch', slotIndex: 0 }  // 150
  ];

  const confirmCheckout = httpsCallable(functions, 'confirmCheckout');
  const checkoutRes = await confirmCheckout({ items: cartItems, type: 'Delivery', paymentScheme: 'Upfront' });
  const { orderId, total: initialTotal } = checkoutRes.data;
  console.log(`  Fresh order created with orderId=${orderId}, initialTotal=${initialTotal}`);

  // Fetch the items to get their database IDs
  const itemsSnap = await adb.collection('orders').doc(orderId).collection('items').get();
  const items = itemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  const vegItem = items.find(it => it.itemId === 'veg');
  const chkItem = items.find(it => it.itemId === 'chk');

  console.log('\n[2] Edit one item selection (veg -> add beverage) —');
  const editOrderItemSelection = httpsCallable(functions, 'editOrderItemSelection');
  const editRes = await editOrderItemSelection({
    orderId,
    itemId: vegItem.id,
    selection: {
      curryId: 'veg',
      baseId: 'brice',
      dhalId: 'none',
      saladId: 'none',
      beverageId: 'alouda', // add alouda (+35 Rs)
      dessertId: 'none',
      note: 'extra sweet'
    }
  });
  
  const { newPrice, newTotal } = editRes.data;
  console.log(`  Edited selection: newPrice=${newPrice}, newTotal=${newTotal}`);

  // Re-read order total from Firestore
  const orderAfterEdit = await adb.collection('orders').doc(orderId).get();
  check('order total updated in Firestore after edit', approx(orderAfterEdit.data().total, newTotal));

  console.log('\n[3] Mark the items Paid and then cancel one item (chk) —');
  // First mark them Paid via Admin SDK
  for (const doc of itemsSnap.docs) {
    await adb.collection('orders').doc(orderId).collection('items').doc(doc.id).update({ paymentStatus: 'Paid' });
  }
  // Read customer store credit before cancellation
  const custBefore = await adb.collection('customers').doc(auth.currentUser.uid).get();
  const creditBefore = custBefore.data().storeCredit || 0;

  const cancelOrderItem = httpsCallable(functions, 'cancelOrderItem');
  const cancelRes = await cancelOrderItem({
    orderId,
    itemId: chkItem.id
  });

  const { refundAmount, newTotal: totalAfterCancel } = cancelRes.data;
  console.log(`  Cancelled item: refundAmount=${refundAmount}, newTotal=${totalAfterCancel}`);

  // Verify item status in Firestore
  const cancelledItemDoc = await adb.collection('orders').doc(orderId).collection('items').doc(chkItem.id).get();
  check('item status is Cancelled', cancelledItemDoc.data().status === 'Cancelled');
  check('item paymentStatus is Refunded', cancelledItemDoc.data().paymentStatus === 'Refunded');

  // Verify order total is reduced
  const orderAfterCancel = await adb.collection('orders').doc(orderId).get();
  check('order total reduced in Firestore', approx(orderAfterCancel.data().total, totalAfterCancel));

  // Verify customer store credit is refunded
  const custAfter = await adb.collection('customers').doc(auth.currentUser.uid).get();
  const creditAfter = custAfter.data().storeCredit || 0;
  check('store credit increased by the refund amount', approx(creditAfter, creditBefore + refundAmount), `creditBefore=${creditBefore}, creditAfter=${creditAfter}, refundAmount=${refundAmount}`);

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => { console.error('Test script crashed:', err); process.exit(1); });
