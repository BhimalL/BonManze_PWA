
import React, { useState } from 'react';
import { Store, UserCircle, LayoutGrid } from 'lucide-react';
import CustomerPortal from './modules/CustomerPortal';
import Operations from './modules/Operations';

type View = 'landing' | 'customer' | 'operations';

const App: React.FC = () => {
  const [view, setView] = useState<View>('landing');

  if (view === 'customer') {
    return (
      <div className="h-screen w-screen overflow-hidden bg-slate-50">
        <CustomerPortal onLogout={() => setView('landing')} />
      </div>
    );
  }

  if (view === 'operations') {
    return (
      <div className="h-screen w-screen overflow-hidden bg-slate-50">
        <Operations onExit={() => setView('landing')} />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#f8fafb] p-6">
      <div className="max-w-2xl w-full text-center">
        <div className="size-16 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/20 mx-auto mb-6">
          <Store className="size-8" />
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">BonManzE</h1>
        <p className="text-slate-500 font-medium mb-10">Home-made Mauritian lunches, delivered weekly.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <button
            onClick={() => setView('customer')}
            className="p-8 bg-white rounded-[32px] border border-slate-200 shadow-sm hover:shadow-lg hover:border-primary/40 transition-all text-left group"
          >
            <div className="size-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-white transition-all">
              <UserCircle className="size-6" />
            </div>
            <h2 className="text-lg font-black text-slate-900 mb-1">Customer App</h2>
            <p className="text-xs text-slate-500 font-medium">Browse this week's menu, order, and track delivery.</p>
          </button>

          <button
            onClick={() => setView('operations')}
            className="p-8 bg-white rounded-[32px] border border-slate-200 shadow-sm hover:shadow-lg hover:border-primary/40 transition-all text-left group"
          >
            <div className="size-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-white transition-all">
              <LayoutGrid className="size-6" />
            </div>
            <h2 className="text-lg font-black text-slate-900 mb-1">Operations</h2>
            <p className="text-xs text-slate-500 font-medium">This week's menu, orders, deliveries, payments, customers.</p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
