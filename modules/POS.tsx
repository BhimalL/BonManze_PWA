
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Store, Package, ShoppingBag, Calendar, CalendarDays, Search, Users, User, Gift, Info, ShoppingCart, 
  Plus, Minus, Edit, CheckCircle2, X, ChevronDown, ArrowRight, Clock, Loader2, Trash2, CalendarCheck, 
  Utensils, AlertTriangle, LogIn, CookingPot, Flame, Check, Database, Filter, UserCheck, Lock, Wallet, Truck,
  UserPlus, UserSearch, ClipboardList, ChevronRight, UserCircle2, ShieldCheck, MapPin,
  PanelRightClose, PanelRightOpen, Percent, BadgePercent, Coffee, Sun, Moon, Cake
} from 'lucide-react';
import { MenuItem, Table, Reservation, Customer, Order, OrderItem } from '../types';
import { 
  MEAL_LIBRARY_ITEMS, SYSTEM_CONFIG, subscribeToConfig, getDayMenu, subscribeToOrders, 
  subscribeToPosCarts, updatePosCart, clearPosCart, appendToTableOrder, addOrder, 
  PosCartItem, PosSession, updatePosSession, MOCK_TODAY, updateOrderStatus,
  markOrderTerminalClosed, subscribeToCustomers, addCustomerRecord, formatCurrency, getTaxRate, calculateTotal,
  LOYALTY_TIERS, CUSTOMER_GROUPS, subscribeToLoyaltyTiers, subscribeToCustomerGroups, subscribeToSystemDate,
  cancelOrderItem, subscribeToMealLibrary
} from './store';

const INITIAL_TABLES: Table[] = [
  { id: 't1', name: '01', capacity: 2, status: 'Available', section: 'Main Hall' },
  { id: 't2', name: '02', capacity: 2, status: 'Occupied', section: 'Main Hall' },
  { id: 't3', name: '03', capacity: 4, status: 'Available', section: 'Main Hall' },
  { id: 't4', name: '04', capacity: 4, status: 'Available', section: 'Main Hall' },
  { id: 't5', name: '05', capacity: 6, status: 'Available', section: 'Main Hall' },
  { id: 't10', name: '10', capacity: 2, status: 'Available', section: 'Terrace' },
  { id: 't11', name: '11', capacity: 4, status: 'Dirty', section: 'Terrace' },
  { id: 't20', name: 'VIP', capacity: 8, status: 'Available', section: 'VIP' },
];

const INITIAL_RESERVATIONS: Reservation[] = [
  { id: 'r1', customerName: 'John Wick', tableId: '04', time: '19:00', guests: 2, status: 'Confirmed', preOrders: [] },
  { id: 'r2', customerName: 'Sarah Connor', tableId: '11', time: '20:00', guests: 4, status: 'Confirmed', preOrders: [] }
];

