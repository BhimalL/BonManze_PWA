
import React from 'react';
import { History, Search, Filter, ArrowDownLeft } from 'lucide-react';

const Payables: React.FC = () => {
  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Accounts Payable</h1>
          <p className="text-slate-500 font-medium">Purchase ledger, vendor liabilities and expenditure</p>
        </div>
        <div className="bg-danger/5 px-6 py-3 rounded-2xl border border-danger/20 flex items-center gap-4 text-right">
           <div>
             <p className="text-[10px] font-black uppercase text-danger tracking-widest mb-1">Total Liability</p>
             <p className="text-2xl font-black text-slate-900">$84,200.00</p>
           </div>
           <ArrowDownLeft className="size-8 text-danger opacity-20" />
        </div>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-200 shadow-xl overflow-hidden h-[600px] flex flex-col">
         <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
           <div className="relative flex-1 max-w-sm">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
             <input className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs" placeholder="Search vendors or bills..." />
           </div>
           <button className="flex items-center gap-2 px-6 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest">New Bill</button>
         </div>
         <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100">
                <tr>
                  <th className="px-8 py-4">Reference</th>
                  <th className="px-6 py-4">Vendor</th>
                  <th className="px-6 py-4">Due Date</th>
                  <th className="px-6 py-4 text-right">Outstanding</th>
                  <th className="px-8 py-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                <tr className="hover:bg-slate-50">
                  <td className="px-8 py-5 text-sm font-black text-slate-900">BILL-4201</td>
                  <td className="px-6 py-5 text-sm font-bold text-slate-600">Global Meats Co.</td>
                  <td className="px-6 py-5 text-xs text-danger font-black">OVERDUE</td>
                  <td className="px-6 py-5 text-sm font-black text-slate-900 text-right">$4,820.00</td>
                  <td className="px-8 py-5 text-right"><span className="px-2 py-0.5 bg-danger/10 text-danger text-[10px] font-black rounded uppercase">Immediate</span></td>
                </tr>
              </tbody>
            </table>
         </div>
      </div>
    </div>
  );
};

export default Payables;
