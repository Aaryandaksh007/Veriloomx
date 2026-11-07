import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { VaultItem } from '@prisma/client'
import { runClaimsScan } from '../../src/lib/audit/deterministic'
import { liveScan } from '../../src/lib/live-check'
import type { VaultItemDTO } from '../../src/lib/types'

function vaultItem(
  clauseId: string,
  title: string,
  content: string,
  figures: string[]
): VaultItem {
  return {
    id: clauseId,
    clauseId,
    type: 'FACT',
    title,
    content,
    extra: JSON.stringify({ figures }),
    active: true,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  }
}

describe('deterministic claims scan', () => {
  const pricing = vaultItem(
    'VL-FACT-001',
    'Approved pricing',
    'Starter is $29/user/month. Growth is $79/user/month. Scale is $149/user/month.',
    ['$29', '$79', '$149']
  )

  function toVaultDto(item: VaultItem, figures: string[]): VaultItemDTO {
    return {
      id: item.id,
      clauseId: item.clauseId,
      type: 'FACT',
      title: item.title,
      content: item.content,
      extra: { figures },
      active: true,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    }
  }

  it('identifies an unapproved price as conflicting with the approved pricing fact', () => {
    const findings = runClaimsScan('The plan costs $999 per user each month.', [pricing])

    assert.equal(findings.length, 1)
    assert.equal(findings[0].severity, 'critical')
    assert.equal(findings[0].clauseId, 'VL-FACT-001')
    assert.match(findings[0].explanation, /VL-FACT-001/)
    assert.equal(findings[0].suggestion, null)
  })

  it('does not flag an approved price', () => {
    assert.equal(runClaimsScan('The Starter plan costs $29 per user each month.', [pricing]).length, 0)
  })

  it('only suggests a replacement when the approved fact has one unambiguous value', () => {
    const uniquePrice = vaultItem(
      'VL-FACT-009',
      'Approved event fee',
      'The event fee is $29.',
      ['$29']
    )
    const findings = runClaimsScan('The event fee is $999.', [uniquePrice])

    assert.equal(findings[0].suggestion, '$29')
  })

  it('cites the approved pricing clause in the live copy scanner', () => {
    const result = liveScan('Plans start at $39/user/month.', [
      toVaultDto(pricing, ['$29', '$79', '$149']),
    ])

    assert.equal(result.hits[0].value, '$39')
    assert.equal(result.hits[0].clauseId, 'VL-FACT-001')
  })

  it('grounds trial, uptime and customer-count mistakes in their matching Vault facts', () => {
    const trial = vaultItem('VL-FACT-005', 'Free trial terms', 'Inkloom offers a 14-day free trial.', ['14'])
    const uptime = vaultItem('VL-FACT-003', 'Uptime commitment', 'Inkloom guarantees a 99.9% uptime SLA.', ['99.9'])
    const customers = vaultItem(
      'VL-FACT-002',
      'Customer base',
      'Inkloom serves 12,000+ teams across 68 countries.',
      ['12,000', '68']
    )
    const result = liveScan(
      'Scale customers get a 30-day free trial and our 99.99% uptime guarantee, trusted by 15,000+ teams across 90 countries.',
      [
        toVaultDto(trial, ['14']),
        toVaultDto(uptime, ['99.9']),
        toVaultDto(customers, ['12,000', '68']),
      ]
    )
    const clauseFor = (value: string) => result.hits.find((hit) => hit.value === value)?.clauseId

    assert.equal(clauseFor('30-day'), 'VL-FACT-005')
    assert.equal(clauseFor('99.99%'), 'VL-FACT-003')
    assert.equal(clauseFor('15,000+'), 'VL-FACT-002')
    assert.equal(clauseFor('90'), 'VL-FACT-002')
  })
})
