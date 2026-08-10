
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Users, 
  Search, 
  UserPlus, 
  Verified, 
  AlertTriangle, 
  Calendar, 
  Store, 
  Upload, 
  Crown, 
  Megaphone, 
  Mail, 
  Plus, 
  X, 
  Camera, 
  Gift, 
  Cake, 
  Filter, 
  User, 
  Smartphone, 
  MapPin, 
  Hash, 
  ShieldCheck, 
  Save, 
  Info, 
  BarChart3, 
  TrendingUp, 
  MessageSquare, 
  MousePointer2, 
  CheckCircle2, 
  Edit, 
  Trash2, 
  Sparkles, 
  Loader2, 
  Send, 
  Building2, 
  Pencil, 
  ChevronRight,
  PieChart,
  Target,
  Zap,
  ArrowRight,
  Receipt,
  Truck
} from 'lucide-react';
import { LoyaltyTier, CustomerGroup, Customer, CustomerAddress } from '../types';
import { 
  LOYALTY_TIERS, 
  subscribeToCustomers, 
  addCustomerRecord, 
  updateCustomerRecord, 
  formatCurrency, 
  subscribeToLoyaltyTiers, 
  updateLoyaltyTiers,
  deleteLoyaltyTier,
  subscribeToCustomerGroups,
  updateCustomerGroups,
  deleteCustomerGroup,
  bulkUpdateCustomers
} from './store';

