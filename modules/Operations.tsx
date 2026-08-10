
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
  ChevronUp
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
  subscribeToWeeklyMenu,
  updateCurryOption,
  subscribeToDinnerMenu,
  updateDinnerCurryOption,
  WEEKLY_DINNER_MENU,
  MOCK_TODAY,
  WEEKDAY_KEYS,
  WeekdayKey,
  WEEKLY_CURRY_MENU,
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

type Tab = 'menu' | 'orders' | 'delivery' | 'payments' | 'customers';

// Which offering a curry-menu edit applies to — Dinner is a second,
// independently toggleable offering that otherwise mirrors Lunch exactly.
type Service = 'Lunch' | 'Dinner';

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: 'menu', label: "This Week's Menu", icon: BookOpen },
  { id: 'orders', label: 'Orders by Dish', icon: ClipboardList },
  { id: 'delivery', label: 'Delivery List', icon: Truck },
  { id: 'payments', label: 'Payments', icon: Wallet },
  { id: 'customers', label: 'Customers', icon: Users },
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

const Operations: React.FC<OperationsProps> = ({ onExit }) => {
  const [tab, setTab] = useState<Tab>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [systemDate, setSystemDate] = useState(MOCK_TODAY);
  const [weeklyMenu, setWeeklyMenu] = useState(WEEKLY_CURRY_MENU);
  const [dinnerMenu, setDinnerMenu] = useState(WEEKLY_DINNER_MENU);
  const [paymentDrop, setPaymentDrop] = useState<DropTask | null>(null);

  // Which curry is being edited inline on the Menu tab, plus its draft
  // values — Save calls updateCurryOption/updateDinnerCurryOption depending
  // on `service`, Cancel just clears this.
  const [editingCurry, setEditingCurry] = useState<{ day: WeekdayKey; curryId: string; service: Service } | null>(null);
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
    logoUrl: SYSTEM_CONFIG.businessLogoUrl
  });

  useEffect(() => {
    const u1 = subscribeToOrders(setOrders);
    const u2 = subscribeToCustomers(setCustomers);
    const u3 = subscribeToPaymentMethods(setPaymentMethods);
    const u4 = subscribeToSystemDate(setSystemDate);
    const u5 = subscribeToWeeklyMenu(setWeeklyMenu);
    const u6 = subscribeToConfig(() => {
      setVatEnabledLocal(SYSTEM_CONFIG.vatEnabled);
      setVatRateInput(String(SYSTEM_CONFIG.vatRate));
      setVatNumberInput(SYSTEM_CONFIG.vatNumber);
      setBrandForm({ name: SYSTEM_CONFIG.businessName, tagline: SYSTEM_CONFIG.businessTagline, logoUrl: SYSTEM_CONFIG.businessLogoUrl });
      setDinnerEnabledLocal(SYSTEM_CONFIG.dinnerEnabled);
    });
    const u7 = subscribeToDinnerMenu(setDinnerMenu);
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); };
  }, []);

  const toggleVat = (next: boolean) => updateSystemConfig({ vatEnabled: next });
  const toggleDinner = (next: boolean) => updateSystemConfig({ dinnerEnabled: next });
  const saveVatDetails = () => {
    const parsedRate = parseFloat(vatRateInput);
    updateSystemConfig({
      vatRate: isNaN(parsedRate) ? SYSTEM_CONFIG.vatRate : parsedRate,
      vatNumber: vatNumberInput.trim()
    });
  };
  const saveBranding = () => {
    updateSystemConfig({
      businessName: brandForm.name.trim() || SYSTEM_CONFIG.businessName,
      businessTagline: brandForm.tagline.trim(),
      businessLogoUrl: brandForm.logoUrl.trim()
    });
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

  const getCustomer = (name: string) => customers.find(c => c.name === name);

  const handleMarkDelivered = (drop: DropTask) => {
    drop.items.forEach(i => updateOrderItemStatus(drop.orderId, i.itemId, drop.date || '', drop.slot || '', 'Completed'));
  };

  const markPaid = (drop: DropTask, method: PaymentMethod) => {
    updateOrderItemsPayment(drop.orderId, drop.date || '', drop.slot, method.type, method.name);
    setPaymentDrop(null);
  };

  const startEditCurry = (day: WeekdayKey, curry: CurryOption, service: Service = 'Lunch') => {
    setEditingCurry({ day, curryId: curry.id, service });
    setEditForm({ name: curry.name, desc: curry.desc, price: String(curry.price) });
  };

  const saveCurryEdit = () => {
    if (!editingCurry) return;
    const menu = editingCurry.service === 'Dinner' ? dinnerMenu : weeklyMenu;
    const update = editingCurry.service === 'Dinner' ? updateDinnerCurryOption : updateCurryOption;
    const existing = menu[editingCurry.day].find(c => c.id === editingCurry.curryId);
    const parsedPrice = parseInt(editForm.price, 10);
    update(editingCurry.day, editingCurry.curryId, {
      name: editForm.name.trim() || existing?.name || '',
      desc: editForm.desc.trim(),
      price: isNaN(parsedPrice) ? (existing?.price || 0) : parsedPrice
    });
    setEditingCurry(null);
  };

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar bg-[#f8fafb]">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onExit} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-all">
            <ArrowLeft className="size-5" />
          </button>
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none">Operations</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-0.5">BonManzE</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-slate-400 text-xs font-bold">
          <Calendar className="size-4" />
          <input
            type="date"
            value={systemDate}
            onChange={(e) => updateSystemDate(e.target.value)}
            title="Sets what counts as 'today' across BonManzE — drives the cutoff on the Customer App and which day Orders/Delivery highlight here."
            className="bg-transparent outline-none font-mono"
          />
        </div>
      </header>

      <nav className="px-6 pt-4 flex gap-2 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              tab === t.id ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <t.icon className="size-4" />
            {t.label}
          </button>
        ))}
      </nav>

      <main className="p-6 space-y-6">
        {tab === 'menu' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-black text-slate-900">Dinner offering</h3>
                  <p className="text-xs text-slate-400 font-medium mt-1 max-w-sm">
                    Dinner works exactly like Lunch — its own weekly menu below, same 9:00 AM same-day cutoff on the Customer App. Turn it off to hide it from customers entirely.
                  </p>
                </div>
                <button
                  onClick={() => toggleDinner(!dinnerEnabled)}
                  aria-label="Toggle Dinner offering"
                  className={`shrink-0 relative w-12 h-7 rounded-full transition-colors ${dinnerEnabled ? 'bg-primary' : 'bg-slate-200'}`}
                >
                  <span className={`absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform ${dinnerEnabled ? 'translate-x-5' : ''}`} />
                </button>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-base font-black text-slate-900 mb-4">This Week's Curry Menu — Lunch</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {weekDays.map(d => (
                  <div key={d.key} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-3">{d.label}</p>
                    <div className="space-y-2">
                      {weeklyMenu[d.key].map(c => {
                        const isEditing = editingCurry?.day === d.key && editingCurry.curryId === c.id && editingCurry.service === 'Lunch';
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
                            <button onClick={() => startEditCurry(d.key, c, 'Lunch')} className="p-1 text-slate-300 hover:text-primary shrink-0">
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

            {dinnerEnabled && (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
                <h2 className="text-base font-black text-slate-900 mb-4">This Week's Curry Menu — Dinner</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                  {weekDays.map(d => (
                    <div key={d.key} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-3">{d.label}</p>
                      <div className="space-y-2">
                        {dinnerMenu[d.key].map(c => {
                          const isEditing = editingCurry?.day === d.key && editingCurry.curryId === c.id && editingCurry.service === 'Dinner';
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
                              <button onClick={() => startEditCurry(d.key, c, 'Dinner')} className="p-1 text-slate-300 hover:text-primary shrink-0">
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
        )}

        {tab === 'orders' && (
          <div className="space-y-4">
            {orderedWeekDays.map(d => {
              const dishes = dishesByDay[d.date];
              const isToday = d.key === todayKey;
              return (
                <div key={d.key} className={`bg-white rounded-3xl shadow-sm p-6 ${isToday ? 'border-2 border-primary/40' : 'border border-slate-200'}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <p className="text-[10px] font-black uppercase text-primary tracking-widest">{d.label}</p>
                    {isToday && <span className="px-2 py-0.5 rounded bg-primary text-white text-[9px] font-black uppercase tracking-widest">Cook today</span>}
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
            <div className="flex gap-2 overflow-x-auto pb-1">
              {weekDays.map(d => (
                <button
                  key={d.key}
                  onClick={() => setDeliveryDayOverride(d.key)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    activeDeliveryDay === d.key ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {d.short}{d.key === todayKey ? ' · Today' : ''}
                </button>
              ))}
            </div>
            {filteredDrops.length === 0 ? (
              <EmptyState icon={<Truck className="size-10" />} label={`No deliveries ${activeDeliveryDay === todayKey ? 'today' : 'that day'}`} />
            ) : filteredDrops.map(drop => {
              const customer = getCustomer(drop.customerName);
              const address = customer?.addresses?.[0];
              return (
                <div key={drop.key} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <img src={dishPhotoFor(drop.items[0]?.itemId || '')} className="size-11 rounded-xl object-cover shrink-0 hidden sm:block" alt="" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-base font-black text-slate-900">{drop.customerName}</h3>
                        {drop.slot && <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest">{drop.slot}</span>}
                        {drop.date && <span className="text-[10px] font-bold text-slate-400">{formatDay(drop.date)}</span>}
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter ${drop.paymentStatus === 'Pending' ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`}>
                          {drop.paymentStatus === 'Pending' ? 'Unpaid' : 'Paid'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium mb-1">{drop.items.map(i => `${i.qty}x ${i.name}`).join(', ')}</p>
                      {address && (
                        <p className="flex items-center gap-1.5 text-[11px] text-slate-400 font-bold">
                          <MapPin className="size-3" /> {address.street}, {address.city}
                        </p>
                      )}
                      <p className="text-sm font-black text-primary mt-1">{formatCurrency(drop.total)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleMarkDelivered(drop)}
                    className="shrink-0 px-6 py-3 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="size-4" /> Mark Delivered
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'payments' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
              <h3 className="text-sm font-black text-slate-900 mb-1">Business branding</h3>
              <p className="text-xs text-slate-400 font-medium mb-4">Shown on the Customer App header, login screen, and every receipt/invoice.</p>
              <div className="flex items-start gap-4">
                <div className="shrink-0">
                  {brandForm.logoUrl ? (
                    <img src={brandForm.logoUrl} alt="Logo preview" className="size-14 rounded-xl object-cover border border-slate-200" />
                  ) : (
                    <div className="size-14 rounded-xl bg-primary flex items-center justify-center text-white text-xl font-black">
                      {(brandForm.name || 'B').charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1.5">Business name</label>
                    <input
                      value={brandForm.name}
                      onChange={e => setBrandForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1.5">Tagline</label>
                    <input
                      value={brandForm.tagline}
                      onChange={e => setBrandForm(f => ({ ...f, tagline: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1.5">Logo</label>
                    <input ref={logoFileInputRef} type="file" accept="image/*" onChange={handleLogoFileChange} className="hidden" />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => logoFileInputRef.current?.click()}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                      >
                        Upload image
                      </button>
                      {brandForm.logoUrl && (
                        <button type="button" onClick={() => setBrandForm(f => ({ ...f, logoUrl: '' }))} className="text-xs font-bold text-danger">
                          Remove
                        </button>
                      )}
                    </div>
                    {logoError && <p className="text-[11px] text-danger font-bold mt-1.5">{logoError}</p>}
                    <p className="text-[10px] text-slate-400 mt-2 mb-1">Or paste an image URL:</p>
                    <input
                      value={brandForm.logoUrl.startsWith('data:') ? '' : brandForm.logoUrl}
                      onChange={e => setBrandForm(f => ({ ...f, logoUrl: e.target.value }))}
                      placeholder="https://... (leave blank to use the default mark)"
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <button onClick={saveBranding} className="sm:col-span-2 py-2.5 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest">
                    Save branding
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-black text-slate-900">VAT</h3>
                  <p className="text-xs text-slate-400 font-medium mt-1 max-w-sm">
                    Mauritius only allows VAT to be charged once turnover passes MUR 3M/year (or you've voluntarily registered). Leave this off until BonManzE is actually VAT-registered with the MRA.
                  </p>
                </div>
                <button
                  onClick={() => toggleVat(!vatEnabled)}
                  aria-label="Toggle VAT"
                  className={`shrink-0 relative w-12 h-7 rounded-full transition-colors ${vatEnabled ? 'bg-primary' : 'bg-slate-200'}`}
                >
                  <span className={`absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform ${vatEnabled ? 'translate-x-5' : ''}`} />
                </button>
              </div>

              {vatEnabled && (
                <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-100">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1.5">VAT rate (%)</label>
                    <input
                      type="number"
                      value={vatRateInput}
                      onChange={e => setVatRateInput(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1.5">VRN (VAT reg. no.)</label>
                    <input
                      value={vatNumberInput}
                      onChange={e => setVatNumberInput(e.target.value)}
                      placeholder="e.g. VAT12345678"
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <button onClick={saveVatDetails} className="col-span-2 py-2.5 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest">
                    Save VAT details
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Collected</p>
                <p className="text-2xl font-black text-success">{formatCurrency(paymentSummary.collected)}</p>
              </div>
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
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
                        <div key={drop.key} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-base font-black text-slate-900">{drop.customerName}</h3>
                              {drop.slot && <span className="text-[10px] font-bold text-slate-400">{drop.slot}</span>}
                            </div>
                            <p className="text-xs text-slate-500 font-medium">{drop.items.map(i => `${i.qty}x ${i.name}`).join(', ')}</p>
                            <p className="text-sm font-black text-primary mt-1">{formatCurrency(drop.total)}</p>
                            {drop.claimedMethod && (
                              <p className="text-[11px] text-warning font-bold mt-1">
                                Customer says: {drop.claimedMethod}{drop.claimedReference ? ` · ${drop.claimedReference}` : ''}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => setPaymentDrop(drop)}
                            className="shrink-0 px-6 py-3 bg-warning text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-warning/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
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
              className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-500"
            >
              <span>{paidDrops.length} paid</span>
              {showPaidHistory ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
            {showPaidHistory && (
              <div className="space-y-3">
                {paidDrops.map(drop => (
                  <div key={drop.key} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-black text-slate-900">{drop.customerName}</h3>
                        {drop.date && <span className="text-[10px] font-bold text-slate-400">{formatDay(drop.date)}{drop.slot ? ` · ${drop.slot}` : ''}</span>}
                      </div>
                      <p className="text-xs text-slate-500 font-medium">{drop.items.map(i => `${i.qty}x ${i.name}`).join(', ')}</p>
                      <p className="text-sm font-black text-primary mt-1">{formatCurrency(drop.total)}</p>
                    </div>
                    <span className="shrink-0 px-4 py-2 bg-success/10 text-success rounded-xl text-[10px] font-black uppercase tracking-widest">Paid</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'customers' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {customers.length === 0 ? (
              <EmptyState icon={<Users className="size-10" />} label="No customers yet" />
            ) : customers.map(c => {
              const orderCount = orders.filter(o => o.customerName === c.name).length;
              return (
                <div key={c.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <img src={c.avatar} alt={c.name} className="size-12 rounded-full border-2 border-slate-100" />
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
                    <p className="flex items-center gap-2"><Phone className="size-3.5 text-slate-300" /> {c.phone}</p>
                    <p className="flex items-center gap-2"><Mail className="size-3.5 text-slate-300" /> {c.email}</p>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                    <div className="bg-slate-50 rounded-xl p-2">
                      <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Points</p>
                      <p className="text-sm font-black text-slate-900">{c.points}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-2">
                      <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Credit</p>
                      <p className="text-sm font-black text-success">{formatCurrency(c.storeCredit || 0)}</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                    <span className="text-slate-400">{orderCount} order{orderCount === 1 ? '' : 's'}</span>
                    <span className="text-slate-900">{formatCurrency(c.ltv)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {paymentDrop && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900">Collect Payment</h2>
              <button onClick={() => setPaymentDrop(null)} className="p-2 text-slate-400 hover:text-danger">
                <X className="size-5" />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="text-center">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">{paymentDrop.customerName}</p>
                <p className="text-4xl font-black text-slate-900 tracking-tight">{formatCurrency(paymentDrop.total)}</p>
                {paymentDrop.claimedMethod && (
                  <div className="mt-3 inline-block bg-warning/10 text-warning rounded-xl px-4 py-2 text-xs font-bold">
                    Customer says: {paymentDrop.claimedMethod}
                    {paymentDrop.claimedReference && <><br /><span className="font-mono">{paymentDrop.claimedReference}</span></>}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {paymentMethods.filter(m => m.isActive && MEAL_PLAN_PAYMENT_METHOD_NAMES.includes(m.name)).map(m => (
                  <button
                    key={m.id}
                    onClick={() => markPaid(paymentDrop, m)}
                    className={`p-5 rounded-2xl border-2 bg-white transition-all flex flex-col items-center gap-2 ${paymentDrop.claimedMethod === m.name ? 'border-primary text-primary' : 'border-slate-100 text-slate-500 hover:border-primary hover:text-primary'}`}
                  >
                    <span className="text-2xl">{m.icon}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest">{m.name}</span>
                  </button>
                ))}
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
