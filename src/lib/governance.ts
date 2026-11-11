// ─────────────────────────────────────────────────────────────
// VeriLoom AI — Audit-to-Draft governance matching
// Distinguishes the active governing audit of a draft's current
// version (including pre-remediation audits that produced vN)
// from historical "what-if" re-audits run against past versions.
// ─────────────────────────────────────────────────────────────

export interface AuditCandidate {
  id: string
  version: number
  createdAt: Date | string
}

export interface VersionCandidate {
  version: number
  note: string | null
  createdAt: Date | string
}

function toMs(d: Date | string): number {
  return d instanceof Date ? d.getTime() : new Date(d).getTime()
}

/**
 * Select the AuditRun that governs the current state of `draft`:
 * 1. If a sealed `certifiedAuditId` is supplied (for APPROVED drafts), prefer it.
 * 2. Else look for the latest audit run directly on `draft.version`.
 * 3. Else, if `draft.version >= 2` and the current DraftVersion row was produced
 *    by remediation (note starts with "Remediated"), pick the newest pre-remediation
 *    audit of `draft.version - 1` created before/at that DraftVersion timestamp —
 *    so later historical "what-if" re-audits of v1 never hijack v2 approval or certs.
 */
export function selectGoverningAudit<T extends AuditCandidate>(
  draft: { version: number; status: string },
  auditsNewestFirst: readonly T[],
  versions: readonly VersionCandidate[],
  certifiedAuditId?: string | null
): T | null {
  if (auditsNewestFirst.length === 0) return null

  if (certifiedAuditId) {
    const exact = auditsNewestFirst.find((a) => a.id === certifiedAuditId)
    if (exact) return exact
  }

  const direct = auditsNewestFirst.find((a) => a.version === draft.version)
  if (direct) return direct

  if (draft.version >= 2) {
    const currentVer = versions.find((v) => v.version === draft.version)
    const isRemediatedVer = Boolean(currentVer?.note?.startsWith('Remediated'))
    if (isRemediatedVer && currentVer) {
      const cutoff = toMs(currentVer.createdAt)
      const preRemAudit = auditsNewestFirst.find(
        (a) => a.version === draft.version - 1 && toMs(a.createdAt) <= cutoff
      )
      if (preRemAudit) return preRemAudit
    }
  }

  return null
}

/**
 * For Dashboard / Workspace hydration: returns the governing audit if one exists,
 * else falls back to the newest recorded audit run so non-approved historical stats
 * still surface prior work.
 */
export function selectWorkspaceAudit<T extends AuditCandidate>(
  draft: { version: number; status: string },
  auditsNewestFirst: readonly T[],
  versions: readonly VersionCandidate[],
  certifiedAuditId?: string | null
): T | null {
  return (
    selectGoverningAudit(draft, auditsNewestFirst, versions, certifiedAuditId) ??
    auditsNewestFirst[0] ??
    null
  )
}

