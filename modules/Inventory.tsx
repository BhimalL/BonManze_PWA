
import React, { useState } from 'react';
import { 
  Plus, Search, Filter, ArrowUpDown, Upload, MoreVertical, 
  Edit, ArrowRight, Truck, ShoppingCart, AlertTriangle, 
  CalendarCheck, ClipboardList, CheckCircle2, Box, X
} from 'lucide-react';
import { formatCurrency } from './store';

const Inventory: React.FC = () => {
  const [view, setView] = useState<'warehouse' | 'purchasing'>('warehouse');
  const [isAddingNew, setIsAddingNew] = useState(false);

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Inventory Control</h1>
          <p className="text-slate-500 font-medium">Ingredients, Warehousing & Automated Stocking</p>
        </div>
        <div className="flex gap-4">
          <div className="flex bg-white border border-slate-200 p-1.5 rounded-[20px] shadow-sm">
            <button 
              onClick={() => setView('warehouse')}
              className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                view === 'warehouse' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <ClipboardList className="size-4" /> Stock Control
            </button>
            <button 
              onClick={() => setView('purchasing')}
              className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                view === 'purchasing' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <ShoppingCart className="size-4" /> Logistics Hub
            </button>
          </div>
          <button 
            onClick={() => setIsAddingNew(true)}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 hover:brightness-110 transition-all"
          >
            <Plus className="size-5" />
            Create New SKU
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <StatsCard label="Total SKUs" value="1,284" change="+2.4%" active />
        <StatsCard label="Low Stock Alert" value="24" warning />
        <StatsCard label="Critical Outage" value="8" critical />
        <StatsCard label="Inventory Value" value={formatCurrency(245000)} />
      </div>

      {view === 'warehouse' ? (
        <div className="bg-white rounded-[32px] border border-slate-200 shadow-xl overflow-hidden h-[600px] flex flex-col">
          <div className="p-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-6 bg-slate-50/50">
            <div className="flex-1 min-w-[300px] relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400" />
              <input className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium" placeholder="Search by SKU, Name or Category..." />
            </div>
            <div className="flex items-center gap-3">
              <button className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-500 hover:text-primary transition-all"><Filter className="size-5" /></button>
              <button className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-500 hover:text-primary transition-all"><Upload className="size-5" /></button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] border-b border-slate-100 sticky top-0 z-10">
                <tr>
                  <th className="px-8 py-4">Item & SKU</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4 text-right">On Hand</th>
                  <th className="px-6 py-4 text-right">Reserved</th>
                  <th className="px-6 py-4">Health</th>
                  <th className="px-8 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                <InvRow name="Heirloom Tomatoes" sku="VEG-402-TH" category="Produce" onHand="42.5 kg" reserved="5.0 kg" health={75} image="https://picsum.photos/seed/tomato/100/100" />
                <InvRow name="Angus Ribeye 12oz" sku="PRO-118-MT" category="Proteins" onHand="8 Units" reserved="2 Units" health={30} image="https://picsum.photos/seed/ribeye/100/100" low />
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 rounded-[40px] border-4 border-dashed border-slate-200 p-20 text-center flex flex-col items-center animate-in zoom-in-95 duration-300">
           <Truck className="size-16 text-slate-300 mb-6" />
           <h3 className="text-xl font-black text-slate-900 uppercase tracking-widest">Supply Chain Hub</h3>
           <p className="text-sm text-slate-500 max-w-sm mt-4">Manage multi-vendor purchasing, receive goods, and automate replenishment cycles.</p>
        </div>
      )}

      {/* New SKU Modal */}
      {isAddingNew && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[40px] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-primary/5">
              <div className="flex items-center gap-4">
                <div className="size-12 bg-primary text-white rounded-2xl flex items-center justify-center">
                  <Box className="size-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900">Add New Inventory SKU</h2>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Warehouse Management System</p>
                </div>
              </div>
              <button onClick={() => setIsAddingNew(false)} className="p-2 text-slate-400 hover:text-danger"><X className="size-6" /></button>
            </div>
            
            <div className="p-10 space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400">SKU Code</label>
                  <input className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-black text-primary" placeholder="e.g. MEAT-402-NY" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400">Item Name</label>
                  <input className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-black" placeholder="e.g. Prime Rib" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400">Category</label>
                  <select className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold">
                    <option>Proteins</option>
                    <option>Produce</option>
                    <option>Dry Goods</option>
                    <option>Equipment</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400">Unit of Measure</label>
                  <select className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold">
                    <option>Kilograms (kg)</option>
                    <option>Units (pcs)</option>
                    <option>Liters (L)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400">Initial Stock</label>
                  <input type="number" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-black" defaultValue="0" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400">Low Stock Threshold</label>
                  <input type="number" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-warning" defaultValue="10" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400">Current Unit Cost</label>
                  <input type="number" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-primary" defaultValue="0.00" />
                </div>
              </div>
            </div>

            <div className="p-8 bg-slate-50 flex justify-end gap-4 border-t border-slate-100">
               <button onClick={() => setIsAddingNew(false)} className="px-8 py-3 bg-white border border-slate-200 rounded-xl font-black text-xs uppercase text-slate-400">Cancel</button>
               <button className="px-8 py-3 bg-primary text-white rounded-xl font-black text-xs uppercase shadow-lg shadow-primary/20">Register SKU</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatsCard = ({ label, value, change, warning, critical, active }: any) => (
  <div className={`p-6 rounded-3xl border border-slate-200 shadow-sm bg-white ${active ? 'ring-2 ring-primary/20' : ''}`}>
    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">{label}</p>
    <div className="flex items-end justify-between">
      <span className={`text-3xl font-black tracking-tight ${critical ? 'text-danger' : warning ? 'text-warning' : active ? 'text-primary' : 'text-slate-900'}`}>{value}</span>
      {change && <span className="text-xs font-black text-success">{change}</span>}
    </div>
  </div>
);

const InvRow = ({ name, sku, category, onHand, reserved, health, image, low }: any) => (
  <tr className={`hover:bg-slate-50 transition-colors ${low ? 'bg-warning/5' : ''}`}>
    <td className="px-8 py-5 flex items-center gap-4">
      <img src={image} className="size-12 rounded-xl object-cover border border-slate-100" />
      <div>
        <p className="text-sm font-black text-slate-900">{name}</p>
        <p className="text-[10px] font-mono text-slate-400">{sku}</p>
      </div>
    </td>
    <td className="px-6 py-5">
      <span className="px-3 py-1 bg-slate-100 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500">{category}</span>
    </td>
    <td className={`px-6 py-5 text-right font-black text-sm ${low ? 'text-warning' : 'text-slate-900'}`}>{onHand}</td>
    <td className="px-6 py-5 text-right text-xs font-bold text-slate-400">{reserved}</td>
    <td className="px-6 py-5">
      <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${low ? 'bg-warning' : 'bg-primary'}`} style={{ width: `${health}%` }}></div>
      </div>
    </td>
    <td className="px-8 py-5 text-center">
      <button className="p-2 text-slate-300 hover:text-primary"><Edit className="size-5" /></button>
    </td>
  </tr>
);

export default Inventory;
