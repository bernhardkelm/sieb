import { describe, expect, it } from 'vitest'

import {
  describeSeverityMix,
  formatShare,
  severitySegments,
} from '@/components/overview/severityMix'

describe('severitySegments', () => {
  it('lists non-empty severities in order with their share', () => {
    const segments = severitySegments({ critical: 1, high: 3, medium: 0, low: 196, unknown: 0 })

    expect(segments.map(({ key, count, shareLabel }) => [key, count, shareLabel])).toEqual([
      ['critical', 1, '<1%'],
      ['high', 3, '2%'],
      ['low', 196, '98%'],
    ])
    expect(segments.reduce((sum, { share }) => sum + share, 0)).toBeCloseTo(1)
  })

  it('returns no segments without findings', () => {
    expect(severitySegments({ critical: 0, high: 0, medium: 0, low: 0, unknown: 0 })).toEqual([])
  })
})

describe('formatShare', () => {
  it('rounds to whole percent and marks tiny shares', () => {
    expect(formatShare(0)).toBe('0%')
    expect(formatShare(0.004)).toBe('<1%')
    expect(formatShare(0.126)).toBe('13%')
  })
})

describe('describeSeverityMix', () => {
  it('names every segment with count and share', () => {
    const segments = severitySegments({ critical: 2, high: 2, medium: 0, low: 0, unknown: 0 })

    expect(describeSeverityMix(segments)).toBe('Critical 2 (50%), High 2 (50%)')
    expect(describeSeverityMix([])).toBe('No open findings')
  })
})
