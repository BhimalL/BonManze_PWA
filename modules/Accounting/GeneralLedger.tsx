
import React from 'react';
import { Book, Search, Filter, Plus } from 'lucide-react';

const GeneralLedger: React.FC = () => {
  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">General Ledger</h1>
          <p className="text-slate-500 font-medium">Double-entry bookkeeping and audit trails</p>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">
          <Plus className="size-4" /> New Journal
        </button>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-200 shadow-xl overflow-hidden h-[600px] flex flex-col">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
           <h3 className="text-sm font-black uppercase text-slate-900 tracking-widest">Transaction History</h3>
           <div className="flex gap-2">
              <button className="px-4 py-2 border border-slate-200 rounded-xl text-[10px] font-black uppercase text-slate-400">Export PDF</button>
              <button className="px-4 py-2 border border-slate-200 rounded-xl text-[10px] font-black uppercase text-slate-400">Filters</button>
           </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] border-b border-slate-100 sticky top-0">
              <tr>
                <th className="px-8 py-4">Transaction ID</th>
                <th className="px-6 py-4">Account</th>
                <th className="px-6 py-4 text-right">Debit</th>
                <th className="px-6 py-4 text-right">Credit</th>
                <th className="px-8 py-4 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {[...Array(10)].map((_, i) => (
                <tr key={i} className="hover:bg-slate-50 text-sm">
                  <td className="px-8 py-5 text-slate-400 font-bold">TX-1049{i}</td>
                  <td className="px-6 py-5 font-black text-slate-900">1001-00 · Operating Bank</td>
                  <td className="px-6 py-5 text-right font-bold text-success">$1,240.00</td>
                  <td className="px-6 py-5 text-right font-bold text-slate-400">-</td>
                  <td className="px-8 py-5 text-right font-black">$242,800.00</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default GeneralLedger;
