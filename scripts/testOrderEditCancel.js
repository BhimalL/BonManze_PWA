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

  console.log('\n[2b] Confirm custom instructions + person tag survive an edit —');
  // Place a second single-item order with both a prep instruction and a person tag in the note.
  // The client's mealNotesLine() produces this composed string.
  const composedNote = 'Brown Rice · req: no chilli please · for Priya';
  const checkoutRes2 = await confirmCheckout({
    items: [{ curryId: 'chk', baseId: 'brice', dhalId: 'none', saladId: 'none', beverageId: 'none', dessertId: 'none',
              note: composedNote, deliveryDate: mon, service: 'Dinner', slotIndex: 0 }],
    type: 'Delivery', paymentScheme: 'Upfront'
  });
  const orderId2 = checkoutRes2.data.orderId;
  const itemsSnap2 = await adb.collection('orders').doc(orderId2).collection('items').get();
  const dinnerItem = itemsSnap2.docs[0];
  const dinnerBefore = dinnerItem.data();

  check('[2b] notes persisted verbatim after checkout',
    dinnerBefore.notes === composedNote,
    `got: ${JSON.stringify(dinnerBefore.notes)}`);
  check('[2b] instructions field parsed correctly after checkout',
    dinnerBefore.instructions === 'no chilli please',
    `got: ${JSON.stringify(dinnerBefore.instructions)}`);

  // Now edit the meal (switch base, keep same person+instruction note on client side)
  await editOrderItemSelection({
    orderId: orderId2,
    itemId: dinnerItem.id,
    selection: { curryId: 'chk', baseId: 'wrice', dhalId: 'none', saladId: 'none',
                 beverageId: 'none', dessertId: 'none', note: 'Priya' }
  });

  const dinnerAfterDoc = await adb.collection('orders').doc(orderId2).collection('items').doc(dinnerItem.id).get();
  const dinnerAfter = dinnerAfterDoc.data();

  check('[2b] instructions field unchanged after edit (not overwritten by person tag)',
    dinnerAfter.instructions === 'no chilli please',
    `got: ${JSON.stringify(dinnerAfter.instructions)}`);
  check('[2b] notes field updated with new base, person tag preserved',
    typeof dinnerAfter.notes === 'string' && dinnerAfter.notes.includes('for Priya'),
    `got: ${JSON.stringify(dinnerAfter.notes)}`);
  check('[2b] notes field still contains req: segment after edit (display sites depend on this)',
    typeof dinnerAfter.notes === 'string' && dinnerAfter.notes.includes('req: no chilli please'),
    `got: ${JSON.stringify(dinnerAfter.notes)}`);
  check('[2b] notes field does NOT contain the garbled duplication pattern',
    typeof dinnerAfter.notes === 'string' && !dinnerAfter.notes.includes('for White Rice'),
    `got: ${JSON.stringify(dinnerAfter.notes)}`);

  console.log('\n[2c] Confirm editing WITH a new instructions value actually changes it —');
  // Edit the same item again, this time sending a genuinely new instructions
  // string (as the "Custom instructions / Prep requests?" field in the edit
  // modal does) — this must overwrite the old instructions, not just survive
  // untouched like [2b] above.
  await editOrderItemSelection({
    orderId: orderId2,
    itemId: dinnerItem.id,
    selection: { curryId: 'chk', baseId: 'wrice', dhalId: 'none', saladId: 'none',
                 beverageId: 'none', dessertId: 'none', note: 'Priya', instructions: 'extra spicy please' }
  });

  const dinnerAfterEdit2Doc = await adb.collection('orders').doc(orderId2).collection('items').doc(dinnerItem.id).get();
  const dinnerAfterEdit2 = dinnerAfterEdit2Doc.data();

  check('[2c] instructions field updated to the new value sent by the edit',
    dinnerAfterEdit2.instructions === 'extra spicy please',
    `got: ${JSON.stringify(dinnerAfterEdit2.instructions)}`);
  check('[2c] notes field reflects the new instructions, not the stale one',
    typeof dinnerAfterEdit2.notes === 'string' && dinnerAfterEdit2.notes.includes('req: extra spicy please') && !dinnerAfterEdit2.notes.includes('no chilli please'),
    `got: ${JSON.stringify(dinnerAfterEdit2.notes)}`);
  check('[2c] person tag still preserved alongside the new instructions',
    typeof dinnerAfterEdit2.notes === 'string' && dinnerAfterEdit2.notes.includes('for Priya'),
    `got: ${JSON.stringify(dinnerAfterEdit2.notes)}`);

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
