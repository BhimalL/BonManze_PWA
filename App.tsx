
import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  Store, 
  MonitorPlay, 
  Users, 
  CalendarDays, 
  Warehouse, 
  Calculator, 
  Settings as SettingsIcon, 
  Factory,
  Bell,
  Search,
  ChevronDown,
  ChevronRight,
  Clock as ClockIcon,
  UserCircle,
  Truck,
  Briefcase,
  BookOpen,
  ClipboardCheck,
  CreditCard,
  History,
  Book,
  Wallet,
  ShoppingCart,
  Banknote,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldAlert,
  Percent,
  CheckCircle2,
  X,
  Calendar,
  Grid
} from 'lucide-react';
import { Module } from './types';
import Dashboard from './modules/Dashboard';
import POS from './modules/POS';
import CRM from './modules/CRM';
import Inventory from './modules/Inventory';
import KitchenPortal from './modules/KitchenPortal';
import KitchenProgress from './modules/KitchenProgress';
import CashierModule from './modules/SalesOrders/Cashier';
import Planner from './modules/Planner';
import MealLibrary from './modules/MealLibrary';
import Settings from './modules/Settings';
import CustomerPortal from './modules/CustomerPortal';
import DeliveryPortal from './modules/DeliveryPortal';
import EmployeePortal from './modules/EmployeePortal';
import ServicePortal from './modules/ServicePortal';
import PurchaseOrdering from './modules/PurchaseOrdering';
import Receivables from './modules/Accounting/Receivables';
import Payables from './modules/Accounting/Payables';
import GeneralLedger from './modules/Accounting/GeneralLedger';
import Cashbook from './modules/Accounting/Cashbook';
import Discrepancies from './modules/CashManagement/Discrepancies';
import DiscountApprovals from './modules/Management/DiscountApprovals';
import CommandPalette from './components/CommandPalette';
import { MOCK_TODAY, subscribeToSystemDate, updateSystemDate } from './modules/store';

interface NavGroup {
  title: string;
  icon: any;
  items: { module: Module; icon: any }[];
}

