/// <reference types="bun-types" />

import { createHash } from 'crypto'
import { describe, expect, test } from 'bun:test'
import {
  buildCertificateCanonicalJson,
  sha256HexWebCrypto,
  type CanonicalCertificateInput,
} from '../../src/lib/certificate-hash'

function baseCertInput(): CanonicalCertificateInput {
  return {
    draft: {
      id: 'draft-1',
      title: 'Q4 Launch Post',
      version: 2,
      channel: 'LinkedIn',
    },
    audit: {
      id: 'audit-2',
      score: 92,
      findings: [
        {
          key: 'claims:VL-FACT-001:99',
          pillar: 'claims',
          severity: 'warning',
          clauseId: 'VL-FACT-001',
        },
      ],
      suppressed: 1,
      vaultSnapshot: [
        { clauseId: 'VL-FACT-001', ruleVer: 2 },
        { clauseId: 'VL-VOICE-001', ruleVer: 1 },
      ],
    },
    overrides: [
      {
        key: 'claims:VL-FACT-001:99',
        note: 'Legal approved launch discount framing for Q4.',
        actor: 'Priya Nair',
      },
    ],
    models: ['gemini-2.5-flash'],
  }
}

describe('certificate hashing parity & tamper detection', () => {
  test('Node crypto SHA-256 and WebCrypto SHA-256 produce identical hex digests', async () => {
    const canonical = buildCertificateCanonicalJson(baseCertInput())
    const nodeDigest = createHash('sha256').update(canonical).digest('hex')
    const webDigest = await sha256HexWebCrypto(canonical)

    expect(webDigest).toBe(nodeDigest)
    expect(webDigest).toHaveLength(64)
  })

  test('detects mutations to audit score, human overrides, or Vault rule snapshot versions', async () => {
    const original = baseCertInput()
    const baseHash = await sha256HexWebCrypto(buildCertificateCanonicalJson(original))

    const alteredScore: CanonicalCertificateInput = {
      ...original,
      audit: { ...original.audit, score: 100 },
    }
    const strippedOverride: CanonicalCertificateInput = {
      ...original,
      overrides: [],
    }
    const alteredVaultVersion: CanonicalCertificateInput = {
      ...original,
      audit: {
        ...original.audit,
        vaultSnapshot: [
          { clauseId: 'VL-FACT-001', ruleVer: 1 },
          { clauseId: 'VL-VOICE-001', ruleVer: 1 },
        ],
      },
    }

    const [scoreHash, overrideHash, vaultHash] = await Promise.all([
      sha256HexWebCrypto(buildCertificateCanonicalJson(alteredScore)),
      sha256HexWebCrypto(buildCertificateCanonicalJson(strippedOverride)),
      sha256HexWebCrypto(buildCertificateCanonicalJson(alteredVaultVersion)),
    ])

    expect(scoreHash).not.toBe(baseHash)
    expect(overrideHash).not.toBe(baseHash)
    expect(vaultHash).not.toBe(baseHash)
  })
})

