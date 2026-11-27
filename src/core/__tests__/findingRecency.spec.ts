import { describe, expect, it } from 'vitest'

import { isRecentFinding, isUnseenNew, newSince } from '#core/findingRecency.ts'

const NOW = new Date('2026-06-08T12:00:00.000Z')
const EDGE = '2026-06-01T12:00:00.000Z'
const OLDER = '2026-06-01T11:59:59.999Z'

describe('finding recency', () => {
  it('starts the recent window seven days before now', () => {
    expect(newSince(NOW)).toBe(EDGE)
    expect(isRecentFinding(EDGE, NOW)).toBe(true)
    expect(isRecentFinding(OLDER, NOW)).toBe(false)
  })

  it('counts a finding as new while recent and not seen by the user', () => {
    expect(isUnseenNew({ firstSeen: EDGE, seen: false }, NOW)).toBe(true)
    expect(isUnseenNew({ firstSeen: EDGE }, NOW)).toBe(true)
    expect(isUnseenNew({ firstSeen: EDGE, seen: true }, NOW)).toBe(false)
    expect(isUnseenNew({ firstSeen: OLDER, seen: false }, NOW)).toBe(false)
  })
})
