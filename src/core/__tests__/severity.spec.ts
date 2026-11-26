import { describe, expect, it } from 'vitest'

import {
  compareSeverity,
  isSeverityHigher,
  maxSeverity,
  parseSeverity,
  severityFromScore,
  type Severity,
} from '#core/severity.ts'

describe('severity ordering', () => {
  it('sorts the most severe first', () => {
    const list: Severity[] = ['Low', 'Unknown', 'Critical', 'Medium', 'High']

    expect([...list].sort(compareSeverity)).toEqual([
      'Critical',
      'High',
      'Medium',
      'Low',
      'Unknown',
    ])
  })

  it('detects a strictly higher severity', () => {
    expect(isSeverityHigher('High', 'Medium')).toBe(true)
    expect(isSeverityHigher('High', 'High')).toBe(false)
    expect(isSeverityHigher('Low', 'Unknown')).toBe(true)
  })

  it('returns the maximum, Unknown for an empty list', () => {
    expect(maxSeverity(['Low', 'High', 'Medium'])).toBe('High')
    expect(maxSeverity([])).toBe('Unknown')
  })

  it('parses title and upper case labels', () => {
    expect(parseSeverity('Critical')).toBe('Critical')
    expect(parseSeverity('HIGH')).toBe('High')
    expect(parseSeverity('bogus')).toBe('Unknown')
    expect(parseSeverity(undefined)).toBe('Unknown')
  })

  it('bands CVSS scores', () => {
    expect(severityFromScore(9.8)).toBe('Critical')
    expect(severityFromScore(7)).toBe('High')
    expect(severityFromScore(6.9)).toBe('Medium')
    expect(severityFromScore(0.1)).toBe('Low')
    expect(severityFromScore(0)).toBe('Unknown')
    expect(severityFromScore(null)).toBe('Unknown')
  })
})
