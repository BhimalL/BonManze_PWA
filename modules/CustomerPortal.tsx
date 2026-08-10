
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
  Check
} from 'lucide-react';
import { Customer, Order, OrderItem, PaymentMethod } from '../types';
import {
  WEEKDAY_KEYS,
  WeekdayKey,
  WEEKLY_CURRY_MENU,
  MEAL_BASES,
  MEAL_DHALS,
  MEAL_SALADS,
  MEAL_BEVERAGES,
  MEAL_DESSERTS,
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
  MOCK_TODAY,
  addOrder,
  cancelOrderItem,
  editOrderItem,
  submitPaymentClaim,
  MEAL_PLAN_PAYMENT_METHOD_NAMES,
  formatCurrency,
  calculateTotal
} from './store';

// Same-day edits/cancels lock at 9:00 AM, same rule the original HTML
// prototype used ("the 9:00 AM cutoff has passed") — after that the kitchen
// has already started on the meal. Past delivery days are always locked;
// future ones are always open. Uses real wall-clock time for the hour check
// since the app's simulated "today" (systemDate) only ever moves in whole
// days.
const isPastCutoff = (deliveryDate: string, systemDate: string): boolean => {
  if (!deliveryDate) return false;
  if (deliveryDate < systemDate) return true;
  if (deliveryDate > systemDate) return false;
  return new Date().getHours() >= 9;
};

interface MealSelection {
  curryId: string;
  baseId: string;
  dhalId: string;      // '' = not chosen yet, 'none' = explicitly skipped
  saladId: string;
  beverageId: string;
  dessertId: string;
  note: string;
}

const emptySelection = (curryId: string): MealSelection => ({
  curryId, baseId: '', dhalId: '', saladId: '', beverageId: 'none', dessertId: 'none', note: ''
});

interface WeekDay { key: WeekdayKey; date: string; label: string; short: string; }

const getThisWeekDays = (systemDateStr: string): WeekDay[] => {
  const [y, m, d] = systemDateStr.split('-').map(Number);
  const base = new Date(y, (m || 1) - 1, d || 1);
  const dow = base.getDay();
  const diffToMonday = dow === 0 ? 1 : (1 - dow);
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

const mealPrice = (m: MealSelection, weekdayKey: WeekdayKey): number => {
  const c = WEEKLY_CURRY_MENU[weekdayKey].find(x => x.id === m.curryId);
  const b = MEAL_BASES.find(x => x.id === m.baseId);
  const v = m.beverageId !== 'none' ? MEAL_BEVERAGES.find(x => x.id === m.beverageId) : null;
  const d = m.dessertId !== 'none' ? MEAL_DESSERTS.find(x => x.id === m.dessertId) : null;
  return (c?.price || 0) + (b?.up || 0) + (v?.price || 0) + (d?.price || 0);
};

const mealSummaryLabel = (m: MealSelection, weekdayKey: WeekdayKey): string => {
  const c = WEEKLY_CURRY_MENU[weekdayKey].find(x => x.id === m.curryId);
  const b = MEAL_BASES.find(x => x.id === m.baseId);
  return `${c?.emoji || ''} ${c?.name || ''}${b ? ` · ${b.name}` : ''}`;
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
  if (m.note.trim()) parts.push(`for ${m.note.trim()}`);
  return parts.join(' · ');
};

// Same as mealNotesLine but without the base (already shown alongside the
// curry in mealSummaryLabel) and without the "for X" note — the note gets
// its own pill tag (PersonTag) wherever this is used, rather than being
// buried in a wall of text.
const mealExtrasLabel = (m: MealSelection): string => {
  const parts: string[] = [];
  const dh = m.dhalId !== 'none' ? MEAL_DHALS.find(x => x.id === m.dhalId) : null;
  if (dh) parts.push(dh.name);
  const sl = m.saladId !== 'none' ? MEAL_SALADS.find(x => x.id === m.saladId) : null;
  if (sl) parts.push(sl.name);
  const bv = m.beverageId !== 'none' ? MEAL_BEVERAGES.find(x => x.id === m.beverageId) : null;
  if (bv) parts.push(bv.name);
  const ds = m.dessertId !== 'none' ? MEAL_DESSERTS.find(x => x.id === m.dessertId) : null;
  if (ds) parts.push(ds.name);
  return parts.join(' · ');
};

// Once a meal becomes a confirmed OrderItem, the "for X" note only survives
// as the trailing segment of the flattened `notes` string (mealNotesLine
// above) — OrderItem has no separate field for it. This pulls that segment
// back out so it can render as its own tag instead of buried in prose.
const splitNotesTag = (notes?: string): { detail: string; person: string | null } => {
  if (!notes) return { detail: '', person: null };
  const segments = notes.split(' · ');
  const last = segments[segments.length - 1];
  if (last && last.startsWith('for ')) {
    return { detail: segments.slice(0, -1).join(' · '), person: last.slice(4) };
  }
  return { detail: notes, person: null };
};

// A confirmed OrderItem only stores its curry id (itemId) plus a flattened
// text description — there's no structured base/dhal/salad/beverage/dessert
// field to edit directly (OrderItem was never extended to carry one). This
// rebuilds a MealSelection good enough to reopen in the builder by matching
// each name in the notes back against the known option lists — reliable as
// long as those names stay unique across categories, which they are today.
const reconstructSelection = (item: OrderItem): MealSelection => {
  const { detail, person } = splitNotesTag(item.notes);
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
    note: person || ''
  };
};

const isPayNowMethod = (name: string) => name.includes('Juice');

