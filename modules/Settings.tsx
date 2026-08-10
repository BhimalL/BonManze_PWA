
import React, { useState, useEffect } from 'react';
import { 
  Save, Globe, CreditCard, Palette, MessageSquare, 
  Shield, Smartphone, Database, Plus, Trash2, Power, 
  Check, Upload, Calendar, Clock, Layout, Type, 
  Moon, Sun, Monitor, Facebook, Mail, MessageCircle,
  AlertTriangle, X, Edit2, CheckCircle2, ChevronRight,
  Zap, BellRing, Settings2, Sparkles, Receipt, Percent
} from 'lucide-react';
import { SYSTEM_CONFIG, updateSystemConfig, PAYMENT_METHODS, updatePaymentMethods, subscribeToPaymentMethods, subscribeToConfig } from './store';
import { PaymentMethod } from '../types';

const THEMES = [
  { id: 'emerald', name: 'Emerald Forest', color: 'bg-[#0f756f]' },
  { id: 'midnight', name: 'Midnight Bistro', color: 'bg-[#1e293b]' },
  { id: 'royal', name: 'Royal Velvet', color: 'bg-[#4c1d95]' },
  { id: 'oceanic', name: 'Oceanic Blue', color: 'bg-[#0ea5e9]' },
  { id: 'rust', name: 'Rust & Iron', color: 'bg-[#c2410c]' },
];

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [activeTheme, setActiveTheme] = useState('emerald');
  const [uiDensity, setUiDensity] = useState<'comfort' | 'compact'>('comfort');
  const [uiMode, setUiMode] = useState<'light' | 'dark' | 'auto'>('light');

  // Meal Plan Configuration State
  const [localServices, setLocalServices] = useState<string[]>([]);
  const [localDays, setLocalDays] = useState<string[]>([]);
  const [localCutoffTime, setLocalCutoffTime] = useState('14:00');
  const [localDeadlinePolicy, setLocalDeadlinePolicy] = useState('1 Day Before');
  const [localCurrency, setLocalCurrency] = useState('Rs');
  
  // Tax Configuration State
  const [localVatEnabled, setLocalVatEnabled] = useState(true);
  const [localVatRate, setLocalVatRate] = useState(15);
  const [localVatNumber, setLocalVatNumber] = useState('');

  // Bulk Discount Configuration State
  const [localBulkDiscountEnabled, setLocalBulkDiscountEnabled] = useState(false);
  const [localBulkDiscountRate, setLocalBulkDiscountRate] = useState(10);

  // Initialize from store
  useEffect(() => {
    const unsubConfig = subscribeToConfig(() => {
       setLocalServices([...SYSTEM_CONFIG.activeServices]);
       setLocalDays([...SYSTEM_CONFIG.operatingDays]);
       setLocalCutoffTime(SYSTEM_CONFIG.cutoffTime);
       setLocalDeadlinePolicy(SYSTEM_CONFIG.deadlinePolicy);
       setLocalCurrency(SYSTEM_CONFIG.currencySymbol);
       setLocalVatEnabled(SYSTEM_CONFIG.vatEnabled);
       setLocalVatRate(SYSTEM_CONFIG.vatRate);
       setLocalVatNumber(SYSTEM_CONFIG.vatNumber);
       setLocalBulkDiscountEnabled(SYSTEM_CONFIG.bulkDiscountEnabled);
       setLocalBulkDiscountRate(SYSTEM_CONFIG.bulkDiscountRate);
    });
    
    const unsubPayment = subscribeToPaymentMethods(setPaymentMethods);
    
    return () => { unsubConfig(); unsubPayment(); };
  }, []);

  // Modal State for Payments
  const [isMethodModalOpen, setIsMethodModalOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('Cash');
  const [formApplicable, setFormApplicable] = useState<string[]>([]);

  // --- ACTIONS ---

  const handleGlobalSave = () => {
    updateSystemConfig({
      activeServices: localServices,
      operatingDays: localDays,
      cutoffTime: localCutoffTime,
      deadlinePolicy: localDeadlinePolicy,
      currencySymbol: localCurrency,
      vatEnabled: localVatEnabled,
      vatRate: localVatRate,
      vatNumber: localVatNumber,
      bulkDiscountEnabled: localBulkDiscountEnabled,
      bulkDiscountRate: localBulkDiscountRate
    });
    updatePaymentMethods(paymentMethods);
    alert("System Settings Saved Successfully!");
  };

  const toggleService = (service: string) => {
    if (localServices.includes(service)) {
      setLocalServices(prev => prev.filter(s => s !== service));
    } else {
      setLocalServices(prev => [...prev, service]);
    }
  };

  const toggleDay = (dayName: string) => {
    const fullDayName = {
      'Mon': 'Monday', 'Tue': 'Tuesday', 'Wed': 'Wednesday', 'Thu': 'Thursday', 
      'Fri': 'Friday', 'Sat': 'Saturday', 'Sun': 'Sunday'
    }[dayName] || dayName;

    if (localDays.includes(fullDayName)) {
      setLocalDays(prev => prev.filter(d => d !== fullDayName));
    } else {
      setLocalDays(prev => [...prev, fullDayName]);
    }
  };

  const togglePayment = (id: string) => {
    setPaymentMethods(prev => prev.map(m => m.id === id ? { ...m, isActive: !m.isActive } : m));
  };

  const openAddMethod = () => {
    setEditingMethod(null);
    setFormName('');
    setFormType('Cash');
    setFormApplicable(['Dine-In', 'Takeout', 'Delivery']);
    setIsMethodModalOpen(true);
  };

  const openEditMethod = (method: PaymentMethod) => {
    setEditingMethod(method);
    setFormName(method.name);
    setFormType(method.type);
    setFormApplicable(method.applicableTo);
    setIsMethodModalOpen(true);
  };

  const toggleApplicable = (type: string) => {
    setFormApplicable(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  };

  const handleSaveMethod = () => {
    if (!formName) return;
    if (editingMethod) {
      setPaymentMethods(prev => prev.map(m => m.id === editingMethod.id ? { 
        ...m, name: formName, type: formType as any, icon: getIconForType(formType), applicableTo: formApplicable as any
      } : m));
    } else {
      setPaymentMethods([...paymentMethods, {
        id: Math.random().toString(36).substr(2, 9), name: formName, type: formType as any, isActive: true, icon: getIconForType(formType), applicableTo: formApplicable as any
      }]);
    }
    setIsMethodModalOpen(false);
  };

  const handleDeleteMethod = (id: string) => {
    if (confirm('Are you sure you want to remove this payment method?')) {
      setPaymentMethods(prev => prev.filter(m => m.id !== id));
      setIsMethodModalOpen(false);
    }
  };

  const getIconForType = (type: string) => {
    switch(type) {
      case 'Cash': return '💵';
      case 'Card': return '💳';
      case 'Digital': return '📱';
      case 'Voucher': return '🎫';
      default: return '💰';
    }
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 relative">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">System Settings</h1>
          <p className="text-slate-500 font-medium">Enterprise Configuration & Preferences</p>
        </div>
        <button 
          onClick={handleGlobalSave}
          className="flex items-center gap-2 px-8 py-3 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 hover:brightness-110 transition-all"
        >
          <Save className="size-5" />
          Save Changes
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <aside className="lg:col-span-1 space-y-2">
          <SidebarGroup title="Core">
            <SidebarItem icon={<Globe className="size-5" />} label="General" active={activeTab === 'general'} onClick={() => setActiveTab('general')} />
            <SidebarItem icon={<CreditCard className="size-5" />} label="Payment Methods" active={activeTab === 'payments'} onClick={() => setActiveTab('payments')} />
            <SidebarItem icon={<Calendar className="size-5" />} label="Meal Plans" active={activeTab === 'mealplans'} onClick={() => setActiveTab('mealplans')} />
          </SidebarGroup>
          <SidebarGroup title="Customization">
            <SidebarItem icon={<Palette className="size-5" />} label="Appearance" active={activeTab === 'appearance'} onClick={() => setActiveTab('appearance')} />
            <SidebarItem icon={<MessageSquare className="size-5" />} label="Communications" active={activeTab === 'comms'} onClick={() => setActiveTab('comms')} />
          </SidebarGroup>
          <SidebarGroup title="System">
            <SidebarItem icon={<Shield className="size-5" />} label="Security & Roles" active={activeTab === 'security'} onClick={() => setActiveTab('security')} />
            <SidebarItem icon={<Smartphone className="size-5" />} label="Mobile & POS" active={activeTab === 'mobile'} onClick={() => setActiveTab('mobile')} />
            <SidebarItem icon={<Database className="size-5" />} label="Data & Backup" active={activeTab === 'data'} onClick={() => setActiveTab('data')} />
          </SidebarGroup>
        </aside>

        <main className="lg:col-span-3 space-y-8">
          
          {activeTab === 'general' && (
            <div className="bg-white rounded-[32px] border border-slate-200 p-10 shadow-sm space-y-10 animate-in slide-in-from-right-4 duration-300">
              <SectionHeader title="Store Profile" subtitle="Basic identity and contact information for this branch." />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <InputGroup label="Restaurant Name" defaultValue="BonManzE Mauritius" />
                <InputGroup label="Legal Entity Name" defaultValue="BonManzE Holdings Ltd" />
                <InputGroup label="Primary Contact Email" defaultValue="manager.ebene@bonmanze.mu" icon={<Mail className="size-4" />} />
                <InputGroup label="Phone Number" defaultValue="+230 404 1234" />
              </div>
              <div className="pt-8 border-t border-slate-100 space-y-6">
                <SectionHeader title="Location" subtitle="Physical address used for delivery radius and invoices." />
                <div className="space-y-2"><label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] block ml-1">Physical Address</label><textarea className="w-full p-6 bg-slate-50 border border-slate-200 rounded-[24px] font-bold text-slate-700 min-h-[120px] focus:ring-4 focus:ring-primary/5 outline-none transition-all resize-none" defaultValue="Level 4, The Catalyst&#10;Silicon Avenue, Ebene Cybercity&#10;Mauritius" /></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] block ml-1 text-slate-400">Currency Symbol</label>
                    <input 
                      type="text" 
                      value={localCurrency}
                      onChange={(e) => setLocalCurrency(e.target.value)}
                      className="w-full px-6 py-4 rounded-[20px] font-bold outline-none transition-all bg-slate-50 border border-slate-200 text-slate-700 focus:ring-4 focus:ring-primary/5 hover:bg-white" 
                    />
                  </div>
                </div>
              </div>
              <div className="pt-8 border-t border-slate-100 space-y-6">
                <SectionHeader title="Tax Configuration" subtitle="Manage VAT registration and applicable rates." />
                <div className="flex flex-col md:flex-row gap-8">
                   <div className="flex-1 space-y-6">
                      <ToggleCard 
                        label="VAT Registered" 
                        sub={localVatEnabled ? "Tax applied to all transactions" : "Tax calculations disabled"} 
                        active={localVatEnabled} 
                        onClick={() => setLocalVatEnabled(!localVatEnabled)} 
                        icon={<Receipt />}
                      />
                   </div>
                   {localVatEnabled && (
                      <div className="flex-1 grid grid-cols-2 gap-6 animate-in fade-in slide-in-from-left-4">
                         <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] block ml-1 text-slate-400">VAT Number</label>
                            <input 
                               type="text" 
                               value={localVatNumber}
                               onChange={(e) => setLocalVatNumber(e.target.value)}
                               className="w-full px-6 py-4 rounded-[20px] font-bold outline-none transition-all bg-slate-50 border border-slate-200 text-slate-700 focus:ring-4 focus:ring-primary/5 hover:bg-white" 
                               placeholder="e.g. VAT12345678"
                            />
                         </div>
                         <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] block ml-1 text-slate-400">VAT Rate (%)</label>
                            <div className="relative">
                               <input 
                                  type="number" 
                                  value={localVatRate}
                                  onChange={(e) => setLocalVatRate(parseFloat(e.target.value) || 0)}
                                  className="w-full px-6 py-4 rounded-[20px] font-bold outline-none transition-all bg-slate-50 border border-slate-200 text-slate-700 focus:ring-4 focus:ring-primary/5 hover:bg-white pr-10" 
                               />
                               <span className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 font-black">%</span>
                            </div>
                         </div>
                      </div>
                   )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="bg-white rounded-[32px] border border-slate-200 p-10 shadow-sm space-y-8 animate-in slide-in-from-right-4 duration-300">
              <div className="flex items-center justify-between"><SectionHeader title="Method Management" subtitle="Configure accepted tender types for POS, Meal Plans, and Online." /><button onClick={openAddMethod} className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all"><Plus className="size-4" /> Add Method</button></div>
              <div className="space-y-4">
                {paymentMethods.map(method => (
                  <div key={method.id} className="flex items-center justify-between p-6 bg-slate-50 rounded-[24px] border border-slate-100 hover:border-slate-200 transition-all group">
                    <div className="flex items-center gap-6"><div className="size-14 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm">{method.icon}</div><div><h4 className="text-lg font-black text-slate-900">{method.name}</h4><div className="flex items-center gap-1.5 mt-1 flex-wrap"><span className="px-2 py-0.5 bg-slate-200 rounded text-[10px] font-black uppercase tracking-widest text-slate-500 mr-2">{method.type}</span>{method.applicableTo.map(type => (<span key={type} className="px-1.5 py-0.5 border border-slate-300 rounded text-[8px] font-black uppercase text-slate-400">{type}</span>))}</div></div></div>
                    <div className="flex items-center gap-4"><div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${method.isActive ? 'bg-success/10 text-success' : 'bg-slate-200 text-slate-400'}`}>{method.isActive ? 'Active' : 'Disabled'}</div><button onClick={() => openEditMethod(method)} className="size-12 rounded-2xl flex items-center justify-center bg-white text-slate-400 border border-slate-200 hover:text-primary hover:border-primary transition-all"><Edit2 className="size-5" /></button><button onClick={() => togglePayment(method.id)} className={`size-12 rounded-2xl flex items-center justify-center transition-all ${method.isActive ? 'bg-slate-900 text-white shadow-xl' : 'bg-white text-slate-300 border border-slate-200'}`}><Power className="size-5" /></button></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'mealplans' && (
            <div className="bg-white rounded-[32px] border border-slate-200 p-10 shadow-sm space-y-10 animate-in slide-in-from-right-4 duration-300">
              <div className="space-y-6"><SectionHeader title="Service Slots" subtitle="Enable specific meal periods for the weekly planner." /><div className="grid grid-cols-1 md:grid-cols-3 gap-6"><ToggleCard label="Breakfast" sub="06:00 - 11:00" active={localServices.includes('Breakfast')} onClick={() => toggleService('Breakfast')} /><ToggleCard label="Lunch" sub="11:30 - 15:00" active={localServices.includes('Lunch')} onClick={() => toggleService('Lunch')} /><ToggleCard label="Dinner" sub="17:30 - 22:00" active={localServices.includes('Dinner')} onClick={() => toggleService('Dinner')} /></div></div>
              <div className="pt-8 border-t border-slate-100 space-y-6">
                <SectionHeader title="Logistics & Cut-off" subtitle="Define when orders are locked for production." />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Deadline Policy</label>
                    <select 
                      value={localDeadlinePolicy}
                      onChange={(e) => setLocalDeadlinePolicy(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] font-bold text-slate-700 outline-none focus:ring-4 focus:ring-primary/5"
                    >
                      <option>Same Day</option>
                      <option>1 Day Before</option>
                      <option>2 Days Before</option>
                      <option>Friday Prior</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Daily Cut-off Time</label>
                    <div className="relative">
                      <Clock className="absolute left-6 top-1/2 -translate-y-1/2 size-5 text-slate-400" />
                      <input 
                        type="time" 
                        value={localCutoffTime}
                        onChange={(e) => setLocalCutoffTime(e.target.value)}
                        className="w-full pl-16 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-[20px] font-bold text-slate-700 outline-none focus:ring-4 focus:ring-primary/5" 
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="pt-8 border-t border-slate-100 space-y-6"><SectionHeader title="Service Days" subtitle="Days of the week the kitchen operates." /><div className="flex flex-wrap gap-3">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => { const fullDayName = { 'Mon': 'Monday', 'Tue': 'Tuesday', 'Wed': 'Wednesday', 'Thu': 'Thursday', 'Fri': 'Friday', 'Sat': 'Saturday', 'Sun': 'Sunday' }[day] || day; const isActive = localDays.includes(fullDayName); return (<button key={day} onClick={() => toggleDay(day)} className={`size-14 rounded-2xl font-black text-xs transition-all ${ isActive ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-slate-50 text-slate-400 border border-slate-100' }`}>{day}</button> ); })}</div></div>
              
              <div className="pt-8 border-t border-slate-100 space-y-6">
                 <SectionHeader title="Bulk Discounts" subtitle="Incentivize full-week commitments for customers." />
                 <div className="bg-slate-900 rounded-[24px] p-6 text-white relative overflow-hidden flex flex-col justify-between">
                    <div className="absolute top-0 right-0 size-24 bg-white/10 rounded-bl-full"></div>
                    <div className="relative z-10 space-y-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="text-lg font-black tracking-tight">Full Week Commitment</h4>
                                <p className="text-xs font-medium text-white/60 mt-1 max-w-[200px]">
                                    Auto-apply discount when a customer books a specific service (e.g. Lunch) for all {localDays.length} operating days.
                                </p>
                            </div>
                            <div className={`size-12 rounded-2xl flex items-center justify-center ${localBulkDiscountEnabled ? 'bg-success text-white' : 'bg-white/10 text-white/40'}`}>
                                <Percent className="size-6" />
                            </div>
                        </div>
                        
                        <div className="flex items-end gap-4 pt-4">
                            <div className="space-y-1 flex-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Discount Rate</label>
                                <div className="relative">
                                    <input 
                                        type="number" 
                                        value={localBulkDiscountRate}
                                        onChange={(e) => setLocalBulkDiscountRate(parseFloat(e.target.value))}
                                        disabled={!localBulkDiscountEnabled}
                                        className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-2 text-white font-bold disabled:opacity-50 outline-none focus:bg-white/20 transition-all"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold">%</span>
                                </div>
                            </div>
                            <button 
                                onClick={() => setLocalBulkDiscountEnabled(!localBulkDiscountEnabled)}
                                className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${localBulkDiscountEnabled ? 'bg-white text-slate-900 hover:bg-white/90' : 'bg-white/20 text-white hover:bg-white/30'}`}
                            >
                                {localBulkDiscountEnabled ? 'Enabled' : 'Enable'}
                            </button>
                        </div>
                    </div>
                 </div>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="bg-white rounded-[32px] border border-slate-200 p-10 shadow-sm space-y-10 animate-in slide-in-from-right-4 duration-300">
               <div className="space-y-6">
                  <SectionHeader title="Brand Visual Identity" subtitle="Configure the global UI theme and primary accent colors." />
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                     {THEMES.map(theme => (
                        <button 
                           key={theme.id}
                           onClick={() => setActiveTheme(theme.id)}
                           className={`p-4 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 ${activeTheme === theme.id ? 'border-slate-900 bg-slate-50 shadow-lg' : 'border-slate-100 hover:border-slate-200'}`}
                        >
                           <div className={`size-12 rounded-2xl ${theme.color} shadow-inner`}></div>
                           <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{theme.name}</span>
                        </button>
                     ))}
                  </div>
               </div>

               <div className="pt-8 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-6">
                     <SectionHeader title="Interface Density" subtitle="Adjust the compactness of list items and buttons." />
                     <div className="flex bg-slate-50 p-1.5 rounded-[24px] border border-slate-200 shadow-inner">
                        <button onClick={() => setUiDensity('comfort')} className={`flex-1 py-3 rounded-[18px] text-xs font-black uppercase tracking-widest transition-all ${uiDensity === 'comfort' ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}>Comfort</button>
                        <button onClick={() => setUiDensity('compact')} className={`flex-1 py-3 rounded-[18px] text-xs font-black uppercase tracking-widest transition-all ${uiDensity === 'compact' ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}>Compact</button>
                     </div>
                  </div>
                  <div className="space-y-6">
                     <SectionHeader title="Display Mode" subtitle="Switch between system, light, or dark environments." />
                     <div className="flex bg-slate-50 p-1.5 rounded-[24px] border border-slate-200 shadow-inner">
                        <button onClick={() => setUiMode('light')} className={`flex-1 py-3 rounded-[18px] flex items-center justify-center gap-2 transition-all ${uiMode === 'light' ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}><Sun className="size-4" /></button>
                        <button onClick={() => setUiMode('dark')} className={`flex-1 py-3 rounded-[18px] flex items-center justify-center gap-2 transition-all ${uiMode === 'dark' ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}><Moon className="size-4" /></button>
                        <button onClick={() => setUiMode('auto')} className={`flex-1 py-3 rounded-[18px] flex items-center justify-center gap-2 transition-all ${uiMode === 'auto' ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}><Monitor className="size-4" /></button>
                     </div>
                  </div>
               </div>

               <div className="pt-8 border-t border-slate-100 flex items-center justify-between p-6 bg-slate-900 rounded-[32px] text-white">
                  <div className="flex items-center gap-6">
                     <div className="size-14 bg-white/10 rounded-2xl flex items-center justify-center text-primary"><Sparkles className="size-8" /></div>
                     <div><h4 className="text-xl font-black tracking-tight">AI Theme Generator</h4><p className="text-xs text-white/40 font-bold uppercase">Generate dynamic palettes via Gemini Vision</p></div>
                  </div>
                  <button className="px-8 py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:brightness-125 transition-all">Launch Studio</button>
               </div>
            </div>
         )}

          {activeTab === 'comms' && (
             <div className="bg-white rounded-[32px] border border-slate-200 p-10 shadow-sm space-y-10 animate-in slide-in-from-right-4 duration-300">
                <div className="space-y-6">
                   <SectionHeader title="Customer Messaging Channels" subtitle="Manage how the system communicates order updates and marketing." />
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <ToggleCard label="Email Gateway" sub="Active • transactional" active={true} icon={<Mail />} />
                      <ToggleCard label="SMS Twilio" sub="Active • logic-gate" active={true} icon={<MessageCircle />} />
                      <ToggleCard label="WhatsApp Business" sub="Disabled" active={false} icon={<MessageSquare />} />
                   </div>
                </div>

                <div className="pt-8 border-t border-slate-100 space-y-8">
                   <div className="flex items-center justify-between">
                      <SectionHeader title="Automated Triggers" subtitle="Define event-based notifications for customers." />
                      <button className="px-5 py-2 bg-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-200 transition-all">+ Add Trigger</button>
                   </div>
                   <div className="space-y-4">
                      <CommRow label="Order Confirmation" channels={['Email', 'SMS']} status="LIVE" />
                      <CommRow label="Dispatch Alert (Delivery)" channels={['SMS']} status="LIVE" />
                      <CommRow label="Weekly Plan Reminder" channels={['Email']} status="STAGING" warning />
                   </div>
                </div>

                <div className="pt-8 border-t border-slate-100 p-8 bg-primary/5 rounded-[40px] border border-primary/10 flex flex-col md:flex-row items-center justify-between gap-10">
                   <div className="flex items-center gap-8">
                      <div className="size-16 bg-primary text-white rounded-3xl flex items-center justify-center shadow-lg"><BellRing className="size-8" /></div>
                      <div><h4 className="text-xl font-black text-slate-900">Communication Audit Pulse</h4><p className="text-xs text-slate-500 font-bold uppercase">1,420 messages delivered in last 24h</p></div>
                   </div>
                   <button className="px-10 py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl">View Delivery Logs</button>
                </div>
             </div>
          )}
          
          {['security', 'mobile', 'data'].includes(activeTab) && (
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[40px] h-[400px] flex flex-col items-center justify-center text-slate-400 space-y-4 animate-in zoom-in-95 duration-300">
              <Shield className="size-12 opacity-20" />
              <div className="text-center"><h3 className="text-lg font-black uppercase tracking-widest text-slate-500">Module Locked</h3><p className="text-xs font-bold mt-1">This settings module is not yet implemented in the demo.</p></div>
            </div>
          )}

          <div className="p-8 bg-danger/5 border-2 border-dashed border-danger/20 rounded-[32px] flex items-center justify-between mt-auto">
             <div className="flex items-center gap-6"><div className="size-12 bg-white rounded-2xl flex items-center justify-center text-danger border border-danger/10"><AlertTriangle className="size-6" /></div><div><h4 className="text-lg font-black text-danger uppercase tracking-tight">Danger Zone</h4><p className="text-xs text-danger/70 font-bold mt-1">Permanently delete this branch and all associated data.</p></div></div>
             <button className="px-8 py-4 bg-white border-2 border-danger/10 text-danger rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-danger hover:text-white transition-all shadow-sm">Delete Branch Data</button>
          </div>
        </main>
      </div>

      {isMethodModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] w-full max-w-lg shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-primary/5"><h3 className="text-lg font-black text-slate-900">{editingMethod ? 'Edit Payment Method' : 'New Payment Method'}</h3><button onClick={() => setIsMethodModalOpen(false)} className="p-2 bg-white rounded-full text-slate-400 hover:text-danger hover:bg-slate-50 transition-all"><X className="size-5" /></button></div>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6"><div className="space-y-2"><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Method Name</label><input value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 outline-none" placeholder="e.g. PayPal" /></div><div className="space-y-2"><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Type</label><select value={formType} onChange={(e) => setFormType(e.target.value)} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 outline-none"><option value="Cash">Cash</option><option value="Card">Card</option><option value="Digital">Digital / Transfer</option><option value="Voucher">Voucher</option></select></div></div>
              <div className="space-y-4"><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Delivery Type Applicability</label><div className="grid grid-cols-2 gap-3">{['Dine-In', 'Takeout', 'Delivery', 'Meal Plan'].map((type) => (<button key={type} onClick={() => toggleApplicable(type)} className={`px-4 py-3 rounded-xl border-2 text-[10px] font-black uppercase transition-all ${ formApplicable.includes(type) ? 'bg-primary/5 border-primary text-primary shadow-sm' : 'bg-white border-slate-100 text-slate-400' }`}>{type}</button>))}</div></div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between gap-4">{editingMethod && (<button onClick={() => handleDeleteMethod(editingMethod.id)} className="p-4 text-danger hover:bg-danger/10 rounded-xl transition-all"><Trash2 className="size-5" /></button>)}<div className="flex gap-4 flex-1 justify-end"><button onClick={() => setIsMethodModalOpen(false)} className="px-6 py-3 bg-white border border-slate-200 rounded-xl font-black text-xs uppercase tracking-widest text-slate-400 hover:bg-slate-100">Cancel</button><button onClick={handleSaveMethod} className="px-8 py-3 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest hover:brightness-110 shadow-lg">Save Method</button></div></div>
          </div>
        </div>
      )}
    </div>
  );
};

/* --- Internal Components --- */

const SidebarGroup = ({ title, children }: any) => (
  <div className="mb-6"><h3 className="px-4 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-2">{title}</h3><div className="space-y-1">{children}</div></div>
);

const SidebarItem = ({ icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`w-full flex items-center gap-4 px-6 py-4 rounded-[20px] text-xs font-black uppercase tracking-widest transition-all ${ active ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/10 scale-[1.02]' : 'text-slate-500 hover:bg-white hover:text-slate-900 hover:shadow-sm' }`}>
    {React.cloneElement(icon, { className: `size-5 ${active ? 'text-primary' : 'text-slate-400'}` })}
    {label}
  </button>
);

const SectionHeader = ({ title, subtitle }: any) => (
  <div className="mb-6"><h3 className="text-xl font-black text-slate-900 tracking-tight">{title}</h3><p className="text-xs font-bold text-slate-400 mt-1">{subtitle}</p></div>
);

const InputGroup = ({ label, defaultValue, type = "text", icon, dark }: any) => (
  <div className="space-y-2">
    <label className={`text-[10px] font-black uppercase tracking-[0.2em] block ml-1 ${dark ? 'text-white/60' : 'text-slate-400'}`}>{label}</label>
    <div className="relative">{icon && <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400">{icon}</div>}<input type={type} defaultValue={defaultValue} className={`w-full ${icon ? 'pl-14' : 'px-6'} py-4 rounded-[20px] font-bold outline-none transition-all ${ dark ? 'bg-slate-800 border border-white/10 text-white focus:ring-4 focus:ring-white/10' : 'bg-slate-50 border border-slate-200 text-slate-700 focus:ring-4 focus:ring-primary/5 hover:bg-white' }`} /></div>
  </div>
);

const ToggleCard = ({ label, sub, active, onClick, icon }: any) => (
  <button onClick={onClick} className={`p-6 rounded-[24px] border-2 text-left transition-all w-full ${ active ? 'border-primary bg-primary/5' : 'border-slate-100 bg-slate-50 opacity-60' }`}>
    <div className="flex justify-between items-start mb-2"><span className={`text-xs font-black uppercase tracking-widest ${active ? 'text-primary' : 'text-slate-400'}`}>{label}</span><div className={`size-4 rounded-full border-2 flex items-center justify-center ${active ? 'border-primary bg-primary text-white' : 'border-slate-300'}`}>{active && <Check className="size-2.5 stroke-[4]" />}</div></div>
    <div className="flex items-center gap-3">
       {icon && <div className="text-slate-300">{React.cloneElement(icon, { className: 'size-4' })}</div>}
       <p className="text-sm font-black text-slate-900">{sub}</p>
    </div>
  </button>
);

const CommRow = ({ label, channels, status, warning }: any) => (
   <div className="flex items-center justify-between p-6 bg-slate-50 rounded-[28px] border border-slate-100 hover:border-primary/20 transition-all group">
      <div className="flex items-center gap-6">
         <div className="size-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors"><Settings2 className="size-6" /></div>
         <div>
            <h4 className="text-base font-black text-slate-900">{label}</h4>
            <div className="flex gap-2 mt-1">{channels.map((c: any) => (<span key={c} className="text-[8px] font-black uppercase tracking-tighter text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded">{c}</span>))}</div>
         </div>
      </div>
      <div className="flex items-center gap-4">
         <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${warning ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}>{status}</span>
         <ChevronRight className="size-5 text-slate-300" />
      </div>
   </div>
);

export default Settings;
