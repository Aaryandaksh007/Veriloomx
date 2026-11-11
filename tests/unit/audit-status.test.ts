/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test'
import { auditHasEngineErrors, type PillarSummary } from '../../src/lib/types'

function pillar(status: PillarSummary['status']): PillarSummary {
  return {
    pillar: 'claims',
    engine: 'hybrid',
    status,
    critical: 0,
    warning: 0,
    info: 0,
    durationMs: 1,
    detail: '',
  }
}

function completeAudit(status: PillarSummary['status'] = 'pass'): PillarSummary[] {
  const pillars: PillarSummary['pillar'][] = [
    'tone',
    'terminology',
    'claims',
    'visual',
    'accessibility',
    'confidentiality',
  ]
  return pillars.map((pillarName) => ({ ...pillar(status), pillar: pillarName }))
}

describe('audit completeness', () => {
  test('allows remediation when an audit has no findings and all checks completed', () => {
    expect(auditHasEngineErrors(completeAudit())).toBe(false)
  })

  test('allows intentionally skipped pillars when the full summary is present', () => {
    const pillars = completeAudit()
    pillars[3] = { ...pillars[3], status: 'skipped' }
    expect(auditHasEngineErrors(pillars)).toBe(false)
  })

  test('marks a failed engine as incomplete even when it produced no findings', () => {
    const pillars = completeAudit()
    pillars[2] = pillar('error')
    expect(auditHasEngineErrors(pillars)).toBe(true)
  })

  test('marks missing or duplicate pillar summaries as incomplete', () => {
    const missing = completeAudit()
    missing.pop()
    expect(auditHasEngineErrors(missing)).toBe(true)

    const duplicate = completeAudit()
    duplicate[1] = { ...duplicate[0] }
    expect(auditHasEngineErrors(duplicate)).toBe(true)
  })

  test('marks absent audit summaries as incomplete', () => {
    expect(auditHasEngineErrors([])).toBe(true)
    expect(auditHasEngineErrors(null)).toBe(true)
  })
})
