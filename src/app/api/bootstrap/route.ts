import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeeded } from '@/lib/seed'
import { serialiseAudit } from '@/lib/audit/engine'
import type { DraftDTO, Role, VaultItemDTO } from '@/lib/types'
import { currentUser } from '@/lib/authorization'
import { selectWorkspaceAudit } from '@/lib/governance'

export const dynamic = 'force-dynamic'

/** Bootstrap: idempotent seed + full workspace snapshot. */
export async function GET() {
  const user = await currentUser()
  if (!user) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
  }

  await ensureSeeded()

  const [vault, drafts, auditRuns, events, certEvents, activeUsers] = await Promise.all([
    db.vaultItem.findMany({ orderBy: { clauseId: 'asc' } }),
    db.draft.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          select: { version: true, note: true, createdAt: true },
        },
      },
    }),
    db.auditRun.findMany({ orderBy: { createdAt: 'desc' } }),
    db.eventLog.findMany({ orderBy: { createdAt: 'desc' }, take: 40 }),
    db.eventLog.findMany({
      where: { action: 'CERT_ISSUED' },
      orderBy: { createdAt: 'desc' },
      select: { draftId: true, details: true },
    }),
    user.role === 'admin'
      ? db.user.findMany({ where: { active: true }, select: { role: true } })
      : Promise.resolve(null),
  ])

  const certifiedByDraft = new Map<string, string>()
  for (const ev of certEvents) {
    if (!ev.draftId || certifiedByDraft.has(ev.draftId) || !ev.details) continue
    try {
      const parsed = JSON.parse(ev.details) as { auditId?: unknown }
      if (typeof parsed.auditId === 'string') certifiedByDraft.set(ev.draftId, parsed.auditId)
    } catch {
      // ignore malformed event details
    }
  }

  const runsByDraft = new Map<string, typeof auditRuns>()
  for (const run of auditRuns) {
    const list = runsByDraft.get(run.draftId)
    if (list) list.push(run)
    else runsByDraft.set(run.draftId, [run])
  }

  const latestAuditByDraft = new Map<string, ReturnType<typeof serialiseAudit>>()
  for (const draft of drafts) {
    const selected = selectWorkspaceAudit(
      draft,
      runsByDraft.get(draft.id) ?? [],
      draft.versions,
      certifiedByDraft.get(draft.id)
    )
    if (selected) {
      latestAuditByDraft.set(draft.id, serialiseAudit(selected, draft.id))
    }
  }

  let teamSummary: { totalUsers: number; roleCounts: Record<Role, number> } | undefined
  if (activeUsers) {
    const roleCounts: Record<Role, number> = { creator: 0, manager: 0, reviewer: 0, admin: 0 }
    for (const u of activeUsers) {
      if (u.role in roleCounts) roleCounts[u.role as Role]++
    }
    teamSummary = { totalUsers: activeUsers.length, roleCounts }
  }

  const vaultDTO: VaultItemDTO[] = vault.map((v) => ({
    id: v.id,
    clauseId: v.clauseId,
    type: v.type as VaultItemDTO['type'],
    title: v.title,
    content: v.content,
    extra: v.extra ? JSON.parse(v.extra) : null,
    active: v.active,
    ruleVer: v.ruleVer,
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
    me: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    vault: vaultDTO,
    drafts: draftDTO,
    audits: Object.fromEntries(latestAuditByDraft),
    teamSummary,
    events: events.map((e) => ({
      id: e.id,
      actor: e.actor,
      action: e.action,
      details: e.details ? JSON.parse(e.details) : {},
      createdAt: e.createdAt.toISOString(),
    })),
  })
}
