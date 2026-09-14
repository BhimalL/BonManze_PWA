# Fix: Customer CRM "Assigned Trading Entity" dropdown shows stale placeholder text

Fast-path (presentational — a hardcoded `<select>` becomes a `.map()` over already-loaded live
data, matching the pattern already used two fields above it in the same modal; no
`firestore.rules`/Cloud Function/schema change, no new data).

**Root cause:** in the Edit Customer CRM modal, `modules/Operations.tsx` (~line 7039-7050), the
"Assigned Trading Entity" `<select>` has two permanently hardcoded options —
`<option value="entity-a">Entity A (PLACEHOLDER ENTITY A LTD)</option>` and the `entity-b`
equivalent — instead of mapping over the live `entities` array. This is inconsistent with the
"Customer Group" `<select>` immediately above it in the same modal (~line 7025-7036), which
correctly does `{customerGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}`.
Since Bhimal renamed the two Trading Entities to "BonMazE" and "Rik's Kitchen" this week, this
dropdown has been showing the old placeholder labels even though the entities themselves are
current — and it will silently go stale again the next time an entity is renamed, added, or
retired, since it isn't reading from `entities` at all.

## The fix

**Where:** `modules/Operations.tsx`, the "Assigned Trading Entity" `<select>` in the Edit Customer
CRM modal (~line 7039-7050).

**Current:**
```jsx
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Assigned Trading Entity</label>
                        <select
                          value={editCustEntityId}
                          onChange={e => setEditCustEntityId(e.target.value)}
                          className="w-full text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all cursor-pointer"
                        >
                          <option value="">Unassigned</option>
                          <option value="entity-a">Entity A (PLACEHOLDER ENTITY A LTD)</option>
                          <option value="entity-b">Entity B (PLACEHOLDER ENTITY B LTD)</option>
                        </select>
                      </div>
```

**Change to (the two hardcoded options replaced with a `.map()` over `entities`, same pattern as
`customerGroups.map()` directly above):**
```jsx
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Assigned Trading Entity</label>
                        <select
                          value={editCustEntityId}
                          onChange={e => setEditCustEntityId(e.target.value)}
                          className="w-full text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white transition-all cursor-pointer"
                        >
                          <option value="">Unassigned</option>
                          {entities.map(ent => (
                            <option key={ent.id} value={ent.id}>{ent.name}</option>
                          ))}
                        </select>
                      </div>
```

`entities` is already loaded and in scope in this component (it's the same array `entities.find(...)`
and the Edit/Add Staff modals' "Assigned Trading Entities" checklists already read from) — no new
fetch or state needed.

## After applying

- `npx tsc --noEmit` and `npm run build` — this file only.
- Manual check: open Customer Directory → edit a customer with an assigned entity, confirm the
  dropdown shows the real current entity names ("BonMazE" / "Rik's Kitchen") instead of the old
  placeholder text, and that selecting a different entity and saving still works as before.
