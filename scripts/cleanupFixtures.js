import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

initializeApp({ projectId: 'demo-bonmanze' });

const db = getFirestore();
const auth = getAuth();

const rolesToDelete = [
  'role-owner', 'pGsC2BiudM90XcgBebzm', 'uUzlUlnjeV7g64iV3CGd', '63XsV4Do02Mjx7vgS1TI',
  '6DjxNnxN3Xb4q9TlvIVI', '7rZUSST7PIOGRAorJW0L', 'CKYvmdYSXELaKa5OjanR',
  'EQ9OrZoitueSoYdVzAba', 'JXfcuORvuUr0cM3aZzKw', 'KZOxrKAfwpSjkdW2FYRB',
  'M4CkVFp8YuVwwGVUUgmz', 'TvuMYWYq2jZs1JQC7VrV', 'hvXYXf0nyjWy7cNC0jsX',
  'mMQplcW800e3JteTZIeJ', 'nJaalAAK0UAq4vlDTmg6', 'nhYCCEVwSKrCPv2BEi0K',
  'qgmPVEpm8JDkBBeuyctb'
];

const staffToDelete = [
  '9LqNe4qvbwYxrHfxGyToluMXk0VC', '0nhmgfb02lwqNyXNSn8yckhyEI1T',
  '1zGnG06EwdlEEv8D3FoRyge8FnKI', '3zvZ1i3hoHwmWWqxEjhe8MOmt17s',
  '4DjAJ3G0sL50AsGy4MVhS5wDsvIt', 'AjVjKgrDzYTPhkHA4PxgmTdfGyrA',
  'Aoviqc9IXVdHZHl3v5hxCtHdyvAz', 'Q3TRpQggiOCLqMx1l4B2yHOwxVr6',
  'T4BBE34F1sZ9tCyDcdbw9vg3CqTS', 'XhJFT9Q49QEsrs1zX9pEytdzDNeV',
  'hBfurnivMZe3BCO62b2SPCxCFCQN', 'kMuvZtxWrDj4mztrYv2bAXiJhb9J',
  'qXS0HqA0n8AyjuEOEqLVNDYh3kdb', 'y4ibgnaKgOSPv5tQqCZOYdsVP7tf',
  'ygcDoKtTp2ULp4YrUpKaPcqEfp8x'
];

async function run() {
  console.log('Starting cleanup...');
  
  // Delete Roles
  for (const id of rolesToDelete) {
    await db.collection('roles').doc(id).delete();
    console.log(`Deleted role doc: ${id}`);
  }
  
  // Delete Staff & Auth Users
  for (const uid of staffToDelete) {
    // Delete Firestore document
    await db.collection('staff').doc(uid).delete();
    console.log(`Deleted staff doc: ${uid}`);
    
    // Delete Auth User
    try {
      await auth.deleteUser(uid);
      console.log(`Deleted Auth user: ${uid}`);
    } catch (e) {
      console.warn(`Auth user delete failed or not found for uid ${uid}: ${e.message}`);
    }
  }
  
  // Verification
  const finalRoles = await db.collection('roles').get();
  const finalStaff = await db.collection('staff').get();
  
  console.log('\n=== VERIFICATION ===');
  console.log(`Remaining Roles count: ${finalRoles.size}`);
  finalRoles.forEach(d => console.log(`  - Role: ${d.id} (${d.data().name})`));
  
  console.log(`Remaining Staff count: ${finalStaff.size}`);
  finalStaff.forEach(d => console.log(`  - Staff: ${d.id} (${d.data().name}, ${d.data().email})`));
}

run().catch(console.error);
