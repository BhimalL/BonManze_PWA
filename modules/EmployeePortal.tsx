
import React from 'react';
import { 
  Briefcase, 
  Calendar, 
  Clock, 
  TrendingUp, 
  Award, 
  MessageSquare, 
  FileText,
  ChevronRight,
  UserCheck
} from 'lucide-react';

const EmployeePortal: React.FC = () => {
  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Employee Center</h1>
          <p className="text-slate-500 font-medium">Midtown Branch • Staff View</p>
        </div>
        <div className="bg-success/10 px-6 py-3 rounded-2xl flex items-center gap-3 border border-success/20">
          <UserCheck className="size-6 text-success" />
          <div>
            <p className="text-[10px] font-black uppercase text-success tracking-widest leading-none mb-1">Status</p>
            <p className="text-sm font-black text-slate-900">Shift Started: 08:30 AM</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Left Column: Schedule & Performance */}
        <div className="col-span-12 lg:col-span-8 space-y-8">
          <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Shift Schedule</h3>
              <div className="flex gap-2">
                <button className="px-4 py-2 bg-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600">This Week</button>
                <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-primary transition-all">Next Week</button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ShiftItem day="Today" date="Oct 12" time="08:30 AM - 04:30 PM" role="Manager" active />
              <ShiftItem day="Tomorrow" date="Oct 13" time="12:00 PM - 08:00 PM" role="Manager" />
              <ShiftItem day="Saturday" date="Oct 14" time="Off" role="-" />
              <ShiftItem day="Sunday" date="Oct 15" time="10:00 AM - 06:00 PM" role="Floor Lead" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
              <h3 className="text-xl font-black text-slate-900 tracking-tight mb-6">Service Metrics</h3>
              <div className="space-y-6">
                <MetricBar label="Table Turn Rate" val="42m avg" progress={85} />
                <MetricBar label="Customer Rating" val="4.9/5" progress={98} />
                <MetricBar label="Upsell Conversion" val="12%" progress={60} />
              </div>
            </div>
            <div className="bg-primary p-8 rounded-3xl text-white shadow-xl shadow-primary/20 flex flex-col justify-between">
              <div>
                <Award className="size-10 mb-4 opacity-50" />
                <h3 className="text-2xl font-black leading-tight">October MVP</h3>
                <p className="text-white/70 font-medium mt-1">Outstanding Service & Lead Leadership</p>
              </div>
              <div className="flex items-center gap-3 mt-8">
                <div className="size-10 bg-white/20 rounded-full flex items-center justify-center font-black">AS</div>
                <p className="text-sm font-bold uppercase tracking-widest">Alex Sterling</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: News & Resources */}
        <div className="col-span-12 lg:col-span-4 space-y-8">
          <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
            <h3 className="text-xl font-black text-slate-900 tracking-tight mb-6">Internal Announcements</h3>
            <div className="space-y-6">
              <NewsItem 
                title="New Health Protocols" 
                desc="Please review the updated sanitization schedule in the staff room." 
                time="2h ago"
              />
              <NewsItem 
                title="Holiday Service Slots" 
                desc="Thanksgiving shift bidding is now open in the Planner module." 
                time="1d ago"
              />
              <NewsItem 
                title="Menu Refresh: Q4" 
                desc="New winter items added to the digital menu. Review ingredients." 
                time="3d ago"
              />
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
            <h3 className="text-xl font-black text-slate-900 tracking-tight mb-6">Resources</h3>
            <div className="space-y-3">
              <ResourceLink icon={<FileText />} label="Employee Handbook" />
              <ResourceLink icon={<MessageSquare />} label="Support Chat" />
              <ResourceLink icon={<TrendingUp />} label="Career Pathing" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ShiftItem = ({ day, date, time, role, active }: any) => (
  <div className={`p-4 rounded-2xl border transition-all ${
    active ? 'bg-primary/5 border-primary/20' : 'bg-slate-50 border-transparent hover:bg-slate-100'
  }`}>
    <div className="flex justify-between items-start mb-2">
      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{day}, {date}</p>
      {active && <span className="size-2 rounded-full bg-success"></span>}
    </div>
    <p className="text-sm font-black text-slate-900">{time}</p>
    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{role}</p>
  </div>
);

const MetricBar = ({ label, val, progress }: any) => (
  <div className="space-y-2">
    <div className="flex justify-between text-xs font-bold text-slate-600">
      <span>{label}</span>
      <span>{val}</span>
    </div>
    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
      <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: `${progress}%` }}></div>
    </div>
  </div>
);

const NewsItem = ({ title, desc, time }: any) => (
  <div className="group cursor-pointer">
    <div className="flex justify-between items-center mb-1">
      <h4 className="text-sm font-black text-slate-900 group-hover:text-primary transition-colors">{title}</h4>
      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{time}</span>
    </div>
    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{desc}</p>
  </div>
);

// Fixed: Removed problematic React.ReactElement cast to allow className property in cloneElement
const ResourceLink = ({ icon, label }: any) => (
  <button className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-2xl hover:bg-primary/5 group transition-all">
    <div className="flex items-center gap-4">
      <div className="text-slate-400 group-hover:text-primary transition-colors">
        {React.cloneElement(icon, { className: 'size-5' })}
      </div>
      <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">{label}</span>
    </div>
    <ChevronRight className="size-4 text-slate-300 group-hover:text-primary transition-all" />
  </button>
);

export default EmployeePortal;
