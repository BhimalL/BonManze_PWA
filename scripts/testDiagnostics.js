// scripts/testDiagnostics.js
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';

import { initializeApp as adminInitializeApp } from 'firebase-admin/app';
import { getFirestore as adminGetFirestore } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

const app = initializeApp({ apiKey: 'x', projectId: 'demo-bonmanze' });
const auth = getAuth(app);
const functions = getFunctions(app);

connectAuthEmulator(auth, 'http://127.0.0.1:9099');
connectFunctionsEmulator(functions, '127.0.0.1', 5001);

adminInitializeApp({ projectId: 'demo-bonmanze' });
const adb = adminGetFirestore();

function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
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

async function runDiagnostics() {
  const monday = await findWeekWithNoOverride();
  const deliveryDate = iso(monday);
  console.log(`Using delivery date: ${deliveryDate}`);

  // 1. Sign in
  console.log('Signing in as Eleanor...');
  await signInWithEmailAndPassword(auth, 'eleanor.f@gmail.com', 'BonManzeTest2!');

  // 2. Call confirmCheckout
  console.log('Calling confirmCheckout...');
  const confirmCheckout = httpsCallable(functions, 'confirmCheckout');
  const composedNotesString = 'White Rice · req: Sacheen loves spicy food · for Sacheen';

  const checkoutRes = await confirmCheckout({
    items: [
      {
        curryId: 'chk',
        baseId: 'brice',
        dhalId: 'none',
        saladId: 'none',
        beverageId: 'none',
        dessertId: 'none',
        note: composedNotesString,
        deliveryDate,
        service: 'Lunch',
        slotIndex: 0
      }
    ],
    type: 'Delivery',
    paymentScheme: 'Upfront',
    paymentClaim: null,
    systemDate: '2026-08-18'
  });

  const { orderId } = checkoutRes.data;
  console.log(`Checkout succeeded. Order ID: ${orderId}`);

  // 3. Read back from Firestore Admin SDK immediately
  console.log('\n--- READING PERSISTED ORDER ITEM FROM FIRESTORE ---');
  const itemsColl = adb.collection('orders').doc(orderId).collection('items');
  const itemsSnap = await itemsColl.get();
  
  if (itemsSnap.empty) {
    console.error('No items found in subcollection!');
    return;
  }

  const itemDoc = itemsSnap.docs[0];
  const itemData = itemDoc.data();
  console.log('Verbatim document fields:');
  console.log(JSON.stringify(itemData, null, 2));

  // 4. Test Edit Path
  console.log('\n--- TESTING EDIT PATH (editOrderItemSelection) ---');
  const editOrderItemSelection = httpsCallable(functions, 'editOrderItemSelection');
  
  const editRes = await editOrderItemSelection({
    orderId,
    itemId: itemDoc.id,
    selection: {
      curryId: 'chk',
      baseId: 'wrice', // edit base to wrice
      dhalId: 'none',
      saladId: 'none',
      beverageId: 'none',
      dessertId: 'none',
      note: 'Sacheen' // client sends person name in note field
    },
    systemDate: '2026-08-18'
  });

  console.log('Edit succeeded. Reading item back again...');
  const editedDocSnap = await itemsColl.doc(itemDoc.id).get();
  const editedData = editedDocSnap.data();
  console.log('Verbatim edited document fields:');
  console.log(JSON.stringify(editedData, null, 2));

  // --- TRACING CLIENT-SIDE RECONSTRUCT SELECTION ---
  console.log('\n--- TRACING CLIENT-SIDE RECONSTRUCT SELECTION ---');
  console.log('Reconstructed Checkout Selection:');
  console.log(JSON.stringify(reconstructSelection(itemData), null, 2));
  console.log('Reconstructed Edited Selection:');
  console.log(JSON.stringify(reconstructSelection(editedData), null, 2));

  process.exit(0);
}

function splitNotesTag(notes) {
  if (!notes) return { detail: '', person: null, instructions: null };
  const segments = notes.split(' · ');
  let person = null;
  let instructions = null;
  const details = [];

  segments.forEach(seg => {
    const s = seg.trim();
    if (s.startsWith('for ')) {
      person = s.slice(4);
    } else if (s.startsWith('req: ')) {
      instructions = s.slice(5);
    } else {
      details.push(s);
    }
  });

  return { detail: details.join(' · '), person, instructions };
}

function reconstructSelection(item) {
  if (item.baseId !== undefined) {
    const { person } = splitNotesTag(item.notes || '');
    return {
      curryId: item.itemId,
      baseId: item.baseId || 'wrice',
      dhalId: item.dhalId || 'none',
      saladId: item.saladId || 'none',
      beverageId: item.beverageId || 'none',
      dessertId: item.dessertId || 'none',
      note: person || '',
      instructions: item.instructions || ''
    };
  }
  return null;
}

runDiagnostics().catch(err => {
  console.error('Diagnostics crashed:', err);
  process.exit(1);
});
