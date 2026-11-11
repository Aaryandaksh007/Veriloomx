/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test'
import { diffVaultSnapshot, compareAudits } from '../../src/lib/vault-lineage'
import { selectGoverningAudit, selectWorkspaceAudit } from '../../src/lib/governance'
import { wordDiff } from '../../src/lib/diff'
import type { AuditResult, Finding, PillarSummary } from '../../src/lib/types'

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    key: 'claims:VL-FACT-001:999',
    pillar: 'claims',
    engine: 'deterministic',
    severity: 'critical',
    title: 'Unapproved pricing',
    quote: '$999/user/month',
    explanation: 'Conflicts with VL-FACT-001.',
    suggestion: '$29/user/month',
    suggestionSource: 'deterministic',
    clauseId: 'VL-FACT-001',
    clauseTitle: 'Approved pricing',
    clauseQuote: 'Starter is $29/user/month.',
    ...overrides,
  }
}

function makePillars(): PillarSummary[] {
  return (
    ['tone', 'terminology', 'claims', 'visual', 'accessibility', 'confidentiality'] as const
  ).map((pillar) => ({
    pillar,
    engine: 'deterministic',
    status: 'pass',
    critical: 0,
    warning: 0,
    info: 0,
    durationMs: 1,
    detail: 'ok',
  }))
}

function makeAudit(overrides: Partial<AuditResult> = {}): AuditResult {
  return {
    id: 'audit-1',
    draftId: 'draft-1',
    version: 1,
    score: 80,
    vaultSnapshot: [
      { clauseId: 'VL-FACT-001', ruleVer: 1 },
      { clauseId: 'VL-TERM-001', ruleVer: 1 },
    ],
    pillars: makePillars(),
    findings: [makeFinding()],
    suppressed: 0,
    redactedPreview: null,
    aiLedger: [],
    createdAt: '2026-11-11T10:00:00.000Z',
    ...overrides,
  }
}

describe('diffVaultSnapshot', () => {
  test('detects updated, newly added active, and archived/removed rules', () => {
    const diff = diffVaultSnapshot(
      [
        { clauseId: 'VL-FACT-001', ruleVer: 1 },
        { clauseId: 'VL-TERM-001', ruleVer: 1 },
        { clauseId: 'VL-VOICE-001', ruleVer: 2 },
      ],
      [
        { clauseId: 'VL-FACT-001', title: 'Approved pricing', ruleVer: 2, active: true },
        { clauseId: 'VL-TERM-001', title: 'Approved terms', ruleVer: 1, active: false },
        { clauseId: 'VL-VOICE-001', title: 'Brand voice', ruleVer: 2, active: true },
        { clauseId: 'VL-FACT-009', title: 'New SLA rule', ruleVer: 1, active: true },
        { clauseId: 'VL-FACT-010', title: 'Archived draft rule', ruleVer: 1, active: false },
      ]
    )

    expect(diff.isStale).toBe(true)
    expect(diff.staleCount).toBe(3)
    expect(diff.updated).toEqual([
      { clauseId: 'VL-FACT-001', title: 'Approved pricing', auditedVer: 1, liveVer: 2, active: true },
    ])
    expect(diff.removed).toEqual([{ clauseId: 'VL-TERM-001', auditedVer: 1 }])
    expect(diff.added).toEqual([{ clauseId: 'VL-FACT-009', title: 'New SLA rule', liveVer: 1 }])
  })

  test('returns empty non-stale diff when snapshot or vault is empty', () => {
    expect(diffVaultSnapshot(null, [])).toEqual({
      updated: [],
      added: [],
      removed: [],
      staleCount: 0,
      isStale: false,
    })
  })
})

