import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Users, 
  Truck, 
  DollarSign, 
  ArrowRight,
  Zap,
  Activity,
  Sparkles,
  BrainCircuit,
  Info,
  BarChart3
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { formatCurrency, subscribeToConfig, SYSTEM_CONFIG } from './store';

const data = [
  { name: 'Mon', revenue: 32000, previous: 28000 },
  { name: 'Tue', revenue: 38000, previous: 31000 },
  { name: 'Wed', revenue: 35000, previous: 32000 },
  { name: 'Thu', revenue: 42000, previous: 35000 },
  { name: 'Fri', revenue: 45000, previous: 40000 },
  { name: 'Sat', revenue: 52000, previous: 45000 },
  { name: 'Sun', revenue: 48000, previous: 42000 },
];

const Dashboard: React.FC = () => {
  const [currency, setCurrency] = useState(SYSTEM_CONFIG.currencySymbol);

  useEffect(() => {
    return subscribeToConfig(() => setCurrency(SYSTEM_CONFIG.currencySymbol));
  }, []);

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          label="Total Revenue (Daily)" 
          value={formatCurrency(42500)}
          change="+12.4%" 
          positive 
          icon={<DollarSign className="size-5" />} 
          progress={78}
        />
        <MetricCard 
          label="Active Tables" 
          value="24" 
          subValue="/ 30" 
          icon={<Users className="size-5" />} 
          progress={80}
        />
        <MetricCard 
          label="Pending Deliveries" 
          value="18" 
          change="High Load" 
          icon={<Truck className="size-5" />} 
          progress={90}
          warning
        />
        <MetricCard 
          label="Intelligence Pulse" 
          value="Active" 
          change="Live Sync" 
          positive 
          icon={<BrainCircuit className="size-5" />} 
          progress={100}
        />
      </div>

      {/* AI Intelligence Alert Banner */}
      <div className="relative group overflow-hidden bg-slate-900 rounded-[32px] p-8 flex flex-col md:flex-row items-center justify-between gap-8 border border-white/5 shadow-2xl">
        <div className="absolute top-0 right-0 size-96 bg-primary/20 rounded-full blur-[120px] -mr-32 -mt-32 opacity-50 group-hover:opacity-100 transition-opacity"></div>
        <div className="absolute bottom-0 left-0 size-64 bg-accent/10 rounded-full blur-[80px] -ml-24 -mb-24 opacity-30"></div>

        <div className="flex items-center gap-6 relative z-10">
          <div className="size-16 rounded-3xl bg-primary flex items-center justify-center text-white shrink-0 shadow-2xl shadow-primary/40 ring-4 ring-white/5 relative">
            <Zap className="size-8" />
            <div className="absolute -top-1 -right-1 size-4 bg-success rounded-full border-2 border-slate-900 animate-pulse"></div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1.5">
               <span className="flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-full text-[10px] font-black text-primary uppercase tracking-widest backdrop-blur-md">
                 <Sparkles className="size-3" /> Intelligence Core Anomaly
               </span>
               <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">Detector: Procurement Guard</span>
            </div>
            <h4 className="font-black text-white text-2xl leading-tight tracking-tight">Critical Food Cost Deviation</h4>
            <p className="text-sm text-slate-400 mt-1 max-w-xl">
              Market prices for <span className="font-bold text-white underline decoration-primary decoration-2 underline-offset-4">'Prime Rib'</span> have surged <span className="text-danger font-black">15%</span>. 
              Gemini projects a <span className="text-white font-bold">{formatCurrency(2400)}</span> weekly margin erosion based on current menu demand.
            </p>
          </div>
        </div>
        
        <div className="flex gap-4 shrink-0 relative z-10">
          <button className="px-8 py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:scale-105 transition-all flex items-center gap-2">
            <BarChart3 className="size-4" /> Analyze Impact
          </button>
          <button className="px-6 py-4 bg-white/5 border border-white/10 text-white/60 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all">
            Dismiss
          </button>
        </div>
      </div>

      {/* Charts & Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col min-h-[500px]">
          <div className="flex justify-between items-start mb-10 shrink-0">
            <div>
              <h3 className="text-xl font-extrabold tracking-tight">Weekly Performance</h3>
              <p className="text-sm text-slate-500">Revenue trends compared to previous 7 days</p>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="size-3 rounded-full bg-primary"></span>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Current</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-3 rounded-full bg-slate-200"></span>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Previous</span>
              </div>
            </div>
          </div>
          
          <div className="flex-1 w-full h-[400px] min-h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0f756f" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#0f756f" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 700, fill: '#64748b'}} dy={15} />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  labelStyle={{ fontWeight: 800, color: '#0f756f' }}
                  formatter={(value: number) => [`${currency} ${(value || 0).toLocaleString()}`, 'Revenue']}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#0f756f" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorRevenue)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="previous" 
                  stroke="#e2e8f0" 
                  strokeWidth={2}
                  fillOpacity={0} 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col h-[500px]">
          <h3 className="text-xl font-extrabold tracking-tight mb-1 shrink-0">High-Margin Items</h3>
          <p className="text-sm text-slate-500 mb-8 shrink-0">Top performing items by volume & margin</p>
          
          <div className="flex-1 space-y-6 overflow-y-auto custom-scrollbar">
            <MarginItem label="Prime Ribeye" orders={420} progress={85} />
            <MarginItem label="Atlantic Salmon" orders={312} progress={65} />
            <MarginItem label="Truffle Pasta" orders={285} progress={58} />
            <MarginItem label="Wagyu Burger" orders={240} progress={45} />
            <MarginItem label="Caesar Salad" orders={210} progress={38} />
          </div>

          <button className="mt-8 text-primary font-bold text-sm flex items-center justify-center gap-1 hover:underline shrink-0">
            View Detailed Inventory <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

const MetricCard = ({ label, value, subValue, change, positive, warning, icon, progress }: any) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex justify-between items-start mb-4">
      <div className="p-2 rounded-xl bg-primary/10 text-primary">
        {icon}
      </div>
      {change && (
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
          warning ? 'bg-danger/10 text-danger' : positive ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'
        }`}>
          {change}
        </span>
      )}
    </div>
    <p className="text-slate-500 text-sm font-medium">{label}</p>
    <h3 className="text-2xl font-black mt-1 text-slate-900 tracking-tight">
      {value} <span className="text-sm font-medium text-slate-400">{subValue}</span>
    </h3>
    <div className="mt-4 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
      <div 
        className={`h-full transition-all duration-1000 ${warning ? 'bg-danger' : 'bg-primary'}`} 
        style={{ width: `${progress}%` }}
      ></div>
    </div>
  </div>
);

const MarginItem = ({ label, orders, progress }: any) => (
  <div className="space-y-2">
    <div className="flex justify-between text-sm">
      <span className="font-bold text-slate-700">{label}</span>
      <span className="text-slate-400 font-medium">{orders} orders</span>
    </div>
    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
      <div className="h-full bg-primary rounded-full" style={{ width: `${progress}%` }}></div>
    </div>
  </div>
);

export default Dashboard;