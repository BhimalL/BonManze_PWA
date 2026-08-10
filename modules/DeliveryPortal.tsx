
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Truck, 
  Map, 
  Navigation, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  ShoppingBag,
  Banknote,
  RefreshCw,
  Package,
  ChevronRight,
  Wallet,
  CreditCard,
  Ticket,
  Landmark,
  Smartphone,
  X
} from 'lucide-react';
import { Order, OrderItem, PaymentMethod } from '../types';
import { subscribeToOrders, updateOrderStatus, updateOrderPayment, updateOrderItemStatus, updateOrderItemsPayment, MOCK_TODAY, subscribeToPaymentMethods, formatNumber, formatCurrency } from './store';

interface DispatchTask {
   id: string; // Order ID
   taskId: string; // Grouping ID (orderId-date-slot)
   customerName: string;
   type: 'Standard Delivery' | 'Meal Plan Dispatch';
   originalType: Order['type'];
   serviceSlot?: string;
   total: number;
   status: 'Ready' | 'Delivered' | 'Completed';
   paymentStatus: 'Paid' | 'Pending' | 'Refunded';
   itemsLabel: string;
   isReconciled: boolean;
   // Consolidated refs for batch updates
   mealItemRefs?: { itemId: string; date: string; slot: string }[];
   timestamp: string;
}

