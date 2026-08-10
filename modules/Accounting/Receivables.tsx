
import React from 'react';
import { CreditCard, ArrowUpRight, Search, Filter, TrendingUp } from 'lucide-react';

const Receivables: React.FC = () => {
  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Accounts Receivable</h1>
          <p className="text-slate-500 font-medium">Sales ledger, invoicing and payment collections</p>
        </div>
        <div className="bg-primary/5 px-6 py-3 rounded-2xl border border-primary/20 flex items-center gap-4">
           <div>
             <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-1">Total Due</p>
             <p className="text-2xl font-black text-slate-900">$142,500.00</p>
           </div>
           <TrendingUp className="size-8 text-primary opacity-20" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <AgingCard label="Current" amount="$98,400" percentage={69} />
        <AgingCard label="30-60 Days" amount="$32,100" percentage={22} warning />
        <AgingCard label="60+ Days" amount="$12,000" percentage={9} critical />
      </div>

      <div className="bg-white rounded-[40px] border border-slate-200 shadow-xl overflow-hidden flex flex-col h-[500px]">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs" placeholder="Filter by invoice or customer..." />
          </div>
          <button className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400"><Filter className="size-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100">
              <tr>
                <th className="px-8 py-4">Invoice #</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Date Issued</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-8 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              <tr className="hover:bg-slate-50">
                <td className="px-8 py-5 text-sm font-black text-slate-900">INV-9402</td>
                <td className="px-6 py-5 text-sm font-bold text-slate-600">Marcus Sterling</td>
                <td className="px-6 py-5 text-xs text-slate-400 font-bold">Oct 12, 2023</td>
                <td className="px-6 py-5 text-sm font-black text-primary text-right">$420.00</td>
                <td className="px-8 py-5 text-right"><ArrowUpRight className="size-4 ml-auto text-slate-300" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const AgingCard = ({ label, amount, percentage, warning, critical }: any) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">{label}</p>
    <p className={`text-2xl font-black mb-4 ${critical ? 'text-danger' : warning ? 'text-warning' : 'text-slate-900'}`}>{amount}</p>
    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${critical ? 'bg-danger' : warning ? 'bg-warning' : 'bg-primary'}`} style={{ width: `${percentage}%` }}></div>
    </div>
  </div>
);

export default Receivables;
