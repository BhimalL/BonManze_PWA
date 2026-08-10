
import React, { useState } from 'react';
import { 
  ShoppingCart, Plus, Search, Truck, Clock, 
  CheckCircle2, AlertCircle, Package, Receipt, ArrowRight, X
} from 'lucide-react';

const PurchaseOrdering: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'orders' | 'receiving'>('orders');

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Purchase Logistics</h1>
          <p className="text-slate-500 font-medium">Issue Purchase Orders & Process Receiving (GRNI)</p>
        </div>
        <div className="flex gap-4">
          <div className="flex bg-white border border-slate-200 p-1.5 rounded-2xl shadow-sm">
            <button 
              onClick={() => setActiveTab('orders')}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === 'orders' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Purchase Orders
            </button>
            <button 
              onClick={() => setActiveTab('receiving')}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === 'receiving' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Receiving (GRNI)
            </button>
          </div>
          <button className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 hover:brightness-110 transition-all">
            <Plus className="size-5" /> New Order
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-8 bg-white rounded-[40px] border border-slate-200 shadow-xl overflow-hidden flex flex-col h-[600px]">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
             <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <input className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs" placeholder="Search POs or Vendors..." />
             </div>
             <div className="flex gap-3 text-xs font-black text-slate-400">
                <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-slate-300"></span> Draft</span>
                <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-primary"></span> Sent</span>
                <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-success"></span> Received</span>
             </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100">
                <tr>
                  <th className="px-8 py-4">PO Reference</th>
                  <th className="px-6 py-4">Vendor</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Delivery Est.</th>
                  <th className="px-8 py-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                <PORow id="PO-8420" vendor="Global Meats Co." amount="$2,450.00" date="Oct 18, 2023" status="Sent" />
                <PORow id="PO-8421" vendor="NYC Fresh Produce" amount="$820.50" date="Oct 18, 2023" status="Received" />
                <PORow id="PO-8422" vendor="Vinery Logistics" amount="$1,100.00" date="Oct 20, 2023" status="Draft" />
              </tbody>
            </table>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-6">
           <div className="bg-slate-900 rounded-[40px] p-8 text-white shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 size-32 bg-white/10 rounded-bl-full"></div>
              <h3 className="text-xl font-black mb-1">Stock Impact</h3>
              <p className="text-xs text-white/50 font-bold uppercase tracking-widest mb-8">Receiving Dashboard</p>
              
              <div className="space-y-6">
                <ImpactItem label="Total Goods Not Invoiced" value="$12,840" icon={<Receipt />} />
                <ImpactItem label="Pending SKUs" value="42 Items" icon={<Package />} />
              </div>
           </div>

           <div className="bg-white rounded-[40px] border border-slate-200 p-8 shadow-sm">
              <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-6">Vendor Performance</h4>
              <div className="space-y-4">
                 <VendorPerformance name="Global Meats" score={98} />
                 <VendorPerformance name="NYC Fresh" score={85} />
                 <VendorPerformance name="Vinery" score={92} />
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

const PORow = ({ id, vendor, amount, date, status }: any) => (
  <tr className="hover:bg-slate-50 transition-colors group cursor-pointer">
    <td className="px-8 py-5">
      <p className="text-sm font-black text-slate-900">{id}</p>
      <p className="text-[10px] text-slate-400 font-bold">Standard Purchase</p>
    </td>
    <td className="px-6 py-5 text-sm font-bold text-slate-700">{vendor}</td>
    <td className="px-6 py-5 text-sm font-black text-slate-900">{amount}</td>
    <td className="px-6 py-5 text-xs font-bold text-slate-400">{date}</td>
    <td className="px-8 py-5 text-center">
      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
        status === 'Sent' ? 'bg-primary text-white' : status === 'Received' ? 'bg-success text-white' : 'bg-slate-100 text-slate-500'
      }`}>
        {status}
      </span>
    </td>
  </tr>
);

const ImpactItem = ({ label, value, icon }: any) => (
  <div className="flex items-center gap-4">
    <div className="size-12 rounded-2xl bg-white/10 flex items-center justify-center">
      {React.cloneElement(icon, { className: 'size-6' })}
    </div>
    <div>
      <p className="text-[10px] font-black uppercase text-white/40 tracking-widest mb-1">{label}</p>
      <p className="text-xl font-black text-white">{value}</p>
    </div>
  </div>
);

const VendorPerformance = ({ name, score }: any) => (
  <div className="space-y-1.5">
    <div className="flex justify-between text-[10px] font-black uppercase text-slate-400">
      <span>{name}</span>
      <span className="text-primary">{score}%</span>
    </div>
    <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
      <div className="h-full bg-primary" style={{ width: `${score}%` }}></div>
    </div>
  </div>
);

export default PurchaseOrdering;