describe('compareAudits', () => {
  test('computes score delta, added/resolved findings, and rule changes', () => {
    const baseline = makeAudit({
      id: 'audit-v1',
      score: 65,
      findings: [
        makeFinding({ key: 'f1', clauseId: 'VL-FACT-001', quote: '99.99% uptime' }),
        makeFinding({ key: 'f2', pillar: 'tone', clauseId: 'VL-VOICE-001', quote: 'AwesomeSauce!' }),
      ],
      vaultSnapshot: [
        { clauseId: 'VL-FACT-001', ruleVer: 1 },
        { clauseId: 'VL-VOICE-001', ruleVer: 1 },
      ],
    })
    const current = makeAudit({
      id: 'audit-v2',
      score: 90,
      findings: [
        makeFinding({ key: 'f1-dup', clauseId: 'VL-FACT-001', quote: '  99.99%   uptime ' }),
        makeFinding({ key: 'f3', pillar: 'terminology', clauseId: 'VL-TERM-002', quote: 'SaaSify' }),
      ],
      vaultSnapshot: [
        { clauseId: 'VL-FACT-001', ruleVer: 2 },
        { clauseId: 'VL-TERM-002', ruleVer: 1 },
      ],
    })

    const comparison = compareAudits(baseline, current)
    expect(comparison.scoreDelta).toBe(25)
    expect(comparison.resolvedFindings.map((f) => f.clauseId)).toEqual(['VL-VOICE-001'])
    expect(comparison.addedFindings.map((f) => f.clauseId)).toEqual(['VL-TERM-002'])
    expect(comparison.ruleChanges).toEqual([
      { clauseId: 'VL-FACT-001', fromVer: 1, toVer: 2 },
      { clauseId: 'VL-TERM-002', fromVer: null, toVer: 1 },
      { clauseId: 'VL-VOICE-001', fromVer: 1, toVer: null, removed: true },
    ])
  })
})

describe('governance audit selection', () => {
  const versions = [
    { version: 1, note: 'Initial draft', createdAt: '2026-11-11T09:00:00.000Z' },
    { version: 2, note: 'Remediated 2 findings', createdAt: '2026-11-11T10:30:00.000Z' },
  ]

  test('ignores post-remediation historical v1 re-audits when selecting governing audit for v2', () => {
    const auditsNewestFirst = [
      { id: 'historical-v1-rerun', version: 1, createdAt: '2026-11-11T11:00:00.000Z' },
      { id: 'pre-remediation-v1', version: 1, createdAt: '2026-11-11T10:00:00.000Z' },
    ]

    const governing = selectGoverningAudit(
      { version: 2, status: 'REMEDIATED' },
      auditsNewestFirst,
      versions
    )
    expect(governing?.id).toBe('pre-remediation-v1')
  })

  test('prefers direct audit on current version and respects certifiedAuditId', () => {
    const auditsNewestFirst = [
      { id: 'audit-v2', version: 2, createdAt: '2026-11-11T11:15:00.000Z' },
      { id: 'audit-v1', version: 1, createdAt: '2026-11-11T10:00:00.000Z' },
    ]

    expect(
      selectGoverningAudit({ version: 2, status: 'AUDITED' }, auditsNewestFirst, versions)?.id
    ).toBe('audit-v2')

    expect(
      selectGoverningAudit(
        { version: 2, status: 'APPROVED' },
        auditsNewestFirst,
        versions,
        'audit-v1'
      )?.id
    ).toBe('audit-v1')
  })

  test('returns null from selectGoverningAudit for un-remediated manual edits, while selectWorkspaceAudit falls back', () => {
    const editedVersions = [
      { version: 1, note: 'Initial draft', createdAt: '2026-11-11T09:00:00.000Z' },
      { version: 2, note: 'Manual copy edit', createdAt: '2026-11-11T10:30:00.000Z' },
    ]
    const audits = [{ id: 'audit-v1', version: 1, createdAt: '2026-11-11T10:00:00.000Z' }]

    expect(selectGoverningAudit({ version: 2, status: 'DRAFT' }, audits, editedVersions)).toBeNull()
    expect(selectWorkspaceAudit({ version: 2, status: 'DRAFT' }, audits, editedVersions)?.id).toBe(
      'audit-v1'
    )
  })
})

describe('wordDiff', () => {
  test('highlights added and removed words cleanly', () => {
    const tokens = wordDiff('Starter costs $999 per month.', 'Starter costs $29 per month.')
    expect(tokens.filter((t) => t.op === 'remove').map((t) => t.text).join('').trim()).toBe('$999')
    expect(tokens.filter((t) => t.op === 'add').map((t) => t.text).join('').trim()).toBe('$29')
    expect(tokens.some((t) => t.op === 'same' && t.text.includes('Starter'))).toBe(true)
  })
})
