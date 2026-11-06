'use client'

// ─────────────────────────────────────────────────────────────
// VeriLoom AI — Dashboard (mission control)
// Every module hangs off this page: live stats, the draft
// pipeline board ("continue where you left off"), the live
// playground, a guided demo, and an interactive workflow rail.
// ─────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight,
  BadgeCheck,
  Check,
  Cpu,
  Eye,
  FlaskConical,
  Image as ImageIcon,
  Pause,
  Play,
  ScanSearch,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import { useApp, roleIdentity, type View } from '@/lib/store'
import type { AuditResult, DraftDTO } from '@/lib/types'
import { AnimatedNumber, EngineChip, StatusChip, timeAgo } from './shared'
import { ProblemSection } from './problem-section'
import { LivePlayground } from './live-playground'
import { DemoChecklist } from './demo-checklist'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const VIEW_LABEL: Record<View, string> = {
  dashboard: 'Dashboard',
  vault: 'Brand Vault',
  audit: 'Audit Studio',
  remediation: 'Remediation',
  review: 'Review & Approval',
  analytics: 'Governance Analytics',
  certificate: 'Compliance Certificate',
}

const fixDone = (d: DraftDTO) =>
  d.status === 'REMEDIATED' ||
  d.status === 'IN_REVIEW' ||
  d.status === 'APPROVED' ||
  d.status === 'CHANGES_REQUESTED' ||
  d.version >= 2

const reviewDone = (d: DraftDTO) =>
  d.status === 'IN_REVIEW' || d.status === 'CHANGES_REQUESTED' || d.status === 'APPROVED'

/** Where should this draft be worked on right now? */
function routeFor(d: DraftDTO): View {
  switch (d.status) {
    case 'APPROVED':
      return 'certificate'
    case 'IN_REVIEW':
      return 'review'
    case 'REMEDIATED':
      return 'review'
    case 'CHANGES_REQUESTED':
      return 'remediation'
    case 'AUDITED':
      return 'remediation'
    default:
      return 'audit'
  }
}

const NEXT_HINT: Record<string, string> = {
  draft: 'Submit it for a 6-pillar audit',
  audit: 'Run the audit in Audit Studio',
  fix: 'Apply the cited fixes in Remediation',
  review: 'Await role-based sign-off in Review',
  live: 'Approved — certificate available',
}

