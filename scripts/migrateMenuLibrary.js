// scripts/migrateMenuLibrary.js
//
// Step 4 of the build sequence in BonManzE_Firestore_Schema.md: migrates
// the Meal Library (Mains) and Menu Planner content (default rotation +
// saved week overrides) into Firestore.
//
// Unlike the config-docs migration (scripts/migrateConfigDocs.js), this
// data is NOT hardcoded in modules/store.ts — Mains and week overrides are
// live state Bhimal built up through the app's own UI, persisted to his
// browser's localStorage. It was exported once via a small console script
// run in the actual running app (not the emulator), then saved to
// scripts/data/menuLibraryExport.json for this script to read. If you ever
// need to re-run this migration against fresher data, re-export first —
// see BonManzE_Firestore_Schema.md's "Storage" section for the export
// snippet.
//
// PHOTOS: one Main ("DiPain Sausice") has a custom-uploaded photo. The
// export originally carried it as a ~740KB base64 data URL — too close to
// Firestore's 1MiB-per-document cap to embed directly, and the wrong place
// for image bytes regardless. scripts/data/menuLibraryExport.json has that
// field stripped out (marked with `_hadPhoto: true` on the two places it
// appeared) and scripts/data/dipain-sausice-photo.base64.txt carries the
// actual image data separately. This script uploads that image to Firebase
// Storage once, then writes a `photoStoragePath` field (pointing at the
// uploaded file) onto every document that had `_hadPhoto` set, instead of
// the raw base64.
//
// Safe to re-run: every Firestore write here is a fixed-ID `.set()`, and
// the Storage upload is skipped if the file already exists.
//
// Uses ES module import syntax (not require) because this repo's
// package.json has "type": "module".
//
// HOW TO RUN:
//   1. Make sure the Firebase Emulator Suite is running (npm run emulators)
//      — this now also starts a Storage emulator on port 9199, added in
//      firebase.json alongside this script.
//   2. From the repo root, in a second terminal:
//        node scripts/migrateMenuLibrary.js

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PROJECT_ID = 'demo-bonmanze';
const BUCKET_NAME = `${PROJECT_ID}.appspot.com`;

initializeApp({ projectId: PROJECT_ID, storageBucket: BUCKET_NAME });

const db = getFirestore();
const bucket = getStorage().bucket();

// ---- Data exported from the live app (see header comment) ----
const exportData = JSON.parse(
  readFileSync(join(__dirname, 'data', 'menuLibraryExport.json'), 'utf8')
);
const { MAIN_DISHES, LUNCH_MENU_OVERRIDES, DINNER_MENU_OVERRIDES, LUNCH_DEFAULT_LINK_MAP, DINNER_DEFAULT_LINK_MAP } = exportData;

// ---- The hardcoded default rotation, copied verbatim from modules/store.ts
// (WEEKLY_LUNCH_MENU_DEFAULT / WEEKLY_DINNER_MENU_DEFAULT) on 2026-08-12.
// These are plain source-code literals, not persisted state, same reasoning
// as migrateConfigDocs.js's SYSTEM_CONFIG etc. ----

const WEEKLY_LUNCH_MENU_DEFAULT = {
  MON: [
    { id: 'veg', emoji: '🥦', name: 'Veg Curry', desc: 'Creole spices · Vegan', price: 130 },
    { id: 'chk', emoji: '🍗', name: 'Chicken Curry', desc: 'Home-style Mauritian', price: 150 },
    { id: 'fsh', emoji: '🐟', name: 'Fish Curry', desc: 'Fresh local fish · Ginger', price: 190 },
  ],
  TUE: [
    { id: 'len', emoji: '🥦', name: 'Lentil Curry', desc: 'Vegan · Turmeric', price: 125 },
    { id: 'chk', emoji: '🍗', name: 'Chicken Curry', desc: 'Spiced · Onion & tomato', price: 150 },
    { id: 'prn', emoji: '🦐', name: 'Prawn Curry', desc: 'Coconut & lemongrass', price: 210 },
  ],
  WED: [
    { id: 'veg', emoji: '🥦', name: 'Veg Curry', desc: 'Seasonal vegetables', price: 130 },
    { id: 'beef', emoji: '🥩', name: 'Beef Curry', desc: 'Slow-cooked · Creole sauce', price: 220 },
    { id: 'fsh', emoji: '🐟', name: 'Fish Curry', desc: 'Ginger & tomato', price: 190 },
  ],
  THU: [
    { id: 'chk', emoji: '🍗', name: 'Chicken Curry', desc: 'Tandoori · Yoghurt marinade', price: 150 },
    { id: 'shp', emoji: '🦐', name: 'Shrimp Curry', desc: 'Coconut cream · Mild', price: 205 },
    { id: 'veg', emoji: '🥦', name: 'Veg Curry', desc: 'Aromatic masala', price: 130 },
  ],
  FRI: [
    { id: 'fsh', emoji: '🐟', name: 'Fish Curry', desc: 'Tamarind · Friday special', price: 190 },
    { id: 'chk', emoji: '🍗', name: 'Chicken Curry', desc: 'Extra herbs · Friday special', price: 150 },
    { id: 'pan', emoji: '🧀', name: 'Paneer Curry', desc: 'Spinach & spice', price: 160 },
  ],
};

