import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

initializeApp({ projectId: 'demo-bonmanze' });

const db = getFirestore();

async function run() {
  console.log('Starting cleanup of stray RBAC Test Entity documents...');
  const stray = await db.collection('entities').where('name', '==', 'RBAC Test Entity').get();
  console.log(`Found ${stray.size} matching stray entity documents.`);
  for (const doc of stray.docs) {
    await doc.ref.delete();
    console.log(`Deleted stray entity doc: ${doc.id}`);
  }

  const remaining = await db.collection('entities').get();
  console.log(`\n=== Remaining Entities (${remaining.size}) ===`);
  remaining.forEach(d => console.log(`  - Entity: ${d.id} (${d.data().name})`));
}

run().catch(console.error);