export function DashboardView() {
  const { data, setView, selectDraft, role } = useApp()

  const audits = data ? Object.values(data.audits) : []
  const totalFindings = audits.reduce((s, a) => s + a.findings.length, 0)
  const totalSuppressed = audits.reduce((s, a) => s + a.suppressed, 0)
  const inFlight = data?.drafts.filter((d) => d.status !== 'APPROVED').length ?? 0
  const demoDraft =
    data?.drafts.find((d) => d.title.includes('Press release')) ??
    data?.drafts.find((d) => d.status !== 'APPROVED') ??
    data?.drafts[0]

  return (
    <div className="space-y-8">
      {/* ── 1 · Command bar ─────────────────────────────── */}
      <CommandBar
        clauses={data?.vault.length ?? 0}
        inFlight={inFlight}
        findings={totalFindings}
        suppressed={totalSuppressed}
        roleLabel={roleIdentity(role).label}
        onTryLive={() => {
          document
            .getElementById('live-playground')
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          setTimeout(
            () =>
              document
                .querySelector<HTMLTextAreaElement>(
                  'textarea[aria-label="Live brand check editor"]'
                )
                ?.focus(),
            450
          )
        }}
        onDemoAudit={() => {
          if (demoDraft) selectDraft(demoDraft.id, 'audit')
          else setView('audit')
        }}
      />

      {/* ── 2 · Pipeline board — everything starts here ── */}
      <PipelineBoard />

      {/* ── 3 · Live playground ────────────────────────── */}
      <div id="live-playground" className="scroll-mt-6">
        <LivePlayground />
      </div>

      {/* ── 4 · Guided demo checklist ──────────────────── */}
      <DemoChecklist />

      {/* ── 5 · Interactive workflow rail ──────────────── */}
      <WorkflowRail />

      {/* ── 6 · The problem, in plain language ─────────── */}
      <ProblemSection />

      {/* ── 7 · Engine + live activity ─────────────────── */}
      <section className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <SectionHead
            kicker="Under the hood"
            title="Neuro-symbolic audit engine"
            desc="Deterministic mathematics and semantic reasoning are strictly separated — colour distances and contrast ratios are never guessed by an LLM."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <EngineCard
              icon={Cpu}
              title="Deterministic Core"
              body="Terminology lexicon matching, CIELAB ΔE2000 colour distance (tolerance ≤ 5.0), WCAG 2.1 relative-luminance contrast, and PII regex scrubbing — pure algorithms, byte-exact."
              engines={['deterministic']}
            />
            <EngineCard
              icon={FlaskConical}
              title="Citation-Constrained RAG"
              body="Tone and claims are verified against Vault facts. A flag missing a valid clause_id or a locatable quote is programmatically discarded before it reaches a human."
              engines={['rag', 'hybrid']}
            />
            <EngineCard
              icon={Eye}
              title="VLM Visual Sampling"
              body="The vision model reports text regions and colours, which are then re-computed with exact WCAG math — the LLM never gets the final say on accessibility."
              engines={['vlm']}
            />
            <EngineCard
              icon={ShieldCheck}
              title="Human Override Ledger"
              body="Every override demands a written justification, feeds the Guideline Blindspot Engine, and appears on the final compliance certificate."
              engines={[]}
            />
          </div>
        </div>

        <div className="lg:col-span-2">
          <SectionHead kicker="Liveness" title="Governance activity" />
          <ActivityTimeline />
        </div>
      </section>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   Section 1 — command bar: greeting, live stats, primary CTAs
   ═══════════════════════════════════════════════════════════ */
function CommandBar({
  clauses,
  inFlight,
  findings,
  suppressed,
  roleLabel,
  onTryLive,
  onDemoAudit,
}: {
  clauses: number
  inFlight: number
  findings: number
  suppressed: number
  roleLabel: string
  onTryLive: () => void
  onDemoAudit: () => void
}) {
  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const stats: { label: string; value: number; hint: string; tone?: string }[] = [
    { label: 'Vault clauses', value: clauses, hint: 'indexed & citable' },
    { label: 'Drafts in flight', value: inFlight, hint: 'under governance' },
    { label: 'Findings caught', value: findings, hint: 'across all audits' },
    {
      label: 'Ungrounded flags suppressed',
      value: suppressed,
      hint: 'zero-hallucination guard',
      tone: 'text-emerald-600',
    },
  ]

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm"
    >
      <div className="p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Live workspace · auto-sync
            </p>
            <h1
              suppressHydrationWarning
              className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 sm:text-[1.7rem]"
            >
              {greeting} — everything starts here.
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-zinc-500">
              Pick up any draft below, or try the engine on your own words.
              Every asset passes six brand-governance checks before it ships —{' '}
              <span className="font-semibold text-zinc-700">
                explained, cited, approved.
              </span>
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              size="sm"
              className="bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
              onClick={onTryLive}
            >
              <Zap className="mr-1.5 h-3.5 w-3.5" />
              Try it live
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900"
              onClick={onDemoAudit}
            >
              <ScanSearch className="mr-1.5 h-3.5 w-3.5" />
              Run demo audit
            </Button>
          </div>
        </div>

        {/* live stat strip */}
        <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-zinc-100 pt-5 lg:grid-cols-4">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.08, duration: 0.4 }}
            >
              <p
                className={cn(
                  'text-2xl font-bold tabular-nums tracking-tight text-zinc-900',
                  s.tone
                )}
              >
                <AnimatedNumber value={s.value} />
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-zinc-600">{s.label}</p>
              <p className="text-[10.5px] text-zinc-400">{s.hint}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* hairline role bar */}
      <div className="flex items-center justify-between gap-3 border-t border-zinc-100 bg-zinc-50/60 px-5 py-2.5 sm:px-7">
        <p className="truncate text-[11px] text-zinc-500">
          Viewing as <span className="font-semibold text-zinc-700">{roleLabel}</span> — switch the acting role to watch RBAC permissions change live.
        </p>
      </div>
    </motion.section>
  )
}

