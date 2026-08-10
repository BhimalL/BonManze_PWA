
import { MenuItem, LoyaltyTier, CustomerGroup, Order, OrderItem, PaymentMethod, Customer } from '../types';

// Unified System Clock for Mocks
export let MOCK_TODAY = '2026-01-27';

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
  cutoffTime: '14:00',
  deadlinePolicy: '1 Day Before',
  currencySymbol: 'Rs',
  vatEnabled: true,
  vatRate: 15,
  vatNumber: 'VAT12345678',
  bulkDiscountEnabled: true,
  bulkDiscountRate: 5
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
}

export const WEEKDAY_KEYS = ['MON', 'TUE', 'WED', 'THU', 'FRI'] as const;
export type WeekdayKey = typeof WEEKDAY_KEYS[number];

export const WEEKLY_CURRY_MENU: Record<WeekdayKey, CurryOption[]> = {
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

export interface AddOnOption { id: string; emoji: string; name: string; price?: number; up?: number; }

export const MEAL_BASES: AddOnOption[] = [
  { id: 'wrice', emoji: '🍚', name: 'White Rice', up: 0 },
  { id: 'brice', emoji: '🌾', name: 'Brown Rice', up: 15 },
  { id: 'quin', emoji: '🌿', name: 'Quinoa', up: 25 },
  { id: 'cous', emoji: '🫓', name: 'Couscous', up: 20 },
  { id: 'caul', emoji: '🥦', name: 'Cauliflower Rice', up: 20 },
];
export const MEAL_DHALS: AddOnOption[] = [
  { id: 'moong', emoji: '🟡', name: 'Yellow Dhal' },
  { id: 'red', emoji: '🟤', name: 'Red Lentil Dhal' },
];
export const MEAL_SALADS: AddOnOption[] = [
  { id: 'garden', emoji: '🥗', name: 'Garden Salad' },
  { id: 'slaw', emoji: '🥙', name: 'Creole Slaw' },
];
export const MEAL_BEVERAGES: AddOnOption[] = [
  { id: 'alouda', emoji: '🥤', name: 'Alouda', price: 35 },
  { id: 'lemonade', emoji: '🍋', name: 'Lemonade', price: 30 },
  { id: 'water', emoji: '💧', name: 'Mineral Water', price: 0 },
];
export const MEAL_DESSERTS: AddOnOption[] = [
  { id: 'gateau', emoji: '🍡', name: 'Gateau Piment', price: 25 },
  { id: 'fruits', emoji: '🍌', name: 'Fruit Salad', price: 30 },
  { id: 'cake', emoji: '🎂', name: 'Coconut Cake', price: 0 },
];

// Real dish photography (three actual photos, licensed for this app),
// grouped by protein family so the same three photos cover every curry on
// the menu without a new photo shoot each time a day's curry changes.
export const dishPhotoFor = (curryId: string): string => {
  if (['fsh', 'prn', 'shp'].includes(curryId)) return '/dishes/fish.jpg';
  if (['veg', 'len', 'pan'].includes(curryId)) return '/dishes/veg.jpg';
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
             newItems[candidateIdx] = { ...newItems[candidateIdx], status: 'Cancelled' as const };
             
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
  if (updates.currencySymbol) SYSTEM_CONFIG.currencySymbol = updates.currencySymbol;
  if (updates.vatEnabled !== undefined) SYSTEM_CONFIG.vatEnabled = updates.vatEnabled;
  if (updates.vatRate !== undefined) SYSTEM_CONFIG.vatRate = updates.vatRate;
  if (updates.vatNumber !== undefined) SYSTEM_CONFIG.vatNumber = updates.vatNumber;
  if (updates.bulkDiscountEnabled !== undefined) SYSTEM_CONFIG.bulkDiscountEnabled = updates.bulkDiscountEnabled;
  if (updates.bulkDiscountRate !== undefined) SYSTEM_CONFIG.bulkDiscountRate = updates.bulkDiscountRate;
  if (updates.deadlinePolicy !== undefined) SYSTEM_CONFIG.deadlinePolicy = updates.deadlinePolicy;
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
// No mutator function above needs to change.
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
