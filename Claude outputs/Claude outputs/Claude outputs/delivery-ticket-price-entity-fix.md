# Fix: Delivery Ticket — stray item price + wrong (generic) business name

Fast-path (presentational only — reads existing `DropTask` fields already denormalized onto orders at
checkout; no `firestore.rules`/Cloud Function/schema change; no security review gate applies).

**Where:** `modules/Operations.tsx` — there are two separate, near-identical ticket-rendering blocks:
the single "80mm Print Ticket Portal" (`activePrintDrop`, ~line 7050) used when printing one delivery
ticket at a time, and the bulk "Delivery Tickets Print Preview" (`activePrintService.drops.map(...)`,
~line 7170) used when printing a whole service's tickets at once. Both render from the same `DropTask`
type (`entityId?: string; entityName?: string;` among its fields, ~line 253).

## 1. Item price still showing on the single ticket

**Problem:** commit `0edba09` ("remove item prices from printed Delivery Stickers") already shipped —
confirmed correctly applied in the *bulk* template (~line 7263, item rows show only `{item.qty}x
{item.name}`, no price). But the *single*-ticket template is a separate copy-pasted block that fix never
touched — it still renders the price at ~line 7103-7106.

**Current (single-ticket template, ~line 7102-7106):**
```jsx
<div key={idx} className="space-y-0.5">
  <div className="flex justify-between font-bold text-slate-950">
    <span>{item.qty}x {item.name}</span>
    <span>Rs {item.price * item.qty}</span>
  </div>
```

**Change to (match the bulk template's already-correct pattern, ~line 7262-7265):**
```jsx
<div key={idx} className="space-y-0.5">
  <div className="font-bold text-slate-950">
    {item.qty}x {item.name}
  </div>
```

No other lines in that item block change (the `detail`/`person`/`instructions` lines right after stay
exactly as they are).

## 2. Both tickets show the generic system-wide business name, not the order's actual trading entity

**Problem:** both templates' header currently reads `{SYSTEM_CONFIG.businessName}` — a single global
branding string from Settings → Identity, with no awareness of which trading entity the order actually
belongs to. This predates the Multi-Entity system and was never updated. The correct value
(`entityName`, denormalized onto the order at checkout — the same field the Invoicing work relies on) is
already sitting right there on `activePrintDrop`/`drop`, and the right resolution pattern already exists
elsewhere in this same file (Delivery List's entity badges, ~line 6343/6512):
```jsx
drop.entityName || (entities.find(e => e.id === drop.entityId)?.name) || drop.entityId
```

**Single-ticket template, current (~line 7066):**
```jsx
<p className="text-sm font-black uppercase tracking-wider text-slate-900">{SYSTEM_CONFIG.businessName}</p>
```
**Change to:**
```jsx
<p className="text-sm font-black uppercase tracking-wider text-slate-900">{activePrintDrop.entityName || (entities.find(e => e.id === activePrintDrop.entityId)?.name) || activePrintDrop.entityId}</p>
```

**Bulk template, current (~line 7231):**
```jsx
<p className="text-sm font-black uppercase tracking-wider text-slate-900">{SYSTEM_CONFIG.businessName}</p>
```
**Change to:**
```jsx
<p className="text-sm font-black uppercase tracking-wider text-slate-900">{drop.entityName || (entities.find(e => e.id === drop.entityId)?.name) || drop.entityId}</p>
```

Nothing else in either header block changes — the "Delivery Ticket" label line right below stays as-is.

## After applying

- `npx tsc --noEmit` and `npm run build` — this file only.
- Manual check: print a single delivery ticket (the 80mm one) for an order tied to a specific entity —
  confirm no price appears next to any item, and the header shows that order's actual entity name (e.g.
  "Rik's Kitchen"), not the generic business name. Then print a full day/service's tickets in bulk and
  confirm the same on every ticket in that batch, for orders across different entities if more than one
  is present that day.
