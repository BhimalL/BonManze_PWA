// firebaseClient.ts
//
// Client-side Firebase wiring for the Customer App — the first time the
// actual React app talks to Firebase directly. Everything before this
// (registerCustomer, the Firestore migrations, the seed scripts) ran only
// from Node scripts using the Admin SDK, which bypasses security rules
// entirely. This file uses the regular Web SDK instead, the same one a
// real customer's browser would use, so it's actually subject to
// firestore.rules/storage.rules rather than working around them.
//
// There is no real Firebase project yet (see BonManzE_Firestore_Schema.md
// §6, step 7) — local dev always points at the Firebase Local Emulator
// Suite (see firebase.json), using the same "demo-bonmanze" project id as
// .firebaserc. The Web SDK only needs real config values once actually
// talking to production; the placeholders below are fine for emulator use
// (the emulators don't check them). import.meta.env.DEV is true under
// `npm run dev` (Vite) and false in a production build — revisit this
// file's emulator-connection block when step 7 (a real Firebase project)
// actually happens.

import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'demo-emulator-key',
  authDomain: 'demo-bonmanze.firebaseapp.com',
  projectId: 'demo-bonmanze',
  storageBucket: 'demo-bonmanze.appspot.com',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const storage = getStorage(app);

if (import.meta.env.DEV) {
  // connectAuthEmulator takes one full URL string, unlike the other two
  // (host, port) — an inconsistency in the SDK itself, not a typo here.
  connectAuthEmulator(auth, 'http://127.0.0.1:9099');
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
}
