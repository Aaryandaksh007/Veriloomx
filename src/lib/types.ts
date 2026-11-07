// ─────────────────────────────────────────────────────────────
// VeriLoom AI — shared domain types
// ─────────────────────────────────────────────────────────────

export type Pillar =
  | 'tone'
  | 'terminology'
  | 'claims'
  | 'visual'
  | 'accessibility'
  | 'confidentiality'

export const PILLAR_META: Record<
  Pillar,
  { label: string; short: string; engine: EngineKind; desc: string }
> = {
  tone: {
    label: 'Tone & Voice',
    short: 'Tone',
    engine: 'rag',
    desc: 'Voice-rule compliance via citation-grounded RAG',
  },
  terminology: {
    label: 'Terminology & Lexicon',
    short: 'Terminology',
    engine: 'deterministic',
    desc: 'Exact lexical matching against the approved glossary',
  },
  claims: {
    label: 'Messaging & Factual Claims',
    short: 'Claims',
    engine: 'hybrid',
    desc: 'Deterministic figure scan + citation-gated RAG verification',
  },
  visual: {
    label: 'Visual Palette & Assets',
    short: 'Visual',
    engine: 'deterministic',
    desc: 'CIELAB ΔE2000 perceptual colour-distance math',
  },
  accessibility: {
    label: 'Accessibility (WCAG 2.1)',
    short: 'Accessibility',
    engine: 'hybrid',
    desc: 'VLM-sampled regions + exact relative-luminance math',
  },
  confidentiality: {
    label: 'Confidentiality & AI Disclosure',
    short: 'Confidentiality',
    engine: 'deterministic',
    desc: 'Local PII / codename scrubbing before any AI call',
  },
}

export type EngineKind = 'deterministic' | 'rag' | 'hybrid' | 'vlm'

export const ENGINE_META: Record<EngineKind, { label: string; desc: string }> = {
  deterministic: {
    label: 'Deterministic',
    desc: 'Exact mathematics & lexical algorithms — never guessed by an LLM',
  },
  rag: {
    label: 'RAG · Citation-Gated',
    desc: 'LLM reasoning where every flag must cite a real Vault clause',
  },
  hybrid: {
    label: 'Hybrid Neuro-Symbolic',
    desc: 'Deterministic math + citation-gated semantic reasoning',
  },
  vlm: {
    label: 'VLM-Assisted',
    desc: 'Vision model sampling, validated by deterministic math',
  },
}

export type Severity = 'critical' | 'warning' | 'info' | 'pass'

export interface Finding {
  key: string // stable key within an audit, e.g. "term-3"
  pillar: Pillar
  severity: Severity
  engine: EngineKind
  title: string
  quote: string // exact span from the draft ("" for image-level findings)
  explanation: string // plain-language compliance risk
  clauseId: string | null // cited Vault clause
  clauseQuote: string | null // verbatim quote from that clause
  clauseTitle: string | null
  suggestion: string | null // suggested fix (deterministic or AI-generated)
  suggestionSource: 'deterministic' | 'ai' | null
  box?: { x: number; y: number; w: number; h: number } // % coords on image
  meta?: Record<string, unknown> // engine payload (ΔE values, contrast ratios…)
}

export interface PillarSummary {
  pillar: Pillar
  engine: EngineKind
  status: 'pass' | 'warn' | 'fail' | 'skipped'
  critical: number
  warning: number
  info: number
  durationMs: number
  detail: string
}

export interface AuditResult {
  id: string
  draftId: string
  version: number
  score: number
  findings: Finding[]
  pillars: PillarSummary[]
  suppressed: number
  redactedPreview: string | null
  aiLedger: AiLedgerEntry[]
  createdAt: string
}

export interface AiLedgerEntry {
  model: string
  purpose: string
  ts: string
}

export type DraftStatus =
  | 'DRAFT'
  | 'AUDITED'
  | 'REMEDIATED'
  | 'IN_REVIEW'
  | 'CHANGES_REQUESTED'
  | 'APPROVED'

export const STATUS_META: Record<
  DraftStatus,
  { label: string; desc: string; tone: string }
> = {
  DRAFT: { label: 'Draft', desc: 'Awaiting audit', tone: 'bg-stone-100 text-stone-600 border-stone-300' },
  AUDITED: { label: 'Audited', desc: '6-pillar audit complete — remediation pending', tone: 'bg-ochre-50 text-ochre-700 border-ochre-200' },
  REMEDIATED: { label: 'Remediated', desc: 'Fixes applied — ready for review', tone: 'bg-terra-50 text-terra-700 border-terra-200' },
  IN_REVIEW: { label: 'In Review', desc: 'With Manager & Authorised Reviewer', tone: 'bg-stone-100 text-stone-700 border-stone-300' },
  CHANGES_REQUESTED: { label: 'Changes Requested', desc: 'Returned to creator by Manager', tone: 'bg-clay-50 text-clay-700 border-clay-200' },
  APPROVED: { label: 'Approved', desc: 'Signed off — certificate issued', tone: 'bg-olive-50 text-olive-700 border-olive-200' },
}

export type Role = 'creator' | 'manager' | 'reviewer'

export const ROLE_META: Record<
  Role,
  { label: string; person: string; desc: string }
> = {
  creator: { label: 'Creator', person: 'Maya Chen', desc: 'Drafts & remediation' },
  manager: { label: 'Brand Manager', person: 'Dev Kapoor', desc: 'Pre-screening & changes' },
  reviewer: { label: 'Authorised Reviewer', person: 'Aaryan Sharma', desc: 'Final sign-off & certificate' },
}

export interface VaultItemDTO {
  id: string
  clauseId: string
  type: 'VOICE' | 'FACT' | 'TERM' | 'COLOR' | 'LOGO' | 'CONFIDENTIAL' | 'RULE'
  title: string
  content: string
  extra: Record<string, unknown> | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface ImageMeta {
  palette: { hex: string; ratio: number }[]
  altText: string
  width: number
  height: number
  fileName: string
}

export interface DraftDTO {
  id: string
  title: string
  channel: string
  kind: 'text' | 'image'
  status: DraftStatus
  creator: string
  content: string
  imageData: string | null
  imageMeta: ImageMeta | null
  version: number
  createdAt: string
  updatedAt: string
}

export interface FindingActionDTO {
  id: string
  findingKey: string
  action: 'accepted' | 'overridden' | 'edited'
  actor: string
  actorRole: string
  note: string | null
  appliedText: string | null
  createdAt: string
}

export interface CommentDTO {
  id: string
  author: string
  role: string
  body: string
  resolved: boolean
  createdAt: string
}

export interface DraftVersionDTO {
  id: string
  version: number
  content: string
  note: string | null
  createdAt: string
}

export interface CertificateData {
  draft: DraftDTO
  audit: AuditResult
  overrides: (FindingActionDTO & { finding: Finding | null })[]
  hash: string
  issuedAt: string
  certificateId: string
}
