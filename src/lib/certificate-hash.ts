// ─────────────────────────────────────────────────────────────
// VeriLoom AI — Canonical tamper-evident certificate hashing
// Shared between the API route (Node crypto) and browser WebCrypto
// verification inspector.
// ─────────────────────────────────────────────────────────────
import type { VaultRuleRef } from './vault-lineage'

export interface CanonicalCertificateInput {
  draft: {
    id: string
    title: string
    version: number
    channel: string
  }
  audit: {
    id: string
    score: number
    findings: {
      key: string
      pillar: string
      severity: string
      clauseId: string | null
    }[]
    suppressed: number
    vaultSnapshot: VaultRuleRef[]
  }
  overrides: {
    key: string
    note: string | null
    actor: string
  }[]
  models: string[]
}

/**
 * Deterministic canonical JSON payload over every governance-critical
 * field on an Approval Certificate. Field ordering matches the server's
 * sealed SHA-256 computation verbatim so client & server digests match bit-for-bit.
 */
export function buildCertificateCanonicalJson(input: CanonicalCertificateInput): string {
  return JSON.stringify({
    draft: {
      id: input.draft.id,
      title: input.draft.title,
      version: input.draft.version,
      channel: input.draft.channel,
    },
    audit: {
      id: input.audit.id,
      score: input.audit.score,
      findings: input.audit.findings.map((f) => ({
        key: f.key,
        pillar: f.pillar,
        severity: f.severity,
        clauseId: f.clauseId,
      })),
      suppressed: input.audit.suppressed,
      vaultSnapshot: input.audit.vaultSnapshot,
    },
    overrides: input.overrides.map((o) => ({
      key: o.key,
      note: o.note,
      actor: o.actor,
    })),
    models: input.models,
  })
}

export async function sha256HexWebCrypto(text: string): Promise<string> {
  if (typeof globalThis.crypto?.subtle === 'undefined') {
    throw new Error('WebCrypto SHA-256 is unavailable in this environment.')
  }
  const bytes = new TextEncoder().encode(text)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