const CRM: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'directory' | 'loyalty' | 'groups' | 'engagement'>('directory');
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Loyalty Edit State
  const [loyaltyTiers, setLoyaltyTiers] = useState<LoyaltyTier[]>([]);
  const [editingTier, setEditingTier] = useState<LoyaltyTier | null>(null);
  const [tierForm, setTierForm] = useState<Partial<LoyaltyTier>>({});

  // Group Management State
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([]);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupForm, setGroupForm] = useState<Partial<CustomerGroup>>({});

  // Customer Edit State
  const [customerForm, setCustomerForm] = useState<Partial<Customer>>({});
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);

  // Engagement Hub State
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [isAIWorkflowRunning, setIsAIWorkflowRunning] = useState(false);
  const [aiStep, setAiStep] = useState(0);

  useEffect(() => {
    const unsubCustomers = subscribeToCustomers((list) => {
      setCustomers(list);
      if (list.length > 0 && !selectedCustomerId) {
        setSelectedCustomerId(list[0].id);
      }
    });
    const unsubLoyalty = subscribeToLoyaltyTiers(setLoyaltyTiers);
    const unsubGroups = subscribeToCustomerGroups(setCustomerGroups);
    
    return () => {
      unsubCustomers();
      unsubLoyalty();
      unsubGroups();
    };
  }, []);

  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId) || customers[0] || null;
  }, [customers, selectedCustomerId]);

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      c.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [customers, searchQuery]);

  // --- LOYALTY LOGIC ---
  const handleAddTier = () => {
    const newTier: LoyaltyTier = {
      id: Math.random().toString(36).substr(2, 9),
      name: 'New Tier',
      pointsThreshold: 0,
      multiplier: 1.0,
      color: 'bg-slate-900',
      perks: ['New Benefit'],
      standardDiscount: 0,
      birthdayDiscount: 0
    };
    updateLoyaltyTiers([...loyaltyTiers, newTier]);
    openEditTier(newTier);
  };

  const openEditTier = (tier: LoyaltyTier) => {
    setEditingTier(tier);
    setTierForm({ ...tier });
  };

  const handleSaveTier = () => {
    if (editingTier && tierForm.id) {
      const updatedTiers = loyaltyTiers.map(t => t.id === tierForm.id ? { ...t, ...tierForm } as LoyaltyTier : t);
      updateLoyaltyTiers(updatedTiers);
      
      // AUTO-UPDATE CUSTOMER TIERS
      // Sort tiers by threshold descending to find highest eligible
      const sortedTiers = [...updatedTiers].sort((a, b) => b.pointsThreshold - a.pointsThreshold);
      
      const updatedCustomers = customers.map(customer => {
         const eligibleTier = sortedTiers.find(t => customer.points >= t.pointsThreshold) || sortedTiers[sortedTiers.length - 1];
         if (eligibleTier && eligibleTier.name !== customer.tier) {
            return { ...customer, tier: eligibleTier.name };
         }
         return customer;
      });
      
      // Only trigger update if changes occurred to avoid loops/overhead
      const hasChanges = updatedCustomers.some((c, i) => c.tier !== customers[i].tier);
      if (hasChanges) {
         bulkUpdateCustomers(updatedCustomers);
      }

      setEditingTier(null);
    }
  };

  const handleDeleteTier = (id: string) => {
    // Sandbox environment blocks window.confirm, so we execute immediately
    deleteLoyaltyTier(id);
    setEditingTier(null);
  };

  const updatePerk = (index: number, value: string) => {
    const newPerks = [...(tierForm.perks || [])];
    newPerks[index] = value;
    setTierForm({ ...tierForm, perks: newPerks });
  };

  const addPerk = () => {
    setTierForm({ ...tierForm, perks: [...(tierForm.perks || []), 'New Perk'] });
  };

  const removePerk = (index: number) => {
    const newPerks = (tierForm.perks || []).filter((_, i) => i !== index);
    setTierForm({ ...tierForm, perks: newPerks });
  };

  // --- GROUP LOGIC ---
  const handleAddGroup = () => {
    setGroupForm({
      id: Math.random().toString(36).substr(2, 9),
      name: '',
      discountPercentage: 0,
      description: '',
      color: 'bg-slate-900'
    });
    setIsGroupModalOpen(true);
  };

  const openEditGroup = (group: CustomerGroup) => {
    setGroupForm({ ...group });
    setIsGroupModalOpen(true);
  };

  const handleSaveGroup = () => {
    if (!groupForm.name) return;
    
    if (customerGroups.find(g => g.id === groupForm.id)) {
      // Edit Mode
      const oldGroup = customerGroups.find(g => g.id === groupForm.id);
      const updatedGroups = customerGroups.map(g => g.id === groupForm.id ? { ...g, ...groupForm } as CustomerGroup : g);
      updateCustomerGroups(updatedGroups);

      // CASCADE RENAME TO CUSTOMERS
      if (oldGroup && oldGroup.name !== groupForm.name) {
         const updatedCustomers = customers.map(c => {
            if (c.group === oldGroup.name) {
               return { ...c, group: groupForm.name };
            }
            return c;
         });
         const hasChanges = updatedCustomers.some((c, i) => c.group !== customers[i].group);
         if (hasChanges) bulkUpdateCustomers(updatedCustomers);
      }

    } else {
      // Create Mode
      updateCustomerGroups([...customerGroups, groupForm as CustomerGroup]);
    }
    setIsGroupModalOpen(false);
  };

  const handleDeleteGroup = (id: string) => {
    // Sandbox environment blocks window.confirm, so we execute immediately
    deleteCustomerGroup(id);
    setIsGroupModalOpen(false);
  };

  // --- CUSTOMER EDIT LOGIC ---
  const openAddCustomer = () => {
    setCustomerForm({ addresses: [] });
    setIsEditingCustomer(false);
    setIsAddingCustomer(true);
  }

  const openEditCustomer = (customer: Customer) => {
    setCustomerForm({ ...customer });
    setIsEditingCustomer(true);
    setIsAddingCustomer(true);
  };

  const updateCustomerFormField = (field: string, value: any) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setCustomerForm(prev => ({
        ...prev,
        [parent]: {
          ...(prev as any)[parent],
          [child]: value
        }
      }));
    } else {
      setCustomerForm(prev => ({ ...prev, [field]: value }));
    }
  };

  const addAddress = () => {
    const newAddress: CustomerAddress = {
      id: Math.random().toString(36).substr(2, 9),
      label: 'Home',
      street: '',
      city: '',
      zip: '',
      country: 'Mauritius'
    };
    setCustomerForm(prev => ({ ...prev, addresses: [...(prev.addresses || []), newAddress] }));
  };

  const removeAddress = (index: number) => {
    setCustomerForm(prev => ({
      ...prev,
      addresses: prev.addresses?.filter((_, i) => i !== index) || []
    }));
  };

  const updateAddress = (index: number, field: keyof CustomerAddress, value: string) => {
    setCustomerForm(prev => {
      const newAddresses = [...(prev.addresses || [])];
      newAddresses[index] = { ...newAddresses[index], [field]: value };
      return { ...prev, addresses: newAddresses };
    });
  };

  // --- ENGAGEMENT LOGIC ---
  const startAIWorkflow = () => {
    setIsCampaignModalOpen(false);
    setIsAIWorkflowRunning(true);
    setAiStep(1);
    // Simulate AI thinking steps
    setTimeout(() => setAiStep(2), 1500); // Analyzing Data
    setTimeout(() => setAiStep(3), 3000); // Identifying Segment
    setTimeout(() => setAiStep(4), 4500); // Drafting Content
  };

  const closeAIWorkflow = () => {
    setIsAIWorkflowRunning(false);
    setAiStep(0);
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Metric label="Customer Database" value={customers.length.toLocaleString()} change="+8.2%" positive />
        <Metric label="Active Loyalty" value={(customers.length * 0.8).toFixed(0)} change="+12%" positive />
        <Metric label="Birthdays This Month" value="1,142" change="Ready" neutral />
        <Metric label="Avg Engagement" value="42.8%" change="+2.1%" positive />
      </div>

      <div className="flex bg-white border border-slate-200 p-1.5 rounded-[24px] shadow-sm w-fit">
        <TabButton active={activeTab === 'directory'} onClick={() => setActiveTab('directory')} icon={<Users className="size-4" />} label="Customer Directory" />
        <TabButton active={activeTab === 'loyalty'} onClick={() => setActiveTab('loyalty')} icon={<Crown className="size-4" />} label="Loyalty & Rewards" />
        <TabButton active={activeTab === 'groups'} onClick={() => setActiveTab('groups')} icon={<Building2 className="size-4" />} label="Groups" />
        <TabButton active={activeTab === 'engagement'} onClick={() => setActiveTab('engagement')} icon={<Megaphone className="size-4" />} label="Engagement Hub" />
      </div>

      {activeTab === 'directory' && (
        <div className="grid grid-cols-12 gap-8 items-start animate-in slide-in-from-bottom-4 duration-300">
          <div className="col-span-12 lg:col-span-8 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[700px]">
            <div className="p-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <input 
                    className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm w-64 focus:ring-2 focus:ring-primary/20 outline-none" 
                    placeholder="Search customer records..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <button className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-primary transition-all"><Filter className="size-4" /></button>
              </div>
              <div className="flex gap-2">
                <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all"><Upload className="size-4" /> Bulk Import</button>
                <button onClick={openAddCustomer} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-110 shadow-lg shadow-primary/20 transition-all"><UserPlus className="size-4" /> Register Customer</button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-white border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-widest z-10">
                  <tr>
                    <th className="px-8 py-4">Customer Account</th>
                    <th className="px-6 py-4">Birth Date</th>
                    <th className="px-6 py-4">Group</th>
                    <th className="px-6 py-4">Tier</th>
                    <th className="px-6 py-4 text-right pr-8">LTV</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-slate-600">
                  {filteredCustomers.map((c) => (
                     <CustomerRow 
                        key={c.id} 
                        name={c.name} 
                        email={c.email} 
                        birthday={c.birthday || 'N/A'} 
                        group={c.group} 
                        tier={c.tier} 
                        ltv={formatCurrency(c.ltv)} 
                        avatar={c.avatar} 
                        active={selectedCustomerId === c.id} 
                        onClick={() => setSelectedCustomerId(c.id)}
                      />
                  ))}
                  {filteredCustomers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs opacity-50">No customer records found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4 space-y-6 h-[700px]">
            {selectedCustomer ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-md relative overflow-hidden h-full flex flex-col animate-in fade-in slide-in-from-right-2 duration-300">
                <div className="absolute top-0 right-0 size-32 bg-primary/5 rounded-bl-full -mr-12 -mt-16"></div>
                <div className="flex items-start gap-6 mb-6 relative">
                  <div className="relative">
                    <img src={selectedCustomer.avatar} className="size-20 rounded-3xl border-4 border-white shadow-xl shadow-slate-200 object-cover" alt={selectedCustomer.name} />
                    <div className="absolute -bottom-2 -right-2 size-8 bg-primary rounded-full border-4 border-white flex items-center justify-center text-white">
                      <Crown className="size-4" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-xl font-black text-slate-900 tracking-tight">{selectedCustomer.name}</h3>
                      <Verified className="size-4 text-blue-500 fill-blue-500/10" />
                    </div>
                    <p className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-2"><Mail className="size-3" /> {selectedCustomer.email}</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest rounded-full">{selectedCustomer.tier}</span>
                      <span className="px-3 py-1 bg-slate-100 text-slate-600 text-[9px] font-black uppercase tracking-widest rounded-full">{selectedCustomer.group || 'Standard'}</span>
                    </div>
                  </div>
                </div>

                {/* Gemini Insight Card */}
                <div className="mb-6 p-5 bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 rounded-[24px] relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><Sparkles className="size-12 text-indigo-600" /></div>
                   <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[9px] font-black uppercase tracking-widest rounded">Gemini Insight</span>
                   </div>
                   <p className="text-xs font-medium text-slate-600 leading-relaxed">
                      "High-value guest with preference for <span className="font-bold text-indigo-900">Seafood</span> and <span className="font-bold text-indigo-900">Weekend Dinner</span> slots. Consistent 15% WoW growth in LTV. Recommend offering <span className="font-bold text-indigo-900">Chef's Table</span> experience."
                   </p>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-6">
                   <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                      <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Avg Ticket</p>
                      <p className="text-sm font-black text-slate-900">{formatCurrency(1250)}</p>
                   </div>
                   <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                      <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Frequency</p>
                      <p className="text-sm font-black text-slate-900">2.4 / mo</p>
                   </div>
                   <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                      <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Points</p>
                      <p className="text-sm font-black text-primary">{selectedCustomer.points}</p>
                   </div>
                </div>

                <div className="flex border-b border-slate-100 gap-8 mb-4">
                  <button className="pb-3 border-b-2 border-primary text-xs font-black text-primary uppercase tracking-widest">History</button>
                  <button className="pb-3 border-b-2 border-transparent text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600">Preferences</button>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-2">
                  <ActivityItem icon={<Receipt className="size-3.5" />} title="Table Service" sub="Oct 14 • 2 Guests" amount={formatCurrency(2400)} />
                  <ActivityItem icon={<Truck className="size-3.5" />} title="Delivery Order" sub="Oct 08 • Online" amount={formatCurrency(850)} />
                  <ActivityItem icon={<Calendar className="size-3.5" />} title="Meal Plan" sub="Sep 28 • Weekly" amount={formatCurrency(4500)} />
                </div>

                <div className="pt-6 border-t border-slate-100 flex gap-3">
                  <button onClick={() => openEditCustomer(selectedCustomer)} className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                      <Pencil className="size-3.5" /> Edit
                  </button>
                  <button className="flex-1 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:brightness-125 transition-all shadow-lg flex items-center justify-center gap-2">
                      <MessageSquare className="size-3.5" /> Chat
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 p-8 flex flex-col items-center justify-center text-center text-slate-400 h-full">
                <Users className="size-12 mb-4 opacity-20" />
                <p className="font-bold uppercase tracking-widest text-xs">Select a customer to view intelligence</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'loyalty' && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
           <div className="flex justify-between items-center bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
              <div>
                 <h3 className="text-xl font-black text-slate-900">Loyalty Tiers</h3>
                 <p className="text-slate-500 font-medium text-sm">Define point multipliers and perks for each level.</p>
              </div>
              <button onClick={handleAddTier} className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl"><Plus className="size-4" /> Add Tier</button>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              {loyaltyTiers.map(tier => (
                 <div key={tier.id} onClick={() => openEditTier(tier)} className="bg-white rounded-[32px] border border-slate-200 p-8 hover:shadow-xl hover:border-primary/30 transition-all cursor-pointer group relative overflow-hidden">
                    <div className={`absolute top-0 right-0 size-32 opacity-5 rounded-bl-full ${tier.color.replace('bg-', 'bg-')}`}></div>
                    <div className="relative z-10">
                       <div className="flex justify-between items-start mb-6">
                          <div className={`size-12 rounded-2xl flex items-center justify-center text-white shadow-lg ${tier.color}`}>
                             <Crown className="size-6" />
                          </div>
                          <span className="px-3 py-1 bg-slate-100 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500">
                             {tier.multiplier}x Pts
                          </span>
                       </div>
                       <h4 className="text-2xl font-black text-slate-900 mb-1">{tier.name}</h4>
                       <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Min {tier.pointsThreshold.toLocaleString()} Pts</p>
                       
                       <div className="space-y-3">
                          {tier.perks.slice(0, 3).map((perk, i) => (
                             <div key={i} className="flex items-center gap-2 text-sm font-bold text-slate-600">
                                <CheckCircle2 className="size-4 text-success" />
                                {perk}
                             </div>
                          ))}
                          {tier.perks.length > 3 && <p className="text-[10px] font-bold text-slate-400 pl-6">+{tier.perks.length - 3} more perks</p>}
                       </div>
                    </div>
                 </div>
              ))}
           </div>
        </div>
      )}

      {activeTab === 'groups' && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
           <div className="flex justify-between items-center bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
              <div>
                 <h3 className="text-xl font-black text-slate-900">Customer Groups</h3>
                 <p className="text-slate-500 font-medium text-sm">Manage corporate accounts and special segments.</p>
              </div>
              <button onClick={handleAddGroup} className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl"><Plus className="size-4" /> Create Group</button>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {customerGroups.map(group => (
                 <div key={group.id} onClick={() => openEditGroup(group)} className="bg-white rounded-[32px] border border-slate-200 p-8 hover:shadow-xl transition-all cursor-pointer group hover:border-primary/30">
                    <div className="flex items-center justify-between mb-6">
                       <div className={`size-14 rounded-2xl flex items-center justify-center text-white shadow-lg ${group.color}`}>
                          <Building2 className="size-7" />
                       </div>
                       <div className="text-right">
                          <p className="text-3xl font-black text-slate-900 tracking-tighter">{group.discountPercentage}%</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Discount</p>
                       </div>
                    </div>
                    <h4 className="text-xl font-black text-slate-900 mb-2">{group.name}</h4>
                    <p className="text-sm font-medium text-slate-500 line-clamp-2 mb-6">{group.description}</p>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 bg-slate-50 p-3 rounded-xl">
                       <Users className="size-4" />
                       {customers.filter(c => c.group === group.name).length} Members linked
                    </div>
                 </div>
              ))}
           </div>
        </div>
      )}

      {activeTab === 'engagement' && (
        <div className="grid grid-cols-12 gap-8 animate-in slide-in-from-right-4 duration-300">
           <div className="col-span-12 lg:col-span-8 space-y-8">
              <div className="bg-slate-900 rounded-[40px] p-10 text-white relative overflow-hidden shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8">
                 <div className="absolute top-0 right-0 size-96 bg-primary/20 rounded-full blur-3xl -mr-24 -mt-24"></div>
                 <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-2">
                       <div className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md flex items-center gap-2"><Sparkles className="size-3 text-primary" /> Powered by Gemini</div>
                    </div>
                    <h3 className="text-3xl font-black tracking-tight mb-2">Engagement Hub</h3>
                    <p className="text-white/60 font-medium max-w-md">Create hyper-personalized campaigns using AI to segment your audience and craft compelling offers.</p>
                 </div>
                 <button onClick={() => setIsCampaignModalOpen(true)} className="px-8 py-4 bg-white text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl shrink-0 flex items-center gap-2 relative z-10">
                    <Plus className="size-4" /> New Campaign
                 </button>
              </div>

              <div className="bg-white rounded-[32px] border border-slate-200 p-8 shadow-sm">
                 <div className="flex justify-between items-center mb-6">
                    <h4 className="text-lg font-black text-slate-900">Active Campaigns</h4>
                    <button className="text-xs font-black text-primary uppercase tracking-widest hover:underline">View All</button>
                 </div>
                 <div className="space-y-4">
                    <CampaignRow title="Weekend Brunch Blast" channel="Email" reach={1240} sent="2h ago" status="Active" openRate="42%" />
                    <CampaignRow title="VIP Tasting Invite" channel="SMS" reach={85} sent="Yesterday" status="Completed" openRate="94%" />
                    <CampaignRow title="We Miss You" channel="Email" reach={450} sent="3 days ago" status="Active" openRate="28%" />
                 </div>
              </div>
           </div>

           <div className="col-span-12 lg:col-span-4 space-y-6">
              <div className="bg-white rounded-[32px] border border-slate-200 p-8 shadow-sm">
                 <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6">Performance</h4>
                 <div className="space-y-4">
                    <ReachMetric label="Total Reach" value="24.5k" />
                    <ReachMetric label="Avg. Open Rate" value="38.2%" />
                    <ReachMetric label="Conversion" value="4.5%" />
                 </div>
              </div>
              
              <div className="space-y-4">
                 <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">Recent Success</h4>
                 <PastCampaignCard title="Summer Menu Launch" date="Jun 12" roi="450%" revenue="$12.4k" />
                 <PastCampaignCard title="Flash Sale Friday" date="May 28" roi="320%" revenue="$8.2k" />
              </div>
           </div>
        </div>
      )}
      
      {/* Edit Tier Modal remains unchanged */}
      {editingTier && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300 w-full h-full">
           <div className="bg-white rounded-[40px] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                 <h3 className="text-xl font-black text-slate-900">Edit Tier</h3>
                 <button onClick={() => setEditingTier(null)} className="p-2 text-slate-400 hover:text-danger hover:bg-slate-50 rounded-full transition-all"><X className="size-6" /></button>
              </div>
              <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.15em]">TIER NAME</label>
                    <input 
                       value={tierForm.name} 
                       onChange={e => setTierForm({...tierForm, name: e.target.value})} 
                       className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:ring-4 focus:ring-primary/5 transition-all shadow-sm" 
                    />
                 </div>
                 
                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.15em]">POINTS THRESHOLD</label>
                       <input 
                          type="number"
                          value={tierForm.pointsThreshold} 
                          onChange={e => setTierForm({...tierForm, pointsThreshold: parseInt(e.target.value)})} 
                          className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:ring-4 focus:ring-primary/5 transition-all shadow-sm" 
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.15em]">MULTIPLIER (X)</label>
                       <input 
                          type="number"
                          step="0.1"
                          value={tierForm.multiplier} 
                          onChange={e => setTierForm({...tierForm, multiplier: parseFloat(e.target.value)})} 
                          className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:ring-4 focus:ring-primary/5 transition-all shadow-sm" 
                       />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.15em]">STANDARD DISCOUNT %</label>
                       <input 
                          type="number"
                          value={tierForm.standardDiscount} 
                          onChange={e => setTierForm({...tierForm, standardDiscount: parseFloat(e.target.value)})} 
                          className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:ring-4 focus:ring-primary/5 transition-all shadow-sm" 
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.15em]">BIRTHDAY DISCOUNT %</label>
                       <input 
                          type="number"
                          value={tierForm.birthdayDiscount} 
                          onChange={e => setTierForm({...tierForm, birthdayDiscount: parseFloat(e.target.value)})} 
                          className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:ring-4 focus:ring-primary/5 transition-all shadow-sm" 
                       />
                    </div>
                 </div>
                 
                 <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.15em]">PERKS</label>
                    <div className="space-y-3">
                       {(tierForm.perks || []).map((perk, idx) => (
                          <div key={idx} className="flex gap-2">
                             <input 
                                value={perk}
                                onChange={e => updatePerk(idx, e.target.value)}
                                className="flex-1 px-5 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 shadow-sm outline-none focus:ring-4 focus:ring-primary/5 transition-all"
                             />
                             <button onClick={() => removePerk(idx)} className="p-3 text-slate-300 hover:text-danger hover:bg-danger/5 rounded-xl transition-all"><X className="size-5" /></button>
                          </div>
                       ))}
                       <button onClick={addPerk} className="w-full py-4 border-2 border-dashed border-slate-100 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:border-primary/30 hover:text-primary transition-all flex items-center justify-center gap-2">
                          <Plus className="size-4" /> ADD PERK
                       </button>
                    </div>
                 </div>
              </div>
              <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-between gap-4 shrink-0">
                 <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDeleteTier(editingTier.id); }}
                    className="px-10 py-4 bg-[#FFEBE5] text-[#FF4D4D] rounded-2xl font-black text-[11px] uppercase tracking-widest hover:brightness-95 active:scale-95 transition-all cursor-pointer border border-transparent focus:ring-2 focus:ring-secondary/50 outline-none"
                 >
                    DELETE
                 </button>
                 <button onClick={handleSaveTier} className="px-12 py-4 bg-primary text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-primary/20 hover:brightness-110 active:scale-95 transition-all">SAVE CHANGES</button>
              </div>
           </div>
        </div>,
        document.body
      )}

      {/* Add/Edit Customer Modal (Portal) */}
      {isAddingCustomer && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-900/70 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[48px] w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-top-8 duration-500 h-[85vh]">
            <div className="p-10 border-b border-slate-100 flex items-center justify-between bg-primary/5">
              <div className="flex items-center gap-6">
                <div className="size-20 bg-primary text-white rounded-[28px] flex items-center justify-center shadow-2xl shadow-primary/30">
                  <UserPlus className="size-10" />
                </div>
                <div>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tighter">
                     {isEditingCustomer ? 'Edit Customer Profile' : 'Enterprise Onboarding'}
                  </h2>
                  <p className="text-[10px] font-black uppercase text-primary tracking-[0.4em] mt-1">Direct CRM Master Entry</p>
                </div>
              </div>
              <button onClick={() => setIsAddingCustomer(false)} className="p-4 bg-white rounded-full text-slate-400 hover:text-danger shadow-xl border border-slate-100 transition-all hover:rotate-90"><X className="size-6" /></button>
            </div>
            
            <div className="p-12 overflow-y-auto space-y-12 custom-scrollbar flex-1">
               <div className="grid grid-cols-2 gap-10">
                  <InputGroup label="First Name" placeholder="e.g. Jane" defaultValue={customerForm.firstName} onChange={(e: any) => updateCustomerFormField('firstName', e.target.value)} />
                  <InputGroup label="Last Name" placeholder="e.g. Doe" defaultValue={customerForm.lastName} onChange={(e: any) => updateCustomerFormField('lastName', e.target.value)} />
               </div>
               <div className="grid grid-cols-3 gap-8">
                  <InputGroup label="Primary Email" icon={<Mail className="size-4" />} placeholder="client@example.com" defaultValue={customerForm.email} onChange={(e: any) => updateCustomerFormField('email', e.target.value)} />
                  <InputGroup label="Mobile Number" icon={<Smartphone className="size-4" />} placeholder="+230 ..." defaultValue={customerForm.phone} onChange={(e: any) => updateCustomerFormField('phone', e.target.value)} />
                  <InputGroup label="Date of Birth" icon={<Cake className="size-4" />} type="date" defaultValue={customerForm.birthday} onChange={(e: any) => updateCustomerFormField('birthday', e.target.value)} />
               </div>
               <div className="grid grid-cols-3 gap-8">
                  <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Customer Group</label>
                     <select className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-accent/20 outline-none transition-all" defaultValue={customerForm.group} onChange={(e: any) => updateCustomerFormField('group', e.target.value)}>
                        {customerGroups.map(g => <option key={g.id} value={g.name}>{g.name} ({g.discountPercentage}%)</option>)}
                     </select>
                  </div>
               </div>
               
               <div className="space-y-6">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                     <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Logistics Profile</h4>
                     <button onClick={addAddress} className="flex items-center gap-2 text-[10px] font-black uppercase text-primary hover:text-primary/80 transition-all"><Plus className="size-3" /> Add Address</button>
                  </div>
                  <div className="space-y-4">
                     {customerForm.addresses?.map((addr, idx) => (
                        <div key={idx} className="p-6 bg-slate-50 rounded-[24px] border border-slate-200 relative group hover:border-primary/30 transition-all">
                           <button onClick={() => removeAddress(idx)} className="absolute top-4 right-4 p-2 text-slate-300 hover:text-danger hover:bg-danger/10 rounded-full transition-all opacity-0 group-hover:opacity-100"><Trash2 className="size-4" /></button>
                           <div className="grid grid-cols-4 gap-6">
                              <div className="col-span-1">
                                 <InputGroup label="Label" placeholder="e.g. Home" defaultValue={addr.label} onChange={(e: any) => updateAddress(idx, 'label', e.target.value)} />
                              </div>
                              <div className="col-span-3">
                                 <InputGroup label="Street Address" icon={<MapPin className="size-4" />} placeholder="123 Royal Road" defaultValue={addr.street} onChange={(e: any) => updateAddress(idx, 'street', e.target.value)} />
                              </div>
                              <div className="col-span-2">
                                 <InputGroup label="City / Zone" placeholder="e.g. Grand Baie" defaultValue={addr.city} onChange={(e: any) => updateAddress(idx, 'city', e.target.value)} />
                              </div>
                              <div className="col-span-2">
                                 <InputGroup label="Postal Code" placeholder="e.g. 30510" defaultValue={addr.zip} onChange={(e: any) => updateAddress(idx, 'zip', e.target.value)} />
                              </div>
                           </div>
                        </div>
                     ))}
                     {(!customerForm.addresses || customerForm.addresses.length === 0) && (
                        <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-[24px]">
                           <MapPin className="size-8 mx-auto text-slate-300 mb-2" />
                           <p className="text-xs font-bold text-slate-400">No addresses on file.</p>
                        </div>
                     )}
                  </div>
               </div>

               <div className="space-y-6">
                  <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 pb-2">Preferences & Compliance</h4>
                  <div className="grid grid-cols-3 gap-6">
                     <ComplianceToggle label="SMS Marketing" sub="Allow promotional texts" active={customerForm.gdprConsent?.sms} onClick={() => updateCustomerFormField('gdprConsent.sms', !customerForm.gdprConsent?.sms)} />
                     <ComplianceToggle label="Email Newsletter" sub="Weekly menu updates" active={customerForm.gdprConsent?.marketing} onClick={() => updateCustomerFormField('gdprConsent.marketing', !customerForm.gdprConsent?.marketing)} />
                     <ComplianceToggle label="Data Processing" sub="Store order history" active={customerForm.gdprConsent?.dataProcessing} onClick={() => updateCustomerFormField('gdprConsent.dataProcessing', !customerForm.gdprConsent?.dataProcessing)} />
                  </div>
               </div>
            </div>

            <div className="p-10 bg-slate-50 border-t border-slate-100 flex justify-end gap-4 shrink-0">
              <button onClick={() => setIsAddingCustomer(false)} className="px-10 py-5 bg-white border border-slate-200 rounded-3xl font-black text-xs uppercase text-slate-400 hover:bg-slate-100">Cancel</button>
              <button onClick={() => { 
                if (isEditingCustomer && customerForm.id) {
                  updateCustomerRecord(customerForm.id, {
                    ...customerForm,
                    name: `${customerForm.firstName || ''} ${customerForm.lastName || ''}`.trim()
                  });
                } else {
                  addCustomerRecord({
                    firstName: customerForm.firstName || 'New',
                    lastName: customerForm.lastName || 'Guest',
                    name: `${customerForm.firstName || 'New'} ${customerForm.lastName || 'Guest'}`,
                    email: customerForm.email || '',
                    phone: customerForm.phone || '',
                    avatar: '',
                    gdprConsent: customerForm.gdprConsent || { marketing: true, sms: true, dataProcessing: true },
                    addresses: customerForm.addresses || []
                  });
                }
                setIsAddingCustomer(false); 
              }} className="px-16 py-5 bg-slate-900 text-white rounded-3xl font-black text-xs uppercase shadow-2xl flex items-center gap-3 hover:scale-105 transition-all">
                 <Save className="size-5" /> {isEditingCustomer ? 'Update Profile' : 'Commit Customer Account'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      
      {/* Campaign Modal (Portal) */}
      {isCampaignModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
           <div className="bg-white rounded-[40px] w-full max-w-lg shadow-2xl p-8">
              <div className="flex justify-between items-center mb-8">
                 <h2 className="text-2xl font-black text-slate-900">Create Campaign</h2>
                 <button onClick={() => setIsCampaignModalOpen(false)}><X className="size-6 text-slate-400" /></button>
              </div>
              <div className="space-y-6">
                 <InputGroup label="Campaign Name" placeholder="e.g. Summer Launch" />
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Channel</label>
                       <select className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none">
                          <option>Email Blast</option>
                          <option>SMS Notification</option>
                          <option>Push Notification</option>
                       </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Target Segment</label>
                       <select className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none">
                          <option>All Customers</option>
                          <option>VIP Tier</option>
                          <option>Churn Risk</option>
                       </select>
                    </div>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Message Content</label>
                    <textarea className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium h-32 text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="Write your message here..." />
                 </div>
                 
                 <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-center gap-4">
                    <Sparkles className="size-6 text-primary" />
                    <div className="flex-1">
                       <p className="text-xs font-black text-slate-900">AI Optimization</p>
                       <p className="text-[10px] text-slate-500 font-medium">Let Gemini refine your copy and segment.</p>
                    </div>
                    <button onClick={startAIWorkflow} className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase shadow-sm hover:border-primary text-slate-600 transition-all">Optimize</button>
                 </div>

                 <button onClick={() => setIsCampaignModalOpen(false)} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] transition-all shadow-xl">Launch Campaign</button>
              </div>
           </div>
        </div>,
        document.body
      )}

      {/* AI Workflow Simulation (Portal) */}
      {isAIWorkflowRunning && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-900/90 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-500">
           <div className="max-w-xl w-full text-center text-white">
              <div className="size-24 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-8 relative">
                 <Sparkles className="size-10 text-primary animate-pulse" />
                 <div className="absolute inset-0 border-4 border-primary/30 rounded-full animate-ping"></div>
              </div>
              <h2 className="text-4xl font-black tracking-tight mb-6">Gemini Intelligence Active</h2>
              
              <div className="space-y-4 max-w-sm mx-auto text-left">
                 <StepItem step={1} current={aiStep} label="Connecting to CRM Database..." />
                 <StepItem step={2} current={aiStep} label="Analyzing Purchase Patterns & LTV..." />
                 <StepItem step={3} current={aiStep} label="Identified Segment: 'Churn Risk - High Value'" />
                 <StepItem step={4} current={aiStep} label="Drafting Personalized Re-engagement Offer..." />
              </div>

              {aiStep === 4 && (
                 <div className="mt-10 bg-white text-slate-900 p-6 rounded-3xl animate-in slide-in-from-bottom-4 text-left shadow-2xl">
                    <p className="text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Drafted SMS • Segment (84 Users)</p>
                    <p className="font-bold text-lg leading-snug">"Hi [Name], we've missed you! Come back to BonManzE this week and enjoy a complementary appetizer on us. Show code: WELCOME-BACK."</p>
                    <div className="flex gap-4 mt-6">
                       <button onClick={closeAIWorkflow} className="flex-1 py-3 bg-slate-100 rounded-xl font-black text-xs uppercase hover:bg-slate-200 transition-all">Discard</button>
                       <button onClick={closeAIWorkflow} className="flex-1 py-3 bg-primary text-white rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 hover:scale-105 transition-all shadow-lg"><Send className="size-4" /> Send Now</button>
                    </div>
                 </div>
              )}
           </div>
        </div>,
        document.body
      )}

      {/* Group Edit Modal (Portal) */}
      {isGroupModalOpen && createPortal(
         <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[40px] w-full max-w-lg shadow-2xl p-8">
               <div className="flex justify-between items-center mb-8">
                  <h2 className="text-2xl font-black text-slate-900">{groupForm.id ? 'Edit Group' : 'Create New Group'}</h2>
                  <div className="flex gap-2">
                     {groupForm.id && (
                        <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteGroup(groupForm.id!); }} className="p-2 bg-white border border-slate-200 rounded-full text-slate-300 hover:text-danger hover:border-danger/30 hover:bg-danger/5 transition-all shadow-sm"><Trash2 className="size-5" /></button>
                     )}
                     <button onClick={() => setIsGroupModalOpen(false)} className="p-2 bg-white rounded-full text-slate-400 hover:text-danger hover:bg-slate-50"><X className="size-5" /></button>
                  </div>
               </div>
               <div className="space-y-6">
                  <InputGroup label="Group Name" placeholder="e.g. Students" defaultValue={groupForm.name} onChange={(e: any) => setGroupForm({...groupForm, name: e.target.value})} />
                  <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Description</label>
                     <textarea className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium h-24 text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="Description of eligibility..." defaultValue={groupForm.description} onChange={(e: any) => setGroupForm({...groupForm, description: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Discount %</label>
                        <input type="number" className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-lg text-primary outline-none focus:ring-2 focus:ring-primary/20" defaultValue={groupForm.discountPercentage} onChange={(e: any) => setGroupForm({...groupForm, discountPercentage: parseFloat(e.target.value)})} />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Color Tag</label>
                        <select className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none" defaultValue={groupForm.color} onChange={(e: any) => setGroupForm({...groupForm, color: e.target.value})}>
                           <option value="bg-slate-900">Slate</option>
                           <option value="bg-primary">Primary Green</option>
                           <option value="bg-indigo-600">Indigo</option>
                           <option value="bg-amber-500">Amber</option>
                           <option value="bg-rose-600">Rose</option>
                        </select>
                     </div>
                  </div>
                  <button onClick={handleSaveGroup} className="w-full py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:brightness-110 shadow-lg transition-all">Save Group</button>
               </div>
            </div>
         </div>,
         document.body
      )}
    </div>
  );
};

