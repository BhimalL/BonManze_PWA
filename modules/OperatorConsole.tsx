
import React, { useState, useEffect, useMemo } from 'react';
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
  Clock
} from 'lucide-react';
import { Order, OrderItem, Customer, PaymentMethod } from '../types';
import {
  subscribeToOrders,
  updateOrderStatus,
  updateOrderItemStatus,
  updateOrderPayment,
  updateOrderItemsPayment,
  subscribeToCustomers,
  subscribeToPaymentMethods,
  subscribeToSystemDate,
  updateSystemDate,
  MOCK_TODAY,
  WEEKDAY_KEYS,
  WEEKLY_CURRY_MENU,
  dishPhotoFor,
  formatCurrency,
  MEAL_PLAN_PAYMENT_METHOD_NAMES
} from './store';

interface OperatorConsoleProps {
  onExit: () => void;
}

type Tab = 'menu' | 'orders' | 'delivery' | 'payments' | 'customers';

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
  isMealPlan: boolean;
  // What the customer told the app when they picked a payment method —
  // a claim, not a confirmed payment. Lets Operations match a Juice/MauCAS
  // transfer against a bank/wallet statement before confirming.
  claimedMethod?: string;
  claimedReference?: string;
}

const getThisWeekDays = (systemDateStr: string) => {
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
    return { key, date: iso, label: dt.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) };
  });
};

