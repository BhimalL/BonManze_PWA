
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Plus, Search, Filter, Edit, Store, CheckCircle2, XCircle, ChevronRight, 
  Scale, Calculator, ArrowRightLeft, Database, Globe, Smartphone, Package, X,
  Image as ImageIcon, Trash2, AlertTriangle, Tag, Save, CalendarDays, Power,
  Upload
} from 'lucide-react';
import { MenuItem, Availability, Ingredient } from '../types';
import { 
  formatCurrency, 
  subscribeToMealLibrary, 
  addMealToLibrary, 
  updateMealInLibrary,
  INVENTORY_ITEMS,
  SYSTEM_CONFIG
} from './store';

const MealLibrary: React.FC = () => {
  const [meals, setMeals] = useState<MenuItem[]>([]);
  const [selectedMeal, setSelectedMeal] = useState<MenuItem | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<MenuItem> & { ingredients: Ingredient[] }>({ ingredients: [] });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [newTag, setNewTag] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Subscribe to real data
  useEffect(() => {
    return subscribeToMealLibrary((updatedMeals) => {
      setMeals(updatedMeals);
      // Update selected meal ref if it exists
      if (selectedMeal) {
        const fresh = updatedMeals.find(m => m.id === selectedMeal.id);
        if (fresh) setSelectedMeal(fresh);
      }
    });
  }, [selectedMeal]);

  const uniqueCategories = useMemo(() => {
     return Array.from(new Set(meals.map(m => m.category))).sort();
  }, [meals]);

  const startEdit = (meal?: MenuItem) => {
    if (meal) {
      setEditForm({ ...meal, ingredients: meal.ingredients || [] });
      setImagePreview(meal.image);
    } else {
      setEditForm({
        id: Math.random().toString(36).substr(2, 9),
        name: '',
        category: '',
        price: 0,
        cost: 0,
        status: 'Active',
        availability: ['Dine-In'],
        image: '',
        description: '',
        tags: [],
        ingredients: []
      });
      setImagePreview(null);
    }
    setIsEditing(true);
  };

  const handleSave = () => {
    if (!editForm.name || !editForm.category) {
        alert("Please provide at least a Name and Category.");
        return;
    }

    const cost = editForm.ingredients.reduce((sum, ing) => sum + (ing.cost * ing.qty), 0);
    const finalMeal: MenuItem = {
       ...editForm as MenuItem,
       category: editForm.category, // Captures custom input or selection
       cost: cost,
       ingredients: editForm.ingredients,
       image: imagePreview || 'https://picsum.photos/200/200' // Fallback if no image
    };

    if (meals.find(m => m.id === finalMeal.id)) {
      updateMealInLibrary(finalMeal);
    } else {
      addMealToLibrary(finalMeal);
    }
    setIsEditing(false);
    setSelectedMeal(finalMeal);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setImagePreview(result);
        setEditForm({ ...editForm, image: result });
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleMealStatus = (e: React.MouseEvent, meal: MenuItem) => {
    e.stopPropagation();
    updateMealInLibrary({ ...meal, status: meal.status === 'Active' ? 'Inactive' : 'Active' });
  };

  const totalCost = useMemo(() => {
    if (!editForm?.ingredients) return 0;
    return editForm.ingredients.reduce((sum, ing) => sum + (ing.cost * ing.qty), 0);
  }, [editForm?.ingredients]);

  const addIngredient = () => {
    setEditForm({
      ...editForm,
      ingredients: [...editForm.ingredients, { sku: '', name: '', qty: 1, cost: 0 }]
    });
  };

  const updateIngredient = (idx: number, sku: string) => {
    const inv = INVENTORY_ITEMS.find(s => s.sku === sku);
    if (!inv) return;
    const newIngs = [...editForm.ingredients];
    newIngs[idx] = { ...newIngs[idx], sku: inv.sku, name: inv.name, cost: inv.cost };
    setEditForm({ ...editForm, ingredients: newIngs });
  };

  const updateIngQty = (idx: number, qty: number) => {
    const newIngs = [...editForm.ingredients];
    newIngs[idx] = { ...newIngs[idx], qty };
    setEditForm({ ...editForm, ingredients: newIngs });
  };

  const toggleAvailability = (val: Availability) => {
    const current = editForm.availability || [];
    const updated = current.includes(val) ? current.filter(a => a !== val) : [...current, val];
    setEditForm({ ...editForm, availability: updated });
  };

  const addTag = () => {
     if (newTag && !editForm.tags?.includes(newTag)) {
        setEditForm({ ...editForm, tags: [...(editForm.tags || []), newTag] });
        setNewTag('');
     }
  };

  const removeTag = (tag: string) => {
     setEditForm({ ...editForm, tags: editForm.tags?.filter(t => t !== tag) });
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 relative h-full flex flex-col">
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Meal Library</h1>
          <p className="text-slate-500 font-medium">Synced Source of Truth for all Hospitality Nodes</p>
        </div>
        <button onClick={() => startEdit()} className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 hover:brightness-110 transition-all">
          <Plus className="size-5" /> New Dish Recipe
        </button>
      </div>

      <div className="grid grid-cols-12 gap-8 flex-1 min-h-0">
        <div className="col-span-12 lg:col-span-8 bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <input className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm" placeholder="Search dish database..." />
            </div>
            <button className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-primary transition-all"><Filter className="size-5" /></button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 sticky top-0 z-10">
                <tr>
                  <th className="px-8 py-4">Item Identity</th>
                  <th className="px-6 py-4">Channels</th>
                  <th className="px-6 py-4">Price / Margin</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-8 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {meals.map((meal) => (
                  <tr key={meal.id} onClick={() => setSelectedMeal(meal)} className={`hover:bg-slate-50 transition-colors cursor-pointer group ${selectedMeal?.id === meal.id ? 'bg-primary/5 border-l-4 border-primary' : ''}`}>
                    <td className="px-8 py-5 flex items-center gap-4">
                      <img src={meal.image} className="size-14 rounded-2xl object-cover border border-slate-100 shadow-sm" />
                      <div>
                        <p className="text-sm font-black text-slate-900 group-hover:text-primary transition-colors">{meal.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{meal.category}</p>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex gap-1.5">
                        {meal.availability.includes('Dine-In') && <span title="Dine-In"><Store className="size-3.5 text-primary" /></span>}
                        {meal.availability.includes('Takeout') && <span title="Takeout"><Package className="size-3.5 text-secondary" /></span>}
                        {meal.availability.includes('Online') && <span title="Online"><Globe className="size-3.5 text-accent" /></span>}
                        {meal.availability.includes('Meal Plan') && <span title="Meal Plan"><CalendarDays className="size-3.5 text-slate-400" /></span>}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-slate-900 font-black text-sm">{formatCurrency(meal.price)}</div>
                        <div className="text-[10px] font-black uppercase tracking-tighter text-success">{(((meal.price - meal.cost) / meal.price) * 100).toFixed(0)}% Margin</div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <button 
                        onClick={(e) => toggleMealStatus(e, meal)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                          meal.status === 'Active' 
                            ? 'bg-success/10 text-success hover:bg-success hover:text-white' 
                            : 'bg-slate-100 text-slate-400 hover:bg-slate-900 hover:text-white'
                        }`}
                      >
                        <Power className="size-3" />
                        {meal.status}
                      </button>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <ChevronRight className={`size-5 text-slate-200 group-hover:text-primary transition-all ${selectedMeal?.id === meal.id ? 'translate-x-1 text-primary' : ''}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-6">
          {selectedMeal ? (
            <div className="bg-white rounded-[32px] border border-slate-200 p-8 shadow-xl animate-in slide-in-from-right-4 h-full flex flex-col">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">{selectedMeal.name}</h3>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{selectedMeal.category}</p>
                </div>
                <button onClick={() => startEdit(selectedMeal)} className="p-3 bg-slate-50 text-slate-400 hover:text-primary rounded-xl transition-all"><Edit className="size-5" /></button>
              </div>

              <div className="p-5 bg-slate-900 rounded-3xl text-white mb-8 text-center">
                <p className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em] mb-1">Plate Cost Analysis</p>
                <p className="text-4xl font-black text-primary">{formatCurrency(selectedMeal.cost)}</p>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6">
                <div>
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 pb-2 mb-4">Recipe Composition</h4>
                  <div className="space-y-3">
                    {selectedMeal.ingredients?.map((ing, i) => (
                      <div key={i} className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <div>
                          <p className="text-xs font-black text-slate-700">{ing.name}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{ing.sku} • {ing.qty} Unit</p>
                        </div>
                        <p className="text-xs font-black text-slate-900">{formatCurrency(ing.cost * ing.qty)}</p>
                      </div>
                    ))}
                    {(!selectedMeal.ingredients || selectedMeal.ingredients.length === 0) && (
                      <p className="text-xs font-bold text-slate-400 italic text-center py-4">No linked inventory items.</p>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 pb-2 mb-4">Sales Channels</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedMeal.availability.map((channel) => (
                      <span key={channel} className="px-3 py-1.5 bg-slate-100 rounded-lg text-[10px] font-black uppercase text-slate-600 tracking-widest border border-slate-200">
                        {channel}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center p-8 opacity-60">
              <Scale className="size-16 text-slate-300 mb-4" />
              <h3 className="text-lg font-black text-slate-400 uppercase tracking-widest">Select Item for Costing</h3>
              <p className="text-xs font-bold text-slate-300 mt-2 max-w-xs">View ingredient breakdown, margins, and channel availability.</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal - Rendered via Portal for Full Screen Fix */}
      {isEditing && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] w-full max-w-4xl h-[90vh] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-primary/5 shrink-0">
              <div className="flex items-center gap-4">
                <div className="size-14 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg">
                  <Edit className="size-7" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">{editForm.id && meals.find(m => m.id === editForm.id) ? 'Edit Recipe Profile' : 'New Menu Item'}</h2>
                  <p className="text-[10px] font-black uppercase text-primary tracking-[0.2em] mt-1">Master Database Entry</p>
                </div>
              </div>
              <button onClick={() => setIsEditing(false)} className="p-3 bg-white rounded-full text-slate-400 hover:text-danger shadow-sm transition-all"><X className="size-6" /></button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50/50">
              <div className="grid grid-cols-1 md:grid-cols-12 min-h-full">
                {/* Left: Basic Info */}
                <div className="col-span-12 md:col-span-5 p-8 border-b md:border-b-0 md:border-r border-slate-100 bg-white space-y-8">
                  <div className="space-y-6">
                    <div 
                      className="aspect-video bg-slate-100 rounded-3xl relative overflow-hidden group border-2 border-dashed border-slate-200 hover:border-primary transition-all cursor-pointer flex items-center justify-center"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleImageUpload}
                      />
                      {imagePreview ? (
                        <>
                          <img src={imagePreview} className="w-full h-full object-cover" alt="Preview" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                             <p className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-2"><Upload className="size-4" /> Change Image</p>
                          </div>
                        </>
                      ) : (
                        <div className="text-center text-slate-400">
                          <ImageIcon className="size-10 mx-auto mb-2 opacity-50" />
                          <p className="text-[10px] font-black uppercase tracking-widest">Click to Upload</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Item Name</label>
                        <input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-primary/20" placeholder="e.g. Wagyu Burger" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Category</label>
                          <input 
                            list="categories" 
                            value={editForm.category} 
                            onChange={e => setEditForm({...editForm, category: e.target.value})} 
                            className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-primary/20"
                            placeholder="Select or Type..." 
                          />
                          <datalist id="categories">
                             {uniqueCategories.map(c => <option key={c} value={c} />)}
                          </datalist>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Selling Price</label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">{SYSTEM_CONFIG.currencySymbol}</span>
                            <input type="number" value={editForm.price} onChange={e => setEditForm({...editForm, price: parseFloat(e.target.value)})} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-primary/20" />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Recipe Description</label>
                        <textarea 
                          value={editForm.description} 
                          onChange={e => setEditForm({...editForm, description: e.target.value})} 
                          className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 h-24 resize-none" 
                          placeholder="Describe the flavor profile, key ingredients, and prep method..." 
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Sales Channels</label>
                        <div className="flex flex-wrap gap-2">
                          {['Dine-In', 'Takeout', 'Online', 'Meal Plan'].map((ch: any) => (
                            <button 
                              key={ch}
                              onClick={() => toggleAvailability(ch)}
                              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${
                                editForm.availability?.includes(ch) 
                                  ? 'bg-primary text-white border-primary' 
                                  : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              {ch}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Tags & Allergens</label>
                         <div className="flex flex-wrap gap-2 mb-2">
                            {editForm.tags?.map((tag: string) => (
                               <span key={tag} className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[9px] font-black uppercase flex items-center gap-1">
                                  {tag} <button onClick={() => removeTag(tag)}><X className="size-3 hover:text-danger" /></button>
                               </span>
                            ))}
                         </div>
                         <div className="flex gap-2">
                            <input value={newTag} onChange={e => setNewTag(e.target.value)} className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" placeholder="Add tag..." onKeyDown={e => e.key === 'Enter' && addTag()} />
                            <button onClick={addTag} className="px-4 py-2 bg-slate-100 rounded-xl hover:bg-slate-200"><Plus className="size-4 text-slate-500" /></button>
                         </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Recipe & Costing */}
                <div className="col-span-12 md:col-span-7 p-8 space-y-8">
                  <div className="bg-white rounded-[32px] border border-slate-200 p-6 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-black text-slate-900">Recipe Composition</h3>
                      <button onClick={addIngredient} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all">
                        <Plus className="size-3" /> Add Component
                      </button>
                    </div>
                    
                    <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                      {editForm.ingredients?.map((ing, idx) => (
                        <div key={idx} className="flex gap-3 items-start p-3 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-primary/30 transition-all">
                          <div className="flex-1 space-y-1">
                            <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Inventory SKU</label>
                            <select 
                              value={ing.sku} 
                              onChange={(e) => updateIngredient(idx, e.target.value)}
                              className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10"
                            >
                              <option value="">Select Item...</option>
                              {INVENTORY_ITEMS.map(sku => (
                                <option key={sku.sku} value={sku.sku}>{sku.name} ({formatCurrency(sku.cost)}/{sku.unit})</option>
                              ))}
                            </select>
                          </div>
                          <div className="w-24 space-y-1">
                            <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Qty</label>
                            <input 
                              type="number" 
                              value={ing.qty} 
                              onChange={(e) => updateIngQty(idx, parseFloat(e.target.value))}
                              className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none text-center" 
                            />
                          </div>
                          <div className="w-24 text-right pt-6">
                            <p className="text-sm font-black text-slate-900">{formatCurrency(ing.cost * ing.qty)}</p>
                          </div>
                          <button 
                            onClick={() => setEditForm({...editForm, ingredients: editForm.ingredients.filter((_, i) => i !== idx)})}
                            className="p-2 mt-4 text-slate-300 hover:text-danger hover:bg-danger/10 rounded-lg transition-all"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      ))}
                      {editForm.ingredients?.length === 0 && (
                        <div className="p-8 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
                          <Database className="size-8 mx-auto mb-2 opacity-50" />
                          <p className="text-[10px] font-black uppercase tracking-widest">No ingredients linked</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-slate-900 p-6 rounded-[28px] text-white flex flex-col justify-between">
                      <p className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em]">Total Cost</p>
                      <p className="text-3xl font-black text-primary">{formatCurrency(totalCost)}</p>
                    </div>
                    <div className="bg-white border border-slate-200 p-6 rounded-[28px] flex flex-col justify-between">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Gross Margin</p>
                      <div className="flex items-end gap-2">
                        <p className={`text-3xl font-black ${(( (editForm.price || 0) - totalCost) / (editForm.price || 1)) < 0.3 ? 'text-danger' : 'text-success'}`}>
                          {(editForm.price || 0) > 0 ? ((( (editForm.price || 0) - totalCost) / (editForm.price || 1)) * 100).toFixed(1) : 0}%
                        </p>
                        {(( (editForm.price || 0) - totalCost) / (editForm.price || 1)) < 0.3 && <AlertTriangle className="size-6 text-danger mb-1" />}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 border-t border-slate-100 bg-white flex justify-end gap-4 shrink-0">
              <button onClick={() => setIsEditing(false)} className="px-8 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">Discard</button>
              <button onClick={handleSave} className="px-12 py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2">
                <Save className="size-4" /> Save Profile
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default MealLibrary;
