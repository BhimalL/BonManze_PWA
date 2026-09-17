// scripts/testDeliveryPaymentsRBAC.js
// ESM verification for Delivery & Payments Security Rules

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, getDoc, updateDoc } from 'firebase/firestore';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, signOut } from 'firebase/auth';

import { initializeApp as adminInitializeApp, getApps as adminGetApps } from 'firebase-admin/app';
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

connectFirestoreEmulator(db, '127.0.0.1', 8080);
connectAuthEmulator(auth, 'http://127.0.0.1:9099');

if (adminGetApps().length === 0) {
  adminInitializeApp({ projectId: 'demo-bonmanze' });
}
const aauth = adminGetAuth();
const adb = adminGetFirestore();

let passed = 0;
let failed = 0;

async function assert(label, fn) {
  try {
    await fn();
    console.log('  PASS  ' + label);
    passed++;
  } catch (e) {
    console.error('  FAIL  ' + label + ' -- ' + e.message);
    failed++;
  }
}

async function assertDenied(label, fn) {
  try {
    await fn();
    console.error('  FAIL  ' + label + ' -- expected PERMISSION_DENIED but operation succeeded');
    failed++;
  } catch (e) {
    if (e.code === 'permission-denied' || (e.message && e.message.includes('PERMISSION_DENIED'))) {
      console.log('  PASS  ' + label + ' (correctly rejected with PERMISSION_DENIED)');
      passed++;
    } else {
      console.error('  FAIL  ' + label + ' -- unexpected error: ' + e.message);
      failed++;
    }
  }
}

async function signInAs(email, password) {
  await signOut(auth).catch(() => {});
  await signInWithEmailAndPassword(auth, email, password);
}

async function teardownUserByEmail(email) {
  try {
    const user = await aauth.getUserByEmail(email);
    await adb.collection('staff').doc(user.uid).delete().catch(() => {});
    await adb.collection('customers').doc(user.uid).delete().catch(() => {});
    await aauth.deleteUser(user.uid).catch(() => {});
  } catch (e) {}
}

async function setupUser(email, pass, staffData, customerData) {
  await teardownUserByEmail(email);
  const user = await aauth.createUser({ email, password: pass, displayName: email.split('@')[0] });
  const uid = user.uid;
  if (staffData) {
    await adb.collection('staff').doc(uid).set({ active: true, isOwner: false, ...staffData, email });
  }
  if (customerData) {
    await adb.collection('customers').doc(uid).set({ ...customerData, email }, { merge: true });
  }
  return uid;
}

