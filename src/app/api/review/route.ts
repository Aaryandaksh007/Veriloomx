import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auditHasEngineErrors, type Finding, type PillarSummary } from '@/lib/types'
import { currentUser } from '@/lib/authorization'
import { selectGoverningAudit } from '@/lib/governance'

export const dynamic = 'force-dynamic'

type ReviewAction = 'submit' | 'request-changes' | 'approve'

const ACTION_ROLES: Record<ReviewAction, string> = {
  submit: 'creator',
  'request-changes': 'manager',
  approve: 'reviewer',
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
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
  const role = user.role
  if (!draftId || !['submit', 'request-changes', 'approve'].includes(action)) {
    return NextResponse.json({ error: 'draftId and a valid action are required' }, { status: 400 })
  }
  if (ACTION_ROLES[action] !== role) {
    return NextResponse.json(
      {
        error: `"${action}" requires the ${ACTION_ROLES[action]} role. Your account is ${role}.`,
      },
      { status: 403 }
    )
  }

  const draft = await db.draft.findUnique({
    where: { id: draftId },
    include: { versions: { orderBy: { version: 'desc' }, select: { version: true, note: true, createdAt: true } } },
  })
  if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 })

  const actor = user.name

  if (action === 'submit') {
    if (draft.status !== 'REMEDIATED') {
      return NextResponse.json(
        { error: `Only REMEDIATED drafts can be submitted — this one is ${draft.status}.` },
        { status: 409 }
      )
    }
    const audits = await db.auditRun.findMany({
      where: { draftId },
      orderBy: { createdAt: 'desc' },
      include: { actions: true },
    })
    const governing = selectGoverningAudit(draft, audits, draft.versions)
    if (!governing) {
      return NextResponse.json(
        { error: 'No qualifying audit exists for the current version — run the 6-pillar audit first.' },
        { status: 409 }
      )
    }
    if (auditHasEngineErrors(JSON.parse(governing.pillarSummaries) as PillarSummary[])) {
      return NextResponse.json(
        { error: 'Submission is blocked because the current audit has incomplete checks. Recover the failed checks first.' },
        { status: 409 }
      )
    }
    await db.draft.update({ where: { id: draftId }, data: { status: 'IN_REVIEW' } })
    await logStatus(draftId, draft.status, 'IN_REVIEW', actor, 'Author submitted for review')
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
        { error: 'Requesting changes requires a note for the author (min 10 characters).' },
        { status: 400 }
      )
    }
    await db.draft.update({ where: { id: draftId }, data: { status: 'CHANGES_REQUESTED' } })
    await db.comment.create({
      data: { draftId, author: actor, role, body: `Changes requested: ${note}` },
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

  // Match the governing audit for this draft (either direct on current version or
  // pre-remediation v(V-1) audit that produced remediated vV; ignores historical v1 re-audits)
  const audits = await db.auditRun.findMany({
    where: { draftId },
    orderBy: { createdAt: 'desc' },
    include: { actions: true },
  })
  const audit = selectGoverningAudit(draft, audits, draft.versions)
  if (!audit) {
    return NextResponse.json(
      { error: 'No qualifying audit exists for the current version — run the 6-pillar audit first.' },
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
