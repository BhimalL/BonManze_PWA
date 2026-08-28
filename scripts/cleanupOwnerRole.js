import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
initializeApp({ projectId: 'demo-bonmanze' });

const db = getFirestore();

async function run() {
  const docRef = db.collection('roles').doc('iISsKzw1SDYP99opBUBv');
  const snap = await docRef.get();
  if (snap.exists) {
    console.log('Cleaning up iISsKzw1SDYP99opBUBv (Owner) permissions...');
    // Delete "manageRegistrations" field using FieldValue.delete()
    await docRef.update({
      'permissions.manageRegistrations': FieldValue.delete()
    });
    console.log('Done!');
  } else {
    console.error('Role iISsKzw1SDYP99opBUBv not found!');
  }
}

run().catch(console.error);
