'use client'

// ─────────────────────────────────────────────────────────────
// VeriLoom AI — Governance Analytics & Blindspot Engine
// ─────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Brain,
  Lightbulb,
  Loader2,
  Cpu,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  FlaskConical,
} from 'lucide-react'
import { useApp } from '@/lib/store'
import { PILLAR_META, type Pillar } from '@/lib/types'
import { KpiCard, ClauseBadge, timeAgo, ViewHeader } from './shared'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface RuleRow {
  clauseId: string
  title: string
  type: string
  violations: number
  overrides: number
  overrideRate: number
  overrideReasons: string[]
  ambiguous: boolean
  active: boolean
}

interface AnalyticsData {
  totals: {
    audits: number
    drafts: number
    approved: number
    inFlight: number
    findings: number
    suppressed: number
    overrides: number
    aiCalls: number
    vaultClauses: number
  }
  byPillar: Record<string, number>
  bySeverity: Record<string, number>
  scoreTrend: { date: string; score: number; draft: string }[]
  rules: RuleRow[]
  aiCalls: { id: string; model?: string; purpose?: string; ts: string }[]
  overrides: {
    id: string
    findingKey?: string
    justification?: string
    actor: string
    ts: string
    clauseId?: string | null
    findingTitle?: string | null
    draftTitle?: string
  }[]
  recentEvents: {
    id: string
    actor: string
    action: string
    details: Record<string, unknown>
    createdAt: string
  }[]
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#a53e2a',
  warning: '#c98a42',
  info: '#8a847a',
}

