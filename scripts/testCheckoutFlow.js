// scripts/testCheckoutFlow.js
//
// Live verification for confirmCheckout + onItemPaymentConfirmed (step 6),
// same idea as the login/registration round's manual testing but automated
// and self-checking: it independently recomputes the expected price/
// discount/total using the same source values already seeded in your
// emulator (modules/store.ts's defaults, scripts/seedCustomers.js's
// Eleanor Fant fixture) and asserts the Function's actual output matches —
// not an eyeball check.
//
// Runs against the REAL data your seed scripts already wrote (no new
// seeding needed) — just make sure these have all been run at least once
// against the currently-running emulator:
//   scripts/seedBootstrap.js, scripts/migrateConfigDocs.js,
//   scripts/migrateMenuLibrary.js, scripts/seedCustomers.js
//
// Uses Eleanor Fant (username "eleanor", Bronze tier, Corporate group,
// 300 points to start) rather than Marcus, specifically because Marcus is
// already at the top tier (Diamond) — there'd be no higher tier left to
// upgrade into, so the tier-upgrade check would have nothing to prove.
//
// HOW TO RUN:
//   1. Make sure the emulator suite is running (npm run emulators) and the
//      4 seed scripts above have all been run against it at least once.
//   2. From the repo root, in a second terminal:
//        node scripts/testCheckoutFlow.js

import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, collection, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
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
  // Picks a future Monday whose menuWeeks/{weekStart} doc doesn't exist,
  // so the test deterministically exercises the menuDefaults fallback
  // instead of accidentally landing on one of Bhimal's saved Menu Planner
  // overrides (which could have different ids/prices than the defaults
  // this script's expected-value math assumes).
  for (let n = 12; n < 200; n++) {
    const monday = mondayPlusWeeks(n);
    const weekStart = iso(monday);
    const snap = await adb.collection('menuWeeks').doc(weekStart).get();
    if (!snap.exists) return monday;
  }
  throw new Error('Could not find a future week with no menuWeeks override — every week for ~4 years out has one?');
}

