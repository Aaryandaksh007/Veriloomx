import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hasRole, currentUser } from '@/lib/authorization'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!(await currentUser())) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
  const drafts = await db.draft.findMany({ orderBy: { updatedAt: 'desc' } })
  return NextResponse.json({
    drafts: drafts.map((d) => ({
      id: d.id,
      title: d.title,
      channel: d.channel,
      kind: d.kind,
      status: d.status,
      creator: d.creator,
      content: d.content,
      imageData: d.imageData,
      imageMeta: d.imageMeta ? JSON.parse(d.imageMeta) : null,
      version: d.version,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    })),
  })
}

export async function POST(req: NextRequest) {
  const user = await hasRole('creator')
  if (!user) return NextResponse.json({ error: 'Author access required.' }, { status: 403 })
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const title = String(body.title ?? '').trim()
  const kind = body.kind === 'image' ? 'image' : 'text'
  const content = String(body.content ?? '')
  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  if (kind === 'text' && !content.trim()) {
    return NextResponse.json({ error: 'Text drafts need content' }, { status: 400 })
  }
  if (kind === 'image' && !body.imageData) {
    return NextResponse.json({ error: 'Image drafts need an image' }, { status: 400 })
  }

  const creator = user.name

  const draft = await db.draft.create({
    data: {
      title,
      channel: String(body.channel ?? 'Web'),
      kind,
      status: 'DRAFT',
      creator,
      content,
      imageData: kind === 'image' ? String(body.imageData) : null,
      imageMeta: body.imageMeta ? JSON.stringify(body.imageMeta) : null,
      version: 1,
    },
  })

  await db.draftVersion.create({
    data: {
      draftId: draft.id,
      version: 1,
      content,
      imageData: draft.imageData,
      imageMeta: draft.imageMeta,
      note: 'Original submission',
    },
  })

  await db.eventLog.create({
    data: {
      draftId: draft.id,
      actor: creator,
      action: 'STATUS_CHANGE',
      details: JSON.stringify({ from: null, to: 'DRAFT', title }),
    },
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
  })
}
