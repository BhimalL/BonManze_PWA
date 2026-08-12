
import { MenuItem, LoyaltyTier, CustomerGroup, Order, OrderItem, PaymentMethod, Customer } from '../types';

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
  dinnerEnabled: true
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
  // Which base-catalog group (see AddOnOption.group below) this dish's Base
  // step offers — optional, defaults to 'rice' when unset so every existing
  // curry keeps offering the same 5 rice-family bases it always has. A
  // non-curry main (e.g. a grilled sausage served with bread) sets this to
  // e.g. 'bread' so the Base step filters to bread-group options only.
  baseGroup?: string;
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
  // entries this dish offers — replaces the old single baseGroup filter
  // with the same applicable+narrow pattern as Dhal/Salad, so a dish can
  // offer an exact hand-picked set of bases instead of "every base tagged
  // with this one group". baseGroup (above) is kept only for dishes
  // configured before this existed — dishBaseOptionIds() below falls back
  // to resolving it into an id list when baseOptionIds itself is unset, so
  // nothing already configured silently loses its narrowing.
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
// "unset" reliably means "behaves like an existing curry" everywhere,
// without having to backfill baseGroup/dhalApplicable/saladApplicable onto
// every literal curry entry already defined below.
export const DEFAULT_BASE_GROUP = 'rice';
export const dishBaseGroup = (dish: CurryOption): string => dish.baseGroup ?? DEFAULT_BASE_GROUP;
export const dishDhalApplicable = (dish: CurryOption): boolean => dish.dhalApplicable ?? true;
export const dishSaladApplicable = (dish: CurryOption): boolean => dish.saladApplicable ?? true;
export const dishBeverageApplicable = (dish: CurryOption): boolean => dish.beverageApplicable ?? true;
export const dishDessertApplicable = (dish: CurryOption): boolean => dish.dessertApplicable ?? true;
export const dishBaseApplicable = (dish: CurryOption): boolean => dish.baseApplicable ?? true;
// Effective allowed Base ids for a dish — prefers the explicit narrow list
// set via the new Base checkboxes; for a dish configured before that
// existed (baseOptionIds unset) falls back to resolving the legacy
// baseGroup into whichever current Base catalog entries share that group,
// so nothing already narrowed by group silently widens back to "every
// base". A dish with neither set (baseOptionIds and baseGroup both unset)
// returns undefined — "no restriction", today's default for every curry
// that predates both mechanisms.
export const dishBaseOptionIds = (dish: CurryOption, allBases: AddOnOption[]): string[] | undefined => {
  if (dish.baseOptionIds !== undefined) return dish.baseOptionIds;
  if (dish.baseGroup !== undefined) return allBases.filter(b => (b.group || DEFAULT_BASE_GROUP) === dish.baseGroup).map(b => b.id);
  return undefined;
};

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

