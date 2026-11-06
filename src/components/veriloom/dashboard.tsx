'use client'

// ─────────────────────────────────────────────────────────────
// VeriLoom AI — Dashboard
// ─────────────────────────────────────────────────────────────
import { motion } from 'framer-motion'
import {
  BookOpenCheck,
  FileStack,
  Flag,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Zap,
  Cpu,
  Eye,
  FlaskConical,
  ChevronRight,
  LibraryBig,
  Award,
} from 'lucide-react'
import { useApp } from '@/lib/store'
import { PILLAR_META, type Pillar } from '@/lib/types'
import { KpiCard, timeAgo, EngineChip, ClauseBadge } from './shared'
import { ProblemSection } from './problem-section'
import { LivePlayground } from './live-playground'
import { DemoChecklist } from './demo-checklist'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const PILLAR_ICON: Record<Pillar, React.ComponentType<{ className?: string }>> = {
  tone: Sparkles,
  terminology: BookOpenCheck,
  claims: Flag,
  visual: Eye,
  accessibility: ShieldCheck,
  confidentiality: ShieldAlert,
}

const STAGES = [
  { n: 1, title: 'Brand Vault Onboarding', desc: 'Voice rules, verified facts, terminology, colour tokens & assets indexed with unique clause IDs.', actor: 'Brand Manager' },
  { n: 2, title: 'Multi-Format Submission', desc: 'Text, Markdown, PNG/JPG visuals — with target channel selection.', actor: 'Creator' },
  { n: 3, title: 'Parallel 6-Pillar Audit', desc: 'Deterministic math (ΔE2000, WCAG 2.1) + citation-gated RAG run simultaneously.', actor: 'VeriLoom Engine' },
  { n: 4, title: 'Explainable Remediation', desc: 'Every flag cites its clause. Accept surgical fixes or override with justification.', actor: 'Creator' },
  { n: 5, title: 'Role-Based Sign-Off', desc: 'Side-by-side diffs, threaded comments, RBAC state machine, formal approval.', actor: 'Manager → Reviewer' },
  { n: 6, title: 'Governance Insights', desc: 'Recurring mistakes, override clusters and ambiguous-guideline detection.', actor: 'Brand Leadership' },
]

