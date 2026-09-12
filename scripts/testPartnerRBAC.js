// scripts/testPartnerRBAC.js
// ESM verification for Partner Accounts RBAC and Security Rules

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, getDoc, updateDoc, collection } from 'firebase/firestore';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';

import { initializeApp as adminInitializeApp } from 'firebase-admin/app';
import { getAuth as adminGetAuth } from 'firebase-admin/auth';
import { getFirestore as adminGetFirestore } from 'firebase-admin/firestore';

const APP_CONFIG = {
  apiKey: 'demo-emulator-key',
  authDomain: 'demo-bonmanze.firebaseapp.com',
  projectId: 'demo-bonmanze',
  storageBucket: 'demo-bonmanze.appspot.com',
};

const app = initializeApp(APP_CONFIG);
const db = getFirestore(app);
const auth = getAuth(app);
const functions = getFunctions(app);

connectFirestoreEmulator(db, '127.0.0.1', 8080);
connectAuthEmulator(auth, 'http://127.0.0.1:9099');
connectFunctionsEmulator(functions, '127.0.0.1', 5001);

adminInitializeApp({ projectId: 'demo-bonmanze' });
const aauth = adminGetAuth();
const adb = adminGetFirestore();

let passed = 0;
let failed = 0;

async function assert(label, fn) {
  try {
    await fn();
    console.log("  PASS  " + label);
    passed++;
  } catch (e) {
    console.error("  FAIL  " + label + " -- " + e.message);
    failed++;
  }
}

async function assertDenied(label, fn) {
  try {
    await fn();
    console.error("  FAIL  " + label + " -- expected permission denied, but operation succeeded");
    failed++;
  } catch (e) {
    if (e.code === 'permission-denied' || (e.message && e.message.includes('PERMISSION_DENIED'))) {
      console.log("  PASS  " + label + " (correctly rejected with PERMISSION_DENIED)");
      passed++;
    } else {
      console.error("  FAIL  " + label + " -- unexpected error: " + e.message);
      failed++;
    }
  }
}

