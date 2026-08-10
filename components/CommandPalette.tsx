
import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Command, 
  ArrowRight, 
  LayoutDashboard, 
  Store, 
  MonitorPlay, 
  Users, 
  CalendarDays, 
  Warehouse, 
  Calculator, 
  Settings,
  UserCircle,
  Truck,
  Briefcase,
  ClipboardCheck,
  Wallet
} from 'lucide-react';
import { Module } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (module: Module) => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onNavigate }) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        isOpen ? onClose() : null;
      }
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const commands = [
    { name: 'Dashboard', icon: LayoutDashboard, module: Module.DASHBOARD },
    { name: 'POS Terminal', icon: Store, module: Module.POS },
    { name: 'Kitchen Progress', icon: ClipboardCheck, module: Module.KITCHEN_PROGRESS },
    { name: 'Cashier Module', icon: Wallet, module: Module.CASHIER_MODULE },
    { name: 'CRM & Loyalty', icon: Users, module: Module.CRM_LOYALTY },
    { name: 'Meal Planner', icon: CalendarDays, module: Module.PLANNER },
    { name: 'Meal Library', icon: ClipboardCheck, module: Module.MEAL_LIBRARY },
    { name: 'Inventory Management', icon: Warehouse, module: Module.INVENTORY },
    { name: 'Accounting Hub', icon: Calculator, module: Module.ACCOUNTING_LEDGER },
    { name: 'Kitchen Portal', icon: MonitorPlay, module: Module.KITCHEN_PORTAL },
    { name: 'Customer Portal', icon: UserCircle, module: Module.CUSTOMER_PORTAL },
    /* Fixed: Corrected Module.DELIVERY_PORTAL to Module.DELIVERY_HUB to match types.ts enum */
    { name: 'Delivery Hub', icon: Truck, module: Module.DELIVERY_HUB },
    { name: 'Employee Center', icon: Briefcase, module: Module.EMPLOYEE_PORTAL },
    { name: 'System Settings', icon: Settings, module: Module.SETTINGS },
  ];

  const filtered = commands.filter(c => c.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 z-[150] flex items-start justify-center pt-[15vh] px-4 backdrop-blur-sm bg-slate-900/40 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white rounded-[32px] shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-top-4 duration-300">
        <div className="relative border-b border-slate-100">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 size-5 text-slate-400" />
          <input
            autoFocus
            className="w-full pl-16 pr-6 py-6 text-lg font-medium border-none focus:ring-0 placeholder:text-slate-300"
            placeholder="Search modules, portals, or actions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="max-h-[400px] overflow-y-auto p-4 custom-scrollbar">
          <div className="space-y-1">
            <p className="px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Jump to Module</p>
            {filtered.map((cmd) => (
              <button
                key={cmd.name}
                onClick={() => { onNavigate(cmd.module); onClose(); }}
                className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-slate-50 group transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="size-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                    <cmd.icon className="size-5" />
                  </div>
                  <span className="font-bold text-slate-700 group-hover:text-slate-900">{cmd.name}</span>
                </div>
                <ArrowRight className="size-4 text-slate-300 group-hover:text-primary transition-all" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
