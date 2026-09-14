# Two fixes, both verified against the live source just now — apply exactly as given

Both pieces below were checked directly against the actual files on the repo (not from memory or
documentation) before being written. Apply verbatim — no rephrasing, no "equivalent" alternatives, no
additional changes beyond what's specified. Two separate commits, please, one per section.

---

# Part A — `functions/index.js`: targeted `mains` cost lookup (replaces the full-collection-read design)

**File:** `functions/index.js` ONLY. This is a Cloud Function / write-path change (financial data) — apply
verbatim, do not improvise.

## Background

`AddOnOption.cost` and `MainDish.cost` already exist (admin-only, never shown to customers). Neither is wired
into checkout yet. A day-slot dish (`CurryOption`, what `findDish()` resolves) carries `mainId` — the
reference back to its Meal Library Main — set by `pickMainForDay` when a dish is added to a day slot. This is
the reliable, already-existing reference to use; it comes from the day-slot dish object the server itself
resolves, never from anything the client submits (the client payload has no `mainId`, `name`, or `price`
field at all — confirmed directly against `confirmCheckout`'s destructuring of `raw`).

Two call sites price an item and both need this: `confirmCheckout` (prices every new item) and
`editOrderItemSelection` (re-prices one item on a post-checkout selection edit).

## Change 1 — `confirmCheckout`: add a memoized per-dish cost lookup (insert after `getWeekOverride`, before `findDish`, around line 334)

```js
// BEFORE (existing code, unchanged above this point)
  const weekOverrideCache = new Map();
  const getWeekOverride = async (weekStart) => {
    if (weekOverrideCache.has(weekStart)) return weekOverrideCache.get(weekStart);
    const snap = await db.collection('menuWeeks').doc(weekStart).get();
    const data = snap.exists ? snap.data() : {};
    weekOverrideCache.set(weekStart, data);
    return data;
  };

  const findDish = async (deliveryDate, service, curryId) => {

// AFTER — new block inserted between the two, findDish unchanged below it
  const weekOverrideCache = new Map();
  const getWeekOverride = async (weekStart) => {
    if (weekOverrideCache.has(weekStart)) return weekOverrideCache.get(weekStart);
    const snap = await db.collection('menuWeeks').doc(weekStart).get();
    const data = snap.exists ? snap.data() : {};
    weekOverrideCache.set(weekStart, data);
    return data;
  };

  // Per-dish food cost, resolved from the linked Main and memoized — same
  // pattern as weekOverrideCache/getWeekOverride above: bounded to the
  // distinct dishes actually referenced in this cart (typically 1-5), never
  // a full `mains` collection read. dish.mainId is unset for a freehand
  // day-slot dish never linked to a Meal Library Main — cost is 0 for the
  // main-dish portion in that case, consistent with cost being optional
  // everywhere else in the catalogs.
  const mainsCostCache = new Map();
  const getMainCost = async (mainId) => {
    if (!mainId) return 0;
    if (mainsCostCache.has(mainId)) return mainsCostCache.get(mainId);
    const snap = await db.collection('mains').doc(mainId).get();
    const cost = snap.exists ? (snap.data().cost || 0) : 0;
    mainsCostCache.set(mainId, cost);
    return cost;
  };

  const findDish = async (deliveryDate, service, curryId) => {
```

## Change 2 — `confirmCheckout`: compute and snapshot `cost` per item (around line 386-395)

```js
// BEFORE
    const price = (dish.price || 0) + (base?.up || 0) + (dhal?.price || 0) + (salad?.price || 0) + (beverage?.price || 0) + (dessert?.price || 0);

    const parsed = splitNotesTag(note);

    priced.push({
      itemId: curryId,
      name: `${dish.emoji || ''} ${dish.name || 'Meal'}`.trim(),
      qty: 1,
      price,
      notes: typeof note === 'string' ? note.slice(0, 500) : '',

// AFTER
    const price = (dish.price || 0) + (base?.up || 0) + (dhal?.price || 0) + (salad?.price || 0) + (beverage?.price || 0) + (dessert?.price || 0);

    // Food cost for this item, snapshotted NOW — same reasoning as
    // tierAtOrder below: Main/Add-On costs are admin-editable at any time,
    // so freezing the resolved cost at order time keeps historical profit
    // figures from silently drifting if a cost figure is corrected later.
    // Admin-only, never shown to the customer. dish.mainId comes from the
    // day-slot dish findDish() just resolved server-side above, never from
    // client input — same trust model as `price`.
    const mainCost = await getMainCost(dish.mainId);
    const addOnCost = (base?.cost || 0) + (dhal?.cost || 0) + (salad?.cost || 0) + (beverage?.cost || 0) + (dessert?.cost || 0);
    const cost = mainCost + addOnCost;

    const parsed = splitNotesTag(note);

    priced.push({
      itemId: curryId,
      name: `${dish.emoji || ''} ${dish.name || 'Meal'}`.trim(),
      qty: 1,
      price,
      cost,
      notes: typeof note === 'string' ? note.slice(0, 500) : '',
```

No change needed where `priced` items are written (the `priced.forEach` / `tx.set(itemRef, { ...itemFields,
... })` block later) — it already spreads every field, so `cost` flows through automatically.

## Change 3 — `editOrderItemSelection`: compute and persist the re-resolved cost (around line 890)

```js
// BEFORE
  const newPrice = (dish.price || 0) + (base?.up || 0) + (dh?.price || 0) + (sl?.price || 0) + (beverage?.price || 0) + (dessert?.price || 0);

  // Recalculate notes string:

// AFTER
  const newPrice = (dish.price || 0) + (base?.up || 0) + (dh?.price || 0) + (sl?.price || 0) + (beverage?.price || 0) + (dessert?.price || 0);

  // Re-resolve cost the same way confirmCheckout does, for the same reason:
  // the customer just changed what's actually in this item, so its frozen
  // cost from the original selection is now stale and must be re-snapshotted
  // against the CURRENT catalog costs. dish.mainId comes from the day-slot
  // dish resolved a few lines above (daySource.find(...)), never from client
  // input. This function only prices one item per call, so a direct get()
  // here is simplest — no cache needed the way confirmCheckout's loop does.
  const mainCostSnap = dish.mainId ? await db.collection('mains').doc(dish.mainId).get() : null;
  const newMainCost = mainCostSnap && mainCostSnap.exists ? (mainCostSnap.data().cost || 0) : 0;
  const newAddOnCost = (base?.cost || 0) + (dh?.cost || 0) + (sl?.cost || 0) + (beverage?.cost || 0) + (dessert?.cost || 0);
  const newCost = newMainCost + newAddOnCost;

  // Recalculate notes string:
```

```js
// BEFORE
    // 1. Update the item
    tx.update(itemRef, {
      price: newPrice,
      notes: newNotes,
      name: `${dish.emoji || ''} ${dish.name || 'Meal'}`.trim(),
      baseId: baseId || '',
      dhalId: dhalId || 'none',
      saladId: saladId || 'none',
      beverageId: beverageId || 'none',
      dessertId: dessertId || 'none',
      instructions: finalInstructions,
      updatedAt: Timestamp.now()
    });

// AFTER
    // 1. Update the item
    tx.update(itemRef, {
      price: newPrice,
      cost: newCost,
      notes: newNotes,
      name: `${dish.emoji || ''} ${dish.name || 'Meal'}`.trim(),
      baseId: baseId || '',
      dhalId: dhalId || 'none',
      saladId: saladId || 'none',
      beverageId: beverageId || 'none',
      dessertId: dessertId || 'none',
      instructions: finalInstructions,
      updatedAt: Timestamp.now()
    });
```

## Do NOT touch

- `calculateItemsTotal` — cost never factors into price/discount/VAT/total, no change needed.
- `firestore.rules` — both writes happen via the Admin SDK (`tx.set`/`tx.update`), which bypasses security
  rules; no rules change needed.
- `Operations.tsx` or the CSV export — a separate follow-up, not part of this fix.
- Old orders placed before this ships simply won't have a `cost` field on their items — no retroactive
  rewrite, matches every other field added this way in this project.

## Verify before committing

1. `npx tsc --noEmit` clean.
2. Full automated suite (`testCheckoutFlow.js`, `testOrderEditCancel.js`, `testMultiEntity.js`,
   `testSettingsRBAC.js`).
3. Against the local emulator: set a `cost` on a Main and on one option in each of the 5 Add-On Catalogs (via
   Settings → Meal Library). Place an order using that Main and those add-ons; confirm the created
   `orders/{id}/items/{itemId}` document has `cost` equal to the Main's cost plus the add-ons' costs — check
   directly in the emulator's Firestore data. Place a second order using a dish with no `mainId` (freehand,
   not linked to a Main) — confirm its `cost` is just the add-on total, not an error or `undefined`. Edit the
   first order's item selection via `editOrderItemSelection` — confirm `cost` updates to match the new
   selection. Confirm price/discount/VAT/total are completely unaffected in every case.
