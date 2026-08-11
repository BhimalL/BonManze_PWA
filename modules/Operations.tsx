
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
  MessageSquare
} from 'lucide-react';
import { Order, OrderItem, Customer, PaymentMethod } from '../types';
import {
  subscribeToOrders,
  updateOrderItemStatus,
  updateOrderPayment,
  updateOrderItemsPayment,
  subscribeToCustomers,
  subscribeToPaymentMethods,
  subscribeToSystemDate,
  updateSystemDate,
  subscribeToLunchMenu,
  updateLunchCurryOption,
  lunchMenuForWeek,
  subscribeToDinnerMenu,
  updateDinnerCurryOption,
  dinnerMenuForWeek,
  MOCK_TODAY,
  getRealTodayISO,
  WEEKDAY_KEYS,
  WeekdayKey,
  CurryOption,
  dishPhotoFor,
  formatCurrency,
  MEAL_PLAN_PAYMENT_METHOD_NAMES,
  SYSTEM_CONFIG,
  subscribeToConfig,
  updateSystemConfig
} from './store';

interface OperationsProps {
  onExit: () => void;
}

type Tab = 'dashboard' | 'menu' | 'orders' | 'delivery' | 'payments' | 'customers' | 'settings';

// Which offering a curry-menu edit applies to — Dinner is a second,
// independently toggleable offering that otherwise mirrors Lunch exactly.
type Service = 'Lunch' | 'Dinner';

// Which of the two currently-orderable calendar weeks the Menu tab is
// editing — 'This' is whatever week the date control up top is in, 'Next'
// is the week after. Matches the Customer App's own This/Next switcher.
type WeekChoice = 'This' | 'Next';

const TABS: { id: Exclude<Tab, 'settings'>; label: string; icon: any }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'menu', label: 'Menu Planner', icon: BookOpen },
  { id: 'orders', label: 'Orders by Dish', icon: ClipboardList },
  { id: 'delivery', label: 'Delivery List', icon: Truck },
  { id: 'payments', label: 'Payments', icon: Wallet },
  { id: 'customers', label: 'Customer Directory', icon: Users },
];

const formatDay = (dateKey: string) => {
  if (!dateKey || dateKey === 'Unscheduled') return 'Unscheduled';
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return dateKey;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
};

interface DropTask {
  key: string;
  orderId: string;
  customerName: string;
  date?: string;
  slot?: string;
  items: OrderItem[];
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
  const diffToMonday = dow === 0 ? 1 : (1 - dow);
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
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
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

  // Which curry is being edited inline on the Menu tab, plus its draft
  // values — Save calls updateLunchCurryOption/updateDinnerCurryOption
  // depending on `service`, scoped to `weekStart`, Cancel just clears this.
  const [editingCurry, setEditingCurry] = useState<{ day: WeekdayKey; curryId: string; service: Service; weekStart: string } | null>(null);
  const [editForm, setEditForm] = useState({ name: '', desc: '', price: '' });

  // Dinner is a second, independently toggleable offering (same pattern as
  // the VAT switch below) — customers never see this switch, only Bhimal
  // does, here in Operations. Defaults to whatever SYSTEM_CONFIG currently
  // holds and flips immediately on click, same as VAT's on/off toggle.
  const [dinnerEnabled, setDinnerEnabledLocal] = useState(SYSTEM_CONFIG.dinnerEnabled);

  // Delivery List defaults to today; this overrides that when Bhimal taps
  // another day's chip to peek ahead. null = "follow today".
  const [deliveryDayOverride, setDeliveryDayOverride] = useState<WeekdayKey | null>(null);
  const [showPaidHistory, setShowPaidHistory] = useState(false);

