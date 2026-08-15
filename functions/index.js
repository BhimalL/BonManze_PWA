// functions/index.js
//
// BonManzE Cloud Functions. See BonManzE_Firestore_Schema.md §4 for the
// full list of things that must run server-side, not client-side.
//
// registerCustomer (step 5, 2026-08-13) — the one piece of customer
// registration that has to run server-side.
//
// confirmCheckout + onItemPaymentConfirmed (step 6, 2026-08-13) — the order
// total and the loyalty fields (points/ltv/tier) are the other two things
// §4 flags as needing real server-side logic: a client can never be
// trusted to submit its own total, or to award itself points.
//
// The Firebase emulator suite auto-wires FIRESTORE_EMULATOR_HOST /
// FIREBASE_AUTH_EMULATOR_HOST for code running inside the Functions
// emulator when other emulators are running in the same
// `firebase emulators:start` session — no manual env var setup needed here
// the way the standalone scripts/*.js files had to do it themselves.
//
// Uses ES module import syntax — functions/package.json has its own
// "type": "module", independent of the repo root's.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

initializeApp();

const auth = getAuth();
const db = getFirestore();

const USERNAME_PATTERN = /^[a-z0-9_.]+$/;

// registerCustomer — callable. See BonManzE_Firestore_Schema.md §2 for why
// this can't be a client-only createUserWithEmailAndPassword + a separate
// usernames/{username} write: claiming a username has to be atomic with
// creating the account, or two people racing for the same username could
// both believe they got it, and a client can't safely undo creating the
// Auth user if writing the username/customer docs afterward fails.
export const registerCustomer = onCall(async (request) => {
  const { username, email, password, firstName, lastName, phone } = request.data || {};

  // ---- Validate input ----
  if (typeof username !== 'string' || username.trim().length < 3) {
    throw new HttpsError('invalid-argument', 'Username must be at least 3 characters.');
  }
  const normalizedUsername = username.trim().toLowerCase();
  if (!USERNAME_PATTERN.test(normalizedUsername)) {
    throw new HttpsError('invalid-argument', 'Username may only contain letters, numbers, underscores, and periods.');
  }
  if (typeof email !== 'string' || !email.includes('@')) {
    throw new HttpsError('invalid-argument', 'A valid email is required.');
  }
  if (typeof password !== 'string' || password.length < 6) {
    throw new HttpsError('invalid-argument', 'Password must be at least 6 characters.');
  }
  if (typeof firstName !== 'string' || !firstName.trim()) {
    throw new HttpsError('invalid-argument', 'First name is required.');
  }
  if (typeof lastName !== 'string' || !lastName.trim()) {
    throw new HttpsError('invalid-argument', 'Last name is required.');
  }

  const usernameRef = db.collection('usernames').doc(normalizedUsername);

  // ---- Step 1: quick check (nice error message in the common case — the
  // real, race-safe check happens inside the transaction in step 3). ----
  const preCheckSnap = await usernameRef.get();
  if (preCheckSnap.exists) {
    throw new HttpsError('already-exists', 'That username is already taken.');
  }

  // ---- Step 2: create the Firebase Auth user ----
  let userRecord;
  try {
    userRecord = await auth.createUser({
      email,
      password,
      displayName: `${firstName.trim()} ${lastName.trim()}`,
    });
  } catch (err) {
    if (err && err.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'An account with that email already exists.');
    }
    throw new HttpsError('internal', 'Could not create the account.');
  }

  // ---- Step 3: atomically re-check the username and write customers/{uid}
  // + usernames/{username} together. A transaction (not a plain batch)
  // because the real safety property is "no two registrations can both
  // succeed in claiming the same username" — a transaction that re-reads
  // usernameRef and fails if it's now taken closes the race a plain
  // get()-then-write can't. ----
  try {
    await db.runTransaction(async (tx) => {
      const usernameSnap = await tx.get(usernameRef);
      if (usernameSnap.exists) {
        throw new HttpsError('already-exists', 'That username is already taken.');
      }
      const now = Timestamp.now();
      tx.set(db.collection('customers').doc(userRecord.uid), {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        name: `${firstName.trim()} ${lastName.trim()}`,
        email,
        phone: typeof phone === 'string' ? phone : '',
        addresses: [],
        points: 0,
        storeCredit: 0,
        tier: 't1', // Bronze — see loyaltyTiers/current, item id t1
        ltv: 0,
        avatar: '',
        referenceCode: normalizedUsername.toUpperCase(),
        gdprConsent: { marketing: false, sms: false, dataProcessing: true },
        createdAt: now,
        updatedAt: now,
      });
      tx.set(usernameRef, {
        uid: userRecord.uid,
        email,
        createdAt: now,
      });
    });
  } catch (err) {
    // Step 3 failed (lost the username race, or any other error) — delete
    // the Auth user created in step 2 rather than leave an orphaned account
    // with no customer/username doc behind it. Per the schema doc, this is
    // the whole reason registration has to be a Function and not a raw
    // client call: a client can't safely do this rollback itself.
    await auth.deleteUser(userRecord.uid).catch(() => {});
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', 'Could not finish registration — please try again.');
  }

  return { uid: userRecord.uid };
});

