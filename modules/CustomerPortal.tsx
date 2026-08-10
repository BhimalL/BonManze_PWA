
import React, { useState, useMemo, useEffect } from 'react';
import { 
  CreditCard, 
  MapPin, 
  Star, 
  Gift, 
  CalendarDays, 
  ShoppingBag, 
  ChevronRight, 
  Clock, 
  Check, 
  X,
  Utensils,
  ArrowRight,
  User,
  Heart,
  Home,
  Menu as MenuIcon,
  Plus,
  Minus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Package,
  LogOut,
  Loader2,
  CalendarCheck,
  Navigation,
  ArrowLeft,
  History,
  Truck,
  Store,
  Banknote,
  Smartphone,
  Mail,
  Wallet,
  Ticket,
  Landmark,
  Info,
  Percent,
  BadgePercent,
  Coffee,
  Sun,
  Moon,
  Layers,
  Lock,
  Trash2,
  Cake,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronUp,
  Sparkles,
  LogIn
} from 'lucide-react';
import { MenuItem, Customer, Order, OrderItem, PaymentMethod } from '../types';
import { MEAL_LIBRARY_ITEMS, getDayMenu, SYSTEM_CONFIG, LOYALTY_TIERS, CUSTOMER_GROUPS, subscribeToConfig, addOrder, subscribeToOrders, cancelOrderItem, MOCK_TODAY, subscribeToPaymentMethods, formatCurrency, calculateTotal, subscribeToLoyaltyTiers, subscribeToCustomerGroups, subscribeToSystemDate, subscribeToCustomers, subscribeToMealLibrary } from './store';

interface CartItem {
  item: MenuItem;
  qty: number;
  type: 'standard' | 'meal-plan';
  cartId: string;
  details?: {
    date: string;
    day: string;
    service: string;
    paymentType: 'upfront' | 'per-delivery';
  };
}

const getMealItemStatus = (item: OrderItem, orderType: Order['type'], currentSystemDate: string) => {
  if (item.status === 'Cancelled') return 'Cancelled';
  
  if (orderType === 'Takeout') {
     if (item.status === 'Ready') return 'Ready for Pickup';
     if (item.status === 'Completed') return 'Picked Up';
     if (item.status === 'Preparing') return 'Preparing';
     return 'Ordered';
  }

  if (item.status === 'Ready') return 'Ready for Dispatch';
  if (item.status === 'Delivered') return 'In Transit';
  if (item.status === 'Completed') return 'Delivered';
  
  if (!item.deliveryDate) return 'Standard';
  if (item.deliveryDate < currentSystemDate) return 'Delivered';
  if (item.deliveryDate === currentSystemDate) return 'Scheduled Today';
  return 'Scheduled';
};

