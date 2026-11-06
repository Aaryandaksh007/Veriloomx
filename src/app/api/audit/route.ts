import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { runAudit, serialiseAudit } from '@/lib/audit/engine'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/** POST {draftId} — run the parallel 6-pillar audit. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const draftId = String(body?.draftId ?? '')
  if (!draftId) return NextResponse.json({ error: 'draftId is required' }, { status: 400 })

  const draft = await db.draft.findUnique({ where: { id: draftId } })
  if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
  if (draft.status === 'APPROVED') {
    return NextResponse.json(
      { error: 'This draft is approved and sealed — audit a new draft instead.' },
      { status: 409 }
    )
  }

  try {
    const result = await runAudit(draftId, body?.actor ?? 'Maya Chen')
    return NextResponse.json({ audit: result })
  } catch (err) {
    console.error('[audit] engine failure:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Audit engine failure' },
      { status: 500 }
    )
  }
}

/** GET ?draftId= — latest audit for a draft. */
export async function GET(req: NextRequest) {
  const draftId = req.nextUrl.searchParams.get('draftId')
  if (!draftId) return NextResponse.json({ error: 'draftId is required' }, { status: 400 })

  const run = await db.auditRun.findFirst({
    where: { draftId },
    orderBy: { createdAt: 'desc' },
  })
  if (!run) return NextResponse.json({ audit: null })
  return NextResponse.json({ audit: serialiseAudit(run, draftId) })
}
