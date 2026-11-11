// ─────────────────────────────────────────────────────────────
// VeriLoom AI — Deterministic pillar implementations
// Terminology (exact lexical match), Claims pre-scan (figure
// verification), and Confidentiality (local redaction sandbox).
// Zero LLM involvement — these checks are pure algorithms.
// ─────────────────────────────────────────────────────────────
import type { VaultItem } from '@prisma/client'
import type { Finding } from '../types'
import { redact, type RedactionHit } from '../redact'

export function vaultExtra(item: VaultItem): Record<string, unknown> {
  if (!item.extra) return {}
  try {
    return JSON.parse(item.extra) as Record<string, unknown>
  } catch {
    return {}
  }
}

// ── Pillar 2: Terminology & Lexicon (deterministic) ─────────

export function runTerminology(
  draftText: string,
  termItems: VaultItem[]
): Finding[] {
  const findings: Finding[] = []
  let n = 0

  for (const item of termItems) {
    const extra = vaultExtra(item)
    const match = String(extra.match ?? '').trim()
    if (!match) continue
    const aliases = Array.isArray(extra.aliases)
      ? (extra.aliases as string[]).map((a) => String(a).trim()).filter(Boolean)
      : []
    const kind = String(extra.kind ?? 'banned')
    const replaceWith = extra.replaceWith ? String(extra.replaceWith) : null
    const variants = [match, ...aliases].filter(Boolean)

    for (const variant of variants) {
      const esc = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re = new RegExp(`\\b${esc}\\b`, 'gi')
      let m: RegExpExecArray | null
      while ((m = re.exec(draftText)) !== null) {
        const matched = m[0]
        const isDeprecated = kind === 'deprecated'
        findings.push({
          key: `terminology-${n++}`,
          pillar: 'terminology',
          severity: isDeprecated ? 'critical' : 'warning',
          engine: 'deterministic',
          title: isDeprecated
            ? `Deprecated term: “${matched}”`
            : `Banned term: “${matched}”`,
          quote: matched,
          explanation: isDeprecated
            ? `“${matched}” is a deprecated name. The approved term is “${replaceWith}”.`
            : `“${matched}” is banned by the brand lexicon.${replaceWith ? ` Approved alternative: “${replaceWith}”.` : ''}`,
          clauseId: item.clauseId,
          clauseQuote: item.content,
          clauseTitle: item.title,
          // literal replacement only for exact-name swaps; banned words need
          // a context-aware rewrite, so no canned suggestion is offered
          suggestion: isDeprecated ? replaceWith : null,
          suggestionSource: isDeprecated ? 'deterministic' : null,
          meta: { matched, replaceWith, kind },
        })
        if (m.index === re.lastIndex) re.lastIndex++
      }
    }
  }

  return dedupeExactQuotes(findings)
}

