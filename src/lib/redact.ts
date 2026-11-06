// ─────────────────────────────────────────────────────────────
// VeriLoom AI — Local Confidentiality Redaction Sandbox
// Regex-based PII / secret / codename scrubbing executed BEFORE
// any external AI call. Nothing leaves the perimeter unmasked.
// ─────────────────────────────────────────────────────────────

export interface RedactionHit {
  kind: string // e.g. "Email", "Phone", "Codename"
  value: string // the sensitive token found
  replacement: string
  clauseId: string | null // cited confidential clause, if any
}

export interface RedactionResult {
  redacted: string
  hits: RedactionHit[]
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
const PHONE_RE =
  /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}(?:[\s.-]?\d{2,4})?/g
const CARD_RE = /\b(?:\d[ -]?){13,16}\b/g
const APIKEY_RE = /\b(?:sk|pk|api)[-_][a-zA-Z0-9]{16,}\b/gi
const URL_TOKEN_RE = /[?&](?:token|key|api_key|apikey|secret)=[^&\s]+/gi

function mask(value: string): string {
  const v = value.trim()
  if (v.length <= 4) return '████'
  return `${v.slice(0, 2)}${'█'.repeat(Math.min(v.length - 4, 12))}${v.slice(-2)}`
}

/**
 * Scrub PII + vault-marked confidential tokens from `text`.
 * `confidentialTerms` come from CONFIDENTIAL vault items
 * (e.g. unreleased project codenames) — { term, clauseId }.
 */
export function redact(
  text: string,
  confidentialTerms: { term: string; clauseId: string; title?: string }[] = []
): RedactionResult {
  const hits: RedactionHit[] = []
  let out = text

  const apply = (re: RegExp, kind: string, clauseId: string | null = null) => {
    out = out.replace(re, (value) => {
      const replacement = mask(value)
      hits.push({ kind, value, replacement, clauseId })
      return replacement
    })
  }

  // Vault codenames first (word-boundary, case-insensitive)
  for (const { term, clauseId } of confidentialTerms) {
    const t = term.trim()
    if (t.length < 3) continue
    const esc = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`\\b${esc}\\b`, 'gi')
    apply(re, 'Project Codename', clauseId)
  }

  apply(APIKEY_RE, 'API Key')
  apply(EMAIL_RE, 'Email')
  apply(CARD_RE, 'Card Number')
  apply(URL_TOKEN_RE, 'URL Secret')
  apply(PHONE_RE, 'Phone')

  return { redacted: out, hits }
}