// Starts empty rather than auto-seeded from the existing default weekly
// rotations: those defaults deliberately vary a curry's name/desc/price by
// day (see dishPhotoFor's comment — ids there are shared per *photo family*,
// not per canonical dish), so there's no single "the" Fish Curry to seed
// from without guessing which day's version is canonical. Existing day-menu
// dishes keep working exactly as before with no Library link (no mainId);
// add Mains here going forward as new dishes come up.
export let MAIN_DISHES: MainDish[] = [];
const mainDishListeners = new Set<(items: MainDish[]) => void>();
export const subscribeToMainDishes = (listener: (items: MainDish[]) => void) => {
  mainDishListeners.add(listener);
  listener([...MAIN_DISHES]);
  return () => { mainDishListeners.delete(listener); };
};
export const addMainDish = (dish: MainDish) => {
  MAIN_DISHES = [...MAIN_DISHES, dish];
  mainDishListeners.forEach(l => l([...MAIN_DISHES]));
};
export const updateMainDish = (id: string, updates: Partial<Omit<MainDish, 'id'>>) => {
  MAIN_DISHES = MAIN_DISHES.map(m => m.id === id ? { ...m, ...updates } : m);
  mainDishListeners.forEach(l => l([...MAIN_DISHES]));
};
export const removeMainDish = (id: string) => {
  MAIN_DISHES = MAIN_DISHES.filter(m => m.id !== id);
  mainDishListeners.forEach(l => l([...MAIN_DISHES]));
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
// applicable+narrowing field, plus baseGroup, reflects the Main's *current*
// definition rather than whatever was copied onto the day when it was
// first picked. Editing a Main in the Library (unticking a category,
// narrowing its options) now immediately applies everywhere that Main is
// used, in both Operations and the Customer App meal builder. `price`,
// `id`, `mainId`, `name`, `desc`, and `emoji` deliberately stay the
// day-slot's own value — those are either intentionally per-day (price)
// or already locked-but-frozen elsewhere (name/desc, Menu Planner's
// editor). A dish with no mainId, or whose linked Main was since deleted,
// is returned unchanged. Every consumer that checks applicability or
// option-narrowing (meal builder sections, sectionComplete, the free-item
// forfeiture check) should look up the dish through this first.
export const resolveDish = (dish: CurryOption): CurryOption => {
  if (!dish.mainId) return dish;
  const main = MAIN_DISHES.find(m => m.id === dish.mainId);
  if (!main) return dish;
  return {
    ...dish,
    baseGroup: main.baseGroup,
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
function createWeeklyMenuStore(defaultMenu: Record<WeekdayKey, CurryOption[]>) {
  let overrides: Record<string, Record<WeekdayKey, CurryOption[]>> = {};
  const listeners = new Set<(overrides: Record<string, Record<WeekdayKey, CurryOption[]>>) => void>();

  const forWeek = (weekStart: string): Record<WeekdayKey, CurryOption[]> => overrides[weekStart] || defaultMenu;

  const subscribe = (listener: (overrides: Record<string, Record<WeekdayKey, CurryOption[]>>) => void) => {
    listeners.add(listener);
    listener({ ...overrides });
    return () => { listeners.delete(listener); };
  };

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
    overrides = {
      ...overrides,
      [weekStart]: { ...base, [day]: base[day].map(c => c.id === curryId ? { ...c, ...updates } : c) }
    };
    listeners.forEach(l => l({ ...overrides }));
  };

  // Adds a new main dish to a given day within a given week — same
  // seed-the-override-from-current-value approach as update(), so only the
  // touched week diverges from the default rotation.
  const addDish = (weekStart: string, day: WeekdayKey, dish: CurryOption) => {
    const base = overrides[weekStart] || defaultMenu;
    overrides = {
      ...overrides,
      [weekStart]: { ...base, [day]: [...base[day], dish] }
    };
    listeners.forEach(l => l({ ...overrides }));
  };

  // Removes a main dish from a given day within a given week.
  const removeDish = (weekStart: string, day: WeekdayKey, dishId: string) => {
    const base = overrides[weekStart] || defaultMenu;
    overrides = {
      ...overrides,
      [weekStart]: { ...base, [day]: base[day].filter(c => c.id !== dishId) }
    };
    listeners.forEach(l => l({ ...overrides }));
  };

  // Replaces an entire week's lineup in one atomic call — used by "reuse a
  // previous week's plan" (copy one week's override into another) and by
  // CSV import, so the copy/import doesn't require looping addDish/
  // removeDish/update per dish. Takes a plain menu object (a snapshot of
  // some week — either forWeek(sourceWeek) or a freshly parsed CSV), not a
  // reference into another week's live override, so editing the destination
  // afterwards never retroactively changes the source it was copied from.
  const setWeekMenu = (weekStart: string, menu: Record<WeekdayKey, CurryOption[]>) => {
    overrides = { ...overrides, [weekStart]: { ...menu } };
    listeners.forEach(l => l({ ...overrides }));
  };

  // Every weekStart key that currently has a saved override — lets Menu
  // Planner list and browse past/future weeks that were deliberately set
  // apart from the default rotation, without already knowing the key.
  // Sorted ascending (ISO date strings sort correctly as plain strings) so
  // a "browse previous weeks" UI can show them oldest/newest without an
  // extra sort step.
  const listWeekStarts = (): string[] => Object.keys(overrides).sort();

  // Raw accessors used only by the persistence layer at the bottom of this
  // file: getSnapshot() reads the current overrides for saving, hydrate()
  // restores a saved set on module load, and addRawListener() registers a
  // subscriber without the immediate "call me with the current value" firing
  // that subscribe() does (persistAll must NOT fire before hydrate() has run,
  // or it would overwrite the saved data with the in-memory defaults).
  const getSnapshot = () => ({ ...overrides });
  const hydrate = (saved: Record<string, Record<WeekdayKey, CurryOption[]>> | undefined) => {
    if (!saved) return;
    overrides = { ...saved };
    listeners.forEach(l => l({ ...overrides }));
  };
  const addRawListener = (listener: (overrides: Record<string, Record<WeekdayKey, CurryOption[]>>) => void) => {
    listeners.add(listener);
  };

  return { forWeek, subscribe, update, addDish, removeDish, setWeekMenu, listWeekStarts, getSnapshot, hydrate, addRawListener };
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

const lunchMenuStore = createWeeklyMenuStore(WEEKLY_LUNCH_MENU_DEFAULT);
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

const dinnerMenuStore = createWeeklyMenuStore(WEEKLY_DINNER_MENU_DEFAULT);
export const dinnerMenuForWeek = dinnerMenuStore.forWeek;
export const subscribeToDinnerMenu = dinnerMenuStore.subscribe;
export const updateDinnerCurryOption = dinnerMenuStore.update;
export const addDinnerDish = dinnerMenuStore.addDish;
export const removeDinnerDish = dinnerMenuStore.removeDish;
export const setDinnerWeekMenu = dinnerMenuStore.setWeekMenu;
export const listDinnerWeekStarts = dinnerMenuStore.listWeekStarts;

// --- One-time Meal Library migration ---
// Walks every dish currently in play — the hardcoded default rotation plus
// any saved week overrides, Lunch and Dinner both — and creates a Main in
// the Library for each distinct dish name that doesn't already have one.
//
// Lunch and Dinner are walked (and deduped) separately rather than merged
// into one shared pool: the same name can legitimately mean two different
// offerings ("Chicken Curry" is Rs150 at lunch, Rs180 at dinner in the
// current data), so folding them into a single Main would silently
// overwrite one service's real price with the other's. Only when a name's
// Lunch and Dinner canonical versions turn out identical (same price and
// description) are they merged into one Main; otherwise each keeps its own
// Main, suffixed "(Lunch)"/"(Dinner)" so both are distinguishable in the
// Add-dish picker.
//
// "Canonical" for a given name is simply its first occurrence when walking
// the default rotation (MON→FRI) and then saved override weeks in
// ascending order — deterministic and reproducible, since in the current
// data every day a name repeats it keeps the same price (only the
// description varies day to day).
//
// Safe to re-run: a name already matching an existing Main (case-
// insensitive) is skipped rather than duplicated, so running this again
// after adding new override weeks only picks up genuinely new names. This
// never touches existing day-slot dishes on the Menu Planner — it only
// populates the Library; nothing already planned gets linked or locked.
export interface MenuLibraryMigrationResult {
  created: string[];
  skipped: string[];
  // How many already-existing day-slot dishes (default rotation + every
  // saved week, both services) got their mainId set to the Main matching
  // their name — see the backfill pass below.
  linked: number;
}

const canonicalDishesByName = (
  defaultMenu: Record<WeekdayKey, CurryOption[]>,
  weekStarts: string[],
  forWeek: (weekStart: string) => Record<WeekdayKey, CurryOption[]>
): Map<string, CurryOption> => {
  const canonical = new Map<string, CurryOption>();
  const visit = (menu: Record<WeekdayKey, CurryOption[]>) => {
    WEEKDAY_KEYS.forEach(day => {
      (menu[day] || []).forEach(dish => {
        const key = dish.name.trim().toLowerCase();
        if (key && !canonical.has(key)) canonical.set(key, dish);
      });
    });
  };
  visit(defaultMenu);
  weekStarts.slice().sort().forEach(w => visit(forWeek(w)));
  return canonical;
};

export const migrateMenuToLibrary = (): MenuLibraryMigrationResult => {
  const lunchCanonical = canonicalDishesByName(WEEKLY_LUNCH_MENU_DEFAULT, listLunchWeekStarts(), lunchMenuForWeek);
  const dinnerCanonical = canonicalDishesByName(WEEKLY_DINNER_MENU_DEFAULT, listDinnerWeekStarts(), dinnerMenuForWeek);

  const findMainByName = (name: string) => MAIN_DISHES.find(m => m.name.trim().toLowerCase() === name.trim().toLowerCase());
  const created: string[] = [];
  const skipped: string[] = [];
  let seq = 0;

  // Creates a Main for `displayName` if one doesn't already exist (by
  // name, case-insensitive), otherwise reuses the existing one — either
  // way returns its id, so the backfill pass below always has something
  // to link matching day-slot dishes to.
  const ensureMain = (dish: CurryOption, displayName: string): string => {
    const existing = findMainByName(displayName);
    if (existing) {
      skipped.push(displayName);
      return existing.id;
    }
    seq += 1;
    const id = `main-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}-${seq}`;
    addMainDish({
      id,
      emoji: dish.emoji,
      name: displayName,
      desc: dish.desc,
      price: dish.price,
      photoUrl: dish.photoUrl,
      baseApplicable: dishBaseApplicable(dish),
      baseOptionIds: dish.baseOptionIds,
      baseGroup: dish.baseGroup,
      dhalApplicable: dishDhalApplicable(dish),
      dhalOptionIds: dish.dhalOptionIds,
      saladApplicable: dishSaladApplicable(dish),
      saladOptionIds: dish.saladOptionIds,
      beverageApplicable: dishBeverageApplicable(dish),
      beverageOptionIds: dish.beverageOptionIds,
      dessertApplicable: dishDessertApplicable(dish),
      dessertOptionIds: dish.dessertOptionIds
    });
    created.push(displayName);
    return id;
  };

  // Per-service, per-name → Main id, built once so the backfill pass below
  // can link every occurrence of that name without re-deciding (identical
  // vs. Lunch/Dinner-suffixed) each time.
  const lunchLinkByKey = new Map<string, string>();
  const dinnerLinkByKey = new Map<string, string>();

  const allKeys = new Set<string>([...lunchCanonical.keys(), ...dinnerCanonical.keys()]);
  allKeys.forEach(key => {
    const lunchDish = lunchCanonical.get(key);
    const dinnerDish = dinnerCanonical.get(key);
    if (lunchDish && dinnerDish) {
      const identical = lunchDish.price === dinnerDish.price && lunchDish.desc.trim() === dinnerDish.desc.trim();
      if (identical) {
        const id = ensureMain(lunchDish, lunchDish.name);
        lunchLinkByKey.set(key, id);
        dinnerLinkByKey.set(key, id);
      } else {
        lunchLinkByKey.set(key, ensureMain(lunchDish, `${lunchDish.name} (Lunch)`));
        dinnerLinkByKey.set(key, ensureMain(dinnerDish, `${dinnerDish.name} (Dinner)`));
      }
    } else if (lunchDish) {
      lunchLinkByKey.set(key, ensureMain(lunchDish, lunchDish.name));
    } else if (dinnerDish) {
      dinnerLinkByKey.set(key, ensureMain(dinnerDish, dinnerDish.name));
    }
  });

  // Persist these name→id links so relinkDefaultRotationToLibrary() can
  // replay them on every future load — see LUNCH_DEFAULT_LINK_MAP above for
  // why. Merged rather than overwritten, in case this ever runs more than
  // once (it currently doesn't, but merging costs nothing and is safer).
  LUNCH_DEFAULT_LINK_MAP = { ...LUNCH_DEFAULT_LINK_MAP, ...Object.fromEntries(lunchLinkByKey) };
  DINNER_DEFAULT_LINK_MAP = { ...DINNER_DEFAULT_LINK_MAP, ...Object.fromEntries(dinnerLinkByKey) };

  // --- Backfill: link every already-existing day-slot dish (the default
  // rotation plus every saved week, both services) to the Main it matches
  // by name — so "Import" doesn't just create Mains, it also connects what
  // was already planned to them. Never touches a dish that already has a
  // mainId (don't clobber a deliberate existing link), and never touches
  // price/desc — a linked day keeps showing whatever it already showed;
  // only its editability and its special-price comparison change from here.
  let linked = 0;
  const linkInPlace = (menu: Record<WeekdayKey, CurryOption[]>, linkByKey: Map<string, string>) => {
    WEEKDAY_KEYS.forEach(day => {
      menu[day].forEach(dish => {
        if (dish.mainId) return;
        const id = linkByKey.get(dish.name.trim().toLowerCase());
        if (id) { dish.mainId = id; linked++; }
      });
    });
  };
  linkInPlace(WEEKLY_LUNCH_MENU_DEFAULT, lunchLinkByKey);
  linkInPlace(WEEKLY_DINNER_MENU_DEFAULT, dinnerLinkByKey);

  const linkOverrideWeek = (
    weekStart: string,
    menu: Record<WeekdayKey, CurryOption[]>,
    linkByKey: Map<string, string>,
    update: (weekStart: string, day: WeekdayKey, curryId: string, updates: Partial<Omit<CurryOption, 'id'>>) => void
  ) => {
    WEEKDAY_KEYS.forEach(day => {
      menu[day].forEach(dish => {
        if (dish.mainId) return;
        const id = linkByKey.get(dish.name.trim().toLowerCase());
        if (id) { update(weekStart, day, dish.id, { mainId: id }); linked++; }
      });
    });
  };
  listLunchWeekStarts().forEach(w => linkOverrideWeek(w, lunchMenuForWeek(w), lunchLinkByKey, updateLunchCurryOption));
  listDinnerWeekStarts().forEach(w => linkOverrideWeek(w, dinnerMenuForWeek(w), dinnerLinkByKey, updateDinnerCurryOption));

  // Mutating WEEKLY_LUNCH/DINNER_MENU_DEFAULT in place (above) bypasses the
  // normal update()/addDish() paths — those only ever touch a single
  // week's override, never the shared fallback rotation itself — so
  // nothing would otherwise tell subscribers (Operations' menuTick,
  // CustomerPortal's own subscription) that it changed. Re-hydrating with
  // the current overrides is a no-op on the override data itself, just a
  // way to force that notification.
  lunchMenuStore.hydrate(lunchMenuStore.getSnapshot());
  dinnerMenuStore.hydrate(dinnerMenuStore.getSnapshot());

  return { created, skipped, linked };
};

export interface AddOnOption {
  id: string;
  emoji: string;
  name: string;
  price?: number;
  up?: number;
  // Which base-catalog "family" this option belongs to — Base entries only
  // (e.g. 'rice' for the original 5, 'bread' for a White/Brown Bread pair
  // added for a non-rice main dish). Unused by Dhal/Salad/Beverage/Dessert.
  group?: string;
}

// Base/Dhal/Salad/Beverage/Dessert used to be plain immutable constants with
// no admin UI — changing them meant editing source code. Each is now a real
// mutable store (live-bound export + listener set + subscribe/add/update/
// remove), the same hand-rolled pattern as MEAL_LIBRARY_ITEMS/LOYALTY_TIERS
// above, so Operations can manage them and the meal builder can react live.

export let MEAL_BASES: AddOnOption[] = [
  { id: 'wrice', emoji: '🍚', name: 'White Rice', up: 0, group: 'rice' },
  { id: 'brice', emoji: '🌾', name: 'Brown Rice', up: 15, group: 'rice' },
  { id: 'quin', emoji: '🌿', name: 'Quinoa', up: 25, group: 'rice' },
  { id: 'cous', emoji: '🫓', name: 'Couscous', up: 20, group: 'rice' },
  { id: 'caul', emoji: '🥦', name: 'Cauliflower Rice', up: 20, group: 'rice' },
];
const baseListeners = new Set<(items: AddOnOption[]) => void>();
export const subscribeToBases = (listener: (items: AddOnOption[]) => void) => {
  baseListeners.add(listener);
  listener([...MEAL_BASES]);
  return () => { baseListeners.delete(listener); };
};
export const addBaseOption = (item: AddOnOption) => {
  MEAL_BASES = [...MEAL_BASES, item];
  baseListeners.forEach(l => l([...MEAL_BASES]));
};
export const updateBaseOption = (id: string, updates: Partial<AddOnOption>) => {
  MEAL_BASES = MEAL_BASES.map(i => i.id === id ? { ...i, ...updates } : i);
  baseListeners.forEach(l => l([...MEAL_BASES]));
};
export const removeBaseOption = (id: string) => {
  MEAL_BASES = MEAL_BASES.filter(i => i.id !== id);
  baseListeners.forEach(l => l([...MEAL_BASES]));
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
export const addDhalOption = (item: AddOnOption) => {
  MEAL_DHALS = [...MEAL_DHALS, item];
  dhalListeners.forEach(l => l([...MEAL_DHALS]));
};
export const updateDhalOption = (id: string, updates: Partial<AddOnOption>) => {
  MEAL_DHALS = MEAL_DHALS.map(i => i.id === id ? { ...i, ...updates } : i);
  dhalListeners.forEach(l => l([...MEAL_DHALS]));
};
export const removeDhalOption = (id: string) => {
  MEAL_DHALS = MEAL_DHALS.filter(i => i.id !== id);
  dhalListeners.forEach(l => l([...MEAL_DHALS]));
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
export const addSaladOption = (item: AddOnOption) => {
  MEAL_SALADS = [...MEAL_SALADS, item];
  saladListeners.forEach(l => l([...MEAL_SALADS]));
};
export const updateSaladOption = (id: string, updates: Partial<AddOnOption>) => {
  MEAL_SALADS = MEAL_SALADS.map(i => i.id === id ? { ...i, ...updates } : i);
  saladListeners.forEach(l => l([...MEAL_SALADS]));
};
export const removeSaladOption = (id: string) => {
  MEAL_SALADS = MEAL_SALADS.filter(i => i.id !== id);
  saladListeners.forEach(l => l([...MEAL_SALADS]));
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
export const addBeverageOption = (item: AddOnOption) => {
  MEAL_BEVERAGES = [...MEAL_BEVERAGES, item];
  beverageListeners.forEach(l => l([...MEAL_BEVERAGES]));
};
export const updateBeverageOption = (id: string, updates: Partial<AddOnOption>) => {
  MEAL_BEVERAGES = MEAL_BEVERAGES.map(i => i.id === id ? { ...i, ...updates } : i);
  beverageListeners.forEach(l => l([...MEAL_BEVERAGES]));
};
export const removeBeverageOption = (id: string) => {
  MEAL_BEVERAGES = MEAL_BEVERAGES.filter(i => i.id !== id);
  beverageListeners.forEach(l => l([...MEAL_BEVERAGES]));
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
export const addDessertOption = (item: AddOnOption) => {
  MEAL_DESSERTS = [...MEAL_DESSERTS, item];
  dessertListeners.forEach(l => l([...MEAL_DESSERTS]));
};
export const updateDessertOption = (id: string, updates: Partial<AddOnOption>) => {
  MEAL_DESSERTS = MEAL_DESSERTS.map(i => i.id === id ? { ...i, ...updates } : i);
  dessertListeners.forEach(l => l([...MEAL_DESSERTS]));
};
export const removeDessertOption = (id: string) => {
  MEAL_DESSERTS = MEAL_DESSERTS.filter(i => i.id !== id);
  dessertListeners.forEach(l => l([...MEAL_DESSERTS]));
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
export const addIconEntry = (item: IconEntry) => {
  ICON_LIBRARY = [...ICON_LIBRARY, item];
  iconLibraryListeners.forEach(l => l([...ICON_LIBRARY]));
};
export const updateIconEntry = (id: string, updates: Partial<IconEntry>) => {
  ICON_LIBRARY = ICON_LIBRARY.map(i => i.id === id ? { ...i, ...updates } : i);
  iconLibraryListeners.forEach(l => l([...ICON_LIBRARY]));
};
export const removeIconEntry = (id: string) => {
  ICON_LIBRARY = ICON_LIBRARY.filter(i => i.id !== id);
  iconLibraryListeners.forEach(l => l([...ICON_LIBRARY]));
};

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
  { id: 'c1', firstName: 'Marcus', lastName: 'Sterling', name: 'Marcus Sterling', email: 'm.sterling@outlook.com', phone: '+230 5765 4321', segment: 'VIP', group: 'VIP', lastOrder: '2023-10-15', ltv: 45000, points: 10450, storeCredit: 1250.00, tier: 'Diamond', birthday: '1990-06-12', avatar: 'https://picsum.photos/seed/m/100/100', referenceCode: 'MARC-VIP-1', gdprConsent: { marketing: true, sms: true, dataProcessing: true }, addresses: [{ id: 'a1', label: 'Home', street: 'Penthouse 4, Cyber Tower 1', city: 'Ebene', zip: '72201', country: 'Mauritius' }, { id: 'a2', label: 'Office', street: 'Level 9, Nexteracom', city: 'Ebene', zip: '72201', country: 'Mauritius' }] },
  { id: 'c2', firstName: 'Eleanor', lastName: 'Fant', name: 'Eleanor Fant', email: 'eleanor.f@gmail.com', phone: '+230 5987 6543', segment: 'VIP', group: 'Corporate', lastOrder: '2023-10-31', ltv: 28400, points: 300, storeCredit: 0, tier: 'Bronze', birthday: '1985-10-31', avatar: 'https://picsum.photos/seed/cust1/100/100', referenceCode: 'ELEA-CORP', gdprConsent: { marketing: true, sms: true, dataProcessing: true }, addresses: [{ id: 'a1', label: 'Work', street: '12 Coastal Road', city: 'Grand Baie', zip: '30510', country: 'Mauritius' }] },
  { id: 'c3', firstName: 'Sarah', lastName: 'Connor', name: 'Sarah Connor', email: 'sarah.c@sky.net', phone: '+230 5111 2222', segment: 'Regular', group: 'ABC Motors Co Ltd', lastOrder: '2023-10-10', ltv: 12500, points: 1450, storeCredit: 450.50, tier: 'Silver', birthday: '1995-01-27', avatar: 'https://picsum.photos/seed/s/100/100', referenceCode: 'SARAH-001', gdprConsent: { marketing: true, sms: false, dataProcessing: true }, addresses: [{ id: 'a1', label: 'Home', street: '123 Cybercity Ave', city: 'Ebene', zip: '72201', country: 'Mauritius' }] }
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

export const updateSystemConfig = (updates: Partial<typeof SYSTEM_CONFIG>) => {
  if (updates.operatingDays) SYSTEM_CONFIG.operatingDays = updates.operatingDays;
  if (updates.activeServices) SYSTEM_CONFIG.activeServices = updates.activeServices;
  if (updates.cutoffTime) SYSTEM_CONFIG.cutoffTime = updates.cutoffTime;
  if (updates.cutoffDayOffset !== undefined) SYSTEM_CONFIG.cutoffDayOffset = updates.cutoffDayOffset;
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
  configListeners.forEach(l => l());
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

export const updateLoyaltyTiers = (tiers: LoyaltyTier[]) => {
  LOYALTY_TIERS = [...tiers];
  loyaltyListeners.forEach(l => l([...LOYALTY_TIERS]));
};

export const deleteLoyaltyTier = (id: string) => {
  LOYALTY_TIERS = LOYALTY_TIERS.filter(t => t.id !== id);
  loyaltyListeners.forEach(l => l([...LOYALTY_TIERS]));
};

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

export const updateCustomerGroups = (groups: CustomerGroup[]) => {
  CUSTOMER_GROUPS = [...groups];
  groupListeners.forEach(l => l([...CUSTOMER_GROUPS]));
};

export const deleteCustomerGroup = (id: string) => {
  CUSTOMER_GROUPS = CUSTOMER_GROUPS.filter(g => g.id !== id);
  groupListeners.forEach(l => l([...CUSTOMER_GROUPS]));
};

// --- PERSISTENCE (localStorage) ---
// Everything above this point is an in-memory mock that forgets everything
// on refresh — the single biggest gap identified in the 2026-08-10 codebase
// review (see AGENTS.md / BonManzE_v1_scope.md). This adds a durable layer
// without changing any mutator function above: every mutator already
// notifies its own listener Set, so persistAll() below just registers
// itself as one more listener on each Set and rides along for free.

const PERSIST_KEY = 'bonmanze_rms_state_v1';

// Whether the one-time Menu Planner → Meal Library migration (see
// migrateMenuToLibrary below) has already run on this installation.
// Persisted so it runs itself automatically, exactly once, right after
// hydration — the admin "Import from existing menu" button has been
// removed now that this is automatic; this flag is what replaces it. A
// fresh browser profile/origin (empty localStorage) or one where this
// flag never got saved will auto-run the migration on next load, same as
// clicking the old button once used to do.
//
// IMPORTANT — this flag only guards *creating* Mains, not *linking* dishes
// to them. See LUNCH_DEFAULT_LINK_MAP/relinkDefaultRotationToLibrary below
// for why those two concerns had to be split apart.
let MENU_LIBRARY_MIGRATED = false;

// Name (lowercased) → Main id, captured once by migrateMenuToLibrary() and
// persisted here so relinkDefaultRotationToLibrary() can replay it on every
// future load. WEEKLY_LUNCH_MENU_DEFAULT/WEEKLY_DINNER_MENU_DEFAULT (below)
// are plain in-memory literals — only week *overrides* are persisted, via
// LUNCH_MENU_OVERRIDES/DINNER_MENU_OVERRIDES — so a mainId the migration
// wrote directly onto those default-rotation objects lived only in that
// page's memory and was gone the instant the module re-initialized on the
// next reload. Because MENU_LIBRARY_MIGRATED (above) then blocked the
// migration from ever running again, "This Week"/"Next Week" (or any future
// week nobody has explicitly edited) silently lost its Meal Library link on
// every single refresh or dev-server restart, forever, after the first
// successful migration — this is the actual root cause of the Menu Planner
// repeatedly appearing "not linked to the Library" across multiple rounds
// of fixes. These maps, plus the ungated relink pass below, fix that for
// good: the *link* step now safely re-runs on every load, while the
// *create* step (gated by MENU_LIBRARY_MIGRATED) still only ever runs once.
let LUNCH_DEFAULT_LINK_MAP: Record<string, string> = {};
let DINNER_DEFAULT_LINK_MAP: Record<string, string> = {};

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
  // Week-specific menu overrides (e.g. a custom "Next Week" lineup set in
  // Operations before that week arrives) were originally left out of this
  // snapshot — everything else in the app survives a refresh, but a planned
  // future week's menu silently reverted to the default rotation. Included
  // here so Operations can plan ahead without racing the clock.
  LUNCH_MENU_OVERRIDES: Record<string, Record<WeekdayKey, CurryOption[]>>;
  DINNER_MENU_OVERRIDES: Record<string, Record<WeekdayKey, CurryOption[]>>;
  // Base/Dhal/Salad/Beverage/Dessert catalogs — previously plain constants,
  // now admin-editable from Operations, so they need the same persistence
  // treatment as everything else above.
  MEAL_BASES: AddOnOption[];
  MEAL_DHALS: AddOnOption[];
  MEAL_SALADS: AddOnOption[];
  MEAL_BEVERAGES: AddOnOption[];
  MEAL_DESSERTS: AddOnOption[];
  // Meal Library Mains — see MAIN_DISHES above.
  MAIN_DISHES: MainDish[];
  // Icon Library — see ICON_LIBRARY above.
  ICON_LIBRARY: IconEntry[];
  // See MENU_LIBRARY_MIGRATED above.
  MENU_LIBRARY_MIGRATED: boolean;
  // See MAIN_DISH_CONTENT_CLEANED below.
  MAIN_DISH_CONTENT_CLEANED: boolean;
  // See LUNCH_DEFAULT_LINK_MAP/DINNER_DEFAULT_LINK_MAP above.
  LUNCH_DEFAULT_LINK_MAP: Record<string, string>;
  DINNER_DEFAULT_LINK_MAP: Record<string, string>;
  // See MENU_PLANNER_CLEARED_ONCE below.
  MENU_PLANNER_CLEARED_ONCE: boolean;
  // See DINNER_OVERRIDE_FIX_ONCE below.
  DINNER_OVERRIDE_FIX_ONCE: boolean;
}

const persistAll = () => {
  try {
    const snapshot: PersistedState = {
      MOCK_TODAY, PAYMENT_METHODS, MEAL_LIBRARY_ITEMS, PUBLISHED_PLAN,
      GLOBAL_CUSTOMERS, AUDIT_LOG, DISCREPANCIES, PURCHASE_ORDERS,
      PETTY_CASH, PREVIOUS_SHIFT_PHYSICAL, CASHIER_SHIFT, DISCOUNT_REQUESTS,
      ACTIVE_ORDERS, POS_SESSION_CARTS, LOYALTY_TIERS, CUSTOMER_GROUPS,
      SYSTEM_CONFIG,
      LUNCH_MENU_OVERRIDES: lunchMenuStore.getSnapshot(),
      DINNER_MENU_OVERRIDES: dinnerMenuStore.getSnapshot(),
      MEAL_BASES, MEAL_DHALS, MEAL_SALADS, MEAL_BEVERAGES, MEAL_DESSERTS,
      MAIN_DISHES, ICON_LIBRARY, MENU_LIBRARY_MIGRATED, MAIN_DISH_CONTENT_CLEANED,
      LUNCH_DEFAULT_LINK_MAP, DINNER_DEFAULT_LINK_MAP, MENU_PLANNER_CLEARED_ONCE,
      DINNER_OVERRIDE_FIX_ONCE,
    };
    localStorage.setItem(PERSIST_KEY, JSON.stringify(snapshot));
  } catch (e) {
    // Storage can fail (quota exceeded, private/incognito mode) — a
    // persistence hiccup should never break the app itself.
    console.warn('BonManzE: failed to persist state', e);
  }
};

// Every existing listener Set gets persistAll added as an extra subscriber.
// No mutator function above needs to change.
[
  systemDateListeners, mealLibraryListeners, customerListeners,
  auditListeners, discrepancyListeners, poListeners, pettyCashListeners,
  cashierListeners, discountRequestListeners, orderListeners, posListeners,
  loyaltyListeners, groupListeners, paymentMethodListeners, configListeners,
  baseListeners, dhalListeners, saladListeners, beverageListeners, dessertListeners,
  mainDishListeners, iconLibraryListeners,
].forEach((set: Set<any>) => set.add(persistAll));
lunchMenuStore.addRawListener(persistAll);
dinnerMenuStore.addRawListener(persistAll);

// Hydrate once at module load, before any component subscribes — ES module
// top-level code always finishes running before an importer's code (e.g. a
// React component's useEffect) can execute, so this is guaranteed to have
// already run by the time anything calls subscribeToX().
export const clearPersistedState = () => {
  try { localStorage.removeItem(PERSIST_KEY); } catch (e) { /* ignore */ }
};

// Runs the Menu Planner → Meal Library migration exactly once per
// installation (see MENU_LIBRARY_MIGRATED above) and immediately persists
// the result, so a page reload right after never re-runs it or loses it.
// No-ops if the flag is already set.
const runMenuLibraryMigrationOnce = () => {
  if (MENU_LIBRARY_MIGRATED) return;
  migrateMenuToLibrary();
  MENU_LIBRARY_MIGRATED = true;
  persistAll();
};

// One-time content cleanup for Mains the original migration created — it
// disambiguated same-named Lunch/Dinner dishes by suffixing the Main's
// name "(Lunch)"/"(Dinner)", which read as visual clutter once the whole
// Library was visible at once, and it always copied the day-slot's short,
// auto-generated description verbatim rather than writing something fuller
// for a Library entry meant to be the definitive version of that dish.
// This strips the suffix from every Main's name (and a stray "- speical"
// typo found on one manually-added entry) and, for the specific Lunch/
// Dinner pairs the migration is known to have produced, replaces the
// description with a fuller one written to also read as the disambiguator
// now that the name no longer is. A Main whose (stripped) name+service
// doesn't match a known migrated pair — added by hand, or from a CSV
// import — only gets the name cleanup; there's no confident source to
// rewrite its description from, so it's left exactly as the admin wrote it.
const MAIN_DISH_DESCRIPTION_REWRITES: Record<string, string> = {
  'Veg Curry|Lunch': 'A comforting Creole-spiced vegetable curry with seasonal greens, carrots, and pumpkin, gently simmered for a light, fully vegan lunch.',
  'Veg Curry|Dinner': 'Roasted seasonal vegetables finished in a fuller evening curry sauce — heartier than the lunch version, built for dinner.',
  'Chicken Curry|Lunch': "Our everyday home-style Mauritian chicken curry, simmered in a fragrant onion-and-tomato masala the way it's cooked in most Mauritian kitchens.",
  'Chicken Curry|Dinner': 'Chicken finished with butter and cream for a richer, restaurant-style evening curry.',
  'Fish Curry|Lunch': "Fresh local fish gently poached in a light, ginger-forward curry sauce, kept simple so the fish stays the star of the plate.",
  'Fish Curry|Dinner': "Fish grilled first, then glazed in a tangy tamarind sauce for extra depth — our dinner take on the classic.",
  'Lentil Curry|Lunch': 'A warming, fully vegan lentil curry finished with roasted turmeric and cumin — a lighter option that still fills you up.',
  'Lentil Curry|Dinner': 'A five-lentil dal, ghee-tempered for extra richness — a more indulgent evening version of the lunch dal.',
  'Prawn Curry|Lunch': 'Plump prawns in a coconut-and-lemongrass curry, balancing sweetness and citrus for a bright midday plate.',
  'Prawn Curry|Dinner': 'Prawns finished in garlic butter with a chilli kick — a bolder, more indulgent evening preparation.',
  'Beef Curry|Lunch': 'Beef slow-cooked until tender in a rich Creole tomato sauce, built for a heartier lunch.',
  'Beef Curry|Dinner': 'Beef slow-cooked overnight for maximum tenderness, in a rich, deeply reduced gravy.',
  'Shrimp Curry|Lunch': 'Small shrimp in a mild coconut cream curry — gentle spicing, easy on the palate.',
  'Shrimp Curry|Dinner': 'Shrimp in a coconut cream curry lifted with fresh curry leaf, a more fragrant evening variation.',
  'Paneer Curry|Lunch': 'Soft paneer cubes in a spinach curry with a touch of spice — a vegetarian favourite with real bite.',
  'Paneer Curry|Dinner': 'Paneer in a cashew-and-tomato sauce — creamier and richer than the lunch version, made for dinner.',
};
let MAIN_DISH_CONTENT_CLEANED = false;
const cleanupMainDishContentOnce = () => {
  if (MAIN_DISH_CONTENT_CLEANED) return;
  MAIN_DISHES = MAIN_DISHES.map(m => {
    const isLunch = /\(lunch\)\s*$/i.test(m.name);
    const isDinner = /\(dinner\)\s*$/i.test(m.name);
    const name = m.name
      .replace(/\s*\((lunch|dinner)\)\s*$/i, '')
      .replace(/\s*-\s*speical\s*$/i, '')
      .trim();
    const key = isLunch ? `${name}|Lunch` : isDinner ? `${name}|Dinner` : undefined;
    const desc = (key && MAIN_DISH_DESCRIPTION_REWRITES[key]) || m.desc;
    return name === m.name && desc === m.desc ? m : { ...m, name, desc };
  });
  mainDishListeners.forEach(l => l([...MAIN_DISHES]));
  MAIN_DISH_CONTENT_CLEANED = true;
  persistAll();
};

// Re-applies LUNCH_DEFAULT_LINK_MAP/DINNER_DEFAULT_LINK_MAP onto
// WEEKLY_LUNCH_MENU_DEFAULT/WEEKLY_DINNER_MENU_DEFAULT — see those maps'
// comment above for the full root-cause explanation. Unlike
// runMenuLibraryMigrationOnce()/cleanupMainDishContentOnce(), this is
// deliberately NOT gated behind a "ran once" flag: it must re-run on every
// single load, because the two default-rotation constants it's patching
// are rebuilt fresh from source (unlinked) every time the module
// re-initializes. Cheap and idempotent — skips any dish that already has a
// mainId, and skips a link whose Main id no longer exists (e.g. deleted
// from the Library since the map was captured).
const relinkDefaultRotationToLibrary = () => {
  let linked = 0;
  const linkInPlace = (menu: Record<WeekdayKey, CurryOption[]>, linkMap: Record<string, string>) => {
    WEEKDAY_KEYS.forEach(day => {
      menu[day].forEach(dish => {
        if (dish.mainId) return;
        const id = linkMap[dish.name.trim().toLowerCase()];
        if (id && MAIN_DISHES.some(m => m.id === id)) { dish.mainId = id; linked++; }
      });
    });
  };
  linkInPlace(WEEKLY_LUNCH_MENU_DEFAULT, LUNCH_DEFAULT_LINK_MAP);
  linkInPlace(WEEKLY_DINNER_MENU_DEFAULT, DINNER_DEFAULT_LINK_MAP);
  if (linked > 0) {
    // Mutating the two default-rotation constants in place bypasses the
    // normal update() path, so nothing would otherwise tell subscribers
    // (Operations' menuTick, CustomerPortal) that a linked-but-unedited
    // week just changed — same re-hydrate-to-force-notify trick
    // migrateMenuToLibrary() already uses.
    lunchMenuStore.hydrate(lunchMenuStore.getSnapshot());
    dinnerMenuStore.hydrate(dinnerMenuStore.getSnapshot());
  }
};

// ONE-TIME script, run automatically the next time this installation loads
// — requested directly by Bhimal to empty the Menu Planner (This Week/Next
// Week/Week+2, both Lunch and Dinner) so he can re-pick every dish from
// the Meal Library by hand and verify each one links correctly from a
// clean slate, rather than trying to untangle whatever was already
// planned before the resolveDish()/relink fixes above landed.
//
// Deliberately called ONLY from the "existing persisted state" branch of
// the hydration IIFE below, never from the fresh-install branch — a brand
// new installation (no persisted state yet) has nothing to clear, and
// should keep showing the intended default rotation, not start blank
// forever. Guarded by MENU_PLANNER_CLEARED_ONCE so it fires exactly once
// on Bhimal's existing installation and never repeats — critically, it
// must never re-fire after he's re-added dishes, or it would wipe his
// rework right back out on the next reload.
//
// Sets every currently-relevant week to an explicit empty override —
// clearing overrides alone isn't enough, since forWeek() would then fall
// back to WEEKLY_LUNCH_MENU_DEFAULT/WEEKLY_DINNER_MENU_DEFAULT (the
// hardcoded rotation), which is not empty. Only touches the Menu
// Planner's day-slot dishes — never the Meal Library (Mains), orders, or
// customers.
let MENU_PLANNER_CLEARED_ONCE = false;
const mondayOfWeek = (dateStr: string, offsetDays: number): string => {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + offsetDays);
  const day = d.getDay(); // 0=Sun..6=Sat
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
};
const clearMenuPlannerOnce = () => {
  if (MENU_PLANNER_CLEARED_ONCE) return;
  const EMPTY_WEEK: Record<WeekdayKey, CurryOption[]> = { MON: [], TUE: [], WED: [], THU: [], FRI: [] };
  // Empty every week that already has an override (past, present, future)...
  Object.keys(lunchMenuStore.getSnapshot()).forEach(w => setLunchWeekMenu(w, { ...EMPTY_WEEK }));
  Object.keys(dinnerMenuStore.getSnapshot()).forEach(w => setDinnerWeekMenu(w, { ...EMPTY_WEEK }));
  // ...and force-empty This Week/Next Week/Week+2 even if they had no
  // override yet (they'd otherwise still show the hardcoded default
  // rotation, which is not empty).
  [0, 7, 14].forEach(offsetDays => {
    const weekStart = mondayOfWeek(MOCK_TODAY, offsetDays);
    setLunchWeekMenu(weekStart, { ...EMPTY_WEEK });
    setDinnerWeekMenu(weekStart, { ...EMPTY_WEEK });
  });
  MENU_PLANNER_CLEARED_ONCE = true;
  persistAll();
};

// Follow-up, second one-time patch. clearMenuPlannerOnce above was supposed
// to leave Dinner's This Week/Next Week/Week+2 slots just as empty as
// Lunch's — same three weekStarts, same setWeekMenu call, same code path —
// but a live check of an actual installation on 2026-08-11 found Dinner's
// overrides for two of those three weeks missing entirely (silently
// falling through to the hardcoded default rotation, which is why Dinner
// still showed real dish names/prices after the "clear") and the third
// full of a stale multi-dish override instead of the intended empty one,
// while all three of Lunch's forced weeks came out correctly empty. The
// asymmetry didn't reproduce from reading the code — the Lunch/Dinner
// paths are byte-for-byte identical — so rather than keep chasing a cause
// that isn't visible in the source, this just re-applies the same
// forced-empty write to Dinner's three current weeks a second time. Gated
// by its own flag so it only ever fires once, and only on an installation
// where the first clear already ran (a fresh install has nothing to fix).
let DINNER_OVERRIDE_FIX_ONCE = false;
const fixDinnerOverridesOnce = () => {
  if (DINNER_OVERRIDE_FIX_ONCE) {
    console.log('BonManzE: fixDinnerOverridesOnce already ran on this installation — skipping.');
    return;
  }
  if (!MENU_PLANNER_CLEARED_ONCE) { DINNER_OVERRIDE_FIX_ONCE = true; return; }
  const EMPTY_WEEK: Record<WeekdayKey, CurryOption[]> = { MON: [], TUE: [], WED: [], THU: [], FRI: [] };
  // Belt-and-suspenders: clear every existing Dinner override key first, not
  // just the three "current" weeks below — in case a stray week outside
  // those three is also carrying stale content (mirrors the first step of
  // clearMenuPlannerOnce above, which did the same for Lunch).
  Object.keys(dinnerMenuStore.getSnapshot()).forEach(w => setDinnerWeekMenu(w, { ...EMPTY_WEEK }));
  const weeksFixed = [0, 7, 14].map(offsetDays => {
    const weekStart = mondayOfWeek(MOCK_TODAY, offsetDays);
    setDinnerWeekMenu(weekStart, { ...EMPTY_WEEK });
    return weekStart;
  });
  DINNER_OVERRIDE_FIX_ONCE = true;
  persistAll();
  // Visible confirmation this actually ran, and with which weeks — so the
  // next person checking the console doesn't have to guess whether this
  // fired or silently no-op'd/threw before reaching here.
  console.warn('BonManzE: fixDinnerOverridesOnce ran — Dinner overrides forced empty for', weeksFixed);
};

(() => {
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) { runMenuLibraryMigrationOnce(); cleanupMainDishContentOnce(); relinkDefaultRotationToLibrary(); return; }
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
    lunchMenuStore.hydrate(saved.LUNCH_MENU_OVERRIDES);
    dinnerMenuStore.hydrate(saved.DINNER_MENU_OVERRIDES);
    if (saved.MEAL_BASES !== undefined) MEAL_BASES = saved.MEAL_BASES;
    if (saved.MEAL_DHALS !== undefined) MEAL_DHALS = saved.MEAL_DHALS;
    if (saved.MEAL_SALADS !== undefined) MEAL_SALADS = saved.MEAL_SALADS;
    if (saved.MEAL_BEVERAGES !== undefined) MEAL_BEVERAGES = saved.MEAL_BEVERAGES;
    if (saved.MEAL_DESSERTS !== undefined) MEAL_DESSERTS = saved.MEAL_DESSERTS;
    if (saved.MAIN_DISHES !== undefined) MAIN_DISHES = saved.MAIN_DISHES;
    if (saved.ICON_LIBRARY !== undefined) ICON_LIBRARY = saved.ICON_LIBRARY;
    if (saved.MENU_LIBRARY_MIGRATED !== undefined) MENU_LIBRARY_MIGRATED = saved.MENU_LIBRARY_MIGRATED;
    if (saved.MAIN_DISH_CONTENT_CLEANED !== undefined) MAIN_DISH_CONTENT_CLEANED = saved.MAIN_DISH_CONTENT_CLEANED;
    if (saved.LUNCH_DEFAULT_LINK_MAP !== undefined) LUNCH_DEFAULT_LINK_MAP = saved.LUNCH_DEFAULT_LINK_MAP;
    if (saved.DINNER_DEFAULT_LINK_MAP !== undefined) DINNER_DEFAULT_LINK_MAP = saved.DINNER_DEFAULT_LINK_MAP;
    if (saved.MENU_PLANNER_CLEARED_ONCE !== undefined) MENU_PLANNER_CLEARED_ONCE = saved.MENU_PLANNER_CLEARED_ONCE;
    if (saved.DINNER_OVERRIDE_FIX_ONCE !== undefined) DINNER_OVERRIDE_FIX_ONCE = saved.DINNER_OVERRIDE_FIX_ONCE;
    runMenuLibraryMigrationOnce();
    cleanupMainDishContentOnce();
    // Unconditional (not just on the fresh-install path above) — see
    // relinkDefaultRotationToLibrary's comment for why this must run on
    // every load, not just once.
    relinkDefaultRotationToLibrary();
    // One-time Menu Planner wipe — see clearMenuPlannerOnce's comment above
    // for why this only ever runs from this branch (existing installation),
    // never the fresh-install branch above.
    clearMenuPlannerOnce();
    // See fixDinnerOverridesOnce's comment above — a targeted second pass
    // that only touches Dinner's three current weeks, once, to correct
    // what the first clear left inconsistent.
    fixDinnerOverridesOnce();
  } catch (e) {
    console.warn('BonManzE: failed to restore persisted state', e);
  }
})();