function dedupeExactQuotes(findings: Finding[]): Finding[] {
  const seen = new Set<string>()
  const out: Finding[] = []
  for (const f of findings) {
    const k = `${f.pillar}:${f.quote.toLowerCase()}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push(f)
  }
  return out
}

// ── Pillar 3a: Claims deterministic figure scan ─────────────

const FIGURE_RE = /\$?\d[\d,]*(?:\.\d+)?(?:\s?(?:%|\+))?/g

function normalizeFigure(fig: string): string {
  return fig.replace(/[$,\s+]/g, '').toLowerCase()
}

function isYearLikeFigure(value: string): boolean {
  const digits = value.replace(/\D/g, '')
  if (!/^\d{4}$/.test(digits)) return false
  const year = Number(digits)
  return year >= 1900 && year <= 2099
}

export function runClaimsScan(
  draftText: string,
  vaultItems: VaultItem[]
): Finding[] {
  if (!draftText.trim()) return []
  const findings: Finding[] = []
  const factItems = vaultItems.filter((v) => v.type === 'FACT')
  const ruleItem = vaultItems.find((v) => v.clauseId === 'VL-RULE-001') ?? null

  // Universe of verified figures: every figure listed in a vault item's
  // extra, plus every number that literally appears in any clause content.
  const verified = new Set<string>()
  for (const item of vaultItems) {
    const extra = vaultExtra(item)
    const figs = Array.isArray(extra.figures) ? (extra.figures as string[]) : []
    for (const f of figs) verified.add(normalizeFigure(String(f)))
    const inContent = item.content.match(FIGURE_RE) ?? []
    for (const f of inContent) verified.add(normalizeFigure(f))
  }

  let m: RegExpExecArray | null
  FIGURE_RE.lastIndex = 0
  let n = 0
  while ((m = FIGURE_RE.exec(draftText)) !== null) {
    const raw = m[0]
    const norm = normalizeFigure(raw)
    const digitCount = norm.replace(/[^\d]/g, '').length
    const isMoneyOrPct = /[$%]/.test(raw)
    if (isYearLikeFigure(raw)) continue
    if (!isMoneyOrPct && digitCount < 2) continue
    if (verified.has(norm)) continue

    // "2.1 AA"-style standards versioning is not a commercial figure
    const after = draftText.slice(m.index + raw.length, m.index + raw.length + 4)
    if (/^\s?AA\b/.test(after)) continue

    const contextStart = Math.max(
      draftText.lastIndexOf('.', m.index),
      draftText.lastIndexOf('!', m.index),
      draftText.lastIndexOf('?', m.index)
    )
    const contextEndCandidates = [
      draftText.indexOf('.', m.index + raw.length),
      draftText.indexOf('!', m.index + raw.length),
      draftText.indexOf('?', m.index + raw.length),
    ].filter((index) => index !== -1)
    const contextEnd = contextEndCandidates.length
      ? Math.min(...contextEndCandidates)
      : draftText.length
    const context = draftText.slice(contextStart + 1, contextEnd).toLowerCase()
    const factHint =
      findFactByContext(raw, context, factItems) ??
      findConflictingFact(raw, factItems)
    const citedFact = factHint
      ? factItems.find((item) => item.clauseId === factHint.clauseId)
      : null
    const citation = citedFact ?? ruleItem
    findings.push({
      key: `claims-det-${n++}`,
      pillar: 'claims',
      severity: isMoneyOrPct ? 'critical' : 'warning',
      engine: 'deterministic',
      title: isMoneyOrPct
        ? `Unverified commercial figure: “${raw}”`
        : `Unverified figure: “${raw}”`,
      quote: raw,
      explanation: factHint
        ? `No approved fact supports “${raw}”. The Vault lists ${factHint.figures
            .map((f) => `“${f}”`)
            .join(', ')} under ${factHint.clauseId} — this figure conflicts with the approved value.`
        : `No approved fact in the Vault supports the figure “${raw}”. Every statistic must trace to a verified fact before publication.`,
      clauseId: citation?.clauseId ?? null,
      clauseQuote: citation?.content ?? null,
      clauseTitle: citation?.title ?? null,
      // literal figure swap only when an approved conflicting value exists
      suggestion: factHint && isMoneyOrPct && factHint.figures.length === 1
        ? factHint.figures[0]
        : null,
      suggestionSource: factHint && isMoneyOrPct && factHint.figures.length === 1
        ? 'deterministic'
        : null,
      meta: { figure: raw, conflictWith: factHint?.clauseId ?? null },
    })
    if (m.index === FIGURE_RE.lastIndex) FIGURE_RE.lastIndex++
  }

  return findings
}

function findConflictingFact(
  figure: string,
  factItems: VaultItem[]
): { clauseId: string; figures: string[] } | null {
  const normFigure = normalizeFigure(figure)
  const isMoney = /^\s*\$/.test(figure)
  const isPercent = /%/.test(figure)

  for (const item of factItems) {
    const extra = vaultExtra(item)
    const figs = Array.isArray(extra.figures) ? (extra.figures as string[]) : []
    const sameKind = figs.filter((f) => {
      const fact = String(f)
      const bothMoney = isMoney === /^\s*\$/.test(fact)
      const bothPct = isPercent === /%/.test(fact)
      return bothMoney && bothPct
    })
    if (sameKind.length === 0) continue
    const isPricing =
      /pric|cost|plan|\$/i.test(item.title + item.content) &&
      isMoney
    const isTrial =
      /trial/i.test(item.title + item.content) && /\d+day/.test(normFigure)
    if (isPricing || isTrial) {
      return { clauseId: item.clauseId, figures: sameKind }
    }

    // generic counts: only a conflict when magnitude is comparable
    if (!isMoney && !isPercent) {
      const v = parseInt(normFigure.replace(/\D/g, ''), 10)
      const f = parseInt(normalizeFigure(sameKind[0]).replace(/\D/g, ''), 10)
      if (!isNaN(v) && !isNaN(f) && Math.abs(v - f) <= Math.max(3, f * 2)) {
        return { clauseId: item.clauseId, figures: sameKind }
      }
    }
  }
  return null
}

function findFactByContext(
  figure: string,
  context: string,
  factItems: VaultItem[]
): { clauseId: string; figures: string[] } | null {
  const isMoney = /^\s*\$/.test(figure)
  const isPercent = /%/.test(figure)
  const relation = isMoney && /\b(price|pricing|plans?|costs?)\b/.test(context)
    ? /\b(price|pricing|plans?|costs?)\b|\$/i
    : /\bday(?:s)?\b/i.test(figure) && /\btrial\b/.test(context)
      ? /\btrial\b/i
      : isPercent && /\b(uptime|sla|availability)\b/.test(context)
        ? /\b(uptime|sla|availability)\b/i
        : /\bteams?|countries|customers?\b/.test(context)
          ? /\bteams?|countries|customers?\b/i
          : null

  if (!relation) return null
  const item = factItems.find((fact) => relation.test(`${fact.title} ${fact.content}`))
  if (!item) return null

  const extra = vaultExtra(item)
  const figures = Array.isArray(extra.figures)
    ? (extra.figures as string[]).filter((value) =>
        isMoney ? /^\s*\$/.test(value) : isPercent ? /%/.test(value) : !/[$%]/.test(value)
      )
    : []

  return figures.length ? { clauseId: item.clauseId, figures } : null
}

// ── Pillar 6: Confidentiality (local redaction sandbox) ─────

export interface ConfidentialityOutcome {
  findings: Finding[]
  redactedText: string
  hits: RedactionHit[]
}

export function runConfidentialityText(
  draftText: string,
  vaultItems: VaultItem[]
): ConfidentialityOutcome {
  const confidentialItems = vaultItems.filter((v) => v.type === 'CONFIDENTIAL')
  const confidentialTerms = confidentialItems
    .map((v) => {
      const extra = vaultExtra(v)
      const term = extra.term ? String(extra.term) : ''
      return { term, clauseId: v.clauseId, title: v.title }
    })
    .filter((t) => t.term.length >= 3)

  const { redacted, hits } = redact(draftText, confidentialTerms)
  const fallback = confidentialItems.find((v) => v.clauseId === 'VL-CONF-003')

  const findings: Finding[] = hits.map((hit, i) => {
    const isCodename = hit.kind === 'Project Codename'
    const clauseItem = hit.clauseId
      ? confidentialItems.find((v) => v.clauseId === hit.clauseId)
      : null
    const cited = clauseItem ?? fallback
    return {
      key: `conf-${i}`,
      pillar: 'confidentiality' as const,
      severity: isCodename ? 'critical' : 'warning',
      engine: 'deterministic' as const,
      title: isCodename
        ? `Confidential codename exposed: “${hit.value}”`
        : `Sensitive ${hit.kind.toLowerCase()} detected: “${hit.value}”`,
      quote: hit.value,
      explanation: isCodename
        ? 'This unreleased project codename was detected and masked locally before any external AI call. It must not appear in public copy.'
        : `This ${hit.kind.toLowerCase()} was detected and masked locally before any external AI call. Public copy must use approved contact channels instead.`,
      clauseId: cited?.clauseId ?? null,
      clauseQuote: cited?.content ?? null,
      clauseTitle: cited?.title ?? null,
      // secrets are never auto-replaced with canned text — the creator
      // must manually rewrite the sentence or override with justification
      suggestion: null,
      suggestionSource: null,
      meta: { redactedAs: hit.replacement, kind: hit.kind },
    }
  })

  return { findings, redactedText: redacted, hits }
}

/** Deterministic PII scan on VLM-extracted image text (image drafts). */
export function runConfidentialityImage(
  extractedTexts: string[],
  altText: string,
  vaultItems: VaultItem[]
): Finding[] {
  const blob = [...extractedTexts, altText].filter(Boolean).join('\n')
  if (!blob.trim()) return []

  const { hits } = redact(blob)
  const fallback = vaultItems.find((v) => v.clauseId === 'VL-CONF-003')
  let n = 0
  const findings: Finding[] = []
  for (const hit of hits) {
    findings.push({
      key: `conf-img-${n++}`,
      pillar: 'confidentiality',
      severity: 'warning',
      engine: 'deterministic',
      title: `Sensitive ${hit.kind.toLowerCase()} rendered in asset`,
      quote: altText.includes(hit.value) ? hit.value : '',
      explanation: `A ${hit.kind.toLowerCase()} (“${hit.value}”) appears inside this visual asset. Internal contact details and personal data must not ship in public creative.`,
      clauseId: fallback?.clauseId ?? null,
      clauseQuote: fallback?.content ?? null,
      clauseTitle: fallback?.title ?? null,
      suggestion: null,
      suggestionSource: null,
      meta: { value: hit.value },
    })
  }
  return findings
}