  // VAT can only legally be charged once BonManzE is actually VAT-registered
  // with the MRA (Mauritius's registration threshold is MUR 3M/yr turnover,
  // or voluntary registration below that) — so this needs to be a switch
  // Bhimal can flip himself, not a hardcoded true buried in store.ts. Rate/
  // VRN are edited as drafts and only pushed to the store on Save; the
  // on/off switch itself commits immediately since it's a single toggle.
  const [vatEnabled, setVatEnabledLocal] = useState(SYSTEM_CONFIG.vatEnabled);
  const [vatRateInput, setVatRateInput] = useState(String(SYSTEM_CONFIG.vatRate));
  const [vatNumberInput, setVatNumberInput] = useState(SYSTEM_CONFIG.vatNumber);

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
    cutoffTime: SYSTEM_CONFIG.cutoffTime,
    cutoffDayOffset: String(SYSTEM_CONFIG.cutoffDayOffset),
    lunchDeliveryWindow: SYSTEM_CONFIG.lunchDeliveryWindow,
    dinnerDeliveryWindow: SYSTEM_CONFIG.dinnerDeliveryWindow
  });

  const [customerSearch, setCustomerSearch] = useState('');
  const [confirmPaymentId, setConfirmPaymentId] = useState<string | null>(null);

  useEffect(() => {
    const u1 = subscribeToOrders(setOrders);
    const u2 = subscribeToCustomers(setCustomers);
    const u3 = subscribeToPaymentMethods(setPaymentMethods);
    const u4 = subscribeToSystemDate(setSystemDate);
    const u5 = subscribeToLunchMenu(() => setMenuTick(t => t + 1));
    const u6 = subscribeToConfig(() => {
      setVatEnabledLocal(SYSTEM_CONFIG.vatEnabled);
      setVatRateInput(String(SYSTEM_CONFIG.vatRate));
      setVatNumberInput(SYSTEM_CONFIG.vatNumber);
      setBrandForm({
        name: SYSTEM_CONFIG.businessName,
        tagline: SYSTEM_CONFIG.businessTagline,
        logoUrl: SYSTEM_CONFIG.businessLogoUrl,
        supportPhone: SYSTEM_CONFIG.supportPhone,
        supportEmail: SYSTEM_CONFIG.supportEmail
      });
      setDinnerEnabledLocal(SYSTEM_CONFIG.dinnerEnabled);
      setDeliveryForm({ cutoffTime: SYSTEM_CONFIG.cutoffTime, cutoffDayOffset: String(SYSTEM_CONFIG.cutoffDayOffset), lunchDeliveryWindow: SYSTEM_CONFIG.lunchDeliveryWindow, dinnerDeliveryWindow: SYSTEM_CONFIG.dinnerDeliveryWindow });
    });
    const u7 = subscribeToDinnerMenu(() => setMenuTick(t => t + 1));
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); };
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
      deliveryForm.cutoffTime !== SYSTEM_CONFIG.cutoffTime ||
      Number(deliveryForm.cutoffDayOffset) !== SYSTEM_CONFIG.cutoffDayOffset ||
      deliveryForm.lunchDeliveryWindow !== SYSTEM_CONFIG.lunchDeliveryWindow ||
      deliveryForm.dinnerDeliveryWindow !== SYSTEM_CONFIG.dinnerDeliveryWindow ||
      vatEnabled !== SYSTEM_CONFIG.vatEnabled ||
      vatRateInput !== String(SYSTEM_CONFIG.vatRate) ||
      vatNumberInput !== SYSTEM_CONFIG.vatNumber ||
      dinnerEnabled !== SYSTEM_CONFIG.dinnerEnabled
    );
  }, [brandForm, deliveryForm, vatEnabled, vatRateInput, vatNumberInput, dinnerEnabled]);

  const saveAllSettings = () => {
    const parsedRate = parseFloat(vatRateInput);
    const parsedOffset = parseInt(deliveryForm.cutoffDayOffset, 10);
    updateSystemConfig({
      businessName: brandForm.name.trim() || SYSTEM_CONFIG.businessName,
      businessTagline: brandForm.tagline.trim(),
      businessLogoUrl: brandForm.logoUrl.trim(),
      supportPhone: brandForm.supportPhone.trim() || SYSTEM_CONFIG.supportPhone,
      supportEmail: brandForm.supportEmail.trim() || SYSTEM_CONFIG.supportEmail,
      cutoffTime: deliveryForm.cutoffTime || SYSTEM_CONFIG.cutoffTime,
      cutoffDayOffset: isNaN(parsedOffset) ? SYSTEM_CONFIG.cutoffDayOffset : parsedOffset,
      lunchDeliveryWindow: deliveryForm.lunchDeliveryWindow.trim() || SYSTEM_CONFIG.lunchDeliveryWindow,
      dinnerDeliveryWindow: deliveryForm.dinnerDeliveryWindow.trim() || SYSTEM_CONFIG.dinnerDeliveryWindow,
      vatEnabled: vatEnabled,
      vatRate: isNaN(parsedRate) ? SYSTEM_CONFIG.vatRate : parsedRate,
      vatNumber: vatNumberInput.trim(),
      dinnerEnabled: dinnerEnabled
    });
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
      cutoffTime: SYSTEM_CONFIG.cutoffTime,
      cutoffDayOffset: String(SYSTEM_CONFIG.cutoffDayOffset),
      lunchDeliveryWindow: SYSTEM_CONFIG.lunchDeliveryWindow,
      dinnerDeliveryWindow: SYSTEM_CONFIG.dinnerDeliveryWindow
    });
    setVatEnabledLocal(SYSTEM_CONFIG.vatEnabled);
    setVatRateInput(String(SYSTEM_CONFIG.vatRate));
    setVatNumberInput(SYSTEM_CONFIG.vatNumber);
    setDinnerEnabledLocal(SYSTEM_CONFIG.dinnerEnabled);
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
  const dishesByDay = useMemo(() => {
    const days: Record<string, Record<string, { qty: number; revenue: number; itemId: string; name: string; service: Service }>> = {};
    lines.forEach(({ item }) => {
      const day = item.deliveryDate || '';
      if (!weekDateKeys.has(day)) return;
      const service: Service = (item.serviceSlot || '').startsWith('Dinner') ? 'Dinner' : 'Lunch';
      const key = `${service}::${item.name}`;
      if (!days[day]) days[day] = {};
      if (!days[day][key]) days[day][key] = { qty: 0, revenue: 0, itemId: item.itemId, name: item.name, service };
      days[day][key].qty += item.qty;
      days[day][key].revenue += item.qty * item.price;
    });
    return days;
  }, [lines, weekDateKeys]);

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
        if (!weekDateKeys.has(date)) return;
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
  }, [orders, weekDateKeys]);

  const filteredDrops = useMemo(
    () => drops.filter(d => d.date === weekDays.find(w => w.key === activeDeliveryDay)?.date),
    [drops, activeDeliveryDay, weekDays]
  );

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

  const handleMarkDelivered = (drop: DropTask) => {
    drop.items.forEach(i => updateOrderItemStatus(drop.orderId, i.itemId, drop.date || '', drop.slot || '', 'Completed'));
  };

  const markPaid = (drop: DropTask, method: PaymentMethod) => {
    updateOrderItemsPayment(drop.orderId, drop.date || '', drop.slot, method.type, method.name);
    setPaymentDrop(null);
  };

  const startEditCurry = (day: WeekdayKey, curry: CurryOption, service: Service, weekStart: string) => {
    setEditingCurry({ day, curryId: curry.id, service, weekStart });
    setEditForm({ name: curry.name, desc: curry.desc, price: String(curry.price) });
  };

  const saveCurryEdit = () => {
    if (!editingCurry) return;
    const menu = editingCurry.service === 'Dinner' ? dinnerMenuForWeek(editingCurry.weekStart) : lunchMenuForWeek(editingCurry.weekStart);
    const update = editingCurry.service === 'Dinner' ? updateDinnerCurryOption : updateLunchCurryOption;
    const existing = menu[editingCurry.day].find(c => c.id === editingCurry.curryId);
    const parsedPrice = parseInt(editForm.price, 10);
    update(editingCurry.weekStart, editingCurry.day, editingCurry.curryId, {
      name: editForm.name.trim() || existing?.name || '',
      desc: editForm.desc.trim(),
      price: isNaN(parsedPrice) ? (existing?.price || 0) : parsedPrice
    });
    setEditingCurry(null);
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
    const activeMenuDays = activeMenuWeek === 'Next' ? nextWeekDays : weekDays;
    const activeMenuWeekStart = activeMenuDays[0].date;
    const activeLunchMenu = lunchMenuForWeek(activeMenuWeekStart);
    const activeDinnerMenu = dinnerMenuForWeek(activeMenuWeekStart);
    
    const [y, m, d] = activeMenuWeekStart.split('-').map(Number);
    const weekDateStr = new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

    return (
      <div className="space-y-6">
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
              Customers can now browse and order a week ahead. Set Next week's menu apart here if you don't want it to just repeat This week's — otherwise it follows the same rotation automatically.
            </p>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 rounded-full p-1 shrink-0">
            {(['This', 'Next'] as WeekChoice[]).map(w => (
              <button
                key={w}
                onClick={() => setActiveMenuWeek(w)}
                className={`px-3.5 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all ${activeMenuWeek === w ? 'bg-primary text-white shadow-sm' : 'text-slate-500'}`}
              >
                {w === 'This' ? 'This week' : 'Next week'}
              </button>
            ))}
          </div>
        </div>

        {/* Lunch menu */}
        <div className="bg-white rounded-3xl border border-[#E7E0D0] shadow-sm p-6">
          <h2 className="text-base font-black text-slate-900 mb-4">{activeMenuWeek === 'Next' ? "Next Week's Curry Menu — Lunch" : "This Week's Curry Menu — Lunch"}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {activeMenuDays.map(d => (
              <div key={d.key} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-3">{d.label}</p>
                <div className="space-y-2.5">
                  {activeLunchMenu[d.key].map(c => {
                    const isEditing = editingCurry?.day === d.key && editingCurry.curryId === c.id && editingCurry.service === 'Lunch' && editingCurry.weekStart === activeMenuWeekStart;
                    if (isEditing) {
                      return (
                        <div key={c.id} className="p-3 bg-white rounded-xl border-2 border-primary/30 space-y-2">
                          <input
                            value={editForm.name}
                            onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                            placeholder="Name"
                            className="w-full text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20"
                          />
                          <input
                            value={editForm.desc}
                            onChange={e => setEditForm(f => ({ ...f, desc: e.target.value }))}
                            placeholder="Description"
                            className="w-full text-[11px] px-2.5 py-1.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20"
                          />
                          <div className="flex items-center gap-2">
                             <span className="text-[10px] font-bold text-slate-400">Rs</span>
                             <input
                               type="number"
                               value={editForm.price}
                               onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))}
                               className="w-20 text-xs font-black px-2.5 py-1.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20"
                             />
                             <div className="flex-1" />
                             <button onClick={saveCurryEdit} className="p-1.5 bg-primary text-white rounded-lg"><Check className="size-3.5" /></button>
                             <button onClick={() => setEditingCurry(null)} className="p-1.5 bg-slate-100 text-slate-400 rounded-lg"><X className="size-3.5" /></button>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={c.id} className="flex items-center gap-2">
                        <img src={dishPhotoFor(c.id)} alt={c.name} className="size-9 rounded-lg object-cover shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-800 truncate">{c.emoji} {c.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">{c.desc}</p>
                        </div>
                        <span className="text-[10px] font-black text-slate-400 shrink-0">{formatCurrency(c.price)}</span>
                        <button onClick={() => startEditCurry(d.key, c, 'Lunch', activeMenuWeekStart)} className="p-1 text-slate-300 hover:text-primary shrink-0">
                          <Edit3 className="size-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-4">
            Tap the pencil to edit a curry's name, description, or price — changes apply immediately on the Customer App.
          </p>
        </div>

        {/* Dinner menu */}
        {dinnerEnabled && (
          <div className="bg-white rounded-3xl border border-[#E7E0D0] shadow-sm p-6">
            <h2 className="text-base font-black text-slate-900 mb-4">{activeMenuWeek === 'Next' ? "Next Week's Curry Menu — Dinner" : "This Week's Curry Menu — Dinner"}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {activeMenuDays.map(d => (
                <div key={d.key} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-3">{d.label}</p>
                  <div className="space-y-2.5">
                    {activeDinnerMenu[d.key].map(c => {
                      const isEditing = editingCurry?.day === d.key && editingCurry.curryId === c.id && editingCurry.service === 'Dinner' && editingCurry.weekStart === activeMenuWeekStart;
                      if (isEditing) {
                        return (
                          <div key={c.id} className="p-3 bg-white rounded-xl border-2 border-primary/30 space-y-2">
                            <input
                              value={editForm.name}
                              onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                              placeholder="Name"
                              className="w-full text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20"
                            />
                            <input
                              value={editForm.desc}
                              onChange={e => setEditForm(f => ({ ...f, desc: e.target.value }))}
                              placeholder="Description"
                              className="w-full text-[11px] px-2.5 py-1.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20"
                            />
                            <div className="flex items-center gap-2">
                               <span className="text-[10px] font-bold text-slate-400">Rs</span>
                               <input
                                 type="number"
                                 value={editForm.price}
                                 onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))}
                                 className="w-20 text-xs font-black px-2.5 py-1.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20"
                               />
                               <div className="flex-1" />
                               <button onClick={saveCurryEdit} className="p-1.5 bg-primary text-white rounded-lg"><Check className="size-3.5" /></button>
                               <button onClick={() => setEditingCurry(null)} className="p-1.5 bg-slate-100 text-slate-400 rounded-lg"><X className="size-3.5" /></button>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div key={c.id} className="flex items-center gap-2">
                          <img src={dishPhotoFor(c.id)} alt={c.name} className="size-9 rounded-lg object-cover shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-800 truncate">{c.emoji} {c.name}</p>
                            <p className="text-[10px] text-slate-400 truncate">{c.desc}</p>
                          </div>
                          <span className="text-[10px] font-black text-slate-400 shrink-0">{formatCurrency(c.price)}</span>
                          <button onClick={() => startEditCurry(d.key, c, 'Dinner', activeMenuWeekStart)} className="p-1 text-slate-300 hover:text-primary shrink-0">
                            <Edit3 className="size-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-4">
              Tap the pencil to edit a curry's name, description, or price — changes apply immediately on the Customer App.
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderSettingsTab = () => {
    return (
      <div className="space-y-8 animate-fade-in pb-24">
        {/* Card 1: Brand Identity & Support */}
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
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Logo Image URL</label>
              <div className="flex gap-4 items-center">
                <input
                  type="text"
                  value={brandForm.logoUrl}
                  onChange={e => setBrandForm(f => ({ ...f, logoUrl: e.target.value }))}
                  className="flex-1 text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all"
                />
                {brandForm.logoUrl && (
                  <img src={brandForm.logoUrl} alt="Logo Preview" className="size-10 rounded-lg object-cover border border-[#E7E0D0] bg-slate-50" />
                )}
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

        {/* Card 2: Delivery Schedules & Cutoffs */}
        <div className="bg-white rounded-3xl border border-[#E7E0D0] p-8 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-black text-slate-900">Delivery Rules & Order Cutoffs</h3>
            <p className="text-xs text-slate-400 font-medium mt-1">
              Set the rules for lock times and delivery schedule slots to enforce cutoff gates in the customer checkout wizard.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Daily Cutoff Time (e.g. 09:00)</label>
              <input
                type="text"
                value={deliveryForm.cutoffTime}
                onChange={e => setDeliveryForm(f => ({ ...f, cutoffTime: e.target.value }))}
                className="w-full text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Weekly Offset Days (e.g. 1 = Monday cutoff)</label>
              <input
                type="number"
                value={deliveryForm.cutoffDayOffset}
                onChange={e => setDeliveryForm(f => ({ ...f, cutoffDayOffset: e.target.value }))}
                className="w-full text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all"
              />
            </div>
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

        {/* Card 3: Offerings & Tax VAT Settings */}
        <div className="bg-white rounded-3xl border border-[#E7E0D0] p-8 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-black text-slate-900">Offerings & Tax Registry</h3>
            <p className="text-xs text-slate-400 font-medium mt-1">
              Activate offerings such as dinner menus or configure tax details for receipts/invoices.
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
      </div>
    );
  };

  const closePaymentModal = () => {
    setPaymentDrop(null);
    setConfirmPaymentId(null);
  };

  const [y, m, d] = weekDays[0].date.split('-').map(Number);
  const deliveryWeekDateStr = new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <div className="h-full w-full flex bg-[#FAF6EE] text-slate-800 font-sans overflow-hidden">
      {/* PERSISTENT LEFT SIDEBAR */}
      <aside className="w-64 bg-white border-r border-[#E7E0D0] flex flex-col shrink-0">
        {/* Sidebar Header */}
        <div className="p-6 border-b border-[#E7E0D0] flex items-center justify-between">
          <div className="flex items-center gap-3">
            {SYSTEM_CONFIG.businessLogoUrl ? (
              <img src={SYSTEM_CONFIG.businessLogoUrl} alt="Logo" className="size-8 rounded-lg object-cover shadow-sm animate-fade-in" />
            ) : (
              <div className="size-8 bg-primary rounded-lg flex items-center justify-center text-white font-black text-sm">
                {(brandForm.name || 'B').charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="text-xs font-black text-slate-900 leading-none truncate max-w-[120px]">{brandForm.name || SYSTEM_CONFIG.businessName}</h2>
              <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black mt-0.5">Operations</p>
            </div>
          </div>
          <button onClick={onExit} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-colors" title="Exit Console">
            <LogOut className="size-4" />
          </button>
        </div>

        {/* Navigation Section */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          <p className="px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Operations</p>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                tab === t.id ? 'text-primary bg-primary/[0.04] border-l-4 border-primary shadow-[0_4px_12px_rgba(62,125,34,0.04)]' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <t.icon className="size-4 shrink-0" />
              <span>{t.label}</span>
            </button>
          ))}

          <div className="pt-6">
            <p className="px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Configuration</p>
            <button
              onClick={() => setTab('settings')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                tab === 'settings' ? 'text-primary bg-primary/[0.04] border-l-4 border-primary shadow-[0_4px_12px_rgba(62,125,34,0.04)]' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <SettingsIcon className="size-4 shrink-0" />
              <span>Settings</span>
            </button>
          </div>
        </nav>

        {/* Labeled Testing Controls */}
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
      </aside>

      {/* MAIN VIEW AREA */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Header */}
        <header className="shrink-0 bg-white border-b border-[#E7E0D0] px-8 py-4 flex items-center justify-between z-10 shadow-sm">
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

          {tab === 'orders' && (
            <div className="space-y-4">
              {orderedWeekDays.map(d => {
                const dishes = dishesByDay[d.date];
                const isToday = d.key === todayKey;
                return (
                  <div key={d.key} className={`bg-white rounded-3xl shadow-sm p-6 ${isToday ? 'border-2 border-primary/40 shadow-[0_8px_30px_rgba(62,125,34,0.06)]' : 'border border-[#E7E0D0]'}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <p className="text-[10px] font-black uppercase text-primary tracking-widest">{d.label}</p>
                      {isToday && <span className="px-2 py-0.5 rounded bg-primary text-white text-[9px] font-black uppercase tracking-widest animate-pulse">Cook today</span>}
                    </div>
                    {!dishes || Object.keys(dishes).length === 0 ? (
                      <p className="text-xs text-slate-400 font-bold">No orders yet for this day.</p>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {Object.entries(dishes).map(([key, agg]) => {
                          const { qty, revenue, itemId, name, service } = agg as { qty: number; revenue: number; itemId: string; name: string; service: Service };
                          return (
                            <div key={key} className="flex items-center gap-3 py-2.5">
                              <img src={dishPhotoFor(itemId)} alt={name} className="size-9 rounded-lg object-cover shrink-0" />
                              <span className="text-sm font-bold text-slate-700 flex-1 min-w-0 truncate">{name}</span>
                              {service === 'Dinner' && <span className="px-1.5 py-0.5 rounded bg-accent/10 text-accent text-[9px] font-black uppercase shrink-0">Dinner</span>}
                              <span className="text-xs font-black text-slate-900 shrink-0">{qty}x</span>
                              <span className="text-xs font-bold text-slate-400 w-24 text-right shrink-0">{formatCurrency(revenue)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'delivery' && (
            <div className="space-y-4">
              {/* Delivery Filter Card with Week-Range Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-[#E7E0D0] rounded-2xl p-4 shadow-sm">
                <div className="flex gap-1 bg-slate-100 rounded-xl p-1 overflow-x-auto">
                  {weekDays.map(d => (
                    <button
                      key={d.key}
                      onClick={() => setDeliveryDayOverride(d.key)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                        activeDeliveryDay === d.key ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {d.short}{d.key === todayKey ? ' · Today' : ''}
                    </button>
                  ))}
                </div>
                <span className="text-[10px] bg-primary/10 text-primary font-black px-2.5 py-1 rounded-full uppercase tracking-wider self-start sm:self-auto shrink-0">
                  Week of {deliveryWeekDateStr}
                </span>
              </div>

              {filteredDrops.length === 0 ? (
                <EmptyState icon={<Truck className="size-10" />} label={`No deliveries ${activeDeliveryDay === todayKey ? 'today' : 'that day'}`} />
              ) : (
                <div className="space-y-4">
                  {filteredDrops.map(drop => {
                    const cust = getCustomer(drop.customerName);
                    const addr = cust?.addresses.find(a => a.id === drop.items[0]?.deliveryAddressId);
                    return (
                      <div key={drop.key} className="bg-white rounded-3xl border border-[#E7E0D0] shadow-sm p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 hover:shadow-md transition-all">
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-black text-slate-900 leading-none">{drop.customerName}</h3>
                            {drop.slot && <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-bold">{drop.slot}</span>}
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                              drop.paymentStatus === 'Paid' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                            }`}>
                              {drop.paymentStatus === 'Paid' ? 'Paid' : 'Unpaid'}
                            </span>
                          </div>
                          
                          <p className="text-xs text-slate-500 font-medium">
                            {drop.items.map(i => `${i.qty}x ${i.name}`).join(', ')}
                          </p>

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
                        <button
                          onClick={() => handleMarkDelivered(drop)}
                          className="shrink-0 px-6 py-3 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-primary/95 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 className="size-4" /> Mark Delivered
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'payments' && (
            <div className="space-y-6">
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
                              <p className="text-xs text-slate-500 font-medium">{drop.items.map(i => `${i.qty}x ${i.name}`).join(', ')}</p>
                              <p className="text-sm font-black text-primary mt-1">{formatCurrency(drop.total)}</p>
                              {drop.claimedMethod && (
                                <p className="text-[11px] text-[#B4703A] font-bold mt-1 bg-[#B4703A]/5 px-2.5 py-1 rounded-lg border border-[#B4703A]/10 inline-block">
                                  Customer claimed: {drop.claimedMethod}{drop.claimedReference ? ` (Ref: ${drop.claimedReference})` : ''}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => setPaymentDrop(drop)}
                              className="shrink-0 px-6 py-3 bg-warning text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-warning/95 active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                              <Banknote className="size-4" /> Mark Paid
                            </button>
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
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-base font-black text-slate-900">{drop.customerName}</h3>
                          {drop.date && <span className="text-[10px] font-bold text-slate-400">{formatDay(drop.date)}{drop.slot ? ` · ${drop.slot}` : ''}</span>}
                        </div>
                        <p className="text-xs text-slate-500 font-medium">{drop.items.map(i => `${i.qty}x ${i.name}`).join(', ')}</p>
                        <p className="text-sm font-black text-primary mt-1">{formatCurrency(drop.total)}</p>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredCustomers.map(c => {
                    const orderCount = orders.filter(o => o.customerName === c.name).length;
                    return (
                      <div key={c.id} className="bg-white rounded-3xl border border-[#E7E0D0] shadow-sm p-6 flex flex-col justify-between hover:shadow-md transition-all">
                        <div>
                          <div className="flex items-center gap-3 mb-4">
                            <img src={c.avatar} alt={c.name} className="size-12 rounded-full border-2 border-slate-100 animate-fade-in" />
                            <div className="min-w-0">
                              <p className="text-sm font-black text-slate-900 truncate">{c.name}</p>
                              {c.tier && (
                                <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-primary">
                                  <Star className="size-3" /> {c.tier}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="space-y-1.5 text-xs text-slate-500 font-medium">
                            <p className="flex items-center gap-2"><Phone className="size-3.5 text-slate-300 shrink-0" /> {c.phone}</p>
                            <p className="flex items-center gap-2"><Mail className="size-3.5 text-slate-300 shrink-0 truncate" /> {c.email}</p>
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                            <div className="bg-[#FAF9F5] rounded-xl p-2 border border-[#E7E0D0]">
                              <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Points</p>
                              <p className="text-sm font-black text-slate-900 mt-0.5">{c.points}</p>
                            </div>
                            <div className="bg-[#FAF9F5] rounded-xl p-2 border border-[#E7E0D0]">
                              <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Credit</p>
                              <p className="text-sm font-black text-success mt-0.5">{formatCurrency(c.storeCredit || 0)}</p>
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                          <span className="text-slate-400">{orderCount} order{orderCount === 1 ? '' : 's'}</span>
                          <span className="text-slate-900">{formatCurrency(c.ltv)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

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

      {/* Collect Payment Modal */}
      {paymentDrop && (
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
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        if (isConfirming) {
                          markPaid(paymentDrop, m);
                          setConfirmPaymentId(null);
                        } else {
                          setConfirmPaymentId(m.id);
                        }
                      }}
                      className={`p-5 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                        isConfirming
                          ? 'border-warning bg-warning/10 text-warning-700 animate-pulse'
                          : paymentDrop.claimedMethod === m.name
                          ? 'border-primary text-primary bg-primary/[0.02]'
                          : 'border-slate-100 bg-white text-slate-500 hover:border-primary hover:text-primary hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-2xl">{m.icon}</span>
                      <span className="text-[10px] font-black uppercase tracking-widest">
                        {isConfirming ? 'Confirm ' + m.name + '?' : m.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
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
