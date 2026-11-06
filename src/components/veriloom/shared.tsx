'use client'

// ─────────────────────────────────────────────────────────────
// VeriLoom AI — shared presentational components
// ─────────────────────────────────────────────────────────────
import { motion } from 'framer-motion'
import { ShieldCheck, BadgeCheck, Cpu, Sparkles, Eye, FlaskConical } from 'lucide-react'
import type {
  DraftStatus,
  EngineKind,
  Finding,
  Severity,
} from '@/lib/types'
import { ENGINE_META, STATUS_META } from '@/lib/types'
import { cn } from '@/lib/utils'

export function SeverityChip({ severity, className }: { severity: Severity; className?: string }) {
  const styles: Record<Severity, string> = {
    critical: 'bg-rose-50 text-rose-700 border-rose-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    info: 'bg-sky-50 text-sky-700 border-sky-200',
    pass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
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
          severity === 'critical' && 'bg-rose-500',
          severity === 'warning' && 'bg-amber-500',
          severity === 'info' && 'bg-sky-500',
          severity === 'pass' && 'bg-emerald-500'
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
  deterministic: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rag: 'bg-teal-50 text-teal-700 border-teal-200',
  hybrid: 'bg-amber-50 text-amber-700 border-amber-200',
  vlm: 'bg-zinc-100 text-zinc-700 border-zinc-300',
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
        'inline-flex items-center rounded-md bg-zinc-900 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-zinc-100',
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
        'rounded-lg border border-emerald-200 bg-emerald-50/60',
        compact ? 'p-2' : 'p-3'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClauseBadge clauseId={finding.clauseId} />
          <span className="text-xs font-semibold text-emerald-900">
            {finding.clauseTitle}
          </span>
        </div>
        <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-700">
          <ShieldCheck className="h-3.5 w-3.5" />
          VERIFIED AGAINST VAULT
        </span>
      </div>
      {!compact && finding.clauseQuote && (
        <blockquote className="mt-2 border-l-2 border-emerald-400 pl-2.5 text-xs leading-relaxed text-emerald-900/80">
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
  const color = score >= 85 ? '#10b981' : score >= 60 ? '#f59e0b' : '#f43f5e'
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e4e4e7" strokeWidth={strokeWidth} />
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
        <span className="text-3xl font-bold tabular-nums" style={{ color }}>
          {score}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          / 100
        </span>
      </div>
    </div>
  )
}

export function HexSwatch({ hex, size = 18 }: { hex: string; size?: number }) {
  return (
    <span
      className="inline-block shrink-0 rounded-md border border-zinc-300 shadow-sm"
      style={{ backgroundColor: hex, width: size, height: size }}
      title={hex}
    />
  )
}

export function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = 'default',
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ComponentType<{ className?: string }>
  tone?: 'default' | 'emerald' | 'amber' | 'rose'
}) {
  const tones = {
    default: 'text-zinc-900',
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
    rose: 'text-rose-600',
  }
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          {label}
        </p>
        <Icon className="h-4 w-4 text-zinc-400" />
      </div>
      <p className={cn('mt-1.5 text-2xl font-bold tabular-nums', tones[tone])}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-zinc-400">{sub}</p>}
    </div>
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
