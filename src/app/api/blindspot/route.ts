import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { suggestClauseRewrite } from '@/lib/audit/rag'
import type { Finding } from '@/lib/types'
import { currentUser, hasRole } from '@/lib/authorization'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST {clauseId, apply?} — Guideline Blind-spot Engine.
 * Without apply: returns an LLM-suggested clearer phrasing.
 * With apply: writes the provided phrasing into the Vault clause.
 */
export async function POST(req: NextRequest) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const clauseId = String(body?.clauseId ?? '')
  if (!clauseId) return NextResponse.json({ error: 'clauseId is required' }, { status: 400 })

  const clause = await db.vaultItem.findUnique({ where: { clauseId } })
  if (!clause) return NextResponse.json({ error: 'Clause not found' }, { status: 404 })

  if (body?.apply) {
    const admin = await hasRole('admin')
    if (!admin) return NextResponse.json({ error: 'Administrator access required to change Vault rules.' }, { status: 403 })
    const newContent = String(body.apply).trim()
    if (newContent.length < 20) {
      return NextResponse.json({ error: 'Suggested clause too short' }, { status: 400 })
    }
    const updated = await db.$transaction(async (tx) => {
      const current = await tx.vaultItem.findUniqueOrThrow({ where: { clauseId } })
      const item = await tx.vaultItem.update({
        where: { clauseId },
        data: { content: newContent, ruleVer: current.ruleVer + 1 },
      })
      await tx.vaultItemVersion.create({
        data: {
          vaultItemId: item.id,
          version: item.ruleVer,
          title: item.title,
          content: item.content,
          extra: item.extra,
          active: item.active,
          editedBy: admin.name,
          editNote: 'AI-assisted clarification',
        },
      })
      return item
    })
    await db.eventLog.create({
      data: {
        actor: admin.name,
        action: 'VAULT_EDIT',
        details: JSON.stringify({
          verb: 'clarified',
          clauseId,
          aiAssisted: true,
          rationale: body.rationale ?? null,
        }),
      },
    })
    return NextResponse.json({ ok: true, content: updated.content, ruleVer: updated.ruleVer })
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
      actor: user.name,
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
