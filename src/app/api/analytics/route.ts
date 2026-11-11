import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { Finding } from '@/lib/types'
import { currentUser } from '@/lib/authorization'

export const dynamic = 'force-dynamic'

/**
 * Governance analytics: pillar/severity distributions, per-rule
 * violation & override stats, blind-spot candidates, AI ledger.
 */
export async function GET() {
  if (!(await currentUser())) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
  }

  const audits = await db.auditRun.findMany({
    orderBy: { createdAt: 'asc' },
    include: { actions: true },
  })
  const drafts = await db.draft.findMany({ orderBy: { updatedAt: 'desc' } })
  const events = await db.eventLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200 })
  const vault = await db.vaultItem.findMany()

  const byPillar: Record<string, number> = {}
  const bySeverity: Record<string, number> = {}
  const ruleStats = new Map<
    string,
    { clauseId: string; violations: number; overrides: number; overrideReasons: string[]; findings: Finding[] }
  >()

  let totalFindings = 0
  let totalSuppressed = 0
  const scoreTrend: { date: string; score: number; draft: string }[] = []

  for (const run of audits) {
    totalSuppressed += run.suppressed
    scoreTrend.push({
      date: run.createdAt.toISOString(),
      score: run.score,
      draft: drafts.find((d) => d.id === run.draftId)?.title ?? run.draftId,
    })
    const findings = JSON.parse(run.findings) as Finding[]
    totalFindings += findings.length
    for (const f of findings) {
      byPillar[f.pillar] = (byPillar[f.pillar] ?? 0) + 1
      bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1

      if (f.clauseId) {
        const cur = ruleStats.get(f.clauseId) ?? {
          clauseId: f.clauseId,
          violations: 0,
          overrides: 0,
          overrideReasons: [],
          findings: [],
        }
        cur.violations++
        cur.findings.push(f)
        ruleStats.set(f.clauseId, cur)
      }

      const override = run.actions.find(
        (a) => a.findingKey === f.key && a.action === 'overridden'
      )
      if (override && f.clauseId) {
        const cur = ruleStats.get(f.clauseId)!
        cur.overrides++
        if (override.note) cur.overrideReasons.push(override.note)
      }
    }
  }

  const clauseById = new Map(vault.map((v) => [v.clauseId, v]))

  const ruleRows = [...ruleStats.values()]
    .map((r) => {
      const clause = clauseById.get(r.clauseId)
      const overrideRate = r.violations ? r.overrides / r.violations : 0
      return {
        clauseId: r.clauseId,
        title: clause?.title ?? r.clauseId,
        type: clause?.type ?? '—',
        violations: r.violations,
        overrides: r.overrides,
        overrideRate,
        overrideReasons: r.overrideReasons.slice(0, 6),
        ambiguous:
          (r.violations >= 3 && overrideRate >= 0.5) || r.overrides >= 2 || r.violations >= 5,
        active: clause?.active ?? false,
      }
    })
    .sort((a, b) => b.violations - a.violations)

  const aiCalls = events
    .filter((e) => e.action === 'AI_CALL')
    .map((e) => ({
      id: e.id,
      ...(e.details ? JSON.parse(e.details) : {}),
      ts: e.createdAt.toISOString(),
    }))
    .slice(0, 50)

  // override log derived from actual finding actions (source of truth),
  // enriched with draft context
  const draftById = new Map(drafts.map((d) => [d.id, d]))
  const overrideEvents = audits.flatMap((run) =>
    run.actions
      .filter((a) => a.action === 'overridden')
      .map((a) => {
        const finding = (JSON.parse(run.findings) as Finding[]).find(
          (f) => f.key === a.findingKey
        )
        return {
          id: a.id,
          findingKey: a.findingKey,
          justification: a.note,
          actor: a.actor,
          ts: a.createdAt.toISOString(),
          clauseId: finding?.clauseId ?? null,
          findingTitle: finding?.title ?? null,
          draftTitle: draftById.get(run.draftId)?.title ?? '',
        }
      })
  )
  const totalOverrides = overrideEvents.length

  return NextResponse.json({
    totals: {
      audits: audits.length,
      drafts: drafts.length,
      approved: drafts.filter((d) => d.status === 'APPROVED').length,
      inFlight: drafts.filter((d) => !['APPROVED'].includes(d.status)).length,
      findings: totalFindings,
      suppressed: totalSuppressed,
      overrides: totalOverrides,
      aiCalls: aiCalls.length,
      vaultClauses: vault.length,
    },
    byPillar,
    bySeverity,
    scoreTrend,
    rules: ruleRows,
    aiCalls,
    overrides: overrideEvents,
    recentEvents: events.slice(0, 30).map((e) => ({
      id: e.id,
      actor: e.actor,
      action: e.action,
      details: e.details ? JSON.parse(e.details) : {},
      createdAt: e.createdAt.toISOString(),
    })),
  })
}