const POS: React.FC<{ onNavigate: (module: any) => void; isEmbedded?: boolean }> = ({ onNavigate, isEmbedded }) => {
  const [activeView, setActiveView] = useState<'dine-in' | 'takeout' | 'meal-plan'>('dine-in');
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [reservations, setReservations] = useState<Reservation[]>(INITIAL_RESERVATIONS);
  const [sessionCarts, setSessionCarts] = useState<Record<string, PosSession>>({});
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);
  const [isReservationListOpen, setIsReservationListOpen] = useState(false);
  const [isQuickAddModalOpen, setIsQuickAddModalOpen] = useState(false);
  const [isCheckoutSuccess, setIsCheckoutSuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [config, setConfig] = useState(SYSTEM_CONFIG);
  const [isCartCollapsed, setIsCartCollapsed] = useState(false);
  const [systemDate, setSystemDate] = useState(MOCK_TODAY);
  
  // Reactive Data
  const [menuItems, setMenuItems] = useState<MenuItem[]>(MEAL_LIBRARY_ITEMS);
  const [loyaltyTiers, setLoyaltyTiers] = useState(LOYALTY_TIERS);
  const [customerGroups, setCustomerGroups] = useState(CUSTOMER_GROUPS);

  // Quick Add State
  const [quickAddForm, setQuickAddForm] = useState({ firstName: '', lastName: '', phone: '', email: '', street: '', city: '', zip: '' });

  // Reservation Edit State
  const [editingRes, setEditingRes] = useState<Partial<Reservation> | null>(null);
  const [resSearchQuery, setResSearchQuery] = useState('');
  
  // Meal Plan State
  const [mealSelections, setMealSelections] = useState<{ [key: string]: { [itemId: string]: number } }>({});
  const [planView, setPlanView] = useState<'current' | 'next'>('current');
  const [paymentPreference, setPaymentPreference] = useState<'upfront' | 'per-delivery'>('upfront');
  
  // Takeout Fulfillment State
  const [fulfillmentType, setFulfillmentType] = useState<'pickup' | 'delivery'>('pickup');

  useEffect(() => {
    const unsubPos = subscribeToPosCarts(setSessionCarts);
    const unsubOrders = subscribeToOrders(setOrders);
    const unsubCustomers = subscribeToCustomers(setCustomers);
    const unsubConfig = subscribeToConfig(() => setConfig({...SYSTEM_CONFIG}));
    const unsubLoyalty = subscribeToLoyaltyTiers(setLoyaltyTiers);
    const unsubGroups = subscribeToCustomerGroups(setCustomerGroups);
    const unsubDate = subscribeToSystemDate(setSystemDate);
    const unsubMeals = subscribeToMealLibrary(setMenuItems);
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    
    return () => { 
      unsubPos(); unsubOrders(); unsubCustomers(); unsubConfig(); unsubLoyalty(); unsubGroups(); unsubDate(); unsubMeals(); clearInterval(timer);
    };
  }, []);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(menuItems.map(m => m.category))).filter(Boolean).sort();
    return ['All', ...cats];
  }, [menuItems]);

  const currentCartKey = useMemo(() => {
    if (activeView === 'dine-in') return selectedTable ? `table-${selectedTable.name}` : '';
    return activeView;
  }, [activeView, selectedTable]);

  const currentSession = sessionCarts[currentCartKey] || { items: [], customer: 'walk-in' };
  const selectedCustomer = currentSession.customer;

  // Check if today is selected customer's birthday
  const isCustBirthdayToday = useMemo(() => {
     if (!selectedCustomer || selectedCustomer === 'walk-in' || !selectedCustomer.birthday) return false;
     const [_, bM, bD] = selectedCustomer.birthday.split('-').map(Number);
     const [__, sM, sD] = systemDate.split('-').map(Number);
     return bM === sM && bD === sD;
  }, [selectedCustomer, systemDate]);

  const cart = useMemo(() => {
    const sessionItems = currentSession.items;
    if (activeView !== 'dine-in' || !selectedTable) return sessionItems;

    const tableOrder = orders.find(o => 
      o.tableId === selectedTable.name && 
      o.status !== 'Completed' && 
      o.status !== 'Cancelled'
    );
    
    if (!tableOrder) return sessionItems;

    const processedIndices = new Set<number>();
    
    return sessionItems.map(item => {
      if (item.status === 'draft') return item;
      
      const orderItemIdx = tableOrder.items.findIndex((oi, idx) => 
        !processedIndices.has(idx) && 
        oi.itemId === item.id &&
        oi.status !== 'Cancelled'
      );

      if (orderItemIdx > -1) {
        processedIndices.add(orderItemIdx);
        const orderItem = tableOrder.items[orderItemIdx];
        const isLiveReady = orderItem.status === 'Ready' || orderItem.status === 'Completed' || orderItem.status === 'Delivered';
        return { 
           ...item, 
           status: isLiveReady ? 'ready' as const : 'sent' as const,
           kitchenStatus: orderItem.status
        };
      }
      return item;
    });
  }, [currentSession.items, orders, activeView, selectedTable]);

  const isTableReadyForClosing = useMemo(() => {
    if (activeView !== 'dine-in') return true;
    const sentItems = cart.filter(i => i.status !== 'draft');
    if (sentItems.length === 0) return true;
    return sentItems.every(i => 
       i.kitchenStatus === 'Ready' || 
       i.kitchenStatus === 'Delivered' || 
       i.kitchenStatus === 'Completed' ||
       i.kitchenStatus === 'Cancelled'
    );
  }, [cart, activeView]);

  const groupPosCartItems = (items: PosCartItem[]) => {
    const grouped: { [s: string]: { [d: string]: PosCartItem[] } } = {};
    items.forEach(i => {
       const s = i.serviceSlot || 'Standard';
       const d = i.deliveryDate || 'ASAP';
       if (!grouped[s]) grouped[s] = {};
       if (!grouped[s][d]) grouped[s][d] = [];
       grouped[s][d].push(i);
    });
    const serviceOrder = ['Breakfast', 'Lunch', 'Dinner'];
    const sortedServices = Object.keys(grouped).sort((a, b) => {
        return serviceOrder.indexOf(a) - serviceOrder.indexOf(b);
    });
    return sortedServices.map(s => ({
       service: s,
       dateGroups: Object.keys(grouped[s]).sort().map(d => {
          const dateObj = d === 'ASAP' ? null : (() => {
             const [y, m, day] = d.split('-').map(Number);
             return new Date(y, m - 1, day);
          })();
          const isValidDate = dateObj && !isNaN(dateObj.getTime());
          return {
            date: d,
            dayName: isValidDate ? dateObj!.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase() : '',
            dayNumber: isValidDate ? dateObj!.getDate() : '',
            month: isValidDate ? dateObj!.toLocaleDateString('en-US', { month: 'short' }) : '',
            items: grouped[s][d]
          };
       })
    }));
  };

  const isDeliveryGateActive = useMemo(() => {
    return activeView === 'takeout' && fulfillmentType === 'delivery' && (selectedCustomer === 'walk-in' || !selectedCustomer);
  }, [activeView, fulfillmentType, selectedCustomer]);

  const hasDraftItems = useMemo(() => cart.some(i => i.status === 'draft'), [cart]);
  const allItemsReady = useMemo(() => cart.length > 0 && cart.every(i => i.status === 'ready'), [cart]);

  const filteredCustomers = useMemo(() => 
    customers.filter(c => c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) || c.phone.includes(customerSearchQuery))
  , [customerSearchQuery, customers]);

  const handleCheckout = async () => {
    if (cart.length === 0 || isProcessing) return;
    if (isDeliveryGateActive) {
      alert("Delivery Protocol Error: A verified CRM record is required for delivery logistics.");
      setIsCustomerModalOpen(true);
      return;
    }
    setIsProcessing(true);
    let isKitchenSend = false;

    try {
      const orderType = activeView === 'takeout' 
        ? (fulfillmentType === 'delivery' ? 'Delivery' : 'Takeout') 
        : activeView === 'dine-in' ? 'Dine-In' : 'Meal Plan';
      const customerName = selectedCustomer === 'walk-in' ? 'Walk-In Guest' : (selectedCustomer as Customer).name;
      
      if (activeView === 'dine-in') {
        const draftItems = cart.filter(c => c.status === 'draft');
        
        if (draftItems.length > 0) {
           isKitchenSend = true;
           const itemsPayload = draftItems.map(c => ({ 
             itemId: c.id, name: c.name, qty: c.qty, price: c.price,
             deliveryDate: c.deliveryDate, deliveryDay: c.deliveryDay, serviceSlot: c.serviceSlot
           }));
           
           if (selectedTable) {
              appendToTableOrder(selectedTable.name, customerName, itemsPayload);
              const updatedItems = currentSession.items.map(item => 
                 item.status === 'draft' ? { ...item, status: 'sent' } : item
              );
              updatePosCart(currentCartKey, updatedItems as any);
           }
        } else {
           const tableOrder = orders.find(o => o.tableId === selectedTable?.name && o.status !== 'Completed' && o.status !== 'Cancelled'); 
           if (tableOrder) markOrderTerminalClosed(tableOrder.id); 
           clearPosCart(currentCartKey); 
           setSelectedTable(null);
        }
      } else {
        const isPerDelivery = orderType === 'Meal Plan' && paymentPreference === 'per-delivery';
        addOrder({ 
          id: `POS-${Math.floor(Math.random() * 10000)}`, 
          customerName, type: orderType as any, status: 'Pending', paymentStatus: 'Pending', 
          paymentScheme: isPerDelivery ? 'Per-Delivery' : 'Upfront',
          items: cart.map(c => ({ 
             itemId: c.id, name: c.name, qty: c.qty, price: c.price, status: 'Active',
             deliveryDate: c.deliveryDate, deliveryDay: c.deliveryDay, serviceSlot: c.serviceSlot,
             paymentStatus: 'Pending'
          })), 
          total: cartTotals.total, timestamp: new Date().toISOString(), isReconciled: false,
          discount: cartTotals.discount 
        });
        clearPosCart(currentCartKey);
      }
      setTimeout(() => { 
        setIsProcessing(false); 
        if (!isKitchenSend) {
           setIsCheckoutSuccess(true); 
           setTimeout(() => setIsCheckoutSuccess(false), 3000); 
        }
      }, 1000);
    } catch (e) { setIsProcessing(false); }
  };

  const cartTotals = useMemo(() => {
    const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    const customer = selectedCustomer !== 'walk-in' ? (selectedCustomer as Customer) : null;
    let totalStandardDiscount = 0;
    let totalBirthdayDiscount = 0;
    let standardLabel = '';

    if (customer) {
       const tierObj = loyaltyTiers.find(t => t.name.toLowerCase() === customer.tier?.toLowerCase());
       const groupObj = customerGroups.find(g => g.name.toLowerCase() === customer.group?.toLowerCase());
       const standardTierRate = tierObj?.standardDiscount || 0;
       const birthdayTierRate = tierObj?.birthdayDiscount || 0;
       const groupRate = groupObj?.discountPercentage || 0;
       const effectiveStandardRate = Math.max(standardTierRate, groupRate);
       standardLabel = standardTierRate >= groupRate ? `${tierObj?.name} Tier` : `${groupObj?.name} Group`;
       let bMonth = -1, bDay = -1;
       if (customer.birthday) {
           const [_, m, d] = customer.birthday.split('-').map(Number);
           bMonth = m; bDay = d;
       }
       cart.forEach(cartItem => {
           const itemTotal = cartItem.price * cartItem.qty;
           totalStandardDiscount += itemTotal * (effectiveStandardRate / 100);
           const dateToCheck = cartItem.deliveryDate || systemDate;
           const [_, m, d] = dateToCheck.split('-').map(Number);
           if (m === bMonth && d === bDay && birthdayTierRate > 0) {
               totalBirthdayDiscount += itemTotal * (birthdayTierRate / 100);
           }
       });
    }

    let bulkDiscount = 0;
    if (config.bulkDiscountEnabled && cart.length > 0 && activeView === 'meal-plan') {
       config.activeServices.forEach(service => {
          const serviceItems = cart.filter(i => i.serviceSlot === service);
          if (serviceItems.length > 0) {
             const uniqueDates = new Set(serviceItems.map(i => i.deliveryDate));
             if (uniqueDates.size >= config.operatingDays.length) {
                const serviceSubtotal = serviceItems.reduce((acc, i) => acc + (i.price * i.qty), 0);
                bulkDiscount += serviceSubtotal * (config.bulkDiscountRate / 100);
             }
          }
       });
    }

    const totalDiscount = totalStandardDiscount + totalBirthdayDiscount + bulkDiscount;
    const netTotal = Math.max(0, subtotal - totalDiscount);
    const vatRate = config.vatEnabled ? (config.vatRate / 100) : 0;
    const vat = netTotal * vatRate;
    const total = netTotal + vat;
    return { subtotal, discount: totalDiscount, standardDiscount: totalStandardDiscount, birthdayDiscount: totalBirthdayDiscount, standardLabel, bulkDiscount, netTotal, vat, total, dueNow: total };
  }, [cart, selectedCustomer, config, activeView, loyaltyTiers, customerGroups, systemDate]);

  const addToCart = (item: MenuItem, qty: number = 1) => {
    if (!currentCartKey) return;
    const sessionItems = currentSession.items;
    const existing = sessionItems.find(i => i.id === item.id && i.status === 'draft');
    if (existing) updatePosCart(currentCartKey, sessionItems.map(i => (i === existing) ? { ...i, qty: i.qty + qty } : i)); 
    else updatePosCart(currentCartKey, [...sessionItems, { ...item, cartId: Math.random().toString(36).substr(2, 9), qty, status: 'draft' } as any]); 
  };

  const updateCartQty = (cartId: string, delta: number) => {
    const sessionItems = currentSession.items;
    updatePosCart(currentCartKey, sessionItems.map(item => item.cartId === cartId && item.status === 'draft' ? { ...item, qty: Math.max(0, item.qty + delta) } : item).filter(item => item.qty > 0));
  };

  const handleRemoveItem = (item: PosCartItem) => {
    if (item.status === 'draft') {
      updateCartQty(item.cartId, -999);
    } else if (item.status === 'sent' || item.status === 'ready') {
       if (item.kitchenStatus === 'Preparing' || item.kitchenStatus === 'Ready' || item.kitchenStatus === 'Completed' || item.kitchenStatus === 'Delivered') {
           alert("Production started. Cancellation locked. Please request cancellation via KDS Station.");
           return;
       }

       if (activeView === 'dine-in' && selectedTable) {
          const order = orders.find(o => o.tableId === selectedTable.name && o.status !== 'Completed' && o.status !== 'Cancelled');
          if (order) {
             cancelOrderItem(order.id, item.deliveryDate as any, item.serviceSlot as any, item.id);
             const sessionItems = currentSession.items;
             updatePosCart(currentCartKey, sessionItems.filter(i => i.cartId !== item.cartId));
          }
       }
    }
  };

  const openNewReservation = () => {
     setEditingRes({ id: Math.random().toString(), time: '12:00', guests: 2, status: 'Confirmed', preOrders: [] });
     setIsReservationModalOpen(true);
  };

  const openEditReservation = (res: Reservation) => {
     setEditingRes({ ...res });
     setIsReservationModalOpen(true);
  };

  const handleSaveRes = () => {
     if (!editingRes?.customerName) return;
     if (reservations.find(r => r.id === editingRes.id)) {
        setReservations(prev => prev.map(r => r.id === editingRes.id ? editingRes as Reservation : r));
     } else {
        setReservations(prev => [editingRes as Reservation, ...prev]);
     }
     setIsReservationModalOpen(false);
  };

  const getUpcomingReservation = (tableName: string) => {
    const res = reservations.find(r => r.tableId === tableName && r.status === 'Confirmed');
    if (!res) return null;
    const [hours, minutes] = res.time.split(':').map(Number);
    const resDate = new Date(currentTime);
    resDate.setHours(hours, minutes, 0, 0);
    const diffMinutes = (resDate.getTime() - currentTime.getTime()) / 60000;
    if (diffMinutes <= 15 && diffMinutes >= -60) return res;
    return null;
  };

  const openQuickAdd = () => {
    const [firstName = '', ...lastNameArr] = customerSearchQuery.trim().split(' ');
    const lastName = lastNameArr.join(' ');
    setQuickAddForm({ firstName, lastName, phone: '', email: '', street: '', city: '', zip: '' });
    setIsQuickAddModalOpen(true);
  };

  const handleQuickAddSubmit = () => {
    if (!quickAddForm.firstName || !quickAddForm.phone) return;
    const fullName = `${quickAddForm.firstName} ${quickAddForm.lastName}`.trim();
    const newCust = addCustomerRecord({
      firstName: quickAddForm.firstName,
      lastName: quickAddForm.lastName,
      name: fullName,
      email: quickAddForm.email || `${quickAddForm.firstName.toLowerCase()}@pos.internal`,
      phone: quickAddForm.phone,
      addresses: [{ 
         id: Math.random().toString(36).substr(2, 9), 
         label: 'Home', 
         street: quickAddForm.street, 
         city: quickAddForm.city, 
         zip: quickAddForm.zip, 
         country: 'Mauritius' 
      }],
      avatar: '',
      gdprConsent: { marketing: true, sms: true, dataProcessing: true }
    });
    if (isCustomerModalOpen) {
       updatePosSession(currentCartKey, { customer: newCust });
       setIsCustomerModalOpen(false);
    } else if (isReservationModalOpen) {
       setEditingRes({...editingRes!, customerName: newCust.name, customerId: newCust.id});
    }
    setIsQuickAddModalOpen(false);
    setCustomerSearchQuery('');
  };

  const getPlanDates = () => {
    const [y, m, d] = systemDate.split('-').map(Number);
    const systemDateObj = new Date(y, m - 1, d);
    const day = systemDateObj.getDay();
    const diff = systemDateObj.getDate() - day + (day === 0 ? -6 : 1);
    const currentMonday = new Date(systemDateObj.setDate(diff));
    const weekStart = new Date(currentMonday);
    if (planView === 'next') weekStart.setDate(weekStart.getDate() + 7);
    const days = [];
    for(let i=0; i<7; i++) {
       const d = new Date(weekStart);
       d.setDate(weekStart.getDate() + i);
       const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
       const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
       if (config.operatingDays.includes(dayName)) {
          days.push({ day: dayName, date: d.getDate(), dateKey, fullDate: d });
       }
    }
    return days;
  };

  const updateMealQty = (dateKey: string, service: string, itemId: string, delta: number) => {
    const key = `${dateKey}-${service}`;
    setMealSelections(prev => {
        const currentSlot = prev[key] || {};
        const currentQty = currentSlot[itemId] || 0;
        const newQty = Math.max(0, currentQty + delta);
        const newSlot = { ...currentSlot };
        if (newQty === 0) delete newSlot[itemId]; else newSlot[itemId] = newQty;
        return { ...prev, [key]: newSlot };
    });
  };

  const checkIsLocked = (targetDateStr: string) => {
     const [sysY, sysM, sysD] = systemDate.split('-').map(Number);
     const now = new Date();
     const systemDateTime = new Date(sysY, sysM - 1, sysD, now.getHours(), now.getMinutes());
     const [tgtY, tgtM, tgtD] = targetDateStr.split('-').map(Number);
     let bufferHours = 24; 
     const policy = (config as any).deadlinePolicy || '1 Day Before';
     if (policy === 'Same Day') bufferHours = 0;
     else if (policy === '2 Days Before') bufferHours = 48;
     else if (policy === 'Friday Prior') bufferHours = 96; 
     const [cutH, cutM] = config.cutoffTime.split(':').map(Number);
     const deadline = new Date(tgtY, tgtM - 1, tgtD, cutH, cutM);
     deadline.setHours(deadline.getHours() - bufferHours);
     return systemDateTime > deadline;
  };

  const confirmPlanToCart = () => {
      const itemsToAdd: any[] = [];
      const planDays = getPlanDates();
      Object.entries(mealSelections).forEach(([key, itemMap]) => {
          const dateKey = key.substring(0, 10);
          const service = key.substring(11);
          if (checkIsLocked(dateKey)) return; 
          const dayObj = planDays.find(d => d.dateKey === dateKey);
          if (dayObj) {
              Object.entries(itemMap).forEach(([itemId, qty]) => {
                  const item = menuItems.find(i => i.id === itemId);
                  if (item) {
                      itemsToAdd.push({ 
                         ...item, cartId: Math.random().toString(36).substr(2, 9), qty, status: 'draft',
                         deliveryDate: dateKey, deliveryDay: dayObj.day, serviceSlot: service
                      });
                  }
              });
          }
      });
      if (itemsToAdd.length === 0) {
         if (Object.keys(mealSelections).length > 0) alert("Selections were blocked due to Cut-off Time restrictions.");
         return;
      }
      updatePosCart('meal-plan', itemsToAdd);
      setMealSelections({}); 
  };

  const getServiceStyle = (service: string) => {
    switch(service) {
      case 'Breakfast': return { color: 'text-secondary', bg: 'bg-secondary/10', icon: <Coffee className="size-3.5" /> };
      case 'Lunch': return { color: 'text-warning', bg: 'bg-warning/10', icon: <Sun className="size-3.5" /> };
      case 'Dinner': return { color: 'text-primary', bg: 'bg-primary/10', icon: <Moon className="size-3.5" /> };
      default: return { color: 'text-slate-500', bg: 'bg-slate-100', icon: <Utensils className="size-3.5" /> };
    }
  };

  return (
    <div className="flex h-full overflow-hidden animate-in slide-in-from-right duration-300">
      <section className="flex-1 p-10 overflow-y-auto bg-[#fcfdfe] custom-scrollbar">
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8">
            {!isEmbedded && (
               <div>
                  <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Terminal Console</h1>
                  <div className="flex items-center gap-2 mt-1">
                     <span className="size-2 rounded-full bg-success animate-pulse"></span>
                     <p className="text-slate-400 font-bold text-xs uppercase tracking-widest leading-none">RMS Core Sync Active</p>
                  </div>
               </div>
            )}
            <div className={`flex bg-slate-100 p-1.5 rounded-[24px] border border-slate-200 shadow-inner self-start flex-wrap ${isEmbedded ? 'w-full justify-center' : ''}`}>
              <NavTab active={activeView === 'dine-in'} onClick={() => { setActiveView('dine-in'); setSelectedTable(null); }} icon={<Store className="size-4" />} label="Dine-In" />
              <NavTab active={activeView === 'takeout'} onClick={() => { setActiveView('takeout'); setSelectedTable(null); }} icon={<Package className="size-4" />} label="Takeout" />
              <NavTab active={activeView === 'meal-plan'} onClick={() => { setActiveView('meal-plan'); setSelectedTable(null); }} icon={<CalendarDays className="size-4" />} label="Meal Plan" />
            </div>
          </div>

          <div className="min-h-[600px]">
            {activeView === 'dine-in' && !selectedTable && (
              <div className="space-y-6">
                <div className="flex justify-end">
                    <button onClick={() => setIsReservationListOpen(true)} className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 hover:text-primary transition-all shadow-sm">
                       <Calendar className="size-4" /> Reservations
                    </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 animate-in fade-in zoom-in-95 duration-500">
                  {INITIAL_TABLES.map(t => (
                    <TableCard key={t.id} table={t} hasItems={(sessionCarts[`table-${t.name}`]?.items || []).length > 0} reservation={getUpcomingReservation(t.name)} onClick={() => setSelectedTable(t)} />
                  ))}
                </div>
              </div>
            )}

            {activeView === 'meal-plan' && (
              <div className="space-y-8 animate-in fade-in duration-500">
                {(!selectedCustomer || selectedCustomer === 'walk-in') ? (
                  <div className="h-[500px] bg-primary/5 rounded-[48px] border-2 border-dashed border-primary/20 flex flex-col items-center justify-center text-center p-12">
                     <UserCircle2 className="size-24 text-primary/30 mb-6" />
                     <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">CRM Authentication Required</h2>
                     <p className="text-slate-500 font-medium max-w-sm mb-10">Meal Plans are tied to subscription accounts. Please select a verified customer from the directory to start planning.</p>
                     <button onClick={() => setIsCustomerModalOpen(true)} className="px-10 py-5 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 transition-all flex items-center gap-3">
                        <UserSearch className="size-5" /> Select Customer
                     </button>
                  </div>
                ) : (
                  <div className="space-y-8 animate-in slide-in-from-right-4">
                     <div className="bg-slate-900 rounded-[40px] p-8 text-white flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden shadow-2xl">
                        <div className="absolute top-0 right-0 size-64 bg-primary/20 rounded-full blur-3xl -mr-16 -mt-16"></div>
                        <div className="flex items-center gap-6 relative z-10">
                           <div className="size-16 bg-primary text-white rounded-2xl flex items-center justify-center shadow-xl shadow-primary/30"><CalendarDays className="size-8" /></div>
                           <div>
                              <h3 className="text-xl font-black tracking-tight leading-none">Weekly Planner Hub</h3>
                              <p className="text-[10px] font-black uppercase text-white/40 tracking-[0.4em] mt-1">Authorized for: {selectedCustomer.name}</p>
                           </div>
                        </div>
                        <div className="flex flex-col md:flex-row gap-6 relative z-10">
                           <div className="space-y-2">
                             <p className="text-[9px] font-black uppercase text-white/30 tracking-widest ml-1 leading-none">Week Selection</p>
                             <div className="flex bg-white/10 p-1 rounded-xl">
                               <button onClick={() => setPlanView('current')} className={`px-5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${planView === 'current' ? 'bg-white text-slate-900 shadow-xl' : 'text-white/60 hover:text-white'}`}>This Week</button>
                               <button onClick={() => setPlanView('next')} className={`px-5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${planView === 'next' ? 'bg-white text-slate-900 shadow-xl' : 'text-white/60 hover:text-white'}`}>Next Week</button>
                             </div>
                           </div>
                           <div className="space-y-2">
                             <p className="text-[9px] font-black uppercase text-white/30 tracking-widest ml-1 leading-none">Payment Plan</p>
                             <div className="flex bg-white/10 p-1 rounded-xl">
                               <button onClick={() => setPaymentPreference('upfront')} className={`px-5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${paymentPreference === 'upfront' ? 'bg-primary text-white shadow-xl' : 'text-white/60 hover:text-white'}`}><Wallet className="size-3" /> Upfront</button>
                               <button onClick={() => setPaymentPreference('per-delivery')} className={`px-5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${paymentPreference === 'per-delivery' ? 'bg-primary text-white shadow-xl' : 'text-white/60 hover:text-white'}`}><Truck className="size-3" /> On Delivery</button>
                             </div>
                           </div>
                        </div>
                     </div>

                     <div className="flex gap-6 overflow-x-auto hide-scrollbar snap-x pb-4">
                        {getPlanDates().map((dayObj) => {
                           const isLocked = checkIsLocked(dayObj.dateKey);
                           
                           // Birthday Cake Integration
                           let isBirthdayOnThisDay = false;
                           if (selectedCustomer && selectedCustomer !== 'walk-in' && selectedCustomer.birthday) {
                               const [_, bM, bD] = selectedCustomer.birthday.split('-').map(Number);
                               const [__, dM, dD] = dayObj.dateKey.split('-').map(Number);
                               if (bM === dM && bD === dD) isBirthdayOnThisDay = true;
                           }

                           return (
                           <div key={dayObj.dateKey} className={`snap-center min-w-[320px] flex flex-col gap-6 ${isLocked ? 'opacity-70 grayscale-[0.5]' : ''}`}>
                              <div className={`p-6 rounded-[32px] text-center border-2 transition-all ${planView === 'current' && dayObj.dateKey === systemDate ? 'bg-primary text-white border-primary shadow-xl' : 'bg-white border-slate-100 shadow-sm'}`}>
                                 <div className="flex justify-between items-start mb-1">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">{dayObj.day}</p>
                                    {isLocked && <Lock className="size-3 opacity-60" />}
                                 </div>
                                 <div className="flex items-center justify-center gap-2">
                                    {isBirthdayOnThisDay && <Cake className="size-6 text-accent -mt-1 animate-bounce" />}
                                    <p className="text-3xl font-black tracking-tighter">
                                       {dayObj.fullDate.toLocaleDateString('en-US', { month: 'short' })} {dayObj.date}
                                    </p>
                                 </div>
                              </div>
                              {config.activeServices.map(service => {
                                 const menu = getDayMenu(dayObj.dateKey, service);
                                 const style = getServiceStyle(service);
                                 return (
                                    <div key={service} className="bg-white rounded-[28px] p-3 border border-slate-100 shadow-sm flex flex-col gap-3">
                                       <div className="flex items-center justify-between px-2 pt-1">
                                          <div className="flex items-center gap-2">
                                             <div className={`size-7 rounded-full flex items-center justify-center ${style.bg} ${style.color}`}>{style.icon}</div>
                                             <span className={`text-xs font-black uppercase tracking-widest ${style.color}`}>{service}</span>
                                          </div>
                                          {menu.length > 0 && <span className="text-[9px] font-bold text-slate-300 bg-slate-50 px-2 py-0.5 rounded-lg">{menu.length} Options</span>}
                                       </div>
                                       <div className="space-y-3">
                                          {menu.map(item => {
                                             const qty = mealSelections[`${dayObj.dateKey}-${service}`]?.[item.id] || 0;
                                             return (
                                                <div key={item.id} className={`p-4 rounded-[20px] border-2 transition-all group flex flex-col gap-4 ${qty > 0 ? 'bg-white border-primary shadow-xl' : 'bg-slate-50/50 border-transparent hover:bg-white hover:border-slate-200'} ${isLocked ? 'cursor-not-allowed' : ''}`}>
                                                   <div className="flex items-center gap-3">
                                                      <img src={item.image} className="size-14 rounded-xl object-cover shrink-0" />
                                                      <div className="min-w-0 flex-1">
                                                         <p className={`text-xs font-black truncate leading-none mb-1 ${qty > 0 ? 'text-primary' : 'text-slate-900'}`}>{item.name}</p>
                                                         <p className="text-[10px] font-bold text-slate-400">{formatCurrency(calculateTotal(item.price))}</p>
                                                      </div>
                                                   </div>
                                                   <div className="flex items-center justify-between bg-slate-100/50 rounded-xl p-1.5">
                                                      <button onClick={() => updateMealQty(dayObj.dateKey, service, item.id, -1)} className={`size-8 rounded-xl flex items-center justify-center transition-colors ${qty > 0 ? 'bg-white shadow-sm text-slate-500 hover:text-danger' : 'text-slate-300 hover:bg-slate-200'}`} disabled={qty === 0 || isLocked}><Minus className="size-3" /></button>
                                                      <span className={`text-sm font-black w-6 text-center tabular-nums ${qty > 0 ? 'text-slate-900' : 'text-slate-300'}`}>{qty}</span>
                                                      <button onClick={() => updateMealQty(dayObj.dateKey, service, item.id, 1)} className={`size-8 rounded-xl flex items-center justify-center transition-all ${isLocked ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-primary hover:bg-white hover:shadow-sm'}`} disabled={isLocked}><Plus className="size-3" /></button>
                                                   </div>
                                                </div>
                                             );
                                          })}
                                          {menu.length === 0 && <div className="py-6 text-center opacity-40"><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">No Menu</p></div>}
                                       </div>
                                    </div>
                                 );
                              })}
                           </div>
                        )})}
                     </div>
                     <button onClick={confirmPlanToCart} disabled={Object.keys(mealSelections).length === 0} className="w-full py-6 bg-slate-900 text-white rounded-[28px] font-black text-xs uppercase tracking-widest shadow-2xl hover:scale-[1.02] active:scale-95 transition-all">Add selections to transaction cart</button>
                  </div>
                )}
              </div>
            )}

            {(activeView === 'takeout' || (activeView === 'dine-in' && selectedTable)) && (
               <div className="space-y-8 animate-in fade-in duration-500">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex gap-2 flex-wrap">
                      {categories.map(cat => (
                        <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeCategory === cat ? 'bg-slate-900 text-white shadow-lg' : 'bg-white border border-slate-100 text-slate-400 hover:border-slate-300'}`}>{cat}</button>
                      ))}
                    </div>
                    {activeView === 'takeout' && (
                       <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner">
                          <button onClick={() => setFulfillmentType('pickup')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${fulfillmentType === 'pickup' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400'}`}><ShoppingBag className="size-3" /> Pickup</button>
                          <button onClick={() => setFulfillmentType('delivery')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${fulfillmentType === 'delivery' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400'}`}><Truck className="size-3" /> Delivery</button>
                       </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                    {menuItems.filter(m => 
                        (activeCategory === 'All' || m.category === activeCategory) &&
                        (
                           (activeView === 'dine-in' && m.availability.includes('Dine-In')) ||
                           (activeView === 'takeout' && m.availability.includes('Takeout')) ||
                           (activeView === 'meal-plan' && m.availability.includes('Meal Plan'))
                        )
                    ).map(meal => (
                      <div key={meal.id} onClick={() => addToCart(meal)}><MenuProductCard item={meal} /></div>
                    ))}
                  </div>
               </div>
            )}
          </div>
        </div>
      </section>

      {/* SIDEBAR CART */}
      <aside className={`border-l border-slate-100 bg-white flex flex-col shadow-2xl z-40 relative transition-all duration-300 ease-in-out ${isCartCollapsed ? 'w-24' : isEmbedded ? 'w-[340px]' : 'w-[480px]'}`}>
        {isCartCollapsed ? (
          <div className="flex flex-col h-full items-center py-8 justify-between">
            <button onClick={() => setIsCartCollapsed(false)} className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-900 hover:text-white transition-all mb-4" title="Expand Cart"><PanelRightOpen className="size-6" /></button>
            <div className="flex flex-col items-center gap-6 flex-1 justify-center">
              <div className="relative p-4 bg-slate-50 rounded-2xl text-slate-400">
                <ShoppingBag className="size-6" />
                <span className="absolute -top-2 -right-2 size-6 bg-primary text-white text-[10px] font-black flex items-center justify-center rounded-full border-4 border-white shadow-sm">
                  {cart.reduce((acc, i) => acc + i.qty, 0)}
                </span>
              </div>
              <div className="h-px w-8 bg-slate-100"></div>
              <div className="flex flex-col items-center gap-2">
                 <span className="text-[10px] font-black uppercase text-slate-300 tracking-widest [writing-mode:vertical-lr] rotate-180">Total Due</span>
                 <span className="text-base font-black text-slate-900 [writing-mode:vertical-lr] rotate-180 py-2 tracking-tight">{formatCurrency(cartTotals.total)}</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="p-8 pb-4 shrink-0 border-b border-slate-50 flex items-start justify-between">
              <div className="flex-1 mr-4">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-3 block">Transaction Party</label>
                <div className="relative group/customer">
                  <button 
                    disabled={activeView === 'dine-in' && !selectedTable}
                    onClick={() => setIsCustomerModalOpen(true)} 
                    className={`w-full flex items-center justify-between px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl transition-all ${activeView === 'dine-in' && !selectedTable ? 'opacity-40 grayscale cursor-not-allowed' : 'hover:border-primary'}`}
                  >
                    <div className="flex items-center gap-3">
                      {selectedCustomer === 'walk-in' ? (<div className="size-10 bg-slate-200 text-slate-400 rounded-xl flex items-center justify-center"><Users className="size-5" /></div>) : 
                      selectedCustomer ? (<img src={(selectedCustomer as Customer).avatar} className="size-10 rounded-xl object-cover" />) : 
                      (<div className="size-10 bg-slate-100 text-slate-300 rounded-xl flex items-center justify-center"><User className="size-5" /></div>)}
                      <div className="text-left overflow-hidden">
                        <div className="flex items-center gap-2">
                           <p className="text-sm font-black text-slate-900 leading-none truncate max-w-[180px]">{selectedCustomer === 'walk-in' ? 'Guest (Walk-In)' : (selectedCustomer as Customer)?.name || 'Identify Customer'}</p>
                           {isCustBirthdayToday && <Cake className="size-3.5 text-accent animate-bounce" />}
                        </div>
                        {isCustBirthdayToday && <p className="text-[9px] font-black text-accent uppercase tracking-widest mt-0.5">Birthday Today! 🎂</p>}
                        {isDeliveryGateActive && <p className="text-[9px] font-black text-danger uppercase tracking-widest animate-pulse">Required for Delivery</p>}
                      </div>
                    </div>
                    <ChevronDown className="size-4 text-slate-300 shrink-0" />
                  </button>
                  {selectedCustomer !== 'walk-in' && !(activeView === 'dine-in' && !selectedTable) && (
                    <button onClick={(e) => { e.stopPropagation(); updatePosSession(currentCartKey, { customer: 'walk-in' }); }} className="absolute top-1/2 -translate-y-1/2 right-12 p-2 bg-white/80 backdrop-blur-sm text-slate-400 hover:text-danger hover:bg-white rounded-full shadow-sm border border-slate-100 transition-all opacity-0 group-hover/customer:opacity-100 z-10"><X className="size-3" /></button>
                  )}
                </div>
              </div>
              <button onClick={() => setIsCartCollapsed(true)} className="mt-7 p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all" title="Collapse Cart"><PanelRightClose className="size-5" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto px-10 py-4 space-y-6 custom-scrollbar">
              {isCheckoutSuccess ? (<div className="h-full flex flex-col items-center justify-center text-center p-8 animate-in zoom-in-95 duration-500"><CheckCircle2 className="size-24 text-success mb-6 shadow-2xl shadow-success/20" /><h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Order Finalized</h3></div>) : 
              cart.length === 0 ? (<div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-60"><ShoppingBag className="size-16 mb-4 stroke-1" /><p className="text-xs font-black uppercase tracking-widest">Cart is empty</p></div>) : 
              (
                activeView === 'meal-plan' ? (
                   <div className="space-y-6">
                      {groupPosCartItems(cart).map((group, gIdx) => (
                         <div key={gIdx} className="space-y-3">
                            <div className="flex items-center gap-2 px-2">
                               <div className="size-1.5 rounded-full bg-primary/40"></div>
                               <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{group.service}</p>
                            </div>
                            {group.dateGroups.map((dateGroup, dgIdx) => (
                               <div key={dgIdx} className="bg-slate-50 border border-slate-100 rounded-3xl overflow-hidden">
                                  {dateGroup.date !== 'ASAP' && (
                                     <div className="bg-white border-b border-slate-100 p-3 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                           <div className="text-center w-8">
                                              <span className="block text-[8px] font-black text-slate-400 uppercase leading-none">{dateGroup.month}</span>
                                              <span className="block text-lg font-black text-slate-900 leading-none">{dateGroup.dayNumber}</span>
                                           </div>
                                           <span className="text-[10px] font-bold text-slate-500 uppercase">{dateGroup.dayName}</span>
                                        </div>
                                     </div>
                                  )}
                                  <div className="divide-y divide-slate-100">
                                     {dateGroup.items.map((item, iIdx) => (
                                        <div key={iIdx} className="p-3 flex items-center justify-between hover:bg-slate-100 transition-colors">
                                           <div className="flex items-center gap-3">
                                              <span className="text-xs font-black text-slate-900 w-6 text-center">{item.qty}x</span>
                                              <div>
                                                 <p className="text-xs font-bold text-slate-700">{item.name}</p>
                                                 <p className="text-[9px] font-bold text-slate-400">{formatCurrency(item.price)}</p>
                                              </div>
                                           </div>
                                           <button onClick={() => handleRemoveItem(item)} className="text-slate-400 hover:text-danger"><Trash2 className="size-3.5" /></button>
                                        </div>
                                     ))}
                                  </div>
                                </div>
                            ))}
                         </div>
                      ))}
                   </div>
                ) : (
                    <div className="space-y-4">
                      {cart.map((item, idx) => {
                        const isLocked = item.kitchenStatus === 'Preparing' || item.kitchenStatus === 'Ready' || item.kitchenStatus === 'Completed' || item.kitchenStatus === 'Delivered';
                        return (
                        <div key={item.cartId || idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-primary/30 transition-all">
                           <div className="flex items-center gap-3">
                              <img src={item.image} className="size-12 rounded-xl object-cover" />
                              <div>
                                 <p className="text-xs font-black text-slate-900">{item.name}</p>
                                 <div className="flex gap-2 items-center">
                                    <p className="text-[10px] font-bold text-slate-400">{formatCurrency(item.price)}</p>
                                    {(item.status === 'sent' || item.status === 'ready') && (
                                       <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                                          item.status === 'ready' ? 'bg-success/10 text-success' : 
                                          item.kitchenStatus === 'Preparing' ? 'bg-warning/10 text-warning animate-pulse' : 
                                          'bg-secondary/10 text-secondary'
                                       }`}>
                                          {item.status === 'ready' ? 'READY' : item.kitchenStatus === 'Preparing' ? 'PREP' : 'SENT'}
                                       </span>
                                    )}
                                 </div>
                              </div>
                           </div>
                           <div className="flex items-center gap-3">
                              {item.status === 'draft' ? (
                                 <div className="flex items-center bg-white rounded-lg border border-slate-100 shadow-sm">
                                    <button onClick={() => updateCartQty(item.cartId, -1)} className="p-1.5 text-slate-400 hover:text-slate-900"><Minus className="size-3" /></button>
                                    <span className="text-xs font-black w-4 text-center">{item.qty}</span>
                                    <button onClick={() => updateCartQty(item.cartId, 1)} className="p-1.5 text-slate-400 hover:text-slate-900"><Plus className="size-3" /></button>
                                 </div>
                              ) : (
                                 <span className="text-xs font-black w-8 text-center text-slate-900">x{item.qty}</span>
                              )}
                              {isLocked ? (
                                 <button onClick={() => alert("Cancellation locked: Kitchen preparation has started.")} className="p-1.5 text-slate-300 cursor-not-allowed">
                                    <Lock className="size-4" />
                                 </button>
                              ) : (
                                 <button onClick={() => handleRemoveItem(item)} className="p-1.5 text-slate-300 hover:text-danger transition-colors">
                                    <Trash2 className="size-4" />
                                 </button>
                              )}
                           </div>
                        </div>
                      )})}
                    </div>
                )
              )}
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-100 shrink-0 space-y-4">
               <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold text-slate-500"><span>Subtotal</span><span>{formatCurrency(cartTotals.subtotal)}</span></div>
                  {cartTotals.discount > 0 && (
                    <div className="space-y-1 py-1">
                      {cartTotals.standardDiscount > 0 && (
                        <div className="flex justify-between text-xs font-bold text-primary">
                          <span>{cartTotals.standardLabel} Discount</span>
                          <span>-{formatCurrency(cartTotals.standardDiscount)}</span>
                        </div>
                      )}
                      {cartTotals.birthdayDiscount > 0 && (
                        <div className="flex justify-between text-xs font-bold text-accent">
                          <span>Birthday Discount</span>
                          <span>-{formatCurrency(cartTotals.birthdayDiscount)}</span>
                        </div>
                      )}
                      {cartTotals.bulkDiscount > 0 && (
                        <div className="flex justify-between text-xs font-bold text-success">
                          <span>Bulk Plan Discount</span>
                          <span>-{formatCurrency(cartTotals.bulkDiscount)}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex justify-between text-xs font-bold text-slate-500"><span>VAT ({config.vatRate}%)</span><span>{formatCurrency(cartTotals.vat)}</span></div>
                  <div className="flex justify-between text-xl font-black text-slate-900 pt-2 border-t border-slate-200"><span>Total</span><span>{formatCurrency(cartTotals.total)}</span></div>
               </div>
               <button 
                  onClick={handleCheckout} 
                  disabled={cart.length === 0 || isProcessing || (activeView === 'dine-in' && !hasDraftItems && !isTableReadyForClosing)} 
                  title={(activeView === 'dine-in' && !hasDraftItems && !isTableReadyForClosing) ? "Cannot close: Kitchen items are still preparing" : ""}
                  className={`w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:scale-100 ${(activeView === 'dine-in' && !hasDraftItems && !isTableReadyForClosing) ? 'cursor-not-allowed' : ''}`}
               >
                  {isProcessing ? <Loader2 className="size-4 animate-spin" /> : 
                    (activeView === 'dine-in' && hasDraftItems) ? 'Send to Kitchen' : 
                    (activeView === 'dine-in') ? <><Lock className="size-4" /> Close Table</> : 
                    'Confirm Payment'}
               </button>
            </div>
          </>
        )}
      </aside>

      {/* Customer Modal */}
      {isCustomerModalOpen && (
         <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-[32px] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
               <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-lg font-black text-slate-900">Select Customer</h3>
                  <button onClick={() => setIsCustomerModalOpen(false)}><X className="size-5 text-slate-400" /></button>
               </div>
               <div className="p-4 border-b border-slate-100 bg-slate-50">
                  <div className="relative">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                     <input autoFocus value={customerSearchQuery} onChange={e => setCustomerSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20" placeholder="Search name or phone..." />
                  </div>
               </div>
               <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  <button onClick={openQuickAdd} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-xs font-black uppercase text-slate-400 hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2"><UserPlus className="size-4" /> Create New Profile</button>
                  {filteredCustomers.map(c => (
                     <button key={c.id} onClick={() => { updatePosSession(currentCartKey, { customer: c }); setIsCustomerModalOpen(false); }} className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl text-left transition-all group">
                        <img src={c.avatar} className="size-10 rounded-lg object-cover bg-slate-200" />
                        <div><p className="text-sm font-black text-slate-900 group-hover:text-primary">{c.name}</p><p className="text-xs font-medium text-slate-500">{c.phone} • {c.tier}</p></div>
                     </button>
                  ))}
               </div>
            </div>
         </div>
      )}

      {/* Reservation Modal */}
      {isReservationModalOpen && editingRes && (
         <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl p-8">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-black text-slate-900">{reservations.find(r => r.id === editingRes.id) ? 'Edit Reservation' : 'New Reservation'}</h3>
                  <button onClick={() => setIsReservationModalOpen(false)}><X className="size-5 text-slate-400" /></button>
               </div>
               <div className="space-y-4">
                  <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Customer Name</label>
                     <div className="flex gap-2">
                        <input value={editingRes.customerName} onChange={e => setEditingRes({...editingRes, customerName: e.target.value})} className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none" placeholder="Guest Name" />
                        <button onClick={openQuickAdd} className="p-3 bg-slate-100 rounded-xl hover:bg-slate-200 text-slate-600"><UserPlus className="size-4" /></button>
                     </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Time</label>
                        <input type="time" value={editingRes.time} onChange={e => setEditingRes({...editingRes, time: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none" />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Guests</label>
                        <input type="number" value={editingRes.guests} onChange={e => setEditingRes({...editingRes, guests: parseInt(e.target.value)})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none" />
                     </div>
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Assign Table</label>
                     <div className="grid grid-cols-4 gap-2">
                        {INITIAL_TABLES.map(t => (
                           <button key={t.id} onClick={() => setEditingRes({...editingRes, tableId: t.name})} className={`py-2 rounded-lg text-xs font-black transition-all ${editingRes.tableId === t.name ? 'bg-primary text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>{t.name}</button>
                        ))}
                     </div>
                  </div>
                  <button onClick={handleSaveRes} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:scale-105 transition-all">Save Reservation</button>
               </div>
            </div>
         </div>
      )}

      {/* Quick Add Modal */}
      {isQuickAddModalOpen && (
         <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-[32px] w-full max-w-lg shadow-2xl p-8 animate-in zoom-in-95">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-black text-slate-900">New Guest Profile</h3>
                  <button onClick={() => setIsQuickAddModalOpen(false)}><X className="size-5 text-slate-400" /></button>
               </div>
               <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                     <input value={quickAddForm.firstName} onChange={e => setQuickAddForm({...quickAddForm, firstName: e.target.value})} placeholder="First Name" className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none" />
                     <input value={quickAddForm.lastName} onChange={e => setQuickAddForm({...quickAddForm, lastName: e.target.value})} placeholder="Last Name" className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none" />
                  </div>
                  <input value={quickAddForm.phone} onChange={e => setQuickAddForm({...quickAddForm, phone: e.target.value})} placeholder="Phone Number" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none" />
                  <input value={quickAddForm.email} onChange={e => setQuickAddForm({...quickAddForm, email: e.target.value})} placeholder="Email (Optional)" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none" />
                  <button onClick={handleQuickAddSubmit} disabled={!quickAddForm.firstName || !quickAddForm.phone} className="w-full py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:brightness-110 transition-all disabled:opacity-50">Create Profile</button>
               </div>
            </div>
         </div>
      )}
      
      {/* Reservation List Modal */}
      {isReservationListOpen && (
         <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-[32px] w-full max-w-3xl shadow-2xl p-8 h-[600px] flex flex-col">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-black text-slate-900">Reservations</h3>
                  <div className="flex gap-4">
                     <button onClick={openNewReservation} className="px-6 py-2 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-110">+ New</button>
                     <button onClick={() => setIsReservationListOpen(false)}><X className="size-6 text-slate-400" /></button>
                  </div>
               </div>
               <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
                  {reservations.map(res => (
                     <div key={res.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-4">
                           <div className="size-12 bg-white rounded-xl flex items-center justify-center font-black text-slate-900 border border-slate-200">{res.time}</div>
                           <div><p className="text-sm font-black text-slate-900">{res.customerName}</p><p className="text-xs font-bold text-slate-400">Table {res.tableId} • {res.guests} Guests</p></div>
                        </div>
                        <div className="flex gap-2">
                           <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${res.status === 'Confirmed' ? 'bg-success/10 text-success' : 'bg-slate-200 text-slate-500'}`}>{res.status}</span>
                           <button onClick={() => openEditReservation(res)} className="p-2 text-slate-400 hover:text-primary"><Edit className="size-4" /></button>
                        </div>
                     </div>
                  ))}
                  {reservations.length === 0 && <p className="text-center text-slate-400 py-10 font-bold">No reservations found.</p>}
               </div>
            </div>
         </div>
      )}

    </div>
  );
};

const NavTab = ({ active, onClick, icon, label }: any) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
      active ? 'bg-white shadow-md text-slate-900' : 'text-slate-400 hover:text-slate-600'
    }`}
  >
    {icon}
    {label}
  </button>
);

const TableCard = ({ table, hasItems, reservation, onClick }: any) => (
  <button 
    onClick={onClick}
    className={`relative p-6 rounded-[32px] border-2 transition-all flex flex-col items-center justify-center gap-4 h-48 group w-full ${
      table.status === 'Occupied' ? 'bg-primary/5 border-primary/20' : 
      table.status === 'Dirty' ? 'bg-warning/5 border-warning/20' :
      'bg-white border-slate-100 hover:border-primary/50 hover:shadow-xl'
    }`}
  >
    <div className={`absolute top-4 right-4 size-3 rounded-full ${
      table.status === 'Available' ? 'bg-success' : 
      table.status === 'Occupied' ? 'bg-primary' : 
      table.status === 'Reserved' ? 'bg-indigo-500' : 'bg-warning'
    }`}></div>
    
    <div className={`text-3xl font-black ${
      table.status === 'Occupied' ? 'text-primary' : 'text-slate-900'
    }`}>
      {table.name}
    </div>
    
    <div className="flex flex-col items-center gap-1">
       <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{table.capacity} Seats</span>
       <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-lg ${
          table.status === 'Available' ? 'bg-slate-100 text-slate-500' :
          table.status === 'Occupied' ? 'bg-primary/10 text-primary' :
          'bg-warning/10 text-warning'
       }`}>{table.status}</span>
    </div>

    {hasItems && (
       <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-slate-900 text-white rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg flex items-center gap-1">
          <ShoppingBag className="size-3" /> Order
       </div>
    )}
    
    {reservation && (
       <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-indigo-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-lg flex items-center gap-1 whitespace-nowrap">
          <Clock className="size-3" /> {reservation.time}
       </div>
    )}
  </button>
);

const MenuProductCard = ({ item }: { item: MenuItem }) => (
  <div className="bg-white p-3 rounded-[24px] border border-slate-100 shadow-sm hover:shadow-xl transition-all group cursor-pointer flex flex-col h-full relative overflow-hidden">
    <div className="aspect-square rounded-[18px] bg-slate-100 mb-3 overflow-hidden relative">
      <img src={item.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={item.name} />
      {item.tags && item.tags.length > 0 && (
         <div className="absolute top-2 left-2 flex flex-wrap gap-1">
            {item.tags.slice(0, 1).map(tag => (
               <span key={tag} className="px-2 py-1 bg-black/60 backdrop-blur-md text-white rounded-lg text-[8px] font-black uppercase tracking-widest">{tag}</span>
            ))}
         </div>
      )}
    </div>
    <div className="flex-1 flex flex-col justify-between">
      <div>
        <h4 className="text-sm font-black text-slate-900 leading-tight mb-0.5 truncate">{item.name}</h4>
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.category}</p>
      </div>
      <div className="flex items-center justify-between mt-3">
        <span className="text-sm font-black text-primary">{formatCurrency(calculateTotal(item.price))}</span>
        <div className="size-8 bg-slate-900 text-white rounded-lg group-hover:bg-primary transition-all flex items-center justify-center shadow-lg shadow-slate-900/20 group-hover:shadow-primary/30">
          <Plus className="size-4" />
        </div>
      </div>
    </div>
  </div>
);

export default POS;
