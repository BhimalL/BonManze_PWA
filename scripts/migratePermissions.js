// scripts/migratePermissions.js
import { initializeApp as adminInitializeApp } from 'firebase-admin/app';
import { getFirestore as adminGetFirestore } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

adminInitializeApp({ projectId: 'demo-bonmanze' });
const adb = adminGetFirestore();

async function run() {
  console.log('\n--- migratePermissions: migrating roles collection to nested schema ---\n');

  const snap = await adb.collection('roles').get();
  if (snap.empty) {
    console.log('No roles found in database.');
    process.exit(0);
  }

  let updated = 0;
  for (const d of snap.docs) {
    const data = d.data();
    const oldPerm = data.permissions || {};

    // Check if it's already using the new nested structure by checking if any value is an object
    const isNewSchema = Object.values(oldPerm).some(val => val !== null && typeof val === 'object');
    if (isNewSchema && d.id !== 'role-owner') {
      console.log(`- Role "${data.name}" (${d.id}) is already using the new schema. Skipping.`);
      continue;
    }

    // Owner role gets full permissions
    let newPermissions = {};
    if (d.id === 'role-owner' || data.name === 'Owner' || data.name === 'owner') {
      newPermissions = {
        menuPlanner: { view: true, edit: true },
        mealLibrary: { view: true, edit: true },
        ordersByDish: { view: true, edit: true },
        deliveryList: { view: true, edit: true },
        payments: { view: true, edit: true },
        customerDirectory: { view: true, edit: true },
        pendingRegistrations: { view: true, edit: true },
        transactionsLedger: { view: true },
        generalConfig: { view: true, edit: true },
        loyaltyTiers: { view: true, edit: true },
        customerGroups: { view: true, edit: true },
        iconLibrary: { view: true, edit: true },
        rolesAndStaff: { view: true, edit: true },
        tradingEntities: { view: true, edit: true }
      };
    } else {
      // Map old keys to new granular groups
      const oldMenu = oldPerm.manageMenu === true;
      const oldOrders = oldPerm.manageOrders === true;
      const oldCustomers = oldPerm.manageCustomers === true;
      const oldConfig = oldPerm.manageConfig === true;
      const oldRoles = oldPerm.manageRoles === true;
      const oldRegistrations = oldPerm.manageRegistrations === true;

      newPermissions = {
        menuPlanner: { view: oldMenu, edit: oldMenu },
        mealLibrary: { view: oldMenu, edit: oldMenu },
        iconLibrary: { view: oldMenu, edit: oldMenu }, // Mapped from oldMenu per scope decision
        ordersByDish: { view: oldOrders, edit: oldOrders },
        deliveryList: { view: oldOrders, edit: oldOrders },
        payments: { view: oldOrders, edit: oldOrders },
        customerDirectory: { view: oldCustomers, edit: oldCustomers },
        pendingRegistrations: { view: oldRegistrations, edit: oldRegistrations },
        transactionsLedger: { view: oldOrders || oldConfig },
        generalConfig: { view: oldConfig, edit: oldConfig },
        loyaltyTiers: { view: oldConfig, edit: oldConfig },
        customerGroups: { view: oldConfig, edit: oldConfig },
        tradingEntities: { view: oldConfig, edit: oldConfig },
        rolesAndStaff: { view: oldRoles, edit: oldRoles }
      };
    }

    await d.ref.update({
      permissions: newPermissions,
      updatedAt: new Date()
    });
    console.log(`- Migrated Role "${data.name}" (${d.id})`);
    updated++;
  }

  console.log(`\nMigration complete. Updated ${updated} roles.`);
  process.exit(0);
}

run().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
