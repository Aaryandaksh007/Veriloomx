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
import { diffVaultSnapshot } from '../vault-lineage'
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
    const parsed = JSON.parse(draft.imageMeta) as Partial<ImageMeta>
    if (
      typeof parsed.altText !== 'string' ||
      !Array.isArray(parsed.palette) ||
      parsed.palette.length === 0 ||
      !parsed.palette.every(
        (swatch) =>
          /^#[0-9a-f]{6}$/i.test(swatch.hex) &&
          Number.isFinite(swatch.ratio) &&
          swatch.ratio >= 0
      ) ||
      typeof parsed.width !== 'number' ||
      typeof parsed.height !== 'number' ||
      typeof parsed.fileName !== 'string'
    ) {
      return null
    }
    return parsed as ImageMeta
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
  skipped = false,
  failed = false
): PillarSummary {
  const critical = findings.filter((f) => f.severity === 'critical').length
  const warning = findings.filter((f) => f.severity === 'warning').length
  const info = findings.filter((f) => f.severity === 'info').length
  return {
    pillar,
    engine: PILLAR_META[pillar].engine,
    status: skipped
      ? 'skipped'
      : failed
        ? 'error'
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

export async function runAudit(
  draftId: string,
  actor = 'Maya Chen',
  options: {
    version?: number
    retryAuditId?: string
    simulateFailure?: 'tone' | 'claims' | 'vision'
  } = {}
): Promise<AuditResult> {
  const currentDraft = await db.draft.findUnique({ where: { id: draftId } })
  if (!currentDraft) throw new Error('Draft not found')
  const requestedVersion = options.version ?? currentDraft.version
  if (!Number.isInteger(requestedVersion) || requestedVersion < 1 || requestedVersion > currentDraft.version) {
    throw new Error('Draft version is invalid')
  }
  const snapshot = requestedVersion === currentDraft.version
    ? null
    : await db.draftVersion.findUnique({
        where: { draftId_version: { draftId, version: requestedVersion } },
      })
  if (requestedVersion !== currentDraft.version && !snapshot) {
    throw new Error('Draft version not found')
  }
  const draft = snapshot
    ? {
        ...currentDraft,
        version: requestedVersion,
        content: snapshot.content,
        imageData: snapshot.imageData,
        imageMeta: snapshot.imageMeta,
      }
    : currentDraft
  if (draft.kind === 'text' && !draft.content.trim()) {
    throw new Error('The saved text version is empty')
  }

  const vault = await db.vaultItem.findMany({ where: { active: true } })
  const ledger: AiLedgerEntry[] = []
  let suppressed = 0

  const isImage = draft.kind === 'image'
  const imageMeta = parseImageMeta(draft)

  // ── Smart failed-check recovery (retry only errored pillars) ──
  let reusePrior = false
  let priorFindings: Finding[] = []
  let priorPillars = new Map<Pillar, PillarSummary>()
  const failedPillars = new Set<Pillar>()
  let recoveryNote: { recoveredFrom: string; retriedPillars: Pillar[] } | null = null

  if (options.retryAuditId) {
    const prior = await db.auditRun.findUnique({ where: { id: options.retryAuditId } })
    if (!prior || prior.draftId !== draftId || prior.version !== draft.version) {
      throw new Error('Original incomplete audit was not found for this draft version')
    }
    const parsedPriorPillars = JSON.parse(prior.pillarSummaries) as PillarSummary[]
    const parsedPriorSnapshot = prior.vaultSnapshot
      ? (JSON.parse(prior.vaultSnapshot) as { clauseId: string; ruleVer: number }[])
      : []
    const vaultDiff = diffVaultSnapshot(parsedPriorSnapshot, vault)
    for (const p of parsedPriorPillars) {
      if (p.status === 'error') failedPillars.add(p.pillar)
      else priorPillars.set(p.pillar, p)
    }
    if (failedPillars.size > 0 && !vaultDiff.isStale) {
      reusePrior = true
      priorFindings = JSON.parse(prior.findings) as Finding[]
      const priorLedger = JSON.parse(prior.aiLedger || '[]') as AiLedgerEntry[]
      for (const entry of priorLedger) {
        const isToneCall = /tone/i.test(entry.purpose)
        const isClaimsCall = /claim/i.test(entry.purpose)
        const isVisionCall = /visual|wcag|contrast|logo/i.test(entry.purpose)
        if (isToneCall && !failedPillars.has('tone')) ledger.push(entry)
        else if (isClaimsCall && !failedPillars.has('claims')) ledger.push(entry)
        else if (
          isVisionCall &&
          !failedPillars.has('visual') &&
          !failedPillars.has('accessibility') &&
          !failedPillars.has('confidentiality')
        ) {
          ledger.push(entry)
        }
      }
      recoveryNote = { recoveredFrom: prior.id, retriedPillars: [...failedPillars] }
    }
  }
  const reusedLedgerCount = ledger.length

  // ── Stage A: local confidentiality sandbox (BEFORE any AI call) ──
  let redactedText: string | null = null
  let confFindings: Finding[] = []

  if (!isImage) {
    const conf = runConfidentialityText(draft.content, vault)
    confFindings =
      reusePrior && !failedPillars.has('confidentiality')
        ? priorFindings.filter((f) => f.pillar === 'confidentiality')
        : conf.findings
    redactedText = conf.redactedText
  }

  const t0 = Date.now()

  // ── Stage B: parallel pillar execution ──────────────────────
  const [terminologyRes, claimsScanRes, toneRes, claimsRes, visualRes] =
    await Promise.allSettled([
      // Pillar 2 — deterministic terminology
      (async () => {
        const s = Date.now()
        if (!isImage && reusePrior && !failedPillars.has('terminology')) {
          return {
            findings: priorFindings.filter((f) => f.pillar === 'terminology'),
            summary: priorPillars.get('terminology')!,
          }
        }
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
        if (!isImage && reusePrior && !failedPillars.has('claims')) {
          return {
            findings: [] as Finding[], // claims findings preserved from prior combined claims findings
            summary: priorPillars.get('claims')!,
          }
        }
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
        if (reusePrior && !failedPillars.has('tone')) {
          return {
            findings: priorFindings.filter((f) => f.pillar === 'tone'),
            summary: priorPillars.get('tone')!,
          }
        }
        if (options.simulateFailure === 'tone') {
          return {
            findings: [] as Finding[],
            summary: pillarSummary(
              'tone',
              [],
              Date.now() - s,
              'Simulated Tone AI check fault (fail-safe check) — retry failed checks to recover',
              false,
              true
            ),
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
              ? 'AI response could not be verified — retry failed checks before review'
              : `${res.findings.length} voice flags grounded in Vault citations${res.suppressed ? `, ${res.suppressed} ungrounded flag(s) suppressed` : ''}`,
            false,
            res.parseError
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
        if (reusePrior && !failedPillars.has('claims')) {
          return {
            findings: priorFindings.filter((f) => f.pillar === 'claims'),
            summary: priorPillars.get('claims')!,
          }
        }
        if (options.simulateFailure === 'claims') {
          return {
            findings: [] as Finding[],
            summary: pillarSummary(
              'claims',
              [],
              Date.now() - s,
              'Simulated Claims AI check fault (fail-safe check) — retry failed checks to recover',
              false,
              true
            ),
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
              ? 'AI response could not be verified — deterministic figure scan only; retry failed checks before review'
              : `Atomic-claim verification complete${res.suppressed ? `, ${res.suppressed} ungrounded flag(s) suppressed` : ''}`,
            false,
            res.parseError
          ),
        }
      })(),

      // Pillar 4 + 5 + 6 — image pipeline
      (async () => {
        const s = Date.now()
        if (!isImage) {
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
        if (
          reusePrior &&
          !failedPillars.has('visual') &&
          !failedPillars.has('accessibility') &&
          !failedPillars.has('confidentiality')
        ) {
          return {
            visualFindings: priorFindings.filter((f) => f.pillar === 'visual'),
            a11yFindings: priorFindings.filter((f) => f.pillar === 'accessibility'),
            visualSummary: priorPillars.get('visual')!,
            a11ySummary: priorPillars.get('accessibility')!,
            imageConf: priorFindings.filter((f) => f.pillar === 'confidentiality'),
            confSummary: priorPillars.get('confidentiality')!,
            altSuggestion: null as string | null,
          }
        }
        if (!draft.imageData || !imageMeta) {
          throw new Error('Image asset or validated image metadata is missing')
        }
        const palette = imageMeta.palette

        // Pillar 4 — deterministic CIELAB ΔE2000
        const colorItems = vault.filter((v) => v.type === 'COLOR')
        const visualFindings = runVisualPalette(palette, colorItems)
        const vs = Date.now() - s

        // Pillar 5 — VLM sampling + deterministic WCAG math
        const a11yRule = vault.find((v) => v.clauseId === 'VL-A11Y-001') ?? null
        const logoRule = vault.find((v) => v.type === 'LOGO') ?? null
        let vlm: Awaited<ReturnType<typeof runImageVlm>> | null = null
        const simulatedVisionFault = options.simulateFailure === 'vision'
        if (!simulatedVisionFault) {
          try {
            vlm = await runImageVlm(draft.imageData, { a11y: a11yRule, logo: logoRule })
            ledger.push(...vlm.ledger)
          } catch (error) {
            console.error('[audit] image vision engine failure:', error)
          }
        }
        const visionAvailable = vlm !== null && !vlm.parseError
        const visionResult = vlm ?? {
          contrastFindings: [],
          logoFindings: [],
          altTextSuggestion: null,
          extractedTexts: [],
          ledger: [],
          parseError: true,
        }

        const a11yFindings: Finding[] = [...visionResult.contrastFindings]

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
            suggestion: visionResult.altTextSuggestion ? `"${visionResult.altTextSuggestion}"` : null,
            suggestionSource: visionResult.altTextSuggestion ? 'ai' : null,
            meta: { kind: 'alt-text' },
          })
        }

        // Pillar 6 for images — PII on VLM-extracted text + alt text
        const imageConf = runConfidentialityImage(
          visionResult.extractedTexts,
          altText,
          vault
        )

        // logo findings live in the visual pillar
        const visualAll = [...visualFindings, ...visionResult.logoFindings]

        return {
          visualFindings: visualAll,
          a11yFindings,
          visualSummary: pillarSummary(
            'visual',
            visualAll,
            vs,
            visionAvailable
              ? `ΔE2000 palette distance on ${palette.length} extracted swatches vs ${colorItems.length} brand tokens${visionResult.logoFindings.length ? ' · logo inspection via VLM' : ''}`
              : `ΔE2000 palette checked (${visualFindings.length} palette hit(s)); logo inspection unavailable — retry failed checks before review`,
            false,
            !visionAvailable && Boolean(logoRule)
          ),
          a11ySummary: pillarSummary(
            'accessibility',
            a11yFindings,
            Date.now() - s,
            visionAvailable
              ? `${visionResult.extractedTexts.length} text regions sampled by VLM · contrast computed with exact WCAG 2.1 luminance math`
              : simulatedVisionFault
                ? `Simulated Vision AI fault (fail-safe check); alt-text check completed (${a11yFindings.length}) — retry failed checks to recover`
                : `${a11yFindings.length} alt-text check completed; image text/contrast could not be sampled — retry failed checks before review`,
            false,
            !visionAvailable
          ),
          imageConf,
          confSummary: pillarSummary(
            'confidentiality',
            imageConf,
            Date.now() - s,
            imageConf.length
              ? `${imageConf.length} sensitive token(s) detected in asset text`
              : visionAvailable
                ? 'No sensitive tokens detected in asset text or alt text'
                : 'Alt text checked; in-image OCR text could not be scanned — retry failed checks before review',
            false,
            !visionAvailable
          ),
          altSuggestion: visionResult.altTextSuggestion,
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
    summary: pillarSummary('terminology', [], 0, 'Engine error — rerun before review', false, true),
  })
  const claimsScan = unwrap(claimsScanRes, {
    findings: [] as Finding[],
    summary: pillarSummary('claims', [], 0, 'Deterministic claims scan failed — rerun before review', false, true),
  })
  const tone = unwrap(toneRes, {
    findings: [] as Finding[],
    summary: pillarSummary('tone', [], 0, 'AI engine failed — rerun before review', false, true),
  })
  const claimsRag = unwrap(claimsRes, {
    findings: [] as Finding[],
    summary: pillarSummary('claims', [], 0, 'AI verification failed — deterministic scan only; rerun before review', false, true),
  })
  const imagePipeline = unwrap(visualRes, {
    visualFindings: [] as Finding[],
    a11yFindings: [] as Finding[],
    visualSummary: pillarSummary('visual', [], 0, 'Image analysis failed — rerun before review', false, true),
    a11ySummary: pillarSummary('accessibility', [], 0, 'Image analysis failed — rerun before review', false, true),
    imageConf: [] as Finding[],
    confSummary: pillarSummary('confidentiality', [], 0, 'Image analysis failed — rerun before review', false, true),
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
      reusePrior && !failedPillars.has('claims') && priorPillars.has('claims')
        ? priorPillars.get('claims')!
        : {
            ...claimsRag.summary,
            critical: claimsRag.summary.critical,
            warning: claimsRag.summary.warning,
            info: claimsRag.summary.info,
            durationMs: claimsScan.summary.durationMs + claimsRag.summary.durationMs,
            status:
              claimsScan.summary.status === 'error' || claimsRag.summary.status === 'error'
                ? 'error'
                : claimsRag.summary.status,
            detail:
              claimsScan.summary.status === 'error'
                ? 'Deterministic claims scan failed — rerun before review'
                : claimsRag.summary.status === 'error'
                  ? claimsRag.summary.detail || 'Claims verification incomplete — rerun before review'
                  : `Deterministic figure scan + citation-gated RAG (${mergedClaims.length} unique findings)`,
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
        p.status === 'skipped' || p.status === 'error'
          ? p.status
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
      vaultSnapshot: JSON.stringify(vault.map(({ clauseId, ruleVer }) => ({ clauseId, ruleVer }))),
    },
  })

  await db.eventLog.create({
    data: {
      draftId,
      actor,
      action: 'AUDIT_RUN',
      details: JSON.stringify({
        auditId: run.id,
        version: draft.version,
        score,
        findings: allFindings.length,
        suppressed,
        durationMs: totalMs,
        ...(options.simulateFailure ? { simulatedFailure: options.simulateFailure } : {}),
        ...(recoveryNote ?? {}),
      }),
    },
  })

  for (const entry of ledger.slice(reusedLedgerCount)) {
    await db.eventLog.create({
      data: {
        draftId,
        actor: 'VeriLoom Engine',
        action: 'AI_CALL',
        details: JSON.stringify(entry),
      },
    })
  }

  if (draft.version === currentDraft.version && ['DRAFT', 'CHANGES_REQUESTED', 'REMEDIATED'].includes(draft.status)) {
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
    vaultSnapshot: run.vaultSnapshot
      ? JSON.parse(run.vaultSnapshot) as { clauseId: string; ruleVer: number }[]
      : [],
    createdAt: run.createdAt.toISOString(),
  }
}
