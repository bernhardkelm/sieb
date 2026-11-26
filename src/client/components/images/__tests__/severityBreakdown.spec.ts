import { describe, expect, it } from 'vitest'

import { describeSeverityBreakdown, severityBreakdown } from '@/components/images/severityBreakdown'

describe('severityBreakdown', () => {
  it('lists every severity in order, zeros included', () => {
    const counts = severityBreakdown({ Critical: 2, High: 0, Medium: 5, Low: 1, Unknown: 0 })

    expect(counts.map(({ severity }) => severity)).toEqual([
      'Critical',
      'High',
      'Medium',
      'Low',
      'Unknown',
    ])
    expect(counts.map(({ count }) => count)).toEqual([2, 0, 5, 1, 0])
  })

  it('describes non-zero counts in words', () => {
    const counts = severityBreakdown({ Critical: 2, High: 0, Medium: 5, Low: 0, Unknown: 1 })

    expect(describeSeverityBreakdown(counts)).toBe('2 critical, 5 medium, 1 unknown')
  })

  it('says so when nothing is open', () => {
    const counts = severityBreakdown({ Critical: 0, High: 0, Medium: 0, Low: 0, Unknown: 0 })

    expect(describeSeverityBreakdown(counts)).toBe('No open findings')
  })
})
