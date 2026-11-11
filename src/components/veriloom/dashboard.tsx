'use client'

// ─────────────────────────────────────────────────────────────
// VeriLoom AI — Dashboard (mission control)
// Every module hangs off this page: live stats, the draft
// pipeline board ("continue where you left off"), the live
// playground, a guided demo, and an interactive workflow rail.
// ─────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useState } from 'react'
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
  Users,
  Zap,
} from 'lucide-react'
import { useApp, roleIdentity, type View } from '@/lib/store'
import { auditHasEngineErrors, ROLE_META, type AuditResult, type DraftDTO, type Role, type VaultItemDTO } from '@/lib/types'
import { diffVaultSnapshot } from '@/lib/vault-lineage'
import { AnimatedNumber, EngineChip, StatusChip, timeAgo } from './shared'
import { ProblemSection, type FailureId } from './problem-section'
import { LivePlayground } from './live-playground'
import { CampaignDriftChecker } from './campaign-drift-checker'
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
  d.status === 'APPROVED'

const reviewDone = (d: DraftDTO) =>
  d.status === 'IN_REVIEW' || d.status === 'CHANGES_REQUESTED' || d.status === 'APPROVED'

/** Where should this draft be worked on right now? */
function routeFor(d: DraftDTO, audit?: AuditResult): View {
  if (d.status !== 'APPROVED' && audit && auditHasEngineErrors(audit.pillars)) {
    return 'audit'
  }

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
  review: 'Ready for role-gated review & sign-off',
  live: 'Approved — certificate available',
}