export function DashboardView() {
  const { data, setView, selectDraft } = useApp()

  const audits = data ? Object.values(data.audits) : []
  const totalFindings = audits.reduce((s, a) => s + a.findings.length, 0)
  const totalSuppressed = audits.reduce((s, a) => s + a.suppressed, 0)
  const inFlight = data?.drafts.filter((d) => d.status !== 'APPROVED').length ?? 0
  // CTA prefers a draft the visitor can still audit live
  const demoDraft =
    data?.drafts.find((d) => d.title.includes('Press release')) ??
    data?.drafts.find((d) => d.status !== 'APPROVED') ??
    data?.drafts[0]

  return (
    <div className="space-y-6">
      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-2xl bg-zinc-950 p-6 text-white sm:p-10">
        <div className="vl-grid-pattern absolute inset-0" />
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold text-emerald-300">
            <Sparkles className="h-3.5 w-3.5" />
            We Code Coders Hackathon · Round 2 Build · Team opopopxxnot
          </div>
          <h1 className="mt-4 max-w-3xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Ship content that is <span className="text-emerald-400">on-brand</span>,{' '}
            <span className="text-amber-400">factually verified</span> and{' '}
            <span className="text-teal-300">accessible</span> — every single time.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base">
            VeriLoom AI is an intelligent brand-governance co-pilot. It audits every
            publication across six dimensions — tone, terminology, claims, visual
            palette, accessibility and confidentiality — explains each flag by citing
            the exact Vault clause, and preserves the creator&rsquo;s intent with
            surgical fixes.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              size="lg"
              className="bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
              onClick={() => {
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
            >
              <Zap className="mr-2 h-4 w-4" />
              Try it live — 10 seconds
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-white"
              onClick={() => {
                if (demoDraft) selectDraft(demoDraft.id, 'audit')
                else setView('audit')
              }}
            >
              <ScanSearch className="mr-2 h-4 w-4" />
              Run the seeded demo audit
            </Button>
          </div>

          {/* six pillar chips */}
          <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {(Object.keys(PILLAR_META) as Pillar[]).map((p, i) => {
              const Icon = PILLAR_ICON[p]
              return (
                <motion.div
                  key={p}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.06 }}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3"
                >
                  <Icon className="h-4 w-4 text-emerald-400" />
                  <p className="mt-1.5 text-xs font-semibold leading-tight text-zinc-200">
                    {PILLAR_META[p].label}
                  </p>
                  <p className="mt-0.5 text-[10px] text-zinc-500">{PILLAR_META[p].short} pillar</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── The problem, in normal-person language ─────── */}
      <ProblemSection />

      {/* ── Live playground — the interactive entry point ── */}
      <div id="live-playground" className="scroll-mt-6">
        <LivePlayground />
      </div>

      {/* ── KPI row ──────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Vault clauses" value={data?.vault.length ?? 0} sub="Indexed, citable rules" icon={LibraryBig} />
        <KpiCard label="Drafts in flight" value={inFlight} sub="Under governance" icon={FileStack} />
        <KpiCard label="Findings caught" value={totalFindings} sub="Across all audits" icon={Flag} tone="amber" />
        <KpiCard
          label="Ungrounded AI flags suppressed"
          value={totalSuppressed}
          sub="Zero-hallucination guard"
          icon={ShieldCheck}
          tone="emerald"
        />
      </section>

      {/* ── Guided 60-second demo ─────────────────────────── */}
      <DemoChecklist />

      {/* ── Workflow ─────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-zinc-900">The governance workflow</h2>
            <p className="text-sm text-zinc-500">
              Six stages, three roles, one immutable audit trail.
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {STAGES.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="group relative rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 text-xs font-bold text-white">
                  {s.n}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                  {s.actor}
                </span>
              </div>
              <h3 className="mt-2.5 text-sm font-bold leading-snug text-zinc-900">{s.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">{s.desc}</p>
              {i < STAGES.length - 1 && (
                <ChevronRight className="absolute -right-2.5 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-zinc-300 xl:block" />
              )}
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Architecture + activity ───────────────────────── */}
      <section className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-3">
          <h2 className="text-lg font-bold tracking-tight text-zinc-900">
            Neuro-symbolic audit engine
          </h2>
          <p className="-mt-1 text-sm text-zinc-500">
            Deterministic mathematics and semantic reasoning are strictly separated —
            colour distances and contrast ratios are never guessed by an LLM.
          </p>
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
          <h2 className="text-lg font-bold tracking-tight text-zinc-900">Governance activity</h2>
          <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-3 vl-scroll">
            {(data?.events ?? []).slice(0, 14).map((e) => (
              <div key={e.id} className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-zinc-50">
                <span
                  className={cn(
                    'mt-1 h-2 w-2 shrink-0 rounded-full',
                    e.action === 'AI_CALL' && 'bg-teal-400',
                    e.action === 'AUDIT_RUN' && 'bg-emerald-500',
                    e.action === 'OVERRIDE' && 'bg-amber-500',
                    e.action === 'STATUS_CHANGE' && 'bg-zinc-400',
                    e.action === 'CERT_ISSUED' && 'bg-emerald-600',
                    e.action.startsWith('VAULT') && 'bg-zinc-700'
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-zinc-800">
                    {describeEvent(e.action, e.details)}
                  </p>
                  <p className="text-[10.5px] text-zinc-400">
                    {e.actor} · {timeAgo(e.createdAt)}
                  </p>
                </div>
              </div>
            ))}
            {(data?.events.length ?? 0) === 0 && (
              <p className="p-4 text-center text-xs text-zinc-400">
                No activity yet — run your first audit.
              </p>
            )}
          </div>
        </div>
      </section>
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
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50">
          <Icon className="h-4 w-4 text-emerald-600" />
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

export { ClauseBadge, Award }