const DigitalClock: React.FC = () => {
  const [time, setTime] = useState(new Date());
  const [systemDateStr, setSystemDateStr] = useState(MOCK_TODAY);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tempDate, setTempDate] = useState(MOCK_TODAY);
  
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    const unsub = subscribeToSystemDate((d) => {
        setSystemDateStr(d);
        setTempDate(d);
    });
    return () => {
      clearInterval(timer);
      unsub();
    };
  }, []);

  const handleConfirmDate = () => {
    updateSystemDate(tempDate);
    setIsModalOpen(false);
  };

  const [year, month, day] = systemDateStr.split('-').map(Number);
  const systemDate = new Date(year, month - 1, day);

  return (
    <>
      <div className="flex items-center gap-4 text-slate-400 font-mono text-sm font-bold">
        <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 relative group cursor-pointer hover:text-primary transition-colors bg-transparent border-none p-0"
            title="Click to Change System Date"
        >
          <CalendarDays className="size-4" />
          <span>
              {systemDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[8px] font-sans font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-white px-2 py-1 rounded shadow-md border border-slate-100 pointer-events-none z-50">
              Change Date
          </div>
        </button>
        <div className="w-px h-3 bg-slate-200"></div>
        <div className="flex items-center gap-2">
          <ClockIcon className="size-4" />
          {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-[32px] p-8 shadow-2xl w-full max-w-sm animate-in zoom-in-95 duration-300">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-black text-slate-900">System Time Travel</h3>
                    <button onClick={() => setIsModalOpen(false)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors">
                        <X className="size-4 text-slate-500" />
                    </button>
                </div>
                
                <div className="space-y-6">
                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center gap-4">
                        <Calendar className="size-8 text-primary" />
                        <p className="text-xs font-medium text-slate-500 text-center">Select a new operating date for the entire system.</p>
                        <input 
                            type="date" 
                            value={tempDate}
                            onChange={(e) => setTempDate(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 font-bold text-slate-900 outline-none focus:ring-2 focus:ring-primary/20 text-center cursor-pointer"
                        />
                    </div>
                    
                    <button 
                        onClick={handleConfirmDate}
                        className="w-full py-3 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                    >
                        Jump to Date
                    </button>
                </div>
            </div>
        </div>
      )}
    </>
  );
};

const App: React.FC = () => {
  const [activeModule, setActiveModule] = useState<Module>(Module.DASHBOARD);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [openHeader, setOpenHeader] = useState<string | null>('Management');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const toggleHeader = (title: string) => {
    if (isSidebarCollapsed) setIsSidebarCollapsed(false);
    setOpenHeader(prev => (prev === title ? null : title));
  };

  const navGroups: NavGroup[] = [
    {
      title: 'Management',
      icon: LayoutDashboard,
      items: [
        { module: Module.DASHBOARD, icon: LayoutDashboard },
        { module: Module.DISCREPANCIES, icon: ShieldAlert },
        { module: Module.DISCOUNT_APPROVALS, icon: Percent },
      ]
    },
    {
      title: 'Operations',
      icon: Factory,
      items: [
        { module: Module.INVENTORY, icon: Warehouse },
        { module: Module.PURCHASE_ORDERING, icon: ShoppingCart },
      ]
    },
    {
      title: 'Accounting',
      icon: Calculator,
      items: [
        { module: Module.ACCOUNTING_RECEIVABLES, icon: CreditCard },
        { module: Module.ACCOUNTING_PAYABLES, icon: History },
        { module: Module.ACCOUNTING_LEDGER, icon: Book },
        { module: Module.ACCOUNTING_CASHBOOK, icon: Wallet },
      ]
    },
    {
      title: 'Menus',
      icon: BookOpen,
      items: [
        { module: Module.MEAL_LIBRARY, icon: BookOpen },
        { module: Module.PLANNER, icon: CalendarDays },
      ]
    },
    {
      title: 'CRM',
      icon: Users,
      items: [
        { module: Module.CRM_LOYALTY, icon: Users },
      ]
    },
    {
      title: 'Portals',
      icon: MonitorPlay,
      items: [
        { module: Module.SERVICE_PORTAL, icon: Grid },
        { module: Module.KITCHEN_PORTAL, icon: MonitorPlay },
        { module: Module.CUSTOMER_PORTAL, icon: UserCircle },
        { module: Module.DELIVERY_HUB, icon: Truck },
        { module: Module.EMPLOYEE_PORTAL, icon: Briefcase },
      ]
    }
  ];

  const NavItem: React.FC<{ module: Module, icon: any }> = ({ module, icon: Icon }) => (
    <button
      onClick={() => setActiveModule(module)}
      className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-xl transition-all duration-200 group ${
        activeModule === module 
          ? 'bg-primary/10 text-primary font-bold' 
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      <Icon className={`size-4 shrink-0 ${activeModule === module ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600'}`} />
      {!isSidebarCollapsed && <span className="text-[12px] whitespace-nowrap overflow-hidden">{module}</span>}
    </button>
  );

  // Full Screen Portals
  if (activeModule === Module.CUSTOMER_PORTAL) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-slate-50">
        <CustomerPortal onLogout={() => setActiveModule(Module.DASHBOARD)} />
      </div>
    );
  }

  if (activeModule === Module.SERVICE_PORTAL) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-slate-50">
        <ServicePortal onExit={() => setActiveModule(Module.DASHBOARD)} />
      </div>
    );
  }

  if (activeModule === Module.KITCHEN_PORTAL) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-[#111f21]">
        <KitchenPortal onExit={() => setActiveModule(Module.DASHBOARD)} />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden font-sans selection:bg-primary/20 bg-[#f8fafb]">
      <aside className={`${isSidebarCollapsed ? 'w-20' : 'w-64'} border-r border-slate-200 bg-white flex flex-col shrink-0 z-30 shadow-sm transition-all duration-300 ease-in-out`}>
        <div className={`p-6 pb-2 ${isSidebarCollapsed ? 'items-center px-0' : ''}`}>
          <div className={`flex items-center gap-3 mb-8 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
            <div className="size-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20 shrink-0">
              <Store className="size-6" />
            </div>
            {!isSidebarCollapsed && (
              <div className="animate-in fade-in duration-300">
                <h1 className="text-base font-bold leading-tight tracking-tight">RMS Enterprise</h1>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Global Executive</p>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto custom-scrollbar px-3 space-y-1">
          {navGroups.map(group => {
            const isOpen = openHeader === group.title && !isSidebarCollapsed;
            return (
              <div key={group.title} className="mb-1">
                <button 
                  onClick={() => toggleHeader(group.title)}
                  title={isSidebarCollapsed ? group.title : ''}
                  className={`flex items-center justify-between w-full px-4 py-3 rounded-xl transition-all ${
                    isOpen ? 'bg-slate-50 text-slate-900' : 'text-slate-500 hover:bg-slate-50/50'
                  } ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <group.icon className={`size-4.5 shrink-0 ${isOpen ? 'text-primary' : 'text-slate-400'}`} />
                    {!isSidebarCollapsed && <span className="text-xs font-black uppercase tracking-widest">{group.title}</span>}
                  </div>
                  {!isSidebarCollapsed && (isOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />)}
                </button>
                {isOpen && (
                  <div className="mt-1 ml-2 pl-4 border-l border-slate-100 space-y-0.5 animate-in slide-in-from-top-1 duration-200">
                    {group.items.map(item => (
                      <NavItem key={item.module} module={item.module} icon={item.icon} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="mt-auto p-4 border-t border-slate-100 bg-slate-50/50">
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="flex items-center justify-center gap-3 w-full px-4 py-2.5 mb-2 rounded-xl transition-all text-slate-400 hover:bg-white hover:text-primary border border-transparent hover:border-slate-200"
          >
            {isSidebarCollapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
            {!isSidebarCollapsed && <span className="text-xs font-bold">Collapse Menu</span>}
          </button>

          <button 
            onClick={() => setActiveModule(Module.SETTINGS)}
            className={`flex items-center gap-3 w-full px-4 py-2.5 mb-4 rounded-xl transition-all ${
              activeModule === Module.SETTINGS ? 'bg-primary text-white font-bold' : 'text-slate-500 hover:bg-white hover:text-slate-900'
            } ${isSidebarCollapsed ? 'justify-center' : ''}`}
          >
            <SettingsIcon className="size-4 shrink-0" />
            {!isSidebarCollapsed && <span className="text-xs font-medium">System Settings</span>}
          </button>
          
          <div className={`flex items-center gap-3 p-2 bg-white rounded-xl border border-slate-200 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
            <img 
              src="https://picsum.photos/seed/executive/80/80" 
              className="size-9 rounded-full border-2 border-slate-100 shadow-sm shrink-0"
              alt="Alex Sterling"
            />
            {!isSidebarCollapsed && (
              <div className="overflow-hidden animate-in fade-in">
                <p className="text-xs font-bold truncate">Alex Sterling</p>
                <p className="text-[9px] text-slate-400 uppercase font-black tracking-tight">Managing Director</p>
              </div>
            )}
          </div>
          {!isSidebarCollapsed && (
             <div className="mt-3 text-center">
                <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">System v2.4</span>
             </div>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 relative">
        <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md px-8 flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-extrabold tracking-tight">{activeModule}</h2>
              <div className="h-4 w-px bg-slate-200"></div>
              <DigitalClock />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsPaletteOpen(true)}
              className="hidden lg:flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-400 rounded-xl text-xs font-bold border border-slate-200 hover:bg-slate-200 transition-all"
            >
              <Search className="size-4" />
              <span>Search...</span>
              <kbd className="ml-2 font-sans font-black text-[10px] text-slate-300">⌘K</kbd>
            </button>
            <button className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
              <Bell className="size-5" />
              <span className="absolute top-2 right-2.5 size-2 bg-danger rounded-full border-2 border-white"></span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto custom-scrollbar">
          {activeModule === Module.DASHBOARD && <Dashboard />}
          {activeModule === Module.POS && <POS onNavigate={setActiveModule} />}
          {activeModule === Module.KITCHEN_PROGRESS && <KitchenProgress />}
          {activeModule === Module.CASHIER_MODULE && <CashierModule />}
          {activeModule === Module.CRM_LOYALTY && <CRM />}
          {activeModule === Module.INVENTORY && <Inventory />}
          {activeModule === Module.PURCHASE_ORDERING && <PurchaseOrdering />}
          {activeModule === Module.MEAL_LIBRARY && <MealLibrary />}
          {activeModule === Module.PLANNER && <Planner />}
          {activeModule === Module.ACCOUNTING_RECEIVABLES && <Receivables />}
          {activeModule === Module.ACCOUNTING_PAYABLES && <Payables />}
          {activeModule === Module.ACCOUNTING_LEDGER && <GeneralLedger />}
          {activeModule === Module.ACCOUNTING_CASHBOOK && <Cashbook />}
          {activeModule === Module.DELIVERY_HUB && <DeliveryPortal />}
          {activeModule === Module.EMPLOYEE_PORTAL && <EmployeePortal />}
          {activeModule === Module.SETTINGS && <Settings />}
          {activeModule === Module.DISCREPANCIES && <Discrepancies />}
          {activeModule === Module.DISCOUNT_APPROVALS && <DiscountApprovals />}
        </main>
      </div>

      <CommandPalette 
        isOpen={isPaletteOpen} 
        onClose={() => setIsPaletteOpen(false)} 
        onNavigate={(mod) => {
          setActiveModule(mod);
          const group = navGroups.find(g => g.items.some(i => i.module === mod));
          if (group) setOpenHeader(group.title);
        }} 
      />
    </div>
  );
};

export default App;
