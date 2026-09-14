# Feature: Orders by Dish — filter by whether an entity has a Partner assigned

Fast-path (presentational + a new client-side derived value from data already loaded; no
`firestore.rules`/Cloud Function/schema change — `staff.isPartner`/`assignedEntityIds` already exist and
are already loaded into `staffListRaw`).

**Scope, confirmed with Bhimal (2026-09-13):** two checkboxes on the admin's Orders by Dish view only
(NOT Delivery List/Payments/Customer Directory, which share the same entity-filter component but are out
of scope here). "Partner-assigned only" shows orders for entities that currently have at least one
**active** Partner-role staff member assigned to them (`staff.isPartner === true && staff.active !== false
&& staff.assignedEntityIds` includes that entity). "No partner assigned" shows the inverse — entities
with no active Partner currently assigned, i.e. the ones run fully in-house. Checking one clears the
other; unchecking either returns to today's unfiltered view. Partners themselves never see these
checkboxes — they're already hard-locked to their own assigned entities and have no use for this.

**Why this is scoped separately from the existing entity dropdown/`entityFilter`:** `entityFilter` and
`lines` (the shared, entity-filtered order-item list, ~line 1386) are used by multiple tabs (Dashboard,
Orders by Dish, and others) — touching them would risk affecting tabs Bhimal didn't ask about. Instead,
this filter is applied entirely inside `dishesByDay` (~line 1425), which is Orders-by-Dish-only, using a
new, separate piece of local state. Nothing shared (`entityFilter`, `filterEntitiesList`,
`renderEntityFilterToggle`, `lines`) is touched.

## 1. New derived value — which entities currently have an active Partner assigned

Add near the other entity-related `useMemo`s (e.g. right after `filterEntitiesList`, ~line 1383):

```jsx
const entitiesWithActivePartner = useMemo(() => {
  const set = new Set<string>();
  staffListRaw.forEach(s => {
    if (s.isPartner === true && s.active !== false) {
      (s.assignedEntityIds || []).forEach(id => set.add(id));
    }
  });
  return set;
}, [staffListRaw]);
```

## 2. New local state for the two checkboxes

Add alongside the other Orders-by-Dish-specific state (`ordersWeekFilter`/`ordersDayFilter`/
`ordersServiceFilter`):

```jsx
const [ordersPartnerFilter, setOrdersPartnerFilter] = useState<'all' | 'partnerOnly' | 'noPartner'>('all');
```

## 3. Apply the filter inside `dishesByDay`'s aggregation loop

**Current (~line 1434-1436):**
```jsx
lines.forEach(({ item }) => {
  const day = item.deliveryDate || '';
  if (!allOrdersDateKeys.has(day)) return;
```

**Change to:**
```jsx
lines.forEach(({ item }) => {
  const day = item.deliveryDate || '';
  if (!allOrdersDateKeys.has(day)) return;
  if (ordersPartnerFilter === 'partnerOnly' && !entitiesWithActivePartner.has(item.entityId || '')) return;
  if (ordersPartnerFilter === 'noPartner' && entitiesWithActivePartner.has(item.entityId || '')) return;
```

And add the two new values to `dishesByDay`'s dependency array (~line 1456):
```jsx
}, [lines, allOrdersDateKeys, ordersPartnerFilter, entitiesWithActivePartner]);
```

## 4. UI — two checkboxes next to the existing entity filter, admin-only

**Where:** the Orders by Dish filter bar, ~line 6118-6119 (confirmed via `ordersWeekFilter`/"This
week"/"Next week" context right above it — this is the Orders by Dish call site, not one of the other
three `renderEntityFilterToggle()` call sites in Delivery List/Payments/Customer Directory).

**Current:**
```jsx
<div className="pt-2 border-t border-slate-100 mt-2 flex items-center justify-between">
  {renderEntityFilterToggle()}
</div>
```

**Change to:**
```jsx
<div className="pt-2 border-t border-slate-100 mt-2 flex items-center justify-between flex-wrap gap-2">
  {renderEntityFilterToggle()}
  {!isPartner && (
    <div className="flex items-center gap-3">
      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer">
        <input
          type="checkbox"
          checked={ordersPartnerFilter === 'partnerOnly'}
          onChange={e => setOrdersPartnerFilter(e.target.checked ? 'partnerOnly' : 'all')}
          className="accent-primary size-3.5"
        />
        Partner-assigned only
      </label>
      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer">
        <input
          type="checkbox"
          checked={ordersPartnerFilter === 'noPartner'}
          onChange={e => setOrdersPartnerFilter(e.target.checked ? 'noPartner' : 'all')}
          className="accent-primary size-3.5"
        />
        No partner assigned
      </label>
    </div>
  )}
</div>
```
(`flex-wrap gap-2` added to the outer container so the new checkboxes wrap cleanly on a narrow screen
instead of overflowing — cosmetic, not required for the logic to work.)

Since `isPartner` is always `false`/`undefined` for the admin viewing this tab, the checkboxes are simply
never rendered in a Partner's own session — no separate gating logic needed beyond the existing
`isPartner` flag already in scope in this component.

## After applying

- `npx tsc --noEmit` and `npm run build` — this file only.
- Manual check, as admin: with at least one entity carrying an active Partner assignment and at least one
  without, confirm "Partner-assigned only" shows just the dishes/orders for partner-managed entities, "No
  partner assigned" shows just the rest, and unchecking both returns to today's full unfiltered view.
  Confirm Dashboard's KPI cards and every other tab (Delivery List, Payments, Customer Directory) are
  completely unaffected — they don't share this new state at all. Confirm a Partner's own session shows no
  trace of these two checkboxes.
