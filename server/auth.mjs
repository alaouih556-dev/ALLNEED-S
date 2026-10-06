import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const KEYLEN = 64
const DEFAULTS = { N: 16384, r: 8, p: 1 }

export function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    throw new Error('mot de passe trop court')
  }
  const salt = randomBytes(16).toString('hex')
  const key = scryptSync(password, salt, KEYLEN, DEFAULTS)
  return `scrypt$${DEFAULTS.N}$${DEFAULTS.r}$${DEFAULTS.p}$${salt}$${key.toString('hex')}`
}

export function verifyPassword(password, stored) {
  if (typeof password !== 'string' || typeof stored !== 'string') return false
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const [, n, r, p, salt, hex] = parts
  try {
    const expected = Buffer.from(hex, 'hex')
    const actual = scryptSync(password, salt, KEYLEN, { N: Number(n), r: Number(r), p: Number(p) })
    if (actual.length !== expected.length) return false
    return timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

export function createSessionToken() {
  return randomBytes(32).toString('hex')
}

export function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex')
}
