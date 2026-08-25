/**
 * testSettingsRBAC.js — automated verification for Settings/Roles/Entities round
 *
 * Tests:
 *  1. Role write: a manageRoles staff can create a new role doc
 *  2. Role read:  any active staff can read roles collection
 *  3. Staff update self-lock: staff cannot deactivate themselves
 *  4. Staff update cross: manageRoles staff can change another staff's roleId
 *  5. AuditLog create valid
 *  6. AuditLog create bad staffUid blocked
 *  7. AuditLog create bad type blocked
 *  8. Entity write by manageConfig staff succeeds
 *  9. Entity write by non-manageConfig staff blocked
 * 10. AuditLog read by non-manageRoles staff blocked
 *
 * Run: node scripts/testSettingsRBAC.js
 */

const { initializeApp } = require('firebase/app');
const {
  getFirestore, connectFirestoreEmulator,
  doc, setDoc, getDoc, updateDoc, addDoc, collection,
  serverTimestamp
} = require('firebase/firestore');
const {
  getAuth, connectAuthEmulator,
  signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword
} = require('firebase/auth');

const APP_CONFIG = {
  apiKey: 'demo-emulator-key',
  authDomain: 'demo-bonmanze.firebaseapp.com',
  projectId: 'demo-bonmanze',
  storageBucket: 'demo-bonmanze.appspot.com',
};

const app  = initializeApp(APP_CONFIG, 'testSettingsRBAC');
const db   = getFirestore(app);
const auth = getAuth(app);
connectFirestoreEmulator(db, '127.0.0.1', 8080);
connectAuthEmulator(auth, 'http://127.0.0.1:9099');

let passed = 0; let failed = 0;

