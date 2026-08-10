
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Wallet, Landmark, FileText, Printer, 
  Lock, ShieldCheck, Banknote, CreditCard, Ticket, 
  X, CheckCircle2, AlertCircle, Search, Calendar,
  ShoppingBag, User, RefreshCw, Truck, Play,
  ChevronRight, Calculator, ArrowRight, Save, History,
  Plus, Minus, TrendingUp, AlertTriangle, Info, Receipt,
  ChevronDown, Smartphone, Coins, ArrowDownToLine, Eye, Coffee, ShoppingCart, ArrowUpRight, ArrowDownLeft,
  Filter, Key, Shield, EyeOff, LayoutGrid, FileSearch, ShieldAlert,
  Bell, LockKeyhole, Loader2, ListFilter, Clock, Percent,
  MoreHorizontal, PanelRightClose, PanelRightOpen, Check, Download
} from 'lucide-react';
import { Order, OrderItem, PaymentMethod } from '../../types';
import { 
  subscribeToOrders, 
  updateOrderPayment, 
  updateOrderItemsPayment, 
  updateOrderStatus, 
  reconcileOrder, 
  reconcileOrderItemsByDate, 
  MOCK_TODAY, 
  CASHIER_SHIFT, 
  subscribeToShift, 
  updateShift, 
  resetShift, 
  ShiftState,
  subscribeToPettyCash,
  addPettyCashTransaction,
  PettyCashState,
  subscribeToPOs,
  PurchaseOrder,
  paySupplierFromTill,
  subscribeToAudit,
  AuditEntry,
  logAuditEvent,
  logDiscrepancy,
  subscribeToPaymentMethods,
  formatNumber,
  formatCurrency,
  calculateTotal,
  applyOrderDiscount,
  requestOrderDiscount,
  subscribeToDiscountRequests,
  DiscountRequest
} from '../store';

interface PayableItem {
   id: string; 
   displayId: string;
   customerName: string;
   type: string;
   amount: number;
   timestamp: string;
   isPartial: boolean; 
   sourceOrder?: Order;
   serviceSlot?: string;
   deliveryDate?: string;
}

interface FleetLineItem {
   id: string; 
   displayId: string;
   customerName: string;
   total: number;
   isMealPlan: boolean;
   dateRef?: string;
   serviceSlot?: string;
   itemsLabel: string;
   timestamp: string;
}

interface FleetRemitGroup {
   paymentMethodName: string;
   tenderType: string;
   total: number;
   count: number;
   items: FleetLineItem[];
}

