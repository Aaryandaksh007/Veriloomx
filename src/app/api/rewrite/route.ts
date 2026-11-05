import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { intentPreservingRewrite } from '@/lib/audit/rag'
import type { Finding } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST {auditId, findingKey, span?} — intent-preserving minimal rewrite
 * of a flagged span (deterministic intent signature constrains the LLM).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const auditId = String(body?.auditId ?? '')
  const findingKey = String(body?.findingKey ?? '')
  if (!auditId || !findingKey) {
    return NextResponse.json({ error: 'auditId and findingKey are required' }, { status: 400 })
  }

  const audit = await db.auditRun.findUnique({ where: { id: auditId } })
  if (!audit) return NextResponse.json({ error: 'Audit not found' }, { status: 404 })

  const findings = JSON.parse(audit.findings) as Finding[]
  const finding = findings.find((f) => f.key === findingKey)
  if (!finding) return NextResponse.json({ error: 'Finding not found' }, { status: 404 })
  if (!finding.quote) {
    return NextResponse.json(
      { error: 'This finding has no text span to rewrite.' },
      { status: 400 }
    )
  }

  const draft = await db.draft.findUnique({ where: { id: audit.draftId } })
  if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 })

  const span = String(body?.span ?? finding.quote)
  const clause = {
    clauseId: finding.clauseId ?? 'VL-RULE-001',
    title: finding.clauseTitle ?? 'Brand rule',
    content: finding.clauseQuote ?? finding.explanation,
  }

  const res = await intentPreservingRewrite(span, draft.content, clause, draft.channel)

  await db.eventLog.create({
    data: {
      draftId: audit.draftId,
      actor: body?.actor ?? draft.creator,
      action: 'AI_CALL',
      details: JSON.stringify({ ...res.ledger, purpose: `Intent-preserving rewrite (${findingKey})` }),
    },
  })

  if (!res.rewrite) {
    return NextResponse.json(
      { error: 'The co-pilot could not produce a grounded rewrite — edit manually.' },
      { status: 502 }
    )
  }

  return NextResponse.json({
    rewrite: res.rewrite,
    intentNotes: res.intentNotes,
    model: res.ledger.model,
  })
}
