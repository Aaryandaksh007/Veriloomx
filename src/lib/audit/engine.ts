// ─────────────────────────────────────────────────────────────
// VeriLoom AI — Parallel 6-Pillar Audit Engine (orchestrator)
// Stage A: local confidentiality scrub (deterministic)
// Stage B: pillars run in parallel (deterministic math + RAG)
// Stage C: citation post-validation, merge, scoring, ledger
// ─────────────────────────────────────────────────────────────
import 'server-only'
import type { Draft, VaultItem, AuditRun } from '@prisma/client'
import { db } from '../db'
import type {
  AiLedgerEntry,
  AuditResult,
  Finding,
  ImageMeta,
  Pillar,
  PillarSummary,
} from '../types'
import { PILLAR_META } from '../types'
import {
  runTerminology,
  runClaimsScan,
  runConfidentialityText,
  runConfidentialityImage,
} from './deterministic'
import { runToneRag, runClaimsRag } from './rag'
import { runVisualPalette, runImageVlm } from './image'

function parseImageMeta(draft: Draft): ImageMeta | null {
  if (!draft.imageMeta) return null
  try {
    return JSON.parse(draft.imageMeta) as ImageMeta
  } catch {
    return null
  }
}

/** overlap ratio between two quotes (share of the shorter quote) */
function quoteOverlap(a: string, b: string): number {
  const na = a.toLowerCase()
  const nb = b.toLowerCase()
  if (!na || !nb) return 0
  if (na.includes(nb) || nb.includes(na)) return 1
  // word-level overlap
  const wa = new Set(na.split(/\s+/))
  const wb = new Set(nb.split(/\s+/))
  let shared = 0
  for (const w of wa) if (wb.has(w)) shared++
  return shared / Math.min(wa.size, wb.size)
}

const SEVERITY_RANK: Record<string, number> = { critical: 0, warning: 1, info: 2, pass: 3 }

/**
 * Merge findings whose quotes overlap heavily (≥0.8). The more severe /
 * more specific finding survives; the dropped citation is preserved in
 * `alsoViolates` so no governance signal is lost.
 */
function mergeOverlapping(findings: Finding[]): Finding[] {
  const sorted = [...findings].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
  )
  const kept: Finding[] = []
  for (const f of sorted) {
    if (!f.quote) {
      // image-level findings never merge by quote
      kept.push(f)
      continue
    }
    const dup = kept.find(
      (k) =>
        k.quote &&
        k.pillar !== 'confidentiality' &&
        f.pillar !== 'confidentiality' &&
        quoteOverlap(k.quote, f.quote) >= 0.8
    )
    if (dup) {
      const also = (dup.meta?.alsoViolates as string[] | undefined) ?? []
      if (f.clauseId && f.clauseId !== dup.clauseId && !also.includes(f.clauseId)) {
        dup.meta = { ...(dup.meta ?? {}), alsoViolates: [...also, f.clauseId] }
      }
      continue
    }
    kept.push(f)
  }
  return kept
}

function pillarSummary(
  pillar: Pillar,
  findings: Finding[],
  durationMs: number,
  detail: string,
  skipped = false
): PillarSummary {
  const critical = findings.filter((f) => f.severity === 'critical').length
  const warning = findings.filter((f) => f.severity === 'warning').length
  const info = findings.filter((f) => f.severity === 'info').length
  return {
    pillar,
    engine: PILLAR_META[pillar].engine,
    status: skipped
      ? 'skipped'
      : critical > 0
        ? 'fail'
        : warning > 0
          ? 'warn'
          : 'pass',
    critical,
    warning,
    info,
    durationMs,
    detail,
  }
}

function computeScore(findings: Finding[]): number {
  let score = 100
  for (const f of findings) {
    if (f.severity === 'critical') score -= 15
    else if (f.severity === 'warning') score -= 7
    else if (f.severity === 'info') score -= 2
  }
  return Math.max(0, score)
}

