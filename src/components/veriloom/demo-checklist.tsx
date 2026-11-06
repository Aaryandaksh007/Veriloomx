'use client'

// ─────────────────────────────────────────────────────────────
// VeriLoom AI — 60-second guided demo checklist
// Auto-tracks the golden path from live store data.
// ─────────────────────────────────────────────────────────────
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Check, Trophy } from 'lucide-react'
import { useApp } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface DemoStep {
  id: string
  title: string
  hint: string
  done: boolean
  action: () => void
}

const isRemediated = (status: string, version: number) =>
  status === 'REMEDIATED' || status === 'IN_REVIEW' || status === 'APPROVED' || version >= 2

export function DemoChecklist() {
  const { data, setView, selectDraft, role } = useApp()

  // ── Skeleton while bootstrapping ─────────────────────
  if (data === null) {
    return (
      <section className="space-y-3" aria-busy="true" aria-label="Loading demo checklist">
        <div className="h-5 w-44 animate-pulse rounded-md bg-zinc-100" />
        <div className="h-3.5 w-full max-w-md animate-pulse rounded-md bg-zinc-100" />
        <div className="h-2 w-full animate-pulse rounded-full bg-zinc-100" />
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-zinc-100" />
          ))}
        </div>
      </section>
    )
  }

  const drafts = data.drafts
  const auditDone = Object.keys(data.audits).length > 0
  const remediationDone = drafts.some((d) => isRemediated(d.status, d.version))
  const approvalDone = drafts.some((d) => d.status === 'APPROVED')
  const certDone = data.events.some((e) => e.action === 'CERT_ISSUED')

  // Draft pickers for each jump action
  const auditTarget =
    drafts.find((d) => d.kind === 'text' && d.status !== 'APPROVED') ??
    drafts.find((d) => d.status !== 'APPROVED') ??
    drafts[0]
  const remediationTarget =
    drafts.find((d) => isRemediated(d.status, d.version)) ?? drafts[0]
  const approvedDraft = drafts.find((d) => d.status === 'APPROVED')

  const steps: DemoStep[] = [
    {
      id: 'audit',
      title: 'Run a 6-pillar audit',
      hint: 'Open a draft and hit Run audit — all six checks fire in parallel.',
      done: auditDone,
      action: () => {
        if (auditTarget) selectDraft(auditTarget.id, 'audit')
        else setView('audit')
      },
    },
    {
      id: 'remediation',
      title: 'Fix findings in Remediation',
      hint:
        role === 'creator'
          ? 'Accept the one-click fixes — every flag cites its guideline clause.'
          : 'Switch to the Creator role, then accept the one-click fixes.',
      done: remediationDone,
      action: () => {
        if (remediationTarget) selectDraft(remediationTarget.id, 'remediation')
        else setView('remediation')
      },
    },
    {
      id: 'review',
      title: 'Send for review & approve',
      hint:
        role === 'reviewer'
          ? 'You hold the final sign-off — approve the draft that reached review.'
          : 'Creator submits, Manager pre-screens, Reviewer approves — switch roles to walk it.',
      done: approvalDone,
      action: () => setView('review'),
    },
    {
      id: 'certificate',
      title: 'Claim the compliance certificate',
      hint: 'Open the tamper-proof certificate for the approved draft.',
      done: certDone,
      action: () => {
        if (approvedDraft) selectDraft(approvedDraft.id, 'certificate')
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
          <h2 className="text-lg font-bold tracking-tight text-zinc-900">
            The 60-second demo
          </h2>
          <p className="mt-0.5 text-sm text-zinc-500">
            Follow the golden path judges walk — steps check themselves off as
            you go.
          </p>
        </div>
        <span className="shrink-0 text-sm font-bold tabular-nums text-zinc-900">
          {doneCount}
          <span className="font-semibold text-zinc-400">/{steps.length}</span>
        </span>
      </div>

      {/* ── Progress bar ─────────────────────────────────── */}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-zinc-100"
        role="progressbar"
        aria-valuenow={doneCount}
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-label="Demo progress"
      >
        <motion.div
          className="h-full rounded-full bg-emerald-500"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>

      {/* ── Step rows ────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        {steps.map((s, i) => (
          <motion.div
            key={s.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: s.done ? 0.65 : 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.04 }}
            className={cn(
              'flex items-center gap-3 p-3 sm:p-4',
              i > 0 && 'border-t border-zinc-100',
            )}
          >
            {/* checkbox circle */}
            <span
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                s.done
                  ? 'bg-emerald-500 text-white'
                  : 'border-2 border-zinc-300 text-xs font-bold text-zinc-400',
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
                  s.done ? 'text-zinc-400 line-through' : 'text-zinc-900',
                )}
              >
                {s.title}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{s.hint}</p>
            </div>

            {/* action */}
            <Button
              variant="ghost"
              size="sm"
              onClick={s.action}
              className={cn(
                'h-8 shrink-0 px-2.5 text-xs font-semibold',
                s.done
                  ? 'text-emerald-600 hover:text-emerald-700'
                  : 'text-zinc-600 hover:text-zinc-900',
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
            className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500">
              <Trophy className="h-5 w-5 text-white" />
            </span>
            <p className="text-sm font-semibold leading-relaxed text-emerald-900">
              Demo complete — you just governed a launch end-to-end.
              That&rsquo;s VeriLoom.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
