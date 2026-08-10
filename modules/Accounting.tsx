
import React from 'react';
import { 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownLeft, 
  FileText, 
  PieChart, 
  ShieldCheck,
  Plus
} from 'lucide-react';
import { formatCurrency } from './store';

const Accounting: React.FC = () => {
  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Financial Command Center</h1>
          <p className="text-slate-500 font-medium">Real-time enterprise-wide fiscal overview</p>
        </div>
        <div className="bg-white border border-slate-200 px-6 py-3 rounded-2xl flex items-center gap-4 shadow-sm">
          <p className="text-xs font-black uppercase text-slate-400 tracking-widest">Cash Position</p>
          <span className="text-2xl font-black text-slate-900">{formatCurrency(245800)}</span>
          <span className="flex items-center gap-1 text-success text-xs font-bold bg-success/5 px-2 py-1 rounded-full">
            <TrendingUp className="size-3" /> +12%
          </span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
         <div className="bg-slate-50 rounded-[40px] p-8 border border-slate-200 flex flex-col justify-center items-center text-center opacity-60">
            <FileText className="size-12 mb-4 text-slate-300" />
            <h3 className="text-lg font-black text-slate-400 uppercase tracking-widest">Reports Module</h3>
            <p className="text-xs font-bold text-slate-300 mt-2">Generate P&L, Balance Sheet, and Cash Flow statements.</p>
         </div>
         <div className="bg-slate-50 rounded-[40px] p-8 border border-slate-200 flex flex-col justify-center items-center text-center opacity-60">
            <PieChart className="size-12 mb-4 text-slate-300" />
            <h3 className="text-lg font-black text-slate-400 uppercase tracking-widest">Expense Analysis</h3>
            <p className="text-xs font-bold text-slate-300 mt-2">Visual breakdown of operational costs.</p>
         </div>
      </div>
    </div>
  );
};

export default Accounting;
