'use client'

// ─────────────────────────────────────────────────────────────
// VeriLoom AI — Problem section (plain-language "why")
// One compact tabbed panel instead of a wall of cards: pick a
// failure mode, see what ships today vs. what VeriLoom catches.
// ─────────────────────────────────────────────────────────────
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Accessibility,
  BadgeDollarSign,
  Check,
  MessageSquareWarning,
  Palette,
  ShieldCheck,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Failure {
  id: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  tab: string
  desc: string
  wrong: string
  caught: string
  clause: string
}

const FAILURES: Failure[] = [
  {
    id: 'facts',
    icon: BadgeDollarSign,
    title: 'Wrong facts & pricing',
    tab: 'Facts & pricing',
    desc: 'Prices, specs and claims drift from the approved source of truth.',
    wrong: 'The launch email says $39/user/month. The approved price is $29.',
    caught: 'Catches unapproved figures against Vault facts before send.',
    clause: 'VL-FACT-001',
  },
  {
    id: 'visual',
    icon: Palette,
    title: 'Off-brand visuals',
    tab: 'Off-brand visuals',
    desc: 'Banners ship in colours the brand never approved.',
    wrong: 'The banner ships with generic purple. The brand colour is Loom Coral #F43F5E.',
    caught: 'Exact CIELAB ΔE colour-distance math flags it before export.',
    clause: 'VL-COLOR-011',
  },
  {
    id: 'tone',
    icon: MessageSquareWarning,
    title: 'Tone & banned words',
    tab: 'Tone & banned words',
    desc: 'Copy slips in words that legal banned or the voice would never use.',
    wrong: '“Revolutionary AI magic” goes live. Legal banned both words last quarter.',
    caught: 'Deterministic lexicon flags banned terms with one-click fixes.',
    clause: 'VL-VOICE-004',
  },
  {
    id: 'a11y',
    icon: Accessibility,
    title: 'Inaccessible assets',
    tab: 'Accessibility',
    desc: 'Unreadable, non-compliant designs reach real customers.',
    wrong: 'White text on a pale yellow banner — 1.8:1 contrast, unreadable, non-compliant.',
    caught: 'WCAG 2.1 math verifies every text region, pixel-exact.',
    clause: 'VL-RULE-031',
  },
]

export function ProblemSection() {
  const [active, setActive] = useState(0)
  const f = FAILURES[active]
  const Icon = f.icon

  return (
    <section aria-label="The problem VeriLoom solves">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="mb-3.5"
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-faint">
          Why this matters
        </p>
        <h2 className="mt-0.5 font-serif text-lg font-semibold tracking-tight text-ink">
          The problem: anyone can publish, nobody double-checks
        </h2>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-soft">
          Decentralised teams, agencies and generative AI produce hundreds of
          assets a week. Brand guidelines live in a 60-page PDF nobody opens
          under deadline. Switch between the four failure modes that reach
          production every day:
        </p>
      </motion.div>

      <div className="overflow-hidden rounded-xl border border-line bg-paper">
        {/* tab strip */}
        <div
          className="flex gap-1 overflow-x-auto border-b border-stone-200 bg-parchment/60 px-2 pt-2 vl-scroll"
          role="tablist"
          aria-label="Failure modes"
        >
          {FAILURES.map((item, i) => {
            const ItemIcon = item.icon
            const isActive = i === active
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActive(i)}
                className={cn(
                  'relative flex shrink-0 items-center gap-1.5 rounded-t-lg px-3.5 py-2.5 text-xs font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-terra-400/60',
                  isActive
                    ? 'bg-paper text-ink'
                    : 'text-ink-soft hover:bg-parchment hover:text-ink'
                )}
              >
                <ItemIcon
                  className={cn(
                    'h-3.5 w-3.5',
                    isActive ? 'text-terra-500' : 'text-faint'
                  )}
                />
                {item.tab}
                {isActive && (
                  <motion.span
                    layoutId="vl-problem-tab"
                    className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-terra-500"
                    transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                  />
                )}
              </button>
            )
          })}
        </div>

        {/* panel */}
        <AnimatePresence mode="wait">
          <motion.div
            key={f.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="p-5"
            role="tabpanel"
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-parchment text-ink-soft">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base font-bold tracking-tight text-ink">
                  {f.title}
                </h3>
                <p className="text-xs text-ink-soft">{f.desc}</p>
              </div>
              <span className="ml-auto hidden rounded-md bg-ink px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-cream sm:inline-flex">
                {f.clause}
              </span>
            </div>

            {/* wrong vs caught */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-clay-200/80 bg-clay-50/60 p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-clay-700">
                  What ships today
                </p>
                <p className="mt-1.5 flex items-start gap-2 text-xs leading-relaxed">
                  <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-clay-100">
                    <X className="h-2.5 w-2.5 text-clay-600" strokeWidth={3} />
                  </span>
                  <span className="text-clay-700 line-through decoration-clay-400">
                    {f.wrong}
                  </span>
                </p>
              </div>
              <div className="rounded-lg border border-olive-200/80 bg-olive-50/60 p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-olive-700">
                  What VeriLoom does
                </p>
                <p className="mt-1.5 flex items-start gap-2 text-xs font-medium leading-relaxed text-olive-800">
                  <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-olive-100">
                    <Check className="h-2.5 w-2.5 text-olive-600" strokeWidth={3} />
                  </span>
                  {f.caught}
                </p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* anchor line */}
        <div className="flex items-center gap-3 border-t border-stone-200 bg-parchment/60 px-5 py-3">
          <ShieldCheck className="h-4 w-4 shrink-0 text-terra-500" />
          <p className="text-xs leading-relaxed text-ink-soft">
            VeriLoom checks every asset <span className="font-bold text-ink">before it goes live</span> —
            explains each flag by citing the exact guideline clause, suggests a
            minimal fix, and records who approved what.{' '}
            <span className="text-faint">
              That&rsquo;s the difference between a blocker and a co-pilot.
            </span>
          </p>
        </div>
      </div>
    </section>
  )
}
