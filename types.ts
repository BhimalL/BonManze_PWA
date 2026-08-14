
export enum Module {
  DASHBOARD = 'Dashboard',
  POS = 'POS Terminal',
  KITCHEN_PROGRESS = 'Kitchen Progress',
  CASHIER_MODULE = 'Cashier Module',
  INVENTORY = 'Inventory',
  PURCHASE_ORDERING = 'Purchase Ordering',
  CRM_LOYALTY = 'CRM & Loyalty',
  PLANNER = 'Meal Planner',
  MEAL_LIBRARY = 'Meal Library',
  ACCOUNTING_RECEIVABLES = 'Receivables',
  ACCOUNTING_PAYABLES = 'Payables',
  ACCOUNTING_LEDGER = 'General Ledger',
  ACCOUNTING_CASHBOOK = 'Cashbook',
  KITCHEN_PORTAL = 'Kitchen Portal',
  CUSTOMER_PORTAL = 'Customer Portal',
  SERVICE_PORTAL = 'Service Portal',
  DELIVERY_HUB = 'Delivery Hub',
  EMPLOYEE_PORTAL = 'Employee Center',
  SETTINGS = 'Settings',
  CASH_MANAGEMENT = 'Cash Management',
  DISCREPANCIES = 'Discrepancies',
  DISCOUNT_APPROVALS = 'Discount Requests'
}

export type Availability = 'Dine-In' | 'Takeout' | 'Online' | 'Meal Plan';

export interface Ingredient {
  sku: string;
  name: string;
  qty: number;
  cost: number;
}

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  status: 'Active' | 'Inactive';
  availability: Availability[];
  image: string;
  description: string;
  tags?: string[];
  ingredients?: Ingredient[];
}

export interface Table {
  id: string;
  name: string;
  capacity: number;
  status: 'Available' | 'Occupied' | 'Reserved' | 'Dirty';
  section: 'Main Hall' | 'Terrace' | 'VIP';
}

export interface Reservation {
  id: string;
  customerName: string;
  customerId?: string;
  tableId: string;
  time: string;
  guests: number;
  status: 'Confirmed' | 'Arrived' | 'Cancelled';
  preOrders?: { itemId: string; name: string; price: number; qty: number; image: string }[];
}

export interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  isActive: boolean;
  type: 'Cash' | 'Card' | 'Digital' | 'Voucher';
  applicableTo: ('Dine-In' | 'Takeout' | 'Delivery' | 'Meal Plan')[];
}

export interface LoyaltyTier {
  id: string;
  name: string;
  pointsThreshold: number;
  multiplier: number;
  color: string;
  perks: string[];
  standardDiscount: number;
  birthdayDiscount: number;
}

export interface CustomerGroup {
  id: string;
  name: string;
  discountPercentage: number;
  description: string;
  color: string;
}

export interface CustomerAddress {
  id: string;
  label: string; // e.g. 'Home', 'Work'
  street: string;
  city: string;
  zip: string;
  country: string;
}

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string;
  segment?: string;
  group?: string;
  lastOrder?: string;
  ltv: number;
  points: number;
  storeCredit?: number;
  tier?: string;
  birthday?: string;
  avatar: string;
  referenceCode?: string;
  gdprConsent?: {
    marketing: boolean;
    sms: boolean;
    dataProcessing: boolean;
  };
  addresses: CustomerAddress[];
  dietaryPreferences?: string[];
}

export interface OrderItem {
  _fsItemId?: string;
  itemId: string;
  name: string;
  qty: number;
  price: number;
  notes?: string;
  deliveryDate?: string;
  deliveryDay?: string;
  serviceSlot?: string;
  paymentStatus?: 'Paid' | 'Pending' | 'Refunded'; 
  status?: 'Active' | 'Preparing' | 'Cancelled' | 'Ready' | 'Delivered' | 'Completed';
  isReconciled?: boolean;
  paymentMethodName?: string;
  // Reference the customer was given (and/or entered themselves) when they
  // told the app how they'd pay — lets Operations match a Juice/MauCAS
  // transfer against a bank/wallet statement before confirming payment.
  // Setting this does NOT mean the meal is paid: paymentStatus only becomes
  // 'Paid' once Operations confirms, so a claimed-but-unconfirmed payment is
  // paymentStatus 'Pending' + paymentMethodName/paymentReference set.
  paymentReference?: string;
  rating?: number;
  ratingComment?: string;
}

export interface Order {
  id: string;
  customerName: string;
  type: 'Dine-In' | 'Takeout' | 'Delivery' | 'Meal Plan';
  status: 'Pending' | 'In Kitchen' | 'Ready' | 'Delivered' | 'Completed' | 'Cancelled';
  paymentStatus: 'Paid' | 'Pending' | 'Refunded';
  tenderType?: 'Cash' | 'Card' | 'Digital' | 'Voucher';
  paymentMethodName?: string;
  paymentScheme?: 'Upfront' | 'Per-Delivery';
  items: OrderItem[];
  total: number;
  timestamp: string;
  tableId?: string;
  isReconciled?: boolean;
  isTerminalClosed?: boolean;
  discount?: number;
  discountReason?: string;
}
