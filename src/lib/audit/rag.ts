// ─────────────────────────────────────────────────────────────
// VeriLoom AI — Citation-Constrained RAG pillars
// Tone & Voice + Factual Claims. Every LLM flag MUST cite a
// real Vault clause with a verbatim quote; anything else is
// programmatically suppressed (zero-hallucination guarantee).
// ─────────────────────────────────────────────────────────────
import type { VaultItem } from '@prisma/client'
import type { Finding, Severity } from '../types'
import { chatJson, type LedgerEntry } from '../ai'
import { vaultExtra } from './deterministic'

export interface RagRawFinding {
  quote?: string
  clauseId?: string
  clauseQuote?: string
  severity?: string
  explanation?: string
  suggestion?: string
}

export interface RagOutcome {
  findings: Finding[]
  ledger: LedgerEntry[]
  suppressed: number
  parseError: boolean
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()

/**
 * Post-validator: the zero-hallucination gate.
 * A flag is SUPPRESSED if (1) its clauseId does not exist in the Vault
 * (hallucinated rule) or (2) its quote cannot be located in the draft
 * (hallucinated span). If the clauseQuote is not a verbatim substring of
 * the cited clause, it is auto-corrected to the authoritative Vault text
 * — the user always sees the grounded, true clause.
 */
export function validateCitations(
  raw: RagRawFinding[],
  vaultMap: Map<string, VaultItem>,
  draftText: string,
  pillar: 'tone' | 'claims',
  startIdx: number
): { findings: Finding[]; suppressed: number } {
  const findings: Finding[] = []
  let suppressed = 0
  let n = startIdx

  for (const r of raw) {
    const quote = (r.quote ?? '').trim()
    const clauseId = (r.clauseId ?? '').trim()
    const clauseQuote = (r.clauseQuote ?? '').trim()

    if (!quote || quote.length > 300 || !clauseId) {
      suppressed++
      continue
    }
    // quote must actually exist in the draft
    if (!norm(draftText).includes(norm(quote))) {
      suppressed++
      continue
    }
    const clause = vaultMap.get(clauseId)
    if (!clause) {
      // hallucinated rule reference — hard suppression
      suppressed++
      continue
    }

    const severity: Severity =
      r.severity === 'critical' || r.severity === 'warning' || r.severity === 'info'
        ? r.severity
        : 'warning'

    // grounding correction: display the authoritative clause text
    const groundedQuote =
      clauseQuote && norm(clause.content).indexOf(norm(clauseQuote)) !== -1
        ? clauseQuote
        : clause.content

    findings.push({
      key: `${pillar}-llm-${n++}`,
      pillar,
      severity,
      engine: pillar === 'tone' ? 'rag' : 'hybrid',
      title: buildTitle(pillar, severity, clause),
      quote,
      explanation: (r.explanation ?? '').trim() || 'Violates a brand rule.',
      clauseId: clause.clauseId,
      clauseQuote: groundedQuote,
      clauseTitle: clause.title,
      suggestion: (r.suggestion ?? '').trim() || null,
      suggestionSource: 'ai',
    })
  }

  return { findings, suppressed }
}

function buildTitle(
  pillar: 'tone' | 'claims',
  severity: Severity,
  clause: VaultItem
): string {
  if (pillar === 'tone') return `Voice violation — ${clause.title}`
  return severity === 'critical'
    ? `Unsupported claim — ${clause.title}`
    : `Claim risk — ${clause.title}`
}

function rulebook(items: VaultItem[]): string {
  return items
    .map((i) => `- [${i.clauseId}] ${i.title}: ${i.content}`)
    .join('\n')
}

// ── Pillar 1: Tone & Voice (citation-gated RAG) ─────────────

export async function runToneRag(
  redactedText: string,
  vaultItems: VaultItem[],
  channel: string
): Promise<RagOutcome> {
  const voiceRules = vaultItems.filter((v) => v.type === 'VOICE' && v.active)
  if (voiceRules.length === 0 || !redactedText.trim()) {
    return { findings: [], ledger: [], suppressed: 0, parseError: false }
  }

  const system =
    'You are the Tone & Voice auditor inside a brand-governance platform. ' +
    'You analyse marketing copy STRICTLY against the provided brand voice rules. ' +
    'You never invent rules. Every violation must cite the exact clause id and quote the rule verbatim. ' +
    'Respond with JSON only.'

  const user = `BRAND VOICE RULES (the only authoritative source — do not use any other rule):
${rulebook(voiceRules)}

DRAFT (target channel: ${channel}):
"""
${redactedText}
"""

Task: Find tone/voice violations ONLY against the rules above (style, address, fear tactics, exclamation restraint, British spelling, hype wording). Do NOT flag factual/numeric issues, terminology bans, or accessibility — other engines handle those.

Respond ONLY with this JSON shape:
{"findings":[{"quote":"<exact substring copied from the draft, max 200 chars>","clauseId":"<one of the ids above>","clauseQuote":"<verbatim substring copied from that rule's text>","severity":"critical"|"warning"|"info","explanation":"<1-2 sentences in plain language>","suggestion":"<LITERAL replacement text for the quoted span — a rewritten version of the span itself, NEVER an instruction like 'remove this'. It will replace the span verbatim inside its sentence, so it MUST fit grammatically (tense, agreement) with the surrounding words. Similar length, creator's voice>"}]}

If there are no violations, respond {"findings":[]}.`

  const res = await chatJson<{ findings: RagRawFinding[] }>(
    system,
    user,
    'Tone & Voice RAG audit (GLM-4.5, citation-constrained)'
  )

  const rawFindings = res.data?.findings
  if (!Array.isArray(rawFindings)) {
    return { findings: [], ledger: [res.ledger], suppressed: 0, parseError: true }
  }

  const vaultMap = new Map(voiceRules.map((v) => [v.clauseId, v]))
  const { findings, suppressed } = validateCitations(
    rawFindings,
    vaultMap,
    redactedText,
    'tone',
    0
  )
  return { findings, ledger: [res.ledger], suppressed, parseError: false }
}

// ── Pillar 3b: Claims verification (citation-gated RAG) ──────

export async function runClaimsRag(
  redactedText: string,
  vaultItems: VaultItem[],
  channel: string
): Promise<RagOutcome> {
  const facts = vaultItems.filter(
    (v) => (v.type === 'FACT' || v.clauseId === 'VL-RULE-001') && v.active
  )
  if (facts.length === 0 || !redactedText.trim()) {
    return { findings: [], ledger: [], suppressed: 0, parseError: false }
  }

  const system =
    'You are the Factual Claims auditor inside a brand-governance platform. ' +
    'You decompose marketing copy into atomic claims and verify each against the approved fact sheet. ' +
    'You never invent facts. Every flag must cite the exact clause id and quote the approved fact verbatim. ' +
    'Respond with JSON only.'

  const user = `APPROVED FACTS & RULES (the only authoritative source — do not use any world knowledge about companies):
${rulebook(facts)}

DRAFT (target channel: ${channel}):
"""
${redactedText}
"""

Task: Decompose the draft into atomic factual / promotional claims. Flag ONLY claims that:
(a) directly CONTRADICT an approved fact (e.g. wrong price, wrong number, wrong trial length) — severity "critical";
(b) contain figures or statistics that cannot be traced to any approved fact — severity "warning";
(c) make exaggerated comparative or superlative claims ("the best", "#1", "fastest") unsupported by the facts — severity "warning".
Do NOT flag tone, wording style, or terminology — other engines handle those.

Respond ONLY with this JSON shape:
{"findings":[{"quote":"<exact substring copied from the draft, max 200 chars>","clauseId":"<the contradicted/related fact id, or VL-RULE-001 for untraceable figures>","clauseQuote":"<verbatim substring copied from that clause's text>","severity":"critical"|"warning"|"info","explanation":"<1-2 sentences, state the approved value>","suggestion":"<LITERAL replacement text for the quoted span using the approved value — e.g. if the draft says '$39/user/month' and the fact says $29, the suggestion is '$29/user/month'. NEVER write an instruction; rewrite the span itself so it fits grammatically in the sentence>"}]}

If nothing is wrong, respond {"findings":[]}.`

  const res = await chatJson<{ findings: RagRawFinding[] }>(
    system,
    user,
    'Atomic-claim RAG verification (GLM-4.5, citation-constrained)'
  )

  const rawFindings = res.data?.findings
  if (!Array.isArray(rawFindings)) {
    return { findings: [], ledger: [res.ledger], suppressed: 0, parseError: true }
  }

  const vaultMap = new Map(facts.map((v) => [v.clauseId, v]))
  const { findings, suppressed } = validateCitations(
    rawFindings,
    vaultMap,
    redactedText,
    'claims',
    0
  )
  return { findings, ledger: [res.ledger], suppressed, parseError: false }
}

// ── Intent signature extraction (deterministic) ──────────────

export interface IntentSignature {
  ctaVerbs: string[]
  exclamations: number
  isQuestion: boolean
  wordCount: number
  register: 'urgent' | 'warm' | 'neutral'
}

const CTA_VERBS = [
  'join', 'act', 'start', 'try', 'discover', 'email', 'contact', 'get', 'see',
  'learn', 'book', 'download', 'sign', 'subscribe', 'claim', 'unlock', 'meet',
  'read', 'watch', 'explore', 'grab', 'register',
]

export function extractIntent(span: string): IntentSignature {
  const lower = span.toLowerCase()
  const ctaVerbs = CTA_VERBS.filter((v) =>
    new RegExp(`\\b${v}\\b`).test(lower)
  )
  const exclamations = (span.match(/!/g) ?? []).length
  const isQuestion = span.includes('?')
  const wordCount = span.split(/\s+/).filter(Boolean).length
  const urgent = /now|today|hurry|limited|last chance|don't miss|before/i.test(span)
  const warm = /thank|love|welcome|delighted|excited|community|together/i.test(span)
  return {
    ctaVerbs,
    exclamations,
    isQuestion,
    wordCount,
    register: urgent ? 'urgent' : warm ? 'warm' : 'neutral',
  }
}

// ── Intent-preserving minimal rewrite ────────────────────────

export async function intentPreservingRewrite(
  originalSpan: string,
  paragraph: string,
  clause: { clauseId: string; title: string; content: string },
  channel: string
): Promise<{ rewrite: string | null; intentNotes: string | null; ledger: LedgerEntry }> {
  const intent = extractIntent(originalSpan)
  const system =
    'You are the Intent-Preserving Co-Pilot of a brand-governance platform. ' +
    'You produce the MINIMAL edit that resolves a brand-rule violation while preserving the creator\u2019s communicative intent: the same call-to-action verbs, emotional register, sentence rhythm and length. ' +
    'You change ONLY the part that violates the rule. Never add new claims, never add facts that are not in the rule. Respond with JSON only.'

  const user = `VIOLATED RULE [${clause.clauseId}] ${clause.title}: ${clause.content}

ORIGINAL SPAN (must be rewritten):
"""
${originalSpan}
"""

SURROUNDING PARAGRAPH (context only — do not rewrite it):
"""
${paragraph}
"""

DETERMINISTIC INTENT SIGNATURE (must be preserved):
${JSON.stringify(intent)}

Target channel: ${channel}.

Respond ONLY with:
{"rewrite":"<the rewritten span, similar length and rhythm>","intentNotes":"<one sentence on how the intent was preserved>"}`

  const res = await chatJson<{ rewrite: string; intentNotes: string }>(
    system,
    user,
    'Intent-preserving minimal-edit rewrite (GLM-4.5)'
  )
  return {
    rewrite: res.data?.rewrite?.trim() || null,
    intentNotes: res.data?.intentNotes?.trim() || null,
    ledger: res.ledger,
  }
}

// ── Guideline ambiguity phrasing suggestion ──────────────────

export async function suggestClauseRewrite(
  clause: { clauseId: string; title: string; content: string },
  stats: { violations: number; overrides: number; overrideReasons: string[] }
): Promise<{ suggestedClause: string | null; rationale: string | null; ledger: LedgerEntry }> {
  const system =
    'You are the Guideline Ambiguity Detector of a brand-governance platform. ' +
    'When creators repeatedly violate a rule or reviewers repeatedly override it, the rule itself is probably unclear. ' +
    'Propose a sharper, more concrete phrasing of the guideline. Respond with JSON only.'

  const user = `CURRENT CLAUSE [${clause.clauseId}] ${clause.title}:
"""
${clause.content}
"""

OBSERVED SIGNALS:
- Times flagged in audits: ${stats.violations}
- Times a human reviewer overrode the flag: ${stats.overrides}
- Override justifications: ${stats.overrideReasons.slice(0, 5).map((r) => `"${r}"`).join('; ') || '(none recorded)'}

Respond ONLY with:
{"suggestedClause":"<clearer, more actionable phrasing of the rule, similar length>","rationale":"<1-2 sentences: what was ambiguous and how the rewrite fixes it>"}`

  const res = await chatJson<{ suggestedClause: string; rationale: string }>(
    system,
    user,
    'Guideline blind-spot phrasing suggestion (GLM-4.5)'
  )
  return {
    suggestedClause: res.data?.suggestedClause?.trim() || null,
    rationale: res.data?.rationale?.trim() || null,
    ledger: res.ledger,
  }
}

// re-export for engine use
export { vaultExtra }
