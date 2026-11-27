import { describe, expect, it } from 'vitest'

import {
  EXPOSURE_CAVEAT,
  EXPOSURE_MEANINGS,
  exposureMeaning,
  exposureNote,
} from '#core/exposureMeaning.ts'

describe('exposureMeaning', () => {
  it('returns the meaning of a tier and the unknown meaning for null', () => {
    expect(exposureMeaning('gated')).toBe(EXPOSURE_MEANINGS.gated)
    expect(exposureMeaning(null)).toContain('possibly reachable')
  })

  it('keeps the texts free of em and en dashes', () => {
    for (const text of [...Object.values(EXPOSURE_MEANINGS), EXPOSURE_CAVEAT]) {
      expect(text).not.toMatch(/[–—]/u)
    }
  })

  it('treats an IP allowlist as a gate and an app login as public', () => {
    expect(EXPOSURE_MEANINGS.gated).toContain('IP allowlist')
    expect(EXPOSURE_MEANINGS.gated).toContain(
      "the app's own login does not count, that stays public",
    )
    expect(EXPOSURE_MEANINGS.public).toContain("the app's own login does not count")
  })
})

describe('exposureNote', () => {
  it('explains each present tier once in rank order, then the caveat', () => {
    const note = exposureNote(['internal', null, 'public', 'internal'])

    expect(note).toBe(
      [
        `public: ${EXPOSURE_MEANINGS.public}`,
        `internal: ${EXPOSURE_MEANINGS.internal}`,
        `unknown: ${EXPOSURE_MEANINGS.unknown}`,
        EXPOSURE_CAVEAT,
      ].join('\n'),
    )
    expect(note).not.toContain('gated:')
  })

  it('is null without any exposure label', () => {
    expect(exposureNote([])).toBeNull()
    expect(exposureNote([null, null])).toBeNull()
  })
})