const WEEKLY_DINNER_MENU_DEFAULT = {
  MON: [
    { id: 'beef', emoji: '🥩', name: 'Beef Curry', desc: 'Slow-cooked overnight · Rich gravy', price: 240 },
    { id: 'chk', emoji: '🍗', name: 'Chicken Curry', desc: 'Butter & cream finish', price: 180 },
    { id: 'pan', emoji: '🧀', name: 'Paneer Curry', desc: 'Cashew & tomato', price: 175 },
  ],
  TUE: [
    { id: 'fsh', emoji: '🐟', name: 'Fish Curry', desc: 'Grilled first · Tamarind glaze', price: 220 },
    { id: 'chk', emoji: '🍗', name: 'Chicken Curry', desc: 'Slow braise · Root vegetables', price: 180 },
    { id: 'len', emoji: '🥦', name: 'Lentil Curry', desc: 'Five-lentil dal · Ghee tempered', price: 150 },
  ],
  WED: [
    { id: 'prn', emoji: '🦐', name: 'Prawn Curry', desc: 'Garlic butter · Chilli', price: 250 },
    { id: 'beef', emoji: '🥩', name: 'Beef Curry', desc: 'Red wine & clove', price: 240 },
    { id: 'veg', emoji: '🥦', name: 'Veg Curry', desc: 'Roasted seasonal vegetables', price: 155 },
  ],
  THU: [
    { id: 'shp', emoji: '🦐', name: 'Shrimp Curry', desc: 'Coconut cream · Curry leaf', price: 235 },
    { id: 'chk', emoji: '🍗', name: 'Chicken Curry', desc: 'Char-grilled · Smoked masala', price: 180 },
    { id: 'pan', emoji: '🧀', name: 'Paneer Curry', desc: 'Spinach & fenugreek', price: 175 },
  ],
  FRI: [
    { id: 'fsh', emoji: '🐟', name: 'Fish Curry', desc: 'Weekend catch · Creole sauce', price: 220 },
    { id: 'beef', emoji: '🥩', name: 'Beef Curry', desc: 'Friday special · Slow-braised', price: 250 },
    { id: 'veg', emoji: '🥦', name: 'Veg Curry', desc: 'Mixed vegetable masala', price: 155 },
  ],
};

const WEEKDAY_KEYS = ['MON', 'TUE', 'WED', 'THU', 'FRI'];

// ---- Photo upload (see header comment) ----

const PHOTO_STORAGE_PATH = 'dishPhotos/mains/main-msq22wrd-f3q0.png';

async function ensurePhotoUploaded() {
  const file = bucket.file(PHOTO_STORAGE_PATH);
  const [exists] = await file.exists();
  if (exists) {
    console.log(`Photo already uploaded at ${PHOTO_STORAGE_PATH} — leaving it as-is.`);
    return;
  }
  const base64Body = readFileSync(
    join(__dirname, 'data', 'dipain-sausice-photo.base64.txt'),
    'utf8'
  );
  const buffer = Buffer.from(base64Body, 'base64');
  await file.save(buffer, { metadata: { contentType: 'image/png' } });
  console.log(`Uploaded photo to ${PHOTO_STORAGE_PATH} (${buffer.length} bytes).`);
}

