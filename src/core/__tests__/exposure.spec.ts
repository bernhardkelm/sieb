import { describe, expect, it } from 'vitest'

import {
  compareExposure,
  isExposure,
  maxExposure,
  parseExposure,
  type Exposure,
} from '#core/exposure.ts'

describe('exposure ordering', () => {
  it('sorts public, gated, unknown, internal', () => {
    const list: (Exposure | null)[] = ['internal', null, 'public', 'gated']

    expect([...list].sort(compareExposure)).toEqual(['public', 'gated', null, 'internal'])
  })

  it('returns the maximum, unknown above internal and for an empty list', () => {
    expect(maxExposure(['internal', 'gated'])).toBe('gated')
    expect(maxExposure(['internal', null])).toBeNull()
    expect(maxExposure([null, 'public'])).toBe('public')
    expect(maxExposure(['internal'])).toBe('internal')
    expect(maxExposure([])).toBeNull()
  })

  it('recognises exposure labels', () => {
    expect(isExposure('gated')).toBe(true)
    expect(isExposure('external')).toBe(false)
  })

  it('parses labels case-insensitively, unknown for missing or unrecognised ones', () => {
    expect(parseExposure('public')).toBe('public')
    expect(parseExposure(' Gated ')).toBe('gated')
    expect(parseExposure('external')).toBeNull()
    expect(parseExposure('')).toBeNull()
    expect(parseExposure(undefined)).toBeNull()
  })
})
