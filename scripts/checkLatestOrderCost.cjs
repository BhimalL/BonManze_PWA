const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
initializeApp({ projectId: 'demo-bonmanze' });
const db = getFirestore();

(async () => {
  const ordersSnap = await db.collection('orders').orderBy('createdAt', 'desc').limit(5).get();
  if (ordersSnap.empty) {
    console.log('No orders found.');
    return;
  }
  for (const orderDoc of ordersSnap.docs) {
    console.log('\n=== ORDER', orderDoc.id, '===');
    console.log(JSON.stringify(orderDoc.data(), null, 2));
    const itemsSnap = await orderDoc.ref.collection('items').get();
    itemsSnap.forEach(itemDoc => {
      console.log('  -- ITEM', itemDoc.id, '--');
      console.log('  ', JSON.stringify(itemDoc.data(), null, 2));
    });
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
