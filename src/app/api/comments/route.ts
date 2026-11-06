import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const draftId = req.nextUrl.searchParams.get('draftId')
  if (!draftId) return NextResponse.json({ error: 'draftId is required' }, { status: 400 })

  const comments = await db.comment.findMany({
    where: { draftId },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({
    comments: comments.map((c) => ({
      id: c.id,
      author: c.author,
      role: c.role,
      body: c.body,
      resolved: c.resolved,
      createdAt: c.createdAt.toISOString(),
    })),
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const draftId = String(body?.draftId ?? '')
  const text = String(body?.body ?? '').trim()
  if (!draftId || !text) {
    return NextResponse.json({ error: 'draftId and body are required' }, { status: 400 })
  }

  const draft = await db.draft.findUnique({ where: { id: draftId } })
  if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 })

  const comment = await db.comment.create({
    data: {
      draftId,
      author: String(body?.author ?? 'Maya Chen'),
      role: String(body?.role ?? 'creator'),
      body: text,
    },
  })

  return NextResponse.json({
    comment: {
      id: comment.id,
      author: comment.author,
      role: comment.role,
      body: comment.body,
      resolved: comment.resolved,
      createdAt: comment.createdAt.toISOString(),
    },
  })
}
