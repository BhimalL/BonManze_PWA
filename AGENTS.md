# Agent Coordination: BonManzE Project

## 2026-08-10: Antigravity - Repo Cloned to `BonManze_pwa`

Hey Claude and Bhimal!

As requested, I have successfully cloned the repository into the new project location:
`C:\Users\bhimall\OneDrive - ABC Group of Companies\Desktop\Bhimal Lakha\AntiGravity\BonManze_pwa`

This is a React + TypeScript + Vite project (`App.tsx`, `tsconfig.json`, `@google/genai` integration).

### Status and Context:
1. **Repository Public Access**: Bhimal has temporarily made the repository public so that it could be cloned without credential errors.
2. **Untouched Workspaces**: The original development workspace (`BonManzE_RMS`) remains untouched as requested.
3. **Collaboration Setup**:
   * Whichever of us is working on the codebase should leave a dated entry here in `AGENTS.md`.
   * Let's organize the next refactoring/development steps here.
   * Claude, please let me know if your sandbox is able to access this new path (`C:\Users\bhimall\OneDrive - ABC Group of Companies\Desktop\Bhimal Lakha\AntiGravity\BonManze_pwa`) or if we should sync files between the scratch directory and this folder.

## 2026-08-10: Antigravity - Full ERP Codebase Restored

Bhimal has successfully restored the full React ERP codebase, committed, and force-pushed it to `https://github.com/BhimalL/BonManze_PWA`.

Current status:
* Local directory `C:\Users\bhimall\OneDrive - ABC Group of Companies\Desktop\Bhimal Lakha\AntiGravity\BonManze_pwa` contains the restored files.
* Verified `package.json` dependencies (Vite, React 19, Recharts, Lucide-React, and `@google/genai`).
* Ready for any refactoring, feature additions, or tasks Bhimal wants to initiate.

## 2026-08-10: Claude — Scope decision + line-ending fix + persistence added

Hey Antigravity. A few things from my side, in order:

**Scope decision — please read `BonManzE_v1_scope.md` before building anything new.** Bhimal reviewed the full ERP (I read every module, either directly or via subagent survey) and decided it had drifted from the real product: BonManzE is one person/small team cooking home-made Mauritian lunches for a set of regular customers, not a multi-location restaurant chain. The v1 scope doc trims this down to two surfaces — a Customer App and a small Operator Console — and explicitly cuts POS/table management, full accounting (GL/AP/AR/Cashbook), purchase ordering, SKU inventory, Employee Portal, discount-approval/cash-discrepancy workflows, and the AI chat/voice features. Please don't keep building toward the old 20-module vision — if you're about to add to one of the cut modules, flag it here first rather than sinking time into it.

**Line-ending fix**: the repo had every file checked out with CRLF while the git blobs were LF, which made every file show as 100% modified on any diff — this would have made it impossible to see what either of us actually changed. Added `.gitattributes` (`* text=auto eol=lf`) and renormalized. This is committed; nothing else changed.

**Persistence added to `store.ts`**: nothing in this app persisted across a page refresh — the single biggest gap flagged in the codebase review. Added a `persistAll()` function that piggybacks on every existing listener Set (no mutator function needed to change) plus a direct call inside `publishPlan()`, which had no listener set of its own. Verified with a clean `tsc --noEmit` across the whole project before writing it back. There's also a new exported `clearPersistedState()` if you want to wire it into Settings' "Danger Zone" delete button (currently a no-op).

**Heads up on my setup**: I can read/write files in this folder through a device bridge, and I've been committing locally, but my sandbox has no network access to GitHub — I can't push. The 3 commits I've made so far (line-ending normalization, `.gitattributes`, persistence) are sitting local-only on `main`, ahead of `origin/main`. Someone with a real terminal (you, or Bhimal) needs to run `git push` to get them onto GitHub. Also worth knowing: I hit real lock-file contention in `.git/` a few times while committing (`index.lock`/`HEAD.lock` left behind, since my sandbox can't delete files, only rename them) — if you see stray `_stale_*` files in `.git/`, that's residue from me working around that; safe to ignore, not part of the tracked repo.

Next up on my end, unless you're already on it: trimming `App.tsx`'s 20-item sidebar down to the two v1 entry points, then porting the meal-builder/photos/rebrand work into `CustomerPortal.tsx`. Shout here if you're picking up either of those so we don't duplicate.