(async () => {
  console.log('\n--- Running Partner Accounts Security Rules Verification Suite ---');

  // Setup: Ensure roles exist
  const partnerRoleId = 'role-partner-test';
  await adb.collection('roles').doc(partnerRoleId).set({
    name: 'Partner Role',
    permissions: {
      ordersByDish: { view: true, edit: true },
    }
  });

  const adminRoleId = 'role-admin-test';
  await adb.collection('roles').doc(adminRoleId).set({
    name: 'Admin Role',
    permissions: {
      rolesAndStaff: { view: true, edit: true },
      ordersByDish: { view: true, edit: true },
    }
  });

  // Create admin staff account for testing createStaffMember
  const adminEmail = 'partner-admin-test@example.com';
  try {
    const user = await aauth.getUserByEmail(adminEmail);
    await adb.collection('staff').doc(user.uid).delete();
    await aauth.deleteUser(user.uid);
  } catch (e) {}

  const adminUser = await aauth.createUser({ email: adminEmail, password: 'password123', displayName: 'Admin Tester' });
  await adb.collection('staff').doc(adminUser.uid).set({
    name: 'Admin Tester',
    email: adminEmail,
    roleId: adminRoleId,
    active: true,
    createdAt: new Date(),
  });

  // Partner staff user setup
  const partnerEmail = 'partner-staff-test@example.com';
  try {
    const user = await aauth.getUserByEmail(partnerEmail);
    await adb.collection('staff').doc(user.uid).delete();
    await aauth.deleteUser(user.uid);
  } catch (e) {}

  // 1. Provision partner staff member using createStaffMember callable
  await signInWithEmailAndPassword(auth, adminEmail, 'password123');
  const createStaffFn = httpsCallable(functions, 'createStaffMember');
  let partnerUid = '';

  await assert('[1] Provision Partner staff account with assignedEntityIds via createStaffMember', async () => {
    const res = await createStaffFn({
      name: 'Partner Chef',
      email: partnerEmail,
      password: 'password123',
      roleId: partnerRoleId,
      isPartner: true,
      assignedEntityIds: ['entity-a']
    });
    partnerUid = res.data.uid;
    const snap = await adb.collection('staff').doc(partnerUid).get();
    if (!snap.exists || snap.data().isPartner !== true || !snap.data().assignedEntityIds.includes('entity-a')) {
      throw new Error('Partner staff document was not created with correct partner fields');
    }
  });

  // 2. Setup test orders under entity-a and entity-b
  const orderAId = 'test-order-entity-a';
  const itemAId = 'test-item-entity-a';
  await adb.collection('orders').doc(orderAId).set({
    customerId: 'cust-1',
    entityId: 'entity-a',
    createdAt: new Date(),
    status: 'Active'
  });
  await adb.collection('orders').doc(orderAId).collection('items').doc(itemAId).set({
    customerId: 'cust-1',
    entityId: 'entity-a',
    name: 'Chicken Curry',
    qty: 1,
    price: 150,
    status: 'Active',
    paymentStatus: 'Pending'
  });

  const orderBId = 'test-order-entity-b';
  const itemBId = 'test-item-entity-b';
  await adb.collection('orders').doc(orderBId).set({
    customerId: 'cust-2',
    entityId: 'entity-b',
    createdAt: new Date(),
    status: 'Active'
  });
  await adb.collection('orders').doc(orderBId).collection('items').doc(itemBId).set({
    customerId: 'cust-2',
    entityId: 'entity-b',
    name: 'Fish Curry',
    qty: 1,
    price: 180,
    status: 'Active',
    paymentStatus: 'Pending'
  });

  // Sign in as Partner staff member
  await signOut(auth);
  await signInWithEmailAndPassword(auth, partnerEmail, 'password123');

  // 3. Assert partner can read assigned entity-a order and item
  await assert('[2] Partner staff can read assigned entity-a order', async () => {
    const docSnap = await getDoc(doc(db, 'orders', orderAId));
    if (!docSnap.exists) throw new Error('Order A not found');
  });

  await assert('[3] Partner staff can read assigned entity-a item', async () => {
    const docSnap = await getDoc(doc(db, 'orders', orderAId, 'items', itemAId));
    if (!docSnap.exists) throw new Error('Item A not found');
  });

  // 4. Assert partner direct read on entity-b order and item is rejected
  await assertDenied('[4] Partner staff read of unassigned entity-b order rejected', async () => {
    await getDoc(doc(db, 'orders', orderBId));
  });

  await assertDenied('[5] Partner staff read of unassigned entity-b item rejected', async () => {
    await getDoc(doc(db, 'orders', orderBId, 'items', itemBId));
  });

  // 5. Assert partner status update on assigned entity-a item succeeds
  await assert('[6] Partner staff status update (Active -> Preparing) on assigned entity-a item succeeds', async () => {
    await updateDoc(doc(db, 'orders', orderAId, 'items', itemAId), {
      status: 'Preparing'
    });
  });

  // 6. Assert partner status update on unassigned entity-b item is rejected
  await assertDenied('[7] Partner staff status update on unassigned entity-b item rejected', async () => {
    await updateDoc(doc(db, 'orders', orderBId, 'items', itemBId), {
      status: 'Preparing'
    });
  });

  // 7. Assert partner attempt to mutate entityId on assigned item is rejected (immutability check)
  await assertDenied('[8] Partner attempt to mutate item entityId rejected by immutability rule', async () => {
    await updateDoc(doc(db, 'orders', orderAId, 'items', itemAId), {
      entityId: 'entity-b'
    });
  });

  // Cleanup & Summary
  await signOut(auth);
  console.log(`\nPartner Accounts Test Suite Finished: ${passed} Passed, ${failed} Failed\n`);
  if (failed > 0) process.exit(1);
  process.exit(0);
})().catch(err => {
  console.error('Test suite exception:', err);
  process.exit(1);
});
