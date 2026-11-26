// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { createConsumedLogins } from '#server/auth/oidc/consumedLogins.ts'

describe('createConsumedLogins', () => {
  it('accepts each state once until its seal expires', () => {
    const now = { ms: 0 }
    const consumed = createConsumedLogins({ clock: () => new Date(now.ms) })

    expect(consumed.consume('a', 1000)).toBe(true)
    expect(consumed.consume('a', 1000)).toBe(false)
    expect(consumed.consume('b', 1000)).toBe(true)
    now.ms = 1000
    expect(consumed.consume('c', 2000)).toBe(true)
    expect(consumed.size()).toBe(1)
  })

  it('evicts the oldest entry beyond capacity', () => {
    const consumed = createConsumedLogins({ clock: () => new Date(0), max: 2 })

    consumed.consume('a', 1000)
    consumed.consume('b', 1000)
    consumed.consume('c', 1000)

    expect(consumed.size()).toBe(2)
    expect(consumed.consume('b', 1000)).toBe(false)
    expect(consumed.consume('a', 1000)).toBe(true)
  })
})
