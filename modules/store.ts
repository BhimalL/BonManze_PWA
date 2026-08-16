
import { MenuItem, LoyaltyTier, CustomerGroup, Order, OrderItem, PaymentMethod, Customer } from '../types';
// Meal Library / Menu Planner (Mains, weekly Lunch/Dinner menus, the
// menuDefaults fallback, and the five Base/Dhal/Salad/Beverage/Dessert
// add-on catalogs plus the Icon Library) are wired directly to Firestore
// here in store.ts rather than via component-local onSnapshot listeners
// (the pattern Operations.tsx/CustomerPortal.tsx use for orders/customers).
// That's a deliberate exception: resolveDish()/specialPriceInfo()/
// filterAddOnOptions() below are plain functions that read these
// module-level arrays directly and are shared by both Operations.tsx and
// CustomerPortal.tsx — syncing Firestore straight into the same exported
// `let` bindings those functions already read means every existing call
// site in both files keeps working completely unchanged, and
// CustomerPortal's menu-drift risk closes with zero changes there, since
// it already only ever reads through these bindings/functions too (see
// BonManzE_Firestore_Schema.md, decision #12, for the full reasoning).
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, deleteField, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebaseClient';
import { onAuthStateChanged } from 'firebase/auth';

// Every mock-era optional field in this file (MainDish.cost/photoUrl,
// CurryOption.baseOptionIds/dhalOptionIds/..., AddOnOption.price/up/group,
// etc.) has always used `field: undefined` to mean "no value" — harmless
// for a plain JS object/spread, but the Firestore SDK rejects a literal
// `undefined` anywhere in written data (nested or top-level) with
// "Unsupported field value: undefined", unlike `null`. Every write path
// below needs to sanitize this before handing data to setDoc/updateDoc,
// rather than relying on every call site in Operations.tsx to know not to
// do this (confirmed live 2026-08-13: editing a Main whose form leaves
// `cost` blank throws exactly this error from `saveMainEditor`'s patch,
// which unconditionally includes `baseGroup: undefined`).
//
// dropUndefined recursively removes undefined-valued keys/array entries —
// correct for setDoc (a full-document or full-array-element write, where
// "no value" and "key absent" mean the same thing) and for values nested
// inside a merge-written map field (menuWeeks' per-day CurryOption[]
// arrays are always written as complete replacements, never merged
// element-by-element — Firestore doesn't merge inside arrays regardless).
// Deliberately does NOT recurse into a Firestore FieldValue sentinel
// (serverTimestamp(), deleteField(), etc.) — those are opaque marker
// objects, not plain data, and destructuring one would break it. Every
// call site below applies this only to the plain-data portion of a write,
// adding `updatedAt: serverTimestamp()` afterward, never running it over
// the sentinel itself.
const dropUndefined = <T>(value: T): T => {
  if (Array.isArray(value)) return value.filter(v => v !== undefined).map(dropUndefined) as unknown as T;
  if (value !== null && typeof value === 'object' && value.constructor === Object) {
    const out: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([k, v]) => {
      if (v !== undefined) out[k] = dropUndefined(v);
    });
    return out as T;
  }
  return value;
};

// For updateDoc specifically: an explicit `updates.field = undefined` (as
// `saveMainEditor`'s patch always sends for baseGroup, and conditionally
// for cost/photoUrl/*OptionIds) means "clear this field" — updateDoc only
// touches the keys present in its payload, so simply dropping an
// undefined-valued key (dropUndefined's behavior) would silently leave
// Firestore's stale prior value in place instead of clearing it. Firestore's
// own sentinel for "delete this field on update" is deleteField() — this
// swaps every top-level undefined for that sentinel instead of dropping it.
const toUpdatePayload = (updates: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  Object.entries(updates).forEach(([k, v]) => { out[k] = v === undefined ? deleteField() : v; });
  return out;
};

// Helper to get real today's date in YYYY-MM-DD ISO format
export const getRealTodayISO = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Unified System Clock for Mocks - defaults to real device date
export let MOCK_TODAY = getRealTodayISO();

const systemDateListeners = new Set<(date: string) => void>();

export const subscribeToSystemDate = (listener: (date: string) => void) => {
  systemDateListeners.add(listener);
  listener(MOCK_TODAY);
  return () => { systemDateListeners.delete(listener); };
};

export const updateSystemDate = (date: string) => {
  MOCK_TODAY = date;
  systemDateListeners.forEach(l => l(MOCK_TODAY));
  notifyOrderListeners();
  notifyCashierListeners();
  notifyPosListeners();
};

// Central Configuration
export const SYSTEM_CONFIG = {
  operatingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  activeServices: ['Breakfast', 'Lunch', 'Dinner'],
  // Same-day cutoff (24h "HH:MM") — a delivery day locks for new orders,
  // edits and cancels once the wall clock passes this time on that day.
  // '09:00' matches the rule the app has always enforced (see isPastCutoff
  // in CustomerPortal.tsx); it's editable here so Bhimal can change it
  // without a code change, and the Customer App's copy (Home status card,
  // "New here?" guide, lock toasts) reads this value live instead of
  // hardcoding "9:00 AM"/"Sunday noon". Shared by Lunch and Dinner.
  cutoffTime: '09:00',
  // Which day the cutoff above falls on, relative to the delivery day: 0 =
  // same day as delivery (the current rule), -1 = the day before delivery,
  // -2 = two days before, and so on. Kept as a signed integer rather than a
  // pair of enums so "3 days before" etc. just works without adding cases.
  cutoffDayOffset: 0,
  // Separated ordering and cancellation/edit cutoffs:
  orderCutoffTime: '09:00',
  orderCutoffDayOffset: 0,
  cancelCutoffTime: '09:00',
  cancelCutoffDayOffset: 0,
  // Lunch specific cutoffs:
  lunchOrderCutoffTime: '12:00',
  lunchOrderCutoffDayOffset: -1,
  lunchCancelCutoffTime: '09:00',
  lunchCancelCutoffDayOffset: 0,
  // Dinner specific cutoffs:
  dinnerOrderCutoffTime: '12:00',
  dinnerOrderCutoffDayOffset: 0,
  dinnerCancelCutoffTime: '14:00',
  dinnerCancelCutoffDayOffset: 0,
  // Delivery arrival windows shown to customers — free text since it's
  // display-only, not used for any scheduling logic. Dinner gets its own
  // window since it naturally arrives later in the day than Lunch.
  lunchDeliveryWindow: '11:30–12:00',
  dinnerDeliveryWindow: '18:30–19:30',
  deadlinePolicy: '1 Day Before',
  currencySymbol: 'Rs',
  vatEnabled: true,
  vatRate: 15,
  vatNumber: 'VAT12345678',
  bulkDiscountEnabled: true,
  bulkDiscountRate: 5,
  // Business identity — editable from Operations so branding (and the
  // invoice/receipt) doesn't require a code change to update. logoUrl is a
  // plain image URL rather than an upload, since there's no backend/storage
  // to hold an uploaded file; '' falls back to the default mark everywhere
  // this is used.
  businessName: 'BonManzE',
  businessTagline: 'Homemade · Delivered fresh',
  businessLogoUrl: '',
  supportPhone: '59412131',
  supportEmail: 'bhimalonly@gmail.com',
  // Dinner is a second, independently toggleable offering that otherwise
  // works exactly like Lunch — same weekly-menu pattern, same cart/checkout
  // flow, same 9AM same-day cutoff. See WEEKLY_DINNER_MENU below.
  dinnerEnabled: true,
  birthdayHeaderCreole: 'Zwaye Laniverser! 🎂🎉',
  birthdayHeaderEnglish: 'Wishing you a wonderful day filled with delicious curries! 🎂🎈',
  birthdayStickerCreole: '🎂 ZWAYE LANIVERSER! 🎂',
  birthdayStickerEnglish: 'Happy Birthday!'
};

