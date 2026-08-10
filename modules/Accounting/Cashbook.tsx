
import React from 'react';
import { Wallet, Search, Filter, ArrowRightLeft, ShieldCheck } from 'lucide-react';

const Cashbook: React.FC = () => {
  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Cashbook & Banking</h1>
          <p className="text-slate-500 font-medium">Petty cash management and bank reconciliation</p>
        </div>
        <div className="flex gap-4">
           <div className="bg-white border border-slate-200 p-4 rounded-2xl flex items-center gap-3 shadow-sm">
              <ShieldCheck className="size-6 text-success" />
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Reconciled Until</p>
                <p className="text-sm font-black text-slate-900">Oct 17, 2023</p>
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <BankCard name="Main Operating Account" balance="$242,800.20" bank="Chase Manhattan" active />
        <BankCard name="Petty Cash Reserve" balance="$2,400.00" bank="Internal Vault" />
      </div>

      <div className="bg-white rounded-[40px] border border-slate-200 shadow-xl overflow-hidden flex flex-col h-[450px]">
        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-900">Recent Bank Feeds</h3>
          <button className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20">
            <ArrowRightLeft className="size-4" /> Reconcile Now
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {[...Array(5)].map((_, i) => (
             <div key={i} className="p-6 border-b border-slate-50 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="size-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-black text-xs">BK</div>
                  <div>
                    <p className="text-sm font-black text-slate-900">Transfer from Stripe Logistics</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">External Bank Transaction • ID: 8420</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-success">+$2,400.00</p>
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Matched</p>
                </div>
             </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const BankCard = ({ name, balance, bank, active }: any) => (
  <div className={`p-8 rounded-[32px] border-2 transition-all relative overflow-hidden ${
    active ? 'border-primary bg-white shadow-xl ring-4 ring-primary/5' : 'border-slate-100 bg-white shadow-sm'
  }`}>
    <div className="flex justify-between items-start mb-6">
      <div className={`size-14 rounded-2xl flex items-center justify-center ${active ? 'bg-primary text-white' : 'bg-slate-100 text-slate-400'}`}>
        <Wallet className="size-8" />
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{bank}</span>
    </div>
    <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-1">{name}</h3>
    <p className={`text-3xl font-black ${active ? 'text-primary' : 'text-slate-900'}`}>{balance}</p>
  </div>
);

export default Cashbook;
