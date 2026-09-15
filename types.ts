
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

export interface Entity {
  id: string;
  name: string;
  brn: string;
  vatNumber: string;
  bankReference: string;
  address?: string;
  email?: string;
  phone?: string;
  invoicePrefix?: string;
  invoiceNumberCounter?: number;
  acceptedPaymentMethodIds?: string[];
  paymentMethodConfig?: Record<string, Record<string, string>>;
  logoStoragePath?: string;
  active: boolean;
  createdAt: any;
  updatedAt: any;
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
  entityId?: string;
  registrationStatus?: 'Pending' | 'Approved' | 'Rejected';
  rejectionReason?: string;
}

export interface OrderItem {
  _fsItemId?: string;
  itemId: string;
  name: string;
  qty: number;
  price: number;
  cost?: number;
  notes?: string;
  deliveryDate?: string;
  deliveryDay?: string;
  serviceSlot?: string;
  paymentStatus?: 'Paid' | 'Pending' | 'Refunded'; 
  status?: 'Active' | 'Preparing' | 'Cancelled' | 'Ready' | 'En route' | 'Delivered' | 'Completed';
  isReconciled?: boolean;
  paymentMethodName?: string;
  paymentReference?: string;
  // Set by Operations' "Send back" action (resetPaymentClaim) when a
  // claimed-but-unconfirmed payment is reset so the customer can pick a
  // method again; cleared by the customer's own commitPayment once they
  // re-claim. Lets the Payments console show "sent back, awaiting the
  // customer" instead of the item silently looking untouched.
  paymentResetAt?: any;
  rating?: number;
  ratingComment?: string;
  baseId?: string;
  dhalId?: string;
  saladId?: string;
  beverageId?: string;
  dessertId?: string;
  instructions?: string;
  tierAtOrder?: string;
  entityId?: string;
  invoiceNumber?: string;
  invoiceIssuedAt?: any;
  invoiceReprintCount?: number;
  // Exact per-item discount amounts, written by confirmCheckout at order
  // creation time — NOT an estimate. Standard/birthday/bulk are each
  // computed per item there (birthday already only ever applied to the one
  // item whose deliveryDate matches the customer's birthday; bulk is an
  // exact per-item share of a week-level discount, since bulk = weekSubtotal
  // * rate is linear in each item's own price). Lets any receipt or partial-
  // payment view attribute discount to the item/day that actually earned it
  // instead of blending the order's total discount proportionally across
  // every item (which used to smear birthday discount across the whole
  // week). Absent on orders placed before this field existed — callers must
  // fall back to the old proportional estimate for those.
  discountShare?: {
    standard: number;
    birthday: number;
    bulk: number;
  };
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
  discountBreakdown?: {
    standard: number;
    standardRate: number;
    // The human-readable name for whichever rate actually won the
    // max(tier%, group%) comparison — e.g. "ABC Motors Co Ltd Group" or
    // "Diamond Tier" — written once at order-creation time (confirmCheckout)
    // so every reader (receipts, order history) shows the real name instead
    // of a generic "Standard" label. Absent on orders placed before this
    // field existed; readers should fall back to parsing discountReason,
    // then to a plain "Standard" label, for those.
    standardLabel?: string;
    birthday: number;
    birthdayRate: number;
    bulk: number;
    bulkRate: number;
  };
  subtotal?: number;   // written by confirmCheckout Cloud Function
  vat?: number;        // written by confirmCheckout Cloud Function
  entityId?: string;
  entityName?: string;
  entityBrn?: string;
  entityVatNumber?: string;
  entityBankReference?: string;
  entityAddress?: string;
  entityEmail?: string;
  entityPhone?: string;
  entityLogoStoragePath?: string;
}

export interface PermissionPair {
  view: boolean;
  edit: boolean;
}

export interface RolePermissions {
  menuPlanner: PermissionPair;
  mealLibrary: PermissionPair;
  ordersByDish: PermissionPair;
  deliveryList: PermissionPair;
  payments: PermissionPair;
  customerDirectory: PermissionPair;
  pendingRegistrations: PermissionPair;
  transactionsLedger: { view: boolean };
  generalConfig: PermissionPair;
  loyaltyTiers: PermissionPair;
  customerGroups: PermissionPair;
  iconLibrary: PermissionPair;
  rolesAndStaff: PermissionPair;
  tradingEntities: PermissionPair;
  paymentMethods: PermissionPair;
}

export interface Role {
  id: string;
  name: string;
  permissions: Partial<RolePermissions>;
  createdAt: any;
  updatedAt: any;
}

export interface Staff {
  id: string; // auth UID
  name: string;
  email: string;
  roleId: string;
  active: boolean;
  createdAt: any;
  isPartner?: boolean;
  assignedEntityIds?: string[];
}

export type AuditLogType =
  | 'ConfigChange'
  | 'RoleChange'
  | 'RegistrationDecision'
  | 'EntityReassignment'
  | 'PaymentConfirmed'
  | 'PaymentClaimReset'
  | 'DeliveryConfirmed';

export interface AuditLog {
  id: string;
  staffUid: string;
  staffName: string;
  timestamp: any; // serverTimestamp
  type: AuditLogType;
  description: string;
}
