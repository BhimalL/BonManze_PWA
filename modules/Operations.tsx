
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  BookOpen,
  ClipboardList,
  Truck,
  Wallet,
  Users,
  Calendar,
  CheckCircle2,
  Banknote,
  X,
  Phone,
  Mail,
  Star,
  MapPin,
  Clock,
  Edit3,
  Check,
  ChevronDown,
  ChevronUp,
  LayoutDashboard,
  Settings as SettingsIcon,
  Search,
  LogOut,
  MessageSquare,
  Plus,
  Trash2,
  Upload,
  Download,
  Copy,
  History,
  ChefHat,
  ImagePlus,
  Loader2,
  AlertCircle,
  Printer,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, collection, collectionGroup, onSnapshot, writeBatch, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseClient';
import { Order, OrderItem, Customer, PaymentMethod, LoyaltyTier, CustomerGroup } from '../types';
import { Portal } from './Portal';
import { IconPickerButton } from './IconPicker';
import {
  subscribeToOrders,
  updateOrderPayment,
  clearAllOrders,
  subscribeToCustomers,
  updateCustomerRecord,
  resetCustomerLoyalty,
  LOYALTY_TIERS,
  CUSTOMER_GROUPS,
  subscribeToLoyaltyTiers,
  updateLoyaltyTiers,
  subscribeToCustomerGroups,
  updateCustomerGroups,
  deleteCustomerGroup,
  subscribeToPaymentMethods,
  subscribeToSystemDate,
  updateSystemDate,
  subscribeToLunchMenu,
  updateLunchCurryOption,
  lunchMenuForWeek,
  addLunchDish,
  removeLunchDish,
  setLunchWeekMenu,
  listLunchWeekStarts,
  subscribeToDinnerMenu,
  updateDinnerCurryOption,
  dinnerMenuForWeek,
  addDinnerDish,
  removeDinnerDish,
  setDinnerWeekMenu,
  listDinnerWeekStarts,
  MOCK_TODAY,
  getRealTodayISO,
  WEEKDAY_KEYS,
  WeekdayKey,
  CurryOption,
  AddOnOption,

  dishBaseApplicable,
  dishBaseOptionIds,
  dishDhalApplicable,
  dishSaladApplicable,
  dishBeverageApplicable,
  dishDessertApplicable,
  dishPhotoFor,
  formatCurrency,
  MEAL_PLAN_PAYMENT_METHOD_NAMES,
  SYSTEM_CONFIG,
  subscribeToConfig,
  updateSystemConfig,
  subscribeToBases,
  addBaseOption,
  updateBaseOption,
  removeBaseOption,
  subscribeToDhals,
  addDhalOption,
  updateDhalOption,
  removeDhalOption,
  subscribeToSalads,
  addSaladOption,
  updateSaladOption,
  removeSaladOption,
  subscribeToBeverages,
  addBeverageOption,
  updateBeverageOption,
  removeBeverageOption,
  subscribeToDesserts,
  addDessertOption,
  updateDessertOption,
  removeDessertOption,
  MainDish,
  subscribeToMainDishes,
  addMainDish,
  updateMainDish,
  removeMainDish,
  specialPriceInfo,
  IconEntry,
  subscribeToIconLibrary,
  addIconEntry,
  updateIconEntry,
  removeIconEntry
} from './store';

const splitNotesTag = (notes?: string): { detail: string; person: string | null; instructions: string | null } => {
  if (!notes) return { detail: '', person: null, instructions: null };
  const segments = notes.split(' · ');
  let person: string | null = null;
  let instructions: string | null = null;
  const details: string[] = [];

  segments.forEach(seg => {
    const s = seg.trim();
    if (s.startsWith('for ')) {
      person = s.slice(4);
    } else if (s.startsWith('req: ')) {
      instructions = s.slice(5);
    } else {
      details.push(s);
    }
  });

  return { detail: details.join(' · '), person, instructions };
};

const isNoteForCustomer = (personName: string | null, customerName: string, cust?: Customer | null): boolean => {
  if (!personName) return false;
  const pLower = personName.trim().toLowerCase();
  const cLower = customerName.trim().toLowerCase();
  if (pLower === cLower) return true;
  if (cust) {
    if (cust.firstName && pLower === cust.firstName.trim().toLowerCase()) return true;
    if (cust.lastName && pLower === cust.lastName.trim().toLowerCase()) return true;
  }
  return false;
};

