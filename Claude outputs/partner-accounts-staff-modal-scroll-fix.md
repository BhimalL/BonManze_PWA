# Fix: Add/Edit Staff Member modal — body doesn't scroll, cuts off Partner Account fields

Fast-path (presentational only — no `firestore.rules`, Cloud Function, or schema change; no security
review gate applies).

**Where:** `modules/Operations.tsx`

**Problem:** both `Add Staff Modal` (~line 5086) and `Edit Staff Modal` (~line 5190) use the same shell:
a fixed, centered overlay containing a card (`overflow-hidden`) whose body is a plain
`<div className="p-6 space-y-4">` with no `max-height` and no scroll region of its own. When the body's
content (name/email/role/active status/Partner Account toggle/assigned-entities checklist/error message)
is taller than the browser viewport, the overflow renders past the edges of the screen with nothing to
scroll it into view — it isn't clipped or hidden conditionally, it's just unreachable at normal zoom.
This is why the "Assigned Trading Entities" checklist appeared to go missing entirely from the Edit modal
during live testing — the fields are present in the DOM, just below the fold. (Confirmed via source read:
the Partner Account checkbox and entity checklist ARE present in both modals — this is a layout bug, not a
missing feature or a regression from recent commits.)

**Fix — two one-line changes:**

1. Add Staff Modal body, currently at line 5094:
   ```
   <div className="p-6 space-y-4">
   ```
   change to:
   ```
   <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
   ```

2. Edit Staff Modal body, currently at line 5198:
   ```
   <div className="p-6 space-y-4">
   ```
   change to:
   ```
   <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
   ```

No other changes needed — in both modals the header (`p-6 border-b ...`) and the footer with
Cancel/Save buttons (`p-6 border-t ... flex justify-end`) are already separate sibling `<div>`s outside
this body block, so they'll stay pinned in place while only the body scrolls internally.

**After applying:**
- `npx tsc --noEmit` and `npm run build` — this file only.
- Manual check: open Add Staff Member and Edit Staff Member (edit an existing Partner, e.g. Partner_1)
  at normal browser zoom (not zoomed out). Confirm the Partner Account toggle and, when checked, the
  Assigned Trading Entities checklist are reachable by scrolling within the modal body, and that the
  Cancel/Save buttons stay visible at the bottom throughout.
