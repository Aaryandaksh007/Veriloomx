import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

const TYPE_PREFIX: Record<string, string> = {
  VOICE: 'VOICE',
  FACT: 'FACT',
  TERM: 'TERM',
  COLOR: 'COLOR',
  LOGO: 'LOGO',
  CONFIDENTIAL: 'CONF',
  RULE: 'RULE',
}

export async function GET() {
  const items = await db.vaultItem.findMany({ orderBy: { clauseId: 'asc' } })
  return NextResponse.json({
    items: items.map((v) => ({
      id: v.id,
      clauseId: v.clauseId,
      type: v.type,
      title: v.title,
      content: v.content,
      extra: v.extra ? JSON.parse(v.extra) : null,
      active: v.active,
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
    })),
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const type = String(body.type ?? '')
  const title = String(body.title ?? '').trim()
  const content = String(body.content ?? '').trim()
  if (!TYPE_PREFIX[type] || !title || !content) {
    return NextResponse.json(
      { error: 'type, title and content are required' },
      { status: 400 }
    )
  }

  // next clause id for this type
  const prefix = `VL-${TYPE_PREFIX[type]}`
  const existing = await db.vaultItem.findMany({ where: { clauseId: { startsWith: `${prefix}-` } } })
  let max = 0
  for (const e of existing) {
    const m = e.clauseId.match(/-(\d+)$/)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  const clauseId = `${prefix}-${String(max + 1).padStart(3, '0')}`

  const item = await db.vaultItem.create({
    data: {
      clauseId,
      type,
      title,
      content,
      extra: body.extra ? JSON.stringify(body.extra) : null,
    },
  })

  await db.eventLog.create({
    data: {
      actor: body.actor ?? 'Dev Kapoor',
      action: 'VAULT_EDIT',
      details: JSON.stringify({ verb: 'created', clauseId, title }),
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