const InstructionsTag = ({ text }: { text: string }) => (
  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-warning/10 text-[#B4703A] border border-warning/15 text-[9px] font-black uppercase shrink-0">
    🍳 {text}
  </span>
);

const PersonTag = ({ name }: { name: string }) => (
  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-accent/10 text-accent text-[9px] font-bold shrink-0">
    👤 {name}
  </span>
);

const formatWeekStartForDropdown = (dateStr: string): string => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `Week of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
};

interface OperationsProps {
  onExit: () => void;
}

type Tab = 'dashboard' | 'menu' | 'library' | 'orders' | 'delivery' | 'payments' | 'customers' | 'transactions' | 'settings';

// Which offering a curry-menu edit applies to — Dinner is a second,
// independently toggleable offering that otherwise mirrors Lunch exactly.
type Service = 'Lunch' | 'Dinner';

// Which week the Menu tab is currently planning — 'This' and 'Next' match
// the Customer App's own This/Next switcher exactly (those two are what a
// customer can actually order). 'Week+2' and 'Week+3' are admin-only planning headroom —
// it lets Bhimal stay two weeks ahead of the calendar rollover instead of
// "Next Week" being empty the moment it becomes "This Week" — and has zero
// effect on what the Customer App shows or lets anyone order; nothing
// customer-facing (orderableWeeks, etc.) reads this type or this value.
type WeekChoice = 'This' | 'Next' | 'Week+2' | 'Week+3';

// A day's lineup can now grow/shrink (add/remove dish), so the fixed
// "curry" vocabulary is generalized to "main dish" wherever new UI is added
// below — CurryOption itself keeps its name (renaming it app-wide is a
// bigger, unrelated change) but the new UI speaks of "dishes".

const TABS: { id: Exclude<Tab, 'settings'>; label: string; icon: any }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'menu', label: 'Menu Planner', icon: BookOpen },
  { id: 'library', label: 'Meal Library', icon: ChefHat },
  { id: 'orders', label: 'Orders by Dish', icon: ClipboardList },
  { id: 'delivery', label: 'Delivery List', icon: Truck },
  { id: 'payments', label: 'Payments', icon: Wallet },
  { id: 'customers', label: 'Customer Directory', icon: Users },
  { id: 'transactions', label: 'Transactions Ledger', icon: FileSpreadsheet },
];

const formatDay = (dateKey: string) => {
  if (!dateKey || dateKey === 'Unscheduled') return 'Unscheduled';
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return dateKey;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
};

// _fsItemId is the item's real Firestore document id under
// orders/{orderId}/items — auto-generated by confirmCheckout, distinct from
// the "itemId" data field (which is just which dish/curry this item is).
// Mark Delivered/Mark Paid need it to build a real doc() reference; it's
// undefined for anything not sourced from the live Firestore listeners.
type FsOrderItem = OrderItem & { _fsItemId?: string };

interface DropTask {
  key: string;
  orderId: string;
  customerName: string;
  date?: string;
  slot?: string;
  items: FsOrderItem[];
  total: number;
  paymentStatus: 'Paid' | 'Pending' | 'Refunded';
  // What the customer told the app when they picked a payment method —
  // a claim, not a confirmed payment. Lets Operations match a Juice/MauCAS
  // transfer against a bank/wallet statement before confirming.
  claimedMethod?: string;
  claimedReference?: string;
}

interface OpsWeekDay { key: WeekdayKey; date: string; label: string; short: string; }

const getThisWeekDays = (systemDateStr: string): OpsWeekDay[] => {
  const [y, m, d] = systemDateStr.split('-').map(Number);
  const base = new Date(y, (m || 1) - 1, d || 1);
  const dow = base.getDay();
  const diffToMonday = dow === 6 ? 2 : (dow === 0 ? 1 : (1 - dow));
  const monday = new Date(base);
  monday.setDate(base.getDate() + diffToMonday);
  return WEEKDAY_KEYS.map((key, i) => {
    const dt = new Date(monday);
    dt.setDate(monday.getDate() + i);
    const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    return {
      key,
      date: iso,
      label: dt.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
      short: dt.toLocaleDateString('en-US', { weekday: 'short' })
    };
  });
};

// Adds/subtracts whole days to a 'YYYY-MM-DD' string — used to get from
// "this week's" Monday to "next week's" Monday (7 days ahead).
const addDays = (dateStr: string, days: number): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, (d || 1) + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

const Operations: React.FC<OperationsProps> = ({ onExit }) => {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // --- Real staff Firebase Auth (new, 2026-08-13) — Operations has never
  // had ANY login concept before this; App.tsx's "Operations" button
  // dropped straight into the full console for anyone. firestore.rules
  // requires request.auth.uid to resolve to an active staff/{uid} doc for
  // every gated read/write (see BonManzE_Firestore_Schema.md §2's staff-
  // login note), so without this gate every Firestore call below would
  // fail with permission-denied. Staff sign in with email+password, no
  // registration flow — accounts are provisioned once via
  // scripts/seedBootstrap.js, same as the schema doc's "bootstrap problem"
  // describes.
  const [staffAuthUser, setStaffAuthUser] = useState<any | null>(null);
  const [staffDocRaw, setStaffDocRaw] = useState<any | null>(null);
  const [staffAuthChecking, setStaffAuthChecking] = useState(true);
  const [staffLoginEmail, setStaffLoginEmail] = useState('');
  const [staffLoginPassword, setStaffLoginPassword] = useState('');
  const [staffAuthLoading, setStaffAuthLoading] = useState(false);
  const [staffAuthError, setStaffAuthError] = useState<string | null>(null);

  // Raw Firestore listener output for orders/items, organization-wide (no
  // customerId filter, unlike CustomerPortal.tsx's single-customer
  // listeners) — reshaped into Order[] below (fsOrders memo) so every
  // existing memo (lines, dishesByDay, drops, paymentDrops) keeps working
  // completely unchanged; they only ever needed an Order[] to iterate.
  const [fsOrderDocs, setFsOrderDocs] = useState<Record<string, any>>({});
  const [fsItemDocs, setFsItemDocs] = useState<Record<string, any[]>>({});

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [systemDate, setSystemDate] = useState(MOCK_TODAY);
  // Menus are looked up live via lunchMenuForWeek(weekStart)/dinnerMenuForWeek
  // (weekStart) rather than held in state directly — this tick just forces a
  // re-render whenever either menu changes, same pattern as configTick below.
  const [menuTick, setMenuTick] = useState(0);
  // Which week the Menu tab is currently browsing/editing — matches the
  // Customer App's own This week/Next week switcher.
  const [activeMenuWeek, setActiveMenuWeek] = useState<WeekChoice>('This');
  const [paymentDrop, setPaymentDrop] = useState<DropTask | null>(null);
  const [reuseWeekIndex, setReuseWeekIndex] = useState<number>(0);

  // In-flight/error state for the real Firestore writes behind Mark
  // Delivered/Mark Paid (see handleMarkDelivered/markPaid below) — these
  // are real network calls now, not synchronous mock mutations, so a
  // button needs a disabled/loading state and a failure needs to surface
  // somewhere rather than silently doing nothing.
  const [pendingDeliveryKey, setPendingDeliveryKey] = useState<string | null>(null);
  const [pendingDispatchKey, setPendingDispatchKey] = useState<string | null>(null);
  const [pendingCookingKey, setPendingCookingKey] = useState<string | null>(null);
  const [pendingPaymentKey, setPendingPaymentKey] = useState<string | null>(null);
  const [opsActionError, setOpsActionError] = useState<string | null>(null);
  const [activePrintDrop, setActivePrintDrop] = useState<DropTask | null>(null);
  const [activePrintService, setActivePrintService] = useState<{ date: string; service: 'Lunch' | 'Dinner'; drops: DropTask[] } | null>(null);

  // Automatically trigger window.print() when activePrintDrop is selected,
  // then clear the state to close the print rendering container.
  useEffect(() => {
    if (activePrintDrop) {
      const timer = setTimeout(() => {
        window.print();
        setActivePrintDrop(null);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [activePrintDrop]);

  // Automatically trigger window.print() when activePrintService is selected,
  // then clear the state to close the print rendering container.
  useEffect(() => {
    if (activePrintService) {
      const timer = setTimeout(() => {
        window.print();
        setActivePrintService(null);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [activePrintService]);

  // Meal Library / Menu Planner / add-on catalogs / Icon Library mutators
  // (addMainDish, updateBaseOption, lunchMenuStore's update/addDish/etc.,
  // addIconEntry, ...) are now real Firestore writes (store.ts) and can
  // reject — a permission-denied rule, a dropped connection. There are
  // ~30 call sites across this tab set; rather than build a per-action
  // spinner/error block for each (the pattern handleMarkDelivered/markPaid
  // use below, appropriate there because those are two specific, high-
  // stakes actions), every Meal Library/Menu Planner call site instead
  // fires its write through this shared helper, which reuses the same
  // opsActionError banner already shown on the Delivery/Payments tabs.
  // Deliberately fire-and-forget from the caller's point of view (matches
  // every one of these call sites' existing synchronous-looking style —
  // e.g. saveMainEditor closes the modal immediately) — a failure surfaces
  // via the banner a moment later instead of blocking the UI on the write.
  const runMenuWrite = (write: Promise<unknown>) => {
    setOpsActionError(null);
    write.catch(err => {
      setOpsActionError(err instanceof Error ? err.message : 'That change failed to save — please try again.');
    });
  };

  // Meal Library Main editor — opens as a modal, used from the Library tab
  // ("Add Main"/pencil on a Main) — base group, dhal/salad applicability
  // and which specific catalog options each allows all live here now,
  // defined once per Main rather than re-specified every time it's served.
  // `mode` distinguishes Save calling addMainDish vs updateMainDish;
  // `mainId` is only set (and only needed) in 'edit' mode.
  const [mainEditor, setMainEditor] = useState<{ mode: 'add' | 'edit'; mainId?: string } | null>(null);
  // null for an *OptionIds field means "no restriction — every catalog
  // entry" (matches every Main that's never narrowed one down). Ticking
  // individual boxes narrows it to an explicit array; re-ticking every box
  // normalizes back to null rather than storing a redundant "all of them,
  // explicitly" list — see toggleMainOption below.
  const [mainForm, setMainForm] = useState<{
    emoji: string; name: string; desc: string; price: string; cost: string; photoUrl: string;
    baseApplicable: boolean; baseOptionIds: string[] | null;
    dhalApplicable: boolean; dhalOptionIds: string[] | null;
    saladApplicable: boolean; saladOptionIds: string[] | null;
    beverageApplicable: boolean; beverageOptionIds: string[] | null;
    dessertApplicable: boolean; dessertOptionIds: string[] | null;
  }>({
    emoji: '🍽️', name: '', desc: '', price: '', cost: '', photoUrl: '',
    baseApplicable: true, baseOptionIds: null,
    dhalApplicable: true, dhalOptionIds: null,
    saladApplicable: true, saladOptionIds: null,
    beverageApplicable: true, beverageOptionIds: null,
    dessertApplicable: true, dessertOptionIds: null
  });
  // Photo upload error, shown inline near the field — same pattern as
  // logoError/csvError elsewhere rather than a blocking alert().
  const [mainPhotoError, setMainPhotoError] = useState('');
  const mainPhotoFileInputRef = useRef<HTMLInputElement>(null);

  // Meal Library Mains — subscribed the same way the five add-on catalogs
  // are below.
  const [mainDishes, setMainDishes] = useState<MainDish[]>([]);

  // Day-slot dish editing is back to a lightweight inline form (name/desc/
  // price only) — base/dhal/salad/beverage/dessert settings now live on the
  // Main a day-slot dish was copied from (see mainId), edited once in the
  // Library rather than per day. Price stays editable here on purpose: a
  // day can run a promo below the Main's general price, shown to customers
  // as a special price (see specialPriceInfo in store.ts).
  const [editingDaySlot, setEditingDaySlot] = useState<{ day: WeekdayKey; curryId: string; service: Service; weekStart: string } | null>(null);
  const [daySlotEditForm, setDaySlotEditForm] = useState({ name: '', desc: '', price: '' });

  // "Add dish" now opens a search-and-select popup over the Meal Library
  // instead of a blank creation form — picking a Main copies its full
  // current settings (base group, dhal/salad applicability + narrowing,
  // beverage/dessert narrowing, price) into a fresh day-slot dish. If the
  // Main you want isn't in the Library yet, add it there first (Library
  // tab) — this popup is select-only, it doesn't create new Mains.
  const [mainPickerFor, setMainPickerFor] = useState<{ day: WeekdayKey; service: Service; weekStart: string } | null>(null);
  const [mainPickerSearch, setMainPickerSearch] = useState('');

  // Base/Dhal/Salad/Beverage/Dessert catalogs — previously plain constants
  // with zero admin UI; now real reactive stores (see store.ts), subscribed
  // here the same way orders/customers/etc. already are.
  const [bases, setBases] = useState<AddOnOption[]>([]);
  const [dhals, setDhals] = useState<AddOnOption[]>([]);
  const [salads, setSalads] = useState<AddOnOption[]>([]);
  const [beverages, setBeverages] = useState<AddOnOption[]>([]);
  const [desserts, setDesserts] = useState<AddOnOption[]>([]);
  const [catalogsOpen, setCatalogsOpen] = useState(false);

  // Icon Library — managed from Settings → Icons, searched from every
  // IconPickerButton (Main Editor's icon, each Add-on Catalog entry's
  // icon) via subscribeToIconLibrary directly inside that component, but
  // Settings itself needs its own subscription to render the CRUD list.
  const [icons, setIcons] = useState<IconEntry[]>([]);
  const [editingIcon, setEditingIcon] = useState<string | null>(null);
  const [iconForm, setIconForm] = useState({ emoji: '', label: '' });
  const [newIconForm, setNewIconForm] = useState({ emoji: '', label: '' });
  // Settings has its own General/Icons sub-tabs now that it manages the
  // Icon Library too — everything that used to be the whole Settings page
  // lives under "General".
  const [settingsSubTab, setSettingsSubTab] = useState<'identity' | 'delivery' | 'tax' | 'loyalty' | 'groups' | 'icons' | 'danger'>('identity');
  const [loyaltyTiers, setLoyaltyTiers] = useState<LoyaltyTier[]>([]);
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([]);

  // Which existing add-on catalog entry is being edited inline, and its
  // draft form — mirrors editingCurry/editForm's shape for the five add-on
  // catalogs instead of main dishes. `catalog` identifies which of the five
  // stores the id belongs to, since ids aren't guaranteed unique *across*
  // catalogs (only within one).
  type CatalogKey = 'base' | 'dhal' | 'salad' | 'beverage' | 'dessert';
  const [editingAddOn, setEditingAddOn] = useState<{ catalog: CatalogKey; id: string } | null>(null);
  const [addOnForm, setAddOnForm] = useState({ emoji: '', name: '', price: '', group: '' });
  const [newAddOnForm, setNewAddOnForm] = useState<Record<CatalogKey, { emoji: string; name: string; price: string; group: string }>>({
    base: { emoji: '🍚', name: '', price: '0', group: 'rice' },
    dhal: { emoji: '🟡', name: '', price: '', group: '' },
    salad: { emoji: '🥗', name: '', price: '', group: '' },
    beverage: { emoji: '🥤', name: '', price: '0', group: '' },
    dessert: { emoji: '🍡', name: '', price: '0', group: '' },
  });

  // Group editing states in Settings > Loyalty
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupForm, setGroupForm] = useState({ name: '', discountPercentage: 0, description: '' });
  const [newGroupForm, setNewGroupForm] = useState({ name: '', discountPercentage: 0, description: '' });
  const [loyaltyTiersForm, setLoyaltyTiersForm] = useState<LoyaltyTier[]>([]);

  useEffect(() => {
    setLoyaltyTiersForm(loyaltyTiers);
  }, [loyaltyTiers]);

  // "Reuse a previous week" — which service's picker is open, and the
  // source weekStart currently selected in it. Copying calls
  // setLunchWeekMenu/setDinnerWeekMenu with a *snapshot* of the source
  // week (forWeek() returns a plain object, not a live reference), so
  // editing the destination afterwards never retroactively changes the
  // source week it was copied from.
  const [reusePickerFor, setReusePickerFor] = useState<Service | null>(null);
  const [reuseSourceWeek, setReuseSourceWeek] = useState<string>('');

  // CSV import — errors surface inline near the Import button rather than
  // as a blocking alert(), same "quiet inline feedback" convention as the
  // logo-upload error above.
  const csvFileInputRef = useRef<HTMLInputElement>(null);
  const [csvImportTarget, setCsvImportTarget] = useState<Service | null>(null);
  const [csvError, setCsvError] = useState('');

  // Transactions Tab filter states
  const [txSearch, setTxSearch] = useState('');
  const [txDateRange, setTxDateRange] = useState<'All' | 'Today' | 'ThisWeek' | 'Custom'>('All');
  const [txCustomStart, setTxCustomStart] = useState('');
  const [txCustomEnd, setTxCustomEnd] = useState('');
  const [txServiceSlot, setTxServiceSlot] = useState<'All' | 'Lunch' | 'Dinner'>('All');
  const [txPaymentStatus, setTxPaymentStatus] = useState<'All' | 'Paid' | 'Pending' | 'Refunded'>('All');
  const [txDeliveryStatus, setTxDeliveryStatus] = useState<'All' | 'Active' | 'Completed' | 'Cancelled'>('All');
  const [txRatingFilter, setTxRatingFilter] = useState<'All' | 'Rated' | 'Unrated' | '5star' | 'LowRating'>('All');

  // Dinner is a second, independently toggleable offering (same pattern as
  // the VAT switch below) — customers never see this switch, only Bhimal
  // does, here in Operations. Defaults to whatever SYSTEM_CONFIG currently
  // holds and flips immediately on click, same as VAT's on/off toggle.
  const [dinnerEnabled, setDinnerEnabledLocal] = useState(SYSTEM_CONFIG.dinnerEnabled);

  // Delivery List defaults to today; this overrides that when Bhimal taps
  // another day's chip to peek ahead. null = "follow today".
  const [deliveryDayOverride, setDeliveryDayOverride] = useState<WeekdayKey | null>(null);
  const [showPaidHistory, setShowPaidHistory] = useState(false);
  // Orders by Dish filter state
  const [ordersWeekFilter, setOrdersWeekFilter] = useState<'this' | 'next'>('this');
  const [ordersDayFilter, setOrdersDayFilter] = useState<string | 'all'>('all');
  const [ordersServiceFilter, setOrdersServiceFilter] = useState<'all' | 'Lunch' | 'Dinner'>('all');
  // Delivery List filter state
  const [deliveryWeekFilter, setDeliveryWeekFilter] = useState<'this' | 'next'>('this');
  const [deliveryServiceFilter, setDeliveryServiceFilter] = useState<'all' | 'Lunch' | 'Dinner'>('all');

  // VAT can only legally be charged once BonManzE is actually VAT-registered
  // with the MRA (Mauritius's registration threshold is MUR 3M/yr turnover,
  // or voluntary registration below that) — so this needs to be a switch
  // Bhimal can flip himself, not a hardcoded true buried in store.ts. Rate/
  // VRN are edited as drafts and only pushed to the store on Save; the
  // on/off switch itself commits immediately since it's a single toggle.
  const [vatEnabled, setVatEnabledLocal] = useState(SYSTEM_CONFIG.vatEnabled);
  const [vatRateInput, setVatRateInput] = useState(String(SYSTEM_CONFIG.vatRate));
  const [vatNumberInput, setVatNumberInput] = useState(SYSTEM_CONFIG.vatNumber);
  const [bulkDiscountEnabled, setBulkDiscountEnabled] = useState(SYSTEM_CONFIG.bulkDiscountEnabled);
  const [bulkDiscountRateInput, setBulkDiscountRateInput] = useState(String(SYSTEM_CONFIG.bulkDiscountRate));

  // Business identity — name/tagline/logo shown on the Customer App header,
  // login screen, and the receipt/invoice. Edited as a draft, pushed to the
  // store on Save, same pattern as the VAT details below.
  const [brandForm, setBrandForm] = useState({
    name: SYSTEM_CONFIG.businessName,
    tagline: SYSTEM_CONFIG.businessTagline,
    logoUrl: SYSTEM_CONFIG.businessLogoUrl,
    supportPhone: SYSTEM_CONFIG.supportPhone,
    supportEmail: SYSTEM_CONFIG.supportEmail
  });

  // Order cutoff & delivery windows — previously hardcoded into the
  // Customer App's copy ("Sunday noon", "11:30–12:00"), now editable here so
  // the app's own claims stay accurate. Edited as a draft, pushed on Save,
  // same pattern as branding/VAT above.
  const [deliveryForm, setDeliveryForm] = useState({
    lunchOrderCutoffTime: SYSTEM_CONFIG.lunchOrderCutoffTime || '12:00',
    lunchOrderCutoffDayOffset: String(SYSTEM_CONFIG.lunchOrderCutoffDayOffset !== undefined ? SYSTEM_CONFIG.lunchOrderCutoffDayOffset : -1),
    lunchCancelCutoffTime: SYSTEM_CONFIG.lunchCancelCutoffTime || '09:00',
    lunchCancelCutoffDayOffset: String(SYSTEM_CONFIG.lunchCancelCutoffDayOffset !== undefined ? SYSTEM_CONFIG.lunchCancelCutoffDayOffset : 0),
    dinnerOrderCutoffTime: SYSTEM_CONFIG.dinnerOrderCutoffTime || '12:00',
    dinnerOrderCutoffDayOffset: String(SYSTEM_CONFIG.dinnerOrderCutoffDayOffset !== undefined ? SYSTEM_CONFIG.dinnerOrderCutoffDayOffset : 0),
    dinnerCancelCutoffTime: SYSTEM_CONFIG.dinnerCancelCutoffTime || '14:00',
    dinnerCancelCutoffDayOffset: String(SYSTEM_CONFIG.dinnerCancelCutoffDayOffset !== undefined ? SYSTEM_CONFIG.dinnerCancelCutoffDayOffset : 0),
    lunchDeliveryWindow: SYSTEM_CONFIG.lunchDeliveryWindow,
    dinnerDeliveryWindow: SYSTEM_CONFIG.dinnerDeliveryWindow
  });

  const [customerSearch, setCustomerSearch] = useState('');
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [editCustFirstName, setEditCustFirstName] = useState('');
  const [editCustLastName, setEditCustLastName] = useState('');
  const [editCustEmail, setEditCustEmail] = useState('');
  const [editCustBirthday, setEditCustBirthday] = useState('');
  const [editCustPhone, setEditCustPhone] = useState('');
  const [editCustTier, setEditCustTier] = useState('');
  const [editCustGroup, setEditCustGroup] = useState('');
  const [editCustStreet, setEditCustStreet] = useState('');
  const [editCustCity, setEditCustCity] = useState('');
  const [confirmPaymentId, setConfirmPaymentId] = useState<string | null>(null);
  // Settings → Danger Zone — same arm-then-confirm pattern as payment
  // collection above, since this is destructive and, unlike everything
  // else in this file, never happens automatically.
  const [dangerConfirm, setDangerConfirm] = useState<'reset' | null>(null);
  const [dangerResetDone, setDangerResetDone] = useState(false);
  const handleDangerReset = () => {
    clearAllOrders();
    resetCustomerLoyalty();
    setDangerConfirm(null);
    setDangerResetDone(true);
  };

  // Staff auth listener — mirrors CustomerPortal.tsx's onAuthStateChanged
  // pattern. Verifies an active staff/{uid} doc exists before treating
  // anyone as signed in; a Firebase-authenticated user with no such doc
  // (or active: false) is immediately signed back out rather than left in
  // a half-authenticated state that would just 403 on every read below.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setStaffAuthUser(null);
        setStaffDocRaw(null);
        setStaffAuthChecking(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'staff', user.uid));
        if (snap.exists() && snap.data().active === true) {
          setStaffAuthUser(user);
          setStaffDocRaw({ id: user.uid, ...snap.data() });
        } else {
          setStaffAuthError('This account is not set up as active staff.');
          await signOut(auth);
          setStaffAuthUser(null);
          setStaffDocRaw(null);
        }
      } catch (e) {
        console.error('staff doc lookup failed', e);
        setStaffAuthError('Could not verify staff access.');
        await signOut(auth);
        setStaffAuthUser(null);
        setStaffDocRaw(null);
      } finally {
        setStaffAuthChecking(false);
      }
    });
    return unsub;
  }, []);

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffAuthError(null);
    setStaffAuthLoading(true);
    try {
      await signInWithEmailAndPassword(auth, staffLoginEmail.trim(), staffLoginPassword);
      // onAuthStateChanged above picks up from here.
    } catch (err: any) {
      const code = err?.code || '';
      setStaffAuthError(
        code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')
          ? 'Incorrect email or password.'
          : 'Could not sign in. Please try again.'
      );
    } finally {
      setStaffAuthLoading(false);
    }
  };

  const handleStaffSignOut = () => {
    signOut(auth).finally(() => {
      setStaffAuthUser(null);
      setStaffDocRaw(null);
      onExit();
    });
  };

  // Real customers/orders/items — organization-wide Firestore listeners,
  // gated on a validated staff session above. Replaces the old
  // subscribeToOrders/subscribeToCustomers mock subscriptions entirely
  // (not merged with them) — Operations now shows real business data, the
  // same "swap, not merge" call CustomerPortal.tsx already made for its
  // own order history. tier/group come back from Firestore as schema ids
  // ("t4"/"g3"); LOYALTY_TIERS/CUSTOMER_GROUPS (the local mock constants,
  // reused purely as a static id->name lookup table) translate them to
  // display names, exactly the same trick CustomerPortal.tsx already uses.
  useEffect(() => {
    if (!staffAuthUser) {
      setOrders([]);
      setCustomers([]);
      setFsOrderDocs({});
      setFsItemDocs({});
      return;
    }
    const unsubCustomers = onSnapshot(collection(db, 'customers'), snap => {
      const list: Customer[] = snap.docs.map(d => {
        const raw: any = d.data();
        return {
          id: d.id,
          firstName: raw.firstName || '',
          lastName: raw.lastName || '',
          name: raw.name || '',
          email: raw.email || '',
          phone: raw.phone || '',
          segment: raw.segment,
          group: CUSTOMER_GROUPS.find(g => g.id === raw.group)?.name ?? raw.group,
          lastOrder: raw.lastOrder,
          ltv: raw.ltv ?? 0,
          points: raw.points ?? 0,
          storeCredit: raw.storeCredit ?? 0,
          tier: LOYALTY_TIERS.find(t => t.id === raw.tier)?.name ?? raw.tier,
          birthday: raw.birthday,
          avatar: raw.avatar || `https://picsum.photos/seed/${d.id}/100/100`,
          referenceCode: raw.referenceCode,
          gdprConsent: raw.gdprConsent,
          addresses: raw.addresses || [],
          dietaryPreferences: raw.dietaryPreferences,
        };
      });
      setCustomers(list);
    }, err => console.error('customers listener failed', err));

    const unsubOrders = onSnapshot(collection(db, 'orders'), snap => {
      const map: Record<string, any> = {};
      snap.forEach(d => { map[d.id] = d.data(); });
      setFsOrderDocs(map);
    }, err => console.error('orders listener failed', err));

    const unsubItems = onSnapshot(collectionGroup(db, 'items'), snap => {
      const grouped: Record<string, any[]> = {};
      snap.forEach(d => {
        const orderId = d.ref.parent.parent?.id;
        if (!orderId) return;
        if (!grouped[orderId]) grouped[orderId] = [];
        // _fsItemId carries the item's real Firestore document id (confirmCheckout
        // writes each item via .doc() with an auto-generated id -- the item's own
        // "itemId" field is just which dish/curry it is, not a unique row id).
        // Mark Delivered/Mark Paid need this to build a doc() reference back to
        // the exact item to update -- without it there's no way to write back.
        grouped[orderId].push({ ...d.data(), _fsItemId: d.id });
      });
      setFsItemDocs(grouped);
    }, err => console.error('order items listener failed', err));

    return () => { unsubCustomers(); unsubOrders(); unsubItems(); };
  }, [staffAuthUser]);

  // Reshapes the two raw listeners above into Order[] -- every downstream
  // memo (lines, dishesByDay, drops, paymentDrops) only ever needed this
  // shape, so nothing else in this file has to change. Kept as a separate
  // memo + bridging effect (rather than computing orders directly) so the
  // orders/items listeners can update independently without racing each
  // other -- same decoupling CustomerPortal.tsx's firestoreOrders uses.
  const fsOrders: Order[] = useMemo(() => {
    return Object.keys(fsOrderDocs).map(orderId => {
      const o = fsOrderDocs[orderId] || {};
      const rawItems: any[] = fsItemDocs[orderId] || [];
      // _fsItemId (extending OrderItem, not part of it) rides along through
      // this reshape so Mark Delivered/Mark Paid -- built on drop.items,
      // which are these exact objects, see the `drops`/`paymentDrops` memos
      // below -- can build a real doc() reference back to Firestore.
      const items: FsOrderItem[] = rawItems.map(it => ({
        itemId: it.itemId,
        name: it.name,
        qty: it.qty,
        price: it.price,
        notes: it.notes,
        deliveryDate: it.deliveryDate,
        deliveryDay: it.deliveryDay,
        serviceSlot: it.serviceSlot,
        paymentStatus: it.paymentStatus,
        status: it.status,
        paymentMethodName: it.paymentMethodName,
        paymentReference: it.paymentReference,
        isReconciled: it.isReconciled,
        _fsItemId: it._fsItemId,
        rating: it.rating,
        ratingComment: it.ratingComment,
      }));
      const allPaid = items.length > 0 && items.every(i => i.paymentStatus === 'Paid');
      const createdAtIso = o.createdAt && typeof o.createdAt.toDate === 'function'
        ? o.createdAt.toDate().toISOString()
        : new Date().toISOString();
      return {
        id: orderId,
        customerName: o.customerName || '',
        type: o.type || 'Meal Plan',
        status: allPaid ? 'Completed' : 'Pending',
        paymentStatus: allPaid ? 'Paid' : 'Pending',
        tenderType: o.tenderType,
        paymentMethodName: o.paymentMethodName,
        paymentScheme: o.paymentScheme,
        items,
        total: o.total ?? 0,
        timestamp: createdAtIso,
        discount: o.discount,
        discountReason: o.discountReason,
      } as Order;
    });
  }, [fsOrderDocs, fsItemDocs]);

  useEffect(() => {
    setOrders(fsOrders);
  }, [fsOrders]);

  useEffect(() => {
    const u3 = subscribeToPaymentMethods(setPaymentMethods);
    const u4 = subscribeToSystemDate(setSystemDate);
    const u5 = subscribeToLunchMenu(() => setMenuTick(t => t + 1));
    const u6 = subscribeToConfig(() => {
      setVatEnabledLocal(SYSTEM_CONFIG.vatEnabled);
      setVatRateInput(String(SYSTEM_CONFIG.vatRate));
      setVatNumberInput(SYSTEM_CONFIG.vatNumber);
      setBulkDiscountEnabled(SYSTEM_CONFIG.bulkDiscountEnabled);
      setBulkDiscountRateInput(String(SYSTEM_CONFIG.bulkDiscountRate));
      setBrandForm({
        name: SYSTEM_CONFIG.businessName,
        tagline: SYSTEM_CONFIG.businessTagline,
        logoUrl: SYSTEM_CONFIG.businessLogoUrl,
        supportPhone: SYSTEM_CONFIG.supportPhone,
        supportEmail: SYSTEM_CONFIG.supportEmail
      });
      setDinnerEnabledLocal(SYSTEM_CONFIG.dinnerEnabled);
      setDeliveryForm({
        lunchOrderCutoffTime: SYSTEM_CONFIG.lunchOrderCutoffTime,
        lunchOrderCutoffDayOffset: String(SYSTEM_CONFIG.lunchOrderCutoffDayOffset),
        lunchCancelCutoffTime: SYSTEM_CONFIG.lunchCancelCutoffTime,
        lunchCancelCutoffDayOffset: String(SYSTEM_CONFIG.lunchCancelCutoffDayOffset),
        dinnerOrderCutoffTime: SYSTEM_CONFIG.dinnerOrderCutoffTime,
        dinnerOrderCutoffDayOffset: String(SYSTEM_CONFIG.dinnerOrderCutoffDayOffset),
        dinnerCancelCutoffTime: SYSTEM_CONFIG.dinnerCancelCutoffTime,
        dinnerCancelCutoffDayOffset: String(SYSTEM_CONFIG.dinnerCancelCutoffDayOffset),
        lunchDeliveryWindow: SYSTEM_CONFIG.lunchDeliveryWindow,
        dinnerDeliveryWindow: SYSTEM_CONFIG.dinnerDeliveryWindow
      });
    });
    const u7 = subscribeToDinnerMenu(() => setMenuTick(t => t + 1));
    const u8 = subscribeToBases(setBases);
    const u9 = subscribeToDhals(setDhals);
    const u10 = subscribeToSalads(setSalads);
    const u11 = subscribeToBeverages(setBeverages);
    const u12 = subscribeToDesserts(setDesserts);
    const u13 = subscribeToMainDishes(setMainDishes);
    const u14 = subscribeToIconLibrary(setIcons);
    const u15 = subscribeToLoyaltyTiers(setLoyaltyTiers);
    const u16 = subscribeToCustomerGroups(setCustomerGroups);
    return () => { u3(); u4(); u5(); u6(); u7(); u8(); u9(); u10(); u11(); u12(); u13(); u14(); u15(); u16(); };
  }, []);

  const toggleVat = (next: boolean) => setVatEnabledLocal(next);
  const toggleDinner = (next: boolean) => setDinnerEnabledLocal(next);

  const isSettingsDirty = useMemo(() => {
    return (
      brandForm.name !== SYSTEM_CONFIG.businessName ||
      brandForm.tagline !== SYSTEM_CONFIG.businessTagline ||
      brandForm.logoUrl !== SYSTEM_CONFIG.businessLogoUrl ||
      brandForm.supportPhone !== SYSTEM_CONFIG.supportPhone ||
      brandForm.supportEmail !== SYSTEM_CONFIG.supportEmail ||
      deliveryForm.lunchOrderCutoffTime !== SYSTEM_CONFIG.lunchOrderCutoffTime ||
      Number(deliveryForm.lunchOrderCutoffDayOffset) !== SYSTEM_CONFIG.lunchOrderCutoffDayOffset ||
      deliveryForm.lunchCancelCutoffTime !== SYSTEM_CONFIG.lunchCancelCutoffTime ||
      Number(deliveryForm.lunchCancelCutoffDayOffset) !== SYSTEM_CONFIG.lunchCancelCutoffDayOffset ||
      deliveryForm.dinnerOrderCutoffTime !== SYSTEM_CONFIG.dinnerOrderCutoffTime ||
      Number(deliveryForm.dinnerOrderCutoffDayOffset) !== SYSTEM_CONFIG.dinnerOrderCutoffDayOffset ||
      deliveryForm.dinnerCancelCutoffTime !== SYSTEM_CONFIG.dinnerCancelCutoffTime ||
      Number(deliveryForm.dinnerCancelCutoffDayOffset) !== SYSTEM_CONFIG.dinnerCancelCutoffDayOffset ||
      deliveryForm.lunchDeliveryWindow !== SYSTEM_CONFIG.lunchDeliveryWindow ||
      deliveryForm.dinnerDeliveryWindow !== SYSTEM_CONFIG.dinnerDeliveryWindow ||
      vatEnabled !== SYSTEM_CONFIG.vatEnabled ||
      vatRateInput !== String(SYSTEM_CONFIG.vatRate) ||
      vatNumberInput !== SYSTEM_CONFIG.vatNumber ||
      dinnerEnabled !== SYSTEM_CONFIG.dinnerEnabled ||
      bulkDiscountEnabled !== SYSTEM_CONFIG.bulkDiscountEnabled ||
      bulkDiscountRateInput !== String(SYSTEM_CONFIG.bulkDiscountRate)
    );
  }, [brandForm, deliveryForm, vatEnabled, vatRateInput, vatNumberInput, dinnerEnabled, bulkDiscountEnabled, bulkDiscountRateInput]);

  const saveAllSettings = () => {
    const parsedRate = parseFloat(vatRateInput);
    const parsedBulkRate = parseFloat(bulkDiscountRateInput);
    const parsedLunchOrderOffset = parseInt(deliveryForm.lunchOrderCutoffDayOffset, 10);
    const parsedLunchCancelOffset = parseInt(deliveryForm.lunchCancelCutoffDayOffset, 10);
    const parsedDinnerOrderOffset = parseInt(deliveryForm.dinnerOrderCutoffDayOffset, 10);
    const parsedDinnerCancelOffset = parseInt(deliveryForm.dinnerCancelCutoffDayOffset, 10);
    runMenuWrite(updateSystemConfig({
      businessName: brandForm.name.trim() || SYSTEM_CONFIG.businessName,
      businessTagline: brandForm.tagline.trim(),
      businessLogoUrl: brandForm.logoUrl.trim(),
      supportPhone: brandForm.supportPhone.trim() || SYSTEM_CONFIG.supportPhone,
      supportEmail: brandForm.supportEmail.trim() || SYSTEM_CONFIG.supportEmail,
      
      // Legacy unified fallbacks to prevent breaking old codebase references:
      cutoffTime: deliveryForm.lunchOrderCutoffTime,
      cutoffDayOffset: isNaN(parsedLunchOrderOffset) ? SYSTEM_CONFIG.lunchOrderCutoffDayOffset : parsedLunchOrderOffset,
      orderCutoffTime: deliveryForm.lunchOrderCutoffTime,
      orderCutoffDayOffset: isNaN(parsedLunchOrderOffset) ? SYSTEM_CONFIG.lunchOrderCutoffDayOffset : parsedLunchOrderOffset,
      cancelCutoffTime: deliveryForm.lunchCancelCutoffTime,
      cancelCutoffDayOffset: isNaN(parsedLunchCancelOffset) ? SYSTEM_CONFIG.lunchCancelCutoffDayOffset : parsedLunchCancelOffset,

      // Lunch Service Cutoffs
      lunchOrderCutoffTime: deliveryForm.lunchOrderCutoffTime || SYSTEM_CONFIG.lunchOrderCutoffTime,
      lunchOrderCutoffDayOffset: isNaN(parsedLunchOrderOffset) ? SYSTEM_CONFIG.lunchOrderCutoffDayOffset : parsedLunchOrderOffset,
      lunchCancelCutoffTime: deliveryForm.lunchCancelCutoffTime || SYSTEM_CONFIG.lunchCancelCutoffTime,
      lunchCancelCutoffDayOffset: isNaN(parsedLunchCancelOffset) ? SYSTEM_CONFIG.lunchCancelCutoffDayOffset : parsedLunchCancelOffset,

      // Dinner Service Cutoffs
      dinnerOrderCutoffTime: deliveryForm.dinnerOrderCutoffTime || SYSTEM_CONFIG.dinnerOrderCutoffTime,
      dinnerOrderCutoffDayOffset: isNaN(parsedDinnerOrderOffset) ? SYSTEM_CONFIG.dinnerOrderCutoffDayOffset : parsedDinnerOrderOffset,
      dinnerCancelCutoffTime: deliveryForm.dinnerCancelCutoffTime || SYSTEM_CONFIG.dinnerCancelCutoffTime,
      dinnerCancelCutoffDayOffset: isNaN(parsedDinnerCancelOffset) ? SYSTEM_CONFIG.dinnerCancelCutoffDayOffset : parsedDinnerCancelOffset,

      lunchDeliveryWindow: deliveryForm.lunchDeliveryWindow.trim() || SYSTEM_CONFIG.lunchDeliveryWindow,
      dinnerDeliveryWindow: deliveryForm.dinnerDeliveryWindow.trim() || SYSTEM_CONFIG.dinnerDeliveryWindow,
      vatEnabled: vatEnabled,
      vatRate: isNaN(parsedRate) ? SYSTEM_CONFIG.vatRate : parsedRate,
      vatNumber: vatNumberInput.trim(),
      dinnerEnabled: dinnerEnabled,
      bulkDiscountEnabled: bulkDiscountEnabled,
      bulkDiscountRate: isNaN(parsedBulkRate) ? SYSTEM_CONFIG.bulkDiscountRate : parsedBulkRate
    }));
  };

  const discardSettings = () => {
    setBrandForm({
      name: SYSTEM_CONFIG.businessName,
      tagline: SYSTEM_CONFIG.businessTagline,
      logoUrl: SYSTEM_CONFIG.businessLogoUrl,
      supportPhone: SYSTEM_CONFIG.supportPhone,
      supportEmail: SYSTEM_CONFIG.supportEmail
    });
    setDeliveryForm({
      lunchOrderCutoffTime: SYSTEM_CONFIG.lunchOrderCutoffTime,
      lunchOrderCutoffDayOffset: String(SYSTEM_CONFIG.lunchOrderCutoffDayOffset),
      lunchCancelCutoffTime: SYSTEM_CONFIG.lunchCancelCutoffTime,
      lunchCancelCutoffDayOffset: String(SYSTEM_CONFIG.lunchCancelCutoffDayOffset),
      dinnerOrderCutoffTime: SYSTEM_CONFIG.dinnerOrderCutoffTime,
      dinnerOrderCutoffDayOffset: String(SYSTEM_CONFIG.dinnerOrderCutoffDayOffset),
      dinnerCancelCutoffTime: SYSTEM_CONFIG.dinnerCancelCutoffTime,
      dinnerCancelCutoffDayOffset: String(SYSTEM_CONFIG.dinnerCancelCutoffDayOffset),
      lunchDeliveryWindow: SYSTEM_CONFIG.lunchDeliveryWindow,
      dinnerDeliveryWindow: SYSTEM_CONFIG.dinnerDeliveryWindow
    });
    setVatEnabledLocal(SYSTEM_CONFIG.vatEnabled);
    setVatRateInput(String(SYSTEM_CONFIG.vatRate));
    setVatNumberInput(SYSTEM_CONFIG.vatNumber);
    setDinnerEnabledLocal(SYSTEM_CONFIG.dinnerEnabled);
    setBulkDiscountEnabled(SYSTEM_CONFIG.bulkDiscountEnabled);
    setBulkDiscountRateInput(String(SYSTEM_CONFIG.bulkDiscountRate));
  };
  const openEditCustomer = (c: Customer) => {
    setEditCustomer(c);
    setEditCustFirstName(c.firstName || '');
    setEditCustLastName(c.lastName || '');
    setEditCustEmail(c.email || '');
    setEditCustBirthday(c.birthday || '');
    setEditCustPhone(c.phone || '');
    setEditCustTier(c.tier || 'Bronze');
    const matchedGroup = customerGroups.find(g => g.id === c.group || g.name === c.group);
    setEditCustGroup(matchedGroup ? matchedGroup.id : '');
    const primaryAddr = c.addresses?.[0];
    setEditCustStreet(primaryAddr?.street || '');
    setEditCustCity(primaryAddr?.city || '');
  };

  const handleSaveCustomer = async () => {
    if (!editCustomer) return;
    try {
      const docRef = doc(db, 'customers', editCustomer.id);
      
      const existingAddresses = editCustomer.addresses || [];
      const updatedAddresses = [...existingAddresses];
      if (updatedAddresses.length > 0) {
        updatedAddresses[0] = {
          ...updatedAddresses[0],
          street: editCustStreet.trim(),
          city: editCustCity.trim(),
        };
      } else if (editCustStreet.trim() || editCustCity.trim()) {
        updatedAddresses.push({
          id: `ADDR-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
          label: 'Delivery',
          street: editCustStreet.trim(),
          city: editCustCity.trim(),
          zip: '',
          country: 'Mauritius',
        });
      }

      const firstName = editCustFirstName.trim();
      const lastName = editCustLastName.trim();
      const name = `${firstName} ${lastName}`.trim();
      const email = editCustEmail.trim();
      const birthday = editCustBirthday.trim();
      const group = editCustGroup;

      await updateDoc(docRef, {
        firstName,
        lastName,
        name,
        email,
        birthday,
        phone: editCustPhone.trim(),
        tier: editCustTier,
        group,
        addresses: updatedAddresses,
      });

      updateCustomerRecord(editCustomer.id, {
        firstName,
        lastName,
        name,
        email,
        birthday,
        phone: editCustPhone.trim(),
        tier: editCustTier,
        group: customerGroups.find(g => g.id === editCustGroup)?.name || '',
        addresses: updatedAddresses,
      });

      setEditCustomer(null);
    } catch (err) {
      console.error('Failed to update customer', err);
      alert('Failed to update customer. Please try again.');
    }
  };
  // Logo upload — there's no backend/file storage in this app, so the
  // chosen image is read into a base64 data URL and stored directly as
  // businessLogoUrl, same as if a URL had been pasted in. Kept under 1.5MB
  // so it doesn't bloat the saved app state.
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const [logoError, setLogoError] = useState('');
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setLogoError('Please choose an image file.');
      return;
    }
    if (file.size > 1_500_000) {
      setLogoError("That image is over 1.5MB — pick a smaller file.");
      return;
    }
    setLogoError('');
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setBrandForm(f => ({ ...f, logoUrl: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const weekDays = useMemo(() => getThisWeekDays(systemDate), [systemDate]);
  // Only used by the Menu tab's "Next week" editor — Orders by Dish,
  // Delivery, and Payments deliberately stay scoped to weekDays (the
  // operationally-current week); an order placed for next week simply won't
  // show up there until that week actually arrives, which is correct for a
  // kitchen-prep tool.
  const nextWeekDays = useMemo(() => getThisWeekDays(addDays(systemDate, 7)), [systemDate]);
  // Admin-only planning headroom, one week beyond "Next" — see the WeekChoice
  // comment above for why this never touches the Customer App.
  const week2Days = useMemo(() => getThisWeekDays(addDays(systemDate, 14)), [systemDate]);
  // Second week of admin planning headroom (Week+3) — total 4 weeks of menus visible in console.
  const week3Days = useMemo(() => getThisWeekDays(addDays(systemDate, 21)), [systemDate]);
  // Which week the Menu tab is currently showing, resolved from
  // activeMenuWeek — hoisted to component scope (not just inside
  // renderMenuTab) so the CSV import handler can target the same week the
  // admin is currently looking at.
  const activeMenuDays = 
    activeMenuWeek === 'Next' ? nextWeekDays :
    activeMenuWeek === 'Week+2' ? week2Days :
    activeMenuWeek === 'Week+3' ? week3Days :
    weekDays;
  const activeMenuWeekStart = activeMenuDays[0].date;
  const weekDateKeys = useMemo(() => new Set(weekDays.map(d => d.date)), [weekDays]);
  const todayKey = useMemo(() => weekDays.find(d => d.date === systemDate)?.key ?? null, [weekDays, systemDate]);
  const activeDeliveryDay = deliveryDayOverride ?? todayKey ?? weekDays[0].key;

  // Non-cancelled order lines, flattened for aggregation across tabs.
  const lines = useMemo(() => {
    const out: { order: Order; item: OrderItem }[] = [];
    orders.forEach(o => {
      o.items.forEach(item => {
        if (item.status === 'Cancelled') return;
        out.push({ order: o, item });
      });
    });
    return out;
  }, [orders]);

  // --- Orders by Dish — scoped to the current week only. This tab answers
  // "what do I need to cook," not "show me every order ever placed"; without
  // this scope it would silently accumulate every past and future week's
  // orders into one undifferentiated list. Tracks a representative itemId
  // per dish so the row can show a real photo, not just a name.
  // Keyed by service + name (not just name) — Lunch and Dinner can each have
  // a dish that happens to share a name, and they're cooked/delivered as
  // separate batches, so they must never be summed together here.
  const allOrdersDays = useMemo(() => [...weekDays, ...nextWeekDays], [weekDays, nextWeekDays]);
  const allOrdersDateKeys = useMemo(() => new Set(allOrdersDays.map(d => d.date)), [allOrdersDays]);

  const dishesByDay = useMemo(() => {
    const days: Record<string, Record<string, {
      qty: number;
      revenue: number;
      itemId: string;
      name: string;
      service: Service;
      requests: { qty: number; person: string | null; instructions: string | null }[];
    }>> = {};
    lines.forEach(({ item }) => {
      const day = item.deliveryDate || '';
      if (!allOrdersDateKeys.has(day)) return;
      const service: Service = (item.serviceSlot || '').startsWith('Dinner') ? 'Dinner' : 'Lunch';
      const key = `${service}::${item.name}`;
      if (!days[day]) days[day] = {};
      if (!days[day][key]) {
        days[day][key] = { qty: 0, revenue: 0, itemId: item.itemId, name: item.name, service, requests: [] };
      }
      days[day][key].qty += item.qty;
      days[day][key].revenue += item.qty * item.price;

      const { person, instructions } = splitNotesTag(item.notes);
      if (person || instructions) {
        days[day][key].requests.push({
          qty: item.qty,
          person,
          instructions
        });
      }
    });
    return days;
  }, [lines, allOrdersDateKeys]);

  // Active days for the orders tab, based on the week filter
  const ordersDaysForWeek = useMemo(() => ordersWeekFilter === 'next' ? nextWeekDays : weekDays, [ordersWeekFilter, weekDays, nextWeekDays]);

  // Day cards to render in orders tab: filtered by day if a specific day is chosen
  const ordersVisibleDays = useMemo(() => {
    const source = ordersWeekFilter === 'next' ? nextWeekDays : weekDays;
    const ordered = ordersWeekFilter === 'this'
      ? [source.find(d => d.key === todayKey), ...source.filter(d => d.key !== todayKey)].filter(Boolean) as typeof weekDays
      : source;
    if (ordersDayFilter === 'all') return ordered;
    return ordered.filter(d => d.date === ordersDayFilter);
  }, [ordersWeekFilter, weekDays, nextWeekDays, todayKey, ordersDayFilter]);

  // Today's card leads the list — the most operationally urgent day belongs
  // first, not buried in Monday-to-Friday order.
  const orderedWeekDays = useMemo(() => {
    const idx = weekDays.findIndex(d => d.key === todayKey);
    if (idx <= 0) return weekDays;
    return [weekDays[idx], ...weekDays.filter((_, i) => i !== idx)];
  }, [weekDays, todayKey]);

  // --- Delivery List (one card per order/day/slot "drop"). Every order the
  // Customer App creates is type 'Meal Plan' — the non-meal-plan branch this
  // used to have (for Dine-In/Takeout/Delivery orders) was leftover from the
  // RMS scaffold and could never actually be hit, since nothing in this app
  // creates that shape of order anymore. Also scoped to the current week —
  // Delivery is a daily concern, not a backlog of every future week's order.
  const drops = useMemo(() => {
    const map: Record<string, DropTask> = {};
    orders.forEach(o => {
      if (o.type !== 'Meal Plan') return;
      o.items.forEach(item => {
        if (item.status === 'Cancelled' || item.status === 'Completed') return;
        const date = item.deliveryDate || '';
        if (!allOrdersDateKeys.has(date)) return;  // covers both weeks
        const key = `${o.id}-${date}-${item.serviceSlot || ''}`;
        if (!map[key]) {
          map[key] = { key, orderId: o.id, customerName: o.customerName, date, slot: item.serviceSlot, items: [], total: 0, paymentStatus: 'Paid' };
        }
        map[key].items.push(item);
        map[key].total += item.qty * item.price;
        if (item.paymentStatus === 'Pending') map[key].paymentStatus = 'Pending';
      });
    });
    return Object.values(map).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }, [orders, allOrdersDateKeys]);

  // Delivery List active day — follows the selected week's days
  const deliveryDaysForWeek = useMemo(() => deliveryWeekFilter === 'next' ? nextWeekDays : weekDays, [deliveryWeekFilter, weekDays, nextWeekDays]);
  const activeDeliveryDayDate = useMemo(() => {
    // When switching weeks, try to keep the same weekday key; fall back to today (this week) or Mon (next week)
    const targetDay = deliveryDayOverride ?? todayKey;
    return deliveryDaysForWeek.find(d => d.key === targetDay)?.date ?? deliveryDaysForWeek[0]?.date;
  }, [deliveryDaysForWeek, deliveryDayOverride, todayKey]);

  const filteredDrops = useMemo(() => {
    let result = drops.filter(d => d.date === activeDeliveryDayDate);
    if (deliveryServiceFilter !== 'all') {
      result = result.filter(d => {
        const service = (d.slot || '').startsWith('Dinner') ? 'Dinner' : 'Lunch';
        return service === deliveryServiceFilter;
      });
    }
    return result;
  }, [drops, activeDeliveryDayDate, deliveryServiceFilter]);

  // --- Payments: every open balance regardless of delivery date — an unpaid
  // meal from three days ago is still owed, so unlike Orders/Delivery this
  // intentionally isn't scoped to the current week. Same dead-branch removal
  // as drops above.
  const paymentDrops = useMemo(() => {
    const map: Record<string, DropTask> = {};
    orders.forEach(o => {
      if (o.type !== 'Meal Plan') return;
      o.items.forEach(item => {
        if (item.status === 'Cancelled') return;
        const key = `${o.id}-${item.deliveryDate || ''}-${item.serviceSlot || ''}`;
        if (!map[key]) {
          map[key] = { key, orderId: o.id, customerName: o.customerName, date: item.deliveryDate, slot: item.serviceSlot, items: [], total: 0, paymentStatus: 'Paid' };
        }
        map[key].items.push(item);
        map[key].total += item.qty * item.price;
        if (item.paymentStatus === 'Pending') map[key].paymentStatus = 'Pending';
        if (item.paymentStatus !== 'Paid' && item.paymentMethodName && !map[key].claimedMethod) {
          map[key].claimedMethod = item.paymentMethodName;
          map[key].claimedReference = item.paymentReference;
        }
      });
    });
    return Object.values(map);
  }, [orders]);

  // Unpaid grouped by delivery date, oldest (most overdue) first — grouping
  // by date is what actually makes the claimed-reference feature useful: you
  // can scan down a date-ordered list and match it against a bank statement
  // in the same order the statement lists transactions.
  const unpaidByDate = useMemo(() => {
    const map: Record<string, DropTask[]> = {};
    paymentDrops.filter(d => d.paymentStatus === 'Pending').forEach(d => {
      const key = d.date || 'Unscheduled';
      if (!map[key]) map[key] = [];
      map[key].push(d);
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [paymentDrops]);

  const paidDrops = useMemo(() => paymentDrops.filter(d => d.paymentStatus === 'Paid'), [paymentDrops]);

  const paymentSummary = useMemo(() => {
    let collected = 0, outstanding = 0;
    lines.forEach(({ item }) => {
      const amt = item.qty * item.price;
      if (item.paymentStatus === 'Paid') collected += amt; else outstanding += amt;
    });
    return { collected, outstanding };
  }, [lines]);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(c => 
      (c.name || '').toLowerCase().includes(q) ||
      (c.tier || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.addresses || []).some(a => 
        (a.street || '').toLowerCase().includes(q) ||
        (a.city || '').toLowerCase().includes(q)
      )
    );
  }, [customers, customerSearch]);

  const getCustomer = (name: string) => customers.find(c => c.name === name);

  // Real write, 2026-08-13 — previously called the mock updateOrderItemStatus,
  // which only mutated the local ACTIVE_ORDERS array and would always
  // silently fail against Firestore-sourced orders (see the disabled-button
  // round earlier this session). drop.items are the exact FsOrderItem
  // objects carried through from the fsOrders memo above, so _fsItemId is
  // the real orders/{orderId}/items/{itemId} document id to write to.
  // firestore.rules' manageOrders rule allows staff to change status/
  // paymentStatus freely as long as price/qty/name/customerId don't move —
  // a batch of plain client updates is enough here, no Cloud Function
  // needed (unlike checkout, nothing about "was this delivered" needs
  // server-computed integrity).
  const handleMarkDelivered = async (drop: DropTask) => {
    const targets = drop.items.filter(i => !!i._fsItemId);
    if (targets.length === 0) {
      setOpsActionError('Could not mark this delivered — no Firestore item ids found on this order. Try refreshing.');
      return;
    }
    setOpsActionError(null);
    setPendingDeliveryKey(drop.key);
    try {
      const batch = writeBatch(db);
      targets.forEach(i => {
        batch.update(doc(db, 'orders', drop.orderId, 'items', i._fsItemId as string), { status: 'Completed' });
      });
      await batch.commit();
    } catch (e) {
      console.error('Mark Delivered failed', e);
      setOpsActionError('Mark Delivered failed — please try again.');
    } finally {
      setPendingDeliveryKey(null);
    }
  };

  const handleStartCooking = async (dateStr: string, serviceSlot: 'Lunch' | 'Dinner') => {
    const targets: { orderId: string; itemId: string }[] = [];
    lines.forEach(({ order, item }) => {
      if (item.deliveryDate === dateStr) {
        const itemService = (item.serviceSlot || '').startsWith('Dinner') ? 'Dinner' : 'Lunch';
        if (itemService === serviceSlot && (item.status === 'Active' || !item.status) && item._fsItemId) {
          targets.push({ orderId: order.id, itemId: item._fsItemId });
        }
      }
    });

    if (targets.length === 0) return;

    const key = `${dateStr}::${serviceSlot}`;
    setOpsActionError(null);
    setPendingCookingKey(key);
    try {
      const batch = writeBatch(db);
      targets.forEach(t => {
        batch.update(doc(db, 'orders', t.orderId, 'items', t.itemId), { status: 'Preparing' });
      });
      await batch.commit();
    } catch (e) {
      console.error('Start Cooking failed', e);
      setOpsActionError('Start Cooking failed — please try again.');
    } finally {
      setPendingCookingKey(null);
    }
  };

  const handleDispatchDrop = async (drop: DropTask) => {
    const targets = drop.items.filter(i => !!i._fsItemId && (i.status === 'Active' || i.status === 'Preparing' || !i.status));
    if (targets.length === 0) {
      setOpsActionError('Could not dispatch — no eligible items found to dispatch. Try refreshing.');
      return;
    }
    setOpsActionError(null);
    setPendingDispatchKey(drop.key);
    try {
      const batch = writeBatch(db);
      targets.forEach(i => {
        batch.update(doc(db, 'orders', drop.orderId, 'items', i._fsItemId as string), { status: 'En route' });
      });
      await batch.commit();
    } catch (e) {
      console.error('Dispatch failed', e);
      setOpsActionError('Dispatch failed — please try again.');
    } finally {
      setPendingDispatchKey(null);
    }
  };

  // Real write, 2026-08-13 — same reasoning as handleMarkDelivered above.
  // The mock's updateOrderItemsPayment also recomputed and wrote the PARENT
  // order's paymentStatus (an "all items paid?" rollup) — that write has no
  // real equivalent here, since firestore.rules blocks any direct update to
  // orders/{orderId} (Cloud-Function-only, see confirmCheckout). It isn't
  // needed anyway: the fsOrders memo above already derives an Order's
  // status/paymentStatus live from its items every time the items listener
  // fires, so once these item writes land, the derived order flips to Paid
  // on its own.
  const markPaid = async (drop: DropTask, method: PaymentMethod) => {
    const targets = drop.items.filter(i => !!i._fsItemId);
    if (targets.length === 0) {
      setOpsActionError('Could not mark this paid — no Firestore item ids found on this order. Try refreshing.');
      setPaymentDrop(null);
      return;
    }
    setOpsActionError(null);
    setPendingPaymentKey(drop.key);
    try {
      const batch = writeBatch(db);
      targets.forEach(i => {
        batch.update(doc(db, 'orders', drop.orderId, 'items', i._fsItemId as string), {
          paymentStatus: 'Paid',
          paymentMethodName: method.name,
        });
      });
      await batch.commit();
    } catch (e) {
      console.error('Mark Paid failed', e);
      setOpsActionError('Mark Paid failed — please try again.');
    } finally {
      setPendingPaymentKey(null);
      setPaymentDrop(null);
    }
  };

  // --- Meal Library: Main add/edit/remove ---
  // mainDishes/bases/dhals/.../icons below (subscribeToMainDishes etc.,
  // wired in the useEffect further down) now come straight from Firestore
  // (mains/{mainId}, mealBases/current, etc. — see store.ts) rather than
  // the mock arrays these used to be. addMainDish/updateMainDish/
  // removeMainDish are real Firestore writes now; the one-time migration
  // that used to auto-seed the Library from the mock Menu Planner
  // (migrateMenuToLibrary) has been removed from store.ts entirely, since
  // Firestore is already correctly seeded (scripts/migrateMenuLibrary.js).

  const startAddMain = () => {
    setMainEditor({ mode: 'add' });
    setMainPhotoError('');
    setMainForm({
      emoji: '🍽️', name: '', desc: '', price: '', cost: '', photoUrl: '',
      baseApplicable: true, baseOptionIds: null,
      dhalApplicable: true, dhalOptionIds: null,
      saladApplicable: true, saladOptionIds: null,
      beverageApplicable: true, beverageOptionIds: null,
      dessertApplicable: true, dessertOptionIds: null
    });
  };

  const startEditMain = (main: MainDish) => {
    setMainEditor({ mode: 'edit', mainId: main.id });
    setMainPhotoError('');
    setMainForm({
      emoji: main.emoji, name: main.name, desc: main.desc, price: String(main.price), cost: main.cost !== undefined ? String(main.cost) : '', photoUrl: main.photoUrl || '',
      baseApplicable: dishBaseApplicable(main), baseOptionIds: dishBaseOptionIds(main, bases) ?? null,
      dhalApplicable: dishDhalApplicable(main), dhalOptionIds: main.dhalOptionIds ?? null,
      saladApplicable: dishSaladApplicable(main), saladOptionIds: main.saladOptionIds ?? null,
      beverageApplicable: dishBeverageApplicable(main), beverageOptionIds: main.beverageOptionIds ?? null,
      dessertApplicable: dishDessertApplicable(main), dessertOptionIds: main.dessertOptionIds ?? null
    });
  };

  const cancelMainEditor = () => setMainEditor(null);

  // Mirrors handleLogoFileChange's pattern (Settings → Brand Identity) —
  // read into a base64 data URL and store it directly, no backend/file
  // storage to upload to. dishPhotoFor() prefers this over the built-in
  // protein-family guess whenever it's set.
  const handleMainPhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setMainPhotoError('Please choose an image file.'); return; }
    if (file.size > 1_500_000) { setMainPhotoError('That image is over 1.5MB — pick a smaller file.'); return; }
    setMainPhotoError('');
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setMainForm(f => ({ ...f, photoUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  // Toggles one catalog entry's membership in a *OptionIds field. Starts
  // from "every entry" when the field is currently null (no restriction),
  // then normalizes back to null if every entry ends up checked again —
  // so the common case (a Main that offers everything in a category) never
  // accumulates a redundant "all of them, explicitly" array. Covers Base
  // now too (baseOptionIds), following the exact same applicable+narrow
  // pattern as Dhal/Salad/Beverage/Dessert.
  const toggleMainOption = (field: 'baseOptionIds' | 'dhalOptionIds' | 'saladOptionIds' | 'beverageOptionIds' | 'dessertOptionIds', allItems: AddOnOption[], id: string) => {
    setMainForm(f => {
      const current = f[field] ?? allItems.map(i => i.id);
      const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
      return { ...f, [field]: next.length === allItems.length ? null : next };
    });
  };

  const saveMainEditor = () => {
    if (!mainEditor) return;
    if (!mainForm.name.trim()) return;
    const parsedPrice = parseInt(mainForm.price, 10);
    const parsedCost = parseFloat(mainForm.cost);
    const patch: Partial<Omit<MainDish, 'id'>> = {
      emoji: mainForm.emoji.trim() || '🍽️',
      name: mainForm.name.trim(),
      desc: mainForm.desc.trim(),
      price: isNaN(parsedPrice) ? 0 : parsedPrice,
      cost: mainForm.cost.trim() === '' || isNaN(parsedCost) ? undefined : parsedCost,
      photoUrl: mainForm.photoUrl.trim() || undefined,
      baseApplicable: mainForm.baseApplicable,
      baseOptionIds: mainForm.baseOptionIds ?? undefined,
      dhalApplicable: mainForm.dhalApplicable,
      dhalOptionIds: mainForm.dhalOptionIds ?? undefined,
      saladApplicable: mainForm.saladApplicable,
      saladOptionIds: mainForm.saladOptionIds ?? undefined,
      beverageApplicable: mainForm.beverageApplicable,
      beverageOptionIds: mainForm.beverageOptionIds ?? undefined,
      dessertApplicable: mainForm.dessertApplicable,
      dessertOptionIds: mainForm.dessertOptionIds ?? undefined
    };
    if (mainEditor.mode === 'add') {
      runMenuWrite(addMainDish({
        id: `main-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        ...patch
      } as MainDish));
    } else if (mainEditor.mainId) {
      runMenuWrite(updateMainDish(mainEditor.mainId, patch));
    }
    setMainEditor(null);
  };

  // --- Menu Planner: pick a Main into a day, remove a day-slot dish, edit a
  // day-slot dish's name/desc/price ---

  const openMainPicker = (day: WeekdayKey, service: Service, weekStart: string) => {
    setMainPickerFor({ day, service, weekStart });
    setMainPickerSearch('');
  };

  const cancelMainPicker = () => { setMainPickerFor(null); setMainPickerSearch(''); };

  const filteredMainPickerResults = useMemo(() => {
    const q = mainPickerSearch.trim().toLowerCase();
    if (!q) return mainDishes;
    return mainDishes.filter(m => m.name.toLowerCase().includes(q) || m.desc.toLowerCase().includes(q));
  }, [mainDishes, mainPickerSearch]);

  const pickMainForDay = (main: MainDish) => {
    if (!mainPickerFor) return;
    const add = mainPickerFor.service === 'Dinner' ? addDinnerDish : addLunchDish;
    const { cost, id, ...rest } = main;
    runMenuWrite(add(mainPickerFor.weekStart, mainPickerFor.day, {
      id: `dish-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      ...rest,
      // Library-sourced copies remember which Main they came from, for the
      // special-price comparison — cost is deliberately not copied down
      // (it's an admin-only Library concern, no day-slot field for it).
      mainId: id
    } as CurryOption));
    cancelMainPicker();
  };

  const handleRemoveDish = (day: WeekdayKey, service: Service, weekStart: string, dishId: string) => {
    const remove = service === 'Dinner' ? removeDinnerDish : removeLunchDish;
    runMenuWrite(remove(weekStart, day, dishId));
  };

  const startEditDaySlot = (day: WeekdayKey, service: Service, weekStart: string, dish: CurryOption) => {
    setEditingDaySlot({ day, curryId: dish.id, service, weekStart });
    setDaySlotEditForm({ name: dish.name, desc: dish.desc, price: String(dish.price) });
  };

  const cancelDaySlotEdit = () => setEditingDaySlot(null);

  const saveDaySlotEdit = () => {
    if (!editingDaySlot) return;
    const menu = editingDaySlot.service === 'Dinner' ? dinnerMenuForWeek(editingDaySlot.weekStart) : lunchMenuForWeek(editingDaySlot.weekStart);
    const update = editingDaySlot.service === 'Dinner' ? updateDinnerCurryOption : updateLunchCurryOption;
    const existing = menu[editingDaySlot.day].find(c => c.id === editingDaySlot.curryId);
    const parsedPrice = parseInt(daySlotEditForm.price, 10);
    const price = isNaN(parsedPrice) ? (existing?.price || 0) : parsedPrice;
    // A dish picked from the Meal Library keeps its name/desc locked to the
    // Main it was copied from — only price is ever editable here (that's
    // the whole point of a special price). Only a legacy day-slot dish with
    // no mainId (never picked through the Library) still allows editing its
    // own name/desc directly.
    runMenuWrite(update(editingDaySlot.weekStart, editingDaySlot.day, editingDaySlot.curryId,
      existing?.mainId
        ? { price }
        : { name: daySlotEditForm.name.trim() || existing?.name || '', desc: daySlotEditForm.desc.trim(), price }
    ));
    setEditingDaySlot(null);
  };

  // --- Add-on catalog management (Base / Dhal / Salad / Beverage / Dessert) ---

  const CATALOG_META: Record<CatalogKey, { label: string; items: AddOnOption[]; add: (i: AddOnOption) => Promise<void>; update: (id: string, u: Partial<AddOnOption>) => Promise<void>; remove: (id: string) => Promise<void>; hasGroup: boolean; hasPrice: boolean }> = {
    base: { label: 'Base', items: bases, add: addBaseOption, update: updateBaseOption, remove: removeBaseOption, hasGroup: false, hasPrice: true },
    dhal: { label: 'Dhal', items: dhals, add: addDhalOption, update: updateDhalOption, remove: removeDhalOption, hasGroup: false, hasPrice: true },
    salad: { label: 'Salad', items: salads, add: addSaladOption, update: updateSaladOption, remove: removeSaladOption, hasGroup: false, hasPrice: true },
    beverage: { label: 'Beverage', items: beverages, add: addBeverageOption, update: updateBeverageOption, remove: removeBeverageOption, hasGroup: false, hasPrice: true },
    dessert: { label: 'Dessert', items: desserts, add: addDessertOption, update: updateDessertOption, remove: removeDessertOption, hasGroup: false, hasPrice: true },
  };

  const startEditAddOn = (catalog: CatalogKey, item: AddOnOption) => {
    setEditingAddOn({ catalog, id: item.id });
    setAddOnForm({ emoji: item.emoji, name: item.name, price: String(item.price ?? item.up ?? 0), group: '' });
  };

  const saveAddOnEdit = () => {
    if (!editingAddOn) return;
    const meta = CATALOG_META[editingAddOn.catalog];
    const parsedPrice = parseFloat(addOnForm.price);
    const priceField = editingAddOn.catalog === 'base' ? 'up' : 'price';
    runMenuWrite(meta.update(editingAddOn.id, {
      emoji: addOnForm.emoji.trim() || '•',
      name: addOnForm.name.trim() || 'Untitled',
      [priceField]: isNaN(parsedPrice) ? 0 : parsedPrice,
    } as Partial<AddOnOption>));
    setEditingAddOn(null);
  };

  const saveNewAddOn = (catalog: CatalogKey) => {
    const draft = newAddOnForm[catalog];
    if (!draft.name.trim()) return;
    const meta = CATALOG_META[catalog];
    const parsedPrice = parseFloat(draft.price);
    const item: AddOnOption = {
      id: `${catalog}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      emoji: draft.emoji.trim() || '•',
      name: draft.name.trim(),
    };
    if (catalog === 'base') {
      item.up = isNaN(parsedPrice) ? 0 : parsedPrice;
    } else {
      item.price = isNaN(parsedPrice) ? 0 : parsedPrice;
    }
    runMenuWrite(meta.add(item));
    setNewAddOnForm(f => ({ ...f, [catalog]: { emoji: draft.emoji, name: '', price: catalog === 'dhal' || catalog === 'salad' ? '' : '0', group: '' } }));
  };

  // --- Icon Library management (Settings → Icons) ---

  const startEditIcon = (icon: IconEntry) => {
    setEditingIcon(icon.id);
    setIconForm({ emoji: icon.emoji, label: icon.label });
  };

  const saveIconEdit = () => {
    if (!editingIcon) return;
    runMenuWrite(updateIconEntry(editingIcon, { emoji: iconForm.emoji.trim() || '❓', label: iconForm.label.trim() || 'Untitled' }));
    setEditingIcon(null);
  };

  const saveNewIcon = () => {
    if (!newIconForm.emoji.trim() || !newIconForm.label.trim()) return;
    runMenuWrite(addIconEntry({
      id: `ic-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      emoji: newIconForm.emoji.trim(),
      label: newIconForm.label.trim()
    }));
    setNewIconForm({ emoji: '', label: '' });
  };

  // --- Reuse a previous week's plan ---

  const savedWeeksFor = (service: Service, activeWeekStart: string): string[] => {
    const starts = service === 'Dinner' ? listDinnerWeekStarts() : listLunchWeekStarts();
    // Only return weeks that are strictly in the past relative to the week
    // being edited, sorted in reverse-chronological order (newest/most recent first).
    return starts
      .filter(w => w < activeWeekStart)
      .sort((a, b) => b.localeCompare(a));
  };

  const applyReuseWeek = (service: Service, destinationWeekStart: string, sourceWeekStart: string) => {
    if (!sourceWeekStart) return;
    const sourceMenu = service === 'Dinner' ? dinnerMenuForWeek(sourceWeekStart) : lunchMenuForWeek(sourceWeekStart);
    const setMenu = service === 'Dinner' ? setDinnerWeekMenu : setLunchWeekMenu;
    // sourceMenu is a plain snapshot object (forWeek() never returns a live
    // reference into another week's override), so this is a one-time copy —
    // editing the destination afterwards never changes the source week.
    runMenuWrite(setMenu(destinationWeekStart, sourceMenu));
    setReusePickerFor(null);
    setReuseSourceWeek('');
  };

  // --- CSV import / export ---
  // Format: one header row, then one row per dish —
  // day,id,emoji,name,desc,price,dhalApplicable,saladApplicable
  // day is MON/TUE/WED/THU/FRI. id is optional (blank = auto-generated on
  // import, so an exported-then-reimported file round-trips its ids too).
  // dhalApplicable/saladApplicable are optional — blank means
  // "use the default" (true / true), same fallback the data model
  // itself uses for any dish that doesn't set them.

  const csvEscape = (value: string): string => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const exportMenuCSV = (service: Service, weekStart: string) => {
    const menu = service === 'Dinner' ? dinnerMenuForWeek(weekStart) : lunchMenuForWeek(weekStart);
    const rows = ['day,id,emoji,name,desc,price,dhalApplicable,saladApplicable'];
    WEEKDAY_KEYS.forEach(day => {
      menu[day].forEach(dish => {
        rows.push([
          day,
          dish.id,
          dish.emoji,
          csvEscape(dish.name),
          csvEscape(dish.desc),
          String(dish.price),
          String(dishDhalApplicable(dish)),
          String(dishSaladApplicable(dish))
        ].join(','));
      });
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bonmanze-${service.toLowerCase()}-menu-${weekStart}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportTransactionsCSV = (rowsToExport: any[]) => {
    // Regular expression to strip emojis, icons, and non-standard pictographs
    const removeEmojis = (str: string): string => {
      if (!str) return '';
      return str
        .replace(/[\u1F600-\u1F64F]/g, '') // Emoticons
        .replace(/[\u1F300-\u1F5FF]/g, '') // Symbols & Pictographs
        .replace(/[\u1F680-\u1F6FF]/g, '') // Transport & Map Symbols
        .replace(/[\u1F1E0-\u1F1FF]/g, '') // Flags
        .replace(/[\u2600-\u27BF]/g, '')   // Misc Symbols & Dingbats
        .replace(/[\uE000-\uF8FF]/g, '')   // Private Use Area
        .replace(/[\uD83C-\uDBFF\uDC00-\uDFFF]/g, '') // Modern Emojis
        .replace(/\s+/g, ' ')             // Clean duplicate spaces
        .trim();
    };

    const headers = [
      'Order ID',
      'Order Placed Date',
      'Delivery Date',
      'Service',
      'Customer Name',
      'Customer Phone',
      'Dish Name',
      'Base Selection',
      'Dhal Selection',
      'Salad Selection',
      'Beverage Selection',
      'Dessert Selection',
      'For Customer (Tag)',
      'Custom Instructions',
      'Qty',
      'Price (Rs)',
      'Item Total (Rs)',
      'Discount Share (Rs)',
      'Discount Reason',
      'VAT Share (Rs)',
      'Net Total (Rs)',
      'Payment Status',
      'Payment Method',
      'Payment Reference',
      'Delivery Status',
      'Rating',
      'Feedback Comment'
    ];

    const csvRows = [headers.join(',')];

    rowsToExport.forEach(r => {
      // Parse detailed selection parts from notes (joined by ' · ')
      const parts = (r.notes || '').split(' · ');
      let baseStr = '';
      let dhalStr = '';
      let saladStr = '';
      let beverageStr = '';
      let dessertStr = '';
      let personStr = '';
      let customNoteStr = '';

      parts.forEach(part => {
        const p = part.trim();
        if (p.startsWith('for ')) {
          personStr = p.slice(4);
        } else if (bases.some(b => b.name === p || removeEmojis(b.name) === removeEmojis(p))) {
          baseStr = p;
        } else if (dhals.some(d => d.name === p || removeEmojis(d.name) === removeEmojis(p))) {
          dhalStr = p;
        } else if (salads.some(s => s.name === p || removeEmojis(s.name) === removeEmojis(p))) {
          saladStr = p;
        } else if (beverages.some(b => b.name === p || removeEmojis(b.name) === removeEmojis(p))) {
          beverageStr = p;
        } else if (desserts.some(d => d.name === p || removeEmojis(d.name) === removeEmojis(p))) {
          dessertStr = p;
        } else if (p) {
          customNoteStr = customNoteStr ? `${customNoteStr} · ${p}` : p;
        }
      });

      const row = [
        csvEscape(r.orderId),
        csvEscape(r.timestamp),
        csvEscape(r.deliveryDate),
        csvEscape(r.serviceSlot),
        csvEscape(removeEmojis(r.customerName)),
        csvEscape(r.customerPhone),
        csvEscape(removeEmojis(r.itemName)),
        csvEscape(removeEmojis(baseStr)),
        csvEscape(removeEmojis(dhalStr)),
        csvEscape(removeEmojis(saladStr)),
        csvEscape(removeEmojis(beverageStr)),
        csvEscape(removeEmojis(dessertStr)),
        csvEscape(removeEmojis(personStr)),
        csvEscape(removeEmojis(customNoteStr)),
        r.qty.toString(),
        r.price.toString(),
        r.itemTotal.toFixed(2),
        r.discount.toFixed(2),
        csvEscape(removeEmojis(r.discountReason)),
        r.vat.toFixed(2),
        r.totalWithTax.toFixed(2),
        csvEscape(r.paymentStatus),
        csvEscape(r.paymentMethod),
        csvEscape(r.paymentRef),
        csvEscape(r.deliveryStatus),
        r.rating !== undefined ? r.rating.toString() : '',
        csvEscape(removeEmojis(r.ratingComment || ''))
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `BonManze_Transactions_Export_${systemDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Minimal RFC4180-ish line splitter — handles quoted fields containing
  // commas (name/desc are free text and occasionally have them) without
  // pulling in a CSV library for a five-column import.
  const parseCsvLine = (line: string): string[] => {
    const fields: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { cur += ch; }
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === ',') { fields.push(cur); cur = ''; }
        else cur += ch;
      }
    }
    fields.push(cur);
    return fields;
  };

  const parseMenuCSV = (text: string): { menu: Record<WeekdayKey, CurryOption[]>; error: string } => {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return { menu: {} as Record<WeekdayKey, CurryOption[]>, error: 'CSV has no data rows.' };
    const header = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());
    const col = (name: string) => header.indexOf(name);
    const dayCol = col('day'), idCol = col('id'), emojiCol = col('emoji'), nameCol = col('name'), descCol = col('desc'), priceCol = col('price'), dhalCol = col('dhalapplicable'), saladCol = col('saladapplicable');
    if (dayCol === -1 || nameCol === -1 || priceCol === -1) {
      return { menu: {} as Record<WeekdayKey, CurryOption[]>, error: 'CSV must have at least day, name, and price columns.' };
    }
    const menu: Record<WeekdayKey, CurryOption[]> = { MON: [], TUE: [], WED: [], THU: [], FRI: [] };
    for (let i = 1; i < lines.length; i++) {
      const fields = parseCsvLine(lines[i]);
      const dayRaw = (fields[dayCol] || '').trim().toUpperCase();
      if (!WEEKDAY_KEYS.includes(dayRaw as WeekdayKey)) {
        return { menu: {} as Record<WeekdayKey, CurryOption[]>, error: `Row ${i + 1}: "${fields[dayCol]}" isn't a valid day (expected MON/TUE/WED/THU/FRI).` };
      }
      const day = dayRaw as WeekdayKey;
      const name = (fields[nameCol] || '').trim();
      if (!name) return { menu: {} as Record<WeekdayKey, CurryOption[]>, error: `Row ${i + 1}: name is required.` };
      const parsedPrice = parseFloat(fields[priceCol] || '0');
      const dhalRaw = (dhalCol !== -1 ? fields[dhalCol] : '')?.trim().toLowerCase();
      const saladRaw = (saladCol !== -1 ? fields[saladCol] : '')?.trim().toLowerCase();
      menu[day].push({
        id: (idCol !== -1 && fields[idCol]?.trim()) || `dish-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}-${i}`,
        emoji: (emojiCol !== -1 && fields[emojiCol]?.trim()) || '🍽️',
        name,
        desc: (descCol !== -1 && fields[descCol]) || '',
        price: isNaN(parsedPrice) ? 0 : parsedPrice,
        dhalApplicable: dhalRaw === '' || dhalRaw === undefined ? true : dhalRaw === 'true',
        saladApplicable: saladRaw === '' || saladRaw === undefined ? true : saladRaw === 'true'
      });
    }
    return { menu, error: '' };
  };

  // CSV import used to create pure freehand day-slot dishes with no mainId
  // at all — bypassing the Meal Library entirely, unlike "Add dish" (which
  // always picks a Main). That meant a CSV-imported dish's applicable/
  // narrowing config could never be managed from the Library, and editing
  // it there later had no effect. This links every imported row to a Main
  // — an existing one if its name matches exactly (case-insensitive), or a
  // freshly created one (seeded from the CSV row's own emoji/desc/price/
  // baseGroup/dhal·saladApplicable) when nothing matches — so "the Menu
  // Planner always pulls from the Meal Library" holds for CSV-imported
  // weeks too, not just dishes added via the Main picker. A local name->id
  // map (rather than the `mainDishes` React state, which won't reflect a
  // Main created mid-loop until the next render) makes two rows sharing a
  // name within the same import link to one Main, not two duplicates.
  const linkMenuDishesToLibrary = (menu: Record<WeekdayKey, CurryOption[]>): Record<WeekdayKey, CurryOption[]> => {
    const byName = new Map<string, string>();
    mainDishes.forEach(m => byName.set(m.name.trim().toLowerCase(), m.id));
    const result: Record<WeekdayKey, CurryOption[]> = { MON: [], TUE: [], WED: [], THU: [], FRI: [] };
    WEEKDAY_KEYS.forEach(day => {
      result[day] = menu[day].map(dish => {
        const key = dish.name.trim().toLowerCase();
        let mainId = byName.get(key);
        if (!mainId) {
          mainId = `main-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
          const { id, ...rest } = dish;
          runMenuWrite(addMainDish({ id: mainId, ...rest }));
          byName.set(key, mainId);
        }
        return { ...dish, mainId };
      });
    });
    return result;
  };

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !csvImportTarget) return;
    const service = csvImportTarget;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const { menu, error } = parseMenuCSV(text);
      if (error) { setCsvError(error); return; }
      setCsvError('');
      const setMenu = service === 'Dinner' ? setDinnerWeekMenu : setLunchWeekMenu;
      runMenuWrite(setMenu(activeMenuWeekStart, linkMenuDishesToLibrary(menu)));
      setCsvImportTarget(null);
    };
    reader.readAsText(file);
  };

  const todayCookCount = useMemo(() => {
    let count = 0;
    lines.forEach(({ item }) => {
      if (item.deliveryDate === systemDate) {
        count += item.qty;
      }
    });
    return count;
  }, [lines, systemDate]);

  const todayDeliveriesPending = useMemo(() => {
    let count = 0;
    lines.forEach(({ item }) => {
      if (item.deliveryDate === systemDate && item.status !== 'Completed') {
        count += item.qty;
      }
    });
    return count;
  }, [lines, systemDate]);

  const pendingPaymentClaimsCount = useMemo(() => {
    return paymentDrops.filter(d => d.paymentStatus === 'Pending' && d.claimedMethod).length;
  }, [paymentDrops]);

  const activeWeekFinancials = useMemo(() => {
    let collected = 0;
    let outstanding = 0;
    lines.forEach(({ item }) => {
      if (item.deliveryDate && weekDateKeys.has(item.deliveryDate)) {
        const amt = item.qty * item.price;
        if (item.paymentStatus === 'Paid') {
          collected += amt;
        } else {
          outstanding += amt;
        }
      }
    });
    return { collected, outstanding };
  }, [lines, weekDateKeys]);

  const renderDashboard = () => {
    const formattedDate = formatDay(systemDate);
    const hasOverride = systemDate !== getRealTodayISO();
    return (
      <div className="space-y-8 animate-fade-in">
        {/* Banner if testing override date is active */}
        {hasOverride && (
          <div className="bg-[#B4703A]/10 border border-[#B4703A]/20 text-[#B4703A] p-4 rounded-2xl flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold">
              <span>⚠️ Testing Date Override Active: <strong>{systemDate}</strong> (Real date: {getRealTodayISO()})</span>
            </div>
            <button
              onClick={() => updateSystemDate(getRealTodayISO())}
              className="text-xs font-black bg-[#B4703A] text-white px-3 py-1.5 rounded-lg hover:bg-[#B4703A]/90 transition-colors shadow-sm"
            >
              Reset to Real Today
            </button>
          </div>
        )}

        {/* Welcome Section */}
        <div className="bg-[#FDFAF4] rounded-[24px] border border-[#E7E0D0] p-8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <h2 className="text-xl font-black text-slate-900 leading-none">Welcome back, Bhimal</h2>
            <p className="text-xs text-slate-500 font-medium">
              Here is your overview for today, <strong className="text-primary">{formattedDate}</strong>.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setTab('menu')}
              className="px-4 py-2.5 bg-primary text-white hover:bg-primary/95 rounded-xl text-xs font-bold shadow-md transition-colors"
            >
              Manage Curries
            </button>
            <button
              onClick={() => setTab('delivery')}
              className="px-4 py-2.5 bg-white border border-[#E7E0D0] hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold shadow-sm transition-colors"
            >
              Delivery List
            </button>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Today's Cook Count */}
          <div className="bg-white rounded-3xl border border-[#E7E0D0] p-6 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
            <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <BookOpen className="size-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Today's Cook Count</p>
              <h3 className="text-2xl font-black text-slate-900 mt-2">{todayCookCount} meals</h3>
              <p className="text-[11px] text-slate-400 font-bold mt-1">Lunch + Dinner preps</p>
            </div>
          </div>

          {/* Deliveries Pending */}
          <div className="bg-white rounded-3xl border border-[#E7E0D0] p-6 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
            <div className="size-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent">
              <Truck className="size-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Deliveries Pending</p>
              <h3 className="text-2xl font-black text-slate-900 mt-2">{todayDeliveriesPending} items</h3>
              <p className="text-[11px] text-slate-400 font-bold mt-1">Remaining for today</p>
            </div>
          </div>

          {/* Awaiting Payment */}
          <div className="bg-white rounded-3xl border border-[#E7E0D0] p-6 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
            <div className="size-12 rounded-2xl bg-yellow-500/10 flex items-center justify-center text-yellow-600">
              <Wallet className="size-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Awaiting Confirmation</p>
              <h3 className="text-2xl font-black text-slate-900 mt-2">{pendingPaymentClaimsCount} claims</h3>
              <p className="text-[11px] text-slate-400 font-bold mt-1">Juice/MauCAS transfers</p>
            </div>
          </div>

          {/* Revenue & Outstanding */}
          <div className="bg-white rounded-3xl border border-[#E7E0D0] p-6 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
            <div className="size-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <Banknote className="size-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">This Week's Revenue</p>
              <h3 className="text-xl font-black text-slate-900 mt-2 truncate">Rs {activeWeekFinancials.collected}</h3>
              <p className="text-[11px] text-[#B4703A] font-bold mt-1">Rs {activeWeekFinancials.outstanding} outstanding</p>
            </div>
          </div>
        </div>

        {/* Informative Guidance Banner */}
        <div className="bg-slate-50 border border-[#E7E0D0] rounded-2xl p-4 text-xs font-bold text-slate-500 flex items-center gap-2">
          <span className="inline-block size-1.5 rounded-full bg-slate-400" />
          <span>Note: System is configured to run entirely in local storage. All changes are saved on your local device.</span>
        </div>
      </div>
    );
  };

  const renderMenuTab = () => {
    // activeMenuDays/activeMenuWeekStart are computed at component scope
    // above (shared with the CSV import handler) — not redeclared here.
    const activeLunchMenu = lunchMenuForWeek(activeMenuWeekStart);
    const activeDinnerMenu = dinnerMenuForWeek(activeMenuWeekStart);

    const [y, m, d] = activeMenuWeekStart.split('-').map(Number);
    const weekDateStr = new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    const weekLabel =
      activeMenuWeek === 'Next' ? "Next Week" :
      activeMenuWeek === 'Week+2' ? "Week+2" :
      activeMenuWeek === 'Week+3' ? "Week+3" :
      "This Week";

    const renderServiceMenu = (service: Service, activeMenu: Record<WeekdayKey, CurryOption[]>) => {
      const savedWeeks = savedWeeksFor(service, activeMenuWeekStart);
      return (
        <div key={service} className="bg-white rounded-3xl border border-[#E7E0D0] shadow-sm p-6">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <h2 className="text-base font-black text-slate-900">{weekLabel}'s Curry Menu — {service}</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setReusePickerFor(reusePickerFor === service ? null : service); setReuseWeekIndex(0); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <History className="size-3.5" /> Reuse a previous week
              </button>
              <button
                onClick={() => exportMenuCSV(service, activeMenuWeekStart)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <Download className="size-3.5" /> Export CSV
              </button>
              <button
                onClick={() => { setCsvImportTarget(service); setCsvError(''); csvFileInputRef.current?.click(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <Upload className="size-3.5" /> Import CSV
              </button>
            </div>
          </div>

          {reusePickerFor === service && (() => {
            const savedWeeks = savedWeeksFor(service, activeMenuWeekStart);
            const sourceWeekStart = savedWeeks[reuseWeekIndex] || '';
            return (
              <div className="mb-6 p-5 bg-[#FAF9F5] border border-[#E7E0D0] rounded-3xl flex flex-col gap-4 animate-fade-in">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-slate-900">Reuse a previous week's {service.toLowerCase()} lineup</h4>
                    <p className="text-[11px] text-slate-400 font-medium">Browse past configurations using the navigation buttons and copy the menu lineup.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setReusePickerFor(null); }}
                    className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                {savedWeeks.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 border border-dashed border-[#E7E0D0] bg-white rounded-2xl">
                    <p className="text-xs font-bold">No previous saved weeks found.</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Edit, add, or remove a dish on another week first to build a past menu library.</p>
                  </div>
                ) : (
                  <>
                    {/* Carousel Navigation Selector Row */}
                    <div className="flex items-center justify-between bg-white rounded-2xl border border-[#E7E0D0] p-3 shadow-sm">
                      <button
                        type="button"
                        disabled={reuseWeekIndex >= savedWeeks.length - 1}
                        onClick={() => setReuseWeekIndex(prev => prev + 1)}
                        className="px-4 py-2 hover:bg-slate-50 border border-slate-200 text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer"
                      >
                        ← Previous Week
                      </button>
                      
                      <div className="text-center">
                        <span className="text-xs font-black text-slate-950 block">
                          {formatWeekStartForDropdown(sourceWeekStart)}
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                          Week {reuseWeekIndex + 1} of {savedWeeks.length}
                        </span>
                      </div>

                      <button
                        type="button"
                        disabled={reuseWeekIndex <= 0}
                        onClick={() => setReuseWeekIndex(prev => prev - 1)}
                        className="px-4 py-2 hover:bg-slate-50 border border-slate-200 text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer"
                      >
                        Next Week →
                      </button>
                    </div>

                    {/* Live Day-by-Day Preview Grid of target past week */}
                    {sourceWeekStart && (() => {
                      const previewMenu = service === 'Dinner' ? dinnerMenuForWeek(sourceWeekStart) : lunchMenuForWeek(sourceWeekStart);
                      return (
                        <div className="bg-white rounded-2xl border border-[#E7E0D0] p-4.5 space-y-2.5 shadow-sm">
                          <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Curry Lineup Preview</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                            {WEEKDAY_KEYS.map(day => (
                              <div key={day} className="bg-slate-50/50 rounded-xl border border-slate-100 p-3 flex flex-col justify-start">
                                <span className="text-[9px] font-black text-primary tracking-widest uppercase mb-2">{day}</span>
                                <div className="space-y-1.5 flex-1">
                                  {previewMenu[day].length === 0 ? (
                                    <span className="text-[10px] text-slate-300 font-bold italic block">No dishes</span>
                                  ) : (
                                    previewMenu[day].map(dish => (
                                      <div key={dish.id} className="text-[11px] font-black text-slate-700 leading-tight truncate flex items-center gap-1" title={`${dish.emoji} ${dish.name}`}>
                                        <span className="text-xs shrink-0">{dish.emoji}</span>
                                        <span className="truncate">{dish.name}</span>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Apply Lineup Confirm Button */}
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => applyReuseWeek(service, activeMenuWeekStart, sourceWeekStart)}
                        className="px-6 py-3 bg-primary text-white hover:bg-primary/95 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Copy className="size-3.5" /> Reuse this weekly menu lineup
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })()}

          {csvImportTarget === service && csvError && (
            <p className="mb-4 text-[11px] font-bold text-red-500">{csvError}</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {activeMenuDays.map(d => (
              <div key={d.key} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-3">{d.label}</p>
                <div className="space-y-2.5">
                  {activeMenu[d.key].map(c => {
                    const isEditingSlot = editingDaySlot?.day === d.key && editingDaySlot.curryId === c.id && editingDaySlot.service === service && editingDaySlot.weekStart === activeMenuWeekStart;
                    const special = specialPriceInfo(c);
                    if (isEditingSlot) {
                      const linkedMain = c.mainId ? mainDishes.find(m => m.id === c.mainId) : undefined;
                      return (
                        <div key={c.id} className="p-3 bg-white rounded-xl border-2 border-primary/30 space-y-2">
                          {c.mainId ? (
                            // Picked from the Meal Library — name & description
                            // are locked to the Main; only the price can move,
                            // so it stays the single lever for a day's special.
                            <div className="flex items-center gap-2.5">
                              <img src={dishPhotoFor(c)} alt={c.name} className="size-9 rounded-lg object-cover shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-slate-800 truncate">{c.emoji} {c.name}</p>
                                <p className="text-[10px] text-slate-400 truncate">{c.desc}</p>
                              </div>
                            </div>
                          ) : (
                            <>
                              <input
                                value={daySlotEditForm.name}
                                onChange={e => setDaySlotEditForm(f => ({ ...f, name: e.target.value }))}
                                placeholder="Name"
                                className="w-full text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20"
                              />
                              <input
                                value={daySlotEditForm.desc}
                                onChange={e => setDaySlotEditForm(f => ({ ...f, desc: e.target.value }))}
                                placeholder="Description"
                                className="w-full text-[11px] px-2.5 py-1.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20"
                              />
                            </>
                          )}
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400">Rs</span>
                            <input
                              type="number"
                              value={daySlotEditForm.price}
                              onChange={e => setDaySlotEditForm(f => ({ ...f, price: e.target.value }))}
                              className="w-20 text-xs font-black px-2.5 py-1.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20"
                            />
                            <div className="flex-1" />
                            <button onClick={saveDaySlotEdit} className="p-1.5 bg-primary text-white rounded-lg"><Check className="size-3.5" /></button>
                            <button onClick={cancelDaySlotEdit} className="p-1.5 bg-slate-100 text-slate-400 rounded-lg"><X className="size-3.5" /></button>
                          </div>
                          {c.mainId && linkedMain && (
                            <p className="text-[10px] text-slate-400 font-medium leading-snug pt-0.5">
                              Regular price <span className="font-black text-slate-600">{formatCurrency(linkedMain.price)}</span>. Enter a lower price to run today's special — customers see it discounted.
                            </p>
                          )}
                        </div>
                      );
                    }
                    return (
                      <div key={c.id} className="flex items-center gap-2">
                        <img src={dishPhotoFor(c)} alt={c.name} className="size-9 rounded-lg object-cover shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-800 truncate">{c.emoji} {c.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">{c.desc}</p>
                          {special && (
                            <p className="text-[9px] text-emerald-600 font-bold truncate">Special price — usually {formatCurrency(special.regularPrice)}</p>
                          )}
                        </div>
                        <span className="text-[10px] font-black text-slate-400 shrink-0">{formatCurrency(c.price)}</span>
                        <button onClick={() => startEditDaySlot(d.key, service, activeMenuWeekStart, c)} className="p-1 text-slate-300 hover:text-primary shrink-0">
                          <Edit3 className="size-3.5" />
                        </button>
                        <button onClick={() => handleRemoveDish(d.key, service, activeMenuWeekStart, c.id)} className="p-1 text-slate-300 hover:text-red-500 shrink-0">
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    );
                  })}

                  <button
                    onClick={() => openMainPicker(d.key, service, activeMenuWeekStart)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-primary/40 hover:text-primary text-[11px] font-bold transition-colors"
                  >
                    <Plus className="size-3.5" /> Add dish
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-4">
            Pencil edits price (name & description come from the Meal Library once a dish is picked from it), trash removes it, "Add dish" picks a Main from the Meal Library — changes apply immediately on the Customer App.
          </p>
        </div>
      );
    };

    return (
      <div className="space-y-6">
        {opsActionError && (
          <div className="bg-danger/10 text-danger text-xs font-bold rounded-xl px-4 py-3 flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" /> {opsActionError}
          </div>
        )}
        <input ref={csvFileInputRef} type="file" accept=".csv" className="hidden" onChange={handleCsvFileChange} />

        {/* Week Switcher with Week Range Header */}
        <div className="bg-white rounded-3xl border border-[#E7E0D0] shadow-sm p-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 flex-wrap">
              <span>Which week are you editing?</span>
              <span className="text-[10px] bg-primary/10 text-primary font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                Week of {weekDateStr}
              </span>
            </h3>
            <p className="text-xs text-slate-400 font-medium mt-1 max-w-sm">
              Customers can order This week and Next week. Week+2 and Week+3 are planning headroom only, so Bhimal always has a week's lead time — they are never shown or orderable in the Customer App.
            </p>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 rounded-full p-1 shrink-0">
            {(['This', 'Next', 'Week+2', 'Week+3'] as WeekChoice[]).map(w => (
              <button
                key={w}
                onClick={() => setActiveMenuWeek(w)}
                className={`px-3.5 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all ${activeMenuWeek === w ? 'bg-primary text-white shadow-sm' : 'text-slate-500'} cursor-pointer`}
              >
                {w === 'This' ? 'This week' : w === 'Next' ? 'Next week' : w === 'Week+2' ? 'Week+2' : 'Week+3'}
              </button>
            ))}
          </div>
        </div>

        {renderServiceMenu('Lunch', activeLunchMenu)}
        {dinnerEnabled && renderServiceMenu('Dinner', activeDinnerMenu)}

        {/* Add-dish Main picker — search-and-select over the Meal Library.
            Select-only by design: if the Main you want isn't here yet, add
            it in the Meal Library tab first, then come back. */}
        {mainPickerFor && (
          <Portal>
          <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={cancelMainPicker}>
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="p-5 border-b border-[#E7E0D0] flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900">Add a dish from the Meal Library</h3>
                <button onClick={cancelMainPicker} className="p-1.5 text-slate-400 hover:text-danger"><X className="size-4" /></button>
              </div>
              <div className="p-4 border-b border-[#E7E0D0]">
                <input
                  value={mainPickerSearch}
                  onChange={e => setMainPickerSearch(e.target.value)}
                  placeholder="Search Mains…"
                  autoFocus
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {mainDishes.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-sm font-bold text-slate-500 mb-2">No Mains in your Meal Library yet.</p>
                    <button onClick={() => { cancelMainPicker(); setTab('library'); }} className="text-xs font-black text-primary underline">Go add one in Meal Library →</button>
                  </div>
                ) : filteredMainPickerResults.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 font-medium py-10">No Mains match "{mainPickerSearch}".</p>
                ) : filteredMainPickerResults.map(m => (
                  <button
                    key={m.id}
                    onClick={() => pickMainForDay(m)}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl border border-slate-100 hover:border-primary/30 hover:bg-primary/5 text-left transition-colors"
                  >
                    <img src={dishPhotoFor(m)} className="size-10 rounded-xl object-cover shrink-0" alt={m.name} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{m.emoji} {m.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">{m.desc}</p>
                    </div>
                    <span className="text-xs font-black text-slate-500 shrink-0">{formatCurrency(m.price)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          </Portal>
        )}
      </div>
    );
  };

  const renderLibraryTab = () => {
    const catalogKeys: CatalogKey[] = ['base', 'dhal', 'salad', 'beverage', 'dessert'];

    const renderAddOnCatalogs = () => (
      <div className="bg-white rounded-3xl border border-[#E7E0D0] shadow-sm p-6">
        <button onClick={() => setCatalogsOpen(o => !o)} className="w-full flex items-center justify-between text-left">
          <div>
            <h3 className="text-sm font-black text-slate-900">Add-On Catalogs</h3>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              Base, Dhal, Salad, Beverage & Dessert options — Mains below choose which of these apply.
            </p>
          </div>
          {catalogsOpen ? <ChevronUp className="size-4 text-slate-400 shrink-0" /> : <ChevronDown className="size-4 text-slate-400 shrink-0" />}
        </button>

        {catalogsOpen && (
          <div className="mt-6 space-y-8 animate-fade-in">
            {catalogKeys.map(key => {
              const meta = CATALOG_META[key];
              const draft = newAddOnForm[key];
              return (
                <div key={key} className="space-y-3 pt-6 border-t border-slate-100 first:border-t-0 first:pt-0">
                  <h4 className="text-[10px] font-black uppercase text-primary tracking-widest">{meta.label} Options</h4>
                  
                  {meta.items.length > 0 ? (
                    <div className="overflow-x-auto border border-[#E7E0D0] rounded-2xl">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-[#E7E0D0] bg-[#FAF9F5] text-[10px] font-black uppercase tracking-widest text-slate-400">
                            <th className="px-6 py-3 w-16">Icon</th>
                            <th className="px-6 py-3">Option Name</th>
                            {meta.hasGroup && <th className="px-6 py-3 w-28">Group</th>}
                            {meta.hasPrice && <th className="px-6 py-3 text-right w-28">Upcharge (Rs)</th>}
                            <th className="px-6 py-3 text-center w-28">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E7E0D0] font-semibold text-slate-700">
                          {meta.items.map(item => {
                            const isEditing = editingAddOn?.catalog === key && editingAddOn.id === item.id;
                            if (isEditing) {
                              return (
                                <tr key={item.id} className="bg-primary/[0.02]">
                                  <td className="px-6 py-3">
                                    <IconPickerButton
                                      value={addOnForm.emoji}
                                      onChange={emoji => setAddOnForm(f => ({ ...f, emoji }))}
                                      className="w-10 h-8 flex items-center justify-center text-sm rounded-lg border border-slate-200 bg-white hover:border-primary/40 transition-colors cursor-pointer shrink-0"
                                    />
                                  </td>
                                  <td className="px-6 py-3">
                                    <input
                                      value={addOnForm.name}
                                      onChange={e => setAddOnForm(f => ({ ...f, name: e.target.value }))}
                                      placeholder="Name"
                                      className="w-full text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 outline-none bg-white"
                                    />
                                  </td>
                                  {meta.hasGroup && (
                                    <td className="px-6 py-3">
                                      <input
                                        value={addOnForm.group}
                                        onChange={e => setAddOnForm(f => ({ ...f, group: e.target.value }))}
                                        placeholder="Group"
                                        className="w-24 text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 outline-none bg-white"
                                      />
                                    </td>
                                  )}
                                  {meta.hasPrice && (
                                    <td className="px-6 py-3 text-right">
                                      <div className="flex justify-end">
                                        <input
                                          type="number"
                                          value={addOnForm.price}
                                          onChange={e => setAddOnForm(f => ({ ...f, price: e.target.value }))}
                                          className="w-20 text-right text-xs font-black px-2.5 py-1.5 rounded-lg border border-slate-200 outline-none bg-white"
                                        />
                                      </div>
                                    </td>
                                  )}
                                  <td className="px-6 py-3 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <button onClick={saveAddOnEdit} className="p-1 bg-primary text-white rounded-lg cursor-pointer"><Check className="size-3.5" /></button>
                                      <button onClick={() => setEditingAddOn(null)} className="p-1 bg-slate-100 text-slate-400 rounded-lg cursor-pointer"><X className="size-3.5" /></button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            }
                            return (
                              <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4 text-base">{item.emoji}</td>
                                <td className="px-6 py-4 text-xs font-bold text-slate-900">{item.name}</td>

                                {meta.hasPrice && (
                                  <td className="px-6 py-4 text-right font-black text-slate-600">
                                    {formatCurrency(item.price ?? item.up ?? 0)}
                                  </td>
                                )}
                                <td className="px-6 py-4 text-center">
                                  <div className="flex items-center justify-center gap-1.5 font-normal">
                                    <button onClick={() => startEditAddOn(key, item)} className="p-1.5 text-primary hover:bg-[#FAF9F5] rounded-lg transition-all cursor-pointer"><Edit3 className="size-3.5" /></button>
                                    <button onClick={() => runMenuWrite(meta.remove(item.id))} className="p-1.5 text-danger hover:bg-danger/5 rounded-lg transition-all cursor-pointer"><Trash2 className="size-3.5" /></button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 font-medium py-2">No {meta.label.toLowerCase()} options yet.</p>
                  )}

                  {/* Add New Option Form Row */}
                  <div className="p-4 bg-[#FAF9F5] rounded-2xl border border-[#E7E0D0] space-y-3">
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest pb-1 border-b border-[#E7E0D0]">Add New {meta.label}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <IconPickerButton
                        value={draft.emoji}
                        onChange={emoji => setNewAddOnForm(f => ({ ...f, [key]: { ...f[key], emoji } }))}
                        className="w-10 h-9 flex items-center justify-center text-sm rounded-lg border border-slate-200 bg-white hover:border-primary/40 transition-colors cursor-pointer shrink-0"
                      />
                      <input
                        value={draft.name}
                        onChange={e => setNewAddOnForm(f => ({ ...f, [key]: { ...f[key], name: e.target.value } }))}
                        placeholder={`New ${meta.label.toLowerCase()} name`}
                        className="flex-1 min-w-[150px] text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 outline-none bg-white"
                      />
                      {meta.hasGroup && (
                        <input
                          value={draft.group}
                          onChange={e => setNewAddOnForm(f => ({ ...f, [key]: { ...f[key], group: e.target.value } }))}
                          placeholder="Group (e.g. Rice)"
                          className="w-24 text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 outline-none bg-white"
                        />
                      )}
                      {meta.hasPrice && (
                        <input
                          type="number"
                          value={draft.price}
                          onChange={e => setNewAddOnForm(f => ({ ...f, [key]: { ...f[key], price: e.target.value } }))}
                          placeholder="Upcharge"
                          className="w-20 text-xs font-black px-2.5 py-1.5 rounded-lg border border-slate-200 outline-none bg-white"
                        />
                      )}
                      <button
                        onClick={() => saveNewAddOn(key)}
                        disabled={!draft.name.trim()}
                        className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white hover:bg-primary/95 disabled:opacity-40 rounded-xl text-xs font-black uppercase tracking-widest transition-colors cursor-pointer shrink-0"
                      >
                        <Plus className="size-4 shrink-0" /> Add {meta.label}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );

    return (
      <div className="space-y-6 animate-fade-in">
        {opsActionError && (
          <div className="bg-danger/10 text-danger text-xs font-bold rounded-xl px-4 py-3 flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" /> {opsActionError}
          </div>
        )}
        <div className="bg-white rounded-3xl border border-[#E7E0D0] shadow-sm p-6">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <div>
              <h2 className="text-base font-black text-slate-900">Meal Library — Mains</h2>
              <p className="text-xs text-slate-400 font-medium mt-1 max-w-md">
                Define each Main once — its base, dhal, salad, beverage & dessert options, general selling price, and cost. The Menu Planner picks Mains from here into each day.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={startAddMain}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-primary text-white hover:bg-primary/90 transition-colors shadow-sm"
              >
                <Plus className="size-4" /> Add Main
              </button>
            </div>
          </div>

          {mainDishes.length === 0 ? (
            <div className="text-center py-14 border-2 border-dashed border-slate-200 rounded-2xl">
              <ChefHat className="size-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-500">No Mains yet.</p>
              <p className="text-xs text-slate-400 font-medium mt-1">Add your first Main to seed the Library.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {mainDishes.map(m => {
                const baseOn = dishBaseApplicable(m);
                const dhalOn = dishDhalApplicable(m);
                const saladOn = dishSaladApplicable(m);
                const bevOn = dishBeverageApplicable(m);
                const desOn = dishDessertApplicable(m);
                return (
                  <div key={m.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-start gap-3">
                      <img src={dishPhotoFor(m)} alt={m.name} className="size-11 rounded-xl object-cover shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-800 truncate">{m.emoji} {m.name}</p>
                        <p className="text-[11px] text-slate-400 truncate">{m.desc}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => startEditMain(m)} className="p-1.5 text-slate-300 hover:text-primary"><Edit3 className="size-3.5" /></button>
                        <button onClick={() => runMenuWrite(removeMainDish(m.id))} className="p-1.5 text-slate-300 hover:text-red-500"><Trash2 className="size-3.5" /></button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <span className="text-xs font-black text-slate-700">{formatCurrency(m.price)}</span>
                      {m.cost !== undefined && <span className="text-[10px] font-bold text-slate-400">Cost {formatCurrency(m.cost)}</span>}
                    </div>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${baseOn ? 'bg-white border-slate-200 text-slate-500' : 'bg-slate-100 border-slate-200 text-slate-300'}`}>{baseOn ? 'Base' : 'No base'}</span>
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${dhalOn ? 'bg-white border-slate-200 text-slate-500' : 'bg-slate-100 border-slate-200 text-slate-300'}`}>{dhalOn ? 'Dhal' : 'No dhal'}</span>
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${saladOn ? 'bg-white border-slate-200 text-slate-500' : 'bg-slate-100 border-slate-200 text-slate-300'}`}>{saladOn ? 'Salad' : 'No salad'}</span>
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${bevOn ? 'bg-white border-slate-200 text-slate-500' : 'bg-slate-100 border-slate-200 text-slate-300'}`}>{bevOn ? 'Beverage' : 'No beverage'}</span>
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${desOn ? 'bg-white border-slate-200 text-slate-500' : 'bg-slate-100 border-slate-200 text-slate-300'}`}>{desOn ? 'Dessert' : 'No dessert'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {renderAddOnCatalogs()}

        {/* Main Editor modal — the single place base/dhal/salad/beverage/
            dessert applicability + price + cost are set for a Main. Day-slot
            dishes copy this once when picked in the Menu Planner; editing a
            Main afterwards never retroactively changes already-placed days.
            Portaled to <body> — this sits inside the admin console's
            overflow-hidden main column, which clips a plain "fixed inset-0"
            child to that column instead of the full viewport (the sidebar
            was showing through un-dimmed). See Portal.tsx. */}
        {mainEditor && (
          <Portal>
          <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={cancelMainEditor}>
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="p-5 border-b border-[#E7E0D0] flex items-center justify-between shrink-0">
                <h3 className="text-sm font-black text-slate-900">{mainEditor.mode === 'add' ? 'Add a Main' : 'Edit Main'}</h3>
                <button onClick={cancelMainEditor} className="p-1.5 text-slate-400 hover:text-danger"><X className="size-4" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <IconPickerButton value={mainForm.emoji} onChange={emoji => setMainForm(f => ({ ...f, emoji }))} />
                  <input value={mainForm.name} onChange={e => setMainForm(f => ({ ...f, name: e.target.value }))} placeholder="Main name" className="flex-1 text-sm font-bold px-3 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <textarea
                  value={mainForm.desc}
                  onChange={e => setMainForm(f => ({ ...f, desc: e.target.value }))}
                  placeholder="Description"
                  rows={2}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />

                {/* Photo — a real uploaded photo, distinct from the emoji
                    icon above. Falls back to the built-in protein-family
                    photo (see dishPhotoFor) until one is uploaded. */}
                <div className="flex items-center gap-3">
                  <img src={mainForm.photoUrl || dishPhotoFor({ id: mainEditor.mainId || '__new__', ...mainForm } as CurryOption)} alt="" className="size-14 rounded-xl object-cover border border-slate-200 shrink-0" />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => mainPhotoFileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors">
                        <ImagePlus className="size-3.5" /> Upload photo
                      </button>
                      {mainForm.photoUrl && (
                        <button type="button" onClick={() => setMainForm(f => ({ ...f, photoUrl: '' }))} className="text-[11px] font-bold text-slate-400 hover:text-red-500">Remove</button>
                      )}
                    </div>
                    {mainPhotoError && <p className="text-[10px] font-bold text-red-500">{mainPhotoError}</p>}
                  </div>
                  <input ref={mainPhotoFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleMainPhotoFileChange} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Selling Price (Rs)</label>
                    <input type="number" value={mainForm.price} onChange={e => setMainForm(f => ({ ...f, price: e.target.value }))} className="w-full text-sm font-bold px-3 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Cost (Rs, optional)</label>
                    <input type="number" value={mainForm.cost} onChange={e => setMainForm(f => ({ ...f, cost: e.target.value }))} className="w-full text-sm font-bold px-3 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                </div>

                {/* Base, Dhal, Salad, Beverage and Dessert all follow the
                    same shape now: an "applicable" checkbox (does this
                    category even apply to this dish?), and — only when
                    applicable — a checkbox grid narrowing to specific
                    catalog entries. Unset/all-checked means "no
                    restriction", same convention as before. */}

                {/* Base */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <input type="checkbox" checked={mainForm.baseApplicable} onChange={e => setMainForm(f => ({ ...f, baseApplicable: e.target.checked }))} className="size-4 accent-primary" />
                    Base applicable
                  </label>
                  {mainForm.baseApplicable && bases.length > 0 && (
                    <div className="flex flex-wrap gap-2 pl-6">
                      {bases.map(b => {
                        const checked = mainForm.baseOptionIds === null || mainForm.baseOptionIds.includes(b.id);
                        return (
                          <label key={b.id} className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border cursor-pointer ${checked ? 'bg-primary/5 border-primary/30 text-primary' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                            <input type="checkbox" checked={checked} onChange={() => toggleMainOption('baseOptionIds', bases, b.id)} className="size-3.5 accent-primary" />
                            {b.emoji} {b.name}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Dhal */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <input type="checkbox" checked={mainForm.dhalApplicable} onChange={e => setMainForm(f => ({ ...f, dhalApplicable: e.target.checked }))} className="size-4 accent-primary" />
                    Dhal applicable
                  </label>
                  {mainForm.dhalApplicable && dhals.length > 0 && (
                    <div className="flex flex-wrap gap-2 pl-6">
                      {dhals.map(d => {
                        const checked = mainForm.dhalOptionIds === null || mainForm.dhalOptionIds.includes(d.id);
                        return (
                          <label key={d.id} className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border cursor-pointer ${checked ? 'bg-primary/5 border-primary/30 text-primary' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                            <input type="checkbox" checked={checked} onChange={() => toggleMainOption('dhalOptionIds', dhals, d.id)} className="size-3.5 accent-primary" />
                            {d.emoji} {d.name}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Salad */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <input type="checkbox" checked={mainForm.saladApplicable} onChange={e => setMainForm(f => ({ ...f, saladApplicable: e.target.checked }))} className="size-4 accent-primary" />
                    Salad applicable
                  </label>
                  {mainForm.saladApplicable && salads.length > 0 && (
                    <div className="flex flex-wrap gap-2 pl-6">
                      {salads.map(s => {
                        const checked = mainForm.saladOptionIds === null || mainForm.saladOptionIds.includes(s.id);
                        return (
                          <label key={s.id} className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border cursor-pointer ${checked ? 'bg-primary/5 border-primary/30 text-primary' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                            <input type="checkbox" checked={checked} onChange={() => toggleMainOption('saladOptionIds', salads, s.id)} className="size-3.5 accent-primary" />
                            {s.emoji} {s.name}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Beverage */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <input type="checkbox" checked={mainForm.beverageApplicable} onChange={e => setMainForm(f => ({ ...f, beverageApplicable: e.target.checked }))} className="size-4 accent-primary" />
                    Beverage applicable
                  </label>
                  {mainForm.beverageApplicable && beverages.length > 0 && (
                    <div className="flex flex-wrap gap-2 pl-6">
                      {beverages.map(b => {
                        const checked = mainForm.beverageOptionIds === null || mainForm.beverageOptionIds.includes(b.id);
                        return (
                          <label key={b.id} className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border cursor-pointer ${checked ? 'bg-primary/5 border-primary/30 text-primary' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                            <input type="checkbox" checked={checked} onChange={() => toggleMainOption('beverageOptionIds', beverages, b.id)} className="size-3.5 accent-primary" />
                            {b.emoji} {b.name}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Dessert */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <input type="checkbox" checked={mainForm.dessertApplicable} onChange={e => setMainForm(f => ({ ...f, dessertApplicable: e.target.checked }))} className="size-4 accent-primary" />
                    Dessert applicable
                  </label>
                  {mainForm.dessertApplicable && desserts.length > 0 && (
                    <div className="flex flex-wrap gap-2 pl-6">
                      {desserts.map(ds => {
                        const checked = mainForm.dessertOptionIds === null || mainForm.dessertOptionIds.includes(ds.id);
                        return (
                          <label key={ds.id} className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border cursor-pointer ${checked ? 'bg-primary/5 border-primary/30 text-primary' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                            <input type="checkbox" checked={checked} onChange={() => toggleMainOption('dessertOptionIds', desserts, ds.id)} className="size-3.5 accent-primary" />
                            {ds.emoji} {ds.name}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div className="p-4 border-t border-[#E7E0D0] flex items-center justify-end gap-2 shrink-0">
                <button onClick={cancelMainEditor} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 transition-colors">Cancel</button>
                <button onClick={saveMainEditor} disabled={!mainForm.name.trim()} className="px-4 py-2 rounded-xl text-xs font-black bg-primary text-white hover:bg-primary/90 disabled:opacity-40 transition-colors">Save Main</button>
              </div>
            </div>
          </div>
          </Portal>
        )}
      </div>
    );
  };

  const handleSaveLoyaltyTiers = async () => {
    try {
      await updateLoyaltyTiers(loyaltyTiersForm);
      alert('Loyalty tiers saved successfully!');
    } catch (err) {
      console.error('Failed to save loyalty tiers', err);
      alert('Failed to save loyalty tiers. Please try again.');
    }
  };

  const startEditGroup = (g: CustomerGroup) => {
    setEditingGroupId(g.id);
    setGroupForm({ name: g.name, discountPercentage: g.discountPercentage, description: g.description || '' });
  };

  const saveGroupEdit = async () => {
    if (!groupForm.name.trim()) return;
    try {
      const updated = customerGroups.map(g => g.id === editingGroupId ? { ...g, ...groupForm } : g);
      await updateCustomerGroups(updated);
      setEditingGroupId(null);
    } catch (err) {
      console.error('Failed to update group', err);
    }
  };

  const handleDeleteGroup = async (id: string) => {
    if (confirm('Are you sure you want to delete this customer group?')) {
      try {
        await deleteCustomerGroup(id);
      } catch (err) {
        console.error('Failed to delete group', err);
      }
    }
  };

  const handleAddNewGroup = async () => {
    if (!newGroupForm.name.trim()) return;
    try {
      const newGroup: CustomerGroup = {
        id: `g-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        name: newGroupForm.name.trim(),
        discountPercentage: Number(newGroupForm.discountPercentage),
        description: newGroupForm.description.trim(),
        color: 'bg-indigo-600'
      };
      await updateCustomerGroups([...customerGroups, newGroup]);
      setNewGroupForm({ name: '', discountPercentage: 0, description: '' });
    } catch (err) {
      console.error('Failed to add group', err);
    }
  };

  const renderLoyaltyTiersSubTab = () => {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="bg-white rounded-3xl border border-[#E7E0D0] p-8 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-black text-slate-900">Configure Loyalty Tiers</h3>
            <p className="text-xs text-slate-400 font-medium mt-1">
              Adjust points thresholds, point multipliers, standard order discounts, and special birthday discount rates for customers in each tier.
            </p>
          </div>

          <div className="overflow-x-auto border border-[#E7E0D0] rounded-2xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E7E0D0] bg-[#FAF9F5] text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <th className="px-6 py-4">Tier Level</th>
                  <th className="px-6 py-4 text-right">Points Threshold</th>
                  <th className="px-6 py-4 text-right">Points Multiplier</th>
                  <th className="px-6 py-4 text-right">Standard Discount</th>
                  <th className="px-6 py-4 text-right">Birthday Discount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E0D0] font-semibold text-slate-700">
                {loyaltyTiersForm.map((tier, idx) => (
                  <tr key={tier.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 ${tier.color || 'bg-primary'} text-white rounded-full text-[9px] font-black uppercase tracking-wider`}>
                        <Star className="size-2.5 fill-white text-white" /> {tier.name}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end">
                        <input
                          type="number"
                          value={tier.pointsThreshold}
                          onChange={e => {
                            const updated = [...loyaltyTiersForm];
                            updated[idx] = { ...updated[idx], pointsThreshold: Number(e.target.value) };
                            setLoyaltyTiersForm(updated);
                          }}
                          className="w-24 text-right text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end">
                        <input
                          type="number"
                          step="0.1"
                          value={tier.multiplier}
                          onChange={e => {
                            const updated = [...loyaltyTiersForm];
                            updated[idx] = { ...updated[idx], multiplier: Number(e.target.value) };
                            setLoyaltyTiersForm(updated);
                          }}
                          className="w-20 text-right text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end items-center gap-1.5">
                        <input
                          type="number"
                          value={tier.standardDiscount || 0}
                          onChange={e => {
                            const updated = [...loyaltyTiersForm];
                            updated[idx] = { ...updated[idx], standardDiscount: Number(e.target.value) };
                            setLoyaltyTiersForm(updated);
                          }}
                          className="w-16 text-right text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all"
                        />
                        <span className="font-bold text-slate-400">%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end items-center gap-1.5">
                        <input
                          type="number"
                          value={tier.birthdayDiscount || 0}
                          onChange={e => {
                            const updated = [...loyaltyTiersForm];
                            updated[idx] = { ...updated[idx], birthdayDiscount: Number(e.target.value) };
                            setLoyaltyTiersForm(updated);
                          }}
                          className="w-16 text-right text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all"
                        />
                        <span className="font-bold text-slate-400">%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-2 border-t border-slate-100 flex justify-end">
            <button
              onClick={handleSaveLoyaltyTiers}
              className="px-6 py-2.5 bg-primary text-white hover:bg-primary/95 rounded-xl text-xs font-black uppercase tracking-widest shadow-md transition-all cursor-pointer"
            >
              Save Loyalty Tiers
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderCustomerGroupsSubTab = () => {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="bg-white rounded-3xl border border-[#E7E0D0] p-8 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-black text-slate-900">Discount & Customer Groups</h3>
            <p className="text-xs text-slate-400 font-medium mt-1">
              Manage custom groups (such as corporate offices, VIPs, or special networks) that receive set percentages of order discounts.
            </p>
          </div>

          <div className="overflow-x-auto border border-[#E7E0D0] rounded-2xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E7E0D0] bg-[#FAF9F5] text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <th className="px-6 py-4">Group Name</th>
                  <th className="px-6 py-4">Discount Rate</th>
                  <th className="px-6 py-4">Description</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E0D0] font-semibold text-slate-700">
                {customerGroups.map(group => {
                  const isEditing = editingGroupId === group.id;
                  if (isEditing) {
                    return (
                      <tr key={group.id} className="bg-primary/[0.02]">
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            value={groupForm.name}
                            onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))}
                            className="w-full text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-white"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              value={groupForm.discountPercentage}
                              onChange={e => setGroupForm(f => ({ ...f, discountPercentage: Number(e.target.value) }))}
                              className="w-16 text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-white"
                            />
                            <span className="font-bold text-slate-500">%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            value={groupForm.description}
                            onChange={e => setGroupForm(f => ({ ...f, description: e.target.value }))}
                            className="w-full text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-white"
                          />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={saveGroupEdit} className="p-1 bg-primary text-white rounded-lg"><Check className="size-3.5" /></button>
                            <button onClick={() => setEditingGroupId(null)} className="p-1 bg-slate-100 text-slate-400 rounded-lg"><X className="size-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={group.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900">{group.name}</td>
                      <td className="px-6 py-4 font-black text-primary">{group.discountPercentage}%</td>
                      <td className="px-6 py-4 text-slate-500 font-medium">{group.description || '-'}</td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 font-normal">
                          <button onClick={() => startEditGroup(group)} className="p-1.5 text-primary hover:bg-[#FAF9F5] rounded-lg transition-all cursor-pointer"><Edit3 className="size-3.5" /></button>
                          <button onClick={() => handleDeleteGroup(group.id)} className="p-1.5 text-danger hover:bg-danger/5 rounded-lg transition-all cursor-pointer"><Trash2 className="size-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Add New Group Section */}
          <div className="p-6 bg-[#FAF9F5] rounded-2xl border border-[#E7E0D0] space-y-4">
            <h4 className="text-[10px] font-black text-slate-950 uppercase tracking-widest pb-1 border-b border-[#E7E0D0]">Add New Group</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Group Name</label>
                <input
                  type="text"
                  placeholder="e.g. ABC Motors"
                  value={newGroupForm.name}
                  onChange={e => setNewGroupForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Discount Rate (%)</label>
                <input
                  type="number"
                  placeholder="e.g. 10"
                  value={newGroupForm.discountPercentage || ''}
                  onChange={e => setNewGroupForm(f => ({ ...f, discountPercentage: Number(e.target.value) }))}
                  className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-white"
                />
              </div>

              <div className="space-y-1 md:col-span-1">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Description</label>
                <input
                  type="text"
                  placeholder="Staff discount group"
                  value={newGroupForm.description}
                  onChange={e => setNewGroupForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-white"
                />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={handleAddNewGroup}
                disabled={!newGroupForm.name.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white hover:bg-primary/95 disabled:opacity-40 rounded-xl text-xs font-black uppercase tracking-widest transition-colors cursor-pointer"
              >
                <Plus className="size-4" /> Add Group
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTransactionsTab = () => {
    // 1. Compile all transaction rows from ACTIVE_ORDERS
    const rows: {
      orderId: string;
      timestamp: string;
      deliveryDate: string;
      customerName: string;
      customerPhone: string;
      itemName: string;
      notes?: string;
      qty: number;
      price: number;
      itemTotal: number;
      discount: number;
      discountReason: string;
      vat: number;
      totalWithTax: number;
      paymentStatus: string;
      paymentMethod: string;
      paymentRef: string;
      deliveryStatus: string;
      rating?: number;
      ratingComment?: string;
      serviceSlot: string;
    }[] = [];

    orders.forEach(o => {
      o.items.forEach(item => {
        const cust = getCustomer(o.customerName);
        const itemTotal = item.price * item.qty;
        
        // Calculate proportional discounts & VAT
        const proportion = o.total > 0 ? (itemTotal / o.total) : 0;
        const itemDiscount = (o.discount || 0) * proportion;
        const itemVat = (o.vat || 0) * proportion;
        const itemNetTotal = itemTotal - itemDiscount + itemVat;

        rows.push({
          orderId: o.id,
          timestamp: o.timestamp,
          deliveryDate: item.deliveryDate || item.deliveryDay || '',
          customerName: o.customerName,
          customerPhone: cust?.phone || '',
          itemName: item.name,
          notes: item.notes,
          qty: item.qty,
          price: item.price,
          itemTotal: itemTotal,
          discount: itemDiscount,
          discountReason: o.discountReason || '',
          vat: itemVat,
          totalWithTax: itemNetTotal,
          paymentStatus: item.paymentStatus || o.paymentStatus || 'Pending',
          paymentMethod: item.paymentMethodName || o.paymentMethodName || '',
          paymentRef: item.paymentReference || '',
          deliveryStatus: item.status || 'Active',
          rating: item.rating,
          ratingComment: item.ratingComment,
          serviceSlot: item.serviceSlot || 'Lunch'
        });
      });
    });

    // Sort: newest delivery date first, then newest order timestamp first
    rows.sort((a, b) => b.deliveryDate.localeCompare(a.deliveryDate) || b.timestamp.localeCompare(a.timestamp));

    // 2. Apply filters
    const filteredRows = rows.filter(r => {
      // Fuzzy search
      if (txSearch.trim()) {
        const q = txSearch.toLowerCase();
        const matchCust = r.customerName.toLowerCase().includes(q);
        const matchId = r.orderId.toLowerCase().includes(q);
        const matchItem = r.itemName.toLowerCase().includes(q);
        if (!matchCust && !matchId && !matchItem) return false;
      }

      // Service slot
      if (txServiceSlot !== 'All' && r.serviceSlot !== txServiceSlot) return false;

      // Payment status
      if (txPaymentStatus !== 'All' && r.paymentStatus !== txPaymentStatus) return false;

      // Delivery status
      if (txDeliveryStatus !== 'All' && r.deliveryStatus !== txDeliveryStatus) return false;

      // Ratings
      if (txRatingFilter !== 'All') {
        if (txRatingFilter === 'Rated' && r.rating === undefined) return false;
        if (txRatingFilter === 'Unrated' && r.rating !== undefined) return false;
        if (txRatingFilter === '5star' && r.rating !== 5) return false;
        if (txRatingFilter === 'LowRating' && (r.rating === undefined || r.rating > 3)) return false;
      }

      // Date filters
      if (txDateRange === 'Today') {
        if (r.deliveryDate !== systemDate) return false;
      } else if (txDateRange === 'ThisWeek') {
        const days = getThisWeekDays(systemDate).map(d => d.date);
        if (!days.includes(r.deliveryDate)) return false;
      } else if (txDateRange === 'Custom') {
        if (txCustomStart && r.deliveryDate < txCustomStart) return false;
        if (txCustomEnd && r.deliveryDate > txCustomEnd) return false;
      }

      return true;
    });

    // 3. Totals summation for filtered set
    const totals = filteredRows.reduce((acc, curr) => {
      acc.qty += curr.qty;
      acc.subtotal += curr.itemTotal;
      acc.discount += curr.discount;
      acc.vat += curr.vat;
      acc.net += curr.totalWithTax;
      return acc;
    }, { qty: 0, subtotal: 0, discount: 0, vat: 0, net: 0 });

    return (
      <div className="space-y-6 animate-fade-in pb-16">
        {/* Header and Export controls */}
        <div className="flex items-center justify-between gap-4 flex-wrap bg-white rounded-3xl border border-[#E7E0D0] p-6 shadow-sm">
          <div className="space-y-1">
            <h2 className="text-base font-black text-slate-900">Transactions Ledger</h2>
            <p className="text-xs text-slate-400 font-medium">View, filter, and export detailed transaction data, itemized totals, and customer reviews.</p>
          </div>
          <button
            type="button"
            onClick={() => exportTransactionsCSV(filteredRows)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-primary/95 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <Download className="size-4" /> Export Filtered to CSV
          </button>
        </div>

        {/* Filters Panel */}
        <div className="bg-white rounded-3xl border border-[#E7E0D0] p-6 shadow-sm space-y-4">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 flex items-center gap-1">Filter Ledger Details</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* Search Input */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-3.5 size-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Customer, Order ID, Dish..."
                  value={txSearch}
                  onChange={e => setTxSearch(e.target.value)}
                  className="w-full text-xs font-bold pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all placeholder-slate-400"
                />
              </div>
            </div>

            {/* Date Range Selector */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Delivery Date Range</label>
              <select
                value={txDateRange}
                onChange={e => setTxDateRange(e.target.value as any)}
                className="w-full text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all"
              >
                <option value="All">All History</option>
                <option value="Today">Today Only</option>
                <option value="ThisWeek">This Week Only</option>
                <option value="Custom">Custom Range...</option>
              </select>
            </div>

            {/* Service Type */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Service</label>
              <select
                value={txServiceSlot}
                onChange={e => setTxServiceSlot(e.target.value as any)}
                className="w-full text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all"
              >
                <option value="All">All Services</option>
                <option value="Lunch">Lunch</option>
                <option value="Dinner">Dinner</option>
              </select>
            </div>

            {/* Payment Status */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Payment Status</label>
              <select
                value={txPaymentStatus}
                onChange={e => setTxPaymentStatus(e.target.value as any)}
                className="w-full text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all"
              >
                <option value="All">All Payments</option>
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
                <option value="Refunded">Refunded</option>
              </select>
            </div>

            {/* Delivery Status */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Delivery Status</label>
              <select
                value={txDeliveryStatus}
                onChange={e => setTxDeliveryStatus(e.target.value as any)}
                className="w-full text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all"
              >
                <option value="All">All Deliveries</option>
                <option value="Active">Active</option>
                <option value="Preparing">Preparing</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            {/* Rating and Reviews Filter */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Customer Rating</label>
              <select
                value={txRatingFilter}
                onChange={e => setTxRatingFilter(e.target.value as any)}
                className="w-full text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all"
              >
                <option value="All">All Ratings</option>
                <option value="Rated">Rated Only</option>
                <option value="Unrated">Unrated Only</option>
                <option value="5star">5 Star Reviews</option>
                <option value="LowRating">Needs Attention (≤ 3 stars)</option>
              </select>
            </div>

            {/* Custom Date Pickers */}
            {txDateRange === 'Custom' && (
              <>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Start Date</label>
                  <input
                    type="date"
                    value={txCustomStart}
                    onChange={e => setTxCustomStart(e.target.value)}
                    className="w-full text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">End Date</label>
                  <input
                    type="date"
                    value={txCustomEnd}
                    onChange={e => setTxCustomEnd(e.target.value)}
                    className="w-full text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Totals Summary Card Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-2xl border border-[#E7E0D0] p-4 shadow-sm">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Rows Filtered</p>
            <h4 className="text-base font-black text-slate-900">{filteredRows.length} items</h4>
          </div>
          <div className="bg-white rounded-2xl border border-[#E7E0D0] p-4 shadow-sm">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Subtotal Sum</p>
            <h4 className="text-base font-black text-slate-900">Rs {totals.subtotal.toFixed(2)}</h4>
          </div>
          <div className="bg-white rounded-2xl border border-[#E7E0D0] p-4 shadow-sm">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Discounts Sum</p>
            <h4 className="text-base font-black text-danger">-{totals.discount.toFixed(2)}</h4>
          </div>
          <div className="bg-white rounded-2xl border border-[#E7E0D0] p-4 shadow-sm">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">VAT Sum</p>
            <h4 className="text-base font-black text-slate-500">Rs {totals.vat.toFixed(2)}</h4>
          </div>
          <div className="bg-white rounded-2xl border border-[#E7E0D0] p-4 shadow-sm col-span-2 md:col-span-1">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Net Total (Revenue)</p>
            <h4 className="text-base font-black text-success">Rs {totals.net.toFixed(2)}</h4>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white rounded-[32px] border border-[#E7E0D0] shadow-sm overflow-hidden">
          {filteredRows.length === 0 ? (
            <EmptyState icon={<FileSpreadsheet className="size-10" />} label="No matching transactions found" />
          ) : (
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-[#E7E0D0] text-slate-400 font-black uppercase tracking-wider sticky top-0 z-10">
                    <th className="px-5 py-4 min-w-[90px]">Order ID</th>
                    <th className="px-5 py-4 min-w-[100px]">Delivery Date</th>
                    <th className="px-5 py-4 min-w-[70px]">Service</th>
                    <th className="px-5 py-4 min-w-[120px]">Customer</th>
                    <th className="px-5 py-4 min-w-[160px]">Dish / Details</th>
                    <th className="px-5 py-4 text-right min-w-[80px]">Price</th>
                    <th className="px-5 py-4 text-right min-w-[80px]">Net Total</th>
                    <th className="px-5 py-4 text-center min-w-[100px]">Payment</th>
                    <th className="px-5 py-4 text-center min-w-[90px]">Delivery</th>
                    <th className="px-5 py-4 min-w-[120px]">Rating & Feedback</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E0D0]/60 font-bold text-slate-700">
                  {filteredRows.map((r, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3 font-mono text-[10px] text-slate-400 uppercase">
                        #{r.orderId.slice(0, 8)}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        {r.deliveryDate ? new Date(r.deliveryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : 'N/A'}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${r.serviceSlot === 'Dinner' ? 'bg-accent/10 text-accent' : 'bg-primary/10 text-primary'}`}>
                          {r.serviceSlot}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-black text-slate-900">{r.customerName}</p>
                        <p className="text-[10px] text-slate-400 font-normal">{r.customerPhone}</p>
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-slate-900">{r.qty}x {r.itemName}</p>
                        {r.notes && (
                          <div className="space-y-1 mt-0.5">
                            {(() => {
                              const { detail, person, instructions } = splitNotesTag(r.notes);
                              return (
                                <>
                                  {detail && <p className="text-[9px] text-slate-400 font-normal leading-snug">↳ {detail}</p>}
                                  <div className="flex flex-wrap gap-1 mt-0.5">
                                    {person && <PersonTag name={person} />}
                                    {instructions && <InstructionsTag text={instructions} />}
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        Rs {r.price}
                      </td>
                      <td className="px-5 py-3 text-right font-black text-slate-950">
                        Rs {r.totalWithTax.toFixed(2)}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                            r.paymentStatus === 'Paid' ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'
                          }`}>
                            {r.paymentStatus}
                          </span>
                          {r.paymentMethod && (
                            <span className="text-[9px] text-slate-400 font-medium leading-none">
                              {r.paymentMethod} {r.paymentRef ? `(Ref: ${r.paymentRef.slice(0, 6)})` : ''}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          r.deliveryStatus === 'Completed' || r.deliveryStatus === 'Delivered'
                            ? 'bg-success/15 text-success'
                            : r.deliveryStatus === 'Cancelled'
                            ? 'bg-slate-200 text-slate-500'
                            : 'bg-primary/15 text-primary'
                        }`}>
                          {r.deliveryStatus}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {r.rating !== undefined ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-0.5">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={`size-3 ${i < r.rating! ? 'fill-warning text-warning' : 'text-slate-200'}`}
                                />
                              ))}
                            </div>
                            {r.ratingComment && (
                              <p className="text-[10px] text-slate-500 font-medium italic leading-snug break-words max-w-[150px]">
                                "{r.ratingComment}"
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 italic font-normal">No rating yet</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderSettingsTab = () => {
    return (
      <div className="space-y-8 animate-fade-in pb-24">
        {/* Sub-tabs Selector Row */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 rounded-2xl p-1.5 w-fit">
          {(['identity', 'delivery', 'tax', 'loyalty', 'groups', 'icons', 'danger'] as const).map(t => {
            const labels: Record<typeof t, string> = {
              identity: 'Identity',
              delivery: 'Delivery & Cut-offs',
              tax: 'Tax & Offerings',
              loyalty: 'Loyalty Tiers',
              groups: 'Customer Groups',
              icons: 'Icon Library',
              danger: 'Danger Zone'
            };
            return (
              <button
                key={t}
                onClick={() => setSettingsSubTab(t)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${settingsSubTab === t ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {labels[t]}
              </button>
            );
          })}
        </div>

        {settingsSubTab === 'icons' && (
          <div className="bg-white rounded-3xl border border-[#E7E0D0] p-8 shadow-sm space-y-6">
            {opsActionError && (
              <div className="bg-danger/10 text-danger text-xs font-bold rounded-xl px-4 py-3 flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0" /> {opsActionError}
              </div>
            )}
            <div>
              <h3 className="text-base font-black text-slate-900">Icon Library</h3>
              <p className="text-xs text-slate-400 font-medium mt-1">
                The emoji set every icon-picker modal in Operations searches — a Main's icon, an Add-on Catalog entry's icon. Add, rename, or remove entries here; nothing here is shown to customers directly.
              </p>
            </div>

            <div className="overflow-x-auto border border-[#E7E0D0] rounded-2xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E7E0D0] bg-[#FAF9F5] text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <th className="px-6 py-4 w-20">Icon</th>
                    <th className="px-6 py-4">Label</th>
                    <th className="px-6 py-4 text-center w-28">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E0D0] font-semibold text-slate-700">
                  {icons.map(icon => {
                    const isEditing = editingIcon === icon.id;
                    if (isEditing) {
                      return (
                        <tr key={icon.id} className="bg-primary/[0.02]">
                          <td className="px-6 py-4">
                            <input
                              value={iconForm.emoji}
                              onChange={e => setIconForm(f => ({ ...f, emoji: e.target.value }))}
                              className="w-12 text-center text-base px-1 py-1.5 rounded-lg border border-slate-200 outline-none bg-white font-bold"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <input
                              value={iconForm.label}
                              onChange={e => setIconForm(f => ({ ...f, label: e.target.value }))}
                              className="w-full text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 outline-none bg-white"
                            />
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button onClick={saveIconEdit} className="p-1 bg-primary text-white rounded-lg"><Check className="size-3.5" /></button>
                              <button onClick={() => setEditingIcon(null)} className="p-1 bg-slate-100 text-slate-400 rounded-lg"><X className="size-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={icon.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 text-lg">{icon.emoji}</td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-900">{icon.label}</td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-1.5 font-normal">
                            <button onClick={() => startEditIcon(icon)} className="p-1.5 text-primary hover:bg-[#FAF9F5] rounded-lg transition-all cursor-pointer"><Edit3 className="size-3.5" /></button>
                            <button onClick={() => runMenuWrite(removeIconEntry(icon.id))} className="p-1.5 text-danger hover:bg-danger/5 rounded-lg transition-all cursor-pointer"><Trash2 className="size-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Add New Icon Section */}
            <div className="p-6 bg-[#FAF9F5] rounded-2xl border border-[#E7E0D0] space-y-4">
              <h4 className="text-[10px] font-black text-slate-950 uppercase tracking-widest pb-1 border-b border-[#E7E0D0]">Add New Icon</h4>
              <div className="flex items-center gap-2">
                <input value={newIconForm.emoji} onChange={e => setNewIconForm(f => ({ ...f, emoji: e.target.value }))} placeholder="🍽️" className="w-14 text-center text-lg px-1 py-2 rounded-xl border border-slate-200 outline-none" />
                <input value={newIconForm.label} onChange={e => setNewIconForm(f => ({ ...f, label: e.target.value }))} placeholder="Label (e.g. Chicken)" className="flex-1 text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20" />
                <button
                  onClick={saveNewIcon}
                  disabled={!newIconForm.emoji.trim() || !newIconForm.label.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white hover:bg-primary/95 disabled:opacity-40 rounded-xl text-xs font-black uppercase tracking-widest transition-colors cursor-pointer shrink-0"
                >
                  <Plus className="size-4 shrink-0" /> Add Icon
                </button>
              </div>
            </div>
          </div>
        )}

        {settingsSubTab === 'loyalty' && renderLoyaltyTiersSubTab()}

        {settingsSubTab === 'groups' && renderCustomerGroupsSubTab()}

        {settingsSubTab === 'identity' && (
          <div className="bg-white rounded-3xl border border-[#E7E0D0] p-8 shadow-sm space-y-6">
            <div>
              <h3 className="text-base font-black text-slate-900">Brand Identity & Support Contact</h3>
              <p className="text-xs text-slate-400 font-medium mt-1">
                Configure the default brand identity and contact information displayed to customers in the support section.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Business Name</label>
                <input
                  type="text"
                  value={brandForm.name}
                  onChange={e => setBrandForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Tagline</label>
                <input
                  type="text"
                  value={brandForm.tagline}
                  onChange={e => setBrandForm(f => ({ ...f, tagline: e.target.value }))}
                  className="w-full text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Business Logo</label>
                <div className="flex items-center gap-4">
                  {brandForm.logoUrl ? (
                    <img src={brandForm.logoUrl} alt="Logo Preview" className="size-14 rounded-xl object-cover border border-[#E7E0D0] bg-slate-50 shrink-0" />
                  ) : (
                    <div className="size-14 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                      <ImagePlus className="size-5" />
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => logoFileInputRef.current?.click()}
                      className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors"
                    >
                      {brandForm.logoUrl ? 'Change Logo' : 'Upload Logo'}
                    </button>
                    {brandForm.logoUrl && (
                      <button
                        type="button"
                        onClick={() => setBrandForm(f => ({ ...f, logoUrl: '' }))}
                        className="px-4 py-2 text-xs font-bold rounded-xl border border-red-100 bg-red-50 hover:bg-red-100 text-red-500 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                    <p className="text-[10px] text-slate-400 font-medium">PNG, JPG or WebP · max 1.5 MB</p>
                    {logoError && <p className="text-[10px] text-red-500 font-bold">{logoError}</p>}
                  </div>
                  <input ref={logoFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFileChange} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Support Phone (WhatsApp Link Only)</label>
                <input
                  type="text"
                  value={brandForm.supportPhone}
                  onChange={e => setBrandForm(f => ({ ...f, supportPhone: e.target.value }))}
                  placeholder="59412131"
                  className="w-full text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Support Email Address</label>
                <input
                  type="email"
                  value={brandForm.supportEmail}
                  onChange={e => setBrandForm(f => ({ ...f, supportEmail: e.target.value }))}
                  placeholder="bhimalonly@gmail.com"
                  className="w-full text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all"
                />
              </div>
            </div>
          </div>
        )}

        {settingsSubTab === 'delivery' && (
          <div className="bg-white rounded-3xl border border-[#E7E0D0] p-8 shadow-sm space-y-6">
            <div>
              <h3 className="text-base font-black text-slate-900">Delivery Rules & Order Cutoffs</h3>
              <p className="text-xs text-slate-400 font-medium mt-1">
                Set the rules for lock times and delivery schedule slots to enforce cutoff gates in the customer checkout wizard.
              </p>
            </div>
            
            <div className="space-y-6">
              {/* Lunch Service Cutoffs */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-primary uppercase tracking-widest pb-1.5 border-b border-slate-100">☀️ Lunch Service Cut-offs</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Lunch Ordering Cutoff Time (e.g. 12:00)</label>
                    <input
                      type="text"
                      value={deliveryForm.lunchOrderCutoffTime}
                      onChange={e => setDeliveryForm(f => ({ ...f, lunchOrderCutoffTime: e.target.value }))}
                      className="w-full text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Lunch Ordering Offset Days (-1 = day before, 0 = same day)</label>
                    <input
                      type="number"
                      value={deliveryForm.lunchOrderCutoffDayOffset}
                      onChange={e => setDeliveryForm(f => ({ ...f, lunchOrderCutoffDayOffset: e.target.value }))}
                      className="w-full text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Lunch Cancel/Edit Cutoff Time (e.g. 09:00)</label>
                    <input
                      type="text"
                      value={deliveryForm.lunchCancelCutoffTime}
                      onChange={e => setDeliveryForm(f => ({ ...f, lunchCancelCutoffTime: e.target.value }))}
                      className="w-full text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Lunch Cancel/Edit Offset Days (0 = same day)</label>
                    <input
                      type="number"
                      value={deliveryForm.lunchCancelCutoffDayOffset}
                      onChange={e => setDeliveryForm(f => ({ ...f, lunchCancelCutoffDayOffset: e.target.value }))}
                      className="w-full text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Dinner Service Cutoffs */}
              {dinnerEnabled && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <h4 className="text-xs font-black text-primary uppercase tracking-widest pb-1.5 border-b border-slate-100">🌙 Dinner Service Cut-offs</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Dinner Ordering Cutoff Time (e.g. 12:00)</label>
                      <input
                        type="text"
                        value={deliveryForm.dinnerOrderCutoffTime}
                        onChange={e => setDeliveryForm(f => ({ ...f, dinnerOrderCutoffTime: e.target.value }))}
                        className="w-full text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Dinner Ordering Offset Days (-1 = day before, 0 = same day)</label>
                      <input
                        type="number"
                        value={deliveryForm.dinnerOrderCutoffDayOffset}
                        onChange={e => setDeliveryForm(f => ({ ...f, dinnerOrderCutoffDayOffset: e.target.value }))}
                        className="w-full text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Dinner Cancel/Edit Cutoff Time (e.g. 14:00)</label>
                      <input
                        type="text"
                        value={deliveryForm.dinnerCancelCutoffTime}
                        onChange={e => setDeliveryForm(f => ({ ...f, dinnerCancelCutoffTime: e.target.value }))}
                        className="w-full text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Dinner Cancel/Edit Offset Days (0 = same day)</label>
                      <input
                        type="number"
                        value={deliveryForm.dinnerCancelCutoffDayOffset}
                        onChange={e => setDeliveryForm(f => ({ ...f, dinnerCancelCutoffDayOffset: e.target.value }))}
                        className="w-full text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[#E7E0D0]">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Lunch Delivery Window (Info Text)</label>
                <input
                  type="text"
                  value={deliveryForm.lunchDeliveryWindow}
                  onChange={e => setDeliveryForm(f => ({ ...f, lunchDeliveryWindow: e.target.value }))}
                  className="w-full text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Dinner Delivery Window (Info Text)</label>
                <input
                  type="text"
                  value={deliveryForm.dinnerDeliveryWindow}
                  onChange={e => setDeliveryForm(f => ({ ...f, dinnerDeliveryWindow: e.target.value }))}
                  className="w-full text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all"
                />
              </div>
            </div>
          </div>
        )}

        {settingsSubTab === 'tax' && (
          <div className="bg-white rounded-3xl border border-[#E7E0D0] p-8 shadow-sm space-y-6 animate-fade-in">
            <div>
              <h3 className="text-base font-black text-slate-900">Offerings, Tax & Discounts</h3>
              <p className="text-xs text-slate-400 font-medium mt-1">
                Configure menu offerings, taxes, and system-wide discounts.
              </p>
            </div>
            <div className="space-y-6">
              {/* Dinner offering */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h4 className="text-xs font-black text-slate-900">Dinner Offering</h4>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">Enables dinner curries as separate selections on the Customer Menu.</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleDinner(!dinnerEnabled)}
                  className={`relative w-12 h-7 rounded-full transition-colors ${dinnerEnabled ? 'bg-primary' : 'bg-slate-200'}`}
                >
                  <span className={`absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform ${dinnerEnabled ? 'translate-x-5' : ''}`} />
                </button>
              </div>

              {/* Bulk Week Discount */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h4 className="text-xs font-black text-slate-900">Bulk Week Discount</h4>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">Enables a weekly discount when a customer purchases a lunch meal for all 5 weekdays.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setBulkDiscountEnabled(!bulkDiscountEnabled)}
                  className={`relative w-12 h-7 rounded-full transition-colors ${bulkDiscountEnabled ? 'bg-primary' : 'bg-slate-200'}`}
                >
                  <span className={`absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform ${bulkDiscountEnabled ? 'translate-x-5' : ''}`} />
                </button>
              </div>

              {bulkDiscountEnabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 pb-4 border-b border-slate-100 animate-in slide-in-from-top-2 duration-200">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Bulk Discount Rate (%)</label>
                    <input
                      type="text"
                      value={bulkDiscountRateInput}
                      onChange={e => setBulkDiscountRateInput(e.target.value)}
                      className="w-full text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all"
                    />
                  </div>
                </div>
              )}

              {/* VAT enabled */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h4 className="text-xs font-black text-slate-900">MRA VAT Charging</h4>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">Toggles VAT calculations and display on invoice receipts.</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleVat(!vatEnabled)}
                  className={`relative w-12 h-7 rounded-full transition-colors ${vatEnabled ? 'bg-primary' : 'bg-slate-200'}`}
                >
                  <span className={`absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform ${vatEnabled ? 'translate-x-5' : ''}`} />
                </button>
              </div>

              {vatEnabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 animate-in slide-in-from-top-2 duration-200">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">VAT Rate (%)</label>
                    <input
                      type="text"
                      value={vatRateInput}
                      onChange={e => setVatRateInput(e.target.value)}
                      className="w-full text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">VAT Registration Number (VRN)</label>
                    <input
                      type="text"
                      value={vatNumberInput}
                      onChange={e => setVatNumberInput(e.target.value)}
                      className="w-full text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {settingsSubTab === 'danger' && (
          <div className="bg-white rounded-3xl border border-red-200 p-8 shadow-sm space-y-5">
            <div>
              <h3 className="text-base font-black text-red-600">Danger Zone</h3>
              <p className="text-xs text-slate-400 font-medium mt-1">
                Wipes test/demo data clean before going live. Does not touch the Meal Library, Menu Planner, or any Settings above — only order history and customer loyalty balances.
              </p>
            </div>
            {dangerResetDone && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3">
                <p className="text-[11px] font-bold text-emerald-700">All orders cleared, and every customer's points and store credit reset to Rs 0.</p>
                <button onClick={() => setDangerResetDone(false)} className="p-1 text-emerald-600 hover:text-emerald-800 shrink-0"><X className="size-3.5" /></button>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-slate-100 pt-5">
              <div>
                <h4 className="text-xs font-black text-slate-900">Clear all orders & reset customer loyalty</h4>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5 max-w-md">
                  Permanently deletes every order (Orders by Dish, Delivery List, Payments all go empty) and zeroes every customer's points and store credit. Customer records, addresses, and tiers are kept. Cannot be undone.
                </p>
              </div>
              <button
                type="button"
                onClick={() => dangerConfirm === 'reset' ? handleDangerReset() : setDangerConfirm('reset')}
                onBlur={() => setDangerConfirm(null)}
                className={`shrink-0 px-4 py-2.5 rounded-xl text-xs font-black transition-colors ${dangerConfirm === 'reset' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'}`}
              >
                {dangerConfirm === 'reset' ? 'Confirm — this cannot be undone' : 'Clear orders & reset loyalty'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const closePaymentModal = () => {
    setPaymentDrop(null);
    setConfirmPaymentId(null);
  };

  const [y, m, d] = weekDays[0].date.split('-').map(Number);
  const deliveryWeekDateStr = new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  // Staff login gate — every read/write below this point talks to
  // Firestore collections gated by firestore.rules' isStaffAllowed()/
  // isActiveStaff(), which require request.auth.uid to resolve to an
  // active staff/{uid} doc. Safe to early-return here: every hook in this
  // component (useState/useEffect/useMemo) is declared above, unconditionally,
  // so React's rules of hooks are satisfied regardless of which branch below
  // actually renders.
  if (staffAuthChecking) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-[#FAF6EE]">
        <Loader2 className="size-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!staffAuthUser) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-[#FAF6EE] p-6">
        <div className="max-w-sm w-full bg-white rounded-[32px] border border-[#E7E0D0] shadow-sm p-8">
          <div className="size-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-4">
            <LayoutDashboard className="size-6" />
          </div>
          <h1 className="text-lg font-black text-slate-900 mb-1">Staff Sign In</h1>
          <p className="text-xs text-slate-500 font-medium mb-6">Sign in with your BonManzE staff account to open Operations.</p>
          <form onSubmit={handleStaffLogin} className="space-y-3">
            <input
              type="email"
              autoComplete="username"
              placeholder="Email"
              value={staffLoginEmail}
              onChange={e => setStaffLoginEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
              required
            />
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              value={staffLoginPassword}
              onChange={e => setStaffLoginPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
              required
            />
            {staffAuthError && (
              <p className="text-xs font-bold text-rose-600 flex items-center gap-1.5">
                <AlertCircle className="size-3.5 shrink-0" /> {staffAuthError}
              </p>
            )}
            <button
              type="submit"
              disabled={staffAuthLoading}
              className="w-full py-3 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-md hover:bg-primary/95 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {staffAuthLoading ? <Loader2 className="size-4 animate-spin" /> : null}
              {staffAuthLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          <button onClick={onExit} className="w-full mt-4 text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors">
            Back to home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex bg-[#FAF6EE] text-slate-800 font-sans overflow-hidden">
      {/* PERSISTENT LEFT SIDEBAR */}
      <aside className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-white border-r border-[#E7E0D0] flex flex-col shrink-0 transition-all duration-200`}>
        {/* Sidebar Header */}
        <div className="h-[72px] shrink-0 px-3 border-b border-[#E7E0D0] flex items-center justify-between">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-3 min-w-0">
              {SYSTEM_CONFIG.businessLogoUrl ? (
                <img src={SYSTEM_CONFIG.businessLogoUrl} alt="Logo" className="size-8 rounded-lg object-cover shadow-sm animate-fade-in shrink-0" />
              ) : (
                <div className="size-8 bg-primary rounded-lg flex items-center justify-center text-white font-black text-sm shrink-0">
                  {(brandForm.name || 'B').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-xs font-black text-slate-900 leading-none truncate">{brandForm.name || SYSTEM_CONFIG.businessName}</h2>
                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black mt-0.5">Operations</p>
              </div>
            </div>
          )}
          {sidebarCollapsed && (
            <div className="flex-1 flex justify-center">
              {SYSTEM_CONFIG.businessLogoUrl ? (
                <img src={SYSTEM_CONFIG.businessLogoUrl} alt="Logo" className="size-8 rounded-lg object-cover shadow-sm" />
              ) : (
                <div className="size-8 bg-primary rounded-lg flex items-center justify-center text-white font-black text-sm">
                  {(brandForm.name || 'B').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          )}
          <div className="flex items-center gap-1 shrink-0">
            {!sidebarCollapsed && (
              <button onClick={handleStaffSignOut} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-colors" title="Sign Out">
                <LogOut className="size-4" />
              </button>
            )}
            <button
              onClick={() => setSidebarCollapsed(c => !c)}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            </button>
          </div>
        </div>

        {/* Navigation Section */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {!sidebarCollapsed && <p className="px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 mt-2">Operations</p>}
          {sidebarCollapsed && <div className="h-4" />}
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              title={sidebarCollapsed ? t.label : undefined}
              className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                tab === t.id
                  ? `text-primary bg-primary/[0.04] ${sidebarCollapsed ? '' : 'border-l-4 border-primary'} shadow-[0_4px_12px_rgba(62,125,34,0.04)]`
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <t.icon className="size-4 shrink-0" />
              {!sidebarCollapsed && <span>{t.label}</span>}
            </button>
          ))}

          <div className="pt-4">
            {!sidebarCollapsed && <p className="px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Configuration</p>}
            <button
              onClick={() => setTab('settings')}
              title={sidebarCollapsed ? 'Settings' : undefined}
              className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                tab === 'settings'
                  ? `text-primary bg-primary/[0.04] ${sidebarCollapsed ? '' : 'border-l-4 border-primary'} shadow-[0_4px_12px_rgba(62,125,34,0.04)]`
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <SettingsIcon className="size-4 shrink-0" />
              {!sidebarCollapsed && <span>Settings</span>}
            </button>
          </div>
        </nav>

        {/* Testing Controls — hidden when collapsed */}
        {!sidebarCollapsed && (
          <div className="p-4 border-t border-[#E7E0D0] bg-[#FAF8F1]">
            <p className="text-[9px] font-black text-[#B4703A] uppercase tracking-widest mb-1.5">⚡ Testing Controls</p>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 bg-white border border-[#E7E0D0] rounded-lg px-2.5 py-1.5 text-xs text-slate-600">
                <Calendar className="size-3.5 shrink-0 text-slate-400" />
                <input
                  type="date"
                  value={systemDate}
                  onChange={(e) => updateSystemDate(e.target.value)}
                  className="bg-transparent outline-none font-mono text-[11px] w-full"
                  title="Sets what counts as 'today' across BonManzE"
                />
              </div>
              <button
                onClick={() => {
                  const now = new Date();
                  const realISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                  updateSystemDate(realISO);
                }}
                className="w-full py-1 bg-white border border-[#E7E0D0] hover:bg-slate-50 text-[10px] font-bold text-slate-500 rounded transition-colors"
              >
                Reset to Real Today
              </button>
            </div>
          </div>
        )}
        {sidebarCollapsed && (
          <div className="p-2 border-t border-[#E7E0D0]">
            <button
              onClick={handleStaffSignOut}
              className="w-full p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-colors flex justify-center"
              title="Sign Out"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        )}
      </aside>

      {/* MAIN VIEW AREA */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Header */}
        <header className="h-[72px] shrink-0 bg-white border-b border-[#E7E0D0] px-8 flex items-center justify-between z-10 shadow-sm">
          <div>
            <h1 className="text-base font-black text-slate-900 tracking-tight leading-none">
              {tab === 'settings' ? 'System Settings' : TABS.find(t => t.id === tab)?.label || tab}
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
              {tab === 'settings' ? 'Configure Branding, Cutoffs, and Finance Rules' : 'Kitchen & Delivery Console'}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Active Test Date Banner */}
            {systemDate !== getRealTodayISO() && (
              <div className="bg-[#B4703A]/10 border border-[#B4703A]/20 text-[#B4703A] px-3.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-2">
                <span>⚠️ Testing date active: <strong>{systemDate}</strong></span>
                <button
                  onClick={() => updateSystemDate(getRealTodayISO())}
                  className="underline hover:text-[#B4703A]/80 font-black cursor-pointer"
                >
                  Reset
                </button>
              </div>
            )}
            
            {/* Load time stamp for sync visibility */}
            <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-[#E7E0D0]">
              <Clock className="size-3" />
              <span>Data loaded as of {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</span>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-6">
          {tab === 'dashboard' && renderDashboard()}
          
          {tab === 'menu' && renderMenuTab()}

          {tab === 'library' && renderLibraryTab()}

          {tab === 'orders' && (
            <div className="space-y-4">
              {/* Filter bar */}
              <div className="bg-white border border-[#E7E0D0] rounded-2xl p-4 shadow-sm space-y-3">
                {/* Week toggle */}
                <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
                  {(['this', 'next'] as const).map(w => (
                    <button
                      key={w}
                      onClick={() => { setOrdersWeekFilter(w); setOrdersDayFilter('all'); }}
                      className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        ordersWeekFilter === w ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {w === 'this' ? 'This week' : 'Next week'}
                    </button>
                  ))}
                </div>
                {/* Day filter */}
                <div className="flex gap-1 overflow-x-auto">
                  <button
                    onClick={() => setOrdersDayFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                      ordersDayFilter === 'all' ? 'bg-slate-700 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >All days</button>
                  {ordersDaysForWeek.map(d => (
                    <button
                      key={d.key}
                      onClick={() => setOrdersDayFilter(d.date)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                        ordersDayFilter === d.date ? 'bg-slate-700 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >{d.short}{d.key === todayKey ? ' · Today' : ''}</button>
                  ))}
                </div>
                {/* Service filter — only shown when Dinner is enabled */}
                {dinnerEnabled && (
                  <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
                    {(['all', 'Lunch', 'Dinner'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => setOrdersServiceFilter(s)}
                        className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          ordersServiceFilter === s ? 'bg-accent text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        {s === 'all' ? 'All services' : s === 'Lunch' ? '☀️ Lunch' : '🌙 Dinner'}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {ordersVisibleDays.map(d => {
                const allDishes = dishesByDay[d.date];
                const isToday = d.key === todayKey;
                // Split dishes into Lunch and Dinner groups
                const lunchDishes = allDishes ? Object.entries(allDishes).filter(([, v]) => (v as {service:string}).service !== 'Dinner') : [];
                const dinnerDishes = allDishes ? Object.entries(allDishes).filter(([, v]) => (v as {service:string}).service === 'Dinner') : [];
                // Apply service filter
                const showLunch = ordersServiceFilter !== 'Dinner' && lunchDishes.length > 0;
                const showDinner = ordersServiceFilter !== 'Lunch' && dinnerDishes.length > 0;
                const hasAny = showLunch || showDinner;
                const dayLines = lines.filter(l => l.item.deliveryDate === d.date);
                const lunchLines = dayLines.filter(l => !(l.item.serviceSlot || '').startsWith('Dinner'));
                const dinnerLines = dayLines.filter(l => (l.item.serviceSlot || '').startsWith('Dinner'));

                const activeLunchCount = lunchLines.filter(l => l.item.status === 'Active' || !l.item.status).length;
                const activeDinnerCount = dinnerLines.filter(l => l.item.status === 'Active' || !l.item.status).length;

                const lunchCookingKey = `${d.date}::Lunch`;
                const dinnerCookingKey = `${d.date}::Dinner`;

                const isLunchCookingPending = pendingCookingKey === lunchCookingKey;
                const isDinnerCookingPending = pendingCookingKey === dinnerCookingKey;

                return (
                  <div key={d.key} className={`bg-white rounded-3xl shadow-sm p-6 ${isToday ? 'border-2 border-primary/40 shadow-[0_8px_30px_rgba(62,125,34,0.06)]' : 'border border-[#E7E0D0]'}`}>
                    <div className="flex items-center gap-2 mb-4">
                      <p className="text-[10px] font-black uppercase text-primary tracking-widest">{d.label}</p>
                      {isToday && <span className="px-2 py-0.5 rounded bg-primary text-white text-[9px] font-black uppercase tracking-widest animate-pulse">Cook today</span>}
                    </div>
                    {!hasAny ? (
                      <p className="text-xs text-slate-400 font-bold">No orders yet for this day{ordersServiceFilter !== 'all' ? ` (${ordersServiceFilter})` : ''}.</p>
                    ) : (
                      <div className="space-y-3">
                        {showLunch && (
                          <div className="bg-primary/5 rounded-2xl p-4">
                            <div className="flex items-center justify-between gap-4 mb-3 border-b border-primary/10 pb-2">
                              <p className="text-[10px] font-black uppercase text-primary tracking-widest">☀️ Lunch</p>
                              {activeLunchCount > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => handleStartCooking(d.date, 'Lunch')}
                                  disabled={isLunchCookingPending}
                                  className="px-3 py-1 bg-primary text-white rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1 hover:bg-primary/95 active:scale-95 transition-all disabled:opacity-60 cursor-pointer"
                                >
                                  {isLunchCookingPending ? <Loader2 className="size-3 animate-spin" /> : <ChefHat className="size-3" />}
                                  Start Cooking
                                </button>
                              ) : (
                                <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-md text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                                  <Check className="size-2.5" /> Cooking Started
                                </span>
                              )}
                            </div>
                            <div className="divide-y divide-primary/10">
                              {lunchDishes.map(([key, agg]) => {
                                const { qty, revenue, itemId, name, requests } = agg as { qty: number; revenue: number; itemId: string; name: string; service: string; requests: any[] };
                                return (
                                  <div key={key} className="py-2.5 space-y-1">
                                    <div className="flex items-center gap-3">
                                      <img src={dishPhotoFor(itemId)} alt={name} className="size-9 rounded-lg object-cover shrink-0" />
                                      <span className="text-sm font-bold text-slate-700 flex-1 min-w-0 truncate">{name}</span>
                                      <span className="text-xs font-black text-slate-900 shrink-0">{qty}x</span>
                                      <span className="text-xs font-bold text-slate-400 w-24 text-right shrink-0">{formatCurrency(revenue)}</span>
                                    </div>
                                    {requests.length > 0 && (
                                      <div className="pl-12 flex flex-col gap-1">
                                        {requests.map((r, rIdx) => (
                                          <div key={rIdx} className="flex items-center gap-1.5 flex-wrap text-[10px]">
                                            <span className="text-slate-400 font-bold">{r.qty}x:</span>
                                            {r.instructions && <InstructionsTag text={r.instructions} />}
                                            {r.person && <PersonTag name={r.person} />}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {showDinner && (
                          <div className="bg-accent/5 rounded-2xl p-4">
                            <div className="flex items-center justify-between gap-4 mb-3 border-b border-accent/10 pb-2">
                              <p className="text-[10px] font-black uppercase text-accent tracking-widest">🌙 Dinner</p>
                              {activeDinnerCount > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => handleStartCooking(d.date, 'Dinner')}
                                  disabled={isDinnerCookingPending}
                                  className="px-3 py-1 bg-accent text-white rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1 hover:bg-accent/95 active:scale-95 transition-all disabled:opacity-60 cursor-pointer"
                                >
                                  {isDinnerCookingPending ? <Loader2 className="size-3 animate-spin" /> : <ChefHat className="size-3" />}
                                  Start Cooking
                                </button>
                              ) : (
                                <span className="px-2 py-0.5 bg-accent/10 text-accent rounded-md text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                                  <Check className="size-2.5" /> Cooking Started
                                </span>
                              )}
                            </div>
                            <div className="divide-y divide-accent/10">
                              {dinnerDishes.map(([key, agg]) => {
                                const { qty, revenue, itemId, name, requests } = agg as { qty: number; revenue: number; itemId: string; name: string; service: string; requests: any[] };
                                return (
                                  <div key={key} className="py-2.5 space-y-1">
                                    <div className="flex items-center gap-3">
                                      <img src={dishPhotoFor(itemId)} alt={name} className="size-9 rounded-lg object-cover shrink-0" />
                                      <span className="text-sm font-bold text-slate-700 flex-1 min-w-0 truncate">{name}</span>
                                      <span className="text-xs font-black text-slate-900 shrink-0">{qty}x</span>
                                      <span className="text-xs font-bold text-slate-400 w-24 text-right shrink-0">{formatCurrency(revenue)}</span>
                                    </div>
                                    {requests.length > 0 && (
                                      <div className="pl-12 flex flex-col gap-1">
                                        {requests.map((r, rIdx) => (
                                          <div key={rIdx} className="flex items-center gap-1.5 flex-wrap text-[10px]">
                                            <span className="text-slate-400 font-bold">{r.qty}x:</span>
                                            {r.instructions && <InstructionsTag text={r.instructions} />}
                                            {r.person && <PersonTag name={r.person} />}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'delivery' && (
            <div className="space-y-4">
              {opsActionError && (
                <div className="bg-danger/10 text-danger text-xs font-bold rounded-xl px-4 py-3 flex items-center gap-2">
                  <AlertCircle className="size-4 shrink-0" /> {opsActionError}
                </div>
              )}
              {/* Delivery Filter Card */}
              <div className="bg-white border border-[#E7E0D0] rounded-2xl p-4 shadow-sm space-y-3">
                {/* Week toggle */}
                <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
                  {(['this', 'next'] as const).map(w => (
                    <button
                      key={w}
                      onClick={() => { setDeliveryWeekFilter(w); setDeliveryDayOverride(null); }}
                      className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        deliveryWeekFilter === w ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {w === 'this' ? 'This week' : 'Next week'}
                    </button>
                  ))}
                </div>
                {/* Day filter */}
                <div className="flex gap-1 overflow-x-auto">
                  {deliveryDaysForWeek.map(d => (
                    <button
                      key={d.key}
                      onClick={() => setDeliveryDayOverride(d.key)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                        activeDeliveryDayDate === d.date ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {d.short}{d.key === todayKey ? ' · Today' : ''}
                    </button>
                  ))}
                </div>
                {/* Service filter — only shown when Dinner is enabled */}
                {dinnerEnabled && (
                  <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
                    {(['all', 'Lunch', 'Dinner'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => setDeliveryServiceFilter(s)}
                        className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          deliveryServiceFilter === s ? 'bg-accent text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        {s === 'all' ? 'All services' : s === 'Lunch' ? '☀️ Lunch' : '🌙 Dinner'}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {(() => {
                // Group filtered drops by service for the selected day
                const lunchDrops = filteredDrops.filter(d => !(d.slot || '').startsWith('Dinner'));
                const dinnerDrops = filteredDrops.filter(d => (d.slot || '').startsWith('Dinner'));
                const showLunch = lunchDrops.length > 0;
                const showDinner = dinnerDrops.length > 0;

                if (!showLunch && !showDinner) {
                  return <EmptyState icon={<Truck className="size-10" />} label={`No deliveries for the selected filters`} />;
                }

                const renderDropCard = (drop: DropTask) => {
                  const cust = getCustomer(drop.customerName);
                  const addr = cust?.addresses[0];
                  const allCompleted = drop.items.every(i => i.status === 'Completed');
                  const allEnRoute = drop.items.every(i => i.status === 'En route');
                  const canDispatch = drop.items.some(i => i.status === 'Active' || i.status === 'Preparing' || !i.status);

                  return (
                    <div key={drop.key} className="bg-white rounded-3xl border border-[#E7E0D0] shadow-sm p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 hover:shadow-md transition-all">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-black text-slate-900 leading-none">{drop.customerName}</h3>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                            drop.paymentStatus === 'Paid' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                          }`}>
                            {drop.paymentStatus === 'Paid' ? 'Paid' : 'Unpaid'}
                          </span>
                        </div>
                        <div className="space-y-1.5 pt-1">
                          {drop.items.map((item, idx) => {
                            const { detail, person, instructions } = splitNotesTag(item.notes);
                            return (
                              <div key={idx} className="text-xs text-slate-700 font-medium">
                                <span className="font-bold text-slate-900">{item.qty}x {item.name}</span>
                                {item.status && item.status !== 'Active' && (
                                  <span className={`ml-1.5 px-1 py-0.5 rounded text-[8px] font-black uppercase tracking-wide ${
                                    item.status === 'Completed' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                                  }`}>
                                    {item.status}
                                  </span>
                                )}
                                {detail && <span className="text-slate-400 text-[11px] block pl-2">↳ {detail}</span>}
                                <div className="flex flex-wrap gap-1.5 mt-1 pl-2">
                                  {person && <PersonTag name={person} />}
                                  {instructions && <InstructionsTag text={instructions} />}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {addr ? (
                          <p className="text-[11px] text-slate-400 font-bold flex items-center gap-1.5 leading-tight">
                            <MapPin className="size-3.5 shrink-0 text-slate-300" />
                            <span>{addr.street}, {addr.city}</span>
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-400 font-bold flex items-center gap-1.5 leading-tight">
                            <MapPin className="size-3.5 shrink-0 text-slate-300" />
                            <span>No address specified</span>
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        {allCompleted ? (
                          <div className="px-4 py-2 bg-success/10 text-success rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                            <CheckCircle2 className="size-4" /> Delivered
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setActivePrintDrop(drop)}
                              className="px-4 py-3 bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95 transition-all rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 cursor-pointer"
                              title="Print delivery ticket"
                            >
                              <Printer className="size-4" /> Print
                            </button>
                            {canDispatch && (
                              <button
                                type="button"
                                onClick={() => handleDispatchDrop(drop)}
                                disabled={pendingDispatchKey === drop.key}
                                className="px-4 py-3 bg-warning/10 text-warning hover:bg-warning/20 active:scale-95 transition-all rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                              >
                                {pendingDispatchKey === drop.key ? <Loader2 className="size-4 animate-spin" /> : <Truck className="size-4" />}
                                {pendingDispatchKey === drop.key ? 'Dispatching...' : 'Dispatch'}
                              </button>
                            )}
                            {allEnRoute && (
                              <span className="px-4 py-3 bg-warning/10 text-warning rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                                <Truck className="size-4 animate-bounce" /> En Route
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleMarkDelivered(drop)}
                              disabled={pendingDeliveryKey === drop.key}
                              className="px-6 py-3 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-primary/95 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait cursor-pointer"
                            >
                              {pendingDeliveryKey === drop.key ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                              {pendingDeliveryKey === drop.key ? 'Marking...' : 'Mark Delivered'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                };

                return (
                  <div className="space-y-4">
                    {showLunch && (
                      <div className="bg-primary/5 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between gap-4 flex-wrap border-b border-primary/10 pb-2">
                          <p className="text-[10px] font-black uppercase text-primary tracking-widest">☀️ Lunch · {lunchDrops.length} drop{lunchDrops.length !== 1 ? 's' : ''}</p>
                          <button
                            type="button"
                            onClick={() => setActivePrintService({ date: activeDeliveryDayDate as string, service: 'Lunch', drops: lunchDrops })}
                            className="px-3 py-1.5 bg-primary text-white rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1 hover:bg-primary/95 active:scale-95 transition-all cursor-pointer shadow-sm"
                          >
                            <Printer className="size-3" /> Print Lunch Stickers
                          </button>
                        </div>
                        {lunchDrops.map(renderDropCard)}
                      </div>
                    )}
                    {showDinner && (
                      <div className="bg-accent/5 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between gap-4 flex-wrap border-b border-accent/10 pb-2">
                          <p className="text-[10px] font-black uppercase text-accent tracking-widest">🌙 Dinner · {dinnerDrops.length} drop{dinnerDrops.length !== 1 ? 's' : ''}</p>
                          <button
                            type="button"
                            onClick={() => setActivePrintService({ date: activeDeliveryDayDate as string, service: 'Dinner', drops: dinnerDrops })}
                            className="px-3 py-1.5 bg-accent text-white rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1 hover:bg-accent/95 active:scale-95 transition-all cursor-pointer shadow-sm"
                          >
                            <Printer className="size-3" /> Print Dinner Stickers
                          </button>
                        </div>
                        {dinnerDrops.map(renderDropCard)}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {tab === 'payments' && (
            <div className="space-y-6">
              {opsActionError && (
                <div className="bg-danger/10 text-danger text-xs font-bold rounded-xl px-4 py-3 flex items-center gap-2">
                  <AlertCircle className="size-4 shrink-0" /> {opsActionError}
                </div>
              )}
              {/* Collected vs Outstanding totals */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white rounded-3xl border border-[#E7E0D0] shadow-sm p-6">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Collected</p>
                  <p className="text-2xl font-black text-success">{formatCurrency(paymentSummary.collected)}</p>
                </div>
                <div className="bg-white rounded-3xl border border-[#E7E0D0] shadow-sm p-6">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Outstanding</p>
                  <p className="text-2xl font-black text-danger">{formatCurrency(paymentSummary.outstanding)}</p>
                </div>
              </div>

              {unpaidByDate.length === 0 ? (
                <EmptyState icon={<Wallet className="size-10" />} label="Nothing outstanding" />
              ) : (
                <div className="space-y-5">
                  {unpaidByDate.map(([date, dateDrops]) => (
                    <div key={date}>
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">{formatDay(date)}</p>
                      <div className="space-y-3">
                        {dateDrops.map(drop => (
                          <div key={drop.key} className="bg-white rounded-3xl border border-[#E7E0D0] shadow-sm p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-base font-black text-slate-900">{drop.customerName}</h3>
                                {drop.slot && <span className="text-[10px] font-bold text-slate-400">{drop.slot}</span>}
                              </div>
                              <div className="space-y-1.5 pt-1">
                                {drop.items.map((item, idx) => {
                                  const { detail, person, instructions } = splitNotesTag(item.notes);
                                  return (
                                    <div key={idx} className="text-xs text-slate-700 font-medium">
                                      <span className="font-bold text-slate-900">{item.qty}x {item.name}</span>
                                      {detail && <span className="text-slate-400 text-[11px] block pl-2">↳ {detail}</span>}
                                      <div className="flex flex-wrap gap-1.5 mt-1 pl-2">
                                        {person && <PersonTag name={person} />}
                                        {instructions && <InstructionsTag text={instructions} />}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              <p className="text-sm font-black text-primary mt-1">{formatCurrency(drop.total)}</p>
                              {drop.claimedMethod && (
                                <p className="text-[11px] text-[#B4703A] font-bold mt-1 bg-[#B4703A]/5 px-2.5 py-1 rounded-lg border border-[#B4703A]/10 inline-block">
                                  Customer claimed: {drop.claimedMethod}{drop.claimedReference ? ` (Ref: ${drop.claimedReference})` : ''}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => setActivePrintDrop(drop)}
                                className="px-4 py-3 bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95 transition-all rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 cursor-pointer"
                                title="Print order ticket"
                              >
                                <Printer className="size-4" /> Print
                              </button>
                              <button
                                type="button"
                                onClick={() => setPaymentDrop(drop)}
                                disabled={pendingPaymentKey === drop.key}
                                className="px-6 py-3 bg-warning text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-warning/95 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait cursor-pointer"
                              >
                                {pendingPaymentKey === drop.key ? <Loader2 className="size-4 animate-spin" /> : <Banknote className="size-4" />}
                                {pendingPaymentKey === drop.key ? 'Marking...' : 'Mark Paid'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => setShowPaidHistory(s => !s)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white border border-[#E7E0D0] text-xs font-bold text-slate-500 shadow-sm"
              >
                <span>{paidDrops.length} paid</span>
                {showPaidHistory ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </button>
              {showPaidHistory && (
                <div className="space-y-3">
                  {paidDrops.map(drop => (
                    <div key={drop.key} className="bg-white rounded-3xl border border-[#E7E0D0] shadow-sm p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-base font-black text-slate-900">{drop.customerName}</h3>
                          {drop.date && <span className="text-[10px] font-bold text-slate-400">{formatDay(drop.date)}{drop.slot ? ` · ${drop.slot}` : ''}</span>}
                        </div>
                        <p className="text-xs text-slate-500 font-medium">{drop.items.map(i => `${i.qty}x ${i.name}`).join(', ')}</p>
                        <p className="text-sm font-black text-primary mt-1">{formatCurrency(drop.total)}</p>
                        {drop.items.some(i => i.rating) && (
                          <div className="mt-3 bg-warning/[0.03] border border-warning/10 rounded-2xl p-3 space-y-2 text-[11px] text-slate-600 font-medium">
                            {drop.items.filter(i => i.rating).map((i, idx) => (
                              <div key={idx} className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5 font-bold text-slate-700">
                                  <span className="flex items-center gap-0.5 text-warning font-black"><Star className="size-3.5 fill-warning text-warning" /> {i.rating}★</span>
                                  <span>on {i.name}</span>
                                </div>
                                {i.ratingComment && <p className="text-slate-500 font-medium italic pl-5">"{i.ratingComment}"</p>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="shrink-0 px-4 py-2 bg-success/10 text-success rounded-xl text-[10px] font-black uppercase tracking-widest font-black">Paid</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'customers' && (
            <div className="space-y-6">
              {/* CRM Search input */}
              <div className="bg-white rounded-3xl border border-[#E7E0D0] p-6 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-center">
                <div className="relative w-full sm:max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by name, address, or tier..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all"
                  />
                </div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{filteredCustomers.length} Customer{filteredCustomers.length !== 1 ? 's' : ''}</p>
              </div>

              {filteredCustomers.length === 0 ? (
                <EmptyState icon={<Users className="size-10" />} label="No matching customers" />
              ) : (
                <div className="bg-white rounded-3xl border border-[#E7E0D0] shadow-sm overflow-hidden animate-fade-in">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#E7E0D0] bg-[#FAF9F5] text-[10px] font-black uppercase tracking-widest text-slate-400">
                          <th className="px-6 py-4">Customer</th>
                          <th className="px-6 py-4">Contact</th>
                          <th className="px-6 py-4">Tier</th>
                          <th className="px-6 py-4">Birthday</th>
                          <th className="px-6 py-4 text-center">Orders</th>
                          <th className="px-6 py-4 text-right">Points</th>
                          <th className="px-6 py-4 text-right">Credit</th>
                          <th className="px-6 py-4 text-right">LTV</th>
                          <th className="px-6 py-4 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E7E0D0] text-xs">
                        {filteredCustomers.map(c => {
                          const orderCount = orders.filter(o => o.customerName === c.name).length;
                          let formattedBirthday = 'Not set';
                          if (c.birthday) {
                            const [yr, mo, dy] = c.birthday.split('-');
                            if (mo && dy) {
                              const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                              const monthName = months[parseInt(mo, 10) - 1] || mo;
                              formattedBirthday = `${parseInt(dy, 10)} ${monthName}`;
                            }
                          }
                          return (
                            <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <img src={c.avatar || `https://picsum.photos/seed/${c.id}/100/100`} alt={c.name} className="size-10 rounded-full border border-slate-100 object-cover shrink-0" />
                                  <div className="min-w-0">
                                    <p className="font-bold text-slate-900 truncate leading-snug">{c.name}</p>
                                    <p className="text-[10px] text-slate-400 font-medium">@{c.referenceCode ? c.referenceCode.toLowerCase() : 'no_username'}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="space-y-0.5">
                                  <p className="font-semibold text-slate-700">{c.phone || 'No phone'}</p>
                                  <p className="text-[10px] text-slate-400 font-medium truncate max-w-[150px]">{c.email}</p>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                {c.tier ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-[9px] font-black uppercase tracking-wider">
                                    <Star className="size-2.5 fill-primary text-primary" /> {c.tier}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <span className={`font-semibold ${c.birthday ? 'text-slate-700' : 'text-slate-300 font-normal'}`}>
                                  {formattedBirthday}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-center font-bold text-slate-700">
                                {orderCount}
                              </td>
                              <td className="px-6 py-4 text-right font-bold text-slate-900">
                                {c.points || 0}
                              </td>
                              <td className="px-6 py-4 text-right font-bold text-success">
                                {formatCurrency(c.storeCredit || 0)}
                              </td>
                              <td className="px-6 py-4 text-right font-bold text-slate-900">
                                {formatCurrency(c.ltv || 0)}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center justify-center">
                                  <button
                                    onClick={() => openEditCustomer(c)}
                                    className="p-1.5 text-primary hover:bg-primary/5 rounded-lg transition-all cursor-pointer"
                                    title="Edit Customer"
                                  >
                                    <Edit3 className="size-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'transactions' && renderTransactionsTab()}
          {tab === 'settings' && renderSettingsTab()}
        </div>
      </main>

      {/* Dirty state floating save/discard bar */}
      {isSettingsDirty && (
        <div className="fixed bottom-6 right-6 left-72 bg-slate-900/95 backdrop-blur text-white px-6 py-4 rounded-2xl flex items-center justify-between shadow-2xl z-30 border border-slate-800 animate-slide-up">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
            <span className="inline-block size-2 rounded-full bg-yellow-500 animate-pulse shrink-0" />
            <span>You have unsaved configuration changes</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={discardSettings}
              className="px-4 py-2 hover:bg-white/10 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Discard
            </button>
            <button
              onClick={saveAllSettings}
              className="px-5 py-2 bg-primary text-white hover:bg-primary/95 rounded-xl text-xs font-bold shadow-md transition-colors cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </div>
      )}

      {/* Collect Payment Modal — portaled to <body>, same clipping issue as
          the Meal Library modals (see Portal.tsx). */}
      {paymentDrop && (
        <Portal>
        <div className="fixed inset-0 z-[9999] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900">Collect Payment</h2>
              <button onClick={closePaymentModal} className="p-2 text-slate-400 hover:text-danger">
                <X className="size-5" />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="text-center">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">{paymentDrop.customerName}</p>
                <p className="text-4xl font-black text-slate-900 tracking-tight">{formatCurrency(paymentDrop.total)}</p>
                {paymentDrop.claimedMethod && (
                  <div className="mt-3 inline-block bg-warning/10 text-[#B4703A] rounded-xl px-4 py-2 text-xs font-bold">
                    Customer says: {paymentDrop.claimedMethod}
                    {paymentDrop.claimedReference && <><br /><span className="font-mono">{paymentDrop.claimedReference}</span></>}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {paymentMethods.filter(m => m.isActive && MEAL_PLAN_PAYMENT_METHOD_NAMES.includes(m.name)).map(m => {
                  const isConfirming = confirmPaymentId === m.id;
                  const isSubmitting = pendingPaymentKey === paymentDrop.key;
                  return (
                    <button
                      key={m.id}
                      disabled={isSubmitting}
                      onClick={() => {
                        if (isConfirming) {
                          markPaid(paymentDrop, m);
                          setConfirmPaymentId(null);
                        } else {
                          setConfirmPaymentId(m.id);
                        }
                      }}
                      className={`p-5 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 disabled:opacity-60 disabled:cursor-wait ${
                        isConfirming
                          ? 'border-warning bg-warning/10 text-warning-700 animate-pulse'
                          : paymentDrop.claimedMethod === m.name
                          ? 'border-primary text-primary bg-primary/[0.02]'
                          : 'border-slate-100 bg-white text-slate-500 hover:border-primary hover:text-primary hover:bg-slate-50'
                      }`}
                    >
                      {isSubmitting && isConfirming ? (
                        <Loader2 className="size-6 animate-spin" />
                      ) : (
                        <span className="text-2xl">{m.icon}</span>
                      )}
                      <span className="text-[10px] font-black uppercase tracking-widest">
                        {isSubmitting && isConfirming ? 'Marking...' : isConfirming ? 'Confirm ' + m.name + '?' : m.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* Edit Customer Modal */}
      {editCustomer && (
        <Portal>
          <div className="fixed inset-0 z-[9999] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-[32px] w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <img src={editCustomer.avatar} alt={editCustomer.name} className="size-9 rounded-full border border-slate-200 shrink-0" />
                  <div>
                    <h2 className="text-base font-black text-slate-900 font-sans tracking-tight">Edit Customer CRM</h2>
                    <p className="text-[10px] text-slate-400 font-bold leading-none mt-0.5">{editCustomer.name} · {editCustomer.email}</p>
                  </div>
                </div>
                <button onClick={() => setEditCustomer(null)} className="p-2 text-slate-400 hover:text-danger">
                  <X className="size-5" />
                </button>
              </div>
              <div className="p-5 overflow-y-auto flex-1">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* LEFT COLUMN: Customer Details (spans 7 cols) */}
                  <div className="lg:col-span-7 space-y-4">
                    <div className="space-y-3">
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Personal Details</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">First Name</label>
                          <input
                            type="text"
                            value={editCustFirstName}
                            onChange={e => setEditCustFirstName(e.target.value)}
                            className="w-full text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Last Name</label>
                          <input
                            type="text"
                            value={editCustLastName}
                            onChange={e => setEditCustLastName(e.target.value)}
                            className="w-full text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Email Address</label>
                          <input
                            type="email"
                            value={editCustEmail}
                            onChange={e => setEditCustEmail(e.target.value)}
                            className="w-full text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Username (Read-only)</label>
                          <input
                            type="text"
                            disabled
                            value={editCustomer.referenceCode ? editCustomer.referenceCode.toLowerCase() : ''}
                            className="w-full text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 outline-none bg-slate-100 text-slate-400 cursor-not-allowed"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Birthday</label>
                          <input
                            type="date"
                            value={editCustBirthday}
                            onChange={e => setEditCustBirthday(e.target.value)}
                            className="w-full text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Phone Number</label>
                          <input
                            type="text"
                            value={editCustPhone}
                            onChange={e => setEditCustPhone(e.target.value)}
                            className="w-full text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 pt-3 border-t border-slate-100">
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Delivery Address</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Street Address</label>
                          <input
                            type="text"
                            value={editCustStreet}
                            onChange={e => setEditCustStreet(e.target.value)}
                            placeholder="e.g. 12 Rue de la Paix"
                            className="w-full text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">City / Town</label>
                          <input
                            type="text"
                            value={editCustCity}
                            onChange={e => setEditCustCity(e.target.value)}
                            placeholder="e.g. Port Louis"
                            className="w-full text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT COLUMN: Configuration & CRM (spans 5 cols) */}
                  <div className="lg:col-span-5 space-y-5 lg:border-l lg:border-slate-100 lg:pl-8">
                    <div className="space-y-3">
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Configuration & Groups</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Loyalty Tier</label>
                          <select
                            value={editCustTier}
                            onChange={e => setEditCustTier(e.target.value)}
                            className="w-full text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all"
                          >
                            {loyaltyTiers.map(t => (
                              <option key={t.id} value={t.name}>{t.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Customer Group</label>
                          <select
                            value={editCustGroup}
                            onChange={e => setEditCustGroup(e.target.value)}
                            className="w-full text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all"
                          >
                            <option value="">None (Regular Customer)</option>
                            {customerGroups.map(g => (
                              <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 pt-4 border-t border-slate-100">
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Customer Stats & Balance</p>
                      <div className="space-y-2">
                        <div className="bg-[#3E7D22]/5 border border-[#3E7D22]/10 rounded-xl px-4 py-2.5 flex items-center justify-between">
                          <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider">Lifetime Value (LTV)</span>
                          <span className="text-xs font-black text-slate-900">Rs {editCustomer.ltv?.toLocaleString() || '0'}</span>
                        </div>
                        
                        <div className="bg-[#B4703A]/5 border border-[#B4703A]/10 rounded-xl px-4 py-2.5 flex items-center justify-between">
                          <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider">Loyalty Points</span>
                          <span className="text-xs font-black text-slate-900">{editCustomer.points || 0} pts</span>
                        </div>

                        <div className="bg-slate-50 border border-slate-200/60 rounded-xl px-4 py-2.5 flex items-center justify-between">
                          <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider">Store Credit Balance</span>
                          <span className="text-xs font-black text-slate-900">Rs {editCustomer.storeCredit || 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50 shrink-0">
                <button
                  onClick={() => setEditCustomer(null)}
                  className="px-4 py-2 text-slate-500 hover:text-slate-800 text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveCustomer}
                  className="px-5 py-2 bg-primary text-white hover:bg-primary/95 rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
                >
                  Save Customer
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* 80mm Print Ticket Portal */}
      {activePrintDrop && (
        <Portal>
          <div className="fixed inset-0 z-[10000] bg-white flex flex-col justify-start items-center p-4 overflow-y-auto bmz-print-ticket-overlay">
            <style>{`
              /* Hidden by default on screen */
              .bmz-print-ticket-container { display: block; }
              @media print {
                body * { visibility: hidden !important; }
                .bmz-print-ticket-overlay, .bmz-print-ticket-overlay * { visibility: visible !important; }
                .bmz-print-ticket-overlay { position: fixed; inset: 0; margin: 0; padding: 0; background: white; width: 100%; height: 100%; overflow: visible; }
                .bmz-print-ticket-container { width: 80mm; max-width: 80mm; margin: 0; padding: 10px; border: none; font-family: monospace; }
                .bmz-no-print { display: none !important; }
              }
            `}</style>
            <div className="bmz-print-ticket-container bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-xs shadow-lg font-mono text-[11px] text-slate-800">
              <div className="text-center border-b border-dashed border-slate-300 pb-3 mb-3">
                <p className="text-sm font-black uppercase tracking-wider text-slate-900">{SYSTEM_CONFIG.businessName}</p>
                <p className="text-[10px] uppercase font-bold text-slate-400 mt-0.5">Delivery Ticket</p>
              </div>
              
              <div className="space-y-1.5 mb-3">
                <div className="flex justify-between gap-2"><span className="text-slate-400 uppercase tracking-widest font-bold text-[9px]">Customer:</span><span className="font-black text-slate-950 text-right">{activePrintDrop.customerName}</span></div>
                {(() => {
                  const cust = getCustomer(activePrintDrop.customerName);
                  return cust?.phone ? (
                    <div className="flex justify-between gap-2"><span className="text-slate-400 uppercase tracking-widest font-bold text-[9px]">Phone:</span><span className="font-bold text-slate-900">{cust.phone}</span></div>
                  ) : null;
                })()}
                <div className="flex justify-between gap-2"><span className="text-slate-400 uppercase tracking-widest font-bold text-[9px]">Date:</span><span className="font-bold text-slate-900">{new Date(activePrintDrop.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span></div>
                <div className="flex justify-between gap-2"><span className="text-slate-400 uppercase tracking-widest font-bold text-[9px]">Service:</span><span className="font-black text-accent uppercase">{activePrintDrop.slot}</span></div>
                <div className="flex justify-between gap-2"><span className="text-slate-400 uppercase tracking-widest font-bold text-[9px]">Payment:</span><span className={`font-black uppercase ${activePrintDrop.paymentStatus === 'Paid' ? 'text-success' : 'text-danger'}`}>{activePrintDrop.paymentStatus === 'Paid' ? 'Paid' : 'Unpaid'}</span></div>
              </div>

              <div className="border-t border-b border-dashed border-slate-300 py-3 my-3">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-2">Items</p>
                <div className="space-y-2.5">
                  {activePrintDrop.items.map((item, idx) => {
                    const { detail, person, instructions } = splitNotesTag(item.notes);
                    const cust = getCustomer(activePrintDrop.customerName);
                    const isForUser = isNoteForCustomer(person, activePrintDrop.customerName, cust);
                    return (
                      <div key={idx} className="space-y-0.5">
                        <div className="flex justify-between font-bold text-slate-950">
                          <span>{item.qty}x {item.name}</span>
                          <span>Rs {item.price * item.qty}</span>
                        </div>
                        {detail && <p className="text-[10px] text-slate-500 leading-tight pl-2">↳ {detail}</p>}
                        {person && !isForUser && <p className="text-[10px] font-bold text-accent pl-2">👤 For {person}</p>}
                        {instructions && <p className="text-[10px] font-bold text-[#B4703A] pl-2">🍳 Req: {instructions}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mb-4">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Delivery Address</p>
                {(() => {
                  const cust = getCustomer(activePrintDrop.customerName);
                  const addr = cust?.addresses?.[0];
                  return addr ? (
                    <div className="font-bold text-slate-950 leading-snug">
                      <p>{addr.street}</p>
                      <p>{addr.city}</p>
                    </div>
                  ) : (
                    <p className="text-slate-400 italic">No address specified</p>
                  );
                })()}
              </div>

              <div className="text-center border-t border-dashed border-slate-300 pt-3 mt-4 text-[9px] text-slate-400 space-y-0.5">
                <p>BonManzE Mauritian Delights 🌿</p>
                <p className="font-mono text-[8px] opacity-75">Order Ref: {activePrintDrop.orderId.slice(0, 8).toUpperCase()}</p>
              </div>
              
              <div className="bmz-no-print mt-5 flex gap-2">
                <button
                  onClick={() => setActivePrintDrop(null)}
                  className="flex-1 py-2 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex-1 py-2 bg-primary text-white hover:bg-primary/95 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer"
                >
                  Print Again
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {activePrintService && (
        <Portal>
          <div className="fixed inset-0 z-[10000] bg-white flex flex-col justify-start items-center p-4 overflow-y-auto bmz-print-stickers-overlay">
            <style>{`
              /* Hidden by default on screen */
              .bmz-sticker-grid {
                display: flex;
                flex-wrap: wrap;
                gap: 20px;
                justify-content: center;
                width: 100%;
                max-width: 1200px;
                padding: 10px;
              }
              .bmz-print-ticket-container {
                width: 80mm;
                max-width: 80mm;
                font-family: monospace;
                box-sizing: border-box;
                page-break-inside: avoid;
                break-inside: avoid;
              }
              @media print {
                body * { visibility: hidden !important; }
                .bmz-print-stickers-overlay, .bmz-print-stickers-overlay * { visibility: visible !important; }
                .bmz-print-stickers-overlay { position: fixed; inset: 0; margin: 0; padding: 0; background: white; width: 100%; height: 100%; overflow: visible; }
                .bmz-sticker-grid {
                  display: block;
                  width: 100%;
                  padding: 0;
                }
                .bmz-print-ticket-container {
                  border: none !important;
                  box-shadow: none !important;
                  margin: 0;
                  padding: 10px;
                  page-break-after: always;
                  break-after: page;
                }
                .bmz-no-print { display: none !important; }
              }
            `}</style>
            <div className="w-full max-w-4xl bg-slate-50 border border-slate-200 rounded-3xl p-6 shadow-xl bmz-no-print mb-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-black text-slate-900 font-sans tracking-tight">Delivery Tickets Print Preview</h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Generating delivery tickets for {activePrintService.service} · {new Date(activePrintService.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setActivePrintService(null)}
                    className="px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="px-5 py-2 bg-primary text-white hover:bg-primary/95 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                  >
                    Print Tickets
                  </button>
                </div>
              </div>
            </div>

            <div className="bmz-sticker-grid">
              {activePrintService.drops.map(drop => {
                const cust = getCustomer(drop.customerName);
                const addr = cust?.addresses?.[0];
                
                return (
                  <div key={drop.key} className="bmz-print-ticket-container bg-white border border-slate-200 rounded-2xl p-6 shadow-lg font-mono text-[11px] text-slate-800">
                    <div className="text-center border-b border-dashed border-slate-300 pb-3 mb-3">
                      <p className="text-sm font-black uppercase tracking-wider text-slate-900">{SYSTEM_CONFIG.businessName}</p>
                      <p className="text-[10px] uppercase font-bold text-slate-400 mt-0.5">Delivery Ticket</p>
                    </div>
                    
                    <div className="space-y-1.5 mb-3">
                      <div className="flex justify-between gap-2"><span className="text-slate-400 uppercase tracking-widest font-bold text-[9px]">Customer:</span><span className="font-black text-slate-950 text-right">{drop.customerName}</span></div>
                      {cust?.phone && (
                        <div className="flex justify-between gap-2"><span className="text-slate-400 uppercase tracking-widest font-bold text-[9px]">Phone:</span><span className="font-bold text-slate-900">{cust.phone}</span></div>
                      )}
                      <div className="flex justify-between gap-2"><span className="text-slate-400 uppercase tracking-widest font-bold text-[9px]">Date:</span><span className="font-bold text-slate-900">{new Date(drop.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span></div>
                      <div className="flex justify-between gap-2"><span className="text-slate-400 uppercase tracking-widest font-bold text-[9px]">Service:</span><span className="font-black text-accent uppercase">{drop.slot}</span></div>
                      <div className="flex justify-between gap-2"><span className="text-slate-400 uppercase tracking-widest font-bold text-[9px]">Payment:</span><span className={`font-black uppercase ${drop.paymentStatus === 'Paid' ? 'text-success' : 'text-danger'}`}>{drop.paymentStatus === 'Paid' ? 'Paid' : 'Unpaid'}</span></div>
                    </div>

                    <div className="border-t border-b border-dashed border-slate-300 py-3 my-3">
                      <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-2">Items</p>
                      <div className="space-y-2.5">
                        {drop.items.map((item, idx) => {
                          const { detail, person, instructions } = splitNotesTag(item.notes);
                          const isForUser = isNoteForCustomer(person, drop.customerName, cust);
                          return (
                            <div key={idx} className="space-y-0.5">
                              <div className="flex justify-between font-bold text-slate-950">
                                <span>{item.qty}x {item.name}</span>
                                <span>Rs {item.price * item.qty}</span>
                              </div>
                              {detail && <p className="text-[10px] text-slate-500 leading-tight pl-2">↳ {detail}</p>}
                              {person && !isForUser && <p className="text-[10px] font-bold text-accent pl-2">👤 For {person}</p>}
                              {instructions && <p className="text-[10px] font-bold text-[#B4703A] pl-2">🍳 Req: {instructions}</p>}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Delivery Address</p>
                      {addr ? (
                        <div className="font-bold text-slate-950 leading-snug">
                          <p>{addr.street}</p>
                          <p>{addr.city}</p>
                        </div>
                      ) : (
                        <p className="text-slate-400 italic">No address specified</p>
                      )}
                    </div>

                    <div className="text-center border-t border-dashed border-slate-300 pt-3 mt-4 text-[9px] text-slate-400 space-y-0.5">
                      <p>BonManzE Mauritian Delights 🌿</p>
                      <p className="font-mono text-[8px] opacity-75">Order Ref: {drop.orderId.slice(0, 8).toUpperCase()}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
};

const EmptyState = ({ icon, label }: { icon: React.ReactNode; label: string }) => (
  <div className="py-20 text-center opacity-30 bg-white rounded-3xl border border-slate-200">
    <div className="mx-auto mb-3 flex justify-center">{icon}</div>
    <p className="font-black uppercase tracking-widest text-xs">{label}</p>
  </div>
);

export default Operations;