(async () => {
  console.log('\n--- Running Delivery & Payments Security Rules Verification Suite ---\n');

  // Ensure emulator is running the latest firestore.rules from disk
  try {
    const fs = await import('fs');
    const path = await import('path');
    const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
    if (fs.existsSync(rulesPath)) {
      const rulesContent = fs.readFileSync(rulesPath, 'utf8');
      await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-bonmanze:reloadRules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ignore_errors: false,
          rules: { files: [{ name: 'firestore.rules', content: rulesContent }] },
        }),
      });
      console.log('Successfully reloaded firestore.rules into emulator.');
    }
  } catch (e) {
    console.warn('Note: Could not reload firestore.rules via API:', e.message);
  }

  // 1. Setup Roles in Firestore via Admin SDK
  await adb.collection('roles').doc('role-driver-test').set({
    name: 'Driver Role',
    permissions: {
      deliveryList: { view: true, edit: true },
      payments: { view: true, edit: false },
    },
  });

  await adb.collection('roles').doc('role-cashier-test').set({
    name: 'Cashier Role',
    permissions: {
      deliveryList: { view: true, edit: true },
      payments: { view: true, edit: true },
    },
  });

  await adb.collection('roles').doc('role-viewonly-test').set({
    name: 'View Only Role',
    permissions: {
      deliveryList: { view: true, edit: false },
      payments: { view: true, edit: false },
    },
  });

  // 2. Setup Test Users
  const driver1Email = 'driver1-test@bonmanze.com';
  const driver2Email = 'driver2-test@bonmanze.com';
  const cashier1Email = 'cashier1-test@bonmanze.com';
  const viewonly1Email = 'viewonly1-test@bonmanze.com';
  const customer1Email = 'customer1-test@bonmanze.com';
  const TEST_PASS = 'Password1!';

  const driver1Uid = await setupUser(driver1Email, TEST_PASS, { name: 'Driver 1', roleId: 'role-driver-test', isDriver: true });
  const driver2Uid = await setupUser(driver2Email, TEST_PASS, { name: 'Driver 2', roleId: 'role-driver-test', isDriver: true });
  const cashier1Uid = await setupUser(cashier1Email, TEST_PASS, { name: 'Cashier 1', roleId: 'role-cashier-test', isDriver: false });
  const viewonly1Uid = await setupUser(viewonly1Email, TEST_PASS, { name: 'View Only 1', roleId: 'role-viewonly-test', isDriver: false });
  const customer1Uid = await setupUser(customer1Email, TEST_PASS, null, { name: 'Customer 1' });

  // 3. Setup Order & Items Fixtures
  const orderId = 'ord-deliv-test-1';
  await adb.collection('orders').doc(orderId).set({
    customerId: customer1Uid,
    entityId: 'entity-a',
    status: 'Active',
    total: 1000,
  });

  const baseItemData = {
    customerId: customer1Uid,
    entityId: 'entity-a',
    name: 'Chicken Curry Meal',
    price: 250,
    qty: 1,
    status: 'En route',
    paymentStatus: 'Pending',
    deliveryDate: '2026-09-17',
    serviceSlot: 'Lunch',
    paymentPaidAmount: null,
    paymentWrittenOff: null,
    invoiceNumber: null,
    invoiceIssuedAt: null,
    invoiceReprintCount: 0,
  };

  const item1Path = `orders/${orderId}/items/item-driver1-assigned`;
  const item2Path = `orders/${orderId}/items/item-driver2-assigned`;
  const itemUnassignedPath = `orders/${orderId}/items/item-unassigned`;

  const resetItems = async () => {
    await adb.doc(item1Path).set({ ...baseItemData, assignedDriverId: driver1Uid });
    await adb.doc(item2Path).set({ ...baseItemData, assignedDriverId: driver2Uid });
    await adb.doc(itemUnassignedPath).set({ ...baseItemData, assignedDriverId: null });
  };

  await resetItems();

  // --- SCENARIO 1: Driver Deliver + Claim Write (Happy Path) ---
  console.log('1. Driver Deliver + Claim Write (Happy Path):');
  await signInAs(driver1Email, TEST_PASS);
  await assert('Driver 1 marks assigned item Delivered & records payment claim', async () => {
    await updateDoc(doc(db, item1Path), {
      status: 'Completed',
      paymentClaimedBy: 'driver',
      paymentClaimedByStaffId: driver1Uid,
      paymentMethodName: 'Cash',
      paymentReference: 'PAY-12345',
      paymentIssueAmount: 250,
      paymentIssueNote: 'Collected at door',
    });
  });

  // --- SCENARIO 2: Driver Deliver + Claim Write (Forbidden Modifications) ---
  console.log('\n2. Driver Deliver + Claim Write (Forbidden Modifications):');
  await resetItems();
  await signInAs(driver1Email, TEST_PASS);
  const itemSnap = await getDoc(doc(db, item1Path));
  const staffSnap = await adb.collection('staff').doc(driver1Uid).get();

  await assertDenied('Driver attempts to set paymentPaidAmount directly', async () => {
    try {
      await updateDoc(doc(db, item1Path), {
        status: 'Completed',
        paymentClaimedBy: 'driver',
        paymentClaimedByStaffId: driver1Uid,
        paymentPaidAmount: 250,
      });
    } catch (e) {
      throw e;
    }
  });

  await assertDenied('Driver attempts to set paymentWrittenOff directly', async () => {
    await updateDoc(doc(db, item1Path), {
      status: 'Completed',
      paymentClaimedBy: 'driver',
      paymentClaimedByStaffId: driver1Uid,
      paymentWrittenOff: true,
    });
  });

  await assertDenied('Driver attempts to alter paymentStatus to Paid', async () => {
    await updateDoc(doc(db, item1Path), {
      status: 'Completed',
      paymentStatus: 'Paid',
    });
  });

  await assertDenied('Driver attempts to alter item price or quantity', async () => {
    await updateDoc(doc(db, item1Path), {
      status: 'Completed',
      price: 999,
    });
  });

  await assertDenied('Driver 1 attempts to update Driver 2 assigned item', async () => {
    await updateDoc(doc(db, item2Path), {
      status: 'Completed',
      paymentClaimedBy: 'driver',
      paymentClaimedByStaffId: driver1Uid,
    });
  });

  await assertDenied('Driver 1 attempts to update unassigned item', async () => {
    await updateDoc(doc(db, itemUnassignedPath), {
      status: 'Completed',
      paymentClaimedBy: 'driver',
      paymentClaimedByStaffId: driver1Uid,
    });
  });

  // --- SCENARIO 3: Customer Self-Claim Write (Forbidden Fields) ---
  console.log('\n3. Customer Self-Claim Write (Forbidden Fields):');
  await resetItems();
  await signInAs(customer1Email, TEST_PASS);

  await assert('Customer submits legitimate payment claim reference', async () => {
    await updateDoc(doc(db, item1Path), {
      paymentMethodName: 'Juice',
      paymentReference: 'CUST-JUICE-999',
    });
  });

  await assertDenied('Customer attempts to modify paymentPaidAmount on self-claim', async () => {
    await updateDoc(doc(db, item1Path), {
      paymentMethodName: 'Juice',
      paymentReference: 'CUST-JUICE-999',
      paymentPaidAmount: 250,
    });
  });

  await assertDenied('Customer attempts to modify paymentWrittenOff on self-claim', async () => {
    await updateDoc(doc(db, item1Path), {
      paymentMethodName: 'Juice',
      paymentReference: 'CUST-JUICE-999',
      paymentWrittenOff: true,
    });
  });

  // --- SCENARIO 4: Resolve / Write Off by Cashier (payments.edit = true) ---
  console.log('\n4. Resolve / Write Off by Cashier (payments.edit = true):');
  await resetItems();
  await signInAs(cashier1Email, TEST_PASS);

  await assert('Cashier (payments.edit) confirms payment & sets paymentPaidAmount', async () => {
    await updateDoc(doc(db, item1Path), {
      paymentStatus: 'Paid',
      paymentPaidAmount: 250,
      paymentMethodName: 'Cash',
    });
  });

  await resetItems();
  await signInAs(cashier1Email, TEST_PASS);

  await assert('Cashier (payments.edit) writes off balance with paymentWrittenOff', async () => {
    await updateDoc(doc(db, item1Path), {
      paymentStatus: 'Paid',
      paymentPaidAmount: 100,
      paymentWrittenOff: true,
    });
  });

  // --- SCENARIO 5: Resolve / Write Off by Non-Cashier (payments.edit = false) ---
  console.log('\n5. Resolve / Write Off by Non-Cashier Staff (payments.edit = false):');
  await resetItems();
  await signInAs(driver1Email, TEST_PASS);

  await assertDenied('Driver (no payments.edit) attempts to set paymentPaidAmount', async () => {
    await updateDoc(doc(db, item1Path), {
      paymentStatus: 'Paid',
      paymentPaidAmount: 250,
    });
  });

  await signInAs(viewonly1Email, TEST_PASS);

  await assertDenied('View-only staff (no payments.edit) attempts to set paymentWrittenOff', async () => {
    await updateDoc(doc(db, item1Path), {
      paymentStatus: 'Paid',
      paymentWrittenOff: true,
    });
  });

  // --- SCENARIO 6: Reprint Count Bump & Protected Fields Defense ---
  console.log('\n6. Reprint Count Bump Constraints:');
  await resetItems();
  await signInAs(viewonly1Email, TEST_PASS);

  await assert('View-only staff increments invoiceReprintCount', async () => {
    await updateDoc(doc(db, item1Path), {
      invoiceReprintCount: 1,
    });
  });

  await assertDenied('Reprint bump attempt touching paymentPaidAmount fails', async () => {
    await updateDoc(doc(db, item1Path), {
      invoiceReprintCount: 2,
      paymentPaidAmount: 500,
    });
  });

  await assertDenied('Reprint bump attempt touching paymentWrittenOff fails', async () => {
    await updateDoc(doc(db, item1Path), {
      invoiceReprintCount: 2,
      paymentWrittenOff: true,
    });
  });

  console.log(`\nDelivery & Payments RBAC Summary: ${passed} passed, ${failed} failed.\n`);

  if (failed > 0) {
    process.exit(1);
  }
})();
