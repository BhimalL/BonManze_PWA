
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Percent, CheckCircle2, XCircle, Search, 
  Filter, Check, X, AlertCircle, Clock
} from 'lucide-react';
import { 
  subscribeToDiscountRequests, 
  DiscountRequest, 
  resolveDiscountRequest, 
  formatCurrency 
} from '../store';

const DiscountApprovals: React.FC = () => {
  const [requests, setRequests] = useState<DiscountRequest[]>([]);
  const [filterStatus, setFilterStatus] = useState<'Pending' | 'Approved' | 'Rejected' | 'All'>('Pending');

  useEffect(() => {
    return subscribeToDiscountRequests(setRequests);
  }, []);

  const filtered = useMemo(() => {
    if (filterStatus === 'All') return requests;
    return requests.filter(r => r.status === filterStatus);
  }, [requests, filterStatus]);

  const stats = useMemo(() => ({
    pending: requests.filter(r => r.status === 'Pending').length,
    approvedToday: requests.filter(r => r.status === 'Approved').length, // In real app, filter by date
    totalValue: requests.filter(r => r.status === 'Approved').reduce((acc, r) => acc + r.calculatedDiscount, 0)
  }), [requests]);

  const handleResolve = (id: string, approved: boolean) => {
    resolveDiscountRequest(id, approved);
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 h-full flex flex-col">
      <div className="flex items-end justify-between shrink-0">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Discount Approvals</h1>
          <p className="text-slate-500 font-medium italic">Manager override console</p>
        </div>
        <div className="flex gap-4">
           <div className="bg-white border border-slate-200 p-1.5 rounded-2xl shadow-sm flex">
              {(['Pending', 'Approved', 'Rejected', 'All'] as const).map(s => (
                 <button 
                    key={s} 
                    onClick={() => setFilterStatus(s)}
                    className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterStatus === s ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                 >
                    {s}
                 </button>
              ))}
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
         <StatsCard label="Pending Requests" value={stats.pending.toString()} icon={<Clock />} warning={stats.pending > 0} />
         <StatsCard label="Approved (Session)" value={stats.approvedToday.toString()} icon={<CheckCircle2 />} />
         <StatsCard label="Total Discounted" value={formatCurrency(stats.totalValue)} icon={<Percent />} />
      </div>

      <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm flex-1 overflow-hidden flex flex-col min-h-0">
         <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Request Queue</h3>
            <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" /><input className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs w-64 focus:ring-2 focus:ring-primary/20 outline-none" placeholder="Search customer..." /></div>
         </div>
         
         <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            {filtered.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center opacity-30">
                  <CheckCircle2 className="size-16 mb-4" />
                  <p className="font-black uppercase tracking-widest">No Requests Found</p>
               </div>
            ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filtered.map(req => (
                     <div key={req.id} className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-sm hover:shadow-md transition-all group">
                        <div className="flex justify-between items-start mb-6">
                           <div>
                              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Order #{req.orderId}</p>
                              <h4 className="text-lg font-black text-slate-900">{req.customerName}</h4>
                           </div>
                           <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                              req.status === 'Pending' ? 'bg-warning/10 text-warning' : 
                              req.status === 'Approved' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                           }`}>
                              {req.status}
                           </span>
                        </div>

                        <div className="space-y-4 mb-6">
                           <div className="flex justify-between text-xs font-bold text-slate-500">
                              <span>Original Total</span>
                              <span>{formatCurrency(req.originalTotal)}</span>
                           </div>
                           <div className="flex justify-between text-xs font-black text-slate-900 bg-slate-50 p-3 rounded-xl">
                              <span>Requested Discount</span>
                              <span className="text-danger">-{formatCurrency(req.calculatedDiscount)}</span>
                           </div>
                           <div className="flex justify-between text-sm font-black text-primary border-t border-slate-100 pt-3">
                              <span>New Total</span>
                              <span>{formatCurrency(req.finalTotal)}</span>
                           </div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-2xl mb-6">
                           <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Reason</p>
                           <p className="text-xs font-medium text-slate-700 italic">"{req.reason}"</p>
                           <p className="text-[9px] font-bold text-slate-400 mt-2 text-right">- Requested by {req.requestedBy}</p>
                        </div>

                        {req.status === 'Pending' && (
                           <div className="flex gap-3">
                              <button onClick={() => handleResolve(req.id, false)} className="flex-1 py-3 bg-white border border-slate-200 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 hover:text-danger transition-all">Reject</button>
                              <button onClick={() => handleResolve(req.id, true)} className="flex-1 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg">Approve</button>
                           </div>
                        )}
                     </div>
                  ))}
               </div>
            )}
         </div>
      </div>
    </div>
  );
};

const StatsCard = ({ label, value, icon, warning }: any) => (
   <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex items-center gap-4">
      <div className={`size-12 rounded-2xl flex items-center justify-center ${warning ? 'bg-danger/10 text-danger' : 'bg-slate-50 text-slate-400'}`}>
         {React.cloneElement(icon, { className: 'size-6' })}
      </div>
      <div>
         <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">{label}</p>
         <p className="text-2xl font-black text-slate-900 tracking-tight leading-none tabular-nums">{value}</p>
      </div>
   </div>
);

export default DiscountApprovals;
