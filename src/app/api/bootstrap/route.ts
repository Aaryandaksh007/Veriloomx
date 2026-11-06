import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeeded } from '@/lib/seed'
import { serialiseAudit } from '@/lib/audit/engine'
import type { DraftDTO, VaultItemDTO } from '@/lib/types'

export const dynamic = 'force-dynamic'

/** Bootstrap: idempotent seed + full workspace snapshot. */
export async function GET() {
  await ensureSeeded()

  const [vault, drafts, auditRuns, events] = await Promise.all([
    db.vaultItem.findMany({ orderBy: { clauseId: 'asc' } }),
    db.draft.findMany({ orderBy: { updatedAt: 'desc' } }),
    db.auditRun.findMany({ orderBy: { createdAt: 'desc' } }),
    db.eventLog.findMany({ orderBy: { createdAt: 'desc' }, take: 40 }),
  ])

  const latestAuditByDraft = new Map<string, ReturnType<typeof serialiseAudit>>()
  for (const run of auditRuns) {
    if (!latestAuditByDraft.has(run.draftId)) {
      latestAuditByDraft.set(run.draftId, serialiseAudit(run, run.draftId))
    }
  }

  const vaultDTO: VaultItemDTO[] = vault.map((v) => ({
    id: v.id,
    clauseId: v.clauseId,
    type: v.type as VaultItemDTO['type'],
    title: v.title,
    content: v.content,
    extra: v.extra ? JSON.parse(v.extra) : null,
    active: v.active,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
  }))

  const draftDTO: DraftDTO[] = drafts.map((d) => ({
    id: d.id,
    title: d.title,
    channel: d.channel,
    kind: d.kind as 'text' | 'image',
    status: d.status as DraftDTO['status'],
    creator: d.creator,
    content: d.content,
    imageData: d.imageData,
    imageMeta: d.imageMeta ? JSON.parse(d.imageMeta) : null,
    version: d.version,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  }))

  return NextResponse.json({
    vault: vaultDTO,
    drafts: draftDTO,
    audits: Object.fromEntries(latestAuditByDraft),
    events: events.map((e) => ({
      id: e.id,
      actor: e.actor,
      action: e.action,
      details: e.details ? JSON.parse(e.details) : {},
      createdAt: e.createdAt.toISOString(),
    })),
  })
}
