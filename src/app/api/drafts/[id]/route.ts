import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { serialiseAudit } from '@/lib/audit/engine'
import type { FindingActionDTO } from '@/lib/types'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const draft = await db.draft.findUnique({
    where: { id },
    include: {
      versions: { orderBy: { version: 'asc' } },
      comments: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!draft) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const audits = await db.auditRun.findMany({
    where: { draftId: id },
    orderBy: { createdAt: 'desc' },
    include: { actions: true },
  })

  return NextResponse.json({
    draft: {
      id: draft.id,
      title: draft.title,
      channel: draft.channel,
      kind: draft.kind,
      status: draft.status,
      creator: draft.creator,
      content: draft.content,
      imageData: draft.imageData,
      imageMeta: draft.imageMeta ? JSON.parse(draft.imageMeta) : null,
      version: draft.version,
      createdAt: draft.createdAt.toISOString(),
      updatedAt: draft.updatedAt.toISOString(),
    },
    versions: draft.versions.map((v) => ({
      id: v.id,
      version: v.version,
      content: v.content,
      note: v.note,
      createdAt: v.createdAt.toISOString(),
    })),
    comments: draft.comments.map((c) => ({
      id: c.id,
      author: c.author,
      role: c.role,
      body: c.body,
      resolved: c.resolved,
      createdAt: c.createdAt.toISOString(),
    })),
    audits: audits.map((a) => ({
      ...serialiseAudit(a, id),
      actions: a.actions.map(
        (x): FindingActionDTO => ({
          id: x.id,
          findingKey: x.findingKey,
          action: x.action as FindingActionDTO['action'],
          actor: x.actor,
          actorRole: x.actorRole,
          note: x.note,
          appliedText: x.appliedText,
          createdAt: x.createdAt.toISOString(),
        })
      ),
    })),
  })
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const draft = await db.draft.findUnique({ where: { id } })
  if (!draft) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (draft.status === 'APPROVED') {
    return NextResponse.json(
      { error: 'Approved drafts are immutable — create a new draft instead' },
      { status: 409 }
    )
  }

  const data: Record<string, unknown> = { updatedAt: new Date() }
  let contentChanged = false

  if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim()
  if (typeof body.channel === 'string' && body.channel) data.channel = body.channel
  if (typeof body.content === 'string' && body.content !== draft.content) {
    data.content = body.content
    contentChanged = true
  }
  if (typeof body.altText === 'string' && draft.imageMeta) {
    const meta = JSON.parse(draft.imageMeta)
    meta.altText = body.altText
    data.imageMeta = JSON.stringify(meta)
    contentChanged = true
  }

  // editing content resets the governance state machine
  if (contentChanged && draft.status !== 'DRAFT') {
    data.status = 'DRAFT'
  }

  const updated = await db.draft.update({ where: { id }, data })

  if (contentChanged) {
    // keep the current version row in sync so diffs stay truthful
    await db.draftVersion.updateMany({
      where: { draftId: id, version: draft.version },
      data: { content: 'content' in data ? String(data.content) : draft.content },
    })
    await db.eventLog.create({
      data: {
        draftId: id,
        actor: body.actor ?? draft.creator,
        action: 'STATUS_CHANGE',
        details: JSON.stringify({
          from: draft.status,
          to: 'DRAFT',
          reason: 'content edited — re-audit required',
        }),
      },
    })
  }

  return NextResponse.json({ ok: true, status: updated.status })
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  await db.draft.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
