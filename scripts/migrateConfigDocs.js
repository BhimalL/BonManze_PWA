// scripts/migrateConfigDocs.js
//
// One-time migration: copies the small "whole-list" config content that
// currently lives as hardcoded constants in modules/store.ts into Firestore,
// per the build sequence in BonManzE_Firestore_Schema.md (step 3) — the
// simplest pieces of the schema, done before the Meal Library/Menu Planner
// or any customer/order data.
//
// Writes to fixed document IDs with .set(), so this is safe to re-run any
// number of times: each run just overwrites these 8 docs with the values
// below, there's no duplicate-creation risk the way the seed script had to
// guard against for auto-generated role/order IDs.
//
// Uses ES module import syntax (not require) because this repo's
// package.json has "type": "module".
//
// HOW TO RUN:
//   1. Make sure the Firebase Emulator Suite is running (npm run emulators).
//   2. From the repo root, in a second terminal:  node scripts/migrateConfigDocs.js

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

initializeApp({ projectId: 'demo-bonmanze' });

const db = getFirestore();

// ---- Values below copied verbatim from modules/store.ts (read fresh from
// the device on 2026-08-12, before writing this script) ----

const SYSTEM_CONFIG = {
  operatingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  activeServices: ['Breakfast', 'Lunch', 'Dinner'],
  cutoffTime: '09:00',
  cutoffDayOffset: 0,
  lunchDeliveryWindow: '11:30–12:00',
  dinnerDeliveryWindow: '18:30–19:30',
  deadlinePolicy: '1 Day Before',
  currencySymbol: 'Rs',
  vatEnabled: true,
  vatRate: 15,
  vatNumber: 'VAT12345678',
  bulkDiscountEnabled: true,
  bulkDiscountRate: 5,
  businessName: 'BonManzE',
  businessTagline: 'Homemade · Delivered fresh',
  businessLogoUrl: '',
  supportPhone: '59412131',
  supportEmail: 'bhimalonly@gmail.com',
  dinnerEnabled: true,
};

const LOYALTY_TIERS = [
  { id: 't1', name: 'Bronze', pointsThreshold: 0, multiplier: 1, color: 'bg-orange-600', perks: ['Member Events'], standardDiscount: 0, birthdayDiscount: 5 },
  { id: 't2', name: 'Silver', pointsThreshold: 1000, multiplier: 1.2, color: 'bg-slate-400', perks: ['Free Coffee Weekly'], standardDiscount: 5, birthdayDiscount: 10 },
  { id: 't3', name: 'Gold', pointsThreshold: 5000, multiplier: 1.5, color: 'bg-amber-400', perks: ['Priority Seating'], standardDiscount: 10, birthdayDiscount: 15 },
  { id: 't4', name: 'Diamond', pointsThreshold: 10000, multiplier: 2, color: 'bg-primary', perks: ['Concierge Service'], standardDiscount: 15, birthdayDiscount: 25 },
];

const CUSTOMER_GROUPS = [
  { id: 'g1', name: 'ABC Motors Co Ltd', discountPercentage: 6, description: 'Default group for regular customers.', color: 'bg-rose-600' },
  { id: 'g2', name: 'Corporate', discountPercentage: 15, description: 'Registered business partners.', color: 'bg-indigo-600' },
  { id: 'g3', name: 'VIP', discountPercentage: 20, description: 'High-net-worth individuals.', color: 'bg-amber-500' },
];

const MEAL_BASES = [
  { id: 'wrice', emoji: '🍚', name: 'White Rice', up: 0, group: 'rice' },
  { id: 'brice', emoji: '🌾', name: 'Brown Rice', up: 15, group: 'rice' },
  { id: 'quin', emoji: '🌿', name: 'Quinoa', up: 25, group: 'rice' },
  { id: 'cous', emoji: '🫓', name: 'Couscous', up: 20, group: 'rice' },
  { id: 'caul', emoji: '🥦', name: 'Cauliflower Rice', up: 20, group: 'rice' },
];

const MEAL_DHALS = [
  { id: 'moong', emoji: '🟡', name: 'Yellow Dhal' },
  { id: 'red', emoji: '🟤', name: 'Red Lentil Dhal' },
];

const MEAL_SALADS = [
  { id: 'garden', emoji: '🥗', name: 'Garden Salad' },
  { id: 'slaw', emoji: '🥙', name: 'Creole Slaw' },
];

const MEAL_BEVERAGES = [
  { id: 'alouda', emoji: '🥤', name: 'Alouda', price: 35 },
  { id: 'lemonade', emoji: '🍋', name: 'Lemonade', price: 30 },
  { id: 'water', emoji: '💧', name: 'Mineral Water', price: 0 },
];