// Three payment states, not two: the customer telling the app how they'll
// pay (paymentMethodName set) is a claim, not a confirmed receipt — only
// Operations confirming it (via the Operator Console) sets paymentStatus to
// 'Paid'. "Unclaimed" is the only state that still needs the customer to
// act; "awaiting" just needs Operations to check their bank/wallet statement.
const isUnclaimed = (item: OrderItem) => item.paymentStatus !== 'Paid' && !item.paymentMethodName;
const isAwaitingConfirmation = (item: OrderItem) => item.paymentStatus !== 'Paid' && !!item.paymentMethodName;
const paymentStatusInfo = (item: OrderItem): { label: string; tone: 'success' | 'warning' | 'danger' } => {
  if (item.paymentStatus === 'Refunded') return { label: 'Refunded', tone: 'warning' };
  if (item.paymentStatus === 'Paid') return { label: 'Paid', tone: 'success' };
  if (item.paymentMethodName) return { label: 'Awaiting confirmation', tone: 'warning' };
  return { label: 'Unpaid', tone: 'danger' };
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
  const [view, setView] = useState<'home' | 'menu' | 'order' | 'profile'>('home');
  const [cart, setCart] = useState<Record<string, MealSelection[]>>({});
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Home's "How BonManzE works" card starts collapsed — repeat customers
  // don't need a permanent 4-line explainer taking up a full card every
  // time they open the app, but first-timers can still tap it open.
  const [guideOpen, setGuideOpen] = useState(false);

  const [builder, setBuilder] = useState<{
    day: WeekDay; openSection: 1 | 2 | 3; sel: MealSelection; editIndex: number | null;
    // Set only when editing an already-confirmed meal (as opposed to a
    // draft-cart one, which uses editIndex) — commitBuilder branches on this.
    editingConfirmed: { orderId: string; date: string; slot: string } | null;
  } | null>(null);

  const [payTarget, setPayTarget] = useState<{
    kind: 'item'; orderId: string; date: string; slot: string; amount: number; what: string; ref: string;
  } | { kind: 'balance'; items: { orderId: string; date: string; slot: string; amount: number }[]; amount: number; what: string; ref: string; } | null>(null);
  const [payMethod, setPayMethod] = useState<PaymentMethod | null>(null);
  // The customer's own transaction reference (from their Juice/MauCAS app),
  // entered on top of the reference we generate — both get stored so
  // Operations has whatever's most useful for matching against a statement.
  const [customerRef, setCustomerRef] = useState('');

  const [ratings, setRatings] = useState<Record<string, { stars: number; comment: string }>>({});
  const [rateTarget, setRateTarget] = useState<{ orderId: string; itemId: string; label: string } | null>(null);
  const [rateStars, setRateStars] = useState(0);

  useEffect(() => {
    const u1 = subscribeToLoyaltyTiers(setLoyaltyTiers);
    const u2 = subscribeToCustomerGroups(setCustomerGroups);
    const u3 = subscribeToCustomers(setCustomers);
    const u4 = subscribeToPaymentMethods(setPaymentMethods);
    const u5 = subscribeToOrders(setOrders);
    const u6 = subscribeToSystemDate(setSystemDate);
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); };
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 3000);
    return () => clearTimeout(t);
  }, [toastMsg]);

  // Keeps the logged-in customer's own record (points, storeCredit, etc.)
  // in sync with the shared customers store whenever it changes — e.g. a
  // cancelled paid meal adds store credit via updateCustomerRecord, and
  // without this, Home/Profile would keep showing the pre-refund balance
  // until the customer logged out and back in.
  useEffect(() => {
    if (!currentUser) return;
    const updated = customers.find(c => c.id === currentUser.id);
    if (updated && JSON.stringify(updated) !== JSON.stringify(currentUser)) {
      setCurrentUser(updated);
    }
  }, [customers, currentUser]);

  const toast = (msg: string) => setToastMsg(msg);

  const weekDays = useMemo(() => getThisWeekDays(systemDate), [systemDate]);

  const culturePhrase = useMemo(() => CREOLE_PHRASES[new Date().getDate() % CREOLE_PHRASES.length], []);

  // --- CART / BUILDER ---
  const openBuilder = (day: WeekDay, presetCurryId?: string, editIndex: number | null = null) => {
    const existing = editIndex !== null ? cart[day.date]?.[editIndex] : null;
    setBuilder({
      day,
      openSection: 1,
      editIndex,
      editingConfirmed: null,
      sel: existing ? { ...existing } : emptySelection(presetCurryId || WEEKLY_CURRY_MENU[day.key][0].id)
    });
  };

  // Editing an already-confirmed meal, gated by the same cutoff that gates
  // Cancel — the button that calls this is only shown once that check
  // passes, but this guards directly too in case anything calls it earlier.
  const openEditConfirmed = (line: Line) => {
    if (isPastCutoff(line.item.deliveryDate || '', systemDate)) {
      toast('Locked — the 9:00 AM cutoff has passed');
      return;
    }
    const day = weekDays.find(d => d.date === line.item.deliveryDate);
    if (!day) return;
    setBuilder({
      day,
      openSection: 1,
      editIndex: null,
      editingConfirmed: { orderId: line.order.id, date: line.item.deliveryDate || '', slot: line.item.serviceSlot || 'Lunch' },
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
  const selectCurry = (id: string) => setBuilder(b => b ? { ...b, sel: { ...b.sel, curryId: id }, openSection: 2 } : b);
  const selectBase = (id: string) => setBuilder(b => b ? { ...b, sel: { ...b.sel, baseId: id }, openSection: 3 } : b);
  const toggleSection = (n: 1 | 2 | 3) => setBuilder(b => b ? { ...b, openSection: n } : b);

  const sectionComplete = (b: NonNullable<typeof builder>) => ({
    1: !!b.sel.curryId,
    2: !!b.sel.baseId,
    3: b.sel.dhalId !== '' && b.sel.saladId !== ''
  });
  const builderReady = (b: NonNullable<typeof builder>) => {
    const c = sectionComplete(b);
    return c[1] && c[2] && c[3];
  };

  const commitBuilder = () => {
    if (!builder) return;
    const { day, sel, editIndex, editingConfirmed } = builder;

    if (editingConfirmed) {
      const c = WEEKLY_CURRY_MENU[day.key].find(x => x.id === sel.curryId);
      editOrderItem(editingConfirmed.orderId, editingConfirmed.date, editingConfirmed.slot, {
        itemId: sel.curryId,
        name: `${c?.emoji || ''} ${c?.name || 'Meal'}`,
        price: mealPrice(sel, day.key),
        notes: mealNotesLine(sel)
      });
      toast('Meal updated');
      closeBuilder();
      return;
    }

    setCart(prev => {
      const dayList = [...(prev[day.date] || [])];
      if (editIndex !== null) dayList[editIndex] = sel;
      else dayList.push(sel);
      return { ...prev, [day.date]: dayList };
    });
    toast(editIndex !== null ? 'Meal updated' : `${day.label} added · Rs ${mealPrice(sel, day.key)}`);
    closeBuilder();
  };

  const removeCartMeal = (dateKey: string, index: number) => {
    setCart(prev => {
      const dayList = [...(prev[dateKey] || [])];
      dayList.splice(index, 1);
      return { ...prev, [dateKey]: dayList };
    });
  };

  const cartCount = useMemo(
    () => Object.values(cart).reduce((t: number, list) => t + (list as MealSelection[]).length, 0),
    [cart]
  );

  // --- DISCOUNT / TOTALS (reuses the app's real loyalty tier + group +
  // bulk-plan discount math, just adapted from a generic cart to the
  // day -> meals structure used here) ---
  const cartTotals = useMemo(() => {
    if (!currentUser) return { subtotal: 0, discount: 0, standardDiscount: 0, birthdayDiscount: 0, standardLabel: '', bulkDiscount: 0, vat: 0, total: 0 };

    const flat: { date: string; weekday: WeekdayKey; price: number }[] = [];
    weekDays.forEach(d => {
      (cart[d.date] || []).forEach(m => flat.push({ date: d.date, weekday: d.key, price: mealPrice(m, d.key) }));
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

    let bulkDiscount = 0;
    if (SYSTEM_CONFIG.bulkDiscountEnabled) {
      const coveredDays = weekDays.filter(d => (cart[d.date] || []).length > 0).length;
      if (coveredDays >= WEEKDAY_KEYS.length) bulkDiscount = subtotal * (SYSTEM_CONFIG.bulkDiscountRate / 100);
    }

    const totalDiscount = standardDiscount + birthdayDiscount + bulkDiscount;
    const netTotal = Math.max(0, subtotal - totalDiscount);
    const vatRate = SYSTEM_CONFIG.vatEnabled ? SYSTEM_CONFIG.vatRate / 100 : 0;
    const vat = netTotal * vatRate;
    const total = netTotal + vat;

    return { subtotal, discount: totalDiscount, standardDiscount, birthdayDiscount, standardLabel, bulkDiscount, vat, total };
  }, [cart, currentUser, loyaltyTiers, customerGroups, weekDays]);

  const handleCheckout = () => {
    if (!currentUser || cartCount === 0) return;
    const items: OrderItem[] = [];
    weekDays.forEach(d => {
      (cart[d.date] || []).forEach((m, idx) => {
        const c = WEEKLY_CURRY_MENU[d.key].find(x => x.id === m.curryId);
        items.push({
          itemId: m.curryId,
          name: `${c?.emoji || ''} ${c?.name || 'Meal'}`,
          qty: 1,
          price: mealPrice(m, d.key),
          notes: mealNotesLine(m),
          deliveryDate: d.date,
          deliveryDay: d.label,
          serviceSlot: idx === 0 ? 'Lunch' : `Lunch-${idx + 1}`,
          paymentStatus: 'Pending',
          status: 'Active'
        });
      });
    });
    if (!items.length) return;
    const newOrder: Order = {
      id: `BMZ-${Date.now().toString(36).toUpperCase()}`,
      customerName: currentUser.name,
      type: 'Meal Plan',
      status: 'Pending',
      paymentStatus: 'Pending',
      paymentScheme: 'Per-Delivery',
      items,
      total: cartTotals.total,
      timestamp: new Date().toISOString(),
      isReconciled: false,
      discount: cartTotals.discount
    };
    addOrder(newOrder);
    setCart({});
    setView('order');
    toast(`Order confirmed · ${items.length} meal${items.length !== 1 ? 's' : ''} · ${formatCurrency(cartTotals.total)} outstanding`);
  };

  // --- MY ORDER (this week's confirmed meals) ---
  const myOrders = useMemo(
    () => orders.filter(o => o.customerName === currentUser?.name && o.type === 'Meal Plan'),
    [orders, currentUser]
  );

  const weekDateKeys = useMemo(() => new Set(weekDays.map(d => d.date)), [weekDays]);

  interface Line { order: Order; item: OrderItem; }
  const thisWeekLines: Line[] = useMemo(() => {
    const out: Line[] = [];
    myOrders.forEach(o => o.items.forEach(item => {
      if (item.status === 'Cancelled') return;
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
  const weekOrders = useMemo(() => {
    const map = new Map<string, { order: Order; lines: typeof thisWeekLinesWithSeq }>();
    thisWeekLinesWithSeq.forEach(l => {
      if (!map.has(l.order.id)) map.set(l.order.id, { order: l.order, lines: [] });
      map.get(l.order.id)!.lines.push(l);
    });
    return Array.from(map.values()).sort((a, b) => a.order.timestamp.localeCompare(b.order.timestamp));
  }, [thisWeekLinesWithSeq]);

  const pastLines: Line[] = useMemo(() => {
    const out: Line[] = [];
    myOrders.forEach(o => o.items.forEach(item => {
      if (item.status === 'Cancelled') return;
      if (item.deliveryDate && !weekDateKeys.has(item.deliveryDate) && item.deliveryDate < systemDate) out.push({ order: o, item });
    }));
    return out.sort((a, b) => (b.item.deliveryDate || '').localeCompare(a.item.deliveryDate || ''));
  }, [myOrders, weekDateKeys, systemDate]);

  // "Outstanding" now means "still needs the customer to pick a payment
  // method" — once they've claimed one, it moves to awaitingConfirmation
  // below (still unpaid, but nothing left for the customer to do).
  const outstandingTotal = useMemo(
    () => thisWeekLines.filter(l => isUnclaimed(l.item)).reduce((t, l) => t + l.item.qty * l.item.price, 0),
    [thisWeekLines]
  );

  const awaitingConfirmationLines = useMemo(
    () => thisWeekLines.filter(l => isAwaitingConfirmation(l.item)),
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
    setPayTarget({
      kind: 'item',
      orderId: line.order.id,
      date: line.item.deliveryDate || '',
      slot: line.item.serviceSlot || 'Lunch',
      amount: line.item.qty * line.item.price,
      what: `${line.item.deliveryDay || ''} · ${line.item.name}`,
      ref: generateRef()
    });
  };

  const openPayBalance = () => {
    const pending = thisWeekLines.filter(l => isUnclaimed(l.item));
    if (!pending.length) return;
    setPayMethod(null);
    setCustomerRef('');
    setPayTarget({
      kind: 'balance',
      items: pending.map(l => ({ orderId: l.order.id, date: l.item.deliveryDate || '', slot: l.item.serviceSlot || 'Lunch', amount: l.item.qty * l.item.price })),
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
    setPayTarget({
      kind: 'balance',
      items: pending.map(l => ({ orderId: l.order.id, date: l.item.deliveryDate || '', slot: l.item.serviceSlot || 'Lunch', amount: l.item.qty * l.item.price })),
      amount: pending.reduce((t, l) => t + l.item.qty * l.item.price, 0),
      what: `${pending.length} unpaid meal${pending.length !== 1 ? 's' : ''} · this order`,
      ref: generateRef()
    });
  };

  // Choosing a method here only records a claim — it never marks anything
  // Paid. Only Operations confirming a payment (Operator Console) does that.
  const commitPayment = () => {
    if (!payTarget || !payMethod) return;
    const finalRef = customerRef.trim() ? `${payTarget.ref} · their ref: ${customerRef.trim()}` : payTarget.ref;
    if (payTarget.kind === 'item') {
      submitPaymentClaim(payTarget.orderId, payTarget.date, payTarget.slot, payMethod.name, finalRef);
    } else {
      payTarget.items.forEach(i => submitPaymentClaim(i.orderId, i.date, i.slot, payMethod.name, finalRef));
    }
    toast(`${payMethod.name} selected · awaiting confirmation`);
    setPayTarget(null);
    setPayMethod(null);
    setCustomerRef('');
  };

  const handleCancel = (line: Line) => {
    const isPaid = line.item.paymentStatus === 'Paid';
    const refundAmt = isPaid ? calculateTotal(line.item.price * line.item.qty) : 0;
    cancelOrderItem(line.order.id, line.item.deliveryDate || '', line.item.serviceSlot || 'Lunch', line.item.itemId);
    toast(isPaid ? `Meal cancelled · Rs ${refundAmt.toFixed(0)} credit added` : 'Meal cancelled');
  };

  const openRating = (line: Line) => {
    setRateTarget({ orderId: line.order.id, itemId: `${line.order.id}-${line.item.itemId}-${line.item.deliveryDate}`, label: `${line.item.deliveryDay} · ${line.item.name}` });
    setRateStars(0);
  };
  const submitRating = () => {
    if (!rateTarget || !rateStars) return;
    setRatings(prev => ({ ...prev, [rateTarget.itemId]: { stars: rateStars, comment: '' } }));
    toast(`Thanks! ${rateStars}★ sent to the kitchen`);
    setRateTarget(null);
  };

  // --- HOME: one status card that always tells you the single most useful
  // next thing, plus a week-at-a-glance emoji strip — mirrors the original
  // prototype's home status card / attention logic, adapted to what our
  // OrderItem model actually tracks (no separate "delivered, unconfirmed"
  // state — Mark Delivered in the Operator Console goes straight to
  // Completed, so there's nothing to confirm receipt of here).
  const needsRating = useMemo(
    () => thisWeekLinesWithSeq.find(l => l.item.status === 'Completed' && l.item.paymentStatus === 'Paid' && !ratings[`${l.order.id}-${l.item.itemId}-${l.item.deliveryDate}`]),
    [thisWeekLinesWithSeq, ratings]
  );

  const homeStatus = useMemo(() => {
    if (cartCount === 0 && thisWeekLinesWithSeq.length === 0) {
      return { icon: '🍽️', tone: 'bg-slate-100', title: "This week's menu is ready", subtitle: 'Order by Sunday noon · Lunch Mon–Fri', ctaLabel: 'Browse the menu', action: () => setView('menu') };
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
  }, [cartCount, thisWeekLinesWithSeq, outstandingTotal, awaitingConfirmationLines, needsRating, cartTotals]);

  // Meals still 'Active' (not yet delivered, not cancelled) landing today —
  // drives Home's hero: if lunch is actually en route today, that's more
  // useful up top than a generic greeting.
  const todaysArrivingLines = useMemo(
    () => thisWeekLinesWithSeq.filter(l => l.item.deliveryDate === systemDate && l.item.status === 'Active'),
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

  // One representative dish per weekday for Home's photo strip — real
  // dish photography instead of a text-only menu, so the app's front page
  // actually looks like food. Picking [0] of each day's curry list rather
  // than flattening every option keeps the strip at 5 cards, not 15.
  const weekMenuPreview = useMemo(
    () => weekDays.map(d => ({ day: d, primary: WEEKLY_CURRY_MENU[d.key][0], moreCount: WEEKLY_CURRY_MENU[d.key].length - 1 })),
    [weekDays]
  );

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

  // --- LOGIN ---
  if (!currentUser) {
    return (
      <div className="h-full w-full overflow-y-auto bg-[#FDFAF4] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          {onLogout && (
            <button onClick={onLogout} className="absolute top-6 left-6 p-2 rounded-xl text-slate-400 hover:bg-white/60">
              <ArrowLeft className="size-5" />
            </button>
          )}
          <div className="size-16 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/20 mx-auto mb-5">
            <Sparkles className="size-8" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-1">BonManzE</h1>
          <p className="text-slate-500 font-medium mb-1">Homemade. Delivered fresh.</p>
          <p className="text-xs text-primary font-bold italic mb-8">"{culturePhrase.cr}" — {culturePhrase.en}</p>

          <div className="space-y-3">
            {customers.map(c => (
              <button
                key={c.id}
                onClick={() => setCurrentUser(c)}
                className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-primary/40 transition-all text-left"
              >
                <img src={c.avatar} alt={c.name} className="size-11 rounded-full border-2 border-slate-100" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 truncate">{c.name}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{c.tier || 'Member'}</p>
                </div>
                <ChevronRight className="size-4 text-slate-300" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const tierObj = loyaltyTiers.find(t => t.name.toLowerCase() === currentUser.tier?.toLowerCase());
  const referralCode = currentUser.referenceCode || 'BONMANZE-' + currentUser.id.toUpperCase();
  const copyReferral = () => navigator.clipboard?.writeText(referralCode).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });

  return (
    <div className="h-full w-full flex flex-col bg-[#FDFAF4] relative">
      <header className="shrink-0 bg-white/90 backdrop-blur-md border-b border-[#E7E0D0] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-9 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-900 leading-none">BonManzE</h1>
            <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold mt-0.5">Homemade · Delivered fresh</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <img src={currentUser.avatar} className="size-8 rounded-full border-2 border-primary/20" alt={currentUser.name} />
          {onLogout && (
            <button onClick={onLogout} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-900">
              <ArrowLeft className="size-4" />
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 pb-24">
        {view === 'home' && (
          <div className="space-y-6">
            {/* Welcome hero — the customer's own name/avatar/tier is the first thing on the
                page, not a generic banner; today's delivery (if any) folds in underneath
                as a highlight rather than displacing the personal welcome entirely. */}
            <div className="bg-primary rounded-[28px] p-6 text-white shadow-lg shadow-primary/20 relative overflow-hidden">
              <button onClick={() => setView('profile')} className="absolute top-5 right-5 text-[10px] font-black uppercase tracking-widest text-white/70 hover:text-white">Profile →</button>
              <div className="flex items-center gap-4">
                <img src={currentUser.avatar} className="size-16 rounded-full border-2 border-white/30 shrink-0" alt={currentUser.name} />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Welcome back</p>
                  <p className="text-xl font-black leading-tight truncate">{currentUser.firstName}!</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {currentUser.tier && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15 text-[10px] font-black uppercase shrink-0">
                        <Star className="size-2.5" /> {currentUser.tier} Member
                      </span>
                    )}
                    {!!currentUser.storeCredit && currentUser.storeCredit > 0 && (
                      <span className="text-[10px] font-black text-white/90 shrink-0">{formatCurrency(currentUser.storeCredit)} credit</span>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-sm font-black italic leading-snug mt-4">"{culturePhrase.cr}"</p>
              <p className="text-xs opacity-80 mt-1">{culturePhrase.en}</p>
              {todaysArrivingLines.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/15 flex items-center gap-3">
                  <img src={dishPhotoFor(todaysArrivingLines[0].item.itemId)} className="size-11 rounded-xl object-cover shrink-0 border-2 border-white/25" alt={todaysArrivingLines[0].item.name} />
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-70">Arriving today · 11:30–12:00</p>
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

            {/* Real dish photography — a scrollable strip instead of a text-only menu */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-black text-slate-900">This week's curries</h2>
                <button onClick={() => setView('menu')} className="text-[11px] font-black uppercase tracking-widest text-primary">See all →</button>
              </div>
              <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-1 -mx-6 px-6 snap-x">
                {weekMenuPreview.map(({ day: d, primary, moreCount }) => (
                  <button key={d.key} onClick={() => openBuilder(d)} className="shrink-0 w-36 rounded-2xl overflow-hidden bg-white border border-[#E7E0D0] text-left snap-start">
                    <div className="relative h-24">
                      <img src={dishPhotoFor(primary.id)} className="w-full h-full object-cover" alt={primary.name} />
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-white/90 text-[9px] font-black uppercase text-slate-700">{d.short}</span>
                    </div>
                    <div className="p-3">
                      <p className="text-xs font-bold text-slate-900 truncate">{primary.emoji} {primary.name}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[11px] font-black text-primary">Rs {primary.price}</span>
                        {moreCount > 0 && <span className="text-[9px] font-bold text-slate-400 shrink-0">+{moreCount} more</span>}
                      </div>
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
                    <p className="text-[10px] text-slate-400 font-bold truncate">This week's curries</p>
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

            {/* Guide — collapsed by default; repeat customers don't need this every visit */}
            <div className="bg-[#F4EFE4] rounded-2xl overflow-hidden">
              <button onClick={() => setGuideOpen(o => !o)} className="w-full flex items-center justify-between gap-3 p-4 text-left">
                <div className="flex items-center gap-2">
                  <Clock className="size-3.5 text-slate-500" />
                  <p className="text-[11px] font-black text-slate-600">New here? How BonManzE works</p>
                </div>
                {guideOpen ? <ChevronUp className="size-4 text-slate-400 shrink-0" /> : <ChevronDown className="size-4 text-slate-400 shrink-0" />}
              </button>
              {guideOpen && (
                <div className="px-4 pb-4 pt-3 border-t border-[#E7E0D0] space-y-1.5 text-xs text-slate-600 font-medium">
                  <p>1. Browse this week's curries and build your meal</p>
                  <p>2. Confirm your order by Sunday noon</p>
                  <p>3. Pay by Juice, MauCAS, or cash on delivery</p>
                  <p>4. Lunch arrives Mon–Fri, 11:30–12:00</p>
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'menu' && (
          <div className="space-y-5">
            <h2 className="text-lg font-black text-slate-900">This week's menu</h2>
            {weekDays.map(d => {
              const meals = cart[d.date] || [];
              return (
                <div key={d.key} className="bg-white rounded-3xl border border-[#E7E0D0] p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-black text-slate-900">{d.label}</p>
                    {meals.length > 0 && (
                      <button onClick={() => openBuilder(d)} className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1">
                        <Plus className="size-3" /> Add another
                      </button>
                    )}
                  </div>
                  <div className="space-y-2 mb-3">
                    {WEEKLY_CURRY_MENU[d.key].map(c => (
                      <button
                        key={c.id}
                        onClick={() => openBuilder(d, c.id)}
                        className="w-full flex items-center gap-3 p-3 bg-[#F4EFE4] rounded-2xl hover:bg-primary/10 transition-all text-left"
                      >
                        <img src={dishPhotoFor(c.id)} className="size-11 rounded-xl object-cover shrink-0" alt={c.name} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-900">{c.emoji} {c.name}</p>
                          <p className="text-[11px] text-slate-500">{c.desc}</p>
                        </div>
                        <span className="text-xs font-black text-primary shrink-0">Rs {c.price}</span>
                      </button>
                    ))}
                  </div>
                  {meals.length > 0 && (
                    <div className="space-y-1.5 pt-3 border-t border-[#E7E0D0]">
                      {meals.map((m, i) => (
                        <div key={i} className="flex items-start justify-between gap-2 text-xs">
                          <div className="min-w-0">
                            <span className="font-bold text-slate-700 block">{mealSummaryLabel(m, d.key)}</span>
                            {mealExtrasLabel(m) && <span className="text-[11px] text-slate-400 block">{mealExtrasLabel(m)}</span>}
                            {m.note.trim() && <div className="mt-1"><PersonTag name={m.note.trim()} /></div>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-black text-primary">Rs {mealPrice(m, d.key)}</span>
                            <button onClick={() => openBuilder(d, undefined, i)} className="p-1.5 text-slate-400 hover:text-primary"><Edit3 className="size-3.5" /></button>
                            <button onClick={() => removeCartMeal(d.date, i)} className="p-1.5 text-slate-400 hover:text-danger"><Trash2 className="size-3.5" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {view === 'order' && (
          <div className="space-y-6">
            <h2 className="text-lg font-black text-slate-900">My Order</h2>

            {cartCount > 0 && (
              <div className="bg-white rounded-3xl border border-[#E7E0D0] p-5">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Draft — not yet confirmed</p>
                <div className="space-y-3 mb-4">
                  {weekDays.map(d => (cart[d.date] || []).map((m, i) => (
                    <div key={`${d.key}-${i}`} className="flex items-start justify-between gap-2 pb-3 border-b border-[#F0EADD] last:border-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-700">{d.short} · {mealSummaryLabel(m, d.key)}</p>
                        {mealExtrasLabel(m) && <p className="text-[11px] text-slate-400 mt-0.5">{mealExtrasLabel(m)}</p>}
                        {m.note.trim() && <div className="mt-1"><PersonTag name={m.note.trim()} /></div>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-black text-slate-900 text-xs">Rs {mealPrice(m, d.key)}</span>
                        <button onClick={() => openBuilder(d, undefined, i)} className="p-1.5 text-slate-400 hover:text-primary"><Edit3 className="size-3.5" /></button>
                        <button onClick={() => removeCartMeal(d.date, i)} className="p-1.5 text-slate-400 hover:text-danger"><Trash2 className="size-3.5" /></button>
                      </div>
                    </div>
                  )))}
                </div>
                <div className="space-y-1.5 pt-3 border-t border-[#E7E0D0] text-xs">
                  <div className="flex justify-between font-bold text-slate-500"><span>Subtotal</span><span>{formatCurrency(cartTotals.subtotal)}</span></div>
                  {cartTotals.standardDiscount > 0 && <div className="flex justify-between font-bold text-primary"><span>{cartTotals.standardLabel} Discount</span><span>-{formatCurrency(cartTotals.standardDiscount)}</span></div>}
                  {cartTotals.birthdayDiscount > 0 && <div className="flex justify-between font-bold text-accent"><span>🎂 Birthday Discount</span><span>-{formatCurrency(cartTotals.birthdayDiscount)}</span></div>}
                  {cartTotals.bulkDiscount > 0 && <div className="flex justify-between font-bold text-success"><span>Full-Week Discount</span><span>-{formatCurrency(cartTotals.bulkDiscount)}</span></div>}
                  <div className="flex justify-between font-bold text-slate-500"><span>VAT ({SYSTEM_CONFIG.vatRate}%)</span><span>{formatCurrency(cartTotals.vat)}</span></div>
                  <div className="pt-2 border-t border-[#E7E0D0] flex justify-between text-base font-black text-slate-900"><span>Total</span><span>{formatCurrency(cartTotals.total)}</span></div>
                </div>
                <button onClick={handleCheckout} className="w-full mt-4 py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20">
                  Confirm order
                </button>
              </div>
            )}

            {weekOrders.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Confirmed this week</p>
                  {outstandingTotal > 0 && (
                    <button onClick={openPayBalance} className="text-[10px] font-black uppercase tracking-widest text-primary">Pay balance · {formatCurrency(outstandingTotal)}</button>
                  )}
                </div>
                <div className="space-y-4">
                  {weekOrders.map(({ order, lines }, gi) => {
                    const orderPaid = lines.every(l => l.item.paymentStatus === 'Paid');
                    const orderUnclaimed = lines.filter(l => isUnclaimed(l.item));
                    const orderUnclaimedTotal = orderUnclaimed.reduce((t, l) => t + l.item.price, 0);

                    // Meals within an order are still grouped by day — an
                    // order can cover more than one delivery day (you can
                    // check out Monday and Tuesday's meals together).
                    const dayGroups: { date: string; label: string; items: typeof lines }[] = [];
                    lines.forEach(line => {
                      const date = line.item.deliveryDate || '';
                      const last = dayGroups[dayGroups.length - 1];
                      if (last && last.date === date) last.items.push(line);
                      else dayGroups.push({ date, label: line.item.deliveryDay || '', items: [line] });
                    });

                    return (
                      <div key={order.id} className="bg-white rounded-2xl border border-[#E7E0D0] overflow-hidden">
                        <div className="px-4 py-3 bg-[#F4EFE4] flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{gi === 0 ? 'Your order' : `Additional order ${gi + 1}`} · {lines.length} meal{lines.length !== 1 ? 's' : ''}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Placed {new Date(order.timestamp).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                          </div>
                          {orderPaid ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase shrink-0 bg-success/10 text-success">Paid</span>
                          ) : orderUnclaimed.length > 0 ? (
                            <button onClick={() => openPayOrder(lines)} className="px-2.5 py-1 rounded text-[10px] font-black uppercase shrink-0 bg-danger/10 text-danger">
                              Pay order · {formatCurrency(orderUnclaimedTotal)}
                            </button>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase shrink-0 bg-warning/10 text-warning">Awaiting confirmation</span>
                          )}
                        </div>
                        <div className="divide-y divide-[#F0EADD]">
                          {dayGroups.map(group => {
                            const locked = isPastCutoff(group.date, systemDate);
                            return (
                              <div key={group.date} className="p-4">
                                <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                                  <p className="text-[10px] font-black uppercase text-primary tracking-widest">{group.label}</p>
                                  {locked && <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 text-[9px] font-black uppercase">🔒 Locked</span>}
                                </div>
                                <div className="space-y-3">
                                  {group.items.map((line, idx) => {
                                    const rating = ratings[`${line.order.id}-${line.item.itemId}-${line.item.deliveryDate}`];
                                    const isCompleted = line.item.status === 'Completed';
                                    const isActive = line.item.status === 'Active';
                                    const payInfo = paymentStatusInfo(line.item);
                                    const { detail, person } = splitNotesTag(line.item.notes);
                                    return (
                                      <div key={idx} className={idx > 0 ? 'pt-3 border-t border-[#F0EADD]' : ''}>
                                        <div className="flex items-start justify-between gap-3 mb-1">
                                          <p className="text-sm font-bold text-slate-900 min-w-0">{line.item.name}</p>
                                          <span className="text-sm font-black text-slate-900 shrink-0">Rs {line.item.price}</span>
                                        </div>
                                        {detail && <p className="text-[11px] text-slate-400 mb-1.5">{detail}</p>}
                                        <div className="flex items-center gap-1.5 flex-wrap mb-2">
                                          {line.seq > 0 && <span className="px-1.5 py-0.5 rounded bg-accent/10 text-accent text-[9px] font-black uppercase shrink-0">Extra {line.seq + 1}</span>}
                                          <StatusBadge label={payInfo.label} tone={payInfo.tone} />
                                          <StatusBadge label={line.item.status || ''} tone="slate" />
                                          {person && <PersonTag name={person} />}
                                        </div>
                                        <div className="flex gap-2">
                                          {isUnclaimed(line.item) && <button onClick={() => openPayItem(line)} className="flex-1 py-2 bg-warning text-white rounded-xl text-[10px] font-black uppercase tracking-widest">Pay</button>}
                                          {isActive && !locked && <button onClick={() => openEditConfirmed(line)} className="flex-1 py-2 bg-primary/10 text-primary rounded-xl text-[10px] font-black uppercase tracking-widest">Edit</button>}
                                          {isActive && !locked && <button onClick={() => handleCancel(line)} className="flex-1 py-2 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest">Cancel</button>}
                                          {isCompleted && !rating && <button onClick={() => openRating(line)} className="flex-1 py-2 bg-primary/10 text-primary rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1"><Star className="size-3" /> Rate</button>}
                                          {rating && <span className="flex-1 py-2 text-center text-[10px] font-black uppercase text-primary">{rating.stars}★ sent</span>}
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
                    );
                  })}
                </div>
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

        {view === 'profile' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-[#E7E0D0] p-6 text-center">
              <img src={currentUser.avatar} className="size-16 rounded-full border-4 border-primary/10 mx-auto mb-3" alt={currentUser.name} />
              <p className="text-lg font-black text-slate-900">{currentUser.name}</p>
              <p className="text-xs text-slate-400 font-medium">{currentUser.email}</p>
            </div>

            {/* Points and store credit are real balances the customer should be able to
                check here — previously shown nowhere except a small chip on Home. */}
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
                  className="p-2 text-primary hover:bg-primary/10 rounded-lg"
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
              <p className="text-sm font-black text-slate-900 mb-4">Order history</p>
              {pastLines.length === 0 ? (
                <p className="text-xs text-slate-400 font-bold">No past orders yet.</p>
              ) : (
                <div className="space-y-2">
                  {pastLines.slice(0, 10).map((line, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="font-bold text-slate-600">{line.item.deliveryDay} · {line.item.name}</span>
                      <span className="font-black text-slate-900">Rs {line.item.price}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {onLogout && (
              <button onClick={onLogout} className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2">
                <LogOut className="size-4" /> Log out
              </button>
            )}
          </div>
        )}
      </main>

      <nav className="shrink-0 bg-white border-t border-[#E7E0D0] flex items-center justify-around py-2">
        {([
          { id: 'home', label: 'Home', icon: HomeIcon },
          { id: 'menu', label: 'Menu', icon: BookOpen },
          { id: 'order', label: 'My Order', icon: ShoppingBag },
          { id: 'profile', label: 'Profile', icon: UserIcon },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setView(t.id)} className={`flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl text-[10px] font-bold ${view === t.id ? 'text-primary' : 'text-slate-400'}`}>
            <t.icon className="size-5" />
            {t.label}
            {t.id === 'order' && cartCount > 0 && <span className="absolute -mt-6 ml-6 size-4 bg-danger text-white rounded-full text-[8px] flex items-center justify-center">{cartCount}</span>}
          </button>
        ))}
      </nav>

      {/* --- MEAL BUILDER --- */}
      {builder && (() => {
        const complete = sectionComplete(builder);
        const selectedCurry = WEEKLY_CURRY_MENU[builder.day.key].find(c => c.id === builder.sel.curryId);
        const selectedBase = MEAL_BASES.find(b => b.id === builder.sel.baseId);
        const extrasList = [
          builder.sel.dhalId && builder.sel.dhalId !== 'none' ? MEAL_DHALS.find(x => x.id === builder.sel.dhalId)?.name : null,
          builder.sel.saladId && builder.sel.saladId !== 'none' ? MEAL_SALADS.find(x => x.id === builder.sel.saladId)?.name : null,
          builder.sel.beverageId !== 'none' ? MEAL_BEVERAGES.find(x => x.id === builder.sel.beverageId)?.name : null,
          builder.sel.dessertId !== 'none' ? MEAL_DESSERTS.find(x => x.id === builder.sel.dessertId)?.name : null,
        ].filter(Boolean) as string[];
        const extrasSummary = extrasList.join(' · ');

        return (
          <div className="fixed inset-0 z-[9999] bg-white flex flex-col">
            <div className="relative h-64 shrink-0">
              <img src={dishPhotoFor(builder.sel.curryId)} className="w-full h-full object-cover" alt="Dish" />
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
                  {extrasList.length > 0 && (
                    <button onClick={() => toggleSection(3)} className="px-2.5 py-1 rounded-full bg-white/90 text-slate-900 text-[11px] font-bold">✨ {extrasList.length} extra{extrasList.length > 1 ? 's' : ''}</button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <SectionCard
                index={1} title="Choose your curry"
                isOpen={builder.openSection === 1} isComplete={complete[1]}
                summary={selectedCurry ? `${selectedCurry.emoji} ${selectedCurry.name}` : undefined}
                onToggle={() => toggleSection(1)}
              >
                <div className="space-y-2">
                  {WEEKLY_CURRY_MENU[builder.day.key].map(c => (
                    <button key={c.id} onClick={() => selectCurry(c.id)} className={`w-full flex items-center gap-3 p-3 rounded-2xl border-2 transition-all ${builder.sel.curryId === c.id ? 'border-primary bg-primary/5' : 'border-transparent bg-[#F4EFE4]'}`}>
                      <span className="text-2xl">{c.emoji}</span>
                      <div className="flex-1 text-left"><p className="text-sm font-bold text-slate-900">{c.name}</p><p className="text-[11px] text-slate-500">{c.desc}</p></div>
                      <span className="text-xs font-black text-primary">Rs {c.price}</span>
                    </button>
                  ))}
                </div>
              </SectionCard>

              <SectionCard
                index={2} title="Choose your base"
                isOpen={builder.openSection === 2} isComplete={complete[2]}
                summary={selectedBase ? `${selectedBase.emoji} ${selectedBase.name}` : undefined}
                onToggle={() => toggleSection(2)}
              >
                <div className="grid grid-cols-2 gap-2">
                  {MEAL_BASES.map(b => (
                    <button key={b.id} onClick={() => selectBase(b.id)} className={`p-4 rounded-2xl border-2 transition-all ${builder.sel.baseId === b.id ? 'border-primary bg-primary/5' : 'border-transparent bg-[#F4EFE4]'}`}>
                      <p className="text-2xl mb-1">{b.emoji}</p>
                      <p className="text-xs font-bold text-slate-900">{b.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold">{b.up ? `+Rs ${b.up}` : 'included'}</p>
                    </button>
                  ))}
                </div>
              </SectionCard>

              <SectionCard
                index={3} title="Make it yours"
                isOpen={builder.openSection === 3} isComplete={complete[3]}
                summary={complete[3] ? (extrasSummary || 'No extras') : undefined}
                onToggle={() => toggleSection(3)}
              >
                <div className="space-y-3">
                  <ChipRow label="🫘 Dhal" options={MEAL_DHALS} selected={builder.sel.dhalId} onSelect={id => setBuilderSel({ dhalId: id })} noneLabel="No dhal" />
                  <ChipRow label="🥗 Salad" options={MEAL_SALADS} selected={builder.sel.saladId} onSelect={id => setBuilderSel({ saladId: id })} noneLabel="No salad" />
                  <ChipRow label="🥤 Beverage" options={MEAL_BEVERAGES} selected={builder.sel.beverageId} onSelect={id => setBuilderSel({ beverageId: id })} noneLabel="None" showPrice />
                  <ChipRow label="🍮 Dessert" options={MEAL_DESSERTS} selected={builder.sel.dessertId} onSelect={id => setBuilderSel({ dessertId: id })} noneLabel="None" showPrice />
                  <div className="rounded-2xl border border-[#E7E0D0] bg-[#FBF8F1] p-4">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">🧑 Who's this meal for? (optional)</p>
                    <input
                      value={builder.sel.note}
                      onChange={e => setBuilderSel({ note: e.target.value })}
                      maxLength={40}
                      placeholder="e.g. Priya"
                      className="w-full px-4 py-3 rounded-xl border border-[#E7E0D0] text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 bg-white"
                    />
                  </div>
                </div>
              </SectionCard>
            </div>

            <div className="p-4 border-t border-[#E7E0D0] flex items-center gap-3 shrink-0 bg-white">
              <div className="flex-1 text-right pr-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Total </span>
                <span className="text-base font-black text-slate-900">Rs {mealPrice(builder.sel, builder.day.key)}</span>
              </div>
              <button
                disabled={!builderReady(builder)}
                onClick={commitBuilder}
                className="px-6 py-3 rounded-xl bg-primary text-white text-xs font-black uppercase shadow-lg shadow-primary/20 disabled:opacity-40"
              >
                {(builder.editIndex !== null || builder.editingConfirmed) ? 'Save changes' : 'Add to order'}
              </button>
            </div>
          </div>
        );
      })()}

      {/* --- PAYMENT SHEET --- */}
      {payTarget && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-[#E7E0D0] flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900">{payMethod ? payMethod.name : `Pay ${formatCurrency(payTarget.amount)}`}</h2>
              <button onClick={() => { setPayTarget(null); setPayMethod(null); setCustomerRef(''); }} className="p-2 text-slate-400 hover:text-danger"><X className="size-5" /></button>
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
                    <p className="text-xs text-slate-500 text-center">You'll be handed to <strong>Juice by MCB</strong> to approve this payment to BonManzE.</p>
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
                  <button onClick={commitPayment} className="w-full py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20">
                    {isPayNowMethod(payMethod.name) ? "I've approved payment" : `Confirm — ${payMethod.name}`}
                  </button>
                  <button onClick={() => { setPayMethod(null); setCustomerRef(''); }} className="w-full py-2 text-slate-400 text-xs font-bold">← Choose a different method</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- RATING SHEET --- */}
      {rateTarget && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-sm shadow-2xl overflow-hidden p-8 text-center">
            <button onClick={() => setRateTarget(null)} className="absolute top-6 right-6 p-2 text-slate-400 hover:text-danger"><X className="size-5" /></button>
            <p className="text-sm font-black text-slate-900 mb-1">Rate your meal</p>
            <p className="text-xs text-slate-400 font-bold mb-6">{rateTarget.label}</p>
            <div className="flex items-center justify-center gap-2 mb-4">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setRateStars(n)}>
                  <Star className={`size-8 ${n <= rateStars ? 'fill-warning text-warning' : 'text-slate-200'}`} />
                </button>
              ))}
            </div>
            <button disabled={!rateStars} onClick={submitRating} className="w-full py-3 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest disabled:opacity-40">
              Submit rating
            </button>
          </div>
        </div>
      )}

      {/* --- TOAST --- */}
      {toastMsg && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[10000] bg-slate-900 text-white px-5 py-3 rounded-2xl text-xs font-bold shadow-2xl max-w-[90vw] text-center">
          {toastMsg}
        </div>
      )}
    </div>
  );
};

// A small uniform badge for payment/order status — keeps the "one line of
// tags" (extra / payment / status / person) actually the same shape and
// size, rather than four differently-styled inline spans.
const StatusBadge: React.FC<{ label: string; tone: 'success' | 'warning' | 'danger' | 'slate' }> = ({ label, tone }) => {
  const cls = tone === 'success' ? 'bg-success/10 text-success' : tone === 'warning' ? 'bg-warning/10 text-warning' : tone === 'danger' ? 'bg-danger/10 text-danger' : 'bg-slate-100 text-slate-500';
  return <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase shrink-0 ${cls}`}>{label}</span>;
};

// A small pill for "who this meal is for" — used everywhere a note shows up
// (draft cart, Menu tab, My Order, Home) so it reads as a tag, not prose.
const PersonTag: React.FC<{ name: string }> = ({ name }) => (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/10 text-accent text-[10px] font-bold shrink-0">
    <UserIcon className="size-2.5" /> {name}
  </span>
);

const SectionCard: React.FC<{
  index: number;
  title: string;
  isOpen: boolean;
  isComplete: boolean;
  summary?: string;
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
        {!isOpen && summary && <span className="text-xs font-bold text-primary truncate max-w-[150px]">{summary}</span>}
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
