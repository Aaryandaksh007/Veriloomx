# Task 1-A (+1-D) — Problem Section & Demo Checklist

**Agent:** UI components agent (problem-narrative + guided demo)
**Status:** ✅ Complete — 2 new files, 0 existing files modified

## Files created

| File | Lines | Purpose |
|---|---|---|
| `src/components/veriloom/problem-section.tsx` | 189 | Plain-language problem explanation (4 failure-mode cards with expandable wrong/caught examples + dark footer strip) |
| `src/components/veriloom/demo-checklist.tsx` | 239 | 60-second guided demo checklist with auto-tracking progress + celebration strip |

## Key design decisions

### problem-section.tsx (`ProblemSection`, no props)
- Exports `ProblemSection`. Heading: "The problem: anyone can publish, nobody double-checks" + exact subtext from spec.
- 4 failure cards in `grid gap-3 sm:grid-cols-2 lg:grid-cols-4` (facts/pricing, visuals, tone/banned words, accessibility).
- Icons in colored rounded squares: `BadgeDollarSign` (amber-50), `Palette` (violet-50), `MessageSquareWarning` (rose-50), `Accessibility` (teal-50).
- Each card has a "See it happen →" toggle (arrow rotates 90°) → AnimatePresence height:0→auto expand revealing:
  - WRONG line: rose-600, line-through, X-in-rose-circle icon
  - CAUGHT line: emerald-700, bold "VeriLoom:" prefix, Check-in-emerald-circle icon
- Footer strip: `rounded-xl bg-zinc-950 p-5 text-white` with ShieldCheck in emerald-tinted square; "before it goes live" highlighted emerald-400; note "That's the difference between a blocker and a co-pilot."
- Zero jargon (no "RAG", "neuro-symbolic"). Card style matches dashboard: `rounded-xl border border-zinc-200 bg-white p-4 shadow-sm`, framer `initial={{opacity:0,y:12}}` stagger.

### demo-checklist.tsx (`DemoChecklist`, no props)
- Exports `DemoChecklist`. Pulls `{ data, setView, selectDraft, role }` from `useApp()`.
- **Done conditions:** ① `Object.keys(data.audits).length > 0` ② any draft REMEDIATED|IN_REVIEW|APPROVED or `version >= 2` ③ any draft APPROVED ④ any event `action === 'CERT_ISSUED'`.
- **Actions:** ① select first non-APPROVED *text* draft → `(id,'audit')` (fallbacks: any non-approved → any → `setView('audit')`) ② select remediated-or-any draft → `'remediation'` ③ `setView('review')` ④ select approved draft → `'certificate'` (fallback `setView('certificate')`).
- `role` is used for role-aware hints on steps 2 & 3 (e.g. "Switch to the Creator role…" when not creator).
- Header: title + subtext + "n/4" tabular counter; emerald spring-animated progress bar with proper `role="progressbar"` aria.
- Steps as divided rows (not cards) in one white container: emerald-filled Check circle (spring pop-in) vs zinc-ring numbered circle; title line-through + row opacity 0.65 when done; ghost Button "Go →"/"Done ✓" (lucide icons, no emoji).
- All-4-done → motion scale-in emerald strip with lucide `Trophy` icon: "Demo complete — you just governed a launch end-to-end. That's VeriLoom."
- `data === null` → pulsing skeleton bars (`aria-busy`). No reset functionality (per spec).

## Verification
- `bunx tsc --noEmit | grep -E "problem-section|demo-checklist"` → **TS OK for new files** (0 errors in new files)
- `bunx eslint` on both files → 0 errors / 0 warnings
- `dev.log` healthy (bootstrap API 200; new components not yet imported anywhere, so no runtime impact)

## Notes for the orchestrator (wiring)
- Both are self-contained client components; suggested placement: `ProblemSection` directly above the KPI row (or below hero) and `DemoChecklist` below the KPI row in `dashboard.tsx` — both inside the existing `space-y-6` wrapper.
- Palette restricted to zinc/emerald/rose/amber/teal/violet throughout (no blue/indigo).
- No existing files were touched.
