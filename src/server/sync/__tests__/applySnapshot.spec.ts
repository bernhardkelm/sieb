// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { getFinding } from '#server/db/findingRepository.ts'
import { listInstances } from '#server/db/instanceRepository.ts'
import { MEMORY_DB, openDatabase } from '#server/db/openDatabase.ts'
import { applySnapshot } from '#server/sync/applySnapshot.ts'

import { buildSnapshot, NGINX } from '#server/db/__tests__/dbFixtures.ts'

const T1 = new Date('2026-06-01T00:00:00.000Z')
const T2 = new Date('2026-06-02T00:00:00.000Z')
const T3 = new Date('2026-06-03T00:00:00.000Z')

describe('applySnapshot', () => {
  it('inserts findings and instances with first_seen and aggregated fields', () => {
    const db = openDatabase(MEMORY_DB)
    const counts = applySnapshot(
      db,
      buildSnapshot(
        [
          { severity: 'Medium', exposure: 'public' },
          { severity: 'High', package: 'libcrypto3' },
          { severity: 'High', package: 'libcrypto3' },
        ],
        ['CVE-2025-1000'],
      ),
      T1,
    )

    expect(counts).toEqual({
      findingsSeen: 1,
      findingsNew: 1,
      findingsResolved: 0,
      findingsReappeared: 0,
      instancesSeen: 2,
      instancesNew: 2,
      instancesResolved: 0,
    })
    expect(getFinding(db, 1)).toMatchObject({
      vulnId: 'CVE-2025-1000',
      imageRef: NGINX,
      severity: 'High',
      exposure: 'public',
      kev: true,
      firstSeen: T1.toISOString(),
      lastSeen: T1.toISOString(),
      resolvedAt: null,
    })
  })

  it('resolves absent findings and instances and clears that when they reappear', () => {
    const db = openDatabase(MEMORY_DB)
    const both = buildSnapshot([
      {},
      { vulnId: 'CVE-2025-2000', package: 'zlib' },
      { package: 'libcrypto3' },
    ])

    applySnapshot(db, both, T1)

    expect(applySnapshot(db, buildSnapshot([{}]), T2)).toMatchObject({
      findingsSeen: 1,
      findingsResolved: 1,
      instancesResolved: 2,
    })
    expect(getFinding(db, 2)?.resolvedAt).toBe(T2.toISOString())
    expect(listInstances(db, 1).map((instance) => [instance.package, instance.resolvedAt])).toEqual(
      [
        ['libssl3', null],
        ['libcrypto3', T2.toISOString()],
      ],
    )

    expect(applySnapshot(db, both, T3)).toMatchObject({
      findingsReappeared: 1,
      findingsNew: 0,
      instancesNew: 0,
    })
    expect(getFinding(db, 2)).toMatchObject({
      resolvedAt: null,
      firstSeen: T1.toISOString(),
      lastSeen: T3.toISOString(),
    })
    expect(listInstances(db, 1).every((instance) => instance.resolvedAt === null)).toBe(true)
  })

  it('keeps Prometheus-only rows as one instance without package', () => {
    const db = openDatabase(MEMORY_DB)
    const row = { container: null, package: null, installedVersion: null, fixedVersion: null }

    applySnapshot(db, buildSnapshot([row]), T1)
    applySnapshot(db, buildSnapshot([row]), T2)

    expect(listInstances(db, 1)).toMatchObject([{ package: null, lastSeen: T2.toISOString() }])
  })
})