const DeliveryPortal: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedTaskForPayment, setSelectedTaskForPayment] = useState<DispatchTask | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  useEffect(() => {
    const unsubOrders = subscribeToOrders((newOrders) => {
      setOrders([...newOrders]);
    });
    const unsubPayments = subscribeToPaymentMethods((newMethods) => {
      setPaymentMethods([...newMethods]);
    });
    return () => {
       unsubOrders();
       unsubPayments();
    };
  }, []);

  // Filter payment methods based on the selected task's delivery type
  const taskApplicableMethods = useMemo(() => {
     if (!selectedTaskForPayment) return [];
     const taskType = selectedTaskForPayment.originalType;
     return paymentMethods.filter(m => m.isActive && m.applicableTo.includes(taskType));
  }, [selectedTaskForPayment, paymentMethods]);

  const activeDispatches: DispatchTask[] = useMemo(() => {
     const tasksMap: Record<string, DispatchTask> = {};

     orders.forEach(o => {
        // 1. Standard Delivery Orders (Ready or En Route)
        if (o.type === 'Delivery' && (o.status === 'Ready' || o.status === 'Delivered') && !o.isReconciled) {
           tasksMap[o.id] = {
              id: o.id,
              taskId: o.id,
              customerName: o.customerName,
              type: 'Standard Delivery',
              originalType: 'Delivery',
              total: o.total,
              status: o.status === 'Ready' ? 'Ready' : 'Delivered',
              paymentStatus: o.paymentStatus,
              itemsLabel: o.items.map(i => i.name).join(', '),
              isReconciled: !!o.isReconciled,
              timestamp: o.timestamp
           };
        }
        
        // 2. Meal Plan Items for Today - GROUPING BY SERVICE SLOT
        if (o.type === 'Meal Plan') {
           o.items.forEach(item => {
              // Only include items that are Ready (Awaiting Dispatch) or Delivered (En Route) AND not yet reconciled
              if (item.deliveryDate === MOCK_TODAY && !item.isReconciled && (item.status === 'Ready' || item.status === 'Delivered')) {
                 const iSlot = item.serviceSlot || 'Lunch';
                 const groupingKey = `${o.id}-${MOCK_TODAY}-${iSlot}`;
                 
                 const currentItemTaskStatus = item.status === 'Delivered' ? 'Delivered' : 'Ready';

                 if (!tasksMap[groupingKey]) {
                    tasksMap[groupingKey] = {
                       id: o.id,
                       taskId: groupingKey,
                       customerName: o.customerName,
                       type: 'Meal Plan Dispatch',
                       originalType: 'Meal Plan',
                       serviceSlot: iSlot,
                       total: 0,
                       status: currentItemTaskStatus, 
                       paymentStatus: 'Paid', 
                       itemsLabel: '',
                       isReconciled: !!o.isReconciled,
                       mealItemRefs: [],
                       timestamp: o.timestamp
                    };
                 }

                 const task = tasksMap[groupingKey];
                 task.total += item.price * item.qty;
                 task.mealItemRefs?.push({ itemId: item.itemId, date: item.deliveryDate, slot: iSlot });
                 
                 if (item.paymentStatus === 'Pending') task.paymentStatus = 'Pending';
                 if (item.status === 'Ready') task.status = 'Ready';

                 const itemDescriptor = `${item.name}`;
                 task.itemsLabel = task.itemsLabel ? `${task.itemsLabel}, ${itemDescriptor}` : itemDescriptor;
              }
           });
        }
     });

     return Object.values(tasksMap).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [orders]);

  const driverHeldCash = useMemo(() => {
      let total = 0;
      orders.forEach(o => {
         if (o.type === 'Delivery' && o.paymentStatus === 'Paid' && !o.isReconciled) {
            total += o.total;
         } else if (o.type === 'Meal Plan') {
            o.items.forEach(i => {
               if (i.paymentStatus === 'Paid' && (i.status === 'Delivered' || i.status === 'Completed') && !i.isReconciled) {
                  total += (i.price * i.qty);
               }
            });
         }
      });
      return total;
  }, [orders]);

  const handlePickup = (task: DispatchTask) => {
     if (task.mealItemRefs) {
        task.mealItemRefs.forEach(ref => {
           updateOrderItemStatus(task.id, ref.itemId, ref.date, ref.slot, 'Delivered');
        });
        alert(`Fleet dispatched for ${task.customerName} (${task.serviceSlot}). Package is now En Route.`);
     } else {
        updateOrderStatus(task.id, 'Delivered'); 
        alert("Standard Order picked up by courier.");
     }
  };

  const handleMarkDelivered = (task: DispatchTask) => {
     if (task.paymentStatus === 'Pending') {
        alert("Gated: Payment must be collected before confirming arrival.");
        setSelectedTaskForPayment(task);
        return;
     }

     if (task.mealItemRefs) {
        task.mealItemRefs.forEach(ref => {
           updateOrderItemStatus(task.id, ref.itemId, ref.date, ref.slot, 'Completed');
        });
     } else {
        updateOrderStatus(task.id, 'Completed');
     }
     alert("Arrival Confirmed: Funds persistent in fleet bag until reconciliation handshake.");
  };

  const processPayment = (method: PaymentMethod) => {
    if (selectedTaskForPayment) {
      setPaymentSuccess(true);
      setTimeout(() => {
        if (selectedTaskForPayment.mealItemRefs) {
           updateOrderItemsPayment(selectedTaskForPayment.id, MOCK_TODAY, selectedTaskForPayment.serviceSlot, method.type, method.name);
        } else {
           updateOrderPayment(selectedTaskForPayment.id, 'Paid', method.type, method.name);
        }
        setPaymentSuccess(false);
        setSelectedTaskForPayment(null);
      }, 1500);
    }
  };

  const handleFinalizeSettlement = () => {
      if (driverHeldCash <= 0) {
         alert("Bag is currently empty.");
         return;
      }
      alert(`Handover Protocol: Inform Cashier you are surrendering Rs ${formatNumber(driverHeldCash)}.`);
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatusMetric label="Dispatch Tasks" value={activeDispatches.filter(t => t.status === 'Ready').length} icon={<Clock />} color="text-warning" />
        <StatusMetric label="In Transit" value={activeDispatches.filter(t => t.status === 'Delivered').length} icon={<Navigation />} color="text-success" />
        <StatusMetric label="Fleet Bag Total" value={`Rs ${formatNumber(driverHeldCash)}`} icon={<Banknote />} color="text-primary" />
        <StatusMetric label="Alerts" value="0" icon={<AlertCircle />} color="text-danger" />
      </div>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-7 bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm h-[700px] flex flex-col">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Consolidated Queue</h3>
            <span className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-primary">Consolidated Logistics</span>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
            {activeDispatches.length === 0 ? (
               <div className="py-20 text-center opacity-30"><Truck className="size-16 mx-auto mb-4" /><p className="font-black uppercase tracking-widest">No active fleet dispatches</p></div>
            ) : (
               activeDispatches.map(task => (
                  <DeliveryCard 
                     key={task.taskId}
                     task={task}
                     onAction={() => task.status === 'Ready' ? handlePickup(task) : handleMarkDelivered(task)}
                     onCollect={() => { setSelectedTaskForPayment(task); }}
                  />
               ))
            )}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5 space-y-6">
          <div className="bg-slate-900 rounded-[32px] overflow-hidden relative h-[300px] shadow-2xl">
            <div className="absolute inset-0 opacity-40 bg-[url('https://picsum.photos/seed/map/800/800')] bg-cover bg-center grayscale brightness-50"></div>
            <div className="relative p-8 h-full flex flex-col justify-between">
              <div className="flex justify-between items-start"><div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10"><p className="text-[10px] font-black uppercase text-white/60 tracking-widest mb-1">Fleet Sync</p><p className="text-xl font-black text-white">Logistics Node v2.4</p></div><Map className="size-8 text-primary shadow-xl" /></div>
              <div className="bg-white p-6 rounded-3xl shadow-xl flex items-center justify-between"><div><p className="text-[10px] font-black uppercase text-slate-400">Hub Accuracy</p><p className="text-lg font-black text-slate-900">99.4% Verified</p></div><CheckCircle2 className="size-6 text-success" /></div>
            </div>
          </div>

          <div className="bg-white rounded-[32px] border border-slate-200 p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6"><div className="size-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center"><Banknote className="size-6" /></div><h3 className="text-xl font-black text-slate-900 tracking-tight">Fleet Settlement</h3></div>
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-6">
               <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Current Bag Holdings</p>
               <p className="text-3xl font-black text-slate-900">Rs {formatNumber(driverHeldCash)}</p>
               <p className="text-[10px] text-slate-400 font-bold mt-2 leading-relaxed uppercase">Cleared upon cashier reconciliation handshake.</p>
            </div>
            <button disabled={driverHeldCash <= 0} onClick={handleFinalizeSettlement} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"><RefreshCw className="size-4" /> Start Remittance</button>
          </div>
        </div>
      </div>

      {selectedTaskForPayment && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            {paymentSuccess ? (
              <div className="p-16 flex flex-col items-center text-center animate-in zoom-in-95"><div className="size-24 bg-success text-white rounded-full flex items-center justify-center mb-8 shadow-xl shadow-success/20"><CheckCircle2 className="size-12" /></div><h2 className="text-3xl font-black text-slate-900 mb-2">Collected</h2><p className="text-slate-500 font-medium italic">Rs {formatNumber(selectedTaskForPayment.total)} settled.</p></div>
            ) : (
              <><div className="p-8 border-b border-slate-100 flex items-center justify-between bg-primary/5"><div className="flex items-center gap-4"><div className="size-12 bg-primary text-white rounded-2xl flex items-center justify-center"><Banknote className="size-6" /></div><h2 className="text-2xl font-black tracking-tight">Handheld Collection</h2></div><button onClick={() => setSelectedTaskForPayment(null)} className="p-2 text-slate-400 hover:text-danger"><X className="size-6" /></button></div>
                <div className="p-10 space-y-10">
                  <div className="text-center"><p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-2">Delivery Total Due ({selectedTaskForPayment.originalType})</p><p className="text-6xl font-black text-slate-900 tracking-tighter">Rs {formatNumber(selectedTaskForPayment.total)}</p></div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {taskApplicableMethods.length === 0 ? (
                      <div className="col-span-2 p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center">
                         <p className="text-sm font-bold text-slate-400">No payment methods applicable to {selectedTaskForPayment.originalType}. Check settings.</p>
                      </div>
                    ) : (
                      taskApplicableMethods.map(method => (
                        <PaymentButton 
                          key={method.id} 
                          icon={<span className="text-3xl">{method.icon}</span>} 
                          label={method.name} 
                          onClick={() => processPayment(method)} 
                          highlight={method.type === 'Card'}
                        />
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const PaymentButton = ({ icon, label, onClick, highlight }: any) => (
  <button onClick={onClick} className={`p-8 rounded-[32px] border-2 flex flex-col items-center gap-4 transition-all hover:scale-103 active:scale-95 ${highlight ? 'border-primary bg-primary/5 text-primary' : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'}`}>{icon}<span className="text-[11px] font-black uppercase tracking-widest">{label}</span></button>
);

const StatusMetric = ({ label, value, icon, color }: any) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
    <div className={`size-12 rounded-2xl bg-slate-50 flex items-center justify-center ${color}`}>{React.cloneElement(icon, { className: 'size-6' })}</div>
    <div><p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{label}</p><p className="text-2xl font-black text-slate-900 tracking-tight">{value}</p></div>
  </div>
);

interface DeliveryCardProps {
  task: DispatchTask;
  onAction: () => void;
  onCollect: () => void;
}

const DeliveryCard: React.FC<DeliveryCardProps> = ({ task, onAction, onCollect }) => {
  const isAwaitingPickup = task.status === 'Ready';
  const isUnpaid = task.paymentStatus === 'Pending';
  
  const topRef = task.type === 'Meal Plan Dispatch' ? `#ORD-${task.id.split('-')[1] || task.id}` : `#${task.id}`;
  
  return (
    <div className={`p-6 rounded-[24px] border transition-all hover:shadow-md bg-white border-slate-100 hover:border-primary/50`}>
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-3">
           <span className="text-[10px] font-black font-mono text-slate-400">{topRef}</span>
           <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter ${isAwaitingPickup ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}>{isAwaitingPickup ? 'AWAITING DISPATCH' : 'EN ROUTE'}</span>
           <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter ${isUnpaid ? 'bg-danger/10 text-danger animate-pulse' : 'bg-success/10 text-success'}`}>{isUnpaid ? 'COLLECT CASH' : 'PAID'}</span>
           {task.serviceSlot && <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest">{task.serviceSlot}</span>}
        </div>
        <div className="flex items-center gap-1.5 text-slate-400 text-xs font-bold"><Clock className="size-3" />{new Date(task.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      </div>
      <div className="flex justify-between items-end">
        <div className="flex-1">
           <h4 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-1">{task.customerName}</h4>
           <p className="text-[10px] font-black uppercase text-primary mb-2 tracking-widest">{task.type}</p>
           <p className="text-sm font-bold text-slate-500 mt-1 max-w-xs">{task.itemsLabel}</p>
           <p className="text-xl font-black text-primary mt-3 tracking-tighter">Rs {formatNumber(task.total)}</p>
        </div>
        <div className="text-right shrink-0 flex flex-col gap-3">
          {isUnpaid && isAwaitingPickup && (
             <button onClick={(e) => { e.stopPropagation(); onCollect(); }} className="px-6 py-2 bg-warning text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-warning/20 transition-all flex items-center justify-center gap-2">
                <Banknote className="size-3" /> Pre-Collect
             </button>
          )}
          {isUnpaid && !isAwaitingPickup && (
             <button onClick={(e) => { e.stopPropagation(); onCollect(); }} className="px-6 py-2 bg-warning text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-warning/20 transition-all flex items-center justify-center gap-2">
                <Banknote className="size-3" /> Collect
             </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); onAction(); }} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all ${isAwaitingPickup ? 'bg-primary text-white shadow-primary/20' : 'bg-success text-white shadow-primary/20'}`}>
             {isAwaitingPickup ? 'DISPATCH FLEET' : 'MARK ARRIVAL'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeliveryPortal;
