// scripts/seedBootstrap.js
//
// One-time bootstrap: creates the "Owner" role (every permission true) and
// a staff account for Bhimal, written directly via the Admin SDK — the one
// legitimate way to create the very first roles/staff docs, since nothing
// in the app itself can: editing roles or staff requires the manageRoles
// permission, and manageRoles doesn't exist until this script creates it
// (see BonManzE_Firestore_Schema.md, "Bootstrap problem").
//
// The Admin SDK bypasses firestore.rules entirely, which is exactly why
// this has to be a script run by a human with access to the machine, not
// something exposed through the app's own UI.
//
// HOW TO RUN:
//   1. Make sure the Firebase Emulator Suite is already running in one
//      terminal (npx firebase emulators:start).
//   2. In a SECOND terminal, from the repo root, run once:
//        npm install firebase-admin --save-dev
//   3. Edit OWNER_EMAIL / OWNER_PASSWORD below if you want something other
//      than the placeholders.
//   4. Run:  node scripts/seedBootstrap.js
//
// Safe to re-run — it looks for an existing Owner role / staff account
// first and leaves them alone rather than creating duplicates.
//
// Uses ES module import syntax (not require) because this repo's
// package.json has "type": "module", which makes Node treat every .js
// file as an ES module.

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

initializeApp({ projectId: 'demo-bonmanze' });

const db = getFirestore();
const auth = getAuth();

// ---- Edit these before running if you want different values ----
const OWNER_EMAIL = 'bhimalonly@gmail.com';
const OWNER_PASSWORD = 'ChangeMe123!'; // placeholder — change this by hand in the emulator's Auth UI after running
const OWNER_NAME = 'BhimalL';
// -------------------------------------------------------------------

const ALL_PERMISSIONS = {
  manageMenu: true,
  manageOrders: true,
  manageCustomers: true,
  manageConfig: true,
  manageRoles: true,
};

async function main() {
  // 1. Owner role
  const rolesSnap = await db.collection('roles').where('name', '==', 'Owner').limit(1).get();
  let roleId;
  if (!rolesSnap.empty) {
    roleId = rolesSnap.docs[0].id;
    console.log(`Owner role already exists (${roleId}) — leaving it as-is.`);
  } else {
    const roleRef = await db.collection('roles').add({
      name: 'Owner',
      permissions: ALL_PERMISSIONS,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    roleId = roleRef.id;
    console.log(`Created Owner role: ${roleId}`);
  }

  // 2. Auth user
  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(OWNER_EMAIL);
    console.log(`Auth user already exists: ${userRecord.uid}`);
  } catch (e) {
    userRecord = await auth.createUser({
      email: OWNER_EMAIL,
      password: OWNER_PASSWORD,
      displayName: OWNER_NAME,
    });
    console.log(`Created Auth user: ${userRecord.uid}`);
  }

  // 3. Staff doc
  const staffRef = db.collection('staff').doc(userRecord.uid);
  const staffDoc = await staffRef.get();
  if (staffDoc.exists) {
    console.log('Staff doc already exists — leaving it as-is.');
  } else {
    await staffRef.set({
      name: OWNER_NAME,
      email: OWNER_EMAIL,
      roleId,
      active: true,
      createdAt: Timestamp.now(),
    });
    console.log(`Created staff doc for ${userRecord.uid}, linked to role ${roleId}`);
  }

  console.log('\nDone. Sign in to the app (once staff login exists) with:');
  console.log(`  email:    ${OWNER_EMAIL}`);
  console.log(`  password: ${OWNER_PASSWORD}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed script failed:', err);
    process.exit(1);
  });
