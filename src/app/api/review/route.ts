import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auditHasEngineErrors, type Finding, type PillarSummary } from '@/lib/types'

export const dynamic = 'force-dynamic'

type ReviewAction = 'submit' | 'request-changes' | 'approve'

const ACTION_ROLES: Record<ReviewAction, string[]> = {
  submit: ['creator'],
  'request-changes': ['manager'],
  approve: ['reviewer'],
}

/**
 * POST {draftId, action: submit|request-changes|approve, role, note?}
 * Role-based state machine:
 *   REMEDIATED --submit(creator)--> IN_REVIEW
 *   IN_REVIEW  --request-changes(manager)--> CHANGES_REQUESTED
 *   IN_REVIEW  --approve(reviewer)--> APPROVED
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const draftId = String(body?.draftId ?? '')
  const action = String(body?.action ?? '') as ReviewAction
  const role = String(body?.role ?? '')
  if (!draftId || !['submit', 'request-changes', 'approve'].includes(action)) {
    return NextResponse.json({ error: 'draftId and a valid action are required' }, { status: 400 })
  }
  if (!ACTION_ROLES[action].includes(role)) {
    return NextResponse.json(
      {
        error: `Demo workflow: "${action}" is reserved for ${ACTION_ROLES[action].join(', ')}. You are acting as ${role}.`,
      },
      { status: 403 }
    )
  }

  const draft = await db.draft.findUnique({ where: { id: draftId } })
  if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 })

  const actor =
    role === 'creator' ? 'Maya Chen' : role === 'manager' ? 'Dev Kapoor' : 'Aaryan Sharma'

  if (action === 'submit') {
    if (draft.status !== 'REMEDIATED') {
      return NextResponse.json(
        { error: `Only REMEDIATED drafts can be submitted — this one is ${draft.status}.` },
        { status: 409 }
      )
    }
    await db.draft.update({ where: { id: draftId }, data: { status: 'IN_REVIEW' } })
    await logStatus(draftId, draft.status, 'IN_REVIEW', actor, 'Creator submitted for review')
    return NextResponse.json({ ok: true, status: 'IN_REVIEW' })
  }

  if (action === 'request-changes') {
    if (draft.status !== 'IN_REVIEW') {
      return NextResponse.json(
        { error: `Changes can only be requested on drafts IN_REVIEW — this one is ${draft.status}.` },
        { status: 409 }
      )
    }
    const note = String(body?.note ?? '').trim()
    if (note.length < 10) {
      return NextResponse.json(
        { error: 'Requesting changes requires a note for the creator (min 10 characters).' },
        { status: 400 }
      )
    }
    await db.draft.update({ where: { id: draftId }, data: { status: 'CHANGES_REQUESTED' } })
    await db.comment.create({
      data: { draftId, author: actor, role: 'manager', body: `🔁 Changes requested: ${note}` },
    })
    await logStatus(draftId, draft.status, 'CHANGES_REQUESTED', actor, note)
    return NextResponse.json({ ok: true, status: 'CHANGES_REQUESTED' })
  }

  // approve
  if (draft.status !== 'IN_REVIEW') {
    return NextResponse.json(
      { error: `Only drafts IN_REVIEW can be approved — this one is ${draft.status}.` },
      { status: 409 }
    )
  }

  // the latest audit is the one the remediation was derived from;
  // the state machine guarantees no content edits since (edits reset to DRAFT)
  const audit = await db.auditRun.findFirst({
    where: { draftId },
    orderBy: { createdAt: 'desc' },
    include: { actions: true },
  })
  if (!audit) {
    return NextResponse.json(
      { error: 'No audit exists for the current version — run the 6-pillar audit first.' },
      { status: 409 }
    )
  }

  if (audit.version !== draft.version) {
    return NextResponse.json(
      { error: 'The latest audit does not match the current draft version. Rerun the audit before approval.' },
      { status: 409 }
    )
  }
  if (auditHasEngineErrors(JSON.parse(audit.pillarSummaries) as PillarSummary[])) {
    return NextResponse.json(
      { error: 'Approval is blocked because one or more audit checks failed. Rerun the audit before sign-off.' },
      { status: 409 }
    )
  }

  const findings = JSON.parse(audit.findings) as Finding[]
  const resolved = new Set(audit.actions.map((a) => a.findingKey))
  const unresolved = findings.filter((f) => !resolved.has(f.key))
  if (unresolved.length > 0) {
    return NextResponse.json(
      {
        error: `${unresolved.length} finding(s) still unresolved (${unresolved
          .slice(0, 3)
          .map((f) => f.key)
          .join(', ')}…). Every flag must be accepted or overridden before sign-off.`,
      },
      { status: 409 }
    )
  }

  await db.draft.update({ where: { id: draftId }, data: { status: 'APPROVED' } })
  await logStatus(draftId, draft.status, 'APPROVED', actor, 'Final sign-off — certificate issued')
  await db.eventLog.create({
    data: {
      draftId,
      actor,
      action: 'CERT_ISSUED',
      details: JSON.stringify({ auditId: audit.id, version: draft.version }),
    },
  })
  return NextResponse.json({ ok: true, status: 'APPROVED' })
}

async function logStatus(
  draftId: string,
  from: string,
  to: string,
  actor: string,
  reason?: string
) {
  await db.eventLog.create({
    data: {
      draftId,
      actor,
      action: 'STATUS_CHANGE',
      details: JSON.stringify({ from, to, reason }),
    },
  })
}