/* Internal Helper Components */

const StepItem = ({ step, current, label }: any) => {
   const isDone = current > step;
   const isActive = current === step;
   
   return (
      <div className={`flex items-center gap-4 transition-all duration-500 ${isActive || isDone ? 'opacity-100' : 'opacity-30'}`}>
         <div className={`size-8 rounded-full flex items-center justify-center font-black text-sm border-2 ${
            isDone ? 'bg-primary border-primary text-white' : isActive ? 'bg-white text-slate-900 border-white animate-pulse' : 'border-white/20 text-white'
         }`}>
            {isDone ? <CheckCircle2 className="size-5" /> : step}
         </div>
         <p className="font-bold text-lg">{label}</p>
      </div>
   );
};

const ReachMetric = ({ label, value }: any) => (
   <div className="flex justify-between items-center bg-white/10 p-4 rounded-xl">
      <span className="text-xs font-bold">{label}</span>
      <span className="text-sm font-black">{value}</span>
   </div>
);

const CampaignRow = ({ title, channel, reach, sent, status, openRate }: any) => (
   <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-primary/20 transition-all group">
      <div className="flex items-center gap-4">
         <div className="size-10 bg-white rounded-xl flex items-center justify-center text-slate-400 border border-slate-200">
            {channel === 'Email' ? <Mail className="size-5" /> : <Smartphone className="size-5" />}
         </div>
         <div>
            <p className="text-sm font-black text-slate-900">{title}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{channel} • {reach} Recipients</p>
         </div>
      </div>
      <div className="text-right">
         <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${status === 'Active' ? 'bg-success/10 text-success' : 'bg-slate-200 text-slate-500'}`}>{status}</span>
         <p className="text-[10px] font-bold text-slate-400 mt-1">Open: {openRate}</p>
      </div>
   </div>
);

const PastCampaignCard = ({ title, date, roi, revenue }: any) => (
   <div className="p-6 bg-slate-50 rounded-[24px] border border-slate-100 hover:shadow-md transition-all">
      <div className="flex justify-between mb-4">
         <div className="size-10 bg-white rounded-xl flex items-center justify-center text-primary shadow-sm"><TrendingUp className="size-5" /></div>
         <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-1 rounded-lg border border-slate-100">{date}</span>
      </div>
      <h4 className="text-base font-black text-slate-900 mb-1">{title}</h4>
      <div className="flex items-baseline gap-2 mt-4">
         <span className="text-2xl font-black text-slate-900 tracking-tight">{roi}</span>
         <span className="text-xs font-bold text-slate-400 uppercase">ROI</span>
      </div>
      <p className="text-xs font-medium text-success mt-1">Generated {revenue}</p>
   </div>
);

const ComplianceToggle = ({ label, sub, active, onClick }: any) => (
   <button onClick={onClick} className={`p-4 rounded-2xl border-2 text-left transition-all ${active ? 'border-primary bg-primary/5' : 'border-white/5 bg-white/5 hover:border-white/20'}`}>
      <div className="flex items-center justify-between mb-1">
         <span className="text-xs font-black uppercase tracking-widest">{label}</span>
         <div className={`size-3 rounded-full ${active ? 'bg-primary' : 'bg-slate-700'}`}></div>
      </div>
      <p className="text-[10px] text-slate-400 font-medium leading-tight">{sub}</p>
   </button>
);

const InputGroup = ({ label, placeholder, defaultValue, icon, type = "text", onChange }: any) => (
  <div className="space-y-2 flex-1">
    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">{label}</label>
    <div className="relative">
      {icon && <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300">{icon}</div>}
      <input type={type} className={`w-full ${icon ? 'pl-10' : 'px-5'} py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-sm`} placeholder={placeholder} defaultValue={defaultValue} onChange={onChange} />
    </div>
  </div>
);

const Metric = ({ label, value, change, positive, neutral }: any) => (
  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">{label}</p>
    <div className="flex items-end justify-between">
      <span className="text-3xl font-black text-slate-900 tracking-tight leading-none">{value}</span>
      <span className={`text-[10px] font-black uppercase tracking-tighter px-2 py-0.5 rounded ${positive ? 'bg-success/10 text-success' : neutral ? 'bg-slate-100 text-slate-400' : 'bg-primary/10 text-primary'}`}>{change}</span>
    </div>
  </div>
);

const TabButton = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${active ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-slate-600'}`}>{icon} {label}</button>
);

