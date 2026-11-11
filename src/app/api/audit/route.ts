import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { runAudit, serialiseAudit } from '@/lib/audit/engine'
import { hasRole, currentUser } from '@/lib/authorization'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/** POST {draftId} — run the parallel 6-pillar audit. */
export async function POST(req: NextRequest) {
  const user = await hasRole('creator')
  if (!user) return NextResponse.json({ error: 'Author access required.' }, { status: 403 })
  const body = await req.json().catch(() => null)
  const draftId = String(body?.draftId ?? '')
  if (!draftId) return NextResponse.json({ error: 'draftId is required' }, { status: 400 })
  const version = body?.version === undefined ? undefined : Number(body.version)
  if (version !== undefined && (!Number.isInteger(version) || version < 1)) {
    return NextResponse.json({ error: 'version must be a positive integer' }, { status: 400 })
  }
  const retryAuditId =
    typeof body?.retryAuditId === 'string' && body.retryAuditId.trim()
      ? body.retryAuditId.trim()
      : undefined
  const rawSim = body?.simulateFailure
  const simulateFailure =
    rawSim === undefined || rawSim === null
      ? undefined
      : typeof rawSim === 'string' && ['tone', 'claims', 'vision'].includes(rawSim)
        ? (rawSim as 'tone' | 'claims' | 'vision')
        : null
  if (simulateFailure === null) {
    return NextResponse.json({ error: 'simulateFailure must be tone, claims, or vision' }, { status: 400 })
  }

  const draft = await db.draft.findUnique({ where: { id: draftId } })
  if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
  if (version !== undefined && version > draft.version) {
    return NextResponse.json({ error: 'version cannot exceed the current draft version' }, { status: 400 })
  }
  const targetVersion = version ?? draft.version
  if (version !== undefined && version < draft.version) {
    const savedVersion = await db.draftVersion.findUnique({
      where: { draftId_version: { draftId, version } },
      select: { id: true, content: true, imageData: true },
    })
    if (!savedVersion) return NextResponse.json({ error: 'Draft version not found' }, { status: 404 })
    if (draft.kind === 'text' && !savedVersion.content.trim()) {
      return NextResponse.json({ error: 'The saved text version is empty and cannot be audited.' }, { status: 409 })
    }
    if (draft.kind === 'image' && !savedVersion.imageData) {
      return NextResponse.json({ error: 'The saved image version has no asset and cannot be audited.' }, { status: 409 })
    }
  } else {
    if (draft.kind === 'text' && !draft.content.trim()) {
      return NextResponse.json({ error: 'The text draft is empty and cannot be audited.' }, { status: 409 })
    }
    if (draft.kind === 'image' && !draft.imageData) {
      return NextResponse.json({ error: 'The image asset is missing and cannot be audited.' }, { status: 409 })
    }
  }
  if (draft.status === 'APPROVED' && targetVersion === draft.version) {
    return NextResponse.json(
      { error: 'This draft is approved and sealed — audit a new draft instead.' },
      { status: 409 }
    )
  }
  if (draft.status === 'IN_REVIEW' && targetVersion === draft.version) {
    return NextResponse.json(
      { error: 'This draft is currently In Review — wait for reviewer feedback or audit a historical version.' },
      { status: 409 }
    )
  }
  if (simulateFailure === 'vision' && draft.kind !== 'image') {
    return NextResponse.json(
      { error: 'Vision check simulation only applies to image drafts.' },
      { status: 400 }
    )
  }
  if ((simulateFailure === 'tone' || simulateFailure === 'claims') && draft.kind !== 'text') {
    return NextResponse.json(
      { error: `${simulateFailure} check simulation only applies to text drafts.` },
      { status: 400 }
    )
  }
  if (retryAuditId) {
    const prior = await db.auditRun.findUnique({
      where: { id: retryAuditId },
      select: { draftId: true, version: true },
    })
    if (!prior || prior.draftId !== draftId || prior.version !== targetVersion) {
      return NextResponse.json(
        { error: 'The incomplete audit could not be matched to this draft version.' },
        { status: 404 }
      )
    }
  }

  try {
    const result = await runAudit(draftId, user.name, { version, retryAuditId, simulateFailure })
    return NextResponse.json({ audit: result })
  } catch (err) {
    console.error('[audit] engine failure:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Audit engine failure' },
      { status: 500 }
    )
  }
}

/** GET ?draftId= — latest audit for a draft. */
export async function GET(req: NextRequest) {
  if (!(await currentUser())) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
  const draftId = req.nextUrl.searchParams.get('draftId')
  if (!draftId) return NextResponse.json({ error: 'draftId is required' }, { status: 400 })

  if (req.nextUrl.searchParams.get('history') === '1') {
    const runs = await db.auditRun.findMany({ where: { draftId }, orderBy: { createdAt: 'desc' } })
    return NextResponse.json({
      audits: runs.map((run) => serialiseAudit(run, draftId)),
    })
  }
  const run = await db.auditRun.findFirst({ where: { draftId }, orderBy: { createdAt: 'desc' } })
  if (!run) return NextResponse.json({ audit: null })
  return NextResponse.json({ audit: serialiseAudit(run, draftId) })
}
