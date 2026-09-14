// scripts/migrateCustomerTierIds.js
//
// One-time data repair: `customers/{uid}.tier` is supposed to store a
// loyaltyTiers/{id} REFERENCE (e.g. "t1"), never a display name. A bug in
// Operations.tsx's "Edit Customer" modal (the Loyalty Tier <select>'s
// <option value={t.name}>, and openEditCustomer/handleSaveCustomer reading
// and writing that same name straight through) has been writing the tier's
// NAME (e.g. "Bronze") into this field instead, for any customer whose
// profile was ever opened and saved through that modal. That's silent and
// serious: confirmCheckout's tier lookup (`tiersArr.find(t => t.id ===
// customer.tier)`) then fails to match, silently zeroing BOTH that
// customer's standard tier discount and birthday discount (found via a
// live test on Neji Lakha's account, 2026-09-10 — her birthday-discount-
// eligible order silently charged 0% instead of her tier's 5%).
//
// The code bug is fixed separately in modules/Operations.tsx. This script
// repairs the data already written by the buggy code: for every customer
// whose `tier` field does not match any current loyaltyTiers[].id, but DOES
// match a loyaltyTiers[].name, it rewrites `tier` to that tier's real id.
// Customers whose `tier` already matches an id are left untouched.
//
// Run against the LOCAL EMULATOR (must already be running):
//   node scripts/migrateCustomerTierIds.js
//
// Safe to re-run — already-correct records are skipped, not touched.

import { initializeApp as adminInitializeApp } from 'firebase-admin/app';
import { getFirestore as adminGetFirestore } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
adminInitializeApp({ projectId: 'demo-bonmanze' }); // matches scripts/checkIndexes.js
const db = adminGetFirestore();

async function run() {
  console.log('\n--- migrateCustomerTierIds: repairing customers.tier fields stored as names instead of ids ---\n');

  const tiersSnap = await db.collection('loyaltyTiers').doc('current').get();
  const tiers = (tiersSnap.data() || {}).items || [];
  if (tiers.length === 0) {
    console.log('No loyaltyTiers found — nothing to repair against. Aborting.');
    process.exit(1);
  }

  const customersSnap = await db.collection('customers').get();
  if (customersSnap.empty) {
    console.log('No customers found.');
    process.exit(0);
  }

  let fixed = 0, alreadyOk = 0, noTier = 0, unmatched = 0;

  for (const doc of customersSnap.docs) {
    const c = doc.data();
    if (!c.tier) { noTier++; continue; }

    const matchesById = tiers.find((t) => t.id === c.tier);
    if (matchesById) { alreadyOk++; continue; }

    const matchesByName = tiers.find((t) => t.name === c.tier);
    if (matchesByName) {
      await doc.ref.update({ tier: matchesByName.id });
      console.log(`- Fixed ${c.name || doc.id}: tier "${c.tier}" -> "${matchesByName.id}"`);
      fixed++;
      continue;
    }

    console.log(`- WARNING: ${c.name || doc.id} has tier "${c.tier}" which matches no known tier id or name. Left unchanged — check manually.`);
    unmatched++;
  }

  console.log(`\nDone. Fixed: ${fixed}. Already correct: ${alreadyOk}. No tier set: ${noTier}. Unmatched (needs manual check): ${unmatched}.`);
  process.exit(0);
}

run().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