/* ═══════════════════════════════════════════════════════════
   Section 2 — pipeline board: every draft, one rail, deep-links
   into the exact module where work continues.
   ═══════════════════════════════════════════════════════════ */
const RAIL_STAGES = [
  { id: 'draft', label: 'Draft' },
  { id: 'audit', label: 'Audit' },
  { id: 'fix', label: 'Fix' },
  { id: 'review', label: 'Review' },
  { id: 'live', label: 'Live' },
] as const

function PipelineBoard() {
  const { data } = useApp()
  const drafts = data?.drafts ?? []

  return (
    <section aria-label="Draft pipeline">
      <SectionHead
        kicker="Continue where you left off"
        title="The brand pipeline"
        desc="Every draft rides the same rail — Draft → Audit → Fix → Review → Live. Open one and you land in the exact module where its work continues."
      />
      <div className="grid gap-3 lg:grid-cols-2">
        {drafts.length === 0
          ? [0, 1, 2].map((i) => (
              <div
                key={`sk-${i}`}
                className="h-36 animate-pulse rounded-xl border border-zinc-200/60 bg-zinc-100/60"
              />
            ))
          : drafts.map((d, i) => (
              <PipelineCard
                key={d.id}
                draft={d}
                audit={data?.audits[d.id]}
                index={i}
              />
            ))}
      </div>
    </section>
  )
}