4. Confirm an order placed before this change still loads and displays normally everywhere — nothing should
   assume `cost` exists.

Commit as its own fix, e.g. `feat(functions): snapshot per-item food cost via targeted mains lookup`.

---

# Part B — `modules/Operations.tsx`: wire Meal Library dish photo upload to Firebase Storage

**File:** `modules/Operations.tsx` ONLY. Mirrors the exact pattern already shipping for entity logos in this
same file (`uploadBytes`/`getDownloadURL`/`storageRef`, all already imported — no new imports needed).

## Background

Verified directly against the live source: `CurryOption.photoUrl?: string` (`store.ts`) is the actual field
name in code today — it has **not** been renamed to `photoStoragePath` anywhere in the app (that name only
appears in `BonManzE_Firestore_Schema.md`'s design notes, describing intent, not what the code actually does).
This fix does **not** rename the field — renaming it would touch `dishPhotoFor()`, every read site, and the
Firestore documents themselves, for no real benefit. It keeps `photoUrl` as the field name and Storage path
convention already used for entity logos (`entities/{entityId}/logo` — no forced extension), just changes
**what value gets stored in it**: a short Storage download URL instead of a large base64 data-URL string, so
a photo never risks Firestore's 1MiB-per-document cap. Live-verified in `storage.rules`: dish photos are
public-read, `mealLibrary`-edit-gated write, at `dishPhotos/{allPaths=**}` — this fix uploads to
`dishPhotos/mains/{mainId}`, matching that rule.

Today's flow (`handleMainPhotoFileChange`, ~line 1779): a chosen file is read via `FileReader.readAsDataURL`
directly into `mainForm.photoUrl`, which is both the live preview source and, unchanged, what gets written to
Firestore in `saveMainEditor`. This fix splits those two: a lightweight local preview (via
`URL.createObjectURL`, not base64) while a new file is pending, and the actual raw `File` uploaded to Storage
only at Save time — mirroring exactly how the entity logo Save button already works (~line 5296-5308:
`entityLogoFile` state, uploaded inside the async Save handler, only when a new file was actually picked).

## Change 1 — add two new pieces of state (right after the existing `mainPhotoError` declaration, ~line 502-503)

```tsx
// BEFORE
  // Photo upload error, shown inline near the field — same pattern as
  // logoError/csvError elsewhere rather than a blocking alert().
  const [mainPhotoError, setMainPhotoError] = useState('');
  const mainPhotoFileInputRef = useRef<HTMLInputElement>(null);

// AFTER
  // Photo upload error, shown inline near the field — same pattern as
  // logoError/csvError elsewhere rather than a blocking alert().
  const [mainPhotoError, setMainPhotoError] = useState('');
  const mainPhotoFileInputRef = useRef<HTMLInputElement>(null);
  // The raw picked file, uploaded to Storage only at Save time — mirrors
  // entityLogoFile's role in the Trading Entities Save handler. null means
  // "no new photo picked this edit session" (keep whatever's already saved).
  const [mainPhotoFile, setMainPhotoFile] = useState<File | null>(null);
  const [mainPhotoUploading, setMainPhotoUploading] = useState(false);
```

## Change 2 — `startAddMain`/`startEditMain`: reset the pending-file state (~line 1747-1771)

```tsx
// BEFORE
  const startAddMain = () => {
    setMainEditor({ mode: 'add' });
    setMainPhotoError('');
    setMainForm({

// AFTER
  const startAddMain = () => {
    setMainEditor({ mode: 'add' });
    setMainPhotoError('');
    setMainPhotoFile(null);
    setMainForm({
```

```tsx
// BEFORE
  const startEditMain = (main: MainDish) => {
    setMainEditor({ mode: 'edit', mainId: main.id });
    setMainPhotoError('');
    setMainForm({

// AFTER
  const startEditMain = (main: MainDish) => {
    setMainEditor({ mode: 'edit', mainId: main.id });
    setMainPhotoError('');
    setMainPhotoFile(null);
    setMainForm({
```

## Change 3 — `handleMainPhotoFileChange`: lightweight preview + keep the raw file (~line 1779-1791)

```tsx
// BEFORE
  const handleMainPhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setMainPhotoError('Please choose an image file.'); return; }
    if (file.size > 1_500_000) { setMainPhotoError('That image is over 1.5MB — pick a smaller file.'); return; }
    setMainPhotoError('');
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setMainForm(f => ({ ...f, photoUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

// AFTER
  const handleMainPhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setMainPhotoError('Please choose an image file.'); return; }
    if (file.size > 1_500_000) { setMainPhotoError('That image is over 1.5MB — pick a smaller file.'); return; }
    setMainPhotoError('');
    setMainPhotoFile(file);
    // Lightweight local preview only (never written to Firestore) — the
    // actual upload happens in saveMainEditor. Object URL instead of
    // FileReader/base64 so nothing large ever sits in component state.
    setMainForm(f => ({ ...f, photoUrl: URL.createObjectURL(file) }));
  };
```

## Change 4 — "Remove" button also clears the pending file (~line 3250-3252)

```tsx
// BEFORE
                      {mainForm.photoUrl && (
                        <button type="button" onClick={() => setMainForm(f => ({ ...f, photoUrl: '' }))} className="text-[11px] font-bold text-slate-400 hover:text-red-500">Remove</button>
                      )}

// AFTER
                      {mainForm.photoUrl && (
                        <button type="button" onClick={() => { setMainPhotoFile(null); setMainForm(f => ({ ...f, photoUrl: '' })); }} className="text-[11px] font-bold text-slate-400 hover:text-red-500">Remove</button>
                      )}
```

## Change 5 — `saveMainEditor`: upload the pending file to Storage before writing (~line 1808-1839)

```tsx
// BEFORE
  const saveMainEditor = () => {
    if (!mainEditor) return;
    if (!mainForm.name.trim()) return;
    const parsedPrice = parseInt(mainForm.price, 10);
    const parsedCost = parseFloat(mainForm.cost);
    const patch: Partial<Omit<MainDish, 'id'>> = {
      emoji: mainForm.emoji.trim() || '🍽️',
      name: mainForm.name.trim(),
      desc: mainForm.desc.trim(),
      price: isNaN(parsedPrice) ? 0 : parsedPrice,
      cost: mainForm.cost.trim() === '' || isNaN(parsedCost) ? undefined : parsedCost,
      photoUrl: mainForm.photoUrl.trim() || undefined,
      baseApplicable: mainForm.baseApplicable,
      baseOptionIds: mainForm.baseOptionIds ?? undefined,
      dhalApplicable: mainForm.dhalApplicable,
      dhalOptionIds: mainForm.dhalOptionIds ?? undefined,
      saladApplicable: mainForm.saladApplicable,
      saladOptionIds: mainForm.saladOptionIds ?? undefined,
      beverageApplicable: mainForm.beverageApplicable,
      beverageOptionIds: mainForm.beverageOptionIds ?? undefined,
      dessertApplicable: mainForm.dessertApplicable,
      dessertOptionIds: mainForm.dessertOptionIds ?? undefined
    };
    if (mainEditor.mode === 'add') {
      runMenuWrite(addMainDish({
        id: `main-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        ...patch
      } as MainDish));
    } else if (mainEditor.mainId) {
      runMenuWrite(updateMainDish(mainEditor.mainId, patch));
    }
    setMainEditor(null);

