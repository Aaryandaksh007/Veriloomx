// ─────────────────────────────────────────────────────────────
// VeriLoom AI — Live instant brand scan (client-side)
// A deterministic, zero-latency pre-flight check that runs in the
// browser as the creator types: banned terms, deprecated names,
// confidential leaks, unverified figures and tone risks — all
// matched against the same Living Brand Vault the server engine
// uses. This is the "feels alive" layer; the full 6-pillar audit
// (with citation-gated RAG + vision math) runs on demand.
// ─────────────────────────────────────────────────────────────
import type { VaultItemDTO } from './types'
import { redact } from './redact'

export type LiveHitKind = 'banned' | 'deprecated' | 'confidential' | 'figure' | 'tone'

export interface LiveHit {
  key: string
  kind: LiveHitKind
  value: string
  start: number
  end: number
  clauseId: string | null
  clauseTitle: string | null
  suggestion: string | null
}

export interface LiveScanResult {
  hits: LiveHit[]
  counts: Record<LiveHitKind, number>
  total: number
  redacted: string
  masked: number
}

export const LIVE_KIND_META: Record<
  LiveHitKind,
  { label: string; plural: string; markBg: string; markText: string; dot: string; text: string; border: string }
> = {
  banned: {
    label: 'Banned term',
    plural: 'banned terms',
    markBg: 'bg-rose-200/80',
    markText: 'text-rose-950',
    dot: 'bg-rose-500',
    text: 'text-rose-700',
    border: 'border-rose-200',
  },
  deprecated: {
    label: 'Deprecated name',
    plural: 'deprecated names',
    markBg: 'bg-rose-100',
    markText: 'text-rose-900',
    dot: 'bg-rose-400',
    text: 'text-rose-600',
    border: 'border-rose-100',
  },
  confidential: {
    label: 'Confidential leak',
    plural: 'confidential leaks',
    markBg: 'bg-amber-200/80',
    markText: 'text-amber-950',
    dot: 'bg-amber-500',
    text: 'text-amber-700',
    border: 'border-amber-200',
  },
  figure: {
    label: 'Unverified figure',
    plural: 'unverified figures',
    markBg: 'bg-orange-200/80',
    markText: 'text-orange-950',
    dot: 'bg-orange-500',
    text: 'text-orange-700',
    border: 'border-orange-200',
  },
  tone: {
    label: 'Tone risk',
    plural: 'tone risks',
    markBg: 'bg-violet-200/80',
    markText: 'text-violet-950',
    dot: 'bg-violet-500',
    text: 'text-violet-700',
    border: 'border-violet-200',
  },
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** normalise a figure so "$29", "29" and "29." all compare equal */
const normFigure = (s: string) => s.toLowerCase().replace(/[^a-z0-9.]/g, '')

const UK_SPELLING: Record<string, string> = {
  color: 'colour',
  colors: 'colours',
  organize: 'organise',
  organized: 'organised',
  optimize: 'optimise',
  optimized: 'optimised',
  personalize: 'personalise',
  personalized: 'personalised',
  center: 'centre',
  centered: 'centred',
}

/** Deterministic tone probes derived from the Inkloom voice clauses. */
const TONE_PROBES: { re: RegExp; clauseId: string; title: string; suggestion: string | null }[] = [
  {
    re: /act now or lose out|before your competitors leave you behind/gi,
    clauseId: 'VL-VOICE-003',
    title: 'No fear-based marketing',
    suggestion: 'State the honest deadline instead',
  },
  {
    re: /valued customers?|dear users|esteemed clients?/gi,
    clauseId: 'VL-VOICE-002',
    title: 'Address the reader directly',
    suggestion: 'Address the reader as “you”',
  },
  {
    re: /!{2,}/g,
    clauseId: 'VL-VOICE-004',
    title: 'Exclamation restraint',
    suggestion: 'Use at most one exclamation mark per paragraph',
  },
]

/**
 * Scan `text` against the vault instantly. Pure & synchronous —
 * safe to run on every keystroke.
 */
export function liveScan(text: string, vault: VaultItemDTO[]): LiveScanResult {
  const hits: LiveHit[] = []
  let n = 0
  const items = vault.filter((v) => v.active)

  const add = (
    kind: LiveHitKind,
    value: string,
    start: number,
    end: number,
    clauseId: string | null,
    clauseTitle: string | null,
    suggestion: string | null
  ) => {
    hits.push({ key: `live-${kind}-${n++}`, kind, value, start, end, clauseId, clauseTitle, suggestion })
  }

  const matchAll = (re: RegExp, cb: (m: RegExpExecArray) => void) => {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      cb(m)
      if (m.index === re.lastIndex) re.lastIndex++ // zero-width guard
    }
  }

  // ── 1. Terminology: banned & deprecated (TERM clauses) ────
  for (const item of items) {
    if (item.type !== 'TERM') continue
    const extra = (item.extra ?? {}) as Record<string, unknown>
    const kind: LiveHitKind | null =
      extra.kind === 'banned' ? 'banned' : extra.kind === 'deprecated' ? 'deprecated' : null
    if (!kind) continue
    const patterns = [extra.match, ...(Array.isArray(extra.aliases) ? extra.aliases : [])].filter(
      (p): p is string => typeof p === 'string' && p.length > 1
    )
    const replaceWith = typeof extra.replaceWith === 'string' ? extra.replaceWith : null
    for (const p of patterns) {
      matchAll(new RegExp(`\\b${escapeRe(p)}\\b`, 'gi'), (m) =>
        add(kind, m[0], m.index, m.index + m[0].length, item.clauseId, item.title, replaceWith)
      )
    }
  }

  // ── 2. Confidentiality: vault codenames + internal PII ────
  for (const item of items) {
    if (item.type !== 'CONFIDENTIAL') continue
    const extra = (item.extra ?? {}) as Record<string, unknown>
    const term = typeof extra.term === 'string' ? extra.term : null
    if (term && term.length > 2) {
      matchAll(new RegExp(`\\b${escapeRe(term)}\\b`, 'gi'), (m) =>
        add('confidential', m[0], m.index, m.index + m[0].length, item.clauseId, item.title, 'Remove before publication')
      )
    }
  }
  // internal email addresses + phone numbers (VL-CONF-003)
  const internalComms = items.find((i) => i.clauseId === 'VL-CONF-003') ?? null
  matchAll(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]*inkloom-internal[a-zA-Z0-9.-]*\.[a-zA-Z]{2,}/g, (m) =>
    add(
      'confidential',
      m[0],
      m.index,
      m.index + m[0].length,
      internalComms?.clauseId ?? 'VL-CONF-003',
      internalComms?.title ?? 'Internal-only contacts',
      'Use the public hello@inkloom.ai address'
    )
  )
  matchAll(/\+?\d[\d\s-]{7,}\d/g, (m) => {
    if (m[0].replace(/\D/g, '').length < 8) return // avoid version numbers etc.
    add(
      'confidential',
      m[0],
      m.index,
      m.index + m[0].length,
      internalComms?.clauseId ?? 'VL-CONF-003',
      internalComms?.title ?? 'Internal-only contacts',
      'Phone numbers must not appear in public copy'
    )
  })

  // ── 3. Claims: figures not traceable to a FACT clause ─────
  const approved = new Set<string>()
  for (const item of items) {
    if (item.type !== 'FACT') continue
    const figs = (item.extra ?? {}).figures
    if (!Array.isArray(figs)) continue
    for (const f of figs) {
      if (typeof f !== 'string') continue
      const norm = normFigure(f)
      approved.add(norm)
      approved.add(`${norm}s`) // "14-day" ↔ "14 days"
    }
  }
  const figureRule =
    items.find((i) => i.clauseId === 'VL-RULE-001') ??
    items.find((i) => i.type === 'RULE' && /figure/i.test(i.title)) ??
    null
  const FIGURE_RES = [
    /\$\d[\d,]*(?:\.\d+)?/g, // $39, $1,499.99
    /\b\d+(?:\.\d+)?\s?%/g, // 99.9%, 30 %
    /\b\d{1,3}(?:,\d{3})+\+?/g, // 12,000+, 15,000
    /\b\d+[-\s\u00A0]?days?\b/gi, // 14-day, 30 days
  ]
  for (const re of FIGURE_RES) {
    matchAll(re, (m) => {
      const cand = normFigure(m[0])
      if (approved.has(cand)) return
      add(
        'figure',
        m[0],
        m.index,
        m.index + m[0].length,
        figureRule?.clauseId ?? 'VL-RULE-001',
        figureRule?.title ?? 'Every figure must be verifiable',
        'Verify against an approved Vault fact or remove'
      )
    })
  }

  // ── 4. Tone: deterministic probes ─────────────────────────
  for (const probe of TONE_PROBES) {
    matchAll(probe.re, (m) =>
      add('tone', m[0], m.index, m.index + m[0].length, probe.clauseId, probe.title, probe.suggestion)
    )
  }
  // British English (VL-VOICE-005)
  const uk = items.find((i) => i.clauseId === 'VL-VOICE-005') ?? null
  matchAll(/\b(color|colors|organize|organized|optimize|optimized|personalize|personalized|center|centered)\b/gi, (m) =>
    add(
      'tone',
      m[0],
      m.index,
      m.index + m[0].length,
      uk?.clauseId ?? 'VL-VOICE-005',
      uk?.title ?? 'British English spelling',
      UK_SPELLING[m[0].toLowerCase()] ?? null
    )
  )

  // ── de-overlap & sort ─────────────────────────────────────
  hits.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start))
  const clean: LiveHit[] = []
  let pos = 0
  for (const h of hits) {
    if (h.start < pos) continue
    clean.push(h)
    pos = h.end
  }

  const counts: Record<LiveHitKind, number> = {
    banned: 0,
    deprecated: 0,
    confidential: 0,
    figure: 0,
    tone: 0,
  }
  for (const h of clean) counts[h.kind]++

  // ── redaction sandbox preview ─────────────────────────────
  const confTerms = items
    .filter((i) => i.type === 'CONFIDENTIAL' && typeof (i.extra ?? {}).term === 'string')
    .map((i) => ({ term: String((i.extra as Record<string, unknown>).term), clauseId: i.clauseId }))
  const red = redact(text, confTerms)

  return {
    hits: clean,
    counts,
    total: clean.length,
    redacted: red.redacted,
    masked: red.hits.length,
  }
}

/** Build non-overlapping display segments for the highlight overlay. */
export function buildSegments(
  text: string,
  hits: LiveHit[]
): { text: string; hit: LiveHit | null }[] {
  const sorted = [...hits].sort((a, b) => a.start - b.start)
  const segs: { text: string; hit: LiveHit | null }[] = []
  let pos = 0
  for (const h of sorted) {
    if (h.start < pos) continue
    if (h.start > pos) segs.push({ text: text.slice(pos, h.start), hit: null })
    segs.push({ text: text.slice(h.start, h.end), hit: h })
    pos = h.end
  }
  if (pos < text.length) segs.push({ text: text.slice(pos), hit: null })
  return segs
}
