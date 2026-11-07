# VeriLoom UI — Warm Editorial Design Spec

**Source:** Awesome Claude Design → `design-md/warm/claude.md` (Claude/Anthropic "Warm Editorial")
**Goal:** Kill the "AI-generated" look. Calm, human, magazine-like. ONE accent color. Flat surfaces. Warm neutrals. Serif headlines.

---

## 1. Palette (CSS custom scales — already defined in `globals.css` `@theme`, use as normal Tailwind classes)

### Neutrals (warm)
| Class | Hex | Role |
|---|---|---|
| `bg-cream` | `#f4f3ee` | Page background |
| `bg-parchment` | `#eeede6` | Raised surface, sidebar, hover lift |
| `bg-paper` | `#fffdf8` | Warm-white card background (prefer over pure `bg-white` on cream) |
| `text-ink` / `bg-ink` | `#191817` | Near-black text / inverse panels |
| `text-ink-soft` | `#5a554e` | Secondary text |
| `text-faint` | `#8a847a` | Muted text |
| `border-line` | `#d8d3c8` | Hairline borders |
| `stone-*` | Tailwind stone | General warm grays (replaces all zinc) |

### Terracotta — THE brand accent (replaces emerald/teal brand usage)
| Class | Hex |
|---|---|
| `terra-50` | `#f8efe9` (tint bg) |
| `terra-100` | `#f1ddd3` (tint border) |
| `terra-200` | `#e3c0a9` |
| `terra-300` | `#e89268` (accent-soft) |
| `terra-400` | `#d97e53` |
| `terra-500` | `#c96442` (**THE accent**) |
| `terra-600` | `#b55738` (hover) |
| `terra-700` | `#9c4a2f` (text on tint) |
| `terra-800` | `#7d3b27` |
| `terra-900` | `#5f2d1e` |

### Semantic scales
| Scale | 600 anchor | Meaning | Replaces |
|---|---|---|---|
| `olive-*` | `#6b7a3d` | success / pass / approved / live | emerald success contexts |
| `ochre-*` | `#c98a42` | warning | amber-* |
| `clay-*` | `#a53e2a` | danger / critical / rejected | rose-* |
| info | — | neutral note | sky-* → `bg-stone-100 text-stone-600 border-stone-300`, dot `bg-stone-400` |

---

## 2. Mechanical color mapping (apply per context)

```
zinc-N        → stone-N                        (all grays, same number)
emerald-N     → terra-N     (brand: logo, active nav, links, buttons, "verified", focus rings, brand data series)
emerald-N     → olive-N     (semantic: pass chips, APPROVED status, score ≥ 85, "ready/live" indicators, success toasts)
teal-N        → terra-N     (secondary brand)
rose-N        → clay-N      (same number)
amber-N       → ochre-N     (same number)
sky-N         → stone-*     (info: bg-stone-100, text-stone-600, border-stone-300, dot bg-stone-400)
violet-N      → ochre-N     (tag/category chips)
bg-zinc-50 / page bg → bg-cream
bg-white (cards) → bg-paper (keep bg-white only in print styles / where pure white needed)
```

**Charts (recharts inline hex):**
- grid stroke `#e4e4e7` → `#e7e3d8`; axis tick fill `#71717a` → `#8a847a`; mono tick `#3f3f46` → `#5a554e`
- primary bar/line `#10b981` → `#c96442` (brand data) — a *score-trend* line may use `#6b7a3d` (score up = good)
- severity colors: critical `#f43f5e` → `#a53e2a`, warning `#f59e0b` → `#c98a42`, info `#0ea5e9` → `#8a847a`, fallback `#a1a1aa` → `#a8a29e`
- violations `#f59e0b` → `#c98a42`, overrides `#f43f5e` → `#a53e2a`

**ScoreRing colors:** ≥85 → `#6b7a3d`, ≥60 → `#c98a42`, else `#a53e2a`. Track `#e4e4e7` → `#e7e3d8`.

---

## 3. Hard rules (from the DESIGN.md — do NOT violate)

1. **FLAT. No drop shadows on cards.** Depth = surface color shift (`parchment` over `cream`) + 1px `border-line` + type weight. Delete `shadow-sm/md/lg/xl` from cards/buttons/badges (keep ONE soft shadow only on modals/dropdown popovers if needed).
2. **No gradients.** Replace `bg-gradient-to-*` with flat fills (`bg-terra-500`, `bg-ink`, …).
3. **No scale/lift hover.** `.vl-lift` has been restyled in CSS (border darkens, slight bg shift) — keep the class, don't add transforms. Remove `hover:scale-*`, `group-hover:scale-*`, `hover:-translate-y-*` on cards. Small icon scale (≤1.08) on buttons is OK.
4. **One terracotta moment per viewport.** Terracotta is for the PRIMARY action / active state / key accent only. Don't paint whole sections terracotta.
5. **Serif headlines.** Main view titles (h1) and section headings get `font-serif` (Lora is wired: class `font-serif`). Keep body/UI text sans (Geist). Numbers in KPIs stay sans + `tabular-nums`.
6. **Radius:** cards 8px (`rounded-lg`), buttons/chips 6px (`rounded-md`) — already via `--radius: 0.5rem`. Prefer `rounded-md/lg/xl` over `rounded-2xl/3xl` for cards (bring oversized radii DOWN one step).
7. **Never tint body text with the accent.** Body copy is `text-ink`/`text-ink-soft`.
8. **No indigo/blue/violet.** Ever.
9. Borders: `border-line` or `border-stone-200` (not zinc). Focus rings: `terra-400/60`-ish or `ring-terra-500/40`.
10. Keep ALL framer-motion entrance animations (fade/slide) — only change colors. Keep functionality identical.

## 4. What NOT to change

- Component logic, state, props, handlers, API calls, data flow — **zero functional changes**.
- Icon choices (lucide) stay.
- Do not rename files or exports.
- Keep `'use client'` directives and imports intact.

## 5. Tone of the result

> "Would this look at home on the Anthropic blog or in a New Yorker feature?"

Cream paper, ink text, terracotta accents, olive/ochre/clay semantics, hairline borders, generous whitespace, serif headlines. Calm, earnest, tactile, deliberate.
