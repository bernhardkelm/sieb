import { describe, expect, it } from 'vitest'

import { partVerdict, testPassed, testVerdict } from '#core/accessTestVerdict.ts'
import type { AccessTestPart, AccessTestResult } from '#core/privateAccess.ts'

const AT = '2026-11-27T09:00:00.000Z'

/**
 * Builds a part with no failures beyond the given ones.
 * @param {Partial<AccessTestPart>} overrides - Fields to set
 * @returns {AccessTestPart} - Part
 */
const part = (overrides: Partial<AccessTestPart>): AccessTestPart => ({
  checked: 2,
  ok: 2,
  failures: [],
  ...overrides,
})

/**
 * Builds a result of two parts.
 * @param {AccessTestPart} registry - Registry part
 * @param {AccessTestPart | null} git - Git part, null without the use
 * @returns {AccessTestResult} - Result
 */
const result = (registry: AccessTestPart, git: AccessTestPart | null): AccessTestResult => ({
  at: AT,
  registry,
  git,
})

describe('testVerdict', () => {
  it.each<[string, AccessTestPart, string]>([
    ['all reachable', part({}), 'passed'],
    [
      'one stale image',
      part({ ok: 1, failures: [{ target: 'a', reason: 'not found' }] }),
      'passed',
    ],
    ['a refused login', part({ ok: 1, denied: 1 }), 'test_failed'],
    [
      'a refused login of an older test',
      part({ ok: 1, failures: [{ target: 'a', reason: '403 forbidden' }] }),
      'test_failed',
    ],
    [
      'nothing reachable',
      part({ ok: 0, failures: [{ target: 'a', reason: 'timeout' }] }),
      'test_failed',
    ],
    ['no covered target', part({ checked: 0, ok: 0 }), 'nothing_to_test'],
    ['only private addresses', part({ ok: 0, blocked: 2 }), 'untestable'],
    ['private addresses and a timeout', part({ ok: 0, blocked: 1 }), 'test_failed'],
  ])('rates %s', (_, tested, verdict) => {
    expect(partVerdict(tested)).toBe(verdict)
  })

  it('lets the worst use decide', () => {
    expect(testVerdict(result(part({}), null))).toBe('passed')
    expect(testPassed(result(part({}), part({ checked: 0, ok: 0 })))).toBe(false)
    expect(testVerdict(result(part({ ok: 0, blocked: 2 }), part({ checked: 0, ok: 0 })))).toBe(
      'nothing_to_test',
    )
    expect(testVerdict(result(part({ ok: 0, blocked: 2 }), part({ ok: 0, denied: 2 })))).toBe(
      'test_failed',
    )
  })
})