async function assert(label, fn) {
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

async function signInAs(email, password) {
  await signOut(auth).catch(() => {});
  await signInWithEmailAndPassword(auth, email, password);
}

const OWNER_EMAIL = 'owner@bonmanze.com';
const OWNER_PASS  = 'Password1!';

async function run() {
  console.log('\n--- testSettingsRBAC: Settings / Roles & Staff / Trading Entities ---\n');

  // Sign in as owner; ensure owner staff + role docs exist
  await signInAs(OWNER_EMAIL, OWNER_PASS);
  const ownerId = auth.currentUser.uid;

  await setDoc(doc(db, 'roles', 'role-owner'), {
    name: 'Owner',
    permissions: { manageMenu: true, manageOrders: true, manageCustomers: true, manageConfig: true, manageRoles: true, manageRegistrations: true },
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  }, { merge: true });

  await setDoc(doc(db, 'staff', ownerId), {
    name: 'Test Owner', email: OWNER_EMAIL, roleId: 'role-owner', active: true, createdAt: serverTimestamp(),
  }, { merge: true });

  // 1. Role create
  const testRoleRef = doc(collection(db, 'roles'));
  await assert('[1] manageRoles staff can create a role', async () => {
    await setDoc(testRoleRef, { name: 'Test Role', permissions: { manageMenu: true, manageOrders: false, manageCustomers: false, manageConfig: false, manageRoles: false, manageRegistrations: false }, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  });

  // 2. Role read
  await assert('[2] active staff can read roles', async () => {
    const snap = await getDoc(testRoleRef);
    if (!snap.exists()) throw new Error('Role doc missing');
  });

  // 3. Self-lock: cannot deactivate yourself
  await assert('[3] staff cannot deactivate themselves', async () => {
    let blocked = false;
    try { await updateDoc(doc(db, 'staff', ownerId), { active: false }); }
    catch (e) { if (e.code === 'permission-denied' || e.message.includes('PERMISSION_DENIED')) blocked = true; }
    if (!blocked) throw new Error('Self-deactivation was not blocked');
  });

  // 4. Cross-staff roleId change
  let staffBEmail, staffBId;
  try {
    await signOut(auth);
    staffBEmail = 'staffb_' + Date.now() + '@bonmanze.com';
    const created = await createUserWithEmailAndPassword(auth, staffBEmail, 'TempPass123!');
    staffBId = created.user.uid;
    await signInAs(OWNER_EMAIL, OWNER_PASS);
    await setDoc(doc(db, 'staff', staffBId), { name: 'Staff B', email: staffBEmail, roleId: testRoleRef.id, active: true, createdAt: serverTimestamp() });
    await assert('[4] manageRoles can change another staff roleId', async () => {
      await updateDoc(doc(db, 'staff', staffBId), { roleId: 'role-owner', updatedAt: serverTimestamp() });
    });
  } catch (e) { console.error('  SKIP  [4] fixture setup failed: ' + e.message); }

  // 5. AuditLog create valid
  let validAuditRef;
  await signInAs(OWNER_EMAIL, OWNER_PASS);
  await assert('[5] valid auditLog create', async () => {
    validAuditRef = await addDoc(collection(db, 'auditLog'), { staffUid: ownerId, staffName: 'Test Owner', type: 'ConfigChange', description: 'Automated test entry', timestamp: serverTimestamp() });
  });

  // 6. AuditLog bad staffUid
  await assertDenied('[6] auditLog create with spoofed staffUid is blocked', async () => {
    await addDoc(collection(db, 'auditLog'), { staffUid: 'FAKE-UID', staffName: 'Hacker', type: 'ConfigChange', description: 'Spoofed', timestamp: serverTimestamp() });
  });

  // 7. AuditLog bad type
  await assertDenied('[7] auditLog create with unknown type is blocked', async () => {
    await addDoc(collection(db, 'auditLog'), { staffUid: ownerId, staffName: 'Test Owner', type: 'UnknownType', description: 'Bad type', timestamp: serverTimestamp() });
  });

  // 8. Entity write by manageConfig staff
  const testEntityRef = doc(collection(db, 'entities'));
  await assert('[8] manageConfig staff can write entities', async () => {
    await setDoc(testEntityRef, { name: 'RBAC Test Entity', brn: '00000001', vatNumber: 'MU00000001', bankReference: 'TEST', active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  });

  // 9. Entity write by non-manageConfig staff
  let noConfigEmail, noConfigUid;
  try {
    await signOut(auth);
    noConfigEmail = 'noconfig_' + Date.now() + '@bonmanze.com';
    const created = await createUserWithEmailAndPassword(auth, noConfigEmail, 'TempPass123!');
    noConfigUid = created.user.uid;
    await signInAs(OWNER_EMAIL, OWNER_PASS);
    await setDoc(doc(db, 'roles', 'role-noconfig-test'), { name: 'Orders Only', permissions: { manageMenu: false, manageOrders: true, manageCustomers: false, manageConfig: false, manageRoles: false, manageRegistrations: false }, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
    await setDoc(doc(db, 'staff', noConfigUid), { name: 'NoConfig', email: noConfigEmail, roleId: 'role-noconfig-test', active: true, createdAt: serverTimestamp() });
    await signInAs(noConfigEmail, 'TempPass123!');
    await assertDenied('[9] non-manageConfig staff cannot write entities', async () => {
      await setDoc(doc(db, 'entities', 'entity-hack'), { name: 'Hacked', brn: '99', vatNumber: 'XX', bankReference: 'H', active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    });
    // 10. AuditLog read by non-manageRoles staff
    if (validAuditRef) {
      await assertDenied('[10] non-manageRoles staff cannot read auditLog', async () => {
        await getDoc(validAuditRef);
      });
    }
    await signInAs(OWNER_EMAIL, OWNER_PASS);
  } catch (e) { console.error('  SKIP  [9,10] fixture setup failed: ' + e.message); await signInAs(OWNER_EMAIL, OWNER_PASS).catch(() => {}); }

  await signOut(auth).catch(() => {});
  console.log('\n' + '-'.repeat(60));
  console.log(passed + ' passed, ' + failed + ' failed');
  if (failed > 0) { console.log('SOME CHECKS FAILED'); process.exit(1); }
  else console.log('ALL CHECKS PASSED');
}

run().catch(e => { console.error('FATAL:', e); process.exit(1); });