export function AnalyticsView() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const res = await fetch('/api/analytics', { cache: 'no-store' })
      if (res.ok) setData((await res.json()) as AnalyticsData)
      setLoading(false)
    }
    void load()
  }, [])

  if (loading || !data) {
    return (
      <div className="flex h-[420px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-terra-500" />
      </div>
    )
  }

  const pillarData = (Object.keys(PILLAR_META) as Pillar[]).map((p) => ({
    pillar: PILLAR_META[p].short,
    findings: data.byPillar[p] ?? 0,
  }))
  const severityData = Object.entries(data.bySeverity).map(([k, v]) => ({
    name: k,
    value: v,
  }))
  const trend = data.scoreTrend.map((t, i) => ({
    name: `#${i + 1}`,
    score: t.score,
    draft: t.draft.length > 22 ? t.draft.slice(0, 22) + '…' : t.draft,
  }))
  const topRules = data.rules.slice(0, 7).map((r) => ({
    clauseId: r.clauseId,
    label: r.title.length > 24 ? r.title.slice(0, 24) + '…' : r.title,
    violations: r.violations,
    overrides: r.overrides,
  }))

  return (
    <div className="space-y-5">
      <ViewHeader
        crumb="Analytics"
        title="Governance Analytics"
        subtitle="Recurring mistakes, override clusters and ambiguous guideline detection — auditing the guidelines, not just the creator."
        showDraftChip={false}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
        <KpiCard label="Audits run" value={data.totals.audits} icon={FlaskConical} />
        <KpiCard label="Findings" value={data.totals.findings} icon={ShieldAlert} tone="ochre" />
        <KpiCard label="Human overrides" value={data.totals.overrides} icon={Brain} tone="ochre" />
        <KpiCard label="AI flags suppressed" value={data.totals.suppressed} icon={Sparkles} tone="olive" />
        <KpiCard label="AI calls logged" value={data.totals.aiCalls} icon={Cpu} />
        <KpiCard label="Approved & certified" value={data.totals.approved} icon={TrendingUp} tone="olive" />
      </div>

      {/* charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Findings by pillar" sub="Which governance dimension fails most?">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={pillarData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e3d8" />
              <XAxis dataKey="pillar" tick={{ fontSize: 11, fill: '#8a847a' }} interval={0} angle={-18} dy={8} height={44} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#8a847a' }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="findings" fill="#c96442" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Severity distribution" sub="Risk profile of all findings">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={severityData}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
              >
                {severityData.map((s) => (
                  <Cell key={s.name} fill={SEVERITY_COLORS[s.name] ?? '#a8a29e'} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Compliance score trend" sub="Per audit run (chronological)">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e3d8" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#8a847a' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#8a847a' }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.draft ?? ''}
              />
              <Line type="monotone" dataKey="score" stroke="#6b7a3d" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Most-violated clauses" sub="Violations vs human overrides per rule">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topRules} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e3d8" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#8a847a' }} />
              <YAxis
                type="category"
                dataKey="clauseId"
                width={95}
                tick={{ fontSize: 10.5, fill: '#5a554e', fontFamily: 'monospace' }}
              />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="violations" name="Violations" fill="#c98a42" radius={[0, 4, 4, 0]} />
              <Bar dataKey="overrides" name="Overrides" fill="#a53e2a" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* blindspot engine */}
      <div>
        <h2 className="flex items-center gap-2 text-lg font-serif font-semibold tracking-tight text-ink">
          <Lightbulb className="h-5 w-5 text-ochre-500" />
          Guideline Blindspot & Override Intelligence
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Rules that are repeatedly violated — or repeatedly overridden by humans — are
          probably unclear. Ask the engine to draft a sharper phrasing.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.rules.slice(0, 9).map((r) => (
            <BlindspotCard key={r.clauseId} rule={r} />
          ))}
          {data.rules.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-faint">
              Run audits to populate governance signals.
            </div>
          )}
        </div>
      </div>

      {/* AI ledger + overrides */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-line bg-paper p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-ink">
            <Cpu className="h-4 w-4 text-terra-600" /> Transparent AI ledger
          </h3>
          <p className="mt-0.5 text-xs text-ink-soft">
            Every external model call is logged — model, purpose, timestamp.
          </p>
          <div className="mt-3 max-h-72 space-y-1.5 overflow-y-auto vl-scroll">
            {data.aiCalls.map((c) => (
              <div key={c.id} className="flex items-start justify-between gap-3 rounded-lg border border-stone-200 bg-parchment/60 px-2.5 py-2">
                <div className="min-w-0">
                  <p className="truncate text-[11.5px] font-medium text-stone-700">
                    {c.purpose ?? 'inference'}
                  </p>
                  <p className="text-[10px] text-faint">{timeAgo(c.ts)}</p>
                </div>
                <span className="shrink-0 rounded-md bg-terra-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-terra-700">
                  {c.model ?? 'Unknown model'}
                </span>
              </div>
            ))}
            {data.aiCalls.length === 0 && (
              <p className="p-4 text-center text-xs text-faint">No AI calls yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-line bg-paper p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-ink">
            <Brain className="h-4 w-4 text-ochre-600" /> Human override log
          </h3>
          <p className="mt-0.5 text-xs text-ink-soft">
            Justified human judgments — the audit trail reviewers see at sign-off.
          </p>
          <div className="mt-3 max-h-72 space-y-1.5 overflow-y-auto vl-scroll">
            {data.overrides.map((o) => (
              <div key={o.id} className="rounded-lg border border-ochre-100 bg-ochre-50/50 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[10.5px] font-bold text-ochre-700">
                    {o.findingKey ?? '—'}
                    {o.clauseId ? (
                      <span className="ml-1.5 rounded bg-ink px-1 py-0.5 text-[9px] text-cream">
                        {o.clauseId}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-[10px] text-faint">
                    {o.actor} · {timeAgo(o.ts)}
                  </span>
                </div>
                {o.findingTitle && (
                  <p className="mt-0.5 text-[10.5px] font-semibold text-stone-600">{o.findingTitle}</p>
                )}
                <p className="mt-1 text-[11.5px] leading-relaxed text-stone-700">
                  “{o.justification ?? ''}”
                </p>
              </div>
            ))}
            {data.overrides.length === 0 && (
              <p className="p-4 text-center text-xs text-faint">
                No overrides recorded — automation and creators are in agreement.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ChartCard({
  title,
  sub,
  children,
}: {
  title: string
  sub: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-line bg-paper p-4">
      <h3 className="text-sm font-bold text-ink">{title}</h3>
      <p className="mt-0.5 text-xs text-faint">{sub}</p>
      <div className="mt-3">{children}</div>
    </div>
  )
}

function BlindspotCard({ rule }: { rule: RuleRow }) {
  const [suggestion, setSuggestion] = useState<{ suggestedClause: string; rationale: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [applying, setApplying] = useState(false)
  const { refresh } = useApp()

  const ask = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/blindspot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clauseId: rule.clauseId }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error)
      setSuggestion(body)
    } catch (err) {
      toast({ title: 'Suggestion failed', description: String(err), variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  const apply = async () => {
    if (!suggestion) return
    setApplying(true)
    try {
      const res = await fetch('/api/blindspot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clauseId: rule.clauseId,
          apply: suggestion.suggestedClause,
          rationale: suggestion.rationale,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      await refresh()
      toast({ title: 'Vault clause clarified', description: 'Future audits use the sharper phrasing.' })
      setSuggestion(null)
    } catch (err) {
      toast({ title: 'Apply failed', description: String(err), variant: 'destructive' })
    } finally {
      setApplying(false)
    }
  }

  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        rule.ambiguous ? 'border-ochre-300 bg-ochre-50/40' : 'border-line bg-paper'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <ClauseBadge clauseId={rule.clauseId} />
        {rule.ambiguous && (
          <span className="rounded-full border border-ochre-300 bg-ochre-100 px-2 py-0.5 text-[10px] font-bold text-ochre-800">
            BLINDSPOT
          </span>
        )}
      </div>
      <p className="mt-2 text-[13px] font-semibold leading-snug text-ink">{rule.title}</p>
      <div className="mt-2 flex items-center gap-3 text-[11px] font-semibold">
        <span className="text-ochre-700">{rule.violations} violations</span>
        <span className="text-clay-600">
          {rule.overrides} overrides ({Math.round(rule.overrideRate * 100)}%)
        </span>
      </div>

      {!suggestion ? (
        <Button
          size="sm"
          variant="outline"
          className="mt-3 h-7 w-full border-ochre-300 text-[11px] text-ochre-800 hover:bg-ochre-50"
          disabled={busy}
          onClick={ask}
        >
          {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Lightbulb className="mr-1 h-3 w-3" />}
          Suggest clearer phrasing
        </Button>
      ) : (
        <div className="mt-3 space-y-2 rounded-lg border border-ochre-200 bg-paper p-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ochre-700">
            Suggested rewrite · AI co-pilot
          </p>
          <p className="text-[11.5px] leading-relaxed text-stone-700">
            “{suggestion.suggestedClause}”
          </p>
          <p className="text-[10.5px] italic text-ink-soft">{suggestion.rationale}</p>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              className="h-7 flex-1 bg-ochre-600 px-2 text-[11px] hover:bg-ochre-500"
              disabled={applying}
              onClick={apply}
            >
              {applying ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              Apply to Vault
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => setSuggestion(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