const OperatorConsole: React.FC<OperatorConsoleProps> = ({ onExit }) => {
  const [tab, setTab] = useState<Tab>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [systemDate, setSystemDate] = useState(MOCK_TODAY);
  const [paymentDrop, setPaymentDrop] = useState<DropTask | null>(null);

  useEffect(() => {
    const u1 = subscribeToOrders(setOrders);
    const u2 = subscribeToCustomers(setCustomers);
    const u3 = subscribeToPaymentMethods(setPaymentMethods);
    const u4 = subscribeToSystemDate(setSystemDate);
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  const weekDays = useMemo(() => getThisWeekDays(systemDate), [systemDate]);

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

  // --- Orders by Dish ---
  const dishesByDay = useMemo(() => {
    const days: Record<string, Record<string, { qty: number; revenue: number }>> = {};
    lines.forEach(({ item }) => {
      const day = item.deliveryDate || 'Unscheduled';
      if (!days[day]) days[day] = {};
      if (!days[day][item.name]) days[day][item.name] = { qty: 0, revenue: 0 };
      days[day][item.name].qty += item.qty;
      days[day][item.name].revenue += item.qty * item.price;
    });
    return days;
  }, [lines]);

  const sortedDays = useMemo(() => {
    return Object.keys(dishesByDay).sort((a, b) => {
      if (a === 'Unscheduled') return 1;
      if (b === 'Unscheduled') return -1;
      return a.localeCompare(b);
    });
  }, [dishesByDay]);

  // --- Delivery List (one card per order/day/slot "drop") ---
  const drops = useMemo(() => {
    const map: Record<string, DropTask> = {};
    orders.forEach(o => {
      if (o.type === 'Meal Plan') {
        o.items.forEach(item => {
          if (item.status === 'Cancelled' || item.status === 'Completed') return;
          const key = `${o.id}-${item.deliveryDate || ''}-${item.serviceSlot || ''}`;
          if (!map[key]) {
            map[key] = {
              key, orderId: o.id, customerName: o.customerName,
              date: item.deliveryDate, slot: item.serviceSlot,
              items: [], total: 0, paymentStatus: 'Paid', isMealPlan: true
            };
          }
          map[key].items.push(item);
          map[key].total += item.qty * item.price;
          if (item.paymentStatus === 'Pending') map[key].paymentStatus = 'Pending';
        });
      } else if (o.status !== 'Completed' && o.status !== 'Cancelled') {
        map[o.id] = {
          key: o.id, orderId: o.id, customerName: o.customerName,
          date: undefined, slot: undefined,
          items: o.items, total: o.total, paymentStatus: o.paymentStatus, isMealPlan: false
        };
      }
    });
    return Object.values(map).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }, [orders]);

  // --- Payments: same drop shape, but every open balance regardless of delivery status ---
  const paymentDrops = useMemo(() => {
    const map: Record<string, DropTask> = {};
    orders.forEach(o => {
      if (o.type === 'Meal Plan') {
        o.items.forEach(item => {
          if (item.status === 'Cancelled') return;
          const key = `${o.id}-${item.deliveryDate || ''}-${item.serviceSlot || ''}`;
          if (!map[key]) {
            map[key] = {
              key, orderId: o.id, customerName: o.customerName,
              date: item.deliveryDate, slot: item.serviceSlot,
              items: [], total: 0, paymentStatus: 'Paid', isMealPlan: true
            };
          }
          map[key].items.push(item);
          map[key].total += item.qty * item.price;
          if (item.paymentStatus === 'Pending') map[key].paymentStatus = 'Pending';
          if (item.paymentStatus !== 'Paid' && item.paymentMethodName && !map[key].claimedMethod) {
            map[key].claimedMethod = item.paymentMethodName;
            map[key].claimedReference = item.paymentReference;
          }
        });
      } else {
        map[o.id] = {
          key: o.id, orderId: o.id, customerName: o.customerName,
          date: undefined, slot: undefined,
          items: o.items, total: o.total, paymentStatus: o.paymentStatus, isMealPlan: false
        };
      }
    });
    return Object.values(map).sort((a, b) => (a.paymentStatus === 'Pending' ? -1 : 1));
  }, [orders]);

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
    if (drop.isMealPlan) {
      drop.items.forEach(i => updateOrderItemStatus(drop.orderId, i.itemId, drop.date || '', drop.slot || '', 'Completed'));
    } else {
      updateOrderStatus(drop.orderId, 'Completed');
    }
  };

  const markPaid = (drop: DropTask, method: PaymentMethod) => {
    if (drop.isMealPlan) {
      updateOrderItemsPayment(drop.orderId, drop.date || '', drop.slot, method.type, method.name);
    } else {
      updateOrderPayment(drop.orderId, 'Paid', method.type, method.name);
    }
    setPaymentDrop(null);
  };

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar bg-[#f8fafb]">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onExit} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-all">
            <ArrowLeft className="size-5" />
          </button>
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none">Operator Console</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-0.5">BonManzE</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-slate-400 text-xs font-bold">
          <Calendar className="size-4" />
          <input
            type="date"
            value={systemDate}
            onChange={(e) => updateSystemDate(e.target.value)}
            title="Test / demo date — advances what counts as 'today' for delivery filtering elsewhere in the app"
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
              <h2 className="text-base font-black text-slate-900 mb-4">This Week's Curry Menu</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {weekDays.map(d => (
                  <div key={d.key} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-3">{d.label}</p>
                    <div className="space-y-2">
                      {WEEKLY_CURRY_MENU[d.key].map(c => (
                        <div key={c.id} className="flex items-center gap-2">
                          <img src={dishPhotoFor(c.id)} alt={c.name} className="size-9 rounded-lg object-cover shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-800 truncate">{c.emoji} {c.name}</p>
                          </div>
                          <span className="text-[10px] font-black text-slate-400 shrink-0">{formatCurrency(c.price)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-4">
                Fixed weekly menu for now — editing next week's curries here is the next piece of work, not built yet.
              </p>
            </div>
          </div>
        )}

        {tab === 'orders' && (
          <div className="space-y-4">
            {sortedDays.length === 0 ? (
              <EmptyState icon={<ClipboardList className="size-10" />} label="No orders yet" />
            ) : sortedDays.map(day => (
              <div key={day} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
                <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-3">{formatDay(day)}</p>
                <div className="divide-y divide-slate-100">
                  {Object.entries(dishesByDay[day]).map(([name, agg]) => {
                    const { qty, revenue } = agg as { qty: number; revenue: number };
                    return (
                      <div key={name} className="flex items-center justify-between py-2.5">
                        <span className="text-sm font-bold text-slate-700">{name}</span>
                        <div className="flex items-center gap-6">
                          <span className="text-xs font-black text-slate-900">{qty}x</span>
                          <span className="text-xs font-bold text-slate-400 w-24 text-right">{formatCurrency(revenue)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'delivery' && (
          <div className="space-y-4">
            {drops.length === 0 ? (
              <EmptyState icon={<Truck className="size-10" />} label="No pending deliveries" />
            ) : drops.map(drop => {
              const customer = getCustomer(drop.customerName);
              const address = customer?.addresses?.[0];
              return (
                <div key={drop.key} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
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

            <div className="space-y-3">
              {paymentDrops.length === 0 ? (
                <EmptyState icon={<Wallet className="size-10" />} label="No orders yet" />
              ) : paymentDrops.map(drop => (
                <div key={drop.key} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-black text-slate-900">{drop.customerName}</h3>
                      {drop.date && <span className="text-[10px] font-bold text-slate-400">{formatDay(drop.date)}{drop.slot ? ` · ${drop.slot}` : ''}</span>}
                    </div>
                    <p className="text-xs text-slate-500 font-medium">{drop.items.map(i => `${i.qty}x ${i.name}`).join(', ')}</p>
                    <p className="text-sm font-black text-primary mt-1">{formatCurrency(drop.total)}</p>
                    {drop.paymentStatus === 'Pending' && drop.claimedMethod && (
                      <p className="text-[11px] text-warning font-bold mt-1">
                        Customer says: {drop.claimedMethod}{drop.claimedReference ? ` · ${drop.claimedReference}` : ''}
                      </p>
                    )}
                  </div>
                  {drop.paymentStatus === 'Pending' ? (
                    <button
                      onClick={() => setPaymentDrop(drop)}
                      className="shrink-0 px-6 py-3 bg-warning text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-warning/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <Banknote className="size-4" /> Mark Paid
                    </button>
                  ) : (
                    <span className="shrink-0 px-4 py-2 bg-success/10 text-success rounded-xl text-[10px] font-black uppercase tracking-widest">Paid</span>
                  )}
                </div>
              ))}
            </div>
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
                  <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
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

export default OperatorConsole;
