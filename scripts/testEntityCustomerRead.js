// scripts/testEntityCustomerRead.js
// Verifies the entities read rule: a signed-in CUSTOMER may get one entity
// by id (the Pay sheet needs its accepted payment methods + payment
// instructions) but may not list the collection or write to it; an
// unauthenticated client and a signed-in user with neither a customers/{uid}
// nor an active staff/{uid} doc can do none of it.
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
import { getFirestore, connectFirestoreEmulator, doc, getDoc, getDocs, setDoc, updateDoc, collection } from 'firebase/firestore';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, signOut } from 'firebase/auth';

import { initializeApp as adminInitializeApp } from 'firebase-admin/app';
import { getAuth as adminGetAuth } from 'firebase-admin/auth';
import { getFirestore as adminGetFirestore } from 'firebase-admin/firestore';

const [fsHost, fsPort] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
const authUrl = 'http://' + process.env.FIREBASE_AUTH_EMULATOR_HOST;

const app = initializeApp({ apiKey: 'demo-emulator-key', authDomain: PROJECT_ID + '.firebaseapp.com', projectId: PROJECT_ID });
const db = getFirestore(app);
const auth = getAuth(app);
connectFirestoreEmulator(db, fsHost, Number(fsPort));
connectAuthEmulator(auth, authUrl);

adminInitializeApp({ projectId: PROJECT_ID });
const aauth = adminGetAuth();
const adb = adminGetFirestore();

const ENTITY_ID = 'ent-customer-read-test';
const CUSTOMER_EMAIL = 'entityread-customer@test.local';
const STRANGER_EMAIL = 'entityread-stranger@test.local';
const PASSWORD = 'Test1234!';

let passed = 0;
let failed = 0;

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
    if (e.code === 'permission-denied' || (e.message && e.message.includes('PERMISSION_DENIED'))) {
      console.log('  PASS  ' + label); passed++;
    } else {
      console.error('  FAIL  ' + label + ' -- unexpected error: ' + e.message); failed++;
    }
  }
}

async function ensureUser(email) {
  try { const u = await aauth.getUserByEmail(email); await aauth.deleteUser(u.uid); } catch (e) { /* none */ }
  return aauth.createUser({ email, password: PASSWORD, emailVerified: true });
}

async function cleanup(uids) {
  await adb.collection('entities').doc(ENTITY_ID).delete().catch(() => {});
  for (const uid of uids) {
    await adb.collection('customers').doc(uid).delete().catch(() => {});
    await aauth.deleteUser(uid).catch(() => {});
  }
}

(async () => {
  const uids = [];
  try {
    const cust = await ensureUser(CUSTOMER_EMAIL);
    const stranger = await ensureUser(STRANGER_EMAIL);
    uids.push(cust.uid, stranger.uid);

    await adb.collection('customers').doc(cust.uid).set({
      id: cust.uid, firstName: 'Entity', lastName: 'Reader', name: 'Entity Reader',
      email: CUSTOMER_EMAIL, phone: '', registrationStatus: 'Approved', entityId: ENTITY_ID,
    });
    await adb.collection('entities').doc(ENTITY_ID).set({
      name: 'Customer Read Test Ltd', brn: 'C00000000', vatNumber: 'VAT00000000', bankReference: 'TEST',
      acceptedPaymentMethodIds: [], paymentMethodConfig: {}, active: true,
    });

    console.log('Entities read rule — customer access');

    await signOut(auth).catch(() => {});
    await assertDenied('[1] unauthenticated client cannot get an entity', () => getDoc(doc(db, 'entities', ENTITY_ID)));

    await signInWithEmailAndPassword(auth, STRANGER_EMAIL, PASSWORD);
    await assertDenied('[2] signed-in user with no customer/staff doc cannot get an entity', () => getDoc(doc(db, 'entities', ENTITY_ID)));

    await signOut(auth).catch(() => {});
    await signInWithEmailAndPassword(auth, CUSTOMER_EMAIL, PASSWORD);
    await assertAllowed('[3] customer can get one entity by id', async () => {
      const snap = await getDoc(doc(db, 'entities', ENTITY_ID));
      if (!snap.exists()) throw new Error('entity doc not found');
      if (snap.data().name !== 'Customer Read Test Ltd') throw new Error('unexpected entity data');
    });
    await assertDenied('[4] customer cannot list the entities collection', () => getDocs(collection(db, 'entities')));
    await assertDenied('[5] customer cannot update an entity', () => updateDoc(doc(db, 'entities', ENTITY_ID), { name: 'Hijacked' }));
    await assertDenied('[6] customer cannot create an entity', () => setDoc(doc(db, 'entities', 'ent-customer-created'), { name: 'Nope', active: true }));
  } catch (e) {
    console.error('Setup/teardown error:', e);
    failed++;
  } finally {
    await signOut(auth).catch(() => {});
    await cleanup(uids);
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})();
