
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Factory, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight, 
  Printer, 
  AlertCircle,
  Hash,
  Smile,
  Zap,
  Info,
  Utensils,
  LayoutGrid,
  BarChart3,
  Clock,
  Check,
  Calendar,
  Users,
  Flame,
  Play,
  Settings,
  Bell,
  LogOut,
  MonitorPlay,
  ChefHat
} from 'lucide-react';
import { Order } from '../types';
import { subscribeToOrders, advanceOrderStatus, batchMarkReady, MOCK_TODAY, SYSTEM_CONFIG, updateOrderItemStatusByIndex, subscribeToSystemDate } from './store';

const KitchenPortal: React.FC<{ onExit?: () => void }> = ({ onExit }) => {
  const [view, setView] = useState<'on-demand' | 'meal-plans' | 'station'>('on-demand');
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date(MOCK_TODAY)); 
  const [selectedService, setSelectedService] = useState<string>('Lunch');
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  useEffect(() => {
    const unsubOrders = subscribeToOrders(setOrders);
    const unsubDate = subscribeToSystemDate((date) => setSelectedDate(new Date(date)));
    return () => {
      unsubOrders();
      unsubDate();
    };
  }, []);

  const dateKey = selectedDate.toISOString().split('T')[0];
  const isToday = dateKey === MOCK_TODAY;

  const allServiceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    SYSTEM_CONFIG.activeServices.forEach(s => counts[s] = 0);
    
    SYSTEM_CONFIG.activeServices.forEach(s => {
      const batchMap: Record<string, boolean> = {};
      orders.filter(o => o.type === 'Meal Plan' && o.status !== 'Cancelled').forEach(o => {
        o.items.forEach(item => {
          const iDate = item.deliveryDate || '';
          const iSlot = item.serviceSlot || 'Lunch';
          if (iDate === dateKey && iSlot === s && 
              item.status !== 'Cancelled' && item.status !== 'Ready' && 
              item.status !== 'Delivered' && item.status !== 'Completed') {
            batchMap[item.name] = true;
          }
        });
      });
      counts[s] = Object.keys(batchMap).length;
    });
    return counts;
  }, [orders, dateKey]);

  const filteredOrders = useMemo(() => {
    if (view === 'on-demand') {
       return orders.filter(o => 
          (o.status === 'Pending' || o.status === 'In Kitchen') && 
          o.type !== 'Meal Plan' &&
          o.items.some(i => i.status === 'Active' || i.status === 'Preparing' || i.status === 'Cancelled')
       );
    } else if (view === 'meal-plans') {
       const batchMap: Record<string, { name: string; qty: number; items: any[]; serviceSlot: string; isReady: boolean }> = {};
       
       orders.filter(o => o.type === 'Meal Plan' && o.status !== 'Cancelled').forEach(o => {
          o.items.forEach(item => {
             const iDate = item.deliveryDate || '';
             const iSlot = item.serviceSlot || 'Lunch';

             if (iDate === dateKey && iSlot === selectedService && 
                 item.status !== 'Cancelled' && item.status !== 'Ready' && 
                 item.status !== 'Delivered' && item.status !== 'Completed') {
                
                const key = `${item.name}-${item.serviceSlot}`;
                if (!batchMap[key]) {
                   batchMap[key] = { name: item.name, qty: 0, items: [], serviceSlot: item.serviceSlot || 'General', isReady: false };
                }
                batchMap[key].qty += item.qty;
                batchMap[key].items.push({ ...item, customerName: o.customerName, parentOrderId: o.id });
             }
          });
       });
       return Object.values(batchMap);
    }
    return [];
  }, [orders, view, dateKey, selectedService]);

  const changeDate = (days: number) => {
     const newDate = new Date(selectedDate);
     newDate.setDate(selectedDate.getDate() + days);
     setSelectedDate(newDate);
  };

  const handleBatchReady = (batch: any) => {
      batchMarkReady(dateKey, batch.serviceSlot, batch.name);
  };

  const activeTicketCount = useMemo(() => {
     return orders.filter(o => 
        (o.status === 'Pending' || o.status === 'In Kitchen') && 
        o.type !== 'Meal Plan' &&
        o.items.some(i => i.status === 'Active' || i.status === 'Preparing' || i.status === 'Cancelled')
     ).length;
  }, [orders]);

  const activeBatchCount = useMemo(() => {
     let count = 0;
     SYSTEM_CONFIG.activeServices.forEach(s => count += allServiceCounts[s]);
     return count;
  }, [allServiceCounts]);

  return (
    <div className="h-full bg-[#111f21] flex flex-col font-display overflow-hidden relative">
      
      {/* TOP HEADER */}
      <header className="h-20 flex items-center justify-between px-6 border-b border-white/5 bg-[#111f21]/95 backdrop-blur-md shrink-0 z-50">
         <div className="flex items-center gap-4">
            <div className="size-10 bg-[#1dbac9] rounded-xl flex items-center justify-center text-[#111f21] shadow-lg shadow-[#1dbac9]/20">
               <MonitorPlay className="size-6" />
            </div>
            <div>
               <h1 className="text-lg font-black text-white tracking-tight leading-none">Kitchen Display</h1>
               <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Station: Hot Line</p>
            </div>
         </div>
         
         <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                <Clock className="size-4 text-[#1dbac9]" />
                <span className="text-xs font-black text-white">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            
            <div className="flex items-center gap-3 pl-6 md:border-l border-white/10">
               <div className="text-right hidden md:block">
                  <p className="text-sm font-black text-white">Chef Ramsey</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Head Chef</p>
               </div>
               <div className="relative">
                  <button onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)} className="size-10 rounded-full bg-white/10 border-2 border-white/10 overflow-hidden hover:border-[#1dbac9] transition-all cursor-pointer">
                     <img src="https://picsum.photos/seed/chef/200/200" className="w-full h-full object-cover" />
                  </button>
                  {isProfileMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setIsProfileMenuOpen(false)}></div>
                      <div className="absolute right-0 top-12 w-64 bg-[#1a2c2e] rounded-2xl shadow-2xl border border-white/10 overflow-hidden z-50 animate-in slide-in-from-top-2 fade-in duration-200">
                        <div className="p-4 bg-white/5 border-b border-white/5">
                          <p className="text-sm font-black text-white uppercase tracking-widest">Chef Ramsey</p>
                          <p className="text-[10px] font-bold text-slate-400 mt-0.5">Head Chef • Station 1</p>
                        </div>
                        <div className="p-1.5 space-y-1">
                          <button onClick={() => { setView('station'); setIsProfileMenuOpen(false); }} className="w-full text-left px-3 py-3 text-xs font-bold text-slate-300 hover:bg-white/5 hover:text-white rounded-xl flex items-center gap-3 transition-all">
                            <Settings className="size-4" /> Station Settings
                          </button>
                          <button className="w-full text-left px-3 py-3 text-xs font-bold text-slate-300 hover:bg-white/5 hover:text-white rounded-xl flex items-center gap-3 transition-all">
                            <Users className="size-4" /> Switch Station User
                          </button>
                          <div className="h-px bg-white/5 my-1"></div>
                          <button onClick={() => { onExit?.(); setIsProfileMenuOpen(false); }} className="w-full text-left px-3 py-3 text-xs font-bold text-danger hover:bg-danger/10 rounded-xl flex items-center gap-3 transition-all">
                            <LogOut className="size-4" /> Exit KDS Mode
                          </button>
                        </div>
                      </div>
                    </>
                  )}
               </div>
            </div>
         </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-6 pb-32">
         
         {view === 'on-demand' && (
            <div className="space-y-6 animate-in fade-in duration-300">
               {/* View Header */}
               <div className="flex justify-between items-center bg-[#1a2c2e] p-4 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-3">
                     <div className="size-8 bg-[#1dbac9]/20 text-[#1dbac9] rounded-lg flex items-center justify-center"><Utensils className="size-4" /></div>
                     <span className="text-xs font-black text-white uppercase tracking-widest">Live Tickets</span>
                  </div>
                  <div className="flex items-center gap-2">
                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Queue:</span>
                     <span className="text-xl font-black text-white">{filteredOrders.length}</span>
                  </div>
               </div>

               {filteredOrders.length === 0 ? (
                  <div className="h-[400px] flex flex-col items-center justify-center opacity-30 text-white">
                     <CheckCircle2 className="size-24 mb-4" />
                     <p className="text-xl font-black uppercase tracking-widest">All Clear</p>
                  </div>
               ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                     {filteredOrders.map((order: any) => (
                        <KDSOrderCard 
                           key={order.id}
                           order={order}
                           id={order.id.split('-')[1] || order.id}
                           table={order.tableId}
                           type={order.type}
                           name={order.customerName}
                           status={order.status === 'Pending' ? 'New' : 'Prep'}
                           elapsed={`${Math.floor((Date.now() - new Date(order.timestamp).getTime()) / 60000)}m`} 
                           items={order.items}
                           onUpdateItem={(idx: number, status: string) => updateOrderItemStatusByIndex(order.id, idx, status as any)}
                           onBumpAll={() => advanceOrderStatus(order.id)}
                        />
                     ))}
                  </div>
               )}
            </div>
         )}

         {view === 'meal-plans' && (
            <div className="space-y-6 animate-in fade-in duration-300">
               {/* Controls Bar */}
               <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-[#1a2c2e] p-3 rounded-2xl border border-white/5 sticky top-0 z-10 shadow-xl">
                  <div className="flex items-center gap-3 bg-white/5 p-1.5 rounded-xl border border-white/10">
                     <button onClick={() => changeDate(-1)} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"><ChevronLeft className="size-4" /></button>
                     <div className="flex flex-col items-center px-4 min-w-[120px]">
                        <span className="text-[8px] font-black uppercase text-[#1dbac9] tracking-widest leading-none mb-1">Production Date</span>
                        <span className="text-sm font-black text-white">{selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })}</span>
                     </div>
                     <button onClick={() => changeDate(1)} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"><ChevronRight className="size-4" /></button>
                  </div>

                  <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 overflow-x-auto hide-scrollbar max-w-full">
                     {SYSTEM_CONFIG.activeServices.map(service => (
                        <button 
                           key={service}
                           onClick={() => setSelectedService(service)}
                           className={`px-5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${
                              selectedService === service 
                                 ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                                 : 'text-slate-400 hover:text-white'
                           }`}
                        >
                           {service}
                           {allServiceCounts[service] > 0 && (
                              <span className={`size-4 rounded-full flex items-center justify-center text-[8px] font-black shadow-sm ${
                                 selectedService === service ? 'bg-white text-primary' : 'bg-primary text-white'
                              }`}>
                                {allServiceCounts[service]}
                              </span>
                           )}
                        </button>
                     ))}
                  </div>
               </div>

               {filteredOrders.length === 0 ? (
                  <div className="h-[400px] flex flex-col items-center justify-center opacity-30 text-white">
                     <Factory className="size-24 mb-4" />
                     <p className="text-xl font-black uppercase tracking-widest">No Batches Queued</p>
                     <p className="text-xs font-bold text-slate-500 mt-2">Select a different date or service slot</p>
                  </div>
               ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                     {filteredOrders.map((batch: any, idx: number) => (
                        <KDSBatchCard 
                           key={`${batch.name}-${idx}`}
                           batch={batch}
                           onBump={() => handleBatchReady(batch)}
                        />
                     ))}
                  </div>
               )}
            </div>
         )}

         {view === 'station' && (
            <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-300">
               <div className="bg-[#1a2c2e] rounded-[32px] p-8 border border-white/10 text-center">
                  <div className="size-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-white/10">
                     <ChefHat className="size-12 text-[#1dbac9]" />
                  </div>
                  <h2 className="text-2xl font-black text-white">Hot Line Station 01</h2>
                  <p className="text-sm font-bold text-slate-400 mt-1">Logged in as Chef Ramsey</p>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#1a2c2e] p-6 rounded-[24px] border border-white/10">
                     <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Avg Bump Time</p>
                     <p className="text-3xl font-black text-white">4m 12s</p>
                  </div>
                  <div className="bg-[#1a2c2e] p-6 rounded-[24px] border border-white/10">
                     <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Items Cleared</p>
                     <p className="text-3xl font-black text-primary">142</p>
                  </div>
               </div>

               <div className="space-y-3">
                  <button className="w-full p-4 bg-[#1a2c2e] rounded-2xl border border-white/10 flex items-center justify-between text-white hover:bg-white/5 transition-all">
                     <span className="text-xs font-black uppercase tracking-widest flex items-center gap-3"><Printer className="size-4 text-slate-400" /> Printer Configuration</span>
                     <div className="flex items-center gap-2"><div className="size-2 rounded-full bg-success"></div><span className="text-[10px] font-bold text-slate-400">Online</span></div>
                  </button>
                  <button className="w-full p-4 bg-[#1a2c2e] rounded-2xl border border-white/10 flex items-center justify-between text-white hover:bg-white/5 transition-all">
                     <span className="text-xs font-black uppercase tracking-widest flex items-center gap-3"><Info className="size-4 text-slate-400" /> System Diagnostics</span>
                     <ChevronRight className="size-4 text-slate-500" />
                  </button>
               </div>
            </div>
         )}

      </main>

      {/* BOTTOM NAVIGATION BAR */}
      <nav className="fixed bottom-0 left-0 right-0 h-24 bg-[#0d1819] border-t border-white/5 flex items-end justify-around px-6 z-40 pb-6 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
         <NavButton 
            label="Live KDS" 
            icon={<Utensils />} 
            active={view === 'on-demand'} 
            onClick={() => setView('on-demand')} 
            badge={activeTicketCount}
         />
         <NavButton 
            label="Production" 
            icon={<Factory />} 
            active={view === 'meal-plans'} 
            onClick={() => setView('meal-plans')} 
            badge={activeBatchCount}
         />
         <NavButton 
            label="Station" 
            icon={<Settings />} 
            active={view === 'station'} 
            onClick={() => setView('station')} 
         />
      </nav>
    </div>
  );
};

