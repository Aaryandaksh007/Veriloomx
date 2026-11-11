'use client'

// ─────────────────────────────────────────────────────────────
// VeriLoom AI — 60-second guided demo checklist
// Auto-tracks the golden path from live store data.
// ─────────────────────────────────────────────────────────────
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Check, Trophy } from 'lucide-react'
import { useApp } from '@/lib/store'
import { auditHasEngineErrors, type DraftDTO } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface DemoStep {
  id: string
  title: string
  hint: string
  done: boolean
  action: () => void
}

const isRemediated = (status: DraftDTO['status']) =>
  status === 'REMEDIATED' || status === 'IN_REVIEW' || status === 'APPROVED'

export function DemoChecklist() {
  const { data, setView, selectDraft, role, selectedDraftId } = useApp()

  // ── Skeleton while bootstrapping ─────────────────────
  if (data === null) {
    return (
      <section className="space-y-3" aria-busy="true" aria-label="Loading demo checklist">
        <div className="h-5 w-44 animate-pulse rounded-md bg-parchment" />
        <div className="h-3.5 w-full max-w-md animate-pulse rounded-md bg-parchment" />
        <div className="h-2 w-full animate-pulse rounded-full bg-parchment" />
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-parchment" />
          ))}
        </div>
      </section>
    )
  }

  const drafts = data.drafts
  const journeyDraft =
    drafts.find((draft) => draft.id === selectedDraftId) ??
    drafts.find((draft) => draft.status !== 'APPROVED') ??
    drafts[0]
  const journeyAudit = journeyDraft ? data.audits[journeyDraft.id] : undefined
  const auditDone = Boolean(
    journeyAudit && !auditHasEngineErrors(journeyAudit.pillars)
  )
  const remediationDone = journeyDraft ? isRemediated(journeyDraft.status) : false
  const approvalDone = journeyDraft?.status === 'APPROVED'
  const certDone = Boolean(
    journeyDraft &&
      data.events.some(
        (event) => event.action === 'CERT_ISSUED' && event.draftId === journeyDraft.id
      )
  )

  const steps: DemoStep[] = [
    {
      id: 'audit',
      title: 'Run a 6-pillar audit',
      hint: journeyDraft
        ? 'Run the six checks on this draft; incomplete checks stay open until recovered.'
        : 'Create a draft in Audit Studio to start the guided flow.',
      done: auditDone,
      action: () => {
        if (journeyDraft) selectDraft(journeyDraft.id, 'audit')
        else setView('audit')
      },
    },
    {
      id: 'remediation',
      title: 'Fix findings in Remediation',
      hint:
        !journeyDraft
          ? 'Create a draft in Audit Studio before resolving its findings.'
          : role === 'creator'
            ? 'Accept or override each cited finding on this draft before creating a remediated version.'
            : 'Requires an Author account — inspect this draft’s findings and cited clauses.',
      done: remediationDone,
      action: () => {
        if (journeyDraft) selectDraft(journeyDraft.id, 'remediation')
        else setView('remediation')
      },
    },
    {
      id: 'review',
      title: 'Send for review & approve',
      hint:
        !journeyDraft
          ? 'Create and audit a draft before sending it for review.'
          : role === 'reviewer'
            ? 'You hold Approver sign-off — approve this draft once it reaches In Review.'
            : role === 'manager'
              ? 'You hold Reviewer access — inspect this draft’s version diffs and request changes if needed.'
              : 'Use separate Author, Reviewer, and Approver accounts to review this draft and sign it off.',
      done: approvalDone,
      action: () => {
        if (journeyDraft) selectDraft(journeyDraft.id, 'review')
        else setView('review')
      },
    },
    {
      id: 'certificate',
      title: 'Claim the compliance certificate',
      hint: journeyDraft
        ? 'Open the tamper-evident certificate after this draft is approved.'
        : 'Create, audit, and approve a draft before issuing its certificate.',
      done: certDone,
      action: () => {
        if (journeyDraft) {
          selectDraft(journeyDraft.id, journeyDraft.status === 'APPROVED' ? 'certificate' : 'review')
        }
        else setView('certificate')
      },
    },
  ]

  const doneCount = steps.filter((s) => s.done).length
  const pct = (doneCount / steps.length) * 100
  const allDone = doneCount === steps.length

  return (
    <section className="space-y-3">
      {/* ── Header + counter ─────────────────────────────── */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg font-semibold tracking-tight text-ink">
            The 60-second demo
          </h2>
          <p className="mt-0.5 text-sm text-ink-soft">
            {journeyDraft
              ? `Tracking “${journeyDraft.title}” through the golden path. Steps only complete when this draft reaches each milestone.`
              : 'Create a draft first, then follow it through audit, remediation, review, and approval.'}
          </p>
        </div>
        <span className="shrink-0 text-sm font-bold tabular-nums text-ink">
          {doneCount}
          <span className="font-semibold text-faint">/{steps.length}</span>
        </span>
      </div>

      {/* ── Progress bar ─────────────────────────────────── */}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-parchment"
        role="progressbar"
        aria-valuenow={doneCount}
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-label="Demo progress"
      >
        <motion.div
          className="h-full rounded-full bg-terra-500"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>

      {/* ── Step rows ────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-line bg-paper">
        {steps.map((s, i) => (
          <motion.div
            key={s.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: s.done ? 0.65 : 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.04 }}
            className={cn(
              'flex items-center gap-3 p-3 sm:p-4',
              i > 0 && 'border-t border-stone-200',
            )}
          >
            {/* checkbox circle */}
            <span
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                s.done
                  ? 'bg-terra-500 text-cream'
                  : 'border-2 border-stone-300 text-xs font-bold text-faint',
              )}
            >
              {s.done ? (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  className="flex"
                >
                  <Check className="h-4 w-4" strokeWidth={3} />
                </motion.span>
              ) : (
                i + 1
              )}
            </span>

            {/* title + hint */}
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'text-sm font-semibold leading-snug',
                  s.done ? 'text-faint line-through' : 'text-ink',
                )}
              >
                {s.title}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{s.hint}</p>
            </div>

            {/* action */}
            <Button
              variant="ghost"
              size="sm"
              onClick={s.action}
              className={cn(
                'h-8 shrink-0 px-2.5 text-xs font-semibold',
                s.done
                  ? 'text-terra-600 hover:text-terra-700'
                  : 'text-ink-soft hover:text-ink',
              )}
            >
              {s.done ? 'Done' : 'Go'}
              {s.done ? (
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              ) : (
                <ArrowRight className="h-3.5 w-3.5" />
              )}
            </Button>
          </motion.div>
        ))}
      </div>

      {/* ── Celebration strip ────────────────────────────── */}
      <AnimatePresence>
        {allDone && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 220, damping: 18 }}
            className="flex items-center gap-3 rounded-xl border border-olive-200 bg-olive-50 p-4"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-olive-500">
              <Trophy className="h-5 w-5 text-cream" />
            </span>
            <p className="text-sm font-semibold leading-relaxed text-olive-900">
              Demo complete — you just governed a launch end-to-end.
              That&rsquo;s VeriLoom.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
