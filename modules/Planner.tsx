
import React, { useState, useMemo, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  Plus, 
  Download, 
  Sparkles, 
  Zap, 
  CheckCircle2, 
  Database, 
  Clock, 
  ShieldCheck, 
  Copy, 
  ClipboardPaste,
  Trash2, 
  Search, 
  X, 
  Filter,
  Lock
} from 'lucide-react';
import { MenuItem } from '../types';
import { MEAL_LIBRARY_ITEMS, PUBLISHED_PLAN, publishPlan, SYSTEM_CONFIG, subscribeToConfig, formatCurrency, MOCK_TODAY, subscribeToSystemDate } from './store';

interface DayAllocation {
  [service: string]: MenuItem[];
}

interface WeeklyPlan {
  [dateKey: string]: DayAllocation;
}

const Planner: React.FC = () => {
  const [config, setConfig] = useState(SYSTEM_CONFIG);
  const [systemDateStr, setSystemDateStr] = useState(MOCK_TODAY);
  
  // Initialize local state with published data or defaults
  const [weeklyAllocations, setWeeklyAllocations] = useState<WeeklyPlan>(() => {
     // Deep copy from store to allow editing without immediate publishing
     return JSON.parse(JSON.stringify(PUBLISHED_PLAN));
  });

  const getMonday = (d: Date) => {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };

  const [currentDate, setCurrentDate] = useState(() => {
      const [y, m, d] = MOCK_TODAY.split('-').map(Number);
      return getMonday(new Date(y, m - 1, d));
  });
  
  // Subscribe to config and system date changes
  useEffect(() => {
    const unsubConfig = subscribeToConfig(() => setConfig({...SYSTEM_CONFIG}));
    const unsubDate = subscribeToSystemDate((date) => {
        setSystemDateStr(date);
        // When system date changes, jump the planner to that week
        const [y, m, d] = date.split('-').map(Number);
        const newDate = new Date(y, m - 1, d);
        const day = newDate.getDay();
        const diff = newDate.getDate() - day + (day === 0 ? -6 : 1);
        setCurrentDate(new Date(newDate.setDate(diff)));
    });
    return () => {
        unsubConfig();
        unsubDate();
    };
  }, []);
  
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedWeeks, setPublishedWeeks] = useState<string[]>(['2023-10-16']);
  const [clipboard, setClipboard] = useState<(DayAllocation | undefined)[] | null>(null);
  
  // Selection Modal State
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [targetSlot, setTargetSlot] = useState<{dateKey: string, service: string} | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const startOfWeek = useMemo(() => getMonday(new Date(currentDate)), [currentDate]);
  
  const weekLabel = useMemo(() => {
    const end = new Date(startOfWeek);
    end.setDate(end.getDate() + 6);
    return `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }, [startOfWeek]);

  const weekId = `${startOfWeek.getFullYear()}-${String(startOfWeek.getMonth() + 1).padStart(2, '0')}-${String(startOfWeek.getDate()).padStart(2, '0')}`;
  const isWeekPublished = publishedWeeks.includes(weekId);

  // --- Actions ---
  const handleNavigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(startOfWeek);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentDate(newDate);
  };

  const handleCopyWeek = () => {
    const weekData: (DayAllocation | undefined)[] = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(d.getDate() + i);
        // Fix UTC offset issue by using local date string construction
        const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        // Store deep copy
        const dayData = weeklyAllocations[dateKey];
        weekData.push(dayData ? JSON.parse(JSON.stringify(dayData)) : undefined);
    }
    setClipboard(weekData);
    alert(`Week of ${weekLabel} copied to clipboard! Navigate to another week to paste.`);
  };

  const handlePasteWeek = () => {
    if (!clipboard) return;
    
    const newAllocations = { ...weeklyAllocations };
    let hasChanges = false;

    for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(d.getDate() + i);
        const targetDateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        
        // Locked Logic: Skip past days relative to system date
        if (targetDateKey < systemDateStr) continue;

        const sourceDayData = clipboard[i];

        if (sourceDayData) {
            newAllocations[targetDateKey] = JSON.parse(JSON.stringify(sourceDayData));
            hasChanges = true;
        } else {
            // If clipboard has no data for this day, clear the target day to match
            if (newAllocations[targetDateKey]) {
                delete newAllocations[targetDateKey];
                hasChanges = true;
            }
        }
    }

    if (hasChanges) {
        setWeeklyAllocations(newAllocations);
        alert(`Menu pasted into ${weekLabel} successfully! (Past dates were skipped)`);
    } else {
        alert("Target week already matches clipboard or is entirely in the past.");
    }
  };

  const handlePublish = () => {
    setIsPublishing(true);
    // Sync to Shared Store
    publishPlan(weeklyAllocations);
    
    setTimeout(() => {
      setIsPublishing(false);
      if (!publishedWeeks.includes(weekId)) {
          setPublishedWeeks(prev => [...prev, weekId]);
      }
      alert(`Success: Week of ${weekLabel} is now LIVE on POS and Customer Portals.`);
    }, 1000);
  };

  const openSelector = (dateKey: string, service: string) => {
    setTargetSlot({ dateKey, service });
    setIsSelectorOpen(true);
  };

  const addDish = (dish: MenuItem) => {
    if (!targetSlot) return;
    
    const { dateKey, service } = targetSlot;
    const currentDay = weeklyAllocations[dateKey] || {};
    const currentService = currentDay[service] || [];

    // Prevent duplicates
    if (currentService.find(d => d.id === dish.id)) {
      alert("This dish is already added to this slot.");
      return;
    }

    setWeeklyAllocations({
      ...weeklyAllocations,
      [dateKey]: {
        ...currentDay,
        [service]: [...currentService, dish]
      }
    });
    setIsSelectorOpen(false);
  };

  const removeDish = (dateKey: string, service: string, dishId: string) => {
    const currentDay = weeklyAllocations[dateKey] || {};
    const currentService = currentDay[service] || [];
    
    setWeeklyAllocations({
      ...weeklyAllocations,
      [dateKey]: {
        ...currentDay,
        [service]: currentService.filter(d => d.id !== dishId)
      }
    });
  };

  const getWeekDays = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      // Fix UTC offset issue by using local date string construction
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
      
      // Use reactive config
      if (config.operatingDays.includes(dayName)) {
        days.push({ name: dayName, date: d.getDate(), key: dateKey });
      }
    }
    return days;
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 h-full flex flex-col">
      {/* Header Controls */}
      <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center gap-1 ${isWeekPublished ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
              {isWeekPublished ? <CheckCircle2 className="size-3" /> : <Clock className="size-3" />}
              {isWeekPublished ? 'Published Live' : 'Draft Mode'}
            </span>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em]">
              {startOfWeek.getFullYear()}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => handleNavigateWeek('prev')} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50"><ChevronLeft className="size-5 text-slate-600" /></button>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter w-64 text-center">{weekLabel}</h1>
            <button onClick={() => handleNavigateWeek('next')} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50"><ChevronRight className="size-5 text-slate-600" /></button>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
           <button onClick={handleCopyWeek} className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all">
              <Copy className="size-4" /> Copy This Week
           </button>
           <button 
              onClick={handlePasteWeek} 
              disabled={!clipboard}
              className={`flex items-center gap-2 px-5 py-3 border border-slate-200 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                !clipboard 
                  ? 'bg-slate-50 text-slate-300 cursor-not-allowed border-slate-100' 
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
           >
              <ClipboardPaste className="size-4" /> Paste Copied Week
           </button>
           <button className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all">
              <Download className="size-4" /> Export PDF
           </button>
           <button 
              onClick={handlePublish}
              disabled={isPublishing}
              className={`flex items-center gap-2 px-8 py-3 rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl transition-all disabled:opacity-50 ${
                isWeekPublished ? 'bg-success text-white shadow-success/20' : 'bg-primary text-white shadow-primary/20 hover:brightness-110'
              }`}
           >
              {isPublishing ? <Zap className="size-5 animate-spin" /> : <Sparkles className="size-5" />}
              {isPublishing ? 'Publishing...' : 'Publish to POS'}
           </button>
        </div>
      </header>

      {/* Grid Container */}
      <div className="flex-1 min-h-0 bg-slate-100/50 rounded-[40px] border border-slate-200 p-8 overflow-x-auto custom-scrollbar">
        <div className="flex gap-6 h-full min-w-max">
          {getWeekDays().map((day) => {
            // Determine if the day is in the past compared to system Today
            const isPast = day.key < systemDateStr;

            return (
              <div key={day.key} className="w-[340px] flex flex-col gap-4">
                <div className={`text-center py-4 bg-white rounded-[24px] border border-slate-200 shadow-sm sticky top-0 z-10 shrink-0 ${isPast ? 'bg-slate-50 opacity-80' : ''}`}>
                  <div className="flex items-center justify-center gap-2">
                     {isPast && <Lock className="size-3 text-slate-400" />}
                     <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{day.name}</p>
                  </div>
                  <p className="text-3xl font-black text-slate-900 tracking-tighter">{day.date}</p>
                </div>

                <div className={`flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2 pb-4 ${isPast ? 'opacity-80 grayscale-[0.5]' : ''}`}>
                  {config.activeServices.map(service => {
                    const dishes = weeklyAllocations[day.key]?.[service] || [];
                    return (
                      <div key={service} className="bg-white rounded-[32px] border border-slate-200 p-5 shadow-sm group hover:border-primary/30 transition-all">
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">{service} Service</h4>
                          <span className="text-[9px] font-bold text-slate-300 bg-slate-50 px-2 py-1 rounded-lg">{dishes.length} Items</span>
                        </div>
                        
                        <div className="space-y-3 mb-4">
                          {dishes.map((dish) => (
                            <div key={dish.id} className="flex items-center gap-3 p-2 bg-slate-50 rounded-2xl border border-transparent hover:border-slate-200 transition-all group/item relative">
                              <img src={dish.image} className="size-12 rounded-xl object-cover" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-black text-slate-900 truncate">{dish.name}</p>
                                <p className="text-[10px] font-bold text-primary">{formatCurrency(dish.price)}</p>
                              </div>
                              {!isPast && (
                                <button 
                                  onClick={() => removeDish(day.key, service, dish.id)}
                                  className="absolute -top-2 -right-2 p-1.5 bg-white text-danger border border-slate-100 rounded-full shadow-sm opacity-0 group-hover/item:opacity-100 transition-opacity hover:scale-110"
                                >
                                  <X className="size-3" />
                                </button>
                              )}
                            </div>
                          ))}
                          {dishes.length === 0 && (
                            <div className="py-6 text-center border-2 border-dashed border-slate-100 rounded-2xl">
                              <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Empty Slot</p>
                            </div>
                          )}
                        </div>

                        {!isPast ? (
                          <button 
                            onClick={() => openSelector(day.key, service)}
                            className="w-full py-3 border-2 border-dashed border-slate-100 rounded-xl flex items-center justify-center text-[10px] font-black text-slate-400 uppercase tracking-widest hover:border-primary/20 hover:text-primary hover:bg-primary/5 transition-all"
                          >
                            <Plus className="size-3 mr-2" /> Select Dish
                          </button>
                        ) : (
                          <div className="py-3 flex items-center justify-center text-[10px] font-bold text-slate-300 uppercase tracking-widest border-2 border-transparent">
                             <Lock className="size-3 mr-2" /> Locked
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dish Selector Modal */}
      {isSelectorOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[40px] w-full max-w-4xl h-[80vh] shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-8 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-primary/5">
              <div className="flex items-center gap-4">
                <div className="size-14 bg-primary text-white rounded-[24px] flex items-center justify-center shadow-lg shadow-primary/20">
                  <Database className="size-7" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Select Menu Item</h2>
                  <p className="text-[10px] font-black uppercase text-primary tracking-[0.2em] mt-1">
                    Adding to: {targetSlot?.dateKey} • {targetSlot?.service}
                  </p>
                </div>
              </div>
              <button onClick={() => setIsSelectorOpen(false)} className="p-3 bg-white rounded-full text-slate-400 hover:text-danger shadow-sm transition-all"><X className="size-6" /></button>
            </div>

            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400" />
                <input 
                  autoFocus
                  className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl font-bold text-sm focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                  placeholder="Search library..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button className="px-6 bg-white border border-slate-200 rounded-2xl text-slate-500 hover:text-primary transition-all">
                <Filter className="size-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-50/20">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {MEAL_LIBRARY_ITEMS
                  .filter(item => 
                     item.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
                     item.availability.includes('Meal Plan')
                  )
                  .map(item => (
                  <div key={item.id} onClick={() => addDish(item)} className="group bg-white p-4 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl hover:border-primary/20 transition-all cursor-pointer relative overflow-hidden">
                    <div className="aspect-[4/3] bg-slate-100 rounded-[24px] mb-4 overflow-hidden">
                      <img src={item.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 leading-tight mb-1">{item.name}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.category}</p>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-lg font-black text-primary">{formatCurrency(item.price)}</span>
                      <div className="size-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
                        <Plus className="size-4" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Planner;
