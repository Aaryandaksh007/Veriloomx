import { describe, expect, test } from 'bun:test'
import { hashPassword, verifyPassword } from '../../src/lib/password'

describe('password credentials', () => {
  test('uses salted hashes and verifies only the matching password', () => {
    const first = hashPassword('a-long-test-password')
    const second = hashPassword('a-long-test-password')

    expect(first).not.toBe(second)
    expect(verifyPassword('a-long-test-password', first)).toBe(true)
    expect(verifyPassword('different-password', first)).toBe(false)
    expect(verifyPassword('a-long-test-password', 'malformed')).toBe(false)
  })
})