const Cashier: React.FC = () => {
  const [activeView, setActiveView] = useState<'log' | 'unpaid' | 'pickups' | 'fleet'>('unpaid');
  const [orderFilter, setOrderFilter] = useState<'All' | 'Meal Plan' | 'On-Demand'>('All');
  const [orders, setOrders] = useState<Order[]>([]);
  const [shift, setShift] = useState<ShiftState>(CASHIER_SHIFT);
  const [pettyCash, setPettyCash] = useState<PettyCashState | null>(null);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  
  const [selectedPayable, setSelectedPayable] = useState<PayableItem | null>(null);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<PayableItem | null>(null);
  const [selectedRemitGroup, setSelectedRemitGroup] = useState<FleetRemitGroup | null>(null);
  const [selectedPickupOrder, setSelectedPickupOrder] = useState<Order | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // System Notification State
  const [notification, setNotification] = useState<{ message: string; sub: string; type: 'warning' | 'danger' } | null>(null);

  // Modal Interactive States
  const [processingPoId, setProcessingPoId] = useState<string | null>(null);

  // Reconciliation inputs
  const [manualOpeningCount, setManualOpeningCount] = useState<number>(0);
  const [manualClosingCount, setManualClosingCount] = useState<number>(0);
  const [spotCheckAmount, setSpotCheckAmount] = useState<number>(0);
  const [closingMethodCounts, setClosingMethodCounts] = useState<Record<string, number>>({});

  const [zReport, setZReport] = useState<any>(null);

  // Modal UI States
  const [isBankingModalOpen, setIsBankingModalOpen] = useState(false);
  const [isPettyCashModalOpen, setIsPettyCashModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isAuditVaultOpen, setIsAuditVaultOpen] = useState(false);
  const [isSpotCheckModalOpen, setIsSpotCheckModalOpen] = useState(false);
  const [isPendingApprovalOpen, setIsPendingApprovalOpen] = useState(false);
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  const [pendingVarianceMsg, setPendingVarianceMsg] = useState('');
  
  const [auditFilterType, setAuditFilterType] = useState<string>('All');
  const [auditDateRange, setAuditDateRange] = useState({ start: new Date().toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] });
  const [tempBankingValue, setTempBankingValue] = useState<number>(0);
  const [pettyForm, setPettyForm] = useState({ desc: '', amount: 0, type: 'Out' as 'In' | 'Out' });

  // Discount Request States
  const [discountRequests, setDiscountRequests] = useState<DiscountRequest[]>([]);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [selectedActionItem, setSelectedActionItem] = useState<PayableItem | null>(null);
  const [isDiscountRequestOpen, setIsDiscountRequestOpen] = useState(false);
  const [discountForm, setDiscountForm] = useState({ type: 'fixed' as 'percentage' | 'fixed', value: 0, reason: '' });

  useEffect(() => {
    const unsubOrders = subscribeToOrders(setOrders);
    const unsubShift = subscribeToShift(setShift);
    const unsubPetty = subscribeToPettyCash(setPettyCash);
    const unsubAudit = subscribeToAudit(setAuditLog);
    const unsubMethods = subscribeToPaymentMethods(setPaymentMethods);
    const unsubDiscounts = subscribeToDiscountRequests(setDiscountRequests);
    const unsubPOs = subscribeToPOs(setPurchaseOrders);
    return () => {
      unsubOrders();
      unsubShift();
      unsubPetty();
      unsubAudit();
      unsubMethods();
      unsubDiscounts();
      unsubPOs();
    };
  }, []);

  // --- COMPUTED DATA ---
  const payableList = useMemo(() => {
     const list: PayableItem[] = [];
     orders.forEach(o => {
        if (o.status === 'Cancelled') return;

        if (o.type !== 'Meal Plan' || o.paymentScheme === 'Upfront') {
           if (o.paymentStatus === 'Pending') {
              let alreadyPaid = 0;
              o.items.forEach(i => { if (i.paymentStatus === 'Paid') alreadyPaid += calculateTotal(i.price * i.qty); });
              
              const remaining = o.total - alreadyPaid;
              if (remaining > 0.01) {
                 list.push({
                    id: o.id,
                    displayId: o.id,
                    customerName: o.customerName,
                    type: o.type,
                    amount: remaining,
                    timestamp: o.timestamp,
                    isPartial: false,
                    sourceOrder: o
                 });
              }
           }
        } 
        else {
           const todayUnpaidItems = o.items.filter(i => 
              i.deliveryDate === MOCK_TODAY && 
              i.paymentStatus === 'Pending' && 
              i.status !== 'Cancelled'
           );

           if (todayUnpaidItems.length > 0) {
              const slotGroups: Record<string, OrderItem[]> = {};
              todayUnpaidItems.forEach(item => {
                 const slot = item.serviceSlot || 'General';
                 if (!slotGroups[slot]) slotGroups[slot] = [];
                 slotGroups[slot].push(item);
              });

              Object.entries(slotGroups).forEach(([slot, items]) => {
                 const slotSubtotal = items.reduce((acc, i) => acc + (i.price * i.qty), 0);
                 const slotTotal = calculateTotal(slotSubtotal); 
                 
                 list.push({
                    id: `${o.id}-${MOCK_TODAY}-${slot}`,
                    displayId: o.id,
                    customerName: o.customerName,
                    type: `Meal Plan: ${slot}`,
                    amount: slotTotal,
                    timestamp: o.timestamp,
                    isPartial: true,
                    sourceOrder: o,
                    serviceSlot: slot,
                    deliveryDate: MOCK_TODAY
                 });
              });
           }
        }
     });
     return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [orders]);

  const filteredPayableList = useMemo(() => {
    if (orderFilter === 'All') return payableList;
    if (orderFilter === 'Meal Plan') return payableList.filter(item => item.type.includes('Meal Plan'));
    return payableList.filter(item => !item.type.includes('Meal Plan'));
  }, [payableList, orderFilter]);

  const queueValuation = useMemo(() => {
    return filteredPayableList.reduce((acc, item) => acc + item.amount, 0);
  }, [filteredPayableList]);

  // Sales totals (dependent on audit log)
  const shiftSalesByType = useMemo(() => {
    const totals: Record<string, number> = { 'Cash': 0, 'Card': 0, 'Digital': 0, 'Voucher': 0 };
    if (!shift.startTimestamp) return totals;
    
    const startTime = new Date(shift.startTimestamp).getTime();
    
    auditLog.forEach(entry => {
       const entryTime = new Date(entry.timestamp).getTime();
       if (entryTime >= startTime && entry.category === 'Sales') {
          const tender = entry.tender as any;
          if (totals[tender] !== undefined) totals[tender] += entry.amount;
       }
    });
    return totals;
  }, [auditLog, shift.startTimestamp]);

  const totalPayouts = shift.payouts.reduce((acc, p) => acc + p.amount, 0);

  const shiftTotals = {
      sales: (Object.values(shiftSalesByType) as number[]).reduce((a, b) => a + b, 0),
      expectedCash: Number(shift.openingFloat) + Number(shiftSalesByType['Cash'] || 0) - Number(shift.bankedAmount) - totalPayouts + Number(shift.cashAdjustments || 0),
      expectedCard: shiftSalesByType['Card'] || 0,
      expectedDigital: shiftSalesByType['Digital'] || 0,
      expectedVoucher: shiftSalesByType['Voucher'] || 0
  };

  const filteredAuditLog = useMemo(() => {
     let logs = auditLog;
     if (auditFilterType !== 'All') {
        logs = logs.filter(e => e.category === auditFilterType);
     }
     
     const startDate = new Date(auditDateRange.start);
     startDate.setHours(0, 0, 0, 0);
     const endDate = new Date(auditDateRange.end);
     endDate.setHours(23, 59, 59, 999);

     return logs.filter(e => {
        const t = new Date(e.timestamp);
        return t >= startDate && t <= endDate;
     });
  }, [auditLog, auditFilterType, auditDateRange]);

  const readyPickups = useMemo(() => {
     return orders.filter(o => o.status === 'Ready' && o.type === 'Takeout');
  }, [orders]);

  const fleetRemittanceGroups: FleetRemitGroup[] = useMemo(() => {
     const groups: Record<string, FleetRemitGroup> = {};

     orders.forEach(o => {
        const tender = o.tenderType || 'Cash';
        const groupKey = o.paymentMethodName || tender;

        if (o.type === 'Delivery' && o.paymentStatus === 'Paid' && !o.isReconciled) {
           if (!groups[groupKey]) groups[groupKey] = { paymentMethodName: groupKey, tenderType: tender, total: 0, count: 0, items: [] };
           groups[groupKey].total += o.total;
           groups[groupKey].count += 1;
           groups[groupKey].items.push({
              id: o.id,
              displayId: o.id,
              customerName: o.customerName,
              total: o.total,
              isMealPlan: false,
              itemsLabel: o.items.map(i => i.name).join(', '),
              timestamp: o.timestamp
           });
        } 
        else if (o.type === 'Meal Plan') {
           const slots: Record<string, OrderItem[]> = {};
           o.items.forEach(i => {
              if (i.deliveryDate === MOCK_TODAY && i.paymentStatus === 'Paid' && !i.isReconciled && i.status !== 'Cancelled') {
                 const s = i.serviceSlot || 'Lunch';
                 if (!slots[s]) slots[s] = [];
                 slots[s].push(i);
              }
           });

           Object.entries(slots).forEach(([slot, items]) => {
              const total = calculateTotal(items.reduce((acc, i) => acc + (i.price * i.qty), 0));
              const subGroupKey = items[0]?.paymentMethodName || groupKey;
              
              if (!groups[subGroupKey]) groups[subGroupKey] = { paymentMethodName: subGroupKey, tenderType: tender, total: 0, count: 0, items: [] };
              groups[subGroupKey].total += total;
              groups[subGroupKey].count += 1;
              groups[subGroupKey].items.push({
                 id: `${o.id}-${MOCK_TODAY}-${slot}`,
                 displayId: o.id,
                 customerName: o.customerName,
                 total,
                 isMealPlan: true,
                 dateRef: MOCK_TODAY,
                 serviceSlot: slot,
                 itemsLabel: items.map(i => i.name).join(', '),
                 timestamp: o.timestamp
              });
           });
        }
     });
     return Object.values(groups);
  }, [orders]);

  // --- ACTIONS ---
  const triggerNotification = (message: string, sub: string, type: 'warning' | 'danger') => {
     setNotification({ message, sub, type });
     setTimeout(() => setNotification(null), 4000);
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Timestamp', 'Type', 'Category', 'Tender', 'Amount', 'User', 'Description', 'Reference'];
    const rows = filteredAuditLog.map(e => [
        e.id,
        new Date(e.timestamp).toLocaleString(),
        e.type,
        e.category,
        e.tender,
        e.amount,
        e.user,
        `"${e.description.replace(/"/g, '""')}"`,
        e.reference
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
        + headers.join(",") + "\n" 
        + rows.map(e => e.join(",")).join("\n");
        
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `audit_log_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBanking = () => {
     if (tempBankingValue <= 0) return;
     const newTotal = shift.bankedAmount + tempBankingValue;
     updateShift({
       bankedAmount: newTotal,
       bankingHistory: [...shift.bankingHistory, { time: new Date().toLocaleTimeString(), amount: tempBankingValue }]
     });
     logAuditEvent({
        type: 'Banking', category: 'Banking', tender: 'Cash', amount: tempBankingValue, reference: 'BNK-OUT', user: 'Alex Sterling', description: 'Authorized banking transfer from drawer.'
     });
     setTempBankingValue(0);
     setIsBankingModalOpen(false);
     triggerNotification("Banking Authorized", `Rs ${formatNumber(tempBankingValue)} removed from drawer.`, "warning");
  };

  const handleStartShift = () => {
      const now = new Date();
      const variance = Number(manualOpeningCount) - Number(shift.expectedOpening);
      if (variance !== 0) {
         const typeLabel = variance > 0 ? 'Excess' : 'Shortage';
         const auditEntry = logAuditEvent({
            type: 'Shift Open', category: 'Audit', tender: 'Cash', amount: manualOpeningCount, reference: 'REQ-OPEN', user: 'Alex Sterling', description: `Opening discrepancy: Cash ${typeLabel} of Rs ${formatNumber(Math.abs(variance))}`, status: 'Pending Approval'
         });
         logDiscrepancy({
            auditId: auditEntry.id, type: 'Opening', expected: shift.expectedOpening, actual: manualOpeningCount, variance: variance, user: 'Alex Sterling', notes: `Cashier manual count: Rs ${formatNumber(manualOpeningCount)}`
         });
         setPendingVarianceMsg(`Cash ${typeLabel}: Rs ${formatNumber(Math.abs(variance))} logged for approval. Till initialized with actual count.`);
         setIsPendingApprovalOpen(true);
      } else {
         logAuditEvent({
            type: 'Shift Open', category: 'Capital', tender: 'Cash', amount: manualOpeningCount, reference: 'START', user: 'Alex Sterling', description: `Till initialized. Zero variance verified.`
         });
      }
      updateShift({
        openingFloat: Number(manualOpeningCount), openingDiscrepancy: variance, startTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), startTimestamp: now.toISOString(), status: 'open'
      });
  };

  const handleFinalizeShift = () => {
      const closingCash = manualClosingCount || 0;
      const closingCard = closingMethodCounts['Card'] || 0;
      const closingDigital = closingMethodCounts['Digital'] || 0;
      const closingVoucher = closingMethodCounts['Voucher'] || 0;

      const cashVariance = closingCash - shiftTotals.expectedCash;
      
      const entry = logAuditEvent({
         type: 'Shift Close',
         category: 'Audit',
         tender: 'N/A',
         amount: closingCash,
         reference: 'Z-REPORT',
         user: 'Alex Sterling',
         description: `Shift closed. Cash Variance: ${formatCurrency(cashVariance)}`
      });

      if (cashVariance !== 0) {
         logDiscrepancy({
            auditId: entry.id,
            type: 'Closing',
            expected: shiftTotals.expectedCash,
            actual: closingCash,
            variance: cashVariance,
            user: 'Alex Sterling',
            notes: 'Closing shift variance'
         });
      }

      setZReport({
         closedAt: new Date().toLocaleTimeString(),
         sales: shiftTotals.sales,
         opening: shift.openingFloat,
         banked: shift.bankedAmount,
         payouts: totalPayouts,
         cash: { expected: shiftTotals.expectedCash, actual: closingCash, variance: cashVariance },
         card: { expected: shiftTotals.expectedCard, actual: closingCard, variance: closingCard - shiftTotals.expectedCard },
         digital: { expected: shiftTotals.expectedDigital, actual: closingDigital, variance: closingDigital - shiftTotals.expectedDigital },
         voucher: { expected: shiftTotals.expectedVoucher, actual: closingVoucher, variance: closingVoucher - shiftTotals.expectedVoucher },
         variance: cashVariance
      });
      
      updateShift({ status: 'closed' });
      setIsClosingModalOpen(false);
  };

  const handleCloseShiftSession = () => {
      resetShift(zReport.cash.actual);
      setZReport(null);
      setManualClosingCount(0);
      setClosingMethodCounts({});
      setActiveView('unpaid');
  };

  const handlePayPO = (po: PurchaseOrder) => {
    if (processingPoId) return;
    setProcessingPoId(po.id);
    setTimeout(() => {
      paySupplierFromTill(po.id);
      triggerNotification("Supplier Paid", `Authorized payout of Rs ${formatNumber(po.amount)} to ${po.vendor}.`, "warning");
      setProcessingPoId(null);
    }, 800);
  };

  const handlePettySubmit = () => {
    if (!pettyForm.desc || pettyForm.amount <= 0) return;
    addPettyCashTransaction(pettyForm.desc, pettyForm.amount, pettyForm.type);
    triggerNotification(`Petty Cash ${pettyForm.type}`, `${pettyForm.desc} recorded.`, "warning");
    setPettyForm({ desc: '', amount: 0, type: 'Out' });
    setIsPettyCashModalOpen(false);
  };

  const handleOpenActionModal = (item: PayableItem) => {
     if (item.type === 'Dine-In' && !item.sourceOrder?.isTerminalClosed) {
        triggerNotification("Gating Protocol Active", "Table session must be closed at POS Terminal before managing payment.", "danger");
        return;
     }
     setSelectedActionItem(item);
     setIsActionModalOpen(true);
  };

  const handleActionSelect = (action: 'pay' | 'discount') => {
     if (!selectedActionItem) return;
     if (action === 'pay') {
        setSelectedPayable(selectedActionItem);
     } else {
        setDiscountForm({ type: 'fixed', value: 0, reason: '' });
        setIsDiscountRequestOpen(true);
     }
     setIsActionModalOpen(false);
  };

  const handleSubmitDiscountRequest = () => {
     if (!selectedActionItem || discountForm.value <= 0) return;
     
     requestOrderDiscount(
        selectedActionItem.sourceOrder?.id || selectedActionItem.id,
        selectedActionItem.customerName,
        selectedActionItem.amount,
        discountForm.type,
        discountForm.value,
        discountForm.reason || 'Manual Request'
     );
     
     setIsDiscountRequestOpen(false);
     setDiscountForm({ type: 'fixed', value: 0, reason: '' });
     triggerNotification("Request Sent", "Discount approval request forwarded to manager.", "warning");
  };

  const handleCommitSpotCheck = () => {
    const variance = Number(spotCheckAmount) - Number(shiftTotals.expectedCash);
    const typeLabel = variance > 0 ? 'Excess' : 'Shortage';
    
    const auditEntry = logAuditEvent({
       type: 'Spot Check', 
       category: 'Audit', 
       tender: 'Cash', 
       amount: spotCheckAmount, 
       reference: 'SPOT', 
       user: 'Alex Sterling', 
       description: `Spot check: Cash ${variance !== 0 ? typeLabel + ' of Rs ' + formatNumber(Math.abs(variance)) : 'Verified'}`,
       status: variance !== 0 ? 'Pending Approval' : 'Approved'
    });

    if (variance !== 0) {
       logDiscrepancy({
          auditId: auditEntry.id, 
          type: 'Spot Check', 
          expected: shiftTotals.expectedCash, 
          actual: spotCheckAmount, 
          variance: variance, 
          user: 'Alex Sterling', 
          notes: `Manual spot check variance recorded.`
       });
       triggerNotification(`Cash ${typeLabel} Detected`, `Rs ${formatNumber(Math.abs(variance))} logged for approval.`, "danger");
    } else {
       triggerNotification("Spot Check Verified", "Manual count matches system expectations.", "warning");
    }

    setSpotCheckAmount(0);
    setIsSpotCheckModalOpen(false);
  };

  const calculateDiscountPreview = () => {
     if (!selectedActionItem) return { discount: 0, final: 0 };
     const discount = discountForm.type === 'percentage' 
        ? selectedActionItem.amount * (discountForm.value / 100)
        : discountForm.value;
     const final = Math.max(0, selectedActionItem.amount - discount);
     return { discount, final };
  };

  const processTransaction = (method: PaymentMethod) => {
    if (!selectedPayable) return;
    setPaymentSuccess(true);
    
    // Simulate API delay
    setTimeout(() => {
       if (selectedPayable.isPartial) {
          updateOrderItemsPayment(
             selectedPayable.sourceOrder!.id, 
             selectedPayable.deliveryDate!, 
             selectedPayable.serviceSlot, 
             method.type as any, 
             method.name
          );
       } else {
          updateOrderPayment(selectedPayable.id, 'Paid', method.type as any, method.name, 'Alex Sterling');
       }
       
       setPaymentSuccess(false);
       setSelectedPayable(null);
       triggerNotification("Payment Successful", `Rs ${formatNumber(selectedPayable.amount)} received via ${method.name}`, "warning");
    }, 1500);
  };

  const processRemittance = () => {
     if (!selectedRemitGroup) return;
     
     selectedRemitGroup.items.forEach(item => {
        if (item.isMealPlan) {
           reconcileOrderItemsByDate(item.displayId, item.dateRef!, item.serviceSlot);
        } else {
           reconcileOrder(item.id);
        }
     });

     logAuditEvent({
        type: 'Payment Receipt',
        category: 'Remittance',
        tender: selectedRemitGroup.tenderType as any,
        amount: selectedRemitGroup.total,
        reference: `REMIT-${Date.now().toString().substr(-6)}`,
        user: 'Alex Sterling',
        description: `Fleet remittance verified: ${selectedRemitGroup.paymentMethodName}`
     });

     triggerNotification("Remittance Verified", `Rs ${formatNumber(selectedRemitGroup.total)} accepted from fleet.`, "warning");
     setSelectedRemitGroup(null);
  };

  const processHandover = () => {
     if (!selectedPickupOrder) return;
     updateOrderStatus(selectedPickupOrder.id, 'Completed');
     setSelectedPickupOrder(null);
     triggerNotification("Handover Complete", `Order #${selectedPickupOrder.id} marked as completed.`, "warning");
  };

  if (shift.status === 'closed' && !zReport) {
    // ... (Initialize Terminal Code kept same)
    return (
      <div className="h-full w-full bg-slate-50 flex items-center justify-center p-4 animate-in fade-in duration-500">
        <div className="max-w-3xl w-full flex flex-col items-center gap-4">
          <div className="text-center space-y-2">
             <div className="size-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto shadow-sm"><Play className="size-6 fill-current" /></div>
             <h1 className="text-2xl font-black text-slate-900 tracking-tighter leading-none uppercase">Initialize Terminal</h1>
             <p className="text-slate-500 font-medium text-xs">Verify drawer contents before commencing service node POS-01.</p>
          </div>
          
          <div className="bg-white rounded-[32px] shadow-2xl border border-slate-200 overflow-hidden flex flex-col lg:flex-row w-full">
             <div className="flex-1 p-8 space-y-6">
                <div className="space-y-2">
                   <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] border-b border-slate-100 pb-2">Audit Expectation Indicator</h3>
                   <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase text-slate-400 mb-0.5">Carried From Last Shift</p>
                        <p className="text-xl font-black text-slate-900 tabular-nums">Rs {formatNumber(shift.expectedOpening)}</p>
                      </div>
                      <ShieldCheck className="size-6 text-primary opacity-20" />
                   </div>
                </div>
                <div className="space-y-2">
                   <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] border-b border-slate-100 pb-2">Manual Verification Count</h3>
                   <div className="relative group">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-300 group-focus-within:text-primary transition-colors">Rs</span>
                      <input 
                        type="text" 
                        value={manualOpeningCount ? manualOpeningCount.toLocaleString() : ''} 
                        onChange={(e) => {
                           const val = e.target.value.replace(/,/g, '');
                           if (val === '') setManualOpeningCount(0);
                           else if (!isNaN(Number(val))) setManualOpeningCount(parseFloat(val));
                        }} 
                        className="w-full pl-14 pr-4 py-4 bg-slate-50 border-4 border-slate-100 rounded-[24px] text-3xl font-black focus:border-primary focus:bg-white transition-all outline-none tabular-nums placeholder:text-slate-200" 
                        placeholder="0.00" 
                        autoFocus 
                      />
                   </div>
                </div>
             </div>
             
             <div className="w-full lg:w-[320px] bg-[#0f172a] p-8 text-white flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 size-48 bg-primary/20 rounded-full blur-3xl -mr-24 -mt-24 pointer-events-none"></div>
                
                <div className="space-y-2 relative z-10">
                   <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">Opening Float</p>
                   <div className="flex items-start">
                      <span className="text-xl font-bold text-primary mt-1 mr-1">Rs</span>
                      <p className="text-4xl font-black text-primary tracking-tighter tabular-nums leading-none break-all">
                         {formatNumber(manualOpeningCount)}
                      </p>
                   </div>
                   {Number(manualOpeningCount) !== shift.expectedOpening && Number(manualOpeningCount) > 0 && (
                      <div className="mt-4 bg-warning/10 border border-warning/20 p-2 rounded-xl flex items-center gap-2 animate-in slide-in-from-bottom-2 fade-in">
                         <AlertTriangle className="size-3 text-warning shrink-0" />
                         <p className="text-[8px] font-black uppercase text-warning tracking-wide">Variance Logged</p>
                      </div>
                   )}
                </div>
                
                <button 
                   onClick={handleStartShift} 
                   className="mt-6 w-full py-4 bg-primary text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] transition-all relative z-10"
                >
                   Start Service Shift
                </button>
             </div>
          </div>
        </div>
        
        {isPendingApprovalOpen && (
          <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-[32px] p-8 max-w-sm w-full text-center animate-in zoom-in-95 shadow-2xl">
               <div className="size-16 bg-warning/10 text-warning rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="size-8" />
               </div>
               <h3 className="text-xl font-black text-slate-900 mb-2">Opening Variance</h3>
               <p className="text-sm font-bold text-slate-500 mb-6">{pendingVarianceMsg}</p>
               <button onClick={() => setIsPendingApprovalOpen(false)} className="w-full py-3 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:brightness-110 transition-all">
                  Acknowledge & Continue
               </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (zReport) {
     // ... (Z-Report Code kept same)
     return (
        <div className="bg-slate-100 p-8 flex flex-col items-center animate-in zoom-in-95 duration-500 h-full overflow-y-auto custom-scrollbar">
           <div className="max-w-2xl w-full space-y-10 py-10">
              <div className="bg-white rounded-[48px] shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
                 <div className="p-10 bg-slate-900 text-white flex items-center justify-between"><div className="flex items-center gap-6"><div className="size-16 bg-white/10 rounded-2xl flex items-center justify-center text-primary"><Receipt className="size-8" /></div><div><h1 className="text-2xl font-black tracking-tight">Shift Z-Report</h1><p className="text-xs font-bold text-white/50 uppercase tracking-widest">Finalized at {zReport.closedAt}</p></div></div><div className="text-right"><p className="text-[10px] font-black uppercase text-white/40 tracking-widest mb-1">Total Sales</p><p className="text-4xl font-black text-white tabular-nums">Rs {formatNumber(zReport.sales)}</p></div></div>
                 <div className="p-10 space-y-8">
                    <div className="grid grid-cols-2 gap-8">
                       <ReportLine label="Opening Float" value={zReport.opening} />
                       <ReportLine label="Total Banked" value={zReport.banked} negative />
                       <ReportLine label="Payouts" value={zReport.payouts} negative />
                       <ReportLine label="Cash Sales" value={shiftSalesByType['Cash']} />
                    </div>
                    <div className="pt-8 border-t-2 border-dashed border-slate-200">
                       <div className="flex justify-between items-end mb-2"><p className="text-sm font-black uppercase text-slate-900 tracking-widest">Net Cash Variance</p><p className={`text-3xl font-black tabular-nums ${zReport.variance === 0 ? 'text-success' : 'text-danger'}`}>{zReport.variance > 0 ? '+' : ''}Rs {formatNumber(zReport.variance)}</p></div>
                       <p className="text-xs font-bold text-slate-400 text-right">{zReport.variance === 0 ? 'Perfect Balance Verified' : 'Discrepancy Logged for Audit'}</p>
                    </div>
                 </div>
                 <div className="p-10 bg-slate-50 border-t border-slate-100"><button onClick={handleCloseShiftSession} className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black text-xs uppercase tracking-[0.2em] hover:scale-[1.02] transition-all">Print & Exit</button></div>
              </div>
           </div>
        </div>
     );
  }

  // --- MAIN DASHBOARD (OPEN SHIFT) ---
  return (
    <div className="flex h-full bg-[#f8fafc] animate-in fade-in duration-500 overflow-hidden relative">
      {/* Notification Toast */}
      {notification && (
         <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[200] px-8 py-4 rounded-full shadow-2xl flex items-center gap-4 animate-in slide-in-from-top-4 fade-in duration-300 ${notification.type === 'danger' ? 'bg-danger text-white' : 'bg-slate-900 text-white'}`}>
            {notification.type === 'danger' ? <AlertCircle className="size-5" /> : <CheckCircle2 className="size-5 text-success" />}
            <div><p className="text-sm font-black tracking-tight">{notification.message}</p><p className="text-[10px] font-bold opacity-80 uppercase tracking-widest">{notification.sub}</p></div>
         </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
         {/* ... (Header) ... */}
         <header className="h-20 px-8 border-b border-slate-200 bg-white flex items-center justify-between shrink-0 z-20">
            <div className="flex items-center gap-6">
               <div className="flex bg-slate-100 p-1 rounded-xl">
                  <TabButton 
                     active={activeView === 'unpaid'} 
                     icon={<Receipt />} 
                     label="Payables" 
                     badge={filteredPayableList.length}
                     onClick={() => setActiveView('unpaid')} 
                  />
                  <TabButton 
                     active={activeView === 'fleet'} 
                     icon={<Truck />} 
                     label="Fleet Remittance" 
                     badge={fleetRemittanceGroups.length}
                     onClick={() => setActiveView('fleet')} 
                  />
                  <TabButton 
                     active={activeView === 'pickups'} 
                     icon={<ShoppingBag />} 
                     label="Ready Pickups" 
                     badge={readyPickups.length}
                     onClick={() => setActiveView('pickups')} 
                  />
               </div>
               {activeView === 'unpaid' && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
                     <Filter className="size-3 text-slate-400" />
                     <select className="bg-transparent text-[10px] font-black uppercase tracking-widest text-slate-500 outline-none cursor-pointer" value={orderFilter} onChange={(e) => setOrderFilter(e.target.value as any)}><option>All</option><option>Meal Plan</option><option>On-Demand</option></select>
                  </div>
               )}
            </div>
            <div className="flex items-center gap-6">
               <div className="text-right"><p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-0.5">Queue Value</p><p className="text-xl font-black text-slate-900 tabular-nums">Rs {formatNumber(queueValuation)}</p></div>
               <button onClick={() => setIsPendingApprovalOpen(true)} className="size-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-200 hover:text-slate-900 transition-all relative"><Bell className="size-5" /><span className="absolute top-2 right-2 size-2 bg-danger rounded-full border-2 border-white"></span></button>
            </div>
         </header>

         <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            {/* ... (Main Content Views) ... */}
            {activeView === 'unpaid' && (
               <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
                  <table className="w-full text-left">
                     <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100">
                        <tr>
                           <th className="px-8 py-4">Reference</th>
                           <th className="px-6 py-4">Customer</th>
                           <th className="px-6 py-4">Type</th>
                           <th className="px-6 py-4">Time</th>
                           <th className="px-6 py-4 text-right">Amount</th>
                           <th className="px-8 py-4 text-center">Action</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50">
                        {filteredPayableList.map(item => (
                           <tr 
                              key={item.id} 
                              onClick={() => setSelectedOrderDetail(item)} 
                              className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                           >
                              <td className="px-8 py-5 font-bold text-slate-500">#{item.displayId}</td>
                              <td className="px-6 py-5 font-black text-slate-900">{item.customerName}</td>
                              <td className="px-6 py-5">
                                 <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                    item.type.includes('Meal Plan') ? 'bg-accent/10 text-accent' : 'bg-primary/10 text-primary'
                                 }`}>
                                    {item.type}
                                 </span>
                              </td>
                              <td className="px-6 py-5 text-xs font-bold text-slate-400">
                                 {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </td>
                              <td className="px-6 py-5 text-right font-black text-slate-900 text-lg">
                                 Rs {formatNumber(item.amount)}
                              </td>
                              <td className="px-8 py-5 text-center">
                                 <button 
                                    onClick={(e) => { e.stopPropagation(); handleOpenActionModal(item); }}
                                    className="px-6 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest group-hover:bg-slate-900 group-hover:text-white transition-all shadow-sm"
                                 >
                                    Actions
                                 </button>
                              </td>
                           </tr>
                        ))}
                        {filteredPayableList.length === 0 && (
                           <tr>
                              <td colSpan={6} className="py-24 text-center opacity-30">
                                 <CheckCircle2 className="size-16 mx-auto mb-4 text-slate-400" />
                                 <h3 className="text-xl font-black text-slate-900 uppercase tracking-widest">All Clear</h3>
                                 <p className="text-slate-500 font-bold mt-2">No pending payments in queue</p>
                              </td>
                           </tr>
                        )}
                     </tbody>
                  </table>
               </div>
            )}

            {activeView === 'fleet' && (
               <div className="space-y-6">
                  {fleetRemittanceGroups.map(group => (
                     <div key={group.paymentMethodName} className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
                        <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                           <div className="flex items-center gap-4">
                              <div className="size-12 bg-white rounded-2xl flex items-center justify-center text-primary shadow-sm"><Truck className="size-6" /></div>
                              <div>
                                 <h3 className="text-lg font-black text-slate-900 uppercase tracking-widest">{group.paymentMethodName}</h3>
                                 <p className="text-xs font-bold text-slate-500">{group.count} Tasks • {group.tenderType}</p>
                              </div>
                           </div>
                           <div className="flex items-center gap-6">
                              <div className="text-right">
                                 <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Remittance Total</p>
                                 <p className="text-2xl font-black text-slate-900">Rs {formatNumber(group.total)}</p>
                              </div>
                              <button onClick={() => setSelectedRemitGroup(group)} className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg">Process Batch</button>
                           </div>
                        </div>
                        <div className="divide-y divide-slate-100">
                           {group.items.map(item => (
                              <div key={item.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                 <div className="flex items-center gap-4">
                                    <div className="w-16 text-[10px] font-black text-slate-400 text-center">#{item.displayId}</div>
                                    <div>
                                       <p className="text-sm font-black text-slate-900">{item.customerName}</p>
                                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.isMealPlan ? `Plan: ${item.serviceSlot}` : 'Delivery'} • {item.itemsLabel}</p>
                                    </div>
                                 </div>
                                 <p className="text-sm font-black text-slate-900">Rs {formatNumber(item.total)}</p>
                              </div>
                           ))}
                        </div>
                     </div>
                  ))}
               </div>
            )}

            {activeView === 'pickups' && (
               <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {readyPickups.map(order => (
                     <div key={order.id} className="bg-white p-6 rounded-[28px] border border-slate-200 shadow-sm flex justify-between items-center group hover:shadow-md transition-all">
                        <div>
                           <div className="flex items-center gap-3 mb-2">
                              <span className="px-3 py-1 bg-accent/10 text-accent rounded-full text-[10px] font-black uppercase tracking-widest">Ready for Pickup</span>
                              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">#{order.id}</span>
                           </div>
                           <h3 className="text-xl font-black text-slate-900">{order.customerName}</h3>
                           <p className="text-xs font-bold text-slate-400 mt-1">{order.items.length} Items • Rs {formatNumber(order.total)}</p>
                        </div>
                        <button onClick={() => setSelectedPickupOrder(order)} className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:scale-105 transition-all">
                           Handover
                        </button>
                     </div>
                  ))}
                  {readyPickups.length === 0 && (
                     <div className="col-span-full py-32 text-center opacity-30">
                        <ShoppingBag className="size-20 mx-auto mb-6 text-slate-400" />
                        <h3 className="text-2xl font-black text-slate-900 uppercase tracking-widest">No Pickups</h3>
                        <p className="text-slate-500 font-bold mt-2">No orders awaiting collection</p>
                     </div>
                  )}
               </div>
            )}

            {activeView === 'log' && (
               <div className="space-y-6">
                  {/* ... (Audit Log Controls) ... */}
                  <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-[24px] border border-slate-200 shadow-sm animate-in slide-in-from-top-2">
                      <div className="flex items-center gap-4">
                          <button 
                              onClick={() => setIsSpotCheckModalOpen(true)} 
                              className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 transition-all"
                          >
                              <RefreshCw className="size-4" /> Perform Spot Check
                          </button>
                          <div className="h-8 w-px bg-slate-200"></div>
                          <div className="flex gap-2 pb-1 overflow-x-auto custom-scrollbar">
                             {['All', 'Sales', 'Capital', 'Banking', 'Petty', 'Audit', 'Logistics'].map(cat => (
                                <button key={cat} onClick={() => setAuditFilterType(cat)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${auditFilterType === cat ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-300'}`}>{cat}</button>
                             ))}
                          </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                              <input type="date" value={auditDateRange.start} onChange={e => setAuditDateRange({...auditDateRange, start: e.target.value})} className="bg-transparent text-[10px] font-bold text-slate-600 outline-none px-2 uppercase tracking-widest cursor-pointer" />
                              <span className="text-slate-300">-</span>
                              <input type="date" value={auditDateRange.end} onChange={e => setAuditDateRange({...auditDateRange, end: e.target.value})} className="bg-transparent text-[10px] font-bold text-slate-600 outline-none px-2 uppercase tracking-widest cursor-pointer" />
                          </div>
                          <button onClick={handleExportCSV} className="p-3 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-all border border-slate-200" title="Export CSV">
                              <Download className="size-4" />
                          </button>
                      </div>
                  </div>

                  <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
                     <table className="w-full text-left">
                        {/* ... Table Header ... */}
                        <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                           <tr>
                              <th className="px-6 py-4">Time</th>
                              <th className="px-6 py-4">Category</th>
                              <th className="px-6 py-4">Description</th>
                              <th className="px-6 py-4">User</th>
                              <th className="px-6 py-4 text-right">Amount</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-sm">
                           {filteredAuditLog.map(entry => {
                              const isOut = ['Banking', 'Supplier Payout', 'Petty Cash Out'].includes(entry.type);
                              const isSnapshot = ['Shift Open', 'Shift Close', 'Spot Check', 'System Adjustment'].includes(entry.type);
                              
                              return (
                                 <tr key={entry.id} className="hover:bg-slate-50/50">
                                    <td className="px-6 py-4 font-bold text-slate-400 text-xs">
                                       {new Date(entry.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </td>
                                    <td className="px-6 py-4">
                                       <span className="px-2 py-1 bg-slate-100 rounded text-[10px] font-black uppercase tracking-widest text-slate-500">
                                          {entry.category}
                                       </span>
                                    </td>
                                    <td className="px-6 py-4">
                                       <p className="text-xs font-bold text-slate-700">{entry.description}</p>
                                       <p className="text-[9px] text-slate-400 font-medium">{entry.reference}</p>
                                    </td>
                                    <td className="px-6 py-4 text-xs font-bold text-slate-600">{entry.user}</td>
                                    <td className={`px-6 py-4 text-right font-black ${
                                       isSnapshot ? 'text-slate-400' : isOut ? 'text-danger' : 'text-success'
                                    }`}>
                                       {isSnapshot ? '' : isOut ? '-' : '+'}Rs {formatNumber(entry.amount)}
                                    </td>
                                 </tr>
                              );
                           })}
                        </tbody>
                        <tfoot>
                           <tr className="bg-slate-50 border-t border-slate-200">
                              <td colSpan={4} className="px-6 py-4 text-right font-bold text-slate-500 uppercase tracking-widest text-xs">Net Flow</td>
                              <td className="px-6 py-4 text-right font-black text-xl text-slate-900">
                                 Rs {formatNumber(filteredAuditLog.reduce((acc, entry) => {
                                    const isOut = ['Banking', 'Supplier Payout', 'Petty Cash Out'].includes(entry.type);
                                    const isSnapshot = ['Shift Open', 'Shift Close', 'Spot Check', 'System Adjustment'].includes(entry.type);
                                    if (isSnapshot) return acc;
                                    return acc + (isOut ? -entry.amount : entry.amount);
                                 }, 0))}
                              </td>
                           </tr>
                        </tfoot>
                     </table>
                  </div>
               </div>
            )}
         </main>
      </div>

      {/* SHIFT CONTROL SIDEBAR */}
      <aside className="w-[400px] bg-[#111827] text-white flex flex-col border-l border-white/5 shadow-2xl relative z-30">
         <div className="p-8 pb-4 shrink-0">
            <div className="flex items-center gap-2 mb-2">
               <span className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em]">Shift Control • {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
            <h2 className="text-5xl font-black text-white tracking-tighter mb-1">
               <span className="text-2xl font-black align-top mr-1">Rs</span>{formatNumber(shiftTotals.expectedCash)}
            </h2>
            <div className="h-1 w-full bg-white/10 rounded-full mt-4 overflow-hidden">
               <div className="h-full bg-success w-[75%] rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
            </div>
         </div>

         <div className="flex-1 overflow-y-auto custom-scrollbar p-8 pt-4 space-y-8">
            <div className="grid grid-cols-2 gap-4">
               <ActionButton icon={<FileText className="size-6" />} label="Audit Log" onClick={() => setActiveView('log')} />
               <ActionButton icon={<Landmark className="size-6" />} label="Banking" onClick={() => setIsBankingModalOpen(true)} />
               <ActionButton icon={<Coins className="size-6" />} label="Petty Cash" onClick={() => setIsPettyCashModalOpen(true)} />
               <ActionButton icon={<Truck className="size-6" />} label="Pay Supplier" onClick={() => setIsSupplierModalOpen(true)} />
            </div>

            <div className="space-y-4">
               <h4 className="text-[10px] font-black uppercase text-white/30 tracking-[0.2em] border-b border-white/10 pb-2">Sales Breakdown</h4>
               <MetricRow label="Cash Sales" value={shiftSalesByType['Cash'] || 0} />
               <MetricRow label="Card Terminals" value={shiftTotals.expectedCard} />
               <MetricRow label="Digital / App" value={shiftTotals.expectedDigital} />
               <MetricRow label="Vouchers" value={shiftTotals.expectedVoucher} />
            </div>
         </div>

         <div className="p-8 border-t border-white/10 bg-white/5">
            <button onClick={() => setIsClosingModalOpen(true)} 
               className="w-full py-5 bg-[#0f756f] text-white rounded-[24px] font-black text-xs uppercase tracking-[0.2em] hover:brightness-110 active:scale-[0.98] transition-all shadow-xl flex items-center justify-center gap-3">
               <LockKeyhole className="size-4" /> End Shift & Reconcile
            </button>
         </div>
      </aside>

      {/* Modals Implementation (Direct Render) */}
      {isActionModalOpen && selectedActionItem && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
           <div className="bg-white rounded-[32px] w-full max-w-sm p-8 shadow-2xl animate-in zoom-in-95">
              <div className="text-center mb-6">
                 <h3 className="text-xl font-black text-slate-900">Manage Payment</h3>
                 <p className="text-sm font-medium text-slate-500 mt-1">{selectedActionItem.customerName}</p>
                 <p className="text-2xl font-black text-slate-900 mt-2">Rs {formatNumber(selectedActionItem.amount)}</p>
              </div>
              <div className="space-y-3">
                 <button onClick={() => handleActionSelect('pay')} className="w-full py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:scale-105 transition-all">
                    Process Payment
                 </button>
                 <button onClick={() => handleActionSelect('discount')} className="w-full py-4 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:border-slate-200 transition-all">
                    Request Discount
                 </button>
                 <button onClick={() => setIsActionModalOpen(false)} className="w-full py-4 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-600">
                    Cancel
                 </button>
              </div>
           </div>
        </div>
      )}

      {selectedPayable && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            {paymentSuccess ? (
              <div className="p-16 flex flex-col items-center text-center animate-in zoom-in-95">
                 <div className="size-24 bg-success text-white rounded-full flex items-center justify-center mb-8 shadow-xl shadow-success/20"><CheckCircle2 className="size-12" /></div>
                 <h2 className="text-3xl font-black text-slate-900 mb-2">Payment Verified</h2>
                 <p className="text-slate-500 font-medium italic">Rs {formatNumber(selectedPayable.amount)} collected successfully.</p>
              </div>
            ) : (
              <><div className="p-8 border-b border-slate-100 flex items-center justify-between bg-primary/5"><div className="flex items-center gap-4"><div className="size-12 bg-primary text-white rounded-2xl flex items-center justify-center"><Banknote className="size-6" /></div><h2 className="text-2xl font-black tracking-tight">Process Transaction</h2></div><button onClick={() => setSelectedPayable(null)} className="p-2 text-slate-400 hover:text-danger"><X className="size-6" /></button></div>
                <div className="p-10 space-y-10">
                  <div className="text-center">
                     <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-2">
                        Total Amount Due ({selectedPayable.sourceOrder?.type || selectedPayable.type})
                     </p>
                     <p className="text-6xl font-black text-slate-900 tracking-tighter">Rs {formatNumber(selectedPayable.amount)}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {paymentMethods.filter(m => {
                        if (!m.isActive) return false;
                        const orderType = selectedPayable.sourceOrder?.type || (selectedPayable.type.includes('Meal Plan') ? 'Meal Plan' : selectedPayable.type);
                        return m.applicableTo.includes(orderType as any);
                    }).length === 0 ? (
                       <div className="col-span-2 text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                          <p className="text-sm font-bold text-slate-400">No applicable payment methods found for this order type.</p>
                       </div>
                    ) : (
                        paymentMethods.filter(m => {
                           if (!m.isActive) return false;
                           const orderType = selectedPayable.sourceOrder?.type || (selectedPayable.type.includes('Meal Plan') ? 'Meal Plan' : selectedPayable.type);
                           return m.applicableTo.includes(orderType as any);
                        }).map(method => (
                        <PaymentButton 
                          key={method.id} 
                          icon={<span className="text-3xl">{method.icon}</span>} 
                          label={method.name} 
                          onClick={() => processTransaction(method)} 
                          highlight={method.type === 'Card'}
                        />
                    )))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {selectedRemitGroup && (
         <div className="fixed inset-0 z-[9999] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-[40px] w-full max-w-lg shadow-2xl p-8 animate-in zoom-in-95">
               <div className="flex justify-between items-center mb-8">
                  <div className="flex items-center gap-4">
                     <div className="size-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg"><Truck className="size-6" /></div>
                     <div><h3 className="text-xl font-black text-slate-900">Fleet Remittance</h3><p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{selectedRemitGroup.paymentMethodName}</p></div>
                  </div>
                  <button onClick={() => setSelectedRemitGroup(null)}><X className="size-6 text-slate-400" /></button>
               </div>
               <div className="text-center bg-slate-50 rounded-3xl p-8 mb-8 border border-slate-100">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-2">Total Remitted</p>
                  <p className="text-5xl font-black text-slate-900 tracking-tight">Rs {formatNumber(selectedRemitGroup.total)}</p>
                  <p className="text-xs font-bold text-slate-400 mt-4">{selectedRemitGroup.count} orders verified</p>
               </div>
               <button onClick={processRemittance} className="w-full py-5 bg-success text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:scale-105 transition-all">Confirm Receipt</button>
            </div>
         </div>
      )}

      {selectedPickupOrder && (
         <div className="fixed inset-0 z-[9999] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl p-8 animate-in zoom-in-95">
               <div className="text-center">
                  <div className="size-20 bg-accent/10 text-accent rounded-full flex items-center justify-center mx-auto mb-6"><ShoppingBag className="size-10" /></div>
                  <h3 className="text-2xl font-black text-slate-900 mb-2">Confirm Handover</h3>
                  <p className="text-sm font-medium text-slate-500 mb-8">Mark order <strong>#{selectedPickupOrder.id}</strong> as picked up by <strong>{selectedPickupOrder.customerName}</strong>?</p>
                  <div className="flex gap-4">
                     <button onClick={() => setSelectedPickupOrder(null)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">Cancel</button>
                     <button onClick={processHandover} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:scale-105 transition-all">Confirm</button>
                  </div>
               </div>
            </div>
         </div>
      )}

      {isDiscountRequestOpen && selectedActionItem && (
         <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl p-8 animate-in zoom-in-95">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-black text-slate-900">Request Discount</h3>
                  <button onClick={() => setIsDiscountRequestOpen(false)}><X className="size-5 text-slate-400" /></button>
               </div>
               
               <div className="space-y-6">
                  <div className="flex bg-slate-100 p-1 rounded-2xl">
                     <button onClick={() => setDiscountForm({...discountForm, type: 'fixed'})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${discountForm.type === 'fixed' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}>Fixed Amount</button>
                     <button onClick={() => setDiscountForm({...discountForm, type: 'percentage'})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${discountForm.type === 'percentage' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}>Percentage</button>
                  </div>

                  <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Value</label>
                     <div className="relative">
                        <input 
                           type="number" 
                           value={discountForm.value || ''} 
                           onChange={e => setDiscountForm({...discountForm, value: parseFloat(e.target.value)})} 
                           className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-xl text-slate-900 outline-none focus:border-primary transition-all"
                           placeholder="0.00"
                        />
                        <span className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 font-black">{discountForm.type === 'percentage' ? '%' : 'Rs'}</span>
                     </div>
                  </div>

                  <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Reason</label>
                     <input 
                        value={discountForm.reason} 
                        onChange={e => setDiscountForm({...discountForm, reason: e.target.value})} 
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm text-slate-900 outline-none focus:border-primary transition-all"
                        placeholder="e.g. Service Recovery"
                     />
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex justify-between items-center">
                     <div>
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">New Total</p>
                        <p className="text-xl font-black text-slate-900">Rs {formatNumber(calculateDiscountPreview().final)}</p>
                     </div>
                     <div className="text-right">
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Discount</p>
                        <p className="text-xl font-black text-danger">-Rs {formatNumber(calculateDiscountPreview().discount)}</p>
                     </div>
                  </div>

                  <button onClick={handleSubmitDiscountRequest} disabled={discountForm.value <= 0 || !discountForm.reason} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:scale-105 transition-all disabled:opacity-50">Submit Request</button>
               </div>
            </div>
         </div>
      )}

      {isSpotCheckModalOpen && (
         <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-[40px] w-full max-w-sm shadow-2xl p-8 animate-in zoom-in-95">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-black text-slate-900">Spot Check</h3>
                  <button onClick={() => setIsSpotCheckModalOpen(false)}><X className="size-5 text-slate-400" /></button>
               </div>
               <div className="space-y-6">
                  <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Current Cash Count</label>
                     <div className="relative">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 font-black">Rs</span>
                        <input 
                           type="number" 
                           value={spotCheckAmount || ''} 
                           onChange={e => setSpotCheckAmount(parseFloat(e.target.value) || 0)} 
                           className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-xl text-slate-900 outline-none focus:border-primary transition-all"
                           placeholder="0.00"
                           autoFocus
                        />
                     </div>
                  </div>
                  <button onClick={handleCommitSpotCheck} disabled={spotCheckAmount <= 0} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:scale-105 transition-all disabled:opacity-50">Verify Drawer</button>
               </div>
            </div>
         </div>
      )}

      {isPettyCashModalOpen && (
         <div className="fixed inset-0 z-[1000] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-[32px] p-8 max-w-md w-full animate-in zoom-in-95 max-h-[85vh] overflow-y-auto custom-scrollbar flex flex-col">
               <div className="flex justify-between items-center mb-6 shrink-0">
                  <h3 className="text-xl font-black text-slate-900">Petty Cash</h3>
                  <button onClick={() => setIsPettyCashModalOpen(false)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X className="size-5 text-slate-500" /></button>
               </div>
               
               <div className="bg-slate-900 p-6 rounded-2xl text-white text-center mb-6 shrink-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50 mb-1">Current Reserve</p>
                  <p className="text-4xl font-black text-primary">Rs {formatNumber(pettyCash?.balance || 0)}</p>
               </div>

               <div className="space-y-4 shrink-0">
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                     <button onClick={() => setPettyForm({...pettyForm, type: 'Out'})} className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${pettyForm.type === 'Out' ? 'bg-white shadow text-slate-900' : 'text-slate-400'}`}>Withdrawn (Out)</button>
                     <button onClick={() => setPettyForm({...pettyForm, type: 'In'})} className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${pettyForm.type === 'In' ? 'bg-white shadow text-slate-900' : 'text-slate-400'}`}>Deposit (In)</button>
                  </div>
                  <input 
                     value={pettyForm.desc}
                     onChange={e => setPettyForm({...pettyForm, desc: e.target.value})}
                     className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
                     placeholder="Reason (e.g. Milk, Cab Fare)"
                  />
                  <input 
                     type="number"
                     value={pettyForm.amount || ''}
                     onChange={e => setPettyForm({...pettyForm, amount: parseFloat(e.target.value) || 0})}
                     className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-black outline-none focus:ring-2 focus:ring-primary/20"
                     placeholder="Amount"
                  />
                  <button onClick={handlePettySubmit} disabled={!pettyForm.desc || pettyForm.amount <= 0} className="w-full py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:scale-105 transition-all disabled:opacity-50">Record Transaction</button>
               </div>

               <div className="mt-6 border-t border-slate-100 pt-4 flex-1">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Recent Activity</h4>
                  <div className="space-y-2">
                     {pettyCash?.history.slice(0, 5).map(tx => (
                        <div key={tx.id} className="flex justify-between items-center text-xs p-3 bg-slate-50 rounded-xl border border-slate-100">
                           <div>
                              <p className="font-bold text-slate-700">{tx.description}</p>
                              <p className="text-[9px] text-slate-400">{new Date(tx.timestamp).toLocaleTimeString()}</p>
                           </div>
                           <span className={`font-black ${tx.type === 'In' ? 'text-success' : 'text-slate-900'}`}>
                              {tx.type === 'In' ? '+' : '-'} Rs {formatNumber(tx.amount)}
                           </span>
                        </div>
                     ))}
                     {(!pettyCash?.history || pettyCash.history.length === 0) && (
                        <p className="text-center text-[10px] text-slate-400 font-bold py-4">No recent transactions</p>
                     )}
                  </div>
               </div>
            </div>
         </div>
      )}

      {isBankingModalOpen && (
         <div className="fixed inset-0 z-[1000] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-[32px] p-8 max-w-sm w-full animate-in zoom-in-95">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-black text-slate-900">Banking Drop</h3>
                  <button onClick={() => setIsBankingModalOpen(false)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X className="size-5 text-slate-500" /></button>
               </div>
               <div className="space-y-6">
                  <p className="text-sm font-medium text-slate-500 text-center">Amount to remove from drawer for banking.</p>
                  <div className="relative">
                     <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-300">Rs</span>
                     <input 
                        type="number" 
                        autoFocus
                        value={tempBankingValue || ''}
                        onChange={e => setTempBankingValue(parseFloat(e.target.value) || 0)}
                        className="w-full pl-16 pr-6 py-6 bg-slate-50 border-2 border-slate-100 rounded-3xl text-4xl font-black text-slate-900 focus:border-primary outline-none text-center"
                        placeholder="0.00"
                     />
                  </div>
                  <button onClick={handleBanking} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:scale-105 transition-all">Confirm Transfer</button>
               </div>
            </div>
         </div>
      )}

      {isSupplierModalOpen && (
         <div className="fixed inset-0 z-[1000] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-[40px] w-full max-w-lg shadow-2xl p-8 animate-in zoom-in-95 flex flex-col max-h-[80vh]">
               <div className="flex justify-between items-center mb-6 shrink-0">
                  <h3 className="text-xl font-black text-slate-900">Pay Suppliers</h3>
                  <button onClick={() => setIsSupplierModalOpen(false)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X className="size-5 text-slate-500" /></button>
               </div>
               <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
                  {purchaseOrders.filter(p => p.status !== 'Paid').length === 0 ? (
                     <div className="py-10 text-center opacity-40">
                        <Truck className="size-12 mx-auto mb-2" />
                        <p className="text-xs font-bold uppercase tracking-widest">No pending bills</p>
                     </div>
                  ) : (
                     purchaseOrders.filter(p => p.status !== 'Paid').map(po => (
                        <div key={po.id} className="flex justify-between items-center p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                           <div>
                              <p className="text-sm font-black text-slate-900">{po.vendor}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Inv: {po.id}</p>
                           </div>
                           <button 
                              onClick={() => handlePayPO(po)} 
                              disabled={processingPoId === po.id}
                              className="px-6 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all shadow-sm flex items-center gap-2"
                           >
                              {processingPoId === po.id ? <Loader2 className="size-3 animate-spin" /> : `Pay Rs ${formatNumber(po.amount)}`}
                           </button>
                        </div>
                     ))
                  )}
               </div>
            </div>
         </div>
      )}

      {/* End Shift Reconciliation Modal */}
      {isClosingModalOpen && (
         <div className="fixed inset-0 z-[1000] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-[40px] w-full max-w-lg shadow-2xl p-10 animate-in zoom-in-95 flex flex-col max-h-[90vh]">
               <div className="flex justify-between items-center mb-8 shrink-0">
                  <div>
                     <h3 className="text-2xl font-black text-slate-900">End Shift Reconciliation</h3>
                     <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Enter physical counts for verification</p>
                  </div>
                  <button onClick={() => setIsClosingModalOpen(false)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X className="size-6 text-slate-500" /></button>
               </div>
               
               <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-2">
                  <div className="space-y-2">
                     <div className="flex justify-between items-center mb-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Cash in Drawer</label>
                        <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">Exp: Rs {formatNumber(shiftTotals.expectedCash)}</span>
                     </div>
                     <div className="relative">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 font-black">Rs</span>
                        <input 
                           type="number" 
                           autoFocus
                           value={manualClosingCount || ''}
                           onChange={e => setManualClosingCount(parseFloat(e.target.value) || 0)}
                           className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-lg text-slate-900 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                           placeholder="0.00"
                        />
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                     <div className="space-y-2">
                        <div className="flex justify-between items-center mb-2">
                           <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Card Terminal Total</label>
                        </div>
                        <div className="relative mb-1">
                           <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">Rs</span>
                           <input 
                              type="number" 
                              value={closingMethodCounts['Card'] || ''}
                              onChange={e => setClosingMethodCounts({...closingMethodCounts, 'Card': parseFloat(e.target.value) || 0})}
                              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                              placeholder="0.00"
                           />
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 text-right">Exp: Rs {formatNumber(shiftTotals.expectedCard)}</p>
                     </div>
                     <div className="space-y-2">
                        <div className="flex justify-between items-center mb-2">
                           <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Digital/App Total</label>
                        </div>
                        <div className="relative mb-1">
                           <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">Rs</span>
                           <input 
                              type="number" 
                              value={closingMethodCounts['Digital'] || ''}
                              onChange={e => setClosingMethodCounts({...closingMethodCounts, 'Digital': parseFloat(e.target.value) || 0})}
                              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                              placeholder="0.00"
                           />
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 text-right">Exp: Rs {formatNumber(shiftTotals.expectedDigital)}</p>
                     </div>
                  </div>

                  <div className="space-y-2">
                     <div className="flex justify-between items-center mb-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Vouchers Total</label>
                        <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">Exp: Rs {formatNumber(shiftTotals.expectedVoucher)}</span>
                     </div>
                     <div className="relative">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 font-black">Rs</span>
                        <input 
                           type="number" 
                           value={closingMethodCounts['Voucher'] || ''}
                           onChange={e => setClosingMethodCounts({...closingMethodCounts, 'Voucher': parseFloat(e.target.value) || 0})}
                           className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-lg text-slate-900 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                           placeholder="0.00"
                        />
                     </div>
                  </div>
               </div>

               <div className="pt-8 mt-6 border-t border-slate-100 flex justify-end gap-4 shrink-0">
                  <button onClick={() => setIsClosingModalOpen(false)} className="px-8 py-4 bg-white border border-slate-200 rounded-2xl font-black text-xs uppercase text-slate-400 hover:bg-slate-50 transition-all">Cancel</button>
                  <button onClick={handleFinalizeShift} className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:scale-105 transition-all">Complete & Print Z-Report</button>
               </div>
            </div>
         </div>
      )}
      
    </div>
  );
};

// Subcomponents
const TabButton = ({ active, icon, label, badge, onClick }: any) => (
  <button 
    onClick={onClick}
    className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
      active ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-900 hover:bg-white'
    }`}
  >
    {React.cloneElement(icon, { className: 'size-4' })}
    {label}
    {badge > 0 && (
      <span className={`ml-1 px-1.5 py-0.5 rounded text-[8px] ${active ? 'bg-white text-slate-900' : 'bg-slate-200 text-slate-600'}`}>
        {badge}
      </span>
    )}
  </button>
);

const ReportLine = ({ label, value, negative }: any) => (
  <div className="flex justify-between text-sm font-bold text-slate-600 border-b border-dashed border-slate-200 pb-2">
    <span>{label}</span>
    <span className={negative ? 'text-danger' : 'text-slate-900'}>
      {negative ? '-' : ''}Rs {formatNumber(value || 0)}
    </span>
  </div>
);

const PaymentButton = ({ icon, label, onClick, highlight }: any) => (
  <button onClick={onClick} className={`p-8 rounded-[32px] border-2 flex flex-col items-center gap-4 transition-all hover:scale-103 active:scale-95 ${highlight ? 'border-primary bg-primary/5 text-primary' : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'}`}>{icon}<span className="text-[11px] font-black uppercase tracking-widest">{label}</span></button>
);

const ActionButton = ({ icon, label, onClick }: any) => (
   <button onClick={onClick} className="flex flex-col items-center justify-center gap-2 p-4 bg-white/10 rounded-2xl hover:bg-white/20 transition-all border border-white/5 active:scale-95 group">
      <div className="text-white/70 group-hover:text-white transition-colors">{icon}</div>
      <span className="text-[9px] font-black uppercase tracking-widest text-white/60 group-hover:text-white">{label}</span>
   </button>
);

const MetricRow = ({ label, value, negative, onClick }: any) => (
   <div onClick={onClick} className={`flex justify-between items-center p-3 rounded-xl transition-all ${onClick ? 'cursor-pointer hover:bg-slate-100' : ''}`}>
      <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{label}</span>
      <span className={`text-sm font-black tabular-nums ${negative ? 'text-danger' : 'text-white'}`}>{negative ? '-' : ''}Rs {formatNumber(value)}</span>
   </div>
);

export default Cashier;