async function main() {
  const monday = await findWeekWithNoOverride();
  const weekDates = [0, 1, 2, 3, 4].map((i) => { const d = new Date(monday); d.setDate(d.getDate() + i); return iso(d); });
  const [mon, tue, wed, thu, fri] = weekDates;
  console.log(`Using week starting ${mon} (confirmed no menuWeeks override for this week)`);

  console.log('\n[1] Sign in as Eleanor (real seeded customer) and call confirmCheckout —');
  await signInWithEmailAndPassword(auth, 'eleanor.f@gmail.com', 'BonManzeTest2!');
  await adb.collection('customers').doc(auth.currentUser.uid).update({
    points: 300,
    tier: 't1',
    ltv: 1500,
    registrationStatus: 'Approved',
    entityId: 'entity-a'
  });

  // Default-rotation ids/prices, copied from modules/store.ts /
  // scripts/migrateMenuLibrary.js (2026-08-12) — see this file's header.
  // Full Lunch coverage (MON-FRI) to trigger the bulk discount, plus one
  // Dinner item the same week (counts toward the week subtotal but not
  // toward Lunch coverage), plus add-ons on two items.
  const cartItems = [
    { curryId: 'veg', baseId: 'brice', beverageId: 'alouda', dessertId: 'gateau', deliveryDate: mon, service: 'Lunch', slotIndex: 0, note: 'no chilli please' }, // 130+15+35+25=205
    { curryId: 'chk', baseId: 'wrice', beverageId: 'none', dessertId: 'none', deliveryDate: tue, service: 'Lunch', slotIndex: 0 }, // 150
    { curryId: 'beef', baseId: 'wrice', beverageId: 'none', dessertId: 'none', deliveryDate: wed, service: 'Lunch', slotIndex: 0 }, // 220
    { curryId: 'shp', baseId: 'wrice', beverageId: 'water', dessertId: 'cake', deliveryDate: thu, service: 'Lunch', slotIndex: 0 }, // 205+0+0=205
    { curryId: 'pan', baseId: 'wrice', beverageId: 'none', dessertId: 'none', deliveryDate: fri, service: 'Lunch', slotIndex: 0 }, // 160
    { curryId: 'pan', baseId: 'wrice', beverageId: 'none', dessertId: 'none', deliveryDate: mon, service: 'Dinner', slotIndex: 0 }, // 175
  ];
  const expectedPrices = [205, 150, 220, 205, 160, 175];
  const expectedSubtotal = expectedPrices.reduce((a, b) => a + b, 0); // 1115
  const effectiveStandardRate = Math.max(0, 15); // Eleanor: Bronze tier 0% vs Corporate group 15% -> group wins
  const expectedStandardDiscount = expectedSubtotal * (effectiveStandardRate / 100);
  const birthdayHits = weekDates.filter((d) => d.slice(5) === '10-31'); // Eleanor's birthday
  const expectedBirthdayDiscount = birthdayHits.length > 0 ? null : 0; // null = "inspect manually", coincidence not expected
  const expectedBulkDiscount = expectedSubtotal * 0.05; // all 5 Lunch weekdays covered -> 5% of full week (incl. Dinner)
  const expectedTotalDiscount = expectedStandardDiscount + (expectedBirthdayDiscount || 0) + expectedBulkDiscount;
  const expectedNet = Math.max(0, expectedSubtotal - expectedTotalDiscount);
  const expectedVat = expectedNet * 0.15;
  const expectedTotal = Math.round((expectedNet + expectedVat) * 100) / 100;

  const confirmCheckout = httpsCallable(functions, 'confirmCheckout');
  const result = await confirmCheckout({ items: cartItems, type: 'Delivery', paymentScheme: 'Upfront' });
  const { orderId, total, breakdown } = result.data;
  console.log(`  confirmCheckout returned orderId=${orderId}, total=${total}`);
  console.log(`  breakdown:`, breakdown);
  console.log(`  independently expected: subtotal=${expectedSubtotal}, standardDiscount=${expectedStandardDiscount.toFixed(2)}, bulkDiscount=${expectedBulkDiscount.toFixed(2)}, total=${expectedTotal}`);

  check('subtotal matches independent calc', approx(breakdown.subtotal, expectedSubtotal), `${breakdown.subtotal} vs ${expectedSubtotal}`);
  check('standardDiscount matches (Corporate group 15% beats Bronze tier 0%)', approx(breakdown.standardDiscount, expectedStandardDiscount), `${breakdown.standardDiscount} vs ${expectedStandardDiscount}`);
  check('bulkDiscount matches (full Lunch week -> 5% of full week subtotal incl. Dinner)', approx(breakdown.bulkDiscount, expectedBulkDiscount), `${breakdown.bulkDiscount} vs ${expectedBulkDiscount}`);
  check('total matches independent calc', approx(total, expectedTotal), `${total} vs ${expectedTotal}`);

  console.log('\n[2] Read back the written order + items via Admin SDK —');
  const orderSnap = await adb.collection('orders').doc(orderId).get();
  const itemsSnap = await adb.collection('orders').doc(orderId).collection('items').get();
  check('order doc exists with the server-computed total (client never sent one)', orderSnap.exists && approx(orderSnap.data().total, expectedTotal));
  check('order.customerId is the real signed-in uid, not client-supplied', orderSnap.data().customerId === auth.currentUser.uid);
  
  const orderData = orderSnap.data();
  check('order denormalized entityId is correct', orderData.entityId === 'entity-a');
  check('order denormalized entityName is correct', orderData.entityName === 'PLACEHOLDER ENTITY A LTD — replace before launch');
  check('order denormalized entityBrn is correct', orderData.entityBrn === 'PLACEHOLDER-BRN-A');
  check('order denormalized entityVatNumber is correct', orderData.entityVatNumber === 'PLACEHOLDER-VAT-A');
  check('order denormalized entityBankReference is correct', orderData.entityBankReference === 'PLACEHOLDER-BANK-A');

  check(`items subcollection has ${cartItems.length} docs`, itemsSnap.size === cartItems.length, `got ${itemsSnap.size}`);
  const pricesWritten = itemsSnap.docs.map((d) => d.data().price).sort((a, b) => a - b);
  check('every item price matches server-computed pricing, not something the client submitted',
    JSON.stringify(pricesWritten) === JSON.stringify([...expectedPrices].sort((a, b) => a - b)), JSON.stringify(pricesWritten));

  console.log('\n[2a] Confirm that checkout fails if the customer is not approved —');
  await adb.collection('customers').doc(auth.currentUser.uid).update({
    registrationStatus: 'Pending'
  });
  try {
    await confirmCheckout({ items: cartItems.slice(0, 1), type: 'Delivery', paymentScheme: 'Upfront' });
    check('checkout fails for unapproved customer', false, 'checkout unexpectedly succeeded');
  } catch (err) {
    check('checkout fails for unapproved customer', err.code === 'functions/failed-precondition', err.code);
  }

  // Restore approval for subsequent tests
  await adb.collection('customers').doc(auth.currentUser.uid).update({
    registrationStatus: 'Approved'
  });

  console.log('\n[3] Confirm invalid input is rejected (unknown dish for that date) —');
  try {
    await confirmCheckout({ items: [{ curryId: 'nonexistent-dish', baseId: 'wrice', beverageId: 'none', dessertId: 'none', deliveryDate: mon, service: 'Lunch', slotIndex: 0 }], type: 'Delivery', paymentScheme: 'Upfront' });
    check('rejects an unknown curryId', false, 'call unexpectedly succeeded');
  } catch (err) {
    check('rejects an unknown curryId', err.code === 'functions/invalid-argument', err.code);
  }

  console.log('\n[4] Confirm the rules fix: a client can no longer create an orders doc directly —');
  try {
    await setDoc(doc(collection(db, 'orders'), 'client-attempt'), { customerId: auth.currentUser.uid, total: 1 });
    check('direct client order create is rejected', false, 'setDoc unexpectedly succeeded — rules gap NOT closed');
  } catch (err) {
    check('direct client order create is rejected', err.code === 'permission-denied', err.code);
  }

  console.log('\n[4a] Confirm security rules: client cannot modify their own customer group —');
  try {
    await updateDoc(doc(db, 'customers', auth.currentUser.uid), { group: 'g-corporate-vip' });
    check('client self-assignment of group is rejected', false, 'updateDoc unexpectedly succeeded');
  } catch (err) {
    check('client self-assignment of group is rejected', err.code === 'permission-denied', err.code);
  }

  console.log('\n[4b] Confirm security rules: client cannot update tierAtOrder or isReconciled on an order item —');
  const testItemRef = doc(db, 'orders', orderId, 'items', itemsSnap.docs[0].id);
  try {
    await updateDoc(testItemRef, { tierAtOrder: 't4' });
    check('client modification of tierAtOrder is rejected', false, 'updateDoc unexpectedly succeeded');
  } catch (err) {
    check('client modification of tierAtOrder is rejected', err.code === 'permission-denied', err.code);
  }
  try {
    await updateDoc(testItemRef, { isReconciled: true });
    check('client modification of isReconciled is rejected', false, 'updateDoc unexpectedly succeeded');
  } catch (err) {
    check('client modification of isReconciled is rejected', err.code === 'permission-denied', err.code);
  }

  console.log('\n[5] Mark every item Paid (Admin SDK write — see note below) and check the loyalty trigger —');
  console.log('  Note: this deliberately writes via the Admin SDK rather than signing in as staff, since the');
  console.log('  bootstrap staff password (scripts/seedBootstrap.js) may have been changed by hand since seeding,');
  console.log('  per that script\'s own comment. The write shape is identical to what a real staff client update');
  console.log('  produces (paymentStatus: \'Paid\', nothing else touched) — what this proves is the trigger\'s own');
  console.log('  behavior once that write lands, which is the part that\'s actually new/untested.');
  const custBefore = await adb.collection('customers').doc(auth.currentUser.uid).get();
  const pointsBefore = custBefore.data().points;
  const ltvBefore = custBefore.data().ltv;
  console.log(`  before: points=${pointsBefore}, ltv=${ltvBefore}, tier=${custBefore.data().tier}`);

  for (const itemDoc of itemsSnap.docs) {
    await adb.collection('orders').doc(orderId).collection('items').doc(itemDoc.id).update({ paymentStatus: 'Paid' });
  }

  let custAfter = null;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const snap = await adb.collection('customers').doc(auth.currentUser.uid).get();
    if (snap.data().points !== pointsBefore) custAfter = snap.data();
    if (custAfter && custAfter.points === pointsBefore + expectedSubtotal) break; // Bronze multiplier is 1x
  }
  if (!custAfter) {
    check('onItemPaymentConfirmed fired at all', false, 'points never changed after marking every item Paid — trigger did not fire or crashed (check the Functions emulator log)');
  } else {
    const expectedPointsEarned = expectedSubtotal; // Bronze tier multiplier = 1, so points = sum of item prices
    console.log(`  after: points=${custAfter.points}, ltv=${custAfter.ltv}, tier=${custAfter.tier}`);
    check('points earned across all 6 items = sum(price) * Bronze multiplier(1)', custAfter.points === pointsBefore + expectedPointsEarned, `expected +${expectedPointsEarned}, got +${custAfter.points - pointsBefore}`);
    check('ltv increased by the sum of paid item prices', approx(custAfter.ltv, ltvBefore + expectedSubtotal));
    const expectPromoted = pointsBefore + expectedPointsEarned >= 1000; // Silver threshold
    check(`tier ${expectPromoted ? 'upgraded to Silver (crossed the 1000-point threshold)' : 'stayed Bronze (did not cross 1000)'}`,
      custAfter.tier === (expectPromoted ? 't2' : 't1'), `got ${custAfter.tier}`);
  }

  console.log('\n[6] Re-flip one item to Paid again (idempotency — should NOT award points twice) —');
  const beforeRepeat = await adb.collection('customers').doc(auth.currentUser.uid).get();
  await adb.collection('orders').doc(orderId).collection('items').doc(itemsSnap.docs[0].id).update({ paymentStatus: 'Paid' });
  await new Promise((r) => setTimeout(r, 2000));
  const afterRepeat = await adb.collection('customers').doc(auth.currentUser.uid).get();
  check('no double-award when paymentStatus is set to Paid again', afterRepeat.data().points === beforeRepeat.data().points, `${beforeRepeat.data().points} -> ${afterRepeat.data().points}`);

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => { console.error('Test script crashed:', err); process.exit(1); });
