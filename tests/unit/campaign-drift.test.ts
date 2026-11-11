import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { compareCampaignClaims, extractNumericClaims } from '../../src/lib/campaign-drift'

describe('cross-channel campaign claim comparison', () => {
  it('surfaces changed and omitted numeric claims in both directions', () => {
    const result = compareCampaignClaims(
      'Starter costs $29/user/month with a 14-day trial and 99.9% uptime.',
      'Starter costs $39/user/month with a 30-day trial and 99.99% uptime.'
    )

    assert.deepEqual(result.sourceOnly.map((claim) => claim.value), [
      '$29/user/month',
      '14-day',
      '99.9%',
    ])
    assert.deepEqual(result.variantOnly.map((claim) => claim.value), [
      '$39/user/month',
      '30-day',
      '99.99%',
    ])
  })

  it('normalizes grouping, spacing, and plural day units', () => {
    const result = compareCampaignClaims(
      '12,000+ teams and a 14-day trial at $29/user/month.',
      '12000+ teams and a 14 days trial at $29 / user / month.'
    )

    assert.deepEqual(result.sourceOnly, [])
    assert.deepEqual(result.variantOnly, [])
    assert.equal(result.matched, 3)
  })

  it('retains meaningful currency and percentage distinctions', () => {
    const result = compareCampaignClaims('Price is $29 and uptime is 99.9%.', 'Price is €29 and uptime is 99.9.')

    assert.deepEqual(result.sourceOnly.map((claim) => claim.value), ['$29', '99.9%'])
    assert.deepEqual(result.variantOnly.map((claim) => claim.value), ['€29', '99.9'])
  })

  it('deduplicates repeated figures and handles empty or non-numeric copy', () => {
    assert.equal(extractNumericClaims('Try it for $29, then pay $29/month.').length, 2)
    assert.deepEqual(compareCampaignClaims('', ''), {
      sourceOnly: [],
      variantOnly: [],
      matched: 0,
    })
    assert.deepEqual(compareCampaignClaims('Welcome to Inkloom.', 'Welcome to Inkloom!'), {
      sourceOnly: [],
      variantOnly: [],
      matched: 0,
    })
  })
})
