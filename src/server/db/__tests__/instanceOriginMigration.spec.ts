// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { DatabaseSync } from 'node:sqlite'

import { buildSourceInstance } from '#core/__tests__/coreBuilders.ts'
import { instanceKey } from '#core/instanceKey.ts'
import { listInstances } from '#server/db/instanceRepository.ts'
import { MIGRATIONS, runMigrations, schemaVersion } from '#server/db/migrations.ts'
import { MIGRATION_11 } from '#server/db/migrations/migration11.ts'
import { MIGRATION_12 } from '#server/db/migrations/migration12.ts'
import { MEMORY_DB } from '#server/db/openDatabase.ts'
import { applySnapshot } from '#server/sync/applySnapshot.ts'

import { buildSnapshot, NGINX } from '#server/db/__tests__/dbFixtures.ts'

const T1 = '2026-06-01T00:00:00.000Z'

/**
 * Opens a version-11 database with one finding and one instance of the default source row.
 * @returns {DatabaseSync} - Database at user_version 11
 */
const version11Database = (): DatabaseSync => {
  const db = new DatabaseSync(MEMORY_DB)

  runMigrations(db, MIGRATIONS.slice(0, MIGRATIONS.indexOf(MIGRATION_11) + 1))
  db.prepare(
    `INSERT INTO findings (id, vuln_id, image_ref, severity, kev, exposure, owner, first_seen,
       last_seen) VALUES (1, 'CVE-2025-1000', ?, 'High', 0, 'internal', 'third-party', ?, ?)`,
  ).run(NGINX, T1, T1)
  db.prepare(
    `INSERT INTO finding_instances (finding_id, natural_key, namespace, resource_kind,
       resource_name, container, package, installed_version, first_seen, last_seen)
     VALUES (1, ?, 'shop', 'ReplicaSet', 'web-6d4f', 'web', 'libssl3', '3.0.1', ?, ?)`,
  ).run(instanceKey(buildSourceInstance()), T1, T1)

  return db
}

describe('migration 12', () => {
  it('follows migration 11 as the twelfth step', () => {
    expect(MIGRATIONS.indexOf(MIGRATION_12)).toBe(11)
  })

  it('adds nullable origin columns to a version-11 database and keeps its instances', () => {
    const db = version11Database()
    runMigrations(db)

    expect(schemaVersion(db)).toBe(MIGRATIONS.length)
    expect(
      db
        .prepare('SELECT locations, package_type, package_class, purl FROM finding_instances')
        .all(),
    ).toEqual([{ locations: null, package_type: null, package_class: null, purl: null }])
    expect(listInstances(db, 1)).toMatchObject([
      { package: 'libssl3', locations: [], packageType: null, packageClass: null, purl: null },
    ])
    expect(() => db.exec(`UPDATE finding_instances SET locations = '{"target":"a"}'`)).toThrow(
      /CHECK/,
    )
    expect(() => db.exec(`UPDATE finding_instances SET locations = 'not json'`)).toThrow(/CHECK/)
  })

  it('fills the columns of an existing instance on the next sync', () => {
    const db = version11Database()
    runMigrations(db)

    const counts = applySnapshot(
      db,
      buildSnapshot([
        {
          locations: [{ target: 'nginx:1.27 (debian 12.7)', pkgPath: null }],
          packageType: 'debian',
          packageClass: 'os-pkgs',
          purl: 'pkg:deb/debian/libssl3@3.0.1',
        },
      ]),
      new Date('2026-06-02T00:00:00.000Z'),
    )

    expect(counts.instancesNew).toBe(0)
    expect(listInstances(db, 1)).toMatchObject([
      {
        firstSeen: T1,
        locations: [{ target: 'nginx:1.27 (debian 12.7)', pkgPath: null }],
        packageType: 'debian',
        packageClass: 'os-pkgs',
        purl: 'pkg:deb/debian/libssl3@3.0.1',
      },
    ])
  })
})