export function DashboardView() {
  const { data, setView, selectDraft, role, userName, setAccountsDialogOpen } = useApp()
  const [requestedPlaygroundSample, setRequestedPlaygroundSample] = useState<string | null>(null)
  const clearRequestedPlaygroundSample = useCallback(
    () => setRequestedPlaygroundSample(null),
    []
  )

  const audits = data ? Object.values(data.audits) : []
  const totalFindings = audits.reduce((s, a) => s + a.findings.length, 0)
  const totalSuppressed = audits.reduce((s, a) => s + a.suppressed, 0)
  const inFlight = data?.drafts.filter((d) => d.status !== 'APPROVED').length ?? 0
  const demoDraft =
    data?.drafts.find(
      (d) => d.title.includes('Pricing update') && d.status !== 'APPROVED'
    ) ??
    data?.drafts.find((d) => d.title.includes('Press release')) ??
    data?.drafts.find((d) => d.status !== 'APPROVED') ??
    data?.drafts[0]

  const teamSummary = data?.teamSummary
  const missingWorkflowRoles: Role[] =
    role === 'admin' && teamSummary
      ? (['creator', 'manager', 'reviewer'] as Role[]).filter(
          (r) => (teamSummary.roleCounts[r] ?? 0) === 0
        )
      : []

  const roleQueueAction = useMemo((): { label: string; badge: string; onClick: () => void } => {
    const allDrafts = data?.drafts ?? []
    const auditsById = data?.audits ?? {}
    const vaultItems = data?.vault ?? []
    const firstIncomplete = allDrafts.find((d) => {
      const a = auditsById[d.id]
      return d.status !== 'APPROVED' && a && auditHasEngineErrors(a.pillars)
    })
    const staleCount = allDrafts.filter((d) => {
      const a = auditsById[d.id]
      return d.status !== 'APPROVED' && a && diffVaultSnapshot(a.vaultSnapshot, vaultItems).isStale
    }).length

    if (role === 'creator') {
      if (firstIncomplete) {
        return {
          badge: 'Fail-safe recovery',
          label: `Recover incomplete check · ${firstIncomplete.title}`,
          onClick: () => selectDraft(firstIncomplete.id, 'audit'),
        }
      }
      const nextFix = allDrafts.find((d) => d.status === 'CHANGES_REQUESTED' || d.status === 'AUDITED')
      if (nextFix) {
        return {
          badge: nextFix.status === 'CHANGES_REQUESTED' ? 'Changes requested' : 'Needs remediation',
          label: `Open Remediation · ${nextFix.title}`,
          onClick: () => selectDraft(nextFix.id, 'remediation'),
        }
      }
      const nextSubmit = allDrafts.find((d) => d.status === 'REMEDIATED')
      if (nextSubmit) {
        return {
          badge: 'Ready to submit',
          label: `Submit for review · ${nextSubmit.title}`,
          onClick: () => selectDraft(nextSubmit.id, 'review'),
        }
      }
      const nextDraft = allDrafts.find((d) => d.status === 'DRAFT') ?? allDrafts[0]
      return {
        badge: 'Author queue',
        label: nextDraft ? `Run 6-pillar audit · ${nextDraft.title}` : 'Open Audit Studio',
        onClick: () => (nextDraft ? selectDraft(nextDraft.id, 'audit') : setView('audit')),
      }
    }

    if (role === 'manager') {
      const waiting = allDrafts.filter((d) => d.status === 'IN_REVIEW')
      if (waiting[0]) {
        return {
          badge: `${waiting.length} in review`,
          label: `Review & screen · ${waiting[0].title}`,
          onClick: () => selectDraft(waiting[0].id, 'review'),
        }
      }
      return {
        badge: '0 waiting',
        label: 'Inspect version diffs in Review',
        onClick: () => setView('review'),
      }
    }

    if (role === 'reviewer') {
      const waiting = allDrafts.filter((d) => d.status === 'IN_REVIEW')
      if (waiting[0]) {
        return {
          badge: `${waiting.length} awaiting sign-off`,
          label: `Approve & certify · ${waiting[0].title}`,
          onClick: () => selectDraft(waiting[0].id, 'review'),
        }
      }
      const certified = allDrafts.find((d) => d.status === 'APPROVED')
      return {
        badge: 'Approver queue',
        label: certified ? `Inspect certificate · ${certified.title}` : 'Open Review & Approval',
        onClick: () => (certified ? selectDraft(certified.id, 'certificate') : setView('review')),
      }
    }

    if (staleCount > 0) {
      return {
        badge: `${staleCount} drifted`,
        label: 'Inspect policy drift in Brand Vault',
        onClick: () => setView('vault'),
      }
    }
    return {
      badge: `${vaultItems.length} clauses`,
      label: 'Manage rules in Brand Vault',
      onClick: () => setView('vault'),
    }
  }, [data, role, selectDraft, setView])

  const tryFailure = (failureId: FailureId) => {
    if (failureId === 'facts' || failureId === 'tone') {
      setRequestedPlaygroundSample(failureId === 'facts' ? 'pricing' : 'hell')
      document
        .getElementById('live-playground')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    const banner = data?.drafts.find(
      (draft) => draft.kind === 'image' && draft.title.toLowerCase().includes('banner')
    )
    if (banner) {
      selectDraft(banner.id, 'audit')
    } else {
      setView('audit')
    }
  }

  return (
    <div className="space-y-8">
      {/* ── 1 · Command bar ─────────────────────────────── */}
      <CommandBar
        clauses={data?.vault.length ?? 0}
        inFlight={inFlight}
        findings={totalFindings}
        suppressed={totalSuppressed}
        role={role}
        userName={userName}
        roleLabel={roleIdentity(role, userName).label}
        roleQueueAction={roleQueueAction}
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

      {role === 'admin' && missingWorkflowRoles.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-terra-200 bg-terra-50/70 px-5 py-3.5">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">
              Provision team roles to complete the multi-user workflow
            </p>
            <p className="mt-0.5 text-xs text-ink-soft">
              Active accounts missing for:{' '}
              <span className="font-semibold text-terra-800">
                {missingWorkflowRoles.map((r) => ROLE_META[r].label).join(', ')}
              </span>
              . Create separate accounts so each gate is exercised by its assigned role.
            </p>
          </div>
          <Button
            size="sm"
            className="bg-terra-600 text-cream hover:bg-terra-500"
            onClick={() => setAccountsDialogOpen(true)}
          >
            <Users className="mr-1.5 h-3.5 w-3.5" />
            Manage workspace accounts
          </Button>
        </div>
      )}

      {/* ── 2 · The concrete problem + proof path ──────── */}
      <ProblemSection onTryFailure={tryFailure} />

      {/* ── 3 · Run the check against real copy ────────── */}
      <div id="live-playground" className="scroll-mt-6">
        <LivePlayground
          requestedSample={requestedPlaygroundSample}
          onSampleLoaded={clearRequestedPlaygroundSample}
        />
      </div>

      <CampaignDriftChecker />

      {/* ── 4 · Guided demo checklist ──────────────────── */}
      <DemoChecklist />

      {/* ── 5 · Draft pipeline ────────────────────────── */}
      <PipelineBoard />

      {/* ── 6 · Interactive workflow rail ──────────────── */}
      <WorkflowRail />

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
  role,
  userName,
  roleLabel,
  roleQueueAction,
  onTryLive,
  onDemoAudit,
}: {
  clauses: number
  inFlight: number
  findings: number
  suppressed: number
  role: Role
  userName: string
  roleLabel: string
  roleQueueAction: { badge: string; label: string; onClick: () => void }
  onTryLive: () => void
  onDemoAudit: () => void
}) {
  const stats: { label: string; value: number; hint: string; tone?: string }[] = [
    { label: 'Vault clauses', value: clauses, hint: 'indexed & citable' },
    { label: 'Drafts in flight', value: inFlight, hint: 'under governance' },
    { label: 'Findings caught', value: findings, hint: 'across all audits' },
    {
      label: 'Ungrounded flags suppressed',
      value: suppressed,
      hint: 'zero-hallucination guard',
      tone: 'text-olive-700',
    },
  ]

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden rounded-xl border border-line bg-paper"
    >
      <div className="p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-olive-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-olive-500" />
              </span>
              Live workspace · auto-sync
            </p>
            <h1
              suppressHydrationWarning
              className="mt-2 font-serif text-2xl font-semibold tracking-tight text-ink sm:text-[1.7rem]"
            >
              Anyone can publish. Nobody double-checks.
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-soft">
              Marketing teams ship dozens of assets every week. VeriLoom checks every draft
              against approved facts, visual identity and legal restrictions before it goes live —{' '}
              <span className="font-semibold text-ink">
                with cited evidence, one-click fixes and a certificate for every approval.
              </span>
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              size="sm"
              className="bg-terra-500 text-cream hover:bg-terra-600"
              onClick={onTryLive}
            >
              <Zap className="mr-1.5 h-3.5 w-3.5" />
              Test risky copy
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-stone-300 bg-paper text-ink-soft hover:bg-parchment hover:text-ink"
              onClick={onDemoAudit}
            >
              <ScanSearch className="mr-1.5 h-3.5 w-3.5" />
              See a real audit
            </Button>
          </div>
        </div>

        {/* live stat strip */}
        <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-stone-200 pt-5 lg:grid-cols-4">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.08, duration: 0.4 }}
            >
              <p
                className={cn(
                  'text-2xl font-semibold tabular-nums tracking-tight text-ink',
                  s.tone
                )}
              >
                <AnimatedNumber value={s.value} />
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-ink-soft">{s.label}</p>
              <p className="text-[10.5px] text-faint">{s.hint}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* hairline role bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 bg-parchment/60 px-5 py-2.5 sm:px-7">
        <p className="min-w-0 truncate text-[11px] text-ink-soft">
          Signed in as <span className="font-semibold text-ink">{userName}</span> ({roleLabel}) — {ROLE_META[role].desc}. Actions across VeriLoom reflect your verified permissions.
        </p>
        <button
          type="button"
          onClick={roleQueueAction.onClick}
          className="inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-full border border-terra-200 bg-paper px-3 py-1 text-[11px] font-semibold text-terra-700 transition-colors hover:border-terra-300 hover:bg-terra-50"
        >
          <span className="rounded bg-terra-50 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-terra-700">
            {roleQueueAction.badge}
          </span>
          <span className="max-w-[240px] truncate">{roleQueueAction.label}</span>
          <ArrowRight className="h-3 w-3 shrink-0" />
        </button>
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
  const { data, setView } = useApp()
  const drafts = data?.drafts ?? []

  return (
    <section aria-label="Draft pipeline">
      <SectionHead
        kicker="Continue where you left off"
        title="The brand pipeline"
        desc="Every draft rides the same rail — Draft → Audit → Fix → Review → Live. Open one and you land in the exact module where its work continues."
      />
      <div className="grid gap-3 lg:grid-cols-2">
        {drafts.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-line bg-paper p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-ink">No drafts yet</h3>
              <p className="mt-1 text-sm text-ink-soft">
                Create a draft to start the audit, remediation, and approval workflow.
              </p>
            </div>
            <Button size="sm" onClick={() => setView('audit')}>
              Create a draft <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          drafts.map((d, i) => (
            <PipelineCard
              key={d.id}
              draft={d}
              audit={data?.audits[d.id]}
              vault={data?.vault ?? []}
              index={i}
            />
          ))
        )}
      </div>
    </section>
  )
}

