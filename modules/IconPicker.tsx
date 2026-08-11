import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { IconEntry, subscribeToIconLibrary } from './store';
import { Portal } from './Portal';

// A small "click to pick" button that opens a search modal over the Icon
// Library (see store.ts) instead of a free-text emoji input — every place
// in Operations that used to be a plain `<input value={emoji} .../>` for a
// Main/add-on's icon is now this, so every icon in the app comes from the
// same curated, admin-managed set (Settings → Icons) rather than whatever
// an admin happened to type or paste.
interface IconPickerButtonProps {
  value: string;
  onChange: (emoji: string) => void;
  className?: string;
  title?: string;
}

export const IconPickerButton: React.FC<IconPickerButtonProps> = ({ value, onChange, className, title }) => {
  const [open, setOpen] = useState(false);
  const [icons, setIcons] = useState<IconEntry[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => subscribeToIconLibrary(setIcons), []);

  const q = search.trim().toLowerCase();
  const filtered = q ? icons.filter(i => i.label.toLowerCase().includes(q) || i.emoji.includes(search.trim())) : icons;

  return (
    <>
      <button
        type="button"
        onClick={() => { setSearch(''); setOpen(true); }}
        title={title || 'Choose an icon'}
        className={className || 'w-12 h-10 flex items-center justify-center text-lg rounded-xl border border-slate-200 hover:border-primary/40 bg-white transition-colors shrink-0'}
      >
        {value || '❓'}
      </button>
      {open && (
        <Portal>
          <div className="fixed inset-0 z-[10100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setOpen(false)}>
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="p-4 border-b border-[#E7E0D0] flex items-center justify-between shrink-0">
                <h3 className="text-sm font-black text-slate-900">Choose an icon</h3>
                <button onClick={() => setOpen(false)} className="p-1.5 text-slate-400 hover:text-danger"><X className="size-4" /></button>
              </div>
              <div className="p-3 border-b border-[#E7E0D0] shrink-0">
                <div className="relative">
                  <Search className="size-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search icons…"
                    autoFocus
                    className="w-full text-xs pl-8 pr-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                {filtered.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 font-medium py-10">No icons match "{search}". Add it in Settings → Icons.</p>
                ) : (
                  <div className="grid grid-cols-6 gap-2">
                    {filtered.map(icon => (
                      <button
                        key={icon.id}
                        onClick={() => { onChange(icon.emoji); setOpen(false); }}
                        title={icon.label}
                        className={`aspect-square flex items-center justify-center text-xl rounded-xl border transition-colors ${value === icon.emoji ? 'border-primary bg-primary/10' : 'border-slate-100 hover:border-primary/30 hover:bg-primary/5'}`}
                      >
                        {icon.emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
};
