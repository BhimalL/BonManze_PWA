// scripts/seedEntities.js
//
// Seeds the two placeholder entities, updates the Owner role to include manageRegistrations,
// and backfills existing customers to have registrationStatus = 'Pending'.
//
// HOW TO RUN:
//   1. Make sure the Firebase Emulator Suite is running (npm run emulators).
//   2. Run: node scripts/seedEntities.js

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';

initializeApp({ projectId: 'demo-bonmanze' });
const db = getFirestore();

async function main() {
  const now = Timestamp.now();

  // 1. Seed Entity A
  const entityARef = db.collection('entities').doc('entity-a');
  await entityARef.set({
    name: 'PLACEHOLDER ENTITY A LTD — replace before launch',
    brn: 'PLACEHOLDER-BRN-A',
    vatNumber: 'PLACEHOLDER-VAT-A',
    bankReference: 'PLACEHOLDER-BANK-A',
    active: true,
    createdAt: now,
    updatedAt: now,
  });
  console.log('Seeded Entity A (entity-a)');
  // 2. Seed Entity B
  const entityBRef = db.collection('entities').doc('entity-b');
  await entityBRef.set({
    name: 'PLACEHOLDER ENTITY B LTD — replace before launch',
    brn: 'PLACEHOLDER-BRN-B',
    vatNumber: 'PLACEHOLDER-VAT-B',
    bankReference: 'PLACEHOLDER-BANK-B',
    active: true,
    createdAt: now,
    updatedAt: now,
  });
  console.log('Seeded Entity B (entity-b)');

  // 3. Patch live Owner role permissions
  const rolesSnap = await db.collection('roles').where('name', '==', 'Owner').get();
  if (rolesSnap.empty) {
    console.log('Warning: No Owner role found to patch.');
  } else {
    for (const doc of rolesSnap.docs) {
      await doc.ref.update({
        'permissions.manageRegistrations': true,
        updatedAt: now,
      });
      console.log(`Patched Owner role (${doc.id}) with manageRegistrations = true`);
    }
  }

  // 4. Backfill existing customers to registrationStatus = 'Pending'
  const customersSnap = await db.collection('customers').get();
  if (customersSnap.empty) {
    console.log('No customers found to backfill.');
  } else {
    const batch = db.batch();
    customersSnap.forEach(doc => {
      batch.update(doc.ref, {
        registrationStatus: 'Pending',
        entityId: FieldValue.delete(),
        rejectionReason: FieldValue.delete(),
        updatedAt: now,
      });
    });
    await batch.commit();
    console.log(`Backfilled ${customersSnap.size} customer(s) to registrationStatus = 'Pending'`);
  }

  console.log('All seeding actions completed successfully.');
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Seeding script failed:', err);
    process.exit(1);
  });
