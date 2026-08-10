import React, { useState, useEffect, useMemo } from 'react';
import { 
  ClipboardCheck, 
  Utensils, 
  CalendarDays, 
  Clock, 
  Search, 
  Filter, 
  ChevronRight,
  Timer,
  CheckCircle2, 
  AlertCircle,
  User,
  Truck,
  ShoppingBag,
  Store,
  MapPin
} from 'lucide-react';
import { Order } from '../types';
import { subscribeToOrders, MOCK_TODAY } from './store';

const KitchenProgress: React.FC<{ isEmbedded?: boolean }> = ({ isEmbedded }) => {
  const [view, setView] = useState<'on-demand' | 'meal-plans'>('on-demand');
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    return subscribeToOrders(setOrders);
  }, []);

  const progressOrders = useMemo(() => {
    if (view === 'on-demand') {
      return orders.filter(o => o.type !== 'Meal Plan' && (o.status === 'Pending' || o.status === 'In Kitchen' || o.status === 'Ready'));
    } else {
      return orders.filter(o => {
        if (o.type !== 'Meal Plan') return false;
        return o.items.some(item => 
          item.deliveryDate === MOCK_TODAY && 
          item.status !== 'Cancelled' && 
          item.status !== 'Delivered' && 
          item.status !== 'Completed'
        );
      });
    }
  }, [orders, view]);

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 h-full flex flex-col overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 shrink-0">
        {!isEmbedded && (
           <div>
             <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Kitchen Progress</h1>
             <p className="text-slate-500 font-medium">Real-time preparation tracking for service and floor staff</p>
           </div>
        )}
        <div className={`flex bg-white border border-slate-200 p-1.5 rounded-[20px] shadow-sm ${isEmbedded ? 'w-full justify-center' : ''}`}>
          <button 
            onClick={() => setView('on-demand')}
            className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              view === 'on-demand' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            On-Demand
          </button>
          <button 
            onClick={() => setView('meal-plans')}
            className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              view === 'meal-plans' ? 'bg-secondary text-white shadow-lg shadow-secondary/20' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Meal Plans (Today)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch flex-1 min-h-0">
        {/* Main List - Maximized height */}
        <div className="lg:col-span-8 bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <input className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-primary/20 outline-none" placeholder="Search orders or customers..." />
            </div>
            <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
              <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-warning"></span> New</span>
              <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-secondary"></span> Preparing</span>
              <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-primary"></span> Ready</span>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/30">
            {progressOrders.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center opacity-30">
                  <CheckCircle2 className="size-16 mb-2" />
                  <p className="font-black uppercase tracking-widest text-sm">Station Clear</p>
               </div>
            ) : (
              progressOrders.map(order => {
                let status = 'New';
                let progress = 10;
                
                if (order.type === 'Meal Plan') {
                   const todayItems = order.items.filter(i => i.deliveryDate === MOCK_TODAY);
                   const anyReady = todayItems.some(i => i.status === 'Ready');
                   const allReady = todayItems.every(i => i.status === 'Ready');
                   
                   if (allReady) { status = 'Ready'; progress = 100; }
                   else if (anyReady) { status = 'Preparing'; progress = 60; }
                } else {
                   status = order.status === 'Pending' ? 'New' : order.status === 'In Kitchen' ? 'Preparing' : 'Ready';
                   progress = order.status === 'Pending' ? 10 : order.status === 'In Kitchen' ? 60 : 100;
                }

                const itemsLabel = order.type === 'Meal Plan' 
                  ? order.items.filter(i => i.deliveryDate === MOCK_TODAY).map(i => `${i.qty}x ${i.name} (${i.serviceSlot})`).join(', ')
                  : order.items.map(i => `${i.qty}x ${i.name}`).join(', ');
                
                return (
                  <ProgressItem 
                    key={order.id}
                    order={order}
                    status={status} 
                    progress={progress} 
                    itemsLabel={itemsLabel}
                    completed={status === 'Ready'}
                  />
                )
              })
            )}
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="lg:col-span-4 space-y-6 h-full flex flex-col">
          <div className="bg-primary p-10 rounded-[32px] text-white shadow-xl shadow-primary/20 flex flex-col justify-center min-h-[220px] shrink-0">
            <Clock className="size-10 mb-4 opacity-50" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 mb-1">Average Handover Time</p>
            <h3 className="text-4xl font-black tracking-tight">18.4 <span className="text-sm font-bold opacity-70 uppercase tracking-widest">Mins</span></h3>
            <div className="mt-8 flex items-center justify-between text-xs font-bold text-white/70 pt-6 border-t border-white/10">
              <span>Goal: 20m</span>
              <span className="text-success font-black">+8.2% vs Last Shift</span>
            </div>
          </div>

          <div className="bg-white rounded-[32px] border border-slate-200 p-10 shadow-sm flex-1">
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-8">Live Kitchen Load</h4>
            <div className="space-y-8">
              <StaffMetric name="Grill / Sauté" performance="High" progress={92} />
              <StaffMetric name="Cold Prep" performance="Stable" progress={78} />
              <StaffMetric name="Expo / Plating" performance="High" progress={95} />
            </div>
          </div>

          <div className="p-8 bg-slate-900 rounded-[32px] text-white overflow-hidden relative group shrink-0">
             <div className="absolute top-0 right-0 size-32 bg-primary/20 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-primary/40 transition-all duration-700"></div>
             <div className="relative z-10">
                <Utensils className="size-8 text-primary mb-4" />
                <h4 className="text-lg font-black tracking-tight mb-1">Station Optimization</h4>
                <p className="text-xs text-slate-400 font-medium leading-relaxed">Intelligence suggests rotating staff from cold prep to sauté to handle current surge.</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ProgressItemProps {
  order: Order;
  status: string;
  progress: number;
  itemsLabel: string;
  completed: boolean;
}

