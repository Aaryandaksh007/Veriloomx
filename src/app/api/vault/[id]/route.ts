import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const existing = await db.vaultItem.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const data: Record<string, unknown> = {}
  if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim()
  if (typeof body.content === 'string' && body.content.trim()) data.content = body.content.trim()
  if (typeof body.active === 'boolean') data.active = body.active
  if (body.extra !== undefined) data.extra = body.extra ? JSON.stringify(body.extra) : null

  const item = await db.vaultItem.update({ where: { id }, data })

  await db.eventLog.create({
    data: {
      actor: body.actor ?? 'Dev Kapoor',
      action: 'VAULT_EDIT',
      details: JSON.stringify({
        verb: 'updated',
        clauseId: item.clauseId,
        fields: Object.keys(data),
        aiAssisted: Boolean(body.aiAssisted),
      }),
    },
  })

  return NextResponse.json({
    item: {
      id: item.id,
      clauseId: item.clauseId,
      type: item.type,
      title: item.title,
      content: item.content,
      extra: item.extra ? JSON.parse(item.extra) : null,
      active: item.active,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    },
  })
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const existing = await db.vaultItem.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.vaultItem.delete({ where: { id } })
  await db.eventLog.create({
    data: {
      actor: 'Dev Kapoor',
      action: 'VAULT_EDIT',
      details: JSON.stringify({ verb: 'deleted', clauseId: existing.clauseId }),
    },
  })
  return NextResponse.json({ ok: true })
}
