// functions/index.js
//
// BonManzE Cloud Functions. First function this project has: registerCustomer
// — the one piece of customer registration that has to run server-side, per
// BonManzE_Firestore_Schema.md §2. Everything else about the schema's
// server-side-only list (§4: order totals, loyalty updates) is a later step
// (step 6 of the build sequence) — this file only covers step 5.
//
// The Firebase emulator suite auto-wires FIRESTORE_EMULATOR_HOST /
// FIREBASE_AUTH_EMULATOR_HOST for code running inside the Functions
// emulator when other emulators are running in the same
// `firebase emulators:start` session — no manual env var setup needed here
// the way the standalone scripts/*.js files had to do it themselves.
//
// Uses ES module import syntax — functions/package.json has its own
// "type": "module", independent of the repo root's.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

initializeApp();

const auth = getAuth();
const db = getFirestore();

const USERNAME_PATTERN = /^[a-z0-9_.]+$/;

// registerCustomer — callable. See BonManzE_Firestore_Schema.md §2 for why
// this can't be a client-only createUserWithEmailAndPassword + a separate
// usernames/{username} write: claiming a username has to be atomic with
// creating the account, or two people racing for the same username could
// both believe they got it, and a client can't safely undo creating the
// Auth user if writing the username/customer docs afterward fails.
export const registerCustomer = onCall(async (request) => {
  const { username, email, password, firstName, lastName, phone } = request.data || {};

  // ---- Validate input ----
  if (typeof username !== 'string' || username.trim().length < 3) {
    throw new HttpsError('invalid-argument', 'Username must be at least 3 characters.');
  }
  const normalizedUsername = username.trim().toLowerCase();
  if (!USERNAME_PATTERN.test(normalizedUsername)) {
    throw new HttpsError('invalid-argument', 'Username may only contain letters, numbers, underscores, and periods.');
  }
  if (typeof email !== 'string' || !email.includes('@')) {
    throw new HttpsError('invalid-argument', 'A valid email is required.');
  }
  if (typeof password !== 'string' || password.length < 6) {
    throw new HttpsError('invalid-argument', 'Password must be at least 6 characters.');
  }
  if (typeof firstName !== 'string' || !firstName.trim()) {
    throw new HttpsError('invalid-argument', 'First name is required.');
  }
  if (typeof lastName !== 'string' || !lastName.trim()) {
    throw new HttpsError('invalid-argument', 'Last name is required.');
  }

  const usernameRef = db.collection('usernames').doc(normalizedUsername);

  // ---- Step 1: quick check (nice error message in the common case — the
  // real, race-safe check happens inside the transaction in step 3). ----
  const preCheckSnap = await usernameRef.get();
  if (preCheckSnap.exists) {
    throw new HttpsError('already-exists', 'That username is already taken.');
  }

  // ---- Step 2: create the Firebase Auth user ----
  let userRecord;
  try {
    userRecord = await auth.createUser({
      email,
      password,
      displayName: `${firstName.trim()} ${lastName.trim()}`,
    });
  } catch (err) {
    if (err && err.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'An account with that email already exists.');
    }
    throw new HttpsError('internal', 'Could not create the account.');
  }

  // ---- Step 3: atomically re-check the username and write customers/{uid}
  // + usernames/{username} together. A transaction (not a plain batch)
  // because the real safety property is "no two registrations can both
  // succeed in claiming the same username" — a transaction that re-reads
  // usernameRef and fails if it's now taken closes the race a plain
  // get()-then-write can't. ----
  try {
    await db.runTransaction(async (tx) => {
      const usernameSnap = await tx.get(usernameRef);
      if (usernameSnap.exists) {
        throw new HttpsError('already-exists', 'That username is already taken.');
      }
      const now = Timestamp.now();
      tx.set(db.collection('customers').doc(userRecord.uid), {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        name: `${firstName.trim()} ${lastName.trim()}`,
        email,
        phone: typeof phone === 'string' ? phone : '',
        addresses: [],
        points: 0,
        storeCredit: 0,
        tier: 't1', // Bronze — see loyaltyTiers/current, item id t1
        ltv: 0,
        avatar: '',
        referenceCode: normalizedUsername.toUpperCase(),
        gdprConsent: { marketing: false, sms: false, dataProcessing: true },
        createdAt: now,
        updatedAt: now,
      });
      tx.set(usernameRef, {
        uid: userRecord.uid,
        email,
        createdAt: now,
      });
    });
  } catch (err) {
    // Step 3 failed (lost the username race, or any other error) — delete
    // the Auth user created in step 2 rather than leave an orphaned account
    // with no customer/username doc behind it. Per the schema doc, this is
    // the whole reason registration has to be a Function and not a raw
    // client call: a client can't safely do this rollback itself.
    await auth.deleteUser(userRecord.uid).catch(() => {});
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', 'Could not finish registration — please try again.');
  }

  return { uid: userRecord.uid };
});