const NavButton = ({ label, icon, active, onClick, badge }: any) => (
   <button 
      onClick={onClick} 
      className={`flex flex-col items-center gap-1 transition-all duration-300 ${active ? '-mt-8 scale-110' : 'hover:scale-105 opacity-60 hover:opacity-100'}`}
   >
      <div className={`transition-all duration-300 flex items-center justify-center relative border-4 border-[#0d1819] ${
        active 
          ? 'size-14 rounded-full bg-[#1dbac9] text-[#111f21] shadow-xl shadow-[#1dbac9]/30' 
          : 'size-10 bg-transparent text-slate-400'
      }`}>
        {React.cloneElement(icon, { className: active ? 'size-6' : 'size-6' })}
        {badge > 0 && (
          <span className={`absolute ${active ? 'top-0 right-0' : '-top-1 -right-1'} size-4 flex items-center justify-center text-[9px] font-black bg-danger text-white rounded-full border-2 border-[#0d1819]`}>
             {badge}
          </span>
        )}
      </div>
      <span className={`text-[9px] font-black uppercase tracking-widest transition-colors ${active ? 'text-[#1dbac9]' : 'text-slate-500'}`}>
        {label}
      </span>
   </button>
);

const KDSOrderCard = ({ id, table, type, name, status, elapsed, items, onUpdateItem, onBumpAll }: any) => {
  return (
    <div className={`flex flex-col bg-[#1a2c2e] rounded-[24px] overflow-hidden border transition-all ${status === 'New' ? 'border-warning/50 shadow-lg shadow-warning/10' : 'border-white/10 hover:border-white/20'}`}>
      <div className={`p-4 flex justify-between items-start ${status === 'New' ? 'bg-warning/10' : 'bg-white/5'}`}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${status === 'New' ? 'bg-warning text-black' : 'bg-[#1dbac9] text-[#111f21]'}`}>
              {status}
            </span>
            <span className="text-[10px] font-black text-slate-400">#{id}</span>
          </div>
          <h4 className="text-lg font-black text-white leading-tight">{table ? `Table ${table}` : type}</h4>
        </div>
        <div className="text-right">
          <span className="text-2xl font-black text-white tabular-nums tracking-tighter">{elapsed}</span>
        </div>
      </div>
      
      <div className="flex-1 p-4 space-y-3">
        {items.map((item: any, idx: number) => {
           if (item.status === 'Ready' || item.status === 'Delivered') return null;
           
           return (
             <div key={idx} onClick={() => item.status !== 'Cancelled' && onUpdateItem(idx, item.status === 'Preparing' ? 'Ready' : 'Preparing')} 
                  className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all 
                  ${item.status === 'Cancelled' ? 'opacity-50' : item.status === 'Preparing' ? 'bg-[#1dbac9]/10' : 'hover:bg-white/5'}`}>
                <div className="flex items-center gap-3">
                   <span className={`text-lg font-black w-6 ${item.status === 'Cancelled' ? 'text-red-500 line-through' : 'text-[#1dbac9]'}`}>{item.qty}</span>
                   <span className={`text-sm font-bold ${item.status === 'Cancelled' ? 'text-red-500 line-through' : item.status === 'Preparing' ? 'text-[#1dbac9]' : 'text-slate-300'}`}>{item.name}</span>
                </div>
                {item.status === 'Preparing' && <Flame className="size-4 text-[#1dbac9] animate-pulse" />}
                {item.status === 'Cancelled' && <span className="text-[9px] text-red-500 font-bold uppercase tracking-widest">CANCELLED</span>}
             </div>
           );
        })}
      </div>

      <button onClick={onBumpAll} className="p-4 bg-white/5 hover:bg-[#1dbac9] hover:text-[#111f21] transition-all text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center justify-center gap-2">
        <Check className="size-4" /> Bump Ticket
      </button>
    </div>
  );
};

