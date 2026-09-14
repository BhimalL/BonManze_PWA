# Spec: Per-entity payment method acceptance + configuration

**Working Agreement: fast-path.** No Cloud Function, no `firestore.rules` change (entity writes are already an unrestricted whole-document `isStaffAllowed('tradingEntities','edit')` gate — adding fields doesn't need a new rule). Build the UI/filtering below to match the field names and fallback behavior exactly; the JSX layout itself may follow whatever fits the surrounding form.

**Depends on:** `entity-contact-fields-and-invoice-prefix.md` (same Trading Entity form — apply that one first, this one adds more fields to the same modal) and `payment-methods-managed-collection.md` (this spec filters against the real `paymentMethods` collection that one introduces, not the old hardcoded array).

**Reference:** `BonManzE_InvoicingPaymentMethods_Scope.md` §4, §7 step 4.

---

## 1. `types.ts` — two new `Entity` fields

```ts
export interface Entity {
  ...
  acceptedPaymentMethodIds?: string[];  // absent/empty = accept every active method applicable to the order type — see §3's fallback
  paymentMethodConfig?: { [paymentMethodId: string]: Record<string, string> };  // flat per-method key/value map, e.g. { 'juice-method-id': { 'Phone number': '5xxx xxxx' } }
  ...
}
```
Both optional, both deliberately loose-typed (`Record<string,string>`, not a fixed per-method-type shape) — see the project doc §4 for why (same reasoning as `roles/{roleId}.permissions` being a flat extensible map).

---

## 2. Trading Entity form — method checklist + per-method config editor

Extends the same Add/Edit Entity modal `entity-contact-fields-and-invoice-prefix.md` already adds fields to.

**2a. Form state** — add alongside `entityForm`:
```ts
const [entityAcceptedMethods, setEntityAcceptedMethods] = useState<string[]>([]);
const [entityMethodConfig, setEntityMethodConfig] = useState<Record<string, Record<string, string>>>({});
```
Reset/populate these the same places `entityForm` is reset/populated (the Add button and Edit button handlers): empty on Add, `entity.acceptedPaymentMethodIds || []` / `entity.paymentMethodConfig || {}` on Edit.

**2b. UI** — below the existing field list, a checklist of every **active** method from the `paymentMethods` store (the same `paymentMethods` state Operations already subscribes to via `subscribeToPaymentMethods`, per `payment-methods-managed-collection.md`):
```tsx
<div>
  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Accepted payment methods</label>
  <p className="text-[10px] text-slate-400 mt-0.5">Leave all unchecked to accept every active method — this entity won't narrow anything until you explicitly select methods here.</p>
  <div className="mt-2 space-y-2">
    {paymentMethods.filter(m => m.isActive).map(m => {
      const checked = entityAcceptedMethods.includes(m.id);
      return (
        <div key={m.id} className="border border-slate-100 rounded-xl p-2.5">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <input
              type="checkbox"
              checked={checked}
              onChange={e => setEntityAcceptedMethods(prev =>
                e.target.checked ? [...prev, m.id] : prev.filter(id => id !== m.id)
              )}
            />
            {m.icon} {m.name}
          </label>
          {checked && (
            <div className="mt-2 pl-6 space-y-1.5">
              {/* Generic key/value editor — not a fixed field per method type.
                  A method with no config entries yet shows one empty
                  label/value row to start from; "+ Add detail" appends more. */}
              {Object.entries(entityMethodConfig[m.id] || {}).map(([label, value], idx) => (
                <div key={idx} className="flex gap-1.5">
                  <input
                    placeholder={m.name.toLowerCase().includes('juice') ? 'Phone number' : 'Label'}
                    value={label}
                    onChange={e => setEntityMethodConfig(prev => {
                      const next = { ...(prev[m.id] || {}) };
                      const val = next[label]; delete next[label];
                      next[e.target.value] = val;
                      return { ...prev, [m.id]: next };
                    })}
                    className="w-1/2 border border-slate-200 rounded-lg px-2 py-1 text-xs"
                  />
                  <input
                    placeholder="Value"
                    value={value}
                    onChange={e => setEntityMethodConfig(prev => ({
                      ...prev,
                      [m.id]: { ...(prev[m.id] || {}), [label]: e.target.value },
                    }))}
                    className="w-1/2 border border-slate-200 rounded-lg px-2 py-1 text-xs"
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => setEntityMethodConfig(prev => ({
                  ...prev,
                  [m.id]: { ...(prev[m.id] || {}), ['']: '' },
                }))}
                className="text-[10px] font-black text-primary"
              >
                + Add detail
              </button>
            </div>
          )}
        </div>
      );
    })}
  </div>
</div>
```
(fast-path detail: the exact label-editing interaction above — renaming a key by typing over it — is one reasonable way to build a flat key/value editor; adapt to whatever inline-editable-list pattern already exists elsewhere in this codebase if one fits better, as long as the end result is the same shape: `{ [paymentMethodId]: { [label]: value } }`.)

**2c. Save handler** — the entity `payload` gains:
```ts
acceptedPaymentMethodIds: entityAcceptedMethods,
paymentMethodConfig: entityMethodConfig,
```
Empty-array/empty-object is a valid, meaningful value here (it's the explicit "same as never configured" state) — don't `dropUndefined`-style omit it when empty; write it through as-is so an entity that had methods configured and then has them all unchecked correctly reverts to "accept everything" rather than keeping stale entries.

---

## 3. Checkout / pay-sheet filtering — one more filter pass in both apps

Both existing filters (`CustomerPortal.tsx`'s `applicablePaymentMethods`, per `payment-methods-managed-collection.md`'s §5b change; `Operations.tsx`'s Payments-tab confirm dropdown, per that spec's §5a change) add one more `.filter(...)` on top, keyed off the entity actually relevant to the order/item being paid:

```ts
const entityAccepted = (entity: Entity | undefined, method: PaymentMethod) =>
  !entity?.acceptedPaymentMethodIds?.length || entity.acceptedPaymentMethodIds.includes(method.id);
```

**CustomerPortal.tsx** — `applicablePaymentMethods` needs the current customer's entity. It already has `currentUser`/customer context available (used elsewhere for `currentUser?.entityId`-style lookups per the existing Multi-Entity work); resolve the customer's `Entity` record the same way any other entity-scoped view in this file already does, then:
```ts
const applicablePaymentMethods = useMemo(
  () => paymentMethods.filter(m => m.isActive && m.applicableTo.includes('Meal Plan') && entityAccepted(customerEntity, m)),
  [paymentMethods, customerEntity]
);
```

**Operations.tsx** — the Payments-tab confirm dropdown (~line 6947) is scoped to one `paymentDrop`, which already carries `entityId`/`entityName` (per `DropTask`'s existing shape). Resolve the `Entity` record from the `entities` state array already subscribed in this file:
```tsx
{paymentMethods
  .filter(m => m.isActive && m.applicableTo.includes('Meal Plan') && entityAccepted(entities.find(e => e.id === paymentDrop?.entityId), m))
  .map(m => {
```

Fallback behavior (the permissive empty-list case) is the same `entityAccepted` helper in both places — an entity that has never had this configured (`acceptedPaymentMethodIds` absent or `[]`) accepts every active, applicable method exactly as today. This is the one behavior in this spec that must not regress: confirm with a real entity that has no `acceptedPaymentMethodIds` set that its pay sheet/confirm dropdown looks identical before and after this ships.

---

## 4. What this spec deliberately does not do

- Does not touch `entityBankReference`/the existing "Payment Instructions" receipt block — left exactly as-is, per the project doc's non-goals (§6).
- Does not migrate the *existing* `entityBankReference` field into `paymentMethodConfig` — a future "real Bank Transfer method" is explicitly out of scope here.
- Does not change retiring behavior for a method already referenced on a historical order/item — that's `payment-methods-managed-collection.md`'s concern (methods retiring), unaffected by whether the entity that placed the order had `acceptedPaymentMethodIds` configured or not.
