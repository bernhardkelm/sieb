// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { parseStoredLocations, toStoredLocations } from '#server/db/storedLocations.ts'

describe('stored locations', () => {
  it('round-trips locations and stores none as NULL', () => {
    const locations = [{ target: 'Python', pkgPath: 'usr/lib/a/METADATA' }]

    expect(parseStoredLocations(toStoredLocations(locations))).toEqual(locations)
    expect(toStoredLocations([])).toBeNull()
    expect(parseStoredLocations(null)).toEqual([])
  })

  it('skips entries of an unexpected shape', () => {
    expect(parseStoredLocations('[1, {"target": 2}, {"target": "bin/a", "pkgPath": 3}]')).toEqual([
      { target: 'bin/a', pkgPath: null },
    ])
    expect(parseStoredLocations('{')).toEqual([])
  })
})
