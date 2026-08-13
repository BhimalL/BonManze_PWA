// scripts/seedCustomers.js
//
// One-time seed: creates real Firebase Auth + Firestore accounts for the 3
// mock customers that have lived in modules/store.ts's GLOBAL_CUSTOMERS
// constant since before any backend existed (Marcus Sterling, Eleanor Fant,
// Sarah Connor) — so there's real customer data to develop and test against
// once the Customer App is wired to Firestore, without waiting on real
// signups. Values below copied verbatim from modules/store.ts on
// 2026-08-13.
//
// These are NOT real people or real credentials — the passwords below are
// fixed test-fixture placeholders, fine to commit (unlike Bhimal's own seed
// password in scripts/seedBootstrap.js, which stays a placeholder in the
// script and is set by hand in the emulator UI for exactly this reason).
//
// Usernames are simply each customer's lowercased first name — there's no
// real registration flow being exercised here, just fixture data, so
// there's no need to invent anything fancier.
//
// tier/group are stored in modules/store.ts as display names ("Diamond",
// "VIP", etc.) but the schema stores them as ids referencing
// loyaltyTiers/current and customerGroups/current (migrated in an earlier
// step) — TIER_NAME_TO_ID / GROUP_NAME_TO_ID below do that mapping once,
// here, rather than leaving it to whichever future script or Cloud
// Function reads this data next.
//
// Safe to re-run — looks for an existing Auth user by email first and
// leaves it alone, same pattern as seedBootstrap.js.
//
// Uses ES module import syntax (not require) because this repo's
// package.json has "type": "module".
//
// HOW TO RUN:
//   1. Make sure the Firebase Emulator Suite is running (npm run emulators).
//   2. From the repo root, in a second terminal:  node scripts/seedCustomers.js

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

initializeApp({ projectId: 'demo-bonmanze' });

const db = getFirestore();
const auth = getAuth();

const TIER_NAME_TO_ID = { Bronze: 't1', Silver: 't2', Gold: 't3', Diamond: 't4' };
const GROUP_NAME_TO_ID = { 'ABC Motors Co Ltd': 'g1', Corporate: 'g2', VIP: 'g3' };

// ---- Copied verbatim from modules/store.ts's GLOBAL_CUSTOMERS ----
const MOCK_CUSTOMERS = [
  {
    username: 'marcus',
    password: 'BonManzeTest1!',
    firstName: 'Marcus', lastName: 'Sterling', name: 'Marcus Sterling',
    email: 'm.sterling@outlook.com', phone: '+230 5765 4321',
    segment: 'VIP', group: 'VIP', lastOrder: '2023-10-15',
    ltv: 45000, points: 10450, storeCredit: 1250.00, tier: 'Diamond',
    birthday: '1990-06-12', avatar: 'https://picsum.photos/seed/m/100/100',
    referenceCode: 'MARC-VIP-1',
    gdprConsent: { marketing: true, sms: true, dataProcessing: true },
    addresses: [
      { id: 'a1', label: 'Home', street: 'Penthouse 4, Cyber Tower 1', city: 'Ebene', zip: '72201', country: 'Mauritius' },
      { id: 'a2', label: 'Office', street: 'Level 9, Nexteracom', city: 'Ebene', zip: '72201', country: 'Mauritius' },
    ],
  },
  {
    username: 'eleanor',
    password: 'BonManzeTest2!',
    firstName: 'Eleanor', lastName: 'Fant', name: 'Eleanor Fant',
    email: 'eleanor.f@gmail.com', phone: '+230 5987 6543',
    segment: 'VIP', group: 'Corporate', lastOrder: '2023-10-31',
    ltv: 28400, points: 300, storeCredit: 0, tier: 'Bronze',
    birthday: '1985-10-31', avatar: 'https://picsum.photos/seed/cust1/100/100',
    referenceCode: 'ELEA-CORP',
    gdprConsent: { marketing: true, sms: true, dataProcessing: true },
    addresses: [
      { id: 'a1', label: 'Work', street: '12 Coastal Road', city: 'Grand Baie', zip: '30510', country: 'Mauritius' },
    ],
  },
  {
    username: 'sarah',
    password: 'BonManzeTest3!',
    firstName: 'Sarah', lastName: 'Connor', name: 'Sarah Connor',
    email: 'sarah.c@sky.net', phone: '+230 5111 2222',
    segment: 'Regular', group: 'ABC Motors Co Ltd', lastOrder: '2023-10-10',
    ltv: 12500, points: 1450, storeCredit: 450.50, tier: 'Silver',
    birthday: '1995-01-27', avatar: 'https://picsum.photos/seed/s/100/100',
    referenceCode: 'SARAH-001',
    gdprConsent: { marketing: true, sms: false, dataProcessing: true },
    addresses: [
      { id: 'a1', label: 'Home', street: '123 Cybercity Ave', city: 'Ebene', zip: '72201', country: 'Mauritius' },
    ],
  },
];

async function seedOne(mock) {
  const now = Timestamp.now();

  // 1. Auth user
  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(mock.email);
    console.log(`${mock.name}: Auth user already exists (${userRecord.uid}) — leaving it as-is.`);
  } catch (e) {
    userRecord = await auth.createUser({
      email: mock.email,
      password: mock.password,
      displayName: mock.name,
    });
    console.log(`${mock.name}: created Auth user ${userRecord.uid}`);
  }

  // 2. usernames/{username}
  const usernameRef = db.collection('usernames').doc(mock.username);
  const usernameSnap = await usernameRef.get();
  if (usernameSnap.exists) {
    console.log(`${mock.name}: usernames/${mock.username} already exists — leaving it as-is.`);
  } else {
    await usernameRef.set({ uid: userRecord.uid, email: mock.email, createdAt: now });
    console.log(`${mock.name}: created usernames/${mock.username}`);
  }

  // 3. customers/{uid}
  const customerRef = db.collection('customers').doc(userRecord.uid);
  await customerRef.set({
    firstName: mock.firstName,
    lastName: mock.lastName,
    name: mock.name,
    email: mock.email,
    phone: mock.phone,
    addresses: mock.addresses,
    points: mock.points,
    storeCredit: mock.storeCredit,
    tier: TIER_NAME_TO_ID[mock.tier] ?? mock.tier,
    segment: mock.segment,
    group: GROUP_NAME_TO_ID[mock.group] ?? mock.group,
    lastOrder: mock.lastOrder,
    ltv: mock.ltv,
    birthday: mock.birthday,
    avatar: mock.avatar,
    referenceCode: mock.referenceCode,
    gdprConsent: mock.gdprConsent,
    updatedAt: now,
  }, { merge: true });
  console.log(`${mock.name}: wrote customers/${userRecord.uid} (tier=${TIER_NAME_TO_ID[mock.tier]}, group=${GROUP_NAME_TO_ID[mock.group]})`);
}

async function main() {
  for (const mock of MOCK_CUSTOMERS) {
    await seedOne(mock);
    console.log(`  sign-in: username "${mock.username}", password "${mock.password}"\n`);
  }
  console.log('Done.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
