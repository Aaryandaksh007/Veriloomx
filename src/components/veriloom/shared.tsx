'use client'

// ─────────────────────────────────────────────────────────────
// VeriLoom AI — shared presentational components (warm editorial)
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { ShieldCheck, BadgeCheck, Cpu, Sparkles, Eye, FlaskConical, ChevronLeft } from 'lucide-react'
import type {
  DraftStatus,
  EngineKind,
  Finding,
  Severity,
} from '@/lib/types'
import { ENGINE_META, STATUS_META } from '@/lib/types'
import { useApp } from '@/lib/store'
import { cn } from '@/lib/utils'

export function SeverityChip({ severity, className }: { severity: Severity; className?: string }) {
  const styles: Record<Severity, string> = {
    critical: 'bg-clay-50 text-clay-700 border-clay-200',
    warning: 'bg-ochre-50 text-ochre-700 border-ochre-200',
    info: 'bg-stone-100 text-stone-600 border-stone-300',
    pass: 'bg-olive-50 text-olive-700 border-olive-200',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
        styles[severity],
        className
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          severity === 'critical' && 'bg-clay-500',
          severity === 'warning' && 'bg-ochre-500',
          severity === 'info' && 'bg-stone-400',
          severity === 'pass' && 'bg-olive-500'
        )}
      />
      {severity}
    </span>
  )
}

const ENGINE_ICON: Record<EngineKind, React.ComponentType<{ className?: string }>> = {
  deterministic: Cpu,
  rag: Sparkles,
  hybrid: FlaskConical,
  vlm: Eye,
}

const ENGINE_STYLE: Record<EngineKind, string> = {
  deterministic: 'bg-olive-50 text-olive-700 border-olive-200',
  rag: 'bg-terra-50 text-terra-700 border-terra-200',
  hybrid: 'bg-ochre-50 text-ochre-700 border-ochre-200',
  vlm: 'bg-stone-100 text-stone-600 border-stone-300',
}

export function EngineChip({ engine }: { engine: EngineKind }) {
  const Icon = ENGINE_ICON[engine]
  return (
    <span
      title={ENGINE_META[engine].desc}
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide',
        ENGINE_STYLE[engine]
      )}
    >
      <Icon className="h-3 w-3" />
      {ENGINE_META[engine].label}
    </span>
  )
}

export function StatusChip({ status }: { status: DraftStatus }) {
  const meta = STATUS_META[status]
  return (
    <span
      title={meta.desc}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
        meta.tone
      )}
    >
      {status === 'APPROVED' && <BadgeCheck className="h-3 w-3" />}
      {meta.label}
    </span>
  )
}

export function ClauseBadge({ clauseId, className }: { clauseId: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md bg-ink px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-cream',
        className
      )}
    >
      {clauseId}
    </span>
  )
}

