'use client'

// ─────────────────────────────────────────────────────────────
// VeriLoom AI — Problem section (plain-language "why")
// Explains the hackathon problem for non-technical visitors.
// ─────────────────────────────────────────────────────────────
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Accessibility,
  ArrowRight,
  BadgeDollarSign,
  Check,
  MessageSquareWarning,
  Palette,
  ShieldCheck,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Failure {
  icon: React.ComponentType<{ className?: string }>
  tint: string
  title: string
  desc: string
  wrong: string
  caught: string
}

const FAILURES: Failure[] = [
  {
    icon: BadgeDollarSign,
    tint: 'bg-amber-50 text-amber-600',
    title: 'Wrong facts & pricing',
    desc: 'Prices, specs and claims drift from the approved source of truth.',
    wrong: 'The launch email says $39/user/month. The approved price is $29.',
    caught: 'Catches unapproved figures against Vault facts (VL-FACT-001) before send.',
  },
  {
    icon: Palette,
    tint: 'bg-violet-50 text-violet-600',
    title: 'Off-brand visuals',
    desc: 'Banners ship in colours the brand never approved.',
    wrong: 'The banner ships with generic purple. The brand colour is Loom Coral #F43F5E.',
    caught: 'Exact CIELAB ΔE colour-distance math flags it before export.',
  },
  {
    icon: MessageSquareWarning,
    tint: 'bg-rose-50 text-rose-600',
    title: 'Tone & banned words',
    desc: 'Copy slips in words that legal banned or the voice would never use.',
    wrong: '“Revolutionary AI magic” goes live. Legal banned both words last quarter.',
    caught: 'Deterministic lexicon flags banned terms with one-click fixes.',
  },
  {
    icon: Accessibility,
    tint: 'bg-teal-50 text-teal-600',
    title: 'Inaccessible assets',
    desc: 'Unreadable, non-compliant designs reach real customers.',
    wrong: 'White text on a pale yellow banner — 1.8:1 contrast, unreadable, non-compliant.',
    caught: 'WCAG 2.1 math verifies every text region, pixel-exact.',
  },
]

export function ProblemSection() {
  return (
    <section className="space-y-3">
      {/* ── Heading ──────────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-bold tracking-tight text-zinc-900">
          The problem: anyone can publish, nobody double-checks
        </h2>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-zinc-500">
          Decentralised teams, agencies and generative AI produce hundreds of
          assets a week. Brand guidelines live in a 60-page PDF nobody opens
          under deadline. These four failures reach production every day:
        </p>
      </div>

      {/* ── Four failure modes ───────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FAILURES.map((f, i) => (
          <FailureCard key={f.title} failure={f} index={i} />
        ))}
      </div>

      {/* ── Footer strip ─────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-xl bg-zinc-950 p-5 text-white"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-400/30 bg-emerald-400/10">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
          </span>
          <div>
            <p className="text-sm font-medium leading-relaxed text-zinc-100">
              VeriLoom checks every asset{' '}
              <span className="font-bold text-emerald-400">before it goes live</span> —
              then explains each flag by citing the exact brand-guideline
              clause, suggests a minimal fix, and records who approved what.
            </p>
            <p className="mt-1.5 text-xs text-zinc-400">
              That&rsquo;s the difference between a blocker and a co-pilot.
            </p>
          </div>
        </div>
      </motion.div>
    </section>
  )
}

function FailureCard({ failure, index }: { failure: Failure; index: number }) {
  const [open, setOpen] = useState(false)
  const Icon = failure.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="flex flex-col rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
    >
      <span
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-lg',
          failure.tint,
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="mt-2.5 text-sm font-bold leading-snug text-zinc-900">
        {failure.title}
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-zinc-500">{failure.desc}</p>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mt-3 inline-flex items-center gap-1 self-start rounded-md text-xs font-semibold text-zinc-500 transition-colors hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
      >
        {open ? 'Hide example' : 'See it happen'}
        <motion.span
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.2 }}
          className="inline-flex"
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-2.5 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              {/* what ships today — WRONG */}
              <p className="flex items-start gap-2 text-xs leading-relaxed">
                <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-rose-100">
                  <X className="h-2.5 w-2.5 text-rose-600" strokeWidth={3} />
                </span>
                <span className="text-rose-600 line-through decoration-rose-400">
                  {failure.wrong}
                </span>
              </p>
              {/* what VeriLoom does — CAUGHT */}
              <p className="flex items-start gap-2 border-t border-zinc-200 pt-2.5 text-xs font-medium leading-relaxed text-emerald-700">
                <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                  <Check className="h-2.5 w-2.5 text-emerald-600" strokeWidth={3} />
                </span>
                <span>
                  <span className="font-bold">VeriLoom:</span> {failure.caught}
                </span>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
