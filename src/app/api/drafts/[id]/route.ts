import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { serialiseAudit } from '@/lib/audit/engine'
import type { FindingActionDTO } from '@/lib/types'
import { hasRole, currentUser } from '@/lib/authorization'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  if (!(await currentUser())) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
  const { id } = await ctx.params
  const draft = await db.draft.findUnique({
    where: { id },
    include: {
      versions: { orderBy: { version: 'asc' } },
      comments: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!draft) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (_req.nextUrl.searchParams.get('versions') === '1') {
    return NextResponse.json({
      versions: draft.versions.map((v) => ({
        id: v.id,
        version: v.version,
        content: v.content,
        imageData: v.imageData,
        imageMeta: v.imageMeta ? JSON.parse(v.imageMeta) : null,
        note: v.note,
        createdAt: v.createdAt.toISOString(),
      })),
    })
  }

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
      imageData: v.imageData,
      imageMeta: v.imageMeta ? JSON.parse(v.imageMeta) : null,
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
  const user = await hasRole('creator')
  if (!user) return NextResponse.json({ error: 'Author access required.' }, { status: 403 })
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
    if (draft.kind === 'text' && !body.content.trim()) {
      return NextResponse.json({ error: 'Text drafts cannot be empty.' }, { status: 400 })
    }
    data.content = body.content
    contentChanged = true
  }
  if (typeof body.altText === 'string' && draft.imageMeta) {
    const meta = JSON.parse(draft.imageMeta)
    if (body.altText !== meta.altText) {
      meta.altText = body.altText
      data.imageMeta = JSON.stringify(meta)
      contentChanged = true
    }
  }

  // editing content after an audit preserves prior version history and creates a new version to re-audit
  let createdNewVersion = false
  if (contentChanged && draft.status !== 'DRAFT') {
    data.status = 'DRAFT'
    data.version = draft.version + 1
    createdNewVersion = true
  }

  const updated = await db.draft.update({ where: { id }, data })

  if (contentChanged) {
    const nextContent = 'content' in data ? String(data.content) : draft.content
    const nextImageMeta = 'imageMeta' in data ? String(data.imageMeta) : draft.imageMeta
    if (createdNewVersion) {
      await db.draftVersion.create({
        data: {
          draftId: id,
          version: updated.version,
          content: nextContent,
          imageData: draft.imageData,
          imageMeta: nextImageMeta,
          note: 'Edited in Audit Studio',
        },
      })
    } else {
      await db.draftVersion.updateMany({
        where: { draftId: id, version: draft.version },
        data: { content: nextContent, imageMeta: nextImageMeta },
      })
    }
    await db.eventLog.create({
      data: {
        draftId: id,
        actor: user.name,
        action: 'STATUS_CHANGE',
        details: JSON.stringify({
          from: draft.status,
          to: 'DRAFT',
          version: updated.version,
          reason: 'content edited — re-audit required',
        }),
      },
    })
  }

  return NextResponse.json({ ok: true, status: updated.status, version: updated.version })
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  if (!(await hasRole('creator'))) return NextResponse.json({ error: 'Author access required.' }, { status: 403 })
  const { id } = await ctx.params
  await db.draft.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
