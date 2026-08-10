
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
  updateOrderItemsPayment,
  formatCurrency
} from './store';

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

const CHECKOUT_METHOD_NAMES = ['Juice / Transfer', 'MauCAS', 'Cash on Delivery'];
const isPayNowMethod = (name: string) => name.includes('Juice');

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

  const [builder, setBuilder] = useState<{
    day: WeekDay; openSection: 1 | 2 | 3; sel: MealSelection; editIndex: number | null;
  } | null>(null);

  const [payTarget, setPayTarget] = useState<{
    kind: 'item'; orderId: string; date: string; slot: string; amount: number; what: string;
  } | { kind: 'balance'; items: { orderId: string; date: string; slot: string; amount: number }[]; amount: number; what: string; } | null>(null);
  const [payMethod, setPayMethod] = useState<PaymentMethod | null>(null);

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
      sel: existing ? { ...existing } : emptySelection(presetCurryId || WEEKLY_CURRY_MENU[day.key][0].id)
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
    const { day, sel, editIndex } = builder;
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

  // Home's weekly overview merges both draft (not-yet-confirmed) and
  // confirmed meals per day — previously Home only ever showed the draft
  // cart, so a fully confirmed week looked empty ("Choose your meal" on
  // every day) even though the order existed.
  const weekOverview = useMemo(
    () => weekDays.map(d => ({
      day: d,
      confirmed: thisWeekLinesWithSeq.filter(l => l.item.deliveryDate === d.date),
      draft: cart[d.date] || []
    })),
    [weekDays, thisWeekLinesWithSeq, cart]
  );

  const pastLines: Line[] = useMemo(() => {
    const out: Line[] = [];
    myOrders.forEach(o => o.items.forEach(item => {
      if (item.status === 'Cancelled') return;
      if (item.deliveryDate && !weekDateKeys.has(item.deliveryDate) && item.deliveryDate < systemDate) out.push({ order: o, item });
    }));
    return out.sort((a, b) => (b.item.deliveryDate || '').localeCompare(a.item.deliveryDate || ''));
  }, [myOrders, weekDateKeys, systemDate]);

  const outstandingTotal = useMemo(
    () => thisWeekLines.filter(l => l.item.paymentStatus === 'Pending').reduce((t, l) => t + l.item.qty * l.item.price, 0),
    [thisWeekLines]
  );

  const applicablePaymentMethods = useMemo(
    () => paymentMethods.filter(m => m.isActive && CHECKOUT_METHOD_NAMES.includes(m.name)),
    [paymentMethods]
  );

  const openPayItem = (line: Line) => {
    setPayMethod(null);
    setPayTarget({
      kind: 'item',
      orderId: line.order.id,
      date: line.item.deliveryDate || '',
      slot: line.item.serviceSlot || 'Lunch',
      amount: line.item.qty * line.item.price,
      what: `${line.item.deliveryDay || ''} · ${line.item.name}`
    });
  };

  const openPayBalance = () => {
    const pending = thisWeekLines.filter(l => l.item.paymentStatus === 'Pending');
    if (!pending.length) return;
    setPayMethod(null);
    setPayTarget({
      kind: 'balance',
      items: pending.map(l => ({ orderId: l.order.id, date: l.item.deliveryDate || '', slot: l.item.serviceSlot || 'Lunch', amount: l.item.qty * l.item.price })),
      amount: outstandingTotal,
      what: `${pending.length} unpaid meal${pending.length !== 1 ? 's' : ''} · full balance`
    });
  };

  const commitPayment = () => {
    if (!payTarget || !payMethod) return;
    if (payTarget.kind === 'item') {
      updateOrderItemsPayment(payTarget.orderId, payTarget.date, payTarget.slot, payMethod.type, payMethod.name);
    } else {
      payTarget.items.forEach(i => updateOrderItemsPayment(i.orderId, i.date, i.slot, payMethod.type, payMethod.name));
    }
    const settled = isPayNowMethod(payMethod.name);
    toast(settled ? `Rs ${payTarget.amount} paid via ${payMethod.name}` : `${payMethod.name} selected — Rs ${payTarget.amount} due on delivery`);
    setPayTarget(null);
    setPayMethod(null);
  };

  const handleCancel = (line: Line) => {
    cancelOrderItem(line.order.id, line.item.deliveryDate || '', line.item.serviceSlot || 'Lunch', line.item.itemId);
    toast('Meal cancelled');
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
            <div className="bg-primary rounded-[28px] p-6 text-white shadow-lg shadow-primary/20">
              <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">Bonzour, {currentUser.firstName}!</p>
              <p className="text-lg font-black italic leading-snug">"{culturePhrase.cr}"</p>
              <p className="text-xs opacity-80 mt-1">{culturePhrase.en}</p>
            </div>

            {(cartCount > 0 || thisWeekLinesWithSeq.length > 0) && (
              <div className={`rounded-2xl p-4 flex items-center justify-between gap-3 ${outstandingTotal > 0 ? 'bg-warning/10' : thisWeekLinesWithSeq.length > 0 ? 'bg-primary/5' : 'bg-slate-100'}`}>
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900">
                    {thisWeekLinesWithSeq.length === 0
                      ? `${cartCount} meal${cartCount !== 1 ? 's' : ''} selected`
                      : outstandingTotal > 0
                        ? `${formatCurrency(outstandingTotal)} outstanding`
                        : 'All set for this week'}
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium truncate">
                    {thisWeekLinesWithSeq.length === 0
                      ? `${formatCurrency(cartTotals.total)} · not yet confirmed`
                      : outstandingTotal > 0
                        ? `across ${thisWeekLinesWithSeq.filter(l => l.item.paymentStatus === 'Pending').length} meal${thisWeekLinesWithSeq.filter(l => l.item.paymentStatus === 'Pending').length !== 1 ? 's' : ''}`
                        : `${thisWeekLinesWithSeq.length} meal${thisWeekLinesWithSeq.length !== 1 ? 's' : ''} · fully paid`}
                  </p>
                </div>
                <button onClick={() => setView('order')} className="text-[10px] font-black uppercase tracking-widest text-primary shrink-0">
                  {thisWeekLinesWithSeq.length === 0 ? 'Review & confirm →' : outstandingTotal > 0 ? 'Pay now →' : 'My Order →'}
                </button>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-black text-slate-900">This week</h2>
                <button onClick={() => setView('menu')} className="text-[11px] font-black uppercase tracking-widest text-primary">Browse menu →</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {weekOverview.map(({ day: d, confirmed, draft }) => (
                  <div key={d.key} className="bg-white rounded-2xl border border-[#E7E0D0] p-4">
                    <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-2">{d.label}</p>
                    {confirmed.length === 0 && draft.length === 0 ? (
                      <button onClick={() => setView('menu')} className="w-full py-2 text-left text-xs font-bold text-slate-400 flex items-center gap-1.5">
                        <Plus className="size-3.5" /> Choose your meal
                      </button>
                    ) : (
                      <div className="space-y-1.5">
                        {confirmed.map((l, i) => {
                          const { person } = splitNotesTag(l.item.notes);
                          return (
                            <div key={`c-${i}`}>
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-bold text-slate-700 flex-1 truncate">{l.item.name}</p>
                                {l.seq > 0 && <span className="px-1.5 py-0.5 rounded bg-accent/10 text-accent text-[9px] font-black uppercase shrink-0">Extra {l.seq + 1}</span>}
                              </div>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[9px] font-black uppercase shrink-0">{l.item.status}</span>
                                <span className={`text-[9px] font-black uppercase shrink-0 ${l.item.paymentStatus === 'Paid' ? 'text-success' : 'text-danger'}`}>{l.item.paymentStatus === 'Paid' ? 'Paid' : 'Unpaid'}</span>
                                {person && <PersonTag name={person} />}
                              </div>
                            </div>
                          );
                        })}
                        {draft.map((m, i) => (
                          <div key={`d-${i}`}>
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-bold text-slate-400 flex-1 truncate">{mealSummaryLabel(m, d.key)}</p>
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 text-[9px] font-black uppercase shrink-0">Draft</span>
                            </div>
                            {m.note.trim() && <div className="mt-1"><PersonTag name={m.note.trim()} /></div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {cartCount > 0 && (
              <button onClick={() => setView('order')} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-2">
                Review order · {cartCount} meal{cartCount !== 1 ? 's' : ''} · {formatCurrency(cartTotals.total)}
              </button>
            )}
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
                    const orderOutstanding = lines.filter(l => l.item.paymentStatus === 'Pending').reduce((t, l) => t + l.item.price, 0);
                    return (
                      <div key={order.id} className="bg-white rounded-2xl border border-[#E7E0D0] overflow-hidden">
                        <div className="px-4 py-3 bg-[#F4EFE4] flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{gi === 0 ? 'Your order' : `Additional order ${gi + 1}`} · {lines.length} meal{lines.length !== 1 ? 's' : ''}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Placed {new Date(order.timestamp).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase shrink-0 ${orderPaid ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                            {orderPaid ? 'Paid' : `${formatCurrency(orderOutstanding)} due`}
                          </span>
                        </div>
                        <div className="divide-y divide-[#F0EADD]">
                          {lines.map((line, idx) => {
                            const rating = ratings[`${line.order.id}-${line.item.itemId}-${line.item.deliveryDate}`];
                            const isCompleted = line.item.status === 'Completed';
                            const isPaid = line.item.paymentStatus === 'Paid';
                            const { detail, person } = splitNotesTag(line.item.notes);
                            return (
                              <div key={idx} className="p-4">
                                <div className="flex items-start justify-between gap-3 mb-2">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <p className="text-[10px] font-black uppercase text-primary tracking-widest">{line.item.deliveryDay}</p>
                                      {line.seq > 0 && <span className="px-1.5 py-0.5 rounded bg-accent/10 text-accent text-[9px] font-black uppercase">Extra {line.seq + 1}</span>}
                                    </div>
                                    <p className="text-sm font-bold text-slate-900">{line.item.name}</p>
                                    {detail && <p className="text-[11px] text-slate-400">{detail}</p>}
                                    {person && <div className="mt-1"><PersonTag name={person} /></div>}
                                  </div>
                                  <span className="text-sm font-black text-slate-900 shrink-0">Rs {line.item.price}</span>
                                </div>
                                <div className="flex items-center gap-2 mb-3">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${isPaid ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>{isPaid ? 'Paid' : 'Unpaid'}</span>
                                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-black uppercase">{line.item.status}</span>
                                </div>
                                <div className="flex gap-2">
                                  {!isPaid && <button onClick={() => openPayItem(line)} className="flex-1 py-2 bg-warning text-white rounded-xl text-[10px] font-black uppercase tracking-widest">Pay</button>}
                                  {line.item.status === 'Active' && <button onClick={() => handleCancel(line)} className="flex-1 py-2 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest">Cancel</button>}
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

            {tierObj && (
              <div className="bg-primary rounded-3xl p-6 text-white shadow-lg shadow-primary/20">
                <div className="flex items-center gap-2 mb-3">
                  <Star className="size-5" />
                  <p className="text-lg font-black">{tierObj.name} Member</p>
                </div>
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
                <p className="text-white font-black text-sm mb-2">{builder.editIndex !== null ? `Edit ${builder.day.label}` : `${builder.day.label} — customise`}</p>
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
                {builder.editIndex !== null ? 'Save changes' : 'Add to order'}
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
              <button onClick={() => { setPayTarget(null); setPayMethod(null); }} className="p-2 text-slate-400 hover:text-danger"><X className="size-5" /></button>
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
                  <button onClick={commitPayment} className="w-full py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20">
                    {isPayNowMethod(payMethod.name) ? 'Approve payment' : `Confirm — ${payMethod.name}`}
                  </button>
                  <button onClick={() => setPayMethod(null)} className="w-full py-2 text-slate-400 text-xs font-bold">← Choose a different method</button>
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