function PipelineCard({
  draft,
  audit,
  vault,
  index,
}: {
  draft: DraftDTO
  audit?: AuditResult
  vault: VaultItemDTO[]
  index: number
}) {
  const { selectDraft } = useApp()
  const incomplete = audit ? auditHasEngineErrors(audit.pillars) : false
  const vaultDrift = audit ? diffVaultSnapshot(audit.vaultSnapshot, vault) : null

  const stages = RAIL_STAGES.map((s) => ({
    ...s,
    done:
      s.id === 'draft'
        ? true
        : s.id === 'audit'
          ? !!audit && !incomplete
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
  const route = routeFor(draft, audit)
  const open = () => selectDraft(draft.id, route)

  const approved = draft.status === 'APPROVED'
  const scoreTone =
    !audit || audit.score >= 85
      ? 'text-olive-700 bg-olive-50 border-olive-200'
      : audit.score >= 60
        ? 'text-ochre-700 bg-ochre-50 border-ochre-200'
        : 'text-clay-700 bg-clay-50 border-clay-200'

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.06 * index, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="group cursor-pointer rounded-xl border border-line bg-paper p-4 transition-all duration-200 hover:border-stone-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terra-400/60"
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
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-parchment text-ink-soft transition-colors duration-200 group-hover:bg-ink group-hover:text-cream">
            {draft.kind === 'image' ? (
              <ImageIcon className="h-4 w-4" />
            ) : (
              <ScanSearch className="h-4 w-4" />
            )}
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold leading-snug text-ink">
              {draft.title}
            </h3>
            <p className="mt-0.5 truncate text-[11px] text-ink-soft">
              {draft.creator} · {draft.channel} · {draft.kind} · v{draft.version} ·{' '}
              {timeAgo(draft.updatedAt)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {audit && incomplete && (
            <span
              className="rounded-md border border-clay-300 bg-clay-50 px-1.5 py-0.5 text-[10.5px] font-bold text-clay-700"
              title="One or more checks failed — recover before remediation or approval"
            >
              Incomplete
            </span>
          )}
          {audit && !incomplete && !approved && vaultDrift?.isStale && (
            <span
              className="rounded-md border border-ochre-300 bg-ochre-50 px-1.5 py-0.5 text-[10.5px] font-bold text-ochre-700"
              title="Vault rules changed since this audit ran"
            >
              Rules updated
            </span>
          )}
          {audit && approved ? (
            <span
              className="inline-flex items-center gap-1 rounded-md border border-olive-200 bg-olive-50 px-1.5 py-0.5 text-[11px] font-bold text-olive-700"
              title="Governed publication — tamper-evident certificate issued"
            >
              <BadgeCheck className="h-3 w-3" />
              certified
            </span>
          ) : audit ? (
            <span
              className={cn(
                'rounded-md border px-1.5 py-0.5 text-[11px] font-bold tabular-nums',
                incomplete ? 'border-clay-300 bg-clay-50 text-clay-700' : scoreTone
              )}
              title={incomplete ? `Provisional score ${audit.score}/100 (checks incomplete)` : `Latest audit score ${audit.score}/100`}
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
          <span className="absolute left-6 right-6 top-[9px] h-[3px] rounded-full bg-line/80" />
          <motion.span
            className="absolute left-6 right-6 top-[9px] h-[3px] origin-left rounded-full bg-terra-500"
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
                      ? 'border-terra-500 bg-terra-500 text-cream'
                      : isActive
                        ? 'border-terra-400 bg-paper text-terra-600 shadow-[0_0_0_4px_rgba(201,100,66,0.18)]'
                        : 'border-stone-300 bg-parchment text-faint'
                  )}
                >
                  {isActive && (
                  <span
                    aria-hidden
                    className="absolute inset-0 animate-ping rounded-full bg-terra-400/40"
                  />
                )}
                {s.done ? <Check className="h-3 w-3" strokeWidth={3.5} /> : i + 1}
                </span>
                <span
                  className={cn(
                    'mt-1.5 text-[10px] leading-tight',
                    s.done
                      ? 'font-semibold text-ink-soft'
                      : isActive
                        ? 'font-bold text-terra-700'
                        : 'text-faint'
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
      <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-stone-200 pt-3">
        <p className="min-w-0 truncate text-xs text-ink-soft">
          {allDone ? (
            <>
              <span className="font-semibold text-olive-700">Done:</span>{' '}
              approved & certified — view the tamper-evident certificate
            </>
          ) : (
            <>
              <span className="font-semibold text-ink">Next:</span>{' '}
              {NEXT_HINT[nextStage!.id]}{' '}
              <span className="text-faint">· {VIEW_LABEL[route]}</span>
            </>
          )}
        </p>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-terra-600 transition-all duration-200 group-hover:gap-2 group-hover:text-terra-500">
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
    actor: 'Administrator',
    desc: 'Voice rules, verified facts, terminology, colour tokens & assets versioned with unique clause IDs — the single source of truth every flag must cite.',
    view: 'vault',
  },
  {
    n: 2,
    title: 'Multi-Format Submission',
    actor: 'Author',
    desc: 'Text, Markdown, PNG/JPG visuals — with target channel selection. Submitting from the dashboard lands you here with the draft pre-selected.',
    view: 'audit',
  },
  {
    n: 3,
    title: 'Parallel 6-Pillar Audit',
    actor: 'VeriLoom Engine',
    desc: 'Deterministic math (ΔE2000, WCAG 2.1) + citation-gated RAG run simultaneously — incomplete checks fail closed and ungrounded AI flags are suppressed.',
    view: 'audit',
  },
  {
    n: 4,
    title: 'Explainable Remediation',
    actor: 'Author',
    desc: 'Every flag cites its clause. Accept surgical fixes or override with a written justification that flows into the Blindspot Engine.',
    view: 'remediation',
  },
  {
    n: 5,
    title: 'Role-Based Sign-Off',
    actor: 'Reviewer → Approver',
    desc: 'Word-level version diffs, threaded comments, and a server-enforced state machine. Reviewers request changes; only an authenticated Approver can sign off.',
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
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1.5 text-[11px] font-semibold text-ink-soft transition-colors hover:border-stone-300 hover:text-ink"
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

      <div className="rounded-xl border border-line bg-paper p-5 sm:p-6">
        {/* the rail */}
        <div className="relative flex items-start justify-between sm:px-1">
          <span className="absolute left-7 right-7 top-[13px] h-[3px] rounded-full bg-line/80 sm:left-10 sm:right-10" />
          <motion.span
            className="absolute left-7 right-7 top-[13px] h-[3px] origin-left rounded-full bg-terra-500 sm:left-10 sm:right-10"
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
                      ? 'border-terra-500 bg-terra-500 text-cream'
                      : isActive
                        ? 'border-terra-400 bg-paper text-terra-600 shadow-[0_0_0_5px_rgba(201,100,66,0.2)]'
                        : 'border-stone-300 bg-parchment text-faint hover:border-stone-400 hover:text-ink-soft'
                  )}
                >
                  {isPast ? <Check className="h-3.5 w-3.5" strokeWidth={3.5} /> : s.n}
                </motion.span>
                <span
                  className={cn(
                    'mt-2 hidden text-center text-[10.5px] leading-tight sm:block',
                    isActive
                      ? 'font-bold text-terra-700'
                      : isPast
                        ? 'font-semibold text-ink-soft'
                        : 'text-faint'
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
            className="mt-6 rounded-xl border border-stone-200 bg-parchment/70 p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
                  Stage {current.n} of {STEPS.length} · {current.actor}
                </p>
                <h3 className="mt-1 text-base font-bold tracking-tight text-ink">
                  {current.title}
                </h3>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-soft">
                  {current.desc}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 border-stone-300 bg-paper text-ink-soft hover:border-terra-300 hover:bg-terra-50 hover:text-terra-700"
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
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-faint">
          {kicker}
        </p>
        <h2 className="mt-0.5 font-serif text-lg font-semibold tracking-tight text-ink">{title}</h2>
        {desc && (
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-soft">{desc}</p>
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
    <div className="group vl-lift rounded-xl border border-line bg-paper p-4 transition-colors duration-200 hover:border-stone-300">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-parchment text-ink-soft transition-colors duration-200 group-hover:bg-terra-50 group-hover:text-terra-600">
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="text-sm font-bold text-ink">{title}</h3>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-ink-soft">{body}</p>
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
    <div className="max-h-[430px] overflow-y-auto rounded-xl border border-line bg-paper p-4 vl-scroll">
      {events.length === 0 ? (
        <p className="p-6 text-center text-xs text-faint">
          No activity yet — run your first audit.
        </p>
      ) : (
        <ol className="relative space-y-1">
          <span
            aria-hidden
            className="absolute bottom-2 left-[6.5px] top-2 w-px bg-line"
          />
          {events.map((e, i) => (
            <motion.li
              key={e.id}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: Math.min(i * 0.04, 0.3), duration: 0.35 }}
              className="relative rounded-lg px-2 py-1.5 pl-6 transition-colors hover:bg-parchment"
            >
              <span
                className={cn(
                  'absolute left-0 top-[13px] h-3 w-3 rounded-full border-2 border-paper',
                  e.action === 'AI_CALL' && 'bg-terra-400',
                  e.action === 'AUDIT_RUN' && 'bg-terra-500',
                  e.action === 'OVERRIDE' && 'bg-ochre-500',
                  e.action === 'STATUS_CHANGE' && 'bg-stone-400',
                  e.action === 'CERT_ISSUED' && 'bg-olive-600',
                  e.action.startsWith('VAULT') && 'bg-stone-700'
                )}
              />
              <p className="truncate text-xs font-medium text-ink">
                {describeEvent(e.action, e.details)}
              </p>
              <p className="text-[10.5px] text-faint">
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
