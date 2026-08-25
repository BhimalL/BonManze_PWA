
import React, { useState, useMemo, useEffect } from 'react';
import {
  Home as HomeIcon,
  BookOpen,
  ShoppingBag,
  User as UserIcon,
  ArrowLeft,
  X,
  CheckCircle2,
  Star,
  Gift,
  MapPin,
  LogOut,
  Sparkles,
  Plus,
  Clock,
  Banknote,
  Smartphone,
  Wallet,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Edit3,
  Trash2,
  Copy,
  Check,
  Receipt,
  Printer,
  CalendarDays,
  UtensilsCrossed,
  Truck,
  CreditCard,
  MessageSquare,
  Phone,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, collection, collectionGroup, query, where, onSnapshot, writeBatch, updateDoc, Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../firebaseClient';
import { Customer, Order, OrderItem, PaymentMethod } from '../types';
import {
  WEEKDAY_KEYS,
  WeekdayKey,
  lunchMenuForWeek,
  dinnerMenuForWeek,
  CurryOption,
  MEAL_BASES,
  MEAL_DHALS,
  MEAL_SALADS,
  MEAL_BEVERAGES,
  MEAL_DESSERTS,
  dishBaseApplicable,
  dishBaseOptionIds,
  dishDhalApplicable,
  dishSaladApplicable,
  dishBeverageApplicable,
  dishDessertApplicable,
  filterAddOnOptions,
  resolveDish,
  dishPhotoFor,
  CREOLE_PHRASES,
  SYSTEM_CONFIG,
  LOYALTY_TIERS,
  CUSTOMER_GROUPS,
  subscribeToLoyaltyTiers,
  subscribeToCustomerGroups,
  subscribeToCustomers,
  subscribeToPaymentMethods,
  subscribeToOrders,
  subscribeToSystemDate,
  subscribeToLunchMenu,
  subscribeToDinnerMenu,
  subscribeToConfig,
  MOCK_TODAY,
  addOrder,
  cancelOrderItem,
  editOrderItem,
  updateOrderItemRating,
  submitPaymentClaim,
  MEAL_PLAN_PAYMENT_METHOD_NAMES,
  formatCurrency,
  calculateTotal,
  specialPriceInfo
} from './store';

// Edits/cancels lock at SYSTEM_CONFIG.cutoffTime on a day relative to
// delivery, given by SYSTEM_CONFIG.cutoffDayOffset (0 = delivery day itself
// — the rule the original HTML prototype hardcoded as "the 9:00 AM cutoff
// has passed" — -1 = the day before, and so on) — after that the kitchen
// has already started on the meal. Past delivery days are always locked;
// days before the cutoff day are always open. Uses real wall-clock time for
// the same-day check since the app's simulated "today" (systemDate) only
// ever moves in whole days.
const isPastOrderCutoff = (deliveryDate: string, service: 'Lunch' | 'Dinner' | Service, systemDate: string): boolean => {
  if (!deliveryDate) return false;
  if (deliveryDate < systemDate) return true;
  const isDinner = service === 'Dinner';
  const offset = isDinner
    ? (SYSTEM_CONFIG.dinnerOrderCutoffDayOffset !== undefined ? SYSTEM_CONFIG.dinnerOrderCutoffDayOffset : 0)
    : (SYSTEM_CONFIG.lunchOrderCutoffDayOffset !== undefined ? SYSTEM_CONFIG.lunchOrderCutoffDayOffset : -1);
  const cutoffDate = addDays(deliveryDate, offset);
  if (systemDate < cutoffDate) return false;
  if (systemDate > cutoffDate) return true;
  const time = isDinner ? SYSTEM_CONFIG.dinnerOrderCutoffTime : SYSTEM_CONFIG.lunchOrderCutoffTime;
  const [cutH, cutM] = time.split(':').map(n => parseInt(n, 10) || 0);
  const now = new Date();
  return now.getHours() > cutH || (now.getHours() === cutH && now.getMinutes() >= cutM);
};

const isPastCancelCutoff = (deliveryDate: string, service: 'Lunch' | 'Dinner' | Service, systemDate: string): boolean => {
  if (!deliveryDate) return false;
  if (deliveryDate < systemDate) return true;
  const isDinner = service === 'Dinner';
  const offset = isDinner
    ? (SYSTEM_CONFIG.dinnerCancelCutoffDayOffset !== undefined ? SYSTEM_CONFIG.dinnerCancelCutoffDayOffset : 0)
    : (SYSTEM_CONFIG.lunchCancelCutoffDayOffset !== undefined ? SYSTEM_CONFIG.lunchCancelCutoffDayOffset : 0);
  const cutoffDate = addDays(deliveryDate, offset);
  if (systemDate < cutoffDate) return false;
  if (systemDate > cutoffDate) return true;
  const time = isDinner ? SYSTEM_CONFIG.dinnerCancelCutoffTime : SYSTEM_CONFIG.lunchCancelCutoffTime;
  const [cutH, cutM] = time.split(':').map(n => parseInt(n, 10) || 0);
  const now = new Date();
  return now.getHours() > cutH || (now.getHours() === cutH && now.getMinutes() >= cutM);
};

// "09:00" -> "9:00 AM" — used anywhere the cutoff needs to read as a time a
// human would say out loud, rather than the raw 24h config value.
const formatTimeLabel = (time: string): string => {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${String(m).padStart(2, '0')} ${ampm}`;
};

const isBirthdayToday = (birthday?: string, systemDateStr?: string): boolean => {
  if (!birthday || !systemDateStr) return false;
  const [, bMonth, bDay] = birthday.split('-').map(Number);
  const [, sMonth, sDay] = systemDateStr.split('-').map(Number);
  return bMonth === sMonth && bDay === sDay;
};

/**
 * Returns the YYYY-MM-DD date string of the birthday if it falls within the
 * given week's days AND that date is today or still in the future (>= systemDate).
 * Returns null if the birthday isn't in this week or has already passed.
 * Used by the Menu banner: show a celebration notice from the start of the week
 * up to and including the birthday, then hide it once it's passed.
 */
const birthdayDateInWeek = (birthday?: string, days?: { date: string }[], systemDate?: string): string | null => {
  if (!birthday || !days || !systemDate) return null;
  const [, bMonth, bDay] = birthday.split('-').map(Number);
  for (const d of days) {
    const [, dm, dd] = d.date.split('-').map(Number);
    if (dm === bMonth && dd === bDay && d.date >= systemDate) return d.date;
  }
  return null;
};

const orderCutoffDayPhrase = (service: 'Lunch' | 'Dinner' | Service): string => {
  const isDinner = service === 'Dinner';
  const offset = isDinner ? SYSTEM_CONFIG.dinnerOrderCutoffDayOffset : SYSTEM_CONFIG.lunchOrderCutoffDayOffset;
  if (offset === 0) return 'on its delivery day';
  if (offset === -1) return 'the day before delivery';
  return `${Math.abs(offset)} days before delivery`;
};

const cancelCutoffDayPhrase = (service: 'Lunch' | 'Dinner' | Service): string => {
  const isDinner = service === 'Dinner';
  const offset = isDinner ? SYSTEM_CONFIG.dinnerCancelCutoffDayOffset : SYSTEM_CONFIG.lunchCancelCutoffDayOffset;
  if (offset === 0) return 'on its delivery day';
  if (offset === -1) return 'the day before delivery';
  return `${Math.abs(offset)} days before delivery`;
};

// Which offering a meal belongs to — Dinner is a second, independently
// toggleable offering (SYSTEM_CONFIG.dinnerEnabled) that otherwise works
// exactly like Lunch: its own weekly menu, its own draft cart, tagged onto
// OrderItem.serviceSlot the same way Lunch already is ('Lunch'/'Lunch-2' vs
// 'Dinner'/'Dinner-2').
type Service = 'Lunch' | 'Dinner';

// Which of the two currently-orderable calendar weeks a view is showing —
// 'This' is whatever week systemDate falls in, 'Next' is the week after.
type WeekChoice = 'This' | 'Next';

// Reads which offering a confirmed item belongs to straight off its
// serviceSlot tag ('Lunch'/'Lunch-2' vs 'Dinner'/'Dinner-2') — used to
// regroup My Order / the receipt by offering, not just by day.
const serviceOf = (item: OrderItem): Service => (item.serviceSlot || '').startsWith('Dinner') ? 'Dinner' : 'Lunch';

// Shared shape of every "line" this screen deals with — a confirmed order
// item plus which order it belongs to, and (for My Order) an optional
// same-day sequence number used for the "Extra" badge.
interface OrderLine { order: Order; item: OrderItem; seq?: number; }

// Full "Tuesday, Aug 11"-style label for a 'YYYY-MM-DD' date string — the
// same format getThisWeekDays (below) uses for the draft cart, so a
// confirmed order's day header reads the same way once it's locked in,
// instead of the terser abbreviated weekday ("MON") it showed before.
// Built from y/m/d components (not `new Date(dateStr)`) to avoid the
// UTC-parsing timezone shift that can land on the wrong calendar day.
// Falls back to the raw deliveryDay if the date is missing/unparseable,
// rather than rendering a blank header.
const formatFullDateLabel = (dateStr: string, fallback: string): string => {
  if (!dateStr) return fallback;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return fallback;
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return fallback;
  return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
};

// Order -> Offering -> Day, in that nesting order — an order can contain
// both Lunch and Dinner items for the same day (or, for a receipt spanning
// a "Pay balance" claim, more than one order), and each level is cooked/
// delivered/settled as its own distinct batch, so they always render as
// separate groups rather than being interleaved.
function groupByOrderServiceDay(lines: OrderLine[]) {
  const orderIds: string[] = [];
  lines.forEach(l => { if (!orderIds.includes(l.order.id)) orderIds.push(l.order.id); });
  return orderIds.map(orderId => {
    const orderLines = lines.filter(l => l.order.id === orderId);
    const services = (['Lunch', 'Dinner'] as Service[])
      .map(service => {
        const serviceLines = orderLines.filter(l => serviceOf(l.item) === service);
        if (!serviceLines.length) return null;
        const days: { date: string; label: string; items: OrderLine[] }[] = [];
        serviceLines.forEach(line => {
          const date = line.item.deliveryDate || '';
          const last = days[days.length - 1];
          if (last && last.date === date) last.items.push(line);
          else days.push({ date, label: formatFullDateLabel(date, line.item.deliveryDay || ''), items: [line] });
        });
        return { service, days };
      })
      .filter((g): g is { service: Service; days: { date: string; label: string; items: OrderLine[] }[] } => g !== null);
    return { order: orderLines[0].order, services };
  });
}

interface MealSelection {
  curryId: string;
  baseId: string;
  dhalId: string;      // '' = not chosen yet, 'none' = explicitly skipped
  saladId: string;
  beverageId: string;
  dessertId: string;
  note: string;        // Who's this meal for
  instructions?: string; // Custom instructions
}

const emptySelection = (curryId: string): MealSelection => ({
  curryId, baseId: '', dhalId: '', saladId: '', beverageId: 'none', dessertId: 'none', note: '', instructions: ''
});

interface WeekDay { key: WeekdayKey; date: string; label: string; short: string; }

const getThisWeekDays = (systemDateStr: string): WeekDay[] => {
  const [y, m, d] = systemDateStr.split('-').map(Number);
  const base = new Date(y, (m || 1) - 1, d || 1);
  const dow = base.getDay();
  const diffToMonday = dow === 6 ? 2 : (dow === 0 ? 1 : (1 - dow));
  const monday = new Date(base);
  monday.setDate(base.getDate() + diffToMonday);
  const out: WeekDay[] = [];
  WEEKDAY_KEYS.forEach((key, i) => {
    const dt = new Date(monday);
    dt.setDate(monday.getDate() + i);
    const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    out.push({
      key,
      date: iso,
      label: dt.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
      short: dt.toLocaleDateString('en-US', { weekday: 'short' })
    });
  });
  return out;
};

// Adds/subtracts whole days to a 'YYYY-MM-DD' string — used to get from
// "this week's" Monday to "next week's" Monday (7 days ahead) without
// pulling in a date library for one calculation.
const addDays = (dateStr: string, days: number): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, (d || 1) + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

// Same pattern as addDays, but shifting whole calendar months — used to draw
// the Order History display window (last 3 months) off the actual calendar
// rather than a fixed day count, so it behaves the same in a 28-day month or
// a 31-day one.
const addMonths = (dateStr: string, months: number): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1 + months, d || 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

const mealNotesLine = (m: MealSelection): string => {
  const parts: string[] = [];
  const b = MEAL_BASES.find(x => x.id === m.baseId);
  if (b) parts.push(b.name);
  const dh = m.dhalId !== 'none' ? MEAL_DHALS.find(x => x.id === m.dhalId) : null;
  if (dh) parts.push(dh.name);
  const sl = m.saladId !== 'none' ? MEAL_SALADS.find(x => x.id === m.saladId) : null;
  if (sl) parts.push(sl.name);
  const bv = m.beverageId !== 'none' ? MEAL_BEVERAGES.find(x => x.id === m.beverageId) : null;
  if (bv) parts.push(bv.name);
  const ds = m.dessertId !== 'none' ? MEAL_DESSERTS.find(x => x.id === m.dessertId) : null;
  if (ds) parts.push(ds.name);
  if (m.instructions?.trim()) parts.push(`req: ${m.instructions.trim()}`);
  if (m.note.trim()) parts.push(`for ${m.note.trim()}`);
  return parts.join(' · ');
};

// Same as mealNotesLine but without the base (already shown alongside the
// curry in mealSummaryLabel) and without the "for X" note — the note gets
// its own pill tag (PersonTag) wherever this is used, rather than being
// buried in a wall of text.
const mealExtrasList = (m: MealSelection): string[] => {
  const parts: string[] = [];
  const dh = m.dhalId !== 'none' ? MEAL_DHALS.find(x => x.id === m.dhalId) : null;
  if (dh) parts.push(dh.name);
  const sl = m.saladId !== 'none' ? MEAL_SALADS.find(x => x.id === m.saladId) : null;
  if (sl) parts.push(sl.name);
  const bv = m.beverageId !== 'none' ? MEAL_BEVERAGES.find(x => x.id === m.beverageId) : null;
  if (bv) parts.push(bv.name);
  const ds = m.dessertId !== 'none' ? MEAL_DESSERTS.find(x => x.id === m.dessertId) : null;
  if (ds) parts.push(ds.name);
  return parts;
};
const mealExtrasLabel = (m: MealSelection): string => mealExtrasList(m).join(' · ');

// Once a meal becomes a confirmed OrderItem, the "for X" note only survives
// as the trailing segment of the flattened `notes` string (mealNotesLine
// above) — OrderItem has no separate field for it. This pulls that segment
// back out so it can render as its own tag instead of buried in prose.
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

// A confirmed OrderItem only stores its curry id (itemId) plus a flattened
// text description — there's no structured base/dhal/salad/beverage/dessert
// field to edit directly (OrderItem was never extended to carry one). This
// rebuilds a MealSelection good enough to reopen in the builder by matching
// each name in the notes back against the known option lists — reliable as
// long as those names stay unique across categories, which they are today.
const reconstructSelection = (item: OrderItem): MealSelection => {
  if (item.baseId !== undefined) {
    const { person } = splitNotesTag(item.notes || '');
    return {
      curryId: item.itemId,
      baseId: item.baseId || MEAL_BASES[0].id,
      dhalId: item.dhalId || 'none',
      saladId: item.saladId || 'none',
      beverageId: item.beverageId || 'none',
      dessertId: item.dessertId || 'none',
      note: person || '',
      instructions: item.instructions || ''
    };
  }
  const { detail, person, instructions } = splitNotesTag(item.notes || '');
  const segments = detail.split(' · ').map(s => s.trim()).filter(Boolean);
  const baseMatch = MEAL_BASES.find(b => segments.includes(b.name));
  const dhalMatch = MEAL_DHALS.find(x => segments.includes(x.name));
  const saladMatch = MEAL_SALADS.find(x => segments.includes(x.name));
  const bevMatch = MEAL_BEVERAGES.find(x => segments.includes(x.name));
  const desMatch = MEAL_DESSERTS.find(x => segments.includes(x.name));
  return {
    curryId: item.itemId,
    baseId: baseMatch?.id || MEAL_BASES[0].id,
    dhalId: dhalMatch?.id || 'none',
    saladId: saladMatch?.id || 'none',
    beverageId: bevMatch?.id || 'none',
    dessertId: desMatch?.id || 'none',
    note: person || '',
    instructions: instructions || ''
  };
};

// _fsItemId is the item's real Firestore document id under
// orders/{orderId}/items — auto-generated by confirmCheckout, distinct from
// the "itemId" data field (which is just which dish/curry this item is).
// The customer-side "Pay"/"Pay order"/"Pay balance" claim needs it to write
// back to the exact item document; it's undefined for anything sourced from
// the local mock store rather than the live Firestore listeners (see
// Operations.tsx's identical FsOrderItem, used for the same reason there).
type FsOrderItem = OrderItem & { _fsItemId?: string };

const isPayNowMethod = (name: string) => name.includes('Juice');

// Three payment states, not two: the customer telling the app how they'll
// pay (paymentMethodName set) is a claim, not a confirmed receipt — only
// Operations confirming it (via the Operator Console) sets paymentStatus to
// 'Paid'. "Unclaimed" is the only state that still needs the customer to
// act; "awaiting" just needs Operations to check their bank/wallet statement.
const isUnclaimed = (item: OrderItem) => item.paymentStatus !== 'Paid' && !item.paymentMethodName && item.status !== 'Cancelled';
const isAwaitingConfirmation = (item: OrderItem) => item.paymentStatus !== 'Paid' && !!item.paymentMethodName;
const paymentStatusInfo = (item: OrderItem): { label: string; tone: 'success' | 'warning' | 'danger' | 'slate' } => {
  if (item.status === 'Cancelled') {
    if (item.paymentStatus === 'Refunded') return { label: 'Refunded', tone: 'warning' };
    return { label: 'No payment due', tone: 'slate' };
  }
  if (item.paymentStatus === 'Refunded') return { label: 'Refunded', tone: 'warning' };
  if (item.paymentStatus === 'Paid') return { label: 'Paid', tone: 'success' };
  if (item.paymentMethodName) return { label: 'Awaiting confirmation', tone: 'warning' };
  return { label: 'Unpaid', tone: 'danger' };
};

const statusTone = (status?: string): 'success' | 'warning' | 'danger' | 'slate' => {
  if (status === 'Cancelled') return 'danger';
  if (status === 'Completed' || status === 'Delivered') return 'success';
  if (status === 'Preparing' || status === 'En route' || status === 'Ready') return 'warning';
  return 'slate';
};

interface CustomerPortalProps { onLogout?: () => void; }

const CustomerPortal: React.FC<CustomerPortalProps> = ({ onLogout }) => {
  const [currentUser, setCurrentUser] = useState<Customer | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loyaltyTiers, setLoyaltyTiers] = useState(LOYALTY_TIERS);
  const [customerGroups, setCustomerGroups] = useState(CUSTOMER_GROUPS);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [systemDate, setSystemDate] = useState(MOCK_TODAY);
  const [view, setView] = useState<'home' | 'menu' | 'order' | 'contact'>('home');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [cart, setCart] = useState<Record<string, MealSelection[]>>(() => {
    try {
      const saved = localStorage.getItem('bmz_customer_cart_lunch');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  // Dinner's own draft cart, kept as a separate parallel state rather than
  // folding a service key into `cart` — same shape, same day-keyed pattern,
  // just a second bucket so Lunch's existing logic above stays untouched.
  const [dinnerCart, setDinnerCart] = useState<Record<string, MealSelection[]>>(() => {
    try {
      const saved = localStorage.getItem('bmz_customer_cart_dinner');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('bmz_customer_cart_lunch', JSON.stringify(cart));
    } catch (e) {
      console.error('Failed to save lunch cart to localStorage', e);
    }
  }, [cart]);

  useEffect(() => {
    try {
      localStorage.setItem('bmz_customer_cart_dinner', JSON.stringify(dinnerCart));
    } catch (e) {
      console.error('Failed to save dinner cart to localStorage', e);
    }
  }, [dinnerCart]);
  // Which offering the Menu tab is currently browsing/adding to — the Draft
  // review further down shows both services at once regardless of this.
  const [activeService, setActiveService] = useState<Service>('Lunch');
  // Which week the Menu tab is currently browsing/adding to — same idea as
  // activeService, and likewise the Draft review shows both weeks at once
  // regardless of this (the day label already carries the date, so there's
  // no ambiguity there without an extra switcher).
  const [activeWeek, setActiveWeek] = useState<WeekChoice>('This');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Home's "How BonManzE works" card starts collapsed — repeat customers
  // don't need a permanent 4-line explainer taking up a full card every
  // time they open the app, but first-timers can still tap it open.
  const [guideOpen, setGuideOpen] = useState(false);

  // --- Real Firebase Auth state (replaces the old mock customer-picker) ---
  // customerDocRaw holds the customers/{uid} document exactly as Firestore
  // returns it (tier/group as schema ids, e.g. "t4") — currentUser below is
  // derived from it in its own effect further down, rather than resolved
  // inline in onAuthStateChanged, so the tier/group name lookups never run
  // against a stale loyaltyTiers/customerGroups closure.
  const [customerDocRaw, setCustomerDocRaw] = useState<any | null>(null);
  // True only until Firebase Auth's persisted-session check resolves once,
  // on first mount — avoids flashing the login screen for an already
  // signed-in customer before their session is restored.
  const [authChecking, setAuthChecking] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [resubmitPhone, setResubmitPhone] = useState('');
  const [resubmitStreet, setResubmitStreet] = useState('');
  const [resubmitCity, setResubmitCity] = useState('');
  const [resubmitLoading, setResubmitLoading] = useState(false);
  const [resubmitError, setResubmitError] = useState<string | null>(null);

  // --- Real order history (replaces nothing — supplements the existing
  // mock `orders`/myOrders below). A real checkout (see handleCheckout)
  // now writes to Firestore's orders/{orderId} + items subcollection via
  // confirmCheckout, not the local store — so without this, a customer
  // who places a real order would never see it again anywhere in the app.
  // Two raw listeners (order envelopes, and a collectionGroup query across
  // every order's items) are combined into full Order objects below, rather
  // than nesting a per-order items listener, so a new order's items show up
  // in one query instead of needing to know every orderId up front.
  const [fsOrderDocs, setFsOrderDocs] = useState<Record<string, any>>({});
  const [fsItemDocs, setFsItemDocs] = useState<Record<string, any[]>>({});
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [builderSaving, setBuilderSaving] = useState(false);
  const [cancellingItemId, setCancellingItemId] = useState<string | null>(null);

  const [builder, setBuilder] = useState<{
    day: WeekDay; service: Service; weekStart: string; openSection: 1 | 2 | 3; sel: MealSelection; editIndex: number | null;
    // Set only when editing an already-confirmed meal (as opposed to a
    // draft-cart one, which uses editIndex) — commitBuilder branches on this.
    editingConfirmed: { orderId: string; date: string; slot: string; fsItemId?: string } | null;
  } | null>(null);

  // Picking "None" for Dhal/Salad just updates the selection immediately —
  // no per-tap interrupt. The free-item forfeiture warning now fires once,
  // batched, at commit time (see forfeitConfirm/commitBuilder below) rather
  // than once per category, which used to fire twice back-to-back if both
  // were skipped.
  const requestExtraChange = (field: 'dhalId' | 'saladId', id: string) => {
    setBuilderSel({ [field]: id } as Partial<MealSelection>);
  };

  // Any applicable category left on "none" that has at least one free
  // (price 0/undefined) option available — Dhal/Salad usually, but also
  // Beverage/Dessert when the specific dish offers a free item there (e.g.
  // Mineral Water, Coconut Cake) — gets confirmed once, at commit time,
  // listing everything the customer is about to forfeit, so nothing free
  // is lost by accident without one clear final chance to go back. `apply`
  // is the real commit (performCommit) to run once confirmed; when nothing
  // free is being skipped, commitBuilder below calls performCommit
  // directly and this never appears.
  const [forfeitConfirm, setForfeitConfirm] = useState<{ labels: string[]; apply: () => void } | null>(null);

  // fsItemId (on the item-kind shape, and per-entry on the balance-kind
  // shape) is the real Firestore document id to write to — undefined for a
  // mock-store item. commitPayment below uses its presence/absence to route
  // each target to either a real writeBatch update or the old mock
  // submitPaymentClaim, so a mixed "Pay balance" spanning both a real order
  // and mock demo history still settles every line correctly.
  const [payTarget, setPayTarget] = useState<{
    kind: 'item'; orderId: string; date: string; slot: string; amount: number; what: string; ref: string; fsItemId?: string;
  } | { kind: 'balance'; items: { orderId: string; date: string; slot: string; amount: number; fsItemId?: string }[]; amount: number; what: string; ref: string; } | null>(null);
  const [payMethod, setPayMethod] = useState<PaymentMethod | null>(null);
  // The customer's own transaction reference (from their Juice/MauCAS app),
  // entered on top of the reference we generate — both get stored so
  // Operations has whatever's most useful for matching against a statement.
  const [customerRef, setCustomerRef] = useState('');
  // Loading/error state for commitPayment's real Firestore write — mirrors
  // the pattern Operations.tsx's Mark Delivered/Mark Paid round established.
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const [ratings, setRatings] = useState<Record<string, { stars: number; comment: string }>>({});
  const [rateTarget, setRateTarget] = useState<{ orderId: string; fsItemId?: string; itemId: string; label: string } | null>(null);
  const [rateStars, setRateStars] = useState(0);
  const [rateComment, setRateComment] = useState('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

  // Receipt sheet — either one paid meal (item-level Pay) or every line in an
  // Order once every item in it has been confirmed paid (order-level Paid).
  // seq carries over from thisWeekLinesWithSeq so the "Extra 2/3" badge can
  // still show on the receipt, same as it does in My Order.
  const [receiptTarget, setReceiptTarget] = useState<{ order: Order; lines: { order: Order; item: OrderItem; seq?: number }[] } | null>(null);
  // Menus are looked up live via lunchMenuForWeek(weekStart)/dinnerMenuForWeek
  // (weekStart) — module-level pure functions reading store.ts's live
  // week-override maps — rather than held in React state directly. This tick
  // just forces a re-render whenever Operations edits either menu, same
  // pattern as configTick below for SYSTEM_CONFIG.
  const [menuTick, setMenuTick] = useState(0);
  // SYSTEM_CONFIG (VAT on/off, rate, VRN, etc.) is a plain mutable object, not
  // React state — this tick just forces a re-render whenever Operations saves
  // a change, so cart totals reflect it without needing a reload.
  const [configTick, setConfigTick] = useState(0);

  useEffect(() => {
    const u1 = subscribeToLoyaltyTiers(setLoyaltyTiers);
    const u2 = subscribeToCustomerGroups(setCustomerGroups);
    const u3 = subscribeToCustomers(setCustomers);
    const u4 = subscribeToPaymentMethods(setPaymentMethods);
    const u5 = subscribeToOrders(setOrders);
    const u6 = subscribeToSystemDate(setSystemDate);
    const u7 = subscribeToLunchMenu(() => setMenuTick(t => t + 1));
    const u8 = subscribeToConfig(() => setConfigTick(t => t + 1));
    const u9 = subscribeToDinnerMenu(() => setMenuTick(t => t + 1));
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8(); u9(); };
  }, []);

  // If Operations turns Dinner off while it's the active tab, fall back to
  // Lunch rather than leaving the Menu tab stuck showing a now-hidden service.
  useEffect(() => {
    if (!SYSTEM_CONFIG.dinnerEnabled && activeService === 'Dinner') setActiveService('Lunch');
  }, [configTick, activeService]);

  const menuFor = (service: Service, weekStart: string) => service === 'Dinner' ? dinnerMenuForWeek(weekStart) : lunchMenuForWeek(weekStart);
  const cartFor = (service: Service) => service === 'Dinner' ? dinnerCart : cart;
  const setCartFor = (service: Service) => service === 'Dinner' ? setDinnerCart : setCart;

  // Local helpers that need to look up a curry by id for a given service AND
  // week (the same weekday can show a different curry lineup next week than
  // this week, once that week has its own menu override).
  const mealPrice = (m: MealSelection, weekdayKey: WeekdayKey, service: Service, weekStart: string): number => {
    const c = menuFor(service, weekStart)[weekdayKey].find(x => x.id === m.curryId);
    const b = MEAL_BASES.find(x => x.id === m.baseId);
    const dh = m.dhalId !== 'none' ? MEAL_DHALS.find(x => x.id === m.dhalId) : null;
    const sl = m.saladId !== 'none' ? MEAL_SALADS.find(x => x.id === m.saladId) : null;
    const v = m.beverageId !== 'none' ? MEAL_BEVERAGES.find(x => x.id === m.beverageId) : null;
    const d = m.dessertId !== 'none' ? MEAL_DESSERTS.find(x => x.id === m.dessertId) : null;
    return (c?.price || 0) + (b?.up || 0) + (dh?.price || 0) + (sl?.price || 0) + (v?.price || 0) + (d?.price || 0);
  };
  const mealSummaryLabel = (m: MealSelection, weekdayKey: WeekdayKey, service: Service, weekStart: string): string => {
    const c = menuFor(service, weekStart)[weekdayKey].find(x => x.id === m.curryId);
    const b = MEAL_BASES.find(x => x.id === m.baseId);
    return `${c?.emoji || ''} ${c?.name || ''}${b ? ` · ${b.name}` : ''}`;
  };

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 3000);
    return () => clearTimeout(t);
  }, [toastMsg]);

  // Real login/registration (Firebase Auth), replacing the old mock
  // customer-picker. Fires once on mount and again on every sign-in/out.
  // Only fetches *which* customer is signed in — currentUser itself is
  // derived from customerDocRaw in the next effect below.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setCustomerDocRaw(null);
        setAuthChecking(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'customers', user.uid));
        if (snap.exists()) {
          setCustomerDocRaw({ id: user.uid, ...snap.data() });
        } else {
          // Signed in with Firebase but no customers/{uid} doc — shouldn't
          // happen via registerCustomer's own flow, but fail safe rather
          // than show an app screen with a half-populated currentUser.
          setAuthError('Signed in, but no customer record was found for this account.');
          await signOut(auth);
        }
      } catch (err) {
        console.error('Failed to load customer profile', err);
        setAuthError('Could not load your account — please try again.');
      } finally {
        setAuthChecking(false);
      }
    });
    return unsub;
  }, []);

  // Re-derive currentUser from the raw Firestore doc whenever it (or the
  // loyaltyTiers/customerGroups arrays it resolves ids against) changes.
  // Firestore stores tier/group as schema ids ("t4"/"g3" — see
  // scripts/seedCustomers.js and functions/index.js), but every other part
  // of this app (built long before Firestore existed) expects tier/group
  // as a display NAME ("Diamond"/"VIP") to match against loyaltyTiers —
  // this is the one translation step that keeps a real Firestore customer
  // from silently regressing to "t4 Member" in the header.
  useEffect(() => {
    if (!customerDocRaw) { setCurrentUser(null); return; }
    setCurrentUser({
      id: customerDocRaw.id,
      firstName: customerDocRaw.firstName,
      lastName: customerDocRaw.lastName,
      name: customerDocRaw.name,
      email: customerDocRaw.email,
      phone: customerDocRaw.phone || '',
      segment: customerDocRaw.segment,
      group: customerGroups.find(g => g.id === customerDocRaw.group)?.name ?? customerDocRaw.group,
      lastOrder: customerDocRaw.lastOrder,
      ltv: customerDocRaw.ltv ?? 0,
      points: customerDocRaw.points ?? 0,
      storeCredit: customerDocRaw.storeCredit ?? 0,
      tier: loyaltyTiers.find(t => t.id === customerDocRaw.tier)?.name ?? customerDocRaw.tier,
      birthday: customerDocRaw.birthday,
      avatar: customerDocRaw.avatar || `https://picsum.photos/seed/${customerDocRaw.id}/100/100`,
      referenceCode: customerDocRaw.referenceCode,
      gdprConsent: customerDocRaw.gdprConsent,
      addresses: customerDocRaw.addresses || [],
      dietaryPreferences: customerDocRaw.dietaryPreferences,
      registrationStatus: customerDocRaw.registrationStatus,
      rejectionReason: customerDocRaw.rejectionReason,
    });
  }, [customerDocRaw, loyaltyTiers, customerGroups]);

  useEffect(() => {
    if (currentUser && currentUser.registrationStatus === 'Rejected') {
      setResubmitPhone(currentUser.phone || '');
      setResubmitStreet(currentUser.addresses?.[0]?.street || '');
      setResubmitCity(currentUser.addresses?.[0]?.city || '');
    }
  }, [currentUser]);

  // Live listeners for this customer's REAL Firestore orders — separate
  // from the mock `subscribeToOrders` above, which only ever reflects the
  // local store's pre-seeded/demo order history. Two queries rather than
  // one: order envelopes (orders/{orderId} where customerId == uid) and a
  // COLLECTION GROUP query across every order's items subcollection
  // (orders/*/items where customerId == uid) — the same customerId is
  // duplicated onto every item precisely so this query doesn't need to
  // already know which orderIds exist (see
  // BonManzE_Firestore_Schema.md's `orders/{orderId}/items/{itemId}` note).
  // Both listeners tear down on sign-out/unmount, same as every other
  // subscription in this file.
  useEffect(() => {
    const uid = customerDocRaw?.id;
    if (!uid) { setFsOrderDocs({}); setFsItemDocs({}); return; }
    const ordersQuery = query(collection(db, 'orders'), where('customerId', '==', uid));
    const unsubOrders = onSnapshot(ordersQuery, snap => {
      const map: Record<string, any> = {};
      snap.forEach(d => { map[d.id] = d.data(); });
      setFsOrderDocs(map);
    }, err => console.error('orders listener failed', err));
    const itemsQuery = query(collectionGroup(db, 'items'), where('customerId', '==', uid));
    const unsubItems = onSnapshot(itemsQuery, snap => {
      const grouped: Record<string, any[]> = {};
      snap.forEach(d => {
        const orderId = d.ref.parent.parent?.id;
        if (!orderId) return;
        if (!grouped[orderId]) grouped[orderId] = [];
        // _fsItemId carries the item's real Firestore document id — the
        // payment-claim write (commitPayment below) needs it to build a
        // doc() reference back to the exact item, same reason Operations.tsx
        // carries it through its own equivalent listener.
        grouped[orderId].push({ ...d.data(), _fsItemId: d.id });
      });
      setFsItemDocs(grouped);
    }, err => console.error('order items listener failed', err));
    return () => { unsubOrders(); unsubItems(); };
  }, [customerDocRaw?.id]);

  // Reshapes the two raw Firestore listeners above into the SAME `Order`
  // shape every other screen in this file already knows how to render
  // (groupByOrderServiceDay, the receipt sheet, My Order, Profile's order
  // history) — so none of that existing rendering code needs to change to
  // understand a real order, it just needs an `Order` object. `status`/
  // `paymentStatus` don't exist at the order-envelope level in Firestore
  // (only per item, see the schema doc) — derived here from whether every
  // item is Paid, a reasonable summary for the handful of places that read
  // the order-level field rather than iterating items directly.
  const firestoreOrders: Order[] = useMemo(() => {
    return Object.keys(fsOrderDocs).map(orderId => {
      const o = fsOrderDocs[orderId] || {};
      const rawItems: any[] = fsItemDocs[orderId] || [];
      // paymentMethodName/paymentReference/isReconciled (the customer's own
      // payment claim, and Operations' reconciliation flag) plus _fsItemId
      // (extending OrderItem, not part of it) ride along through this
      // reshape so the payment-claim write in commitPayment below can both
      // render the claim already made and build a real doc() reference back
      // to Firestore — same fields Operations.tsx's equivalent memo carries.
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
        customerName: o.customerName || currentUser?.name || '',
        type: o.type || 'Meal Plan',
        status: allPaid ? 'Completed' : 'Pending',
        paymentStatus: allPaid ? 'Paid' : 'Pending',
        tenderType: o.tenderType || undefined,
        paymentMethodName: o.paymentMethodName || undefined,
        paymentScheme: o.paymentScheme,
        items,
        total: o.total ?? 0,
        timestamp: createdAtIso,
        discount: o.discount,
        discountReason: o.discountReason,
      } as Order;
    });
  }, [fsOrderDocs, fsItemDocs, currentUser]);

  // Which order ids are real (Firestore) vs. the local mock's pre-seeded
  // demo history — used below to hide Edit/Cancel controls on real orders.
  // editOrderItem/cancelOrderItem still only mutate the local mock store by
  // looking up an order id there — a real order's Firestore id would never
  // be found, so rather than ship buttons that silently do nothing (or
  // worse), they stay hidden for real orders, with a short explanatory note
  // instead. Wiring those to real Cloud Functions is separate follow-up
  // work, not done here — see the schema doc's open items.
  // Pay/Pay order/Pay balance are NOT gated by this anymore (2026-08-13) —
  // commitPayment below tells a real item apart from a mock one via
  // _fsItemId (set only on Firestore-sourced items) and writes to the right
  // place either way, so the same buttons now work for both.
  const firestoreOrderIds = useMemo(() => new Set(firestoreOrders.map(o => o.id)), [firestoreOrders]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      const normalized = loginUsername.trim().toLowerCase();
      const usernameSnap = await getDoc(doc(db, 'usernames', normalized));
      if (!usernameSnap.exists()) {
        setAuthError('No account found with that username.');
        return;
      }
      const { email } = usernameSnap.data() as { email: string };
      await signInWithEmailAndPassword(auth, email, loginPassword);
      // onAuthStateChanged (above) picks up from here and loads the profile.
    } catch (err: any) {
      setAuthError(friendlyAuthError(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      const register = httpsCallable(functions, 'registerCustomer');
      await register({
        username: regUsername.trim(),
        email: regEmail.trim(),
        password: regPassword,
        firstName: regFirstName.trim(),
        lastName: regLastName.trim(),
        phone: regPhone.trim(),
      });
      // registerCustomer creates the account server-side via the Admin SDK,
      // which doesn't give the browser a session — sign in with the same
      // credentials the customer just chose to actually establish one.
      await signInWithEmailAndPassword(auth, regEmail.trim(), regPassword);
    } catch (err: any) {
      setAuthError(friendlyAuthError(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const friendlyAuthError = (err: any): string => {
    const code = err?.code || '';
    if (code.includes('wrong-password') || code.includes('invalid-credential')) return 'Incorrect password.';
    if (code.includes('too-many-requests')) return 'Too many attempts — please wait a moment and try again.';
    if (code.includes('user-disabled')) return 'This account has been disabled.';
    // Cloud Function HttpsErrors (registration) and most Auth SDK errors
    // already carry a readable message — see functions/index.js.
    return err?.message?.replace(/^Firebase: /, '').replace(/\s*\(auth\/[a-z-]+\)\.?$/i, '') || 'Something went wrong — please try again.';
  };

  // Keeps the logged-in customer's own record (points, storeCredit, etc.)
  // in sync with the LOCAL mock customers store whenever it changes — e.g.
  // a cancelled paid meal adds store credit via updateCustomerRecord. This
  // is now effectively inert for a real Firebase-authenticated customer
  // (their id is a Firebase UID, never present in the local GLOBAL_CUSTOMERS
  // array), a known, disclosed gap — see BonManzE_Firestore_Schema.md §5.
  // Left in place rather than removed since it's harmless and still exactly
  // correct for the local-store world every *other* part of this screen
  // (orders, cart, menu) still lives in.
  useEffect(() => {
    if (!currentUser) return;
    const updated = customers.find(c => c.id === currentUser.id);
    if (updated && JSON.stringify(updated) !== JSON.stringify(currentUser)) {
      setCurrentUser(updated);
    }
  }, [customers, currentUser]);

  const toast = (msg: string) => setToastMsg(msg);

  const weekDays = useMemo(() => getThisWeekDays(systemDate), [systemDate]);
  // Customers can now browse and order a week ahead too — same menu
  // mechanics, just a second set of days, one calendar week later.
  const nextWeekDays = useMemo(() => getThisWeekDays(addDays(systemDate, 7)), [systemDate]);
  // Bundles the two orderable weeks together so anything that needs to walk
  // "everything currently orderable" (cart totals, checkout, Draft) does it
  // once, consistently, instead of duplicating a two-week loop everywhere.
  // Widening the horizon later (e.g. a third week) means adding one entry
  // here, not touching every call site.
  const orderableWeeks = useMemo(() => ([
    { start: weekDays[0].date, days: weekDays },
    { start: nextWeekDays[0].date, days: nextWeekDays },
  ]), [weekDays, nextWeekDays]);

  const culturePhrase = useMemo(() => CREOLE_PHRASES[new Date().getDate() % CREOLE_PHRASES.length], []);
  const isBirthday = useMemo(() => isBirthdayToday(currentUser?.birthday, systemDate), [currentUser, systemDate]);

  // --- CART / BUILDER ---
  const openBuilder = (day: WeekDay, service: Service, weekStart: string, presetCurryId?: string, editIndex: number | null = null) => {
    const existing = editIndex !== null ? cartFor(service)[day.date]?.[editIndex] : null;
    setBuilder({
      day,
      service,
      weekStart,
      openSection: 1,
      editIndex,
      editingConfirmed: null,
      // A brand-new meal defaults "who's this for" to whoever's signed in —
      // it's almost always themselves, and typing your own name every time
      // was the one bit of friction left in an otherwise one-tap flow. Only
      // applies to a fresh meal; editing an existing one (draft or
      // confirmed) keeps whatever note is already there, even if blank.
      sel: existing ? { ...existing } : { ...emptySelection(presetCurryId || menuFor(service, weekStart)[day.key][0].id), note: currentUser.firstName || '' }
    });
  };

  // Editing an already-confirmed meal, gated by the same cutoff that gates
  // Cancel — the button that calls this is only shown once that check
  // passes, but this guards directly too in case anything calls it earlier.
  // The confirmed meal could fall in either orderable week, so this searches
  // both to find the matching day and which week it belongs to.
  const openEditConfirmed = (line: Line) => {
    const service: Service = (line.item.serviceSlot || '').startsWith('Dinner') ? 'Dinner' : 'Lunch';
    if (isPastCancelCutoff(line.item.deliveryDate || '', service, systemDate)) {
      const cutoffTime = service === 'Dinner' ? SYSTEM_CONFIG.dinnerCancelCutoffTime : SYSTEM_CONFIG.lunchCancelCutoffTime;
      toast(`Locked — the ${formatTimeLabel(cutoffTime)} cutoff (${cancelCutoffDayPhrase(service)}) has passed`);
      return;
    }
    let day: WeekDay | undefined;
    let weekStart = orderableWeeks[0].start;
    for (const week of orderableWeeks) {
      const found = week.days.find(d => d.date === line.item.deliveryDate);
      if (found) { day = found; weekStart = week.start; break; }
    }
    if (!day) return;
    setBuilder({
      day,
      service,
      weekStart,
      openSection: 1,
      editIndex: null,
      editingConfirmed: { orderId: line.order.id, date: line.item.deliveryDate || '', slot: line.item.serviceSlot || 'Lunch', fsItemId: line.item._fsItemId },
      sel: reconstructSelection(line.item)
    });
  };

  const closeBuilder = () => setBuilder(null);

  const setBuilderSel = (patch: Partial<MealSelection>) => {
    setBuilder(b => b ? { ...b, sel: { ...b.sel, ...patch } } : b);
  };

  // Picking a curry or base auto-collapses that section and opens the next
  // one; every section stays visible (as a collapsed summary row) so the
  // user can tap back into it, rather than being hidden behind a Next/Back
  // paged wizard.
  const selectCurry = (id: string) => setBuilder(b => {
    if (!b) return b;
    // Resolved through its linked Meal Library Main (if any) — see
    // resolveDish in store.ts — so applicable/narrowing checks below always
    // reflect the Main's *current* configuration, not a frozen copy from
    // whenever this dish was placed on the Menu Planner.
    const rawDish = menuFor(b.service, b.weekStart)[b.day.key].find(x => x.id === id);
    const dish = rawDish ? resolveDish(rawDish) : undefined;
    // A previous selection stays only if it's still in the newly-picked
    // dish's *allowed* set — covers both "different base group entirely"
    // (old behavior) and "same group, but this dish narrowed to a specific
    // few" (new — see dishBaseOptionIds/filterAddOnOptions in store.ts).
    const allowedBaseIds = dish ? dishBaseOptionIds(dish, MEAL_BASES) : undefined;
    const baseStillValid = !!b.sel.baseId && (!allowedBaseIds || allowedBaseIds.includes(b.sel.baseId));
    const stillAllowed = (current: string, allowedIds: string[] | undefined) =>
      current === '' || current === 'none' || !allowedIds || allowedIds.includes(current);
    return {
      ...b,
      sel: {
        ...b.sel,
        curryId: id,
        // Switching to a dish with a different/narrower base selection
        // invalidates whatever base was picked — reset it so the Base
        // step can't silently keep an incompatible selection.
        baseId: baseStillValid ? b.sel.baseId : '',
        // Dhal/Salad/Beverage/Dessert only apply (or only offer certain
        // items) to some dishes now — force to 'none' (skipped) when the
        // newly-selected dish doesn't offer the category at all, or reset
        // to unselected when it narrowed away the specific item that was
        // already picked, rather than leaving an now-invalid selection.
        dhalId: dish && !dishDhalApplicable(dish) ? 'none' : (stillAllowed(b.sel.dhalId, dish?.dhalOptionIds) ? b.sel.dhalId : ''),
        saladId: dish && !dishSaladApplicable(dish) ? 'none' : (stillAllowed(b.sel.saladId, dish?.saladOptionIds) ? b.sel.saladId : ''),
        beverageId: dish && !dishBeverageApplicable(dish) ? 'none' : (stillAllowed(b.sel.beverageId, dish?.beverageOptionIds) ? b.sel.beverageId : 'none'),
        dessertId: dish && !dishDessertApplicable(dish) ? 'none' : (stillAllowed(b.sel.dessertId, dish?.dessertOptionIds) ? b.sel.dessertId : 'none')
      },
      openSection: 2
    };
  });
  const selectBase = (id: string) => setBuilder(b => b ? { ...b, sel: { ...b.sel, baseId: id }, openSection: 3 } : b);
  const toggleSection = (n: 1 | 2 | 3) => setBuilder(b => b ? { ...b, openSection: n } : b);

  // A category that doesn't apply to the selected dish (e.g. Dhal for a
  // dish with dhalApplicable === false) is treated as automatically
  // complete regardless of its raw '' value — its ChipRow doesn't render
  // at all (see the Section 3 JSX below), so it would otherwise never
  // leave '' and permanently block the Add-to-order button.
  const sectionComplete = (b: NonNullable<typeof builder>) => {
    const rawDish = menuFor(b.service, b.weekStart)[b.day.key].find(x => x.id === b.sel.curryId);
    const dish = rawDish ? resolveDish(rawDish) : undefined;
    const dhalOk = !dish || !dishDhalApplicable(dish) || b.sel.dhalId !== '';
    const saladOk = !dish || !dishSaladApplicable(dish) || b.sel.saladId !== '';
    // A dish can also have Base *applicable* but narrowed down to zero
    // actual catalog entries (every specific item unticked, or the global
    // Base catalog itself is empty) — Base has no "None" escape valve like
    // Dhal/Salad do, so without this check there'd be nothing to pick and
    // Add-to-order would be permanently blocked. Treat "nothing to offer"
    // the same as "not applicable".
    const baseOptionCount = dish ? filterAddOnOptions(MEAL_BASES, dishBaseOptionIds(dish, MEAL_BASES)).length : MEAL_BASES.length;
    return {
      1: !!b.sel.curryId,
      // A dish with Base turned off entirely (or with nothing left to
      // offer after narrowing) doesn't need one picked — same
      // "inapplicable category is auto-complete" rule as Dhal/Salad.
      2: !dish || !dishBaseApplicable(dish) || baseOptionCount === 0 || !!b.sel.baseId,
      3: dhalOk && saladOk
    };
  };
  const builderReady = (b: NonNullable<typeof builder>) => {
    const c = sectionComplete(b);
    return c[1] && c[2] && c[3];
  };

  // The actual commit — unchanged from before this round of changes, just
  // renamed and pulled out of commitBuilder so the forfeiture check below
  // can defer calling it until after confirmation (or call it immediately
  // when there's nothing to confirm).
  const performCommit = () => {
    if (!builder) return;
    const { day, service, weekStart, sel, editIndex, editingConfirmed } = builder;

    if (editingConfirmed) {
      if (editingConfirmed.fsItemId) {
        setBuilderSaving(true);
        const editFn = httpsCallable(functions, 'editOrderItemSelection');
        editFn({
          orderId: editingConfirmed.orderId,
          itemId: editingConfirmed.fsItemId,
          selection: {
            curryId: sel.curryId,
            baseId: sel.baseId,
            dhalId: sel.dhalId,
            saladId: sel.saladId,
            beverageId: sel.beverageId,
            dessertId: sel.dessertId,
            note: sel.note,
            instructions: sel.instructions
          },
          systemDate,
        })
          .then((res: any) => {
            const data = res.data as { refundAmount?: number } | undefined;
            if (data?.refundAmount && data.refundAmount !== 0) {
              const diff = data.refundAmount;
              if (diff > 0) {
                toast(`Meal updated · Rs ${diff.toFixed(0)} credit refunded`);
              } else {
                toast(`Meal updated · Rs ${Math.abs(diff).toFixed(0)} charged`);
              }
            } else {
              toast('Meal updated');
            }
            closeBuilder();
          })
          .catch((err: any) => {
            console.error('Edit failed', err);
            toast(`Edit failed: ${err.message || 'Please try again.'}`);
          })
          .finally(() => {
            setBuilderSaving(false);
          });
        return;
      }

      const c = menuFor(service, weekStart)[day.key].find(x => x.id === sel.curryId);
      editOrderItem(editingConfirmed.orderId, editingConfirmed.date, editingConfirmed.slot, {
        itemId: sel.curryId,
        name: `${c?.emoji || ''} ${c?.name || 'Meal'}`,
        price: mealPrice(sel, day.key, service, weekStart),
        notes: mealNotesLine(sel)
      });
      toast('Meal updated');
      closeBuilder();
      return;
    }

    setCartFor(service)(prev => {
      const dayList = [...(prev[day.date] || [])];
      if (editIndex !== null) dayList[editIndex] = sel;
      else dayList.push(sel);
      return { ...prev, [day.date]: dayList };
    });
    toast(editIndex !== null ? 'Meal updated' : `${day.label} added · Rs ${mealPrice(sel, day.key, service, weekStart)}`);
    closeBuilder();
  };

  // Fired by the "Add to order"/"Save changes" button. Checks every
  // *applicable* category left on "none"/skipped and flags it if that
  // category actually has a free (price 0/undefined) option available to
  // this dish — data-driven rather than a hardcoded "Dhal/Salad are always
  // free, Beverage/Dessert are always paid" assumption, since individual
  // catalog items can be free either way (e.g. Mineral Water or Coconut
  // Cake at Rs 0 while other beverages/desserts carry a price). Opens one
  // consolidated confirmation listing everything forfeited instead of
  // committing immediately; commits straight away when nothing free is
  // being left behind.
  const commitBuilder = () => {
    if (!builder) return;
    const rawDish = menuFor(builder.service, builder.weekStart)[builder.day.key].find(x => x.id === builder.sel.curryId);
    const dish = rawDish ? resolveDish(rawDish) : undefined;
    const hasFreeOption = (opts: { price?: number }[]) => opts.some(o => !o.price);
    const forfeited: string[] = [];
    if (dish && dishDhalApplicable(dish) && builder.sel.dhalId === 'none' && hasFreeOption(filterAddOnOptions(MEAL_DHALS, dish.dhalOptionIds))) forfeited.push('Dhal');
    if (dish && dishSaladApplicable(dish) && builder.sel.saladId === 'none' && hasFreeOption(filterAddOnOptions(MEAL_SALADS, dish.saladOptionIds))) forfeited.push('Salad');
    if (dish && dishBeverageApplicable(dish) && builder.sel.beverageId === 'none' && hasFreeOption(filterAddOnOptions(MEAL_BEVERAGES, dish.beverageOptionIds))) forfeited.push('Beverage');
    if (dish && dishDessertApplicable(dish) && builder.sel.dessertId === 'none' && hasFreeOption(filterAddOnOptions(MEAL_DESSERTS, dish.dessertOptionIds))) forfeited.push('Dessert');
    if (forfeited.length > 0) {
      setForfeitConfirm({ labels: forfeited, apply: performCommit });
    } else {
      performCommit();
    }
  };

  const removeCartMeal = (dateKey: string, index: number, service: Service = 'Lunch') => {
    setCartFor(service)(prev => {
      const dayList = [...(prev[dateKey] || [])];
      dayList.splice(index, 1);
      return { ...prev, [dateKey]: dayList };
    });
  };

  const cartCount = useMemo(() => {
    let n = 0;
    Object.values(cart).forEach(list => { n += (list as MealSelection[]).length; });
    Object.values(dinnerCart).forEach(list => { n += (list as MealSelection[]).length; });
    return n;
  }, [cart, dinnerCart]);

  // --- DISCOUNT / TOTALS (reuses the app's real loyalty tier + group +
  // bulk-plan discount math, just adapted from a generic cart to the
  // day -> meals structure used here) ---
  const cartTotals = useMemo(() => {
    if (!currentUser) return { subtotal: 0, discount: 0, standardDiscount: 0, birthdayDiscount: 0, standardLabel: '', bulkDiscount: 0, vat: 0, total: 0 };

    const flat: { date: string; weekday: WeekdayKey; weekStart: string; price: number }[] = [];
    orderableWeeks.forEach(week => {
      week.days.forEach(d => {
        (cart[d.date] || []).forEach(m => flat.push({ date: d.date, weekday: d.key, weekStart: week.start, price: mealPrice(m, d.key, 'Lunch', week.start) }));
        (dinnerCart[d.date] || []).forEach(m => flat.push({ date: d.date, weekday: d.key, weekStart: week.start, price: mealPrice(m, d.key, 'Dinner', week.start) }));
      });
    });
    const subtotal = flat.reduce((t, f) => t + f.price, 0);

    const tierObj = loyaltyTiers.find(t => t.name.toLowerCase() === currentUser.tier?.toLowerCase());
    const groupObj = customerGroups.find(g => g.name.toLowerCase() === currentUser.group?.toLowerCase());
    const standardTierRate = tierObj?.standardDiscount || 0;
    const birthdayTierRate = tierObj?.birthdayDiscount || 0;
    const groupRate = groupObj?.discountPercentage || 0;
    const effectiveStandardRate = Math.max(standardTierRate, groupRate);
    const standardLabel = standardTierRate >= groupRate ? `${tierObj?.name || ''} Tier` : `${groupObj?.name || ''} Group`;

    let bMonth = -1, bDay = -1;
    if (currentUser.birthday) {
      const [, bm, bd] = currentUser.birthday.split('-').map(Number);
      bMonth = bm; bDay = bd;
    }

    let standardDiscount = 0, birthdayDiscount = 0;
    flat.forEach(f => {
      standardDiscount += f.price * (effectiveStandardRate / 100);
      const [, fm, fd] = f.date.split('-').map(Number);
      if (fm === bMonth && fd === bDay && birthdayTierRate > 0) birthdayDiscount += f.price * (birthdayTierRate / 100);
    });

    // Bulk ("full week") discount is scoped per calendar week, not summed
    // across both — booking a full week ahead earns it for that week only;
    // it doesn't take "half of each week" as satisfying the requirement.
    // Coverage is still Lunch-only (matches the check as it existed before
    // Dinner/next-week were added — not changing that business rule here).
    let bulkDiscount = 0;
    if (SYSTEM_CONFIG.bulkDiscountEnabled) {
      orderableWeeks.forEach(week => {
        const coveredDays = week.days.filter(d => (cart[d.date] || []).length > 0).length;
        if (coveredDays >= WEEKDAY_KEYS.length) {
          const weekSubtotal = flat.filter(f => f.weekStart === week.start).reduce((t, f) => t + f.price, 0);
          bulkDiscount += weekSubtotal * (SYSTEM_CONFIG.bulkDiscountRate / 100);
        }
      });
    }

    const totalDiscount = standardDiscount + birthdayDiscount + bulkDiscount;
    const netTotal = Math.max(0, subtotal - totalDiscount);
    const vatRate = SYSTEM_CONFIG.vatEnabled ? SYSTEM_CONFIG.vatRate / 100 : 0;
    const vat = netTotal * vatRate;
    const total = netTotal + vat;

    return {
      subtotal,
      discount: totalDiscount,
      standardDiscount,
      birthdayDiscount,
      standardLabel,
      standardRate: effectiveStandardRate,
      birthdayRate: birthdayTierRate,
      bulkDiscount,
      vat,
      total
    };
  }, [cart, dinnerCart, currentUser, loyaltyTiers, customerGroups, orderableWeeks, menuTick, configTick]);

  // Real checkout (2026-08-13) — calls the confirmCheckout Cloud Function
  // instead of building an Order locally and pushing it into the mock
  // store. The client submits WHAT was ordered (dish/add-on selections,
  // date, service, a same-day slot index) — never a price or a total; the
  // Function recomputes both server-side from the live menu + the
  // customer's actual tier/group/birthday (see BonManzE_Firestore_Schema.md
  // §4). `note` is still built client-side via mealNotesLine — dhal/salad
  // choices carry no price and confirmCheckout doesn't need them, but
  // they're still worth recording as text for kitchen prep, same as before.
  const handleCheckout = async () => {
    if (!currentUser || cartCount === 0 || checkoutLoading) return;
    const payloadItems: {
      curryId: string; baseId: string; dhalId: string; saladId: string; beverageId: string; dessertId: string;
      note: string; deliveryDate: string; service: Service; slotIndex: number;
    }[] = [];
    orderableWeeks.forEach(week => {
      week.days.forEach(d => {
        (cart[d.date] || []).forEach((m, idx) => {
          payloadItems.push({
            curryId: m.curryId, baseId: m.baseId, dhalId: m.dhalId, saladId: m.saladId, beverageId: m.beverageId, dessertId: m.dessertId,
            note: mealNotesLine(m), deliveryDate: d.date, service: 'Lunch', slotIndex: idx,
          });
        });
        (dinnerCart[d.date] || []).forEach((m, idx) => {
          payloadItems.push({
            curryId: m.curryId, baseId: m.baseId, dhalId: m.dhalId, saladId: m.saladId, beverageId: m.beverageId, dessertId: m.dessertId,
            note: mealNotesLine(m), deliveryDate: d.date, service: 'Dinner', slotIndex: idx,
          });
        });
      });
    });
    if (!payloadItems.length) return;
    setCheckoutError(null);
    setCheckoutLoading(true);
    try {
      const confirmCheckoutFn = httpsCallable(functions, 'confirmCheckout');
      const result = await confirmCheckoutFn({
        items: payloadItems,
        type: 'Meal Plan',
        paymentScheme: 'Per-Delivery',
        systemDate,
      });
      const data = result.data as { total?: number } | undefined;
      const confirmedTotal = typeof data?.total === 'number' ? data.total : cartTotals.total;
      setCart({});
      setDinnerCart({});
      setView('order');
      toast(`Order confirmed · ${payloadItems.length} meal${payloadItems.length !== 1 ? 's' : ''} · ${formatCurrency(confirmedTotal)} outstanding`);
      // The new order/items appear in myOrders automatically once the
      // Firestore listeners above pick up what confirmCheckout just wrote —
      // no local state push needed here, unlike the old mock addOrder().
    } catch (err: any) {
      console.error('Checkout failed', err);
      const message = typeof err?.message === 'string' ? err.message : 'Please try again.';
      setCheckoutError(message);
      toast(`Checkout failed — ${message}`);
    } finally {
      setCheckoutLoading(false);
    }
  };

  // --- MY ORDER (this week's confirmed meals) ---
  // Two sources, concatenated: the local mock's pre-seeded/demo order
  // history (matched by customerName, the same string-match the mock has
  // always used) plus this customer's REAL Firestore orders (firestoreOrders,
  // already scoped to just their uid by the query itself — see the listener
  // effect above). A real checkout only ever adds to the second source now;
  // the first stays exactly as it was for backward compatibility with
  // whatever demo history already existed before Firestore did.
  const myOrders = useMemo(
    () => [
      ...orders.filter(o => o.customerName === currentUser?.name && o.type === 'Meal Plan'),
      ...firestoreOrders.filter(o => o.type === 'Meal Plan'),
    ],
    [orders, firestoreOrders, currentUser]
  );

  // Every date currently orderable/visible in My Order — both weeks, not
  // just this one, now that customers can browse and book a week ahead.
  const weekDateKeys = useMemo(() => new Set(orderableWeeks.flatMap(w => w.days.map(d => d.date))), [orderableWeeks]);

  // item is typed FsOrderItem (not plain OrderItem) so _fsItemId rides
  // through every place a Line is built — a mock-store item simply never
  // has it set, which is exactly how commitPayment tells a real Firestore
  // item apart from a mock one below.
  interface Line { order: Order; item: FsOrderItem; }
  const thisWeekLines: Line[] = useMemo(() => {
    const out: Line[] = [];
    myOrders.forEach(o => o.items.forEach(item => {
      if (item.deliveryDate && weekDateKeys.has(item.deliveryDate)) out.push({ order: o, item });
    }));
    return out.sort((a, b) => (a.item.deliveryDate || '').localeCompare(b.item.deliveryDate || ''));
  }, [myOrders, weekDateKeys]);

  // Additional meals (a second, later checkout for a day that already has a
  // confirmed meal) land as their own Order behind the scenes, but the
  // customer should still see them tagged "EXTRA" against the day they land
  // on, same as the original prototype's per-day extra-meal tag — this is
  // sequence-within-day, not sequence-within-order.
  const thisWeekLinesWithSeq = useMemo(() => {
    const counts: Record<string, number> = {};
    return thisWeekLines.map(line => {
      const key = line.item.deliveryDate || '';
      if (line.item.status === 'Cancelled') {
        return { ...line, seq: -1 }; // -1 indicates no sequence badge for cancelled items
      }
      const seq = counts[key] || 0;
      counts[key] = seq + 1;
      return { ...line, seq };
    });
  }, [thisWeekLines]);

  // My Order groups by the actual Order a meal belongs to — a checkout is
  // one order; going back later and checking out an extra meal creates a
  // second, separate order — so the screen should show that as two visibly
  // distinct groups, not one flat list of meal cards. Grouped chronologically
  // by when each order was placed.
  // Date sets for each week used to split confirmed orders into two labelled
  // sections in My Order — "This week" and "Next week".
  const thisWeekDateSet = useMemo(() => new Set(weekDays.map(d => d.date)), [weekDays]);
  const nextWeekDateSet = useMemo(() => new Set(nextWeekDays.map(d => d.date)), [nextWeekDays]);

  const buildWeekOrders = (dateSet: Set<string>) => {
    const map = new Map<string, { order: Order; lines: typeof thisWeekLinesWithSeq }>();
    thisWeekLinesWithSeq.filter(l => dateSet.has(l.item.deliveryDate || '')).forEach(l => {
      if (!map.has(l.order.id)) map.set(l.order.id, { order: l.order, lines: [] });
      map.get(l.order.id)!.lines.push(l);
    });
    return Array.from(map.values()).sort((a, b) => a.order.timestamp.localeCompare(b.order.timestamp));
  };

  const weekOrders = useMemo(() => buildWeekOrders(thisWeekDateSet), [thisWeekLinesWithSeq, thisWeekDateSet]);
  const nextWeekOrders = useMemo(() => buildWeekOrders(nextWeekDateSet), [thisWeekLinesWithSeq, nextWeekDateSet]);

  // A receipt corresponds to one payment, not to one order or one meal —
  // "Pay order"/"Pay balance" claim several lines under a single generated
  // reference, so those lines are one payment and belong on one receipt;
  // a lone "Pay" on a single meal generates its own reference, so that meal
  // gets its own receipt. Lines without a reference (shouldn't happen once
  // Paid, but just in case) fall back to being their own single-line group.
  const paymentGroups = useMemo(() => {
    const map = new Map<string, typeof thisWeekLinesWithSeq>();
    thisWeekLinesWithSeq.forEach(l => {
      if (l.item.paymentStatus !== 'Paid') return;
      const key = l.item.paymentReference || `solo-${l.order.id}-${l.item.itemId}-${l.item.deliveryDate}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l);
    });
    return map;
  }, [thisWeekLinesWithSeq]);

  // Order History shows a rolling 3-month window rather than a fixed "last
  // 10" count — orders are never deleted from the underlying store (nothing
  // in ACTIVE_ORDERS is ever purged, so the full history is always there),
  // this is purely a display window for the customer-facing list. Anything
  // older than 3 months is still in the data, it's just not shown here.
  const orderHistoryCutoff = useMemo(() => addMonths(systemDate, -3), [systemDate]);

  const pastLines: Line[] = useMemo(() => {
    const out: Line[] = [];
    myOrders.forEach(o => o.items.forEach(item => {
      if (item.deliveryDate && !weekDateKeys.has(item.deliveryDate) && item.deliveryDate < systemDate && item.deliveryDate >= orderHistoryCutoff) out.push({ order: o, item });
    }));
    return out.sort((a, b) => (b.item.deliveryDate || '').localeCompare(a.item.deliveryDate || ''));
  }, [myOrders, weekDateKeys, systemDate, orderHistoryCutoff]);

  // "Outstanding" now means "still needs the customer to pick a payment
  // method" — once they've claimed one, it moves to awaitingConfirmation
  // below (still unpaid, but nothing left for the customer to do).
  const outstandingTotal = useMemo(
    () => thisWeekLines.filter(l => l.item.status !== 'Cancelled' && isUnclaimed(l.item)).reduce((t, l) => t + l.item.qty * l.item.price, 0),
    [thisWeekLines]
  );

  const awaitingConfirmationLines = useMemo(
    () => thisWeekLines.filter(l => l.item.status !== 'Cancelled' && isAwaitingConfirmation(l.item)),
    [thisWeekLines]
  );

  const applicablePaymentMethods = useMemo(
    () => paymentMethods.filter(m => m.isActive && MEAL_PLAN_PAYMENT_METHOD_NAMES.includes(m.name)),
    [paymentMethods]
  );

  // A fresh reference per payment attempt — shown to the customer to quote
  // when they make the Juice/MauCAS transfer, and stored on the item(s) so
  // Operations can match it against a bank/wallet statement later.
  const generateRef = () => `BMZ-PAY-${Math.floor(Math.random() * 900000 + 100000)}`;

  const openPayItem = (line: Line) => {
    setPayMethod(null);
    setCustomerRef('');
    setPaymentError(null);
    setPayTarget({
      kind: 'item',
      orderId: line.order.id,
      date: line.item.deliveryDate || '',
      slot: line.item.serviceSlot || 'Lunch',
      amount: line.item.qty * line.item.price,
      what: `${line.item.deliveryDay || ''} · ${line.item.name}`,
      ref: generateRef(),
      fsItemId: line.item._fsItemId,
    });
  };

  const openPayBalance = () => {
    const pending = thisWeekLines.filter(l => isUnclaimed(l.item));
    if (!pending.length) return;
    setPayMethod(null);
    setCustomerRef('');
    setPaymentError(null);
    setPayTarget({
      kind: 'balance',
      items: pending.map(l => ({ orderId: l.order.id, date: l.item.deliveryDate || '', slot: l.item.serviceSlot || 'Lunch', amount: l.item.qty * l.item.price, fsItemId: l.item._fsItemId })),
      amount: pending.reduce((t, l) => t + l.item.qty * l.item.price, 0),
      what: `${pending.length} unpaid meal${pending.length !== 1 ? 's' : ''} · full balance`,
      ref: generateRef()
    });
  };

  // Pay everything unpaid within one specific Order, as opposed to the
  // whole week (openPayBalance) or a single meal (openPayItem) — reuses the
  // same 'balance' payTarget shape, just scoped to one order's lines.
  const openPayOrder = (lines: (Line & { seq: number })[]) => {
    const pending = lines.filter(l => isUnclaimed(l.item));
    if (!pending.length) return;
    setPayMethod(null);
    setCustomerRef('');
    setPaymentError(null);
    setPayTarget({
      kind: 'balance',
      items: pending.map(l => ({ orderId: l.order.id, date: l.item.deliveryDate || '', slot: l.item.serviceSlot || 'Lunch', amount: l.item.qty * l.item.price, fsItemId: l.item._fsItemId })),
      amount: pending.reduce((t, l) => t + l.item.qty * l.item.price, 0),
      what: `${pending.length} unpaid meal${pending.length !== 1 ? 's' : ''} · this order`,
      ref: generateRef()
    });
  };

  // Choosing a method here only records a claim — it never marks anything
  // Paid. Only Operations confirming a payment (Operator Console) does that
  // (Mark Paid, wired to real writes in the previous round). A target with
  // an fsItemId is a real Firestore item — those get one batched update to
  // paymentMethodName/paymentReference, permitted by the new customer-scoped
  // clause added to firestore.rules this round (restricted to exactly those
  // two fields; paymentStatus itself never moves from here). Anything
  // without an fsItemId is mock demo history and still goes through the old
  // local-store submitPaymentClaim — so a "Pay balance" spanning both a real
  // order and mock history (unlikely in practice, but the UI doesn't rule it
  // out) settles every line correctly either way.
  const commitPayment = async () => {
    if (!payTarget || !payMethod) return;
    const finalRef = customerRef.trim() ? `${payTarget.ref} · their ref: ${customerRef.trim()}` : payTarget.ref;
    const targets = payTarget.kind === 'item'
      ? [{ orderId: payTarget.orderId, date: payTarget.date, slot: payTarget.slot, fsItemId: payTarget.fsItemId }]
      : payTarget.items;
    const realTargets = targets.filter(t => !!t.fsItemId);
    const mockTargets = targets.filter(t => !t.fsItemId);

    setPaymentError(null);
    setPaymentSubmitting(true);
    try {
      if (realTargets.length > 0) {
        const batch = writeBatch(db);
        realTargets.forEach(t => {
          batch.update(doc(db, 'orders', t.orderId, 'items', t.fsItemId as string), {
            paymentMethodName: payMethod.name,
            paymentReference: finalRef,
          });
        });
        await batch.commit();
      }
      mockTargets.forEach(t => submitPaymentClaim(t.orderId, t.date, t.slot, payMethod.name, finalRef));
      toast(`${payMethod.name} selected · awaiting confirmation`);
      setPayTarget(null);
      setPayMethod(null);
      setCustomerRef('');
    } catch (err) {
      console.error('Payment claim failed', err);
      setPaymentError('Could not record your payment claim — please try again.');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const handleCancel = async (line: Line) => {
    const isPaid = line.item.paymentStatus === 'Paid';
    if (firestoreOrderIds.has(line.order.id)) {
      if (!line.item._fsItemId) return;
      setCancellingItemId(line.item._fsItemId);
      try {
        const cancelFn = httpsCallable(functions, 'cancelOrderItem');
        const result = await cancelFn({ orderId: line.order.id, itemId: line.item._fsItemId, systemDate });
        const data = result.data as { refundAmount?: number } | undefined;
        const refundAmt = data?.refundAmount || 0;
        toast(isPaid ? `Meal cancelled · Rs ${refundAmt.toFixed(0)} credit added` : 'Meal cancelled');
      } catch (err: any) {
        console.error('Cancellation failed', err);
        toast(`Cancel failed: ${err.message || 'Please try again.'}`);
      } finally {
        setCancellingItemId(null);
      }
    } else {
      const refundAmt = isPaid ? calculateTotal(line.item.price * line.item.qty) : 0;
      cancelOrderItem(line.order.id, line.item.deliveryDate || '', line.item.serviceSlot || 'Lunch', line.item.itemId);
      toast(isPaid ? `Meal cancelled · Rs ${refundAmt.toFixed(0)} credit added` : 'Meal cancelled');
    }
  };

  const openRating = (line: Line) => {
    setRateTarget({
      orderId: line.order.id,
      fsItemId: line.item._fsItemId,
      itemId: `${line.order.id}-${line.item.itemId}-${line.item.deliveryDate}`,
      label: `${line.item.deliveryDay} · ${line.item.name}`
    });
    setRateStars(0);
    setRateComment('');
  };

  // A receipt always represents one payment — resolve to every line that
  // shares this line's payment reference (paymentGroups), never just the one
  // line that was clicked and never an entire order regardless of how many
  // separate payments it was actually settled with.
  const openReceipt = (line: Line) => {
    const key = line.item.paymentReference || `solo-${line.order.id}-${line.item.itemId}-${line.item.deliveryDate}`;
    setReceiptTarget({ order: line.order, lines: paymentGroups.get(key) || [line] });
  };
  const submitRating = async () => {
    if (!rateTarget || !rateStars) return;
    setRatingSubmitting(true);
    try {
      // Update order item rating in local store (automatically persists via notifyOrderListeners)
      updateOrderItemRating(rateTarget.orderId, rateTarget.itemId, rateStars, rateComment.trim());

      if (rateTarget.fsItemId) {
        // Real Firestore document update if synced
        const itemRef = doc(db, 'orders', rateTarget.orderId, 'items', rateTarget.fsItemId);
        await updateDoc(itemRef, {
          rating: rateStars,
          ratingComment: rateComment.trim()
        });
      }
      toast(`Thanks! ${rateStars}★ review sent to the kitchen`);
      setRateTarget(null);
      setRateComment('');
      setRateStars(0);
    } catch (err) {
      console.error('Failed to submit rating', err);
      toast('Failed to save rating. Please try again.');
    } finally {
      setRatingSubmitting(false);
    }
  };

  // --- HOME: one status card that always tells you the single most useful
  // next thing, plus a week-at-a-glance emoji strip — mirrors the original
  // prototype's home status card / attention logic, adapted to what our
  // OrderItem model actually tracks (no separate "delivered, unconfirmed"
  // state — Mark Delivered in the Operator Console goes straight to
  // Completed, so there's nothing to confirm receipt of here).
  const needsRating = useMemo(
    () => thisWeekLinesWithSeq.find(l => {
      const alreadyRated = l.item.rating || ratings[`${l.order.id}-${l.item.itemId}-${l.item.deliveryDate}`];
      return l.item.status === 'Completed' && l.item.paymentStatus === 'Paid' && !alreadyRated;
    }),
    [thisWeekLinesWithSeq, ratings]
  );

  const homeStatus = useMemo(() => {
    if (cartCount === 0 && thisWeekLinesWithSeq.length === 0) {
      const offerings = SYSTEM_CONFIG.dinnerEnabled ? 'Lunch & Dinner' : 'Lunch';
      return { icon: '🍽️', tone: 'bg-slate-100', title: "This week's & next week's menus are ready", subtitle: `${offerings} · order by ${formatTimeLabel(SYSTEM_CONFIG.lunchOrderCutoffTime)} ${orderCutoffDayPhrase('Lunch')}`, ctaLabel: 'Browse the menu', action: () => setView('menu') };
    }
    if (thisWeekLinesWithSeq.length === 0) {
      return { icon: '🍱', tone: 'bg-slate-100', title: `${cartCount} meal${cartCount !== 1 ? 's' : ''} selected`, subtitle: `${formatCurrency(cartTotals.total)} · not yet confirmed`, ctaLabel: 'Review & confirm', action: () => setView('order') };
    }
    if (outstandingTotal > 0) {
      const n = thisWeekLinesWithSeq.filter(l => isUnclaimed(l.item)).length;
      return { icon: '💳', tone: 'bg-warning/10', title: `${formatCurrency(outstandingTotal)} outstanding`, subtitle: `across ${n} meal${n !== 1 ? 's' : ''}`, ctaLabel: 'Pay now', action: () => { setView('order'); openPayBalance(); } };
    }
    if (awaitingConfirmationLines.length > 0) {
      return { icon: '⏳', tone: 'bg-warning/10', title: 'Payment awaiting confirmation', subtitle: `${awaitingConfirmationLines.length} meal${awaitingConfirmationLines.length !== 1 ? 's' : ''} · confirmed once the team checks it`, ctaLabel: 'View My Order', action: () => setView('order') };
    }
    if (needsRating) {
      return { icon: '⭐', tone: 'bg-primary/5', title: 'How was it?', subtitle: `Rate your ${needsRating.item.deliveryDay} meal`, ctaLabel: 'Rate meal', action: () => { setView('order'); openRating(needsRating); } };
    }
    return { icon: '✅', tone: 'bg-primary/5', title: 'All set for this week', subtitle: `${thisWeekLinesWithSeq.length} meal${thisWeekLinesWithSeq.length !== 1 ? 's' : ''} · fully paid`, ctaLabel: null as string | null, action: null as (() => void) | null };
  }, [cartCount, thisWeekLinesWithSeq, outstandingTotal, awaitingConfirmationLines, needsRating, cartTotals, configTick]);

  // Meals still 'Active' (not yet delivered, not cancelled) landing today —
  // drives Home's hero: if lunch is actually en route today, that's more
  // useful up top than a generic greeting.
  const todaysArrivingLines = useMemo(
    () => thisWeekLinesWithSeq.filter(l => l.item.deliveryDate === systemDate && l.item.status !== 'Completed' && l.item.status !== 'Cancelled'),
    [thisWeekLinesWithSeq, systemDate]
  );

  // Points progress toward the next loyalty tier — the tier badge already
  // existed, but a flat "Silver" label doesn't tell you anything is being
  // worked toward. Tiers are sorted by threshold since LOYALTY_TIERS isn't
  // guaranteed to already be in ascending order.
  const loyaltyProgress = useMemo(() => {
    if (!currentUser) return null;
    const sorted = [...loyaltyTiers].sort((a, b) => a.pointsThreshold - b.pointsThreshold);
    const idx = sorted.findIndex(t => t.name.toLowerCase() === (currentUser.tier || '').toLowerCase());
    const current = idx >= 0 ? sorted[idx] : sorted[0];
    if (!current) return null;
    const next = idx >= 0 ? sorted[idx + 1] : sorted[1];
    if (!next) return { next: null as typeof current | null, pct: 100, remaining: 0 };
    const span = Math.max(1, next.pointsThreshold - current.pointsThreshold);
    const into = Math.max(0, currentUser.points - current.pointsThreshold);
    return { next, pct: Math.min(100, Math.round((into / span) * 100)), remaining: Math.max(0, next.pointsThreshold - currentUser.points) };
  }, [currentUser, loyaltyTiers]);

  // Home's "order for..." shortcuts — one tile per week x offering
  // combination a customer can currently order, each fronted by a real dish
  // photo (Monday's first curry for that week/service) rather than a
  // text-only menu. Replaces the old this-week-only day-by-day photo strip
  // now that ordering spans two weeks and two offerings — a photo strip of
  // every day in both weeks would be 10 cards; these four (or two, with
  // Dinner off) get straight to "which week, which offering" instead.
  const orderShortcuts = useMemo(() => {
    const tiles: { week: WeekChoice; service: Service; weekLabel: string; dish: CurryOption }[] = [
      { week: 'This', service: 'Lunch', weekLabel: 'This week', dish: lunchMenuForWeek(weekDays[0].date).MON[0] },
      { week: 'Next', service: 'Lunch', weekLabel: 'Next week', dish: lunchMenuForWeek(nextWeekDays[0].date).MON[0] },
    ];
    if (SYSTEM_CONFIG.dinnerEnabled) {
      tiles.push(
        { week: 'This', service: 'Dinner', weekLabel: 'This week', dish: dinnerMenuForWeek(weekDays[0].date).MON[0] },
        { week: 'Next', service: 'Dinner', weekLabel: 'Next week', dish: dinnerMenuForWeek(nextWeekDays[0].date).MON[0] }
      );
    }
    return tiles;
  }, [weekDays, nextWeekDays, menuTick, configTick]);

  // Thumbnail for the "My Orders" quick-action tile — the confirmed meal's
  // dish if there is one this week, else the first draft's, else none (the
  // tile falls back to a plain bag icon).
  const myOrdersThumbId = useMemo(() => {
    if (thisWeekLinesWithSeq[0]) return thisWeekLinesWithSeq[0].item.itemId;
    for (const d of weekDays) {
      const first = (cart[d.date] || [])[0];
      if (first) return first.curryId;
    }
    return null;
  }, [thisWeekLinesWithSeq, cart, weekDays]);

  // --- LOGIN / REGISTER ---
  if (authChecking) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-[#FDFAF4]">
        <Loader2 className="size-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="h-full w-full overflow-y-auto bg-[#FDFAF4] flex items-center justify-center p-6 relative">
        {onLogout && (
          <button onClick={onLogout} className="absolute top-6 left-6 p-2 rounded-xl text-slate-400 hover:bg-white/60">
            <ArrowLeft className="size-5" />
          </button>
        )}
        <div className="max-w-md w-full">
          <div className="text-center mb-6">
            {SYSTEM_CONFIG.businessLogoUrl ? (
              <img src={SYSTEM_CONFIG.businessLogoUrl} alt={SYSTEM_CONFIG.businessName} className="size-16 rounded-2xl object-cover shadow-lg shadow-primary/20 mx-auto mb-5" />
            ) : (
              <div className="size-16 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/20 mx-auto mb-5">
                <Sparkles className="size-8" />
              </div>
            )}
            <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-1">{SYSTEM_CONFIG.businessName}</h1>
            <p className="text-slate-500 font-medium mb-1">{SYSTEM_CONFIG.businessTagline}</p>
            <p className="text-xs text-primary font-bold italic">"{culturePhrase.cr}" — {culturePhrase.en}</p>
          </div>

          <div className="bg-white rounded-[28px] border border-slate-200 shadow-sm p-6">
            <div className="flex bg-[#F4EFE4] rounded-2xl p-1 mb-6">
              <button
                onClick={() => { setAuthMode('login'); setAuthError(null); }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${authMode === 'login' ? 'bg-white text-primary shadow-sm' : 'text-slate-400'}`}
              >
                Log In
              </button>
              <button
                onClick={() => { setAuthMode('register'); setAuthError(null); }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${authMode === 'register' ? 'bg-white text-primary shadow-sm' : 'text-slate-400'}`}
              >
                Sign Up
              </button>
            </div>

            {authError && (
              <div className="mb-4 p-3 rounded-xl bg-danger/10 text-danger text-xs font-bold flex items-start gap-2">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            {authMode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1.5">Username</label>
                  <input
                    value={loginUsername}
                    onChange={e => setLoginUsername(e.target.value)}
                    placeholder="e.g. marcus"
                    autoCapitalize="none"
                    className="w-full px-4 py-3 rounded-xl border border-[#E7E0D0] text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 bg-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1.5">Password</label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 rounded-xl border border-[#E7E0D0] text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 bg-white"
                  />
                </div>
                <button
                  type="submit"
                  disabled={authLoading || !loginUsername || !loginPassword}
                  className="w-full py-3.5 rounded-xl bg-primary text-white text-xs font-black uppercase shadow-lg shadow-primary/20 disabled:opacity-40 flex items-center justify-center gap-2 mt-2"
                >
                  {authLoading && <Loader2 className="size-4 animate-spin" />}
                  Log In
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1.5">First name</label>
                    <input value={regFirstName} onChange={e => setRegFirstName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-[#E7E0D0] text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 bg-white" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1.5">Last name</label>
                    <input value={regLastName} onChange={e => setRegLastName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-[#E7E0D0] text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 bg-white" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1.5">Username</label>
                  <input value={regUsername} onChange={e => setRegUsername(e.target.value)} placeholder="letters, numbers, _ and . only" autoCapitalize="none" className="w-full px-4 py-3 rounded-xl border border-[#E7E0D0] text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 bg-white" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1.5">Email</label>
                  <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-[#E7E0D0] text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 bg-white" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1.5">Phone (optional)</label>
                  <input type="tel" value={regPhone} onChange={e => setRegPhone(e.target.value)} placeholder="+230 ..." className="w-full px-4 py-3 rounded-xl border border-[#E7E0D0] text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 bg-white" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1.5">Password</label>
                  <input type="password" value={regPassword} onChange={e => setRegPassword(e.target.value)} placeholder="At least 6 characters" className="w-full px-4 py-3 rounded-xl border border-[#E7E0D0] text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 bg-white" />
                </div>
                <button
                  type="submit"
                  disabled={authLoading || !regUsername || !regEmail || !regPassword || !regFirstName || !regLastName}
                  className="w-full py-3.5 rounded-xl bg-primary text-white text-xs font-black uppercase shadow-lg shadow-primary/20 disabled:opacity-40 flex items-center justify-center gap-2 mt-2"
                >
                  {authLoading && <Loader2 className="size-4 animate-spin" />}
                  Create Account
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  const handleResubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!resubmitPhone.trim() || !resubmitStreet.trim() || !resubmitCity.trim()) {
      setResubmitError('Please fill in all fields.');
      return;
    }
    setResubmitLoading(true);
    setResubmitError(null);
    try {
      const updatedAddresses = [
        {
          id: 'default',
          label: 'Home',
          street: resubmitStreet.trim(),
          city: resubmitCity.trim(),
          zip: '',
          country: 'Mauritius'
        }
      ];
      await updateDoc(doc(db, 'customers', currentUser.id), {
        phone: resubmitPhone.trim(),
        addresses: updatedAddresses,
        registrationStatus: 'Pending',
        rejectionReason: null,
        updatedAt: Timestamp.now()
      });
      setCustomerDocRaw(prev => prev ? {
        ...prev,
        phone: resubmitPhone.trim(),
        addresses: updatedAddresses,
        registrationStatus: 'Pending',
        rejectionReason: null
      } : null);
    } catch (err: any) {
      setResubmitError(`Resubmission failed: ${err.message}`);
    } finally {
      setResubmitLoading(false);
    }
  };

  if (currentUser && currentUser.registrationStatus === 'Pending') {
    return (
      <div className="h-full w-full bg-[#FDFAF4] flex flex-col items-center justify-center p-6 text-center space-y-6">
        <div className="max-w-md w-full bg-white border border-[#E7E0D0] rounded-3xl p-8 shadow-sm space-y-6">
          <div className="size-16 bg-warning/10 text-warning rounded-full flex items-center justify-center mx-auto">
            <Loader2 className="size-8 animate-spin" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900">Awaiting Approval</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Your account is currently pending review by our operations team. You will be able to place orders as soon as your account is approved.
            </p>
          </div>
          <div className="bg-[#FAF9F5] rounded-2xl p-4 text-left text-xs space-y-2.5">
            <p className="font-bold text-slate-700">Registration Details:</p>
            <p className="text-slate-500"><strong className="text-slate-700 font-bold">Name:</strong> {currentUser.name}</p>
            <p className="text-slate-500"><strong className="text-slate-700 font-bold">Email:</strong> {currentUser.email}</p>
            <p className="text-slate-500"><strong className="text-slate-700 font-bold">Phone:</strong> {currentUser.phone || 'Not provided'}</p>
            {currentUser.addresses && currentUser.addresses.length > 0 && (
              <div>
                <strong className="text-slate-700 font-bold">Delivery Address:</strong>
                <p className="text-slate-500 pl-2 mt-0.5">{currentUser.addresses[0].street}, {currentUser.addresses[0].city}</p>
              </div>
            )}
          </div>
          <button
            onClick={async () => {
              await signOut(auth);
            }}
            className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (currentUser && currentUser.registrationStatus === 'Rejected') {
    return (
      <div className="h-full w-full bg-[#FDFAF4] flex flex-col items-center justify-center p-6 overflow-y-auto">
        <div className="max-w-md w-full bg-white border border-[#E7E0D0] rounded-3xl p-8 shadow-sm space-y-6">
          <div className="size-12 bg-error/10 text-error rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="size-6" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-xl font-bold text-slate-900">Registration Rejected</h2>
            <p className="text-xs text-slate-500">Your registration could not be approved for the following reason:</p>
          </div>

          <div className="bg-error/[0.03] border border-error/10 rounded-2xl p-4 text-xs font-medium text-error leading-relaxed">
            <p className="font-bold uppercase tracking-wider text-[10px] text-error/70 mb-1">Reason from Operations</p>
            {currentUser.rejectionReason || 'No reason provided.'}
          </div>

          <form onSubmit={handleResubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Phone Number</label>
              <input
                type="tel"
                value={resubmitPhone}
                onChange={e => setResubmitPhone(e.target.value)}
                placeholder="+230 ..."
                required
                className="w-full px-4 py-3 rounded-xl border border-[#E7E0D0] text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Street Address</label>
              <input
                type="text"
                value={resubmitStreet}
                onChange={e => setResubmitStreet(e.target.value)}
                placeholder="e.g. 12 Rue de la Source"
                required
                className="w-full px-4 py-3 rounded-xl border border-[#E7E0D0] text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">City / Town</label>
              <input
                type="text"
                value={resubmitCity}
                onChange={e => setResubmitCity(e.target.value)}
                placeholder="e.g. Port Louis"
                required
                className="w-full px-4 py-3 rounded-xl border border-[#E7E0D0] text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all"
              />
            </div>

            {resubmitError && (
              <p className="text-xs font-bold text-rose-600 flex items-center gap-1.5 animate-pulse">
                <AlertCircle className="size-3.5 shrink-0" /> {resubmitError}
              </p>
            )}

            <button
              type="submit"
              disabled={resubmitLoading}
              className="w-full py-3.5 rounded-xl bg-primary hover:bg-primary/95 text-white text-xs font-black uppercase shadow-lg shadow-primary/20 disabled:opacity-40 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {resubmitLoading && <Loader2 className="size-4 animate-spin" />}
              Resubmit Registration
            </button>
          </form>

          <button
            onClick={async () => {
              await signOut(auth);
            }}
            className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  const tierObj = loyaltyTiers.find(t => t.name.toLowerCase() === currentUser.tier?.toLowerCase());
  const referralCode = currentUser.referenceCode || 'BONMANZE-' + currentUser.id.toUpperCase();
  const copyReferral = () => navigator.clipboard?.writeText(referralCode).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });

  return (
    <div className="h-full w-full flex flex-col bg-[#FDFAF4] relative">
      <header className="shrink-0 bg-white/90 backdrop-blur-md border-b border-[#E7E0D0] px-6 py-4 flex items-center justify-between relative z-30">
        <div className="flex items-center gap-3">
          {SYSTEM_CONFIG.businessLogoUrl ? (
            <img src={SYSTEM_CONFIG.businessLogoUrl} alt={SYSTEM_CONFIG.businessName} className="size-9 rounded-xl object-cover shadow-lg shadow-primary/20" />
          ) : (
            <div className="size-9 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
              <Sparkles className="size-5" />
            </div>
          )}
          <div>
            <h1 className="text-sm font-black text-slate-900 leading-none">{SYSTEM_CONFIG.businessName}</h1>
            <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold mt-0.5">{SYSTEM_CONFIG.businessTagline}</p>
          </div>
        </div>
        <div className="relative">
          <button
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
            className="flex items-center focus:outline-none cursor-pointer"
          >
            <img src={currentUser.avatar} className="size-8 rounded-full border-2 border-primary/20 hover:border-primary/50 active:scale-95 transition-all" alt={currentUser.name} />
          </button>
          {profileMenuOpen && (
            <>
              <div className="fixed inset-0 z-40 cursor-default" onClick={() => setProfileMenuOpen(false)} />
              <div className="absolute right-0 mt-2 w-40 bg-white rounded-2xl border border-[#E7E0D0] shadow-xl py-1.5 z-50">
                <button
                  onClick={() => {
                    setProfileMenuOpen(false);
                    setProfileOpen(true);
                  }}
                  className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
                >
                  <UserIcon className="size-3.5 text-slate-400" />
                  View Profile
                </button>
                <div className="border-t border-[#F0EADD] my-1" />
                <button
                  onClick={() => {
                    setProfileMenuOpen(false);
                    signOut(auth).finally(() => {
                      setCustomerDocRaw(null);
                      if (onLogout) onLogout();
                    });
                  }}
                  className="w-full text-left px-4 py-2.5 text-xs font-bold text-danger hover:bg-slate-50 transition-colors flex items-center gap-2"
                >
                  <LogOut className="size-3.5" />
                  Log Out
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 pb-[calc(7rem+env(safe-area-inset-bottom))]">
        {view === 'home' && (
          <div className="space-y-6">
            {/* Welcome hero — the customer's own name/avatar/tier is the first thing on the
                page, not a generic banner; today's delivery (if any) folds in underneath
                as a highlight rather than displacing the personal welcome entirely.
                Gradient + glassmorphism treatment: a diagonal primary->secondary
                background, soft blurred color blobs for depth, and frosted
                (backdrop-blur + translucent white) panels for every element
                sitting on top of it, rather than flat white-on-solid-color. */}
            <div className={`relative rounded-[28px] p-6 text-white shadow-xl overflow-hidden ${
              isBirthday
                ? 'bg-gradient-to-br from-[#1e1b4b] via-[#4c1d95] to-[#7e22ce] shadow-purple-900/40'
                : 'bg-gradient-to-br from-primary via-primary to-secondary shadow-primary/30'
            }`}>
              {/* Ambient blobs */}
              <div className="absolute -top-12 -right-10 size-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
              <div className="absolute -bottom-16 -left-10 size-44 rounded-full bg-white/5 blur-2xl pointer-events-none" />
              {/* Large decorative cake — birthday only */}
              {isBirthday && (
                <div className="absolute right-4 bottom-2 text-[72px] opacity-10 pointer-events-none select-none leading-none">
                  🎂
                </div>
              )}
              <button onClick={() => setProfileOpen(true)} className="absolute top-5 right-5 z-10 text-[10px] font-black uppercase tracking-widest text-white/80 hover:text-white bg-white/10 backdrop-blur-md border border-white/20 px-2.5 py-1 rounded-full">Profile →</button>

              {isBirthday && (
                <div className="relative z-10 mb-3 px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-md border border-white/25 text-[9px] font-black uppercase tracking-wider w-fit">
                  🎂 Birthday Today!
                </div>
              )}

              <div className="relative z-10 flex items-center gap-4">
                <img src={currentUser.avatar} className="size-16 rounded-full border-2 border-white/40 shadow-lg shrink-0" alt={currentUser.name} />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Welcome back</p>
                  <p className="text-xl font-black leading-tight truncate">{currentUser.firstName}{isBirthday ? ' 🎂' : '!'}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {currentUser.tier && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-[10px] font-black uppercase shrink-0">
                        <Star className="size-2.5" /> {currentUser.tier} Member
                      </span>
                    )}
                    {!!currentUser.storeCredit && currentUser.storeCredit > 0 && (
                      <span className="text-[10px] font-black text-white/90 shrink-0">{formatCurrency(currentUser.storeCredit)} credit</span>
                    )}
                  </div>
                </div>
              </div>
              <p className="relative z-10 text-sm font-black italic leading-snug mt-4">"{isBirthday ? (SYSTEM_CONFIG.birthdayHeaderCreole || 'Zwaye Laniverser! 🎂🎉') : culturePhrase.cr}"</p>
              <p className="relative z-10 text-xs opacity-80 mt-1">{isBirthday ? (SYSTEM_CONFIG.birthdayHeaderEnglish || 'Wishing you a wonderful day filled with delicious curries! 🎂🎈') : culturePhrase.en}</p>
              {todaysArrivingLines.length > 0 && (
                <div className="relative z-10 mt-4 flex items-center gap-3 bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-3">
                  <img src={dishPhotoFor(todaysArrivingLines[0].item.itemId)} className="size-11 rounded-xl object-cover shrink-0 border-2 border-white/25" alt={todaysArrivingLines[0].item.name} />
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-70 flex items-center gap-1.5 flex-wrap">
                      <span>Arriving today · {serviceOf(todaysArrivingLines[0].item) === 'Dinner' ? SYSTEM_CONFIG.dinnerDeliveryWindow : SYSTEM_CONFIG.lunchDeliveryWindow}</span>
                      {todaysArrivingLines[0].item.status && todaysArrivingLines[0].item.status !== 'Active' && (
                        <span className="px-1 py-0.5 rounded bg-white/20 text-white font-extrabold normal-case leading-none">
                          {todaysArrivingLines[0].item.status}
                        </span>
                      )}
                    </p>
                    <p className="text-xs font-bold truncate">
                      {todaysArrivingLines[0].item.name}
                      {todaysArrivingLines.length > 1 && ` +${todaysArrivingLines.length - 1} more`}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Loyalty progress — points now build toward something visible, not just a badge */}
            {loyaltyProgress && (
              <div className="bg-white rounded-2xl border border-[#E7E0D0] p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Loyalty</p>
                  <span className="text-[11px] font-bold text-slate-400">{currentUser.points} pts</span>
                </div>
                {loyaltyProgress.next ? (
                  <>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden mb-1.5">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${loyaltyProgress.pct}%` }} />
                    </div>
                    <p className="text-[11px] text-slate-500 font-bold">{loyaltyProgress.remaining} pts to {loyaltyProgress.next.name}</p>
                  </>
                ) : (
                  <p className="text-[11px] text-slate-500 font-bold">✨ You've reached the top tier</p>
                )}
              </div>
            )}

            <div className={`rounded-2xl p-4 flex items-start gap-3 ${homeStatus.tone}`}>
              <div className="size-10 rounded-xl bg-white/70 flex items-center justify-center text-lg shrink-0">{homeStatus.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-slate-900">{homeStatus.title}</p>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">{homeStatus.subtitle}</p>
                {homeStatus.ctaLabel && homeStatus.action && (
                  <button onClick={homeStatus.action} className="mt-2 text-[10px] font-black uppercase tracking-widest text-primary">{homeStatus.ctaLabel} →</button>
                )}
              </div>
            </div>

            {/* Order shortcuts — straight to "which week, which offering" instead
                of a this-week-only day strip, now that both are choices. */}
            <div>
              <h2 className="text-base font-black text-slate-900 mb-3">Order for...</h2>
              <div className="grid grid-cols-2 gap-3">
                {orderShortcuts.map(tile => (
                  <button
                    key={`${tile.week}-${tile.service}`}
                    onClick={() => { setActiveWeek(tile.week); setActiveService(tile.service); setView('menu'); }}
                    className="relative rounded-2xl overflow-hidden text-left h-28 border border-[#E7E0D0]"
                  >
                    <img src={dishPhotoFor(tile.dish)} className="absolute inset-0 w-full h-full object-cover" alt="" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-[9px] font-black uppercase tracking-widest text-white/80">{tile.weekLabel}</p>
                      <p className="text-sm font-black text-white leading-tight">{tile.service}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick actions — My Orders lives here now (with a dish thumbnail) instead of a separate day-by-day grid */}
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Quick actions</p>
              <div className="grid grid-cols-2 gap-3">
                {outstandingTotal > 0 && (
                  <button onClick={() => { setView('order'); openPayBalance(); }} className="bg-white rounded-2xl border border-[#E7E0D0] p-4 text-left flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-danger/10 text-danger flex items-center justify-center shrink-0"><Wallet className="size-5" /></div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-900">Pay now</p>
                      <p className="text-[10px] text-slate-400 font-bold truncate">{formatCurrency(outstandingTotal)} outstanding</p>
                    </div>
                  </button>
                )}
                {needsRating && (
                  <button onClick={() => { setView('order'); openRating(needsRating); }} className="bg-white rounded-2xl border border-[#E7E0D0] p-4 text-left flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-warning/10 text-warning flex items-center justify-center shrink-0"><Star className="size-5" /></div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-900">Rate last meal</p>
                      <p className="text-[10px] text-slate-400 font-bold truncate">{needsRating.item.deliveryDay}</p>
                    </div>
                  </button>
                )}
                <button onClick={() => setView('order')} className="bg-white rounded-2xl border border-[#E7E0D0] p-4 text-left flex items-center gap-3">
                  {myOrdersThumbId ? (
                    <img src={dishPhotoFor(myOrdersThumbId)} className="size-10 rounded-xl object-cover shrink-0" alt="" />
                  ) : (
                    <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><ShoppingBag className="size-5" /></div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-900">My Orders</p>
                    <p className="text-[10px] text-slate-400 font-bold truncate">
                      {thisWeekLinesWithSeq.length > 0 ? `${thisWeekLinesWithSeq.length} meal${thisWeekLinesWithSeq.length !== 1 ? 's' : ''} this week` : cartCount > 0 ? `${cartCount} in draft` : 'No orders yet'}
                    </p>
                  </div>
                </button>
                <button onClick={() => setView('menu')} className="bg-white rounded-2xl border border-[#E7E0D0] p-4 text-left flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0"><BookOpen className="size-5" /></div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-900">Browse menu</p>
                    <p className="text-[10px] text-slate-400 font-bold truncate">This week & next</p>
                  </div>
                </button>
                <button onClick={copyReferral} className="bg-white rounded-2xl border border-[#E7E0D0] p-4 text-left flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><Gift className="size-5" /></div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-900">Refer a friend</p>
                    <p className="text-[10px] text-slate-400 font-bold truncate">{copied ? 'Code copied!' : referralCode}</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Guide — collapsed by default; repeat customers don't need this
                every visit. Redesigned from a flat numbered list into
                icon-led steps so it reads at a glance, and every time-based
                claim now pulls live from SYSTEM_CONFIG instead of hardcoded
                copy ("Sunday noon", "11:30–12:00") that had drifted from the
                actual rules. Covers both ordering weeks and both offerings. */}
            <div className="bg-white rounded-2xl border border-[#E7E0D0] shadow-sm overflow-hidden">
              <button onClick={() => setGuideOpen(o => !o)} className="w-full flex items-center justify-between gap-3 p-4 text-left">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><Sparkles className="size-4" /></div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-800">New here?</p>
                    <p className="text-[10px] text-slate-400 font-bold truncate">How {SYSTEM_CONFIG.businessName} works</p>
                  </div>
                </div>
                {guideOpen ? <ChevronUp className="size-4 text-slate-400 shrink-0" /> : <ChevronDown className="size-4 text-slate-400 shrink-0" />}
              </button>
              {guideOpen && (
                <div className="px-4 pb-4 pt-1 border-t border-[#E7E0D0] space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><CalendarDays className="size-4" /></div>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-xs font-black text-slate-800">Choose your week{SYSTEM_CONFIG.dinnerEnabled ? ' & meal' : ''}</p>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                        This Week or Next Week{SYSTEM_CONFIG.dinnerEnabled ? ', Lunch or Dinner' : ''} — the Menu tab has shortcuts for all of it.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="size-8 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0"><UtensilsCrossed className="size-4" /></div>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-xs font-black text-slate-800">Build your plate</p>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">Pick a curry and sides for each day you want delivered.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="size-8 rounded-xl bg-warning/10 text-warning flex items-center justify-center shrink-0"><Clock className="size-4" /></div>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-xs font-black text-slate-800">Confirm before {formatTimeLabel(SYSTEM_CONFIG.lunchOrderCutoffTime)}</p>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">Each meal locks for changes at {formatTimeLabel(SYSTEM_CONFIG.lunchCancelCutoffTime)}, {cancelCutoffDayPhrase('Lunch')} — order any time before that.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="size-8 rounded-xl bg-success/10 text-success flex items-center justify-center shrink-0"><CreditCard className="size-4" /></div>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-xs font-black text-slate-800">Pay your way</p>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">Juice, MauCAS, or cash on delivery — whichever's easiest.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><Truck className="size-4" /></div>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-xs font-black text-slate-800">Fresh, right on time</p>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                        Lunch arrives Mon–Fri, {SYSTEM_CONFIG.lunchDeliveryWindow}
                        {SYSTEM_CONFIG.dinnerEnabled && <> · Dinner arrives {SYSTEM_CONFIG.dinnerDeliveryWindow}</>}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'menu' && (() => {
          const activeDays = activeWeek === 'Next' ? nextWeekDays : weekDays;
          const activeWeekStart = activeDays[0].date;
          return (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-lg font-black text-slate-900">{activeWeek === 'Next' ? "Next week's menu" : "This week's menu"}</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 bg-[#F4EFE4] rounded-full p-1">
                  {(['This', 'Next'] as WeekChoice[]).map(w => (
                    <button
                      key={w}
                      onClick={() => setActiveWeek(w)}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all ${activeWeek === w ? 'bg-primary text-white' : 'text-slate-500'}`}
                    >
                      {w === 'This' ? 'This week' : 'Next week'}
                    </button>
                  ))}
                </div>
                {SYSTEM_CONFIG.dinnerEnabled && (
                  <div className="flex items-center gap-1 bg-[#F4EFE4] rounded-full p-1">
                    {(['Lunch', 'Dinner'] as Service[]).map(s => (
                      <button
                        key={s}
                        onClick={() => setActiveService(s)}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all ${activeService === s ? 'bg-primary text-white' : 'text-slate-500'}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {(() => {
              // Show the birthday banner as long as the birthday falls within
              // the currently-viewed week AND hasn't passed yet.
              // birthdayDateInWeek returns the date string or null.
              const bdayDate = birthdayDateInWeek(currentUser?.birthday, activeDays, systemDate);
              if (!bdayDate) return null;
              const tierObj = loyaltyTiers.find(t => t.name.toLowerCase() === currentUser?.tier?.toLowerCase());
              const birthdayDiscountRate = tierObj?.birthdayDiscount || 0;
              const bdayLabel = activeDays.find(d => d.date === bdayDate)?.label || bdayDate;
              const isToday = bdayDate === systemDate;
              return (
                <div className="bg-gradient-to-r from-rose-50 via-pink-50 to-purple-50 border border-pink-200/60 rounded-3xl p-5 shadow-sm animate-fade-in">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl shrink-0">🎂</span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-black text-slate-900">
                        {isToday ? `Happy Birthday, ${currentUser?.firstName}! 🎉` : `🎉 Your birthday is coming up, ${currentUser?.firstName}!`}
                      </h3>
                      <p className="text-xs text-slate-600 font-medium mt-1 leading-relaxed">
                        {birthdayDiscountRate > 0 && (
                          <>{isToday ? 'Today' : `On ${bdayLabel}`}, a <span className="font-black text-pink-600">{birthdayDiscountRate}% Birthday Discount</span> will apply to your delivery. </>
                        )}
                        {isToday ? 'Enjoy your special day! 🎈' : `Order ahead and it'll be applied automatically!`}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}
            {activeDays.map(d => {
              const meals = cartFor(activeService)[d.date] || [];
              const pastCutoff = isPastOrderCutoff(d.date, activeService, systemDate);
              const isUserBirthdayOnDay = isBirthdayToday(currentUser?.birthday, d.date);
              return (
                <div key={d.key} className={`bg-white rounded-3xl border border-[#E7E0D0] p-5 transition-all ${pastCutoff ? 'opacity-65 bg-slate-50/50' : ''}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-black text-slate-900">{d.label}</p>
                      {isUserBirthdayOnDay && (
                        <span className="text-sm shrink-0" title="Your Birthday!">🎂</span>
                      )}
                      {pastCutoff && (
                        <span className="px-2 py-0.5 rounded-full bg-danger/10 text-danger text-[9px] font-black uppercase tracking-widest animate-fade-in">
                          Past Cut-off
                        </span>
                      )}
                    </div>
                    {meals.length > 0 && !pastCutoff && (
                      <button onClick={() => openBuilder(d, activeService, activeWeekStart)} className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1">
                        <Plus className="size-3" /> Add another
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {menuFor(activeService, activeWeekStart)[d.key].map(c => {
                      const special = specialPriceInfo(c);
                      return (
                        <button
                          key={c.id}
                          disabled={pastCutoff}
                          onClick={() => openBuilder(d, activeService, activeWeekStart, c.id)}
                          className={`relative rounded-2xl overflow-hidden border border-[#E7E0D0] text-left h-32 ${pastCutoff ? 'cursor-not-allowed filter grayscale-[30%]' : ''}`}
                        >
                          <img src={dishPhotoFor(c)} className="absolute inset-0 w-full h-full object-cover" alt={c.name} />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                          {special && (
                            <span className="absolute top-1.5 right-1.5 bg-emerald-500 text-white text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full shadow-sm">Special</span>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 p-2">
                            <p className="text-[11px] font-black text-white leading-tight truncate">{c.emoji} {c.name}</p>
                            <p className="text-[9px] text-white/80 font-medium truncate mt-0.5">{c.desc}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              {special && <span className="text-[9px] text-white/60 font-bold line-through">Rs {special.regularPrice}</span>}
                              <p className={`text-[11px] font-black mt-0 ${special ? 'text-emerald-300' : 'text-white'}`}>Rs {c.price}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {meals.length > 0 && (
                    <div className="space-y-1.5 pt-3 border-t border-[#E7E0D0]">
                      {meals.map((m, i) => (
                        <div key={i} className="flex items-start justify-between gap-2 text-xs">
                          <div className="min-w-0">
                            <span className="font-bold text-slate-700 block">{mealSummaryLabel(m, d.key, activeService, activeWeekStart)}</span>
                            {mealExtrasLabel(m) && <span className="text-[11px] text-slate-400 block">{mealExtrasLabel(m)}</span>}
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {m.note.trim() && <PersonTag name={m.note.trim()} />}
                              {m.instructions?.trim() && <InstructionsTag text={m.instructions.trim()} />}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-black text-primary">Rs {mealPrice(m, d.key, activeService, activeWeekStart)}</span>
                            {!pastCutoff && (
                              <button onClick={() => openBuilder(d, activeService, activeWeekStart, undefined, i)} className="p-1.5 text-slate-400 hover:text-primary"><Edit3 className="size-3.5" /></button>
                            )}
                            <button onClick={() => removeCartMeal(d.date, i, activeService)} className="p-1.5 text-slate-400 hover:text-danger"><Trash2 className="size-3.5" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          );
        })()}

        {view === 'order' && (
          <div className="space-y-6">
            <h2 className="text-lg font-black text-slate-900">My Order</h2>

            {cartCount > 0 && (
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Draft — not yet confirmed</p>

                <div className="space-y-4 mb-4">
                  {(['Lunch', 'Dinner'] as Service[]).flatMap(service =>
                    orderableWeeks.flatMap(week =>
                      week.days.filter(d => (cartFor(service)[d.date] || []).length > 0).map(d => (
                        <div key={`${service}-${d.date}`} className="bg-white rounded-2xl border border-[#E7E0D0] p-4">
                          <div className="flex items-center gap-1.5 mb-3">
                            <p className="text-[10px] font-black uppercase text-primary tracking-widest">{d.label}</p>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${service === 'Dinner' ? 'bg-accent/10 text-accent' : 'bg-primary/10 text-primary'}`}>{service}</span>
                          </div>
                          <div className="space-y-3">
                            {(cartFor(service)[d.date] || []).map((m, i) => (
                              <div key={`${d.date}-${i}`} className={`flex items-start justify-between gap-2 ${i > 0 ? 'pt-3 border-t border-[#F0EADD]' : ''}`}>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-700">{mealSummaryLabel(m, d.key, service, week.start)}</p>
                                  {mealExtrasLabel(m) && <p className="text-[11px] text-slate-400 mt-0.5">{mealExtrasLabel(m)}</p>}
                                  <div className="flex flex-wrap gap-1.5 mt-1">
                                    {m.note.trim() && <PersonTag name={m.note.trim()} />}
                                    {m.instructions?.trim() && <InstructionsTag text={m.instructions.trim()} />}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="font-black text-slate-900 text-xs">Rs {mealPrice(m, d.key, service, week.start)}</span>
                                  <button onClick={() => openBuilder(d, service, week.start, undefined, i)} className="p-1.5 text-slate-400 hover:text-primary"><Edit3 className="size-3.5" /></button>
                                  <button onClick={() => removeCartMeal(d.date, i, service)} className="p-1.5 text-slate-400 hover:text-danger"><Trash2 className="size-3.5" /></button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )
                  )}
                </div>

                <div className="bg-white rounded-3xl border border-[#E7E0D0] p-5">
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between font-bold text-slate-500"><span>Subtotal</span><span>{formatCurrency(cartTotals.subtotal)}</span></div>
                    {cartTotals.standardDiscount > 0 && <div className="flex justify-between font-bold text-primary"><span>{cartTotals.standardLabel} Discount ({cartTotals.standardRate}%)</span><span>-{formatCurrency(cartTotals.standardDiscount)}</span></div>}
                    {cartTotals.birthdayDiscount > 0 && <div className="flex justify-between font-bold text-accent"><span>🎂 Birthday Discount ({cartTotals.birthdayRate}%)</span><span>-{formatCurrency(cartTotals.birthdayDiscount)}</span></div>}
                    {cartTotals.bulkDiscount > 0 && <div className="flex justify-between font-bold text-success"><span>Full-Week Discount ({SYSTEM_CONFIG.bulkDiscountRate}%)</span><span>-{formatCurrency(cartTotals.bulkDiscount)}</span></div>}
                    <div className="flex justify-between font-bold text-slate-500"><span>VAT ({SYSTEM_CONFIG.vatRate}%)</span><span>{formatCurrency(cartTotals.vat)}</span></div>
                    <div className="pt-2 border-t border-[#E7E0D0] flex justify-between text-base font-black text-slate-900"><span>Total</span><span>{formatCurrency(cartTotals.total)}</span></div>
                  </div>
                  {checkoutError && (
                    <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-danger/10 text-danger text-xs font-bold">
                      <AlertCircle className="size-4 shrink-0 mt-0.5" />
                      <span>{checkoutError}</span>
                    </div>
                  )}
                  <button onClick={handleCheckout} disabled={checkoutLoading} className="w-full mt-4 py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 disabled:opacity-60 flex items-center justify-center gap-2">
                    {checkoutLoading && <Loader2 className="size-4 animate-spin" />}
                    {checkoutLoading ? 'Confirming...' : 'Confirm order'}
                  </button>
                </div>
              </div>
            )}

            {(weekOrders.length > 0 || nextWeekOrders.length > 0) && (
              <div className="space-y-6">

              {weekOrders.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">✅ This week</p>
                  {outstandingTotal > 0 && (
                    <button onClick={openPayBalance} className="text-[10px] font-black uppercase tracking-widest text-primary">Pay balance · {formatCurrency(outstandingTotal)}</button>
                  )}
                </div>
                <div className="space-y-4">
                  {weekOrders.map(({ order, lines }, gi) => {
                    const orderPaid = lines.every(l => l.item.paymentStatus === 'Paid');
                    const orderUnclaimed = lines.filter(l => isUnclaimed(l.item));
                    const orderUnclaimedTotal = orderUnclaimed.reduce((t, l) => t + l.item.price, 0);
                    // Only offer one receipt for the whole order when it was
                    // actually settled as one payment (every line shares the
                    // same reference) — if some meals were paid individually
                    // and others together, that's more than one receipt, so
                    // fall back to "Paid" with no combined receipt button;
                    // each meal's own Receipt button still opens the right one.
                    const orderPaymentRefs = new Set(lines.map(l => l.item.paymentReference || `solo-${l.order.id}-${l.item.itemId}-${l.item.deliveryDate}`));
                    const orderIsOnePayment = orderPaid && orderPaymentRefs.size === 1;

                    // Meals within an order are grouped by offering first,
                    // then by day — an order can cover more than one
                    // delivery day (you can check out Monday and Tuesday's
                    // meals together), and can contain both Lunch and Dinner
                    // items, which are cooked/delivered as separate batches.
                    const serviceGroups = groupByOrderServiceDay(lines)[0]?.services || [];

                    return (
                      <div key={order.id} className="bg-white rounded-2xl border border-[#E7E0D0] overflow-hidden">
                        <div className="px-4 py-3 bg-[#F4EFE4] flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{gi === 0 ? 'Your order' : `Additional order ${gi + 1}`} · {lines.length} meal{lines.length !== 1 ? 's' : ''}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Placed {new Date(order.timestamp).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                          </div>
                          {orderIsOnePayment ? (
                            <button onClick={() => openReceipt(lines[0])} className="px-2.5 py-1 rounded text-[10px] font-black uppercase shrink-0 bg-success/10 text-success flex items-center gap-1">
                              <Receipt className="size-3" /> Paid · Receipt
                            </button>
                          ) : orderPaid ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase shrink-0 bg-success/10 text-success">Paid</span>
                          ) : orderUnclaimed.length > 0 ? (
                            <button onClick={() => openPayOrder(lines)} className="px-2.5 py-1 rounded text-[10px] font-black uppercase shrink-0 bg-danger/10 text-danger">
                              Pay order · {formatCurrency(orderUnclaimedTotal)}
                            </button>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase shrink-0 bg-warning/10 text-warning">Awaiting confirmation</span>
                          )}
                        </div>
                        <div className="p-4 space-y-4 bg-[#FDFAF4]">
                          {serviceGroups.map(sg => (
                            <div key={sg.service}>
                              <p className="text-[10px] font-black uppercase text-accent tracking-widest mb-2">{sg.service === 'Dinner' ? '🌙 Dinner' : '☀️ Lunch'}</p>
                              <div className="space-y-3">
                                {sg.days.map(group => {
                                  const locked = isPastCancelCutoff(group.date, sg.service, systemDate);
                                  return (
                                    <div key={group.date} className="bg-white rounded-2xl border border-[#E7E0D0] p-4">
                                      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                                        <p className="text-[10px] font-black uppercase text-primary tracking-widest">{group.label}</p>
                                        {locked && <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 text-[9px] font-black uppercase">🔒 Locked</span>}
                                      </div>
                                      <div className="space-y-3">
                                        {group.items.map((line, idx) => {
                                          const rating = line.item.rating || ratings[`${line.order.id}-${line.item.itemId}-${line.item.deliveryDate}`]?.stars;
                                          const isCompleted = line.item.status === 'Completed';
                                          const isActive = line.item.status === 'Active';
                                          const isCancelled = line.item.status === 'Cancelled';
                                          const payInfo = paymentStatusInfo(line.item);
                                          const { detail, person, instructions } = splitNotesTag(line.item.notes);
                                          return (
                                            <div key={idx} className={idx > 0 ? 'pt-3 border-t border-[#F0EADD]' : ''}>
                                              <div className="flex items-start justify-between gap-3 mb-1">
                                                <p className={`text-sm font-bold min-w-0 ${isCancelled ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{line.item.name}</p>
                                                <span className={`text-sm font-black shrink-0 ${isCancelled ? 'text-slate-400 line-through' : 'text-slate-900'}`}>Rs {line.item.price}</span>
                                              </div>
                                              {detail && <p className={`text-[11px] mb-1.5 ${isCancelled ? 'text-slate-300 line-through' : 'text-slate-400'}`}>{detail}</p>}
                                              <div className="flex items-center gap-1.5 flex-wrap mb-2">
                                                {line.seq > 0 && <span className="px-1.5 py-0.5 rounded bg-accent/10 text-accent text-[9px] font-black uppercase shrink-0">Extra {line.seq + 1}</span>}
                                                <StatusBadge label={payInfo.label} tone={payInfo.tone} />
                                                <StatusBadge label={line.item.status || 'Active'} tone={statusTone(line.item.status)} />
                                                {person && <PersonTag name={person} />}
                                                {instructions && <InstructionsTag text={instructions} />}
                                              </div>
                                              <div className="flex gap-2">
                                                {line.item.paymentStatus === 'Paid' && <button onClick={() => openReceipt(line)} className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1"><Receipt className="size-3" /> Receipt</button>}
                                                {isUnclaimed(line.item) && !isCancelled && <button onClick={() => openPayItem(line)} className="flex-1 py-2 bg-warning text-white rounded-xl text-[10px] font-black uppercase tracking-widest">Pay</button>}
                                                {isActive && !locked && <button onClick={() => openEditConfirmed(line)} className="flex-1 py-2 bg-primary/10 text-primary rounded-xl text-[10px] font-black uppercase tracking-widest">Edit</button>}
                                                {isActive && !locked && <button onClick={() => handleCancel(line)} disabled={cancellingItemId === line.item._fsItemId} className="flex-1 py-2 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest">{cancellingItemId === line.item._fsItemId ? 'Cancelling...' : 'Cancel'}</button>}
                                                {isActive && locked && <span className="flex-1 py-2 text-center text-[10px] font-black uppercase text-slate-400" title="The cutoff has passed — contact us for changes.">Contact us to change</span>}
                                                {isCompleted && !rating && <button onClick={() => openRating(line)} className="flex-1 py-2 bg-primary/10 text-primary rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1"><Star className="size-3" /> Rate</button>}
                                                {rating && <span className="flex-1 py-2 text-center text-[10px] font-black uppercase text-primary">{rating}★ sent</span>}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                        {/* Order-level totals — from confirmCheckout */}
                        {(() => {
                          const actv = lines.filter(l => l.item.status !== 'Cancelled');
                          const itemSum = actv.reduce((s, l) => s + l.item.price, 0);
                          const has = typeof order.subtotal === 'number';
                          const sub = has ? order.subtotal : itemSum;
                          const disc = has ? (order.discount || 0) : 0;
                          const vatAmt = has ? (order.vat || 0) : 0;
                          const tot = has ? order.total : itemSum;
                          const reason = has ? (order.discountReason || '') : '';
                          if (sub === 0) return null;
                          return (
                            <div className="mx-4 mb-4 pt-3 border-t border-[#E7E0D0]">
                              <div className="space-y-1 text-[11px]">
                                <div className="flex justify-between text-slate-500 font-bold"><span>Subtotal</span><span>{formatCurrency(sub)}</span></div>
                                {disc > 0 && <div className="flex justify-between text-primary font-bold"><span>Discount{reason ? ` (${reason})` : ''}</span><span>-{formatCurrency(disc)}</span></div>}
                                {vatAmt > 0 && <div className="flex justify-between text-slate-500 font-bold"><span>VAT ({SYSTEM_CONFIG.vatRate}%)</span><span>{formatCurrency(vatAmt)}</span></div>}
                                <div className="flex justify-between text-slate-900 font-black pt-1.5 border-t border-[#E7E0D0] text-xs"><span>Total</span><span>{formatCurrency(tot)}</span></div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              </div>
              )}

              {nextWeekOrders.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">📅 Next week</p>
                </div>
                <div className="space-y-4">
                  {nextWeekOrders.map(({ order, lines }, gi) => {
                    const orderPaid = lines.every(l => l.item.paymentStatus === 'Paid');
                    const orderUnclaimed = lines.filter(l => isUnclaimed(l.item));
                    const orderUnclaimedTotal = orderUnclaimed.reduce((t, l) => t + l.item.price, 0);
                    const orderPaymentRefs = new Set(lines.map(l => l.item.paymentReference || `solo-${l.order.id}-${l.item.itemId}-${l.item.deliveryDate}`));
                    const orderIsOnePayment = orderPaid && orderPaymentRefs.size === 1;
                    const serviceGroups = groupByOrderServiceDay(lines)[0]?.services || [];
                    return (
                      <div key={order.id} className="bg-white rounded-2xl border border-[#E7E0D0] overflow-hidden">
                        <div className="px-4 py-3 bg-[#F4EFE4] flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{gi === 0 ? 'Your order' : `Additional order ${gi + 1}`} · {lines.length} meal{lines.length !== 1 ? 's' : ''}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Placed {new Date(order.timestamp).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                          </div>
                          {orderIsOnePayment ? (
                            <button onClick={() => openReceipt(lines[0])} className="px-2.5 py-1 rounded text-[10px] font-black uppercase shrink-0 bg-success/10 text-success flex items-center gap-1"><Receipt className="size-3" /> Paid · Receipt</button>
                          ) : orderPaid ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase shrink-0 bg-success/10 text-success">Paid</span>
                          ) : orderUnclaimed.length > 0 ? (
                            <button onClick={() => openPayOrder(lines)} className="px-2.5 py-1 rounded text-[10px] font-black uppercase shrink-0 bg-danger/10 text-danger">Pay order · {formatCurrency(orderUnclaimedTotal)}</button>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase shrink-0 bg-warning/10 text-warning">Awaiting confirmation</span>
                          )}
                        </div>
                        <div className="p-4 space-y-4 bg-[#FDFAF4]">
                          {serviceGroups.map(sg => (
                            <div key={sg.service}>
                              <p className="text-[10px] font-black uppercase text-accent tracking-widest mb-2">{sg.service === 'Dinner' ? '🌙 Dinner' : '☀️ Lunch'}</p>
                              <div className="space-y-3">
                                {sg.days.map(group => {
                                  const locked = isPastCancelCutoff(group.date, sg.service, systemDate);
                                  return (
                                    <div key={group.date} className="bg-white rounded-2xl border border-[#E7E0D0] p-4">
                                      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                                        <p className="text-[10px] font-black uppercase text-primary tracking-widest">{group.label}</p>
                                        {locked && <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 text-[9px] font-black uppercase">🔒 Locked</span>}
                                      </div>
                                      <div className="space-y-3">
                                        {group.items.map((line, idx) => {
                                          const rating = line.item.rating || ratings[`${line.order.id}-${line.item.itemId}-${line.item.deliveryDate}`]?.stars;
                                          const isCompleted = line.item.status === 'Completed';
                                          const isActive = line.item.status === 'Active';
                                          const isCancelled = line.item.status === 'Cancelled';
                                          const payInfo = paymentStatusInfo(line.item);
                                          const { detail, person, instructions } = splitNotesTag(line.item.notes);
                                          return (
                                            <div key={idx} className={idx > 0 ? 'pt-3 border-t border-[#F0EADD]' : ''}>
                                              <div className="flex items-start justify-between gap-3 mb-1">
                                                <p className={`text-sm font-bold min-w-0 ${isCancelled ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{line.item.name}</p>
                                                <span className={`text-sm font-black shrink-0 ${isCancelled ? 'text-slate-400 line-through' : 'text-slate-900'}`}>Rs {line.item.price}</span>
                                              </div>
                                              {detail && <p className={`text-[11px] mb-1.5 ${isCancelled ? 'text-slate-300 line-through' : 'text-slate-400'}`}>{detail}</p>}
                                              <div className="flex items-center gap-1.5 flex-wrap mb-2">
                                                {line.seq > 0 && <span className="px-1.5 py-0.5 rounded bg-accent/10 text-accent text-[9px] font-black uppercase shrink-0">Extra {line.seq + 1}</span>}
                                                <StatusBadge label={payInfo.label} tone={payInfo.tone} />
                                                <StatusBadge label={line.item.status || 'Active'} tone={statusTone(line.item.status)} />
                                                {person && <PersonTag name={person} />}
                                                {instructions && <InstructionsTag text={instructions} />}
                                              </div>
                                              <div className="flex gap-2">
                                                {line.item.paymentStatus === 'Paid' && <button onClick={() => openReceipt(line)} className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1"><Receipt className="size-3" /> Receipt</button>}
                                                {isUnclaimed(line.item) && !isCancelled && <button onClick={() => openPayItem(line)} className="flex-1 py-2 bg-warning text-white rounded-xl text-[10px] font-black uppercase tracking-widest">Pay</button>}
                                                {isActive && !locked && <button onClick={() => openEditConfirmed(line)} className="flex-1 py-2 bg-primary/10 text-primary rounded-xl text-[10px] font-black uppercase tracking-widest">Edit</button>}
                                                {isActive && !locked && <button onClick={() => handleCancel(line)} disabled={cancellingItemId === line.item._fsItemId} className="flex-1 py-2 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest">{cancellingItemId === line.item._fsItemId ? 'Cancelling...' : 'Cancel'}</button>}
                                                {isActive && locked && <span className="flex-1 py-2 text-center text-[10px] font-black uppercase text-slate-400" title="The cutoff has passed — contact us for changes.">Contact us to change</span>}
                                                {isCompleted && !rating && <button onClick={() => openRating(line)} className="flex-1 py-2 bg-primary/10 text-primary rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1"><Star className="size-3" /> Rate</button>}
                                                {rating && <span className="flex-1 py-2 text-center text-[10px] font-black uppercase text-primary">{rating}★ sent</span>}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                        {/* Order-level totals — from confirmCheckout */}
                        {(() => {
                          const actv = lines.filter(l => l.item.status !== 'Cancelled');
                          const itemSum = actv.reduce((s, l) => s + l.item.price, 0);
                          const has = typeof order.subtotal === 'number';
                          const sub = has ? order.subtotal : itemSum;
                          const disc = has ? (order.discount || 0) : 0;
                          const vatAmt = has ? (order.vat || 0) : 0;
                          const tot = has ? order.total : itemSum;
                          const reason = has ? (order.discountReason || '') : '';
                          if (sub === 0) return null;
                          return (
                            <div className="mx-4 mb-4 pt-3 border-t border-[#E7E0D0]">
                              <div className="space-y-1 text-[11px]">
                                <div className="flex justify-between text-slate-500 font-bold"><span>Subtotal</span><span>{formatCurrency(sub)}</span></div>
                                {disc > 0 && <div className="flex justify-between text-primary font-bold"><span>Discount{reason ? ` (${reason})` : ''}</span><span>-{formatCurrency(disc)}</span></div>}
                                {vatAmt > 0 && <div className="flex justify-between text-slate-500 font-bold"><span>VAT ({SYSTEM_CONFIG.vatRate}%)</span><span>{formatCurrency(vatAmt)}</span></div>}
                                <div className="flex justify-between text-slate-900 font-black pt-1.5 border-t border-[#E7E0D0] text-xs"><span>Total</span><span>{formatCurrency(tot)}</span></div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              </div>
              )}

              </div>
            )}

            {cartCount === 0 && thisWeekLines.length === 0 && (
              <div className="py-16 text-center opacity-40">
                <ShoppingBag className="size-10 mx-auto mb-3" />
                <p className="text-xs font-black uppercase tracking-widest">No meals yet this week</p>
                <button onClick={() => setView('menu')} className="mt-4 text-xs font-black text-primary uppercase tracking-widest">Browse the menu →</button>
              </div>
            )}
          </div>
        )}

        {view === 'contact' && (
          <div className="space-y-6 text-slate-800">
            <div className="bg-white rounded-3xl border border-[#E7E0D0] p-6 text-center shadow-[0_8px_30px_rgb(0,0,0,0.015)]">
              <div className="size-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mx-auto mb-3">
                <MessageSquare className="size-7" />
              </div>
              <h2 className="text-lg font-black text-slate-900">How can we help?</h2>
              <p className="text-xs text-slate-400 font-medium max-w-xs mx-auto mt-1">
                Have a question about your order, scheduling, or dietary preferences? We're here to assist.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {/* WhatsApp Card */}
              <a
                href={`https://wa.me/${SYSTEM_CONFIG.supportPhone.replace(/\D/g, '').length === 8 ? '230' : ''}${SYSTEM_CONFIG.supportPhone.replace(/\D/g, '')}?text=Bonjour%20BonManzE!%20`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-5 bg-white rounded-3xl border border-[#E7E0D0] shadow-sm hover:border-[#25D366]/40 transition-all text-left active:scale-[0.98]"
              >
                <div className="size-12 bg-[#25D366]/10 text-[#25D366] rounded-2xl flex items-center justify-center shrink-0">
                  <Phone className="size-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900">WhatsApp Chat</p>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Message us at +230 {SYSTEM_CONFIG.supportPhone}</p>
                </div>
                <ChevronRight className="size-4 text-slate-300" />
              </a>

              {/* Email Card */}
              <a
                href={`mailto:${SYSTEM_CONFIG.supportEmail}?subject=BonManzE%20Customer%20Query`}
                className="flex items-center gap-4 p-5 bg-white rounded-3xl border border-[#E7E0D0] shadow-sm hover:border-primary/40 transition-all text-left active:scale-[0.98]"
              >
                <div className="size-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shrink-0">
                  <Smartphone className="size-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900">Email Support</p>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">{SYSTEM_CONFIG.supportEmail}</p>
                </div>
                <ChevronRight className="size-4 text-slate-300" />
              </a>
            </div>

            {/* Delivery details card */}
            <div className="bg-white rounded-3xl border border-[#E7E0D0] p-6 shadow-sm">
              <h3 className="text-sm font-black text-slate-900 mb-4">Kitchen & Delivery Hours</h3>
              <div className="space-y-3 text-xs font-medium text-slate-600">
                <div className="flex justify-between pb-2.5 border-b border-[#F0EADD]">
                  <span>Operating Days</span>
                  <span className="font-bold text-slate-900">{SYSTEM_CONFIG.operatingDays.join(', ')}</span>
                </div>
                <div className="flex justify-between pb-2.5 border-b border-[#F0EADD]">
                  <span>Lunch Delivery Slot</span>
                  <span className="font-bold text-slate-900">{SYSTEM_CONFIG.lunchDeliveryWindow}</span>
                </div>
                {SYSTEM_CONFIG.dinnerEnabled && (
                  <div className="flex justify-between">
                    <span>Dinner Delivery Slot</span>
                    <span className="font-bold text-slate-900">{SYSTEM_CONFIG.dinnerDeliveryWindow}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* --- PROFILE MODAL DRAWER --- */}
      {profileOpen && (
        <div className="fixed inset-0 z-[9999] bg-[#FDFAF4] flex flex-col overflow-hidden animate-slide-up">
          <header className="shrink-0 bg-white border-b border-[#E7E0D0] px-6 py-4 flex items-center justify-between relative z-30">
            <div className="flex items-center gap-3">
              <div className="size-8 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                <UserIcon className="size-4" />
              </div>
              <h2 className="text-sm font-black text-slate-900 leading-none">Your Profile</h2>
            </div>
            <button
              onClick={() => setProfileOpen(false)}
              className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-900 active:scale-95 transition-transform"
            >
              <X className="size-5" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 pb-24">
            <div className="bg-white rounded-3xl border border-[#E7E0D0] p-6 text-center relative overflow-hidden">
              {isBirthday && (
                <div className="absolute top-3 right-3 px-2 py-0.5 rounded bg-accent/15 text-accent text-[9px] font-black uppercase tracking-wider animate-pulse flex items-center gap-1">
                  🎂 Birthday Today!
                </div>
              )}
              <img src={currentUser.avatar} className="size-16 rounded-full border-4 border-primary/10 mx-auto mb-3" alt={currentUser.name} />
              <p className="text-lg font-black text-slate-900">{currentUser.name}</p>
              <p className="text-xs text-slate-400 font-medium">{currentUser.email}</p>
              {currentUser.birthday && (
                <p className="text-[10px] text-slate-500 font-bold mt-1.5 flex items-center justify-center gap-1">
                  📅 Birthdate: {(() => {
                    const [y, m, d] = currentUser.birthday.split('-').map(Number);
                    const dt = new Date(y, m - 1, d);
                    return Number.isNaN(dt.getTime()) ? currentUser.birthday : dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                  })()}
                  {isBirthday && <span className="text-xs">🎉</span>}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl border border-[#E7E0D0] p-4 text-center">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Points</p>
                <p className="text-xl font-black text-slate-900">{currentUser.points}</p>
              </div>
              <div className="bg-white rounded-2xl border border-[#E7E0D0] p-4 text-center">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Store credit</p>
                <p className="text-xl font-black text-success">{formatCurrency(currentUser.storeCredit || 0)}</p>
              </div>
            </div>

            {tierObj && (
              <div className="bg-primary rounded-3xl p-6 text-white shadow-lg shadow-primary/20">
                <div className="flex items-center gap-2 mb-3">
                  <Star className="size-5" />
                  <p className="text-lg font-black">{tierObj.name} Member</p>
                </div>
                {loyaltyProgress?.next && (
                  <div className="mb-4">
                    <div className="h-2 rounded-full bg-white/15 overflow-hidden mb-1.5">
                      <div className="h-full bg-white rounded-full transition-all" style={{ width: `${loyaltyProgress.pct}%` }} />
                    </div>
                    <p className="text-[11px] opacity-80 font-bold">{loyaltyProgress.remaining} pts to {loyaltyProgress.next.name}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 text-xs font-bold">
                  <div className="bg-white/10 rounded-xl p-3"><p className="opacity-70 text-[10px] uppercase mb-1">Standard discount</p><p className="text-lg font-black">{tierObj.standardDiscount}%</p></div>
                  <div className="bg-white/10 rounded-xl p-3"><p className="opacity-70 text-[10px] uppercase mb-1">Birthday discount</p><p className="text-lg font-black">{tierObj.birthdayDiscount}%</p></div>
                </div>
                {tierObj.perks?.length > 0 && <p className="text-[11px] opacity-80 mt-3">✨ {tierObj.perks.join(' · ')}</p>}
              </div>
            )}

            <div className="bg-white rounded-3xl border border-[#E7E0D0] p-6">
              <div className="flex items-center gap-2 mb-3"><Gift className="size-5 text-primary" /><p className="text-sm font-black text-slate-900">Referral code</p></div>
              <div className="flex items-center justify-between bg-[#F4EFE4] rounded-xl p-4">
                <span className="font-mono font-black text-slate-900">{currentUser.referenceCode || 'BONMANZE-' + currentUser.id.toUpperCase()}</span>
                <button
                  onClick={() => {
                    const code = currentUser.referenceCode || 'BONMANZE-' + currentUser.id.toUpperCase();
                    navigator.clipboard?.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
                  }}
                  className="p-2 text-primary hover:bg-primary/10 rounded-lg active:scale-90 transition-transform"
                >
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                </button>
              </div>
            </div>

            {currentUser.addresses?.[0] && (
              <div className="bg-white rounded-3xl border border-[#E7E0D0] p-6">
                <div className="flex items-center gap-2 mb-2"><MapPin className="size-5 text-primary" /><p className="text-sm font-black text-slate-900">Delivery address</p></div>
                <p className="text-xs text-slate-500 font-medium">{currentUser.addresses[0].street}, {currentUser.addresses[0].city}</p>
              </div>
            )}

            <div className="bg-white rounded-3xl border border-[#E7E0D0] p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-black text-slate-900">Order history</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Last 3 months</p>
              </div>
              {pastLines.length === 0 ? (
                <p className="text-xs text-slate-400 font-bold">No past orders yet.</p>
              ) : (
                <div className="space-y-2">
                  {pastLines.map((line, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="font-bold text-slate-600">{line.item.deliveryDay} · {line.item.name}</span>
                      <span className="font-black text-slate-900">Rs {line.item.price}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {onLogout && (
              <button
                onClick={() => {
                  setProfileOpen(false);
                  signOut(auth).finally(() => {
                    setCustomerDocRaw(null);
                    onLogout();
                  });
                }}
                className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                <LogOut className="size-4" /> Log out
              </button>
            )}
          </div>
        </div>
      )}

      <nav className="fixed bottom-5 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md bg-gradient-to-r from-primary/10 via-white/95 to-secondary/10 backdrop-blur-xl border border-[#E7E0D0] rounded-[24px] shadow-[0_12px_40px_-12px_rgba(62,125,34,0.15)] z-40 flex items-center justify-around py-3 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bmz-no-print">
        {([
          { id: 'home', label: 'Home', icon: HomeIcon },
          { id: 'menu', label: 'Menu', icon: BookOpen },
          { id: 'order', label: 'My Order', icon: ShoppingBag },
          { id: 'contact', label: 'Contact Us', icon: MessageSquare },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-bold active:scale-95 transition-transform relative ${view === t.id ? 'text-primary' : 'text-slate-400'}`}
          >
            <t.icon className="size-5" />
            <span>{t.label}</span>
            {t.id === 'order' && cartCount > 0 && (
              <span className="absolute -top-1 right-2 size-4 bg-danger text-white rounded-full text-[8px] flex items-center justify-center font-black">
                {cartCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* --- MEAL BUILDER --- */}
      {builder && (() => {
        const complete = sectionComplete(builder);
        // Resolved through the linked Meal Library Main — see resolveDish
        // in store.ts — so every applicable/narrowing check below (Base
        // visibility, Dhal/Salad/Beverage/Dessert ChipRows) reflects the
        // Main's current configuration live, not a frozen copy from
        // whenever this dish was placed on the Menu Planner.
        const rawSelectedCurry = menuFor(builder.service, builder.weekStart)[builder.day.key].find(c => c.id === builder.sel.curryId);
        const selectedCurry = rawSelectedCurry ? resolveDish(rawSelectedCurry) : undefined;
        const selectedBase = MEAL_BASES.find(b => b.id === builder.sel.baseId);
        const baseOptions = filterAddOnOptions(MEAL_BASES, selectedCurry ? dishBaseOptionIds(selectedCurry, MEAL_BASES) : undefined);
        const extrasList = [
          builder.sel.dhalId && builder.sel.dhalId !== 'none' ? MEAL_DHALS.find(x => x.id === builder.sel.dhalId)?.name : null,
          builder.sel.saladId && builder.sel.saladId !== 'none' ? MEAL_SALADS.find(x => x.id === builder.sel.saladId)?.name : null,
          builder.sel.beverageId !== 'none' ? MEAL_BEVERAGES.find(x => x.id === builder.sel.beverageId)?.name : null,
          builder.sel.dessertId !== 'none' ? MEAL_DESSERTS.find(x => x.id === builder.sel.dessertId)?.name : null,
        ].filter(Boolean) as string[];

        return (
          <div className="fixed inset-0 z-[9999] bg-white flex flex-col animate-slide-up">
            <div className="relative h-64 shrink-0">
              <img src={dishPhotoFor(selectedCurry || builder.sel.curryId)} className="w-full h-full object-cover" alt="Dish" />
              <button onClick={closeBuilder} className="absolute top-4 right-4 p-2 bg-white/90 rounded-full text-slate-700"><X className="size-4" /></button>
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent">
                <p className="text-white font-black text-sm mb-2">{(builder.editIndex !== null || builder.editingConfirmed) ? `Edit ${builder.day.label}` : `${builder.day.label} — customise`}</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {selectedCurry && (
                    <button onClick={() => toggleSection(1)} className="px-2.5 py-1 rounded-full bg-white/90 text-slate-900 text-[11px] font-bold">{selectedCurry.emoji} {selectedCurry.name}</button>
                  )}
                  <button onClick={() => toggleSection(2)} className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${selectedBase ? 'bg-white/90 text-slate-900' : 'bg-white/30 text-white'}`}>
                    {selectedBase ? `${selectedBase.emoji} ${selectedBase.name}` : '🌾 Pick a base'}
                  </button>
                  {extrasList.map((label, i) => (
                    <button key={i} onClick={() => toggleSection(3)} className="px-2.5 py-1 rounded-full bg-white/90 text-slate-900 text-[11px] font-bold">✨ {label}</button>
                  ))}
                </div>
              </div>
            </div>
            {selectedCurry?.desc && (
              <p className="px-4 pt-3 text-xs text-slate-500 font-medium leading-relaxed shrink-0">{selectedCurry.desc}</p>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <SectionCard
                index={1} title="Choose your curry"
                isOpen={builder.openSection === 1} isComplete={complete[1]}
                summary={selectedCurry ? `${selectedCurry.emoji} ${selectedCurry.name}` : undefined}
                onToggle={() => toggleSection(1)}
              >
                <div className="grid grid-cols-3 gap-2">
                  {menuFor(builder.service, builder.weekStart)[builder.day.key].map(c => {
                    const special = specialPriceInfo(c);
                    return (
                      <button
                        key={c.id}
                        onClick={() => selectCurry(c.id)}
                        className={`relative rounded-2xl overflow-hidden text-left h-28 border-2 transition-all active:scale-[0.98] ${builder.sel.curryId === c.id ? 'border-primary ring-4 ring-primary/10 shadow-[0_0_20px_rgba(62,125,34,0.08)]' : 'border-transparent'}`}
                      >
                        <img src={dishPhotoFor(c)} className="absolute inset-0 w-full h-full object-cover" alt={c.name} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                        {special && (
                          <span className="absolute top-1.5 right-1.5 bg-emerald-500 text-white text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full shadow-sm">Special</span>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 p-2">
                          <p className="text-[11px] font-black text-white leading-tight truncate">{c.name}</p>
                          <div className="flex items-center gap-1.5">
                            {special && <span className="text-[9px] text-white/60 font-bold line-through">Rs {special.regularPrice}</span>}
                            <p className={`text-[10px] font-black mt-0.5 ${special ? 'text-emerald-300' : 'text-white/90'}`}>Rs {c.price}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </SectionCard>

              {(!selectedCurry || (dishBaseApplicable(selectedCurry) && baseOptions.length > 0)) && (
              <SectionCard
                index={2} title="Choose your base"
                isOpen={builder.openSection === 2} isComplete={complete[2]}
                summary={selectedBase ? `${selectedBase.emoji} ${selectedBase.name}` : undefined}
                onToggle={() => toggleSection(2)}
              >
                <div className="grid grid-cols-2 gap-2">
                  {baseOptions.map(b => (
                    <button key={b.id} onClick={() => selectBase(b.id)} className={`p-4 rounded-2xl border-2 transition-all active:scale-[0.98] ${builder.sel.baseId === b.id ? 'border-primary bg-primary/[0.04] ring-4 ring-primary/10 shadow-[0_0_20px_rgba(62,125,34,0.08)]' : 'border-transparent bg-[#F4EFE4]'}`}>
                      <p className="text-2xl mb-1">{b.emoji}</p>
                      <p className="text-xs font-bold text-slate-900">{b.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold">{b.up ? `+Rs ${b.up}` : 'included'}</p>
                    </button>
                  ))}
                </div>
              </SectionCard>
              )}

              <SectionCard
                index={3} title="Make it yours"
                isOpen={builder.openSection === 3} isComplete={complete[3]}
                summary={complete[3] ? (
                  extrasList.length > 0 ? (
                    <>
                      {extrasList.map((label, i) => (
                        <span key={i} className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-bold truncate max-w-[80px]">{label}</span>
                      ))}
                    </>
                  ) : <span className="text-xs font-bold text-slate-400">No extras</span>
                ) : undefined}
                onToggle={() => toggleSection(3)}
              >
                <div className="space-y-3">
                  {(!selectedCurry || dishDhalApplicable(selectedCurry)) && (
                    <ChipRow label="🫘 Dhal" options={filterAddOnOptions(MEAL_DHALS, selectedCurry?.dhalOptionIds)} selected={builder.sel.dhalId} onSelect={id => requestExtraChange('dhalId', id)} noneLabel="None" showPrice />
                  )}
                  {(!selectedCurry || dishSaladApplicable(selectedCurry)) && (
                    <ChipRow label="🥗 Salad" options={filterAddOnOptions(MEAL_SALADS, selectedCurry?.saladOptionIds)} selected={builder.sel.saladId} onSelect={id => requestExtraChange('saladId', id)} noneLabel="None" showPrice />
                  )}
                  {(!selectedCurry || dishBeverageApplicable(selectedCurry)) && (
                    <ChipRow label="🥤 Beverage" options={filterAddOnOptions(MEAL_BEVERAGES, selectedCurry?.beverageOptionIds)} selected={builder.sel.beverageId} onSelect={id => setBuilderSel({ beverageId: id })} noneLabel="None" showPrice />
                  )}
                  {(!selectedCurry || dishDessertApplicable(selectedCurry)) && (
                    <ChipRow label="🍮 Dessert" options={filterAddOnOptions(MEAL_DESSERTS, selectedCurry?.dessertOptionIds)} selected={builder.sel.dessertId} onSelect={id => setBuilderSel({ dessertId: id })} noneLabel="None" showPrice />
                  )}
                  <div className="grid grid-cols-1 gap-3 rounded-2xl border border-[#E7E0D0] bg-[#FBF8F1] p-4">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">🧑 Who's this meal for? (optional)</p>
                      <input
                        value={builder.sel.note}
                        onChange={e => setBuilderSel({ note: e.target.value })}
                        maxLength={40}
                        placeholder="e.g. Priya"
                        className="w-full px-4 py-2.5 rounded-xl border border-[#E7E0D0] text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/20 bg-white placeholder-slate-400"
                      />
                    </div>
                    <div className="space-y-1 pt-3 border-t border-[#E7E0D0]/50">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">🍳 Custom instructions / Prep requests? (optional)</p>
                      <input
                        value={builder.sel.instructions || ''}
                        onChange={e => setBuilderSel({ instructions: e.target.value })}
                        maxLength={80}
                        placeholder="e.g. Less spicy, no dhal, allergy info"
                        className="w-full px-4 py-2.5 rounded-xl border border-[#E7E0D0] text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/20 bg-white placeholder-slate-400"
                      />
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>

            <div className="p-4 border-t border-[#E7E0D0] flex items-center gap-3 shrink-0 bg-white">
              <div className="flex-1 text-right pr-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Total </span>
                <span className="text-base font-black text-slate-900">Rs {mealPrice(builder.sel, builder.day.key, builder.service, builder.weekStart)}</span>
              </div>
              <button
                disabled={!builderReady(builder) || builderSaving}
                onClick={commitBuilder}
                className="px-6 py-3 rounded-xl bg-primary text-white text-xs font-black uppercase shadow-lg shadow-primary/20 disabled:opacity-40"
              >
                {builderSaving ? 'Saving...' : ((builder.editIndex !== null || builder.editingConfirmed) ? 'Save changes' : 'Add to order')}
              </button>
            </div>
          </div>
        );
      })()}

      {/* Free-item forfeiture confirmation — fires once at commit time
          (Add to order/Save changes), listing every applicable free
          category (Dhal/Salad) set to "none", rather than interrupting
          per-tap. Sits above the builder's own z-[9999]. */}
      {forfeitConfirm && (
        <div className="fixed inset-0 z-[10050] bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={() => setForfeitConfirm(null)}>
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-black text-slate-900 mb-1">You're skipping: {forfeitConfirm.labels.join(', ')}</p>
            <p className="text-xs text-slate-500 font-medium mb-5">
              {forfeitConfirm.labels.length > 1 ? "They're included" : "It's included"} at no extra cost — go back to add {forfeitConfirm.labels.length > 1 ? 'them' : 'it'} back, or confirm to skip.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setForfeitConfirm(null)} className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-600 text-xs font-black uppercase tracking-widest">Go back</button>
              <button onClick={() => { forfeitConfirm.apply(); setForfeitConfirm(null); }} className="flex-1 py-3 rounded-2xl bg-primary text-white text-xs font-black uppercase tracking-widest">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* --- PAYMENT SHEET --- */}
      {payTarget && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-[#E7E0D0] flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900">{payMethod ? payMethod.name : `Pay ${formatCurrency(payTarget.amount)}`}</h2>
              <button disabled={paymentSubmitting} onClick={() => { setPayTarget(null); setPayMethod(null); setCustomerRef(''); setPaymentError(null); }} className="p-2 text-slate-400 hover:text-danger disabled:opacity-40"><X className="size-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-400 font-bold">{payTarget.what}</p>
              {!payMethod ? (
                <div className="space-y-2">
                  {applicablePaymentMethods.map(m => (
                    <button key={m.id} onClick={() => setPayMethod(m)} className="w-full flex items-center gap-3 p-4 rounded-2xl border border-[#E7E0D0] hover:border-primary/40 transition-all">
                      <span className="text-2xl">{m.icon}</span>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-bold text-slate-900">{m.name}</p>
                        <p className="text-[11px] text-slate-400">{isPayNowMethod(m.name) ? 'Approve in your Juice app' : m.name === 'MauCAS' ? "Scan the driver's QR on delivery" : 'Pay the driver in cash'}</p>
                      </div>
                      <span className={`text-[10px] font-black uppercase ${isPayNowMethod(m.name) ? 'text-primary' : 'text-accent'}`}>{isPayNowMethod(m.name) ? 'Pay now' : 'At delivery'}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-3xl font-black text-slate-900">{formatCurrency(payTarget.amount)}</p>
                  </div>
                  {isPayNowMethod(payMethod.name) ? (
                    <p className="text-xs text-slate-500 text-center">You'll be handed to <strong>Juice by MCB</strong> to approve this payment to {SYSTEM_CONFIG.businessName}.</p>
                  ) : (
                    <p className="text-xs text-slate-500 text-center">
                      {payMethod.name === 'MauCAS' ? "Your driver will show the MauCAS QR code on their device — scan it with your banking app on delivery." : 'Have cash ready for the driver on delivery.'}
                    </p>
                  )}
                  {payMethod.name !== 'Cash on Delivery' && (
                    <>
                      <div className="bg-[#F4EFE4] rounded-xl p-4 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Quote this reference</p>
                          <p className="font-mono font-black text-slate-900 text-sm truncate">{payTarget.ref}</p>
                        </div>
                        <button
                          onClick={() => navigator.clipboard?.writeText(payTarget.ref).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })}
                          className="p-2 text-primary hover:bg-white rounded-lg shrink-0"
                        >
                          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                        </button>
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1.5">Got a reference back from {payMethod.name}? (optional)</label>
                        <input
                          value={customerRef}
                          onChange={e => setCustomerRef(e.target.value)}
                          maxLength={40}
                          placeholder="e.g. the transaction ID from your banking app"
                          className="w-full px-4 py-3 rounded-xl border border-[#E7E0D0] text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">Helps us match your payment faster.</p>
                      </div>
                    </>
                  )}
                  {paymentError && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-danger/10 text-danger text-xs font-bold">
                      <AlertCircle className="size-4 shrink-0 mt-0.5" />
                      <span>{paymentError}</span>
                    </div>
                  )}
                  <button onClick={commitPayment} disabled={paymentSubmitting} className="w-full py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 disabled:opacity-60 flex items-center justify-center gap-2">
                    {paymentSubmitting && <Loader2 className="size-4 animate-spin" />}
                    {paymentSubmitting ? 'Recording...' : (isPayNowMethod(payMethod.name) ? "I've approved payment" : `Confirm — ${payMethod.name}`)}
                  </button>
                  <button disabled={paymentSubmitting} onClick={() => { setPayMethod(null); setCustomerRef(''); setPaymentError(null); }} className="w-full py-2 text-slate-400 text-xs font-bold disabled:opacity-40">← Choose a different method</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- RATING SHEET --- */}
      {rateTarget && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-sm shadow-2xl overflow-hidden p-8 text-center relative animate-in zoom-in-95 duration-200">
            <button disabled={ratingSubmitting} onClick={() => setRateTarget(null)} className="absolute top-6 right-6 p-2 text-slate-400 hover:text-danger disabled:opacity-40"><X className="size-5" /></button>
            <p className="text-sm font-black text-slate-900 mb-1">Rate your meal</p>
            <p className="text-xs text-slate-400 font-bold mb-6">{rateTarget.label}</p>
            <div className="flex items-center justify-center gap-2 mb-6">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} disabled={ratingSubmitting} onClick={() => setRateStars(n)}>
                  <Star className={`size-8 transition-colors ${n <= rateStars ? 'fill-warning text-warning' : 'text-slate-200'}`} />
                </button>
              ))}
            </div>
            <div className="mb-6 text-left">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1.5">
                Share your feedback (optional)
              </label>
              <textarea
                value={rateComment}
                onChange={e => setRateComment(e.target.value)}
                disabled={ratingSubmitting}
                maxLength={300}
                rows={3}
                placeholder="How was the curry? What did you think of the sides?"
                className="w-full px-4 py-3 rounded-xl border border-[#E7E0D0] text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20 resize-none bg-slate-50 focus:bg-white transition-all disabled:opacity-60"
              />
            </div>
            <button
              disabled={!rateStars || ratingSubmitting}
              onClick={submitRating}
              className="w-full py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition-all hover:bg-primary/95 active:scale-98"
            >
              {ratingSubmitting && <Loader2 className="size-4 animate-spin" />}
              {ratingSubmitting ? 'Submitting...' : 'Submit rating'}
            </button>
          </div>
        </div>
      )}

      {/* --- RECEIPT SHEET --- */}
      {receiptTarget && (() => {
        const receiptTotal = receiptTarget.lines.reduce((t, l) => t + l.item.price, 0);
        // Every line in a receipt was settled in the same payment, so
        // method/reference are shown once at the top, not repeated per line.
        const first = receiptTarget.lines[0];
        // The order ID is the actual invoice reference — the generated
        // payment reference (and whatever the customer quoted back from
        // Juice/MauCAS) is just how the payment itself gets matched, shown
        // separately below as "Payment ref".
        const orderIds = Array.from(new Set(receiptTarget.lines.map(l => l.order.id)));
        // Meal prices are treated as VAT-inclusive when VAT is on — this
        // doesn't change what was actually collected (still the sum of
        // item.price below); it just discloses how much of that total is
        // tax. Uses today's SYSTEM_CONFIG rate since the rate actually in
        // effect at checkout time isn't stored per order/item.
        const vatOn = SYSTEM_CONFIG.vatEnabled;
        const vatRate = SYSTEM_CONFIG.vatRate;
        // Legacy fallback back-calculation from raw item sum
        const legacyNetTotal = vatOn ? receiptTotal / (1 + vatRate / 100) : receiptTotal;
        const legacyVatAmount = receiptTotal - legacyNetTotal;
        const billToAddress = currentUser?.addresses?.[0];
        // Same Order -> Offering -> Day nesting as My Order — a receipt can
        // span more than one order (a "Pay balance" claim settles everything
        // outstanding at once) and more than one offering, so the item table
        // below groups accordingly instead of listing everything flat.
        const receiptGroups = groupByOrderServiceDay(receiptTarget.lines);
        // Use saved order-level fields when present (written by confirmCheckout).
        // Must come after receiptGroups is declared.
        const firstOrder = receiptGroups[0]?.order;
        const hasSavedTotals = typeof firstOrder?.subtotal === 'number';
        // When a receipt covers multiple orders ("Pay balance" spanning several
        // orders at once), sum the saved fields across all covered orders.
        const savedSubtotal = hasSavedTotals
          ? receiptGroups.reduce((s, og) => s + (og.order.subtotal || 0), 0)
          : receiptTotal;
        const savedDiscount = hasSavedTotals
          ? receiptGroups.reduce((s, og) => s + (og.order.discount || 0), 0)
          : 0;
        const savedDiscountReason = hasSavedTotals
          ? Array.from(new Set(receiptGroups.map(og => og.order.discountReason).filter(Boolean))).join(', ')
          : '';
        const savedVat = hasSavedTotals
          ? receiptGroups.reduce((s, og) => s + (og.order.vat || 0), 0)
          : 0;
        const savedTotal = hasSavedTotals
          ? receiptGroups.reduce((s, og) => s + (og.order.total || 0), 0)
          : receiptTotal;
        const displaySubtotal = hasSavedTotals ? savedSubtotal : receiptTotal;
        const displayDiscount = hasSavedTotals ? savedDiscount : 0;
        const displayDiscountReason = hasSavedTotals ? savedDiscountReason : '';
        const displayVat = hasSavedTotals ? savedVat : (vatOn ? legacyVatAmount : 0);
        const displayTotal = hasSavedTotals ? savedTotal : receiptTotal;
        return (
          <div className="fixed inset-0 z-[9999] bg-slate-900/70 backdrop-blur-md overflow-y-auto p-4">
            <style>{`
              @media print {
                body * { visibility: hidden; }
                .bmz-receipt-printable, .bmz-receipt-printable * { visibility: visible; }
                .bmz-receipt-printable { position: fixed; inset: 0; margin: 0; max-width: 100%; max-height: none; overflow: visible; box-shadow: none; border-radius: 0; }
                .bmz-no-print { display: none !important; }
              }
            `}</style>
            <div className="min-h-full flex items-center justify-center py-8">
              <div className="bmz-receipt-printable bg-white rounded-[32px] w-full max-w-sm shadow-2xl overflow-x-hidden overflow-y-auto max-h-[85vh]">
                <div className="p-6">
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2.5">
                    {SYSTEM_CONFIG.businessLogoUrl && (
                      <img src={SYSTEM_CONFIG.businessLogoUrl} alt={SYSTEM_CONFIG.businessName} className="size-9 rounded-lg object-cover shrink-0" />
                    )}
                    <div>
                      <p className="text-lg font-black text-slate-900">{SYSTEM_CONFIG.businessName}</p>
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{SYSTEM_CONFIG.businessTagline}</p>
                    </div>
                  </div>
                  <button onClick={() => setReceiptTarget(null)} className="bmz-no-print p-1.5 text-slate-400 hover:text-danger"><X className="size-5" /></button>
                </div>
                <p className="text-[10px] font-black uppercase text-primary tracking-widest mt-3">{vatOn ? 'Tax invoice' : 'Receipt'}</p>
                {vatOn && SYSTEM_CONFIG.vatNumber && (
                  <p className="text-[10px] text-slate-400 mt-0.5">VRN {SYSTEM_CONFIG.vatNumber}</p>
                )}

                <div className="border-t border-dashed border-slate-300 mt-3 pt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <div>
                    <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-1">Bill to</p>
                    <p className="font-black text-slate-800">{currentUser?.name || receiptTarget.order.customerName}</p>
                    {currentUser?.phone && <p className="text-slate-500 mt-0.5">{currentUser.phone}</p>}
                    {currentUser?.email && <p className="text-slate-500 mt-0.5 break-all">{currentUser.email}</p>}
                    {billToAddress && <p className="text-slate-500 mt-0.5">{billToAddress.street}, {billToAddress.city}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-1">{orderIds.length > 1 ? 'Invoice refs' : 'Invoice ref'}</p>
                    <p className="font-mono text-slate-600">{orderIds.join(', ')}</p>
                    {orderIds.length === 1 && (
                      <p className="text-slate-500 mt-1">{new Date(receiptTarget.order.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    )}
                  </div>
                </div>

                {(first?.item.paymentMethodName || first?.item.paymentReference) && (
                  <div className="border-t border-dashed border-slate-300 mt-3 pt-3 space-y-1 text-xs">
                    {first?.item.paymentMethodName && (
                      <div className="flex justify-between"><span className="text-slate-400 font-bold">Payment method</span><span className="text-slate-600">{first.item.paymentMethodName}</span></div>
                    )}
                    {first?.item.paymentReference && (
                      <div className="flex justify-between gap-3"><span className="text-slate-400 font-bold shrink-0">Payment ref</span><span className="text-slate-600 text-right break-all">{first.item.paymentReference}</span></div>
                    )}
                  </div>
                )}

                <div className="border-t border-dashed border-slate-300 mt-3 pt-3">
                  <div className="flex text-[9px] font-black uppercase text-slate-400 tracking-widest pb-2">
                    <span className="flex-1">Description</span>
                    <span className="w-8 text-center shrink-0">Qty</span>
                    <span className="w-16 text-right shrink-0">Amount</span>
                  </div>
                  <div className="space-y-4">
                    {receiptGroups.map(og => (
                      <div key={og.order.id}>
                        {receiptGroups.length > 1 && (
                          <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1.5">Order {og.order.id}</p>
                        )}
                        <div className="space-y-3">
                          {og.services.map(sg => (
                            <div key={sg.service}>
                              {og.services.length > 1 && (
                                <p className="text-[9px] font-black uppercase text-accent tracking-widest mb-1.5">{sg.service === 'Dinner' ? '🌙 Dinner' : '☀️ Lunch'}</p>
                              )}
                              <div className="space-y-3">
                                {sg.days.flatMap(d => d.items).map((line, i) => {
                                  const { detail, person } = splitNotesTag(line.item.notes);
                                  return (
                                    <div key={i} className={i > 0 ? 'pt-3 border-t border-[#F0EADD]' : ''}>
                                      <div className="flex items-start gap-2">
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-bold text-slate-800">{line.item.deliveryDay} · {line.item.name}</p>
                                          {detail && <p className="text-[11px] text-slate-400 mt-0.5">{detail}</p>}
                                        </div>
                                        <span className="w-8 text-center text-xs text-slate-600 shrink-0">{line.item.qty}</span>
                                        <span className="w-16 text-right text-xs font-black text-slate-900 shrink-0">Rs {line.item.price}</span>
                                      </div>
                                      {((!!line.seq && line.seq > 0) || person) && (
                                        <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                                          {!!line.seq && line.seq > 0 && <span className="px-1.5 py-0.5 rounded bg-accent/10 text-accent text-[9px] font-black uppercase">Extra {line.seq + 1}</span>}
                                          {person && <PersonTag name={person} />}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-dashed border-slate-300 mt-3 pt-3 space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-500 font-bold"><span>Subtotal</span><span>Rs {displaySubtotal.toFixed(2)}</span></div>
                  {displayDiscount > 0 && (
                    <div className="flex justify-between text-xs text-primary font-bold">
                      <span>Discount{displayDiscountReason ? ` (${displayDiscountReason})` : ''}</span>
                      <span>-Rs {displayDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  {(vatOn || displayVat > 0) && (
                    <div className="flex justify-between text-xs text-slate-500 font-bold"><span>VAT ({vatRate}%)</span><span>Rs {displayVat.toFixed(2)}</span></div>
                  )}
                  <div className="flex justify-between items-baseline pt-1.5 border-t border-[#E7E0D0]">
                    <span className="text-xs font-black uppercase text-slate-400 tracking-widest">Total paid</span>
                    <span className="text-lg font-black text-success">Rs {displayTotal.toFixed(0)}</span>
                  </div>
                </div>

                <p className="text-center text-[10px] text-slate-400 mt-5">Thank you for ordering with {SYSTEM_CONFIG.businessName} 🌿</p>

                <div className="bmz-no-print flex gap-2 mt-5">
                  <button onClick={() => setReceiptTarget(null)} className="flex-1 py-2.5 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest">Close</button>
                  <button onClick={() => window.print()} className="flex-1 py-2.5 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5">
                    <Printer className="size-3.5" /> Print / Save PDF
                  </button>
                </div>
              </div>
            </div>
            </div>
          </div>
        );
      })()}

      {/* --- TOAST --- */}
      {toastMsg && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[10000] bg-slate-900 text-white px-5 py-3 rounded-2xl text-xs font-bold shadow-2xl max-w-[90vw] text-center">
          {toastMsg}
        </div>
      )}
    </div>
  );
};

// A small pill for "who this meal is for" — used everywhere a note shows up
// (draft cart, Menu tab, My Order, Home) so it reads as a tag, not prose.
const PersonTag: React.FC<{ name: string }> = ({ name }) => (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/10 text-accent text-[10px] font-bold shrink-0">
    <UserIcon className="size-2.5" /> {name}
  </span>
);

const InstructionsTag: React.FC<{ text: string }> = ({ text }) => (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/10 text-[#B4703A] border border-warning/10 text-[10px] font-black uppercase tracking-wide shrink-0">
    🍳 {text}
  </span>
);

// A small uniform badge for payment/order status — keeps the "one line of
// tags" (extra / payment / status / person) actually the same shape and
// size, rather than four differently-styled inline spans.
const StatusBadge: React.FC<{ label: string; tone: 'success' | 'warning' | 'danger' | 'slate' }> = ({ label, tone }) => {
  const cls = tone === 'success' ? 'bg-success/10 text-success' : tone === 'warning' ? 'bg-warning/10 text-warning' : tone === 'danger' ? 'bg-danger/10 text-danger' : 'bg-slate-100 text-slate-500';
  return <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase shrink-0 ${cls}`}>{label}</span>;
};

const SectionCard: React.FC<{
  index: number;
  title: string;
  isOpen: boolean;
  isComplete: boolean;
  summary?: React.ReactNode;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ index, title, isOpen, isComplete, summary, onToggle, children }) => (
  <div className="rounded-2xl border border-[#E7E0D0] bg-white overflow-hidden">
    <button onClick={onToggle} className="w-full flex items-center justify-between gap-3 p-4 text-left">
      <div className="flex items-center gap-3 min-w-0">
        <span className={`size-7 rounded-full text-xs font-black flex items-center justify-center shrink-0 ${isComplete ? 'bg-primary text-white' : 'bg-slate-100 text-slate-400'}`}>
          {isComplete && !isOpen ? <Check className="size-3.5" /> : index}
        </span>
        <span className="text-sm font-black text-slate-900 truncate">{title}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {!isOpen && summary && <div className="flex items-center gap-1 flex-wrap justify-end max-w-[170px]">{summary}</div>}
        {isOpen ? <ChevronUp className="size-4 text-slate-400" /> : <ChevronDown className="size-4 text-slate-400" />}
      </div>
    </button>
    {isOpen && <div className="px-4 pb-4 pt-4 border-t border-[#F0EADD]">{children}</div>}
  </div>
);

const ChipRow: React.FC<{
  label: string;
  options: { id: string; emoji: string; name: string; price?: number }[];
  selected: string;
  onSelect: (id: string) => void;
  noneLabel: string;
  showPrice?: boolean;
}> = ({ label, options, selected, onSelect, noneLabel, showPrice }) => (
  <div className="rounded-2xl border border-[#E7E0D0] bg-[#FBF8F1] p-4">
    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">{label}</p>
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <button
          key={o.id}
          onClick={() => onSelect(o.id)}
          className={`px-3 py-2 rounded-full text-xs font-bold border-2 transition-all ${selected === o.id ? 'border-primary bg-primary/10 text-primary' : 'border-transparent bg-[#F4EFE4] text-slate-600'}`}
        >
          {o.emoji} {o.name}{showPrice && o.price ? ` +Rs ${o.price}` : ''}
        </button>
      ))}
      <button
        onClick={() => onSelect('none')}
        className={`px-3 py-2 rounded-full text-xs font-bold border-2 transition-all ${selected === 'none' ? 'border-primary bg-primary/10 text-primary' : 'border-transparent bg-[#F4EFE4] text-slate-400'}`}
      >
        {noneLabel}
      </button>
    </div>
  </div>
);

export default CustomerPortal;
