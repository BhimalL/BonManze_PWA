import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldAlert, CheckCircle2, XCircle, Search, 
  Filter, History, User, Banknote, Clock, ArrowRight,
  TrendingDown, TrendingUp, AlertTriangle, ShieldCheck,
  MessageSquare, Check, X
} from 'lucide-react';
import { 
  subscribeToDiscrepancies, 
  Discrepancy, 
  approveDiscrepancy, 
  rejectDiscrepancy,
  formatNumber,
  formatCurrency
} from '../store';

const Discrepancies: React.FC = () => {
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [filterStatus, setFilterStatus] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('Pending');
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approvalNote, setApprovalNote] = useState('');

  useEffect(() => {
    return subscribeToDiscrepancies(setDiscrepancies);
  }, []);

  const filtered = useMemo(() => {
    if (filterStatus === 'All') return discrepancies;
    return discrepancies.filter(d => d.status === filterStatus);
  }, [discrepancies, filterStatus]);

  const stats = useMemo(() => {
    return {
       pending: discrepancies.filter(d => d.status === 'Pending').length,
       approved: discrepancies.filter(d => d.status === 'Approved').length,
       totalValue: discrepancies.reduce((acc, d) => acc + Math.abs(d.variance), 0)
    };
  }, [discrepancies]);

  const handleApproveClick = (id: string) => {
     setApprovingId(id);
     setApprovalNote('');
  };

  const submitApproval = () => {
     if (approvingId) {
        approveDiscrepancy(approvingId, approvalNote);
        setApprovingId(null);
        setApprovalNote('');
     }
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 h-full flex flex-col">
      <div className="flex items-end justify-between shrink-0">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Discrepancy Approvals</h1>
          <p className="text-slate-500 font-medium italic">High-risk variance gating protocol v4.0</p>
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
         <StatsCard label="Awaiting Action" value={stats.pending.toString()} icon={<ShieldAlert />} warning={stats.pending > 0} />
         <StatsCard label="Approved Today" value={stats.approved.toString()} icon={<ShieldCheck />} />
         <StatsCard label="Cumulative Risk" value={`Rs ${formatNumber(stats.totalValue)}`} icon={<TrendingDown />} />
      </div>

      <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm flex-1 overflow-hidden flex flex-col min-h-0">
         <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Variance Incident Log</h3>
            <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" /><input className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs w-64 focus:ring-2 focus:ring-primary/20 outline-none" placeholder="Search by ID or user..." /></div>
         </div>
         
         <div className="flex-1 overflow-y-auto custom-scrollbar">
            {filtered.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center opacity-30">
                  <CheckCircle2 className="size-16 mb-4" />
                  <p className="font-black uppercase tracking-widest">Queue Clear</p>
               </div>
            ) : (
               <table className="w-full text-left">
                  <thead className="sticky top-0 bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest z-10 border-b border-slate-100">
                     <tr>
                        <th className="px-8 py-4">Reference</th>
                        <th className="px-6 py-4">Incident Details</th>
                        <th className="px-6 py-4 text-right">Expected</th>
                        <th className="px-6 py-4 text-right">Actual</th>
                        <th className="px-6 py-4 text-right">Variance</th>
                        <th className="px-8 py-4 text-center">Action</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                     {filtered.map(d => (
                        <tr key={d.id} className="hover:bg-slate-50/50 transition-colors group">
                           <td className="px-8 py-5">
                              <p className="text-sm font-black text-slate-900 leading-none mb-1">#{d.id}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(d.timestamp).toLocaleString()}</p>
                           </td>
                           <td className="px-6 py-5">
                              <div className="flex items-center gap-3">
                                 <div className="size-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400"><User className="size-4" /></div>
                                 <div>
                                    <p className="text-xs font-black text-slate-700 leading-none mb-1">{d.user}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{d.type} Audit Point</p>
                                    {d.approvalNote && <p className="text-[9px] text-slate-500 mt-1 italic">Note: {d.approvalNote}</p>}
                                 </div>
                              </div>
                           </td>
                           <td className="px-6 py-5 text-right font-bold text-slate-400 text-sm tabular-nums">Rs {formatNumber(d.expected)}</td>
                           <td className="px-6 py-5 text-right font-bold text-slate-900 text-sm tabular-nums">Rs {formatNumber(d.actual)}</td>
                           <td className={`px-6 py-5 text-right font-black text-sm tabular-nums ${d.variance === 0 ? 'text-success' : 'text-danger'}`}>
                              {d.variance > 0 ? '+' : ''}Rs {formatNumber(d.variance)}
                           </td>
                           <td className="px-8 py-5">
                              {d.status === 'Pending' ? (
                                 <div className="flex justify-center gap-2">
                                    {approvingId === d.id ? (
                                       <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-2 w-full justify-end">
                                          <input 
                                             autoFocus
                                             className="flex-1 min-w-[200px] px-4 py-3 text-xs font-bold border-2 border-slate-200 bg-white text-slate-900 rounded-xl outline-none focus:border-primary placeholder:text-slate-400 transition-all shadow-inner"
                                             placeholder="Type Notes for Discrepancy..."
                                             value={approvalNote}
                                             onChange={(e) => setApprovalNote(e.target.value)}
                                             onKeyDown={(e) => e.key === 'Enter' && submitApproval()}
                                          />
                                          <button onClick={submitApproval} className="size-10 flex items-center justify-center bg-success text-white rounded-lg hover:brightness-110 shadow-lg shadow-success/20 transition-all shrink-0"><Check className="size-5" strokeWidth={3} /></button>
                                          <button onClick={() => setApprovingId(null)} className="size-10 flex items-center justify-center bg-slate-100 text-slate-400 rounded-lg hover:bg-slate-200 transition-all shrink-0"><X className="size-5" /></button>
                                       </div>
                                    ) : (
                                       <div className="flex justify-center gap-2">
                                          <button onClick={() => rejectDiscrepancy(d.id)} className="px-4 py-2 bg-danger/10 text-danger rounded-xl text-[10px] font-black uppercase hover:bg-danger hover:text-white transition-all">Reject</button>
                                          <button onClick={() => handleApproveClick(d.id)} className="px-4 py-2 bg-success text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-success/20 hover:scale-105 active:scale-95 transition-all">Approve</button>
                                       </div>
                                    )}
                                 </div>
                              ) : (
                                 <div className="flex justify-center">
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${d.status === 'Approved' ? 'bg-success/10 text-success' : 'bg-slate-100 text-slate-400'}`}>
                                       {d.status}
                                    </span>
                                 </div>
                              )}
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
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

export default Discrepancies;