const CustomerPortal: React.FC<{ onLogout?: () => void }> = ({ onLogout }) => {
  // Auth State
  const [currentUser, setCurrentUser] = useState<Customer | null>(null);
  const [customersList, setCustomersList] = useState<Customer[]>([]);

  const [config, setConfig] = useState(SYSTEM_CONFIG);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [activeTab, setActiveTab] = useState<'home' | 'menu' | 'cart' | 'plan' | 'profile' | 'orders'>('home');
  const [historyFilter, setHistoryFilter] = useState<'active' | 'completed'>('active');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [systemDate, setSystemDate] = useState(MOCK_TODAY);
  
  // Reactive Data
  const [menuItems, setMenuItems] = useState<MenuItem[]>(MEAL_LIBRARY_ITEMS);
  const [loyaltyTiers, setLoyaltyTiers] = useState(LOYALTY_TIERS);
  const [customerGroups, setCustomerGroups] = useState(CUSTOMER_GROUPS);

  const [cancelModal, setCancelModal] = useState<{
    isOpen: boolean;
    orderId: string | null;
    itemDetails?: { date: string; slot: string; itemId: string; name: string };
  }>({ isOpen: false, orderId: null });

  const [selectedProduct, setSelectedProduct] = useState<MenuItem | null>(null);
  const [detailQty, setDetailQty] = useState(1);
  const [detailContext, setDetailContext] = useState<{ type: 'menu' } | { type: 'plan', dateKey: string, service: string }>({ type: 'menu' });

  const [mealSelections, setMealSelections] = useState<{ [key: string]: { [itemId: string]: number } }>({}); 
  const [planView, setPlanView] = useState<'current' | 'next'>('current');
  const [paymentPreference, setPaymentPreference] = useState<'upfront' | 'per-delivery'>('upfront');

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<'details' | 'success'>('details');
  const [fulfillmentType, setFulfillmentType] = useState<'delivery' | 'pickup'>('delivery');
  
  // New Address State
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');

  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [lastCheckoutTotal, setLastCheckoutTotal] = useState(0);
  const [orderRef, setOrderRef] = useState('');
  
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string>('');

  // Expand state for orders
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const unsubConfig = subscribeToConfig(() => setConfig({...SYSTEM_CONFIG}));
    const unsubPayment = subscribeToPaymentMethods(setPaymentMethods);
    const unsubCustomers = subscribeToCustomers(setCustomersList);
    const unsubOrders = subscribeToOrders((allOrders) => {
      if (currentUser) {
        const myOrders = allOrders.filter(o => 
          o.customerName.toLowerCase().trim() === currentUser.name.toLowerCase().trim()
        );
        setOrders([...myOrders]);
        // Auto expand first order if exists and user just logged in
        if (myOrders.length > 0 && Object.keys(expandedOrders).length === 0) {
           setExpandedOrders({ [myOrders[0].id]: true });
        }
      }
    });
    const unsubLoyalty = subscribeToLoyaltyTiers(setLoyaltyTiers);
    const unsubGroups = subscribeToCustomerGroups(setCustomerGroups);
    const unsubDate = subscribeToSystemDate(setSystemDate);
    const unsubMeals = subscribeToMealLibrary(setMenuItems);

    return () => {
       unsubConfig();
       unsubPayment();
       unsubOrders();
       unsubLoyalty();
       unsubGroups();
       unsubDate();
       unsubCustomers();
       unsubMeals();
    };
  }, [currentUser]);

  // Update selected address when user logs in
  useEffect(() => {
    if (currentUser && currentUser.addresses && currentUser.addresses.length > 0) {
      setSelectedAddressId(currentUser.addresses[0].id);
    } else {
      setSelectedAddressId('');
    }
  }, [currentUser]);

  const toggleOrderExpand = (orderId: string) => {
     setExpandedOrders(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const isMealPlanOrder = useMemo(() => cart.some(c => c.type === 'meal-plan'), [cart]);
  const isPayOnDelivery = useMemo(() => isMealPlanOrder && paymentPreference === 'per-delivery', [isMealPlanOrder, paymentPreference]);

  const currentOrderType = useMemo(() => {
    if (isMealPlanOrder) return 'Meal Plan';
    return fulfillmentType === 'delivery' ? 'Delivery' : 'Takeout';
  }, [isMealPlanOrder, fulfillmentType]);

  const activeMethods = useMemo(() => {
    return paymentMethods.filter(m => 
      m.isActive && m.applicableTo.includes(currentOrderType as any)
    );
  }, [paymentMethods, currentOrderType]);

  useEffect(() => {
    if (activeMethods.length > 0) {
       const isCurrentValid = activeMethods.some(m => m.id === selectedPaymentMethodId);
       if (!isCurrentValid) {
          setSelectedPaymentMethodId(activeMethods[0].id);
       }
    } else {
       setSelectedPaymentMethodId('');
    }
  }, [activeMethods, selectedPaymentMethodId]);

  const { activeOrders, completedOrders } = useMemo(() => {
    const active = orders.filter(o => {
        if (o.status === 'Cancelled') return false;
        if (o.status === 'Completed' && o.paymentStatus === 'Paid') return false;
        return true;
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const completed = orders.filter(o => {
        return o.status === 'Cancelled' || (o.status === 'Completed' && o.paymentStatus === 'Paid');
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return { activeOrders: active, completedOrders: completed };
  }, [orders]);

  // --- Strict Menu Filter ---
  const menuCategories = useMemo(() => {
    const cats: Record<string, MenuItem[]> = {};
    const sortedItems = [...menuItems].sort((a, b) => a.name.localeCompare(b.name));
    
    sortedItems.forEach(item => {
       const avail = item.availability || [];
       // Only show items that are explicitly available for Online or Takeout
       const isAvailableForOrdering = avail.includes('Online') || avail.includes('Takeout');
       
       if (isAvailableForOrdering) {
          if (!cats[item.category]) cats[item.category] = [];
          cats[item.category].push(item);
       }
    });
    return Object.entries(cats).sort((a, b) => a[0].localeCompare(b[0]));
  }, [menuItems]);

  const addToCart = (item: MenuItem, quantity: number = 1) => {
    if (cart.length > 0 && cart.some(c => c.type === 'meal-plan')) {
       alert("Your cart already contains a Meal Plan. Please clear it first.");
       return;
    }
    setCart(prev => {
      const existing = prev.find(c => c.item.id === item.id && c.type === 'standard');
      if (existing) {
        return prev.map(c => c.cartId === existing.cartId ? { ...c, qty: c.qty + quantity } : c);
      }
      return [...prev, { item, qty: quantity, type: 'standard', cartId: Math.random().toString(36).substr(2, 9) }];
    });
  };

  const updateCartQty = (cartId: string, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.cartId === cartId) return { ...c, qty: Math.max(0, c.qty + delta) };
      return c;
    }).filter(c => c.qty > 0));
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

  const openProductDetail = (item: MenuItem, context: { type: 'menu' } | { type: 'plan', dateKey: string, service: string } = { type: 'menu' }) => {
    if (context.type === 'plan') {
       if (checkIsLocked(context.dateKey)) return; 
    }
    setSelectedProduct(item);
    setDetailQty(1);
    setDetailContext(context);
  };

  const handleAddToCartFromDetail = () => {
    if (selectedProduct) {
      if (detailContext.type === 'plan') {
         updateMealQty(detailContext.dateKey, detailContext.service, selectedProduct.id, detailQty);
         setSelectedProduct(null);
      } else {
         addToCart(selectedProduct, detailQty);
         setSelectedProduct(null);
      }
    }
  };

  const cartTotals = useMemo(() => {
    if (!currentUser) return { subtotal: 0, discount: 0, standardDiscount: 0, birthdayDiscount: 0, standardLabel: '', bulkDiscount: 0, netTotal: 0, vat: 0, total: 0 };

    const subtotal = cart.reduce((acc, c) => acc + (c.item.price * c.qty), 0);
    let totalStandardDiscount = 0;
    let totalBirthdayDiscount = 0;
    let standardLabel = '';

    const tierObj = loyaltyTiers.find(t => t.name.toLowerCase() === currentUser.tier?.toLowerCase());
    const groupObj = customerGroups.find(g => g.name.toLowerCase() === currentUser.group?.toLowerCase());

    const standardTierRate = tierObj?.standardDiscount || 0;
    const birthdayTierRate = tierObj?.birthdayDiscount || 0;
    const groupRate = groupObj?.discountPercentage || 0;

    const effectiveStandardRate = Math.max(standardTierRate, groupRate);
    standardLabel = standardTierRate >= groupRate ? `${tierObj?.name} Tier` : `${groupObj?.name} Group`;

    let bMonth = -1, bDay = -1;
    if (currentUser.birthday) {
        const [_, m, d] = currentUser.birthday.split('-').map(Number);
        bMonth = m; 
        bDay = d;
    }

    cart.forEach(cartItem => {
        const itemTotal = cartItem.item.price * cartItem.qty;
        totalStandardDiscount += itemTotal * (effectiveStandardRate / 100);

        let isItemBirthday = false;
        const dateToCheck = cartItem.details?.date || systemDate;
        const [_, m, d] = dateToCheck.split('-').map(Number);
        if (m === bMonth && d === bDay) isItemBirthday = true;

        if (isItemBirthday && birthdayTierRate > 0) {
            totalBirthdayDiscount += itemTotal * (birthdayTierRate / 100);
        }
    });

    let bulkDiscount = 0;
    if (config.bulkDiscountEnabled && cart.length > 0 && cart[0].type === 'meal-plan') {
       config.activeServices.forEach(service => {
          const serviceItems = cart.filter(i => i.details?.service === service);
          if (serviceItems.length > 0) {
             const uniqueDates = new Set(serviceItems.map(i => i.details?.date));
             if (uniqueDates.size >= config.operatingDays.length) {
                const serviceSubtotal = serviceItems.reduce((acc, i) => acc + (i.item.price * i.qty), 0);
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
    
    return { 
        subtotal, 
        discount: totalDiscount, 
        standardDiscount: totalStandardDiscount,
        birthdayDiscount: totalBirthdayDiscount,
        standardLabel, 
        bulkDiscount, 
        netTotal, 
        vat, 
        total 
    };
  }, [cart, currentUser, config, loyaltyTiers, customerGroups, systemDate]);

  const handleCancelItem = (orderId: string, item: OrderItem) => {
     setCancelModal({ 
        isOpen: true, 
        orderId, 
        itemDetails: { date: item.deliveryDate || '', slot: item.serviceSlot || '', itemId: item.itemId, name: item.name } 
     });
  };

  const submitCancellation = () => {
    if (!cancelModal.orderId || !cancelModal.itemDetails) return;
    cancelOrderItem(cancelModal.orderId, cancelModal.itemDetails.date, cancelModal.itemDetails.slot, cancelModal.itemDetails.itemId);
    setCancelModal({ isOpen: false, orderId: null });
  };

  const getPlanDates = () => {
     const [y, m, d] = systemDate.split('-').map(Number);
     const systemDateObj = new Date(y, m - 1, d);
     const day = systemDateObj.getDay();
     const diff = systemDateObj.getDate() - day + (day === 0 ? -6 : 1); 
     const currentMonday = new Date(systemDateObj.setDate(diff));

     const weekStart = new Date(currentMonday);
     if (planView === 'next') {
         weekStart.setDate(weekStart.getDate() + 7);
     }

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

  const getMealQty = (dateKey: string, service: string, itemId: string) => {
      return mealSelections[`${dateKey}-${service}`]?.[itemId] || 0;
  };

  const confirmPlanToCart = () => {
      if (cart.length > 0 && cart.some(c => c.type === 'standard')) {
         alert("Your cart already contains a menu order. Please clear it first.");
         return;
      }
      const itemsToAdd: CartItem[] = [];
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
                         item, qty, type: 'meal-plan', cartId: Math.random().toString(36).substr(2, 9),
                         details: { date: dateKey, day: dayObj.day, service: service, paymentType: paymentPreference }
                      });
                  }
              });
          }
      });
      if (itemsToAdd.length === 0) {
         if (Object.keys(mealSelections).length > 0) alert("Selected items are past the cut-off time and could not be added.");
         return;
      }
      setCart(prev => [...prev, ...itemsToAdd]);
      setActiveTab('cart');
      setMealSelections({}); 
  };

  const handleOpenCheckout = () => {
    if (cart.length === 0) return;
    setIsCheckoutOpen(true);
    setCheckoutStep('details');
  };

  const handlePlaceOrder = () => {
    if (isPlacingOrder || !currentUser) return;
    setIsPlacingOrder(true);
    setLastCheckoutTotal(cartTotals.total);

    setTimeout(() => {
      const newRef = `ORD-${Math.floor(Math.random() * 10000)}`;
      setOrderRef(newRef);
      setCheckoutStep('success');
      
      const isPerDelivery = cart.some(c => c.type === 'meal-plan' && c.details?.paymentType === 'per-delivery');
      const orderType = cart.some(c => c.type === 'meal-plan') ? 'Meal Plan' : (fulfillmentType === 'delivery' ? 'Delivery' : 'Takeout');
      
      const selectedMethod = isPayOnDelivery ? 
        paymentMethods.find(m => m.name === 'Cash on Delivery') : 
        paymentMethods.find(m => m.id === selectedPaymentMethodId);

      const newOrder: Order = {
         id: newRef,
         customerName: currentUser.name,
         type: orderType as any,
         status: 'Pending',
         paymentStatus: 'Pending', 
         paymentScheme: isPerDelivery ? 'Per-Delivery' : 'Upfront',
         tenderType: selectedMethod?.type,
         paymentMethodName: selectedMethod?.name,
         items: cart.map(c => ({
            itemId: c.item.id,
            name: c.item.name,
            qty: c.qty,
            price: c.item.price,
            deliveryDate: c.details?.date,
            deliveryDay: c.details?.day,
            serviceSlot: c.details?.service,
            paymentStatus: 'Pending',
            status: 'Active',
            paymentMethodName: selectedMethod?.name
         })),
         total: cartTotals.total,
         timestamp: new Date().toISOString(),
         isReconciled: false,
         discount: cartTotals.discount
      };
      addOrder(newOrder);
      setCart([]);
      setIsPlacingOrder(false);
    }, 1500);
  };

  const groupCartItems = (items: CartItem[]) => {
    const grouped: { [s: string]: { [d: string]: CartItem[] } } = {};
    items.forEach(i => {
       const s = i.details?.service || 'Standard';
       const d = i.details?.date || 'ASAP';
       if (!grouped[s]) grouped[s] = {};
       if (!grouped[s][d]) grouped[s][d] = [];
       grouped[s][d].push(i);
    });
    return Object.keys(grouped).map(s => ({
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

  const groupOrderItemsByDay = (items: OrderItem[]) => {
    const sortedItems = [...items].sort((a, b) => {
        if (!a.deliveryDate) return 1;
        if (!b.deliveryDate) return -1;
        return a.deliveryDate.localeCompare(b.deliveryDate);
    });

    const grouped: { [key: string]: { dayNum: string, dayName: string, items: OrderItem[] } } = {};
    
    sortedItems.forEach(item => {
        const dateKey = item.deliveryDate || 'ASAP';
        if (!grouped[dateKey]) {
            let dayNum = '', dayName = '';
            if (dateKey !== 'ASAP') {
               const [y, m, d] = dateKey.split('-').map(Number);
               const dateObj = new Date(y, m - 1, d);
               dayNum = dateObj.getDate().toString();
               dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
            }
            grouped[dateKey] = { dayNum, dayName, items: [] };
        }
        grouped[dateKey].items.push(item);
    });

    return Object.values(grouped);
  };

  const getTabTitle = () => {
    switch (activeTab) {
      case 'home': return currentUser ? `Hello, ${currentUser.firstName}!` : 'Welcome';
      case 'menu': return 'Daily Menu';
      case 'cart': return 'Your Cart';
      case 'plan': return 'Weekly Plan';
      case 'profile': return 'My Profile';
      case 'orders': return 'Order History';
      default: return 'Customer Portal';
    }
  };

  const getServiceStyle = (service: string) => {
    switch(service) {
      case 'Breakfast': return { color: 'text-secondary', bg: 'bg-secondary/10', icon: <Coffee className="size-3.5" /> };
      case 'Lunch': return { color: 'text-warning', bg: 'bg-warning/10', icon: <Sun className="size-3.5" /> };
      case 'Dinner': return { color: 'text-primary', bg: 'bg-primary/10', icon: <Moon className="size-3.5" /> };
      default: return { color: 'text-slate-500', bg: 'bg-slate-100', icon: <Utensils className="size-3.5" /> };
    }
  };

  // --- BIRTHDAY LOGIC ---
  const isBirthdayToday = useMemo(() => {
    if (!currentUser || !currentUser.birthday) return false;
    const [_, bM, bD] = currentUser.birthday.split('-').map(Number);
    const [__, sM, sD] = systemDate.split('-').map(Number);
    return bM === sM && bD === sD;
  }, [currentUser, systemDate]);

  const birthdayPerkPercent = useMemo(() => {
    if (!currentUser) return 0;
    const tierObj = loyaltyTiers.find(t => t.name.toLowerCase() === currentUser.tier?.toLowerCase());
    return tierObj?.birthdayDiscount || 0;
  }, [loyaltyTiers, currentUser]);

  // --- DYNAMIC TIER CALCULATION ---
  const tierProgress = useMemo(() => {
     if (!currentUser) return { current: 'Bronze', next: 'Silver', progress: 0, points: 0, toNext: 1000 };
     
     const sortedTiers = [...loyaltyTiers].sort((a, b) => a.pointsThreshold - b.pointsThreshold);
     const currentTier = sortedTiers.find(t => t.name.toLowerCase() === currentUser.tier?.toLowerCase()) || sortedTiers[0];
     const nextTierIdx = sortedTiers.indexOf(currentTier) + 1;
     const nextTier = sortedTiers[nextTierIdx];

     if (!nextTier) {
        return { 
           current: currentTier.name, 
           next: 'Max Level', 
           progress: 100, 
           points: currentUser.points, 
           toNext: 0 
        };
     }

     const threshold = nextTier.pointsThreshold;
     const currentPoints = currentUser.points;
     const prevThreshold = currentTier.pointsThreshold;
     
     // Progress within the current bracket
     const progress = Math.min(100, Math.max(0, ((currentPoints - prevThreshold) / (threshold - prevThreshold)) * 100));
     
     return {
        current: currentTier.name,
        next: nextTier.name,
        progress,
        points: currentPoints,
        toNext: threshold - currentPoints
     };
  }, [currentUser, loyaltyTiers]);

  if (!currentUser) {
     return (
        <div className="h-full w-full bg-slate-50 flex flex-col items-center justify-center p-6 animate-in fade-in duration-500">
           <div className="max-w-md w-full bg-white rounded-[40px] shadow-2xl p-10 text-center">
              <div className="size-20 bg-primary text-white rounded-[32px] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-primary/30">
                 <User className="size-10" />
              </div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tighter mb-2">Customer Portal</h1>
              <p className="text-slate-500 font-medium mb-10">Select a verified identity to continue.</p>
              
              <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                 {customersList.map(c => (
                    <button 
                       key={c.id} 
                       onClick={() => { setCurrentUser(c); setActiveTab('home'); }}
                       className="w-full flex items-center gap-4 p-4 rounded-3xl border border-slate-100 bg-slate-50 hover:bg-white hover:border-primary/30 hover:shadow-lg transition-all group"
                    >
                       <img src={c.avatar} className="size-12 rounded-2xl object-cover border-2 border-white shadow-sm" />
                       <div className="text-left">
                          <p className="font-black text-slate-900 text-sm group-hover:text-primary transition-colors">{c.name}</p>
                          <div className="flex gap-2 mt-1">
                             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{c.tier}</span>
                             {c.storeCredit && c.storeCredit > 0 ? (
                                <span className="text-[10px] font-black text-success uppercase tracking-widest">Credit: {formatCurrency(c.storeCredit)}</span>
                             ) : null}
                          </div>
                       </div>
                       <ChevronRight className="size-5 text-slate-300 ml-auto group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </button>
                 ))}
                 {customersList.length === 0 && <p className="text-sm text-slate-400">No customers found in CRM.</p>}
              </div>
              
              <div className="mt-8 pt-8 border-t border-slate-100">
                 <button onClick={onLogout} className="flex items-center justify-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">
                    <LogOut className="size-4" /> Exit Portal
                 </button>
              </div>
           </div>
        </div>
     );
  }

  return (
    <div className="h-full bg-slate-50 flex flex-col relative overflow-hidden font-sans">
      
      {/* GLOBAL PERSISTENT HEADER */}
      <header className="sticky top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 p-6 flex justify-between items-center shrink-0">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight transition-all duration-300">
          {getTabTitle()}
        </h2>
        <div className="relative">
          <button 
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)} 
            className="size-11 rounded-full border-2 border-white shadow-md overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all"
          >
            <img src={currentUser.avatar} className="w-full h-full object-cover" alt="Profile" />
          </button>
          {isProfileMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsProfileMenuOpen(false)}></div>
              <div className="absolute right-0 top-12 w-52 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-20 animate-in slide-in-from-top-2 fade-in duration-200">
                <div className="p-4 bg-slate-50/50 border-b border-slate-100">
                  <p className="text-xs font-black text-slate-900 uppercase tracking-widest">{currentUser.name}</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-0.5">{currentUser.tier} Member</p>
                </div>
                <div className="p-1.5">
                  <button onClick={() => { setActiveTab('profile'); setIsProfileMenuOpen(false); }} className="w-full text-left px-3 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-primary rounded-xl flex items-center gap-2.5 transition-all">
                    <User className="size-4" /> My Profile
                  </button>
                  <button onClick={() => { setCurrentUser(null); setIsProfileMenuOpen(false); }} className="w-full text-left px-3 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-900 rounded-xl flex items-center gap-2.5 transition-all">
                    <User className="size-4" /> Switch User
                  </button>
                  <button onClick={() => { onLogout?.(); setIsProfileMenuOpen(false); }} className="w-full text-left px-3 py-2.5 text-xs font-bold text-danger hover:bg-danger/5 rounded-xl flex items-center gap-2.5 transition-all">
                    <LogOut className="size-4" /> Log Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar pb-24 relative">
        {/* ... (HOME, MENU, etc. sections remain largely same) */}
        
        {activeTab === 'home' && (
          <div className="p-6 pt-2 space-y-8 animate-in fade-in duration-500">
            {/* Celebration Birthday Card */}
            {isBirthdayToday && (
              <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-[32px] p-8 text-white relative overflow-hidden shadow-2xl shadow-indigo-900/20 border border-white/10">
                <div className="absolute top-0 right-0 p-4 opacity-10"><Cake className="size-48" /></div>
                <div className="absolute -bottom-8 -left-8 size-32 bg-white/10 rounded-full blur-2xl"></div>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                     <div className="size-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                        <Sparkles className="size-6 text-white" />
                     </div>
                     <h3 className="text-2xl font-black">Happy Birthday, {currentUser.firstName}!</h3>
                  </div>
                  <p className="text-white/80 font-bold text-sm leading-relaxed max-w-sm mb-6">
                    Today is your special day! As a {currentUser.tier} member, you're entitled to a <span className="text-indigo-200 font-black underline decoration-indigo-200 underline-offset-4">{birthdayPerkPercent}% Birthday Discount</span> on any meal ordered today.
                  </p>
                  <button onClick={() => setActiveTab('menu')} className="px-8 py-3 bg-white text-indigo-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all flex items-center gap-2">
                    Claim My Perk <ArrowRight className="size-4" />
                  </button>
                </div>
              </div>
            )}

            <div className="bg-slate-900 rounded-[32px] p-8 text-white relative overflow-hidden shadow-xl shadow-slate-900/20">
              <div className="absolute top-0 right-0 size-64 bg-primary/30 rounded-full blur-3xl -mr-16 -mt-16"></div>
              <div className="relative z-10">
                <h3 className="text-2xl font-black text-white">{tierProgress.current} Member</h3>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-xs font-bold text-white/80">
                     <span>{tierProgress.points} pts</span>
                     <span>{tierProgress.next === 'Max Level' ? 'Max Level Reached' : `Next: ${tierProgress.next}`}</span>
                  </div>
                  <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                     <div className="h-full bg-primary rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)] transition-all duration-1000" style={{ width: `${tierProgress.progress}%` }}></div>
                  </div>
                  {tierProgress.next !== 'Max Level' && (
                     <p className="text-xs text-white/50 font-medium mt-1">Earn {tierProgress.toNext} more points to reach {tierProgress.next}!</p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setActiveTab('menu')} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl transition-all group text-left h-48 flex flex-col justify-between">
                <div className="size-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><ShoppingBag className="size-6" /></div>
                <h3 className="text-lg font-black text-slate-900 leading-tight">Order<br/>Menu</h3>
              </button>
              <button onClick={() => setActiveTab('plan')} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl transition-all group text-left h-48 flex flex-col justify-between">
                <div className="size-12 bg-accent/10 text-accent rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><CalendarDays className="size-6" /></div>
                <h3 className="text-lg font-black text-slate-900 leading-tight">Weekly<br/>Plan</h3>
              </button>
            </div>
          </div>
        )}

        {/* MENU TAB */}
        {activeTab === 'menu' && (
          <div className="p-6 pt-2 space-y-8 animate-in slide-in-from-right-4 duration-300 min-h-[600px] bg-slate-50">
            {menuCategories.map(([category, items]) => (
              <div key={category} className="space-y-4">
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Layers className="size-4 text-slate-400" />
                  {category}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {items.map(item => (
                    <div key={item.id} onClick={() => openProductDetail(item)} className="bg-white p-3 rounded-[24px] border border-slate-100 shadow-sm hover:shadow-xl transition-all group flex flex-col cursor-pointer h-full">
                      <div className="aspect-square rounded-[18px] bg-slate-100 mb-3 overflow-hidden relative">
                        <img src={item.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={item.name} />
                      </div>
                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <h4 className="text-sm font-black text-slate-900 leading-tight mb-0.5 truncate">{item.name}</h4>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.category}</p>
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-sm font-black text-primary">{formatCurrency(calculateTotal(item.price))}</span>
                          <button onClick={(e) => { e.stopPropagation(); addToCart(item); }} className="size-8 bg-slate-900 text-white rounded-lg hover:bg-primary transition-all flex items-center justify-center">
                            <Plus className="size-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            
            {menuCategories.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 text-center opacity-50">
                <Utensils className="size-12 mb-4 text-slate-400" />
                <p className="font-bold text-slate-500">Menu items unavailable.</p>
              </div>
            )}
          </div>
        )}

        {/* CART TAB */}
        {activeTab === 'cart' && (
           <div className="p-6 pt-2 space-y-8 animate-in slide-in-from-bottom-8 duration-300">
              {cart.length === 0 ? (
                 <div className="py-20 text-center text-slate-400"><ShoppingBag className="size-16 mx-auto mb-4 opacity-50" /><p className="font-bold">Your cart is empty</p><button onClick={() => setActiveTab('menu')} className="mt-4 px-6 py-3 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest">Browse Menu</button></div>
              ) : (
                 <div className="space-y-6">
                    {cart.some(c => c.type === 'meal-plan') ? (
                       <div className="space-y-8">
                          <div className="flex items-center gap-2 mb-2">
                             <div className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-[0.2em]">Weekly Plan Preview</div>
                          </div>
                          {groupCartItems(cart).map((group, gIdx) => (
                             <div key={gIdx} className="space-y-4">
                                <div className="flex items-center gap-2"><div className="size-1.5 rounded-full bg-primary/40"></div><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{group.service}</p></div>
                                <div className="space-y-4">
                                   {group.dateGroups.map((dateGroup) => (
                                      <div key={dateGroup.date} className="flex bg-white border border-slate-100 rounded-[28px] overflow-hidden shadow-sm">
                                         {dateGroup.date !== 'ASAP' && (
                                            <div className="w-16 bg-slate-50 border-r border-slate-100 flex flex-col items-center justify-center p-2 shrink-0">
                                               <span className="text-[8px] font-black text-slate-400 uppercase leading-none mb-0.5">{dateGroup.month}</span>
                                               <span className="text-xl font-black text-slate-900 leading-none">{dateGroup.dayNumber}</span>
                                               <span className="text-[8px] font-bold text-slate-300 uppercase leading-none mt-0.5">{dateGroup.dayName}</span>
                                            </div>
                                         )}
                                         <div className="flex-1 divide-y divide-slate-50">
                                            {dateGroup.items.map((c) => (
                                               <div key={c.cartId} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                                  <div className="flex-1 min-w-0 pr-4">
                                                     <p className="text-sm font-black text-slate-900 truncate">{c.item.name}</p>
                                                     <div className="flex items-center gap-2 mt-1">
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase">{formatCurrency(calculateTotal(c.item.price))}</p>
                                                        <span className="text-[9px] font-black px-2 py-0.5 bg-slate-100 text-slate-500 rounded">Qty: {c.qty}</span>
                                                     </div>
                                                  </div>
                                                  <div className="flex items-center gap-3">
                                                     <button onClick={() => updateCartQty(c.cartId, -1)} className="size-8 rounded-xl bg-slate-50 text-slate-400 hover:text-danger hover:bg-danger/10 transition-all flex items-center justify-center">
                                                        <Minus className="size-4" />
                                                     </button>
                                                     <span className="text-sm font-black w-4 text-center">{c.qty}</span>
                                                     <button onClick={() => updateCartQty(c.cartId, 1)} className="size-8 rounded-xl bg-slate-50 text-slate-400 hover:text-primary hover:bg-primary/10 transition-all flex items-center justify-center">
                                                        <Plus className="size-4" />
                                                     </button>
                                                  </div>
                                               </div>
                                            ))}
                                         </div>
                                      </div>
                                   ))}
                                </div>
                             </div>
                          ))}
                       </div>
                    ) : (
                       <div className="space-y-4">
                          {cart.map((c) => (
                             <div key={c.cartId} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-[24px] hover:shadow-md transition-all">
                                <div className="flex items-center gap-4">
                                   <img src={c.item.image} className="size-16 rounded-2xl object-cover" />
                                   <div>
                                      <p className="text-sm font-black text-slate-900">{c.item.name}</p>
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatCurrency(calculateTotal(c.item.price))}</p>
                                   </div>
                                </div>
                                <div className="flex items-center gap-4">
                                   <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-1">
                                      <button onClick={() => updateCartQty(c.cartId, -1)} className="size-8 rounded-lg bg-white shadow-sm text-slate-600 flex items-center justify-center hover:text-danger"><Minus className="size-3" /></button>
                                      <span className="text-xs font-black w-6 text-center">{c.qty}</span>
                                      <button onClick={() => updateCartQty(c.cartId, 1)} className="size-8 rounded-lg bg-slate-900 text-white shadow-sm flex items-center justify-center hover:bg-primary"><Plus className="size-3" /></button>
                                   </div>
                                   <button onClick={() => updateCartQty(c.cartId, -999)} className="p-2 text-slate-300 hover:text-danger transition-colors"><Trash2 className="size-4" /></button>
                                </div>
                             </div>
                          ))}
                       </div>
                    )}

                    <div className="bg-white rounded-[32px] border border-slate-200 p-8 shadow-sm">
                       <div className="space-y-3 mb-6">
                          <div className="flex justify-between text-xs font-bold text-slate-500"><span>Subtotal</span><span>{formatCurrency(cartTotals.subtotal)}</span></div>
                          {cartTotals.standardDiscount > 0 && <div className="flex justify-between text-xs font-bold text-primary"><span>{cartTotals.standardLabel} Discount</span><span>-{formatCurrency(cartTotals.standardDiscount)}</span></div>}
                          {cartTotals.birthdayDiscount > 0 && <div className="flex justify-between text-xs font-bold text-accent"><span>Birthday Discount</span><span>-{formatCurrency(cartTotals.birthdayDiscount)}</span></div>}
                          {cartTotals.bulkDiscount > 0 && <div className="flex justify-between text-xs font-bold text-success"><span>Bulk Plan Discount</span><span>-{formatCurrency(cartTotals.bulkDiscount)}</span></div>}
                          <div className="flex justify-between text-xs font-bold text-slate-500"><span>VAT ({config.vatRate}%)</span><span>{formatCurrency(cartTotals.vat)}</span></div>
                          <div className="pt-4 border-t border-slate-100 flex justify-between text-xl font-black text-slate-900"><span>Total</span><span>{formatCurrency(cartTotals.total)}</span></div>
                       </div>
                       <button onClick={handleOpenCheckout} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2">
                          Proceed to Checkout <ArrowRight className="size-4" />
                       </button>
                    </div>
                 </div>
              )}
           </div>
        )}

        {/* PLANNER & ORDERS tabs remain mostly same structure... skipping large unmodified chunks but ensuring proper closing */}
        {activeTab === 'plan' && (
           <div className="p-6 pt-2 space-y-8 animate-in fade-in duration-500 pb-32">
              {/* ... Planner content ... */}
              <div className="space-y-6">
                 <div className="flex gap-4">
                    <div className="flex-1 space-y-2">
                       <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Week Selection</p>
                       <div className="flex bg-white p-1 rounded-[20px] border border-slate-200 shadow-sm">
                          <button onClick={() => setPlanView('current')} className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${planView === 'current' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>This Week</button>
                          <button onClick={() => setPlanView('next')} className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${planView === 'next' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Next Week</button>
                       </div>
                    </div>
                    <div className="flex-1 space-y-2">
                       <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Payment Plan</p>
                       <div className="flex bg-white p-1 rounded-[20px] border border-slate-200 shadow-sm">
                          <button onClick={() => setPaymentPreference('upfront')} className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${paymentPreference === 'upfront' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}><Wallet className="size-3" /> Upfront</button>
                          <button onClick={() => setPaymentPreference('per-delivery')} className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${paymentPreference === 'per-delivery' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}><Truck className="size-3" /> On Delivery</button>
                       </div>
                    </div>
                 </div>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-4 snap-x hide-scrollbar">
                 {getPlanDates().map((dayObj) => {
                    const isLocked = checkIsLocked(dayObj.dateKey);
                    let isBirthday = false;
                    if (currentUser && currentUser.birthday) {
                       const [_, bMonth, bDay] = currentUser.birthday.split('-').map(Number);
                       const [__, dMonth, dDay] = dayObj.dateKey.split('-').map(Number);
                       if (bMonth === dMonth && bDay === dDay) isBirthday = true;
                    }
                    return (
                       <div key={dayObj.dateKey} className={`snap-center min-w-[300px] flex flex-col gap-4 ${isLocked ? 'opacity-60' : ''}`}>
                          <div className={`p-6 rounded-[28px] text-center border-2 transition-all bg-white border-slate-100 shadow-sm relative overflow-hidden`}>
                             {isLocked && <div className="absolute top-2 right-2 text-slate-300"><Lock className="size-4" /></div>}
                             <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{dayObj.day}</p>
                             <div className="flex items-center justify-center gap-2 mt-1">
                                {isBirthday && <Cake className="size-6 text-accent -mt-1 animate-bounce" />}
                                <p className="text-2xl font-black tracking-tighter text-slate-900">{dayObj.fullDate.toLocaleDateString('en-US', { month: 'short' })} {dayObj.date}</p>
                             </div>
                          </div>
                          {config.activeServices.map(service => {
                             const menu = getDayMenu(dayObj.dateKey, service);
                             const style = getServiceStyle(service);
                             return (
                                <div key={service} onClick={() => openProductDetail(MEAL_LIBRARY_ITEMS.find(i => i.availability.includes('Meal Plan')) || MEAL_LIBRARY_ITEMS[0], { type: 'plan', dateKey: dayObj.dateKey, service })} className="bg-white rounded-[24px] p-3 border border-slate-100 shadow-sm flex flex-col gap-3 cursor-pointer hover:shadow-md transition-all">
                                   <div className="flex items-center gap-2 px-2 pt-1"><div className={`size-6 rounded-full flex items-center justify-center ${style.bg} ${style.color}`}>{style.icon}</div><span className={`text-[10px] font-black uppercase tracking-widest ${style.color}`}>{service}</span></div>
                                   <div className="space-y-2">
                                      {menu.length === 0 ? <div className="py-4 text-center opacity-40 text-[9px] font-bold uppercase tracking-widest text-slate-400">No Options</div> : menu.map(item => {
                                         const qty = getMealQty(dayObj.dateKey, service, item.id);
                                         return (
                                            <div key={item.id} onClick={(e) => { e.stopPropagation(); openProductDetail(item, { type: 'plan', dateKey: dayObj.dateKey, service }); }} className={`p-3 rounded-[18px] border transition-all flex gap-3 items-center group cursor-pointer ${qty > 0 ? 'bg-primary/5 border-primary/20' : 'bg-slate-50 border-transparent hover:bg-white hover:border-slate-200'}`}><img src={item.image} className="size-10 rounded-xl object-cover shrink-0" /><div className="flex-1 min-w-0"><p className="text-[10px] font-black truncate text-slate-900 leading-tight">{item.name}</p><p className="text-[9px] font-bold text-slate-400">{formatCurrency(calculateTotal(item.price))}</p></div>{!isLocked && (<div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>{qty > 0 && <button onClick={(e) => { e.stopPropagation(); updateMealQty(dayObj.dateKey, service, item.id, -1); }} className="size-6 bg-white shadow-sm rounded-lg flex items-center justify-center text-slate-500 hover:text-danger"><Minus className="size-3" /></button>}{qty > 0 && <span className="text-xs font-black w-4 text-center">{qty}</span>}<button onClick={(e) => { e.stopPropagation(); updateMealQty(dayObj.dateKey, service, item.id, 1); }} className={`size-6 rounded-lg flex items-center justify-center transition-all ${qty > 0 ? 'bg-primary text-white shadow-sm' : 'bg-white shadow-sm text-slate-400 hover:text-primary'}`}><Plus className="size-3" /></button></div>)}</div>
                                         );
                                      })}
                                   </div>
                                </div>
                             );
                          })}
                       </div>
                    );
                 })}
              </div>
              <div className="fixed bottom-24 left-6 right-6 z-40"><button onClick={confirmPlanToCart} disabled={Object.keys(mealSelections).length === 0} className="w-full py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-2xl hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100">Add Selections to Cart</button></div>
           </div>
        )}

        {activeTab === 'orders' && (
           <div className="p-6 pt-2 space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="flex bg-white border border-slate-200 p-1 rounded-[20px] w-fit">
                 <button onClick={() => setHistoryFilter('active')} className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${historyFilter === 'active' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Active</button>
                 <button onClick={() => setHistoryFilter('completed')} className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${historyFilter === 'completed' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>History</button>
              </div>
              {(historyFilter === 'active' ? activeOrders : completedOrders).length === 0 ? (<div className="py-20 text-center opacity-40"><History className="size-16 mx-auto mb-4" /><p className="font-bold">No orders found.</p></div>) : ((historyFilter === 'active' ? activeOrders : completedOrders).map(order => {
                    const isOpen = expandedOrders[order.id];
                    let paidAmount = 0;
                    order.items.forEach(i => { if (i.paymentStatus === 'Paid') paidAmount += calculateTotal(i.price * i.qty); });
                    const outstanding = Math.max(0, order.total - paidAmount);
                    return (<div key={order.id} className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-sm transition-all hover:shadow-md"><div onClick={() => toggleOrderExpand(order.id)} className="p-6 cursor-pointer bg-white hover:bg-slate-50/50 transition-colors"><div className="flex justify-between items-start mb-4"><div><div className="flex items-center gap-2 mb-1"><span className="text-[10px] font-black uppercase tracking-widest text-accent">{order.type.toUpperCase()} ORDER</span><span className="text-[10px] font-bold text-slate-300">•</span><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">#{order.id}</span></div><p className="text-xs font-bold text-slate-400">Created: {new Date(order.timestamp).toLocaleDateString()}</p></div><div className="text-right"><p className="text-xl font-black text-slate-900">{formatCurrency(order.total)}</p><div className="flex justify-end gap-2 mt-1"><span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${order.paymentStatus === 'Paid' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>Payment {order.paymentStatus}</span><span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-[9px] font-black uppercase tracking-widest">{order.status}</span></div></div></div><div className="flex gap-4"><div className="flex-1 bg-success/5 border border-success/10 rounded-xl p-3"><p className="text-[9px] font-black uppercase text-success/60 tracking-widest mb-0.5">Total Paid</p><p className="text-sm font-black text-success">{formatCurrency(paidAmount)}</p></div><div className="flex-1 bg-warning/5 border border-warning/10 rounded-xl p-3"><p className="text-[9px] font-black uppercase text-warning/60 tracking-widest mb-0.5">Outstanding</p><p className="text-sm font-black text-warning">{formatCurrency(outstanding)}</p></div></div><div className="flex justify-center mt-2">{isOpen ? <ChevronUp className="size-4 text-slate-300" /> : <ChevronDown className="size-4 text-slate-300" />}</div></div>{isOpen && (<div className="border-t border-slate-100 bg-slate-50/50 p-6 space-y-6">{order.type === 'Meal Plan' ? (groupOrderItemsByDay(order.items).map((group, idx) => (<div key={idx} className="space-y-3">{group.dayName && (<div className="flex items-center gap-3"><div className="flex flex-col items-center justify-center w-10"><span className="text-[9px] font-black uppercase text-slate-400 leading-none">{group.dayName}</span><span className="text-lg font-black text-slate-900 leading-none">{group.dayNum}</span></div><div className="h-px flex-1 bg-slate-200"></div></div>)}<div className="space-y-2">{group.items.map((item, i) => (<div key={i} className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm"><div><p className="text-sm font-black text-slate-900">{item.name} <span className="text-slate-400">x{item.qty}</span></p><p className="text-[10px] font-bold text-slate-400">{formatCurrency(calculateTotal(item.price * item.qty))}</p></div><div className="flex flex-col items-end gap-1"><span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{item.serviceSlot ? item.serviceSlot.toUpperCase() : 'STANDARD'}</span><div className="flex gap-2"><span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${getMealItemStatus(item, order.type, systemDate).includes('Delivered') || getMealItemStatus(item, order.type, systemDate).includes('Completed') ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-white text-slate-400 border-slate-200'}`}>{getMealItemStatus(item, order.type, systemDate)}</span>{order.status !== 'Completed' && item.status !== 'Cancelled' && item.status !== 'Delivered' && item.status !== 'Completed' && (<button onClick={(e) => { e.stopPropagation(); handleCancelItem(order.id, item); }} className="px-2 py-0.5 bg-white border border-danger/20 text-danger rounded text-[9px] font-black uppercase tracking-widest hover:bg-danger hover:text-white transition-all">Cancel</button>)}</div></div></div>))}</div></div>))) : (<div className="space-y-2">{order.items.map((item, i) => (<div key={i} className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm"><div><p className="text-sm font-black text-slate-900">{item.name} <span className="text-slate-400">x{item.qty}</span></p><p className="text-[10px] font-bold text-slate-400">{formatCurrency(calculateTotal(item.price * item.qty))}</p></div><div className="flex flex-col items-end gap-1"><span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border bg-slate-100 text-slate-500 border-slate-200`}>{getMealItemStatus(item, order.type, systemDate)}</span>{order.status !== 'Completed' && item.status !== 'Cancelled' && (<button onClick={(e) => { e.stopPropagation(); handleCancelItem(order.id, item); }} className="text-[9px] font-black text-danger uppercase tracking-widest hover:underline mt-1">Cancel Item</button>)}</div></div>))}</div>)}</div>)}</div>);}))}
           </div>
        )}

        {activeTab === 'profile' && currentUser && (
           <div className="p-6 pt-2 space-y-8 animate-in slide-in-from-bottom-4">
              <div className="bg-white rounded-[32px] border border-slate-200 p-8 shadow-sm">
                 <div className="flex items-center gap-6 mb-8">
                    <img src={currentUser.avatar} className="size-20 rounded-3xl object-cover border-4 border-slate-50 shadow-lg" />
                    <div>
                       <h3 className="text-2xl font-black text-slate-900 tracking-tight">{currentUser.name}</h3>
                       <p className="text-sm font-bold text-slate-500">{currentUser.email}</p>
                       <p className="text-sm font-bold text-slate-500">{currentUser.phone}</p>
                    </div>
                 </div>
                 <div className="space-y-6">
                    {/* Store Credit Card */}
                    <div className="bg-slate-900 rounded-[24px] p-6 text-white flex items-center justify-between shadow-lg">
                       <div className="flex items-center gap-4">
                          <div className="size-12 bg-white/10 rounded-2xl flex items-center justify-center">
                             <Wallet className="size-6 text-primary" />
                          </div>
                          <div>
                             <p className="text-[10px] font-black uppercase text-white/40 tracking-widest mb-1">Store Credit Balance</p>
                             <p className="text-2xl font-black text-white">{formatCurrency(currentUser.storeCredit || 0)}</p>
                          </div>
                       </div>
                       <button className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Top Up</button>
                    </div>

                    <div>
                       <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 pb-2 mb-4">Saved Addresses</h4>
                       <div className="space-y-3">
                          {currentUser.addresses.map(addr => (
                             <div key={addr.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-start gap-3">
                                <MapPin className="size-5 text-primary shrink-0" />
                                <div>
                                   <p className="text-sm font-black text-slate-900">{addr.label}</p>
                                   <p className="text-xs font-bold text-slate-500">{addr.street}, {addr.city}</p>
                                </div>
                             </div>
                          ))}
                          {currentUser.addresses.length === 0 && <p className="text-xs text-slate-400 italic">No addresses saved.</p>}
                       </div>
                    </div>
                    <div>
                       <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 pb-2 mb-4">Preferences</h4>
                       <div className="flex flex-wrap gap-2">
                          {currentUser.dietaryPreferences?.map(pref => (
                             <span key={pref} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-widest">{pref}</span>
                          ))}
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-6 pb-safe pt-2 flex justify-between items-end z-40 h-20 shadow-[0_-10px_40px_rgba(0,0,0,0.03)]">
         <PortalNavButton 
            tab="menu" 
            current={activeTab} 
            onClick={setActiveTab} 
            icon={<Utensils />} 
            label="Menu" 
         />
         <PortalNavButton 
            tab="plan" 
            current={activeTab} 
            onClick={setActiveTab} 
            icon={<CalendarDays />} 
            label="Plan" 
         />
         <PortalNavButton 
            tab="home" 
            current={activeTab} 
            onClick={setActiveTab} 
            icon={<Home />} 
            label="Home" 
         />
         <PortalNavButton 
            tab="orders" 
            current={activeTab} 
            onClick={setActiveTab} 
            icon={<History />} 
            label="Orders" 
         />
         <PortalNavButton 
            tab="cart" 
            current={activeTab} 
            onClick={setActiveTab} 
            icon={<ShoppingBag />} 
            label="Cart" 
            badge={cart.reduce((acc, i) => acc + i.qty, 0)} 
         />
      </nav>

      {/* CHECKOUT & PRODUCT DETAIL MODALS ... existing code ... */}
      {isCheckoutOpen && (
         <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-[40px] w-full max-w-lg shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-300 max-h-[85vh] flex flex-col">
               {checkoutStep === 'details' ? (
                  <>
                     <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50"><h3 className="text-xl font-black text-slate-900">Checkout</h3><button onClick={() => setIsCheckoutOpen(false)}><X className="size-6 text-slate-400" /></button></div>
                     <div className="p-8 overflow-y-auto space-y-8 flex-1">
                        {!isMealPlanOrder && (
                           <div className="space-y-4">
                              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Fulfillment Method</h4>
                              <div className="flex gap-4">
                                 <button onClick={() => setFulfillmentType('delivery')} className={`flex-1 p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${fulfillmentType === 'delivery' ? 'border-primary bg-primary/5 text-primary' : 'border-slate-100 bg-white text-slate-400'}`}><Truck className="size-6" /><span className="text-xs font-black uppercase">Delivery</span></button>
                                 <button onClick={() => setFulfillmentType('pickup')} className={`flex-1 p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${fulfillmentType === 'pickup' ? 'border-primary bg-primary/5 text-primary' : 'border-slate-100 bg-white text-slate-400'}`}><ShoppingBag className="size-6" /><span className="text-xs font-black uppercase">Pickup</span></button>
                              </div>
                           </div>
                        )}
                        {(fulfillmentType === 'delivery' || isMealPlanOrder) && (
                           <div className="space-y-4">
                              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Delivery Address</h4>
                              <div className="space-y-2">
                                 {currentUser?.addresses.map(addr => (
                                    <button 
                                       key={addr.id}
                                       onClick={() => setSelectedAddressId(addr.id)}
                                       className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-start gap-3 ${selectedAddressId === addr.id ? 'border-primary bg-primary/5' : 'border-slate-100 bg-slate-50 hover:bg-white'}`}
                                    >
                                       <div className={`mt-0.5 size-4 rounded-full border-2 flex items-center justify-center shrink-0 ${selectedAddressId === addr.id ? 'border-primary' : 'border-slate-300'}`}>
                                          {selectedAddressId === addr.id && <div className="size-2 bg-primary rounded-full" />}
                                       </div>
                                       <div>
                                          <div className="flex items-center gap-2">
                                             <span className="text-xs font-black text-slate-900 uppercase">{addr.label}</span>
                                             {selectedAddressId === addr.id && <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">Selected</span>}
                                          </div>
                                          <p className="text-xs font-medium text-slate-500 mt-1">{addr.street}, {addr.city}</p>
                                       </div>
                                    </button>
                                 ))}
                                 {(!currentUser?.addresses || currentUser.addresses.length === 0) && (
                                    <div className="p-4 bg-warning/10 rounded-2xl border border-warning/20 text-center">
                                       <p className="text-xs font-bold text-warning">No saved addresses found.</p>
                                    </div>
                                 )}
                              </div>
                           </div>
                        )}
                        <div className="space-y-4">
                           <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Payment Method</h4>
                           {isPayOnDelivery ? (
                              <div className="p-4 bg-secondary/10 rounded-2xl border border-secondary/20 flex items-center gap-3"><Wallet className="size-5 text-secondary" /><span className="text-xs font-black text-secondary uppercase tracking-widest">Pay Per Delivery</span></div>
                           ) : (
                              <div className="space-y-2">
                                 {activeMethods.length === 0 ? <p className="text-xs text-danger font-bold">No applicable payment methods.</p> : activeMethods.map(m => (
                                    <button key={m.id} onClick={() => setSelectedPaymentMethodId(m.id)} className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all ${selectedPaymentMethodId === m.id ? 'border-primary bg-primary/5 shadow-sm' : 'border-slate-100 bg-white'}`}>
                                       <span className="text-xl">{m.icon}</span>
                                       <span className="text-xs font-black text-slate-900 uppercase tracking-widest">{m.name}</span>
                                       {selectedPaymentMethodId === m.id && <CheckCircle2 className="size-5 text-primary ml-auto" />}
                                    </button>
                                 ))}
                              </div>
                           )}
                        </div>
                     </div>
                     <div className="p-8 border-t border-slate-100 bg-slate-50"><button onClick={handlePlaceOrder} disabled={isPlacingOrder || (!isPayOnDelivery && !selectedPaymentMethodId) || ((fulfillmentType === 'delivery' || isMealPlanOrder) && !selectedAddressId)} className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black text-xs uppercase tracking-[0.2em] hover:scale-[1.02] transition-all flex items-center justify-center gap-3 disabled:opacity-50">{isPlacingOrder ? <Loader2 className="size-5 animate-spin" /> : <CreditCard className="size-5" />} {isPlacingOrder ? 'Processing...' : `Pay ${formatCurrency(cartTotals.total)}`}</button></div>
                  </>
               ) : (
                  <div className="p-16 flex flex-col items-center justify-center text-center h-full">
                     <div className="size-24 bg-success text-white rounded-full flex items-center justify-center shadow-xl shadow-success/30 mb-8 animate-in zoom-in-95"><Check className="size-12 stroke-[3]" /></div>
                     <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Order Confirmed!</h2>
                     <p className="text-sm font-bold text-slate-500 mb-8">Ref: {orderRef}</p>
                     <p className="text-xs text-slate-400 font-medium max-w-xs mx-auto mb-10">You will receive a confirmation via {currentUser?.email} shortly.</p>
                     <button onClick={() => { setIsCheckoutOpen(false); setActiveTab('orders'); }} className="px-10 py-4 bg-slate-100 text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">Track Order</button>
                  </div>
               )}
            </div>
         </div>
      )}

      {selectedProduct && (
         <div className="fixed inset-0 z-[150] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[80vh]">
               <div className="h-64 bg-slate-100 relative"><img src={selectedProduct.image} className="w-full h-full object-cover" /><button onClick={() => setSelectedProduct(null)} className="absolute top-4 right-4 p-2 bg-white/50 backdrop-blur-md rounded-full text-slate-900 hover:bg-white transition-all"><X className="size-6" /></button></div>
               <div className="p-8 flex-1 overflow-y-auto">
                  <div className="mb-6"><h3 className="text-2xl font-black text-slate-900 leading-tight mb-1">{selectedProduct.name}</h3><p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{selectedProduct.category}</p></div>
                  <p className="text-sm text-slate-600 font-medium leading-relaxed mb-6">{selectedProduct.description}</p>
                  <div className="flex flex-wrap gap-2 mb-8">{selectedProduct.tags?.map(tag => (<span key={tag} className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-widest">{tag}</span>))}</div>
                  <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                     <p className="text-lg font-black text-primary">{formatCurrency(calculateTotal(selectedProduct.price * detailQty))}</p>
                     <div className="flex items-center gap-4 bg-white rounded-xl px-2 py-1 shadow-sm border border-slate-100"><button onClick={() => setDetailQty(Math.max(1, detailQty - 1))} className="p-2 text-slate-400 hover:text-slate-900"><Minus className="size-4" /></button><span className="text-sm font-black w-4 text-center">{detailQty}</span><button onClick={() => setDetailQty(detailQty + 1)} className="p-2 text-slate-400 hover:text-slate-900"><Plus className="size-4" /></button></div>
                  </div>
               </div>
               <div className="p-8 border-t border-slate-100 bg-slate-50"><button onClick={handleAddToCartFromDetail} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] transition-all shadow-xl">Add to {detailContext.type === 'plan' ? 'Plan' : 'Cart'}</button></div>
            </div>
         </div>
      )}

      {/* CANCELLATION MODAL */}
      {cancelModal.isOpen && (
         <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-[32px] p-8 max-w-sm w-full text-center animate-in zoom-in-95">
               <div className="size-16 bg-danger/10 text-danger rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle className="size-8" /></div>
               <h3 className="text-xl font-black text-slate-900 mb-2">Cancel Item?</h3>
               <p className="text-sm font-medium text-slate-500 mb-6">Are you sure you want to cancel <strong>{cancelModal.itemDetails?.name}</strong>? This action cannot be undone.</p>
               <div className="flex gap-4"><button onClick={() => setCancelModal({ isOpen: false, orderId: null })} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase hover:bg-slate-200 transition-all">Keep It</button><button onClick={submitCancellation} className="flex-1 py-3 bg-danger text-white rounded-xl font-black text-xs uppercase shadow-lg shadow-danger/20 hover:brightness-110 transition-all">Confirm Cancel</button></div>
            </div>
         </div>
      )}
    </div>
  );
};

/* --- Dynamic Nav Component --- */
const PortalNavButton = ({ tab, current, onClick, icon, label, badge }: any) => {
  const isActive = current === tab;
  return (
    <button 
      onClick={() => onClick(tab)} 
      className={`flex flex-col items-center gap-1 transition-all duration-300 ${isActive ? '-mt-10 scale-110' : 'hover:scale-105'}`}
    >
      <div className={`transition-all duration-300 flex items-center justify-center relative border-4 border-white ${
        isActive 
          ? 'size-14 rounded-full bg-slate-900 text-white shadow-2xl' 
          : 'size-10 bg-transparent text-slate-400'
      }`}>
        {React.cloneElement(icon, { className: isActive ? 'size-6' : 'size-6' })}
        {badge && (
          <span className={`absolute ${isActive ? 'top-1 right-1' : '-top-1 -right-1'} size-3 bg-danger rounded-full border-2 ${isActive ? 'border-slate-900' : 'border-white'}`}></span>
        )}
      </div>
      <span className={`text-[9px] font-black uppercase tracking-widest transition-colors ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>
        {label}
      </span>
    </button>
  );
};

export default CustomerPortal;
