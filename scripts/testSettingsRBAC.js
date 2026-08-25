// scripts/testSettingsRBAC.js
// ESM verification for Settings/Roles/Entities round

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, updateDoc, deleteDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
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
    console.error("  FAIL  " + label + " -- expected PERMISSION_DENIED but succeeded");
    failed++;
  } catch (e) {
    if (e.code === 'permission-denied' || (e.message && e.message.includes('PERMISSION_DENIED'))) {
      console.log("  PASS  " + label);
      passed++;
    } else {
      console.error("  FAIL  " + label + " -- unexpected error: " + e.message);
      failed++;
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

  // Setup/Upsert Owner in emulator Auth
  let ownerId;
  try {
    const user = await aauth.getUserByEmail(OWNER_EMAIL);
    ownerId = user.uid;
  } catch (e) {
    const user = await aauth.createUser({
      email: OWNER_EMAIL,
      password: OWNER_PASS,
      displayName: 'Owner'
    });
    ownerId = user.uid;
  }

  // Ensure owner staff doc and owner role exist
  await adb.collection('roles').doc('role-owner').set({
    name: 'Owner',
    permissions: { manageMenu: true, manageOrders: true, manageCustomers: true, manageConfig: true, manageRoles: true, manageRegistrations: true },
    createdAt: new Date(), updatedAt: new Date(),
  }, { merge: true });

  await adb.collection('staff').doc(ownerId).set({
    name: 'Test Owner', email: OWNER_EMAIL, roleId: 'role-owner', active: true, createdAt: new Date(),
  }, { merge: true });

  // Sign in on client
  await signInAs(OWNER_EMAIL, OWNER_PASS);

  // 1. Role create
  const testRoleRef = doc(collection(db, 'roles'));
  await assert('[1] manageRoles staff can create a role', async () => {
    await setDoc(testRoleRef, {
      name: 'Test Role',
      permissions: { manageMenu: true, manageOrders: false, manageCustomers: false, manageConfig: false, manageRoles: false, manageRegistrations: false },
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
  });

  // 2. Role read
  await assert('[2] active staff can read roles', async () => {
    const snap = await getDoc(testRoleRef);
    if (!snap.exists()) throw new Error('Role doc missing');
  });

  // 3. Self-lock: cannot deactivate yourself
  await assert('[3] staff cannot deactivate themselves', async () => {
    let blocked = false;
    try {
      await updateDoc(doc(db, 'staff', ownerId), { active: false });
    } catch (e) {
      if (e.code === 'permission-denied' || e.message.includes('PERMISSION_DENIED')) blocked = true;
    }
    if (!blocked) throw new Error('Self-deactivation was not blocked');
  });

  // 3b. Self-lock: cannot change your own roleId
  await assert('[3b] staff cannot change their own roleId', async () => {
    let blocked = false;
    try {
      await updateDoc(doc(db, 'staff', ownerId), { roleId: 'role-some-other' });
    } catch (e) {
      if (e.code === 'permission-denied' || e.message.includes('PERMISSION_DENIED')) blocked = true;
    }
    if (!blocked) throw new Error('Self-roleId-change was not blocked');
  });

  // 4. Cross-staff creation via createStaffMember Cloud Function and verify
  let staffBId;
  const staffBEmail = "staffb_" + Date.now() + "@bonmanze.com";
  await assert('[4] manageRoles can create another staff via Cloud Function', async () => {
    const fn = httpsCallable(functions, 'createStaffMember');
    const res = await fn({
      name: 'Staff B',
      email: staffBEmail,
      password: 'TempPass123!',
      roleId: testRoleRef.id
    });
    staffBId = res.data.uid;
    if (!staffBId) throw new Error('No UID returned by function');
  });

  // 5. AuditLog create valid
  let validAuditRef;
  await assert('[5] valid auditLog create', async () => {
    validAuditRef = await addDoc(collection(db, 'auditLog'), {
      staffUid: ownerId,
      staffName: 'Test Owner',
      type: 'ConfigChange',
      description: 'Automated test entry',
      timestamp: serverTimestamp()
    });
  });

  // 6. AuditLog bad staffUid
  await assertDenied('[6] auditLog create with spoofed staffUid is blocked', async () => {
    await addDoc(collection(db, 'auditLog'), {
      staffUid: 'FAKE-UID',
      staffName: 'Hacker',
      type: 'ConfigChange',
      description: 'Spoofed',
      timestamp: serverTimestamp()
    });
  });

  // 7. AuditLog bad type
  await assertDenied('[7] auditLog create with unknown type is blocked', async () => {
    await addDoc(collection(db, 'auditLog'), {
      staffUid: ownerId,
      staffName: 'Test Owner',
      type: 'UnknownType',
      description: 'Bad type',
      timestamp: serverTimestamp()
    });
  });

  // 8. Entity write by manageConfig staff
  const testEntityRef = doc(collection(db, 'entities'));
  await assert('[8] manageConfig staff can write entities', async () => {
    await setDoc(testEntityRef, {
      name: 'RBAC Test Entity',
      brn: '00000001',
      vatNumber: 'MU00000001',
      bankReference: 'TEST',
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  });

  // 9. Entity write by non-manageConfig staff
  let noConfigEmail = "noconfig_" + Date.now() + "@bonmanze.com";
  let noConfigUid;
  try {
    // create a non-admin role & staff
    const fn = httpsCallable(functions, 'createStaffMember');
    const newRoleRef = doc(collection(db, 'roles'));
    await setDoc(newRoleRef, {
      name: 'Orders Only',
      permissions: { manageMenu: false, manageOrders: true, manageCustomers: false, manageConfig: false, manageRoles: false, manageRegistrations: false },
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    
    const res = await fn({
      name: 'NoConfig',
      email: noConfigEmail,
      password: 'TempPass123!',
      roleId: newRoleRef.id
    });
    noConfigUid = res.data.uid;

    // sign in as the noConfig user
    await signInAs(noConfigEmail, 'TempPass123!');

    // 2b. Role read by low-privilege staff member
    await assert('[2b] low-privilege active staff can read their own role document', async () => {
      const snap = await getDoc(newRoleRef);
      if (!snap.exists()) throw new Error('Role doc missing');
    });

    await assertDenied('[9] non-manageConfig staff cannot write entities', async () => {
      await setDoc(doc(db, 'entities', 'entity-hack'), {
        name: 'Hacked',
        brn: '99',
        vatNumber: 'XX',
        bankReference: 'H',
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });

    // 10. AuditLog read by non-manageRoles staff
    if (validAuditRef) {
      await assertDenied('[10] non-manageRoles staff cannot read auditLog', async () => {
        await getDoc(validAuditRef);
      });
    }

    // 11a. Role delete by non-manageRoles staff (noConfig user)
    await assertDenied('[11a] non-manageRoles staff cannot delete roles', async () => {
      await deleteDoc(newRoleRef);
    });

    // 11b. Role delete by manageRoles staff (Owner)
    await signInAs(OWNER_EMAIL, OWNER_PASS);
    await assert('[11b] manageRoles staff can delete unassigned role', async () => {
      const tempRoleRef = doc(collection(db, 'roles'));
      await setDoc(tempRoleRef, {
        name: 'Temp Role to Delete',
        permissions: { manageMenu: false, manageOrders: false, manageCustomers: false, manageConfig: false, manageRoles: false, manageRegistrations: false },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      await deleteDoc(tempRoleRef);
    });

  } catch (e) {
    console.error("  FAIL  [2b,9,10,11] fixture setup or tests failed: " + e.message);
  }

  // clean up signout
  await signOut(auth).catch(() => {});
  console.log('\n' + '-'.repeat(60));
  console.log(passed + ' passed, ' + failed + ' failed');
  if (failed > 0) {
    console.log('SOME CHECKS FAILED');
    process.exit(1);
  } else {
    console.log('ALL CHECKS PASSED');
  }
}

run().catch(e => { console.error('FATAL:', e); process.exit(1); });
