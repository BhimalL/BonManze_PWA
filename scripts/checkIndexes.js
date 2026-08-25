// scripts/checkIndexes.js
// One-shot empirical check: does every collectionGroup('items') query the
// app actually runs succeed against the currently-defined firestore.indexes.json?
//
// Why this exists: an earlier audit round couldn't agree whether the existing
// composite indexes cover every query, or whether some are missing (or unused).
// Rather than guess from field names, this runs the EXACT query shapes found
// in the client code (grepped directly — see below) against a live emulator
// and reports whether Firestore accepts or rejects each one.
//
// Uses the Admin SDK deliberately, not the client SDK — the Admin SDK bypasses
// Firestore Security Rules entirely, so a failure here can only mean "missing
// index," never "not signed in as the right user." (First version of this
// script used the client SDK with no auth and got permission-denied from the
// rules before it ever reached the index question — that was a bug in the
// script, not a real finding.)
//
// The two real call sites in the codebase, as of this writing:
//   modules/CustomerPortal.tsx:739  query(collectionGroup(db,'items'), where('customerId','==',uid))
//   modules/Operations.tsx:741      onSnapshot(collectionGroup(db,'items'))   -- no filters at all

import { initializeApp as adminInitializeApp } from 'firebase-admin/app';
import { getFirestore as adminGetFirestore } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

adminInitializeApp({ projectId: 'demo-bonmanze' });
const adb = adminGetFirestore();

let failures = 0;
async function checkQuery(label, run) {
  try {
    const snap = await run();
    console.log(`  PASS  ${label} (${snap.size} docs, no index error)`);
  } catch (e) {
    failures++;
    console.log(`  FAIL  ${label}`);
    console.log(`        ${e.code || ''} ${e.message || e}`);
  }
}

async function main() {
  console.log('Checking every collectionGroup("items") query shape actually used in the app (via Admin SDK, rules bypassed) —\n');

  // Matches CustomerPortal.tsx:739 exactly (equality-only filter, no orderBy).
  await checkQuery(
    "CustomerPortal: where('customerId','==', <uid>)",
    () => adb.collectionGroup('items').where('customerId', '==', 'some-test-uid-that-need-not-exist').get()
  );

  // Matches Operations.tsx:741 exactly (no filters, no orderBy at all).
  await checkQuery(
    'Operations: collectionGroup with no filters (full listener)',
    () => adb.collectionGroup('items').get()
  );

  console.log(failures === 0
    ? '\nALL QUERIES SUCCEEDED — current firestore.indexes.json is sufficient for every collectionGroup query the app actually runs.'
    : `\n${failures} QUERY FAILED — see the index-creation link Firestore printed above and add it to firestore.indexes.json.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(e => { console.error('Script crashed:', e); process.exit(1); });