const CustomerRow = ({ name, email, birthday, segment, tier, ltv, avatar, active, group, onClick }: any) => (
  <tr 
    onClick={onClick}
    className={`hover:bg-primary/5 transition-colors cursor-pointer group ${active ? 'bg-primary/5 border-l-4 border-primary' : ''}`}
  >
    <td className="px-8 py-4">
      <div className="flex items-center gap-4">
        <img src={avatar || 'https://picsum.photos/seed/default/100/100'} className="size-10 rounded-xl border-2 border-white shadow-sm object-cover" alt={name} />
        <div>
          <p className="text-sm font-black text-slate-900 tracking-tight leading-tight">{name}</p>
          <p className="text-[10px] font-bold text-slate-400 italic">{email}</p>
        </div>
      </div>
    </td>
    <td className="px-6 py-4 text-xs font-bold text-slate-500">{birthday}</td>
    <td className="px-6 py-4"><span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-black uppercase tracking-widest">{group || 'Standard'}</span></td>
    <td className="px-6 py-4"><span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter ${tier === 'Diamond' ? 'bg-primary text-white' : 'bg-slate-400 text-white'}`}>{tier}</span></td>
    <td className="px-6 py-4 text-sm font-black text-slate-900 text-right pr-8">{ltv}</td>
  </tr>
);

const ActivityItem = ({ icon, title, sub, amount }: any) => (
   <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-primary/20 transition-all">
      <div className="flex items-center gap-3">
         <div className="size-8 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-sm border border-slate-200">
            {icon}
         </div>
         <div>
            <p className="text-xs font-black text-slate-900 leading-none mb-0.5">{title}</p>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{sub}</p>
         </div>
      </div>
      <p className="text-xs font-black text-slate-900">{amount}</p>
   </div>
);

export default CRM;