function PipelineCard({
  draft,
  audit,
  index,
}: {
  draft: DraftDTO
  audit?: AuditResult
  index: number
}) {
  const { selectDraft } = useApp()

  const stages = RAIL_STAGES.map((s) => ({
    ...s,
    done:
      s.id === 'draft'
        ? true
        : s.id === 'audit'
          ? !!audit
          : s.id === 'fix'
            ? fixDone(draft)
            : s.id === 'review'
              ? reviewDone(draft)
              : draft.status === 'APPROVED',
  }))
  const doneCount = stages.filter((s) => s.done).length
  const allDone = doneCount === stages.length
  const activeIdx = allDone ? -1 : doneCount
  const fillPct = allDone ? 100 : ((doneCount - 1) / (stages.length - 1)) * 100
  const nextStage = allDone ? null : stages[activeIdx]
  const route = routeFor(draft)
  const open = () => selectDraft(draft.id, route)

  const approved = draft.status === 'APPROVED'
  const scoreTone =
    !audit || audit.score >= 85
      ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
      : audit.score >= 60
        ? 'text-amber-600 bg-amber-50 border-amber-200'
        : 'text-rose-600 bg-rose-50 border-rose-200'

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.06 * index, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="group cursor-pointer rounded-xl border border-zinc-200/80 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300"
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          open()
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`Open ${draft.title} in ${VIEW_LABEL[route]}`}
    >
      {/* header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 transition-colors duration-200 group-hover:bg-zinc-900 group-hover:text-white">
            {draft.kind === 'image' ? (
              <ImageIcon className="h-4 w-4" />
            ) : (
              <ScanSearch className="h-4 w-4" />
            )}
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold leading-snug text-zinc-900">
              {draft.title}
            </h3>
            <p className="mt-0.5 truncate text-[11px] text-zinc-500">
              {draft.creator} · {draft.channel} · {draft.kind} · v{draft.version} ·{' '}
              {timeAgo(draft.updatedAt)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {audit && approved ? (
            <span
              className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-bold text-emerald-600"
              title="Governed publication — tamper-evident certificate issued"
            >
              <BadgeCheck className="h-3 w-3" />
              certified
            </span>
          ) : audit ? (
            <span
              className={cn(
                'rounded-md border px-1.5 py-0.5 text-[11px] font-bold tabular-nums',
                scoreTone
              )}
              title={`Latest audit score ${audit.score}/100`}
            >
              {audit.score}
            </span>
          ) : null}
          <StatusChip status={draft.status} />
        </div>
      </div>

      {/* rail */}
      <div className="mt-4 px-1">
        <div className="relative flex items-start justify-between">
          {/* track */}
          <span className="absolute left-6 right-6 top-[9px] h-[3px] rounded-full bg-zinc-200/80" />
          <motion.span
            className="absolute left-6 right-6 top-[9px] h-[3px] origin-left rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: fillPct / 100 }}
            transition={{ delay: 0.25 + 0.06 * index, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          />
          {stages.map((s, i) => {
            const isActive = i === activeIdx
            return (
              <div key={s.id} className="relative z-10 flex w-12 flex-col items-center">
                <span
                  className={cn(
                    'relative flex h-5 w-5 items-center justify-center rounded-full border-2 text-[9px] font-bold transition-all duration-300',
                    s.done
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : isActive
                        ? 'border-emerald-400 bg-white text-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.18)]'
                        : 'border-zinc-300 bg-zinc-50 text-zinc-400'
                  )}
                >
                  {isActive && (
                  <span
                    aria-hidden
                    className="absolute inset-0 animate-ping rounded-full bg-emerald-400/40"
                  />
                )}
                {s.done ? <Check className="h-3 w-3" strokeWidth={3.5} /> : i + 1}
                </span>
                <span
                  className={cn(
                    'mt-1.5 text-[10px] leading-tight',
                    s.done
                      ? 'font-semibold text-zinc-700'
                      : isActive
                        ? 'font-bold text-emerald-600'
                        : 'text-zinc-400'
                  )}
                >
                  {s.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* footer row */}
      <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-zinc-100 pt-3">
        <p className="min-w-0 truncate text-xs text-zinc-500">
          {allDone ? (
            <>
              <span className="font-semibold text-emerald-600">Done:</span>{' '}
              approved & certified — view the tamper-evident certificate
            </>
          ) : (
            <>
              <span className="font-semibold text-zinc-700">Next:</span>{' '}
              {NEXT_HINT[nextStage!.id]}{' '}
              <span className="text-zinc-400">· {VIEW_LABEL[route]}</span>
            </>
          )}
        </p>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-emerald-600 transition-all duration-200 group-hover:gap-2 group-hover:text-emerald-500">
          Open <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </motion.article>
  )
}

/* ═══════════════════════════════════════════════════════════
   Section 5 — interactive workflow rail (auto-advancing,
   click any stage to explore the matching module)
   ═══════════════════════════════════════════════════════════ */
const STEPS: {
  n: number
  title: string
  actor: string
  desc: string
  view: View
}[] = [
  {
    n: 1,
    title: 'Brand Vault Onboarding',
    actor: 'Brand Manager',
    desc: 'Voice rules, verified facts, terminology, colour tokens & assets indexed with unique clause IDs — the single source of truth every flag must cite.',
    view: 'vault',
  },
  {
    n: 2,
    title: 'Multi-Format Submission',
    actor: 'Creator',
    desc: 'Text, Markdown, PNG/JPG visuals — with target channel selection. Submitting from the dashboard lands you here with the draft pre-selected.',
    view: 'audit',
  },
  {
    n: 3,
    title: 'Parallel 6-Pillar Audit',
    actor: 'VeriLoom Engine',
    desc: 'Deterministic math (ΔE2000, WCAG 2.1) + citation-gated RAG run simultaneously — ungrounded AI flags are suppressed before a human ever sees them.',
    view: 'audit',
  },
  {
    n: 4,
    title: 'Explainable Remediation',
    actor: 'Creator',
    desc: 'Every flag cites its clause. Accept surgical fixes or override with a written justification that flows into the Blindspot Engine.',
    view: 'remediation',
  },
  {
    n: 5,
    title: 'Role-Based Sign-Off',
    actor: 'Manager → Reviewer',
    desc: 'Side-by-side diffs, threaded comments, RBAC state machine, formal approval. Managers pre-screen; only the Authorised Reviewer can sign off.',
    view: 'review',
  },
  {
    n: 6,
    title: 'Governance Insights',
    actor: 'Brand Leadership',
    desc: 'Recurring mistakes, override clusters and ambiguous-guideline detection — the Vault learns from every human decision.',
    view: 'analytics',
  },
]

function WorkflowRail() {
  const { setView } = useApp()
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [hovering, setHovering] = useState(false)

  useEffect(() => {
    if (!playing || hovering) return
    const id = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 4200)
    return () => clearInterval(id)
  }, [playing, hovering])

  const current = STEPS[step]
  const fillPct = (step / (STEPS.length - 1)) * 100

  return (
    <section
      aria-label="Governance workflow"
      onPointerEnter={() => setHovering(true)}
      onPointerLeave={() => setHovering(false)}
    >
      <SectionHead
        kicker="How it works"
        title="One workflow, six stages, three roles"
        desc="The rail advances on its own — click any stage to hold it there and jump into the matching module."
        right={
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-600 shadow-sm transition-colors hover:border-zinc-300 hover:text-zinc-900"
            aria-label={playing ? 'Pause auto-advance' : 'Resume auto-advance'}
          >
            {playing ? (
              <Pause className="h-3 w-3" />
            ) : (
              <Play className="h-3 w-3" />
            )}
            {playing ? 'Auto' : 'Paused'}
          </button>
        }
      />

      <div className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm sm:p-6">
        {/* the rail */}
        <div className="relative flex items-start justify-between sm:px-1">
          <span className="absolute left-7 right-7 top-[13px] h-[3px] rounded-full bg-zinc-200/80 sm:left-10 sm:right-10" />
          <motion.span
            className="absolute left-7 right-7 top-[13px] h-[3px] origin-left rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 sm:left-10 sm:right-10"
            initial={false}
            animate={{ scaleX: fillPct / 100 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          />
          {STEPS.map((s, i) => {
            const isActive = i === step
            const isPast = i < step
            return (
              <button
                key={s.n}
                type="button"
                onClick={() => {
                  setStep(i)
                  setPlaying(false)
                }}
                aria-current={isActive ? 'step' : undefined}
                className="relative z-10 flex w-14 flex-col items-center outline-none sm:w-20"
                title={s.title}
              >
                <motion.span
                  animate={{ scale: isActive ? 1.18 : 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-bold transition-colors duration-300',
                    isPast
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : isActive
                        ? 'border-emerald-400 bg-white text-emerald-600 shadow-[0_0_0_5px_rgba(16,185,129,0.2)]'
                        : 'border-zinc-300 bg-zinc-50 text-zinc-400 hover:border-zinc-400 hover:text-zinc-600'
                  )}
                >
                  {isPast ? <Check className="h-3.5 w-3.5" strokeWidth={3.5} /> : s.n}
                </motion.span>
                <span
                  className={cn(
                    'mt-2 hidden text-center text-[10.5px] leading-tight sm:block',
                    isActive
                      ? 'font-bold text-emerald-600'
                      : isPast
                        ? 'font-semibold text-zinc-600'
                        : 'text-zinc-400'
                  )}
                >
                  {s.title.split(' ').slice(0, 2).join(' ')}
                </span>
              </button>
            )
          })}
        </div>

        {/* detail panel */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 rounded-xl border border-zinc-100 bg-zinc-50/70 p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-400">
                  Stage {current.n} of {STEPS.length} · {current.actor}
                </p>
                <h3 className="mt-1 text-base font-bold tracking-tight text-zinc-900">
                  {current.title}
                </h3>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-500">
                  {current.desc}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 border-zinc-300 bg-white text-zinc-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                onClick={() => setView(current.view)}
              >
                Open {VIEW_LABEL[current.view]}
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════
   Shared bits
   ═══════════════════════════════════════════════════════════ */
function SectionHead({
  kicker,
  title,
  desc,
  right,
}: {
  kicker: string
  title: string
  desc?: string
  right?: React.ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="mb-3.5 flex flex-wrap items-end justify-between gap-3"
    >
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-zinc-400">
          {kicker}
        </p>
        <h2 className="mt-0.5 text-lg font-bold tracking-tight text-zinc-900">{title}</h2>
        {desc && (
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-zinc-500">{desc}</p>
        )}
      </div>
      {right}
    </motion.div>
  )
}

function EngineCard({
  icon: Icon,
  title,
  body,
  engines,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  body: string
  engines: ('deterministic' | 'rag' | 'hybrid' | 'vlm')[]
}) {
  return (
    <div className="group vl-lift rounded-xl border border-zinc-200/80 bg-white p-4 shadow-sm transition-colors duration-200 hover:border-zinc-300">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 transition-colors duration-200 group-hover:bg-emerald-50 group-hover:text-emerald-600">
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="text-sm font-bold text-zinc-900">{title}</h3>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-zinc-500">{body}</p>
      {engines.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {engines.map((e) => (
            <EngineChip key={e} engine={e} />
          ))}
        </div>
      )}
    </div>
  )
}

function ActivityTimeline() {
  const { data } = useApp()
  const events = useMemo(() => (data?.events ?? []).slice(0, 14), [data])

  return (
    <div className="max-h-[430px] overflow-y-auto rounded-xl border border-zinc-200/80 bg-white p-4 shadow-sm vl-scroll">
      {events.length === 0 ? (
        <p className="p-6 text-center text-xs text-zinc-400">
          No activity yet — run your first audit.
        </p>
      ) : (
        <ol className="relative space-y-1">
          <span
            aria-hidden
            className="absolute bottom-2 left-[6.5px] top-2 w-px bg-zinc-200"
          />
          {events.map((e, i) => (
            <motion.li
              key={e.id}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: Math.min(i * 0.04, 0.3), duration: 0.35 }}
              className="relative rounded-lg px-2 py-1.5 pl-6 transition-colors hover:bg-zinc-50"
            >
              <span
                className={cn(
                  'absolute left-0 top-[13px] h-3 w-3 rounded-full border-2 border-white',
                  e.action === 'AI_CALL' && 'bg-teal-400',
                  e.action === 'AUDIT_RUN' && 'bg-emerald-500',
                  e.action === 'OVERRIDE' && 'bg-amber-500',
                  e.action === 'STATUS_CHANGE' && 'bg-zinc-400',
                  e.action === 'CERT_ISSUED' && 'bg-emerald-600',
                  e.action.startsWith('VAULT') && 'bg-zinc-700'
                )}
              />
              <p className="truncate text-xs font-medium text-zinc-800">
                {describeEvent(e.action, e.details)}
              </p>
              <p className="text-[10.5px] text-zinc-400">
                {e.actor} · {timeAgo(e.createdAt)}
              </p>
            </motion.li>
          ))}
        </ol>
      )}
    </div>
  )
}

function describeEvent(action: string, details: Record<string, unknown>): string {
  switch (action) {
    case 'AUDIT_RUN':
      return `6-pillar audit completed — score ${details.score}, ${details.findings} findings (${details.suppressed} suppressed)`
    case 'AI_CALL':
      return `AI call: ${String(details.purpose ?? 'inference').slice(0, 70)}`
    case 'OVERRIDE':
      return `Human override on ${details.findingKey} — “${String(details.justification ?? '').slice(0, 48)}…”`
    case 'STATUS_CHANGE':
      return `Status: ${details.from ?? '∅'} → ${details.to}`
    case 'CERT_ISSUED':
      return 'Compliance certificate issued'
    case 'VAULT_INIT':
      return String(details.message ?? 'Vault initialised')
    case 'VAULT_EDIT':
      return `Vault clause ${details.verb} — ${details.clauseId}`
    case 'ACCEPT':
      return `Finding ${details.findingKey} accepted`
    default:
      return action
  }
}
