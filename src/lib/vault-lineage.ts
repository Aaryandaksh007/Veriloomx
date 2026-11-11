// ─────────────────────────────────────────────────────────────
// VeriLoom AI — Vault rule lineage & audit-to-audit impact diff
// ─────────────────────────────────────────────────────────────
import type { AuditResult, Finding, VaultItemDTO } from './types'

export interface VaultRuleRef {
  clauseId: string
  ruleVer: number
}

export interface VaultSnapshotDiff {
  updated: { clauseId: string; title: string; auditedVer: number; liveVer: number; active: boolean }[]
  added: { clauseId: string; title: string; liveVer: number }[]
  removed: { clauseId: string; auditedVer: number }[]
  staleCount: number
  isStale: boolean
}

export function diffVaultSnapshot(
  snapshot: readonly VaultRuleRef[] | null | undefined,
  vault: readonly Pick<VaultItemDTO, 'clauseId' | 'title' | 'ruleVer' | 'active'>[]
): VaultSnapshotDiff {
  const snap = Array.isArray(snapshot) ? snapshot : []
  if (snap.length === 0 || vault.length === 0) {
    return { updated: [], added: [], removed: [], staleCount: 0, isStale: false }
  }

  const snapMap = new Map(snap.map((s) => [s.clauseId, s.ruleVer]))
  const vaultMap = new Map(vault.map((v) => [v.clauseId, v]))

  const updated: VaultSnapshotDiff['updated'] = []
  const removed: VaultSnapshotDiff['removed'] = []
  const added: VaultSnapshotDiff['added'] = []

  for (const [clauseId, auditedVer] of snapMap) {
    const live = vaultMap.get(clauseId)
    if (!live || !live.active) {
      removed.push({ clauseId, auditedVer })
    } else if (live.ruleVer !== auditedVer) {
      updated.push({
        clauseId,
        title: live.title,
        auditedVer,
        liveVer: live.ruleVer,
        active: live.active,
      })
    }
  }

  for (const live of vault) {
    if (live.active && !snapMap.has(live.clauseId)) {
      added.push({ clauseId: live.clauseId, title: live.title, liveVer: live.ruleVer })
    }
  }

  const staleCount = updated.length + added.length + removed.length
  return { updated, added, removed, staleCount, isStale: staleCount > 0 }
}

export interface AuditComparison {
  scoreDelta: number
  addedFindings: Finding[]
  resolvedFindings: Finding[]
  ruleChanges: { clauseId: string; fromVer: number | null; toVer: number | null; removed?: boolean }[]
}

function findingSignature(f: Finding): string {
  const clause = f.clauseId ?? 'none'
  const quote = (f.quote || f.title).trim().toLowerCase().replace(/\s+/g, ' ')
  return `${f.pillar}::${clause}::${quote}`
}

export function compareAudits(baseline: AuditResult, current: AuditResult): AuditComparison {
  const baseBySig = new Map<string, Finding>()
  for (const f of baseline.findings) {
    baseBySig.set(findingSignature(f), f)
  }
  const currBySig = new Map<string, Finding>()
  for (const f of current.findings) {
    currBySig.set(findingSignature(f), f)
  }

  const addedFindings = current.findings.filter((f) => !baseBySig.has(findingSignature(f)))
  const resolvedFindings = baseline.findings.filter((f) => !currBySig.has(findingSignature(f)))

  const baseRules = new Map((baseline.vaultSnapshot ?? []).map((r) => [r.clauseId, r.ruleVer]))
  const currRules = new Map((current.vaultSnapshot ?? []).map((r) => [r.clauseId, r.ruleVer]))
  const ruleChanges: AuditComparison['ruleChanges'] = []

  for (const [clauseId, toVer] of currRules) {
    const fromVer = baseRules.get(clauseId) ?? null
    if (fromVer !== toVer) {
      ruleChanges.push({ clauseId, fromVer, toVer })
    }
  }
  for (const [clauseId, fromVer] of baseRules) {
    if (!currRules.has(clauseId)) {
      ruleChanges.push({ clauseId, fromVer, toVer: null, removed: true })
    }
  }

  return {
    scoreDelta: current.score - baseline.score,
    addedFindings,
    resolvedFindings,
    ruleChanges,
  }
}

export interface ClauseBlastDraft {
  draftId: string
  draftTitle: string
  draftStatus: string
  draftVersion: number
  auditScore: number
  changeKind: 'updated' | 'added' | 'removed'
  auditedVer: number | null
  liveVer: number | null
  citedFindingsCount: number
}

export interface VaultBlastRadius {
  staleDraftIds: string[]
  byClause: Record<string, ClauseBlastDraft[]>
}

export function computeVaultBlastRadius(
  drafts: readonly { id: string; title: string; status: string; version: number }[],
  audits: Record<string, Pick<AuditResult, 'score' | 'vaultSnapshot' | 'findings'> | undefined>,
  vault: readonly Pick<VaultItemDTO, 'clauseId' | 'title' | 'ruleVer' | 'active'>[]
): VaultBlastRadius {
  const staleDraftIds: string[] = []
  const byClause: Record<string, ClauseBlastDraft[]> = {}

  const pushEntry = (clauseId: string, entry: ClauseBlastDraft) => {
    if (!byClause[clauseId]) byClause[clauseId] = []
    byClause[clauseId].push(entry)
  }

  for (const draft of drafts) {
    if (draft.status === 'APPROVED') continue
    const audit = audits[draft.id]
    if (!audit) continue
    const diff = diffVaultSnapshot(audit.vaultSnapshot, vault)
    if (!diff.isStale) continue

    staleDraftIds.push(draft.id)
    const findingsByClause = new Map<string, number>()
    for (const f of audit.findings) {
      if (f.clauseId) {
        findingsByClause.set(f.clauseId, (findingsByClause.get(f.clauseId) ?? 0) + 1)
      }
    }

    for (const u of diff.updated) {
      pushEntry(u.clauseId, {
        draftId: draft.id,
        draftTitle: draft.title,
        draftStatus: draft.status,
        draftVersion: draft.version,
        auditScore: audit.score,
        changeKind: 'updated',
        auditedVer: u.auditedVer,
        liveVer: u.liveVer,
        citedFindingsCount: findingsByClause.get(u.clauseId) ?? 0,
      })
    }
    for (const a of diff.added) {
      pushEntry(a.clauseId, {
        draftId: draft.id,
        draftTitle: draft.title,
        draftStatus: draft.status,
        draftVersion: draft.version,
        auditScore: audit.score,
        changeKind: 'added',
        auditedVer: null,
        liveVer: a.liveVer,
        citedFindingsCount: 0,
      })
    }
    for (const r of diff.removed) {
      pushEntry(r.clauseId, {
        draftId: draft.id,
        draftTitle: draft.title,
        draftStatus: draft.status,
        draftVersion: draft.version,
        auditScore: audit.score,
        changeKind: 'removed',
        auditedVer: r.auditedVer,
        liveVer: null,
        citedFindingsCount: findingsByClause.get(r.clauseId) ?? 0,
      })
    }
  }

  return { staleDraftIds, byClause }
}