/** The citation card — the heart of explainability. */
export function CitationCard({ finding, compact = false }: { finding: Finding; compact?: boolean }) {
  if (!finding.clauseId) return null
  return (
    <div
      className={cn(
        'rounded-lg border border-terra-100 bg-terra-50/70',
        compact ? 'p-2' : 'p-3'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClauseBadge clauseId={finding.clauseId} />
          <span className="text-xs font-semibold text-terra-900">
            {finding.clauseTitle}
          </span>
        </div>
        <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-terra-700">
          <ShieldCheck className="h-3.5 w-3.5" />
          VERIFIED AGAINST VAULT
        </span>
      </div>
      {!compact && finding.clauseQuote && (
        <blockquote className="mt-2 border-l-2 border-terra-300 pl-2.5 text-xs leading-relaxed text-terra-900/80">
          “{finding.clauseQuote}”
        </blockquote>
      )}
    </div>
  )
}

/** Animated compliance score ring. */
export function ScoreRing({
  score,
  size = 120,
  strokeWidth = 9,
}: {
  score: number
  size?: number
  strokeWidth?: number
}) {
  const r = (size - strokeWidth) / 2
  const c = 2 * Math.PI * r
  const color = score >= 85 ? '#6b7a3d' : score >= 60 ? '#c98a42' : '#a53e2a'
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e7e3d8" strokeWidth={strokeWidth} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (c * score) / 100 }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-serif text-3xl font-semibold tabular-nums" style={{ color }}>
          {score}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-faint">
          / 100
        </span>
      </div>
    </div>
  )
}

export function HexSwatch({ hex, size = 18 }: { hex: string; size?: number }) {
  return (
    <span
      className="inline-block shrink-0 rounded-md border border-line"
      style={{ backgroundColor: hex, width: size, height: size }}
      title={hex}
    />
  )
}

/** Spring count-up number — mounts at 0, settles on `value`. */
export function AnimatedNumber({
  value,
  className,
}: {
  value: number
  className?: string
}) {
  const mv = useMotionValue(0)
  const spring = useSpring(mv, { stiffness: 90, damping: 24, mass: 0.6 })
  const text = useTransform(spring, (v) => Math.round(v).toLocaleString())
  const first = useRef(true)

  useEffect(() => {
    // small delay on mount so the dashboard feels like it "boots"
    const t = setTimeout(() => mv.set(value), first.current ? 140 : 0)
    first.current = false
    return () => clearTimeout(t)
  }, [value, mv])

  return <motion.span className={className}>{text}</motion.span>
}

export function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = 'default',
  delay = 0,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ComponentType<{ className?: string }>
  tone?: 'default' | 'accent' | 'olive' | 'ochre' | 'clay' | 'emerald' | 'amber' | 'rose'
  delay?: number
}) {
  const tones: Record<string, string> = {
    default: 'text-ink',
    accent: 'text-terra-600',
    olive: 'text-olive-700',
    ochre: 'text-ochre-600',
    clay: 'text-clay-600',
    // legacy aliases (pre-warm-palette call sites)
    emerald: 'text-olive-700',
    amber: 'text-ochre-600',
    rose: 'text-clay-600',
  }
  const toneBorder: Record<string, string> = {
    default: 'hover:border-stone-300',
    accent: 'hover:border-terra-200',
    olive: 'hover:border-olive-200',
    ochre: 'hover:border-ochre-200',
    clay: 'hover:border-clay-200',
    emerald: 'hover:border-olive-200',
    amber: 'hover:border-ochre-200',
    rose: 'hover:border-clay-200',
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'group vl-lift rounded-lg border border-line bg-paper p-4',
        toneBorder[tone]
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          title={label}
          className="line-clamp-2 min-h-[28px] text-[11px] font-semibold uppercase leading-snug tracking-wider text-faint"
        >
          {label}
        </p>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-parchment text-ink-soft transition-colors duration-200 group-hover:bg-ink group-hover:text-cream">
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <p className={cn('mt-1.5 whitespace-nowrap text-2xl font-semibold tabular-nums', tones[tone])}>
        {typeof value === 'number' ? (
          <AnimatedNumber value={value} />
        ) : (
          value
        )}
      </p>
      {sub && <p className="mt-0.5 text-[11px] text-faint">{sub}</p>}
    </motion.div>
  )
}

/**
 * Unified view header — every module hangs off the Dashboard,
 * so each one opens with the same breadcrumb "← Dashboard › …",
 * optional live draft context chip and an actions slot.
 */
export function ViewHeader({
  crumb,
  title,
  subtitle,
  actions,
  showDraftChip = true,
  className,
}: {
  crumb: string
  title: string
  subtitle?: string
  actions?: React.ReactNode
  showDraftChip?: boolean
  className?: string
}) {
  const { setView, data, selectedDraftId } = useApp()
  const draft = data?.drafts.find((d) => d.id === selectedDraftId) ?? null

  return (
    <motion.header
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={cn('vl-header-underline relative mb-5', className)}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          type="button"
          onClick={() => setView('dashboard')}
          className="group inline-flex items-center gap-1 rounded-md text-xs font-semibold text-faint transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terra-400/60"
        >
          <ChevronLeft className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
          Dashboard
        </button>
        <span className="text-[10px] text-line" aria-hidden>/</span>
        <span className="text-xs font-semibold text-ink">{crumb}</span>

        <span className="hidden h-4 w-px bg-line sm:block" aria-hidden />

        {showDraftChip && draft && (
          <motion.span
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="inline-flex max-w-[280px] items-center gap-1.5 truncate rounded-full border border-line bg-paper px-2.5 py-0.5 text-[11px] font-medium text-ink-soft"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-terra-400" />
            <span className="truncate">{draft.title}</span>
            <span className="shrink-0 text-faint">·</span>
            <span className="shrink-0 text-faint">{STATUS_META[draft.status].label}</span>
          </motion.span>
        )}

        <div className="ml-auto flex items-center gap-2">{actions}</div>
      </div>
      <h1 className="mt-2 font-serif text-xl font-semibold tracking-tight text-ink sm:text-2xl">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-soft">{subtitle}</p>
      )}
    </motion.header>
  )
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
