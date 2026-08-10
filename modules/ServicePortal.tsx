import React, { useState, useEffect } from 'react';
import { 
  Store, 
  Utensils, 
  Wallet, 
  Home, 
  LogOut, 
  ChevronRight, 
  Clock, 
  ShoppingBag,
  Bell,
  User,
  Users,
  Briefcase
} from 'lucide-react';
import POS from './POS';
import KitchenProgress from './KitchenProgress';
import Cashier from './SalesOrders/Cashier';
import CRM from './CRM';
import EmployeePortal from './EmployeePortal';
import { ACTIVE_ORDERS, subscribeToOrders } from './store';

interface ServicePortalProps {
  onExit: () => void;
}

const ServicePortal: React.FC<ServicePortalProps> = ({ onExit }) => {
  const [activeTab, setActiveTab] = useState<'home' | 'pos' | 'kds' | 'cashier' | 'crm' | 'profile'>('home');
  const [orders, setOrders] = useState(ACTIVE_ORDERS);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  // Mock Staff User
  const staffUser = {
    name: 'Alex Sterling',
    role: 'Shift Lead',
    avatar: 'https://picsum.photos/seed/executive/200/200'
  };

  useEffect(() => {
    return subscribeToOrders(setOrders);
  }, []);

  const activeCount = orders.filter(o => o.status !== 'Completed' && o.status !== 'Cancelled').length;
  const kitchenCount = orders.filter(o => o.status === 'In Kitchen' || o.status === 'Pending').length;
  const pendingPaymentCount = orders.filter(o => o.paymentStatus === 'Pending' && o.status !== 'Cancelled').length;

  const handleNavigate = (module: any) => {
     console.log("Internal nav requested to:", module);
  };

  const getTabLabel = () => {
     switch(activeTab) {
        case 'home': return 'Service Hub';
        case 'pos': return 'Terminal';
        case 'kds': return 'Kitchen Display';
        case 'cashier': return 'Register';
        case 'crm': return 'Customer Directory';
        case 'profile': return 'Staff Profile';
        default: return 'Portal';
     }
  };

  return (
    <div className="h-full w-full bg-slate-50 flex flex-col overflow-hidden relative font-sans">
      
      {/* Top Bar - Increased Z-Index to overlap Module Sidebars */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-50">
         <div className="flex items-center gap-3">
            <div className="size-8 bg-slate-900 rounded-lg flex items-center justify-center text-white shadow-sm">
               <Store className="size-4" />
            </div>
            <div>
               <h1 className="text-sm font-black text-slate-900 leading-none">{getTabLabel()}</h1>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Midtown Branch</p>
            </div>
         </div>
         <div className="flex items-center gap-4">
            <button className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors">
               <Bell className="size-5" />
               <span className="absolute top-1.5 right-1.5 size-2 bg-danger rounded-full border-2 border-white"></span>
            </button>
            <div className="w-px h-6 bg-slate-200"></div>
            
            {/* User Profile Dropdown */}
            <div className="relative">
               <button 
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)} 
                  className="size-9 rounded-full border-2 border-slate-100 shadow-sm overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all"
               >
                  <img src={staffUser.avatar} className="w-full h-full object-cover" alt="Profile" />
               </button>
               {isProfileMenuOpen && (
                  <>
                     <div className="fixed inset-0 z-10" onClick={() => setIsProfileMenuOpen(false)}></div>
                     <div className="absolute right-0 top-12 w-52 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-20 animate-in slide-in-from-top-2 fade-in duration-200">
                        <div className="p-4 bg-slate-50/50 border-b border-slate-100">
                           <p className="text-xs font-black text-slate-900 uppercase tracking-widest">{staffUser.name}</p>
                           <p className="text-[10px] font-bold text-slate-400 mt-0.5">{staffUser.role}</p>
                        </div>
                        <div className="p-1.5">
                           <button onClick={() => { setActiveTab('profile'); setIsProfileMenuOpen(false); }} className="w-full text-left px-3 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-primary rounded-xl flex items-center gap-2.5 transition-all">
                              <User className="size-4" /> My Profile
                           </button>
                           <button onClick={() => { onExit(); setIsProfileMenuOpen(false); }} className="w-full text-left px-3 py-2.5 text-xs font-bold text-danger hover:bg-danger/5 rounded-xl flex items-center gap-2.5 transition-all">
                              <LogOut className="size-4" /> Log Out
                           </button>
                        </div>
                     </div>
                  </>
               )}
            </div>
         </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative flex flex-col">
         {activeTab === 'home' && (
            <div className="flex-1 overflow-y-auto p-6 animate-in fade-in duration-300">
               <div className="max-w-4xl mx-auto space-y-8">
                  {/* Welcome Section */}
                  <div className="bg-slate-900 rounded-[32px] p-8 text-white relative overflow-hidden shadow-2xl">
                     <div className="absolute top-0 right-0 size-64 bg-primary/20 rounded-full blur-3xl -mr-16 -mt-16"></div>
                     <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-6">
                           <div className="size-12 bg-white/10 rounded-full flex items-center justify-center border border-white/10">
                              <User className="size-6 text-white" />
                           </div>
                           <div>
                              <h2 className="text-2xl font-black">Welcome, {staffUser.name.split(' ')[0]}</h2>
                              <p className="text-xs text-white/60 font-bold uppercase tracking-widest">Shift Active • {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                           </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4">
                           <div className="bg-white/10 rounded-2xl p-4 border border-white/5 backdrop-blur-sm">
                              <p className="text-[10px] font-black uppercase text-white/40 tracking-widest mb-1">Active</p>
                              <p className="text-2xl font-black">{activeCount}</p>
                           </div>
                           <div className="bg-white/10 rounded-2xl p-4 border border-white/5 backdrop-blur-sm">
                              <p className="text-[10px] font-black uppercase text-white/40 tracking-widest mb-1">Kitchen</p>
                              <p className="text-2xl font-black">{kitchenCount}</p>
                           </div>
                           <div className="bg-white/10 rounded-2xl p-4 border border-white/5 backdrop-blur-sm">
                              <p className="text-[10px] font-black uppercase text-white/40 tracking-widest mb-1">Unpaid</p>
                              <p className="text-2xl font-black">{pendingPaymentCount}</p>
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* App Launcher Grid */}
                  <div>
                     <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.2em] mb-4 ml-2">Quick Launch</h3>
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <LaunchCard 
                           title="POS Terminal" 
                           subtitle="New Order Entry" 
                           icon={<Store className="size-8" />} 
                           color="text-primary" 
                           bg="bg-primary/5" 
                           onClick={() => setActiveTab('pos')} 
                        />
                        <LaunchCard 
                           title="Kitchen" 
                           subtitle="Track Production" 
                           icon={<Utensils className="size-8" />} 
                           color="text-secondary" 
                           bg="bg-secondary/5" 
                           onClick={() => setActiveTab('kds')}
                           badge={kitchenCount > 0 ? `${kitchenCount}` : undefined}
                        />
                        <LaunchCard 
                           title="Cashier" 
                           subtitle="Payments & Shifts" 
                           icon={<Wallet className="size-8" />} 
                           color="text-accent" 
                           bg="bg-accent/5" 
                           onClick={() => setActiveTab('cashier')}
                           badge={pendingPaymentCount > 0 ? `${pendingPaymentCount}` : undefined}
                        />
                        <LaunchCard 
                           title="CRM Directory" 
                           subtitle="Guest Profiles" 
                           icon={<Users className="size-8" />} 
                           color="text-indigo-600" 
                           bg="bg-indigo-50" 
                           onClick={() => setActiveTab('crm')}
                        />
                     </div>
                  </div>

                  {/* Recent Activity Mini-Feed */}
                  <div className="bg-white rounded-[32px] border border-slate-200 p-6 shadow-sm">
                     <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-black text-slate-900">Recent Activity</h3>
                        <Clock className="size-4 text-slate-300" />
                     </div>
                     <div className="space-y-3">
                        {orders.slice(0, 3).map(order => (
                           <div key={order.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                              <div className="flex items-center gap-3">
                                 <div className={`size-2 rounded-full ${order.status === 'Completed' ? 'bg-success' : 'bg-primary'}`}></div>
                                 <span className="text-xs font-bold text-slate-700">{order.customerName}</span>
                              </div>
                              <span className="text-[10px] font-black uppercase text-slate-400">{order.status}</span>
                           </div>
                        ))}
                        {orders.length === 0 && <p className="text-xs text-slate-400 font-medium text-center py-4">No recent activity logged.</p>}
                     </div>
                  </div>
               </div>
            </div>
         )}

         {/* Modules Rendered Full-Height */}
         {activeTab === 'pos' && (
            <div className="flex-1 h-full overflow-hidden">
               <POS onNavigate={handleNavigate} isEmbedded={true} />
            </div>
         )}
         {activeTab === 'kds' && (
            <div className="flex-1 h-full overflow-hidden">
               <KitchenProgress isEmbedded={true} />
            </div>
         )}
         {activeTab === 'cashier' && (
            <div className="flex-1 h-full overflow-hidden">
               <Cashier />
            </div>
         )}
         {activeTab === 'crm' && (
            <div className="flex-1 h-full overflow-y-auto bg-slate-50">
               <CRM />
            </div>
         )}
         {activeTab === 'profile' && (
            <div className="flex-1 h-full overflow-y-auto bg-slate-50">
               <EmployeePortal />
            </div>
         )}
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="h-20 bg-white border-t border-slate-200 shrink-0 flex items-center justify-around px-2 pb-safe z-30 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
         <NavButton active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<Home />} label="Home" />
         <NavButton active={activeTab === 'pos'} onClick={() => setActiveTab('pos')} icon={<Store />} label="POS" />
         <NavButton active={activeTab === 'kds'} onClick={() => setActiveTab('kds')} icon={<Utensils />} label="Kitchen" />
         <NavButton active={activeTab === 'cashier'} onClick={() => setActiveTab('cashier')} icon={<Wallet />} label="Cashier" />
         <NavButton active={activeTab === 'crm'} onClick={() => setActiveTab('crm')} icon={<Users />} label="Directory" />
      </nav>
    </div>
  );
};

