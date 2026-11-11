import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'

const KEY_LENGTH = 64

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, KEY_LENGTH).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, expectedHex] = stored.split(':')
  if (!salt || !expectedHex || !/^[a-f0-9]{128}$/i.test(expectedHex)) return false
  const actual = scryptSync(password, salt, KEY_LENGTH)
  const expected = Buffer.from(expectedHex, 'hex')
  return timingSafeEqual(actual, expected)
}
