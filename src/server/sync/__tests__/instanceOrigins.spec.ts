// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { listInstances } from '#server/db/instanceRepository.ts'
import { MEMORY_DB, openDatabase } from '#server/db/openDatabase.ts'
import { applySnapshot } from '#server/sync/applySnapshot.ts'

import { buildSnapshot } from '#server/db/__tests__/dbFixtures.ts'

const T1 = new Date('2026-06-01T00:00:00.000Z')
const T2 = new Date('2026-06-02T00:00:00.000Z')

const GO_ROW = {
  package: 'stdlib',
  installedVersion: 'v1.22.7',
  packageType: 'gobinary',
  packageClass: 'lang-pkgs',
  purl: 'pkg:golang/stdlib@v1.22.7',
}

describe('applySnapshot origins', () => {
  it('stores one instance with every distinct target when a package sits in several binaries', () => {
    const db = openDatabase(MEMORY_DB)
    const counts = applySnapshot(
      db,
      buildSnapshot([
        { ...GO_ROW, locations: [{ target: 'bin/prometheus', pkgPath: null }] },
        { ...GO_ROW, locations: [{ target: 'bin/promtool', pkgPath: null }] },
        { ...GO_ROW, locations: [{ target: 'bin/prometheus', pkgPath: null }] },
      ]),
      T1,
    )

    expect(counts.instancesNew).toBe(1)
    expect(counts.instancesSeen).toBe(1)
    expect(listInstances(db, 1)).toMatchObject([
      {
        ...GO_ROW,
        locations: [
          { target: 'bin/prometheus', pkgPath: null },
          { target: 'bin/promtool', pkgPath: null },
        ],
      },
    ])
  })

  it('keeps the origin per workload, so different workloads of one image differ', () => {
    const db = openDatabase(MEMORY_DB)

    applySnapshot(
      db,
      buildSnapshot([
        { ...GO_ROW, locations: [{ target: 'usr/local/bin/a', pkgPath: null }] },
        {
          ...GO_ROW,
          resourceName: 'worker-1',
          locations: [{ target: 'app/b', pkgPath: null }],
        },
      ]),
      T1,
    )

    expect(listInstances(db, 1).map((instance) => instance.locations)).toEqual([
      [{ target: 'usr/local/bin/a', pkgPath: null }],
      [{ target: 'app/b', pkgPath: null }],
    ])
  })

  it('overwrites the origin with what the latest report says, unknown stays empty', () => {
    const db = openDatabase(MEMORY_DB)

    applySnapshot(
      db,
      buildSnapshot([{ ...GO_ROW, locations: [{ target: 'bin/old', pkgPath: null }] }]),
      T1,
    )
    applySnapshot(db, buildSnapshot([{ package: 'stdlib', installedVersion: 'v1.22.7' }]), T2)

    expect(listInstances(db, 1)).toMatchObject([
      {
        locations: [],
        packageType: null,
        packageClass: null,
        purl: null,
        lastSeen: T2.toISOString(),
      },
    ])
    expect(db.prepare('SELECT locations FROM finding_instances').get()).toEqual({ locations: null })
  })
})