const ProgressItem: React.FC<ProgressItemProps> = ({ order, status, progress, itemsLabel, completed }) => {
  const elapsed = `${Math.floor((Date.now() - new Date(order.timestamp).getTime()) / 60000)}m`;

  const getFulfillmentUI = () => {
    switch (order.type) {
      case 'Dine-In':
        return { icon: <Store className="size-3" />, label: `Table ${order.tableId || '??'}`, color: 'bg-indigo-50 text-indigo-600' };
      case 'Delivery':
        return { icon: <Truck className="size-3" />, label: 'Standard Delivery', color: 'bg-primary/10 text-primary' };
      case 'Takeout':
        return { icon: <ShoppingBag className="size-3" />, label: 'Self Pickup', color: 'bg-accent/10 text-accent' };
      case 'Meal Plan':
        return { icon: <CalendarDays className="size-3" />, label: 'Daily Dispatch', color: 'bg-secondary/10 text-secondary' };
      default:
        return { icon: <Utensils className="size-3" />, label: order.type, color: 'bg-slate-100 text-slate-600' };
    }
  };

  const fulfillment = getFulfillmentUI();

  return (
    <div className={`p-8 rounded-[36px] border transition-all duration-300 ${
      completed ? 'bg-primary/5 border-primary/20 shadow-inner' : 'bg-white border-slate-200 hover:shadow-xl hover:border-slate-300 group'
    }`}>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-6">
        <div className="flex items-center gap-6">
          <div className="size-14 rounded-[20px] bg-slate-50 flex flex-col items-center justify-center border border-slate-100 shadow-sm shrink-0 group-hover:bg-white transition-colors">
             <span className="text-[9px] font-black text-slate-400 uppercase leading-none mb-1">Order</span>
             <span className="text-base font-black text-slate-900 leading-none">#{order.id.split('-')[1] || order.id}</span>
          </div>
          <div>
             <div className="flex items-center gap-3 mb-1.5">
                <h4 className="text-xl font-black text-slate-900 tracking-tight leading-none">{order.customerName}</h4>
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${fulfillment.color}`}>
                   {fulfillment.icon}
                   {fulfillment.label}
                </div>
             </div>
             <div className="flex items-center gap-6">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                   <Timer className="size-3.5" /> In Prep: <span className="text-slate-900 font-black">{elapsed}</span>
                </p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                   <CheckCircle2 className="size-3.5" /> Status: <span className={completed ? 'text-primary font-black' : 'text-slate-600 font-black'}>{completed ? 'Verified Ready' : 'Pending Kitchen'}</span>
                </p>
             </div>
          </div>
        </div>
        
        <div className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] shadow-sm flex items-center justify-center min-w-[120px] ${
          completed ? 'bg-primary text-white' : status === 'New' ? 'bg-warning text-white' : 'bg-secondary text-white'
        }`}>
          {status}
        </div>
      </div>

      <div className="bg-slate-50/50 p-6 rounded-[24px] border border-slate-100 mb-8 group-hover:bg-white transition-colors">
         <p className="text-base font-bold text-slate-700 leading-relaxed">
            {itemsLabel}
         </p>
      </div>

      <div className="space-y-3">
         <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">
            <span>Production Timeline</span>
            <span className={completed ? 'text-primary' : 'text-slate-600'}>{progress}% Complete</span>
         </div>
         <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/50 p-0.5">
            <div 
              className={`h-full rounded-full transition-all duration-1000 ease-out ${
                completed ? 'bg-primary shadow-[0_0_15px_rgba(15,117,111,0.4)]' : status === 'New' ? 'bg-warning' : 'bg-secondary'
              }`} 
              style={{ width: `${progress}%` }}
            ></div>
         </div>
      </div>
    </div>
  );
};

const StaffMetric = ({ name, performance, progress }: any) => (
  <div className="space-y-2">
    <div className="flex justify-between text-[11px] font-black uppercase tracking-widest text-slate-400">
      <span>{name}</span>
      <span className={performance === 'High' ? 'text-success' : 'text-slate-500'}>{performance}</span>
    </div>
    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-1000 ${performance === 'High' ? 'bg-primary' : 'bg-slate-300'}`} style={{ width: `${progress}%` }}></div>
    </div>
  </div>
);

export default KitchenProgress;