# Feature: visible build stamp — so a stale bundle is never mistaken for a bug

Fast-path (purely presentational — a build-time constant baked in and displayed; touches no
Firestore data, no write path, no `firestore.rules`, no `store.ts` hydration logic).

**Why:** On 2026-09-14, the Orders by Dish partner-filter checkboxes (added in `0828f3d`, still
present in source at `043e80b`) appeared to have vanished from the running app. Ten minutes of
investigation (re-reading the committed source directly, confirming the JSX and its `!isPartner`
gate were exactly as spec'd, confirming Bhimal's own staff doc had "Partner Account" unchecked)
turned up nothing wrong — because nothing was wrong. A hard browser refresh made the checkboxes
reappear immediately: the page had simply been running a stale cached bundle from before the
`0828f3d`/`043e80b` commits landed. This adds a small, always-visible stamp so that question is
answered by looking at the screen instead of by a debugging session.

## 1. Compute the build's commit hash and time — `vite.config.ts`

**Where:** top of the file, alongside the other imports.

**Current (top of file):**
```ts
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
```

**Change to:**
```ts
import path from 'path';
import { execSync } from 'child_process';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
```

**Where:** inside the `defineConfig(({ mode }) => { ... })` factory body, before the `return`
statement (right after the existing `const env = loadEnv(mode, '.', '');` line).

**Current:**
```ts
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
```

**Change to:**
```ts
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');

    // Build stamp (see Working Agreement, 2026-09-14 amendment): lets anyone looking at the
    // running app confirm at a glance which commit it's actually running, instead of a stale
    // cached bundle silently looking like a regression. Recomputed every time the dev server
    // starts (npm run dev) and every production build (npm run build) — never at runtime.
    let buildCommit = 'unknown';
    try {
      buildCommit = execSync('git rev-parse --short HEAD').toString().trim();
    } catch {
      // No .git available in this context (e.g. some deploy environments) — fall back rather
      // than fail the build over a cosmetic feature.
    }
    const buildTime = new Date().toISOString();

    return {
```

## 2. Expose it to the client — `vite.config.ts`'s `define` block

**Current:**
```ts
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
```

**Change to (one new line, same pattern already used for the two lines above it):**
```ts
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        __BUILD_INFO__: JSON.stringify({ commit: buildCommit, time: buildTime })
      },
```

## 3. Declare the global — `modules/Operations.tsx`

**Where:** right after the top imports (after the `lucide-react` import block, before the
component/interfaces start).

**Add:**
```ts
// Injected at build time by vite.config.ts — see the 2026-09-14 Working Agreement amendment.
declare const __BUILD_INFO__: { commit: string; time: string };
```

## 4. Show it next to the existing "Data loaded as of" pill

**Where:** the persistent header, ~line 6052-6056 (confirmed present in every tab via the "Data
loaded as of" pill visible in every screenshot this session).

**Current:**
```jsx
            {/* Load time stamp for sync visibility */}
            <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-[#E7E0D0]">
              <Clock className="size-3" />
              <span>Data loaded as of {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</span>
            </div>
```

**Change to (new pill added right before it, same visual style):**
```jsx
            {/* Build stamp — confirms at a glance whether this tab is running the commit you
                expect, rather than a stale cached bundle. See Working Agreement, 2026-09-14. */}
            <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-[#E7E0D0]">
              <span>Build {__BUILD_INFO__.commit} · {new Date(__BUILD_INFO__.time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
            </div>

            {/* Load time stamp for sync visibility */}
            <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-[#E7E0D0]">
              <Clock className="size-3" />
              <span>Data loaded as of {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</span>
            </div>
```

## After applying

- `npx tsc --noEmit` and `npm run build` — both files. Note `npm run build` is the real test here:
  the `execSync('git rev-parse --short HEAD')` call only runs at build/dev-server-start time, so
  confirm the built output actually contains a real short hash, not `unknown` (which would mean
  the `try`/`catch` silently swallowed something worth knowing about — check `git` is on PATH in
  whatever shell runs the build if that happens).
- Manual check: restart `npm run dev`, load the app, confirm the new "Build <hash> · <date/time>"
  pill appears next to "Data loaded as of" and the hash matches `git rev-parse --short HEAD` run
  in the same terminal. Make an unrelated trivial commit, restart the dev server, hard-refresh,
  and confirm the pill's hash changes to match — that's what makes a stale bundle visible next
  time instead of triggering a debugging session over nothing.