export const formatNumber = (value: number | undefined | null) => {
  if (value === undefined || value === null || isNaN(value)) return '0.00';
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const formatCurrency = (value: number) => {
  return `${SYSTEM_CONFIG.currencySymbol} ${formatNumber(value)}`;
};

export const calculateTotal = (price: number): number => {
  const vatMultiplier = 1 + (SYSTEM_CONFIG.vatEnabled ? SYSTEM_CONFIG.vatRate / 100 : 0);
  return price * vatMultiplier;
};

export const getTaxRate = (): number => {
  return SYSTEM_CONFIG.vatEnabled ? SYSTEM_CONFIG.vatRate : 0;
};

// Global Payment Methods
export let PAYMENT_METHODS: PaymentMethod[] = [
  { id: '1', name: 'Cash (Drawer)', type: 'Cash', isActive: true, icon: '💵', applicableTo: ['Dine-In', 'Takeout'] },
  { id: '2', name: 'Visa / MC', type: 'Card', isActive: true, icon: '💳', applicableTo: ['Dine-In', 'Takeout', 'Delivery', 'Meal Plan'] },
  { id: '3', name: 'Juice / Transfer', type: 'Digital', isActive: true, icon: '📱', applicableTo: ['Delivery', 'Meal Plan', 'Takeout'] },
  { id: '4', name: 'Cash on Delivery', type: 'Cash', isActive: true, icon: '🚚', applicableTo: ['Delivery', 'Meal Plan'] },
  { id: '5', name: 'Staff Meal', type: 'Voucher', isActive: true, icon: '🎫', applicableTo: ['Dine-In'] },
  { id: '6', name: 'MauCAS', type: 'Digital', isActive: true, icon: '📲', applicableTo: ['Delivery', 'Meal Plan'] },
];

// The Meal Plan side of the business (Customer App checkout + Operator
// Console's payment collection) only ever offers these three — the rest of
// PAYMENT_METHODS (Cash Drawer, Visa/MC, Staff Meal) are legacy dine-in/POS
// entries left over from the cut ERP modules. Single source of truth so
// both surfaces stay in sync instead of each hardcoding its own list.
export const MEAL_PLAN_PAYMENT_METHOD_NAMES = ['Juice / Transfer', 'MauCAS', 'Cash on Delivery'];

// --- INVENTORY MASTER DATA ---
export interface InventoryItem {
  sku: string;
  name: string;
  unit: string;
  cost: number;
}

export const INVENTORY_ITEMS: InventoryItem[] = [
  { sku: 'MET-401', name: 'Prime Brisket', unit: 'kg', cost: 21.50 },
  { sku: 'MET-502', name: 'Angus Ribeye', unit: 'unit', cost: 18.20 },
  { sku: 'FSH-102', name: 'Atlantic Salmon', unit: 'kg', cost: 28.00 },
  { sku: 'VEG-301', name: 'Heirloom Tomatoes', unit: 'kg', cost: 4.50 },
  { sku: 'DRY-101', name: 'Truffle Oil', unit: 'L', cost: 45.00 },
  { sku: 'DRY-202', name: 'Arborio Rice', unit: 'kg', cost: 6.20 },
  { sku: 'DAI-101', name: 'Parmesan Reggiano', unit: 'kg', cost: 22.00 },
  { sku: 'DRY-105', name: 'Hickory Oil', unit: 'L', cost: 15.00 },
  { sku: 'VEG-305', name: 'Fresh Romaine', unit: 'head', cost: 2.00 },
  { sku: 'DRY-303', name: 'Brioche Bun', unit: 'pcs', cost: 0.80 },
  { sku: 'FSH-201', name: 'Fresh Tuna Loin', unit: 'kg', cost: 35.00 },
];

// --- MEAL LIBRARY & PLANNER ---
export let MEAL_LIBRARY_ITEMS: MenuItem[] = [
  { 
    id: '1', 
    name: 'Texas Smoked Brisket', 
    category: 'Mains', 
    price: 1250.00, 
    cost: 350.00, 
    status: 'Active', 
    availability: ['Dine-In', 'Takeout', 'Meal Plan'], 
    image: 'https://picsum.photos/seed/brisket/200/200', 
    description: 'Slow-smoked over hickory for 12 hours.',
    tags: ['Meat', 'Smoked', 'Gluten-Free'],
    ingredients: [
      { sku: 'MET-401', name: 'Prime Brisket', qty: 0.3, cost: 21.50 },
      { sku: 'DRY-105', name: 'Hickory Oil', qty: 0.05, cost: 15.00 }
    ]
  },
  { 
    id: '2', 
    name: 'Atlantic Salmon', 
    category: 'Mains', 
    price: 1100.00, 
    cost: 320.00, 
    status: 'Active', 
    availability: ['Dine-In', 'Online', 'Meal Plan'], 
    image: 'https://picsum.photos/seed/salmon/200/200', 
    description: 'Pan-seared with lemon butter sauce.',
    tags: ['Seafood', 'Gluten-Free', 'Keto'],
    ingredients: [
      { sku: 'FSH-102', name: 'Atlantic Salmon', qty: 0.22, cost: 28.00 }
    ]
  },
  { 
    id: '3', 
    name: 'Caesar Salad', 
    category: 'Starters', 
    price: 400.00, 
    cost: 120.00, 
    status: 'Active', 
    availability: ['Dine-In', 'Takeout', 'Meal Plan'], 
    image: 'https://picsum.photos/seed/salad/200/200', 
    description: 'Crisp romaine with parmesan and croutons.',
    tags: ['Vegetarian', 'Starters'],
    ingredients: [
      { sku: 'VEG-305', name: 'Fresh Romaine', qty: 1, cost: 2.00 },
      { sku: 'DAI-101', name: 'Parmesan Reggiano', qty: 0.05, cost: 22.00 }
    ]
  },
  { 
    id: '4', 
    name: 'Wagyu Burger', 
    category: 'Mains', 
    price: 950.00, 
    cost: 450.00, 
    status: 'Active', 
    availability: ['Dine-In', 'Takeout'], 
    image: 'https://picsum.photos/seed/burger/200/200', 
    description: 'Premium wagyu beef patty with truffle mayo.',
    tags: ['Meat', 'Comfort'],
    ingredients: [
      { sku: 'MET-502', name: 'Angus Ribeye', qty: 1, cost: 18.20 },
      { sku: 'DRY-303', name: 'Brioche Bun', qty: 1, cost: 0.80 }
    ]
  },
  { 
    id: '5', 
    name: 'Truffle Pasta', 
    category: 'Mains', 
    price: 850.00, 
    cost: 250.00, 
    status: 'Active', 
    availability: ['Dine-In', 'Meal Plan'], 
    image: 'https://picsum.photos/seed/pasta/200/200', 
    description: 'Fresh tagliatelle with black truffle cream.',
    ingredients: [
      { sku: 'DRY-101', name: 'Truffle Oil', qty: 0.02, cost: 45.00 },
      { sku: 'DAI-101', name: 'Parmesan Reggiano', qty: 0.08, cost: 22.00 }
    ]
  },
  { 
    id: '6', 
    name: 'Poke Bowl', 
    category: 'Mains', 
    price: 900.00, 
    cost: 300.00, 
    status: 'Active', 
    availability: ['Takeout', 'Online', 'Meal Plan'], 
    image: 'https://picsum.photos/seed/poke/200/200', 
    description: 'Fresh tuna with rice and edamame.',
    ingredients: [
      { sku: 'FSH-201', name: 'Fresh Tuna Loin', qty: 0.15, cost: 35.00 },
      { sku: 'DRY-202', name: 'Arborio Rice', qty: 0.15, cost: 6.20 }
    ]
  },
];

const mealLibraryListeners = new Set<(meals: MenuItem[]) => void>();

export const subscribeToMealLibrary = (listener: (meals: MenuItem[]) => void) => {
  mealLibraryListeners.add(listener);
  listener([...MEAL_LIBRARY_ITEMS]);
  return () => { mealLibraryListeners.delete(listener); };
};

export const addMealToLibrary = (meal: MenuItem) => {
  MEAL_LIBRARY_ITEMS = [...MEAL_LIBRARY_ITEMS, meal];
  mealLibraryListeners.forEach(l => l([...MEAL_LIBRARY_ITEMS]));
};

export const updateMealInLibrary = (meal: MenuItem) => {
  MEAL_LIBRARY_ITEMS = MEAL_LIBRARY_ITEMS.map(m => m.id === meal.id ? meal : m);
  mealLibraryListeners.forEach(l => l([...MEAL_LIBRARY_ITEMS]));
};

export let PUBLISHED_PLAN: any = {};

export const publishPlan = (plan: any) => {
    PUBLISHED_PLAN = plan;
    // PUBLISHED_PLAN has no listener set of its own (CustomerPortal reads it
    // on demand via getDayMenu rather than subscribing), so it can't
    // piggyback on the persistAll-via-listener-set trick below. Persist it
    // directly here instead.
    persistAll();
};

export const getDayMenu = (dateKey: string, service: string) => {
  if (PUBLISHED_PLAN[dateKey] && PUBLISHED_PLAN[dateKey][service]) {
      return PUBLISHED_PLAN[dateKey][service];
  }
  // Fallback mock data if no plan is published for that day
  return MEAL_LIBRARY_ITEMS.filter(i => i.availability.includes('Meal Plan') && (i.category === 'Mains' || i.category === 'Starters')).slice(0, 4);
};

// --- BONMANZE WEEKLY CURRY MENU ---
// This is the real product data: a home-made Mauritian lunch service, one
// curry family a day, built with a 3-step curry -> base -> extras wizard.
// It replaces MEAL_LIBRARY_ITEMS (a generic restaurant catalog left over
// from the ERP scaffold) as the source of truth for what the Customer App
// actually sells. MEAL_LIBRARY_ITEMS is left in place, unused by the
// Customer App, in case anything else in the tree still reads it.
export interface CurryOption {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  price: number;

  // Whether the Dhal / Salad steps apply to this dish at all — optional,
  // default true (existing behavior) when unset. Set to false for a dish
  // that doesn't pair with a free dhal/salad; the meal builder skips that
  // step entirely (not just defaults it to "none") when false.
  dhalApplicable?: boolean;
  saladApplicable?: boolean;
  // Which specific catalog entries this dish offers within an applicable
  // category — optional, undefined/empty means "all of them" (today's
  // behavior for every existing dish). Lets two dishes that both allow Dhal
  // still differ on *which* dhals they offer (e.g. a spicier dish only
  // pairing with Red Lentil, not Yellow) — narrower than the all-or-nothing
  // dhalApplicable/saladApplicable switch above. Beverage/Dessert have no
  // applicable switch (every dish always offers both), just this narrowing.
  dhalOptionIds?: string[];
  saladOptionIds?: string[];
  beverageOptionIds?: string[];
  dessertOptionIds?: string[];
  // Whether Beverage/Dessert apply at all — optional, default true (today's
  // behavior: every dish offers both, narrowed only by *OptionIds above).
  // Mirrors dhalApplicable/saladApplicable so all five extras — Base, Dhal,
  // Salad, Beverage, Dessert — follow the same applicable+narrow pattern.
  beverageApplicable?: boolean;
  dessertApplicable?: boolean;
  // Whether a Base step applies at all, and which specific Base catalog
  // entries this dish offers — the same applicable+narrow pattern as Dhal/
  // Salad/Beverage/Dessert.
  baseApplicable?: boolean;
  baseOptionIds?: string[];
  // A custom uploaded photo for this dish (data URL or path) — takes
  // priority over dishPhotoFor's id-based protein-family fallback below.
  // Optional: dishes that never had a photo assigned keep using that
  // fallback exactly as before.
  photoUrl?: string;
  // Which Meal Library Main (see MainDish/MAIN_DISHES below) this day-slot
  // entry was copied from, if any — set automatically when Menu Planner's
  // "Add dish" picks a Main from the Library, left unset for a dish that
  // predates the Library or was never linked to one. Name/description and
  // price stay the day-slot's own value (price is deliberately overridable
  // per day — see specialPriceInfo — and name/desc are locked-but-frozen in
  // the Menu Planner's editor). Every Base/Dhal/Salad/Beverage/Dessert
  // applicable+narrowing setting and the dish photo, however, are resolved
  // LIVE from the linked Main via resolveDish() below — editing those in
  // the Library immediately applies to every day that references it,
  // rather than requiring every already-planned day to be re-picked. This
  // supersedes an earlier "one-time copy, never live" design for those
  // fields, which turned out to mean unticking a category in the Library
  // silently had no effect on days already planned from that Main.
  mainId?: string;
}

// Read-with-defaults helpers — every consumer (meal builder, Menu Planner
// forms) should read through these rather than the raw optional fields, so
// "unset" reliably means "behaves like an existing curry" everywhere.
export const dishDhalApplicable = (dish: CurryOption): boolean => dish.dhalApplicable ?? true;
export const dishSaladApplicable = (dish: CurryOption): boolean => dish.saladApplicable ?? true;
export const dishBeverageApplicable = (dish: CurryOption): boolean => dish.beverageApplicable ?? true;
export const dishDessertApplicable = (dish: CurryOption): boolean => dish.dessertApplicable ?? true;
export const dishBaseApplicable = (dish: CurryOption): boolean => dish.baseApplicable ?? true;
// Effective allowed Base ids for a dish — undefined means no restriction
// (show all bases), otherwise the explicit narrow list from the Library.
export const dishBaseOptionIds = (dish: CurryOption, _allBases: AddOnOption[]): string[] | undefined => dish.baseOptionIds;

// --- MEAL LIBRARY (Mains) ---
// The master catalog of dishes Bhimal actually sells — every field a day-menu
// slot needs (base group, dhal/salad applicability and narrowing, beverage/
// dessert narrowing, price) defined ONCE per Main rather than re-specified
// every time it appears on a day. Menu Planner's "Add dish" now searches and
// copies from here (a one-time copy — see CurryOption.mainId above) instead
// of building a dish from a blank form, so the same Main's settings stay
// consistent everywhere it's served. `cost` is admin-only (food cost, for
// future margin tracking) — never shown to customers.
export interface MainDish extends CurryOption {
  cost?: number;
}

// Backed by the `mains/{mainId}` Firestore collection (already seeded — see
// scripts/migrateMenuLibrary.js) — starts empty and fills in the instant the
// first onSnapshot batch arrives, same "empty until Firestore answers"
// pattern Operations.tsx already uses for orders/customers.
export let MAIN_DISHES: MainDish[] = [];
const mainDishListeners = new Set<(items: MainDish[]) => void>();
export const subscribeToMainDishes = (listener: (items: MainDish[]) => void) => {
  mainDishListeners.add(listener);
  listener([...MAIN_DISHES]);
  return () => { mainDishListeners.delete(listener); };
};
onSnapshot(collection(db, 'mains'), snap => {
  MAIN_DISHES = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<MainDish, 'id'>) }));
  mainDishListeners.forEach(l => l([...MAIN_DISHES]));
});
// `dish.id` is client-generated (e.g. `main-${Date.now()...}`, same as every
// other call site in this file) and used directly as the Firestore doc id —
// matches migrateMenuLibrary.js's own `mains/{mainId}` shape, so a
// hand-added Main and a migrated one look identical in Firestore.
export const addMainDish = async (dish: MainDish) => {
  const { id, ...fields } = dish;
  await setDoc(doc(db, 'mains', id), { ...dropUndefined(fields), updatedAt: serverTimestamp() });
};
export const updateMainDish = async (id: string, updates: Partial<Omit<MainDish, 'id'>>) => {
  await updateDoc(doc(db, 'mains', id), { ...toUpdatePayload(updates), updatedAt: serverTimestamp() });
};
export const removeMainDish = async (id: string) => {
  await deleteDoc(doc(db, 'mains', id));
};

// Whether a day-slot dish is currently running at a special/promo price —
// true whenever it's linked to a Main (mainId) whose *current* general
// price differs from what this specific day is charging. Comparing against
// the Main's live price (not a frozen snapshot) is deliberate: raising or
// lowering a Main's general price in the Library should immediately make
// any day still priced at the old value read as a promo/markup relative to
// today's normal price, without editing every day that references it.
export const specialPriceInfo = (dish: CurryOption): { regularPrice: number } | null => {
  if (!dish.mainId) return null;
  const main = MAIN_DISHES.find(m => m.id === dish.mainId);
  if (!main || main.price === dish.price) return null;
  return { regularPrice: main.price };
};

// Resolves a day-slot dish's Meal-Library-governed configuration through
// its linked Main (mainId), live — every Base/Dhal/Salad/Beverage/Dessert
// applicable+narrowing field reflects the Main's *current* definition rather
// than whatever was copied onto the day when it was first picked. Editing a
// Main in the Library immediately applies everywhere that Main is used.
// `price`, `id`, `mainId`, `name`, `desc`, and `emoji` deliberately stay
// the day-slot's own value. A dish with no mainId, or whose linked Main was
// since deleted, is returned unchanged.
export const resolveDish = (dish: CurryOption): CurryOption => {
  if (!dish.mainId) return dish;
  const main = MAIN_DISHES.find(m => m.id === dish.mainId);
  if (!main) return dish;
  return {
    ...dish,
    baseApplicable: main.baseApplicable,
    baseOptionIds: main.baseOptionIds,
    dhalApplicable: main.dhalApplicable,
    dhalOptionIds: main.dhalOptionIds,
    saladApplicable: main.saladApplicable,
    saladOptionIds: main.saladOptionIds,
    beverageApplicable: main.beverageApplicable,
    beverageOptionIds: main.beverageOptionIds,
    dessertApplicable: main.dessertApplicable,
    dessertOptionIds: main.dessertOptionIds,
  };
};

// Narrows a full add-on catalog (MEAL_DHALS, MEAL_SALADS, MEAL_BEVERAGES,
// MEAL_DESSERTS) down to the subset a specific dish allows. undefined or an
// empty array means "no restriction" — every existing dish (which has never
// set *OptionIds) keeps showing the full catalog exactly as before.
export const filterAddOnOptions = (items: AddOnOption[], allowedIds?: string[]): AddOnOption[] =>
  (!allowedIds || allowedIds.length === 0) ? items : items.filter(i => allowedIds.includes(i.id));

export const WEEKDAY_KEYS = ['MON', 'TUE', 'WED', 'THU', 'FRI'] as const;
export type WeekdayKey = typeof WEEKDAY_KEYS[number];

