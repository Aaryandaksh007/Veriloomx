import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auditHasEngineErrors, type PillarSummary } from '@/lib/types'
import { hasRole } from '@/lib/authorization'

export const dynamic = 'force-dynamic'

/**
 * POST — record a creator decision on a single finding.
 * { auditId, findingKey, action: accepted|overridden|edited,
 *   note?, appliedText?, actor?, actorRole? }
 */
export async function POST(req: NextRequest) {
  const user = await hasRole('creator')
  if (!user) return NextResponse.json({ error: 'Author access required.' }, { status: 403 })
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const auditId = String(body.auditId ?? '')
  const findingKey = String(body.findingKey ?? '')
  const action = String(body.action ?? '')
  if (!auditId || !findingKey || !['accepted', 'overridden', 'edited'].includes(action)) {
    return NextResponse.json(
      { error: 'auditId, findingKey and a valid action are required' },
      { status: 400 }
    )
  }

  const audit = await db.auditRun.findUnique({ where: { id: auditId } })
  if (!audit) return NextResponse.json({ error: 'Audit not found' }, { status: 404 })

  const draft = await db.draft.findUnique({ where: { id: audit.draftId } })
  if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
  if (draft.status === 'APPROVED') {
    return NextResponse.json({ error: 'Approved drafts are sealed.' }, { status: 409 })
  }
  if (audit.version !== draft.version) {
    return NextResponse.json(
      { error: 'Can only resolve findings on the current draft version.' },
      { status: 409 }
    )
  }
  if (auditHasEngineErrors(JSON.parse(audit.pillarSummaries) as PillarSummary[])) {
    return NextResponse.json(
      { error: 'This audit is incomplete because one or more checks failed. Recover or rerun the audit before resolving findings.' },
      { status: 409 }
    )
  }

  const findings = JSON.parse(audit.findings) as { key: string }[]
  if (!findings.some((f) => f.key === findingKey)) {
    return NextResponse.json({ error: 'Finding not part of this audit' }, { status: 400 })
  }

  if (action === 'overridden') {
    const note = String(body.note ?? '').trim()
    if (note.length < 15) {
      return NextResponse.json(
        { error: 'A human override requires a justification of at least 15 characters.' },
        { status: 400 }
      )
    }
  }

  // upsert (replace previous decision on the same finding)
  const existing = await db.findingAction.findFirst({ where: { auditId, findingKey } })
  if (existing) {
    await db.findingAction.delete({ where: { id: existing.id } })
  }

  const saved = await db.findingAction.create({
    data: {
      auditId,
      findingKey,
      action,
      actor: user.name,
      actorRole: user.role,
      note: body.note ? String(body.note) : null,
      appliedText: body.appliedText ? String(body.appliedText) : null,
    },
  })

  if (action === 'overridden') {
    await db.eventLog.create({
      data: {
        draftId: audit.draftId,
        actor: saved.actor,
        action: 'OVERRIDE',
        details: JSON.stringify({
          findingKey,
          auditId,
          justification: saved.note,
          clauseId:
            (JSON.parse(audit.findings) as { key: string; clauseId: string | null }[]).find(
              (f) => f.key === findingKey
            )?.clauseId ?? null,
        }),
      },
    })
  } else {
    await db.eventLog.create({
      data: {
        draftId: audit.draftId,
        actor: saved.actor,
        action: action === 'accepted' ? 'ACCEPT' : 'EDIT',
        details: JSON.stringify({ findingKey, auditId }),
      },
    })
  }

  return NextResponse.json({
    action: {
      id: saved.id,
      findingKey: saved.findingKey,
      action: saved.action,
      actor: saved.actor,
      actorRole: saved.actorRole,
      note: saved.note,
      appliedText: saved.appliedText,
      createdAt: saved.createdAt.toISOString(),
    },
  })
}

/** DELETE {auditId, findingKey} — undo a decision (finding returns to pending). */
export async function DELETE(req: NextRequest) {
  if (!(await hasRole('creator'))) return NextResponse.json({ error: 'Author access required.' }, { status: 403 })
  const body = await req.json().catch(() => null)
  const auditId = String(body?.auditId ?? '')
  const findingKey = String(body?.findingKey ?? '')
  if (!auditId || !findingKey) {
    return NextResponse.json({ error: 'auditId and findingKey are required' }, { status: 400 })
  }
  const existing = await db.findingAction.findFirst({
    where: { auditId, findingKey },
    include: { audit: { select: { draftId: true } } },
  })
  if (!existing) return NextResponse.json({ ok: true })
  const draft = await db.draft.findUnique({
    where: { id: existing.audit.draftId },
    select: { status: true },
  })
  if (draft?.status === 'APPROVED') {
    return NextResponse.json({ error: 'Approved drafts are sealed.' }, { status: 409 })
  }
  await db.findingAction.delete({ where: { id: existing.id } })
  return NextResponse.json({ ok: true })
}