export async function runAudit(draftId: string, actor = 'Maya Chen'): Promise<AuditResult> {
  const draft = await db.draft.findUnique({ where: { id: draftId } })
  if (!draft) throw new Error('Draft not found')

  const vault = await db.vaultItem.findMany({ where: { active: true } })
  const ledger: AiLedgerEntry[] = []
  let suppressed = 0

  const isImage = draft.kind === 'image'
  const imageMeta = parseImageMeta(draft)

  // ── Stage A: local confidentiality sandbox (BEFORE any AI call) ──
  let redactedText: string | null = null
  let confFindings: Finding[] = []

  if (!isImage) {
    const conf = runConfidentialityText(draft.content, vault)
    confFindings = conf.findings
    redactedText = conf.redactedText
  }

  const t0 = Date.now()

  // ── Stage B: parallel pillar execution ──────────────────────
  const [terminologyRes, claimsScanRes, toneRes, claimsRes, visualRes] =
    await Promise.allSettled([
      // Pillar 2 — deterministic terminology
      (async () => {
        const s = Date.now()
        const termItems = vault.filter((v) => v.type === 'TERM')
        const findings = isImage ? [] : runTerminology(draft.content, termItems)
        return {
          findings,
          summary: pillarSummary(
            'terminology',
            findings,
            Date.now() - s,
            isImage
              ? 'Skipped — no text body in visual asset'
              : `${termItems.length} lexicon rules matched lexically (${findings.length} hits)`
          ),
        }
      })(),

      // Pillar 3a — deterministic claims pre-scan
      (async () => {
        const s = Date.now()
        const findings = isImage ? [] : runClaimsScan(draft.content, vault)
        return {
          findings,
          summary: pillarSummary(
            'claims',
            findings,
            Date.now() - s,
            isImage
              ? 'Skipped for visual asset'
              : `${findings.length} figures traced against the verified fact sheet`
          ),
        }
      })(),

      // Pillar 1 — citation-gated RAG tone audit
      (async () => {
        const s = Date.now()
        if (isImage) {
          return {
            findings: [] as Finding[],
            summary: pillarSummary('tone', [], Date.now() - s, 'Skipped — no text body in visual asset', true),
          }
        }
        const res = await runToneRag(redactedText ?? draft.content, vault, draft.channel)
        ledger.push(...res.ledger)
        suppressed += res.suppressed
        return {
          findings: res.findings,
          summary: pillarSummary(
            'tone',
            res.findings,
            Date.now() - s,
            res.parseError
              ? 'AI response unparseable — deterministic checks only (no flags raised)'
              : `${res.findings.length} voice flags grounded in Vault citations${res.suppressed ? `, ${res.suppressed} ungrounded flag(s) suppressed` : ''}`
          ),
        }
      })(),

      // Pillar 3b — citation-gated RAG claims verification
      (async () => {
        const s = Date.now()
        if (isImage) {
          return {
            findings: [] as Finding[],
            summary: pillarSummary('claims', [], Date.now() - s, 'Skipped for visual asset', true),
          }
        }
        const res = await runClaimsRag(redactedText ?? draft.content, vault, draft.channel)
        ledger.push(...res.ledger)
        suppressed += res.suppressed
        return {
          findings: res.findings,
          summary: pillarSummary(
            'claims',
            res.findings,
            Date.now() - s,
            res.parseError
              ? 'AI response unparseable — deterministic figure scan only'
              : `Atomic-claim verification complete${res.suppressed ? `, ${res.suppressed} ungrounded flag(s) suppressed` : ''}`
          ),
        }
      })(),

      // Pillar 4 + 5 + 6 — image pipeline
      (async () => {
        const s = Date.now()
        if (!isImage || !draft.imageData) {
          return {
            visualFindings: [] as Finding[],
            a11yFindings: [] as Finding[],
            visualSummary: pillarSummary('visual', [], Date.now() - s, 'Skipped — text-only draft', true),
            a11ySummary: pillarSummary('accessibility', [], Date.now() - s, 'Skipped — text-only draft', true),
            imageConf: [] as Finding[],
            confSummary: pillarSummary('confidentiality', confFindings, Date.now() - s, 'No text to scrub', true),
            altSuggestion: null as string | null,
          }
        }
        const palette = imageMeta?.palette ?? []

        // Pillar 4 — deterministic CIELAB ΔE2000
        const colorItems = vault.filter((v) => v.type === 'COLOR')
        const visualFindings = runVisualPalette(palette, colorItems)
        const vs = Date.now() - s

        // Pillar 5 — VLM sampling + deterministic WCAG math
        const a11yRule = vault.find((v) => v.clauseId === 'VL-A11Y-001') ?? null
        const logoRule = vault.find((v) => v.type === 'LOGO') ?? null
        const vlm = await runImageVlm(draft.imageData, { a11y: a11yRule, logo: logoRule })
        ledger.push(...vlm.ledger)

        const a11yFindings: Finding[] = [...vlm.contrastFindings]

        // alt-text check (deterministic, cited to A11Y rule)
        const altText = (imageMeta?.altText ?? '').trim()
        if (!altText && a11yRule) {
          a11yFindings.push({
            key: 'a11y-alt-0',
            pillar: 'accessibility',
            severity: 'critical',
            engine: 'deterministic',
            title: 'Missing alt text',
            quote: '',
            explanation:
              'This asset has no descriptive alt text. WCAG 2.1 AA (SC 1.1.1) requires a text alternative for all non-decorative images.',
            clauseId: a11yRule.clauseId,
            clauseQuote: a11yRule.content,
            clauseTitle: a11yRule.title,
            suggestion: vlm.altTextSuggestion ? `"${vlm.altTextSuggestion}"` : null,
            suggestionSource: vlm.altTextSuggestion ? 'ai' : null,
            meta: { kind: 'alt-text' },
          })
        }

        // Pillar 6 for images — PII on VLM-extracted text + alt text
        const imageConf = runConfidentialityImage(
          vlm.extractedTexts,
          altText,
          vault
        )

        // logo findings live in the visual pillar
        const visualAll = [...visualFindings, ...vlm.logoFindings]

        return {
          visualFindings: visualAll,
          a11yFindings,
          visualSummary: pillarSummary(
            'visual',
            visualAll,
            vs,
            `ΔE2000 palette distance on ${palette.length} extracted swatches vs ${colorItems.length} brand tokens${vlm.logoFindings.length ? ' · logo inspection via VLM' : ''}`
          ),
          a11ySummary: pillarSummary(
            'accessibility',
            a11yFindings,
            Date.now() - s,
            `${vlm.extractedTexts.length} text regions sampled by VLM · contrast computed with exact WCAG 2.1 luminance math${vlm.parseError ? ' (VLM unparseable — alt-text check only)' : ''}`
          ),
          imageConf,
          confSummary: pillarSummary(
            'confidentiality',
            imageConf,
            Date.now() - s,
            imageConf.length
              ? `${imageConf.length} sensitive token(s) detected in asset text`
              : 'No sensitive tokens detected in asset text or alt text'
          ),
          altSuggestion: vlm.altTextSuggestion,
        }
      })(),
    ])

  for (const [name, result] of [
    ['terminology', terminologyRes],
    ['claims scan', claimsScanRes],
    ['tone AI', toneRes],
    ['claims AI', claimsRes],
    ['image analysis', visualRes],
  ] as const) {
    if (result.status === 'rejected') {
      console.error(`[audit] ${name} engine failure:`, result.reason)
    }
  }

  const unwrap = <T>(r: PromiseSettledResult<T>, fallback: T): T =>
    r.status === 'fulfilled' ? r.value : fallback

  const terminology = unwrap(terminologyRes, {
    findings: [] as Finding[],
    summary: pillarSummary('terminology', [], 0, 'Engine error — skipped', true),
  })
  const claimsScan = unwrap(claimsScanRes, {
    findings: [] as Finding[],
    summary: pillarSummary('claims', [], 0, 'Engine error', true),
  })
  const tone = unwrap(toneRes, {
    findings: [] as Finding[],
    summary: pillarSummary('tone', [], 0, 'AI engine failed — see server logs', true),
  })
  const claimsRag = unwrap(claimsRes, {
    findings: [] as Finding[],
    summary: pillarSummary('claims', [], 0, 'AI engine failed — see server logs', true),
  })
  const imagePipeline = unwrap(visualRes, {
    visualFindings: [] as Finding[],
    a11yFindings: [] as Finding[],
    visualSummary: pillarSummary('visual', [], 0, 'Engine error', true),
    a11ySummary: pillarSummary('accessibility', [], 0, 'Engine error', true),
    imageConf: [] as Finding[],
    confSummary: pillarSummary('confidentiality', [], 0, 'Engine error', true),
    altSuggestion: null as string | null,
  })

  // ── Stage C: merge, dedupe, re-key, score ───────────────────
  let allFindings: Finding[] = []
  let pillars: PillarSummary[] = []

  if (isImage) {
    allFindings = [
      ...imagePipeline.visualFindings,
      ...imagePipeline.a11yFindings,
      ...imagePipeline.imageConf,
    ]
    pillars = [
      pillarSummary('tone', [], 0, 'Skipped — visual asset (no copy body)', true),
      pillarSummary('terminology', [], 0, 'Skipped — visual asset (no copy body)', true),
      pillarSummary('claims', [], 0, 'Skipped — visual asset (no copy body)', true),
      imagePipeline.visualSummary,
      imagePipeline.a11ySummary,
      imagePipeline.confSummary,
    ]
  } else {
    // merge deterministic + RAG claims findings (dedupe overlapping quotes)
    const mergedClaims = mergeOverlapping([...claimsScan.findings, ...claimsRag.findings])
    allFindings = [
      ...tone.findings,
      ...terminology.findings,
      ...mergedClaims,
      ...confFindings,
    ]
    pillars = [
      tone.summary,
      terminology.summary,
      {
        ...claimsRag.summary,
        critical: claimsRag.summary.critical,
        warning: claimsRag.summary.warning,
        info: claimsRag.summary.info,
        durationMs: claimsScan.summary.durationMs + claimsRag.summary.durationMs,
        detail: `Deterministic figure scan + citation-gated RAG (${mergedClaims.length} unique findings)`,
      },
      pillarSummary('visual', [], 0, 'Skipped — text-only draft', true),
      pillarSummary('accessibility', [], 0, 'Skipped — text-only draft', true),
      pillarSummary(
        'confidentiality',
        confFindings,
        0,
        confFindings.length
          ? `${confFindings.length} token(s) masked locally before AI calls`
          : 'No sensitive tokens detected — draft transmitted to AI clean'
      ),
    ]
  }

  // global overlap merge across pillars (tone vs terminology double-flags)
  allFindings = mergeOverlapping(allFindings)

  // recompute pillar counts after merge
  pillars = pillars.map((p) => {
    const fs = allFindings.filter((f) => f.pillar === p.pillar)
    const critical = fs.filter((f) => f.severity === 'critical').length
    const warning = fs.filter((f) => f.severity === 'warning').length
    const info = fs.filter((f) => f.severity === 'info').length
    return {
      ...p,
      critical,
      warning,
      info,
      status:
        p.status === 'skipped'
          ? 'skipped'
          : critical > 0
            ? 'fail'
            : warning > 0
              ? 'warn'
              : 'pass',
    }
  })

  // stable keys
  allFindings = allFindings.map((f, i) => ({ ...f, key: `F${i + 1}` }))

  const score = computeScore(allFindings)
  const totalMs = Date.now() - t0

  // ── Persist ─────────────────────────────────────────────────
  const run = await db.auditRun.create({
    data: {
      draftId,
      version: draft.version,
      score,
      pillarSummaries: JSON.stringify(pillars),
      findings: JSON.stringify(allFindings),
      suppressed,
      redactedPreview: redactedText,
      aiLedger: JSON.stringify(ledger),
    },
  })

  await db.eventLog.create({
    data: {
      draftId,
      actor,
      action: 'AUDIT_RUN',
      details: JSON.stringify({
        auditId: run.id,
        score,
        findings: allFindings.length,
        suppressed,
        durationMs: totalMs,
      }),
    },
  })

  for (const entry of ledger) {
    await db.eventLog.create({
      data: {
        draftId,
        actor: 'VeriLoom Engine',
        action: 'AI_CALL',
        details: JSON.stringify(entry),
      },
    })
  }

  if (['DRAFT', 'CHANGES_REQUESTED'].includes(draft.status)) {
    await db.draft.update({ where: { id: draftId }, data: { status: 'AUDITED' } })
  }

  return serialiseAudit(run, draftId)
}

export function serialiseAudit(run: AuditRun, draftId: string): AuditResult {
  return {
    id: run.id,
    draftId,
    version: run.version,
    score: run.score,
    findings: JSON.parse(run.findings) as Finding[],
    pillars: JSON.parse(run.pillarSummaries) as PillarSummary[],
    suppressed: run.suppressed,
    redactedPreview: run.redactedPreview,
    aiLedger: JSON.parse(run.aiLedger || '[]') as AiLedgerEntry[],
    createdAt: run.createdAt.toISOString(),
  }
}
