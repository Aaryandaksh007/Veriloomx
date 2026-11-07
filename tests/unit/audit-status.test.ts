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

describe('audit completeness', () => {
  test('allows remediation when an audit has no findings and all checks completed', () => {
    expect(auditHasEngineErrors([pillar('pass'), pillar('skipped')])).toBe(false)
  })

  test('marks a failed engine as incomplete even when it produced no findings', () => {
    expect(auditHasEngineErrors([pillar('pass'), pillar('error')])).toBe(true)
  })
})