// Menus are week-specific: each calendar week (keyed by that week's Monday,
// e.g. "2026-08-17") can have its own curry lineup. A week with no override
// just falls back to the DEFAULT rotation below — so nothing changes unless
// a specific week is deliberately set apart (e.g. planning a different menu
// for next week), and the mechanism isn't limited to "next week" specifically:
// any week, any number of weeks out, can get its own menu the same way.
// Shared by both Lunch and Dinner (two independent instances) via this
// factory, same mutable-store pattern as LOYALTY_TIERS/CUSTOMER_GROUPS —
// a module-level binding plus a listener set, rather than local component
// state.
//
// Backed by Firestore: `menuDefaults/current` (read-only from here — see
// setDefaultMenu below; the Menu Planner UI never edits an abstract
// "default", only real calendar weeks, per Operations.tsx's
// activeMenuWeekStart) supplies the fallback, and `menuWeeks/{weekStart}`
// (one doc per week that has ANY override, `{ lunch?, dinner?, updatedAt }`
// — the two services are independent keys on the SAME doc) supplies
// `overrides`. update/addDish/removeDish/setWeekMenu below write straight to
// Firestore and return a Promise; `overrides` itself only ever changes via
// applySnapshot(), called from the single shared `menuWeeks` collection
// listener declared right after both stores exist (see below) — so a write
// here becomes visible through forWeek()/subscribe() once it round-trips
// through Firestore's onSnapshot, the same "write, then let the listener
// update local state" shape Operations.tsx already uses for orders/
// customers (e.g. its Mark Delivered/Mark Paid batches).
function createWeeklyMenuStore(serviceKey: 'lunch' | 'dinner', initialDefaultMenu: Record<WeekdayKey, CurryOption[]>) {
  let defaultMenu: Record<WeekdayKey, CurryOption[]> = initialDefaultMenu;
  let overrides: Record<string, Record<WeekdayKey, CurryOption[]>> = {};
  const listeners = new Set<(overrides: Record<string, Record<WeekdayKey, CurryOption[]>>) => void>();
  const notify = () => listeners.forEach(l => l({ ...overrides }));

  const forWeek = (weekStart: string): Record<WeekdayKey, CurryOption[]> => overrides[weekStart] || defaultMenu;

  const subscribe = (listener: (overrides: Record<string, Record<WeekdayKey, CurryOption[]>>) => void) => {
    listeners.add(listener);
    listener({ ...overrides });
    return () => { listeners.delete(listener); };
  };

  // Called only from the menuDefaults/current onSnapshot handler below.
  const setDefaultMenu = (menu: Record<WeekdayKey, CurryOption[]>) => {
    defaultMenu = menu;
    notify();
  };

  // Called only from the menuWeeks collection onSnapshot handler below.
  // `menu === undefined` means this service's key is gone from that week's
  // doc (removed, or the whole doc was deleted) — falls back to defaultMenu.
  const applySnapshot = (weekStart: string, menu: Record<WeekdayKey, CurryOption[]> | undefined) => {
    if (menu === undefined) {
      if (!(weekStart in overrides)) return;
      const next = { ...overrides };
      delete next[weekStart];
      overrides = next;
    } else {
      overrides = { ...overrides, [weekStart]: menu };
    }
    notify();
  };

  // Writes this service's key on menuWeeks/{weekStart}, merged so the OTHER
  // service's key on the same doc (if any) is left untouched — a week can
  // have only Lunch overridden, only Dinner, or both, per the schema doc.
  const writeWeek = (weekStart: string, menu: Record<WeekdayKey, CurryOption[]>) =>
    setDoc(doc(db, 'menuWeeks', weekStart), { [serviceKey]: dropUndefined(menu), updatedAt: serverTimestamp() }, { merge: true });

  // Edits one curry option's name/description/price for a given weekday
  // within a given week — scoped to editing what's already on the menu, not
  // adding/removing curry slots (that would touch dishPhotoFor's id-based
  // photo family mapping and the builder's assumptions about fixed option
  // counts, a bigger change than "the price went up this week"). The first
  // edit to a week seeds its override from whatever it currently shows
  // (the default, or an earlier override), so only the touched week diverges.
  // Widened to accept any dish field (not just name/desc/price/emoji) so
  // editing an existing dish can also update baseGroup/dhalApplicable/
  // saladApplicable/*OptionIds — the Menu Planner's dish editor now covers
  // all of these on both add and edit, not just the original three text
  // fields.
  const update = (weekStart: string, day: WeekdayKey, curryId: string, updates: Partial<Omit<CurryOption, 'id'>>) => {
    const base = overrides[weekStart] || defaultMenu;
    return writeWeek(weekStart, { ...base, [day]: base[day].map(c => c.id === curryId ? { ...c, ...updates } : c) });
  };

  // Adds a new main dish to a given day within a given week — same
  // seed-the-override-from-current-value approach as update(), so only the
  // touched week diverges from the default rotation.
  const addDish = (weekStart: string, day: WeekdayKey, dish: CurryOption) => {
    const base = overrides[weekStart] || defaultMenu;
    return writeWeek(weekStart, { ...base, [day]: [...base[day], dish] });
  };

  // Removes a main dish from a given day within a given week.
  const removeDish = (weekStart: string, day: WeekdayKey, dishId: string) => {
    const base = overrides[weekStart] || defaultMenu;
    return writeWeek(weekStart, { ...base, [day]: base[day].filter(c => c.id !== dishId) });
  };

  // Replaces an entire week's lineup in one atomic call — used by "reuse a
  // previous week's plan" (copy one week's override into another) and by
  // CSV import, so the copy/import doesn't require looping addDish/
  // removeDish/update per dish. Takes a plain menu object (a snapshot of
  // some week — either forWeek(sourceWeek) or a freshly parsed CSV), not a
  // reference into another week's live override, so editing the destination
  // afterwards never retroactively changes the source it was copied from.
  const setWeekMenu = (weekStart: string, menu: Record<WeekdayKey, CurryOption[]>) => writeWeek(weekStart, { ...menu });

  // Every weekStart key that currently has a saved override — lets Menu
  // Planner list and browse past/future weeks that were deliberately set
  // apart from the default rotation, without already knowing the key.
  // Sorted ascending (ISO date strings sort correctly as plain strings) so
  // a "browse previous weeks" UI can show them oldest/newest without an
  // extra sort step.
  const listWeekStarts = (): string[] => Object.keys(overrides).sort();

  return { forWeek, subscribe, update, addDish, removeDish, setWeekMenu, listWeekStarts, setDefaultMenu, applySnapshot };
}

