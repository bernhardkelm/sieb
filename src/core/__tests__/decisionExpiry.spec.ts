import { describe, expect, it } from 'vitest'

import { defaultExpiresAt, isExpired } from '#core/decisionExpiry.ts'

import { NOW } from './coreBuilders.ts'

describe('defaultExpiresAt', () => {
  it('expires accepted risks after 90 days', () => {
    expect(defaultExpiresAt('accepted', NOW)).toBe('2026-08-30T12:00:00.000Z')
  })

  it('never expires other statuses by default', () => {
    expect(defaultExpiresAt('not_affected', NOW)).toBeNull()
    expect(defaultExpiresAt('fix_planned', NOW)).toBeNull()
  })
})

describe('isExpired', () => {
  it('treats the expiry instant itself as expired', () => {
    expect(isExpired(NOW.toISOString(), NOW)).toBe(true)
    expect(isExpired('2026-06-01T12:00:01.000Z', NOW)).toBe(false)
    expect(isExpired(null, NOW)).toBe(false)
  })
})
