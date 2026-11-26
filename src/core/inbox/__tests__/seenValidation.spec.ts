import { describe, expect, it } from 'vitest'

import { MAX_SEEN_KEYS, validateSeenKeys } from '#core/inbox/seenValidation.ts'

const EXPIRING = 'expiring:3:2026-06-15T00:00:00.000Z'

describe('validateSeenKeys', () => {
  it('accepts expiring and KEV keys and collapses duplicates', () => {
    expect(validateSeenKeys({ keys: ['kev:1', EXPIRING, 'kev:1'] })).toEqual({
      ok: true,
      value: ['kev:1', EXPIRING],
    })
    expect(validateSeenKeys({ keys: [] })).toEqual({ ok: true, value: [] })
  })

  it('rejects a missing or malformed list and too many keys', () => {
    expect(validateSeenKeys({})).toEqual({
      ok: false,
      errors: [{ field: 'keys', code: 'required' }],
    })
    expect(validateSeenKeys({ keys: 'kev:1' })).toEqual({
      ok: false,
      errors: [{ field: 'keys', code: 'invalid' }],
    })
    expect(
      validateSeenKeys({
        keys: Array.from({ length: MAX_SEEN_KEYS + 1 }, (_, i) => `kev:${i + 1}`),
      }),
    ).toEqual({ ok: false, errors: [{ field: 'keys', code: 'too_many' }] })
    expect(
      validateSeenKeys({ keys: Array.from({ length: MAX_SEEN_KEYS }, (_, i) => `kev:${i + 1}`) })
        .ok,
    ).toBe(true)
  })

  it('names each bad key, proposals and re-opens as not seeable', () => {
    expect(
      validateSeenKeys({ keys: ['kev:1', 'proposal:2', 'reopened:1:pending', 7, 'kev:x', 'x:1'] }),
    ).toEqual({
      ok: false,
      errors: [
        { field: 'keys.1', code: 'not_seeable' },
        { field: 'keys.2', code: 'not_seeable' },
        { field: 'keys.3', code: 'invalid' },
        { field: 'keys.4', code: 'invalid' },
        { field: 'keys.5', code: 'invalid' },
      ],
    })
  })
})