const WEEKLY_LUNCH_MENU_DEFAULT: Record<WeekdayKey, CurryOption[]> = {
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

const lunchMenuStore = createWeeklyMenuStore('lunch', WEEKLY_LUNCH_MENU_DEFAULT);
export const lunchMenuForWeek = lunchMenuStore.forWeek;
export const subscribeToLunchMenu = lunchMenuStore.subscribe;
export const updateLunchCurryOption = lunchMenuStore.update;
export const addLunchDish = lunchMenuStore.addDish;
export const removeLunchDish = lunchMenuStore.removeDish;
export const setLunchWeekMenu = lunchMenuStore.setWeekMenu;
export const listLunchWeekStarts = lunchMenuStore.listWeekStarts;

// Dinner — a second offering, toggled on/off via SYSTEM_CONFIG.dinnerEnabled,
// that otherwise mirrors Lunch exactly: same shape, same week-override
// mechanism, same curry ids (so dishPhotoFor's protein-family photo mapping
// just works for these too, no new photos needed).
const WEEKLY_DINNER_MENU_DEFAULT: Record<WeekdayKey, CurryOption[]> = {
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

const dinnerMenuStore = createWeeklyMenuStore('dinner', WEEKLY_DINNER_MENU_DEFAULT);
export const dinnerMenuForWeek = dinnerMenuStore.forWeek;
export const subscribeToDinnerMenu = dinnerMenuStore.subscribe;
export const updateDinnerCurryOption = dinnerMenuStore.update;
export const addDinnerDish = dinnerMenuStore.addDish;
export const removeDinnerDish = dinnerMenuStore.removeDish;
export const setDinnerWeekMenu = dinnerMenuStore.setWeekMenu;
export const listDinnerWeekStarts = dinnerMenuStore.listWeekStarts;

// menuDefaults/current is the Firestore fallback both stores use in place
// of the hardcoded WEEKLY_LUNCH/DINNER_MENU_DEFAULT literals above (which
// now only serve as the initial value until this first snapshot arrives).
// Read-only from the client on purpose — Operations.tsx's Menu Planner
// always edits a real calendar week (activeMenuWeekStart), never an
// abstract "default", so there's no write path for this doc this round.
onSnapshot(doc(db, 'menuDefaults', 'current'), snap => {
  if (!snap.exists()) return;
  const data = snap.data() as { lunch?: Record<WeekdayKey, CurryOption[]>; dinner?: Record<WeekdayKey, CurryOption[]> };
  if (data.lunch) lunchMenuStore.setDefaultMenu(data.lunch);
  if (data.dinner) dinnerMenuStore.setDefaultMenu(data.dinner);
});

// menuWeeks/{weekStart} — one doc per week with ANY override, `lunch`/
// `dinner` independent optional keys on the SAME doc (a week can override
// just one service). A single collection listener feeds both stores'
// applySnapshot(), rather than each store subscribing separately, so a
// week doc with only a `lunch` key doesn't need dinnerMenuStore to guess
// whether its own key is "genuinely absent" vs. "not loaded yet". Weeks
// that disappear from the snapshot (doc deleted, or emptied down to no
// service keys) are swept via applySnapshot(weekStart, undefined) so a
// removed override actually falls back to the default rotation instead of
// getting stuck on the last value seen.
onSnapshot(collection(db, 'menuWeeks'), snap => {
  const seenLunch = new Set<string>();
  const seenDinner = new Set<string>();
  snap.forEach(docSnap => {
    const weekStart = docSnap.id;
    const data = docSnap.data() as { lunch?: Record<WeekdayKey, CurryOption[]>; dinner?: Record<WeekdayKey, CurryOption[]> };
    if (data.lunch) { lunchMenuStore.applySnapshot(weekStart, data.lunch); seenLunch.add(weekStart); }
    if (data.dinner) { dinnerMenuStore.applySnapshot(weekStart, data.dinner); seenDinner.add(weekStart); }
  });
  lunchMenuStore.listWeekStarts().forEach(w => { if (!seenLunch.has(w)) lunchMenuStore.applySnapshot(w, undefined); });
  dinnerMenuStore.listWeekStarts().forEach(w => { if (!seenDinner.has(w)) dinnerMenuStore.applySnapshot(w, undefined); });
});

export interface AddOnOption {
  id: string;
  emoji: string;
  name: string;
  price?: number;
  up?: number;
}

// Base/Dhal/Salad/Beverage/Dessert used to be plain immutable constants with
// no admin UI — changing them meant editing source code. Each is now a real
// mutable store (live-bound export + listener set + subscribe/add/update/
// remove), the same hand-rolled pattern as MEAL_LIBRARY_ITEMS/LOYALTY_TIERS
// above, so Operations can manage them and the meal builder can react live.

// Each of the five catalogs below is backed by a single Firestore doc,
// `meal{Bases,Dhals,Salads,Beverages,Desserts}/current`, shaped
// `{ items: AddOnOption[], updatedAt }` — already seeded (see
// scripts/migrateConfigDocs.js) and already read by confirmCheckout in
// functions/index.js for server-side pricing, so this is wiring the client
// onto data that's real in Firestore right now. The literal arrays below
// are only the fallback shown until the first onSnapshot batch arrives.
export let MEAL_BASES: AddOnOption[] = [
  { id: 'wrice', emoji: '🍚', name: 'White Rice', up: 0 },
  { id: 'brice', emoji: '🌾', name: 'Brown Rice', up: 15 },
  { id: 'quin', emoji: '🌿', name: 'Quinoa', up: 25 },
  { id: 'cous', emoji: '🫓', name: 'Couscous', up: 20 },
  { id: 'caul', emoji: '🥦', name: 'Cauliflower Rice', up: 20 },
];
const baseListeners = new Set<(items: AddOnOption[]) => void>();
export const subscribeToBases = (listener: (items: AddOnOption[]) => void) => {
  baseListeners.add(listener);
  listener([...MEAL_BASES]);
  return () => { baseListeners.delete(listener); };
};
onSnapshot(doc(db, 'mealBases', 'current'), snap => {
  if (!snap.exists()) return;
  MEAL_BASES = (snap.data().items || []) as AddOnOption[];
  baseListeners.forEach(l => l([...MEAL_BASES]));
});
export const addBaseOption = async (item: AddOnOption) => {
  await setDoc(doc(db, 'mealBases', 'current'), { items: dropUndefined([...MEAL_BASES, item]), updatedAt: serverTimestamp() });
};
export const updateBaseOption = async (id: string, updates: Partial<AddOnOption>) => {
  await setDoc(doc(db, 'mealBases', 'current'), { items: dropUndefined(MEAL_BASES.map(i => i.id === id ? { ...i, ...updates } : i)), updatedAt: serverTimestamp() });
};
export const removeBaseOption = async (id: string) => {
  await setDoc(doc(db, 'mealBases', 'current'), { items: dropUndefined(MEAL_BASES.filter(i => i.id !== id)), updatedAt: serverTimestamp() });
};

export let MEAL_DHALS: AddOnOption[] = [
  { id: 'moong', emoji: '🟡', name: 'Yellow Dhal' },
  { id: 'red', emoji: '🟤', name: 'Red Lentil Dhal' },
];
const dhalListeners = new Set<(items: AddOnOption[]) => void>();
export const subscribeToDhals = (listener: (items: AddOnOption[]) => void) => {
  dhalListeners.add(listener);
  listener([...MEAL_DHALS]);
  return () => { dhalListeners.delete(listener); };
};
onSnapshot(doc(db, 'mealDhals', 'current'), snap => {
  if (!snap.exists()) return;
  MEAL_DHALS = (snap.data().items || []) as AddOnOption[];
  dhalListeners.forEach(l => l([...MEAL_DHALS]));
});
export const addDhalOption = async (item: AddOnOption) => {
  await setDoc(doc(db, 'mealDhals', 'current'), { items: dropUndefined([...MEAL_DHALS, item]), updatedAt: serverTimestamp() });
};
export const updateDhalOption = async (id: string, updates: Partial<AddOnOption>) => {
  await setDoc(doc(db, 'mealDhals', 'current'), { items: dropUndefined(MEAL_DHALS.map(i => i.id === id ? { ...i, ...updates } : i)), updatedAt: serverTimestamp() });
};
export const removeDhalOption = async (id: string) => {
  await setDoc(doc(db, 'mealDhals', 'current'), { items: dropUndefined(MEAL_DHALS.filter(i => i.id !== id)), updatedAt: serverTimestamp() });
};

export let MEAL_SALADS: AddOnOption[] = [
  { id: 'garden', emoji: '🥗', name: 'Garden Salad' },
  { id: 'slaw', emoji: '🥙', name: 'Creole Slaw' },
];
const saladListeners = new Set<(items: AddOnOption[]) => void>();
export const subscribeToSalads = (listener: (items: AddOnOption[]) => void) => {
  saladListeners.add(listener);
  listener([...MEAL_SALADS]);
  return () => { saladListeners.delete(listener); };
};
onSnapshot(doc(db, 'mealSalads', 'current'), snap => {
  if (!snap.exists()) return;
  MEAL_SALADS = (snap.data().items || []) as AddOnOption[];
  saladListeners.forEach(l => l([...MEAL_SALADS]));
});
export const addSaladOption = async (item: AddOnOption) => {
  await setDoc(doc(db, 'mealSalads', 'current'), { items: dropUndefined([...MEAL_SALADS, item]), updatedAt: serverTimestamp() });
};
export const updateSaladOption = async (id: string, updates: Partial<AddOnOption>) => {
  await setDoc(doc(db, 'mealSalads', 'current'), { items: dropUndefined(MEAL_SALADS.map(i => i.id === id ? { ...i, ...updates } : i)), updatedAt: serverTimestamp() });
};
export const removeSaladOption = async (id: string) => {
  await setDoc(doc(db, 'mealSalads', 'current'), { items: dropUndefined(MEAL_SALADS.filter(i => i.id !== id)), updatedAt: serverTimestamp() });
};

export let MEAL_BEVERAGES: AddOnOption[] = [
  { id: 'alouda', emoji: '🥤', name: 'Alouda', price: 35 },
  { id: 'lemonade', emoji: '🍋', name: 'Lemonade', price: 30 },
  { id: 'water', emoji: '💧', name: 'Mineral Water', price: 0 },
];
const beverageListeners = new Set<(items: AddOnOption[]) => void>();
export const subscribeToBeverages = (listener: (items: AddOnOption[]) => void) => {
  beverageListeners.add(listener);
  listener([...MEAL_BEVERAGES]);
  return () => { beverageListeners.delete(listener); };
};
onSnapshot(doc(db, 'mealBeverages', 'current'), snap => {
  if (!snap.exists()) return;
  MEAL_BEVERAGES = (snap.data().items || []) as AddOnOption[];
  beverageListeners.forEach(l => l([...MEAL_BEVERAGES]));
});
export const addBeverageOption = async (item: AddOnOption) => {
  await setDoc(doc(db, 'mealBeverages', 'current'), { items: dropUndefined([...MEAL_BEVERAGES, item]), updatedAt: serverTimestamp() });
};
export const updateBeverageOption = async (id: string, updates: Partial<AddOnOption>) => {
  await setDoc(doc(db, 'mealBeverages', 'current'), { items: dropUndefined(MEAL_BEVERAGES.map(i => i.id === id ? { ...i, ...updates } : i)), updatedAt: serverTimestamp() });
};
export const removeBeverageOption = async (id: string) => {
  await setDoc(doc(db, 'mealBeverages', 'current'), { items: dropUndefined(MEAL_BEVERAGES.filter(i => i.id !== id)), updatedAt: serverTimestamp() });
};

export let MEAL_DESSERTS: AddOnOption[] = [
  { id: 'gateau', emoji: '🍡', name: 'Gateau Piment', price: 25 },
  { id: 'fruits', emoji: '🍌', name: 'Fruit Salad', price: 30 },
  { id: 'cake', emoji: '🎂', name: 'Coconut Cake', price: 0 },
];
const dessertListeners = new Set<(items: AddOnOption[]) => void>();
export const subscribeToDesserts = (listener: (items: AddOnOption[]) => void) => {
  dessertListeners.add(listener);
  listener([...MEAL_DESSERTS]);
  return () => { dessertListeners.delete(listener); };
};
onSnapshot(doc(db, 'mealDesserts', 'current'), snap => {
  if (!snap.exists()) return;
  MEAL_DESSERTS = (snap.data().items || []) as AddOnOption[];
  dessertListeners.forEach(l => l([...MEAL_DESSERTS]));
});
export const addDessertOption = async (item: AddOnOption) => {
  await setDoc(doc(db, 'mealDesserts', 'current'), { items: dropUndefined([...MEAL_DESSERTS, item]), updatedAt: serverTimestamp() });
};
export const updateDessertOption = async (id: string, updates: Partial<AddOnOption>) => {
  await setDoc(doc(db, 'mealDesserts', 'current'), { items: dropUndefined(MEAL_DESSERTS.map(i => i.id === id ? { ...i, ...updates } : i)), updatedAt: serverTimestamp() });
};
export const removeDessertOption = async (id: string) => {
  await setDoc(doc(db, 'mealDesserts', 'current'), { items: dropUndefined(MEAL_DESSERTS.filter(i => i.id !== id)), updatedAt: serverTimestamp() });
};

// --- ICON LIBRARY ---
// A searchable, admin-curated set of emoji glyphs — every "pick an emoji"
// field in Operations (a Main's icon, an Add-on Catalog entry's icon) opens
// a search modal over this list instead of a free-text box, so the same
// small set of icons stays visually consistent across Mains/catalogs
// instead of admins typing/pasting whatever emoji they happen to have handy.
// Managed from Settings → Icons, same reactive-store + CRUD pattern as the
// five Add-on catalogs above.
export interface IconEntry {
  id: string;
  emoji: string;
  label: string;
}

export let ICON_LIBRARY: IconEntry[] = [
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
const iconLibraryListeners = new Set<(items: IconEntry[]) => void>();
export const subscribeToIconLibrary = (listener: (items: IconEntry[]) => void) => {
  iconLibraryListeners.add(listener);
  listener([...ICON_LIBRARY]);
  return () => { iconLibraryListeners.delete(listener); };
};
// firestore.rules gates iconLibrary/current's read to isActiveStaff() (it's
// an admin-only picker, never customer-facing — see the rule's own
// comment), but store.ts loads unconditionally in BOTH Operations.tsx and
// CustomerPortal.tsx. A signed-in customer session is expected to fail this
// read every time — that's the rule working as designed, not a bug — so
// this listener needs its own error callback; without one, the Firestore
// SDK logs an unhandled permission-denied error to the console on every
// single customer page load.
// Icon Library live sync is now managed inside the Auth observer block at the bottom of the file
export const addIconEntry = async (item: IconEntry) => {
  await setDoc(doc(db, 'iconLibrary', 'current'), { items: dropUndefined([...ICON_LIBRARY, item]), updatedAt: serverTimestamp() });
};
export const updateIconEntry = async (id: string, updates: Partial<IconEntry>) => {
  await setDoc(doc(db, 'iconLibrary', 'current'), { items: dropUndefined(ICON_LIBRARY.map(i => i.id === id ? { ...i, ...updates } : i)), updatedAt: serverTimestamp() });
};
export const removeIconEntry = async (id: string) => {
  await setDoc(doc(db, 'iconLibrary', 'current'), { items: dropUndefined(ICON_LIBRARY.filter(i => i.id !== id)), updatedAt: serverTimestamp() });
};

// config/system — live sync of system configurations (Operating Days, VAT, Cutoffs, Business Identity, etc.)
onSnapshot(doc(db, 'config', 'system'), snap => {
  if (!snap.exists()) return;
  const data = snap.data();
  Object.assign(SYSTEM_CONFIG, {
    ...data,
    // Fallbacks for the new separate cutoff properties if they aren't in the DB yet:
    orderCutoffTime: data.orderCutoffTime || data.cutoffTime || '09:00',
    orderCutoffDayOffset: data.orderCutoffDayOffset !== undefined ? data.orderCutoffDayOffset : (data.cutoffDayOffset !== undefined ? data.cutoffDayOffset : 0),
    cancelCutoffTime: data.cancelCutoffTime || data.cutoffTime || '09:00',
    cancelCutoffDayOffset: data.cancelCutoffDayOffset !== undefined ? data.cancelCutoffDayOffset : (data.cutoffDayOffset !== undefined ? data.cutoffDayOffset : 0),
    
    // Lunch Service Cutoffs
    lunchOrderCutoffTime: data.lunchOrderCutoffTime || data.orderCutoffTime || data.cutoffTime || '12:00',
    lunchOrderCutoffDayOffset: data.lunchOrderCutoffDayOffset !== undefined ? data.lunchOrderCutoffDayOffset : (data.orderCutoffDayOffset !== undefined ? data.orderCutoffDayOffset : (data.cutoffDayOffset !== undefined ? data.cutoffDayOffset : -1)),
    lunchCancelCutoffTime: data.lunchCancelCutoffTime || data.cancelCutoffTime || data.cutoffTime || '09:00',
    lunchCancelCutoffDayOffset: data.lunchCancelCutoffDayOffset !== undefined ? data.lunchCancelCutoffDayOffset : (data.cancelCutoffDayOffset !== undefined ? data.cancelCutoffDayOffset : (data.cutoffDayOffset !== undefined ? data.cutoffDayOffset : 0)),

    // Dinner Service Cutoffs
    dinnerOrderCutoffTime: data.dinnerOrderCutoffTime || data.orderCutoffTime || data.cutoffTime || '12:00',
    dinnerOrderCutoffDayOffset: data.dinnerOrderCutoffDayOffset !== undefined ? data.dinnerOrderCutoffDayOffset : (data.orderCutoffDayOffset !== undefined ? data.orderCutoffDayOffset : (data.cutoffDayOffset !== undefined ? data.cutoffDayOffset : 0)),
    dinnerCancelCutoffTime: data.dinnerCancelCutoffTime || data.cancelCutoffTime || data.cutoffTime || '14:00',
    dinnerCancelCutoffDayOffset: data.dinnerCancelCutoffDayOffset !== undefined ? data.dinnerCancelCutoffDayOffset : (data.cancelCutoffDayOffset !== undefined ? data.cancelCutoffDayOffset : (data.cutoffDayOffset !== undefined ? data.cutoffDayOffset : 0)),
  });
  configListeners.forEach(l => l());
});

// Real dish photography (three actual photos, licensed for this app),
// grouped by protein family so the same three photos cover every curry on
// the menu without a new photo shoot each time a day's curry changes.
// Accepts either a full dish (preferred — lets a custom uploaded photoUrl
// win) or a bare id string (for call sites that only ever had an id on
// hand, e.g. a historical order line's itemId) — every existing call site
// that passes just an id keeps working unchanged, falling back to the
// protein-family guess exactly as before. When a full dish is linked to a
// Meal Library Main (mainId), the Main's own uploaded photo takes priority
// over the dish's own — a day-slot dish never has a photo-upload UI of its
// own, so without this a Main's photo would never actually show anywhere
// it's been placed on the menu.
export const dishPhotoFor = (dish: CurryOption | string | undefined | null): string => {
  // Defensive: a caller can legitimately have no dish to show — e.g. a
  // Home-screen shortcut tile for a day/week whose Menu Planner slot is
  // currently empty (nothing planned yet, or freshly cleared) — so this
  // must degrade to a sensible default rather than crash. Previously
  // assumed a dish or id string was always passed; not true once an empty
  // day became a reachable state.
  if (!dish) return '/dishes/chicken.jpg';
  const id = typeof dish === 'string' ? dish : dish.id;
  let photoUrl = typeof dish === 'string' ? undefined : dish.photoUrl;
  if (typeof dish !== 'string' && dish.mainId) {
    const main = MAIN_DISHES.find(m => m.id === dish.mainId);
    if (main?.photoUrl) photoUrl = main.photoUrl;
  }
  if (photoUrl) return photoUrl;
  if (['fsh', 'prn', 'shp'].includes(id)) return '/dishes/fish.jpg';
  if (['veg', 'len', 'pan'].includes(id)) return '/dishes/veg.jpg';
  return '/dishes/chicken.jpg';
};

// A little Mauritian Creole flavour so the app feels rooted in place rather
// than a generic delivery template.
export const CREOLE_PHRASES: { cr: string; en: string }[] = [
  { cr: 'Manzé bien pou viv bien.', en: 'Eat well to live well.' },
  { cr: "Nou tou dan mem sak.", en: "We're all in this together." },
  { cr: 'Lakaz vinn kot manze bon.', en: 'Home is wherever the food is good.' },
  { cr: 'Partaz manze, partaz lamour.', en: 'Share food, share love.' },
  { cr: 'Pa gagn traka, manze pare.', en: "Don't worry, lunch is sorted." },
  { cr: 'Enn ti kari, enn gran plaisir.', en: 'One small curry, one big pleasure.' },
  { cr: 'Bon manze, bon lazourné.', en: 'Good food, good day.' },
];

// --- CUSTOMER SYSTEM ---
export let GLOBAL_CUSTOMERS: Customer[] = [
  { id: 'c1', firstName: 'Marcus', lastName: 'Sterling', name: 'Marcus Sterling', email: 'm.sterling@outlook.com', phone: '+230 5765 4321', segment: 'VIP', group: 'VIP', lastOrder: '2023-10-15', ltv: 45000, points: 10450, storeCredit: 1250.00, tier: 'Diamond', birthday: '1990-06-12', avatar: 'https://picsum.photos/seed/m/100/100', referenceCode: 'MARCUS', gdprConsent: { marketing: true, sms: true, dataProcessing: true }, addresses: [{ id: 'a1', label: 'Home', street: 'Penthouse 4, Cyber Tower 1', city: 'Ebene', zip: '72201', country: 'Mauritius' }, { id: 'a2', label: 'Office', street: 'Level 9, Nexteracom', city: 'Ebene', zip: '72201', country: 'Mauritius' }] },
  { id: 'c2', firstName: 'Eleanor', lastName: 'Fant', name: 'Eleanor Fant', email: 'eleanor.f@gmail.com', phone: '+230 5987 6543', segment: 'VIP', group: 'Corporate', lastOrder: '2023-10-31', ltv: 28400, points: 300, storeCredit: 0, tier: 'Bronze', birthday: '1985-10-31', avatar: 'https://picsum.photos/seed/cust1/100/100', referenceCode: 'ELEANOR', gdprConsent: { marketing: true, sms: true, dataProcessing: true }, addresses: [{ id: 'a1', label: 'Work', street: '12 Coastal Road', city: 'Grand Baie', zip: '30510', country: 'Mauritius' }] },
  { id: 'c3', firstName: 'Sarah', lastName: 'Connor', name: 'Sarah Connor', email: 'sarah.c@sky.net', phone: '+230 5111 2222', segment: 'Regular', group: 'ABC Motors Co Ltd', lastOrder: '2023-10-10', ltv: 12500, points: 1450, storeCredit: 450.50, tier: 'Silver', birthday: '1995-01-27', avatar: 'https://picsum.photos/seed/s/100/100', referenceCode: 'SARAH', gdprConsent: { marketing: true, sms: false, dataProcessing: true }, addresses: [{ id: 'a1', label: 'Home', street: '123 Cybercity Ave', city: 'Ebene', zip: '72201', country: 'Mauritius' }] }
];

const customerListeners = new Set<(list: Customer[]) => void>();

export const subscribeToCustomers = (listener: (list: Customer[]) => void) => {
  customerListeners.add(listener);
  listener([...GLOBAL_CUSTOMERS]);
  return () => { customerListeners.delete(listener); };
};

export const addCustomerRecord = (customer: Omit<Customer, 'id' | 'points' | 'ltv'>) => {
  const newCustomer: Customer = {
    ...customer,
    id: `CUST-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
    points: 0,
    ltv: 0,
    tier: 'Bronze',
    storeCredit: 0,
    avatar: `https://picsum.photos/seed/${Math.random()}/100/100`
  };
  GLOBAL_CUSTOMERS = [newCustomer, ...GLOBAL_CUSTOMERS];
  customerListeners.forEach(l => l([...GLOBAL_CUSTOMERS]));
  return newCustomer;
};

export const updateCustomerRecord = (id: string, updates: Partial<Customer>) => {
  GLOBAL_CUSTOMERS = GLOBAL_CUSTOMERS.map(c => c.id === id ? { ...c, ...updates } : c);
  customerListeners.forEach(l => l([...GLOBAL_CUSTOMERS]));
};

export const bulkUpdateCustomers = (updates: Customer[]) => {
  GLOBAL_CUSTOMERS = [...updates];
  customerListeners.forEach(l => l([...GLOBAL_CUSTOMERS]));
};

// Deliberate, admin-triggered reset (Settings → Danger Zone) — zeroes every
// customer's loyalty points and store credit, alongside clearAllOrders
// above. Deliberately leaves ltv (lifetime value), tier, contact details,
// addresses, and every other field untouched — this clears the two
// balances that accrue *from* orders, not the customer records or their
// historical order-value reporting. Never runs itself; only fires from an
// explicit confirmed button press.
export const resetCustomerLoyalty = () => {
  GLOBAL_CUSTOMERS = GLOBAL_CUSTOMERS.map(c => ({ ...c, points: 0, storeCredit: 0 }));
  customerListeners.forEach(l => l([...GLOBAL_CUSTOMERS]));
};

// --- AUDIT LOG SYSTEM ---
export interface AuditEntry {
  id: string;
  timestamp: string;
  type: 'Shift Open' | 'Shift Close' | 'Payment Receipt' | 'Supplier Payout' | 'Banking' | 'Petty Cash In' | 'Petty Cash Out' | 'Spot Check' | 'System Adjustment' | 'Manual Discount';
  category: 'Capital' | 'Sales' | 'Logistics' | 'Banking' | 'Petty' | 'Audit' | 'Remittance';
  tender: 'Cash' | 'Card' | 'Digital' | 'Voucher' | 'N/A';
  amount: number;
  reference: string;
  user: string;
  description: string;
  status?: 'Pending Approval' | 'Approved' | 'Rejected';
}

export let AUDIT_LOG: AuditEntry[] = [];
const auditListeners = new Set<(log: AuditEntry[]) => void>();

export const logAuditEvent = (event: Omit<AuditEntry, 'id' | 'timestamp'>) => {
  const newEntry: AuditEntry = {
    ...event,
    id: `AUD-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
    timestamp: new Date().toISOString()
  };
  AUDIT_LOG = [newEntry, ...AUDIT_LOG];
  auditListeners.forEach(l => l([...AUDIT_LOG]));
  return newEntry;
};

export const updateAuditStatus = (id: string, status: AuditEntry['status']) => {
  AUDIT_LOG = AUDIT_LOG.map(e => e.id === id ? { ...e, status } : e);
  auditListeners.forEach(l => l([...AUDIT_LOG]));
};

export const subscribeToAudit = (listener: (log: AuditEntry[]) => void) => {
  auditListeners.add(listener);
  listener([...AUDIT_LOG]);
  return () => { auditListeners.delete(listener); };
};

// --- DISCREPANCIES SYSTEM ---
export interface Discrepancy {
  id: string;
  auditId: string;
  timestamp: string;
  type: 'Opening' | 'Spot Check' | 'Closing';
  expected: number;
  actual: number;
  variance: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  user: string;
  notes: string;
  approvalNote?: string;
}

export let DISCREPANCIES: Discrepancy[] = [];
const discrepancyListeners = new Set<(list: Discrepancy[]) => void>();

export const logDiscrepancy = (d: Omit<Discrepancy, 'id' | 'timestamp' | 'status'>) => {
  const newD: Discrepancy = {
    ...d,
    id: `DSC-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
    timestamp: new Date().toISOString(),
    status: 'Pending'
  };
  DISCREPANCIES = [newD, ...DISCREPANCIES];
  discrepancyListeners.forEach(l => l([...DISCREPANCIES]));
  return newD;
};

export const approveDiscrepancy = (id: string, approvalNote?: string) => {
  const d = DISCREPANCIES.find(item => item.id === id);
  if (!d) return;

  DISCREPANCIES = DISCREPANCIES.map(item => item.id === id ? { ...item, status: 'Approved', approvalNote } : item);
  
  if (d.type === 'Opening') {
     CASHIER_SHIFT.openingFloat = d.actual;
     CASHIER_SHIFT.openingDiscrepancy = d.variance;
     notifyCashierListeners();
  } else if (d.type === 'Closing') {
     PREVIOUS_SHIFT_PHYSICAL = d.actual;
     if (CASHIER_SHIFT.status === 'closed') {
        CASHIER_SHIFT.expectedOpening = PREVIOUS_SHIFT_PHYSICAL;
        notifyCashierListeners();
     }
  } else if (d.type === 'Spot Check') {
     CASHIER_SHIFT.cashAdjustments = (CASHIER_SHIFT.cashAdjustments || 0) + d.variance;
     notifyCashierListeners();
  }
  
  logAuditEvent({
     type: 'System Adjustment',
     category: 'Audit',
     tender: 'N/A',
     amount: d.variance,
     reference: d.id,
     user: 'Management System',
     description: `Approved ${d.type} discrepancy adjustment: ${formatCurrency(d.variance)}. Note: ${approvalNote || 'None'}`
  });

  updateAuditStatus(d.auditId, 'Approved');
  discrepancyListeners.forEach(l => l([...DISCREPANCIES]));
};

export const rejectDiscrepancy = (id: string) => {
  const d = DISCREPANCIES.find(item => item.id === id);
  if (!d) return;
  DISCREPANCIES = DISCREPANCIES.map(item => item.id === id ? { ...item, status: 'Rejected' } : item);
  updateAuditStatus(d.auditId, 'Rejected');
  discrepancyListeners.forEach(l => l([...DISCREPANCIES]));
};

export const subscribeToDiscrepancies = (listener: (list: Discrepancy[]) => void) => {
  discrepancyListeners.add(listener);
  listener([...DISCREPANCIES]);
  return () => { discrepancyListeners.delete(listener); };
};

// --- PURCHASE ORDERS ---
export interface PurchaseOrder {
  id: string;
  vendor: string;
  amount: number;
  status: 'Draft' | 'Sent' | 'Received' | 'Paid';
  date: string;
}

export let PURCHASE_ORDERS: PurchaseOrder[] = [
  { id: 'PO-8420', vendor: 'Global Meats Co.', amount: 2450.00, status: 'Sent', date: '2023-10-15' },
  { id: 'PO-8421', vendor: 'NYC Fresh Produce', amount: 820.50, status: 'Received', date: '2023-10-15' },
  { id: 'PO-8422', vendor: 'Vinery Logistics', amount: 1100.00, status: 'Draft', date: '2023-10-16' },
  { id: 'PO-8425', vendor: 'Ebene Cleaning Supplies', amount: 450.00, status: 'Received', date: '2023-10-16' },
];

export const paySupplierFromTill = (poId: string) => {
  const po = PURCHASE_ORDERS.find(p => p.id === poId);
  if (!po) return;
  
  // Ensure we are creating a new array reference for payouts so React useMemo detects the change
  const newPayout = { id: po.id, vendor: po.vendor, amount: po.amount, time: new Date().toLocaleTimeString() };
  CASHIER_SHIFT = {
    ...CASHIER_SHIFT,
    payouts: [...CASHIER_SHIFT.payouts, newPayout]
  };

  PURCHASE_ORDERS = PURCHASE_ORDERS.map(p => p.id === poId ? { ...p, status: 'Paid' } : p);
  
  logAuditEvent({
    type: 'Supplier Payout',
    category: 'Logistics',
    tender: 'Cash',
    amount: po.amount,
    reference: po.id,
    user: 'Alex Sterling',
    description: `Paid invoice ${po.id} for ${po.vendor}`
  });
  
  notifyCashierListeners();
  poListeners.forEach(l => l([...PURCHASE_ORDERS]));
};

// --- PETTY CASH STATE ---
export interface PettyCashTransaction {
  id: string;
  description: string;
  amount: number;
  type: 'In' | 'Out';
  timestamp: string;
}

export interface PettyCashState {
  balance: number;
  history: PettyCashTransaction[];
}

export let PETTY_CASH: PettyCashState = {
  balance: 0.00,
  history: []
};

export const addPettyCashTransaction = (description: string, amount: number, type: 'In' | 'Out') => {
  const newTx: PettyCashTransaction = {
    id: Math.random().toString(36).substr(2, 9),
    description,
    amount,
    type,
    timestamp: new Date().toISOString()
  };
  PETTY_CASH = {
    balance: type === 'In' ? PETTY_CASH.balance + amount : PETTY_CASH.balance - amount,
    history: [newTx, ...PETTY_CASH.history]
  };
  
  if (type === 'In') {
     // Money DEPOSITED into Petty Cash (e.g. Replenishment)
     // Log as 'Petty Cash In' -> Displayed as Green (+) in Audit Log
     logAuditEvent({
       type: 'Petty Cash In',
       category: 'Petty',
       tender: 'Cash',
       amount: amount,
       reference: 'PTY-IN',
       user: 'Alex Sterling',
       description: `Deposit to Petty Cash: ${description}`
     });
  } else {
     // Money WITHDRAWN from Petty Cash (Expense)
     // Log as 'Petty Cash Out' -> Displayed as Red (-) in Audit Log
     logAuditEvent({
        type: 'Petty Cash Out',
        category: 'Petty',
        tender: 'N/A', 
        amount: amount,
        reference: 'PTY-EXP',
        user: 'Alex Sterling',
        description: `Petty Cash Expense: ${description}`
     });
  }
  
  notifyCashierListeners();
  pettyCashListeners.forEach(l => l({ ...PETTY_CASH }));
};

// --- CASHIER SHIFT PERSISTENCE ---
export type ShiftStatus = 'closed' | 'open' | 'reconciling';
export interface ShiftState {
  status: ShiftStatus;
  openingFloat: number;
  expectedOpening: number;
  openingDiscrepancy: number; 
  bankedAmount: number;
  cashAdjustments: number;
  bankingHistory: { time: string; amount: number }[];
  countHistory: { time: string; total: number }[];
  startTime: string | null;
  startTimestamp: string | null;
  payouts: { id: string; vendor: string; amount: number; time: string }[];
}

export let PREVIOUS_SHIFT_PHYSICAL: number = 2500.00;

export let CASHIER_SHIFT: ShiftState = {
  status: 'closed',
  openingFloat: 0,
  expectedOpening: PREVIOUS_SHIFT_PHYSICAL,
  openingDiscrepancy: 0,
  bankedAmount: 0,
  cashAdjustments: 0,
  bankingHistory: [],
  countHistory: [],
  startTime: null,
  startTimestamp: null,
  payouts: []
};

const cashierListeners = new Set<(state: ShiftState) => void>();
const notifyCashierListeners = () => cashierListeners.forEach(l => l({ ...CASHIER_SHIFT }));

export const updateShift = (updates: Partial<ShiftState>) => {
  CASHIER_SHIFT = { ...CASHIER_SHIFT, ...updates };
  notifyCashierListeners();
};

export const resetShift = (closingBalance: number) => {
  PREVIOUS_SHIFT_PHYSICAL = closingBalance;
  CASHIER_SHIFT = {
    status: 'closed',
    openingFloat: 0,
    expectedOpening: PREVIOUS_SHIFT_PHYSICAL,
    openingDiscrepancy: 0,
    bankedAmount: 0,
    cashAdjustments: 0,
    bankingHistory: [],
    countHistory: [],
    startTime: null,
    startTimestamp: null,
    payouts: []
  };
  notifyCashierListeners();
};

const pettyCashListeners = new Set<(state: PettyCashState) => void>();
const poListeners = new Set<(pos: PurchaseOrder[]) => void>();
const configListeners = new Set<() => void>();
const paymentMethodListeners = new Set<(methods: PaymentMethod[]) => void>();

export const subscribeToShift = (listener: (state: ShiftState) => void) => {
  cashierListeners.add(listener);
  listener({ ...CASHIER_SHIFT });
  return () => { cashierListeners.delete(listener); };
};

export const subscribeToPettyCash = (listener: (state: PettyCashState) => void) => {
  pettyCashListeners.add(listener);
  listener({ ...PETTY_CASH });
  return () => { pettyCashListeners.delete(listener); };
};

export const subscribeToPOs = (listener: (pos: PurchaseOrder[]) => void) => {
  poListeners.add(listener);
  listener([...PURCHASE_ORDERS]);
  return () => { poListeners.delete(listener); };
};

export const subscribeToConfig = (listener: () => void) => {
  configListeners.add(listener);
  listener();
  return () => { configListeners.delete(listener); };
};

// --- DISCOUNT REQUEST SYSTEM ---
export interface DiscountRequest {
  id: string;
  orderId: string;
  customerName: string;
  originalTotal: number;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  calculatedDiscount: number;
  finalTotal: number;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  requestedBy: string;
  timestamp: string;
}

export let DISCOUNT_REQUESTS: DiscountRequest[] = [];
const discountRequestListeners = new Set<(list: DiscountRequest[]) => void>();

export const subscribeToDiscountRequests = (listener: (list: DiscountRequest[]) => void) => {
  discountRequestListeners.add(listener);
  listener([...DISCOUNT_REQUESTS]);
  return () => { discountRequestListeners.delete(listener); };
};

export const requestOrderDiscount = (orderId: string, customerName: string, originalTotal: number, type: 'percentage' | 'fixed', value: number, reason: string) => {
  const calculatedDiscount = type === 'percentage' ? originalTotal * (value / 100) : value;
  const finalTotal = Math.max(0, originalTotal - calculatedDiscount);
  
  const req: DiscountRequest = {
    id: `REQ-${Math.floor(Math.random() * 10000)}`,
    orderId,
    customerName,
    originalTotal,
    discountType: type,
    discountValue: value,
    calculatedDiscount,
    finalTotal,
    reason,
    status: 'Pending',
    requestedBy: 'Cashier',
    timestamp: new Date().toISOString()
  };
  
  DISCOUNT_REQUESTS = [req, ...DISCOUNT_REQUESTS];
  discountRequestListeners.forEach(l => l([...DISCOUNT_REQUESTS]));
};

export const resolveDiscountRequest = (reqId: string, approved: boolean) => {
  const req = DISCOUNT_REQUESTS.find(r => r.id === reqId);
  if (!req) return;

  if (approved) {
    const vatMult = 1 + (SYSTEM_CONFIG.vatEnabled ? SYSTEM_CONFIG.vatRate / 100 : 0);
    const netDiscount = req.calculatedDiscount / vatMult;

    applyOrderDiscount(req.orderId, netDiscount, req.reason); 
    DISCOUNT_REQUESTS = DISCOUNT_REQUESTS.map(r => r.id === reqId ? { ...r, status: 'Approved' } : r);
  } else {
    DISCOUNT_REQUESTS = DISCOUNT_REQUESTS.map(r => r.id === reqId ? { ...r, status: 'Rejected' } : r);
  }
  discountRequestListeners.forEach(l => l([...DISCOUNT_REQUESTS]));
};

// --- ORDERS SYSTEM ---
export let ACTIVE_ORDERS: Order[] = [
  {
    id: 'ORD-8422',
    customerName: 'Marcus Sterling',
    type: 'Dine-In',
    status: 'In Kitchen',
    paymentStatus: 'Pending',
    items: [
      { itemId: '1', name: 'Texas Smoked Brisket', qty: 1, price: 1250.00, status: 'Active', isReconciled: false }
    ],
    total: 1250.00 * (1 + (SYSTEM_CONFIG.vatEnabled ? SYSTEM_CONFIG.vatRate / 100 : 0)), // Initial Calc
    timestamp: new Date().toISOString(),
    tableId: '12',
    isReconciled: false
  }
];

const orderListeners = new Set<(orders: Order[]) => void>();
const notifyOrderListeners = () => orderListeners.forEach(l => l([...ACTIVE_ORDERS]));

export const subscribeToOrders = (listener: (orders: Order[]) => void) => {
  orderListeners.add(listener);
  listener([...ACTIVE_ORDERS]);
  return () => { orderListeners.delete(listener); };
};

export const addOrder = (order: Order) => {
  ACTIVE_ORDERS = [order, ...ACTIVE_ORDERS];
  notifyOrderListeners();
};

// Deliberate, admin-triggered reset (Settings → Danger Zone) for wiping
// test/demo order history clean before going live — unlike the automatic
// Meal Library migration/cleanup above, this is destructive and never
// runs itself; it only fires from an explicit confirmed button press.
export const clearAllOrders = () => {
  ACTIVE_ORDERS = [];
  notifyOrderListeners();
};

export const updateOrderStatus = (id: string, status: Order['status']) => {
  ACTIVE_ORDERS = ACTIVE_ORDERS.map(o => o.id === id ? { ...o, status } : o);
  notifyOrderListeners();
};

export const updateOrderItemRating = (orderId: string, itemId: string, rating: number, comment: string) => {
  ACTIVE_ORDERS = ACTIVE_ORDERS.map(o => {
    if (o.id === orderId) {
      return {
        ...o,
        items: o.items.map(item => item.itemId === itemId ? { ...item, rating, ratingComment: comment } : item)
      };
    }
    return o;
  });
  notifyOrderListeners();
};

export const updateOrderPayment = (id: string, status: 'Paid' | 'Pending' | 'Refunded', tenderType?: Order['tenderType'], methodName?: string, user?: string) => {
  ACTIVE_ORDERS = ACTIVE_ORDERS.map(o => {
    if (o.id === id) {
      // If paid, log it
      if (status === 'Paid' && o.paymentStatus !== 'Paid') {
         logAuditEvent({
            type: 'Payment Receipt',
            category: 'Sales',
            tender: tenderType || 'Cash',
            amount: o.total,
            reference: o.id,
            user: user || 'System',
            description: `Payment collected for Order #${o.id}`
         });
      }
      return { 
         ...o, 
         paymentStatus: status, 
         tenderType, 
         paymentMethodName: methodName,
         items: o.items.map(i => ({ ...i, paymentStatus: status, paymentMethodName: methodName })) 
      };
    }
    return o;
  });
  notifyOrderListeners();
};

export const cancelOrderItem = (orderId: string, date: string, slot: string, itemId: string) => {
   ACTIVE_ORDERS = ACTIVE_ORDERS.map(o => {
      if (o.id === orderId) {
         // Find index of the best candidate to cancel
         // Priority: Active > Pending > Preparing > Ready
         // We want to avoid cancelling 'Ready' items if 'Active' ones exist, to prevent "Ready -> Sent" visual regression in POS
         let candidateIdx = -1;
         const statusPriority = ['Active', 'Pending', 'Preparing', 'Ready'];
         
         for (const status of statusPriority) {
             const idx = o.items.findIndex(i => 
                 i.itemId === itemId && 
                 i.deliveryDate === date && 
                 i.serviceSlot === slot && 
                 i.status === status
             );
             if (idx !== -1) {
                 candidateIdx = idx;
                 break;
             }
         }

         // Fallback: any non-cancelled match
         if (candidateIdx === -1) {
             candidateIdx = o.items.findIndex(i => 
                 i.itemId === itemId && 
                 i.deliveryDate === date && 
                 i.serviceSlot === slot && 
                 i.status !== 'Cancelled'
             );
         }

         if (candidateIdx !== -1) {
             const newItems = [...o.items];
             const itemToCancel = newItems[candidateIdx];

             if (itemToCancel.paymentStatus === 'Paid') {
                 newItems[candidateIdx] = { 
                     ...itemToCancel, 
                     status: 'Cancelled' as const, 
                     paymentStatus: 'Refunded' as const 
                 };
                 const refundAmt = calculateTotal(itemToCancel.price * itemToCancel.qty);
                 const customer = GLOBAL_CUSTOMERS.find(c => c.name === o.customerName);
                 if (customer) {
                     updateCustomerRecord(customer.id, {
                         storeCredit: (customer.storeCredit || 0) + refundAmt
                     });
                 }
             } else {
                 newItems[candidateIdx] = { ...itemToCancel, status: 'Cancelled' as const };
             }
             
             // Recalculate total by summing only non-cancelled items
             const newTotal = newItems.reduce((acc, i) => {
                if (i.status === 'Cancelled') return acc;
                return acc + calculateTotal(i.price * i.qty);
             }, 0);

             return { ...o, items: newItems, total: newTotal };
         }
      }
      return o;
   });
   notifyOrderListeners();
};

// Lets a customer amend a still-editable confirmed meal (curry/base/extras
// changed, price recalculated) rather than only being able to cancel it.
// Same find-by-date+slot pattern as cancelOrderItem; the cutoff check that
// decides whether this is allowed at all lives in the caller (CustomerPortal),
// same place the cancel cutoff will live.
export const editOrderItem = (orderId: string, date: string, slot: string, updates: { itemId: string; name: string; price: number; notes: string }) => {
  ACTIVE_ORDERS = ACTIVE_ORDERS.map(o => {
    if (o.id !== orderId) return o;
    const idx = o.items.findIndex(i => i.deliveryDate === date && i.serviceSlot === slot && i.status !== 'Cancelled');
    if (idx === -1) return o;
    const newItems = [...o.items];
    newItems[idx] = { ...newItems[idx], ...updates };
    const newTotal = newItems.reduce((acc, i) => i.status === 'Cancelled' ? acc : acc + calculateTotal(i.price * i.qty), 0);
    return { ...o, items: newItems, total: newTotal };
  });
  notifyOrderListeners();
};

// The customer telling the app "I'll pay via Juice, here's my reference"
// is a claim, not a confirmed payment — paymentStatus stays exactly as it
// was (still 'Pending') and only paymentMethodName/paymentReference are
// set, so the UI can show "awaiting confirmation" rather than "Paid" until
// Operations actually checks the bank/wallet statement and calls
// updateOrderItemsPayment/updateOrderPayment (which are unchanged, and
// remain the only things that ever set paymentStatus to 'Paid').
export const submitPaymentClaim = (orderId: string, date: string, slot: string | undefined, methodName: string, reference: string) => {
  ACTIVE_ORDERS = ACTIVE_ORDERS.map(o => {
    if (o.id !== orderId) return o;
    const newItems = o.items.map(i => {
      if (i.deliveryDate === date && i.serviceSlot === slot) {
        return { ...i, paymentMethodName: methodName, paymentReference: reference };
      }
      return i;
    });
    return { ...o, items: newItems };
  });
  notifyOrderListeners();
};

export const updateOrderItemsPayment = (orderId: string, date: string, slot: string | undefined, tenderType: Order['tenderType'], methodName: string) => {
   let amountPaid = 0;
   ACTIVE_ORDERS = ACTIVE_ORDERS.map(o => {
      if (o.id === orderId) {
         const newItems = o.items.map(i => {
            if (i.deliveryDate === date && i.serviceSlot === slot) {
               amountPaid += calculateTotal(i.price * i.qty);
               return { ...i, paymentStatus: 'Paid' as const, paymentMethodName: methodName };
            }
            return i;
         });
         
         // Check if full order is paid
         const allPaid = newItems.every(i => i.paymentStatus === 'Paid' || i.status === 'Cancelled');
         
         return { 
            ...o, 
            items: newItems,
            paymentStatus: allPaid ? 'Paid' : 'Pending' 
         };
      }
      return o;
   });
   
   if (amountPaid > 0) {
      logAuditEvent({
         type: 'Payment Receipt',
         category: 'Sales',
         tender: tenderType || 'Cash',
         amount: amountPaid,
         reference: `${orderId}-PARTIAL`,
         user: 'System',
         description: `Partial payment for Order #${orderId} (${slot})`
      });
   }
   notifyOrderListeners();
};

export const updateOrderItemStatus = (orderId: string, itemId: string, date: string, slot: string, status: OrderItem['status']) => {
   ACTIVE_ORDERS = ACTIVE_ORDERS.map(o => {
      if (o.id === orderId) {
         return {
            ...o,
            items: o.items.map(i => i.itemId === itemId && i.deliveryDate === date && i.serviceSlot === slot ? { ...i, status } : i)
         };
      }
      return o;
   });
   notifyOrderListeners();
};

export const updateOrderItemStatusByIndex = (orderId: string, idx: number, status: OrderItem['status']) => {
   ACTIVE_ORDERS = ACTIVE_ORDERS.map(o => {
      if (o.id === orderId) {
         const newItems = [...o.items];
         newItems[idx] = { ...newItems[idx], status };
         return { ...o, items: newItems };
      }
      return o;
   });
   notifyOrderListeners();
};

export const appendToTableOrder = (tableId: string, customerName: string, newItems: Partial<OrderItem>[]) => {
   const existingOrder = ACTIVE_ORDERS.find(o => o.tableId === tableId && o.status !== 'Completed' && o.status !== 'Cancelled');
   if (existingOrder) {
      const itemsToAdd = newItems.map(i => ({ 
         ...i, 
         status: 'Active', 
         paymentStatus: 'Pending',
         isReconciled: false
      } as OrderItem));
      
      const additionalCost = calculateTotal(itemsToAdd.reduce((acc, i) => acc + (i.price! * i.qty!), 0));
      
      // Force status to 'Pending' (New) to trigger KDS bump visibility
      const newOrderStatus = 'Pending';

      ACTIVE_ORDERS = ACTIVE_ORDERS.map(o => o.id === existingOrder.id ? {
         ...o,
         status: newOrderStatus,
         items: [...o.items, ...itemsToAdd],
         total: o.total + additionalCost
      } : o);
   } else {
      // Create new order
      const itemsToAdd = newItems.map(i => ({ 
         ...i, 
         status: 'Active', 
         paymentStatus: 'Pending',
         isReconciled: false
      } as OrderItem));
      
      const total = calculateTotal(itemsToAdd.reduce((acc, i) => acc + (i.price! * i.qty!), 0));
      
      addOrder({
         id: `ORD-${Math.floor(Math.random() * 10000)}`,
         customerName,
         type: 'Dine-In',
         status: 'Pending',
         paymentStatus: 'Pending',
         items: itemsToAdd,
         total,
         timestamp: new Date().toISOString(),
         tableId,
         isReconciled: false
      });
   }
   notifyOrderListeners();
};

export const markOrderTerminalClosed = (orderId: string) => {
   ACTIVE_ORDERS = ACTIVE_ORDERS.map(o => o.id === orderId ? { ...o, isTerminalClosed: true, status: 'Completed' } : o);
   notifyOrderListeners();
};

export const reconcileOrder = (orderId: string) => {
   ACTIVE_ORDERS = ACTIVE_ORDERS.map(o => o.id === orderId ? { ...o, isReconciled: true, items: o.items.map(i => ({...i, isReconciled: true})) } : o);
   notifyOrderListeners();
};

export const reconcileOrderItemsByDate = (orderId: string, date: string, slot?: string) => {
   ACTIVE_ORDERS = ACTIVE_ORDERS.map(o => {
      if (o.id === orderId) {
         const newItems = o.items.map(i => {
            if (i.deliveryDate === date && (!slot || i.serviceSlot === slot)) {
               return { ...i, isReconciled: true };
            }
            return i;
         });
         const allReconciled = newItems.every(i => i.isReconciled);
         return { ...o, items: newItems, isReconciled: allReconciled };
      }
      return o;
   });
   notifyOrderListeners();
};

export const advanceOrderStatus = (orderId: string) => {
   ACTIVE_ORDERS = ACTIVE_ORDERS.map(o => {
      if (o.id === orderId) {
         const nextStatus = o.status === 'Pending' ? 'In Kitchen' : o.status === 'In Kitchen' ? 'Ready' : 'Completed';
         
         // Define target item status based on order status flow
         let targetItemStatus: OrderItem['status'] = 'Active';
         if (nextStatus === 'In Kitchen') targetItemStatus = 'Preparing';
         else if (nextStatus === 'Ready') targetItemStatus = 'Ready';
         else if (nextStatus === 'Completed') targetItemStatus = 'Completed';
         
         const newItems = o.items.map(i => {
            // Skip cancelled items
            if (i.status === 'Cancelled') return i;

            // Status Hierarchy to prevent regression
            // e.g. If we bump "New" -> "Prep", we shouldn't degrade "Ready" items back to "Prep"
            const statusLevels: Record<string, number> = {
               'Active': 0, 'Pending': 0,
               'Preparing': 1,
               'Ready': 2,
               'Delivered': 3,
               'Completed': 4
            };

            const currentLevel = statusLevels[i.status || 'Active'] || 0;
            const targetLevel = statusLevels[targetItemStatus || 'Active'] || 0;

            // Only update status if we are advancing the item (or if it's currently untracked/lower)
            if (targetLevel > currentLevel) {
               return { ...i, status: targetItemStatus };
            }
            return i;
         });
         
         return {
            ...o,
            status: nextStatus,
            items: newItems
         };
      }
      return o;
   });
   notifyOrderListeners();
};

export const batchMarkReady = (date: string, slot: string, itemName: string) => {
   ACTIVE_ORDERS = ACTIVE_ORDERS.map(o => {
      if (o.type === 'Meal Plan') {
         return {
            ...o,
            items: o.items.map(i => {
               if (i.name === itemName && i.deliveryDate === date && i.serviceSlot === slot && i.status !== 'Cancelled') {
                  return { ...i, status: 'Ready' as const };
               }
               return i;
            })
         };
      }
      return o;
   });
   notifyOrderListeners();
};

export const applyOrderDiscount = (orderId: string, discountAmount: number, reason: string) => {
   ACTIVE_ORDERS = ACTIVE_ORDERS.map(o => {
      if (o.id === orderId) {
         const vatMult = 1 + (SYSTEM_CONFIG.vatEnabled ? SYSTEM_CONFIG.vatRate / 100 : 0);
         const newTotal = Math.max(0, o.total - (discountAmount * vatMult));
         return { ...o, discount: (o.discount || 0) + discountAmount, total: newTotal, discountReason: reason };
      }
      return o;
   });
   notifyOrderListeners();
};

export const subscribeToPaymentMethods = (listener: (methods: PaymentMethod[]) => void) => {
  paymentMethodListeners.add(listener);
  listener([...PAYMENT_METHODS]);
  return () => { paymentMethodListeners.delete(listener); };
};

export const updateSystemConfig = async (updates: Partial<typeof SYSTEM_CONFIG>) => {
  if (updates.operatingDays) SYSTEM_CONFIG.operatingDays = updates.operatingDays;
  if (updates.activeServices) SYSTEM_CONFIG.activeServices = updates.activeServices;
  if (updates.cutoffTime) SYSTEM_CONFIG.cutoffTime = updates.cutoffTime;
  if (updates.cutoffDayOffset !== undefined) SYSTEM_CONFIG.cutoffDayOffset = updates.cutoffDayOffset;
  if (updates.orderCutoffTime) SYSTEM_CONFIG.orderCutoffTime = updates.orderCutoffTime;
  if (updates.orderCutoffDayOffset !== undefined) SYSTEM_CONFIG.orderCutoffDayOffset = updates.orderCutoffDayOffset;
  if (updates.cancelCutoffTime) SYSTEM_CONFIG.cancelCutoffTime = updates.cancelCutoffTime;
  if (updates.cancelCutoffDayOffset !== undefined) SYSTEM_CONFIG.cancelCutoffDayOffset = updates.cancelCutoffDayOffset;
  if (updates.lunchDeliveryWindow !== undefined) SYSTEM_CONFIG.lunchDeliveryWindow = updates.lunchDeliveryWindow;
  if (updates.dinnerDeliveryWindow !== undefined) SYSTEM_CONFIG.dinnerDeliveryWindow = updates.dinnerDeliveryWindow;
  if (updates.currencySymbol) SYSTEM_CONFIG.currencySymbol = updates.currencySymbol;
  if (updates.vatEnabled !== undefined) SYSTEM_CONFIG.vatEnabled = updates.vatEnabled;
  if (updates.vatRate !== undefined) SYSTEM_CONFIG.vatRate = updates.vatRate;
  if (updates.vatNumber !== undefined) SYSTEM_CONFIG.vatNumber = updates.vatNumber;
  if (updates.bulkDiscountEnabled !== undefined) SYSTEM_CONFIG.bulkDiscountEnabled = updates.bulkDiscountEnabled;
  if (updates.bulkDiscountRate !== undefined) SYSTEM_CONFIG.bulkDiscountRate = updates.bulkDiscountRate;
  if (updates.deadlinePolicy !== undefined) SYSTEM_CONFIG.deadlinePolicy = updates.deadlinePolicy;
  if (updates.businessName !== undefined) SYSTEM_CONFIG.businessName = updates.businessName;
  if (updates.businessTagline !== undefined) SYSTEM_CONFIG.businessTagline = updates.businessTagline;
  if (updates.businessLogoUrl !== undefined) SYSTEM_CONFIG.businessLogoUrl = updates.businessLogoUrl;
  if (updates.supportPhone !== undefined) SYSTEM_CONFIG.supportPhone = updates.supportPhone;
  if (updates.supportEmail !== undefined) SYSTEM_CONFIG.supportEmail = updates.supportEmail;
  if (updates.dinnerEnabled !== undefined) SYSTEM_CONFIG.dinnerEnabled = updates.dinnerEnabled;
  if (updates.lunchOrderCutoffTime !== undefined) SYSTEM_CONFIG.lunchOrderCutoffTime = updates.lunchOrderCutoffTime;
  if (updates.lunchOrderCutoffDayOffset !== undefined) SYSTEM_CONFIG.lunchOrderCutoffDayOffset = updates.lunchOrderCutoffDayOffset;
  if (updates.lunchCancelCutoffTime !== undefined) SYSTEM_CONFIG.lunchCancelCutoffTime = updates.lunchCancelCutoffTime;
  if (updates.lunchCancelCutoffDayOffset !== undefined) SYSTEM_CONFIG.lunchCancelCutoffDayOffset = updates.lunchCancelCutoffDayOffset;
  if (updates.dinnerOrderCutoffTime !== undefined) SYSTEM_CONFIG.dinnerOrderCutoffTime = updates.dinnerOrderCutoffTime;
  if (updates.dinnerOrderCutoffDayOffset !== undefined) SYSTEM_CONFIG.dinnerOrderCutoffDayOffset = updates.dinnerOrderCutoffDayOffset;
  if (updates.dinnerCancelCutoffTime !== undefined) SYSTEM_CONFIG.dinnerCancelCutoffTime = updates.dinnerCancelCutoffTime;
  if (updates.dinnerCancelCutoffDayOffset !== undefined) SYSTEM_CONFIG.dinnerCancelCutoffDayOffset = updates.dinnerCancelCutoffDayOffset;
  if (updates.birthdayHeaderCreole !== undefined) SYSTEM_CONFIG.birthdayHeaderCreole = updates.birthdayHeaderCreole;
  if (updates.birthdayHeaderEnglish !== undefined) SYSTEM_CONFIG.birthdayHeaderEnglish = updates.birthdayHeaderEnglish;
  if (updates.birthdayStickerCreole !== undefined) SYSTEM_CONFIG.birthdayStickerCreole = updates.birthdayStickerCreole;
  if (updates.birthdayStickerEnglish !== undefined) SYSTEM_CONFIG.birthdayStickerEnglish = updates.birthdayStickerEnglish;
  configListeners.forEach(l => l());

  await setDoc(doc(db, 'config', 'system'), dropUndefined({
    ...SYSTEM_CONFIG
  }), { merge: true });
};


export const updatePaymentMethods = (methods: PaymentMethod[]) => {
  PAYMENT_METHODS = [...methods];
  paymentMethodListeners.forEach(l => l([...PAYMENT_METHODS]));
};

// --- POS STATE ---
export interface PosCartItem extends Omit<MenuItem, 'status'> {
  qty: number;
  cartId: string;
  status: 'draft' | 'sent' | 'ready';
  kitchenStatus?: string;
  deliveryDate?: string;
  deliveryDay?: string;
  serviceSlot?: string;
}

export interface PosSession {
  items: PosCartItem[];
  customer: Customer | 'walk-in';
}

export let POS_SESSION_CARTS: Record<string, PosSession> = {};
const posListeners = new Set<(carts: Record<string, PosSession>) => void>();
const notifyPosListeners = () => posListeners.forEach(l => l({ ...POS_SESSION_CARTS }));

export const subscribeToPosCarts = (listener: (carts: Record<string, PosSession>) => void) => {
  posListeners.add(listener);
  listener({ ...POS_SESSION_CARTS });
  return () => { posListeners.delete(listener); };
};

export const updatePosCart = (key: string, items: PosCartItem[]) => {
  const session = POS_SESSION_CARTS[key] || { customer: 'walk-in' };
  POS_SESSION_CARTS = { ...POS_SESSION_CARTS, [key]: { ...session, items } };
  notifyPosListeners();
};

export const updatePosSession = (key: string, updates: Partial<PosSession>) => {
  const session = POS_SESSION_CARTS[key] || { items: [], customer: 'walk-in' };
  POS_SESSION_CARTS = { ...POS_SESSION_CARTS, [key]: { ...session, ...updates } };
  notifyPosListeners();
};

export const clearPosCart = (key: string) => {
  if (POS_SESSION_CARTS[key]) {
    POS_SESSION_CARTS = { ...POS_SESSION_CARTS, [key]: { ...POS_SESSION_CARTS[key], items: [] } };
    notifyPosListeners();
  }
};

// --- LOYALTY & LIBRARY ---
export let LOYALTY_TIERS: LoyaltyTier[] = [
  { id: 't1', name: 'Bronze', pointsThreshold: 0, multiplier: 1, color: 'bg-orange-600', perks: ['Member Events'], standardDiscount: 0, birthdayDiscount: 5 },
  { id: 't2', name: 'Silver', pointsThreshold: 1000, multiplier: 1.2, color: 'bg-slate-400', perks: ['Free Coffee Weekly'], standardDiscount: 5, birthdayDiscount: 10 },
  { id: 't3', name: 'Gold', pointsThreshold: 5000, multiplier: 1.5, color: 'bg-amber-400', perks: ['Priority Seating'], standardDiscount: 10, birthdayDiscount: 15 },
  { id: 't4', name: 'Diamond', pointsThreshold: 10000, multiplier: 2, color: 'bg-primary', perks: ['Concierge Service'], standardDiscount: 15, birthdayDiscount: 25 },
];

const loyaltyListeners = new Set<(tiers: LoyaltyTier[]) => void>();

export const subscribeToLoyaltyTiers = (listener: (tiers: LoyaltyTier[]) => void) => {
  loyaltyListeners.add(listener);
  listener([...LOYALTY_TIERS]);
  return () => { loyaltyListeners.delete(listener); };
};

export const updateLoyaltyTiers = async (tiers: LoyaltyTier[]) => {
  LOYALTY_TIERS = [...tiers];
  loyaltyListeners.forEach(l => l([...LOYALTY_TIERS]));
  await setDoc(doc(db, 'loyaltyTiers', 'current'), { items: dropUndefined(LOYALTY_TIERS), updatedAt: serverTimestamp() });
};

export const deleteLoyaltyTier = async (id: string) => {
  LOYALTY_TIERS = LOYALTY_TIERS.filter(t => t.id !== id);
  loyaltyListeners.forEach(l => l([...LOYALTY_TIERS]));
  await setDoc(doc(db, 'loyaltyTiers', 'current'), { items: dropUndefined(LOYALTY_TIERS), updatedAt: serverTimestamp() });
};

onSnapshot(doc(db, 'loyaltyTiers', 'current'), snap => {
  if (!snap.exists()) return;
  LOYALTY_TIERS = (snap.data().items || []) as LoyaltyTier[];
  loyaltyListeners.forEach(l => l([...LOYALTY_TIERS]));
});

// --- CUSTOMER GROUPS SYSTEM ---
export let CUSTOMER_GROUPS: CustomerGroup[] = [
  { id: 'g1', name: 'ABC Motors Co Ltd', discountPercentage: 6, description: 'Default group for regular customers.', color: 'bg-rose-600' },
  { id: 'g2', name: 'Corporate', discountPercentage: 15, description: 'Registered business partners.', color: 'bg-indigo-600' },
  { id: 'g3', name: 'VIP', discountPercentage: 20, description: 'High-net-worth individuals.', color: 'bg-amber-500' },
];

const groupListeners = new Set<(groups: CustomerGroup[]) => void>();

export const subscribeToCustomerGroups = (listener: (groups: CustomerGroup[]) => void) => {
  groupListeners.add(listener);
  listener([...CUSTOMER_GROUPS]);
  return () => { groupListeners.delete(listener); };
};

export const updateCustomerGroups = async (groups: CustomerGroup[]) => {
  CUSTOMER_GROUPS = [...groups];
  groupListeners.forEach(l => l([...CUSTOMER_GROUPS]));
  await setDoc(doc(db, 'customerGroups', 'current'), { items: dropUndefined(CUSTOMER_GROUPS), updatedAt: serverTimestamp() });
};

export const deleteCustomerGroup = async (id: string) => {
  CUSTOMER_GROUPS = CUSTOMER_GROUPS.filter(g => g.id !== id);
  groupListeners.forEach(l => l([...CUSTOMER_GROUPS]));
  await setDoc(doc(db, 'customerGroups', 'current'), { items: dropUndefined(CUSTOMER_GROUPS), updatedAt: serverTimestamp() });
};

// Customer Groups live sync is now managed inside the Auth observer block at the bottom of the file

// --- PERSISTENCE (localStorage) ---
// Everything above this point is an in-memory mock that forgets everything
// on refresh — the single biggest gap identified in the 2026-08-10 codebase
// review (see AGENTS.md / BonManzE_v1_scope.md). This adds a durable layer
// without changing any mutator function above: every mutator already
// notifies its own listener Set, so persistAll() below just registers
// itself as one more listener on each Set and rides along for free.

const PERSIST_KEY = 'bonmanze_rms_state_v1';

// Meal Library / Menu Planner / add-on catalogs / Icon Library are no
// longer part of this localStorage snapshot — they're Firestore-backed now
// (see the onSnapshot listeners above, each collection's own comment), and
// Firestore is the only source of truth for them going forward. This used
// to also carry a chain of one-time, localStorage-flag-gated migration/
// cleanup passes (migrateMenuToLibrary, cleanupMainDishContentOnce,
// relinkDefaultRotationToLibrary, clearMenuPlannerOnce,
// fixDinnerOverridesOnce/V2) from the mock-data era — all removed here,
// because every one of them called a mutator (addMainDish, setLunchWeekMenu,
// etc.) that now writes to Firestore for real. Left in place, any of them
// re-firing on a fresh browser profile or cleared localStorage (their own
// "ran once" flags live in localStorage, so a fresh profile has none of
// them set) would have replayed old mock-era fixups — created duplicate
// Mains, wiped a real planned week back to empty — straight onto the real,
// already-correctly-seeded production data. See BonManzE_Firestore_Schema.md
// decision #12 for the full removal rationale.

interface PersistedState {
  MOCK_TODAY: string;
  PAYMENT_METHODS: PaymentMethod[];
  MEAL_LIBRARY_ITEMS: MenuItem[];
  PUBLISHED_PLAN: any;
  GLOBAL_CUSTOMERS: Customer[];
  AUDIT_LOG: AuditEntry[];
  DISCREPANCIES: Discrepancy[];
  PURCHASE_ORDERS: PurchaseOrder[];
  PETTY_CASH: PettyCashState;
  PREVIOUS_SHIFT_PHYSICAL: number;
  CASHIER_SHIFT: ShiftState;
  DISCOUNT_REQUESTS: DiscountRequest[];
  ACTIVE_ORDERS: Order[];
  POS_SESSION_CARTS: Record<string, PosSession>;
  LOYALTY_TIERS: LoyaltyTier[];
  CUSTOMER_GROUPS: CustomerGroup[];
  SYSTEM_CONFIG: typeof SYSTEM_CONFIG;
  // LUNCH_MENU_OVERRIDES/DINNER_MENU_OVERRIDES, the five add-on catalogs,
  // MAIN_DISHES, and ICON_LIBRARY used to live in this snapshot — removed
  // now that all of them are Firestore-backed (see the comment above this
  // interface). Restoring them from localStorage on load would just mask
  // real Firestore data with a stale local copy until the first onSnapshot
  // batch overwrote it anyway, so there's nothing useful left to persist.
}

const persistAll = () => {
  try {
    const snapshot: PersistedState = {
      MOCK_TODAY, PAYMENT_METHODS, MEAL_LIBRARY_ITEMS, PUBLISHED_PLAN,
      GLOBAL_CUSTOMERS, AUDIT_LOG, DISCREPANCIES, PURCHASE_ORDERS,
      PETTY_CASH, PREVIOUS_SHIFT_PHYSICAL, CASHIER_SHIFT, DISCOUNT_REQUESTS,
      ACTIVE_ORDERS, POS_SESSION_CARTS, LOYALTY_TIERS, CUSTOMER_GROUPS,
      SYSTEM_CONFIG,
    };
    localStorage.setItem(PERSIST_KEY, JSON.stringify(snapshot));
  } catch (e) {
    // Storage can fail (quota exceeded, private/incognito mode) — a
    // persistence hiccup should never break the app itself.
    console.warn('BonManzE: failed to persist state', e);
  }
};

// Every existing listener Set gets persistAll added as an extra subscriber.
// No mutator function above needs to change. The Meal Library/Menu Planner
// listener Sets (baseListeners, dhalListeners, saladListeners,
// beverageListeners, dessertListeners, mainDishListeners,
// iconLibraryListeners) and the two weekly-menu-stores are deliberately NOT
// in this list any more — see the comment above PersistedState for why:
// Firestore's own onSnapshot listeners are what keeps those in sync now,
// and persistAll() no longer has anywhere to put their data anyway (it was
// removed from PersistedState above).
[
  systemDateListeners, mealLibraryListeners, customerListeners,
  auditListeners, discrepancyListeners, poListeners, pettyCashListeners,
  cashierListeners, discountRequestListeners, orderListeners, posListeners,
  loyaltyListeners, groupListeners, paymentMethodListeners, configListeners,
].forEach((set: Set<any>) => set.add(persistAll));

// Hydrate once at module load, before any component subscribes — ES module
// top-level code always finishes running before an importer's code (e.g. a
// React component's useEffect) can execute, so this is guaranteed to have
// already run by the time anything calls subscribeToX().
export const clearPersistedState = () => {
  try { localStorage.removeItem(PERSIST_KEY); } catch (e) { /* ignore */ }
};

(() => {
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return;
    const saved: Partial<PersistedState> = JSON.parse(raw);
    if (saved.MOCK_TODAY !== undefined) MOCK_TODAY = saved.MOCK_TODAY;
    if (saved.PAYMENT_METHODS !== undefined) PAYMENT_METHODS = saved.PAYMENT_METHODS;
    if (saved.MEAL_LIBRARY_ITEMS !== undefined) MEAL_LIBRARY_ITEMS = saved.MEAL_LIBRARY_ITEMS;
    if (saved.PUBLISHED_PLAN !== undefined) PUBLISHED_PLAN = saved.PUBLISHED_PLAN;
    if (saved.GLOBAL_CUSTOMERS !== undefined) GLOBAL_CUSTOMERS = saved.GLOBAL_CUSTOMERS;
    if (saved.AUDIT_LOG !== undefined) AUDIT_LOG = saved.AUDIT_LOG;
    if (saved.DISCREPANCIES !== undefined) DISCREPANCIES = saved.DISCREPANCIES;
    if (saved.PURCHASE_ORDERS !== undefined) PURCHASE_ORDERS = saved.PURCHASE_ORDERS;
    if (saved.PETTY_CASH !== undefined) PETTY_CASH = saved.PETTY_CASH;
    if (saved.PREVIOUS_SHIFT_PHYSICAL !== undefined) PREVIOUS_SHIFT_PHYSICAL = saved.PREVIOUS_SHIFT_PHYSICAL;
    if (saved.CASHIER_SHIFT !== undefined) CASHIER_SHIFT = saved.CASHIER_SHIFT;
    if (saved.DISCOUNT_REQUESTS !== undefined) DISCOUNT_REQUESTS = saved.DISCOUNT_REQUESTS;
    if (saved.ACTIVE_ORDERS !== undefined) ACTIVE_ORDERS = saved.ACTIVE_ORDERS;
    if (saved.POS_SESSION_CARTS !== undefined) POS_SESSION_CARTS = saved.POS_SESSION_CARTS;
    if (saved.LOYALTY_TIERS !== undefined) LOYALTY_TIERS = saved.LOYALTY_TIERS;
    if (saved.CUSTOMER_GROUPS !== undefined) CUSTOMER_GROUPS = saved.CUSTOMER_GROUPS;
    if (saved.SYSTEM_CONFIG !== undefined) Object.assign(SYSTEM_CONFIG, saved.SYSTEM_CONFIG);
  } catch (e) {
    console.warn('BonManzE: failed to restore persisted state', e);
  }
})();

// Real-time synchronization of restricted/staff-only collections (Icon Library & Customer Groups).
// Since the read rules for these collections require active staff authentication, setting up
// the listeners unconditionally on import (when auth.currentUser is initially null) causes them
// to immediately fail and terminate. Instead, we subscribe/unsubscribe dynamically as the
// user's authentication state changes.
let activeStaffListenersUnsub: (() => void) | null = null;

onAuthStateChanged(auth, user => {
  if (activeStaffListenersUnsub) {
    activeStaffListenersUnsub();
    activeStaffListenersUnsub = null;
  }

  if (user) {
    const unsubIcon = onSnapshot(
      doc(db, 'iconLibrary', 'current'),
      snap => {
        if (!snap.exists()) return;
        ICON_LIBRARY = (snap.data().items || []) as IconEntry[];
        iconLibraryListeners.forEach(l => l([...ICON_LIBRARY]));
      },
      err => {
        console.warn('Icon Library sync rejected (expected for customer accounts):', err);
      }
    );

    const unsubGroup = onSnapshot(
      doc(db, 'customerGroups', 'current'),
      snap => {
        if (!snap.exists()) return;
        CUSTOMER_GROUPS = (snap.data().items || []) as CustomerGroup[];
        groupListeners.forEach(l => l([...CUSTOMER_GROUPS]));
      },
      err => {
        console.warn('Customer Groups sync rejected (expected for customer accounts):', err);
      }
    );

    activeStaffListenersUnsub = () => {
      unsubIcon();
      unsubGroup();
    };
  }
});