// ============================================================================
// confirmCheckout — callable. See BonManzE_Firestore_Schema.md §4: a client
// submits WHAT was ordered (which dish, which add-ons, which date/service),
// never WHAT IT COSTS. Every price and the order total are computed here,
// from the current published menu + the current add-on catalogs + the
// customer's own tier/group/birthday + the current config/system VAT and
// bulk-discount settings — replicating CustomerPortal.tsx's cartTotals
// logic exactly (see that file's comments), just server-side.
// ============================================================================

const WEEKDAY_KEYS = ['MON', 'TUE', 'WED', 'THU', 'FRI'];

// Both helpers assume deliveryDate is already a Mon-Fri date — the app only
// ever offers weekday delivery slots, so a weekend deliveryDate reaching
// here is a client bug (or tampering), not a case to silently handle.
function weekStartOf(deliveryDate) {
  const [y, m, d] = deliveryDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = dt.getDay(); // 0=Sun..6=Sat
  const diffToMonday = dow === 0 ? 1 : (1 - dow);
  dt.setDate(dt.getDate() + diffToMonday);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function weekdayKeyOf(deliveryDate) {
  const [y, m, d] = deliveryDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const idx = dt.getDay() - 1; // Mon=0 .. Fri=4 when getDay() is 1..5
  return idx >= 0 && idx <= 4 ? WEEKDAY_KEYS[idx] : null;
}

// Timezone and Cutoff Helpers
// Mauritius is UTC+4. Cloud Functions run in UTC, so we format/convert using Intl API.
function getOverrideDate(request) {
  const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
  return (isEmulator && request && request.data && request.data.systemDate) || null;
}

function getMauritiusDateTime(systemDateOverride) {
  const options = { timeZone: 'Indian/Mauritius', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: false };
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(new Date());
  const map = {};
  parts.forEach(p => { map[p.type] = p.value; });
  const y = parseInt(map.year, 10);
  const m = parseInt(map.month, 10);
  const d = parseInt(map.day, 10);
  const h = parseInt(map.hour, 10);
  const min = parseInt(map.minute, 10);
  return {
    dateStr: systemDateOverride || `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    hours: h,
    minutes: min
  };
}

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function checkCutoffPassed(deliveryDate, cutoffTime, cutoffDayOffset, systemDateOverride) {
  const cutoffDateStr = addDays(deliveryDate, cutoffDayOffset);
  const muTime = getMauritiusDateTime(systemDateOverride);
  const [cutH, cutM] = cutoffTime.split(':').map(Number);
  
  if (muTime.dateStr > cutoffDateStr) return true;
  if (muTime.dateStr < cutoffDateStr) return false;
  return muTime.hours > cutH || (muTime.hours === cutH && muTime.minutes >= cutM);
}

export const confirmCheckout = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }
  const uid = request.auth.uid;
  const { items: rawItems, type, paymentScheme, tenderType, paymentMethodName } = request.data || {};

  // ---- Validate top-level input ----
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new HttpsError('invalid-argument', 'Cart is empty.');
  }
  if (rawItems.length > 200) {
    throw new HttpsError('invalid-argument', 'Too many items in one checkout.');
  }
  if (type !== 'Delivery' && type !== 'Meal Plan') {
    throw new HttpsError('invalid-argument', 'Invalid order type.');
  }
  if (paymentScheme !== 'Upfront' && paymentScheme !== 'Per-Delivery') {
    throw new HttpsError('invalid-argument', 'Invalid payment scheme.');
  }

  const customerSnap = await db.collection('customers').doc(uid).get();
  if (!customerSnap.exists) {
    throw new HttpsError('permission-denied', 'No customer record for this account.');
  }
  const customer = customerSnap.data();

  // ---- Load current catalogs/config in parallel ----
  const [configSnap, tiersSnap, groupsSnap, basesSnap, dhalsSnap, saladsSnap, bevSnap, desSnap, defaultsSnap] = await Promise.all([
    db.collection('config').doc('system').get(),
    db.collection('loyaltyTiers').doc('current').get(),
    db.collection('customerGroups').doc('current').get(),
    db.collection('mealBases').doc('current').get(),
    db.collection('mealDhals').doc('current').get(),
    db.collection('mealSalads').doc('current').get(),
    db.collection('mealBeverages').doc('current').get(),
    db.collection('mealDesserts').doc('current').get(),
    db.collection('menuDefaults').doc('current').get(),
  ]);
  const config = configSnap.data() || {};
  
  const systemDateOverride = getOverrideDate(request);

  for (const raw of rawItems) {
    if (raw && typeof raw === 'object' && raw.deliveryDate) {
      const srv = raw.service === 'Dinner' ? 'dinner' : 'lunch';
      const timeKey = srv === 'dinner' ? 'dinnerOrderCutoffTime' : 'lunchOrderCutoffTime';
      const offsetKey = srv === 'dinner' ? 'dinnerOrderCutoffDayOffset' : 'lunchOrderCutoffDayOffset';
      
      const cutoffTime = config[timeKey] || config.orderCutoffTime || config.cutoffTime || '09:00';
      const cutoffDayOffset = typeof config[offsetKey] === 'number' ? config[offsetKey]
        : (typeof config.orderCutoffDayOffset === 'number' ? config.orderCutoffDayOffset
        : (typeof config.cutoffDayOffset === 'number' ? config.cutoffDayOffset : (srv === 'dinner' ? 0 : -1)));

      if (checkCutoffPassed(raw.deliveryDate, cutoffTime, cutoffDayOffset, systemDateOverride)) {
        throw new HttpsError('failed-precondition', `Ordering cutoff time for ${raw.service} delivery on ${raw.deliveryDate} has passed.`);
      }
    }
  }

  const tiersArr = (tiersSnap.data() || {}).items || [];
  const groupsArr = (groupsSnap.data() || {}).items || [];
  const basesArr = (basesSnap.data() || {}).items || [];
  const dhalsArr = (dhalsSnap.data() || {}).items || [];
  const saladsArr = (saladsSnap.data() || {}).items || [];
  const bevArr = (bevSnap.data() || {}).items || [];
  const desArr = (desSnap.data() || {}).items || [];
  const menuDefaults = defaultsSnap.data() || {};

  // menuWeeks/{weekStart} docs are fetched lazily, one per distinct week
  // referenced by the cart, and cached — a week with no override document
  // (or with only one of lunch/dinner overridden) falls back to
  // menuDefaults for the missing side, same semantics as the client's
  // forWeek() helpers (see BonManzE_Firestore_Schema.md's menuWeeks note).
  const weekOverrideCache = new Map();
  const getWeekOverride = async (weekStart) => {
    if (weekOverrideCache.has(weekStart)) return weekOverrideCache.get(weekStart);
    const snap = await db.collection('menuWeeks').doc(weekStart).get();
    const data = snap.exists ? snap.data() : {};
    weekOverrideCache.set(weekStart, data);
    return data;
  };

  const findDish = async (deliveryDate, service, curryId) => {
    const weekStart = weekStartOf(deliveryDate);
    const weekdayKey = weekdayKeyOf(deliveryDate);
    if (!weekdayKey) {
      throw new HttpsError('invalid-argument', `${deliveryDate} is not a Mon-Fri delivery day.`);
    }
    const serviceKey = service === 'Dinner' ? 'dinner' : 'lunch';
    const weekOverride = await getWeekOverride(weekStart);
    const daySource =
      (weekOverride[serviceKey] && weekOverride[serviceKey][weekdayKey]) ||
      (menuDefaults[serviceKey] && menuDefaults[serviceKey][weekdayKey]) ||
      [];
    const dish = daySource.find((c) => c.id === curryId);
    if (!dish) {
      throw new HttpsError('invalid-argument', `"${curryId}" is not on the ${service} menu for ${deliveryDate}.`);
    }
    return { dish, weekStart, weekdayKey };
  };

  // ---- Price every item server-side — never trusting a client-submitted
  // price. Mirrors CustomerPortal.tsx's mealPrice() exactly: curry price
  // (the day-slot's own price, per resolveDish()'s note that price stays
  // per-day, not resolved live from the linked Main) + base "up" charge +
  // beverage + dessert. Dhal/salad carry no price today — matches the
  // existing client logic, not an omission here. ----
  const priced = [];
  for (let i = 0; i < rawItems.length; i++) {
    const raw = rawItems[i];
    if (!raw || typeof raw !== 'object') {
      throw new HttpsError('invalid-argument', `Item ${i} is malformed.`);
    }
    const { curryId, baseId, dhalId, saladId, beverageId, dessertId, note, deliveryDate, service, slotIndex } = raw;
    if (typeof curryId !== 'string' || !curryId) {
      throw new HttpsError('invalid-argument', `Item ${i} is missing curryId.`);
    }
    if (typeof deliveryDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)) {
      throw new HttpsError('invalid-argument', `Item ${i} has an invalid deliveryDate.`);
    }
    if (service !== 'Lunch' && service !== 'Dinner') {
      throw new HttpsError('invalid-argument', `Item ${i} has an invalid service.`);
    }
    const idx = Number.isInteger(slotIndex) && slotIndex >= 0 ? slotIndex : 0;

    const { dish, weekStart, weekdayKey } = await findDish(deliveryDate, service, curryId);
    const base = basesArr.find((b) => b.id === baseId);
    const dhal = dhalId && dhalId !== 'none' ? dhalsArr.find((d) => d.id === dhalId) : null;
    const salad = saladId && saladId !== 'none' ? saladsArr.find((s) => s.id === saladId) : null;
    const beverage = beverageId && beverageId !== 'none' ? bevArr.find((b) => b.id === beverageId) : null;
    const dessert = dessertId && dessertId !== 'none' ? desArr.find((d) => d.id === dessertId) : null;

    const price = (dish.price || 0) + (base?.up || 0) + (dhal?.price || 0) + (salad?.price || 0) + (beverage?.price || 0) + (dessert?.price || 0);

    priced.push({
      itemId: curryId,
      name: `${dish.emoji || ''} ${dish.name || 'Meal'}`.trim(),
      qty: 1,
      price,
      notes: typeof note === 'string' ? note.slice(0, 500) : '',
      deliveryDate,
      deliveryDay: weekdayKey,
      serviceSlot: idx === 0 ? service : `${service}-${idx + 1}`,
      paymentStatus: 'Pending',
      status: 'Active',
      // Frozen at checkout time, deliberately not re-derived at payment
      // time — see onItemPaymentConfirmed below for why: re-reading the
      // customer's LIVE tier when payment is confirmed makes the points
      // earned depend on the non-deterministic order multiple items in the
      // same order happen to get marked Paid/processed in (an item
      // processed after an earlier one in the same batch pushes the
      // customer over a tier threshold would earn at the NEW multiplier,
      // even though every item in the order was placed under the same
      // tier). Freezing it here makes the earned rate deterministic and
      // tied to "what tier you were at when you ordered."
      tierAtOrder: customer.tier,
      _weekStart: weekStart,
      _service: service,
      _weekdayKey: weekdayKey,
    });
  }

  // ---- Discount stacking — exact port of CustomerPortal.tsx's cartTotals
  // useMemo. Standard = max(tier%, group%) per item. Birthday = tier% only
  // on items whose deliveryDate month/day matches the customer's birthday.
  // Bulk = per calendar week, Lunch-only coverage check (all 5 weekdays
  // must have at least one Lunch item that week — matches the existing,
  // deliberately-unchanged business rule), applied to that week's full
  // Lunch+Dinner subtotal. VAT last, on the discounted net. ----
  const tierObj = tiersArr.find((t) => t.id === customer.tier);
  const groupObj = customer.group ? groupsArr.find((g) => g.id === customer.group) : null;
  const standardTierRate = tierObj?.standardDiscount || 0;
  const birthdayTierRate = tierObj?.birthdayDiscount || 0;
  const groupRate = groupObj?.discountPercentage || 0;
  const effectiveStandardRate = Math.max(standardTierRate, groupRate);

  let bMonth = -1, bDay = -1;
  if (customer.birthday) {
    const [, bm, bd] = customer.birthday.split('-').map(Number);
    bMonth = bm;
    bDay = bd;
  }

  let standardDiscount = 0, birthdayDiscount = 0;
  priced.forEach((p) => {
    standardDiscount += p.price * (effectiveStandardRate / 100);
    const [, fm, fd] = p.deliveryDate.split('-').map(Number);
    if (fm === bMonth && fd === bDay && birthdayTierRate > 0) {
      birthdayDiscount += p.price * (birthdayTierRate / 100);
    }
  });

  let bulkDiscount = 0;
  if (config.bulkDiscountEnabled) {
    const weekStarts = new Set(priced.map((p) => p._weekStart));
    weekStarts.forEach((ws) => {
      const lunchDaysCovered = new Set(
        priced.filter((p) => p._weekStart === ws && p._service === 'Lunch').map((p) => p._weekdayKey)
      );
      if (lunchDaysCovered.size >= WEEKDAY_KEYS.length) {
        const weekSubtotal = priced.filter((p) => p._weekStart === ws).reduce((t, p) => t + p.price, 0);
        bulkDiscount += weekSubtotal * ((config.bulkDiscountRate || 0) / 100);
      }
    });
  }

  const subtotal = priced.reduce((t, p) => t + p.price, 0);
  const totalDiscount = standardDiscount + birthdayDiscount + bulkDiscount;
  const netTotal = Math.max(0, subtotal - totalDiscount);
  const vatRate = config.vatEnabled ? (config.vatRate || 0) / 100 : 0;
  const vat = netTotal * vatRate;
  const total = Math.round((netTotal + vat) * 100) / 100;

  // ---- Write the order + its items subcollection transactionally ----
  const orderRef = db.collection('orders').doc();
  await db.runTransaction(async (tx) => {
    const now = Timestamp.now();
    tx.set(orderRef, {
      customerId: uid,
      customerName: customer.name || '',
      type,
      paymentScheme,
      tenderType: typeof tenderType === 'string' ? tenderType : '',
      paymentMethodName: typeof paymentMethodName === 'string' ? paymentMethodName : '',
      total,
      subtotal,
      discount: totalDiscount,
      discountReason: `Standard: ${effectiveStandardRate}%, Birthday: ${birthdayTierRate}%, Bulk: ${bulkDiscount > 0 ? config.bulkDiscountRate : 0}%`,
      vat,
      createdAt: now,
    });
    priced.forEach((p) => {
      const { _weekStart, _service, _weekdayKey, ...itemFields } = p;
      const itemRef = orderRef.collection('items').doc();
      tx.set(itemRef, {
        ...itemFields,
        customerId: uid,
        customerName: customer.name || '',
      });
    });
  });

  return {
    orderId: orderRef.id,
    total,
    breakdown: { subtotal, standardDiscount, birthdayDiscount, bulkDiscount, vat },
  };
});

// ============================================================================
// onItemPaymentConfirmed — Firestore trigger, not callable. Fires whenever
// any orders/{orderId}/items/{itemId} document's paymentStatus transitions
// INTO 'Paid' (marked by staff via the client-side update the rules above
// already allow — manageOrders, price/qty/name/customerId frozen). Awards
// loyalty points (price × the tier.multiplier the customer had AT CHECKOUT
// TIME — the LoyaltyTier.multiplier field that has existed since before
// this Function but was never actually used by anything, confirmed via a
// grep of modules/store.ts), adds to lifetime value, and upgrades tier if
// the new points total crosses a higher tier's threshold. Never downgrades
// automatically — matches every existing loyalty-program expectation
// (a tier earned is never silently taken back for spending less later).
//
// Uses item.tierAtOrder (frozen by confirmCheckout), NOT the customer's
// CURRENT tier — found via testCheckoutFlow.js, 2026-08-13: an order's
// items are typically all marked Paid together (Upfront payment scheme),
// and each item's trigger fires as its own independent invocation. Reading
// the customer's live tier meant an item processed after an EARLIER item
// in the same batch had already pushed the customer over a threshold would
// earn at the NEW multiplier — making the total points awarded for one
// order depend on the non-deterministic order Cloud Functions happened to
// process its items in, not on anything about the order itself. Freezing
// the tier at order time fixes that: every item in an order earns at the
// same, deterministic rate regardless of processing order.
// ============================================================================

export const onItemPaymentConfirmed = onDocumentUpdated('orders/{orderId}/items/{itemId}', async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();

  if (!after || after.paymentStatus !== 'Paid' || before?.paymentStatus === 'Paid') {
    return; // only the transition INTO Paid awards points, and only once
  }

  const customerId = after.customerId;
  const price = after.price || 0;
  if (!customerId) return;

  const customerRef = db.collection('customers').doc(customerId);
  const tiersSnap = await db.collection('loyaltyTiers').doc('current').get();
  const tiersArr = (tiersSnap.data() || {}).items || [];

  // Older items (written before tierAtOrder existed) have no such field —
  // fall back to the customer's tier at the time the trigger reads it, the
  // old behavior, rather than crashing on a missing field.
  const earningTierId = after.tierAtOrder;

  await db.runTransaction(async (tx) => {
    const custSnap = await tx.get(customerRef);
    if (!custSnap.exists) return;
    const customer = custSnap.data();

    const earningTier = tiersArr.find((t) => t.id === (earningTierId || customer.tier));
    const multiplier = earningTier?.multiplier ?? 1;
    const currentTier = tiersArr.find((t) => t.id === customer.tier);
    const currentThreshold = currentTier?.pointsThreshold ?? 0;

    const pointsEarned = Math.round(price * multiplier);
    const newPoints = (customer.points || 0) + pointsEarned;
    const newLtv = (customer.ltv || 0) + price;

    // Highest tier whose pointsThreshold is met by newPoints — only
    // applied if it's actually higher than the current tier, so this never
    // downgrades (e.g. a customer who somehow has fewer points than their
    // current tier's threshold keeps their tier).
    let bestTier = null;
    tiersArr.forEach((t) => {
      if (typeof t.pointsThreshold === 'number' && t.pointsThreshold <= newPoints) {
        if (!bestTier || t.pointsThreshold > bestTier.pointsThreshold) bestTier = t;
      }
    });
    const newTierId = bestTier && bestTier.pointsThreshold > currentThreshold ? bestTier.id : customer.tier;

    tx.update(customerRef, {
      points: newPoints,
      ltv: newLtv,
      tier: newTierId,
      updatedAt: Timestamp.now(),
    });
  });
});

// Helper: Calculate net order total for a list of items, replicating confirmCheckout pricing rules
function calculateItemsTotal(items, customer, tiersArr, groupsArr, config) {
  if (items.length === 0) {
    return { subtotal: 0, total: 0 };
  }

  const mappedItems = items.map(item => {
    const weekStart = weekStartOf(item.deliveryDate);
    const weekdayKey = weekdayKeyOf(item.deliveryDate);
    const service = (item.serviceSlot || '').startsWith('Dinner') ? 'Dinner' : 'Lunch';
    return {
      ...item,
      _weekStart: weekStart,
      _service: service,
      _weekdayKey: weekdayKey
    };
  });

  const tierAtOrder = mappedItems[0].tierAtOrder || customer.tier;
  const tierObj = tiersArr.find((t) => t.id === tierAtOrder);
  const groupObj = customer.group ? groupsArr.find((g) => g.id === customer.group) : null;
  const standardTierRate = tierObj?.standardDiscount || 0;
  const birthdayTierRate = tierObj?.birthdayDiscount || 0;
  const groupRate = groupObj?.discountPercentage || 0;
  const effectiveStandardRate = Math.max(standardTierRate, groupRate);

  let bMonth = -1, bDay = -1;
  if (customer.birthday) {
    const [, bm, bd] = customer.birthday.split('-').map(Number);
    bMonth = bm;
    bDay = bd;
  }

  let standardDiscount = 0, birthdayDiscount = 0;
  mappedItems.forEach((p) => {
    standardDiscount += p.price * (effectiveStandardRate / 100);
    const [, fm, fd] = p.deliveryDate.split('-').map(Number);
    if (fm === bMonth && fd === bDay && birthdayTierRate > 0) {
      birthdayDiscount += p.price * (birthdayTierRate / 100);
    }
  });

  let bulkDiscount = 0;
  if (config.bulkDiscountEnabled) {
    const weekStarts = new Set(mappedItems.map((p) => p._weekStart));
    weekStarts.forEach((ws) => {
      const lunchDaysCovered = new Set(
        mappedItems.filter((p) => p._weekStart === ws && p._service === 'Lunch').map((p) => p._weekdayKey)
      );
      if (lunchDaysCovered.size >= WEEKDAY_KEYS.length) {
        const weekSubtotal = mappedItems.filter((p) => p._weekStart === ws).reduce((t, p) => t + p.price, 0);
        bulkDiscount += weekSubtotal * ((config.bulkDiscountRate || 0) / 100);
      }
    });
  }

  const subtotal = mappedItems.reduce((t, p) => t + p.price, 0);
  const totalDiscount = standardDiscount + birthdayDiscount + bulkDiscount;
  const netTotal = Math.max(0, subtotal - totalDiscount);
  const vatRate = config.vatEnabled ? (config.vatRate || 0) / 100 : 0;
  const vat = netTotal * vatRate;
  const total = Math.round((netTotal + vat) * 100) / 100;

  return { subtotal, standardDiscount, birthdayDiscount, bulkDiscount, vat, total };
}

// cancelOrderItem — Callable. Sets an item status to Cancelled and recalculates the order.
// If the item was already Paid, calculates the refund and credits storeCredit in customers/{uid}.
export const cancelOrderItem = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }
  const uid = request.auth.uid;
  const { orderId, itemId } = request.data || {};

  if (!orderId || !itemId) {
    throw new HttpsError('invalid-argument', 'Missing orderId or itemId.');
  }

  const itemRef = db.collection('orders').doc(orderId).collection('items').doc(itemId);
  const itemSnap = await itemRef.get();
  if (!itemSnap.exists) {
    throw new HttpsError('not-found', 'Order item not found.');
  }
  const item = itemSnap.data();

  if (item.customerId !== uid) {
    throw new HttpsError('permission-denied', 'You do not own this order.');
  }
  if (item.status === 'Cancelled') {
    throw new HttpsError('failed-precondition', 'This item is already cancelled.');
  }

  // Load configuration for cancel cutoff:
  const configSnap = await db.collection('config').doc('system').get();
  const config = configSnap.data() || {};

  const srv = item.serviceSlot.startsWith('Dinner') ? 'dinner' : 'lunch';
  const timeKey = srv === 'dinner' ? 'dinnerCancelCutoffTime' : 'lunchCancelCutoffTime';
  const offsetKey = srv === 'dinner' ? 'dinnerCancelCutoffDayOffset' : 'lunchCancelCutoffDayOffset';

  const cancelCutoffTime = config[timeKey] || config.cancelCutoffTime || config.cutoffTime || '09:00';
  const cancelCutoffDayOffset = typeof config[offsetKey] === 'number' ? config[offsetKey]
    : (typeof config.cancelCutoffDayOffset === 'number' ? config.cancelCutoffDayOffset
    : (typeof config.cutoffDayOffset === 'number' ? config.cutoffDayOffset : 0));

  const systemDateOverride = getOverrideDate(request);

  if (checkCutoffPassed(item.deliveryDate, cancelCutoffTime, cancelCutoffDayOffset, systemDateOverride)) {
    throw new HttpsError('failed-precondition', `The cancellation cutoff time for this ${srv} delivery day has passed.`);
  }

  const orderRef = db.collection('orders').doc(orderId);
  const customerRef = db.collection('customers').doc(uid);

  let refundAmount = 0;
  let newTotal = 0;

  await db.runTransaction(async (tx) => {
    const [customerSnap, tiersSnap, groupsSnap, orderSnap, itemsSnap] = await Promise.all([
      tx.get(customerRef),
      tx.get(db.collection('loyaltyTiers').doc('current')),
      tx.get(db.collection('customerGroups').doc('current')),
      tx.get(orderRef),
      tx.get(orderRef.collection('items'))
    ]);
    const customer = customerSnap.data() || {};
    const tiersArr = (tiersSnap.data() || {}).items || [];
    const groupsArr = (groupsSnap.data() || {}).items || [];
    const order = orderSnap.data() || {};

    const isPaid = item.paymentStatus === 'Paid';

    // 1. Cancel the item
    tx.update(itemRef, {
      status: 'Cancelled',
      paymentStatus: isPaid ? 'Refunded' : item.paymentStatus,
      updatedAt: Timestamp.now()
    });

    // 2. Recalculate parent order total from remaining active items
    const activeItems = [];
    itemsSnap.forEach(doc => {
      const it = doc.data();
      if (doc.id === itemId) {
        // Exclude the cancelled item
      } else if (it.status !== 'Cancelled') {
        activeItems.push(it);
      }
    });

    const pricing = calculateItemsTotal(activeItems, customer, tiersArr, groupsArr, config);
    newTotal = pricing.total;

    // 3. Update order document with new total
    tx.update(orderRef, {
      total: newTotal,
      updatedAt: Timestamp.now()
    });

    // 4. If paid, refund customer via storeCredit
    if (isPaid) {
      const originalTotal = order.total || 0;
      refundAmount = Math.max(0, originalTotal - newTotal);
      if (refundAmount > 0) {
        tx.update(customerRef, {
          storeCredit: (customer.storeCredit || 0) + refundAmount,
          updatedAt: Timestamp.now()
        });

        // 5. Append to audit log
        const auditRef = db.collection('auditLog').doc();
        tx.set(auditRef, {
          timestamp: Timestamp.now(),
          userId: uid,
          userName: customer.name || '',
          action: 'ORDER_ITEM_CANCEL',
          details: `Cancelled prepaid item ${itemId} from order ${orderId}. Refunded Rs ${refundAmount} as store credit.`,
        });
      }
    }
  });

  return { refundAmount, newTotal };
});

// editOrderItemSelection — Callable. Customizes the selection of a confirmed order item.
export const editOrderItemSelection = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }
  const uid = request.auth.uid;
  const { orderId, itemId, selection } = request.data || {};

  if (!orderId || !itemId || !selection) {
    throw new HttpsError('invalid-argument', 'Missing orderId, itemId, or selection.');
  }

  const itemRef = db.collection('orders').doc(orderId).collection('items').doc(itemId);
  const itemSnap = await itemRef.get();
  if (!itemSnap.exists) {
    throw new HttpsError('not-found', 'Order item not found.');
  }
  const item = itemSnap.data();

  if (item.customerId !== uid) {
    throw new HttpsError('permission-denied', 'You do not own this order.');
  }
  if (item.status === 'Cancelled') {
    throw new HttpsError('failed-precondition', 'Cannot edit a cancelled item.');
  }

  // Load configuration for cancel/edit cutoff:
  const configSnap = await db.collection('config').doc('system').get();
  const config = configSnap.data() || {};

  const srv = item.serviceSlot.startsWith('Dinner') ? 'dinner' : 'lunch';
  const timeKey = srv === 'dinner' ? 'dinnerCancelCutoffTime' : 'lunchCancelCutoffTime';
  const offsetKey = srv === 'dinner' ? 'dinnerCancelCutoffDayOffset' : 'lunchCancelCutoffDayOffset';

  const cancelCutoffTime = config[timeKey] || config.cancelCutoffTime || config.cutoffTime || '09:00';
  const cancelCutoffDayOffset = typeof config[offsetKey] === 'number' ? config[offsetKey]
    : (typeof config.cancelCutoffDayOffset === 'number' ? config.cancelCutoffDayOffset
    : (typeof config.cutoffDayOffset === 'number' ? config.cutoffDayOffset : 0));

  const systemDateOverride = getOverrideDate(request);

  if (checkCutoffPassed(item.deliveryDate, cancelCutoffTime, cancelCutoffDayOffset, systemDateOverride)) {
    throw new HttpsError('failed-precondition', `The editing cutoff time for this ${srv} delivery day has passed.`);
  }

  // Load current catalogs, menus, and menu defaults
  const [basesSnap, bevSnap, desSnap, defaultsSnap, dhalsSnap, saladsSnap] = await Promise.all([
    db.collection('mealBases').doc('current').get(),
    db.collection('mealBeverages').doc('current').get(),
    db.collection('mealDesserts').doc('current').get(),
    db.collection('menuDefaults').doc('current').get(),
    db.collection('mealDhals').doc('current').get(),
    db.collection('mealSalads').doc('current').get(),
  ]);
  const basesArr = (basesSnap.data() || {}).items || [];
  const bevArr = (bevSnap.data() || {}).items || [];
  const desArr = (desSnap.data() || {}).items || [];
  const menuDefaults = defaultsSnap.data() || {};
  const dhalsArr = (dhalsSnap.data() || {}).items || [];
  const saladsArr = (saladsSnap.data() || {}).items || [];

  // Find dish on the menu to check price
  const { baseId, beverageId, dessertId, dhalId, saladId, note } = selection;
  const deliveryDate = item.deliveryDate;
  const service = item.serviceSlot.startsWith('Dinner') ? 'Dinner' : 'Lunch';
  
  const weekStart = weekStartOf(deliveryDate);
  const weekdayKey = weekdayKeyOf(deliveryDate);
  const serviceKey = service === 'Dinner' ? 'dinner' : 'lunch';
  
  const weekOverrideSnap = await db.collection('menuWeeks').doc(weekStart).get();
  const weekOverride = weekOverrideSnap.exists ? weekOverrideSnap.data() : {};
  const daySource =
    (weekOverride[serviceKey] && weekOverride[serviceKey][weekdayKey]) ||
    (menuDefaults[serviceKey] && menuDefaults[serviceKey][weekdayKey]) ||
    [];
  const dish = daySource.find((c) => c.id === item.itemId);
  if (!dish) {
    throw new HttpsError('invalid-argument', `Dish is no longer on the menu for ${deliveryDate}.`);
  }

  const base = basesArr.find((b) => b.id === baseId);
  const beverage = beverageId && beverageId !== 'none' ? bevArr.find((b) => b.id === beverageId) : null;
  const dessert = dessertId && dessertId !== 'none' ? desArr.find((d) => d.id === dessertId) : null;

  const newPrice = (dish.price || 0) + (base?.up || 0) + (beverage?.price || 0) + (dessert?.price || 0);

  // Recalculate notes string:
  const parts = [];
  if (base) parts.push(base.name);
  const dh = dhalId && dhalId !== 'none' ? dhalsArr.find(x => x.id === dhalId) : null;
  if (dh) parts.push(dh.name);
  const sl = saladId && saladId !== 'none' ? saladsArr.find(x => x.id === saladId) : null;
  if (sl) parts.push(sl.name);
  if (beverage) parts.push(beverage.name);
  if (dessert) parts.push(dessert.name);
  if (note && note.trim()) parts.push(`for ${note.trim()}`);
  const newNotes = parts.join(' · ');

  const orderRef = db.collection('orders').doc(orderId);
  const customerRef = db.collection('customers').doc(uid);

  let newTotal = 0;
  let refundAmount = 0;

  await db.runTransaction(async (tx) => {
    const [customerSnap, tiersSnap, groupsSnap, orderSnap, itemsSnap] = await Promise.all([
      tx.get(customerRef),
      tx.get(db.collection('loyaltyTiers').doc('current')),
      tx.get(db.collection('customerGroups').doc('current')),
      tx.get(orderRef),
      tx.get(orderRef.collection('items'))
    ]);
    const customer = customerSnap.data() || {};
    const tiersArr = (tiersSnap.data() || {}).items || [];
    const groupsArr = (groupsSnap.data() || {}).items || [];
    const order = orderSnap.data() || {};

    const isPaid = item.paymentStatus === 'Paid';

    // 1. Update the item
    tx.update(itemRef, {
      price: newPrice,
      notes: newNotes,
      name: `${dish.emoji || ''} ${dish.name || 'Meal'}`.trim(),
      updatedAt: Timestamp.now()
    });

    // 2. Recalculate parent order total
    const activeItems = [];
    itemsSnap.forEach(doc => {
      const it = doc.data();
      if (doc.id === itemId) {
        activeItems.push({
          ...it,
          price: newPrice,
          notes: newNotes
        });
      } else if (it.status !== 'Cancelled') {
        activeItems.push(it);
      }
    });

    const pricing = calculateItemsTotal(activeItems, customer, tiersArr, groupsArr, config);
    newTotal = pricing.total;

    // 3. Update order document with new total
    tx.update(orderRef, {
      total: newTotal,
      updatedAt: Timestamp.now()
    });

    // 4. If paid, adjust customer store credit
    if (isPaid) {
      const originalTotal = order.total || 0;
      refundAmount = originalTotal - newTotal; // Positive if refund, negative if extra cost
      tx.update(customerRef, {
        storeCredit: (customer.storeCredit || 0) + refundAmount,
        updatedAt: Timestamp.now()
      });

      // 5. Append to audit log
      const auditRef = db.collection('auditLog').doc();
      tx.set(auditRef, {
        timestamp: Timestamp.now(),
        userId: uid,
        userName: customer.name || '',
        action: 'ORDER_ITEM_EDIT',
        details: `Edited item ${itemId} in order ${orderId}. Adjusted store credit by Rs ${refundAmount} (new total: ${newTotal}).`,
      });
    }
  });

  return { newPrice, newTotal, refundAmount };
});

