import { describe, expect, it } from 'vitest'

import { isStatsRange, statsRangeStart } from '#core/statsRange.ts'

describe('statsRange', () => {
  it('accepts the known ranges only', () => {
    expect(['7d', '30d', '90d'].every(isStatsRange)).toBe(true)
    expect(['1d', '', 'toString', undefined].some(isStatsRange)).toBe(false)
  })

  it('starts a range its days before now', () => {
    expect(statsRangeStart('7d', new Date('2026-06-08T12:00:00.000Z')).toISOString()).toBe(
      '2026-06-01T12:00:00.000Z',
    )
  })
})