// Applies `photoStoragePath` in place of the stripped `_hadPhoto` flag.
// Throws if it finds an unexpected _hadPhoto-flagged entry this script
// doesn't know how to resolve, or a raw base64 photoUrl that somehow
// survived the export-stripping step — both would mean the live data has
// moved on since this script was written, and it should not silently ship
// something wrong.
function resolvePhoto(dish) {
  if (dish.photoUrl && typeof dish.photoUrl === 'string' && dish.photoUrl.startsWith('data:image')) {
    throw new Error(`Unexpected raw base64 photoUrl on dish ${dish.id} — this script only knows how to handle the one photo it was written against. Re-check the export.`);
  }
  if (!dish._hadPhoto) return dish;
  if (dish.id !== 'main-msq22wrd-f3q0' && dish.id !== 'dish-msq2610u-wv2r') {
    throw new Error(`Unexpected _hadPhoto flag on dish ${dish.id} — this script only knows about the one photo (DiPain Sausice) present when it was written.`);
  }
  const { _hadPhoto, ...rest } = dish;
  return { ...rest, photoStoragePath: PHOTO_STORAGE_PATH };
}

function resolvePhotosInWeek(week) {
  const out = {};
  for (const day of WEEKDAY_KEYS) {
    out[day] = (week[day] || []).map(resolvePhoto);
  }
  return out;
}

// ---- Link the default rotation to the Library, same logic as store.ts's
// relinkDefaultRotationToLibrary()/linkInPlace(): match each default dish's
// lowercased name against the persisted link map to set mainId. ----

function linkDefaults(defaultMenu, linkMap) {
  const linked = {};
  for (const day of WEEKDAY_KEYS) {
    linked[day] = defaultMenu[day].map((dish) => {
      const mainId = linkMap[dish.name.trim().toLowerCase()];
      return mainId ? { ...dish, mainId } : { ...dish };
    });
  }
  return linked;
}

async function main() {
  await ensurePhotoUploaded();

  const now = Timestamp.now();

  // 1. Mains
  for (const main of MAIN_DISHES) {
    const { id, ...fields } = resolvePhoto(main);
    await db.collection('mains').doc(id).set({ ...fields, updatedAt: now });
  }
  console.log(`Wrote ${MAIN_DISHES.length} mains/{mainId} docs`);

  // 2. menuDefaults/current
  const linkedLunchDefault = linkDefaults(WEEKLY_LUNCH_MENU_DEFAULT, LUNCH_DEFAULT_LINK_MAP);
  const linkedDinnerDefault = linkDefaults(WEEKLY_DINNER_MENU_DEFAULT, DINNER_DEFAULT_LINK_MAP);
  await db.collection('menuDefaults').doc('current').set({
    lunch: linkedLunchDefault,
    dinner: linkedDinnerDefault,
    updatedAt: now,
  });
  console.log('Wrote menuDefaults/current');

  // 3. menuWeeks/{weekStart} — union of every week that has a Lunch and/or
  // Dinner override. Both services happen to share the same 6 week-starts
  // in this data, but the union is computed defensively in case a future
  // re-run finds them diverged.
  const weekStarts = new Set([
    ...Object.keys(LUNCH_MENU_OVERRIDES || {}),
    ...Object.keys(DINNER_MENU_OVERRIDES || {}),
  ]);
  for (const weekStart of weekStarts) {
    const doc = {};
    if (LUNCH_MENU_OVERRIDES && weekStart in LUNCH_MENU_OVERRIDES) {
      doc.lunch = resolvePhotosInWeek(LUNCH_MENU_OVERRIDES[weekStart]);
    }
    if (DINNER_MENU_OVERRIDES && weekStart in DINNER_MENU_OVERRIDES) {
      doc.dinner = resolvePhotosInWeek(DINNER_MENU_OVERRIDES[weekStart]);
    }
    doc.updatedAt = now;
    await db.collection('menuWeeks').doc(weekStart).set(doc);
  }
  console.log(`Wrote ${weekStarts.size} menuWeeks/{weekStart} docs: ${[...weekStarts].sort().join(', ')}`);

  console.log('\nDone.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
