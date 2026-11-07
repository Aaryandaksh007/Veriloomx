import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { db } from '@/lib/db'
import { serialiseAudit } from '@/lib/audit/engine'
import { auditHasEngineErrors, type CertificateData, type Finding, type FindingActionDTO, type PillarSummary } from '@/lib/types'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ draftId: string }> }

/**
 * GET — tamper-evident Brand Governance Approval Certificate.
 * The SHA-256 integrity hash covers the full audit record.
 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { draftId } = await ctx.params

  const draft = await db.draft.findUnique({
    where: { id: draftId },
    include: { versions: true },
  })
  if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
  if (draft.status !== 'APPROVED') {
    return NextResponse.json(
      { error: 'Certificates are only issued for APPROVED drafts.' },
      { status: 409 }
    )
  }

  // latest audit = the one the approval decision was based on
  const audit = await db.auditRun.findFirst({
    where: { draftId },
    orderBy: { createdAt: 'desc' },
    include: { actions: true },
  })
  if (!audit) return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
  if (auditHasEngineErrors(JSON.parse(audit.pillarSummaries) as PillarSummary[])) {
    return NextResponse.json(
      { error: 'This certificate cannot be issued because one or more audit checks failed.' },
      { status: 409 }
    )
  }

  const findings = JSON.parse(audit.findings) as Finding[]
  const auditResult = serialiseAudit(audit, draftId)

  const overrides: (FindingActionDTO & { finding: Finding | null })[] = audit.actions
    .filter((a) => a.action === 'overridden')
    .map((a) => ({
      id: a.id,
      findingKey: a.findingKey,
      action: 'overridden',
      actor: a.actor,
      actorRole: a.actorRole,
      note: a.note,
      appliedText: a.appliedText,
      createdAt: a.createdAt.toISOString(),
      finding: findings.find((f) => f.key === a.findingKey) ?? null,
    }))

  const approvedEvent = await db.eventLog.findFirst({
    where: { draftId, action: 'CERT_ISSUED' },
    orderBy: { createdAt: 'desc' },
  })

  // ── tamper-evident integrity hash ─────────────────────────
  const canonical = JSON.stringify({
    draft: { id: draft.id, title: draft.title, version: draft.version, channel: draft.channel },
    audit: {
      id: audit.id,
      score: audit.score,
      findings: findings.map((f) => ({
        key: f.key,
        pillar: f.pillar,
        severity: f.severity,
        clauseId: f.clauseId,
      })),
      suppressed: audit.suppressed,
    },
    overrides: overrides.map((o) => ({ key: o.findingKey, note: o.note, actor: o.actor })),
    models: auditResult.aiLedger.map((l) => l.model),
  })
  const hash = createHash('sha256').update(canonical).digest('hex')

  const certificateId = `VLC-${new Date().getFullYear()}-${hash
    .slice(0, 8)
    .toUpperCase()}`

  const data: CertificateData = {
    draft: {
      id: draft.id,
      title: draft.title,
      channel: draft.channel,
      kind: draft.kind as 'text' | 'image',
      status: 'APPROVED',
      creator: draft.creator,
      content: draft.content,
      imageData: draft.imageData,
      imageMeta: draft.imageMeta ? JSON.parse(draft.imageMeta) : null,
      version: draft.version,
      createdAt: draft.createdAt.toISOString(),
      updatedAt: draft.updatedAt.toISOString(),
    },
    audit: auditResult,
    overrides,
    hash,
    issuedAt: (approvedEvent?.createdAt ?? audit.createdAt).toISOString(),
    certificateId,
  }

  return NextResponse.json(data)
}
