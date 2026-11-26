import { describe, expect, it } from 'vitest'

import {
  compareOwner,
  distinctOwners,
  firstOwner,
  isOwner,
  ownerSortKey,
  parseOwner,
} from '#core/owner.ts'

describe('parseOwner', () => {
  it('keeps free-form labels trimmed', () => {
    expect(parseOwner('self')).toBe('self')
    expect(parseOwner(' platform team ')).toBe('platform team')
    expect(parseOwner('x'.repeat(64))).toBe('x'.repeat(64))
  })

  it('drops missing, blank, long, comma and control character labels', () => {
    expect(parseOwner(undefined)).toBeNull()
    expect(parseOwner('  ')).toBeNull()
    expect(parseOwner('x'.repeat(65))).toBeNull()
    expect(parseOwner('a,b')).toBeNull()
    expect(parseOwner('a\nb')).toBeNull()
  })

  it('accepts only values parseOwner keeps as they are', () => {
    expect(isOwner('ops')).toBe(true)
    expect(isOwner(' ops')).toBe(false)
    expect(isOwner('a,b')).toBe(false)
  })
})

describe('owner ordering', () => {
  it('sorts self first, the others alphabetically, no owner last', () => {
    const owners = ['third-party', null, 'platform', 'self', 'ops']

    expect([...owners].sort(compareOwner)).toEqual(['self', 'ops', 'platform', 'third-party', null])
  })

  it('picks the first owner and lists the distinct ones', () => {
    expect(firstOwner(['platform', 'self', null])).toBe('self')
    expect(firstOwner(['third-party', 'platform'])).toBe('platform')
    expect(firstOwner([null])).toBeNull()
    expect(firstOwner([])).toBeNull()
    expect(distinctOwners(['ops', null, 'self', 'ops'])).toEqual(['self', 'ops'])
  })

  it('gives self the lowest text sort key', () => {
    expect(ownerSortKey('self')).toBe('')
    expect(ownerSortKey('ops')).toBe('ops')
    expect(ownerSortKey(null)).toBeNull()
  })
})
