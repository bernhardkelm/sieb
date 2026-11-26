import { describe, expect, it } from 'vitest'

import {
  expiringKey,
  inboxKindOf,
  kevKey,
  proposalKey,
  reopenedKey,
  seeableKindOf,
} from '#core/inbox/inboxKeys.ts'

describe('inbox keys', () => {
  it('builds keys per kind and reads their kind back', () => {
    const at = '2026-06-15T00:00:00.000Z'

    expect([
      proposalKey(3),
      reopenedKey(4, at),
      reopenedKey(4, null),
      expiringKey(5, at),
      kevKey(6),
    ]).toEqual([
      'proposal:3',
      `reopened:4:${at}`,
      'reopened:4:pending',
      `expiring:5:${at}`,
      'kev:6',
    ])
    expect(inboxKindOf(`expiring:5:${at}`)).toBe('expiring')
    expect(inboxKindOf('other:1')).toBeNull()
    expect(inboxKindOf('kev')).toBeNull()
  })

  it('accepts only well-formed expiring and KEV keys as seeable', () => {
    expect(seeableKindOf('kev:12')).toBe('kev')
    expect(seeableKindOf('expiring:3:2026-06-15T00:00:00.000Z')).toBe('expiring')
    expect(seeableKindOf('proposal:1')).toBeNull()
    expect(seeableKindOf('reopened:1:2026-06-15T00:00:00.000Z')).toBeNull()
    expect(seeableKindOf('kev:0')).toBeNull()
    expect(seeableKindOf('kev:01')).toBeNull()
    expect(seeableKindOf('kev:1:x')).toBeNull()
    expect(seeableKindOf('expiring:3:not-a-date')).toBeNull()
    expect(seeableKindOf('expiring:3:')).toBeNull()
    expect(seeableKindOf(`expiring:3:2026-06-15T00:00:00.000Z${' '.repeat(120)}`)).toBeNull()
  })
})
