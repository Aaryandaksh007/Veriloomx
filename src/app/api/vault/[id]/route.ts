import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { currentUser, hasRole } from '@/lib/authorization'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  if (!(await currentUser())) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
  }
  const { id } = await ctx.params
  const item = await db.vaultItem.findUnique({
    where: { id },
    include: { history: { orderBy: { version: 'desc' } } },
  })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({
    item: {
      id: item.id,
      clauseId: item.clauseId,
      type: item.type,
      title: item.title,
      content: item.content,
      extra: item.extra ? JSON.parse(item.extra) : null,
      active: item.active,
      ruleVer: item.ruleVer,
    },
    history: item.history.map((version) => ({
      version: version.version,
      title: version.title,
      content: version.content,
      extra: version.extra ? JSON.parse(version.extra) : null,
      active: version.active,
      editedBy: version.editedBy,
      editNote: version.editNote,
      createdAt: version.createdAt.toISOString(),
    })),
  })
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await hasRole('admin')
  if (!user) return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 })
  const { id } = await ctx.params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const existing = await db.vaultItem.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const editNote = typeof body.editNote === 'string' ? body.editNote.trim().slice(0, 500) : ''

  if (body.restoreVersion !== undefined) {
    const targetVer = Number(body.restoreVersion)
    if (!Number.isInteger(targetVer) || targetVer < 1) {
      return NextResponse.json({ error: 'restoreVersion must be a positive integer.' }, { status: 400 })
    }
    const snapshot = await db.vaultItemVersion.findUnique({
      where: { vaultItemId_version: { vaultItemId: id, version: targetVer } },
    })
    if (!snapshot) {
      return NextResponse.json({ error: `Version v${targetVer} was not found.` }, { status: 404 })
    }
    const restored = await db.$transaction(async (tx) => {
      const nextVersion = existing.ruleVer + 1
      const updated = await tx.vaultItem.update({
        where: { id },
        data: {
          title: snapshot.title,
          content: snapshot.content,
          extra: snapshot.extra,
          active: snapshot.active,
          ruleVer: nextVersion,
        },
      })
      await tx.vaultItemVersion.create({
        data: {
          vaultItemId: id,
          version: nextVersion,
          title: updated.title,
          content: updated.content,
          extra: updated.extra,
          active: updated.active,
          editedBy: user.name,
          editNote: editNote || `Restored from v${targetVer}`,
        },
      })
      return updated
    })
    await db.eventLog.create({
      data: {
        actor: user.name,
        action: 'VAULT_EDIT',
        details: JSON.stringify({
          verb: 'restored',
          clauseId: restored.clauseId,
          restoredFrom: targetVer,
          ruleVer: restored.ruleVer,
        }),
      },
    })
    return NextResponse.json({
      item: {
        id: restored.id,
        clauseId: restored.clauseId,
        type: restored.type,
        title: restored.title,
        content: restored.content,
        extra: restored.extra ? JSON.parse(restored.extra) : null,
        active: restored.active,
        ruleVer: restored.ruleVer,
        createdAt: restored.createdAt.toISOString(),
        updatedAt: restored.updatedAt.toISOString(),
      },
    })
  }

  const data: { title?: string; content?: string; active?: boolean; extra?: string | null } = {}
  if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim()
  if (typeof body.content === 'string' && body.content.trim()) data.content = body.content.trim()
  if (typeof body.active === 'boolean') data.active = body.active
  if (body.extra !== undefined) data.extra = body.extra ? JSON.stringify(body.extra) : null
  const changed = Object.entries(data).some(([key, value]) => existing[key as keyof typeof existing] !== value)

  const item = changed
    ? await db.$transaction(async (tx) => {
        const nextVersion = existing.ruleVer + 1
        const updated = await tx.vaultItem.update({
          where: { id },
          data: { ...data, ruleVer: nextVersion },
        })
        await tx.vaultItemVersion.create({
          data: {
            vaultItemId: id,
            version: nextVersion,
            title: updated.title,
            content: updated.content,
            extra: updated.extra,
            active: updated.active,
            editedBy: user.name,
            editNote: editNote || null,
          },
        })
        return updated
      })
    : existing

  if (changed) {
    await db.eventLog.create({
      data: {
        actor: user.name,
        action: 'VAULT_EDIT',
        details: JSON.stringify({
          verb: 'updated',
          clauseId: item.clauseId,
          fields: Object.keys(data),
          ruleVer: item.ruleVer,
        }),
      },
    })
  }

  return NextResponse.json({
    item: {
      id: item.id,
      clauseId: item.clauseId,
      type: item.type,
      title: item.title,
      content: item.content,
      extra: item.extra ? JSON.parse(item.extra) : null,
      active: item.active,
      ruleVer: item.ruleVer,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    },
  })
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await hasRole('admin')
  if (!user) return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 })
  const { id } = await ctx.params
  const existing = await db.vaultItem.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const item = existing.active
    ? await db.$transaction(async (tx) => {
        const updated = await tx.vaultItem.update({
          where: { id },
          data: { active: false, ruleVer: existing.ruleVer + 1 },
        })
        await tx.vaultItemVersion.create({
          data: {
            vaultItemId: id,
            version: updated.ruleVer,
            title: updated.title,
            content: updated.content,
            extra: updated.extra,
            active: false,
            editedBy: user.name,
            editNote: 'Rule archived',
          },
        })
        return updated
      })
    : existing
  await db.eventLog.create({
    data: {
      actor: user.name,
      action: 'VAULT_EDIT',
      details: JSON.stringify({ verb: 'archived', clauseId: item.clauseId, ruleVer: item.ruleVer }),
    },
  })
  return NextResponse.json({ ok: true })
}