const MEAL_DESSERTS = [
  { id: 'gateau', emoji: '🍡', name: 'Gateau Piment', price: 25 },
  { id: 'fruits', emoji: '🍌', name: 'Fruit Salad', price: 30 },
  { id: 'cake', emoji: '🎂', name: 'Coconut Cake', price: 0 },
];

const ICON_LIBRARY = [
  { id: 'ic-chicken', emoji: '🍗', label: 'Chicken' },
  { id: 'ic-fish', emoji: '🐟', label: 'Fish' },
  { id: 'ic-prawn', emoji: '🦐', label: 'Prawn / Shrimp' },
  { id: 'ic-beef', emoji: '🥩', label: 'Beef' },
  { id: 'ic-veg', emoji: '🥦', label: 'Vegetable' },
  { id: 'ic-paneer', emoji: '🧀', label: 'Paneer / Cheese' },
  { id: 'ic-egg', emoji: '🥚', label: 'Egg' },
  { id: 'ic-bread', emoji: '🍞', label: 'Bread' },
  { id: 'ic-sausage', emoji: '🌭', label: 'Sausage' },
  { id: 'ic-rice', emoji: '🍚', label: 'Rice' },
  { id: 'ic-grain', emoji: '🌾', label: 'Grain' },
  { id: 'ic-noodle', emoji: '🍜', label: 'Noodles' },
  { id: 'ic-curry', emoji: '🍛', label: 'Curry' },
  { id: 'ic-plate', emoji: '🍽️', label: 'Plate / General dish' },
  { id: 'ic-salad', emoji: '🥗', label: 'Salad' },
  { id: 'ic-dhal', emoji: '🟡', label: 'Dhal / Lentil' },
  { id: 'ic-dhal2', emoji: '🟤', label: 'Dhal (dark)' },
  { id: 'ic-chilli', emoji: '🌶️', label: 'Chilli / Spice' },
  { id: 'ic-lemon', emoji: '🍋', label: 'Lemon' },
  { id: 'ic-coconut', emoji: '🥥', label: 'Coconut' },
  { id: 'ic-juice', emoji: '🥤', label: 'Juice / Drink' },
  { id: 'ic-water', emoji: '💧', label: 'Water' },
  { id: 'ic-tea', emoji: '🍵', label: 'Tea' },
  { id: 'ic-cake', emoji: '🎂', label: 'Cake' },
  { id: 'ic-dessert', emoji: '🍡', label: 'Dessert (skewer)' },
  { id: 'ic-fruit', emoji: '🍌', label: 'Fruit' },
  { id: 'ic-strawberry', emoji: '🍓', label: 'Strawberry' },
  { id: 'ic-star', emoji: '⭐', label: 'Star / Featured' },
  { id: 'ic-fire', emoji: '🔥', label: 'Spicy / Popular' },
  { id: 'ic-gift', emoji: '🎁', label: 'Gift / Promo' },
];

async function main() {
  const now = Timestamp.now();

  await db.collection('config').doc('system').set({ ...SYSTEM_CONFIG, updatedAt: now });
  console.log('Wrote config/system');

  await db.collection('loyaltyTiers').doc('current').set({ items: LOYALTY_TIERS, updatedAt: now });
  console.log('Wrote loyaltyTiers/current');

  await db.collection('customerGroups').doc('current').set({ items: CUSTOMER_GROUPS, updatedAt: now });
  console.log('Wrote customerGroups/current');

  await db.collection('mealBases').doc('current').set({ items: MEAL_BASES, updatedAt: now });
  console.log('Wrote mealBases/current');

  await db.collection('mealDhals').doc('current').set({ items: MEAL_DHALS, updatedAt: now });
  console.log('Wrote mealDhals/current');

  await db.collection('mealSalads').doc('current').set({ items: MEAL_SALADS, updatedAt: now });
  console.log('Wrote mealSalads/current');

  await db.collection('mealBeverages').doc('current').set({ items: MEAL_BEVERAGES, updatedAt: now });
  console.log('Wrote mealBeverages/current');

  await db.collection('mealDesserts').doc('current').set({ items: MEAL_DESSERTS, updatedAt: now });
  console.log('Wrote mealDesserts/current');

  await db.collection('iconLibrary').doc('current').set({ items: ICON_LIBRARY, updatedAt: now });
  console.log('Wrote iconLibrary/current');

  console.log('\nDone. 9 config docs written to the emulator.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