const KDSBatchCard = ({ batch, onBump, active }: any) => (
   <div className={`flex flex-col bg-[#1a2c2e] rounded-[24px] overflow-hidden border border-white/10 hover:border-primary/50 transition-all group`}>
      <div className="p-6 bg-white/5 flex justify-between items-start">
         <div>
            <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest mb-2 block w-fit">Batch</span>
            <h4 className="text-xl font-black text-white leading-tight">{batch.name}</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{batch.serviceSlot}</p>
         </div>
         <div className="text-right">
            <span className="text-4xl font-black text-white tracking-tighter">{batch.qty}</span>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Count</p>
         </div>
      </div>
      <div className="flex-1 p-4 bg-[#162628] overflow-y-auto max-h-[200px] custom-scrollbar">
         {batch.items.map((item: any, i: number) => (
            <div key={i} className="flex justify-between py-2 border-b border-white/5 text-xs font-medium text-slate-400 last:border-0">
               <span>{item.customerName}</span>
               <span>x{item.qty}</span>
            </div>
         ))}
      </div>
      <button onClick={onBump} className="p-4 bg-primary text-white text-xs font-black uppercase tracking-[0.2em] hover:brightness-110 transition-all flex items-center justify-center gap-2">
         <CheckCircle2 className="size-4" /> Complete Batch
      </button>
   </div>
);

export default KitchenPortal;