// AFTER
  const saveMainEditor = async () => {
    if (!mainEditor) return;
    if (!mainForm.name.trim()) return;
    const parsedPrice = parseInt(mainForm.price, 10);
    const parsedCost = parseFloat(mainForm.cost);

    const newMainId = mainEditor.mode === 'add'
      ? `main-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      : mainEditor.mainId!;

    // Upload the newly-picked photo to Storage now, if there is one — same
    // pattern as the Trading Entities Save handler's entityLogoFile upload.
    // If no new file was picked, photoUrl is left exactly as it already was
    // (the previously-saved download URL, or '' if removed/never set) —
    // nothing re-uploads on every save, only when a photo actually changed.
    let photoUrl = mainForm.photoUrl.trim() || undefined;
    if (mainPhotoFile) {
      setMainPhotoUploading(true);
      try {
        const photoRef = storageRef(storage, `dishPhotos/mains/${newMainId}`);
        await uploadBytes(photoRef, mainPhotoFile);
        photoUrl = await getDownloadURL(photoRef);
      } catch (err) {
        setMainPhotoError(err instanceof Error ? err.message : 'Failed to upload photo — please try again.');
        setMainPhotoUploading(false);
        return;
      }
      setMainPhotoUploading(false);
    }

    const patch: Partial<Omit<MainDish, 'id'>> = {
      emoji: mainForm.emoji.trim() || '🍽️',
      name: mainForm.name.trim(),
      desc: mainForm.desc.trim(),
      price: isNaN(parsedPrice) ? 0 : parsedPrice,
      cost: mainForm.cost.trim() === '' || isNaN(parsedCost) ? undefined : parsedCost,
      photoUrl,
      baseApplicable: mainForm.baseApplicable,
      baseOptionIds: mainForm.baseOptionIds ?? undefined,
      dhalApplicable: mainForm.dhalApplicable,
      dhalOptionIds: mainForm.dhalOptionIds ?? undefined,
      saladApplicable: mainForm.saladApplicable,
      saladOptionIds: mainForm.saladOptionIds ?? undefined,
      beverageApplicable: mainForm.beverageApplicable,
      beverageOptionIds: mainForm.beverageOptionIds ?? undefined,
      dessertApplicable: mainForm.dessertApplicable,
      dessertOptionIds: mainForm.dessertOptionIds ?? undefined
    };
    if (mainEditor.mode === 'add') {
      runMenuWrite(addMainDish({ id: newMainId, ...patch } as MainDish));
    } else if (mainEditor.mainId) {
      runMenuWrite(updateMainDish(mainEditor.mainId, patch));
    }
    setMainPhotoFile(null);
    setMainEditor(null);
```

(The rest of the function, if anything follows `setMainEditor(null);` today, is unchanged — this only touches
the lines shown.)

## Change 6 — Save button: show upload progress (~line 3384)

```tsx
// BEFORE
                <button onClick={saveMainEditor} disabled={!mainForm.name.trim()} className="px-4 py-2 rounded-xl text-xs font-black bg-primary text-white hover:bg-primary/90 disabled:opacity-40 transition-colors">Save Main</button>

// AFTER
                <button onClick={saveMainEditor} disabled={!mainForm.name.trim() || mainPhotoUploading} className="px-4 py-2 rounded-xl text-xs font-black bg-primary text-white hover:bg-primary/90 disabled:opacity-40 transition-colors">{mainPhotoUploading ? 'Uploading…' : 'Save Main'}</button>
```

## Do NOT touch

- `CurryOption.photoUrl` / `MainDish.photoUrl` field name in `store.ts` or `types.ts` — stays `photoUrl`, not
  renamed. `dishPhotoFor()` is unaffected either way (it just reads whatever string is in `photoUrl`, a
  download URL works exactly the same as a base64 string did).
- Entity logo upload code, or anything else in Settings — unrelated, no other Storage path changes.
- No cleanup/deletion of a dish's old Storage object when its photo is replaced or removed — matches the
  existing entity-logo behavior (nothing in this app deletes orphaned Storage files today), and Storage cost
  at this scale is trivial. Not in scope for this fix.
- Day-slot-only custom photos (`dishPhotos/days/{dishId}.png`, per the schema doc) — out of scope; this fix
  only covers the Meal Library Main photo editor.

## Verify before committing

1. `npx tsc --noEmit` clean, `vite build` clean.
2. Against the local emulator (Storage emulator running): open Meal Library, add a new Main with a photo —
   confirm the preview shows immediately, confirm after Save the `mains/{id}` Firestore document's `photoUrl`
   field is a `https://` download URL (not a `data:image/...` string), and confirm the image actually renders
   from that URL in the Meal Library list and anywhere else it's shown (e.g. Customer App menu).
3. Edit an existing Main's photo (replace it) — confirm the new upload replaces the old URL correctly.
4. Edit a Main WITHOUT touching its photo — confirm `photoUrl` is unchanged after save (no re-upload
   happens).
5. Click "Remove" on a photo, then Save — confirm `photoUrl` is cleared (`undefined`) and the dish falls back
   to `dishPhotoFor()`'s protein-family guess, same as before this fix.
6. Confirm the Save button shows "Uploading…" and is disabled for the brief moment a new photo is being
   uploaded, and returns to normal after.
7. Confirm a pre-existing Main with an old large base64 `photoUrl` (from before this fix) still displays
   correctly and isn't broken by this change — this fix only changes what NEW saves write, it doesn't migrate
   old data (no retroactive rewrite, same principle as everywhere else in this project).

Commit as its own fix, e.g. `feat(operations): wire Meal Library dish photo upload to Firebase Storage`.
