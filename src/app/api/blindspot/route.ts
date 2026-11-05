import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { suggestClauseRewrite } from '@/lib/audit/rag'
import type { Finding } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST {clauseId, apply?} — Guideline Blind-spot Engine.
 * Without apply: returns an LLM-suggested clearer phrasing.
 * With apply: writes the provided phrasing into the Vault clause.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const clauseId = String(body?.clauseId ?? '')
  if (!clauseId) return NextResponse.json({ error: 'clauseId is required' }, { status: 400 })

  const clause = await db.vaultItem.findUnique({ where: { clauseId } })
  if (!clause) return NextResponse.json({ error: 'Clause not found' }, { status: 404 })

  if (body?.apply) {
    const newContent = String(body.apply).trim()
    if (newContent.length < 20) {
      return NextResponse.json({ error: 'Suggested clause too short' }, { status: 400 })
    }
    await db.vaultItem.update({ where: { clauseId }, data: { content: newContent } })
    await db.eventLog.create({
      data: {
        actor: 'Dev Kapoor',
        action: 'VAULT_EDIT',
        details: JSON.stringify({
          verb: 'clarified',
          clauseId,
          aiAssisted: true,
          rationale: body.rationale ?? null,
        }),
      },
    })
    return NextResponse.json({ ok: true, content: newContent })
  }

  // aggregate stats for this clause
  const audits = await db.auditRun.findMany({ include: { actions: true } })
  let violations = 0
  let overrides = 0
  const overrideReasons: string[] = []
  for (const run of audits) {
    const findings = JSON.parse(run.findings) as Finding[]
    for (const f of findings) {
      if (f.clauseId !== clauseId) continue
      violations++
      const ov = run.actions.find(
        (a) => a.findingKey === f.key && a.action === 'overridden'
      )
      if (ov) {
        overrides++
        if (ov.note) overrideReasons.push(ov.note)
      }
    }
  }

  const res = await suggestClauseRewrite(
    { clauseId: clause.clauseId, title: clause.title, content: clause.content },
    { violations, overrides, overrideReasons }
  )

  await db.eventLog.create({
    data: {
      actor: 'Dev Kapoor',
      action: 'AI_CALL',
      details: JSON.stringify({ ...res.ledger, purpose: `Blind-spot phrasing suggestion (${clauseId})` }),
    },
  })

  if (!res.suggestedClause) {
    return NextResponse.json(
      { error: 'Suggestion engine unavailable — try again.' },
      { status: 502 }
    )
  }

  return NextResponse.json({
    suggestedClause: res.suggestedClause,
    rationale: res.rationale,
    stats: { violations, overrides, overrideReasons },
    model: res.ledger.model,
  })
}