/* --- Internal Components --- */

const LaunchCard = ({ title, subtitle, icon, color, bg, onClick, badge }: any) => (
   <button onClick={onClick} className="bg-white p-6 rounded-[28px] border border-slate-200 shadow-sm hover:shadow-xl transition-all group text-left relative overflow-hidden h-full flex flex-col justify-between">
      <div className={`absolute top-0 right-0 p-4 opacity-50 group-hover:opacity-100 transition-opacity`}>
         <ChevronRight className="size-5 text-slate-300" />
      </div>
      <div className={`size-14 rounded-2xl ${bg} ${color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
         {icon}
      </div>
      <div>
         <h3 className="text-sm font-black text-slate-900 leading-tight">{title}</h3>
         <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{subtitle}</p>
      </div>
      {badge && (
         <div className="absolute top-4 right-4 bg-danger text-white text-[9px] font-black uppercase px-2 py-1 rounded-full shadow-md animate-in zoom-in">
            {badge}
         </div>
      )}
   </button>
);

const NavButton = ({ active, onClick, icon, label }: any) => (
   <button onClick={onClick} className="flex-1 flex flex-col items-center justify-center gap-1 group h-full">
      <div className={`p-2 rounded-2xl transition-all duration-300 ${active ? 'bg-slate-900 text-white shadow-lg -translate-y-2' : 'text-slate-400 group-hover:text-slate-600'}`}>
         {React.cloneElement(icon, { className: 'size-5' })}
      </div>
      <span className={`text-[9px] font-black uppercase tracking-widest transition-colors ${active ? 'text-slate-900' : 'text-slate-400'}`}>{label}</span>
   </button>
);

export default ServicePortal;