import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { replaceQuote } from '@/lib/diff'
import { auditHasEngineErrors, type Finding, type PillarSummary } from '@/lib/types'
import { hasRole } from '@/lib/authorization'

export const dynamic = 'force-dynamic'

/**
 * POST {draftId, auditId} — apply all accepted/edited fixes as a new
 * remediated version (Human Overrides keep the original wording).
 */
export async function POST(req: NextRequest) {
  const user = await hasRole('creator')
  if (!user) return NextResponse.json({ error: 'Author access required.' }, { status: 403 })
  const body = await req.json().catch(() => null)
  const draftId = String(body?.draftId ?? '')
  const auditId = String(body?.auditId ?? '')
  if (!draftId || !auditId) {
    return NextResponse.json({ error: 'draftId and auditId are required' }, { status: 400 })
  }

  const [draft, audit] = await Promise.all([
    db.draft.findUnique({ where: { id: draftId } }),
    db.auditRun.findUnique({ where: { id: auditId }, include: { actions: true } }),
  ])
  if (!draft || !audit) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const findings = JSON.parse(audit.findings) as Finding[]
  const pillars = JSON.parse(audit.pillarSummaries) as PillarSummary[]
  if (!['AUDITED', 'CHANGES_REQUESTED', 'REMEDIATED'].includes(draft.status)) {
    return NextResponse.json(
      { error: `Remediation is not available while the draft is ${draft.status}. Run a fresh audit first.` },
      { status: 409 }
    )
  }
  if (audit.version !== draft.version) {
    return NextResponse.json(
      { error: 'This audit is for an older draft version. Run a fresh audit before remediation.' },
      { status: 409 }
    )
  }
  if (auditHasEngineErrors(pillars)) {
    return NextResponse.json(
      { error: 'This audit is incomplete because one or more checks failed. Rerun the audit before remediation.' },
      { status: 409 }
    )
  }
  const actionsBy = new Map(audit.actions.map((a) => [a.findingKey, a]))

  // Clean 0-finding fast-path: confirm clean audit without creating a duplicate version row
  if (findings.length === 0 && Boolean(body?.confirmClean)) {
    await db.draft.update({ where: { id: draftId }, data: { status: 'REMEDIATED' } })
    await db.eventLog.create({
      data: {
        draftId,
        actor: user.name,
        action: 'STATUS_CHANGE',
        details: JSON.stringify({
          from: draft.status,
          to: 'REMEDIATED',
          applied: 0,
          overrides: 0,
          clean: true,
          version: draft.version,
        }),
      },
    })
    return NextResponse.json({
      ok: true,
      version: draft.version,
      applied: 0,
      overrides: 0,
      clean: true,
    })
  }

  const unresolved = findings.filter((f) => !actionsBy.has(f.key))
  if (unresolved.length > 0) {
    return NextResponse.json(
      {
        error: `Resolve every finding first — ${unresolved.length} still pending (e.g. ${unresolved[0].key}).`,
        unresolved: unresolved.map((f) => f.key),
      },
      { status: 409 }
    )
  }

  const overrides = audit.actions.filter((a) => a.action === 'overridden')

  if (draft.kind === 'text') {
    let content = draft.content
    let applied = 0

    // apply replacements from the end of the text backwards to keep indices valid
    const edits: { quote: string; replacement: string }[] = []
    for (const f of findings) {
      const act = actionsBy.get(f.key)!
      if (act.action === 'overridden' || !f.quote) continue
      const replacement =
        act.appliedText ?? f.suggestion ?? f.quote
      if (!replacement) continue
      edits.push({ quote: f.quote, replacement })
    }

    for (const { quote, replacement } of edits) {
      const res = replaceQuote(content, quote, replacement)
      if (res.replaced) {
        content = res.text
        applied++
      }
    }

    const version = draft.version + 1
    await db.draftVersion.create({
      data: {
        draftId,
        version,
        content,
        note: `Remediated — ${applied} fix(es) applied, ${overrides.length} human override(s) preserved`,
      },
    })
    await db.draft.update({
      where: { id: draftId },
      data: { content, version, status: 'REMEDIATED' },
    })
    await db.eventLog.create({
      data: {
        draftId,
        actor: user.name,
        action: 'STATUS_CHANGE',
        details: JSON.stringify({
          from: draft.status,
          to: 'REMEDIATED',
          applied,
          overrides: overrides.length,
          version,
        }),
      },
    })

    return NextResponse.json({ ok: true, version, applied, overrides: overrides.length })
  }

  // ── image drafts: remediation touches alt text only ──────
  const meta = draft.imageMeta ? JSON.parse(draft.imageMeta) : null
  if (meta) {
    let applied = 0
    const altFinding = findings.find((f) => f.meta?.kind === 'alt-text')
    const altAction = altFinding ? actionsBy.get(altFinding.key) : undefined
    if (altAction && altAction.action !== 'overridden') {
      meta.altText = (altAction.appliedText ?? altFinding?.suggestion ?? meta.altText)
        .replace(/^"|"$/g, '')
      applied = 1
    }
    const nextMetaJson = JSON.stringify(meta)
    const version = draft.version + 1
    await db.draftVersion.create({
      data: {
        draftId,
        version,
        content: '',
        imageData: draft.imageData,
        imageMeta: nextMetaJson,
        note: `Remediated — ${applied} alt-text fix(es) applied, ${overrides.length} human override(s) preserved`,
      },
    })
    await db.draft.update({
      where: { id: draftId },
      data: { imageMeta: nextMetaJson, status: 'REMEDIATED', version },
    })

    await db.eventLog.create({
      data: {
        draftId,
        actor: user.name,
        action: 'STATUS_CHANGE',
        details: JSON.stringify({
          from: draft.status,
          to: 'REMEDIATED',
          kind: 'image',
          applied,
          overrides: overrides.length,
          version,
        }),
      },
    })

    return NextResponse.json({ ok: true, version, applied, overrides: overrides.length })
  }

  return NextResponse.json({ ok: true, version: draft.version, applied: 0, overrides: overrides.length })
}
